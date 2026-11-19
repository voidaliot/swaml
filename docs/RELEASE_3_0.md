# swa.ml 3.0 release

**Unreleased; prepared 19 November 2026.** Standard 3.0, parser and host semantics 3.0, reference profile `swaml-reference/3.0`, reference implementation package 4.0.0. Nothing here is published until the `v3.0` tag and its verified reference, PDF, manifest and checksum exist ([VERSIONING.md](VERSIONING.md)).

swa.ml 3.0 is a **major edition**: it replaces the 2.2 state machines by states that are steps of the flow and removes the `when` keyword. Every valid 2.2 source without a state machine stays valid with unchanged meaning; a 2.2 source with a state machine is rewritten by `swaml migrate` ([migration guide](MIGRATION_3_0.md)). The edition was drafted under the name 2.3; its design record is kept in [docs/design](design/3.0-release-plan.md).

## States in the flow

A state is an ordinary statement of a flow: `state s { … }`. The flow reaches it, its `on entry` runs once, and it waits until a look leaves it. Inside its braces it holds `on entry`, `on exit`, event lines (`on receive p.m(x) { … }`, `after D { … }`), ordinary statements and, last, inner states. `if` never waits: the state waits and looks at what is inside its braces again each time something happens to it (arrival, a message it or a parent names, a timer, a value its statements read being written or sampled, and in a periodic machine each release). `exit;` goes on with what is written next and `to S;` goes to `S`; they are the only bodies that may drop their braces. A leave written on a parent leaves everything inside it. Unhandled input is dropped while a state waits; what must be remembered is a variable. An operation with states released `on every P` is a periodic machine that keeps its state, locals and timers across releases. See chapter [3.6](spec/03-behavior.md), [6.5](spec/06-execution-contract.md) and [ADR 0026](decisions/0026-states-in-the-flow.md); examples [44](../examples/44-uplink-session.swaml) to [47](../examples/47-sensor-warmup.swaml) and [54](../examples/54-interior-light.swaml) to [57](../examples/57-turn-signal-flasher.swaml), and the [door-controller showcase](../examples/showcase/autosar-classic-door-controller.swaml) (window lifter with parent states, mirror heater and supply monitor as periodic machines).

**Removed:** `initial S;`, `final state`, ordered transitions `on receive … when (g) to T { … }` and `after D when (g) to T { … }`, and the `when` keyword (`initial`, `final` and `when` are basic names in 3.0). A file in 2.2 machine syntax gets one SW2000 error that names `swaml migrate`.

## Other additions

| Area | Addition | Decision |
| --- | --- | --- |
| Places | Element and field assignment (`statuses[i].confirmed = true;`), member access after an index (`recent[i].vehicleId`), literal component indexes in test paths (`backend.twins[0].link`) | [ADR 0022](decisions/0022-values-places-and-expressions.md) |
| Expressions | The whole-expression conditional `x = if (c) a else b;` (never a statement); `else if` | ADR 0022, ADR 0026 |
| Names | `view`, `state`, `in`, `out` are contextual words, written unquoted; association lists `associate a, b to 'X', 'Y';` | [ADR 0024](decisions/0024-communication-and-package-links.md) |
| Library | `Swaml::Numeric` (`minInt`, `maxInt`, `clampInt`, `clamp`, `sqrt`), `Swaml::Text` (`intText`, `realText`, `boolText`), `Swaml::Time` (`now()`), `Swaml::Os` (`Core`, `Task`, `TaskKind`), in the built-in document `builtin:///swaml-3.0.swaml` | ADR 0022, [ADR 0025](decisions/0025-real-time-placement-and-binding.md) |
| Durations | A duration literal is a `uint` value in nanoseconds; computed waits `wait (e);`, receive timeouts, state timers `after (e)`, periods `on every (e)` and deadlines `deadline (e)` in the constant sublanguage; the runtime failure `DurationRange`; the single-form `PolicySetting` | ADR 0022 |
| Communication | Sampled reads `p.m` of required attributes that declare an initial value (sample cells, the `sample` observation); policies per connection member `connect … { crash: CanEvent; }` | ADR 0024 |
| Schedules | Release guards `on every 20ms slot() if (g) deadline 2ms;` on `every`, `receive` and `after` entries; a false guard is a `skip` that counts as completion for `after` successors | ADR 0025 |
| Placement | Deploy paths that end at released operations; `Swaml::Os` tasks with the static rules T1 to T7; equal-time work ordered by task priority and in-task position; the `swaml-binding/1` schema and `swaml binding check` | ADR 0025 |
| Tools | `swaml migrate <file|dir> [--write]`: rewrites 2.2 machines and `when` release guards, a dry run by default, validated as a workspace | [MIGRATION_3_0.md](MIGRATION_3_0.md) |

**New diagnostics** (warnings): SW2016 (a computed duration without a unit), SW2019 (two `every` entries of one occurrence with equal periods but different triggers), SW2020 (a release guard that folds to false, or a replacing entry that drops an inherited guard), SW2021 (an operation placement on a platform without a task). State rules use SW2008 and SW2006 (SIF-D01 to SIF-D04); task rules use SW2009. SW2017 and SW2018 are not used by any rule of 3.0.

