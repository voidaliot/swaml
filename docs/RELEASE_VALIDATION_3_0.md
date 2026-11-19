# swa.ml 3.0 release preparation evidence

19 November 2026. Preparation of standard 3.0 with reference implementation 4.0.0 on the branch `release/final-package`. This preparation merges no source to main, creates no tag, uploads no asset and dispatches no publication or Pages workflow. A local build and local acceptance do not establish a publication.

## Scope of the preparation

- The edition name: 3.0 by [VERSIONING.md](VERSIONING.md) (an incompatible syntax change takes the next major number); the candidate was drafted as 2.3.
- The user command `swaml migrate`, the half-typed-state messages, the idiomatic examples and showcase, the complete 3.0 documentation, [ADR 0026](decisions/0026-states-in-the-flow.md), the [release notes](RELEASE_3_0.md), the [migration guide](MIGRATION_3_0.md) and the prepared 3.0 PDF tooling ([PDF_PUBLICATION.md](PDF_PUBLICATION.md)).

## Local acceptance

Pinned Node 26.12.0 on Windows, after `npm ci`:

- `npm run check` passes (1 min 54 s): 776 unit tests; 62 complete examples validated with 11 documented warnings and both negative fixtures rejected; inventories, standard version 3.0 and lockfile; documentation with 6,305 local links and 104 executable 3.0 fences; 179 example use cases and tests with their expected results; gate 1 (38 recorded 2.2 sources with identical ASTs, references, diagnostics, types and projections); gate 2 (46 of 46 recorded runs and cases, 0 differences); the nine extended 2.2 sets (0 differences); gate B (113 of 114 migrated machine results identical, the one difference the accepted r10); gate C (the four pinned models of r10 and C-3); the 3.0 reference and keyword reference; worked diagrams, notation (26 concepts, 107 grammar/type families, 86 keywords), site data, modeling overview, public content (989 files), frozen publications (33 published files of 11 editions, 241 frozen copies), traceability and timing demos.
- `node --test test/ci/*.test.mjs`: 56 of 56 pass, including the `swaml migrate` command tests, the migrator tests, the accepted-differences and compatibility-fixture pins, the frozen-publication and local review policies.
- Mutation checks of the new logic (`node scripts/mutations-sif2.mjs`): MC1 to MC5 (`swaml migrate`: a dry run that writes, a refusal that does not fail, an invalid result written, no directory walk, a wrong guard spelling) and RC1 to RC4 (state recovery and messages) are killed; the migrator mutations B1 to B6, R1-M1, R1-M3, R5-N1 and R5-N1b were re-anchored to the build output of `src/migrate/machines.ts` (B1, B4 and R1-M1 verified killed after the move).
- The door-controller showcase: all 36 cases keep their verdicts and final stores against the text migrated from 2.2 (gate D: identical traces apart from the parents' state observations; gate F: identical sends and writes of the heater and the supply monitor), and a test pins the showcase as exactly that text with the three rewrites.
- `amendments.json` stays empty; no recorded 2.2 fixture was edited or re-recorded; the rule index counts 214 rules, unchanged.

## Not done locally, and why

- **Figures and PDF.** The Python figure builders and the PDF tools need Pillow, reportlab, pypdf and pdfplumber (`scripts/ci-pdf-requirements.txt`), which were not installed in the preparation environment. The figures under `docs/figures/3.0` and `docs/notation/3.0` are the 2.3 figures moved to 3.0 paths; their inputs (examples 02, 04, 17, 22, 25 and 26, the notation inventory and the renderer) did not change, and `check-graphical-examples.mjs`, `check-notation.mjs` and `check-modeling-overview.mjs` pass. The 3.0 PDF builder, checker and publication test are syntax-checked only. The first publication run must build, check and inspect them (publication checklist in the release notes).
- **Independent adversarial review** of this preparation is the next step and is not part of this evidence.
- **Hosted CI** was not used; source CI runs only at the reviewed ready-for-review transition.
