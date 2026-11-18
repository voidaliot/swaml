# 4. Deployment, cases, views and conformance: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 4](../../spec/04-systems-and-conformance.md). Examples are `text` fences until their work package lands. Decisions: [ADR 0024](../../decisions/0024-communication-and-package-links.md) for association lists and [ADR 0025](../../decisions/0025-real-time-placement-and-binding.md) for deployment.

## 4.1 Deployment

The sentence "Buses, hardware timing, core/task allocation and operating-system scheduling are target-translation concerns." becomes "Buses, hardware timing and operating-system scheduling are target-translation concerns. Core and task allocation may be declared with `Swaml::Os` (below); its costs belong to a target binding."

```text
import Swaml::Os;
component def SafetyCore specializes Core {
  component isrAdc: Task {
    redefines const attribute kind: TaskKind = TaskKind.isr;
    redefines const attribute responseNs: uint = 500us;
    redefines const attribute priority: uint = 60;
  }
  component task20ms: Task {
    redefines const attribute periodNs: uint = 20ms;
    redefines const attribute priority: uint = 30;
  }
}
deployment 'Front left door' of dcu on vehicle {
  deploy comMain on doorModules[0].core1.task20ms;
  deploy comMain.storePdu on doorModules[0].core1.isrCan;
  deploy comMain.onMode on doorModules[0].core1.taskEventLow;
}
```

| ID | Rule |
| --- | --- |
| WP8-S01 | **Operation placement.** A placement path may end at an operation of the addressed occurrence that is the target of at least one effective schedule entry of that occurrence; otherwise SW2009. It applies to every activation released by those entries. Callees run in their caller's placement. |
| WP8-S02 | **Specificity.** Each schedule entry's effective placement is the most specific placement among its operation, its occurrence and that occurrence's ancestors. An operation placement overrides any occurrence placement. A multiplicity family path applies to every index, and an indexed path overrides it. Exact paths, including operation paths, are unique within one deployment (SW2009). |
| WP8-S03 | **Core grouping.** The Tasks of a Core are the `Swaml::Os::Task` occurrences whose nearest `Swaml::Os::Core` ancestor is that Core. Tasks without a Core ancestor form one implicit Core per platform root. An entry is on Task K when its effective placement target is K or a Node whose nearest Task ancestor is K. |
| WP8-S04 | **Activation.** T1–T6 apply to every deployment whose platform tree contains a `Swaml::Os::Task` occurrence, wherever its placements point. T7 applies whenever the platform tree contains a `Swaml::Os::Core` or `Swaml::Os::Task` occurrence. A platform with neither keeps its 2.2 meaning. |
| WP8-S05 | **T1.** Priorities are unique among the Tasks of one Core (SW2009). |
| WP8-S06 | **T2.** A Task with `periodNs > 0` receives only `every` entries whose evaluated period is a positive multiple of `periodNs`, plus `after` successors of entries on the same Task. `receive`, `call` and `start` entries go to Tasks with `periodNs = 0` (SW2009). |
| WP8-S07 | **T3.** A Task of kind `isr` has `periodNs = 0` and `preemptive = true`, and receives only `receive` entries and their `after` successors (SW2009). |
| WP8-S08 | **T4.** An activation that may suspend (a transitive suspend effect: `wait`, a request, a `receive` statement or a suspending callee) is placed only on a Task of kind `extended`. A stateful operation may be placed on a `basic` Task only if none of its reactions can suspend, counting its entry actions, exit actions, transition effects (including internal and completion effects) and their callees. The idle wait between reactions does not count. Otherwise it needs an `extended` Task (SW2009). |
| WP8-S09 | **T5.** If a Task has `responseNs > 0`, every entry on it that has an explicit deadline has `deadline ≥ responseNs` (SW2009). |
| WP8-S10 | **T6 and T7.** T6: every schedule entry of the deployed tree is on a Task. T7: the effective placements of all entries of one component occurrence reach at most one Core, explicit or implicit. A placement reaches a Core when its target is the Core or lies below it. Placements on Nodes outside any Core do not count. Both are SW2009. |
| WP8-M01 | **In-task position.** An entry's position in its Task is the order of the `deploy` statements whose target is that Task or a Node whose nearest Task ancestor is that Task. An operation placement contributes the entries of that operation in schedule order. An occurrence placement contributes, in schedule order, those entries of the occurrence that no more specific placement claims. Its descendants without their own placement follow depth-first in declaration order, multiplicity indexes ascending. *Schedule order* is the effective order of `semantic.ts` `schedule()`: inherited entries in their base order, a replacing entry at the position of the entry it replaces, then new entries in authored order. |
| WP8-M02 | **Target binding.** `spec/binding.schema.json` defines schema `swaml-binding/2.3` with `deployment`, `costs` (`operation`, `wcetNs`, optional `bcetNs`, `source`), `budgets` (`task`, `budgetNs`) and `crossCoreLatencyNs` (`connection`, `maxNs`), and no other properties. Software operations are named by occurrence path plus operation name from the deployed root, and Tasks by platform occurrence path. Connections use the route identities of runs and traces: `owner.name`, or `owner.@connectN` for an unnamed component connection, where `N` counts every `connect` member of the owner including forwarding. A package connection is `name`, or `@packageN` when unnamed. Names use canonical spelling. |
| WP8-M03 | **`swaml binding check`.** `swaml binding check <binding> <sources…>` validates the file against the schema and resolves every identity against the validated model and the named deployment. It exits 1 on a schema error, an unresolved identity or `bcetNs > wcetNs`. It reports every placed operation without a cost as a finding without failing. It computes no schedule. |

