# 3. Operations, flow and states

Normative chapter of the [SWAML 0.1 specification](../LANGUAGE_SPECIFICATION.md).

## 3.1 Operation identity and activation

An operation belongs directly to a unit definition and is instantiated per unit instance. It has a name, ordered parameters, result type, optional trigger, optional timing contract, and exactly one body form: a statement block or an owned state machine. A component does not execute operations; execution lives in its contained units.

| Trigger | Activation and permitted signature |
| --- | --- |
| omitted | local `invoke`; the callable operation must return Void |
| `on manual` | parameterless Void root activated by a test/administrative harness, carrying no model data |
| `on start` | parameterless Void operation, once after unit initialization and connector readiness |
| `on every D` | parameterless Void operation released at unit start + kD, for positive integer k |
| `on receive p.m` | copied data/event arguments, Void result |
| `on call p.m` | copied RPC arguments and exact contract result |

Manual activation is a control of the modeling environment, not a way to inject an external data exchange without a port. A modeled UI command, interrupt payload, device sample, network event or external client MUST use an interface. Timers and initial activation are local lifecycle mechanisms.

Several ordinary operations may exist in one unit. There is no UML-style separate “method implementation of action definition” layer. The interface signature describes an RPC contract, while the unit operation triggered by that member is its implementation. A stateful operation directly contains its states. Reuse of algorithms is through functions or local operations, and reuse of architecture is through definitions and instances.

## 3.2 Flow execution

An activation holds its copied parameters, locals, a program position, its unit reference and any request correlation. Execute statements in source order. Blocks introduce lexical scope and discard block-local variables on leaving the block.

| Statement | Semantics |
| --- | --- |
| `let x: T = e;` | evaluate e, typecheck, create a local mutable value |
| `set x = e;` | replace an existing local/parameter/unit-variable value; no field or remote assignment |
| `invoke op(args);` | execute an untriggered local Void operation synchronously; return resumes the caller |
| `return;` / `return e;` | complete the current operation; return a copied value when required |
| `if (e) { … } else { … }` | evaluate a Bool once and execute the selected block; else is optional |
| `while (e) bound n { … }` | evaluate the Bool before each iteration; at most n body executions |
| `assert e;` | require a Bool true; false fails the current activation |
| `fail "reason";` | terminate the activation with a local failure reason |
| `send` / `publish` / `request` | execute chapter 2's interface exchanges |

Reaching the end of a Void operation completes it. A value-returning operation MUST return a value or fail on every path. If the loop condition remains true after n iterations, execution fails with a bound violation; the nth iteration is allowed. Local recursion is forbidden for both operations and functions. `invoke` cannot call a triggered operation, a stateful operation, or a non-Void operation. Use functions for side-effect-free returned values, and a local Void operation plus owned data for local imperative work.

Failure unwinds the current activation and its synchronous local callers. It does not undo earlier variable assignments, published messages, responses, or external effects. For an RPC handler, failure produces a RemoteFailure response through the originating interface. For a periodic/start/manual/receive activation it produces a local diagnostic occurrence, not an implicit broadcast. To notify another unit, model a fault event and publish it explicitly on a declared interface in an explicit branch before failing.

Conditionals, bounded loops, expression evaluation and sequential local calls are the full flow language in 0.1. There is no generic fork/join statement, exception hierarchy, arbitrary host-language body or independent action node. Concurrent architectural behavior is expressed by separately activated operations and connected units. A later fork/join extension must define data-race and cancellation semantics before entering the grammar.

## 3.3 Scheduling and concurrency

All ordinary operations and state-machine reactions are serial by default. The unit has one logical serial dispatch lock. A serial activation holds this lock until completion, including while suspended on a request; the logical lock is not required to consume a physical thread. A local invoke borrows its caller's lock and does not acquire a second lock.

A callback to the same unit while a serial request is pending cannot execute until the serial activation ends. Cycles of requests can therefore time out or deadlock absent timeouts; all requests have finite timeouts. The language does not silently release the lock and allow reentrant state mutation. Authors SHOULD avoid synchronous request cycles.

`concurrency reentrant` permits overlapping activations with separate local frames. Such an operation MUST NOT mutate unit data directly or through local helpers, and MUST NOT invoke an operation that mutates shared state. It may read the unit's state snapshot captured at dispatch, and functions receive copied parameters. A conforming backend must preserve that snapshot or reject the model if its target cannot realize it. The reference validator follows local helper calls to check this prohibition. Snapshot realizability remains a backend obligation.

