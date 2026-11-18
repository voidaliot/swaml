# ADR 0025: Release guards, operation placement, tasks and the target binding

Status: accepted for the unreleased standard 2.3, 18 November 2026. Owner approval of the 2.3 scope and decisions D9, D10, D11 and D13 of the [2.3 proposal](../proposals/NEXT_MINOR_PROPOSAL.md). The owner decided the state-machine rule T4. Not implemented: each rule lands with the work package named in the [2.3 chapter drafts](../drafts/2.3/README.md). This ADR is normative where it differs from the proposal. It amends chapter 4.1 of the specification, which leaves core and task allocation to target translation. Published editions remain unchanged. WP7 implements B19 (chapters 3.5, 6.2, 6.6 and 6.7, rules WP7-*); see *Implementation in WP7*.

Items: B19 mode-dependent schedules, B17 operation-level deployment, B18 tasks (Tier 1). Deferred: B18 timed run and B20 latency chains (Tier 2). Work packages: WP7 (B19, after WP4), WP8 (B17, B18, after WP4, WP7 and tool fix A4).

## Context

Showcase evidence at `showcase/all` `cc16c25`:

- **Mode gating inside bodies (B19).** Door `LinMaster` (873–921) and `ComMain.txMainFunction` (799–803) keep a local `sleeping` flag only to return early in every periodic release, so the Timing view shows activations that do nothing.
- **Components split by task (B17).** The door deployment (2786–2815, model documentation 444–455) splits `IoHwAbInput`/`IoHwAbOutput` and `CanInterface`/`ComMain` so that each occurrence's deadline-carrying runnables share one task. Receive entries that only copy a value stand in for RTE buffer updates.
- **Task data as unchecked attributes (B18).** Door 2667–2744 declares a local `OsTask` with `periodUs`, `responseUs`, `priority` and `category`, documented as "the reference run does not schedule by them".

The review (findings 2, 3 and 13) found:
- skipped releases broke the proposal's own `after` chain;
- an armed deadline contradicted the skip;
- one serial lock could span two Cores;
- event entries landed on periodic tasks;
- suspending operations landed on basic tasks;
- in-task order and preemptability were missing;
- without a binding schema, the 2.3 door schedule could not be checked by any 2.3 tool;
- the closing claim of the proposal overstated what 2.3 derives.

## Decision

### Release guards (B19, WP7)

`when (g)` may follow the operation call of an `every`, `receive` or `after` schedule entry, before `deadline`:

```text
on every 20ms slot() when (mode.current != PowerMode.sleep) deadline 2ms;
```

- **Allowed entries (SW2007).** A guard on `start` or `call` entries is an error.
- **Effects (SW2007).** The guard is pure or reads state. Its scope is the component's attributes, its sampled ports (ADR 0024), `now()` and the entry's receive bindings.
- **Evaluation.** At the activation's first execution step, before its dispatch arguments (amended in WP7, see *Implementation in WP7*). It sees the deliveries and sample-cell updates ordered before that step in the instant's event order (ADR 0024). A serial entry evaluates under the serial lock. A concurrent entry reads attributes from its dispatch snapshot and sample cells live.
- **False guard.**
  - No argument is evaluated, no operation runs, and the deadline armed at release is cancelled.
  - The trace records `skip` with the entry as source.
  - The skip counts as a successful whole completion for `after` successors: they are released at the time of the skip and apply their own guards. AUTOSAR mode disabling suppresses one runnable, not its successors.
  - A `receive` entry's input, consumed at release as in 2.2, is discarded with `discardInput` reason `releaseGuard`.
  - The periodic grid stays on the root epoch (D9), and the serial lock is released.
- **Guard failure.** A runtime failure inside the guard is an uncaught failure of that release. The trace records `failure` with the entry as source, or the failing statement of an operation the guard calls, as for the arguments (amended in WP7); the deadline is cancelled, no successor is released and the lock is released. Sampled reads cannot cause it (D7); arithmetic can.
- **Identity.** The guard is not part of entry identity.

### Operation placement (B17, WP8)

A placement may end at an operation: `deploy comMain.storePdu on doorModules[0].core1.isrCan;`. No new syntax is needed; the existing `Path` admits it.

