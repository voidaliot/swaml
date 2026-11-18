# 6. Reference execution contract: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 6](../../spec/06-execution-contract.md). The profile became `swaml-reference/2.3` when the candidate was allocated (WP1a); the Tier 2 timed profile `swaml-reference-timed/2.4` is not part of 2.3. Every rule below leaves a 2.2 model's run unchanged: gate 2 (WP1a-M02) compares complete traces with the frozen 3.1.0 fixture, ignoring only `profile` and `languageVersion`. New trace information appears only where new syntax is used.

## 6.1 Lifecycle and time

| ID | Rule |
| --- | --- |
| WP4-R02 | **Computed durations.** A computed `wait` or receive timeout is evaluated when the statement starts waiting. A computed state timer is evaluated when the entry actions finish, and its expiry is the state-update time plus the value. Periods and deadlines use the per-occurrence constant values (WP4-S06). A non-positive or unrepresentable value is `DurationRange` (WP4-R01). An expiry outside the clock range stays the `ClockRange` violation. |
| WP8-R01 | **Ordering keys.** Releases, dispatches and ready continuations at equal logical time and phase are ordered by descending Task priority (unplaced activations at priority 0), then activations on a Task before unplaced activations of equal priority, then, between activations on the same Task, by in-task position (WP8-M01), then by the existing insertion ordinal. A case-script activation is unplaced. A primary-subject call borrowed by a case (ADR 0021) runs within the case activation and keeps its keys; it does not take the Task of the subject's entries. A run without Tasks has equal keys and keeps its 2.2 order. |
| WP8-R02 | **Zero cost.** With zero-cost steps, `preemptive`, `kind` and `responseNs` have no runtime effect beyond the static rules. A run records the applied deployment as before. |

## 6.2 Lock and snapshot

Release guards (new paragraph after the `after` paragraph):

| ID | Rule |
| --- | --- |
| WP7-R01 | **Evaluation.** A release guard is evaluated at the activation's first execution step, together with its dispatch arguments. It sees every sample-cell update ordered before that step in the instant's event order (time, phase, insertion ordinal; WP6-R02), and none ordered after it. Serial entries evaluate under the serial lock. Concurrent entries read attributes from their dispatch snapshot and sample cells and `now()` live (WP6-R07). |
| WP7-R02 | **False guard.** No operation runs, and the deadline armed at release is cancelled. The serial lock is released. |
| WP7-R03 | **Skip as completion.** A skip counts as a successful whole completion for `after` successors: each successor is released at the time of the skip and applies its own guard. |
| WP7-R04 | **Receive entries.** A `receive` entry consumes its input at release, as in 2.2. When its guard is false, that input is discarded. |
| WP7-R05 | **Grid.** Periodic releases stay on the root-epoch grid `kD` whatever the guard results (D9). |
| WP7-R06 | **Guard failure.** A runtime failure inside a release guard is an uncaught failure of that release: the deadline is cancelled, no successor is released and the lock is released. |

## 6.3 Values, flow and failure

