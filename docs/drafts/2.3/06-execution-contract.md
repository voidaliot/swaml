# 6. Reference execution contract: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 6](../../spec/06-execution-contract.md). The profile became `swaml-reference/2.3` when the candidate was allocated (WP1a); the Tier 2 timed profile `swaml-reference-timed/2.4` is not part of 2.3. Every rule below leaves a 2.2 model's run unchanged: gate 2 (WP1a-M02) compares complete traces with the frozen 3.1.0 fixture, ignoring only `profile` and `languageVersion`. New trace information appears only where new syntax is used.

## 6.1 Lifecycle and time

| ID | Rule |
| --- | --- |
| WP4-R02 | Moved to [chapter 6.1](../../spec/06-execution-contract.md#61-lifecycle-and-time) in WP4. |
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
| WP6-R05 | Moved to [chapter 6.4](../../spec/06-execution-contract.md#64-communication) in WP6. |
| WP6-R06 | Moved to [chapter 6.4](../../spec/06-execution-contract.md#64-communication) in WP6. |

## 6.5 Input ownership and interruption

Applied in WP5: the state-machine paragraph is followed by the 2.3 selection rules, which reduce to it for a machine without the 2.3 forms.

| ID | Rule |
| --- | --- |
| WP5-R01 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R13 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R02 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R03 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R04 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R05 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R06 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R07 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R08 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R09 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R10 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R11 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |

## 6.6 Evidence and resources

New and extended observations. Field names follow the existing trace (`timeNs`, `ordinal`, `kind`, `subject`, `source`).

| ID | Observation | Fields and meaning |
| --- | --- | --- |
| WP1-T01 | `write` | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP1. |
| WP4-T01 | `wait`, `receiveWait`, `timer` | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP4. |
| WP5-T01 | `state` (extended) | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP5. |
| WP5-T02 | `discardTimer` (new) | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP5. |
| WP5-T03 | `defer` (new) | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP5. |
| WP5-T04 | `violation` (extended) | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP5. |
| WP6-T01 | Moved to [chapter 6.4](../../spec/06-execution-contract.md#64-communication) in WP6. |
| WP7-T01 | `skip` (new) | A release whose guard was false: `subject` the operation occurrence, `activation`, `source` the schedule entry. |
| WP7-T02 | `discardInput`, `failure` (extended) | A skipped `receive` entry's input is a `discardInput` with `reason: 'releaseGuard'`. A failing release guard is a `failure` with the entry as `source`. |

The `DurationRange` observation rule moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP4. (The `sqrt` and `realText` failures, WP3-R01 and WP3-R02, moved to [chapter 6.3](../../spec/06-execution-contract.md#63-values-flow-and-failure) in WP3.)

## 6.7 Case runs

| ID | Rule |
| --- | --- |
| WP5-R12 | Moved to [chapter 6.7](../../spec/06-execution-contract.md#67-case-runs) in WP5. |
| WP7-R07 | A skipped release is neither a failure nor a completion of the case script. A failing release guard is an uncaught activation failure and fails the case. |
