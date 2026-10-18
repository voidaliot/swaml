# ADR 0010 — Consistent subject relations

Status: accepted for SWAML 1.2.1. Date: 2026-10-18.

Subject-assignment relations consistently use `of`. The 1.2.0 grammar used case `for`, satisfaction `by` and compact-view `of` for analogous references. This patch corrects those spellings without changing their semantic targets, ownership or execution. Any future use of `for` is limited to loop syntax.

## Decision

Use `useCase Name of Root { ... }`, `verificationCase Name of Root { ... }`, `satisfy Requirement of Design.path;` and `view Name iv of Subject;`. View blocks continue to use `include` to select multiple subjects. A case's root context is a reference; the package still owns the case. Satisfaction still points from the design element to the requirement. Imports, qualified targets, duplicate checks and occurrence identity are unchanged.

The remaining relation vocabulary denotes different concepts: `on` selects an activation stimulus or deployment location; `as` binds a call result or completion; `:` denotes typing/header structure; `=` initializes or assigns values; arrows denote direction; `via` selects a route; `after` denotes a causal predecessor or timer. These constructs do not receive a general-purpose `of` alias.

The only current loop is bounded `while (...) bound n`. There is no `for` loop production in 1.2.1. The word `for` has no relation meaning; any future language use must be a separately specified loop construct. Removing `for` and `by` from current keyword coverage reflects the actual grammar, not an implementation of new loop syntax.

## Migration and version selection

Version 1.2.1 intentionally changes source compatibility after the 1.2.0 publication. The model meaning is preserved, but the parser rejects old case `for` and satisfaction `by` forms. Migration is contextual: change those delimiters to `of`, while preserving strings, ordinary prose, triggers, deployment locations and result bindings.

Hosts currently select the 1.2 language family. The package/release revision determines its concrete parser, so reproducible consumers must pin both. Use the archived 1.2.0 release to reproduce its earlier grammar. Published 1.2.0 Markdown, PDF, manifest, checksum, tag and release assets remain preserved. New artifacts have 1.2.1 filenames.

## Audit and evidence

The audit covers grammar keywords, semantic reference roles, keyword and notation inventories, current examples, source-backed showcase projections and maintained guides. It also corrects outdated descriptions of requirements, root-owned case endpoints, view selection unions and the published release status. Regressions cover positive `of` references, imported/qualified roots and requirements, alias duplicate satisfaction, rejected old spellings and malformed input. Existing simulations check that execution traces and stores remain unchanged.
