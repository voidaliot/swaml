# swa.ml 2.0 implementation status

**Standard:** 2.0 · **Implementation package:** 2.0.0 · **Parser:** 2.0 only · **Reference profile:** swaml-reference/2.0 · **Publication:** versioned reference edition.

The 2.0 core replaces the 1.x grammar, AST, resolver, validator and interpreter. It does not accept historical source. Published 1.x books, PDFs, manifests/checksums and historical figure files remain unchanged. [ADR 0016](decisions/0016-swaml-2-0.md) defines the restart; [conformance obligations](spec/08-conformance-obligations.md) separate syntax, validation, execution, analysis, kernel and graphical claims.

## Reference implementation

| Capability | Implemented evidence and boundary |
| --- | --- |
| Syntax and recovery | Normative Langium grammar, generated AST/TextMate, malformed input and retired-syntax rejection tests |
| Components and values | Single specialization, whole redefinition, usage bodies, typed roots, indexed multiplicity, private copied stores, nominal records/enums/arrays and checked domains |
| Operations | Definitions/usages, explicit returns, nested no-capture scope, expression calls, in/out, success-only copy-back, definite out assignment and acyclic calls |
| Effects and failures | Transitive write/read/communication/suspension flags, pure initializers, read-only guards, non-writing concurrency, lazy try and allowed suspension placement |
| Ports and routes | Per-member direction/reversal, structural compatibility with variance and individual diagnostics, connection/forwarding, closed roots, resolved cardinality and ownership/emission provenance |
| Policies | Versioned complete typed QoS definitions, Default/Latest/Reliable/BestEffort, per-use idempotency; occurrence/direction/member queues and latest attributes |
| Schedule and runtime | Start/every/receive/call/after entries, inherited entry replacement, dispatch copying, deadlines, lock release/reacquisition, live serial reads and concurrent snapshots |
| Flow and state | Loops and copied iteration, wait/receive, interruption across callees, ordered nested transitions, final completion and queued startup input |
| Correlation and adverse behavior | Routed results/out values, failures, timeout ties, terminal cancellation, late-reply suppression, policy overflow, age at eligibility and explicit resource limits |
| Deployment | Separate software/platform roots, Node-only contents/targets, indexed/family placements and most-specific selection |
| Requirements/cases/views | Immutable intent, routed named steps with causal replies, seven library definitions, package/member subjects and stable occurrence unions |
| AI authoring | Usage and AI guides, portable author/validate skills, --json diagnostics with code/range/URI/declaration/occurrence metadata and selected safe repair edits |
| Authoring services | Canonical token-preserving full-document formatting; semantic index, definition/references and versioned multi-file rename over indexed paths, port members, nested operations, schedules, states, placements, cases and view subjects/eligible filters |
| Host behavior | CLI exit/JSON/edition checks, LSP 2.0 negotiation, complete dependency enforcement, standard-library validation and workspace negative-lookup invalidation |
| Diagrams and page | Exhaustive notation/mapping inventories; original 2.0 SVG/PNG/scenes and source-subject checks; generated source/trace site data, seven interactive views, light/dark/system themes and responsive preview |

The unit suite exercises observable positive/negative language behavior, malformed recovery, final stores/traces and validated authoring edits. The example gate validates every current model, checks explicit expected stores and deterministic reruns. These are reference implementation tests, not an independent formal certification of all possible executions.

## Deliberate implementation limits

The reference validator expands at most 10000 component occurrences per concrete root and reports SW2013 above that host limit. This is a reference resource boundary, not a new mathematical language multiplicity restriction. Stale-read analysis is conservative and may warn after a safe recheck. Definite-return/out assignment is conservative. Formatter range/on-type operations are not implemented. A rename that introduces an error, changes any indexed reference binding, or cannot preserve selected view identities is refused; persistent editor sidecar identity/native undo belongs to the editor integration.

Math abs/min/max/concat are ordinary source; floor/round/trunc/length are explicitly documented host intrinsics with checked semantics. The interpreter uses zero physical CPU cost and one deterministic permitted order, with finite resources and recorded fault assumptions. It does not implement a production scheduler, real network reliability protocol or universal analysis.

No validated KerML exporter or executable KerML semantic library exists; chapter 5 and the mapping inventory remain a proposed contract. No XMI adapter, generic UML/SysML importer or graphical conformance certification is claimed. The adjacent editor has its own pin, source-edit, desktop/browser and package gates; its completion must be reported separately from a passing core suite.

The 2.0 standard, originally published under the legacy v2.0.0 tag, includes the production website and a separately versioned PDF under the [publication gate](PDF_PUBLICATION.md). Draft mockups are excluded. See the [review resolution](REVIEW_2_0.md) and [release notes](RELEASE_2_0_0.md); archived editions are never rebuilt from current sources.
