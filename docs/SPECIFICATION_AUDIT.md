# Specification completeness audit — 0.1.1

This is the historical 0.1 audit. For current behavior and simulation support, read the [1.1 evidence](RELEASE_1_1.md).

**Date:** 2026-10-14. **Scope:** complete the bounded 0.1 language contract and resolve defects found in the initial Langium reference core. Language header remains `swaml "0.1";`.

## Findings and resolutions

| Issue | Finding | Resolution and evidence |
| --- | --- | --- |
| [#1](https://github.com/voidaliot/swaml/issues/1) | Lexical/value/scope rules were broader in implementation than prose | Portable lexer, cross-kind namespace ambiguity, Void result/failure scope and signed constant index checks; `test/audit.test.ts` |
| [#2](https://github.com/voidaliot/swaml/issues/2) | Execution ordering was underspecified and helpers could hide reentrant writes | [Operational contract](spec/06-execution-contract.md), transitive write analysis, positive read-only and negative helper-chain tests |
| [#3](https://github.com/voidaliot/swaml/issues/3) | Reply correlation, reverse publish direction, view subjects and alias closure were incomplete | Unique causal request matching, strict subject categories, required alias checks and duplicate normalized routes; audit tests and service-field example |
| [#4](https://github.com/voidaliot/swaml/issues/4) | Composite path and negative lookup diagnostics could become stale across files | Conservative workspace relinking; tests change, restore and delete imported definitions and introduce ambiguous declarations |
| [#5](https://github.com/voidaliot/swaml/issues/5) | Mapping inventory omitted syntax families and conformance obligations mixed validity with proof | [Normalized model](spec/07-normalized-model.md), [obligations](spec/08-conformance-obligations.md), all 80 grammar rule/type names mapped and checked |

The issues' resolution records link the publication commit and CI evidence. Repository tests supply implementation evidence for static checks; prose-only runtime/kernel behavior is labeled as a contract awaiting a backend.

## Completion checklist

| Area | Completion boundary |
| --- | --- |
| Static architecture | Ownership, definitions/occurrences, ports/interfaces, connectors/delegation, closure and deployment defined |
| Dynamic architecture | Pure functions, operations, structured flow, local calls, states and activation defined |
| Communication | Data/RPC/pubsub/service events have provenance, directions, typed payloads, handler ownership, correlation and QoS |
| Runtime edge cases | Startup, timers, queue overflow, fanout, timeout ties, snapshots, failure and resource binding obligations defined |
| Scenarios and graphics | Case dependencies/correlation, Browser/GV/IV/CV/SV/GRV/FV subjects and notation/edit rules defined; no performers or GEV |
| Kernel foundation | Every syntax family has normalized information and proposed kernel bases/library responsibilities; no false exporter claim |
| Developer handoff | Grammar, services, CLI/LSP, examples, user guide, AGENTS and contribution guide agree with the revision |
| Validation | Reproducible `npm run check`, executable examples, malformed input and cross-file regression coverage |

The full gate verifies **87 tests, 8 example models and 80 grammar mapping entries**, plus documentation links and a complete executable guide snippet. CI checks Node 22 and 24. The test suite is a reference-core regression suite; it is not yet an independent certification suite for all V clauses.

## Remaining implementation work

KerML serialization/library validation, execution/scheduling, analysis witnesses, graphical editors, persistent IDs, path-aware IDE refactoring, VS Code packaging and platform exports remain separate implementation milestones. Their absence does not leave the 0.1 syntax undefined, but it limits the tool's conformance claim to S and partial V. See [implementation status](IMPLEMENTATION_STATUS.md).

Unsupported language features remain explicit in the specification. This audit does not silently import the rest of UML, SysML, KerML or AUTOSAR. Future features need a versioned proposal and the same syntax, semantics, mapping, evidence and migration checklist.
