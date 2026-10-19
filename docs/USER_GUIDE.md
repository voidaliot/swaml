# SWAML 1.4 development user guide

This is the unpublished 1.4.0 development guide. Published 1.3.1 editions remain archived. The [1.4 migration guide](MIGRATION_1_4.md) explains the parser/profile change and contains a complete completion-triggered example.

Architects familiar with UML: start with the [concept correspondence and modeling workflow](UML_GUIDE.md).

Version 1.3.1 also supports `class` as the general structural category and `operation` as the general executable/signature category. `component` specializes `class`; `function` specializes `operation`. The component/function examples below retain their meaning. Both alternatives use the same private values, owned children, typed ports, local calculations, flow/states and execution rules. See the [complete mixed example](../examples/20-classes-and-operations.swaml) and [category compatibility rules](decisions/0014-classes-operations-and-uml-notation.md). clientServer/service ports use balls for server/provides and sockets for client/requires, while preserving contract labels and reverse traffic.

SWAML describes what software contains, how it communicates, and how functions and state evolve. The model remains independent of C++, Rust, an RTOS, a cloud runtime, or a particular network protocol.

## 1. Install and check a model

From the repository root:

```sh
npm ci
npm run build
node out/src/cli/main.js examples/01-hello.swaml
```

A successful result is `Checked 1 model(s): 0 error(s)`. This checks the implemented rules; it does not execute the software or prove schedulability. `npm run check` also runs the repository tests. Open the [implementation matrix](IMPLEMENTATION_STATUS.md) before interpreting a passed check as a stronger assurance claim.

A file begins directly with named packages. Pin the 1.4 development language core and exact package revision in the host; there is no per-file version header. Unsupported requested editions and historical headers are rejected rather than guessed. Names are case sensitive. Keywords cannot be identifiers. Use `orderLink`, for example, rather than the reserved word `ordering`.

## 2. Write the contract first

Choose the communication model by the meaning of the exchange:

| Need | Interface | Roles | Function statement |
| --- | --- | --- | --- |
| A current sensor value | `senderReceiver`, `sampled` data | sender → receiver | `send p.member(value);` |
| Every queued reading | `senderReceiver`, `queued` data | sender → receiver | `send p.member(value);` |
| Request and correlated response | `clientServer` | client → server | `call p.member(...) as result within … otherwise …;` |
| One event to many subscribers | `publishSubscribe` | publisher → subscriber | `publish p.member(...);` |
| RPC plus server notifications | `service` | requires → provides | call and publish |

Each connector uses one nominal interface definition. Equal-looking interfaces are not automatically interchangeable. Create an adapter component when their meaning, payload, or version differs.

This is a complete small model; save it as `example.swaml`:

```swaml
package First {
    interface senderReceiver Reading version "1.0.0" {
        data value: real sampled;
    }
    component def Source {
        port output: Reading sender;
        function sample() on start {
            send output.value(21.5);
            return;
        }
    }
    component def Sink {
        port input: Reading receiver;
        var last: real = 0.0;
        function update(value: real) on receive input.value {
            last = value;
            return;
        }
    }
    component def Pair {
        component source: Source;
        component sink: Sink;
        connect readings: source.output -> sink.input qos {
            delivery atMostOnce; ordering fifo; capacity 1; overflow dropOldest;
        };
    }
    component Demo: Pair;
    view overview gv of Demo;
    view wiring iv of Pair;
    view updateFlow fv of Sink.update;
}
```

`component def Pair` is a reusable type; `component Demo: Pair;` selects one root occurrence for execution. Its omitted profile means service. `Reading` defines the payload. Both ports use it with complementary roles. `sample` sends through its own port, and `update` declares that same port-member contract as its activation source. The connector allows the transfer. The variable `last` belongs to each `Sink` instance, not to every instance of its definition.

## Reuse a communication policy

When several connectors have the same QoS, declare a complete policy once at package scope:

