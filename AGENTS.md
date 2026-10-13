# Instructions for agents working on SWAML

## Read first

- `docs/LANGUAGE_SPECIFICATION.md` and the normative chapter affected by the task.
- `docs/IMPLEMENTATION_STATUS.md` to distinguish specified and implemented behavior.
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

## Source and architecture

The normative concrete grammar is `src/language/swaml.langium`. Prose specifies validity and semantics. Update both when meaning changes. Generated files in `src/language/generated/`, TextMate output and `out/` must not be hand-edited or committed.

Keep the language core free of Node filesystem dependencies; CLI/server adapters own platform I/O. Composite paths currently use explicit semantic resolution and need path-aware IDE services. Do not claim generic Langium rename covers them.

KerML mapping is a proposed contract until a real exporter and kernel validation exist. Do not label Langium AST generation as KerML conformance. Likewise do not call an accepted model schedulable, race-free, executable or graphically editable without the corresponding implementation/evidence.

## Required checks

For grammar, semantic or source changes run `npm run check`. Use `npm ci` after dependency changes or on a fresh checkout. Add meaningful positive and negative tests for changed language rules, including malformed input when parser recovery is affected. Report failures honestly and fix regressions within the task scope.

For documentation changes run `node scripts/check-docs.mjs` after a build. Complete `swaml` fences are executable fixtures; deliberate fragments should use inline text or a `text` fence.

## Working practices

Prefer small, reviewable changes with stable diagnostic codes. Add a decision record for substantial language changes and update the changelog and implementation matrix. Do not silently widen access scopes to make a fixture pass.

Preserve the existing license, unrelated user edits and repository history. Never add credentials or downloaded proprietary standards. Use primary-source links and original analysis. Follow the user's authorization for GitHub changes; local edits alone do not imply permission to publish a release or alter another repository.
