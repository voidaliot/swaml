# 2. Interfaces and communication

Normative chapter of the [SWAML 1.4 development specification](../LANGUAGE_SPECIFICATION.md).

Target profiles own security, authorization, integrity, serialization, encryption and transport while preserving the interface boundaries below. [Chapter 6](06-execution-contract.md) specifies admission, timeout races, lifetime and failure.

## 2.1 Contract identity and members

An interface declaration has a kind, package-qualified name, explicit `major.minor.patch` version string, and at least one member. Its identity is its declaration plus that version. Member names are unique across the entire interface; function overloading is absent.

| Kind | Permitted members | Port roles |
| --- | --- | --- |
| `senderReceiver` | `data name: T sampled;` or `queued;` | `sender`, `receiver` |
| `clientServer` | operation/function signatures | `client`, `server` |
| `publishSubscribe` | event signatures | `publisher`, `subscriber` |
| `service` | operation/function and event signatures | `provides`, `requires` |

An `operation` or `function` signature declares ordered input parameters, an optional result annotation, and optionally `idempotent`. Function specializes Operation. An operation signature may be implemented by a compatible operation or function; a function signature MUST be implemented by a function. Parameter/result, trigger and route checks apply equally to both. The callable signature kind is preserved separately from an executable implementation. Omitting `: Type` means void, exactly as an explicit `: void`. An event signature declares zero or more ordered payload parameters and no result. Data is one typed value. A notification without payload uses a zero-parameter event. No event may be declared directly in a package, component or state.

A service field is modeled explicitly as a getter function, optional setter function and changed event. This avoids a second implicit communication mechanism. A setter returns an application result; its implementation owns the decision whether and when to publish the changed event. Property storage never becomes remotely writable data.

Version strings document compatibility intent: a breaking change SHOULD increase major; additive changes SHOULD increase minor; a meaning-preserving correction SHOULD increase patch. However, 1.4 performs **exact nominal matching**, not automatic version negotiation. Use a differently named declaration for another version in the same package and an adapter between versions. Adding an event may require a new receiver and is not automatically compatible with an existing complete implementation.

## 2.2 Ports and boundary exposure

A port belongs to one class/component usage and references exactly one interface. Its role must be legal for that interface kind. `optional` permits the port to have zero connections in a closed root component; it does not relax type, direction, handler or emission requirements.

A connector joins owned or immediate-child ports: `connect name: child.port -> child.port qos { … };` or `connect name: localPort -> child.port qos { … };`. Its owner is a component definition or inline root; a typed root uses its definition's connectors. Each endpoint has one or two segments and references a port, not a member, function, variable, state or grandchild. The interface declarations MUST be identical. Explicit routes may connect complementary ports of the same component instance. Such exchanges still use the connector queue and handler dispatch; local calls and calculations remain available for synchronous local work.

Legal connector orientations are sender → receiver, client → server, publisher → subscriber, and requires → provides. Service roles also support provider-to-consumer event traffic over the same contract; the arrow denotes the request orientation, not a unidirectional transport restriction.

The following table restates the direction and closure rules. Counts refer to resolved leaf port connections, not interface member count or UML part multiplicity. Optional ports permit zero connections; otherwise the minimum is one. Multiple connections always require distinct explicit connectors.

| Kind | Connector orientation | Permitted traffic | Maximum connections per leaf port |
| --- | --- | --- | --- |
| senderReceiver | sender → receiver | data in the arrow direction | sender: many; receiver: one |
| clientServer | client → server | request forward; correlated result/failure reverse | client: one; server: many |
| publishSubscribe | publisher → subscriber | events in the arrow direction | publisher: many; subscriber: many |
| service | requires → provides | request forward; correlated result/failure and events reverse | requires: one; provides: many |

A role identifies interaction direction, not visibility or optionality. In particular, `requires` is the service consumer role; `optional` independently controls whether its port may remain unbound. Interfaces describe complete contracts: a consumer cannot silently omit handlers for unwanted incoming members. Separate contracts or an explicit adapter are needed when those responsibilities differ.

A component port may be handled locally or have exactly one delegation to an immediate child port: `delegate outer -> child.port;`. Delegation MUST preserve role and nominal interface. It is a forwarding boundary, with no implicit queue, payload conversion, delivery retry or additional source. Child components can delegate again. To cross a hierarchy, expose a port at each boundary; no connector may tunnel to a grandchild.

At root closure, recursively expand instances, resolve each delegation to a leaf component port, and inspect actual connector endpoints. Every nonoptional port, including boundary aliases, MUST resolve to a connected leaf. Receiver ports have exactly one source; client/requires ports have exactly one provider. Sender, publisher, server and provides ports can participate in multiple connectors. Subscriber ports may receive from multiple publishers. A duplicate connector resolving to the same directed leaf pair is an error; it must not create an accidental duplicate subscription. A component may not expose the same child port under two aliases in 1.4.

A locally handled port and a delegated alias cannot acquire conflicting handlers. Delegation forwards a boundary; it does not grant private access to the child.

For graphical notation, clientServer and service connections use a ball at the server/provides port and a socket at the client/requires port. The owned port square, nominal contract/version, explicit connector and QoS remain identifiable. The ball/socket pair denotes the request-facing roles; replies and service notifications retain their reverse typed routes. It does not represent senderReceiver or publishSubscribe. See [graphical notation](../GRAPHICAL_NOTATION.md).

## 2.3 Emission and reception ownership

Operator commands, test stimuli and device notifications use the same interface contracts and routes as application messages. An ordinary source function publishes a named event through its owned port. A test driver may schedule that function's publications using lifecycle or state/timer behavior; it cannot directly invoke a receiving function or inject a message at its destination.