```text
qos def LocalLink {
    delivery atMostOnce; ordering fifo; capacity 8; overflow reject;
}
// Inside a component, explicitly select it on each route:
connect frontLink: front.setting -> settings.api qos LocalLink;
connect rearLink: rear.setting -> settings.api qos LocalLink;
```

The complete [service-setting model](../examples/08-service-field.swaml) uses this form. Inline blocks remain valid. A named policy shares values, while every connector keeps its own queues, directions and member identities. Qualified names and direct imports follow normal namespace rules. The validator checks the actual interface and root at every use, so a generic policy cannot bypass sampled buffering, idempotency or realtime bounds. The [1.2 migration guide](MIGRATION_1_2.md) explains the AST update.

## 3. Choose component and component boundaries

Use a **component** for a cohesive software boundary: an embedded controller, a service backend, or a subsystem. It may own functions, private data and child components. A component need not be a thread, file, class, or process; deployment is separate.

A component definition owns component instances, ports and connectors. `def` makes this type declaration explicit, following the familiar SysML definition/usage distinction. A root is an occurrence: use `component Demo: Pair;` to instantiate a definition, or `component Demo { component source: Source; … }` to assemble components directly. Statements belong to functions; a root can own functions and private variables. This keeps executable ownership unambiguous.

A function can call a local helper with `call helper(...);`. The helper is an untriggered flow function in the same component. For a value result, write `call helper(...) as result;`. Pure calculations use expression syntax such as `scaled(...)` only inside their owning function. These local calls do not need ports because they do not cross the agreed component boundary.

Never write `otherComponent.function()` or `otherUnit.privateValue`. The syntax and validator reject that access. To reach another component, declare a port, choose an interface, connect it in their common parent, and use `call`, `send` or `publish`.

For a nested component, expose a boundary port and delegate it to one immediate child port. The [service example](../examples/03-service-pubsub.swaml) demonstrates `Backend.api` delegating to `serviceUnit.api`. Delegation preserves the port's role and interface; it does not reverse them or convert data.

## 4. Describe function control flow

Functions contain ordered statements: typed local declarations, assignments, assertions, conditionals, bounded loops, local calls, interface exchanges, returns and failures. Read [Values and flow](../examples/05-values-and-flow.swaml) as a worked example.

Functions and interface signatures may omit `: void`; a missing result annotation means exactly void. Calculations are expressions with typed parameters and an explicit non-void result. They cannot read mutable component data, issue requests, or emit events. Pass their inputs explicitly. Records, enums and arrays are values, so sending them does not expose a remote reference to local mutable data. Write `count = count + 1;` for whole-value assignment, `clamp(value)` for a pure local calculation, `[1, 2, 3]` for an array, and `Status.Ready` for an enum value. Use `Contracts::Status.Ready` when a local value named `Status` would otherwise hide that enum.

A `while` includes a maximum iteration count. Exceeding that count at runtime is a failure, not permission to silently stop the loop. This makes the bound useful to a later analysis or code generator.

Use `assert` for a model-level assumption that must hold at that point. A requirement is a named prose obligation. A case can link to requirements using `satisfies`; that trace link is not proof that the requirement is met.

## Local completion dependencies

Use `function B() on completion A { ... }` or the corresponding `operation` form when one same-owner executable should start a fresh activation after another successfully completes. A must be an effective triggered executable in the same class/component; B must be a parameterless void flow body. Dependencies are acyclic. The new activation gets its own lock/snapshot, release-relative deadline and backlog slot. It receives no arguments/result and may wait behind other enabled work. Failure releases nothing. A stateful A counts only when the whole function finishes, not after individual reactions. This is separate from a state's `on completion` transition and from a synchronous local `call`.

The [complete model](../examples/25-function-completion.swaml) and [ADR 0015](decisions/0015-local-executable-completion.md) show a chain. Cross-component coordination still uses typed ports and explicit routes. Multiple dependents do not imply a join or execution order among them.

## 5. Model a service call and its failure

Read [Services and pub/sub](../examples/03-service-pubsub.swaml). The service declares `submit` in its interface; the server component implements it with `on call api.submit`. The client's `call` includes a timeout and an `otherwise` block.