The tables of `Swaml::Os` (WP8-L01) are in chapter 1.5. The run-order rule is in chapter 6.1 (WP8-R01).

## 4.2 Requirements, cases and package links

| ID | Rule |
| --- | --- |
| WP2-S06 | Moved to [chapter 4.2](../../spec/04-systems-and-conformance.md#42-requirements-cases-and-package-links) in WP2. |

## 4.3 Views

| ID | Rule |
| --- | --- |
| WP4-M03 | **Timing per occurrence.** Timing projects computed periods and deadlines per occurrence with `constantValue`. A definition-level selection shows the expression text. |
| WP5-M01 | **Flow.** Flow shows completion transitions as edges labelled with their guard, internal transitions as reactions of their state without a target edge, and deferrals as state annotations. |
| WP7-M01 | **Timing guards.** Timing shows release guards on their entries; observed mode marks `skip` observations. |
| WP8-M04 | **Task lanes.** Timing groups activations in Task lanes when a deployment places them on Tasks. The General view shows operation placements. |
| WP6-M01 | **Interconnect.** Interconnect labels member policies on their connection. |

## 4.4 Validation groups

The table keeps every existing code and adds three warnings:

| Code | Static group |
| --- | --- |
| SW2016 | Computed duration without a time unit (warning) |
| SW2017 | Completion guard that cannot change while the machine waits (warning) |
| SW2018 | Deferred member whose effective policy rejects on overflow (warning) |

Diagnostics added or extended by 2.3. Message shapes are templates in the existing style: a sentence with the offending names, ending with a period. Implementations may add context but keep the leading clause stable. All are errors unless marked as warnings.

| ID | Code | Condition | Message shape |
| --- | --- | --- | --- |
| WP1-D01 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D02 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D03 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D04 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D05 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D06 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D07 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP2-D01 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP2. | |
| WP2-D02 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP2. | |
| WP2-D03 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP2. | |
| WP2-D04 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP2. | |
| WP2-D05 | — | Added and moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP2 (review of the conditional's parser limits). | |
| WP3-D01 | SW2006 | `now()` in an initializer (WP3-S01) | The existing purity message, naming `now()`: `Initializer of {attribute} must be pure; now() reads state.` |
| WP4-D01 | SW2013 | Policy setting value (WP4-S02) | `{setting} must be a duration literal such as 1s.` / `{setting} is not a duration setting.` |
| WP4-D02 | SW2002 | Non-integral computed duration (WP4-S01, WP4-S03, WP4-S04, WP4-S08) | `A duration must be integral, found {type}.` |
| WP4-D03 | SW2007 | Outside the constant sublanguage (WP4-S05) | `{expression} is not a constant duration: {calls \| mutable state \| sampled reads \| now()} are not allowed.` |
| WP4-D04 | SW2013 | Per-occurrence value (WP4-S06) | `{period \| deadline} of {entry} is {value} ns in {occurrence}; it must be a positive representable duration.` |
| WP4-D05 | SW2007 | Deadline above period per occurrence (WP4-S06) | The existing deadline-above-period message, with the occurrence named. |
| WP4-D06 | SW2016, warning | A computed duration expression that contains no duration literal, no `now()` call and no reference to a const attribute whose effective initializer, followed through const references, contains a duration literal or `now()` | `{expression} has no time unit and counts nanoseconds; multiply by a unit such as 1ms.` |
| WP4-D07 | SW2013 | Non-exact or zero-divisor `/` in a constant duration, per occurrence (WP4-S05) | `{expression} divides {a} by {b} in {occurrence}, which is not an exact integral division.` |
| WP5-D01 | SW2008 | Completion transition without target (WP5-S02) | `A completion transition needs a target state.` |
| WP5-D02 | SW2008 | Completion guard calls `now()` or has a wrong effect (WP5-S03) | `A completion guard cannot call now(); it is not re-evaluated as time passes.` / the existing guard-effect message |
| WP5-D03 | SW2008 | `when (true)` cycle (WP5-S04) | `States {A} → {B} → {A} form a cycle of when (true) completion transitions.` |
| WP5-D04 | SW2008 | Transition or deferral in a final state (WP5-S02, WP5-S07, WP5-S08) | `Final state {state} cannot have transitions or deferrals.` |
| WP5-D05 | SW2008 | Deferred member not handled by any state, or not owned by this machine (WP5-S08, WP5-S09) | `{member} is deferred, but no state of {operation} handles it.` / `{member} is not an input of {operation}.` |
| WP5-D06 | SW2008 | Defer and handle in one state, or deferred twice (WP5-S08) | `State {state} defers {member} and also handles it.` / `State {state} defers {member} twice.` |
| WP5-D07 | SW2008 | Timer guard effect (WP5-S06) | The existing guard-effect message. |
| WP5-D08 | SW2017, warning | Completion guard that reads nothing written by the machine's entry actions, exit actions or effects or their callees | `Completion guard of {state} reads nothing that {operation} writes; it cannot change while the machine waits.` |
| WP5-D09 | SW2018, warning | Deferred member with an effective `reject` overflow on a route into this occurrence | `{member} is deferred in {state}, but policy {policy} of {connection} rejects on overflow; a full queue fails the sender.` |
| WP6-D01 | SW2005 | Sampling a forwarded boundary (WP6-S08) | `{port}.{member} cannot be sampled: {port} is a forwarded boundary.` |
| WP6-D02 | SW2004 | Sampled member without initial value (WP6-S03) | `Sampled attribute {member} of {portDefinition} needs an initial value.` |
| WP6-D03 | SW2005 | Ownership of sampled and unsampled members (WP6-S04) | The existing owner messages; a sampled member with no owner is not reported. |
| WP6-D04 | SW2002, SW2006 | Initial value typing and purity (WP6-S02) | The existing initializer messages. |
| WP6-D05 | SW2006 | `p.m` not an owned port's required attribute, or in a forbidden position (WP6-S01, WP6-S08) | `{port}.{member} is not a required attribute of an owned port.` / `A sampled read is not allowed in {an initializer \| a constant duration}.` |
| WP6-D06 | SW2004 | Member policy on forwarding, unknown member or repeated member (WP6-S05) | `Member policies are not allowed on forwarding {connection}.` / `{member} is not a member of both ports of {connection}.` / `{member} has two policies in {connection}.` |
| WP6-D07 | SW2013 | Member policy completeness or idempotency per member route (WP6-S07) | The existing policy messages, naming the member. |
| WP6-D08 | SW2010 | Sampled read in a case script (WP6-S09) | `A case script cannot sample {port}.{member}; use on receive.` |
| WP7-D01 | SW2007 | Release guard on a `start` or `call` entry (WP7-S01) | `A release guard is allowed only on every, receive and after entries.` |
| WP7-D02 | SW2007 | Release guard type, effect or scope (WP7-S02) | `Release guard must be bool, found {type}.` / `Release guard must be pure or read state.` / an unresolved-name message for names outside the scope |
| WP8-D01 | SW2009 | Operation placement target (WP8-S01) | `{path} names operation {operation}, which no schedule entry of {occurrence} releases.` |
| WP8-D02 | SW2009 | T1 | `Tasks {task1} and {task2} of {core} share priority {priority}.` |
| WP8-D03 | SW2009 | T2 | `{entry} cannot run on periodic task {task}: {its period {p} is not a multiple of {periodNs} \| event entries need a task with periodNs = 0 \| its predecessor runs on {otherTask}}.` |
| WP8-D04 | SW2009 | T3 | `ISR task {task} {must have periodNs = 0 \| must be preemptive \| accepts only receive entries and their after successors}.` |
| WP8-D05 | SW2009 | T4 | `{entry} may suspend in {statement} and needs an extended task; {task} is {basic \| isr}.` |
| WP8-D06 | SW2009 | T5 | `Deadline {d} of {entry} is shorter than the response bound {r} of {task}.` |
| WP8-D07 | SW2009 | T6 | `{entry} of {occurrence} is not placed on a task of {platform}; place {operation} or {occurrence} on a task, for example: deploy {occurrencePath}.{operation} on {taskPath};` (the example names the nearest Task that already hosts an entry of the occurrence, or the first Task of the platform). |
| WP8-D08 | SW2009 | T7 | `{occurrence} runs on {core1} and {core2}; all its operations must run on one core.` |
| WP8-D09 | SW2009 | Duplicate exact operation path (WP8-S02) | The existing `Duplicate exact deployment path.` |
| WP8-D10 | — (CLI) | `swaml binding check` findings (WP8-M03) | One line per finding with the JSON Pointer of the offending value, the identity and the reason; missing costs are marked as findings, not errors. |

## 4.5 Evidence boundaries

| ID | Rule |
| --- | --- |
| WP8-M05 | A binding check is static resolution of target assumptions. It is neither an analysis claim (A) nor schedulability evidence. The Tier 2 timed profile `swaml-reference-timed/2.4` is where costs first influence a run. |
