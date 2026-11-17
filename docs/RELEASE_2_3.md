# swa.ml 2.3 release (draft)

**Status: unreleased draft, 18 November 2026.** No 2.3 version is allocated and nothing in this file is published. The owner approved releasing swa.ml 2.3 as a compatible minor edition after 2.2 with the scope below. The decisions are [ADR 0022](decisions/0022-values-places-and-expressions.md), [ADR 0023](decisions/0023-state-reactions.md), [ADR 0024](decisions/0024-communication-and-package-links.md) and [ADR 0025](decisions/0025-real-time-placement-and-binding.md). The rules to implement, each tagged with its work package, are in the [2.3 chapter drafts](drafts/2.3/README.md). The design record is the [2.3 proposal](proposals/NEXT_MINOR_PROPOSAL.md), revision 2; the ADRs are normative where they differ.

Planned identifiers: standard 2.3, parser and host semantics 2.3, reference profile `swaml-reference/2.3`, reference implementation package 4.0.0. No migration guide is needed: every valid 2.2 source stays valid with unchanged meaning.

## Scope (Tier 1)

| Item | Change | ADR | WP |
| --- | --- | --- | --- |
| B1, B2 | Element and field assignment (`statuses[i].confirmed = true;`), index then member access | 0022 | WP1 |
| B11a | Literal component indexes in test inspection paths (`backend.twins[0].link`) | 0022 | WP1 |
| B3 | Whole-expression conditional `if (c) a else b`, never a statement | 0022 | WP2 |
| B15 | `view`, `state`, `in`, `out` (and `defer`) as contextual words | 0024 | WP2 (WP5) |
| B16 | Association lists `associate a, b to 'X', 'Y';` | 0024 | WP2 |
| B4 | `Swaml::Numeric` (`minInt`, `maxInt`, `clampInt`, `clamp`, `sqrt`), `Swaml::Text` (`intText`, `realText`, `boolText`) | 0022 | WP3 |
| B5 | `Swaml::Time::now()` | 0022 | WP3 |
| B6 | Durations as `uint` nanosecond values; computed `wait`, timeouts, state timers, periods and deadlines; constant sublanguage; single-form `PolicySetting`; SW2016 | 0022 | WP4 |
| B7, B10 | Guard-only completion transitions; guarded timers; `CompletionLoop`; SW2017 | 0023 | WP5 |
| B8 | Internal transitions (no `to`) | 0023 | WP5 |
| B9 | `defer p.m;` with offer-ordinal order; SW2018 | 0023 | WP5 |
| B14 | Sampled reads of required attributes with mandatory initial values | 0024 | WP6 |
| B13 | Policies per connection member | 0024 | WP6 |
| B19 | Release guards on `every`, `receive` and `after` entries; a skip counts as completion | 0025 | WP7 |
| B17 | Operation-level placement; one Core per component occurrence | 0025 | WP8 |
| B18 | `Swaml::Os` (`Core`, `Task`, `TaskKind`), rules T1–T7, in-task order, priority ordering in the run, `swaml-binding/2.3` schema and `swaml binding check` | 0025 | WP8 |

New stable diagnostics: SW2016 (computed duration without a unit), SW2017 (completion guard that cannot change while the machine waits) and SW2018 (deferred member with a rejecting overflow policy), all warnings. New runtime codes: `DurationRange` (runtime failure) and `CompletionLoop` (contract violation). New or extended trace observations: `skip`, `defer`, `discardTimer`, `state` with `internal`, `deliver` with `sample`, `write` with `place`, `discardInput` with reason `releaseGuard`.

## Deferred (Tier 2) and rejected

| Item | Status |
| --- | --- |
| Trigonometry as swa.ml library source; enum `ordinal`/`literalText` (D14) | Tier 2 |
| B12 boundary port to several children | Tier 2, no showcase instance |
| B18 timed run `swaml-reference-timed/2.4`: fixed-priority scheduling per Core, preemption, budgets, cross-core blocking | Tier 2 |
| B20 declarative latency chains | Deferred; tests measure latency with `now()` |
| B11b port arrays and connector loops (D12) | Not in 2.3; an additive 2.4 candidate |
| B11c per-index configuration | Rejected; use distinct usages |
| B16 "did not arrive" construct | Rejected; `on receive … { fail "…"; } or after D { }` |
| B21 service discovery | Rejected; static optional connections and a sampled availability attribute |