- **Target (SW2009).** The operation is the target of at least one effective schedule entry of that occurrence.
- **Scope.** The placement applies to every activation released by those entries. Callees run in their caller's placement. It overrides any placement of the occurrence or an ancestor. A multiplicity family path applies to every index, and an indexed path overrides it.
- **Effective placement.** Each schedule entry's effective placement is the most specific placement among its operation, its occurrence and that occurrence's ancestors.
- **Same Core (T7, SW2009).** The effective placements of all entries of one component occurrence reach at most one Core. A placement reaches a Core when its target is that Core or lies below it; Tasks without a Core ancestor belong to the implicit Core of their platform root. Placements on Nodes outside any Core, explicit or implicit, do not count. One serial lock therefore never spans Cores until the Tier 2 timed run defines cross-core blocking.
- **Granularity (D13).** Per operation. An operation released both periodically and by an event that needs different Tasks is split with a wrapper operation (`operation pollEvent() { poll(); }`).

### Tasks (B18 Tier 1, WP8)

```text
package Swaml::Os {
  import Swaml::Platform;
  enum TaskKind { basic, extended, isr }
  component def Core specializes Node { }
  component def Task specializes Process {
    const attribute kind: TaskKind = TaskKind.basic;
    const attribute priority: uint = 0;
    const attribute preemptive: bool = true;
    const attribute periodNs: uint = 0 /** 0: event-activated. */;
    const attribute responseNs: uint = 0 /** Response bound of an event-activated task or ISR; 0: none. */;
  }
}
```

**Core grouping.**
- The Tasks of a Core are the Task occurrences whose nearest `Core` ancestor is that Core.
- Tasks with no `Core` ancestor form one implicit Core per platform root, so single-core targets need not declare one.
- An entry is *on* Task K when its effective placement target is K or a Node whose nearest Task ancestor is K.

**Static rules (SW2009).** T1–T6 apply to every deployment whose platform tree contains a `Swaml::Os::Task` occurrence. T7 applies whenever the platform tree contains a `Swaml::Os::Core` or `Task` occurrence. Re-pointing placements from Tasks to Cores or plain Nodes therefore cannot switch the rules off. A 2.2 platform contains neither, so it keeps its 2.2 meaning. T6 reports each unplaced entry with an example `deploy` line for a Task of the platform.

| # | Rule |
| --- | --- |
| T1 | Priorities are unique among the Tasks of one Core (D11). |
| T2 | A Task with `periodNs > 0` receives only `every` entries whose period is a positive multiple of `periodNs`, plus `after` successors of entries on the same Task. Event entries (`receive`, `call`, `start`) go to Tasks with `periodNs = 0`. |
| T3 | An `isr` Task has `periodNs = 0`, is preemptive, and receives only `receive` entries and their `after` successors. |
| T4 | An activation that may suspend is placed only on an `extended` Task. Suspension here means a transitive suspend effect: `wait`, a request, a `receive` statement or suspending callees. A stateful operation may sit on a `basic` Task only if none of its reactions can suspend, counting the entry actions, exit actions, transition effects (including internal and completion effects) and their callees. Otherwise it needs an `extended` Task. The idle wait between reactions does not count: each reaction runs to completion and maps to one activation of a basic task. |
| T5 | If `responseNs > 0`, every entry on the Task that has an explicit deadline has `deadline ≥ responseNs`. |
| T6 | Complete mapping: every schedule entry of the deployed tree is on a Task. |
| T7 | Same Core per component occurrence (above). |

**In-task position.**
- The position of an entry in its Task is the order of the `deploy` statements whose target is that Task or a Node whose nearest Task ancestor is that Task.
- An operation placement contributes the entries of that operation in schedule order.
- An occurrence placement contributes, in schedule order, those entries of the occurrence that no more specific placement claims. Its descendants without their own placement follow depth-first in declaration order, with multiplicity indexes ascending.
- *Schedule order* is the effective schedule order of `semantic.ts` `schedule()`: inherited entries first in their base order, a replacing entry at the position of the entry it replaces, then new entries in authored order.

**Reference run (Tier 1).**
- Releases, dispatches and ready continuations at equal logical time and phase are ordered by:
  1. descending Task priority, with unplaced activations at priority 0;
  2. then activations on a Task before unplaced activations of equal priority;
  3. then, between activations on the same Task, in-task position;
  4. then the existing insertion ordinal.
