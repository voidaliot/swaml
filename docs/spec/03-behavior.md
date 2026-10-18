# 3. Operations, functions, flow and states

Normative chapter of the [SWAML 1.3 specification](../LANGUAGE_SPECIFICATION.md).

## 3.1 Operation/function identity and activation

An executable `operation` belongs directly to a class/component definition or an inline root and executes in its owning usage. `function` declares the specialized Function kind of Operation. Both keywords accept the same body forms, local calculations, triggers, timing and copied-value execution rules. The remaining function rules in this chapter apply to both executable kinds unless a contract-kind rule explicitly distinguishes them. Neither spelling creates a pure expression call; `calc` remains the separate pure expression construct.

An operation/function has a name, ordered parameters, optional result annotation, optional trigger, optional timing contract, zero or more function-local calculations, and exactly one executable body form: a statement block or directly owned states. Omitting `: Type` means void; an explicit `: void` has identical meaning. Both leaf and composite classes/components may execute their own operations/functions. Each function executes against its owning component instance, independently of that component's children.

An **activation root** is one dispatched function activation or state reaction and its synchronous local-call stack. It owns the execution lock/snapshot context inherited by helpers. This runtime term is distinct from a **root component**, which selects architecture and may also own local functions.

| Trigger | Activation and permitted signature |
| --- | --- |
| omitted | local `call`; untriggered flow functions may return void or a typed value |
| `on start` | parameterless void function, once after component initialization and connector readiness |
| `on every D` | parameterless void function released at component start + kD, for positive integer k |
| `on receive p.m` | copied data/event arguments, void result |
| `on call p.m` | copied RPC arguments and exact contract result |

Operator commands, test stimuli, interrupt payloads, device samples and network events MUST use named interface members and explicit routes. Their source is an ordinary component-owned function that publishes or sends through an owned typed port. There is no special harness trigger or direct function-release input. Reproducible test drivers use existing start, periodic or state-timer behavior to schedule publications. A host-generated driver MUST remain ordinary validated source recorded with the run. Timers and initial activation are local lifecycle mechanisms.

Several ordinary operations/functions may exist in one class/component. An interface operation/function signature declares an RPC contract; the owned implementation triggered by that member implements it. An operation contract accepts either compatible executable kind; a function contract requires a function implementation. A stateful function directly contains its states. Reuse of algorithms is through calculations or local functions, and reuse of architecture is through definitions and instances.

## 3.2 Flow execution

An activation holds its copied parameters, locals, a program position, its component reference and any request correlation. Execute statements in source order. Blocks introduce lexical scope and discard block-local variables on leaving the block.

| Statement | Semantics |
| --- | --- |
| `var x: T = e;` | evaluate e, typecheck, create a local mutable value |
| `x = e;` | replace an existing local/parameter/component-variable value; no field or remote assignment |
| `call helper(args);` / `call helper(args) as result;` | execute an untriggered local flow function synchronously; void omits the binding, a value result requires a fresh binding |
| `return;` / `return e;` | complete the current function; return a copied value when required |
| `if (e) { … } else { … }` | evaluate a bool once and execute the selected block; else is optional |
| `while (e) bound n { … }` | evaluate the bool before each iteration; at most n body executions |
| `for (var i: T = e; condition; i = update) bound n { … }` | initialize once, test before each iteration, update after each normally completed body; at most n body executions |
| `forEach (item: T in values) { … }` | evaluate and copy one fixed-size array; execute once per copied element with a fresh typed binding |
| `do { … } while (e) bound n;` | execute the body once before testing; at most n body executions |
| `interruptible name { … } on receive port.member { … }` | protect a region and transfer to its typed interrupt handler within the current activation |
| `assert e;` | require a bool true; false fails the current activation |
| `fail "reason";` | terminate the activation with a local failure reason |
| `send` / `publish` / `call port.member(args) as result within D otherwise { … };` | execute chapter 2's typed interface exchanges |

Reaching the end of a void function completes it. A value-returning function MUST return a value or fail on every path. If the loop condition remains true after n iterations, execution fails with a bound violation; the nth iteration is allowed. Local recursion is forbidden across operations and functions alike. Functions own calculations. `call name(args)` can only target an untriggered flow function in the same component. A non-void result MUST bind a fresh local with `as name`; void MUST omit that binding. Arguments and results are copied, with declared type and range checks. The result is available only after successful return and cannot shadow an existing live value. The helper borrows its caller’s lock and snapshot; failure unwinds the caller without rollback. Functions are never expression calls. `call port.member(args)` selects a routed exchange with mandatory timeout and failure clauses. This two-segment form cannot bypass a component boundary.

