# Contributing to swa.ml

swa.ml 2.0 is a clean language restart. Read the [specification](docs/LANGUAGE_SPECIFICATION.md), [ADR 0016](docs/decisions/0016-swaml-2-0.md), [support matrix](docs/IMPLEMENTATION_STATUS.md) and the affected normative chapter. Published 1.x editions remain archived. This checkout does not convert or accept historical syntax.

Use Node.js 22+ and npm 10.2.3+:

```sh
npm ci
npm run check
```

The gate generates the AST/TextMate grammar, compiles TypeScript, runs the 2.0 language/runtime/host tests, validates examples and simulations, and checks maintained documentation, exhaustive inventories, generated references, diagrams and site sources. Generated parser files, out/, dependencies and bundles are not committed.

Routine CI runs that gate once on Node 22, the public-artifact boundary and version-policy tests,
and a production showcase build in the same job. Branch pushes with an open PR do
not launch a duplicate run. Node 24, Windows notation and PDF integrity checks are
in the `Publication and compatibility` workflow; run it before an edition release.
It also runs for PRs that change publication tooling or assets. Pages deployment
remains a separate manual action on the default branch. See the
[CI security audit](CI_SECURITY_AUDIT.md) for the tested boundaries and remaining
repository-setting recommendations.

The standard version is MAJOR.MINOR only and is owned by spec/standard.json. Implementation packages use independent npm SemVer. Read [the version policy](docs/VERSIONING.md) before changing either; existing published tags and artifact filenames remain intact.

A language proposal must identify concrete syntax, ownership, types, effects, failure behavior, runtime observations and normalization. Substantial changes need an ADR, changelog entry and support-matrix update. Every production needs a mapping entry; every keyword needs a reference and graphical/textual coverage. A proposed KerML mapping does not establish kernel conformance.

Implement grammar and prose together. Add a positive example and a negative regression, multi-file tests for name resolution, malformed-input tests for recovery, and trace/store tests for runtime changes. Run the complete gate. Never make an example pass by widening private scopes or inventing a communication route. Use small reviewable changes and stable SW2xxx codes.

Regenerate books with npm run docs:build. Complete swaml fences are validated examples; use text fences for fragments. Regenerate vectors and notation with the documented Python builders. Preserve the 1.x publication bytes. Publishing a new edition additionally requires [PDF review](docs/PDF_PUBLICATION.md). Site changes need a local light/dark responsive preview before publication.