Input queues are per connector/member. FIFO constrains order within one queue. Across independent ready queues, the scheduler may choose any ready activation consistent with deadlines and the target profile; no global total order is inferred. Periodic activations released while the serial unit is busy remain pending; a target profile MUST bound that activation backlog; exceeding the bound records ActivationOverflow and stops the system, as defined in chapter 6. Deadlines are measured from release, not eventual dispatch. Merely listing WCET/deadline does not define thread priorities.

The core semantics is therefore a set of allowed execution traces. An execution backend may add a deterministic scheduling policy that narrows this set but must document it. A model requiring determinism across sources must explicitly order exchanges or provide a coordinating operation.

## 3.4 Stateful operations

A stateful operation MUST have no parameters, result Void, and `on start`. It owns one flat state machine with one or more states, exactly one initial reference and zero or more transitions. State and transition names are unique in the machine namespace. Hierarchical/orthogonal states, history pseudostates, entry/exit points and state inheritance are absent in 0.1.

Starting the operation enters its initial state and executes that state's entry block once. The operation remains alive between reactions without holding the serial unit lock. Each entry/exit/transition reaction is scheduled as a serial activation unless its timing contract explicitly says reentrant; a stateful operation nevertheless MUST have at most one reaction in progress and cannot reenter its own state machine.

A state owns an optional entry block and optional exit block. A `final` state completes the operation after its entry finishes and MUST have no outgoing transition. Ordinary completion is not an event emitted to another unit. A notification on completion must be published explicitly before completing.

## 3.5 Transition triggers and selection

A transition names source and destination states in the same machine. It has one trigger and optional Bool guard and nonnegative safe integer priority. Missing priority means 0; larger values take precedence.

- `on receive port.member` consumes one incoming data/event for the machine. Event parameter names are available as copied values in the guard and effect. Data has the local name `payload`. These names MUST NOT collide with unit variables. RPC operations are not allowed as machine transition triggers.
- `on after D` becomes eligible after D elapsed time since completing the source state's entry block. Leaving the source cancels its timer. Reentering starts a fresh timer.
- `on completion` is eligible after the state's entry and any prior reaction have finished, before waiting for a new external message.

For one stimulus, first select transitions from the current state with matching trigger, then evaluate guards, then choose the highest-priority enabled transition. Potentially competing transitions with the same source and identical trigger MUST have distinct priorities even when an author believes their guards are mutually exclusive. A missing guard means true. Unrelated queued stimuli are dispatched one at a time, in the scheduler order permitted by 3.3.

A received message with no enabled transition is consumed and ignored. A timer with no enabled transition expires once and is not retriggered until reentry. Completion transitions are reevaluated after each successful state entry and each machine reaction, including an ignored stimulus. Models MUST NOT contain unconditional completion cycles. Guarded cycles must reach quiescence; a checking executor MUST fail a reaction after 1,024 completion microsteps rather than spin forever. This limit is a semantic protection, not a proof of useful behavior.

## 3.6 Transition execution

A selected transition executes atomically with respect to this unit's other serial reactions:

1. Consume the matching stimulus, if any, and cancel all timers for the source state's entry generation.
2. Run the source state's exit block.
3. Run the transition effect with the stimulus payload in scope.
4. Update the current-state identity to the destination.
5. Run the destination state's entry block.
6. Complete if final; otherwise evaluate completion transitions or await a stimulus.

Entry and exit blocks do not inherit event parameters; only the guard/effect does. Copy a needed payload to unit data in the effect if entry behavior needs it. A self-transition exits and reenters, including entry/exit effects and resetting timers.

`return;` in any state block terminates the owning stateful operation immediately and cancels pending timers; remaining transition phases are skipped. `fail` terminates it with failure and also cancels timers. Neither rolls back prior side effects. Other queued messages still belong to the unit, but a terminated machine no longer dispatches its members; a target runtime must record these as undeliverable until unit restart.

Every state MUST be reachable from the initial state in the transition graph, ignoring guards for this static check. Reachability through satisfiable guards and eventual completion are stronger analysis obligations, not consequences of graph reachability. No state, operation or component may use an unbound global event to change another unit's behavior.

The [operational contract](06-execution-contract.md) further defines initialization barriers, snapshots, timer generations, stimulus ties, failure and resource bounds.
