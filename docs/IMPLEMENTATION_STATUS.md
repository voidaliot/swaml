# Implementation status — 1.3.1

The 1.3.1 revision retains the bounded 1.3 parser family and `swaml-reference/1.3` simulation profile. Exact reproduction also pins the package revision. See [migration](MIGRATION_1_3_1.md) and [ADR 0012](decisions/0012-timing-view-and-structure-layouts.md). The repository implements the Langium parser, CLI, language-server foundation and broad static checking. It also implements a bounded logical-time reference simulator; it does not implement a production runtime, KerML exporter or graphical editor. See the [1.2 migration](MIGRATION_1_2.md), [historical 1.1 migration](MIGRATION_1_1.md), historical [1.0 evidence](RELEASE_1_0.md) and historical [0.1 audit](SPECIFICATION_AUDIT.md) and [conformance obligations](spec/08-conformance-obligations.md).

## Implemented and tested

Version 1.3.0 added counted for, copied-array forEach and post-test do loops, typed interruptible regions and portable trace-to-timing projection. The 1.3.1 revision gives timing its dedicated tv kind and GV its Box in box/Tree presentation layouts; FV retains flow, interruptible regions and states. Regression coverage checks scope, bounds, cancellation races, nested unwind, inactive input and source-backed diagram metadata. Graphical source editing and physical interrupt/timing guarantees remain outside the implementation.

| Capability | Evidence |
| --- | --- |
| Class/component and operation/function specialization, exact authored view kinds and compatible narrowing | category, inheritance, handler and runtime regressions; complete mixed example |
| Headerless 1.3 grammar, portable string escapes, generated AST/TextMate syntax | generator, all examples, lexical regressions |
| Unified components, local behavior in composite/root components, explicit definitions/instances, deployment-only typed bindings | component-model parser and simulation regressions |
| Single specialization and compatible explicit redefinition, with distinct inherited stores | reuse, cycle, contract and isolation regressions |
| Executable functions with direct states or statements; typed calc inputs and named pure output | parser, purity, shadowing and simulation regressions |
| Function-local calculation scope, value-returning local functions, unified call and var syntax | lexical isolation, state actions/guards, inherited results, copying/ranges, failures and malformed-input regressions |
| uint and byte domains with checked integral conversion | static constant-range and runtime range regressions |
| Imports, qualified names, ambiguity across declaration kinds and owner-scoped references | multi-document and namespace tests |
| Interface member/role/signature checks; no cross-component function/data bypass | contract and isolation tests |
| Composition, delegation, required boundary/leaf closure, route uniqueness and cardinality | topology tests |
| Emitting-function provenance and unique handler ownership | SW050/SW055 tests |
| Value typing, records/enums/arrays, expressions, calculations, void completion restrictions | values/flow and audit tests |
| Local calls, acyclic call/containment graphs, transitive reentrant write analysis | call-cycle and helper-effect tests |
| Named complete QoS policies and inline selections; imported/qualified resolution, effective-use validation and queue independence | 1.2 policy regressions |
| Explicit QoS, sampled buffering and idempotency declaration checks | QoS tests |
| Positive safe bounds, WCET/deadline/period consistency and realtime completeness | timing and numeric tests |
| Stateful signature, transition priorities, graph reachability, finality and unconditional-cycle checks | state tests |
| External system deployment identities, case direction/dependencies and unique causal reply correlation | allocation/case regressions |
| All seven view kinds and their subject rules; operation/function-only tv selections with explicit recursive filters | view regressions, including reserved-word, occurrence-path, invalid-subject/filter and parser-recovery cases |
| Dedicated TV timing and GV Box in box/Tree showcase layouts | source-checked function selections and trace provenance; layout preserves occurrence identities and typed topology |
| Conservative workspace relink/revalidation after change/addition/deletion | editor update tests including newly ambiguous names |
| LSP initialize/diagnostics/shutdown and CLI exit behavior | integration tests |
| Reference execution | all statements/expressions, startup/periodic activation, authored named-event input drivers, machines, queue policies, RPC, snapshots, fault injection and bounded trace evidence |
| Classic, Adaptive, web and cloud architecture examples | four complete models and configured simulations; six timeout, transport, duplicate-delivery and partial-fanout regressions |
| Graphical ontology and end-to-end modeling walkthrough | shared diagram inventory, reproducible flat SVG/vector scenes, parsed subject and source-excerpt checks, interactive stage navigation |
| Production-to-spec/normalized mapping inventory | automatic coverage for every current grammar rule/type name |

`npm run check` rebuilds, runs tests, validates every example, checks documentation links and executable snippets, and detects missing/duplicate grammar mappings. Mapping coverage is a documentation consistency check, not a KerML validation result.

