# Changelog

## Unreleased

- Cancel undispatched inputs to terminated machines even behind unavailable FIFO messages, preventing false handler deadlines while preserving live-machine deadlines and delivery order (#15).

- Fix required boundary-port closure: internal leaf connections cannot satisfy unused outer aliases; external connection use propagates inward through every delegation (#14).

## 1.0.0 — 2026-10-14

- Stabilize the complete language with header 1.0 and aligned package/specification version. Add migration guidance and formal typing/execution transition rules.
- Implement a deterministic logical-time reference simulator covering the full expression/statement language, RPC, queues, snapshots, state reactions and explicit failures/resource limits.
- Add reproducible simulation configurations and expected results for all eight example systems, with trace evidence and behavioral/CLI regressions.
- Publish a complete user-facing Markdown/PDF reference, alphabetical concern guide and exhaustive 129-keyword index.
- Add eight source-linked vector examples for Browser, GV, IV, CV, SV, GRV and operation-flow/state FV.
- Keep VS Code extension implementation separate. Preserve the explicit limits on physical timing proof, kernel export and graphical-editor conformance.
- Resolve specification/publication issues #8–#12 through focused commits and checked evidence.

## Public release 0.1.0 — 2026-10-14

- Publish the initial GitHub release as `v0.1.0`, packaging the reviewed 0.1.1 draft/core revision below.
- Deliver the complete PDF book, embedded original sources, source manifest and SHA-256 checksum.
- Add the reproducible PDF builder, navigation/source/bounds verification and PDF CI gate.
- Preserve the `swaml "0.1";` header and existing conformance limitations.

## 0.1.1 — 2026-10-14

- Close the first specification audit with explicit operational, normalization and conformance chapters; cover all 80 grammar rule/type names in the checked mapping inventory.
- Define startup, backlog, snapshot, fanout, timer-generation and timeout-race behavior and required execution binding evidence.
- Enforce portable strings, cross-kind name ambiguity, Void completion rules, reserved failure scope and literal negative array bounds.
- Follow helper calls for reentrant mutation checks; validate case reply correlation, all view subject kinds, delegated required ports and expanded duplicate routes.
- Revalidate loaded models after cross-file updates, including new ambiguous declarations and string paths.
- Add a service-field/multiple-subscriber example and regression coverage. Language header stays `0.1`; previously accepted invalid inputs can now be rejected. See decision 0002 for draft compatibility policy.

## 0.1.0 — 2026-10-14

- Define the complete initial SWAML language draft, with a proposed KerML 1.0 semantic mapping and explicit conformance levels.
- Define components, units, value types, pure functions, operations, port contracts, delegation, sender–receiver, client–server, publish–subscribe and combined services.
- Specify control flow, stateful operations, queue/delivery/error semantics, timing contracts, deployment, cases and the six graphical views.
- Add a Langium 4.4 grammar, owner-aware scoping, initial semantic checks, CLI and LSP entry point.
- Add seven valid examples, invalid fixtures, tests, CI, user and contributor guides, architecture comparison and coding-agent instructions.

This is a language design/reference-core release. Kernel interchange, execution, graphical editors and an extension package are specified integration work, not implemented features.
