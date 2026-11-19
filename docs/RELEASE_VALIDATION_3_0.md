# swa.ml 3.0 release preparation evidence

19 November 2026. Preparation of standard 3.0 with reference implementation 4.0.0 on the branch `release/final-package`. This preparation merges no source to main, creates no tag, uploads no asset and dispatches no publication or Pages workflow. A local build and local acceptance do not establish a publication.

## Scope of the preparation

- The edition name: 3.0 by [VERSIONING.md](VERSIONING.md) (an incompatible syntax change takes the next major number); the candidate was drafted as 2.3.
- The user command `swaml migrate`, the half-typed-state messages, the idiomatic examples and showcase, the complete 3.0 documentation, [ADR 0026](decisions/0026-states-in-the-flow.md), the [release notes](RELEASE_3_0.md), the [migration guide](MIGRATION_3_0.md) and the prepared 3.0 PDF tooling ([PDF_PUBLICATION.md](PDF_PUBLICATION.md)).

## Local acceptance

PENDING: filled from the final runs.

## Not done locally, and why

- **Figures and PDF.** The Python figure builders and the PDF tools need Pillow, reportlab, pypdf and pdfplumber (`scripts/ci-pdf-requirements.txt`), which were not installed in the preparation environment. The figures under `docs/figures/3.0` and `docs/notation/3.0` are the 2.3 figures moved to 3.0 paths; their inputs (examples 02, 04, 17, 22, 25 and 26, the notation inventory and the renderer) did not change, and `check-graphical-examples.mjs`, `check-notation.mjs` and `check-modeling-overview.mjs` pass. The 3.0 PDF builder, checker and publication test are syntax-checked only. The first publication run must build, check and inspect them (publication checklist in the release notes).
- **Independent adversarial review** of this preparation is the next step and is not part of this evidence.
- **Hosted CI** was not used; source CI runs only at the reviewed ready-for-review transition.
