# SWAML language specification

**Version:** 1.4.0 development · **Source:** headerless packages; parser/host pinned to 1.4 · **Status:** unpublished development specification · **Date:** 2026-10-19

SWAML means Software Architecture Modeling Language. This document and its normative chapters define a software architecture language with a proposed KerML semantic mapping. SWAML is independently authored and does not denote an OMG standard or UML compatibility level. Architects familiar with UML can begin with the informative [UML transition guide](UML_GUIDE.md); implemented capabilities are identified separately from mapping and execution contracts.

## 1. Normative document set

Read these chapters together. Their requirements have equal standing:

1. [Structure, names and types](spec/01-structure-and-types.md).
2. [Interfaces and communication](spec/02-communication.md).
3. [Operation/function and state semantics](spec/03-behavior.md).
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

The grammar determines tokens and parse structure. Prose determines validity and meaning. If grammar accepts text that violates a semantic rule, that text is invalid. If a discovered conflict makes the two impossible to satisfy, record a specification defect; do not silently choose a runtime meaning. Unknown syntax and unsupported requested language versions MUST be rejected. The host selects a pinned 1.4 parser before loading source; a file does not guess its own edition. See the [1.3.1 migration guide](MIGRATION_1_3_1.md), [1.3 migration guide](MIGRATION_1_3.md) and [historical 1.1 migration guide](MIGRATION_1_1.md) for the intentional syntax migration from 1.0.

The language is closed at version 1.4: constructs not listed in the grammar are not implicitly inherited from UML, SysML or KerML. Class and component definitions support instantiation, single specialization and compatible explicit member redefinition. The software metamodel specializes Component from Class and Function from Operation; the corresponding lower camel case source keywords preserve those kinds. Generics, unrestricted KerML embedding and dynamic creation remain outside this version. External system identities support deployment integration without importing another modeling language.

The structural rules apply to both classes and components, and the executable rules apply to both operations and functions. A component is a specialized class; a function is a specialized operation. These are declared software kinds, not unrestricted UML object semantics. See [ADR 0014](decisions/0014-classes-operations-and-uml-notation.md).

## 3. Design invariants

- **I1 — Boundary:** every exchange between distinct class/component instances crosses port instances typed by the same interface contract and a permitted connector/delegation path.
- **I2 — Ownership:** classes and components own child class/component usages, ports, private data and operations/functions; operations and functions own calculations and statement flow or states. No performer element, behavior allocation, free action, free signal, or global variable exists.
- **I3 — Event provenance:** after resolving any delegation, every outgoing data/event member has at least one syntactically associated emitting function in the resolved owning component. Every incoming member has exactly one handling function in that context, including a stateful function or interruptible-region owner where applicable. A delegated boundary has no additional local handler or emitter.
- **I4 — Type safety:** payloads and results conform to nominal contracts. Messages transfer values, never aliases to another component's private state.
- **I5 — Explicit communication policy:** every connector declares delivery, ordering, capacity and overflow. Time-sensitive connections add latency/freshness bounds.
- **I6 — Views preserve meaning:** views reference existing semantic elements. Drawing a message cannot create a hidden communication channel.

Local calls, calculation values, timer expiration, initial activation, same-owner successful executable completion and state completion do not constitute exchanges between components. They are the only exceptions needed for local computation and lifecycle. An external actor or device that exchanges model data MUST be represented through a component port; a case actor label cannot bypass I1. Operator and test inputs are named interface events emitted by component-owned functions; there is no separate harness activation trigger. See [events and inputs](EVENTS_AND_INPUTS.md).

## 4. Abstract model inventory

| Element | Owns | References / meaning |
| --- | --- | --- |
| Model | packages | language edition selected by the parser/host |
| Package | imports and named declarations | namespace |
| DataType / EnumType | typed fields / literals | immutable nominal value shape |
| Interface | data, event or operation/function signatures | nominal versioned communication contract |
| Class definition | child class/component usages, ports, variables, operations/functions, connectors and delegation | reusable software type; optional single class base |
| Component definition | the same owned members as Class | specialized software boundary; optional class or component base |
| Class/component usage | distinct private stores and expanded effective members | one compatible definition; multiplicity one; component usage requires component type |
| Execution root | inline class/component members or a compatible definition usage; deployment bindings | closed architecture selected for execution; default service profile |
| Port | role and optionality | one interface |
| QoS policy definition | complete policy values | package-owned reuse without queue sharing |
| Connector / delegation | policy selection / boundary alias | explicit typed route / same-contract forwarding |
| Operation | typed parameters/result, trigger, timing, calculations; statements **or** states | executable behavior owned by one class/component |
| Function | the same owned executable content as Operation | specialization of Operation; retains its function kind |
| Calculation | typed inputs, named non-void output and expression | pure value computation owned by one operation/function |
| State / transition | entry/exit blocks / trigger, guard, priority and effect | behavior directly owned by one operation/function |
| Deployment | no system definition | component-instance path and external system/part identity |
| Requirement | immutable typed attributes and one optional formal doc | named obligation; incoming satisfy/verify links |
| Use / verification case | optional doc, verification links where permitted, and exchange steps | one root context selected with of; intended use / verification intent |
| View | kind, optional doc and one or more subject selections | stable union of occurrence paths; pure optional filters; no runtime effects |

Definitions and instances retain different identities. Specialization and redefinition reference source declarations; neither shares private state across instances. Tools SHOULD persist a separate identity map for editing. A rename preserves identity only when the tool updates that map and all references atomically.

## Local completion activation in development 1.4

`function B() on completion A` declares a same-owner effective executable dependency. B is parameterless void flow; A is triggered; the graph is acyclic. Only successful whole A completion releases B after unlock, with a new activation context and no forwarded result, implicit join or cross-component channel. See [behavior](spec/03-behavior.md#37-local-completion-activation), [migration](MIGRATION_1_4.md) and [ADR 0015](decisions/0015-local-executable-completion.md). The current development package/profile are 1.4.0 / swaml-reference/1.4. Published 1.3.1 artifacts remain unchanged and no 1.4 PDF is published.

## 5. Conformance summary

A parser supports concrete syntax. A semantic validator additionally enforces static rules. A KerML mapper additionally produces the normalized representation in chapter 5. An execution backend additionally realizes chapter 3 and communication policies. A graphical editor additionally satisfies the view/editing contract. A tool MUST state which levels it implements; success at one level MUST NOT imply the others.

This repository supplies a parser, LSP foundation, documented static validation and a [reference simulator](SIMULATION.md). The specification defines more than that implementation, especially runtime delivery, idempotency, target snapshot realization, timing proof, interchange and graphical editing. See the [exact support matrix](IMPLEMENTATION_STATUS.md).

## Requirements and formal documentation

Requirements own typed attributes and one optional `doc /* ... */` specification. Design elements link through `satisfy`; verification cases link through `verify`. Use cases describe intent. Ordinary comments remain independent notes. View kinds use lower camel case, and view blocks combine multiple selections and Boolean filters. See the [guide](REQUIREMENTS_AND_DOCUMENTATION.md) and [complete model](../examples/16-requirements-and-views.swaml).

## Extended function flow and timing

The 1.3 edition adds counted for, copied-array forEach, bounded do loops and typed interruptible regions. The 1.3.1 revision separates trace-backed function timing into `tv`; `fv` presents statement flow, states and interrupts. `gv` supports Box in box and Tree layouts of the same ownership hierarchy. See the [control-flow guide](CONTROL_FLOW_AND_TIMING.md), [1.3.1 migration](MIGRATION_1_3_1.md) and [view design decision](decisions/0012-timing-view-and-structure-layouts.md).