- A case-script activation is unplaced. A primary-subject call borrowed by a case (ADR 0021) runs within the case's activation and keeps its keys; it does not take the Task of the subject's entries.
- No preemption: on a Core that has Tasks, a dispatched (or resumed) activation runs until it waits or ends before any other activation of that Core is dispatched or continued; the keys decide only which ready activation goes next (WP8-R02, review F1). Different Cores and unplaced activations interleave statement by statement as in 2.2.
- With zero-cost steps, `preemptive`, `kind` and `responseNs` affect only the static rules. Release notes and documentation say so.
- A run without Tasks has all keys equal and keeps its 2.2 order.

### Target binding (B18, WP8)

`spec/binding.schema.json` defines `"schema": "swaml-binding/2.3"`:
- `deployment`: the deployment's qualified identity;
- `costs`: per operation occurrence `wcetNs`, optional `bcetNs ≤ wcetNs` and a `source` reference;
- `budgets`: per Task occurrence, `budgetNs`;
- `crossCoreLatencyNs`: per connection occurrence, `maxNs`.

No other properties are allowed.

**Identities.**
- Paths use the canonical name spelling of the normalized model: software operations as occurrence path plus operation name from the deployed root, and Tasks as platform occurrence paths.
- A connection is identified by the route identity that runs and traces already use, so there is one identity scheme. A component connection is `owner.name`, or `owner.@connectN` when unnamed, where `N` is the zero-based index among all `connect` members of the owner, forwarding included. A package connection is its `name`, or `@packageN` when unnamed, where `N` is the index among the package's connections.

`swaml binding check <binding> <sources…>`:
- validates the file against the schema;
- resolves every identity against the validated model and deployment;
- exits 1 on a schema error, an unresolved identity or `bcetNs > wcetNs`;
- reports every placed operation without a cost as a finding without failing.

It computes no schedule in 2.3.

### Tier 2 (not in 2.3)

- **Timed profile.** `swaml-reference-timed/2.4` uses the binding for fixed-priority scheduling per Core, preemption at statement boundaries, budget and deadline violations and cross-core blocking. Its results are evidence under the stated assumptions.
- **Latency chains (B20).** Deferred. A declarative chain needs causal correlation across sampling activations and an analysis level with stated assumptions. With `now()` (ADR 0022) a test can already assert a bounded latency.

### What 2.3 derives for a door ECU

**Statically checked:**
- the task set per Core: kind, priority, preemptability, and period or response bound;
- runnable-to-task mapping per operation and the position within each task;
- per-entry deadlines consistent with periods and response bounds;
- one Core per component occurrence;
- no event entries on periodic tasks;
- no suspension on basic tasks or ISRs;
- level-triggered mode gating;
- per-member communication policies;
- typed data and behaviour precise enough for a backend to generate code.

**Run:** in logical zero time, with equal-time work ordered by task priority and in-task position. A binding file can be validated against the model.

**Not derived:**
- response times or schedulability;
- WCET;
- cross-core blocking;
- CAN signal packing;
- the OS configuration format;
- memory mapping;
- generated code.

## Implementation in WP7

