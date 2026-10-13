# SWAML 1.0 user guide

SWAML describes what software contains, how it communicates, and how operations and state evolve. The model remains independent of C++, Rust, an RTOS, a cloud runtime, or a particular network protocol.

## 1. Install and check a model

From the repository root:

```sh
npm ci
npm run build
node out/src/cli/main.js examples/01-hello.swaml
```

A successful result is `Checked 1 model(s): 0 error(s)`. This checks the implemented rules; it does not execute the software or prove schedulability. `npm run check` also runs the repository tests. Open the [implementation matrix](IMPLEMENTATION_STATUS.md) before interpreting a passed check as a stronger assurance claim.

A file starts with `swaml "1.0";` and contains named packages. Names are case sensitive. Keywords cannot be identifiers. Use `orderLink`, for example, rather than the reserved word `ordering`.

## 2. Write the contract first

Choose the communication model by the meaning of the exchange:

| Need | Interface | Roles | Operation statement |
| --- | --- | --- | --- |
| A current sensor value | `senderReceiver`, `sampled` data | sender → receiver | `send p.member(value);` |
| Every queued reading | `senderReceiver`, `queued` data | sender → receiver | `send p.member(value);` |
| Request and correlated response | `clientServer` | client → server | `request p.member(...) as result within … otherwise …;` |
| One event to many subscribers | `publishSubscribe` | publisher → subscriber | `publish p.member(...);` |
| RPC plus server notifications | `service` | requires → provides | request and publish |

Each connector uses one nominal interface definition. Equal-looking interfaces are not automatically interchangeable. Create an adapter unit when their meaning, payload, or version differs.

This is a complete small model; save it as `example.swaml`:

```swaml
swaml "1.0";
package First {
    interface senderReceiver Reading version "1.0.0" {
        data value: Real sampled;
    }
    unit def Source {
        port output: Reading sender;
        operation sample(): Void on start {
            send output.value(21.5);
            return;
        }
    }
    unit def Sink {
        port input: Reading receiver;
        var last: Real = 0.0;
        operation update(value: Real): Void on receive input.value {
            set last = value;
            return;
        }
    }
    component def Pair {
        unit source: Source;
        unit sink: Sink;
        connect readings: source.output -> sink.input qos {
            delivery atMostOnce; ordering fifo; capacity 1; overflow dropOldest;
        };
    }
    system Demo service { component pair: Pair; }
    view overview GV of Demo;
    view wiring IV of Pair;
    view updateFlow FV of Sink.update;
}
```

`Reading` defines the payload. Both ports use it with complementary roles. `sample` sends through its own port, and `update` declares that same port-member contract as its activation source. The connector allows the transfer. The variable `last` belongs to each `Sink` instance, not to every instance of its definition.

## 3. Choose component and unit boundaries

Use a **component** for a reusable architecture boundary: an embedded controller, a service backend, or a subsystem. Use a **unit** for a cohesive implementation boundary that owns operations and private data. A unit need not be a thread, file, class, or process; deployment is separate.

A component owns component/unit instances, ports and connectors. It does not own executable statements. A unit owns operations, pure functions and private variables. This keeps executable ownership unambiguous.

An operation can call a local helper with `invoke helper(...);`. The helper must be an untriggered `Void` operation in the same unit. Use `compute functionName(...)` for pure calculation results. These local calls do not need ports because they do not cross the agreed unit boundary.

Never write `otherUnit.operation()` or `otherUnit.privateValue`. The syntax and validator reject that access. To reach another unit, declare a port, choose an interface, connect it in their common parent, and use `request`, `send` or `publish`.

For a nested component, expose a boundary port and delegate it to one immediate child port. The [service example](../examples/03-service-pubsub.swaml) demonstrates `Backend.api` delegating to `serviceUnit.api`. Delegation preserves the port's role and interface; it does not reverse them or convert data.

## 4. Describe operation control flow

Operations contain ordered statements: typed local declarations, assignments, assertions, conditionals, bounded loops, local calls, interface exchanges, returns and failures. Read [Values and flow](../examples/05-values-and-flow.swaml) as a worked example.

Functions are expressions with typed parameters and results. They cannot read mutable unit data, issue requests, or emit events. Pass their inputs explicitly. Records, enums and arrays are values, so sending them does not expose a remote reference to local mutable data.