## Compatibility gates

Release gates for D1. WP4 runs them first; every later package and WP9 run them again ([ADR 0022](decisions/0022-values-places-and-expressions.md#compatibility)):

1. **Corpus AST identity.** Every repository `.swaml` file and the three showcase models parse to identical ASTs under the 2.2 and 2.3 grammars, after the single normalization N1 for `PolicySetting`. The test is `test/compatibility-2-2.test.ts`.
2. **Behaviour identity.** `scripts/check-simulations.mjs` reproduces every expected final store and case result of `examples/simulation/cases.json`.
3. **Warning-free grammar.** No Langium generation or parser-construction warning, enforced by a unit test.

The implementation package becomes 4.0.0 because existing AST properties silently widen (`Assign.target`, `CallExpression.target`, `Association`, `PolicySetting`; D2).

## Version allocation

The first implementing package (WP1) allocates the unreleased candidate, following [VERSIONING.md](VERSIONING.md):
- `spec/standard.json` 2.3;
- the edition module with parser 2.3 and `swaml-reference/2.3`;
- `npm version 4.0.0 --no-git-tag-version` with both lockfile entries synchronized;
- a note under `## Unreleased`.

At that point:
- `npm run docs:build` writes `docs/SWAML-2.3-Reference.md` and no longer regenerates the published 2.2 book.
- Pull-request PDF checks switch to `scripts/check-spec-pdf-2.2.py --archive`, as was done for 2.1.
- Maintained chapters may carry 2.3 text. Each package moves its rules from the drafts into them.

This is a recommendation of WP0. The coordinator may instead keep 2.2 identifiers until WP9, but then no package can edit a maintained chapter without failing `build-reference --check`.

## Work packages

One draft PR at a time, each with an independent adversarial review, merged before the next starts.

| WP | Content | Needs | Showcase proof (fragments at `cc16c25`) |
| --- | --- | --- | --- |
| WP0 | ADRs 0022–0025, chapter drafts, this file, changelog | — | — |
| WP1 | Places, indexed reads, test indexes; version allocation | A2 | `Dem.report`, `AlertRouter.findOpen`, twins test |
| WP2 | Conditional, contextual words, association lists | A1 | `DoorEcu::Types`, v2x `state`, cloud associations |
| WP3 | `Swaml::Numeric`, `Swaml::Text`, `Swaml::Time` | A2 | v2x `sqrt`, `ComMain` reception age |
| WP4 | Durations, `PolicySetting`, constant evaluator, gates 1–3 | WP3 | v2x hazard validity |
| WP5 | Completion, guarded timers, internal transitions, deferral | WP4 | v2x session, cloud breaker, door `LockControl` |
| WP6 | Sampled reads, member policies; revisit SW2017; settle when a sampled value becomes readable | WP5 | `ComMain` stores, `BodyCan` |
| WP7 | Release guards | WP4 (WP6 for the proof only) | `LinMaster`, `ComMain` |
| WP8 | Operation placement, `Swaml::Os`, T1–T7, ordering keys, binding schema and check | WP4, WP7, A4 | door deployment |
| WP9 | Edition: inventories, notation, figures, reference book, showcase rewrites, site data, PDF | WP1–WP8, A1, A7 | the three models |
| E1 | Consuming editor: text services, edits and forms; fix the `associate` list data loss before lists are accepted | WP1–WP4 | — |
| E2 | Consuming editor: Flow and Sequence for completion, internal transitions, deferral, sampled reads | WP5–WP6 | — |
| E3 | Consuming editor: Timing, Interconnect and deployment for computed periods, release guards, Task lanes and member policies | WP4, WP6–WP8 | — |

Rule counts per package are in the [draft index](drafts/2.3/README.md#rules-per-work-package).

### Tool-fix prerequisites

These live on branch `fix/showcase-tool-defects`. They change no standard and must be merged before the packages that need them:

| Fix | Defect | Needed by |
| --- | --- | --- |
| A1 | Formatter data loss and layout | WP2, WP9 (every new form must print before a showcase is reformatted) |
| A2 | Flow-sensitive stale-read warning SW2011 | WP1, WP3 (place writes and `now()`) |
| A4 | Per-model simulation options | WP8 (the door's 1 ms task) |
| A7 | `swaml test` text mode exhausts the V8 heap on a long door case while `--json` completes | WP9 |

## Publication checklist

Following [VERSIONING.md](VERSIONING.md) and [PDF_PUBLICATION.md](PDF_PUBLICATION.md). Nothing here is authorized by this draft.

1. Changes recorded under `## Unreleased` in `CHANGELOG.md`; standard and implementation changes kept apart.
2. `spec/standard.json` 2.3, edition module and profile reviewed; implementation 4.0.0 and lockfile synchronized (done in WP1 if the allocation above is accepted).
3. Inventories regenerated (`node scripts/build-inventories.mjs`):
   - new productions `Selector`, `ConditionalExpression`, `Deferral`, `MemberPolicy`;
   - changed `PolicySetting`, `Assign`, `ReferenceExpression`, `CallExpression`, `Literal`, `ExpressionStatement`, `Expression`, `Wait`, `Receive`, `ScheduleEntry`, `Transition`, `State`, `Connect`, `PortMember`, `Association`, `Name`.
4. All draft rules moved into maintained chapters; `docs/drafts/2.3/` emptied or removed; every 2.3 example a validated `swaml` fence or example file.
5. New figures under `docs/notation/2.3/`: Flow (completion, internal, deferral), Timing (guarded entry, Task lanes), Interconnect (member policy), General (operation placement). `python scripts/build-graphical-examples.py --check` and `python scripts/build-notation.py --check` pass.
6. `scripts/build-reference.mjs` lists ADRs 0022–0025 and `RELEASE_2_3`; `npm run docs:build` writes `docs/SWAML-2.3-Reference.md`.
7. Showcase rewrites of the three models; `node scripts/build-showcase-data.mjs`; light/dark responsive preview of the site.
8. Compatibility gates 1–3 and the complete `npm run check` on Node 26.12.0.
9. New `scripts/build-spec-pdf-2.3.py`, `scripts/check-spec-pdf-2.3.py` and `scripts/test-publication-2-3.py` (with the 2.2 source inventory generalized); `SWAML-2.3-Specification.pdf`, manifest and SHA-256; every page rendered and inspected; 2.2 checks in archive mode.
10. The Publication and compatibility workflow on the release commit.
11. Notes moved to `## 2.3 — YYYY-MM-DD` with the intended date; this file's status line updated; the `v2.3` tag only when publication is authorized.
12. The 2.2 reference, PDF, manifest, checksum, figures and notes keep their bytes.

## What a door ECU team can and cannot derive after 2.3

After 2.3, the door model fixes a complete, statically checked task and runnable mapping:
- the Tasks of each Core with kind (basic, extended, ISR), priority, preemptability, and period or response bound;
- each runnable's Task and its position in that Task;
- per-entry deadlines consistent with periods and response bounds;
- one Core per component occurrence, no event entries on periodic Tasks, and no suspension on basic Tasks or ISRs (a state machine sits on a basic Task only if none of its reactions can suspend);
- level-triggered mode gating;
- per-member communication policies.

The model carries behaviour and data semantics precise enough for a backend to generate code. It runs deterministically in logical zero time, with equal-time work ordered by Task priority and in-task position. A binding file of costs, budgets and cross-core latencies can be validated against the model and deployment.

It does **not** establish that this schedule meets its deadlines on the target. That needs costs (the binding) plus the Tier 2 timed run or an external analysis. 2.3 does not derive or check:
- response times or schedulability;
- WCET;
- cross-core blocking (excluded by the one-Core rule);
- interrupt latency;
- CAN or LIN signal packing and PDU layout;
- E2E profiles;
- the OS configuration format;
- memory mapping, NvM layout or calibration;
- RTE or generated code.

Passing tests and cases remain bounded evidence of deterministic runs, not proofs.