The [canonical graphical catalog](GRAPHICAL_CATALOG.md) and its SVG/PNG exports define the visual language, with inventory coverage and semantic example checks. The current notation is entirely flat and reproducibly exported. `scripts/check-showcase.mjs` checks five interface patterns and four domain architectures against parsed definitions, occurrences, ports, routes and deployment allocations. The [quick start](QUICK_START.md), [architecture patterns](ARCHITECTURE_PATTERNS.md) and [UML transition guide](UML_GUIDE.md) provide authoring guidance. The [React Flow showcase](../showcase/README.md) implements selection, navigation, TV timing and GV Box in box/Tree layout interactions over curated checked-in models. It is an interactive presentation, not arbitrary graphical source editing; it makes no G conformance claim.

Operator and test stimuli use named interface events and explicit emitting functions/routes. The retired `on manual` trigger and simulator `manual` release option are rejected. Finite state/timer driver schedules and adverse input/transport cases are tested; see [the event guide](EVENTS_AND_INPUTS.md) and [ADR 0013](decisions/0013-event-driven-external-inputs.md).

## Limits of static acceptance

The reference core checks the static groups listed in chapter 8; it remains labeled **S, partial V** until an independent conformance suite audits every normative clause and boundary case. It is not a model checker. Acceptance does not establish useful emissions, guard feasibility, case realization, idempotency of implemented effects, termination without runtime failure, schedulability, absence of request cycles, or snapshot support on a particular target.

General arithmetic ranges and computed array bounds are runtime checks. Guarded completion cycles are protected by a specified runtime limit. Activation backlog is bounded by a required execution binding. These are specified execution/analysis obligations, not unimplemented syntax disguised as successful static proof.

string-valued paths now receive conservative dependency invalidation. Path-aware rename, navigation, reference search and persisted editor IDs still need dedicated IDE providers. The all-document rebuild is correct for the loaded workspace but may be expensive on large projects.

## Specified, not implemented

| Capability | Remaining implementation |
| --- | --- |
| KerML K backend | versioned SWAML library, normalized mapper, kernel validation, reverse traces and round-trip tests |
| Production E backend | physical CPU/scheduling, real middleware/serialization, platform clock/resource evidence and independent assessment; logical reference simulation is implemented |
| Timing/behavioral analysis | target scheduling model, case witnesses, idempotency and safety/liveness evidence |
| Browser and graphical G workbench | projections, layout sidecars, Properties, validated source edits and undo |
| Complete IDE refactoring | path-aware rename/find references/navigation and stable identity map |
| Platform exports | target bindings and serialization such as AUTOSAR ARXML |
| External system integration | resolve and validate deployment destinations, including SysML part identities; core checks local paths and reference syntax only |

No blanket K, E or G certification is claimed. The [reference simulation profile](SIMULATION.md) documents its executable scope and time abstraction. These implementation milestones have complete language-side contracts; specification coverage does not establish implementation conformance.

## UML notation and transformation

Class/component and operation/function categories are implemented using shared AST families with explicit authored kinds, compatible subtype direction and unchanged isolation/execution rules. The canonical catalog and showcase use ball/socket symbols for clientServer and service ports. The [UML transformation assessment](UML_COMPATIBILITY.md) documents compatible subsets and remaining semantic differences. No XMI adapter or general UML importer is implemented or planned by this edition.

## Intentionally outside 1.3

Multiple inheritance, generics, dynamic object creation, unbounded arrays, reference-valued payloads, hierarchical/orthogonal state regions, fork/join syntax, host-language code blocks, dynamic service discovery, runtime subscribe/unsubscribe, topic wildcards, exactly-once delivery, full requirements algebra and geometry require a versioned language proposal. They cannot be introduced as undocumented backend behavior.

## Requirements and selected views in 1.2.1

Implemented: typed requirement attributes; one raw formal documentation block per grammar owner; lexical-comment projection with owner/source extents; separate useCase and verificationCase; satisfy/verify target and duplicate checks; lower camel case primitive/view keywords; occurrence-preserving multi-subject views and typed Boolean predicates. The exported documentationText, modelComments, viewCandidates and selectView helpers are portable. Requirement links are claims; verification cases are not an automatic test runner. The showcase includes source-checked diagram/table projections.

## Relation syntax in 1.2.1

Cases and satisfaction claims use `of`, matching compact view subjects. Parsing rejects the former case `for` and satisfaction `by` spellings; qualified/imported targets and unchanged link orientation have regression coverage. Version 1.3 adds bounded for/do loops, finite copied-array iteration and serial interruptible flow regions. The current host selects 1.3 explicitly; use an archived 1.2 release for its exact grammar and profile.
