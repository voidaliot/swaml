# Contributing to SWAML

SWAML is developed as a language: specification, grammar, semantics, diagnostics and examples must evolve together. Start with the [language specification](docs/LANGUAGE_SPECIFICATION.md), [ownership decision](docs/decisions/0001-language-boundaries.md) and [implementation status](docs/IMPLEMENTATION_STATUS.md).

## Development setup

Use Node.js 22+ and npm 10.2.3+:

```sh
npm ci
npm run check
```

This generates the AST/TextMate files, compiles TypeScript, runs the test suite, validates the examples and checks documentation. Generated files, dependencies and compiled output are not committed. The dependency lockfile is committed.

## Propose a language change

Describe the actual modeling problem and a small before/after model. Identify the affected grammar productions, normative clauses, KerML representation, validation rules, view projections and migration behavior. Distinguish a new language feature from a new target-platform binding.

A proposal that adds cross-unit communication must identify the port/interface/member route. A proposal for an event must identify its declaration, emitting operation, receiving owner, delivery policy and failure behavior. A proposal for state or control flow must define ordering, concurrency and termination. Avoid accepting syntax before its semantics exists.

Breaking changes require a new language version and migration notes. Additive keywords can still break existing identifiers; document that impact. Record substantial decisions under `docs/decisions/`.

## Implement and test

1. Update the normative prose and grammar together.
2. Regenerate with `npm run langium:generate`; update scoping and validators as needed.
3. Add a valid model and a negative regression that would have caught the original issue. Cross-file changes need imported/qualified and ambiguous-name cases.
4. Update the user guide, affected examples, implementation matrix and changelog.
5. Run `npm run check` and report the result in the pull request.

Tests must verify observable language behavior, not copy the implementation's internal algorithm. Preserve malformed-input recovery: editor diagnostics must not crash the language server. New communication features need tests that attempts to bypass interfaces are rejected.

## Pull requests and review

Use a focused branch and describe the user-visible modeling behavior. Include a concise syntax/semantic example, the affected specification clauses, validation evidence and any remaining conformance gap. Do not describe a proposed feature as implemented merely because the grammar accepts it.

Reviewers should check that definitions and instances remain distinct, private data cannot escape through paths, all exchanges remain typed, and diagrams do not invent semantics. Compatibility or migration decisions should be explicit before merging.

## Documentation and standards

Link to primary sources for external standards. Write original explanations; do not copy standard PDFs or proprietary specification text into the repository. Preserve the existing MIT license for original code and documentation and retain any applicable third-party notices.

Executable `swaml` code fences must be complete, valid models: the documentation checker parses and validates them. Use inline snippets or `text` fences for deliberate fragments, and put intentionally invalid models under `examples/invalid/` with their expected diagnostic.

## Report a defect

Include the language/core version, a minimal model, exact CLI command or editor action, observed diagnostics and expected rule. For graphical work include the view ID and semantic subject path. For timing/delivery concerns state the target assumptions; a compiler acceptance result alone is not execution evidence.

Do not include credentials, private service URLs or production payloads in examples. Replace them with minimal synthetic values.
