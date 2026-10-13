# 2. Interfaces and communication

Normative chapter of the [SWAML 0.1 specification](../LANGUAGE_SPECIFICATION.md).

## 2.1 Contract identity and members

An interface declaration has a kind, package-qualified name, explicit `major.minor.patch` version string, and at least one member. Its identity is its declaration plus that version. Member names are unique across the entire interface; operation overloading is absent.

| Kind | Permitted members | Port roles |
| --- | --- | --- |
| `senderReceiver` | `data name: T sampled;` or `queued;` | `sender`, `receiver` |
| `clientServer` | operation signatures | `client`, `server` |
| `publishSubscribe` | event signatures | `publisher`, `subscriber` |
| `service` | operation and event signatures | `provides`, `requires` |

An operation signature declares ordered input parameters, a result, and optionally `idempotent`. An event signature declares zero or more ordered payload parameters and no result. Data is one typed value. A notification without payload uses a zero-parameter event. No event may be declared directly in a package, unit, component or state.

A service field is modeled explicitly as a getter operation, optional setter operation and changed event. This avoids a second implicit communication mechanism. A setter returns an application result; its implementation owns the decision whether and when to publish the changed event. Property storage never becomes remotely writable data.

Version strings document compatibility intent: a breaking change SHOULD increase major; additive changes SHOULD increase minor; a meaning-preserving correction SHOULD increase patch. However, 0.1 performs **exact nominal matching**, not automatic version negotiation. Use a differently named declaration for another version in the same package and an adapter between versions. Adding an event may require a new receiver and is not automatically compatible with an existing complete implementation.

## 2.2 Ports and boundary exposure

A port belongs to one unit or component and references exactly one interface. Its role must be legal for that interface kind. `optional` permits the port to have zero connections in a closed system; it does not relax type, direction, handler or emission requirements.

A connector joins immediate child ports of its owner: `connect name: child.port -> child.port qos { … };`. Its owner is a component or system. Both paths MUST have exactly two segments and reference ports, not members, operations, variables, states or grandchildren. The interface declarations MUST be identical.

Legal connector orientations are sender → receiver, client → server, publisher → subscriber, and requires → provides. The last two roles support provider-to-consumer event traffic over the same service contract; the arrow denotes the request orientation, not a unidirectional transport restriction.

A component port MUST have exactly one delegation to an immediate child port: `delegate outer -> child.port;`. Delegation MUST preserve role and nominal interface. It is a forwarding boundary, with no implicit queue, payload conversion, delivery retry or additional source. Child components can delegate again. To cross a hierarchy, expose a port at each boundary; no connector may tunnel to a grandchild.

At system closure, recursively expand instances, resolve each delegation to a leaf unit port, and inspect actual connector endpoints. Every nonoptional leaf port MUST be connected. Receiver ports have exactly one source; client/requires ports have exactly one provider. Sender, publisher, server and provides ports can participate in multiple connectors. Subscriber ports may receive from multiple publishers. A duplicate identical connector is an error; it must not create an accidental duplicate subscription. A component may not expose the same child port under two aliases in 0.1.

## 2.3 Emission and reception ownership

A unit's outgoing data/event member MUST occur in at least one `send`/`publish` statement inside one of its operations, including a state entry, exit or transition effect. This is a static provenance relationship, not a proof of reachability or a promise that the operation always emits.

Each incoming data/event member MUST have exactly one handler owner: an ordinary operation triggered by that member, or one stateful operation containing one or more receiving transitions for it. An operation signature on a server/provides port MUST have exactly one ordinary operation with `on call port.member`. Several transitions in one stateful operation count as one owner. Two different operations receiving the same member are invalid. To intentionally fan out processing, use a local coordinating handler that invokes helpers, or explicit subscriber units.

An ordinary handler MUST reproduce the member's ordered parameter types. Names may differ. A data handler has one parameter of the data type; an event handler has the event's parameter list. Both return Void. An RPC handler MUST also reproduce the signature's result type.

## 2.4 Exchange semantics

`send p.data(value);` emits one typed data value through a sender port. `publish p.event(args);` emits one typed event through a publisher/provides port. Both paths are exactly `localPort.member`. The transfer copies the value; a target implementation may use zero-copy storage only if it preserves isolation and observable value semantics.

For each outgoing permitted connector, the communication system independently offers the message to that connector's destination queue. Emission does not execute a remote handler on the caller's stack. A `reject` overflow fails the emitting activation for that connector. For fan-out, delivery to earlier subscribers cannot be rolled back; a partially successful publish may therefore be followed by failure. Programs needing atomic broadcast must model a protocol explicitly.

