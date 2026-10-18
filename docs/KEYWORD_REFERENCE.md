# Alphabetical keyword reference

This user-facing reference covers every reserved word in the SWAML 1.3 grammar. Entries are sorted alphabetically, ignoring case for sorting only; source keywords remain case-sensitive. Example fragments illustrate a use and are not standalone models. Read the linked normative concern for full constraints. Punctuation and operator precedence follow the final section.

[`after`](#keyword-after) · [`and`](#keyword-and) · [`as`](#keyword-as) · [`assert`](#keyword-assert) · [`atLeastOnce`](#keyword-atleastonce) · [`atMostOnce`](#keyword-atmostonce) · [`attribute`](#keyword-attribute) · [`bestEffort`](#keyword-besteffort) · [`bool`](#keyword-bool) · [`bound`](#keyword-bound) · [`byte`](#keyword-byte) · [`calc`](#keyword-calc) · [`call`](#keyword-call) · [`capacity`](#keyword-capacity) · [`class`](#keyword-class) · [`client`](#keyword-client) · [`clientServer`](#keyword-clientserver) · [`completion`](#keyword-completion) · [`component`](#keyword-component) · [`concurrency`](#keyword-concurrency) · [`connect`](#keyword-connect) · [`cv`](#keyword-cv) · [`data`](#keyword-data) · [`datatype`](#keyword-datatype) · [`deadline`](#keyword-deadline) · [`def`](#keyword-def) · [`delegate`](#keyword-delegate) · [`delivery`](#keyword-delivery) · [`deploy`](#keyword-deploy) · [`do`](#keyword-do) · [`doc`](#keyword-doc) · [`dropNewest`](#keyword-dropnewest) · [`dropOldest`](#keyword-dropoldest) · [`else`](#keyword-else) · [`entry`](#keyword-entry) · [`enum`](#keyword-enum) · [`event`](#keyword-event) · [`every`](#keyword-every) · [`exit`](#keyword-exit) · [`fail`](#keyword-fail) · [`false`](#keyword-false) · [`fifo`](#keyword-fifo) · [`final`](#keyword-final) · [`for`](#keyword-for) · [`forEach`](#keyword-foreach) · [`function`](#keyword-function) · [`fv`](#keyword-fv) · [`grv`](#keyword-grv) · [`gv`](#keyword-gv) · [`idempotent`](#keyword-idempotent) · [`if`](#keyword-if) · [`import`](#keyword-import) · [`in`](#keyword-in) · [`include`](#keyword-include) · [`initial`](#keyword-initial) · [`int`](#keyword-int) · [`interface`](#keyword-interface) · [`interruptible`](#keyword-interruptible) · [`iv`](#keyword-iv) · [`label`](#keyword-label) · [`maxAge`](#keyword-maxage) · [`maxLatency`](#keyword-maxlatency) · [`mixed`](#keyword-mixed) · [`ms`](#keyword-ms) · [`not`](#keyword-not) · [`ns`](#keyword-ns) · [`of`](#keyword-of) · [`on`](#keyword-on) · [`operation`](#keyword-operation) · [`optional`](#keyword-optional) · [`or`](#keyword-or) · [`ordering`](#keyword-ordering) · [`otherwise`](#keyword-otherwise) · [`overflow`](#keyword-overflow) · [`package`](#keyword-package) · [`port`](#keyword-port) · [`priority`](#keyword-priority) · [`provides`](#keyword-provides) · [`publish`](#keyword-publish) · [`publisher`](#keyword-publisher) · [`publishSubscribe`](#keyword-publishsubscribe) · [`qos`](#keyword-qos) · [`queued`](#keyword-queued) · [`real`](#keyword-real) · [`realtime`](#keyword-realtime) · [`receive`](#keyword-receive) · [`receiver`](#keyword-receiver) · [`record`](#keyword-record) · [`recursive`](#keyword-recursive) · [`redefines`](#keyword-redefines) · [`reentrant`](#keyword-reentrant) · [`reject`](#keyword-reject) · [`reply`](#keyword-reply) · [`requirement`](#keyword-requirement) · [`requires`](#keyword-requires) · [`return`](#keyword-return) · [`s`](#keyword-s) · [`sampled`](#keyword-sampled) · [`satisfy`](#keyword-satisfy) · [`send`](#keyword-send) · [`sender`](#keyword-sender) · [`senderReceiver`](#keyword-senderreceiver) · [`serial`](#keyword-serial) · [`server`](#keyword-server) · [`service`](#keyword-service) · [`specializes`](#keyword-specializes) · [`start`](#keyword-start) · [`state`](#keyword-state) · [`string`](#keyword-string) · [`subscriber`](#keyword-subscriber) · [`sv`](#keyword-sv) · [`timing`](#keyword-timing) · [`transition`](#keyword-transition) · [`true`](#keyword-true) · [`tv`](#keyword-tv) · [`uint`](#keyword-uint) · [`unordered`](#keyword-unordered) · [`us`](#keyword-us) · [`useCase`](#keyword-usecase) · [`var`](#keyword-var) · [`verificationCase`](#keyword-verificationcase) · [`verify`](#keyword-verify) · [`version`](#keyword-version) · [`via`](#keyword-via) · [`view`](#keyword-view) · [`void`](#keyword-void) · [`wcet`](#keyword-wcet) · [`when`](#keyword-when) · [`where`](#keyword-where) · [`while`](#keyword-while) · [`within`](#keyword-within)

## Keyword: after

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`, `ScenarioStep`.

In a transition, creates a timer measured from source-state entry completion; leaving the state cancels its generation. In a case step, names one earlier causal predecessor, not a delay or source-order convention.

**Example fragment:** `on after 10 ms / via link after sent label received;`

**Graphical notation:** [Residence timer transition](GRAPHICAL_CATALOG.md#notation-timer-transition), [Case causal order](GRAPHICAL_CATALOG.md#notation-case-causal-order). Residence timer transition; Case causal order.

## Keyword: and

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `AndExpression`.

Short-circuit Boolean conjunction. Both operands must be bool; the right operand is evaluated only when the left is true.

**Example fragment:** `ready and enabled`

**Graphical notation:** [Expressions and value paths](GRAPHICAL_CATALOG.md#notation-expression). Expressions and value paths.

## Keyword: as

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `RemoteCall`, `LocalCall`.

Names a fresh local-call result or awaited RPC result. Local void calls omit it; routed void calls reserve a completion name without a readable value.

**Example fragment:** `call api.read() as value within 1 s otherwise { return; };`

**Graphical notation:** [Routed function call](GRAPHICAL_CATALOG.md#notation-routed-call). Routed function call.

## Keyword: assert

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Assert`.

Evaluates a bool; false fails the activation without rollback. A failed RPC handler returns RemoteFailure through its correlation. Assertions are executable checks, not static proofs.

**Example fragment:** `assert measured <= 100;`

**Graphical notation:** [Assertion](GRAPHICAL_CATALOG.md#notation-assert). Assertion.

## Keyword: atLeastOnce

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

Permits retries and duplicate delivery subject to liveness, overflow and freshness. RPC members on such a connector must declare idempotent behavior. It never implies exactly-once effects.

**Example fragment:** `delivery atLeastOnce;`

**Graphical notation:** [Delivery policy](GRAPHICAL_CATALOG.md#notation-delivery-policy). Delivery policy.

## Keyword: atMostOnce

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

Allows loss but no duplicate delivery for a logical message. A lost request or response can still lead to timeout. This policy does not guarantee admission or successful execution.

**Example fragment:** `delivery atMostOnce;`

**Graphical notation:** [Delivery policy](GRAPHICAL_CATALOG.md#notation-delivery-policy). Delivery policy.

## Keyword: attribute

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Attribute`.

Immutable typed requirement metadata.

**Example fragment:** `attribute priority: uint = 1;`

**Graphical notation:** [Requirement attribute](GRAPHICAL_CATALOG.md#notation-requirement-attribute). Requirement attribute.

## Keyword: bestEffort

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

Permits loss without an eventual-delivery guarantee and without duplicate delivery. Queue capacity, overflow and declared timing bounds still apply.

**Example fragment:** `delivery bestEffort;`

**Graphical notation:** [Delivery policy](GRAPHICAL_CATALOG.md#notation-delivery-policy). Delivery policy.

## Keyword: bool

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Primitive two-valued Boolean type. Conditions and logical operators require bool; numbers and strings are not truthy substitutes.

**Example fragment:** `var ready: bool = true;`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Primitive types.

## Keyword: bound

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `While`, `For`, `DoWhile`.

Sets the positive safe-integer maximum number of body executions for while, for and do-while loops. A still-true condition after the final permitted body fails before another body. forEach instead uses its copied array cardinality as the bound.

**Example fragment:** `while (i < 3) bound 3 { i = i + 1; }`

**Graphical notation:** [Bounded loop](GRAPHICAL_CATALOG.md#notation-bounded-loop), [Counted for loop](GRAPHICAL_CATALOG.md#notation-for-loop), [Post-test do-while loop](GRAPHICAL_CATALOG.md#notation-do-while-loop). Bounded loop; Counted for loop; Post-test do-while loop.

## Keyword: byte

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Exact unsigned eight-bit values from 0 through 255. Integral assignment checks the destination range statically for known constants and at runtime for computed values.

**Example fragment:** `var payload: byte[2] = [0, 255];`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Primitive types.

## Keyword: calc

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `Calculation`.

Declares a pure calculation at the start of a function body. Its typed inputs and named result expression are visible only within that owning function, including its states and guards.

**Example fragment:** `calc twice { in x: int; return result: int = x * 2; }`

**Graphical notation:** [Pure calculation](GRAPHICAL_CATALOG.md#notation-calculation). Pure calculation.

## Keyword: call

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`, `RemoteCall`, `LocalCall`, `ScenarioStep`.

Calls an untriggered local function, awaits a routed port.member function, marks an incoming RPC trigger, or describes a case RPC step. Local non-void calls require as name; routed calls require a result/completion name, timeout and terminating failure path.

**Example fragment:** `call normalize(input) as value; / call api.read() as reply within 1 s otherwise { return; };`

**Graphical notation:** [RPC handler activation](GRAPHICAL_CATALOG.md#notation-trigger-call), [Local function call](GRAPHICAL_CATALOG.md#notation-local-call), [Routed function call](GRAPHICAL_CATALOG.md#notation-routed-call), [Case request](GRAPHICAL_CATALOG.md#notation-case-request). RPC handler activation; Local function call; Routed function call; Case request.

## Keyword: capacity

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

Positive safe-integer retained-message limit per connector occurrence, direction and member. Transport-pending messages count; running handlers do not. Sampled data requires capacity 1.

**Example fragment:** `capacity 8;`

**Graphical notation:** [Queue capacity](GRAPHICAL_CATALOG.md#notation-capacity-policy). Queue capacity.

## Keyword: class

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Component`, `Instance`, `RootComponent`.

General software classifier: owns private copied values, typed ports, child class/component usages and executable operations/functions. A component specializes this category. Definitions use def; top-level usages are closed execution roots. No dynamic object creation or cross-owner access is introduced.

**Example fragment:** `class def CounterBase { var value: int = 21; }`

**Graphical notation:** [Class definition](GRAPHICAL_CATALOG.md#notation-class-definition), [Class usage and root](GRAPHICAL_CATALOG.md#notation-class-usage). Class definition; Class usage and root.

## Keyword: client

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Port role for the requesting side of a clientServer interface. A closed client port has at most one route; replies return through the same route and correlation.

**Example fragment:** `port api: Health client;`

**Graphical notation:** [RPC client port](GRAPHICAL_CATALOG.md#notation-port-client). RPC client port.

## Keyword: clientServer

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Interface kind containing operation/function signatures only. A client issues requests; a server implements compatible on call handlers. Events belong in service or publishSubscribe contracts.

**Example fragment:** `interface clientServer Health version "1.0.0" { function check(): bool; }`

**Graphical notation:** [Client–server interface](GRAPHICAL_CATALOG.md#notation-client-server-interface). Client–server interface.

## Keyword: completion

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`.

Local state stimulus reconsidered after entry and each reaction until quiescent. It is not an interface event. Unconditional cycles are invalid; guarded cycles have a 1,024-edge runtime limit.

**Example fragment:** `transition next: A -> B on completion {}`

**Graphical notation:** [Completion transition](GRAPHICAL_CATALOG.md#notation-completion-transition). Completion transition.

## Keyword: component

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Component`, `Instance`, `RootComponent`.

Specialized class category for a software component. Definitions use def; usages have separate private stores. Components may specialize class or component definitions. Component usages require component definitions; class usages may instantiate either category.

**Example fragment:** `component def Controller { } / component controller: Controller;`

**Graphical notation:** [Component definition](GRAPHICAL_CATALOG.md#notation-component-definition), [Component usage](GRAPHICAL_CATALOG.md#notation-component-usage), [Occurrence typing relationship](GRAPHICAL_CATALOG.md#notation-type-relationship), [Root component](GRAPHICAL_CATALOG.md#notation-root-component), [Inline root composition](GRAPHICAL_CATALOG.md#notation-inline-root). Component definition; Component usage; Occurrence typing relationship; Root component; Inline root composition.

## Keyword: concurrency

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Selects serial or reentrant function activation policy in a timing contract. Helpers inherit the activation mode. Stateful functions never overlap their own reactions.

**Example fragment:** `concurrency serial;`

**Graphical notation:** [Concurrency mode](GRAPHICAL_CATALOG.md#notation-concurrency-mode). Concurrency mode.

## Keyword: connect

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Connect`.

Creates an explicit connector between owned or immediate-child ports. Contracts must be identical and roles complementary. Every connector supplies a complete QoS selection.

**Example fragment:** `connect samples: sensor.output -> controller.input qos { ... };`

**Graphical notation:** [Interface connector](GRAPHICAL_CATALOG.md#notation-connector). Interface connector.

## Keyword: cv

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Case View kind: displays cases, requirements and claimed coverage for a case or root component. Verified coverage requires separate linked evidence.

**Example fragment:** `view coverage cv of Shop;`

**Graphical notation:** [Case View](GRAPHICAL_CATALOG.md#notation-view-cv). Case View.

## Keyword: data

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `DataMember`.

Declares one senderReceiver member with a value type and sampled or queued mode. Outgoing use is send; incoming handling is on receive with one typed argument.

**Example fragment:** `data sample: real sampled;`

**Graphical notation:** [Data member](GRAPHICAL_CATALOG.md#notation-data-member). Data member.

## Keyword: datatype

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `DataType`.

Declares a nominal finite record. Field names are unique, every literal supplies all fields once, and recursive value containment is invalid. Empty records have one value.

**Example fragment:** `datatype Point { x: real; y: real; }`

**Graphical notation:** [Record datatype](GRAPHICAL_CATALOG.md#notation-datatype). Record datatype.

## Keyword: deadline

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Positive elapsed-time bound from activation release to completion, including queueing and request suspension. For stateful functions it applies per reaction. WCET must not exceed it.

**Example fragment:** `deadline 5 ms;`

**Graphical notation:** [Function timing contract](GRAPHICAL_CATALOG.md#notation-timing-contract), [Timing View](GRAPHICAL_CATALOG.md#notation-function-timing-diagram). Function timing contract; Timing View.

## Keyword: def

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Component`, `QosPolicy`.

Declares a reusable class/component type or complete named QoS policy. A definition is not an execution occurrence and does not allocate shared state.

**Example fragment:** `component def Controller { } / qos def LocalLink { ... }`

**Graphical notation:** [Component definition](GRAPHICAL_CATALOG.md#notation-component-definition), [Reusable QoS policy](GRAPHICAL_CATALOG.md#notation-qos-policy-definition), [Class definition](GRAPHICAL_CATALOG.md#notation-class-definition). Component definition; Reusable QoS policy; Class definition.

## Keyword: delegate

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Delegate`.

Aliases a component boundary port to one immediate child port of the same role and interface. A port has at most one delegation and cannot also have local behavior owners. Delegation adds neither conversion nor a queue.

**Example fragment:** `delegate api -> worker.api;`

**Graphical notation:** [Boundary delegation](GRAPHICAL_CATALOG.md#notation-delegation). Boundary delegation.

## Keyword: delivery

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

Chooses bestEffort, atMostOnce or atLeastOnce for all member queues of a connector. Delivery is separate from FIFO ordering, admission and application success.

**Example fragment:** `delivery atMostOnce;`

**Graphical notation:** [Delivery policy](GRAPHICAL_CATALOG.md#notation-delivery-policy). Delivery policy.

## Keyword: deploy

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Deployment`.

Associates a component instance path, or the root name itself, with an external system/part identity string. Descendants inherit the nearest binding. The host resolves the external destination.

**Example fragment:** `deploy controller on "sysml:Vehicle::ecu";`

**Graphical notation:** [Deployment binding](GRAPHICAL_CATALOG.md#notation-deployment). Deployment binding.

## Keyword: do

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `DoWhile`.

Starts a post-test loop. Its body runs at least once, then its Boolean while condition is evaluated. A mandatory positive safe-integer bound limits body executions; another requested body fails with LoopBound. Body-local declarations do not escape to the condition.

**Example fragment:** `do { count = count + 1; } while (count < 3) bound 3;`

**Graphical notation:** [Post-test do-while loop](GRAPHICAL_CATALOG.md#notation-do-while-loop). Post-test do-while loop.

## Keyword: doc

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Documentation`, `DOC_COMMENT`.

One owned formal multiline specification.

**Example fragment:** `doc /* Formal text. */`

**Graphical notation:** [Formal documentation](GRAPHICAL_CATALOG.md#notation-formal-documentation). Formal documentation.

## Keyword: dropNewest

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

On a full queue, discards the offered message observably. Admission does not fail the producer; an RPC can later time out. Existing retained messages stay.

**Example fragment:** `overflow dropNewest;`

**Graphical notation:** [Overflow behavior](GRAPHICAL_CATALOG.md#notation-overflow-policy). Overflow behavior.

## Keyword: dropOldest

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

On a full queue, discards the oldest retained message and admits the new one. Required with capacity 1 for sampled data. It does not undo effects of already dispatched handlers.

**Example fragment:** `overflow dropOldest;`

**Graphical notation:** [Overflow behavior](GRAPHICAL_CATALOG.md#notation-overflow-policy). Overflow behavior.

## Keyword: else

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `If`.

Optional alternative block of an if statement. Only the chosen branch executes; branch-local declarations do not escape that branch.

**Example fragment:** `if (ready) { return; } else { fail "not ready"; }`

**Graphical notation:** [Conditional branch](GRAPHICAL_CATALOG.md#notation-conditional). Conditional branch.

## Keyword: entry

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

State-entry block executed after that state becomes current. It has no incoming payload scope. Residence timers begin after entry finishes; return/fail terminates the owning function.

**Example fragment:** `state Idle { entry { count = 0; } }`

**Graphical notation:** [State entry behavior](GRAPHICAL_CATALOG.md#notation-state-entry). State entry behavior.

## Keyword: enum

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `EnumType`.

Declares a nominal set of one or more unique literals. Values use Type.Literal or Package::Type.Literal. A live value first segment in the current expression environment takes precedence over an unqualified enum name, with no fallback after a failed field lookup; qualify to select the enum explicitly.

**Example fragment:** `enum Status { Ready, Failed } / Status.Ready / Contracts::Status.Ready`

**Graphical notation:** [Enumeration](GRAPHICAL_CATALOG.md#notation-enumeration). Enumeration.

## Keyword: event

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `EventMember`.

Declares a typed asynchronous member in publishSubscribe or service. It must be emitted by a function through a port and owned by one receiving function; free global events are absent.

**Example fragment:** `event changed(value: real);`

**Graphical notation:** [Event member](GRAPHICAL_CATALOG.md#notation-event-member). Event member.

## Keyword: every

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`.

Periodic parameterless void activation at epoch plus k periods, k starting at 1. Releases do not merge when earlier activations are busy; pending work is bounded by the binding.

**Example fragment:** `function sample(): void on every 10 ms { ... }`

**Graphical notation:** [Periodic activation](GRAPHICAL_CATALOG.md#notation-trigger-periodic). Periodic activation.

## Keyword: exit

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

State-exit block runs after timer cancellation and before the transition effect. It lacks payload scope. Return/failure skips remaining transition phases.

**Example fragment:** `state Running { exit { active = false; } }`

**Graphical notation:** [State exit behavior](GRAPHICAL_CATALOG.md#notation-state-exit). State exit behavior.

## Keyword: fail

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Fail`.

Raises a local failure with a string literal reason, unwinds synchronous callers, and preserves committed effects. An RPC caller receives the correlated RemoteFailure outcome.

**Example fragment:** `fail "invalid operating mode";`

**Graphical notation:** [Failure](GRAPHICAL_CATALOG.md#notation-fail). Failure.

## Keyword: false

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `Literal`.

The false bool literal. Distinct from numeric zero, empty strings or absent values; no implicit coercion exists.

**Example fragment:** `var ready: bool = false;`

**Graphical notation:** [Expressions and value paths](GRAPHICAL_CATALOG.md#notation-expression). Expressions and value paths.

## Keyword: fifo

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

Dispatches retained messages in queue order for one connector/direction/member. Independent queues and handler completion order are not globally ordered.

**Example fragment:** `ordering fifo;`

**Graphical notation:** [Queue ordering](GRAPHICAL_CATALOG.md#notation-ordering-policy). Queue ordering.

## Keyword: final

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

Marks a state that completes its owning function after entry. It has no outgoing transition. Future input to that function is undeliverable, not rerouted.

**Example fragment:** `state Stopped final {}`

**Graphical notation:** [Final state](GRAPHICAL_CATALOG.md#notation-final-state). Final state.

## Keyword: for

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `For`.

Counted pretest loop with one typed local initializer, Boolean condition, assignment update and mandatory positive safe-integer bound. The header variable belongs to the loop; body locals are fresh each iteration. The update follows each completed body. A true condition after the bound fails before another body.

**Example fragment:** `for (var i: int = 0; i < 3; i = i + 1) bound 3 { count = count + 1; }`

**Graphical notation:** [Counted for loop](GRAPHICAL_CATALOG.md#notation-for-loop). Counted for loop.

## Keyword: forEach

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `ForEach`.

Iterates in array order over one copied fixed-array value evaluated once on entry. Every iteration binds a fresh typed copy of its item. Array cardinality is the finite bound; changing the source or item cannot change the iteration snapshot.

**Example fragment:** `forEach (item: int in values) { total = total + item; }`

**Graphical notation:** [Fixed-array forEach loop](GRAPHICAL_CATALOG.md#notation-for-each-loop). Fixed-array forEach loop.

## Keyword: function

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Signature`, `FunctionDef`.

Specialized operation category, used for executable members and interface signatures. It retains ordinary ownership, copied values, triggers, timing, function-local calculations and flow/state semantics; it does not imply purity. A function contract requires a function implementation.

**Example fragment:** `function startUp() on start { return; }`

**Graphical notation:** [Interface function signature](GRAPHICAL_CATALOG.md#notation-function-signature), [Executable function](GRAPHICAL_CATALOG.md#notation-function), [Function with states](GRAPHICAL_CATALOG.md#notation-stateful-function). Interface function signature; Executable function; Function with states.

## Keyword: fv

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Selects a Flow View presenting operation/function statement flow, states or interruptible regions. Every selected occurrence must be executable behavior; interface signatures and calculations are invalid subjects. Use tv for timing.

**Example fragment:** `view control fv of Controller.regulate;`

**Graphical notation:** [Flow View](GRAPHICAL_CATALOG.md#notation-view-fv). Flow View.

## Keyword: grv

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Grid View of a package or named semantic declaration other than a view. Presents inventory, contracts, timing, allocation or trace tables; sorting does not change model meaning.

**Example fragment:** `view inventory grv of Architecture;`

**Graphical notation:** [Grid View](GRAPHICAL_CATALOG.md#notation-view-grv). Grid View.

## Keyword: gv

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Selects a General View of software structure. Box in box and Tree are alternative presentation layouts preserving the same ownership and occurrence identities.

**Example fragment:** `view overview gv of Product;`

**Graphical notation:** [General View](GRAPHICAL_CATALOG.md#notation-view-gv), [General View: Tree](GRAPHICAL_CATALOG.md#notation-view-gv-tree). General View; General View: Tree.

## Keyword: idempotent

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Signature`.

Contract assertion required for RPC under atLeastOnce delivery. Repeated requests must have idempotent effects including published side effects. The keyword alone is not a proof.

**Example fragment:** `function read(): int idempotent;`

**Graphical notation:** [Interface function signature](GRAPHICAL_CATALOG.md#notation-function-signature). Interface function signature.

## Keyword: if

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `If`.

Evaluates one bool and executes the selected lexical block. It supplies no concurrency or implicit variable merging. Value-returning functions must cover both paths or fail.

**Example fragment:** `if (value > limit) { return false; } else { return true; }`

**Graphical notation:** [Conditional branch](GRAPHICAL_CATALOG.md#notation-conditional). Conditional branch.

## Keyword: import

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Import`.

Imports top-level names from one package using namespace::*; imports are not transitive. A short name must be unique across local and directly imported declarations.

**Example fragment:** `import Common::*;`

**Graphical notation:** [Package import](GRAPHICAL_CATALOG.md#notation-import). Package import.

## Keyword: in

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `Calculation`, `ForEach`.

Declares a typed input of a pure calculation, or separates the typed item binding from the fixed-array expression of forEach. Calculation inputs are copied; array iteration snapshots its collection once and binds copied items.

**Example fragment:** `in measured: real;`

**Graphical notation:** [Pure calculation](GRAPHICAL_CATALOG.md#notation-calculation), [Fixed-array forEach loop](GRAPHICAL_CATALOG.md#notation-for-each-loop). Pure calculation; Fixed-array forEach loop.

## Keyword: include

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `ViewSelection`.

Adds a subject selection to a view.

**Example fragment:** `include Demo;`

**Graphical notation:** [Filtered view selection](GRAPHICAL_CATALOG.md#notation-view-selection). Filtered view selection.

## Keyword: initial

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `StateBody`.

Introduces the state body after optional function-local calculation declarations. References exactly one state owned by that function and distinguishes state behavior from a statement block without a wrapper keyword. Initialization enters it once per run epoch before input consumption.

**Example fragment:** `initial Idle;`

**Graphical notation:** [Function with states](GRAPHICAL_CATALOG.md#notation-stateful-function), [Initial state reference](GRAPHICAL_CATALOG.md#notation-initial-state). Function with states; Initial state reference.

## Keyword: int

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Exact signed safe integers from âˆ’(2^53âˆ’1) through 2^53âˆ’1. Integral arithmetic produces int, with exact intermediate checks; division returns real.

**Example fragment:** `var delta: int = -2;`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Primitive types.

## Keyword: interface

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Declares a nominal, versioned contract of one of four kinds. Port endpoints must reference the same declaration; matching names or version strings alone are insufficient.

**Example fragment:** `interface service Orders version "1.0.0" { ... }`

**Graphical notation:** [Sender–receiver interface](GRAPHICAL_CATALOG.md#notation-sender-receiver-interface), [Client–server interface](GRAPHICAL_CATALOG.md#notation-client-server-interface), [Publish–subscribe interface](GRAPHICAL_CATALOG.md#notation-publish-subscribe-interface), [Service interface](GRAPHICAL_CATALOG.md#notation-service-interface). Sender–receiver interface; Client–server interface; Publish–subscribe interface; Service interface.

## Keyword: interruptible

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Interruptible`.

Names a cooperatively cancellable region in a triggered serial flow function. An explicitly routed data/event input cancels protected work at a statement boundary or suspended request and runs the typed handler in the same activation. Pending requests are abandoned locally without rolling back prior or remote effects. The region supplies no hardware preemption or pause/resume.

**Example fragment:** `interruptible work { call job.perform() as answer within 1 s otherwise { return; }; } on receive control.stop { cancelled = true; }`

**Graphical notation:** [Interruptible flow region](GRAPHICAL_CATALOG.md#notation-interruptible-region). Interruptible flow region.

## Keyword: iv

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Interconnect View of a class/component root, definition or occurrence. Shows owned and immediate-child ports, explicit connectors and delegation with exact interface paths; client/server and requires/provides use socket/ball symbols.

**Example fragment:** `view wiring iv of Product;`

**Graphical notation:** [Interconnect View](GRAPHICAL_CATALOG.md#notation-view-iv). Interconnect View.

## Keyword: label

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `ScenarioStep`.

Assigns a unique name to a scenario step. Later after clauses use that label as a causal predecessor; source position alone imposes no ordering.

**Example fragment:** `via orderLink label submitted;`

**Graphical notation:** [Case data exchange](GRAPHICAL_CATALOG.md#notation-case-data-exchange), [Case event exchange](GRAPHICAL_CATALOG.md#notation-case-event-exchange), [Case request](GRAPHICAL_CATALOG.md#notation-case-request), [Correlated case reply](GRAPHICAL_CATALOG.md#notation-case-reply), [Case causal order](GRAPHICAL_CATALOG.md#notation-case-causal-order). Case data exchange; Case event exchange; Case request; Correlated case reply; Case causal order.

## Keyword: maxAge

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

Maximum message age measured from original emission through retries. Eligibility is inclusive; greater age discards before dispatch. Required for sampled data in realtime/mixed roots.

**Example fragment:** `maxAge 20 ms;`

**Graphical notation:** [Message freshness bound](GRAPHICAL_CATALOG.md#notation-freshness-bound). Message freshness bound.

## Keyword: maxLatency

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

Positive bound from admitted emission to destination readiness, excluding dispatch wait. Exceeding it is an observable contract violation. Required on realtime/mixed connectors.

**Example fragment:** `maxLatency 1 ms;`

**Graphical notation:** [Transport latency bound](GRAPHICAL_CATALOG.md#notation-latency-bound). Transport latency bound.

## Keyword: mixed

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `RootComponent`.

Root component profile covering embedded/service combinations. All used functions carry timing and all connectors latency; sampled data also carries age. It does not silently exempt cloud-facing paths.

**Example fragment:** `component Product mixed { ... }`

**Graphical notation:** [Root execution profile](GRAPHICAL_CATALOG.md#notation-execution-profile). Root execution profile.

## Keyword: ms

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Millisecond duration unit; one ms equals 1,000,000 ns. Duration magnitude must be a positive integer and normalize exactly within the safe range.

**Example fragment:** `within 25 ms`

**Graphical notation:** [Duration value](GRAPHICAL_CATALOG.md#notation-duration). Duration value.

## Keyword: not

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `UnaryExpression`.

Unary bool negation with precedence above multiplication. No numeric or string coercion is allowed.

**Example fragment:** `not ready`

**Graphical notation:** [Expressions and value paths](GRAPHICAL_CATALOG.md#notation-expression). Expressions and value paths.

## Keyword: ns

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Nanosecond duration unit and the reference simulation clock's integral base. All specified durations are positive, with safe exact conversion.

**Example fragment:** `after 1 ns`

**Graphical notation:** [Duration value](GRAPHICAL_CATALOG.md#notation-duration). Duration value.

## Keyword: of

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `Satisfaction`, `Scenario`, `View`.

Selects the root context of a useCase/verificationCase, the design source of a satisfy claim, or the subject of a compact view. These are references, not changes of containment. Satisfaction remains directed from design to requirement.

**Example fragment:** `view flow fv of Product.controller.worker.run;`

**Graphical notation:** [Use case](GRAPHICAL_CATALOG.md#notation-case), [Satisfaction relation](GRAPHICAL_CATALOG.md#notation-satisfies-link), [General View](GRAPHICAL_CATALOG.md#notation-view-gv), [General View: Tree](GRAPHICAL_CATALOG.md#notation-view-gv-tree), [Interconnect View](GRAPHICAL_CATALOG.md#notation-view-iv), [Case View](GRAPHICAL_CATALOG.md#notation-view-cv), [Sequence View](GRAPHICAL_CATALOG.md#notation-view-sv), [Grid View](GRAPHICAL_CATALOG.md#notation-view-grv), [Flow View](GRAPHICAL_CATALOG.md#notation-view-fv), [Verification case](GRAPHICAL_CATALOG.md#notation-verification-case). Use case; Satisfaction relation; General View; General View: Tree; Interconnect View; Case View; Sequence View; Grid View; Flow View; Verification case.

## Keyword: on

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Deployment`, `Trigger`, `Interruptible`, `Transition`.

Introduces a function activation trigger, state transition trigger, interruptible-region input or deployment destination. Deployment is a location association; activation and interruption are incoming control bindings.

**Example fragment:** `function tick() on every 10 ms { return; } / deploy app on "system:production";`

**Graphical notation:** [Startup activation](GRAPHICAL_CATALOG.md#notation-trigger-start), [Periodic activation](GRAPHICAL_CATALOG.md#notation-trigger-periodic), [Port receive activation](GRAPHICAL_CATALOG.md#notation-trigger-receive), [RPC handler activation](GRAPHICAL_CATALOG.md#notation-trigger-call), [State transition](GRAPHICAL_CATALOG.md#notation-transition), [Deployment binding](GRAPHICAL_CATALOG.md#notation-deployment), [Interruptible flow region](GRAPHICAL_CATALOG.md#notation-interruptible-region). Startup activation; Periodic activation; Port receive activation; RPC handler activation; State transition; Deployment binding; Interruptible flow region.

## Keyword: operation

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Signature`, `FunctionDef`.

General executable member or interface signature, with the same copied inputs/result, activation, timing and body rules as its function specialization. Operations own local calculations and statement flow or states. An operation signature accepts an operation or function handler; a function signature requires a function handler.

**Example fragment:** `operation twice(input: int): int { return input * 2; }`

**Graphical notation:** [Executable operation](GRAPHICAL_CATALOG.md#notation-operation), [Interface operation signature](GRAPHICAL_CATALOG.md#notation-operation-signature). Executable operation; Interface operation signature.

## Keyword: optional

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Allows a port to remain unconnected in a closed root component. It does not change contract, role or handler rules. Unbound data/event sends succeed; unbound RPC reports Unavailable.

**Example fragment:** `port diagnostics: Notices publisher optional;`

**Graphical notation:** [Optional port](GRAPHICAL_CATALOG.md#notation-optional-port). Optional port.

## Keyword: or

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `OrExpression`.

Short-circuit Boolean disjunction. The right bool operand is evaluated only when the left is false.

**Example fragment:** `ready or retryAllowed`

**Graphical notation:** [Expressions and value paths](GRAPHICAL_CATALOG.md#notation-expression). Expressions and value paths.

## Keyword: ordering

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

Selects fifo or unordered independently of delivery reliability. Ordering applies per connector occurrence, direction and member, not across an entire interface or root.

**Example fragment:** `ordering fifo;`

**Graphical notation:** [Queue ordering](GRAPHICAL_CATALOG.md#notation-ordering-policy). Queue ordering.

## Keyword: otherwise

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `RemoteCall`.

Mandatory request failure block with implicit copied failure:string. It must return or fail on every path and cannot fall through to successful result use.

**Example fragment:** `within 1 s otherwise { lastError = failure; return; };`

**Graphical notation:** [Routed function call](GRAPHICAL_CATALOG.md#notation-routed-call). Routed function call.

## Keyword: overflow

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

Required admission policy when a member queue is full: dropOldest, dropNewest or reject. Policies apply independently to every route in fanout.

**Example fragment:** `overflow reject;`

**Graphical notation:** [Overflow behavior](GRAPHICAL_CATALOG.md#notation-overflow-policy). Overflow behavior.

## Keyword: package

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Package`.

Top-level, non-nested namespace for declarations and direct imports. A package is declared once in the loaded workspace; multiple packages may share a file.

**Example fragment:** `package Control { ... }`

**Graphical notation:** [Package](GRAPHICAL_CATALOG.md#notation-package). Package.

## Keyword: port

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Owned communication boundary typed by one interface with a compatible role and optionality. A port may bind local functions to members or delegate to a child while retaining one resolved handler owner.

**Example fragment:** `port api: Orders requires;`

**Graphical notation:** [Data sender port](GRAPHICAL_CATALOG.md#notation-port-sender), [Data receiver port](GRAPHICAL_CATALOG.md#notation-port-receiver), [RPC client port](GRAPHICAL_CATALOG.md#notation-port-client), [RPC server port](GRAPHICAL_CATALOG.md#notation-port-server), [Event publisher port](GRAPHICAL_CATALOG.md#notation-port-publisher), [Event subscriber port](GRAPHICAL_CATALOG.md#notation-port-subscriber), [Service provider port](GRAPHICAL_CATALOG.md#notation-port-provides), [Service consumer port](GRAPHICAL_CATALOG.md#notation-port-requires). Data sender port; Data receiver port; RPC client port; RPC server port; Event publisher port; Event subscriber port; Service provider port; Service consumer port.

## Keyword: priority

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`, `Attribute`.

Nonnegative safe-integer tie-break among matching transitions for the same state and stimulus; larger wins, default 0. It is not a function scheduling priority.

**Example fragment:** `on receive commands.begin priority 2 {}`

**Graphical notation:** [Transition priority](GRAPHICAL_CATALOG.md#notation-transition-priority). Transition priority.

## Keyword: provides

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Provider role of a service interface. Handles incoming RPC, returns correlated results/failures and publishes its declared events in reverse connector direction.

**Example fragment:** `port api: Orders provides;`

**Graphical notation:** [Service provider port](GRAPHICAL_CATALOG.md#notation-port-provides). Service provider port.

## Keyword: publish

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Send`, `ScenarioStep`.

Emits an outgoing event through a publisher/provides port. In a case, describes a routed event step. Arguments are evaluated once and copied per route; no free event syntax exists.

**Example fragment:** `publish api.changed(current);`

**Graphical notation:** [Event publication](GRAPHICAL_CATALOG.md#notation-publish), [Case event exchange](GRAPHICAL_CATALOG.md#notation-case-event-exchange). Event publication; Case event exchange.

## Keyword: publisher

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Outgoing role for a publishSubscribe contract. One port may fan out through several connectors; every outgoing member is tied to an emitting function.

**Example fragment:** `port events: Notices publisher;`

**Graphical notation:** [Event publisher port](GRAPHICAL_CATALOG.md#notation-port-publisher). Event publisher port.

## Keyword: publishSubscribe

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Event-only contract kind with publisher/subscriber ports. Subscriptions are explicit static connectors. Runtime subscribe/unsubscribe and wildcard topics are outside 1.3.

**Example fragment:** `interface publishSubscribe Notices version "1.0.0" { event changed(); }`

**Graphical notation:** [Publish–subscribe interface](GRAPHICAL_CATALOG.md#notation-publish-subscribe-interface). Publish–subscribe interface.

## Keyword: qos

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosPolicy`, `Qos`.

Introduces a complete inline connector policy, an explicit named-policy reference, or a package-owned qos def declaration. A named policy reuses values without sharing connector queues. Every body declares delivery, ordering, capacity and overflow, then optional latency and age.

**Example fragment:** `qos def LocalLink { delivery atMostOnce; ordering fifo; capacity 8; overflow reject; } / qos LocalLink`

**Graphical notation:** [Delivery policy](GRAPHICAL_CATALOG.md#notation-delivery-policy), [Reusable QoS policy](GRAPHICAL_CATALOG.md#notation-qos-policy-definition), [Named connector policy](GRAPHICAL_CATALOG.md#notation-qos-policy-reference). Delivery policy; Reusable QoS policy; Named connector policy.

## Keyword: queued

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `DataMember`.

SenderReceiver data mode representing a sequence of retained values under queue policy. It does not imply losslessness or unbounded history.

**Example fragment:** `data text: string queued;`

**Graphical notation:** [Data member](GRAPHICAL_CATALOG.md#notation-data-member). Data member.

## Keyword: real

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Finite IEEE 754 binary64 values. Scalar byte, uint and int may widen to real; real does not implicitly narrow to an integral type.

**Example fragment:** `var gain: real = 0.5;`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Primitive types.

## Keyword: realtime

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `RootComponent`.

Root component profile requiring function timing, connector latency and sampled freshness contracts. Those declarations require target evidence before any hard realtime claim.

**Example fragment:** `component Heating realtime { ... }`

**Graphical notation:** [Root execution profile](GRAPHICAL_CATALOG.md#notation-execution-profile). Root execution profile.

## Keyword: receive

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`, `Interruptible`, `Transition`.

Consumes an incoming data/event member through a receiver/subscriber/requires port. An ordinary function receives copied parameters; a transition or interruptible handler receives a copied data payload or event parameters. Boundaries remain explicit.

**Example fragment:** `on receive commands.begin`

**Graphical notation:** [Port receive activation](GRAPHICAL_CATALOG.md#notation-trigger-receive), [State transition](GRAPHICAL_CATALOG.md#notation-transition), [Interruptible flow region](GRAPHICAL_CATALOG.md#notation-interruptible-region). Port receive activation; State transition; Interruptible flow region.

## Keyword: receiver

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Incoming senderReceiver role. Every data member has one handler owner; at most one route feeds a closed receiver port. Multiple sources require an explicit merge/adaptor component.

**Example fragment:** `port input: Samples receiver;`

**Graphical notation:** [Data receiver port](GRAPHICAL_CATALOG.md#notation-port-receiver). Data receiver port.

## Keyword: record

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `RecordLiteral`.

Constructs a nominal datatype value by assigning each declared field exactly once. Field order in the literal does not change record equality; fields remain copied values.

**Example fragment:** `record Point { x = 1.0; y = 2.0; }`

**Graphical notation:** [Record construction](GRAPHICAL_CATALOG.md#notation-record-value). Record construction.

## Keyword: recursive

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `ViewSelection`.

Includes descendants before filtering.

**Example fragment:** `include Demo recursive;`

**Graphical notation:** [Filtered view selection](GRAPHICAL_CATALOG.md#notation-view-selection). Filtered view selection.

## Keyword: redefines

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Instance`, `Port`, `Variable`, `Connect`, `Delegate`, `FunctionDef`.

Explicitly replaces an inherited member while preserving its category and compatible contract. Unmarked inherited-name collisions and missing inherited targets are errors.

**Example fragment:** `redefines function startUp() on start { return; }`

**Graphical notation:** [Member redefinition](GRAPHICAL_CATALOG.md#notation-member-redefinition). Member redefinition.

## Keyword: reentrant

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Allows overlapping function activations with independent dispatch-time component snapshots. Direct or helper writes to component state are statically invalid. Local variables remain mutable; one state reaction cannot overlap itself.

**Example fragment:** `concurrency reentrant;`

**Graphical notation:** [Concurrency mode](GRAPHICAL_CATALOG.md#notation-concurrency-mode). Concurrency mode.

## Keyword: reject

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

On full queue, rejects the offer. Data/event producers fail after all fanout offers; requests take otherwise with Rejected. Previously accepted offers and effects are preserved.

**Example fragment:** `overflow reject;`

**Graphical notation:** [Overflow behavior](GRAPHICAL_CATALOG.md#notation-overflow-policy). Overflow behavior.

## Keyword: reply

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `ScenarioStep`.

Describes a response step in a case, reversing an existing connector/member request. It must have one unanswered causal request ancestor. Executable handlers reply by returning, not by a reply statement.

**Example fragment:** `reply backend.api.get -> client.api.get via link after asked label answered;`

**Graphical notation:** [Correlated case reply](GRAPHICAL_CATALOG.md#notation-case-reply). Correlated case reply.

## Keyword: requirement

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Requirement`.

Declares a named obligation with immutable typed attributes and at most one optional formal doc. satisfy links design to the requirement; only verificationCase owns verify links. These relations do not establish a passed result.

**Example fragment:** `requirement Safe { doc /* Duty shall remain within the allowed range. */ }`

**Graphical notation:** [Requirement](GRAPHICAL_CATALOG.md#notation-requirement). Requirement.

## Keyword: requires

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Consumer role of a service interface. Issues RPC and handles reverse-direction provider events. It has at most one route in a closed root component.

**Example fragment:** `port orders: Orders requires;`

**Graphical notation:** [Service consumer port](GRAPHICAL_CATALOG.md#notation-port-requires). Service consumer port.

## Keyword: return

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Calculation`, `Return`.

Completes a function activation or local call with its required result; bare return completes void. In a calc declaration it introduces the one named typed output and pure expression.

**Example fragment:** `return true; / return result: real = value * gain;`

**Graphical notation:** [Pure calculation](GRAPHICAL_CATALOG.md#notation-calculation), [Function return](GRAPHICAL_CATALOG.md#notation-return). Pure calculation; Function return.

## Keyword: s

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Second duration unit; one s equals 1,000,000,000 ns. A duration must still fit the exact safe nanosecond range.

**Example fragment:** `within 2 s`

**Graphical notation:** [Duration value](GRAPHICAL_CATALOG.md#notation-duration). Duration value.

## Keyword: sampled

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `DataMember`.

SenderReceiver data mode retaining the latest pending sample: capacity 1 and dropOldest are mandatory. Dispatch removes the sample; the core does not define a remote shared-variable read.

**Example fragment:** `data temperature: real sampled;`

**Graphical notation:** [Data member](GRAPHICAL_CATALOG.md#notation-data-member). Data member.

## Keyword: satisfy

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Satisfaction`.

Design-to-requirement satisfaction claim.

**Example fragment:** `satisfy Reliable of Demo;`

**Graphical notation:** [Satisfaction relation](GRAPHICAL_CATALOG.md#notation-satisfies-link). Satisfaction relation.

## Keyword: send

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Send`, `ScenarioStep`.

Emits an outgoing senderReceiver data member through a sender port with exactly one value. In a case it describes a data exchange. It cannot publish events or bypass another component's interface.

**Example fragment:** `send output.temperature(23.5);`

**Graphical notation:** [Data send](GRAPHICAL_CATALOG.md#notation-send), [Case data exchange](GRAPHICAL_CATALOG.md#notation-case-data-exchange). Data send; Case data exchange.

## Keyword: sender

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Outgoing senderReceiver role. May fan out through multiple explicit connectors; each member has at least one syntactically associated emitting function.

**Example fragment:** `port output: Samples sender;`

**Graphical notation:** [Data sender port](GRAPHICAL_CATALOG.md#notation-port-sender). Data sender port.

## Keyword: senderReceiver

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Data-only contract kind with sampled/queued members and sender/receiver roles. No RPC functions or event members may be declared inside it.

**Example fragment:** `interface senderReceiver Samples version "1.0.0" { data value: real sampled; }`

**Graphical notation:** [Sender–receiver interface](GRAPHICAL_CATALOG.md#notation-sender-receiver-interface). Sender–receiver interface.

## Keyword: serial

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Default activation mode: acquire the component's one serial lock until completion/failure, including RPC waits. Local invokes share the activation lock. Independent component activations may still interleave.

**Example fragment:** `concurrency serial;`

**Graphical notation:** [Concurrency mode](GRAPHICAL_CATALOG.md#notation-concurrency-mode). Concurrency mode.

## Keyword: server

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Provider role for clientServer contracts. Each function signature has exactly one on call handler; results/failures follow the request correlation.

**Example fragment:** `port health: Health server;`

**Graphical notation:** [RPC server port](GRAPHICAL_CATALOG.md#notation-port-server). RPC server port.

## Keyword: service

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`, `RootComponent`.

As an interface kind, combines RPC functions and events with requires/provides roles. As a root component profile, makes timing contracts optional while retaining interfaces, explicit QoS and static validity; it is the default when no profile is written.

**Example fragment:** `interface service Orders version "1.0.0" { ... } / component Shop service { ... }`

**Graphical notation:** [Service interface](GRAPHICAL_CATALOG.md#notation-service-interface), [Root execution profile](GRAPHICAL_CATALOG.md#notation-execution-profile). Service interface; Root execution profile.

## Keyword: specializes

**Concern:** [Structure and names](spec/01-structure-and-types.md). **Grammar:** `Component`.

Declares one acyclic compatible base. A component definition may specialize a class or component; a class definition may specialize a class. Effective members retain explicit compatible redefinition rules.

**Example fragment:** `component def Tuned specializes Controller { }`

**Graphical notation:** [Component specialization](GRAPHICAL_CATALOG.md#notation-component-specialization). Component specialization.

## Keyword: start

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Trigger`.

Once-per-run startup trigger for a parameterless void function. Stateful functions require it. All stores/routes/handlers exist before startup work runs; readiness protocols still need explicit ports.

**Example fragment:** `function boot(): void on start { ... }`

**Graphical notation:** [Startup activation](GRAPHICAL_CATALOG.md#notation-trigger-start). Startup activation.

## Keyword: state

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `State`.

Declares a named state directly inside a function after its initial reference. Optional entry/exit blocks contain ordinary function statements. State names are function-local; no separate state allocation or performer exists.

**Example fragment:** `state Idle { entry { active = false; } }`

**Graphical notation:** [State](GRAPHICAL_CATALOG.md#notation-state), [Final state](GRAPHICAL_CATALOG.md#notation-final-state). State; Final state.

## Keyword: string

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Finite Unicode text with exact equality and no normalization. Strings support portable escapes; implicit concatenation, ordering and bounded transport size are absent.

**Example fragment:** `var lastError: string = "";`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Primitive types.

## Keyword: subscriber

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Port`.

Incoming publishSubscribe role. Multiple publishers may feed one subscriber port through distinct queues. Each event has one handler owner; cross-source ordering is unspecified.

**Example fragment:** `port input: Notices subscriber;`

**Graphical notation:** [Event subscriber port](GRAPHICAL_CATALOG.md#notation-port-subscriber). Event subscriber port.

## Keyword: sv

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Sequence View of a case or a root component's selected case. Lifelines are occurrences; arrows show port/member/connector and request correlation. Independent steps must remain visibly unordered.

**Example fragment:** `view checkout sv of Checkout;`

**Graphical notation:** [Sequence View](GRAPHICAL_CATALOG.md#notation-view-sv). Sequence View.

## Keyword: timing

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Function contract containing wcet, deadline and concurrency in that order. Required on used functions in realtime/mixed roots; stateful function timing applies per reaction.

**Example fragment:** `timing { wcet 1 ms; deadline 5 ms; concurrency serial; }`

**Graphical notation:** [Function timing contract](GRAPHICAL_CATALOG.md#notation-timing-contract), [Timing View](GRAPHICAL_CATALOG.md#notation-function-timing-diagram). Function timing contract; Timing View.

## Keyword: transition

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`.

Named state edge owned by one function, with source/target, stimulus, optional guard/priority and effect. Execution orders exit, effect, state update, entry, then completion processing.

**Example fragment:** `transition beginRun: Idle -> Running on receive commands.begin {}`

**Graphical notation:** [State transition](GRAPHICAL_CATALOG.md#notation-transition). State transition.

## Keyword: true

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `Literal`.

The true bool literal, with no implicit equivalence to numeric one or other nonempty values.

**Example fragment:** `assert true;`

**Graphical notation:** [Expressions and value paths](GRAPHICAL_CATALOG.md#notation-expression). Expressions and value paths.

## Keyword: tv

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Selects a Timing View of executable operation/function declarations or occurrences. Explicit selection and filters preserve identity; the host associates an identified trace and concrete occurrence identities separately from declared timing contracts.

**Example fragment:** `view polling tv of Demo.first.poll;`

**Graphical notation:** [Timing View](GRAPHICAL_CATALOG.md#notation-function-timing-diagram). Timing View.

## Keyword: uint

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

Exact nonnegative integers from 0 through 2^53âˆ’1. Scalar widening is supported; assigning an integral expression to uint checks its range instead of wrapping.

**Example fragment:** `var count: uint = 0;`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Primitive types.

## Keyword: unordered

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `QosBody`.

No source-language dispatch ordering guarantee beyond other causal rules. A deterministic backend may still choose FIFO; this choice must not be mistaken for a model guarantee.

**Example fragment:** `ordering unordered;`

**Graphical notation:** [Queue ordering](GRAPHICAL_CATALOG.md#notation-ordering-policy). Queue ordering.

## Keyword: us

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Duration`.

Microsecond duration unit; one us equals 1,000 ns. The source spelling is ASCII us, not the micro sign.

**Example fragment:** `wcet 100 us;`

**Graphical notation:** [Duration value](GRAPHICAL_CATALOG.md#notation-duration). Duration value.

## Keyword: useCase

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Scenario`.

Intended use with optional routed exchanges.

**Example fragment:** `useCase Start of Demo {}`

**Graphical notation:** [Use case](GRAPHICAL_CATALOG.md#notation-case). Use case.

## Keyword: var

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `Variable`, `LocalVariable`.

Declares mutable private component data or a block-local copied value. Ownership determines scope; local declarations cannot shadow live values.

**Example fragment:** `var count: int = 0;`

**Graphical notation:** [Private component variable](GRAPHICAL_CATALOG.md#notation-private-variable), [Local declaration](GRAPHICAL_CATALOG.md#notation-local-declaration). Private component variable; Local declaration.

## Keyword: verificationCase

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Scenario`.

Verification intent with explicit verify links.

**Example fragment:** `verificationCase Check of Demo { verify Reliable; }`

**Graphical notation:** [Verification case](GRAPHICAL_CATALOG.md#notation-verification-case). Verification case.

## Keyword: verify

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `Verification`.

Links a verification case to a requirement.

**Example fragment:** `verify Reliable;`

**Graphical notation:** [Verification relation](GRAPHICAL_CATALOG.md#notation-verification-link). Verification relation.

## Keyword: version

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `Interface`.

Required interface semantic-version string major.minor.patch. Compatibility is nominal declaration identity, not automatic version-range matching or structural subtyping.

**Example fragment:** `interface clientServer API version "1.0.0" { ... }`

**Graphical notation:** [Sender–receiver interface](GRAPHICAL_CATALOG.md#notation-sender-receiver-interface), [Client–server interface](GRAPHICAL_CATALOG.md#notation-client-server-interface), [Publish–subscribe interface](GRAPHICAL_CATALOG.md#notation-publish-subscribe-interface), [Service interface](GRAPHICAL_CATALOG.md#notation-service-interface). Sender–receiver interface; Client–server interface; Publish–subscribe interface; Service interface.

## Keyword: via

**Concern:** [Cases and evidence](spec/04-systems-and-conformance.md). **Grammar:** `ScenarioStep`.

Names the root-level connector used by a case exchange. Endpoint-member paths must resolve on root-owned or immediate-child component ports with a legal orientation.

**Example fragment:** `via orderLink label submitted;`

**Graphical notation:** [Case data exchange](GRAPHICAL_CATALOG.md#notation-case-data-exchange), [Case event exchange](GRAPHICAL_CATALOG.md#notation-case-event-exchange), [Case request](GRAPHICAL_CATALOG.md#notation-case-request), [Correlated case reply](GRAPHICAL_CATALOG.md#notation-case-reply). Case data exchange; Case event exchange; Case request; Correlated case reply.

## Keyword: view

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `View`.

Declares a named gv/iv/cv/sv/grv/fv/tv projection. Compact of syntax selects one subject; a block combines include selections, optional recursive traversal and pure where filters into a stable union of occurrence paths. It carries no executable behavior or diagram geometry.

**Example fragment:** `view wiring iv of Product;`

**Graphical notation:** [General View](GRAPHICAL_CATALOG.md#notation-view-gv), [General View: Tree](GRAPHICAL_CATALOG.md#notation-view-gv-tree), [Interconnect View](GRAPHICAL_CATALOG.md#notation-view-iv), [Case View](GRAPHICAL_CATALOG.md#notation-view-cv), [Sequence View](GRAPHICAL_CATALOG.md#notation-view-sv), [Grid View](GRAPHICAL_CATALOG.md#notation-view-grv), [Flow View](GRAPHICAL_CATALOG.md#notation-view-fv). General View; General View: Tree; Interconnect View; Case View; Sequence View; Grid View; Flow View.

## Keyword: void

**Concern:** [Values and calculation](spec/01-structure-and-types.md). **Grammar:** `TypeRef`.

No result value. It is the default function/signature result and cannot type data, input parameters, fields, arrays or calculation outputs.

**Example fragment:** `function reset() { return; }`

**Graphical notation:** [Primitive types](GRAPHICAL_CATALOG.md#notation-primitive-types). Primitive types.

## Keyword: wcet

**Concern:** [Timing and deployment](spec/04-systems-and-conformance.md). **Grammar:** `Timing`.

Positive active-execution-time bound including local helpers and state reaction microsteps, excluding request wait. Must not exceed deadline; physical evidence belongs to a target binding.

**Example fragment:** `wcet 1 ms;`

**Graphical notation:** [Function timing contract](GRAPHICAL_CATALOG.md#notation-timing-contract), [Timing View](GRAPHICAL_CATALOG.md#notation-function-timing-diagram). Function timing contract; Timing View.

## Keyword: when

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `Transition`.

Optional pure bool transition guard evaluated against the component snapshot/live environment and stimulus payload as applicable. False consumes/ignores the stimulus when no other transition matches.

**Example fragment:** `on receive commands.begin when (enabled) {}`

**Graphical notation:** [Transition guard](GRAPHICAL_CATALOG.md#notation-transition-guard). Transition guard.

## Keyword: where

**Concern:** [Graphical views](GRAPHICAL_NOTATION.md). **Grammar:** `ViewSelection`.

Filters selected candidates with a Boolean predicate.

**Example fragment:** `include Demo recursive where kind == "function";`

**Graphical notation:** [Filtered view selection](GRAPHICAL_CATALOG.md#notation-view-selection). Filtered view selection.

## Keyword: while

**Concern:** [Behavior and states](spec/03-behavior.md). **Grammar:** `While`, `DoWhile`.

Checks the Boolean condition before each while iteration or after each do-loop body. Both forms require a positive safe-integer bound and a fresh lexical body scope. A true condition after the bound fails instead of silently exiting.

**Example fragment:** `while (i < 3) bound 3 { i = i + 1; }`

**Graphical notation:** [Bounded loop](GRAPHICAL_CATALOG.md#notation-bounded-loop), [Post-test do-while loop](GRAPHICAL_CATALOG.md#notation-do-while-loop). Bounded loop; Post-test do-while loop.

## Keyword: within

**Concern:** [Communication](spec/02-communication.md). **Grammar:** `RemoteCall`.

Required positive RPC timeout measured from issuance. Only a response observed strictly before expiry can win; equal-time expiry wins and late server effects are not canceled.

**Example fragment:** `within 100 ms otherwise { return; };`

**Graphical notation:** [Routed function call](GRAPHICAL_CATALOG.md#notation-routed-call). Routed function call.

## Punctuation and operator reference

| Token | Meaning |
| --- | --- |
| `;` | Declaration/statement terminator where the production requires it. |
| `{ }` | Owned declarations, block scope, record assignments, QoS or timing block according to context. |
| `( )` | Arguments, parameters, conditions or precedence grouping. |
| `[ ]` | Fixed type extent, array literal or one final index read. |
| `:` | Name/type separator, function result or connector/transition header separator. |
| `,` | List separator; no implicit trailing comma. |
| `::` | Package qualification; imports append `::*`. |
| `.` | Structural/member path, local record field, enum literal separator or real-literal decimal point. |
| `->` | Connector, delegation, state transition or case exchange direction. |
| `=` | Initialization, assignment, calculation result expression or record field assignment; never equality. |
| `== !=` | Typed recursive equality/inequality; numeric scalar promotion permitted. |
| `< <= > >=` | Numeric ordering; no string ordering. |
| `+ - * / %` | Checked numeric arithmetic; slash always real, remainder integral only; minus also unary. |
| `//` / `/* */` | Line / non-nested block comments outside strings. |

Precedence, lowest first: or; and; equality; ordered comparison; addition/subtraction; multiplication/division/remainder; unary not/minus; primary. Binary operators associate left. Only and/or short-circuit. Identifiers, strings, numerics and durations have the exact lexical rules in [chapter 1](spec/01-structure-and-types.md); the [complete grammar](../src/language/swaml.langium) is authoritative for concrete syntax.
