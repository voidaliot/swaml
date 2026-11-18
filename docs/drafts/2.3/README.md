# swa.ml 2.3 chapter drafts

**Status: draft for the unreleased standard 2.3. Not normative for any published edition.** These files state the changes that work packages WP1–WP8 make to the normative chapters. They are the checklist that implementers and reviewers tick off. The decisions behind them are [ADR 0022](../../decisions/0022-values-places-and-expressions.md), [ADR 0023](../../decisions/0023-state-reactions.md), [ADR 0024](../../decisions/0024-communication-and-package-links.md) and [ADR 0025](../../decisions/0025-real-time-placement-and-binding.md); the plan is in [the 2.3 release draft](../../RELEASE_2_3.md). Where a draft and an ADR differ, the ADR wins and the draft is corrected.

## Why separate files

The maintained chapters under `docs/spec/`, `docs/LANGUAGE_SPECIFICATION.md` and the other maintained guides are inputs of the published 2.2 edition. `scripts/build-reference.mjs --check` regenerates `docs/SWAML-2.2-Reference.md` from them and fails on any difference. The published 2.2 book is frozen: `scripts/check-frozen-publications.mjs` requires `docs/SWAML-2.2-Reference.md` to equal the copy embedded in the 2.2 PDF. Unreleased 2.3 text in those chapters would therefore either fail `build-reference.mjs --check` or change the published 2.2 book. (The strict 2.2 PDF checker, which compared every embedded source with the workspace, was the 2.2 release gate; after P0 the 2.2 PDF is checked in archive mode.) The drafts therefore mirror the chapter structure here until the 2.3 candidate is allocated.

## How a work package uses these drafts

