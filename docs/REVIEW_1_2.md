# SWAML 1.2 architecture usability review

Review scope: simpler software architecture modeling, flat graphics, complete ontology/views, an interactive React Flow showcase, GitHub presentation, and familiarity for UML architects. This is an engineering review of the local edition, not an independent conformance certification.

## Findings and changes

| Finding | Assessment | Resolution |
| --- | --- | --- |
| Repeated connector policy text | Named complete policies reduce real authoring repetition without changing route semantics. | Retain `qos def` and effective-use validation. |
| 3D execution-node graphics | Conflicted with the flat-only requirement. | Flat canonical frames and reproducibility checks already implemented. |
| Showcase demonstrated only service communication | Did not explain the full interface vocabulary. | Add five selectable source-backed patterns covering all four interface kinds, including sampled/queued data. |
| Promotional headings and decorative presentation | Too informal for architecture review. | Use restrained typography, structured contract compartments, exact names and reference-oriented copy. |
| Familiar names concealed semantic differences | cv is not a UML use-case model; service arrows also carry reverse traffic. | Add a UML transition guide, traffic/cardinality table and explicit projection explanations. |
| Manual diagram metadata could drift | Build success alone does not prove agreement with the language model. | Parse fixture sources and check catalog contract kinds, port roles, connector endpoints and effective policies in the language gate. |
| Generic diagnostics for incorrect roles or missing QoS | Rejection did not explain the repair in familiar architectural terms. | Include legal roles/orientation and inline or named policy choices, preserving diagnostic codes. |
| Tool-specific planning in public guidance | Coupled the language reference to an unrelated implementation project. | Keep parser, CLI, LSP and browser-host guidance independent; check maintained sources and PDF content, navigation and attachments for regressions. |
| Platform examples were too general | Architects could not follow a complete Classic, Adaptive, web or cloud design through validation and execution. | Add four complete models, configured simulations, adverse-path tests and inspectable source-backed architecture diagrams. |
| Profile, deployment and platform mapping could be confused | A service profile is a timing choice; placement alone supplies no middleware or platform guarantees. | Clarify those distinctions in chapters 4 and 6, with explicit activation, value-conversion, transport and lifecycle mapping obligations. |
| Entry guidance assumed familiarity with the language | New users needed a short route from a contract to a running example. | Add a landing-page quick start and linked architecture-pattern guide. |

## Language decision

The 1.2.0 release uses a unified component boundary and component-owned functions. Pure calculations declare typed inputs and a named output. Single specialization and compatible redefinition support reuse; deployment refers to external systems or parts. [ADR 0007](decisions/0007-component-functions-and-calculations.md) records this revision and supersedes the earlier split ownership model.

Retain explicit interface kind/version and port role: they identify interaction semantics. Retain explicit QoS selection: omitted policies would hide queue and failure decisions. Retain mandatory handler ownership and emitter provenance: weakening them would let an incomplete implementation pass as a closed architecture. Contract-only libraries provide an existing first step without pretending an unimplemented root is executable.

Multiple inheritance, abstract executable stubs, collections of parts, hierarchical states, true UML use-case relations and graphical source editing need separate proposals with semantics and evidence. They are future design topics, not silently accepted 1.2 capabilities. Familiarity is delivered through concept correspondence, notation and workflow; it does not imply UML interchange or conformance.

## Review evidence

The executable acceptance gates are `npm run check`, `npm --prefix showcase run build`, both figure generator check modes, and the PDF workflow. The language gate includes `scripts/check-showcase.mjs`, which resolves every displayed pattern against the actual parser/validator. Manual browser checks must cover all pattern selectors, endpoint inspection, full source expansion, all seven existing surfaces and narrow layouts. The [release record](RELEASE_1_2_0.md) records completed verification and publication status.

The platform review preserves the fixed instance topology, copied payloads, typed routes, private stores and explicit failure behavior. It does not add platform-specific keywords. The architecture guide records which decisions belong in the model and which require a target binding; reference simulations check bounded logical behavior under their supplied options.