A request binds its result only on success. The failure block has a local `failure: string` value and must return from or fail the current function. This prevents subsequent statements from reading an uninitialized result. A timeout says the caller stopped waiting; it does not prove the server did nothing. Later responses to that timed-out request are ignored.

For application-specific errors, use an enum or result record in the function's declared return type. Transport failures and application results are different concepts. Do not retry a request unless its idempotency and retry budget are established. The core rejects `atLeastOnce` RPC when the function is not declared idempotent; proving that declaration is an implementation obligation.

## 6. Use publish/subscribe without a hidden event bus

An event is a member of a `publishSubscribe` or `service` interface. Only a function can publish it, through one of its own outgoing ports. Subscribers receive it through their own typed ports. The normal handler uses `on receive input.eventName` with the event's parameter types in order.

Fan-out is multiple explicit connectors from a publisher port to subscriber ports. Each subscription has its own queue and QoS. A slow subscriber does not silently change the queue of another subscriber. Multiple publishers may connect to one subscriber; ordering is per connector, not global.

In a combined service, the connector is drawn from `requires` to `provides` for requests. Service events travel back from provider to consumer, and replies return on the originating request's correlation. Both remain members of the same declared interface.

Model a broker as a component with incoming and outgoing interfaces if broker behavior, failure, buffering or deployment matters. A connector alone represents a logical subscription, without selecting MQTT, DDS, Kafka or SOME/IP. Dynamic discovery and unsubscribe functions are reserved for future language versions.

## 7. Put states inside a function

The [stateful function example](../examples/04-stateful-function.swaml) owns `Idle`, `Running`, and `Stopped` inside `Device.lifecycle`. It starts once with its component. No performer or external behavior allocation is required.

A stateful function has no parameters, a void result (usually omitted), and `on start { initial Idle; … }`. The initial reference follows any function-local calculation declarations and precedes all states. There is no extra behavior wrapper. It declares an initial state, states with optional entry/exit blocks, and transitions. Triggers are an incoming port member, a positive delay after entering a state, or completion. A receiving transition makes event parameter names available in its guard and effect; sender–receiver data uses `payload`.

This complete model places the states directly where they execute:

```swaml
package TimerExample {
    component def Device {
        var cycles: int = 0;
        function lifecycle() on start {
            initial Waiting;
            state Waiting {
                entry { cycles = cycles + 1; }
            }
            state Finished final {}
            transition complete: Waiting -> Finished on after 10 ms {}
        }
    }
    component Demo { component device: Device; }
    view lifecycle fv of Demo.device.lifecycle;
}
```

The root contains its component directly. The delay is local to that function; it is not a free event or cross-component channel. The [interface-triggered lifecycle model](../examples/04-stateful-function.swaml) adds commands and status ports.

On a transition: run the source exit block, the transition effect, then the destination entry block. A final state completes the stateful function. A received event with no enabled transition in the current state is consumed and ignored. Add an explicit transition if ignoring it is unacceptable.

Use one stateful function as the receiver for a given member, or one ordinary function. Do not bind the same member to both: that would create ambiguous delivery.

## 8. Model realtime constraints

The [controller example](../examples/02-realtime-controller.swaml) uses `on every 10 ms`, execution-time bounds and deadlines. A root with a realtime or mixed profile requires timing contracts for every used function and maximum connector latency. Sampled realtime data also needs `maxAge`.

The validator checks positivity, `wcet <= deadline`, and `deadline <= period` for a periodic function. These are necessary checks, not a scheduling proof. Document the actual RTOS policy, interrupt load, CPU allocation, priorities, clock assumptions, transport timing and measured/analyzed WCET in the implementation project. A production backend must establish them before claiming hard realtime execution.

`serial` is the default component-local execution policy. `reentrant` requires independent activations and must not mutate shared component state, including through helpers. A function waiting for a service response consumes elapsed deadline time even when it consumes no CPU execution time.

## 9. Separate deployment from architecture

