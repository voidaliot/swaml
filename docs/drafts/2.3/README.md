# swa.ml 2.3 chapter drafts

**Status: draft for the unreleased standard 2.3. Not normative for any published edition.** These files state the changes that work packages WP1–WP8 make to the normative chapters. They are the checklist that implementers and reviewers tick off. The decisions behind them are [ADR 0022](../../decisions/0022-values-places-and-expressions.md), [ADR 0023](../../decisions/0023-state-reactions.md), [ADR 0024](../../decisions/0024-communication-and-package-links.md) and [ADR 0025](../../decisions/0025-real-time-placement-and-binding.md); the plan is in [the 2.3 release draft](../../RELEASE_2_3.md). Where a draft and an ADR differ, the ADR wins and the draft is corrected.

## Why separate files

The maintained chapters under `docs/spec/`, `docs/LANGUAGE_SPECIFICATION.md` and the other maintained guides are inputs of the published 2.2 edition. `scripts/build-reference.mjs --check` regenerates `docs/SWAML-2.2-Reference.md` from them and fails on any difference. The strict 2.2 PDF checker (`scripts/check-spec-pdf-2.2.py`, `scripts/publication_2_2_sources.py`) also requires every embedded source, including `docs/spec/*.md` and `src/**/*.ts`, to match the workspace. Unreleased 2.3 text in those files would either fail the gate or change the published 2.2 book. The drafts therefore mirror the chapter structure here until the 2.3 candidate is allocated.

## How a work package uses these drafts

1. The first implementing package (WP1) allocates the unreleased 2.3 candidate, following [VERSIONING.md](../../VERSIONING.md) and [the release draft](../../RELEASE_2_3.md#version-allocation):
   - `spec/standard.json` 2.3;
   - edition module, parser 2.3 and profile `swaml-reference/2.3`;
   - implementation 4.0.0 with a synchronized lockfile;
   - the 2.2 PDF checks switched to archive mode.

   From then on `npm run docs:build` writes `docs/SWAML-2.3-Reference.md`, and the published 2.2 book is no longer regenerated.
2. Each package moves the rules tagged with its number from these drafts into the maintained chapter named by the file and section, in the same PR as the implementation. It deletes them here, or marks them "moved", so the drafts always show what is still open.
3. **Fences.** Every swa.ml example in these drafts is a `text` fence, because complete `swaml` fences in documentation are executable fixtures validated against the current (2.2) implementation by `scripts/check-docs.mjs`. When a package lands a form, it turns the examples of that form into complete `swaml` fences in the maintained chapters, or into examples under `examples/`, so that they are validated.
4. The package regenerates the inventories it affects (`node scripts/build-inventories.mjs`), because `npm run check` verifies them for every changed production and keyword.

## Rule identifiers

Each normative rule has one identifier `WPn-Kxx`. `n` is the work package that implements it and `K` is its kind:

| Kind | Meaning |
| --- | --- |
| G | grammar production or token change |
| S | static validity rule |
| R | runtime rule of the reference execution contract |
| D | diagnostic: code, severity and message shape |
| T | trace observation |
| L | library content |
| M | model, normalization, projection, formatter or tool contract |

Each identifier is defined once, in the chapter that owns the rule. Other chapters cite it. Conformance rows (chapter 8) and formal schemas (chapter 9) restate rules for their audience; they carry a `[WPn]` tag but no identifier of their own. A rule is done when the implementing PR moves it into a maintained chapter, adds its tests and names the identifier in its review evidence.

## Files

| Draft | Maintained target |
| --- | --- |
| [Grammar delta](grammar.md) | `src/language/swaml.langium` |
| [1. Structure, names and types](01-structure-and-types.md) | `docs/spec/01-structure-and-types.md` |
| [2. Ports and communication](02-communication.md) | `docs/spec/02-communication.md` |
| [3. Operations, schedules and states](03-behavior.md) | `docs/spec/03-behavior.md` |
| [4. Deployment, cases, views and conformance](04-systems-and-conformance.md) | `docs/spec/04-systems-and-conformance.md` |
| [5. Proposed KerML mapping](05-kerml-mapping.md) | `docs/spec/05-kerml-mapping.md`, `spec/kerml-mapping.json` |
| [6. Execution contract](06-execution-contract.md) | `docs/spec/06-execution-contract.md` |
| [7. Normalized model](07-normalized-model.md) | `docs/spec/07-normalized-model.md` |
| [8. Conformance obligations](08-conformance-obligations.md) | `docs/spec/08-conformance-obligations.md` |
| [9. Formal semantics](09-formal-semantics.md) | `docs/spec/09-formal-semantics.md` |

`docs/LANGUAGE_SPECIFICATION.md` changes only its edition line, its section 2 sentence on dynamic topology (unchanged in meaning) and the inventory table rows for "State/transition" (completion, internal, deferral) and "Deployment/placement" (operation placements on `Swaml::Os` Tasks). WP9 makes these edits together with the edition switch.

## Rules per work package

Counted from the identifiers in these drafts (ten files). The count includes grammar and library entries.

| WP | Content | G | S | R | D | T | L | M | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WP1 | Places, indexed reads, test indexes | 3 | 8 | 4 | 7 | 1 | 0 | 3 | 26 |
| WP2 | Conditional, contextual words, association lists | 3 | 6 | 1 | 4 | 0 | 0 | 5 | 19 |
| WP3 | `Swaml::Numeric`, `Swaml::Text`, `Swaml::Time` | 0 | 2 | 3 | 1 | 0 | 4 | 1 | 11 |
| WP4 | Durations as values, `PolicySetting`, constant evaluator, gate | 4 | 8 | 2 | 6 | 1 | 0 | 8 | 29 |
| WP5 | Completion, timer guards, internal transitions, deferral | 3 | 10 | 12 | 9 | 4 | 0 | 4 | 42 |
| WP6 | Sampled reads, member policies | 2 | 9 | 6 | 8 | 1 | 0 | 5 | 31 |
| WP7 | Release guards | 1 | 3 | 7 | 2 | 2 | 0 | 3 | 18 |
| WP8 | Operation placement, `Swaml::Os`, T1–T7, in-task order, binding | 0 | 10 | 2 | 10 | 0 | 1 | 6 | 29 |
| | **All** | 16 | 56 | 37 | 47 | 9 | 5 | 35 | **205** |

The table is regenerated by counting `WPn-K` identifiers at the start of table rows. WP9 (edition) and the consuming-editor packages E1–E3 have no rule identifiers. Their work is listed in the release draft.