A locally handled component port's outgoing data/event member MUST occur in at least one `send`/`publish` statement inside one of its functions, including a state entry, exit or transition effect. This is a static provenance relationship, not a proof of reachability or a promise that the function always emits.

Each incoming data/event member MUST have exactly one handler owner: an ordinary function triggered by that member, or one stateful function containing one or more receiving transitions for it. An operation/function signature on a server/provides port MUST have exactly one kind-compatible operation/function with `on call port.member`. Several transitions in one stateful function count as one owner. Two different functions receiving the same member are invalid. To intentionally fan out processing, use a local coordinating handler that invokes helpers, or explicit subscriber components.

An ordinary handler MUST reproduce the member's ordered parameter types. Names may differ. A data handler has one parameter of the data type; an event handler has the event's parameter list. Both return void. An RPC handler MUST also reproduce the signature's result type.

## 2.4 Exchange semantics

`send p.data(value);` emits one typed data value through a sender port. `publish p.event(args);` emits one typed event through a publisher/provides port. Both paths are exactly `localPort.member`. The transfer copies the value; a target implementation may use zero-copy storage only if it preserves isolation and observable value semantics.

For each outgoing permitted connector, the communication system independently offers the message to that connector's destination queue. Emission does not execute a remote handler on the caller's stack. All fanout offers are attempted. Any `reject` fails the emitting activation after those decisions; accepted offers cannot be rolled back. No interconnector offer order is implied. Programs needing atomic broadcast must model a protocol explicitly.

`call p.member(args) as result within duration otherwise { … };` issues one correlated RPC to the single provider selected by its connector. The result name becomes available in the current block only after successful completion. The caller is suspended until a result or failure; this is an awaited request in the model, independent of whether generated code uses a blocking call or a future.

The communication system creates a fresh correlation identity for each request and carries its response back through the same interface/port/connector route. That response is the operation/function's declared result, not an independent event or unmodeled channel. A server return and a service event are distinct occurrences and have no implicit order beyond their function's control flow.

The `otherwise` block executes on timeout, unavailable optional provider, admission rejection, transport failure or server `fail`. Its local `failure: string` is respectively `Timeout`, `Unavailable`, `Rejected`, `Transport`, or `RemoteFailure`. Remote implementation error strings are not automatically disclosed. Every path of the failure block MUST return from or fail the enclosing function. No result is bound on failure. The implicit failure name must not shadow a live value. A void success name labels completion only and cannot be used as data.

The timeout starts at issuance and includes admission, queueing, service execution and return transport. Timeout does not cancel committed server effects. A late response to that correlation is discarded. Automatic application-level retry is absent. A backend using retries to satisfy delivery policy MUST preserve correlation and timeout budgets. Application-specific unsuccessful results remain typed results, not communication failures.

An outgoing optional unbound data/event port accepts an emission with no receivers; an unbound request fails as Unavailable. Incoming optional ports retain their handlers even if no external source is connected.

## 2.5 Queue and delivery policy

Every connector MUST explicitly select its complete policy, either with an inline `qos { ... }` block or `qos PolicyName`. A reusable policy is declared at package scope as `qos def PolicyName { ... }`. The name follows ordinary package/import/qualified-name and cross-kind ambiguity rules. There are no implicit policies, inheritance, overrides or partial bodies. An unresolved reference is an error.

Every inline or named policy body MUST specify all four base QoS fields, in the grammar's order:

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

Overflow and expiration govern admission/retention and may intentionally discard messages even when delivery is atLeastOnce. This policy is therefore not a promise of lossless application execution. Reliability is separate from handler success; processing that fails is not silently repeated. AtLeastOnce RPC is permitted only when every function on the interface is declared idempotent. A runtime/implementation MUST substantiate idempotency (including event side effects); the declaration alone is not a proof.

Named policy bodies are checked even when unused. Each use is checked against its actual interface and root: sampled buffering, idempotent RPC and realtime bounds are never waived by a reference. Reuse copies policy values conceptually; it does not share queues or correlations. The connector retains the named declaration identity as provenance. `qos OtherPackage::PolicyName` selects a qualified declaration; short names require local or directly imported visibility and must be unambiguous.

Exactly-once delivery is deliberately not a QoS option. Application-level deduplication and transactional processing can be modeled as functions and state, but depend on storage and failure assumptions outside the connector.

Sampled data retains only the latest pending value for that member. Any connector on an interface containing sampled members MUST use capacity 1 and dropOldest; this single connector policy also applies to other members of that interface. Use separate interfaces if mixed buffering policies are needed. Queued data preserves individual samples subject to explicit capacity/overflow. Receiving a sampled value is an activation with that value; there is no hidden cross-component shared variable or implicit read function.

Subscriptions are active while their endpoint components are alive. Pub/sub does not require a central broker; a logical connector describes the allowed subscription. Broker placement and behavior can be modeled explicitly. Runtime discovery, topic wildcards, content filters, retention persistence and dynamic subscription management are outside 1.3 and MUST NOT be assumed. Use explicit alternate root components or adapter components to document such deployment variants.

## 2.6 Timing of messages

`maxLatency` is a bound from accepted emission to availability for destination dispatch, excluding handler execution. `maxAge` is a maximum age since the producing emission timestamp; expired messages are discarded before dispatch. Clock translation across external deployment targets is an implementation obligation. If a backend cannot establish a sufficiently bounded common time basis, it cannot claim the corresponding bound.

Request and response each have their own directional queue. A service event has its provider-to-consumer event queue. The connector QoS applies to each independently. Capacity is not shared between request, response and event traffic. A timed-out correlation does not keep its response queue alive indefinitely.

`maxLatency` and `maxAge` constrain execution; they supply neither simulated delays nor measured timing evidence. A conforming checking executor MUST report violations.