Write `deploy instance.path on "sysml:Vehicle::ecu";` to refer to an external system or part. A general host identity such as `"system:production::checkout"` is also supported. SWAML checks the component path and reference syntax; the integration host must resolve the destination and validate its suitability.

A typed root may have a deployment-only body: `component Product: Controller realtime { deploy sensor on "sysml:Vehicle::ecu"; }`. Its `sensor` must already exist in `Controller`; the binding cannot add children, functions or connections. An inline root may combine composition, local behavior and deployments. Deploying the root name establishes its own location and the default for its children. More specific descendant bindings override that default; each explicit path may occur only once.

The [component roots example](../examples/09-component-roots.swaml) shows reusable assemblies and concrete bindings. The software model retains its typed communication boundaries wherever components are placed. A SysML reference identifies an integration point; it does not import a SysML model or certify cross-language mapping.

## Specialize a reusable component

`component def Tuned specializes Controller { … }` reuses one base definition. Prefix an inherited replacement with `redefines`; an unmarked name collision is invalid. Replacement ports and functions preserve their contracts, while bodies, pure expressions and initial values can vary. Child instances may use the original type or a specialization of it. Instances remain separate stores and connected peers. See the [complete specialization example](../examples/15-component-specialization.swaml) and [ownership decision](decisions/0007-component-functions-and-calculations.md).

## Add a pure calculation

Use `calc scaled { in value: real; in gain: real; return result: real = value * gain; }` at the start of a function body, then write `scaled(measured, 0.5)` in an expression. Inputs are copied values and the named output is a single pure result. Functions carry effects and control flow; calculations can appear in that function’s guards, local initializers and other expressions.

The basic types are `bool`, `int`, `uint`, `byte`, `real`, `string` and result-only `void`. Add nominal records, enums and fixed arrays such as `byte[8]` for structured values. uint and byte assignments check their ranges instead of truncating or wrapping.

## 10. Organize a larger model

Packages are flat namespaces in 1.2. Write `import Contracts::*;` to use another package's declarations unqualified, or name a declaration `Contracts::Reading`. All relevant files must be loaded together. Two imports exposing the same short name make it ambiguous; use the qualified name.

The editor host should load the whole model workspace. The CLI deliberately loads the files you supply and does not search unrelated directories. Do not put secrets in model payloads, examples or deployment notes.

## 11. Navigate through views

| Surface | Purpose |
| --- | --- |
| Browser | Navigate packages → definitions → instances → ports/functions → states |
| gv — General View | Inspect the same structure in Box in box or Tree layout |
| iv — Interconnect View | Inspect connected ports and component delegation |
| cv — Case View | Inspect cases and linked requirements |
| sv — Sequence View | Inspect the partial ordering of interface exchanges in a case |
| grv — Grid View | Inspect sortable model, interface, timing and deployment tables |
| fv — Flow View | Inspect a function's control flow, interruptible regions or owned state transitions |
| tv — Timing View | Inspect observed function activation timing beside separate declared contracts |

These are the seven source view kinds plus Browser navigation. In gv, **Box in box** shows nested ownership frames and **Tree** shows the same hierarchy with ownership edges. Switching layouts preserves occurrence paths, selection, ownership and typed routes; it does not edit the model.

The current package parses and validates view declarations. The [showcase](../showcase/README.md) renders curated source-checked models with selection and layout controls; it does not implement arbitrary graphical source editing. See [graphical notation](GRAPHICAL_NOTATION.md) for the drawing and editing contract.

## 12. Resolve diagnostics

| Diagnostic | Typical fix |
| --- | --- |
| `SW030` | Connect immediate child ports; expose/delegate a port across each component boundary |
| `SW031` / `SW032` | Use the same interface definition and complementary port roles |
| `SW034` | Connect the port in a closed root component, or mark an intentionally unbound port `optional` |
| `SW050` / `SW051` | Use a local port member and the correct communication verb/direction |
| `SW052` / `SW055` | Match handler parameters/results and give each incoming member one owner |
| `SW057` | Make every failure path return or fail |
| `SW062` | Give competing transitions distinct priorities |