| ID | Rule |
| --- | --- |
| WP1-R04 | Moved to [chapter 6.3](../../spec/06-execution-contract.md#63-values-flow-and-failure) in WP1. |
| WP2-R01 | Moved to [chapter 6.3](../../spec/06-execution-contract.md#63-values-flow-and-failure) in WP2. |

## 6.4 Communication

| ID | Rule |
| --- | --- |
| WP6-R05 | **Per-member policy.** Each member route uses its effective policy (member policy, else connection policy, else `Default`) for capacity, overflow, ordering, delivery, request timeout, latency and age. Queues remain per connection occurrence, direction and member. |
| WP6-R06 | **Sample cells.** Sample cells follow WP6-R01 to WP6-R04. Updating a cell never consumes input and never releases work. A cell update is part of its delivery event and takes its place in the instant's event order like every other event. |

## 6.5 Input ownership and interruption

The state-machine paragraph is replaced by the rules below.

| ID | Rule |
| --- | --- |
| WP5-R01 | **Selection order.** After the entry actions of a state finish, the machine selects in this total order: (1) the first enabled completion transition in declaration order, taken at once (exit, effect, state update, entry); (2) the earliest elapsed timer, declaration order on equal expiry; (3) retained input in global offer-ordinal order (WP5-R09); (4) other queued input in the 2.2 order. If nothing is selectable, it waits without the lock. |
| WP5-R13 | **Input during a chain.** Input queued while entry actions run, or during a chain of completion reactions, is selected in whatever state the chain reaches. If that state neither handles nor defers it, it is discarded there (`inactiveOwner`). |
| WP5-R02 | **After internal reactions.** The same completion evaluation follows every internal reaction. |
| WP5-R03 | **No completion after discards.** Completion is not evaluated after `discardInput` or `discardTimer`. |
| WP5-R04 | **Guarded timers.** When a guarded timer is selected, its guard is evaluated. If the guard is false, the timer is consumed for this state entry (`discardTimer`) and the next timer with the same expiry is tried in declaration order. Later timers stay armed. |
| WP5-R05 | **Internal reactions.** An internal transition runs only its effect: no exit, no entry, no state update. The state's timers keep their epoch and generation. An internal timer fires at most once per state entry. Its reaction leaves the other timers armed; an already elapsed one, including one with the same expiry, is selected after the completion evaluation that follows the reaction. |
| WP5-R06 | **Suspended effects.** If an entry action or an internal effect suspends, the timers keep their epoch. On resumption, the machine evaluates completion, then elapsed timers, then input, as after entry actions. |
| WP5-R07 | **`CompletionLoop`.** A completion chain starts when the stateful activation starts. It restarts at every consumption of input or a timer and at every suspension of an entry action, exit action or effect. A completion reaction that enters a state already entered in the current chain is the contract violation `CompletionLoop`. It stops the run and bypasses `try`. A retry state whose entry suspends on a request and re-enters through completion is therefore allowed. A counting loop through completion transitions that never suspends is rejected even when bounded. |
| WP5-R08 | **Retention.** While the current state defers member `m`, input for `m` stays in its connection queue, and capacity, overflow, ordering and `maxAge` apply to it observably. A retained attribute keeps only its latest value. |
| WP5-R09 | **Retained order.** In a state that handles retained members, retained input precedes other queued input but follows completion transitions and elapsed timers (WP5-R01). It is consumed in global offer-ordinal order across all of the machine's queues. Input that was never retained follows in the 2.2 order. |
| WP5-R10 | **Retained discard.** On entering a state that neither handles nor defers `m`, retained input for `m` is discarded at the next wait with reason `inactiveOwner`. |
| WP5-R11 | **2.2 machines.** A machine without completion transitions, internal transitions, timer guards and deferrals selects and orders exactly as in 2.2. |

## 6.6 Evidence and resources

New and extended observations. Field names follow the existing trace (`timeNs`, `ordinal`, `kind`, `subject`, `source`).

| ID | Observation | Fields and meaning |
| --- | --- | --- |
| WP1-T01 | `write` | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP1. |
| WP4-T01 | `wait`, `receiveWait` (extended, computed forms only); `timer` (new) | A wait or receive timeout whose duration is computed adds the optional field `durationNs` with the evaluated value. A computed state timer is evaluated when the entry actions finish, after the `state` observation of that entry, so it gets a new `timer` observation at that moment: `subject` the machine, `state`, `source` the timer transition, `timerNs` the evaluated value and `expiresNs` the expiry time. Literal waits and literal state timers produce no new field and no `timer` observation, so 2.2 traces stay identical. |
| WP5-T01 | `state` (extended) | An internal reaction is a `state` observation with `internal: true`, the unchanged `state` and the transition as `source`. |
| WP5-T02 | `discardTimer` (new) | A timer consumed because its guard was false: `subject` the machine, `state`, `source` the timer transition, `reason: 'guard'`. |
| WP5-T03 | `defer` (new) | Exactly one per retained message, the first time the machine waits in a deferring state while the message is deliverable: `subject` the machine, `state`, `member`, `source` the message origin, and the message or correlation identity. |
| WP5-T04 | `violation` (extended) | `code: 'CompletionLoop'` with the machine as `subject` and the completion transition as `source`. |
| WP6-T01 | `sample` (new) | A cell update: `subject` the port occurrence and member, `targetPort`, `member`, the copied `value`, the message identity and `source` the emitting statement. `deliver` keeps meaning consumption by an owner, so a member that is both sampled and consumed produces one `sample` and one `deliver`. Reads are not observed. |
| WP7-T01 | `skip` (new) | A release whose guard was false: `subject` the operation occurrence, `activation`, `source` the schedule entry. |
| WP7-T02 | `discardInput`, `failure` (extended) | A skipped `receive` entry's input is a `discardInput` with `reason: 'releaseGuard'`. A failing release guard is a `failure` with the entry as `source`. |

`DurationRange` (WP4-R01) is recorded like every runtime failure. A caught one is a `caught` observation. (The `sqrt` and `realText` failures, WP3-R01 and WP3-R02, moved to [chapter 6.3](../../spec/06-execution-contract.md#63-values-flow-and-failure) in WP3.)

## 6.7 Case runs

| ID | Rule |
| --- | --- |
| WP5-R12 | A `CompletionLoop` violation fails a case: it is a contract violation in trace order, like the existing ones, and never an inconclusive step-limit stop. |
| WP7-R07 | A skipped release is neither a failure nor a completion of the case script. A failing release guard is an uncaught activation failure and fails the case. |