1. Two small PRs come before WP1 ([release draft](../../RELEASE_2_3.md#version-allocation)):
   - **P0** switches the 2.2 PDF check to archive mode. It is a tooling change with no language change.
   - **WP1a** allocates the unreleased 2.3 candidate, following [VERSIONING.md](../../VERSIONING.md):
     - `spec/standard.json` 2.3;
     - the edition module with parser 2.3 and profile `swaml-reference/2.3`;
     - implementation 4.0.0 with a synchronized lockfile;
     - `examples/simulation/2.3/hello-trace.json`;
     - the three compatibility gates.

   From then on `npm run docs:build` writes `docs/SWAML-2.3-Reference.md`, and the published 2.2 book is no longer regenerated.
2. Each package moves the rules tagged with its number from these drafts into the maintained chapter named by the file and section, in the same PR as the implementation. It deletes them here, or marks them "moved", so the drafts always show what is still open.
3. **Fences.** Every swa.ml example in these drafts is a `text` fence, because complete `swaml` fences in documentation are executable fixtures validated against the current (2.2) implementation by `scripts/check-docs.mjs`. When a package lands a form, it turns the examples of that form into complete `swaml` fences in the maintained chapters, or into examples under `examples/`, so that they are validated.
4. The package regenerates the inventories it affects (`node scripts/build-inventories.mjs`), because `npm run check` verifies them for every changed production and keyword.

## Rule identifiers

Each normative rule has one identifier `WPn-Kxx`. `WPn` is the work package that implements it (WP1a is the allocation package) and `K` is its kind:

| Kind | Meaning |
| --- | --- |
| G | grammar production or token change |
| S | static validity rule |
| R | runtime rule of the reference execution contract |
| D | diagnostic: code, severity and message shape |
| T | trace observation |
| L | library content |
| M | model, normalization, projection, formatter or tool contract |

Each identifier is defined once, in the chapter that owns the rule. Other chapters cite it. Conformance rows (chapter 8) and formal schemas (chapter 9) restate rules for their audience; they carry a `[WPn]` tag but no identifier of their own. A rule is done when the implementing PR moves it into a maintained chapter, adds its tests and names the identifier in its review evidence.

## Files

| Draft | Maintained target |
| --- | --- |
| [Grammar delta](grammar.md) | `src/language/swaml.langium` |
| [1. Structure, names and types](01-structure-and-types.md) | `docs/spec/01-structure-and-types.md` |
| [2. Ports and communication](02-communication.md) | `docs/spec/02-communication.md` |
| [3. Operations, schedules and states](03-behavior.md) | `docs/spec/03-behavior.md` |
| [4. Deployment, cases, views and conformance](04-systems-and-conformance.md) | `docs/spec/04-systems-and-conformance.md` |
| [5. Proposed KerML mapping](05-kerml-mapping.md) | `docs/spec/05-kerml-mapping.md`, `spec/kerml-mapping.json` |
| [6. Execution contract](06-execution-contract.md) | `docs/spec/06-execution-contract.md` |
| [7. Normalized model](07-normalized-model.md) | `docs/spec/07-normalized-model.md` |
| [8. Conformance obligations](08-conformance-obligations.md) | `docs/spec/08-conformance-obligations.md` |
| [9. Formal semantics](09-formal-semantics.md) | `docs/spec/09-formal-semantics.md` |

`docs/LANGUAGE_SPECIFICATION.md` changes only its edition line, its section 2 sentence on dynamic topology (unchanged in meaning) and the inventory table rows for "State/transition" (completion, internal, deferral) and "Deployment/placement" (operation placements on `Swaml::Os` Tasks). WP9 makes these edits together with the edition switch.

## Rules per work package

Counted from the identifiers in these drafts (ten files). The count includes grammar and library entries.

| WP | Content | G | S | R | D | T | L | M | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WP1a | Allocation and compatibility gates | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 3 |
| WP1 | Places, indexed reads, test indexes | 3 | 8 | 4 | 7 | 1 | 0 | 3 | 26 |
| WP2 | Conditional, contextual words, association lists | 3 | 6 | 1 | 4 | 0 | 0 | 5 | 19 |
| WP3 | `Swaml::Numeric`, `Swaml::Text`, `Swaml::Time` | 0 | 2 | 3 | 1 | 0 | 4 | 1 | 11 |
| WP4 | Durations as values, `PolicySetting`, constant evaluator | 4 | 8 | 2 | 7 | 1 | 0 | 5 | 27 |
| WP5 | Completion, timer guards, internal transitions, deferral | 3 | 10 | 13 | 9 | 4 | 0 | 4 | 43 |
| WP6 | Sampled reads, member policies | 2 | 9 | 7 | 8 | 1 | 0 | 5 | 32 |
| WP7 | Release guards | 1 | 3 | 7 | 2 | 2 | 0 | 3 | 18 |
| WP8 | Operation placement, `Swaml::Os`, T1–T7, in-task order, binding | 0 | 10 | 2 | 10 | 0 | 1 | 6 | 29 |
| | **All** | 16 | 56 | 39 | 48 | 9 | 5 | 35 | **208** |

The table is regenerated by counting `WPn-K` identifiers at the start of table rows. Identifiers are never renumbered; a gap (such as WP4-M05 to WP4-M07, which moved to WP1a) is intentional. P0 and WP9 (edition) have no rule identifiers. Their work is listed in the release draft.

## Appendix: choices beyond the proposal

Choices made in WP0 that the proposal left open or that the WP0 review changed. Each points to its rule, so reviewers of later packages can find and challenge it.

| # | Choice | Rules |
| --- | --- | --- |
| C1 | **Warning codes.** Three separate stable warnings (owner decision): SW2016 for a computed duration without a unit, SW2017 for a completion guard that cannot change, SW2018 for a deferred member with a rejecting overflow policy. | WP4-D06, WP5-D08, WP5-D09 |
| C2 | **T4.** A state machine may use a basic Task only if no reaction (entry action, exit action, transition effect, internal or completion effect, or their callees) can suspend; otherwise it needs an extended Task (owner decision). | WP8-S08 |
| C3 | **ADR split.** The proposal's titles plus the owner's fallback: B11a in 0022; B15 and B16 in 0024; B19 in 0025; the rejections in 0024; the B20 deferral in 0025. | — |
| C4 | **Deferral order.** The total order in a state is completion, elapsed timers, retained input (offer order), other input (2.2 order). There is one `defer` observation per message, on first retention. Input queued during a chain is selected wherever the chain ends. | WP5-R01, WP5-R09, WP5-R13, WP5-T03 |
| C5 | **Constant sublanguage.** A const attribute qualifies only if its own effective initializer is in the sublanguage. `/` on integral operands is exact integral division, checked per occurrence (changed after the review). Uninstantiated definitions are checked for typing only. | WP4-S05, WP4-S06, WP4-D07 |
| C6 | **`DurationRange`.** An ordinary catchable runtime failure, not a violation. Computed durations are integral. `capacity = 5ms` stays invalid. | WP4-R01, WP4-S02 |
| C7 | **Places.** A dotted target without an index is a place. The `write` value is the whole new root value, with the new `place` field. | WP1-S05, WP1-T01 |
| C8 | **Sampled reads.** The sampling side's initial value governs, and its absence is reported by SW2004 (changed after the review). Case scripts cannot sample. A sampled member with no consumer has no pending-queue observation. The update instant is decided: the delivery instant, ordered within an instant by the event order, with live, atomic reads by every activation (owner decision; WP6-R07 amends chapter 3.4). A new `sample` observation is used, not `deliver`. | WP6-S03, WP6-S09, WP6-R02, WP6-R03, WP6-R04, WP6-R07, WP6-T01 |
| C9 | **Tasks.** Tasks without a Core ancestor form one implicit Core per platform root. T1–T6 apply whenever the platform contains a `Swaml::Os` Task, and T7 whenever it contains a Core or Task (changed after both reviews). T5 checks explicit deadlines only. | WP8-S03, WP8-S04, WP8-S09 |
| C10 | **Ordering keys.** Descending priority, then Task-placed before unplaced activations, then in-task position (same Task only), then insertion ordinal. Case-script activations are unplaced, and borrowed subject calls keep the case activation's keys. | WP8-R01 |
| C11 | **In-task order.** Deploy statement order, counting statements that name a Node below the Task. An occurrence placement contributes its unclaimed entries, then its descendants depth-first. Schedule order is the effective order of `schedule()`. | WP8-M01 |
| C12 | **Binding identities.** The route identities of runs and traces: `owner.name`, `owner.@connectN` counting every connect member, and `@packageN` (changed after the review). `swaml binding check` exits 1 on schema errors, unresolved identities or `bcetNs > wcetNs`; missing costs are findings. | WP8-M02, WP8-M03 |
| C13 | **Contextual words.** Written unquoted only for a 2.3 workspace; name services are edition-aware. | WP2-M01 |
| C14 | **SW2017 in WP6.** WP6 only confirms that the warning covers guards reading only sampled cells; completion guards are not re-evaluated on cell updates. | WP5-D08 |
| C15 | **Diagnostic codes.** Release guards use SW2007; deferral counts as the machine's own input ownership (SW2005). | WP7-D01, WP7-D02, WP5-S09 |
| C16 | **Release sequence (changed after the review).** First P0 switches the 2.2 PDF check to archive mode; then WP1a allocates the candidate and adds the gates; then WP1. | release draft |
| C17 | **`realText` (changed after the review).** Ties away from zero, unsigned zero, `Bounds` from 1e21; implementations must not rely on `toFixed` alone. | WP3-R02 |
| C18 | **`CompletionLoop` (changed after the review).** The chain restarts at every input or timer consumption and at every suspension. Zero-time counting loops through completion are rejected. | WP5-R07 |
| C19 | **Gate 2 (changed after the review).** Results are compared with a 3.1.0 fixture of full stores, verdicts and SHA-256 digests of canonical JSON traces, ignoring only `profile` and `languageVersion`. Showcase models are taken from `examples/showcase/*.swaml` on main and run through the API or `--json`. New trace information appears only for new syntax, including the new `timer` observation for computed state timers. | WP1a-M02, WP4-T01 |
| C20 | **SW2016 scope (changed after the review).** References to const attributes whose effective initializer contains a duration literal or `now()` count as carrying a unit. | WP4-D06 |
| C21 | **Release guard timing.** Evaluated at the first execution step with the dispatch arguments, seeing the cell updates ordered before it in the event order. A receive entry's input is consumed at release, as in 2.2. | WP7-R01, WP7-R04 |
| C22 | **Internal timers.** An internal timer leaves the other timers armed. An elapsed equal-expiry timer is selected after the following completion evaluation. | WP5-R05 |