A parser error usually means a reserved identifier, missing delimiter, or malformed block. Resolve syntax errors first; semantic checks are skipped on syntactically incomplete documents to avoid misleading secondary errors.

## Service fields, repeated consumers and checked traces

[Service field](../examples/08-service-field.swaml) models one temperature setting with explicit `get`, `setPoint` and `changed` interface members. The service stores the value privately. Its serial setter publishes through its provided port, which fans out to two required ports on separate panel instances. Each panel owns a distinct displayed value and its own receiving function.

The getter is reentrant and reads the private-state snapshot taken when it is dispatched. It can safely overlap the serial setter because it does not mutate storage, directly or through a helper. Snapshot implementation is an execution-backend obligation; parsing this example does not simulate it.

A case reply must follow a unique unanswered matching request through its `after` ancestry. Two outstanding requests on the same route/member cannot be disambiguated by drawing one reply lower on the page. Order the pairs or use separate cases. Requests may remain unanswered in a partial trace. A route-valid case still needs a function-level witness before it counts as verified behavior.

Use the owning package's name as a gv/grv subject for an inventory. iv takes a component definition/root component or child occurrence; fv/tv take executable functions, including an occurrence path such as `Cabin.settings.store.update`. cv/sv take a case or root component. A view cannot use another view as its semantic subject. Select a single timing function with `view updateTiming tv of Cabin.settings.store.update;`. To select every function under a root, write `view allTiming tv { include Cabin recursive where kind == "function"; }`; compact tv of a component is invalid. A function need not have a timing contract or trigger to be selected. The view itself supplies no execution evidence.

If a routed call returns void, its required `as` name marks completion but cannot be read as a value. Reserve `failure` for the implicit error-path binding. Write string line breaks with `\n`; raw line breaks, tabs and unsupported escapes inside strings are rejected.

The [operational contract](spec/06-execution-contract.md) defines execution edge cases, and the [conformance obligations](spec/08-conformance-obligations.md) distinguish validator acceptance from runtime and analysis evidence.

## Find a construct or run an example

Use the [alphabetical keyword reference](KEYWORD_REFERENCE.md) for exact words and context, the [concern guide](CONCERN_GUIDE.md) for architectural questions, or the [current development Markdown book](SWAML-1.4.0-Reference.md) for a single user-facing document. The maintained examples have executable [simulation configurations](../examples/simulation/runs.json); follow the [reference simulation guide](SIMULATION.md) to run them and inspect their traces.

## Operator and test inputs

Declare named, typed events and receive them through an owned port with `on receive port.member`. Model the operator, adapter or test driver as component-owned functions that publish those events through explicit routes. Finite simulations use start and state-timer behavior to schedule driver publications. See [events and external inputs](EVENTS_AND_INPUTS.md). There is no direct simulator function-release or destination-event injection input.

## Requirements and formal documentation

Requirements own typed attributes and one optional `doc /* ... */` specification. Design elements link through `satisfy`; verification cases link through `verify`. Use cases describe intent. Ordinary comments remain independent notes. View kinds use lower camel case, and view blocks combine multiple selections and Boolean filters. See the [guide](REQUIREMENTS_AND_DOCUMENTATION.md) and [complete model](../examples/16-requirements-and-views.swaml).

## Extended loops, interrupts and timing

Use counted `for`, copied-array `forEach` or post-test `do` when their scope and test order fit the behavior. Conditional loops retain explicit bounds. `interruptible` regions bind cancellation to an owned typed input route and preserve the activation deadline and committed effects. FV covers flow, states and interruptible regions. TV provides trace-backed function timing with declared WCET, deadline and concurrency shown separately. A timing diagram adds no execution semantics or scheduling proof. See the [complete guide](CONTROL_FLOW_AND_TIMING.md), [1.3 migration](MIGRATION_1_3.md) and [1.3.1 correction](MIGRATION_1_3_1.md).
