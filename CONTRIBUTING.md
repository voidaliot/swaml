# Contributing to SWAML

SWAML is developed as a language: specification, grammar, semantics, diagnostics and examples must evolve together. The 1.2 syntax keeps explicit `def` declarations and distinguishes them from concrete component usages; named QoS policies reuse complete values while connector queues stay independent. Source files are headerless; a host must pin language 1.2. Read the [1.2 migration](docs/MIGRATION_1_2.md) when updating hosts and the [historical 1.1 migration](docs/MIGRATION_1_1.md) when converting 1.0 models.

Start with the [language specification](docs/LANGUAGE_SPECIFICATION.md), [ownership and reuse decision](docs/decisions/0007-component-functions-and-calculations.md) and [implementation status](docs/IMPLEMENTATION_STATUS.md).

## Development setup

Use Node.js 22+ and npm 10.2.3+:

```sh
npm ci
npm run check
```

This generates the AST/TextMate files, compiles TypeScript, runs the test suite, validates the examples and checks documentation. Generated files, dependencies and compiled output are not committed. The dependency lockfile is committed.

## Propose a language change

Describe the actual modeling problem and a small before/after model. Identify the affected grammar productions, normative clauses, KerML representation, validation rules, view projections and migration behavior. Distinguish a new language feature from a new target-platform binding.

A proposal that adds cross-component communication must identify the port/interface/member route. A proposal for an event must identify its declaration, emitting function, receiving owner, delivery policy and failure behavior. A proposal for state or control flow must define ordering, concurrency and termination. Avoid accepting syntax before its semantics exists.

Published breaking changes require a new language version and migration notes. The unpublished 1.2 release candidate includes the owner-approved component/function/calculation revision; its migration guide records the changes from earlier 1.2 drafts and 1.1. Additive keywords can still break existing identifiers; document that impact. Record substantial decisions under `docs/decisions/`.

## Implement and test

1. Update the normative prose and grammar together.
2. Update the grammar mapping inventory and classify each obligation as static, runtime, analysis, kernel or graphical. Every rule/type needs a normative home. Regenerate with `npm run langium:generate`; update scoping and validators as needed.
3. Add a valid model and a negative regression that would have caught the original issue. Cross-file changes need imported/qualified and ambiguous-name cases.
4. Update the keyword inventory, user guide, affected examples, simulation configurations, graphical projections, implementation matrix and changelog. Regenerate the complete reference with `npm run docs:build`.
5. Run `npm run check` and report the result in the pull request.

Tests must verify observable language behavior, not copy the implementation's internal algorithm. Preserve malformed-input recovery: editor diagnostics must not crash the language server. New communication features need tests that attempts to bypass interfaces are rejected.

## Pull requests and review

Use a focused branch and describe the user-visible modeling behavior. Include a concise syntax/semantic example, the affected specification clauses, validation evidence and any remaining conformance gap. Do not describe a proposed feature as implemented merely because the grammar accepts it.

Reviewers should check that definitions and instances remain distinct, private data cannot escape through paths, all exchanges remain typed, and diagrams do not invent semantics. Compatibility or migration decisions should be explicit before merging.

## Documentation and standards

Link to primary sources for external standards. Write original explanations; do not copy standard PDFs or proprietary specification text into the repository. Preserve the existing MIT license for original code and documentation and retain any applicable third-party notices.

Executable `swaml` code fences must be complete, valid models: the documentation checker parses and validates them. Use inline snippets or `text` fences for deliberate fragments, and put intentionally invalid models under `examples/invalid/` with their expected diagnostic.

## Resolve specification issues

Track a concrete contradiction, missing semantic choice or validator defect as a GitHub issue with acceptance criteria. Resolve it with matching normative text, implementation where in scope, examples and regression evidence. Close the issue only when its stated criteria are met; do not close runtime/editor implementation work because a specification paragraph exists. Link the resolution commit or merged pull request and record any remaining conformance limitation.

## Report a defect

Include the language/core version, a minimal model, exact CLI command or editor action, observed diagnostics and expected rule. For graphical work include the view ID and semantic subject path. For timing/delivery concerns state the target assumptions; a compiler acceptance result alone is not execution evidence.

Do not include credentials, private service URLs or production payloads in examples. Replace them with minimal synthetic values.

## Graphical notation changes

Update the graphical contract and `spec/notation.json` together. A concept must identify its semantic owner, required labels, shape or edge grammar, textual example and applicable views. Classify syntax that has no independent glyph explicitly. Generate original SVG and PNG representations from the shared scene geometry with `scripts/build-notation.py`; verify coverage and exports before editing the full publication. Read the [presentation review](docs/SYSML_STYLE_REVIEW.md) for the adopted document style.

## Publication changes

The source chapters and `spec/keywords.json` are maintained inputs. The complete Markdown and keyword reference are generated. Run `npm run docs:build` after editing those inputs. Figure changes require `python3 scripts/build-graphical-examples.py` and semantic subject checks; commit SVG and scene pairs together. Do not silently edit one rendition.

For an edition, follow [the PDF workflow](docs/PDF_PUBLICATION.md): build, verify exact source attachments and hashes, render all pages, and visually inspect figures, code, tables and navigation. Attach the full Markdown, PDF, manifest and checksum to the prepared release. A public release is a separate explicit publication action; a release-ready commit/tag or draft preserves reviewability.

Simulator changes must retain the [profile contract](docs/SIMULATION.md) or introduce a new named profile/version. Include a trace-level regression and record configuration/source identity. Review timeout ties, partial fanout, stale timers, queue limits and snapshot behavior whenever communication or dispatch changes. Never equate a bounded successful run with physical schedulability or a proof of all possible executions.