A `while` includes a maximum iteration count. Exceeding that count at runtime is a failure, not permission to silently stop the loop. This makes the bound useful to a later analysis or code generator.

Use `assert` for a model-level assumption that must hold at that point. A requirement is a named prose obligation. A case can link to requirements using `satisfies`; that trace link is not proof that the requirement is met.

## 5. Model a service call and its failure

Read [Services and pub/sub](../examples/03-service-pubsub.swaml). The service declares `submit` in its interface; the server unit implements it with `on call api.submit`. The client's `request` includes a timeout and an `otherwise` block.

A request binds its result only on success. The failure block has a local `failure: String` value and must return from or fail the current operation. This prevents subsequent statements from reading an uninitialized result. A timeout says the caller stopped waiting; it does not prove the server did nothing. Later responses to that timed-out request are ignored.

For application-specific errors, use an enum or result record in the operation's declared return type. Transport failures and application results are different concepts. Do not retry a request unless its idempotency and retry budget are established. The core rejects `atLeastOnce` RPC when the operation is not declared idempotent; proving that declaration is an implementation obligation.

## 6. Use publish/subscribe without a hidden event bus

An event is a member of a `publishSubscribe` or `service` interface. Only an operation can publish it, through one of its own outgoing ports. Subscribers receive it through their own typed ports. The normal handler uses `on receive input.eventName` with the event's parameter types in order.

Fan-out is multiple explicit connectors from a publisher port to subscriber ports. Each subscription has its own queue and QoS. A slow subscriber does not silently change the queue of another subscriber. Multiple publishers may connect to one subscriber; ordering is per connector, not global.

In a combined service, the connector is drawn from `requires` to `provides` for requests. Service events travel back from provider to consumer, and replies return on the originating request's correlation. Both remain members of the same declared interface.

Model a broker as a component with incoming and outgoing interfaces if broker behavior, failure, buffering or deployment matters. A connector alone represents a logical subscription, without selecting MQTT, DDS, Kafka or SOME/IP. Dynamic discovery and unsubscribe operations are reserved for future language versions.

## 7. Put states inside an operation

The [stateful operation example](../examples/04-stateful-operation.swaml) owns `Idle`, `Running`, and `Stopped` inside `Device.lifecycle`. It starts once with its unit. No performer or external behavior allocation is required.

A stateful operation returns `Void`, has no parameters and uses `on start machine { … }`. It declares an initial state, states with optional entry/exit blocks, and transitions. Triggers are an incoming port member, a positive delay after entering a state, or completion. A receiving transition makes event parameter names available in its guard and effect; sender–receiver data uses `payload`.

On a transition: run the source exit block, the transition effect, then the destination entry block. A final state completes the stateful operation. A received event with no enabled transition in the current state is consumed and ignored. Add an explicit transition if ignoring it is unacceptable.

Use one stateful operation as the receiver for a given member, or one ordinary operation. Do not bind the same member to both: that would create ambiguous delivery.

## 8. Model realtime constraints

The [controller example](../examples/02-realtime-controller.swaml) uses `on every 10 ms`, execution-time bounds and deadlines. A realtime or mixed system requires timing contracts for every used operation and maximum connector latency. Sampled realtime data also needs `maxAge`.

The validator checks positivity, `wcet <= deadline`, and `deadline <= period` for a periodic operation. These are necessary checks, not a scheduling proof. Document the actual RTOS policy, interrupt load, CPU allocation, priorities, clock assumptions, transport timing and measured/analyzed WCET in the implementation project. A production backend must establish them before claiming hard realtime execution.

`serial` is the default unit-local execution policy. `reentrant` requires independent activations and must not mutate shared unit state, including through helpers. An operation waiting for a service response consumes elapsed deadline time even when it consumes no CPU execution time.

## 9. Separate deployment from architecture

A system can declare execution nodes with kind `mcu`, `process`, or `container`, and `deploy instance.path on nodeName;`. A component deployment applies to descendants unless a more specific descendant deployment overrides it. Each explicit instance path may be deployed only once.

Nodes are allocation targets, not units and not communication shortcuts. Moving a unit to another process cannot make a previously illegal direct data access legal. Network addresses, credentials, task schedules and generated code are outside the 1.0 model.

