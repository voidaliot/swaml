# swa.ml 3.0 release preparation evidence

19 November 2026. Preparation of standard 3.0 with reference implementation 4.0.0 on the branch `release/final-package`. This preparation merges no source to main, creates no tag, uploads no asset and dispatches no publication or Pages workflow. A local build and local acceptance do not establish a publication.

## Scope of the preparation

- The edition name: 3.0 by [VERSIONING.md](VERSIONING.md) (an incompatible syntax change takes the next major number); the candidate was drafted as 2.3.
- The user command `swaml migrate`, the half-typed-state messages, the idiomatic examples and showcase, the complete 3.0 documentation, [ADR 0026](decisions/0026-states-in-the-flow.md), the [release notes](RELEASE_3_0.md), the [migration guide](MIGRATION_3_0.md) and the prepared 3.0 PDF tooling ([PDF_PUBLICATION.md](PDF_PUBLICATION.md)).

## Local acceptance

Pinned Node 26.12.0 on Windows, after `npm ci`:

- `npm run check` passes (1 min 56 s, after the review fixes): 783 unit tests; 62 complete examples validated with 11 documented warnings and both negative fixtures rejected; inventories, standard version 3.0 and lockfile; documentation with 6,315 local links, 520 checked anchors and 105 executable 3.0 fences; 181 example use cases and tests with their expected results; gate 1 (38 recorded 2.2 sources with identical ASTs, references, diagnostics, types and projections); gate 2 (46 of 46 recorded runs and cases, 0 differences); the nine extended 2.2 sets (0 differences); gate B (113 of 114 migrated machine results identical, the one difference the accepted r10); gate C (the four pinned models of r10 and C-3); the 3.0 reference and keyword reference; worked diagrams, notation (26 concepts, 107 grammar/type families, 86 keywords), site data, modeling overview, public content (990 files), frozen publications (33 published files of 11 editions, 241 frozen copies), traceability and timing demos.
- `node --test test/ci/*.test.mjs`: 61 of 61 pass, including the `swaml migrate` command tests, the migrator tests, the accepted-differences and compatibility-fixture pins, the frozen-publication and local review policies.
- Mutation checks of the new logic (`node scripts/mutations-sif2.mjs`): MC1 to MC9 (`swaml migrate`: a dry run that writes, a refusal that does not fail, an invalid result written, no directory walk, a wrong guard spelling, a partial write on an I/O failure, lost CRLF line ends, a file named twice migrated twice, a refusal at the wrong grammar) and RC1 to RC9 (state recovery and messages, the token pass for half-typed forms, the 2.2-syntax check at member starts) are killed; the migrator mutations B1 to B6, R1-M1, R1-M3, R5-N1 and R5-N1b were re-anchored to the build output of `src/migrate/machines.ts` (B1, B4 and R1-M1 verified killed after the move).
- The door-controller showcase: all 36 cases keep their verdicts and final stores against the text migrated from 2.2 (gate D: identical traces apart from the parents' state observations; gate F: identical sends and writes of the heater and the supply monitor), and a test pins the showcase as exactly that text with the three rewrites.
- `amendments.json` stays empty; no recorded 2.2 fixture was edited or re-recorded; the rule index counts 214 rules, unchanged.

## Independent adversarial review

An independent reviewer checked `beea042` (the range from main `eb184c5`) against the semantic contracts and the code with 25 minimal models, 40 migrated machine fixtures and example mutations. No blocker. Findings and their resolution:

- **M1** (half-typed forms lost the rest of the package; the `or` message did not fire for `on receive p.m() or receive p.k()`; no hint for `when (c)` in a state): a token pass before parsing reports one message for each form and keeps the schedule, later components and connections, asserted in the AST by tests; `when (c)` is read as `if`. Mutations RC5 to RC8.
- **M2** (example 46 passed with the half-open success leading to Open): a second arrival after the successful probe must be written.
- **m1** broken anchors: fixed; `check-docs` now verifies anchors. **m2** ADR history restored (accepted for 2.3, released as 3.0). **m3** chapters 3.6 and 4.4 carry the SIF-D01 messages and the migration recipe themselves. **m4** CHANGELOG names `swaml migrate`. **m5** `x = final` before a state is the missing `;` (RC9). **m6** `to ;` reports only SW2008; no follow-on error for a state in `on entry`. **m7** refusals at the right grammar's first error with the whole message (MC9). **m8** all-or-nothing writes on I/O failure (MC6). **m9** CRLF kept (MC7). **m10** one file in two spellings migrated once (MC8). **m11** `@swaml/language/migrate` exported and tested; renamed exports listed; `--language-version 2.3` names 3.0; `before3_0` means major < 3. **m12** examples 47, 54, 55, 56 gained cases or boundaries; every listed mutation now fails a case. **m13** 46's always-true `t >= 0` removed.

## Not done locally, and why

- **Figures and PDF.** The Python figure builders and the PDF tools need Pillow, reportlab, pypdf and pdfplumber (`scripts/ci-pdf-requirements.txt`), which were not installed in the preparation environment. The figures under `docs/figures/3.0` and `docs/notation/3.0` are the 2.3 figures moved to 3.0 paths; their inputs (examples 02, 04, 17, 22, 25 and 26, the notation inventory and the renderer) did not change, and `check-graphical-examples.mjs`, `check-notation.mjs` and `check-modeling-overview.mjs` pass. The 3.0 PDF builder, checker and publication test are syntax-checked only. The first publication run must build, check and inspect them (publication checklist in the release notes).
- **Hosted CI** was not used; source CI runs only at the reviewed ready-for-review transition.