Failure unwinds the current activation and its synchronous local callers. It does not undo earlier variable assignments, published messages, responses, or external effects. For an RPC handler, failure produces a RemoteFailure response through the originating interface. For a periodic/start/receive activation it produces a local diagnostic occurrence, not an implicit broadcast. To notify another component, model a fault event and publish it explicitly on a declared interface in an explicit branch before failing.

Conditionals, bounded loops, interruptible regions, expression evaluation and sequential local calls are the full flow language in 1.3. There is no generic fork/join statement, exception hierarchy, arbitrary host-language body or independent action node. Concurrent architectural behavior is expressed by separately activated functions and connected components. A later fork/join extension must define data-race and cancellation semantics before entering the grammar.

### Loop scopes and limits

while, for and do loops require a positive safe-integer literal bound. After n body executions, a true condition fails with LoopBound before another body execution. A counted loop's initializer executes once; its local binding is visible in the condition, update and body, and disappears after the loop. Its update sees the header scope, not locals declared in the body. Body locals are fresh for every iteration. A return/failure skips later update and condition evaluation while unwinding its function/frame.

forEach requires a nonempty fixed-size array and an explicit element type. The collection is evaluated and copied exactly once before the first iteration. Each element is copied and checked/widened into a fresh mutable iteration binding. Writes to the source array or iteration binding do not alter the iteration snapshot or other iterations. Array length is the iteration bound; no bound clause is permitted. do executes at least one body, then evaluates its Boolean condition in the enclosing scope; body locals cannot escape into that condition.

Nested loops have independent counters and scopes. A for/while loop may run zero times, so it cannot alone establish a required return. A do or nonempty forEach body that definitely terminates establishes termination on its first iteration. Bounds constrain repetitions, not elapsed physical time.

### Interruptible regions

An interruptible region is a named statement owned by a triggered serial flow function. It may carry one doc before its protected body. Its incoming endpoint MUST be a data/event member of a port owned by that component with receiver, subscriber or requires role. The endpoint uses the existing interface and connector/delegation route. Only one receiving function owns that member; it cannot also activate the same function or select another region. Region names are unique in the function. Reentrant functions, untriggered helpers and state actions cannot declare regions; stateful functions retain their receive transitions.

The region is armed when execution enters it and disarmed when the protected body exits or an interrupt is accepted. Delivery while armed cancels the remaining protected work and enters the handler at a statement boundary, including while the activation is suspended on a request. Nested protected regions and local call frames inside the cancelled region are unwound. The handler retains enclosing values and gains copied data payload or named event parameters; these bindings must not shadow enclosing values. Protected-body locals are absent. The same region is disarmed during its handler; an enclosing region may remain armed. After a normally completed body or handler, control continues after the region.

The handler retains the activation identity, serial lock, snapshot and deadline. Previous assignments, emissions and remote effects remain committed. A pending request continuation and its otherwise branch are cancelled; its correlation becomes terminal with an Interrupted reason. A response already terminal remains terminal with its original outcome. Server execution is not cancelled. Future replies cannot resume the unwound continuation. Available interrupt input outside an armed interval is explicitly discarded. One input cannot create a fresh activation.

Return and runtime failure unwind/disarm regions normally; a region catches only its selected interrupt. For value-returning functions, a region establishes definite termination only when both its protected body and handler definitely terminate. See chapter 6 for correlation races and statement-boundary scheduling. This construct does not specify processor interrupt service, pause/resume or physical preemption latency.

## 3.3 Scheduling and concurrency

All ordinary functions and state-machine reactions are serial by default. The component has one logical serial dispatch lock. A serial activation holds this lock until completion, including while suspended on a request; the logical lock is not required to consume a physical thread. A local call borrows its caller's lock and does not acquire a second lock.

A callback that starts another serial activation in the same component cannot execute until the current serial activation ends. A matching interrupt instead transfers control within the existing serial activation and does not acquire a second lock. Cycles of requests can therefore time out or deadlock absent timeouts; all requests have finite timeouts. The language does not silently release the lock and allow reentrant state mutation. Authors SHOULD avoid synchronous request cycles.

`concurrency reentrant` permits overlapping activations with separate local frames. Such a function MUST NOT mutate component data directly or through local helpers, and MUST NOT call a function that mutates shared state. It may read the component's state snapshot captured at dispatch, and calculations receive copied parameters. A conforming backend must preserve that snapshot or reject the model if its target cannot realize it. The reference validator follows local helper calls to check this prohibition. Snapshot realizability remains a backend obligation.

