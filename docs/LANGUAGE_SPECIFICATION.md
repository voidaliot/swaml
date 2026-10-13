# SWAML language specification

**Version:** 1.0.0 · **Language header:** `swaml "1.0";` · **Status:** complete 1.0 specification · **Date:** 2026-10-14

SWAML means Software Architecture Modeling Language. This document and its normative chapters define a software architecture language over a KerML-based semantic model. SWAML is independently authored; “unofficial UML 3.0” describes its motivation and does not denote an OMG standard or compatibility level.

## 1. Normative document set

Read these chapters together. Their requirements have equal standing:

1. [Structure, names and types](spec/01-structure-and-types.md).
2. [Interfaces and communication](spec/02-communication.md).
3. [Operation and state semantics](spec/03-behavior.md).
4. [Timing, deployment, cases and conformance](spec/04-systems-and-conformance.md).
5. [KerML semantic mapping](spec/05-kerml-mapping.md).
6. [Graphical notation](GRAPHICAL_NOTATION.md).
7. [Concrete grammar](../src/language/swaml.langium).
8. [Operational contract and target bindings](spec/06-execution-contract.md).
9. [Normalized semantic model](spec/07-normalized-model.md).
10. [Conformance obligations and evidence](spec/08-conformance-obligations.md).
11. [Formal core and simulation relation](spec/09-formal-semantics.md).
12. [Machine-readable mapping inventory](../spec/kerml-mapping.json).

The [user guide](USER_GUIDE.md), [architecture comparison](ARCHITECTURE_COMPARISON.md), examples and design decisions are informative. The [implementation matrix](IMPLEMENTATION_STATUS.md) reports current tool support; a missing implementation does not waive a language rule.

## 2. Normative terms and precedence

MUST and MUST NOT state conformance requirements. SHOULD states a recommendation with an explicitly documented justification needed for deviation. MAY grants permission. “Error” means a model is not valid under this version. An implementation may retain an invalid model for editing but MUST NOT report it as fully valid.

The grammar determines tokens and parse structure. Prose determines validity and meaning. If grammar accepts text that violates a semantic rule, that text is invalid. If a discovered conflict makes the two impossible to satisfy, record a specification defect; do not silently choose a runtime meaning. Unknown syntax and unknown language versions MUST be rejected.

The language is closed at version 1.0: constructs not listed in the grammar are not implicitly inherited from UML, SysML or KerML. Definitions may be reused by instantiation, but inheritance, generics, redefinition, unrestricted KerML embedding and dynamic creation are not part of this version. This constraint makes the whole v1.0 language implementable without pretending to reproduce three other standards.

## 3. Design invariants

- **I1 — Boundary:** every exchange between distinct unit instances crosses port instances typed by the same interface contract and a permitted connector/delegation path.
- **I2 — Ownership:** components own composition; units own private data, functions and operations; operations own statement flow or states. No performer element, behavior allocation, free action, free signal, or global variable exists.
- **I3 — Event provenance:** every outgoing data/event member of a unit port has at least one syntactically associated emitting operation. Every incoming member has exactly one handling operation, including a stateful operation where applicable.
- **I4 — Type safety:** payloads and results conform to nominal contracts. Messages transfer values, never aliases to another unit's private state.
- **I5 — Explicit communication policy:** every connector declares delivery, ordering, capacity and overflow. Time-sensitive connections add latency/freshness bounds.
- **I6 — Views preserve meaning:** views reference existing semantic elements. Drawing a message cannot create a hidden communication channel.

Local calls, calculation values, timer expiration, initial activation and state completion do not constitute exchanges between units. They are the only exceptions needed for local computation and lifecycle. An external actor or device that exchanges model data MUST be represented through a component/unit port; a case actor label cannot bypass I1.

## 4. Abstract model inventory

| Element | Owns | References / meaning |
| --- | --- | --- |
| Model | packages | exact language version |
| Package | imports, named elements | namespace |
| DataType / EnumType | fields / literals | immutable value shape |
| Interface | data, event or operation members | nominal versioned contract |
| Component definition | ports, child instances, connectors, delegation | reusable composition type |
| Unit definition | ports, private variables, operations, functions | reusable behavior/data boundary |
| Instance | no inline definitions in 1.0 | one component or unit definition |
| Port | role and optionality | one interface |
| Connector | QoS | source and target port paths |
| Delegation | no data conversion | outer port and immediate child port |
| Operation | parameters, result, trigger, timing; flow **or** machine | executable behavior owned by a unit |
| Function | parameters, result, expression | pure local calculation |
| Machine | states, transitions, initial reference | lifetime of a stateful operation |
| State | entry and exit blocks | one operation-local condition |
| Transition | guard, effect, priority, trigger | source and target states |
| System | component instances, connectors, execution nodes, deployment | closed assembly and profile |
| Requirement | text | named obligation |
| Case | exchange steps, trace links | one system and requirements |
| View | kind | one subject, no runtime semantics |

All named elements have stable identity within a model version. Tools SHOULD persist a separate UUID identity map for editing; the language's normative textual identity is its qualified declaration/instance path. A rename is an identity-preserving edit only when the tool updates that map and all references atomically.

## 5. Conformance summary

A parser supports concrete syntax. A semantic validator additionally enforces static rules. A KerML mapper additionally produces the normalized representation in chapter 5. An execution backend additionally realizes chapter 3 and communication policies. A graphical editor additionally satisfies the view/editing contract. A tool MUST state which levels it implements; success at one level MUST NOT imply the others.

This repository supplies a parser, LSP foundation, documented static validation and a [reference simulator](SIMULATION.md). The specification defines more than that implementation, especially runtime delivery, idempotency, target snapshot realization, timing proof, interchange and graphical editing. See the [exact support matrix](IMPLEMENTATION_STATUS.md).
