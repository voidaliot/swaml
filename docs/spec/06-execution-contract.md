# 6. Operational contract and target bindings

Normative chapter of the [SWAML 1.3 specification](../LANGUAGE_SPECIFICATION.md). This chapter makes the allowed traces precise; it does not prescribe an implementation thread model. The [reference simulation binding](../SIMULATION.md) makes a deterministic logical-time choice within this contract; production backends require their own binding and evidence.

## 6.1 Configuration and observable occurrences

A running configuration consists of: the selected root component instance tree; private variable stores per component instance; live activation frames and their local call stacks; one serial lock per component; the state and timer generation of each live stateful function; message queues keyed by connector occurrence, direction and member; pending request correlations; released lifecycle activations; and a monotonic logical time.

Each message has a logical identity, original emission time, producing activation identity, typed copied payload, source/destination port occurrences, interface member, connector occurrence and delegation route. A retry keeps the logical identity and original timestamp. A transport attempt has a separate identity. An RPC response additionally references its request correlation. Occurrence identities MUST be unique within a run and cannot be declaration IDs reused for every emission.

The minimum observable trace alphabet is initialization, release, dispatch, statement completion, emission, admission, drop, delivery, request completion, timeout, state entry/exit, activation completion/failure, and contract violation. Each record includes logical time, occurrence identity and relevant source identities. A backend may omit detailed statement traces during normal execution, but MUST provide sufficient checking instrumentation to diagnose violated obligations. Trace records and diagnostics are observations, not implicit interface messages.

A step of execution is either a local statement/expression step, communication admission/delivery, dispatch, reaction microstep, or time advancement. Independent components may step in either order. No text-file order between components creates a happens-before edge. Elapsed physical execution time must be represented when checking deadlines; treating each statement as zero-time cannot establish production timing compliance.

## 6.2 Initialization and release

Initialization has a barrier with the following phases:

1. Expand the acyclic instance tree, establish effective deployments, create private stores from pure initializers, resolve all routes and install all queues/handlers.
2. Install each stateful function's initial state identity and arm its initialization reaction. It is not yet ready to consume a stimulus. Register all ordinary startup activations.
3. Establish one run epoch `t0`. Release every startup/initialization activation at `t0`; activate periodic releases at `t0 + k * period`, with k starting at 1. All ports may now admit traffic.

The scheduler may interleave startup activations across components and within a component subject to its lock. Messages arriving before a machine finishes initial entry remain in their connector queue; they are not discarded merely because initial entry is pending. Timers start when entry finishes, not when the initialization reaction was released. A startup function may request a service whose component's startup activation has not run: handlers and initialized data already exist. If an application needs an additional readiness protocol, it MUST model that protocol through an interface.

Each startup activation is released exactly once per root run. The core defines no automatic component restart. A deployment implementation restarting a failed component starts a new run epoch for the affected binding and MUST report its reset, queue-retention and correlation policy; it cannot imply uninterrupted E conformance for a reset it has not modeled.

Periodic releases are independent of earlier completions. Serial dispatch does not merge or silently skip them. Manual activations are parameterless local harness releases. Input-triggered work remains in the input queue until dispatch is possible; it is not copied into an unbounded second activation queue. Admission of an RPC response resumes its suspended frame without acquiring another component lock.

## 6.3 Dispatch, backlog and snapshots

A serial activation root acquires its component's lock at dispatch and releases it on completion/failure. Local calls execute on the activation root's stack and inherit its concurrency mode and snapshot, regardless of a helper's own timing declaration. A reentrant activation root may overlap other activation roots, but neither it nor any reachable helper may assign component data. Assigning its own parameters/locals is allowed.

A reentrant activation root captures an atomic value snapshot of all component variables at dispatch, before its first expression. All reads by that activation and its helpers use that snapshot throughout suspension and resumption. An assignment by a serial activation is atomic at the whole-value level; snapshots observe some consistent store between assignments. A machine's next reaction captures a fresh snapshot if it is reentrant. Reentrant does not allow overlapping reactions of the same machine.

Between independent ready queues and lifecycle releases, the scheduler chooses any enabled activation root. For a FIFO queue, dispatch preserves queue order; completion order of reentrant handlers need not match dispatch order. A target backend MUST specify fairness and scheduling policy, and MUST NOT introduce starvation while claiming eventual at-least-once delivery under continuously enabled receivers.

An executable target binding MUST bound pending start/manual/periodic activations separately from connector queues. On exceeding that bound it MUST record `ActivationOverflow` and stop the affected root execution; silently dropping or coalescing releases is not an implementation of this core. A simulator may expose an explicitly unbounded mathematical backlog, but cannot use it as evidence for a bounded production deployment. The binding also bounds simultaneous reentrant activation roots; when full, subsequent work remains pending rather than exceeding the limit.