The [mixed gateway](../examples/06-mixed-gateway.swaml) shows how one unit explicitly converts sampled values into event notifications. An adapter owns the conversion, timing and failure policy.

## 10. Organize a larger model

Packages are flat namespaces in 1.0. Write `import Contracts::*;` to use another package's declarations unqualified, or name a declaration `Contracts::Reading`. All relevant files must be loaded together. Two imports exposing the same short name make it ambiguous; use the qualified name.

The editor host should load the whole model workspace. The CLI deliberately loads the files you supply and does not search unrelated directories. Do not put secrets in model payloads, examples or deployment notes.

## 11. Navigate through views

| Surface | Purpose |
| --- | --- |
| Browser | Navigate packages → definitions → instances → ports/operations → states |
| GV — General View | Inspect structure, declarations and their relationships |
| IV — Interconnect View | Inspect connected ports and component delegation |
| CV — Case View | Inspect cases and linked requirements |
| SV — Sequence View | Inspect the partial ordering of interface exchanges in a case |
| GRV — Grid View | Inspect sortable model, interface, timing and deployment tables |
| FV — Flow View | Inspect an operation's control flow or owned state transitions |

These are specified editor behaviors. The current package supplies the model syntax and language server, not a diagram renderer. View declarations can already be parsed and checked. See [graphical notation](GRAPHICAL_NOTATION.md) for the drawing and editing contract. There is no GEV, and AFV/STV are combined into FV.

## 12. Resolve diagnostics

| Diagnostic | Typical fix |
| --- | --- |
| `SW030` | Connect immediate child ports; expose/delegate a port across each component boundary |
| `SW031` / `SW032` | Use the same interface definition and complementary port roles |
| `SW034` | Connect the port in a closed system, or mark an intentionally unbound port `optional` |
| `SW050` / `SW051` | Use a local port member and the correct communication verb/direction |
| `SW052` / `SW055` | Match handler parameters/results and give each incoming member one owner |
| `SW057` | Make every failure path return or fail |
| `SW062` | Give competing transitions distinct priorities |

A parser error usually means a reserved identifier, missing delimiter, or malformed block. Resolve syntax errors first; semantic checks are skipped on syntactically incomplete documents to avoid misleading secondary errors.

## Service fields, repeated consumers and checked traces

[Service field](../examples/08-service-field.swaml) models one temperature setting with explicit `get`, `setPoint` and `changed` interface members. The service stores the value privately. Its serial setter publishes through its provided port, which fans out to two required ports on separate panel instances. Each panel owns a distinct displayed value and its own receiving operation.

The getter is reentrant and reads the private-state snapshot taken when it is dispatched. It can safely overlap the serial setter because it does not mutate storage, directly or through a helper. Snapshot implementation is an execution-backend obligation; parsing this example does not simulate it.

A case reply must follow a unique unanswered matching request through its `after` ancestry. Two outstanding requests on the same route/member cannot be disambiguated by drawing one reply lower on the page. Order the pairs or use separate cases. Requests may remain unanswered in a partial trace. A route-valid case still needs an operation-level witness before it counts as verified behavior.

Use the owning package's name as a GV/GRV subject for an inventory. IV takes a component/system; FV takes an operation, including an occurrence path such as `Cabin.settings.store.update`. CV/SV take a case or system. A view cannot use another view as its semantic subject.

If a request returns Void, its required `as` name marks completion but cannot be read as a value. Reserve `failure` for the implicit error-path binding. Write string line breaks with `\n`; raw line breaks, tabs and unsupported escapes inside strings are rejected.

The [operational contract](spec/06-execution-contract.md) defines execution edge cases, and the [conformance obligations](spec/08-conformance-obligations.md) distinguish validator acceptance from runtime and analysis evidence.

## Find a construct or run an example

Use the [alphabetical keyword reference](KEYWORD_REFERENCE.md) for exact words and context, the [concern guide](CONCERN_GUIDE.md) for architectural questions, or the [complete Markdown book](SWAML-1.0.0-Reference.md) for a single user-facing document. All eight examples have executable [simulation configurations](../examples/simulation/runs.json); follow the [reference simulation guide](SIMULATION.md) to run them and inspect their traces.
