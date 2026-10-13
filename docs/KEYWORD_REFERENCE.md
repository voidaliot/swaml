# Alphabetical keyword reference

This user-facing reference covers every reserved word in the SWAML 1.0 grammar. Entries are sorted alphabetically, ignoring case for sorting only; source keywords remain case-sensitive. Example fragments illustrate a use and are not standalone models. Read the linked normative concern for full constraints. Punctuation and operator precedence follow the final section.

[`after`](#keyword-after) · [`and`](#keyword-and) · [`array`](#keyword-array) · [`as`](#keyword-as) · [`assert`](#keyword-assert) · [`atLeastOnce`](#keyword-atleastonce) · [`atMostOnce`](#keyword-atmostonce) · [`bestEffort`](#keyword-besteffort) · [`Bool`](#keyword-bool) · [`bound`](#keyword-bound) · [`call`](#keyword-call) · [`capacity`](#keyword-capacity) · [`case`](#keyword-case) · [`client`](#keyword-client) · [`clientServer`](#keyword-clientserver) · [`completion`](#keyword-completion) · [`component`](#keyword-component) · [`compute`](#keyword-compute) · [`concurrency`](#keyword-concurrency) · [`connect`](#keyword-connect) · [`container`](#keyword-container) · [`CV`](#keyword-cv) · [`data`](#keyword-data) · [`datatype`](#keyword-datatype) · [`deadline`](#keyword-deadline) · [`def`](#keyword-def) · [`delegate`](#keyword-delegate) · [`delivery`](#keyword-delivery) · [`deploy`](#keyword-deploy) · [`dropNewest`](#keyword-dropnewest) · [`dropOldest`](#keyword-dropoldest) · [`else`](#keyword-else) · [`entry`](#keyword-entry) · [`enum`](#keyword-enum) · [`enumValue`](#keyword-enumvalue) · [`event`](#keyword-event) · [`every`](#keyword-every) · [`exit`](#keyword-exit) · [`fail`](#keyword-fail) · [`false`](#keyword-false) · [`fifo`](#keyword-fifo) · [`final`](#keyword-final) · [`for`](#keyword-for) · [`function`](#keyword-function) · [`FV`](#keyword-fv) · [`GRV`](#keyword-grv) · [`GV`](#keyword-gv) · [`idempotent`](#keyword-idempotent) · [`if`](#keyword-if) · [`import`](#keyword-import) · [`initial`](#keyword-initial) · [`Int`](#keyword-int) · [`interface`](#keyword-interface) · [`invoke`](#keyword-invoke) · [`IV`](#keyword-iv) · [`label`](#keyword-label) · [`let`](#keyword-let) · [`machine`](#keyword-machine) · [`manual`](#keyword-manual) · [`maxAge`](#keyword-maxage) · [`maxLatency`](#keyword-maxlatency) · [`mcu`](#keyword-mcu) · [`mixed`](#keyword-mixed) · [`ms`](#keyword-ms) · [`node`](#keyword-node) · [`not`](#keyword-not) · [`ns`](#keyword-ns) · [`of`](#keyword-of) · [`on`](#keyword-on) · [`operation`](#keyword-operation) · [`optional`](#keyword-optional) · [`or`](#keyword-or) · [`ordering`](#keyword-ordering) · [`otherwise`](#keyword-otherwise) · [`overflow`](#keyword-overflow) · [`package`](#keyword-package) · [`port`](#keyword-port) · [`priority`](#keyword-priority) · [`process`](#keyword-process) · [`provides`](#keyword-provides) · [`publish`](#keyword-publish) · [`publisher`](#keyword-publisher) · [`publishSubscribe`](#keyword-publishsubscribe) · [`qos`](#keyword-qos) · [`queued`](#keyword-queued) · [`Real`](#keyword-real) · [`realtime`](#keyword-realtime) · [`receive`](#keyword-receive) · [`receiver`](#keyword-receiver) · [`record`](#keyword-record) · [`reentrant`](#keyword-reentrant) · [`reject`](#keyword-reject) · [`reply`](#keyword-reply) · [`request`](#keyword-request) · [`requirement`](#keyword-requirement) · [`requires`](#keyword-requires) · [`return`](#keyword-return) · [`s`](#keyword-s) · [`sampled`](#keyword-sampled) · [`satisfies`](#keyword-satisfies) · [`send`](#keyword-send) · [`sender`](#keyword-sender) · [`senderReceiver`](#keyword-senderreceiver) · [`serial`](#keyword-serial) · [`server`](#keyword-server) · [`service`](#keyword-service) · [`set`](#keyword-set) · [`start`](#keyword-start) · [`state`](#keyword-state) · [`String`](#keyword-string) · [`subscriber`](#keyword-subscriber) · [`SV`](#keyword-sv) · [`swaml`](#keyword-swaml) · [`system`](#keyword-system) · [`timing`](#keyword-timing) · [`transition`](#keyword-transition) · [`true`](#keyword-true) · [`unit`](#keyword-unit) · [`unordered`](#keyword-unordered) · [`us`](#keyword-us) · [`var`](#keyword-var) · [`version`](#keyword-version) · [`via`](#keyword-via) · [`view`](#keyword-view) · [`Void`](#keyword-void) · [`wcet`](#keyword-wcet) · [`when`](#keyword-when) · [`while`](#keyword-while) · [`within`](#keyword-within)

## Keyword: after

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`, `ScenarioStep`.

In a transition, creates a timer measured from source-state entry completion; leaving the state cancels its generation. In a case step, names one earlier causal predecessor, not a delay or source-order convention.

**Example fragment:** `on after 10 ms / via link after sent label received;`

## Keyword: and

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `AndExpression`.

Short-circuit Boolean conjunction. Both operands must be Bool; the right operand is evaluated only when the left is true.

**Example fragment:** `ready and enabled`

## Keyword: array

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `ArrayLiteral`.

Constructs a nonempty fixed array. Elements share one nominal type, with numeric common-type widening inside the literal. The inferred extent is the element count.

**Example fragment:** `array [1, 2, 3]`

## Keyword: as

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Request`.

Names the successful awaited RPC result. A Void result reserves the name without creating a readable value. The name must be fresh in the live lexical environment.

**Example fragment:** `request api.read() as value within 1 s otherwise { return; };`

## Keyword: assert

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Assert`.

Evaluates a Bool; false fails the activation without rollback. A failed RPC handler returns RemoteFailure through its correlation. Assertions are executable checks, not static proofs.

**Example fragment:** `assert measured <= 100;`

## Keyword: atLeastOnce

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Permits retries and duplicate delivery subject to liveness, overflow and freshness. RPC members on such a connector must declare idempotent behavior. It never implies exactly-once effects.

**Example fragment:** `delivery atLeastOnce;`

## Keyword: atMostOnce

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Allows loss but no duplicate delivery for a logical message. A lost request or response can still lead to timeout. This policy does not guarantee admission or successful execution.

**Example fragment:** `delivery atMostOnce;`

## Keyword: bestEffort

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Permits loss without an eventual-delivery guarantee and without duplicate delivery. Queue capacity, overflow and declared timing bounds still apply.

**Example fragment:** `delivery bestEffort;`

## Keyword: Bool

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Primitive two-valued Boolean type. Conditions and logical operators require Bool; numbers and strings are not truthy substitutes.

**Example fragment:** `let ready: Bool = true;`

## Keyword: bound

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `While`.

Sets the positive safe-integer maximum number of loop-body executions. After that many iterations the condition is reevaluated; a still-true condition fails execution.

**Example fragment:** `while (i < 3) bound 3 { set i = i + 1; }`

## Keyword: call

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`.

Activates a unit operation for an incoming RPC interface member. Parameters and result must match the contract, and the member has exactly one handler owner.

**Example fragment:** `operation read(): Int on call api.get { return current; }`

## Keyword: capacity

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Positive safe-integer retained-message limit per connector occurrence, direction and member. Transport-pending messages count; running handlers do not. Sampled data requires capacity 1.

**Example fragment:** `capacity 8;`

## Keyword: case

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Scenario`.

Defines a descriptive scenario for a system with labeled interface exchanges and optional requirement traces. It does not execute or prove itself and cannot introduce hidden traffic.

**Example fragment:** `case Checkout for Shop satisfies Accepted { ... }`

## Keyword: client

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Port role for the requesting side of a clientServer interface. A closed client port has at most one route; replies return through the same route and correlation.

**Example fragment:** `port api: Health client;`

## Keyword: clientServer

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Interface kind containing operation signatures only. A client issues request; a server implements on call handlers. Events belong in service or publishSubscribe contracts.

**Example fragment:** `interface clientServer Health version "1.0.0" { operation check(): Bool; }`

## Keyword: completion

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`.

Local machine stimulus reconsidered after entry and each reaction until quiescent. It is not an interface event. Unconditional cycles are invalid; guarded cycles have a 1,024-edge runtime limit.

**Example fragment:** `transition next: A -> B on completion {}`

## Keyword: component

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Component`, `Instance`.

Declares a reusable composition definition with def, or a contained occurrence without def. Components own ports, units/components, connections and delegations; execution belongs to units.

**Example fragment:** `component def Service { unit store: Store; } / component backend: Service;`

## Keyword: compute

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `FunctionCall`.

Calls a pure function owned by the same unit with copied arguments. Functions cannot observe unit state or invoke operations. The function result retains its declared type.

**Example fragment:** `compute clamp(temperature)`

## Keyword: concurrency

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Selects serial or reentrant root activation policy in a timing contract. Helpers inherit the root mode. Machines never overlap their own reactions.

**Example fragment:** `concurrency serial;`

## Keyword: connect

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Connect`.

Creates an explicit connector between immediate child ports of a component/system. Contracts must be identical and roles complementary. Every connector supplies QoS.

**Example fragment:** `connect samples: sensor.output -> controller.input qos { ... };`

## Keyword: container

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Node`.

Execution-node kind representing a container deployment location. It does not create a component, communication channel or container runtime configuration.

**Example fragment:** `node application container;`

## Keyword: CV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Case View kind: displays cases, requirements and claimed coverage for a case or system. Verified coverage requires separate linked evidence.

**Example fragment:** `view coverage CV of Shop;`

## Keyword: data

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `DataMember`.

Declares one senderReceiver member with a value type and sampled or queued mode. Outgoing use is send; incoming handling is on receive with one typed argument.

**Example fragment:** `data sample: Real sampled;`

## Keyword: datatype

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `DataType`.

Declares a nominal finite record. Field names are unique, every literal supplies all fields once, and recursive value containment is invalid. Empty records have one value.

**Example fragment:** `datatype Point { x: Real; y: Real; }`

## Keyword: deadline

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Positive elapsed-time bound from root release to completion, including queueing and request suspension. For machines it applies per reaction. WCET must not exceed it.

**Example fragment:** `deadline 5 ms;`

## Keyword: def

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Component`, `Unit`.

Distinguishes a reusable component or unit definition from a contained occurrence. Defining a type creates no runtime storage; each occurrence receives its own state.

**Example fragment:** `unit def Worker { ... }`

## Keyword: delegate

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Delegate`.

Aliases a component boundary port to one immediate child port of the same role and interface. Every component port delegates once. Delegation adds neither conversion nor a queue.

**Example fragment:** `delegate api -> worker.api;`

## Keyword: delivery

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Chooses bestEffort, atMostOnce or atLeastOnce for all member queues of a connector. Delivery is separate from FIFO ordering, admission and application success.

**Example fragment:** `delivery atMostOnce;`

## Keyword: deploy

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Deployment`.

Assigns an existing component or descendant occurrence to a system node. Descendants inherit the nearest explicit allocation. Duplicate exact-path allocations are invalid.

**Example fragment:** `deploy backend.worker on application;`

## Keyword: dropNewest

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

On a full queue, discards the offered message observably. Admission does not fail the producer; an RPC can later time out. Existing retained messages stay.

**Example fragment:** `overflow dropNewest;`

## Keyword: dropOldest

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

On a full queue, discards the oldest retained message and admits the new one. Required with capacity 1 for sampled data. It does not undo effects of already dispatched handlers.

**Example fragment:** `overflow dropOldest;`

## Keyword: else

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `If`.

Optional alternative block of an if statement. Only the chosen branch executes; branch-local declarations do not escape that branch.

**Example fragment:** `if (ready) { return; } else { fail "not ready"; }`

## Keyword: entry

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

State-entry block executed after that state becomes current. It has no incoming payload scope. Residence timers begin after entry finishes; return/fail terminates the machine.

**Example fragment:** `state Idle { entry { set count = 0; } }`

## Keyword: enum

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `EnumType`.

Declares a nominal type with one or more unique named literals. Distinct enum declarations are incompatible even if names match; no implicit integer conversion exists.

**Example fragment:** `enum Health { Good, Failed }`

## Keyword: enumValue

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `EnumLiteral`.

Constructs one declared literal of an enum type. The dot selects an enum literal, not a component path or variable field.

**Example fragment:** `enumValue Health.Good`

## Keyword: event

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `EventMember`.

Declares a typed asynchronous member in publishSubscribe or service. It must be emitted by an operation through a port and owned by one receiving operation; free global events are absent.

**Example fragment:** `event changed(value: Real);`

## Keyword: every

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`.

Periodic parameterless Void activation at epoch plus k periods, k starting at 1. Releases do not merge when earlier activations are busy; pending work is bounded by the binding.

**Example fragment:** `operation sample(): Void on every 10 ms { ... }`

## Keyword: exit

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

State-exit block runs after timer cancellation and before the transition effect. It lacks payload scope. Return/failure skips remaining transition phases.

**Example fragment:** `state Running { exit { set active = false; } }`

## Keyword: fail

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Fail`.

Raises a local failure with a String literal reason, unwinds synchronous callers, and preserves committed effects. An RPC caller receives the correlated RemoteFailure outcome.

**Example fragment:** `fail "invalid operating mode";`

## Keyword: false

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `Literal`.

The false Bool literal. Distinct from numeric zero, empty strings or absent values; no implicit coercion exists.

**Example fragment:** `let ready: Bool = false;`

## Keyword: fifo

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Dispatches retained messages in queue order for one connector/direction/member. Independent queues and handler completion order are not globally ordered.

**Example fragment:** `ordering fifo;`

## Keyword: final

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

Marks a state that completes its owning operation after entry. It has no outgoing transition. Future input to that machine is undeliverable, not rerouted.

**Example fragment:** `state Stopped final {}`

## Keyword: for

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Scenario`.

Selects the system described by a case. The steps must use top-level connectors and exposed component port/member paths of that system.

**Example fragment:** `case Poll for HealthCheck { ... }`

## Keyword: function

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `FunctionDef`.

Defines a pure expression with a non-Void result. It sees only copied parameters and other local pure functions, never unit variables. The call graph is acyclic.

**Example fragment:** `function twice(x: Real): Real = x * 2.0;`

## Keyword: FV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Flow View of an operation. Projects either its statement body or its owned states/transitions in the same view family. There are no performer allocations or separate AFV/STV kinds.

**Example fragment:** `view control FV of Controller.regulate;`

## Keyword: GRV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Grid View of a package or named semantic declaration other than a view. Presents inventory, contracts, timing, allocation or trace tables; sorting does not change model meaning.

**Example fragment:** `view inventory GRV of Architecture;`

## Keyword: GV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

General View of a package or resolvable named semantic declaration other than a view. Shows ownership, types, attributes and relations, retaining definition/occurrence distinction.

**Example fragment:** `view overview GV of Product;`

## Keyword: idempotent

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Signature`.

Contract assertion required for RPC under atLeastOnce delivery. Repeated requests must have idempotent effects including published side effects. The keyword alone is not a proof.

**Example fragment:** `operation read(): Int idempotent;`

## Keyword: if

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `If`.

Evaluates one Bool and executes the selected lexical block. It supplies no concurrency or implicit variable merging. Value-returning operations must cover both paths or fail.

**Example fragment:** `if (value > limit) { return false; } else { return true; }`

## Keyword: import

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Import`.

Imports top-level names from one package using namespace::*; imports are not transitive. A short name must be unique across local and directly imported declarations.

**Example fragment:** `import Common::*;`

## Keyword: initial

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Machine`.

References exactly one state in the owning machine. Initialization enters it once per system epoch before the machine consumes input.

**Example fragment:** `initial Idle;`

## Keyword: Int

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Exact signed integer type from -(2^53-1) through 2^53-1. Overflow, invalid indexing and division/remainder by zero fail execution. Scalar Int may widen to Real.

**Example fragment:** `var count: Int = 0;`

## Keyword: interface

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Declares a nominal, versioned contract of one of four kinds. Port endpoints must reference the same declaration; matching names or version strings alone are insufficient.

**Example fragment:** `interface service Orders version "1.0.0" { ... }`

## Keyword: invoke

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Invoke`.

Synchronously calls an untriggered Void operation in the same unit. It shares the root lock and snapshot; copied parameters are local. Remote invocation requires request through a port.

**Example fragment:** `invoke prepare();`

## Keyword: IV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Interconnect View of a system/component definition or occurrence. Shows immediate children, boundary ports, connectors and delegation with exact interface paths.

**Example fragment:** `view wiring IV of Product;`

## Keyword: label

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `ScenarioStep`.

Assigns a unique name to a scenario step. Later after clauses use that label as a causal predecessor; source position alone imposes no ordering.

**Example fragment:** `via orderLink label submitted;`

## Keyword: let

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Let`.

Creates a typed mutable local value from a copied initializer. It cannot shadow a live local, parameter or unit variable, and disappears at block exit.

**Example fragment:** `let count: Int = 0;`

## Keyword: machine

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Machine`.

Alternative body of a parameterless Void on start operation. Owns one flat set of states and transitions. State behavior is directly owned by the operation, without a performer layer.

**Example fragment:** `operation lifecycle(): Void on start machine { initial Idle; state Idle {} }`

## Keyword: manual

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`.

Parameterless Void operation trigger released by a harness. It is control of execution, not a route for injecting external model payloads or bypassing interfaces.

**Example fragment:** `operation refresh(): Void on manual { ... }`

## Keyword: maxAge

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Maximum message age measured from original emission through retries. Eligibility is inclusive; greater age discards before dispatch. Required for sampled data in realtime/mixed systems.

**Example fragment:** `maxAge 20 ms;`

## Keyword: maxLatency

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Positive bound from admitted emission to destination readiness, excluding dispatch wait. Exceeding it is an observable contract violation. Required on realtime/mixed connectors.

**Example fragment:** `maxLatency 1 ms;`

## Keyword: mcu

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Node`.

Execution-node kind for an embedded microcontroller location. The core does not infer interrupts, task priorities, processor speed or memory limits.

**Example fragment:** `node controller mcu;`

## Keyword: mixed

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `System`.

System profile covering embedded/service combinations. All used operations carry timing and all connectors latency; sampled data also carries age. It does not silently exempt cloud-facing paths.

**Example fragment:** `system Product mixed { ... }`

## Keyword: ms

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Millisecond duration unit; one ms equals 1,000,000 ns. Duration magnitude must be a positive integer and normalize exactly within the safe range.

**Example fragment:** `within 25 ms`

## Keyword: node

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Node`.

Declares a named execution location in a system with mcu, process or container kind. Nodes affect allocation only; traffic still follows interfaces.

**Example fragment:** `node edge process;`

## Keyword: not

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `UnaryExpression`.

Unary Bool negation with precedence above multiplication. No numeric or string coercion is allowed.

**Example fragment:** `not ready`

## Keyword: ns

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Nanosecond duration unit and the reference simulation clock's integral base. All specified durations are positive, with safe exact conversion.

**Example fragment:** `after 1 ns`

## Keyword: of

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Introduces a view subject path rooted in the owning package or its top-level declaration. Allowed subject kinds depend on the view kind.

**Example fragment:** `view flow FV of Product.controller.worker.run;`

## Keyword: on

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Deployment`, `Trigger`, `Transition`.

Introduces an operation or transition trigger. Operations use start/manual/every/receive/call; transitions use completion/after/receive. Triggers do not introduce free signals.

**Example fragment:** `on receive input.sample`

## Keyword: operation

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Signature`, `Operation`.

In an interface, declares an RPC signature. In a unit, declares executable flow or an owned machine. An incoming signature is implemented by exactly one on call operation.

**Example fragment:** `operation get(): Int; / operation read(): Int on call api.get { return value; }`

## Keyword: optional

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Allows a port to remain unconnected in a closed system. It does not change contract, role or handler rules. Unbound data/event sends succeed; unbound RPC reports Unavailable.

**Example fragment:** `port diagnostics: Notices publisher optional;`

## Keyword: or

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `OrExpression`.

Short-circuit Boolean disjunction. The right Bool operand is evaluated only when the left is false.

**Example fragment:** `ready or retryAllowed`

## Keyword: ordering

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Selects fifo or unordered independently of delivery reliability. Ordering applies per connector occurrence, direction and member, not across an entire interface or system.

**Example fragment:** `ordering fifo;`

## Keyword: otherwise

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Request`.

Mandatory request failure block with implicit copied failure:String. It must return or fail on every path and cannot fall through to successful result use.

**Example fragment:** `within 1 s otherwise { set lastError = failure; return; };`

## Keyword: overflow

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Required admission policy when a member queue is full: dropOldest, dropNewest or reject. Policies apply independently to every route in fanout.

**Example fragment:** `overflow reject;`

## Keyword: package

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Package`.

Top-level, non-nested namespace for declarations and direct imports. A package is declared once in the loaded workspace; multiple packages may share a file.

**Example fragment:** `package Control { ... }`

## Keyword: port

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Owned communication boundary feature typed by one interface, with a compatible role and optionality. Component ports delegate to children; unit ports bind operations to members.

**Example fragment:** `port api: Orders requires;`

## Keyword: priority

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`.

Nonnegative safe-integer tie-break among matching transitions for the same state and stimulus; larger wins, default 0. It is not an operation scheduling priority.

**Example fragment:** `on receive commands.begin priority 2 {}`

## Keyword: process

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Node`.

Execution-node kind for a logical process. It supplies no hidden IPC access, shared memory or task scheduling policy.

**Example fragment:** `node worker process;`

## Keyword: provides

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Provider role of a service interface. Handles incoming RPC, returns correlated results/failures and publishes its declared events in reverse connector direction.

**Example fragment:** `port api: Orders provides;`

## Keyword: publish

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Send`, `ScenarioStep`.

Emits an outgoing event through a publisher/provides port. In a case, describes a routed event step. Arguments are evaluated once and copied per route; no free event syntax exists.

**Example fragment:** `publish api.changed(current);`

## Keyword: publisher

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Outgoing role for a publishSubscribe contract. One port may fan out through several connectors; every outgoing member is tied to an emitting operation.

**Example fragment:** `port events: Notices publisher;`

## Keyword: publishSubscribe

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Event-only contract kind with publisher/subscriber ports. Subscriptions are explicit static connectors. Runtime subscribe/unsubscribe and wildcard topics are outside 1.0.

**Example fragment:** `interface publishSubscribe Notices version "1.0.0" { event changed(); }`

## Keyword: qos

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Introduces connector delivery, ordering, capacity and overflow, followed by optional latency and age in the grammar's order. Each connector must supply the block.

**Example fragment:** `qos { delivery atMostOnce; ordering fifo; capacity 4; overflow reject; }`

## Keyword: queued

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `DataMember`.

SenderReceiver data mode representing a sequence of retained values under queue policy. It does not imply losslessness or unbounded history.

**Example fragment:** `data text: String queued;`

## Keyword: Real

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Finite IEEE 754 binary64 type. Arithmetic is nearest-even; non-finite results and division by zero fail. Scalar Int widens, but fixed arrays do not implicitly widen.

**Example fragment:** `var temperature: Real = 20.0;`

## Keyword: realtime

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `System`.

System profile requiring operation timing, connector latency and sampled freshness contracts. Those declarations require target evidence before any hard realtime claim.

**Example fragment:** `system Heating realtime { ... }`

## Keyword: receive

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`, `Transition`.

Consumes an incoming data/event member through a receiver/subscriber/requires port. An ordinary operation receives copied parameters; a transition exposes event parameters or data payload in guard/effect.

**Example fragment:** `on receive commands.begin`

## Keyword: receiver

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Incoming senderReceiver role. Every data member has one handler owner; at most one route feeds a closed receiver port. Multiple sources require an explicit merge/adaptor unit.

**Example fragment:** `port input: Samples receiver;`

## Keyword: record

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `RecordLiteral`.

Constructs a nominal datatype value by assigning each declared field exactly once. Field order in the literal does not change record equality; fields remain copied values.

**Example fragment:** `record Point { x = 1.0; y = 2.0; }`

## Keyword: reentrant

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Allows overlapping roots with independent dispatch-time unit snapshots. Direct or helper writes to unit state are statically invalid. Local variables remain mutable; one machine reaction cannot overlap itself.

**Example fragment:** `concurrency reentrant;`

## Keyword: reject

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

On full queue, rejects the offer. Data/event producers fail after all fanout offers; requests take otherwise with Rejected. Previously accepted offers and effects are preserved.

**Example fragment:** `overflow reject;`

## Keyword: reply

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `ScenarioStep`.

Describes a response step in a case, reversing an existing connector/member request. It must have one unanswered causal request ancestor. Executable handlers reply by returning, not by a reply statement.

**Example fragment:** `reply backend.api.get -> client.api.get via link after asked label answered;`

## Keyword: request

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Request`, `ScenarioStep`.

Awaits one RPC on a local client/requires port with fresh correlation, result name, finite timeout and explicit failure block. In cases it describes the corresponding routed exchange.

**Example fragment:** `request api.get() as value within 1 s otherwise { return; };`

## Keyword: requirement

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Requirement`.

Named natural-language obligation. It has descriptive text and can be referenced by cases; the core supplies no implicit requirements solver or verified checkmark.

**Example fragment:** `requirement Safe "Duty shall remain within the allowed range.";`

## Keyword: requires

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Consumer role of a service interface. Issues RPC and handles reverse-direction provider events. It has at most one route in a closed system.

**Example fragment:** `port orders: Orders requires;`

## Keyword: return

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Return`.

Completes the current operation with a copied typed result or bare Void. Inside an invoked helper it resumes the caller; inside state behavior it terminates the owning machine immediately.

**Example fragment:** `return accepted;`

## Keyword: s

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Second duration unit; one s equals 1,000,000,000 ns. A duration must still fit the exact safe nanosecond range.

**Example fragment:** `within 2 s`

## Keyword: sampled

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `DataMember`.

SenderReceiver data mode retaining the latest pending sample: capacity 1 and dropOldest are mandatory. Dispatch removes the sample; the core does not define a remote shared-variable read.

**Example fragment:** `data temperature: Real sampled;`

## Keyword: satisfies

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Scenario`.

Links a case to one or more requirement declarations as intended coverage. It is a claim requiring test/analysis/review evidence, not a proof by syntax.

**Example fragment:** `case Checkout for Shop satisfies Accepted, Audited { ... }`

## Keyword: send

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Send`, `ScenarioStep`.

Emits an outgoing senderReceiver data member through a sender port with exactly one value. In a case it describes a data exchange. It cannot publish events or bypass another unit's interface.

**Example fragment:** `send output.temperature(23.5);`

## Keyword: sender

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Outgoing senderReceiver role. May fan out through multiple explicit connectors; each member has at least one syntactically associated emitting operation.

**Example fragment:** `port output: Samples sender;`

## Keyword: senderReceiver

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Data-only contract kind with sampled/queued members and sender/receiver roles. No RPC operations or event members may be declared inside it.

**Example fragment:** `interface senderReceiver Samples version "1.0.0" { data value: Real sampled; }`

## Keyword: serial

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Default root mode: acquire the unit's one serial lock until completion/failure, including RPC waits. Local invokes share the root lock. Independent unit roots may still interleave.

**Example fragment:** `concurrency serial;`

## Keyword: server

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Provider role for clientServer contracts. Each operation signature has exactly one on call handler; results/failures follow the request correlation.

**Example fragment:** `port health: Health server;`

## Keyword: service

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`, `System`.

As an interface kind, combines RPC operations and events with requires/provides roles. As a system profile, makes timing contracts optional while retaining interfaces, QoS and static validity.

**Example fragment:** `interface service Orders version "1.0.0" { ... } / system Shop service { ... }`

## Keyword: set

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Assign`.

Replaces an existing mutable local, parameter or permitted unit variable with a copied assignable value. Field/index mutation and remote/private access are absent.

**Example fragment:** `set current = desired;`

## Keyword: start

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`.

Once-per-run startup trigger for a parameterless Void operation. State machines require it. All stores/routes/handlers exist before startup work runs; readiness protocols still need explicit ports.

**Example fragment:** `operation boot(): Void on start { ... }`

## Keyword: state

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

Declares a named operation-owned state with optional entry/exit and final marker. States are flat, directly owned and never assigned later to performers.

**Example fragment:** `state Idle { entry { set active = false; } }`

## Keyword: String

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Finite Unicode text with exact equality and no normalization. Strings support portable escapes; implicit concatenation, ordering and bounded transport size are absent.

**Example fragment:** `var lastError: String = "";`

## Keyword: subscriber

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Incoming publishSubscribe role. Multiple publishers may feed one subscriber port through distinct queues. Each event has one handler owner; cross-source ordering is unspecified.

**Example fragment:** `port input: Notices subscriber;`

## Keyword: SV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Sequence View of a case or a system's selected case. Lifelines are occurrences; arrows show port/member/connector and request correlation. Independent steps must remain visibly unordered.

**Example fragment:** `view checkout SV of Checkout;`

## Keyword: swaml

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Model`.

Mandatory document introducer followed by the exact language major/minor header string and semicolon. All loaded sources must use supported version 1.0.

**Example fragment:** `swaml "1.0";`

## Keyword: system

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `System`.

Closed assembly of top-level component occurrences, connectors, execution nodes and deployment. Each selected system expands definitions into distinct runtime instances.

**Example fragment:** `system Product mixed { component root: Assembly; ... }`

## Keyword: timing

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Operation contract containing wcet, deadline and concurrency in that order. Required on used operations in realtime/mixed systems; machine timing applies per reaction.

**Example fragment:** `timing { wcet 1 ms; deadline 5 ms; concurrency serial; }`

## Keyword: transition

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`.

Named state edge owned by one machine, with source/target, stimulus, optional guard/priority and effect. Execution orders exit, effect, state update, entry, then completion processing.

**Example fragment:** `transition beginRun: Idle -> Running on receive commands.begin {}`

## Keyword: true

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `Literal`.

The true Bool literal, with no implicit equivalence to numeric one or other nonempty values.

**Example fragment:** `assert true;`

## Keyword: unit

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Unit`, `Instance`.

Smallest interface-protected software boundary. Defines private data/functions/operations or instantiates a unit inside a component. Systems wrap top-level units in components.

**Example fragment:** `unit def Worker { ... } / unit worker: Worker;`

## Keyword: unordered

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

No source-language dispatch ordering guarantee beyond other causal rules. A deterministic backend may still choose FIFO; this choice must not be mistaken for a model guarantee.

**Example fragment:** `ordering unordered;`

## Keyword: us

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Microsecond duration unit; one us equals 1,000 ns. The source spelling is ASCII us, not the micro sign.

**Example fragment:** `wcet 100 us;`

## Keyword: var

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `Variable`.

Declares private per-unit mutable state with a typed pure initializer independent of mutable variables. Each unit occurrence owns separate storage; other units cannot read it directly.

**Example fragment:** `var count: Int = 0;`

## Keyword: version

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Required interface semantic-version string major.minor.patch. Compatibility is nominal declaration identity, not automatic version-range matching or structural subtyping.

**Example fragment:** `interface clientServer API version "1.0.0" { ... }`

## Keyword: via

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `ScenarioStep`.

Names the top-level system connector used by a case exchange. Endpoint-member paths must resolve on its visible component ports with a legal orientation.

**Example fragment:** `via orderLink label submitted;`

## Keyword: view

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Declares a named projection of an existing semantic subject with GV/IV/CV/SV/GRV/FV kind. It carries no executable behavior or diagram geometry.

**Example fragment:** `view wiring IV of Product;`

## Keyword: Void

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Uninhabited operation/signature result type. Invalid for stored values, parameters, record fields, arrays and pure-function results. A Void RPC result name is reserved but unreadable.

**Example fragment:** `operation notify(): Void { return; }`

## Keyword: wcet

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Positive active-execution-time bound including local helpers and machine microsteps, excluding request wait. Must not exceed deadline; physical evidence belongs to a target binding.

**Example fragment:** `wcet 1 ms;`

## Keyword: when

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`.

Optional pure Bool transition guard evaluated against the unit snapshot/live environment and stimulus payload as applicable. False consumes/ignores the stimulus when no other transition matches.

**Example fragment:** `on receive commands.begin when (enabled) {}`

## Keyword: while

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `While`.

Pretest Bool loop with mandatory positive bound. Each iteration has a lexical body scope. A still-true condition after the bound fails instead of silently exiting.

**Example fragment:** `while (i < 3) bound 3 { set i = i + 1; }`

## Keyword: within

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Request`.

Required positive RPC timeout measured from issuance. Only a response observed strictly before expiry can win; equal-time expiry wins and late server effects are not canceled.

**Example fragment:** `within 100 ms otherwise { return; };`

## Punctuation and operator reference

| Token | Meaning |
| --- | --- |
| `;` | Declaration/statement terminator where the production requires it. |
| `{ }` | Owned declarations, block scope, record assignments, QoS or timing block according to context. |
| `( )` | Arguments, parameters, conditions or precedence grouping. |
| `[ ]` | Fixed type extent, array literal or one final index read. |
| `:` | Name/type separator, operation result or connector/transition header separator. |
| `,` | List separator; no implicit trailing comma. |
| `::` | Package qualification; imports append `::*`. |
| `.` | Structural/member path, local record field, enum literal separator or real-literal decimal point. |
| `->` | Connector, delegation, state transition or case exchange direction. |
| `=` | Initialization, assignment, pure function body or record field assignment; never equality. |
| `== !=` | Typed recursive equality/inequality; numeric scalar promotion permitted. |
| `< <= > >=` | Numeric ordering; no String ordering. |
| `+ - * / %` | Checked numeric arithmetic; slash always Real, remainder Int only; minus also unary. |
| `//` / `/* */` | Line / non-nested block comments outside strings. |

Precedence, lowest first: or; and; equality; ordered comparison; addition/subtraction; multiplication/division/remainder; unary not/minus; primary. Binary operators associate left. Only and/or short-circuit. Identifiers, strings, numerics and durations have the exact lexical rules in [chapter 1](spec/01-structure-and-types.md); the [complete grammar](../src/language/swaml.langium) is authoritative for concrete syntax.
