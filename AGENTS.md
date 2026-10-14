# Instructions for agents working on SWAML

## Read first

- `docs/LANGUAGE_SPECIFICATION.md` and the normative chapter affected by the task.
- `docs/IMPLEMENTATION_STATUS.md` to distinguish specified and implemented behavior.
- `docs/spec/06-execution-contract.md`, `07-normalized-model.md`, `08-conformance-obligations.md` and `09-formal-semantics.md` for execution, mapping and evidence boundaries.
- `docs/decisions/0001-language-boundaries.md` for the owner's accepted architecture choices.
- `CONTRIBUTING.md` for contribution and validation expectations.

## Preserve the language invariants

- Components compose units/components. Units own private data, functions and operations. Operations own statement flow or states directly.
- No performers, separate action allocations, global mutable state or free events.
- Every exchange between distinct units/components uses an owned typed port, interface member and explicit connector/delegation route.
- Local calls/data may stay inside a unit. Never resolve a local operation or function from a different unit as a convenience fallback.
- Outgoing events/data must be tied to emitting operations; incoming members must have one handler owner. Service responses remain correlated through their interface route.
- Keep Browser, GV, IV, CV, SV, GRV and FV. No GEV; AFV/STV are unified as FV.
- Distinguish definition identity from instance paths. Never make same-type instances share private state.

## SWAML 1.1 authoring contract

Keep `component def` and `unit def` for reusable types. A top-level component usage is an execution root; it may contain inline topology or instantiate a component definition with optional deployment bindings. Typed roots cannot extend topology. Every concrete root is checked for closure, independently of reusable library definitions. Omitted root profile means service; omitted operation/signature result means Void. Functions still require an explicit non-Void result.

Files are headerless and interpreted by the explicitly selected 1.1 parser/host. Do not restore `swaml`, `system`, `machine`, `set`, `compute`, `array` or `enumValue` as required markers. States are directly authored inside an operation's body; the StateBody AST grouping has no separate executable identity. Preserve the documented ambiguity rules for enum values and local records. Historical tagged syntax requires migration, not silent fallback.

## Source and architecture

The normative concrete grammar is `src/language/swaml.langium`. Prose specifies validity and semantics. Update both when meaning changes. Generated files in `src/language/generated/`, TextMate output and `out/` must not be hand-edited or committed.

Keep the language core free of Node filesystem dependencies; CLI/server adapters own platform I/O. Composite paths currently use explicit semantic resolution and need path-aware IDE services. Do not claim generic Langium rename covers them.

KerML mapping is a proposed contract until a real exporter and kernel validation exist. Do not label Langium AST generation as KerML conformance. Likewise do not call an accepted model schedulable, race-free, executable or graphically editable without the corresponding implementation/evidence.

## Required checks

For grammar, semantic or source changes run `npm run check`. Use `npm ci` after dependency changes or on a fresh checkout. Add meaningful positive and negative tests for changed language rules, including malformed input when parser recovery is affected. Report failures honestly and fix regressions within the task scope.

For documentation changes run `node scripts/check-docs.mjs` after a build. Complete `swaml` fences are executable fixtures; deliberate fragments should use inline text or a `text` fence.

## Working practices

Prefer small, reviewable changes with stable diagnostic codes. Keep every grammar rule/type covered in `spec/kerml-mapping.json`; the documentation checker enforces coverage. Add a decision record for substantial language changes and update the changelog and implementation matrix. Do not silently widen access scopes to make a fixture pass.

Preserve the existing license, unrelated user edits and repository history. Never add credentials or downloaded proprietary standards. Use primary-source links and original analysis. Follow the user's authorization for GitHub changes; local edits alone do not imply permission to publish a release or alter another repository.

## Reference execution and publication

Keep the reference simulator portable: file access and source hashing belong to CLI/host adapters. Preserve the documented scheduler, timeout ties, queue identity, copied values, snapshot scope, direct operation/state ownership and explicit resource failures. Test observable traces and final stores, including adverse cases. A simulator run is not production scheduling proof or universal verification.

Maintain every current keyword entry in `spec/keywords.json` as the grammar evolves. Regenerate the consolidated Markdown with `npm run docs:build`; do not hand-edit generated `KEYWORD_REFERENCE.md` or `SWAML-1.1.0-Reference.md`. Regenerate vector examples with `python3 scripts/build-graphical-examples.py`. Their scene/SVG sources and model-subject manifest must stay synchronized.

Before publishing an edition, run the complete language gate, figure reproducibility check and PDF build/check described in `docs/PDF_PUBLICATION.md`, then render and inspect every page. Commit synchronized Markdown, PDF, manifest and checksum. Preserve published historical assets. Keep the VS Code extension implementation outside this language repository.