`request p.operation(args) as result within duration otherwise { … };` issues one correlated RPC to the single provider selected by its connector. The result name becomes available in the current block only after successful completion. The caller is suspended until a result or failure; this is an awaited request in the model, independent of whether generated code uses a blocking call or a future.

The communication system creates a fresh correlation identity for each request and carries its response back through the same interface/port/connector route. That response is the operation's declared result, not an independent event or unmodeled channel. A server return and a service event are distinct occurrences and have no implicit order beyond their operation's control flow.

The `otherwise` block executes on timeout, unavailable optional provider, admission rejection, transport failure or server `fail`. Its local `failure: String` is respectively `Timeout`, `Unavailable`, `Rejected`, `Transport`, or `RemoteFailure`. Remote implementation error strings are not automatically disclosed. Every path of the failure block MUST return from or fail the enclosing operation. No result is bound on failure.

The timeout starts at issuance and includes admission, queueing, service execution and return transport. Timeout does not cancel committed server effects. A late response to that correlation is discarded. Automatic application-level retry is absent. A backend using retries to satisfy delivery policy MUST preserve correlation and timeout budgets. Application-specific unsuccessful results remain typed results, not communication failures.

An outgoing optional unbound data/event port accepts an emission with no receivers; an unbound request fails as Unavailable. Incoming optional ports retain their handlers even if no external source is connected.

## 2.5 Queue and delivery policy

Every connector MUST specify all four base QoS fields, in the grammar's order:

| Field | Meaning |
| --- | --- |
| `delivery bestEffort` | messages may be lost, no retransmission obligation; accepted unique transmissions are not deliberately duplicated |
| `delivery atMostOnce` | delivery may be absent, but a given logical message is presented to a handler no more than once |
| `delivery atLeastOnce` | admitted messages may be retried and duplicated; eventual delivery is required only under a live connection, available receiver and unexpired lifetime/budget |
| `ordering fifo` | per connector and per member, presented messages preserve sender emission order; duplicates may repeat an item before the next item |
| `ordering unordered` | presentation order is unspecified |
| `capacity n` | positive bound on buffered messages per connector, direction and member; executing activations are not in this queue |
| `overflow dropOldest` | remove the oldest buffered message and admit the new one |
| `overflow dropNewest` | discard the incoming message |
| `overflow reject` | refuse admission and signal the emitting activation |

Overflow and expiration govern admission/retention and may intentionally discard messages even when delivery is atLeastOnce. This policy is therefore not a promise of lossless application execution. Reliability is separate from handler success; processing that fails is not silently repeated. AtLeastOnce RPC is permitted only when every operation on the interface is declared idempotent. A runtime/implementation MUST substantiate idempotency (including event side effects); the declaration alone is not a proof.

Exactly-once delivery is deliberately not a QoS option. Application-level deduplication and transactional processing can be modeled as operations and state, but depend on storage and failure assumptions outside the connector.

Sampled data retains only the latest pending value for that member. Any connector on an interface containing sampled members MUST use capacity 1 and dropOldest; this single connector policy also applies to other members of that interface. Use separate interfaces if mixed buffering policies are needed. Queued data preserves individual samples subject to explicit capacity/overflow. Receiving a sampled value is an activation with that value; there is no hidden cross-unit shared variable or implicit read operation.

Subscriptions are active while their endpoint units are alive. Pub/sub does not require a central broker; a logical connector describes the allowed subscription. Broker placement and behavior can be modeled explicitly. Runtime discovery, topic wildcards, content filters, retention persistence and dynamic subscription management are outside 0.1 and MUST NOT be assumed. Use explicit alternate systems or adapter components to document such deployment variants.

## 2.6 Timing of messages

`maxLatency` is a bound from accepted emission to availability for destination dispatch, excluding handler execution. `maxAge` is a maximum age since the producing emission timestamp; expired messages are discarded before dispatch. Clock translation across nodes is an implementation obligation. If a backend cannot establish a sufficiently bounded common time basis, it cannot claim the corresponding bound.

Request and response each have their own directional queue. A service event has its provider-to-consumer event queue. The connector QoS applies to each independently. Capacity is not shared between request, response and event traffic. A timed-out correlation does not keep its response queue alive indefinitely.

`maxLatency` and `maxAge` are obligations, not simulated delay values. Violations must be observable as runtime contract violations by a conforming checking executor. A declaration is not a measured proof. Security, authorization, integrity, serialization, encryption and transport binding belong to a target implementation profile and MUST preserve these interface boundaries.