WCET includes local helpers and active reaction microsteps; request wait consumes deadline budget but no active CPU budget. The activation root's deadline is measured from release. For input reactions release occurs when the message is ready in its destination queue. A timer reaction is released at its due time even if dispatch is later. Local helpers have no independent release; a backend checks their declared execution bounds over the invocation and also includes them in the activation root's bounds.

## 6.4 Queue offers and fanout

`send` and `publish` evaluate all arguments once and snapshot the matching active connector set. They offer a distinct per-connector logical message to **every** connector in that set, even if an earlier offer rejects. Offers are independent and have no specified interconnector order. The statement finishes after all local admission decisions. If any offer rejects, the activation fails with an admission failure; successful offers remain committed. Loss through dropOldest/dropNewest is not rejection and does not fail the sender. Atomic broadcast requires a modeled protocol.

For a given queue, offer and dispatch are atomic decisions. Capacity counts retained messages waiting for dispatch, including ones whose transport availability is pending; it excludes running handlers. Removing an old message or discarding a new one MUST be observable to a checking executor. An optional port with no connectors produces no offers and succeeds for data/events.

| Condition | Data/event emission | RPC request | RPC response |
| --- | --- | --- | --- |
| No live endpoint | optional unbound succeeds; failed bound route reports transport failure | `Unavailable` if unbound; otherwise `Transport` when detected | requester gets `Transport` if detectable, otherwise timeout |
| Full queue with reject | producer activation fails after all fanout offers | caller executes `otherwise` with `Rejected` | requester gets `Rejected` if the binding can report it; otherwise timeout; server's completed effects remain |
| dropOldest/dropNewest | dropped occurrence is observable; statement can succeed | dropped request waits until timeout unless transport reports failure | dropped response leaves request waiting until timeout |
| Age expired | discard before dispatch | no service dispatch; caller eventually times out unless already failed | discard; no successful completion |
| Receiver handler fails | receiver records local failure; sender is not retrospectively failed | correlated `RemoteFailure` | not a second handler; resume request failure path |

Control failures such as admission rejection use the same request route/correlation. They are transport outcomes of that interface exchange, not arbitrary model event channels. A binding unable to signal a failure cannot fabricate a successful result.

An admitted message becomes ready no later than emission plus maxLatency when such a bound is claimed. Deadline miss is a violation even if the message is later delivered; it is not itself a new delivery policy. `maxAge` eligibility is inclusive: age <= maxAge may dispatch; age > maxAge is expired. Discarded/expired messages have no eventual-delivery obligation. Without maxAge, asynchronous messages have no core expiry before connection teardown; a backend must maintain its delivery obligation or explicitly report loss of availability. Retry policy, finite memory and resource exhaustion behavior belong in the target binding, not undocumented defaults.

## 6.5 RPC completion and races

A request correlation has states Pending, Succeeded or Failed. Creation precedes the first request offer. Its expiry is issuance time plus timeout. At most one terminal completion may win. A response can succeed only if it is observed at the requester at a time **strictly earlier** than expiry and the correlation is Pending. At expiry timeout wins ties. Terminal state is immutable; later responses and duplicate replies are discarded and observable.

AtLeastOnce may dispatch multiple handler activations with the same logical request/correlation. Idempotency must cover storage writes and published side effects; returning the same value alone is insufficient. The first eligible response completes the caller. Retrying must never create a new caller-visible correlation or extend its timeout. A binding may deduplicate repeated requests while preserving required behavior.

The mandatory `as name` on a void RPC labels successful completion without introducing an inhabitable value. It reserves that name in the enclosing lexical scope but it MUST NOT be read or assigned as data. A void handler uses bare `return;`. The failure block has an implicit copied `failure: string`; an existing live value with that name is a static error. Failure blocks cannot fall through to the successful continuation.

A timeout does not retract messages already sent or cancel a server frame. Pending requests cannot be used as detached futures; each statement awaits its own outcome. Synchronous dependency cycles remain expressible but may time out. A static validator is not required to prove their absence; an execution/timing claim must account for them.

### Interruption of pending continuations

An accepted region interrupt resumes its existing activation at a statement boundary, retaining the serial lock and activation deadline. Its input is admitted, delayed, ordered, expired or dropped through the same per-route queue rules as other data/events. It is delivered only while its selected region is armed; available input outside that interval is discarded with an undeliverable-interrupt observation. It does not release an independent activation or create an unbounded handler queue.

Cancellation unwinds the protected stack to that region, disarms it, and enters its handler with copied payload bindings and the enclosing lexical environment. If a caller-side request is Pending, cancellation makes it terminal Failed with an Interrupted reason and records requestCancelled. Its success and otherwise continuations are both abandoned. Scheduled resume work for the unwound stack is invalidated. Server execution and committed effects remain unchanged. A later reply observes the terminal correlation and is discarded.