Input queues are per connector/member. FIFO constrains order within one queue. Across independent ready queues, the scheduler may choose any ready activation consistent with deadlines and the target profile; no global total order is inferred. Periodic activations released while the serial component is busy remain pending; a target profile MUST bound that activation backlog; exceeding the bound records ActivationOverflow and stops the selected root execution, as defined in chapter 6. Deadlines are measured from release, not eventual dispatch. Merely listing WCET/deadline does not define thread priorities.

The core semantics is therefore a set of allowed execution traces. An execution backend may add a deterministic scheduling policy that narrows this set but must document it. A model requiring determinism across sources must explicitly order exchanges or provide a coordinating function.

## 3.4 Stateful operations/functions

A stateful operation/function MUST have no parameters, result void (explicit or omitted), and `on start`. Its body begins with zero or more calculation declarations, then `initial StateName;`, followed by one or more states and zero or more transitions. There is no `machine` declaration or keyword. The grammar's `StateBody` only groups the owned syntax; it has no separate authored name, definition, allocation or runtime identity. `initial` MUST precede states and transitions after the optional calculations, so the executable body is unambiguously distinguished from statement flow. Calculations remain visible in all state guards, entries, exits and effects. The behavior is mathematically a flat state machine with exactly one initial reference. State and transition names are unique within that function's state body. Hierarchical/orthogonal states, history pseudostates, entry/exit points and state inheritance are absent in 1.3.

Starting the function enters its initial state and executes that state's entry block once. The function remains alive between reactions without holding the serial component lock. Each entry/exit/transition reaction is scheduled as a serial activation unless its timing contract explicitly says reentrant; a stateful function nevertheless MUST have at most one reaction in progress and cannot reenter its own state machine.

A state owns an optional entry block and optional exit block. A `final` state completes the function after its entry finishes and MUST have no outgoing transition. Ordinary completion is not an event emitted to another component. A notification on completion must be published explicitly before completing.

## 3.5 Transition triggers and selection

A transition names source and destination states in the same function. It has one trigger and optional bool guard and nonnegative safe integer priority. Missing priority means 0; larger values take precedence.

- `on receive port.member` consumes one incoming data/event for the machine. Event parameter names are available as copied values in the guard and effect. Data has the local name `payload`. These names MUST NOT collide with component variables. RPC functions are not allowed as state transition triggers.
- `on after D` becomes eligible after D elapsed time since completing the source state's entry block. Leaving the source cancels its timer. Reentering starts a fresh timer.
- `on completion` is eligible after the state's entry and any prior reaction have finished, before waiting for a new external message.

For one stimulus, first select transitions from the current state with matching trigger, then evaluate guards, then choose the highest-priority enabled transition. Potentially competing transitions with the same source and identical trigger MUST have distinct priorities even when an author believes their guards are mutually exclusive. A missing guard means true. Unrelated queued stimuli are dispatched one at a time, in the scheduler order permitted by 3.3.

A received message with no enabled transition is consumed and ignored. A timer with no enabled transition expires once and is not retriggered until reentry. Completion transitions are reevaluated after each successful state entry and each machine reaction, including an ignored stimulus. Models MUST NOT contain unconditional completion cycles. Guarded cycles must reach quiescence; a checking executor MUST fail a reaction after 1,024 completion microsteps rather than spin forever. This limit is a semantic protection, not a proof of useful behavior.

## 3.6 Transition execution

A selected transition executes atomically with respect to this component's other serial reactions:

1. Consume the matching stimulus, if any, and cancel all timers for the source state's entry generation.
2. Run the source state's exit block.
3. Run the transition effect with the stimulus payload in scope.
4. Update the current-state identity to the destination.
5. Run the destination state's entry block.
6. Complete if final; otherwise evaluate completion transitions or await a stimulus.

Entry and exit blocks do not inherit event parameters; only the guard/effect does. Copy a needed payload to component data in the effect if entry behavior needs it. A self-transition exits and reenters, including entry/exit effects and resetting timers.

`return;` in any state block terminates the owning stateful function immediately and cancels pending timers; remaining transition phases are skipped. `fail` terminates it with failure and also cancels timers. Neither rolls back prior side effects. Other queued messages still belong to the component, but a terminated machine no longer dispatches its members; a target runtime must record these as undeliverable until component restart.

Every state MUST be reachable from the initial state in the transition graph, ignoring guards for this static check. Reachability through satisfiable guards and eventual completion are stronger analysis obligations, not consequences of graph reachability. No state, function or component may use an unbound global event to change another component's behavior.

The [operational contract](06-execution-contract.md) further defines initialization barriers, snapshots, timer generations, stimulus ties, failure and resource bounds.