- **Scope of the guard.** The guard has exactly the scope of the entry's dispatch arguments, which the validator already types: the component's attributes, its sampled ports, `now()` and the entry's receive bindings. A sampled read in a guard is a sampled read of the component (ownership and the mandatory initial value of ADR 0024 apply), and a binding of the same name hides the port, by the validator's scope rules (`localVisible`).
- **Order at dispatch.** The guard is evaluated first, then, only when it is true, the arguments (owner decision E in the WP7 review, replacing the proposal's order). A false guard therefore evaluates no argument: a skipped release never runs an argument helper that writes or communicates, and a guard may protect its own arguments (`use(sum % count) when (count != 0)`). An argument failure keeps its 2.2 meaning and can only follow a true guard. The guard, the arguments and the body read one sampled value (WP6-R03).
- **Observations.** The activation exists from its release: a skipped serial release records `release`, `dispatch`, `unlock`, `skip` (a concurrent one has no `unlock`), and a receive entry adds `discardInput`; no argument or operation observation belongs to it. A skip replaces `complete` and, like it, follows the activation's `unlock`; a skipped receive entry's `discardInput` (reason `releaseGuard`, with `activation` and `message`) directly follows its `skip`. A failing guard's `failure` names the entry as `source` when its own expression fails, and the failing statement when the failure happens inside an operation the guard calls, exactly as for a dispatch argument (owner decision H in the WP7 review, replacing the draft's entry-only source).
- **Diagnostics.** A suspending, remote or unresolved call in a guard is reported by the existing call rules only; the guard rule reports calls that write or communicate. A guard on a `start` or `call` entry is reported once, where it is written, and is not typed.
- **Inherited guards.** Like the arguments, a guard of an inherited entry is typed in every effective structure, so a redefined helper that writes is an error before any run; a guard whose document has syntax errors is typed nowhere until its syntax is fixed: the validation of a document with syntax errors reports only those errors, and a structure in another document that inherits the entry skips the guard, so a valid file that specializes it gets no error for the unfinished guard. An entry with the same trigger and operation in a specialization or usage replaces the inherited entry with its guard (WP7-S03).
- **Independent of state machines.** Release guards apply to schedule entries only. They use none of the WP5 state forms (completion transitions, internal reactions, deferral); a stateful operation has exactly one `on start` entry, which cannot carry a guard.

## Implementation in WP8

- **Plan.** One function, `deploymentPlan` (`src/language/placement.ts`), resolves every deploy statement to an occurrence or operation placement, the platform's `Swaml::Os` Tasks with their Core and constant attributes, and each effective schedule entry's placement, Task, Core and in-task position. The validator, the reference run and the binding check read it, so they cannot disagree. Tasks and Cores are recognised by the built-in declaration (`osRole`); a workspace's own `Swaml::Os` hides the library package and keeps the 2.2 meaning.
- **D01 and compatibility.** WP8-D01 is reported only on a platform that contains a `Swaml::Os` Core or Task; elsewhere a path naming an unreleased operation keeps the 2.2 message `Unknown software occurrence {path}.` (owner decision A in the release draft). A path to a released operation, an error in 2.2, is valid, as decided above.
- **T4.** Decided on the property "the activation can wait apart from the idle selection of a machine" (decision C): no other WP5 form is used.
- **Ordering.** Releases, deliveries that release entries, dispatch steps and ready continuations carry the key of their activation; equal-priority Tasks on different Cores are ordered by their declaration rank, so the order is total (decision B). A run without Tasks carries no key and keeps its 2.2 order; gate 2 and the nine extended 2.2 sets confirm it.
- **No preemption (review F1).** The first WP8 commit let a higher-priority activation released at an instant run between two statements of a lower-priority one of the same Core, which contradicted WP8-R02 and made `preemptive = false` meaningless to a designer. Each Core now has one running activation, from its dispatch or resumption to its next wait or end; the scan for the next one visits activations in key order, kept sorted on release instead of sorted at every step. The reviewer's model (`L` publishes to `H` and then to `C` at 10 ms) logs 32 on Tasks of one Core as on plain Nodes, and 23 when `H` and `C` run on another Core.
- **Task rules per Core (review F2, F3, F4).** T6 applies to the entries of occurrences deployed in a Core that has Tasks; software on a plain Node outside every Core keeps the 2.2 meaning, so a platform mixes OS Cores with plain Nodes as the door showcase does. The D07 example names a Task of the occurrence's own Core that accepts the entry under T2 to T4. A platform root that is a Task is WP8-D13. An `after` successor runs on its predecessor's Task on every Task kind (OSEK chaining). An operation placement on a platform without a Task is the warning SW2021 (WP8-D12).
- **Plan cost (review F5).** The plan indexes placements by path and walks each occurrence's ancestors once, so it is linear in occurrences, entries and placements; on a platform without `Swaml::Os` the validator reads only the placement kinds and the entries are never computed.
- **Binding.** `spec/binding.schema.json` and the checker's `BINDING_SHAPE` are kept equal by a unit test; no schema library is added. Findings are `error|finding {pointer} {identity}: {reason}.`; exit codes 0, 1 and 2 as in the release draft.
- **Proof.** Example 52 is the door deployment: ComMain's main functions on the 20 ms task of core 1 and its receive entries on the CAN interrupt and an event task of the same Core, rxMainFunction first by deploy order, a higher-priority 10 ms supervision and NvM on the extended background task. Its cases fail when the deploy order or the priorities are swapped, and the obvious misplacements (a receive entry on the 20 ms task, NvM on a basic task, ComMain across Cores, equal priorities, a deadline below a response bound) are rejected.
- **Open.** The General view does not yet draw operation placements: the language projection has no deployment projection, and the drawing belongs to the consuming tools (WP8-M04, second sentence).

