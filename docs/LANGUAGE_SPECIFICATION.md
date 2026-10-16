# SWAML language specification

**Version:** 1.2.0 · **Source:** headerless packages; parser/host pinned to 1.2 · **Status:** 1.2.0 release · **Date:** 2026-10-16

SWAML means Software Architecture Modeling Language. This document and its normative chapters define a software architecture language with a proposed KerML semantic mapping. SWAML is independently authored and does not denote an OMG standard or UML compatibility level. Architects familiar with UML can begin with the informative [UML transition guide](UML_GUIDE.md); implemented capabilities are identified separately from mapping and execution contracts.

## 1. Normative document set

Read these chapters together. Their requirements have equal standing:

1. [Structure, names and types](spec/01-structure-and-types.md).
2. [Interfaces and communication](spec/02-communication.md).
3. [Function and state semantics](spec/03-behavior.md).
4. [Timing, deployment, cases and conformance](spec/04-systems-and-conformance.md).
5. [KerML semantic mapping](spec/05-kerml-mapping.md).
6. [Graphical notation](GRAPHICAL_NOTATION.md) and [canonical concept catalog](GRAPHICAL_CATALOG.md).
7. [Concrete grammar](../src/language/swaml.langium).
8. [Operational contract and target bindings](spec/06-execution-contract.md).
9. [Normalized semantic model](spec/07-normalized-model.md).
10. [Conformance obligations and evidence](spec/08-conformance-obligations.md).
11. [Formal core and simulation relation](spec/09-formal-semantics.md).
12. [Machine-readable mapping inventory](../spec/kerml-mapping.json).

The [user guide](USER_GUIDE.md), [architecture comparison](ARCHITECTURE_COMPARISON.md), examples and design decisions are informative. The [implementation matrix](IMPLEMENTATION_STATUS.md) reports current tool support; a missing implementation does not waive a language rule.

## 2. Normative terms and precedence

MUST and MUST NOT state conformance requirements. SHOULD states a recommendation with an explicitly documented justification needed for deviation. MAY grants permission. “Error” means a model is not valid under this version. An implementation may retain an invalid model for editing but MUST NOT report it as fully valid.

The grammar determines tokens and parse structure. Prose determines validity and meaning. If grammar accepts text that violates a semantic rule, that text is invalid. If a discovered conflict makes the two impossible to satisfy, record a specification defect; do not silently choose a runtime meaning. Unknown syntax and unsupported requested language versions MUST be rejected. The host selects a pinned 1.2 parser before loading source; a file does not guess its own edition. See the [1.2 migration guide](MIGRATION_1_2.md) and [historical 1.1 migration guide](MIGRATION_1_1.md) for the intentional syntax migration from 1.0.

The language is closed at version 1.2: constructs not listed in the grammar are not implicitly inherited from UML, SysML or KerML. Component definitions support instantiation, single specialization and compatible explicit member redefinition. Generics, unrestricted KerML embedding and dynamic creation remain outside this version. External system identities support deployment integration without importing another modeling language.

## 3. Design invariants

- **I1 — Boundary:** every exchange between distinct component instances crosses port instances typed by the same interface contract and a permitted connector/delegation path.
- **I2 — Ownership:** components own child components, ports, private data and functions; functions own calculations and statement flow or states. No performer element, behavior allocation, free action, free signal, or global variable exists.
- **I3 — Event provenance:** after resolving any delegation, every outgoing data/event member has at least one syntactically associated emitting function in the resolved owning component. Every incoming member has exactly one handling function in that context, including a stateful function where applicable. A delegated boundary has no additional local handler or emitter.
- **I4 — Type safety:** payloads and results conform to nominal contracts. Messages transfer values, never aliases to another component's private state.
- **I5 — Explicit communication policy:** every connector declares delivery, ordering, capacity and overflow. Time-sensitive connections add latency/freshness bounds.
- **I6 — Views preserve meaning:** views reference existing semantic elements. Drawing a message cannot create a hidden communication channel.

Local calls, calculation values, timer expiration, initial activation and state completion do not constitute exchanges between components. They are the only exceptions needed for local computation and lifecycle. An external actor or device that exchanges model data MUST be represented through a component port; a case actor label cannot bypass I1.

## 4. Abstract model inventory

| Element | Owns | References / meaning |
| --- | --- | --- |
| Model | packages | language edition selected by the parser/host |
| Package | imports and named declarations | namespace |
| DataType / EnumType | typed fields / literals | immutable nominal value shape |
| Interface | data, event or function signatures | nominal versioned communication contract |
| Component definition | child component instances, ports, variables, functions, connectors and delegation | reusable software boundary; optional base definition |
| Component instance | distinct private stores and expanded effective members | one component definition; multiplicity one |
| Root component | inline members or a component-definition instance; deployment bindings | closed architecture selected for execution; default service profile |
| Port | role and optionality | one interface |
| QoS policy definition | complete policy values | package-owned reuse without queue sharing |
| Connector / delegation | policy selection / boundary alias | explicit typed route / same-contract forwarding |
| Function | typed parameters/result, trigger, timing, calculations; statements **or** states | executable behavior owned by one component |
| Calculation | typed inputs, named non-void output and expression | pure value computation owned by one function |
| State / transition | entry/exit blocks / trigger, guard, priority and effect | behavior directly owned by one function |
| Deployment | no system definition | component-instance path and external system/part identity |
| Requirement / case | obligation text / exchange steps and trace links | intended behavior and claimed coverage |
| View | kind and subject reference | projection with no added runtime semantics |

Definitions and instances retain different identities. Specialization and redefinition reference source declarations; neither shares private state across instances. Tools SHOULD persist a separate identity map for editing. A rename preserves identity only when the tool updates that map and all references atomically.

## 5. Conformance summary

A parser supports concrete syntax. A semantic validator additionally enforces static rules. A KerML mapper additionally produces the normalized representation in chapter 5. An execution backend additionally realizes chapter 3 and communication policies. A graphical editor additionally satisfies the view/editing contract. A tool MUST state which levels it implements; success at one level MUST NOT imply the others.

This repository supplies a parser, LSP foundation, documented static validation and a [reference simulator](SIMULATION.md). The specification defines more than that implementation, especially runtime delivery, idempotency, target snapshot realization, timing proof, interchange and graphical editing. See the [exact support matrix](IMPLEMENTATION_STATUS.md).

## Requirements and formal documentation

Requirements own typed attributes and one optional `doc /* ... */` specification. Design elements link through `satisfy`; verification cases link through `verify`. Use cases describe intent. Ordinary comments remain independent notes. View kinds use lower camel case, and view blocks combine multiple selections and Boolean filters. See the [guide](REQUIREMENTS_AND_DOCUMENTATION.md) and [complete model](../examples/16-requirements-and-views.swaml).