**Trace observations**, only where new syntax is used: `skip`, `sample`, `write` with `place`, `discardInput` with reason `releaseGuard`, `durationNs` on computed waits and timeouts, `timer` for computed state timers, `task` on a release on a task, and for states `state` (with `trigger`, `held`, `stay`), `wake`, `leave` and `periodicEnd`. A loop without time passing ends at the step limit, whose `StepLimit` report names the instant and the activations that ran.

## Compatibility with 2.2

Checked by `npm run check` on every change (the numbers at the release preparation, [RELEASE_VALIDATION_3_0.md](RELEASE_VALIDATION_3_0.md)):

- **Gate 1, sources:** every recorded 2.2 source without a machine keeps its AST, resolved references, diagnostics, inferred types, projections and view selections.
- **Gate 2, behaviour:** every recorded 2.2 run and case without a machine (46 of 46) keeps its status, stores, verdicts and canonical trace digest, ignoring only `profile` and `languageVersion`. The nine extended sets of 2.2 models outside the corpus show no difference.
- **Gate 3:** the grammar builds without a Langium warning.
- **Gate B, migrated machines:** every recorded 2.2 run and case with a machine is migrated in memory, run and mapped back: 113 of 114 identical, 0 verdict differences.
- **Gate C, accepted differences**, pinned by models in `test/fixtures/compatibility-2-2/accepted/`:
  - **r10:** input queued for a waiting state is looked at in delivery order (2.2 walked its queues in creation order), which can change which unnamed input is dropped. Generated 2.2 machines without `if`: 41 of 194 differ (12 in the final store); with a helper activation 19 of 151 and 39 of 152; none with 2.2's queue order emulated.
  - **C-3:** an `if` test in a migrated transition block is no scheduling step. With 2.2's queue order emulated, of 794 generated valid machines 2 differ in the final store, 7 in the order inside a component and 372 only across components; r10 and C-3 together: 78, 66 and 304.
- **Migrator refusals:** about 2 % of generated valid 2.2 machines (8 of 387), where removing a never-taken transition would delete the only publish of a member, and every source that uses a form of the unreleased draft (completion and internal transitions, guarded timers, `defer`).

Published 2.2 and older references, PDFs, manifests, checksums, figures, notes and traces keep their bytes (`check-frozen-publications.mjs`). Behaviour remains bounded evidence of deterministic reference runs, not production scheduling or universal verification.

## Consumers

What a tool that reads swa.ml must change (details per area in the [implementation record](design/3.0-release-plan.md#compatibility-gates); its WP5 notes are void):

- **Edition:** pass `languageVersion` / `--language-version` 3.0; the 3.0 host rejects 2.2. Name services are edition-aware: `formatName(name, '3.0')` writes `view`, `state`, `in`, `out`, `initial`, `final` and `when` unquoted, `'2.2'` quotes them; diagnostics keep the 2.2 spelling (`MESSAGE_SPELLING`).
- **Library:** load `builtin:///swaml-3.0.swaml` (`LIBRARY_3_0_URI`, `STANDARD_LIBRARY_3_0`) beside `swaml-2.0.swaml`; `createSwamlServices` does. A user package named like a library package hides it.
- **AST:** `StateStep`, `StateMember`, `EventLine`, `Leave` (`Exit`, `Jump`), `ConditionalExpression`, `Selector`, `MemberPolicy`, `ElseIf`; `Association.moreOccurrences`/`moreTargets`; `PortMember.initial`; `PolicySetting.value` (read durations with `settingDuration`); computed `delayValue`, `timeoutValue`, `periodValue`, `deadlineValue`. Removed: `OperationBody.initial`/`states`, `State`, `Transition`, `PolicySetting.duration`.
- **API:** `flowStates`, `isStateful`, `innerStates`, `stateItems`, `isShortBody`, `statementReads`, `associationPairs`, `entryPeriod`, `entryDeadline`, `displayText`, `libraryIntrinsic`, `isClockRead`; the migrator `migrateSource`, `migrateFile`, `migrateReleaseGuards` (`src/migrate`).
- **Identities and projection:** a state is identified by its statement path (`Pkg::C.op/0`); states are view candidates of kind `state` owned by their parent state; each leave is a `transition` edge labelled with its line and branch. Flow View draws states.
- **CST:** a binary expression built at the top of an `Expression` has the CST rule `Expression`; recognise operators by `BinaryExpression.operator`.

## Publication checklist

Following [VERSIONING.md](VERSIONING.md) and [PDF_PUBLICATION.md](PDF_PUBLICATION.md); none of these steps is authorized by the preparation.

1. Review and merge the release-preparation PR after its independent adversarial review; the complete `npm run check` and `node --test test/ci/*.test.mjs` on Node 26.12.0.
2. Regenerate and check figures with the Python builders (`build-graphical-examples.py`, `build-notation.py`, `build-modeling-overview.py`, each then with `--check`).
3. Build the PDF with `python scripts/build-spec-pdf-3.0.py`, check it with `python scripts/check-spec-pdf-3.0.py` (strict current-source) and `python scripts/test-publication-3-0.py`; render and inspect every page.
4. Add the 3.0 PDF, manifest and checksum to `check-frozen-publications.mjs` and the Publication workflow, move the changelog notes to `## 3.0 — YYYY-MM-DD`, and update this status line.
5. Run the Publication and compatibility workflow on the release commit; tag `v3.0` and create the GitHub release with the PDF, manifest and checksum only when publication is authorized.