## Alternatives rejected

- **"A skip releases nothing"** (proposal revision 1). The door rewrite would stop `txMainFunction` in `startup` and `postRun`, where it transmits today, and AUTOSAR suppresses one runnable, not its successors (finding 2).
- **Restarting the periodic phase on guard change (D9 alternative).** The grid would depend on mode history, and a declared period would no longer be exact.
- **Everything in source or everything in the binding (D10 alternatives).** Costs are measured or analysed per target and change without a model change, so they belong in the binding. Task kind, priority, preemptability, period and response bound are design decisions and belong in reviewed source (finding 3e).
- **Equal priorities with FIFO order (D11 alternative).** The order would depend on release history, and AUTOSAR OS configurations commonly avoid it.
- **Per-entry placement (D13 alternative).** It needs entry names, which do not exist. Wrapper operations cover the showcase.
- **Cross-core operations of one component.** This is cross-core blocking under one serial lock, with no defined semantics before Tier 2 (finding 3a).
- **Releasing event entries at the next grid point of a periodic task.** It hides queueing delay in the release semantics; T2 makes the mapping explicit instead (finding 3b).
- **State machines on extended tasks only.** Rejected by the owner's decision: a machine whose reactions never suspend runs each reaction to completion like a basic-task runnable. A machine with a suspending reaction (door `ModeManager`, whose entry action requests `nvm.writeAll()`) needs an extended task under T4.
- **Activating the T rules only when something is placed on a Task** (first WP0 draft). Re-pointing every placement to a Core silently switched off T1–T6 (WP0 review finding 3).
- **Separate binding identities for connections** (first WP0 draft, `owner@connectN` counting connections only). They disagreed with trace route identities whenever a forwarding connect precedes (WP0 review finding 4).
- **Leaving the in-task order to insertion order.** A generator must still decide it (finding 3d). Deploy order expresses it with existing syntax.

## Consequences

- **Grammar.** `ScheduleEntry` gains `when (g)` (WP7). Placement needs no grammar change.
- **Library.** `Swaml::Os` (WP8). The door model's `OsTask` is replaced by `Task`; `taskBackground` becomes `kind = TaskKind.extended`.
- **Validator.**
  - SW2007 for release guards;
  - SW2009 for operation placement, T1–T7 and the in-task position computation.
- **Simulator.**
  - Release guards: `skip`, deadline cancellation, skip as completion, `releaseGuard` discard and guard failure.
  - Ordering keys for priority and position.
  - Per-model simulation options (tool fix A4) for the door's 1 ms task.
- **CLI.** The `swaml binding check` command and the binding schema with tests.
- **Projection.** Timing gains Task lanes, guarded entries and skip markers. The General view shows operation placements.
- **Consuming tools.** Tools must accept release guards and `skip` evidence, operation placements and Task lanes.

## Compatibility

Release guards are new syntax. An operation placement path was a SW2009 error in 2.2 and is now valid; every valid 2.2 placement keeps its meaning. `Swaml::Os` is a new package; no 2.2 source imports it. The T rules apply only to platforms that contain a `Swaml::Os` Task or Core, and the ordering keys are equal without Tasks, so every 2.2 run keeps its trace (gate 2). Release gates: corpus AST identity, unchanged simulation results and a warning-free grammar (ADR 0022).

## Open items

- The Tier 2 timed profile and its binding use: preemption points, budget enforcement and cross-core blocking.
- Whether `responseNs` should constrain entries without an explicit deadline is left to the timed profile. T5 checks explicit deadlines only.
- WP8 fixes the schema's JSON Pointer–based finding format and the exact CLI output. The binding remains outside source validation (no SW code).
