# Alphabetical keyword reference

This user-facing reference covers every reserved word in the SWAML 1.1 grammar. Entries are sorted alphabetically, ignoring case for sorting only; source keywords remain case-sensitive. Example fragments illustrate a use and are not standalone models. Read the linked normative concern for full constraints. Punctuation and operator precedence follow the final section.

[`after`](#keyword-after) · [`and`](#keyword-and) · [`as`](#keyword-as) · [`assert`](#keyword-assert) · [`atLeastOnce`](#keyword-atleastonce) · [`atMostOnce`](#keyword-atmostonce) · [`bestEffort`](#keyword-besteffort) · [`Bool`](#keyword-bool) · [`bound`](#keyword-bound) · [`call`](#keyword-call) · [`capacity`](#keyword-capacity) · [`case`](#keyword-case) · [`client`](#keyword-client) · [`clientServer`](#keyword-clientserver) · [`completion`](#keyword-completion) · [`component`](#keyword-component) · [`concurrency`](#keyword-concurrency) · [`connect`](#keyword-connect) · [`container`](#keyword-container) · [`CV`](#keyword-cv) · [`data`](#keyword-data) · [`datatype`](#keyword-datatype) · [`deadline`](#keyword-deadline) · [`def`](#keyword-def) · [`delegate`](#keyword-delegate) · [`delivery`](#keyword-delivery) · [`deploy`](#keyword-deploy) · [`dropNewest`](#keyword-dropnewest) · [`dropOldest`](#keyword-dropoldest) · [`else`](#keyword-else) · [`entry`](#keyword-entry) · [`enum`](#keyword-enum) · [`event`](#keyword-event) · [`every`](#keyword-every) · [`exit`](#keyword-exit) · [`fail`](#keyword-fail) · [`false`](#keyword-false) · [`fifo`](#keyword-fifo) · [`final`](#keyword-final) · [`for`](#keyword-for) · [`function`](#keyword-function) · [`FV`](#keyword-fv) · [`GRV`](#keyword-grv) · [`GV`](#keyword-gv) · [`idempotent`](#keyword-idempotent) · [`if`](#keyword-if) · [`import`](#keyword-import) · [`initial`](#keyword-initial) · [`Int`](#keyword-int) · [`interface`](#keyword-interface) · [`invoke`](#keyword-invoke) · [`IV`](#keyword-iv) · [`label`](#keyword-label) · [`let`](#keyword-let) · [`manual`](#keyword-manual) · [`maxAge`](#keyword-maxage) · [`maxLatency`](#keyword-maxlatency) · [`mcu`](#keyword-mcu) · [`mixed`](#keyword-mixed) · [`ms`](#keyword-ms) · [`node`](#keyword-node) · [`not`](#keyword-not) · [`ns`](#keyword-ns) · [`of`](#keyword-of) · [`on`](#keyword-on) · [`operation`](#keyword-operation) · [`optional`](#keyword-optional) · [`or`](#keyword-or) · [`ordering`](#keyword-ordering) · [`otherwise`](#keyword-otherwise) · [`overflow`](#keyword-overflow) · [`package`](#keyword-package) · [`port`](#keyword-port) · [`priority`](#keyword-priority) · [`process`](#keyword-process) · [`provides`](#keyword-provides) · [`publish`](#keyword-publish) · [`publisher`](#keyword-publisher) · [`publishSubscribe`](#keyword-publishsubscribe) · [`qos`](#keyword-qos) · [`queued`](#keyword-queued) · [`Real`](#keyword-real) · [`realtime`](#keyword-realtime) · [`receive`](#keyword-receive) · [`receiver`](#keyword-receiver) · [`record`](#keyword-record) · [`reentrant`](#keyword-reentrant) · [`reject`](#keyword-reject) · [`reply`](#keyword-reply) · [`request`](#keyword-request) · [`requirement`](#keyword-requirement) · [`requires`](#keyword-requires) · [`return`](#keyword-return) · [`s`](#keyword-s) · [`sampled`](#keyword-sampled) · [`satisfies`](#keyword-satisfies) · [`send`](#keyword-send) · [`sender`](#keyword-sender) · [`senderReceiver`](#keyword-senderreceiver) · [`serial`](#keyword-serial) · [`server`](#keyword-server) · [`service`](#keyword-service) · [`start`](#keyword-start) · [`state`](#keyword-state) · [`String`](#keyword-string) · [`subscriber`](#keyword-subscriber) · [`SV`](#keyword-sv) · [`timing`](#keyword-timing) · [`transition`](#keyword-transition) · [`true`](#keyword-true) · [`unit`](#keyword-unit) · [`unordered`](#keyword-unordered) · [`us`](#keyword-us) · [`var`](#keyword-var) · [`version`](#keyword-version) · [`via`](#keyword-via) · [`view`](#keyword-view) · [`Void`](#keyword-void) · [`wcet`](#keyword-wcet) · [`when`](#keyword-when) · [`while`](#keyword-while) · [`within`](#keyword-within)

## Keyword: after

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`, `ScenarioStep`.

In a transition, creates a timer measured from source-state entry completion; leaving the state cancels its generation. In a case step, names one earlier causal predecessor, not a delay or source-order convention.

**Example fragment:** `on after 10 ms / via link after sent label received;`

**Graphical notation:** [Residence timer transition](GRAPHICAL_CATALOG.md#notation-timer-transition), [Case causal order](GRAPHICAL_CATALOG.md#notation-case-causal-order). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: and

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `AndExpression`.

Short-circuit Boolean conjunction. Both operands must be Bool; the right operand is evaluated only when the left is true.

**Example fragment:** `ready and enabled`

**Graphical notation:** [Expressions and value paths](GRAPHICAL_CATALOG.md#notation-expression). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: as

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Request`.

Names the successful awaited RPC result. A Void result reserves the name without creating a readable value. The name must be fresh in the live lexical environment.

**Example fragment:** `request api.read() as value within 1 s otherwise { return; };`

**Graphical notation:** [RPC request and failure continuation](GRAPHICAL_CATALOG.md#notation-request). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: assert

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Assert`.

Evaluates a Bool; false fails the activation without rollback. A failed RPC handler returns RemoteFailure through its correlation. Assertions are executable checks, not static proofs.

**Example fragment:** `assert measured <= 100;`

**Graphical notation:** [Assertion](GRAPHICAL_CATALOG.md#notation-assert). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: atLeastOnce

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Permits retries and duplicate delivery subject to liveness, overflow and freshness. RPC members on such a connector must declare idempotent behavior. It never implies exactly-once effects.

**Example fragment:** `delivery atLeastOnce;`

**Graphical notation:** [Delivery policy](GRAPHICAL_CATALOG.md#notation-delivery-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: atMostOnce

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Allows loss but no duplicate delivery for a logical message. A lost request or response can still lead to timeout. This policy does not guarantee admission or successful execution.

**Example fragment:** `delivery atMostOnce;`

**Graphical notation:** [Delivery policy](GRAPHICAL_CATALOG.md#notation-delivery-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: bestEffort

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Permits loss without an eventual-delivery guarantee and without duplicate delivery. Queue capacity, overflow and declared timing bounds still apply.

**Example fragment:** `delivery bestEffort;`

**Graphical notation:** [Delivery policy](GRAPHICAL_CATALOG.md#notation-delivery-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: Bool

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Primitive two-valued Boolean type. Conditions and logical operators require Bool; numbers and strings are not truthy substitutes.

**Example fragment:** `let ready: Bool = true;`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: bound

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `While`.

Sets the positive safe-integer maximum number of loop-body executions. After that many iterations the condition is reevaluated; a still-true condition fails execution.

**Example fragment:** `while (i < 3) bound 3 { i = i + 1; }`

**Graphical notation:** [Bounded loop](GRAPHICAL_CATALOG.md#notation-bounded-loop). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: call

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`.

Activates a unit operation for an incoming RPC interface member. Parameters and result must match the contract, and the member has exactly one handler owner.

**Example fragment:** `operation read(): Int on call api.get { return current; }`

**Graphical notation:** [RPC handler activation](GRAPHICAL_CATALOG.md#notation-trigger-call). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: capacity

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Positive safe-integer retained-message limit per connector occurrence, direction and member. Transport-pending messages count; running handlers do not. Sampled data requires capacity 1.

**Example fragment:** `capacity 8;`

**Graphical notation:** [Queue capacity](GRAPHICAL_CATALOG.md#notation-capacity-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: case

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Scenario`.

Defines a descriptive scenario for a root component with labeled interface exchanges and optional requirement traces. It does not execute or prove itself and cannot introduce hidden traffic.

**Example fragment:** `case Checkout for Shop satisfies Accepted { ... }`

**Graphical notation:** [Case](GRAPHICAL_CATALOG.md#notation-case). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: client

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Port role for the requesting side of a clientServer interface. A closed client port has at most one route; replies return through the same route and correlation.

**Example fragment:** `port api: Health client;`

**Graphical notation:** [RPC client port](GRAPHICAL_CATALOG.md#notation-port-client). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: clientServer

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Interface kind containing operation signatures only. A client issues request; a server implements on call handlers. Events belong in service or publishSubscribe contracts.

**Example fragment:** `interface clientServer Health version "1.0.0" { operation check(): Bool; }`

**Graphical notation:** [Client–server interface](GRAPHICAL_CATALOG.md#notation-client-server-interface). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: completion

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`.

Local state stimulus reconsidered after entry and each reaction until quiescent. It is not an interface event. Unconditional cycles are invalid; guarded cycles have a 1,024-edge runtime limit.

**Example fragment:** `transition next: A -> B on completion {}`

**Graphical notation:** [Completion transition](GRAPHICAL_CATALOG.md#notation-completion-transition). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: component

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Component`, `Instance`, `RootComponent`.

With def, declares a reusable composition type. Without def, a typed child occurrence uses name: Type; at package level a root occurrence either supplies inline unit/component children and connectors or instantiates a component definition. A typed root body may bind nodes/deployment only. The root profile defaults to service.

**Example fragment:** `component def Assembly { unit controller: Controller; } / component Demo: Assembly;`

**Graphical notation:** [Component definition](GRAPHICAL_CATALOG.md#notation-component-definition), [Component usage](GRAPHICAL_CATALOG.md#notation-component-usage), [Root component](GRAPHICAL_CATALOG.md#notation-root-component), [Inline root composition](GRAPHICAL_CATALOG.md#notation-inline-root), [Occurrence typing relationship](GRAPHICAL_CATALOG.md#notation-type-relationship). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: concurrency

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Selects serial or reentrant operation activation policy in a timing contract. Helpers inherit the activation mode. Stateful operations never overlap their own reactions.

**Example fragment:** `concurrency serial;`

**Graphical notation:** [Concurrency mode](GRAPHICAL_CATALOG.md#notation-concurrency-mode). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: connect

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Connect`.

Creates an explicit connector between immediate child ports of a component definition or root component. Contracts must be identical and roles complementary. Every connector supplies QoS.

**Example fragment:** `connect samples: sensor.output -> controller.input qos { ... };`

**Graphical notation:** [Interface connector](GRAPHICAL_CATALOG.md#notation-connector). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: container

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Node`.

Execution-node kind representing a container deployment location. It does not create a component, communication channel or container runtime configuration.

**Example fragment:** `node application container;`

**Graphical notation:** [Execution node](GRAPHICAL_CATALOG.md#notation-execution-node). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: CV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Case View kind: displays cases, requirements and claimed coverage for a case or root component. Verified coverage requires separate linked evidence.

**Example fragment:** `view coverage CV of Shop;`

**Graphical notation:** [Case View](GRAPHICAL_CATALOG.md#notation-view-cv). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: data

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `DataMember`.

Declares one senderReceiver member with a value type and sampled or queued mode. Outgoing use is send; incoming handling is on receive with one typed argument.

**Example fragment:** `data sample: Real sampled;`

**Graphical notation:** [Data member](GRAPHICAL_CATALOG.md#notation-data-member). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: datatype

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `DataType`.

Declares a nominal finite record. Field names are unique, every literal supplies all fields once, and recursive value containment is invalid. Empty records have one value.

**Example fragment:** `datatype Point { x: Real; y: Real; }`

**Graphical notation:** [Record datatype](GRAPHICAL_CATALOG.md#notation-datatype). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: deadline

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Positive elapsed-time bound from activation release to completion, including queueing and request suspension. For stateful operations it applies per reaction. WCET must not exceed it.

**Example fragment:** `deadline 5 ms;`

**Graphical notation:** [Operation timing contract](GRAPHICAL_CATALOG.md#notation-timing-contract). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: def

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Component`, `Unit`.

Required marker for a reusable component or unit type. Definitions create no running singleton. An occurrence without def must either refer to the matching definition kind or, for a package-level component root, supply inline composition.

**Example fragment:** `unit def Worker { ... }`

**Graphical notation:** [Component definition](GRAPHICAL_CATALOG.md#notation-component-definition), [Unit definition](GRAPHICAL_CATALOG.md#notation-unit-definition). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: delegate

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Delegate`.

Aliases a component boundary port to one immediate child port of the same role and interface. Every component port delegates once. Delegation adds neither conversion nor a queue.

**Example fragment:** `delegate api -> worker.api;`

**Graphical notation:** [Boundary delegation](GRAPHICAL_CATALOG.md#notation-delegation). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: delivery

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Chooses bestEffort, atMostOnce or atLeastOnce for all member queues of a connector. Delivery is separate from FIFO ordering, admission and application success.

**Example fragment:** `delivery atMostOnce;`

**Graphical notation:** [Delivery policy](GRAPHICAL_CATALOG.md#notation-delivery-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: deploy

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Deployment`.

Assigns an existing component or descendant occurrence to a root component node. Descendants inherit the nearest explicit allocation. Duplicate exact-path allocations are invalid.

**Example fragment:** `deploy backend.worker on application;`

**Graphical notation:** [Deployment binding](GRAPHICAL_CATALOG.md#notation-deployment). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: dropNewest

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

On a full queue, discards the offered message observably. Admission does not fail the producer; an RPC can later time out. Existing retained messages stay.

**Example fragment:** `overflow dropNewest;`

**Graphical notation:** [Overflow behavior](GRAPHICAL_CATALOG.md#notation-overflow-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: dropOldest

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

On a full queue, discards the oldest retained message and admits the new one. Required with capacity 1 for sampled data. It does not undo effects of already dispatched handlers.

**Example fragment:** `overflow dropOldest;`

**Graphical notation:** [Overflow behavior](GRAPHICAL_CATALOG.md#notation-overflow-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: else

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `If`.

Optional alternative block of an if statement. Only the chosen branch executes; branch-local declarations do not escape that branch.

**Example fragment:** `if (ready) { return; } else { fail "not ready"; }`

**Graphical notation:** [Conditional branch](GRAPHICAL_CATALOG.md#notation-conditional). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: entry

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

State-entry block executed after that state becomes current. It has no incoming payload scope. Residence timers begin after entry finishes; return/fail terminates the owning operation.

**Example fragment:** `state Idle { entry { count = 0; } }`

**Graphical notation:** [State entry behavior](GRAPHICAL_CATALOG.md#notation-state-entry). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: enum

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `EnumType`.

Declares a nominal set of one or more unique literals. Values use Type.Literal or Package::Type.Literal. A live value first segment in the current expression environment takes precedence over an unqualified enum name, with no fallback after a failed field lookup; qualify to select the enum explicitly.

**Example fragment:** `enum Status { Ready, Failed } / Status.Ready / Contracts::Status.Ready`

**Graphical notation:** [Enumeration](GRAPHICAL_CATALOG.md#notation-enumeration). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: event

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `EventMember`.

Declares a typed asynchronous member in publishSubscribe or service. It must be emitted by an operation through a port and owned by one receiving operation; free global events are absent.

**Example fragment:** `event changed(value: Real);`

**Graphical notation:** [Event member](GRAPHICAL_CATALOG.md#notation-event-member). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: every

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`.

Periodic parameterless Void activation at epoch plus k periods, k starting at 1. Releases do not merge when earlier activations are busy; pending work is bounded by the binding.

**Example fragment:** `operation sample(): Void on every 10 ms { ... }`

**Graphical notation:** [Periodic activation](GRAPHICAL_CATALOG.md#notation-trigger-periodic). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: exit

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

State-exit block runs after timer cancellation and before the transition effect. It lacks payload scope. Return/failure skips remaining transition phases.

**Example fragment:** `state Running { exit { active = false; } }`

**Graphical notation:** [State exit behavior](GRAPHICAL_CATALOG.md#notation-state-exit). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: fail

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Fail`.

Raises a local failure with a String literal reason, unwinds synchronous callers, and preserves committed effects. An RPC caller receives the correlated RemoteFailure outcome.

**Example fragment:** `fail "invalid operating mode";`

**Graphical notation:** [Failure](GRAPHICAL_CATALOG.md#notation-fail). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: false

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `Literal`.

The false Bool literal. Distinct from numeric zero, empty strings or absent values; no implicit coercion exists.

**Example fragment:** `let ready: Bool = false;`

**Graphical notation:** [Expressions and value paths](GRAPHICAL_CATALOG.md#notation-expression). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: fifo

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Dispatches retained messages in queue order for one connector/direction/member. Independent queues and handler completion order are not globally ordered.

**Example fragment:** `ordering fifo;`

**Graphical notation:** [Queue ordering](GRAPHICAL_CATALOG.md#notation-ordering-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: final

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

Marks a state that completes its owning operation after entry. It has no outgoing transition. Future input to that operation is undeliverable, not rerouted.

**Example fragment:** `state Stopped final {}`

**Graphical notation:** [Final state](GRAPHICAL_CATALOG.md#notation-final-state). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: for

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Scenario`.

Selects the root component described by a case. The steps use root-level connectors and immediate child unit/component port-member paths. Typed roots resolve topology through their component definition.

**Example fragment:** `case Startup for Product { ... }`

**Graphical notation:** [Case](GRAPHICAL_CATALOG.md#notation-case). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: function

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `FunctionDef`.

Defines a pure expression with a non-Void result. It sees only copied parameters and other local pure functions, never unit variables. The call graph is acyclic.

**Example fragment:** `function twice(value: Int): Int = value * 2; / twice(3)`

**Graphical notation:** [Pure local function](GRAPHICAL_CATALOG.md#notation-pure-function). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: FV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Flow View of an operation. Projects either its statement body or its owned states/transitions in the same view family. There are no performer allocations or separate AFV/STV kinds.

**Example fragment:** `view control FV of Controller.regulate;`

**Graphical notation:** [Flow View](GRAPHICAL_CATALOG.md#notation-view-fv). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: GRV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Grid View of a package or named semantic declaration other than a view. Presents inventory, contracts, timing, allocation or trace tables; sorting does not change model meaning.

**Example fragment:** `view inventory GRV of Architecture;`

**Graphical notation:** [Grid View](GRAPHICAL_CATALOG.md#notation-view-grv). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: GV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

General View of a package or resolvable named semantic declaration other than a view. Shows ownership, types, attributes and relations, retaining definition/occurrence distinction.

**Example fragment:** `view overview GV of Product;`

**Graphical notation:** [General View](GRAPHICAL_CATALOG.md#notation-view-gv). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: idempotent

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Signature`.

Contract assertion required for RPC under atLeastOnce delivery. Repeated requests must have idempotent effects including published side effects. The keyword alone is not a proof.

**Example fragment:** `operation read(): Int idempotent;`

**Graphical notation:** [Interface operation signature](GRAPHICAL_CATALOG.md#notation-operation-signature). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: if

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `If`.

Evaluates one Bool and executes the selected lexical block. It supplies no concurrency or implicit variable merging. Value-returning operations must cover both paths or fail.

**Example fragment:** `if (value > limit) { return false; } else { return true; }`

**Graphical notation:** [Conditional branch](GRAPHICAL_CATALOG.md#notation-conditional). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: import

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Import`.

Imports top-level names from one package using namespace::*; imports are not transitive. A short name must be unique across local and directly imported declarations.

**Example fragment:** `import Common::*;`

**Graphical notation:** [Package import](GRAPHICAL_CATALOG.md#notation-import). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: initial

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `StateBody`.

The first item in a stateful operation body. References exactly one state owned by that operation and distinguishes state behavior from a statement block without a wrapper keyword. Initialization enters it once per run epoch before input consumption.

**Example fragment:** `initial Idle;`

**Graphical notation:** [Operation with states](GRAPHICAL_CATALOG.md#notation-stateful-operation), [Initial state reference](GRAPHICAL_CATALOG.md#notation-initial-state). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: Int

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Exact signed integer type from -(2^53-1) through 2^53-1. Overflow, invalid indexing and division/remainder by zero fail execution. Scalar Int may widen to Real.

**Example fragment:** `var count: Int = 0;`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: interface

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Declares a nominal, versioned contract of one of four kinds. Port endpoints must reference the same declaration; matching names or version strings alone are insufficient.

**Example fragment:** `interface service Orders version "1.0.0" { ... }`

**Graphical notation:** [Sender–receiver interface](GRAPHICAL_CATALOG.md#notation-sender-receiver-interface), [Client–server interface](GRAPHICAL_CATALOG.md#notation-client-server-interface), [Publish–subscribe interface](GRAPHICAL_CATALOG.md#notation-publish-subscribe-interface), [Service interface](GRAPHICAL_CATALOG.md#notation-service-interface). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: invoke

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Invoke`.

Synchronously calls an untriggered Void operation in the same unit. It shares the activation lock and snapshot; copied parameters are local. Remote invocation requires request through a port.

**Example fragment:** `invoke prepare();`

**Graphical notation:** [Local operation invocation](GRAPHICAL_CATALOG.md#notation-invoke). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: IV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Interconnect View of a root component/component definition or occurrence. Shows immediate children, boundary ports, connectors and delegation with exact interface paths.

**Example fragment:** `view wiring IV of Product;`

**Graphical notation:** [Interconnect View](GRAPHICAL_CATALOG.md#notation-view-iv). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: label

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `ScenarioStep`.

Assigns a unique name to a scenario step. Later after clauses use that label as a causal predecessor; source position alone imposes no ordering.

**Example fragment:** `via orderLink label submitted;`

**Graphical notation:** [Case data exchange](GRAPHICAL_CATALOG.md#notation-case-data-exchange), [Case event exchange](GRAPHICAL_CATALOG.md#notation-case-event-exchange), [Case request](GRAPHICAL_CATALOG.md#notation-case-request), [Correlated case reply](GRAPHICAL_CATALOG.md#notation-case-reply), [Case causal order](GRAPHICAL_CATALOG.md#notation-case-causal-order). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: let

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Let`.

Creates a typed mutable local value from a copied initializer. It cannot shadow a live local, parameter or unit variable, and disappears at block exit.

**Example fragment:** `let count: Int = 0;`

**Graphical notation:** [Local declaration](GRAPHICAL_CATALOG.md#notation-local-declaration). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: manual

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`.

Parameterless Void operation trigger released by a harness. It is control of execution, not a route for injecting external model payloads or bypassing interfaces.

**Example fragment:** `operation refresh(): Void on manual { ... }`

**Graphical notation:** [Manual activation](GRAPHICAL_CATALOG.md#notation-trigger-manual). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: maxAge

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Maximum message age measured from original emission through retries. Eligibility is inclusive; greater age discards before dispatch. Required for sampled data in realtime/mixed roots.

**Example fragment:** `maxAge 20 ms;`

**Graphical notation:** [Message freshness bound](GRAPHICAL_CATALOG.md#notation-freshness-bound). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: maxLatency

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Positive bound from admitted emission to destination readiness, excluding dispatch wait. Exceeding it is an observable contract violation. Required on realtime/mixed connectors.

**Example fragment:** `maxLatency 1 ms;`

**Graphical notation:** [Transport latency bound](GRAPHICAL_CATALOG.md#notation-latency-bound). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: mcu

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Node`.

Execution-node kind for an embedded microcontroller location. The core does not infer interrupts, task priorities, processor speed or memory limits.

**Example fragment:** `node controller mcu;`

**Graphical notation:** [Execution node](GRAPHICAL_CATALOG.md#notation-execution-node). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: mixed

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `RootComponent`.

Root component profile covering embedded/service combinations. All used operations carry timing and all connectors latency; sampled data also carries age. It does not silently exempt cloud-facing paths.

**Example fragment:** `component Product mixed { ... }`

**Graphical notation:** [Root execution profile](GRAPHICAL_CATALOG.md#notation-execution-profile). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: ms

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Millisecond duration unit; one ms equals 1,000,000 ns. Duration magnitude must be a positive integer and normalize exactly within the safe range.

**Example fragment:** `within 25 ms`

**Graphical notation:** [Duration value](GRAPHICAL_CATALOG.md#notation-duration). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: node

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Node`.

Declares a named execution location in a root component with mcu, process or container kind. Nodes affect allocation only; traffic still follows interfaces.

**Example fragment:** `node edge process;`

**Graphical notation:** [Execution node](GRAPHICAL_CATALOG.md#notation-execution-node). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: not

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `UnaryExpression`.

Unary Bool negation with precedence above multiplication. No numeric or string coercion is allowed.

**Example fragment:** `not ready`

**Graphical notation:** [Expressions and value paths](GRAPHICAL_CATALOG.md#notation-expression). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: ns

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Nanosecond duration unit and the reference simulation clock's integral base. All specified durations are positive, with safe exact conversion.

**Example fragment:** `after 1 ns`

**Graphical notation:** [Duration value](GRAPHICAL_CATALOG.md#notation-duration). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: of

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Introduces a view subject path rooted in the owning package or its top-level declaration. Allowed subject kinds depend on the view kind.

**Example fragment:** `view flow FV of Product.controller.worker.run;`

**Graphical notation:** [General View](GRAPHICAL_CATALOG.md#notation-view-gv), [Interconnect View](GRAPHICAL_CATALOG.md#notation-view-iv), [Case View](GRAPHICAL_CATALOG.md#notation-view-cv), [Sequence View](GRAPHICAL_CATALOG.md#notation-view-sv), [Grid View](GRAPHICAL_CATALOG.md#notation-view-grv), [Flow View](GRAPHICAL_CATALOG.md#notation-view-fv). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: on

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Deployment`, `Trigger`, `Transition`.

Introduces an operation or transition trigger. Operations use start/manual/every/receive/call; transitions use completion/after/receive. Triggers do not introduce free signals.

**Example fragment:** `on receive input.sample`

**Graphical notation:** [Startup activation](GRAPHICAL_CATALOG.md#notation-trigger-start), [Manual activation](GRAPHICAL_CATALOG.md#notation-trigger-manual), [Periodic activation](GRAPHICAL_CATALOG.md#notation-trigger-periodic), [Port receive activation](GRAPHICAL_CATALOG.md#notation-trigger-receive), [RPC handler activation](GRAPHICAL_CATALOG.md#notation-trigger-call), [State transition](GRAPHICAL_CATALOG.md#notation-transition), [Deployment binding](GRAPHICAL_CATALOG.md#notation-deployment). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: operation

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Signature`, `Operation`.

In an interface, declares an RPC signature. In a unit, declares executable statements or directly owned states. An omitted result annotation means Void. An incoming signature is implemented by exactly one on call operation.

**Example fragment:** `operation reset(); / operation reset() on call api.reset { return; }`

**Graphical notation:** [Interface operation signature](GRAPHICAL_CATALOG.md#notation-operation-signature), [Executable operation](GRAPHICAL_CATALOG.md#notation-operation), [Operation with states](GRAPHICAL_CATALOG.md#notation-stateful-operation). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: optional

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Allows a port to remain unconnected in a closed root component. It does not change contract, role or handler rules. Unbound data/event sends succeed; unbound RPC reports Unavailable.

**Example fragment:** `port diagnostics: Notices publisher optional;`

**Graphical notation:** [Optional port](GRAPHICAL_CATALOG.md#notation-optional-port). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: or

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `OrExpression`.

Short-circuit Boolean disjunction. The right Bool operand is evaluated only when the left is false.

**Example fragment:** `ready or retryAllowed`

**Graphical notation:** [Expressions and value paths](GRAPHICAL_CATALOG.md#notation-expression). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: ordering

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Selects fifo or unordered independently of delivery reliability. Ordering applies per connector occurrence, direction and member, not across an entire interface or root.

**Example fragment:** `ordering fifo;`

**Graphical notation:** [Queue ordering](GRAPHICAL_CATALOG.md#notation-ordering-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: otherwise

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Request`.

Mandatory request failure block with implicit copied failure:String. It must return or fail on every path and cannot fall through to successful result use.

**Example fragment:** `within 1 s otherwise { lastError = failure; return; };`

**Graphical notation:** [RPC request and failure continuation](GRAPHICAL_CATALOG.md#notation-request). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: overflow

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Required admission policy when a member queue is full: dropOldest, dropNewest or reject. Policies apply independently to every route in fanout.

**Example fragment:** `overflow reject;`

**Graphical notation:** [Overflow behavior](GRAPHICAL_CATALOG.md#notation-overflow-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: package

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Package`.

Top-level, non-nested namespace for declarations and direct imports. A package is declared once in the loaded workspace; multiple packages may share a file.

**Example fragment:** `package Control { ... }`

**Graphical notation:** [Package](GRAPHICAL_CATALOG.md#notation-package). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: port

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Owned communication boundary feature typed by one interface, with a compatible role and optionality. Component ports delegate to children; unit ports bind operations to members.

**Example fragment:** `port api: Orders requires;`

**Graphical notation:** [Data sender port](GRAPHICAL_CATALOG.md#notation-port-sender), [Data receiver port](GRAPHICAL_CATALOG.md#notation-port-receiver), [RPC client port](GRAPHICAL_CATALOG.md#notation-port-client), [RPC server port](GRAPHICAL_CATALOG.md#notation-port-server), [Event publisher port](GRAPHICAL_CATALOG.md#notation-port-publisher), [Event subscriber port](GRAPHICAL_CATALOG.md#notation-port-subscriber), [Service provider port](GRAPHICAL_CATALOG.md#notation-port-provides), [Service consumer port](GRAPHICAL_CATALOG.md#notation-port-requires). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: priority

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`.

Nonnegative safe-integer tie-break among matching transitions for the same state and stimulus; larger wins, default 0. It is not an operation scheduling priority.

**Example fragment:** `on receive commands.begin priority 2 {}`

**Graphical notation:** [Transition priority](GRAPHICAL_CATALOG.md#notation-transition-priority). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: process

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Node`.

Execution-node kind for a logical process. It supplies no hidden IPC access, shared memory or task scheduling policy.

**Example fragment:** `node worker process;`

**Graphical notation:** [Execution node](GRAPHICAL_CATALOG.md#notation-execution-node). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: provides

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Provider role of a service interface. Handles incoming RPC, returns correlated results/failures and publishes its declared events in reverse connector direction.

**Example fragment:** `port api: Orders provides;`

**Graphical notation:** [Service provider port](GRAPHICAL_CATALOG.md#notation-port-provides). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: publish

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Send`, `ScenarioStep`.

Emits an outgoing event through a publisher/provides port. In a case, describes a routed event step. Arguments are evaluated once and copied per route; no free event syntax exists.

**Example fragment:** `publish api.changed(current);`

**Graphical notation:** [Event publication](GRAPHICAL_CATALOG.md#notation-publish), [Case event exchange](GRAPHICAL_CATALOG.md#notation-case-event-exchange). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: publisher

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Outgoing role for a publishSubscribe contract. One port may fan out through several connectors; every outgoing member is tied to an emitting operation.

**Example fragment:** `port events: Notices publisher;`

**Graphical notation:** [Event publisher port](GRAPHICAL_CATALOG.md#notation-port-publisher). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: publishSubscribe

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Event-only contract kind with publisher/subscriber ports. Subscriptions are explicit static connectors. Runtime subscribe/unsubscribe and wildcard topics are outside 1.1.

**Example fragment:** `interface publishSubscribe Notices version "1.0.0" { event changed(); }`

**Graphical notation:** [Publish–subscribe interface](GRAPHICAL_CATALOG.md#notation-publish-subscribe-interface). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: qos

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

Introduces connector delivery, ordering, capacity and overflow, followed by optional latency and age in the grammar's order. Each connector must supply the block.

**Example fragment:** `qos { delivery atMostOnce; ordering fifo; capacity 4; overflow reject; }`

**Graphical notation:** [Delivery policy](GRAPHICAL_CATALOG.md#notation-delivery-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: queued

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `DataMember`.

SenderReceiver data mode representing a sequence of retained values under queue policy. It does not imply losslessness or unbounded history.

**Example fragment:** `data text: String queued;`

**Graphical notation:** [Data member](GRAPHICAL_CATALOG.md#notation-data-member). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: Real

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Finite IEEE 754 binary64 type. Arithmetic is nearest-even; non-finite results and division by zero fail. Scalar Int widens, but fixed arrays do not implicitly widen.

**Example fragment:** `var temperature: Real = 20.0;`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: realtime

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `RootComponent`.

Root component profile requiring operation timing, connector latency and sampled freshness contracts. Those declarations require target evidence before any hard realtime claim.

**Example fragment:** `component Heating realtime { ... }`

**Graphical notation:** [Root execution profile](GRAPHICAL_CATALOG.md#notation-execution-profile). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: receive

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`, `Transition`.

Consumes an incoming data/event member through a receiver/subscriber/requires port. An ordinary operation receives copied parameters; a transition exposes event parameters or data payload in guard/effect.

**Example fragment:** `on receive commands.begin`

**Graphical notation:** [Port receive activation](GRAPHICAL_CATALOG.md#notation-trigger-receive), [State transition](GRAPHICAL_CATALOG.md#notation-transition). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: receiver

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Incoming senderReceiver role. Every data member has one handler owner; at most one route feeds a closed receiver port. Multiple sources require an explicit merge/adaptor unit.

**Example fragment:** `port input: Samples receiver;`

**Graphical notation:** [Data receiver port](GRAPHICAL_CATALOG.md#notation-port-receiver). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: record

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `RecordLiteral`.

Constructs a nominal datatype value by assigning each declared field exactly once. Field order in the literal does not change record equality; fields remain copied values.

**Example fragment:** `record Point { x = 1.0; y = 2.0; }`

**Graphical notation:** [Record construction](GRAPHICAL_CATALOG.md#notation-record-value). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: reentrant

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Allows overlapping operation activations with independent dispatch-time unit snapshots. Direct or helper writes to unit state are statically invalid. Local variables remain mutable; one state reaction cannot overlap itself.

**Example fragment:** `concurrency reentrant;`

**Graphical notation:** [Concurrency mode](GRAPHICAL_CATALOG.md#notation-concurrency-mode). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: reject

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

On full queue, rejects the offer. Data/event producers fail after all fanout offers; requests take otherwise with Rejected. Previously accepted offers and effects are preserved.

**Example fragment:** `overflow reject;`

**Graphical notation:** [Overflow behavior](GRAPHICAL_CATALOG.md#notation-overflow-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: reply

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `ScenarioStep`.

Describes a response step in a case, reversing an existing connector/member request. It must have one unanswered causal request ancestor. Executable handlers reply by returning, not by a reply statement.

**Example fragment:** `reply backend.api.get -> client.api.get via link after asked label answered;`

**Graphical notation:** [Correlated case reply](GRAPHICAL_CATALOG.md#notation-case-reply). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: request

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Request`, `ScenarioStep`.

Awaits one RPC on a local client/requires port with fresh correlation, result name, finite timeout and explicit failure block. In cases it describes the corresponding routed exchange.

**Example fragment:** `request api.get() as value within 1 s otherwise { return; };`

**Graphical notation:** [RPC request and failure continuation](GRAPHICAL_CATALOG.md#notation-request), [Case request](GRAPHICAL_CATALOG.md#notation-case-request). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: requirement

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Requirement`.

Named natural-language obligation. It has descriptive text and can be referenced by cases; the core supplies no implicit requirements solver or verified checkmark.

**Example fragment:** `requirement Safe "Duty shall remain within the allowed range.";`

**Graphical notation:** [Requirement](GRAPHICAL_CATALOG.md#notation-requirement). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: requires

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Consumer role of a service interface. Issues RPC and handles reverse-direction provider events. It has at most one route in a closed root component.

**Example fragment:** `port orders: Orders requires;`

**Graphical notation:** [Service consumer port](GRAPHICAL_CATALOG.md#notation-port-requires). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: return

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Return`.

Completes the current operation with a copied typed result or bare Void. Inside an invoked helper it resumes the caller; inside state behavior it terminates the owning operation immediately.

**Example fragment:** `return accepted;`

**Graphical notation:** [Operation return](GRAPHICAL_CATALOG.md#notation-return). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: s

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Second duration unit; one s equals 1,000,000,000 ns. A duration must still fit the exact safe nanosecond range.

**Example fragment:** `within 2 s`

**Graphical notation:** [Duration value](GRAPHICAL_CATALOG.md#notation-duration). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: sampled

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `DataMember`.

SenderReceiver data mode retaining the latest pending sample: capacity 1 and dropOldest are mandatory. Dispatch removes the sample; the core does not define a remote shared-variable read.

**Example fragment:** `data temperature: Real sampled;`

**Graphical notation:** [Data member](GRAPHICAL_CATALOG.md#notation-data-member). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: satisfies

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Scenario`.

Links a case to one or more requirement declarations as intended coverage. It is a claim requiring test/analysis/review evidence, not a proof by syntax.

**Example fragment:** `case Checkout for Shop satisfies Accepted, Audited { ... }`

**Graphical notation:** [Requirement coverage link](GRAPHICAL_CATALOG.md#notation-satisfies-link). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: send

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Send`, `ScenarioStep`.

Emits an outgoing senderReceiver data member through a sender port with exactly one value. In a case it describes a data exchange. It cannot publish events or bypass another unit's interface.

**Example fragment:** `send output.temperature(23.5);`

**Graphical notation:** [Data send](GRAPHICAL_CATALOG.md#notation-send), [Case data exchange](GRAPHICAL_CATALOG.md#notation-case-data-exchange). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: sender

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Outgoing senderReceiver role. May fan out through multiple explicit connectors; each member has at least one syntactically associated emitting operation.

**Example fragment:** `port output: Samples sender;`

**Graphical notation:** [Data sender port](GRAPHICAL_CATALOG.md#notation-port-sender). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: senderReceiver

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Data-only contract kind with sampled/queued members and sender/receiver roles. No RPC operations or event members may be declared inside it.

**Example fragment:** `interface senderReceiver Samples version "1.0.0" { data value: Real sampled; }`

**Graphical notation:** [Sender–receiver interface](GRAPHICAL_CATALOG.md#notation-sender-receiver-interface). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: serial

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Default activation mode: acquire the unit's one serial lock until completion/failure, including RPC waits. Local invokes share the activation lock. Independent unit activations may still interleave.

**Example fragment:** `concurrency serial;`

**Graphical notation:** [Concurrency mode](GRAPHICAL_CATALOG.md#notation-concurrency-mode). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: server

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Provider role for clientServer contracts. Each operation signature has exactly one on call handler; results/failures follow the request correlation.

**Example fragment:** `port health: Health server;`

**Graphical notation:** [RPC server port](GRAPHICAL_CATALOG.md#notation-port-server). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: service

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`, `RootComponent`.

As an interface kind, combines RPC operations and events with requires/provides roles. As a root component profile, makes timing contracts optional while retaining interfaces, explicit QoS and static validity; it is the default when no profile is written.

**Example fragment:** `interface service Orders version "1.0.0" { ... } / component Shop service { ... }`

**Graphical notation:** [Service interface](GRAPHICAL_CATALOG.md#notation-service-interface), [Root execution profile](GRAPHICAL_CATALOG.md#notation-execution-profile). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: start

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`.

Once-per-run startup trigger for a parameterless Void operation. Stateful operations require it. All stores/routes/handlers exist before startup work runs; readiness protocols still need explicit ports.

**Example fragment:** `operation boot(): Void on start { ... }`

**Graphical notation:** [Startup activation](GRAPHICAL_CATALOG.md#notation-trigger-start). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: state

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

Declares a named state directly inside an operation after its initial reference. Optional entry/exit blocks contain ordinary operation statements. State names are operation-local; no separate state allocation or performer exists.

**Example fragment:** `state Idle { entry { active = false; } }`

**Graphical notation:** [State](GRAPHICAL_CATALOG.md#notation-state), [Final state](GRAPHICAL_CATALOG.md#notation-final-state). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: String

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Finite Unicode text with exact equality and no normalization. Strings support portable escapes; implicit concatenation, ordering and bounded transport size are absent.

**Example fragment:** `var lastError: String = "";`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: subscriber

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Incoming publishSubscribe role. Multiple publishers may feed one subscriber port through distinct queues. Each event has one handler owner; cross-source ordering is unspecified.

**Example fragment:** `port input: Notices subscriber;`

**Graphical notation:** [Event subscriber port](GRAPHICAL_CATALOG.md#notation-port-subscriber). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: SV

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Sequence View of a case or a root component's selected case. Lifelines are occurrences; arrows show port/member/connector and request correlation. Independent steps must remain visibly unordered.

**Example fragment:** `view checkout SV of Checkout;`

**Graphical notation:** [Sequence View](GRAPHICAL_CATALOG.md#notation-view-sv). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: timing

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Operation contract containing wcet, deadline and concurrency in that order. Required on used operations in realtime/mixed roots; stateful operation timing applies per reaction.

**Example fragment:** `timing { wcet 1 ms; deadline 5 ms; concurrency serial; }`

**Graphical notation:** [Operation timing contract](GRAPHICAL_CATALOG.md#notation-timing-contract). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: transition

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`.

Named state edge owned by one operation, with source/target, stimulus, optional guard/priority and effect. Execution orders exit, effect, state update, entry, then completion processing.

**Example fragment:** `transition beginRun: Idle -> Running on receive commands.begin {}`

**Graphical notation:** [State transition](GRAPHICAL_CATALOG.md#notation-transition). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: true

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `Literal`.

The true Bool literal, with no implicit equivalence to numeric one or other nonempty values.

**Example fragment:** `assert true;`

**Graphical notation:** [Expressions and value paths](GRAPHICAL_CATALOG.md#notation-expression). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: unit

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Unit`, `Instance`.

Smallest interface-protected software boundary. With def, defines private data/functions/operations; a typed usage creates an occurrence inside a nested or root component. Each occurrence has distinct storage and handlers.

**Example fragment:** `unit def Worker { ... } / unit worker: Worker;`

**Graphical notation:** [Inline root composition](GRAPHICAL_CATALOG.md#notation-inline-root), [Unit definition](GRAPHICAL_CATALOG.md#notation-unit-definition), [Unit usage](GRAPHICAL_CATALOG.md#notation-unit-usage), [Occurrence typing relationship](GRAPHICAL_CATALOG.md#notation-type-relationship). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: unordered

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Qos`.

No source-language dispatch ordering guarantee beyond other causal rules. A deterministic backend may still choose FIFO; this choice must not be mistaken for a model guarantee.

**Example fragment:** `ordering unordered;`

**Graphical notation:** [Queue ordering](GRAPHICAL_CATALOG.md#notation-ordering-policy). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: us

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Microsecond duration unit; one us equals 1,000 ns. The source spelling is ASCII us, not the micro sign.

**Example fragment:** `wcet 100 us;`

**Graphical notation:** [Duration value](GRAPHICAL_CATALOG.md#notation-duration). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: var

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `Variable`.

Declares private per-unit mutable state with a typed pure initializer independent of mutable variables. Each unit occurrence owns separate storage; other units cannot read it directly.

**Example fragment:** `var count: Int = 0;`

**Graphical notation:** [Private unit variable](GRAPHICAL_CATALOG.md#notation-private-variable). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: version

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Required interface semantic-version string major.minor.patch. Compatibility is nominal declaration identity, not automatic version-range matching or structural subtyping.

**Example fragment:** `interface clientServer API version "1.0.0" { ... }`

**Graphical notation:** [Sender–receiver interface](GRAPHICAL_CATALOG.md#notation-sender-receiver-interface), [Client–server interface](GRAPHICAL_CATALOG.md#notation-client-server-interface), [Publish–subscribe interface](GRAPHICAL_CATALOG.md#notation-publish-subscribe-interface), [Service interface](GRAPHICAL_CATALOG.md#notation-service-interface). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: via

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `ScenarioStep`.

Names the root-level connector used by a case exchange. Endpoint-member paths must resolve on its immediate child component/unit ports with a legal orientation.

**Example fragment:** `via orderLink label submitted;`

**Graphical notation:** [Case data exchange](GRAPHICAL_CATALOG.md#notation-case-data-exchange), [Case event exchange](GRAPHICAL_CATALOG.md#notation-case-event-exchange), [Case request](GRAPHICAL_CATALOG.md#notation-case-request), [Correlated case reply](GRAPHICAL_CATALOG.md#notation-case-reply). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: view

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Declares a named projection of an existing semantic subject with GV/IV/CV/SV/GRV/FV kind. It carries no executable behavior or diagram geometry.

**Example fragment:** `view wiring IV of Product;`

**Graphical notation:** [General View](GRAPHICAL_CATALOG.md#notation-view-gv), [Interconnect View](GRAPHICAL_CATALOG.md#notation-view-iv), [Case View](GRAPHICAL_CATALOG.md#notation-view-cv), [Sequence View](GRAPHICAL_CATALOG.md#notation-view-sv), [Grid View](GRAPHICAL_CATALOG.md#notation-view-grv), [Flow View](GRAPHICAL_CATALOG.md#notation-view-fv). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: Void

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

No result value. Operation implementations and interface signatures default to Void when : Type is omitted; an explicit : Void is equivalent. Forbidden for parameters, variables, fields, arrays and pure function results. A Void RPC completion label is not readable data.

**Example fragment:** `operation notify(): Void { return; }`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: wcet

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Positive active-execution-time bound including local helpers and state reaction microsteps, excluding request wait. Must not exceed deadline; physical evidence belongs to a target binding.

**Example fragment:** `wcet 1 ms;`

**Graphical notation:** [Operation timing contract](GRAPHICAL_CATALOG.md#notation-timing-contract). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: when

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`.

Optional pure Bool transition guard evaluated against the unit snapshot/live environment and stimulus payload as applicable. False consumes/ignores the stimulus when no other transition matches.

**Example fragment:** `on receive commands.begin when (enabled) {}`

**Graphical notation:** [Transition guard](GRAPHICAL_CATALOG.md#notation-transition-guard). Rendered as text in its owning compartment/property; no independent semantic glyph is introduced.

## Keyword: while

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `While`.

Pretest Bool loop with mandatory positive bound. Each iteration has a lexical body scope. A still-true condition after the bound fails instead of silently exiting.

**Example fragment:** `while (i < 3) bound 3 { i = i + 1; }`

**Graphical notation:** [Bounded loop](GRAPHICAL_CATALOG.md#notation-bounded-loop). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

## Keyword: within

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Request`.

Required positive RPC timeout measured from issuance. Only a response observed strictly before expiry can win; equal-time expiry wins and late server effects are not canceled.

**Example fragment:** `within 100 ms otherwise { return; };`

**Graphical notation:** [RPC request and failure continuation](GRAPHICAL_CATALOG.md#notation-request). Represented by the named semantic construct; the keyword remains explicit in its heading/edge label.

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
