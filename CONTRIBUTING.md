# Contributing to swa.ml

swa.ml 2.2 is an unreleased draft with the unchanged 2.1 concrete grammar and an explicit associated-component test access rule. Read the [specification](docs/LANGUAGE_SPECIFICATION.md), [ADR 0020](docs/decisions/0020-associated-test-access.md), [support matrix](docs/IMPLEMENTATION_STATUS.md) and the affected normative chapter. Published editions, including the 2.1 reference and PDF, keep their original bytes.

Use the pinned Node.js 26.12.0 runtime from [.node-version](.node-version) and npm 10.2.3+ for local validation. The source confirmation job reads the same runtime file:

```sh
npm ci
npm run check
```

The gate generates the AST/TextMate grammar, compiles TypeScript, runs the language/runtime/host tests, validates examples and simulations, and checks maintained documentation, exhaustive inventories, generated references, diagrams and site sources. Generated parser files, out/, dependencies and bundles are not committed.

Start an independent adversarial review subagent before every PR and fix its actionable findings with reviewer verification. Run the complete gate, CI helper tests, workflow lint and the production showcase build locally before marking a draft PR ready. The single Linux Node 26 source job confirms only an explicit ready-for-review transition and the reviewed main merge. PR creation, pushes, synchronization and reopening do not allocate hosted testing; returning to draft cancels the ready run. Return to draft before every subsequent commit. `Publication and compatibility` is manual release acceptance; published 2.1 is checked in archive mode, and a future 2.2 release needs its own strict current-source PDF gate. Pages deployment remains separately manual. See the [CI security audit](CI_SECURITY_AUDIT.md).

The standard version is MAJOR.MINOR only and is owned by spec/standard.json. Implementation packages use independent npm SemVer. Read [the version policy](docs/VERSIONING.md) before changing either; existing published tags and artifact filenames remain intact.

A language proposal must identify concrete syntax, ownership, types, effects, failure behavior, runtime observations and normalization. Substantial changes need an ADR, changelog entry and support-matrix update. Every production needs a mapping entry; every keyword needs a reference and graphical/textual coverage. A proposed KerML mapping does not establish kernel conformance.

Implement grammar and prose together. Add a positive example and a negative regression, multi-file tests for name resolution, malformed-input tests for recovery, and trace/store tests for runtime changes. Run the complete gate. Never make an example pass by widening private scopes or inventing a communication route. Use small reviewable changes and stable SW2xxx codes.

Regenerate books with npm run docs:build. Complete swaml fences are validated examples; use text fences for fragments. Regenerate vectors and notation with the documented Python builders. Preserve the 1.x publication bytes. Publishing a new edition additionally requires [PDF review](docs/PDF_PUBLICATION.md). Site changes need a local light/dark responsive preview before publication.
