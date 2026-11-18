# swa.ml 2.3 release (draft)

**Status: unreleased draft, 18 November 2026.** The 2.3 candidate is allocated (WP1a) as an unreleased candidate; nothing in this file is published. The owner approved releasing swa.ml 2.3 as a compatible minor edition after 2.2 with the scope below. The decisions are [ADR 0022](decisions/0022-values-places-and-expressions.md), [ADR 0023](decisions/0023-state-reactions.md), [ADR 0024](decisions/0024-communication-and-package-links.md) and [ADR 0025](decisions/0025-real-time-placement-and-binding.md). The rules to implement, each tagged with its work package, are in the [2.3 chapter drafts](drafts/2.3/README.md). The design record is the [2.3 proposal](proposals/NEXT_MINOR_PROPOSAL.md), revision 2; the ADRs are normative where they differ.

Allocated identifiers (WP1a): standard 2.3, parser and host semantics 2.3, reference profile `swaml-reference/2.3`, reference implementation package 4.0.0. WP1 has landed: assignment to places (`statuses[i].confirmed = true;`), member access after an index (`recent[i].vehicleId`) and literal component indexes in test inspection paths (`backend.twins[0].link`). The other Tier 1 items are still open, and the candidate otherwise accepts exactly the 2.2 language. No migration guide is needed: every valid 2.2 source stays valid with unchanged meaning.

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

New stable diagnostics: SW2016 (computed duration without a unit), SW2017 (completion guard that cannot change while the machine waits) and SW2018 (deferred member with a rejecting overflow policy), all warnings. New runtime codes: `DurationRange` (runtime failure) and `CompletionLoop` (contract violation). New or extended trace observations: `skip`, `defer`, `discardTimer`, `sample`, `state` with `internal`, `write` with `place`, `discardInput` with reason `releaseGuard`, `durationNs` on computed waits and timeouts, and `timer` for computed state timers. They appear only where new syntax is used, so 2.2 traces are unchanged.

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

