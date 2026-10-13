# Decision 0003: stabilize the language with reproducible execution evidence

**Status:** accepted for SWAML 1.0.0, 2026-10-14.

The repository is the public language authority, not the VS Code extension implementation. Version 1.0 retains the bounded 0.1 construct set and promotes its clarified rules into explicit typing and operational judgments. The header changes to 1.0 so consumers cannot silently treat this edition as an old draft. Specification and package versions are aligned at 1.0.0; interface versions remain independent.

A small deterministic interpreter makes the language testable through observed behavior. It interprets all supported values, statements and state machines; it resolves the same interface routes checked statically. The execution binding deliberately uses zero local CPU cost and explicit transport delay, resource limits, timeout ties and fault schedules. These assumptions produce useful reproducible traces without claiming hardware scheduling proof or covering every possible schedule.

The full user-facing Markdown/PDF references provide two access paths: an alphabetical concern guide and all grammar keywords in alphabetical order. A machine-checked inventory prevents a new keyword from entering the grammar without a user-facing explanation. Maintained chapters, exact grammar and complete examples are assembled into the edition; generated files are checked for drift.

Browser and diagrams retain the established view vocabulary. Eight rendered examples demonstrate definition/occurrence identity, port-bound exchange, case partial order, grid properties and both FV forms. Their semantic subjects are resolved against real models; static illustrations do not imply that an editor has been implemented.

KerML mapping remains an explicit normative design contract requiring a separately implemented library/exporter and kernel validation before K conformance. The reference execution binding is independently testable without pretending that its Langium AST is a KerML serialization. Future production or editor backends must preserve the defined meaning rather than importing undocumented behavior from their frameworks.

Publication preserves the historical v0.1.0 tag/assets. Each 1.0 work item has a focused issue, resolution commit and acceptance evidence. A release-ready tag and draft package can be reviewed before a separate public release action. Once published, assets must not be silently replaced to change language meaning.
