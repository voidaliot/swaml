# Implementation status — 0.1.1

The normative draft defines the complete bounded 0.1 language. The repository implements the Langium parser, CLI, language-server foundation and broad static checking. It does not implement a runtime, KerML exporter or graphical editor. See the [audit report](SPECIFICATION_AUDIT.md) and [conformance obligations](spec/08-conformance-obligations.md).

## Implemented and tested

| Capability | Evidence |
| --- | --- |
| Complete grammar, portable string escapes, generated AST/TextMate syntax | generator, all examples, lexical regressions |
| Imports, qualified names, ambiguity across declaration kinds and owner-scoped references | multi-document and namespace tests |
| Interface member/role/signature checks; no cross-unit operation/data bypass | contract and isolation tests |
| Composition, delegation, required boundary/leaf closure, route uniqueness and cardinality | topology tests |
| Emitting-operation provenance and unique handler ownership | SW050/SW055 tests |
| Value typing, records/enums/arrays, expressions, pure functions, Void completion restrictions | values/flow and audit tests |
| Local calls, acyclic call/containment graphs, transitive reentrant write analysis | call-cycle and helper-effect tests |
| Explicit QoS, sampled buffering and idempotency declaration checks | QoS tests |
| Positive safe bounds, WCET/deadline/period consistency and realtime completeness | timing and numeric tests |
| Stateful signature, transition priorities, graph reachability, finality and unconditional-cycle checks | state tests |
| Deployment references, case direction/dependencies and unique causal reply correlation | allocation/case regressions |
| All six view subject categories, package and occurrence contexts | view regressions |
| Conservative workspace relink/revalidation after change/addition/deletion | editor update tests including newly ambiguous names |
| LSP initialize/diagnostics/shutdown and CLI exit behavior | integration tests |
| Production-to-spec/normalized mapping inventory | automatic coverage for all 80 grammar rule/type names |

`npm run check` rebuilds, runs tests, validates every example, checks documentation links and executable snippets, and detects missing/duplicate grammar mappings. Mapping coverage is a documentation consistency check, not a KerML validation result.

## Limits of static acceptance

The reference core checks the static groups listed in chapter 8; it remains labeled **S, partial V** until an independent conformance suite audits every normative clause and boundary case. It is not a model checker. Acceptance does not establish useful emissions, guard feasibility, case realization, idempotency of implemented effects, termination without runtime failure, schedulability, absence of request cycles, or snapshot support on a particular target.

General arithmetic ranges and computed array bounds are runtime checks. Guarded completion cycles are protected by a specified runtime limit. Activation backlog is bounded by a required execution binding. These are specified execution/analysis obligations, not unimplemented syntax disguised as successful static proof.

String-valued paths now receive conservative dependency invalidation. Path-aware rename, navigation, reference search and persisted editor IDs still need dedicated IDE providers. The all-document rebuild is correct for the loaded workspace but may be expensive on large projects.

## Specified, not implemented

| Capability | Remaining implementation |
| --- | --- |
| KerML K backend | versioned SWAML library, normalized mapper, kernel validation, reverse traces and round-trip tests |
| Execution E backend | frames, scheduler, state reactions, queues, snapshots, correlation, failures and evidence |
| Timing/behavioral analysis | target scheduling model, case witnesses, idempotency and safety/liveness evidence |
| Browser and graphical G workbench | projections, layout sidecars, Properties, validated source edits and undo |
| Complete IDE refactoring | path-aware rename/find references/navigation and stable identity map |
| VS Code package | language client activation, bundling, desktop/web entry points, commands and release pipeline |
| Platform exports | target bindings and serialization such as AUTOSAR ARXML |

No K, E or G conformance claim is made. These implementation milestones have complete language-side contracts; they are not necessary to claim that the 0.1 specification draft has defined its syntax and meaning.

## Intentionally outside 0.1

Inheritance/redefinition, generics, dynamic object creation, unbounded arrays, reference-valued payloads, hierarchical/orthogonal state regions, fork/join syntax, host-language code blocks, dynamic service discovery, runtime subscribe/unsubscribe, topic wildcards, exactly-once delivery, full requirements algebra and geometry require a versioned language proposal. They cannot be introduced as undocumented backend behavior.
