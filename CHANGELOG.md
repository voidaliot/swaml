# Changelog

## 1.3.0 — 2026-10-18

- Add bounded counted for and post-test do loops, plus finite copied-array forEach with explicit lexical scopes.
- Add named interruptible regions in triggered serial flow functions, using existing typed input routes and same-activation cancellation/handlers.
- Cancel pending caller continuations without rollback or server cancellation; preserve timeout ties and late-response correlation.
- Add portable function timing projection and FV Timing/Interrupts showcase modes, separating declared contracts from observed logical phases.
- Add complete models, simulation evidence, positive/negative regressions and flat canonical notation for the new constructs.
- Remove personal attribution from maintained technical documents; state behavior and changes directly.

## 1.2.1 — 2026-10-18

- Use `of` for case root contexts and satisfaction design sources, matching compact view subjects; reject the former `for` and `by` relation spellings.
- Document the intentional patch migration and current 1.2 family/package revision selection. Preserve the published 1.2.0 artifacts.
- Correct requirement, case endpoint and multi-selection view descriptions; remove obsolete release-candidate wording.
- Synchronize grammar, examples, keyword/notation coverage, source-backed diagrams, showcase and publication artifacts; add imported/qualified, legacy-rejection and malformed-input regressions.

## 1.2.0 — 2026-10-16

- Add typed requirements, formal doc blocks, ordinary comment ownership, satisfy/verify relations and separate useCase/verificationCase declarations.
- Use lower camel case keywords throughout, including primitive types and view kinds; support multi-subject filtered view blocks.

- Scope calculations to their owning function, including states and guards; support copied return values from local functions.
- Use `call` for local and routed functions and case RPC steps; use `var` for private and local mutable values. Preserve typed routes, timeout/failure branches and activation isolation.
- Unify software ownership around nested components with private values, typed ports and local behavior, including composite/root-owned behavior.
- Replace executable operations with functions and old pure functions with typed-input, named-output `calc` declarations.
- Add single component specialization and compatible explicit member redefinition; preserve distinct inherited stores and explicit cross-component communication.
- Replace hardware node declarations with external system/part deployment identities resolved by the integration host.
- Add uint and byte value domains with checked integral conversion; preserve records, enums, fixed arrays and copied values.
- Version the reference execution binding as `swaml-reference/1.2`, migrate manual function inputs and add behavior/isolation/range regressions and a complete specialization example.
- Add reusable complete QoS policies with per-route queues, flat notation, graphical ontology, a source-linked walkthrough and a static React Flow showcase prepared for GitHub Pages.
- Provide a quick start, UML transition guide and complete Classic, Adaptive, web and cloud patterns with configured simulations.
- Document the deliberate migration from 1.1 and earlier unpublished 1.2 drafts. Preserve published historical editions and keep public guidance independent of specific authoring tools.

## 1.1.1 — 2026-10-14

- Complete canonical graphical concept catalog with paired graphical/textual notation, required labels, context and constraints.
- Original SVG and PNG representations, explicit keyword/grammar coverage, semantic example checks and reproducible exports.
- Expanded Markdown/PDF publication following the documented SysML v2 presentation conventions, preserving language 1.1 semantics and historical artifacts.

## 1.1.0 — 2026-10-14

- Keep `component def` and `unit def` as explicit reusable types; concrete root component usages replace `system`, including typed roots with separate deployment bindings.
- Author operation-owned states directly without `machine`; omit void results and the file header, and use ordinary assignments, calls, enum values and array literals.
- Pin the headerless 1.1 grammar at the host/CLI; document the deliberate 1.0 syntax migration requested for this minor release.
- Preserve interface-only communication, bounded control flow, typed contracts, runtime queues, RPC correlation, private stores, state timing and all graphical views.
- Migrate the complete normative/user-facing reference, examples, graphical figures and reference simulation profile; provide a full 1.1 Markdown/PDF edition and executable regression evidence.


- Cancel undispatched inputs to terminated machines even behind unavailable FIFO messages, preventing false handler deadlines while preserving live-machine deadlines and delivery order (#15).

- Fix required boundary-port closure: internal leaf connections cannot satisfy unused outer aliases; external connection use propagates inward through every delegation (#14).

## 1.0.0 — 2026-10-14

- Stabilize the complete language with header 1.0 and aligned package/specification version. Add migration guidance and formal typing/execution transition rules.
- Implement a deterministic logical-time reference simulator covering the full expression/statement language, RPC, queues, snapshots, state reactions and explicit failures/resource limits.
- Add reproducible simulation configurations and expected results for all eight example systems, with trace evidence and behavioral/CLI regressions.
- Publish a complete user-facing Markdown/PDF reference, alphabetical concern guide and exhaustive 129-keyword index.
- Add eight source-linked vector examples for Browser, gv, iv, cv, sv, grv and operation-flow/state fv.
- Define platform-neutral parser, CLI and language-server integration contracts. Preserve the explicit limits on physical timing proof, kernel export and graphical-editor conformance.
- Resolve specification/publication issues #8–#12 through focused commits and checked evidence.

## Public release 0.1.0 — 2026-10-14

- Publish the initial GitHub release as `v0.1.0`, packaging the reviewed 0.1.1 draft/core revision below.
- Deliver the complete PDF book, embedded original sources, source manifest and SHA-256 checksum.
- Add the reproducible PDF builder, navigation/source/bounds verification and PDF CI gate.
- Preserve the `swaml "0.1";` header and existing conformance limitations.

## 0.1.1 — 2026-10-14

- Close the first specification audit with explicit operational, normalization and conformance chapters; cover all 80 grammar rule/type names in the checked mapping inventory.
- Define startup, backlog, snapshot, fanout, timer-generation and timeout-race behavior and required execution binding evidence.
- Enforce portable strings, cross-kind name ambiguity, void completion rules, reserved failure scope and literal negative array bounds.
- Follow helper calls for reentrant mutation checks; validate case reply correlation, all view subject kinds, delegated required ports and expanded duplicate routes.
- Revalidate loaded models after cross-file updates, including new ambiguous declarations and string paths.
- Add a service-field/multiple-subscriber example and regression coverage. Language header stays `0.1`; previously accepted invalid inputs can now be rejected. See decision 0002 for draft compatibility policy.

## 0.1.0 — 2026-10-14

- Define the complete initial SWAML language draft, with a proposed KerML 1.0 semantic mapping and explicit conformance levels.
- Define components, units, value types, pure functions, operations, port contracts, delegation, sender–receiver, client–server, publish–subscribe and combined services.
- Specify control flow, stateful operations, queue/delivery/error semantics, timing contracts, deployment, cases and the six graphical views.
- Add a Langium 4.4 grammar, owner-aware scoping, initial semantic checks, CLI and LSP entry point.
- Add seven valid examples, invalid fixtures, tests, CI, user and contributor guides, architecture comparison and coding-agent instructions.

This is a language design/reference-core release. Kernel interchange, execution and graphical editors are specified integration work, not implemented features.