A response or timeout already terminal keeps its original outcome. In particular, expiry still wins the response/timeout tie. A subsequent interrupt may transfer control before the already queued terminal continuation runs; this does not change the recorded correlation outcome. A normally completed interrupt handler continues after the region. An outer interrupt can unwind an inner region or its handler, including a second suspended request. Return/failure still disarms all regions unwound with the frame. The original activation deadline applies through cancellation and handler completion.

A conforming trace identifies region entry/exit, interrupt delivery and cancelled correlations with their source region, activation, member and route identities. Reference simulation uses one-shot region watches and continuation generations to prevent stale scheduling from resuming cancelled frames. Physical cancellation latency remains a target-binding obligation.

## 6.6 State reaction ordering

A machine has one initialization reaction and then a sequence of reactions. Each reaction includes all immediately enabled completion transitions until quiescent/final/failure. Completion selection precedes dispatch of the next external stimulus. If no completion guard holds, the machine becomes quiescent. A write by another function does not itself awaken completion transitions; they are reconsidered after the next machine reaction, including one that consumed an unhandled message or expired a timer with no enabled transition.

On completing a state's entry, create one timer stimulus per distinct `after` duration on its outgoing transitions, tagged with the current state-entry generation. All transitions with that duration compete using guard/priority. Distinct durations produce distinct stimuli. Leaving a state cancels every timer from that generation. A queued timer from an obsolete generation is discarded. Reentering, including a self-transition, creates a new generation. Entry code time is outside the residence timer; the timer measures time since entry completion.

A due timer and a ready input are independent stimuli. Their selection order is unspecified unless the target scheduler constrains it. Transition priority selects among transitions for the **same** stimulus; it is not a task/queue priority. A consumed stimulus is not retained merely because all guards were false. Entry/exit blocks have no event payload scope. Exit and effect run before state identity changes; destination entry follows that change.

The completion microstep counter is zero at the start of a reaction and increases once per taken completion transition. Taking a 1,025th completion transition fails the reaction before executing that transition. External dispatch does not occur between those microsteps. Guards are pure expressions and cannot send, mutate, or consume another message. A guard evaluation failure fails the owning activation.

Final entry completion, bare return or failure terminates the machine, cancels all its timers and disables its dispatch. Future messages to its members become undeliverable occurrences; they are not rerouted to another function. Other functions in the same component may remain alive. No implicit exit behavior runs on return/failure unless it has already been reached in the specified transition phases.

## 6.7 Execution binding contract

Every backend claiming E MUST identify its backend version, supported SWAML version, selected root component, model digest and target configuration. It MUST supply explicit values or a justified symbolic abstraction for:

- effective deployment of every component; clock basis, precision and cross-target clock-error bounds;
- scheduler, fairness, serial locking, snapshot implementation and reentrant limits;
- lifecycle backlog limits and overflow observation;
- transport, serialization, copying/isolation, queue storage and retry/deduplication policy;
- deadline/latency/age measurement points and what happens after a reported violation;
- external adapter behavior and assumptions, startup readiness, shutdown/reset and queue retention;
- resource failure handling, correlation uniqueness, observability and evidence artifacts.

Timing/resource failure policies may stop execution after recording a violation. Continuing is permitted only with the violation visible, and cannot count as a satisfying execution for the violated contract. An execution trace is conforming when all observed steps obey core transitions; satisfying a particular model additionally requires its declared assertions and contracts to hold. A runtime that correctly reports a failed assertion is not thereby a broken interpreter.

Security and target-specific bus/OS policies can strengthen this contract, but cannot add hidden model exchanges. AUTOSAR Classic task/RTE mappings, Adaptive service bindings and broker configurations must preserve the same identities, member directions and copied-value boundaries.

For each mapped function the binding MUST identify its activation source and preserve component-wide serial exclusion or the declared reentrant snapshot semantics. For each mapped interface member it MUST identify the data conversion and transport route, including response correlation where applicable. A platform read/write API, shared-memory optimization or callback must preserve the observable copied-value and queue semantics of the modeled exchange.

For AUTOSAR Classic, the binding MUST state how modeled activations map to runnable events and tasks, and how sampled or queued members map to RTE communication. For Adaptive, it MUST state how the fixed modeled endpoints map to service instances and how discovery, unavailability and application startup affect pending exchanges. For web and cloud targets, it MUST state how requests, notifications, broker acknowledgments, durable state and restarts relate to modeled completion and failure. A transport acknowledgment is not automatically a successful application response, and a connector queue is not automatically durable storage.

Primitive values retain the domains in chapter 1. A binding to fixed-width platform integers, bounded strings, schema fields or wire encodings MUST define conversion limits and observable failure for unsupported values, or provide evidence that the model stays within the supported subset. It MUST NOT silently truncate, wrap, reinterpret or share mutable payloads. Target-specific restrictions and evidence belong with the mapping; accepting a core model does not certify a platform implementation.
