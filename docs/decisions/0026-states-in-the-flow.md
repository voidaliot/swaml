# ADR 0026: States in the flow

Status: accepted for standard 3.0, 19 November 2026. Supersedes [ADR 0023](0023-state-reactions.md) (state reactions, never released) and replaces the state machines of 2.2. The normative rules are chapter [3.6](../spec/03-behavior.md) (text and static rules), [4](../spec/04-systems-and-conformance.md) (diagnostics, placement on tasks) and [6.5](../spec/06-execution-contract.md) (execution); the migration is [MIGRATION_3_0.md](../MIGRATION_3_0.md).

## Context

A 2.2 state machine was a separate sublanguage inside an operation: `initial S;`, `state S { … }`, `final state`, ordered transitions `on receive p.m(x) when (g) to T { … }` and `after D when (g) to T { … }`. The showcase models needed a second component to decide on a value the machine had just computed, could not write a check that is repeated while a state waits, and repeated every stop line in every movement state. The first design for the next edition (ADR 0023: completion transitions, guarded timers, internal transitions, `defer`) added more forms to that sublanguage. The owner rejected that direction: one set of words for conditions, a state is a step of the flow, the minimum set of keywords. Because the change removes syntax, the edition is a major one: 3.0.

## Decision

1. **A state is an ordinary statement of a flow**, `state s { … }`, of an operation released `on start` (a waiting machine) or `on every P` (a periodic machine, with or without a release guard and deadline). There is no `states {}` block, no `initial` and no `final`: the flow reaches its first state like any statement, and the end of the flow (or `return`) is the end of the machine.
2. **`if` is the only word for a condition**, everywhere: statements, `else if`, the whole-expression conditional, release guards (`on every 20ms slot() if (ready) …`). `when` is no keyword of 3.0.
3. **`if` never waits; the state waits.** A state holds `on entry`, `on exit`, event lines (`on receive p.m(x) { … }`, `after D { … }`), ordinary statements and, last, inner states. It looks at what is inside its braces again each time something happens to it: arrival, a message it or a parent names, its or a parent's timer, a write by another activation or a sample update of a value its statements read, one of its own lines writing a value an earlier statement of the same look read, and in a periodic machine each release. A look reads values as they are when it runs and ends at the first leave.
4. **Two leaves, the only short bodies.** `exit;` leaves and goes on with what is written next; `to S;` goes to state `S`, also into a state inside a parent. Only these may drop their braces (`after 250ms exit;`, `if (done) to idle;`). A leave written on a parent leaves everything inside it.
5. **Unhandled input is dropped while a state waits; remembering is a variable.** There is no `defer`, `keep` or `ignore`. A message is taken when a line on its member runs for it; a look that leaves before that line leaves it queued for the state reached.
6. **Periodic machines use the schedule**, not a new keyword: an operation with states released `on every P` keeps its place, locals and timers across releases, looks once per release, holds a state reached twice in one release, and starts again from the top after reaching its end.
7. **Minimum keywords, no pointless warnings.** States in the flow add no keyword: they reuse `state`, `on entry`, `on exit`, `exit`, `to`, `on receive` and `after` of 2.2 in new positions (`state` and `to` remain usable as names), and `initial`, `final` and `when` became basic names. Plain statements in a state run at every look without a warning.
8. **Migration, not compatibility parsing.** A 2.2 source with a machine is a syntax error with one SW2000 message that names `swaml migrate`, which rewrites the machine mechanically (one line per member, transitions as an `if`/`else if` chain, `exit;` for the next state, never-taken transitions removed) and validates the result as a workspace.

## What was cut, and why

- **WP5 forms** (completion transitions `when (g) to S`, guarded timers, internal transitions without `to`, `defer p.m;`, `CompletionLoop`, SW2017, the deferral meaning of SW2018, the observations `defer` and `discardTimer`): an `if` in a state's braces, a line that does not leave and a variable express each of them.
- **`StateLoop`** (a violation for a loop of leaves without time passing): it also stopped loops that would end. Such a loop now ends at the step limit, whose `StepLimit` report names the instant and the activations that ran.
- **SIF-D05** (states that leave each other at once): it rejected valid models.
- **SIF-D06 and the periodic backlog** (a warning on a member taken one per release, and a queue of releases a busy machine missed): the warning fired on the natural form, and the backlog was unreachable because a deadline at most the period stops the run first.
- **The zero-time wait** of a state that begins to wait: replaced by looking at queued input at the next scheduling point, in activation order, as 2.2 did (review finding C-1).

## Accepted differences from 2.2

Gate B migrates every recorded 2.2 run and case with a machine, runs it and compares it with its 3.1.0 result: 113 of 114 results are identical; the remaining one is r10. Both accepted differences are pinned by models in `test/fixtures/compatibility-2-2/accepted/` (gate C), and the release notes repeat them.

- **r10, delivery order.** Owned input queued for a waiting state is looked at in delivery order; 2.2 walked the queues in the order they were created, which also decided which unnamed input was dropped. Measured with a generator of 2.2 machines: 41 of 194 valid generated machines without `if` differ (12 in the final store), 19 of 151 and 39 of 152 with a helper activation; with 2.2's queue order emulated, none.
- **C-3, an `if` test is no scheduling step.** An `if` in a migrated transition block or copied exit action is evaluated within the look (SIF-R12). Relative to 2.2 with its queue order emulated (so that only C-3 remains), of 794 valid generated machines 2 differ in the final store, 7 in the order inside a component and 372 only in the order across components. Without the emulation (r10 and C-3 together): 78 in the final store, 66 in the order inside a component, 304 only across components. Within 3.0 no store depends on it (795 generated machines compared with a build where such an `if` is a step again: 0 store differences).
- **Refusals.** The migrator refuses about 2 % of valid generated 2.2 machines (8 of 387 in the verification review), where removing a never-taken transition would delete the only publish of a member, and every source that uses a never-released WP5 form. A refused file is left unchanged and reported with its reason and location.

## Consequences

- Every valid 2.2 source without a state machine keeps its AST, references, diagnostics, types, projections, results and traces (gates 1 and 2, the extended 2.2 sets).
- State identities are statement paths (`Pkg::C.op/i/j`); old traces map through the migration's identity map.
- A waiting machine is placed only on an `extended` task; a periodic machine may use a `basic` task when nothing it runs in a release can suspend (T4).
- Flow View draws states; the 2.2 State view has nothing to draw for a migrated source.
- The number of looks in one instant can depend on delivery order, so plain statements in a state must not count events; a line counts them.
