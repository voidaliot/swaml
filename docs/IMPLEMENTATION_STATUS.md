# Implementation status — 0.1.0

The language specification is a complete draft of the bounded 0.1 language. The repository is a working parser/LSP/validator foundation, **not** a completed editor or runtime. A clean `npm run check` verifies the capabilities below.

## Implemented

| Capability | Evidence |
| --- | --- |
| All concrete grammar productions; generated AST and TextMate grammar | `npm run langium:generate`, positive examples |
| Package imports, qualified type names, owner-scoped local references | cross-document and isolation tests |
| Interface kind/member and port role validation | negative contract tests |
| Immediate-child connectors, exact nominal interface, delegation and closed-system port checks | examples and negative topology tests |
| Outgoing member provenance and incoming handler ownership | `SW050`, `SW055` tests |
| Typed arguments/results, records, enums, arrays, expressions and function purity | value/flow tests |
| Unit-local invoke/compute, acyclic call/containment graphs | local-call and cycle tests |
| Explicit QoS, sampled buffering, RPC idempotency declarations | QoS tests |
| Time positivity and WCET/deadline/period consistency | realtime tests |
| Stateful-operation signature, transition priority, reachability, final-state and unconditional-cycle checks | state tests |
| Basic deployment and case endpoint/dependency validation | model fixtures and negative tests |
| LSP entry point using Langium standard services | initialize/diagnostics/shutdown integration test |
| CLI with nonzero failure exits | CLI integration tests |

The validator checks named constraints; it is not a model checker. Accepted syntax can still contain a runtime failure, unreachable emitting statement, unrealizable case or unproven contract.

## Static-validation gaps

These are specification obligations, not supported features silently assumed correct:

- Constraining string escape sequences to the normative portable subset.
- Proving arithmetic ranges, dynamic array bounds, guard satisfiability and guarded completion-cycle termination.
- Transitive effect analysis for reentrant operations and unit-state snapshot realizability. Direct assignments to unit data are checked; mutation hidden behind a local helper currently requires review.
- Bounded activation backlog and whole-system synchronous request-cycle analysis.
- Correlating case replies with earlier requests and proving case traces realizable by the operation bodies. Endpoint kinds/routes and earlier-label references are checked.
- Assigning stable persisted semantic IDs, and incremental revalidation of every path-based dependency after cross-file edits. Batch CLI validation checks the complete supplied file set. Path strings are deliberately resolved separately from Langium cross-references.
- Strict view-subject category checks for GV/IV/GRV beyond existence; editors must apply the graphical contract.

The supported claim is **SWAML 0.1 syntax support and partial static validation**. No full V, K, E or G conformance claim is made.

## Specified, not implemented

| Capability | Required implementation |
| --- | --- |
| KerML normalized semantics and interchange | semantic library, mapper, kernel validator, identity/round-trip tests |
| Runtime flow/state execution | scheduler, execution frames, state reaction engine, failures and observation |
| Communication semantics | per-connector queues, correlation, timeout, duplication, overflow and freshness |
| Timing assurance | target scheduling model and evidence; the current checks are necessary arithmetic checks only |
| Browser and graphical views | semantic projection, layout sidecars, Properties, source edits and undo |
| Complete IDE refactoring | path-aware rename, find references, navigation and dependency invalidation |
| VS Code package | language client activation, bundling, web/desktop hosts, commands and release pipeline |
| AUTOSAR / other exports | explicit backend profile, serialization and platform-specific constraints |

## Intentionally outside the 0.1 language

Inheritance/redefinition, generics, dynamic object creation, unbounded arrays, reference-valued payloads, hierarchical/orthogonal state regions, fork/join syntax, host-language code blocks, dynamic service discovery, runtime subscribe/unsubscribe, topic wildcards, exactly-once delivery, full requirements algebra and geometry are absent from the grammar. They require a versioned language proposal rather than an undocumented implementation shortcut.

## Completion criteria for the next implementation milestones

1. **Full static core:** every normative static rule has positive and negative tests, including cross-file incremental updates and reentrant effects.
2. **Kernel backend:** selected KerML library/version, generated normalized artifacts, kernel validation and semantic round-trip tests for every syntax family.
3. **Editor integration:** desktop and browser LSP clients, path-aware navigation/refactoring, diagnostic linking and no implied runtime support.
4. **Graphical workbench:** all six view projections plus Browser, stable IDs, sidecars, validated source edits and undo tests.
5. **Execution/export:** explicit target profile, transport/scheduling assumptions, trace tests for timeout/duplicate/overflow/state behavior, then code/ARXML generation where supported.
