# ADR 0020: Associated software components in tests

Status: accepted for implementation in the unreleased 2.2 draft, 10 November 2026. Amends the white-box access clauses of ADR 0019. Published 2.1 artifacts remain unchanged.

[ADR 0021](0021-case-subject-calls.md) subsequently allows normal calls on the exact primary subject from both case kinds. It supersedes the primary-subject call/effect restrictions below; the additional test inspection/helper boundary remains unchanged.

## Context

The 2.1 test script can inspect only its primary subject and that subject's single parts. An integration spanning existing peer components therefore cannot inspect all of its explicitly associated participants. The owner selected existing associations as the access boundary, with neither new reference syntax nor case-owned components.

## Decision

A test may read attributes and directly call operations of its subject and explicitly associated software component occurrences of its own package, following single effective child occurrences. A root must actually execute in the package run and have a non-multiple identity. Association is a reference to that same occurrence, never containment, cloning or an instruction to select execution roots.

Use cases remain black-box. Both case kinds may act through associated interface-only actor ports, with ordinary direction, ownership and route rules. Associating an active component permits test inspection and eligible direct calls; it does not permit impersonating that component's ports or schedule. A test's direct calls may mutate the target through its operation but must neither communicate nor suspend. Direct attribute assignment remains forbidden. Reads borrow the target's live serial context; calls keep the existing lock and success-only output-copy rules. Multi-component reads do not constitute an atomic snapshot.

Value reads retain lexical local precedence. Dotted operation calls retain their existing occurrence-call namespace. Resolve inherited effective members and preserve exact occurrence identity, including when several references share a definition. An unassociated same-prefix name, an imported foreign occurrence, a platform root or an unindexed multiplicity family does not gain access.

The concrete grammar is unchanged. Existing `of`, `associate` and dotted expression paths carry this meaning. Nested/indexed association paths and intermediate component indexes remain unsupported. `of` remains required for a script; an empty case remains intent only. Every case still starts a fresh whole-package configuration, including unrelated startup work, and stops under the existing bounded result rules.

## Consequences

Shared semantic helpers expose the exact permitted roots and single-part lookup to consumers. Validator, completion, graphical editing and inspection must use that rule consistently. Test collaborators should retain their component identity; an association does not turn an implemented component into a fictional external actor. Presentation visibility is not an access permission.

This is a compatible normative addition with a new 2.2 draft edition, implementation 3.1.0 and `swaml-reference/2.2`. Hosts select 2.2 semantics even though the source grammar is unchanged. The published 2.1 book/PDF and its source attachments, notes, manifests and checksums are immutable. No 2.2 publication is authorized by implementation alone.

Validation includes accepted associated roots and inherited parts, rejected unassociated roots/use-case access/effectful calls, quoted names, lexical precedence, per-run store isolation, actual routed ten-component integration and exact occurrence evidence in consuming tools.