Release gates for D1. WP1a adds them before any language change; every later package and WP9 run them ([ADR 0022](decisions/0022-values-places-and-expressions.md#compatibility)):

1. **Corpus AST identity.** Every repository `.swaml` file, including the showcase models at `examples/showcase/*.swaml`, parses to identical ASTs under the 2.2 and 2.3 grammars, after the single normalization N1 for `PolicySetting`, applied to both sides. The test is `test/v2/compatibility-2-2.test.ts` (unit tests run from `test/v2`).
2. **Behaviour identity.** A fixture recorded once with the 3.1.0 implementation freezes the result of every run in `examples/simulation/runs.json`, every example case and every showcase test (`examples/showcase/*.swaml` on main, run through the API or `--json`): status, full final stores, case verdicts and a SHA-256 digest of the canonical JSON trace (rule WP1a-M02). Every package compares with it, ignoring only `profile` and `languageVersion`. New trace fields and observation kinds appear only where new syntax is used.
3. **Warning-free grammar.** No Langium generation or parser-construction warning, enforced by a unit test.

The gates are in place since WP1a. Gate 1 is `test/v2/compatibility-2-2.test.ts` and gate 3 `test/v2/grammar-warnings.test.ts`, both in `npm test`; gate 3 also fails the build on any `langium generate` diagnostic, hints included (`scripts/langium-generate.mjs`). Gate 2 is `node scripts/compatibility-2-2.mjs runs` in `npm run check`. The fixtures under `test/fixtures/compatibility-2-2/` were recorded with implementation 3.1.0 at `213f583`: the kept 2.2 grammar; `ast.json` (source and normalized AST digests); `behaviour.json` (about 0.8 MB, one line per run or case: options, verdict, status, full stores, machines, deployments, trace length, per-kind counts and trace SHA-256); and, added in the WP1a review from the same commit, `resolution.json` (about 0.7 MB, per corpus file: 2,474 cross-references with their resolved targets, 18 diagnostics with severity, code, range and message, and the inferred types of all 12,640 typed expressions, keyed by offset, length and node type), `projection.json` (about 0.3 MB, per corpus file: the digest of `projectModel`, which the seven views draw from, per kind and top-level owner the count and digest of its projection nodes and edges, the view candidates, and the selection of each of the 86 declared views, filters included) and `behaviour-supplement.json` (the resolved run options of the 131 recorded runs, defaults included, and the four cases of example 32). Example 32 (`examples/32-calibration-bench.swaml`) was added so that gate 2 executes 2.2 constructs no other executed model contained. Its four tests observe: `in` and `out` parameters and routed out arguments with copy-back only after a successful return (an interrupted conversion leaves its target unchanged); `byte` values; a redefined component; a redefined connection whose `Latest` policy keeps only the newer of two queued counts; a redefined operation usage inside a redefined component body; an operation usage nested in an operation body; a multi-binding interrupt; and the second branch of a multi-branch `receive`, taken when a hold arrives first. A removed connection redefinition, hold redefinition or nested usage changes a verdict or a store. Two constructs have no observable behaviour by rule and are covered by gate 1 only: a port redefinition must keep the port type (SW2003), and `returns void` equals an omitted result. Contextual words such as `reversed`, `to`, `by`, `case`, `test`, `use`, `name` and `path` are used as member names, and the view `audit` uses the `not`, `!=` and `path` filter forms (gate 1 records its selection). `node scripts/compatibility-2-2.mjs coverage` lists the parts of the 2.2 grammar (rules, alternatives, optional elements and keywords; presence, not execution) that no executed model contains; after WP1a only `view def` and its documentation remain, which only the built-in library may declare (SW2010) and which gate 1 covers through `libraries/swaml-2.0.swaml`. On a mismatch, gate 2 names every differing key and writes the actual trace under `out/compatibility-2-2/`; `--write-traces <dir>` writes all of them; gate 1 names the differing reference, diagnostic, type, projection group or view. The recorded fixtures are never re-recorded or edited to make a gate pass; `test/ci/compatibility-fixtures.test.mjs` pins the SHA-256 of each of them, checks that each names the recording commit and that this commit is the 3.1.0 implementation of 2.2 (source CI fetches it, and under `CI` a missing commit fails; ancestry is checked only in a full clone). A package that deliberately changes a recorded source (a showcase rewrite in WP9, for example) keeps the recorded bytes at `test/fixtures/compatibility-2-2/sources/<path>`, where both gates read them. Gate 1 fails when a reference of a recorded source resolves to another target, a diagnostic or an expression type changes, or a projection or view selection changes; gate 2 when a resolved run option changes.

**Amendments.** `test/fixtures/compatibility-2-2/amendments.json` is the only fixture file a package may edit, and only in a reviewed PR. An amendment may change the message of one recorded gate-1 diagnostic (severity, code and range stay as recorded), remove one recorded warning (`current: null`) that the cited rule retires, or change one recorded expression type to another known type (never `?` or `unknown`). It names the file, the kind (`diagnostic` or `type`, with the type key), the exact recorded value, the exact new value, the rule that requires the change and a reason. The rule is a `WPn-Kxx` identifier defined in a table of the 2.3 drafts, the maintained chapters or the specification (one index function, `knownRules`, finds them wherever a package moves them and ignores a rule whose rule cell starts with `*Deferred.*` or `*Rejected.*` in any row; a unit test pins the 208 identifiers of the drafts), or an ADR with a file under `docs/decisions`; a WP1a rule never justifies an amendment. Gate 1 fails on a stale entry (the recorded value is not in the fixture), an unused entry (the new value is not produced, or a removed warning still is), a duplicate, an unknown or WP1a rule, a missing reason, any change of severity, code or range, the removal of an error, and any other kind. A 2.2 source never gains an error or any new diagnostic in 2.3, and this is not amendable: a new diagnostic always fails gate 1. References are never amended: a 2.2 name keeps its target. Behaviour (gate 2) is never amended: no 2.3 rule changes the result or trace of a 2.2 source, and new trace information appears only for new syntax; a deliberately changed source keeps its recorded bytes under `sources/`. The list starts empty. The gate-1 report prints every applied amendment with its file, rule, kind and recorded and current values. The projection fixture covers `projectModel`, `viewCandidates` and `selectView`; operation timing is covered indirectly through the gate-2 trace digests; Sequence, Flow and behaviour projections and statement identities belong to consuming tools and are outside these gates. New projection fields appear only for new syntax and are absent on 2.2 sources. On a projection mismatch gate 1 writes the actual projection of the file under `out/compatibility-2-2/projections/`; `ast --write-projections <dir>` writes all of them, and the same command in a worktree of `213f583` (with the recording script and the fixture files) writes the 3.1.0 projections to diff against.

To reproduce the fixtures byte for byte, on Node.js 26.12.0: `ast.json` and `behaviour.json` reproduce in a worktree of `213f583` (after `npm ci` and `npm run build`) with `scripts/compatibility-2-2.mjs` from commit 772a3ee, without example 32 and without its `cases.json` entry. For the three later files, check out `213f583` in a separate worktree, run `npm ci` and `npm run build`, copy into it `scripts/compatibility-2-2.mjs` from commit `de4a9c1`, the recorder version whose SHA-256 (`1398ba3a…`) these files record in `recordedWith.script` (later edits of the script change its digest but never the pinned fixtures, which keep naming the version that produced them), `examples/32-calibration-bench.swaml`, `examples/simulation/cases.json` and `swaml-2.2.langium`, `ast.json` and `behaviour.json` from `test/fixtures/compatibility-2-2/`, then run `node scripts/compatibility-2-2.mjs ast --record` twice (`resolution.json`, then `projection.json`) and `node scripts/compatibility-2-2.mjs runs --record` once (`behaviour-supplement.json`). Each `--record` writes the first missing file of its gate and refuses when all exist or the package is not 3.1.0.

The implementation package becomes 4.0.0 because existing AST properties silently widen (`Assign.target`, `CallExpression.target`, `Association`, `PolicySetting`; D2).

## Version allocation

Three PRs, in this order, before any language change is reviewed:

1. **P0: archive the 2.2 PDF check.** A tiny standalone tooling PR, needed regardless of 2.3. The strict `scripts/check-spec-pdf-2.2.py` compares the published PDF's embedded sources with the workspace, and those sources include `src/**/*.ts` (`scripts/publication_2_2_sources.py`). `src` already changed on main after `v2.2` (PR 50), so the strict check is stale today. The Publication and compatibility workflow, which runs only on manual dispatch, switches its 2.2 step to `--archive`, as was done for 2.1. `docs/PDF_PUBLICATION.md` says so. There are no pull-request PDF checks to change. Done: the workflow runs `check-spec-pdf-2.2.py --archive`; a CI test keeps every published 2.x checker in archive mode; and `scripts/check-frozen-publications.mjs` pins the published PDFs, manifests and checksums and freezes the edition-specific workspace copies and the publication scripts that the PDFs embed.

   **Freeze until WP1a.** While the standard is 2.2, these cannot change on main: the 2.2 reference book, and so every maintained chapter or guide it is generated from (`build-reference.mjs --check` regenerates it); `docs/figures/2.2`, `docs/notation/2.2` and `examples/simulation/2.2`, and so any renderer or simulator change that alters them; and the scripts the 2.2 PDF embeds, including `scripts/v2_scene.py`, `build-notation.py`, `build-graphical-examples.py`, `build-reference.mjs`, `standard-version.mjs`, `ci-pdf-requirements.txt`, `publication_archive.py` and `publication_2_2_sources.py`. A package that needs to change one of these scripts does it deliberately, in one of two ways. Either it adds a new 2.3 file (for example `publication_2_3_sources.py` for the generalized inventory), or, in `scripts/check-frozen-publications.mjs`, it moves the entry from the 2.2 edition's `files` to its `exceptions` with the commit and reason, and lowers that edition's `count`. A plain removal fails, because every script a published manifest lists must be frozen or a named exception. WP1a does this for the 2.2 maintained tooling (`maintainedTooling`: `v2_scene.py`, `build-notation.py`, `build-graphical-examples.py` and `build-reference.mjs`), as the 2.0.0 and 2.1 entries already record for theirs: from allocation on these are 2.3 tools. Later work that edits them includes the renderer changes in `v2_scene.py` (WP5 and WP9 figures) and the chapter lists in `build-reference.mjs` (checklist item 6). `standard-version.mjs` and `ci-pdf-requirements.txt` stay frozen until a package needs to change them. The archive checkers and source inventories (`check-spec-pdf-2.x.py`, `build-spec-pdf-2.x.py`, `publication_2_x_sources.py`, `publication_archive.py`) and the 2.2 book, release notes, figures, notation and trace stay frozen permanently.
2. **WP1a: allocate the 2.3 candidate.** Done. No language change. Prerequisites: P0; the showcase models merged to main as `examples/showcase/*.swaml` (branch `showcase/all`), because gates 1 and 2 include them; and tool fixes A1, A2, A4 and A7 merged, so that the gate-2 fixture records the corrected tools' behaviour. Following [VERSIONING.md](VERSIONING.md):
   - `spec/standard.json` 2.3;
   - the edition module with parser 2.3 and `swaml-reference/2.3`;
   - `npm version 4.0.0 --no-git-tag-version` with both lockfile entries synchronized;
   - `examples/simulation/2.3/hello-trace.json`, written with `node scripts/check-simulations.mjs --write` and reviewed;
   - `npm run docs:build` writing `docs/SWAML-2.3-Reference.md`;
   - the three compatibility gates, with the gate-2 fixture recorded from the 3.1.0 implementation before the allocation commit;
   - a note under `## Unreleased`.

   From then on the published 2.2 book is no longer regenerated, and maintained chapters may carry 2.3 text.

   WP1a moved `v2_scene.py`, `build-notation.py`, `build-graphical-examples.py` and `build-reference.mjs` from the 2.2 edition's `files` to its `exceptions` in `scripts/check-frozen-publications.mjs` (`count` 113 to 109); `build-reference.mjs` changed in the allocation to mark the generated book as an unreleased draft. Still frozen: the 2.2 book, release notes, `docs/figures/2.2`, `docs/notation/2.2`, `examples/simulation/2.2`, the archive checkers and source inventories, `publication_archive.py`, `standard-version.mjs` and `ci-pdf-requirements.txt`.

   **After WP1a, when a package changes:**
   - a maintained chapter or guide: it edits the chapter directly (moving its draft rules) and regenerates `docs/SWAML-2.3-Reference.md` with `npm run docs:build`; `build-reference.mjs --check` in `npm run check` rejects a stale 2.3 book;
   - notation, figures or the renderer: it regenerates the 2.3 outputs with `python scripts/build-graphical-examples.py`, `python scripts/build-notation.py` and `python scripts/build-modeling-overview.py` (then each with `--check`) and `npm run docs:build`; these write only `docs/figures/2.3` and `docs/notation/2.3`, and the frozen 2.2 directories must not change;
   - the simulator trace of the Hello run: it regenerates `examples/simulation/2.3/hello-trace.json` with `node scripts/check-simulations.mjs --write` and reviews the difference; `examples/simulation/2.2/hello-trace.json` and `examples/simulation/hello-trace.json` stay frozen. Any change of a 2.2 model's trace other than `profile` and `languageVersion` fails gate 2, which is the point: new trace information appears only for new syntax.
3. **WP1: places.** Reviewed for the language change only. Each package from WP1 on moves its rules from the drafts into the maintained chapters.

## Work packages

One draft PR at a time, each with an independent adversarial review, merged before the next starts.

| WP | Content | Needs | Showcase proof (fragments at `cc16c25`) |
| --- | --- | --- | --- |
| WP0 | ADRs 0022–0025, chapter drafts, this file, changelog | — | — |
| P0 | 2.2 PDF check to archive mode (tooling only); done | — | — |
| WP1a | Allocate the 2.3 candidate; compatibility gates 1–3 (done) | P0; the showcase models merged to main as `examples/showcase/*.swaml` (branch `showcase/all`); tool fixes A1, A2, A4 and A7 merged | — |
| WP1 | Places, indexed reads, test indexes | WP1a, A2 | `Dem.report`, `AlertRouter.findOpen`, twins test |
| WP2 | Conditional, contextual words, association lists | A1 | `DoorEcu::Types`, v2x `state`, cloud associations |
| WP3 | `Swaml::Numeric`, `Swaml::Text`, `Swaml::Time` | A2 | v2x `sqrt`, `ComMain` reception age |
| WP4 | Durations, `PolicySetting`, constant evaluator | WP3 | v2x hazard validity |
| WP5 | Completion, guarded timers, internal transitions, deferral | WP4 | v2x session, cloud breaker, door `LockControl` |
| WP6 | Sampled reads (update instant decided in ADR 0024), member policies; confirm SW2017 for sampled cells | WP5 | `ComMain` stores, `BodyCan` |
| WP7 | Release guards | WP4 (WP6 for the proof only) | `LinMaster`, `ComMain` |
| WP8 | Operation placement, `Swaml::Os`, T1–T7, ordering keys, binding schema and check | WP4, WP7, A4 | door deployment |
| WP9 | Edition: inventories, notation, figures, reference book, showcase rewrites, site data, PDF | WP1–WP8, A1, A7 | the three models |

**Consumers after WP1a.** A host passes the language version it selects: a consumer that passes `languageVersion` or `--language-version` 2.2 must switch to 2.3 when it syncs to a language revision at or after WP1a, because the 2.3 host rejects 2.2 as the 2.2 host rejected 2.1. A consumer that stays pinned to 2.2 keeps the 3.1.0 host at commit `213f583`. Consuming tools plan their own integration against the consequences sections of the ADRs. A tool must read and edit every pair of an association list before it accepts 2.3 sources.

Rule counts per package are in the [draft index](drafts/2.3/README.md#rules-per-work-package).

### Tool-fix prerequisites

These live on branch `fix/showcase-tool-defects`. They change no standard. All four are merged before WP1a records the gate fixtures, and in any case before the packages that need them:

| Fix | Defect | Needed by |
| --- | --- | --- |
| A1 | Formatter data loss and layout | WP2, WP9 (every new form must print before a showcase is reformatted) |
| A2 | Flow-sensitive stale-read warning SW2011 | WP1, WP3 (place writes and `now()`) |
| A4 | Per-model simulation options | WP8 (the door's 1 ms task) |
| A7 | `swaml test` text mode exhausts the V8 heap on a long door case while `--json` completes | WP9 |

## Publication checklist

Following [VERSIONING.md](VERSIONING.md) and [PDF_PUBLICATION.md](PDF_PUBLICATION.md). Nothing here is authorized by this draft.

1. Changes recorded under `## Unreleased` in `CHANGELOG.md`; standard and implementation changes kept apart.
2. `spec/standard.json` 2.3, edition module and profile reviewed; implementation 4.0.0 and lockfile synchronized (done in WP1a).
3. Inventories regenerated (`node scripts/build-inventories.mjs`):
   - new productions `Selector`, `ConditionalExpression`, `Deferral`, `MemberPolicy`;
   - changed `PolicySetting`, `Assign`, `ReferenceExpression`, `CallExpression`, `Literal`, `ExpressionStatement`, `Expression`, `Wait`, `Receive`, `ScheduleEntry`, `Transition`, `State`, `Connect`, `PortMember`, `Association`, `Name`.
4. All draft rules moved into maintained chapters; `docs/drafts/2.3/` emptied or removed; every 2.3 example a validated `swaml` fence or example file.
5. New figures under `docs/notation/2.3/`: Flow (completion, internal, deferral), Timing (guarded entry, Task lanes), Interconnect (member policy), General (operation placement). `python scripts/build-graphical-examples.py --check` and `python scripts/build-notation.py --check` pass.
6. `scripts/build-reference.mjs` lists ADRs 0022–0025 and `RELEASE_2_3`; `npm run docs:build` writes `docs/SWAML-2.3-Reference.md`.
7. Showcase rewrites of the three models; `node scripts/build-showcase-data.mjs`; light/dark responsive preview of the site.
8. Compatibility gates 1–3 and the complete `npm run check` on Node 26.12.0.
9. New `scripts/build-spec-pdf-2.3.py`, `scripts/check-spec-pdf-2.3.py` and `scripts/test-publication-2-3.py` (with the 2.2 source inventory generalized); `SWAML-2.3-Specification.pdf`, manifest and SHA-256; every page rendered and inspected; 2.2 checks in archive mode (done in P0).
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
