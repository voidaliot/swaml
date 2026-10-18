# Software architecture rationale

This is an original comparison of modeling choices, not a compatibility claim. AUTOSAR sources below provide a conceptual baseline; target generation requires a separate mapping and evidence.

| Concern | SWAML 1.3 choice | Reason |
| --- | --- | --- |
| Software ownership | Classes/components containing usages and owning private values and behavior | Component specializes Class; both retain the same isolation and static ownership. |
| Executable behavior | Operations/functions with statements or directly owned states | Function specializes Operation; decisions, loops, local calls and stateful reactions retain one behavior owner. |
| Pure values | Calculations with typed inputs and one named output expression | Guards and expressions can reuse calculations without side effects. |
| Architectural reuse | Definitions, instances, single specialization and explicit compatible redefinition | Related designs share declarations while retaining distinct instance state. |
| Communication | Versioned interfaces, owned ports and explicit routes | Every cross-component exchange remains traceable and typed. |
| Placement | External system/part identities | The software model can connect to a system model without duplicating its hardware ontology. |
| Data | bool, byte, uint, int, real, string, records, enums and fixed arrays | Copied values with explicit bounds and nominal contracts. |

## AUTOSAR Classic and Adaptive

Classic separates application software, runtime integration and basic software. Its software-component template defines sender–receiver and client–server interfaces, ports and runnable activation. SWAML preserves these architectural distinctions through components, contracts and triggered functions. Mapping a function to a runnable still requires an activation, parameter, task and scheduling binding. [Classic overview](https://www.autosar.org/standards/classic-platform/), [Software Component Template R21-11](https://www.autosar.org/fileadmin/standards/R21-11/CP/AUTOSAR_TPS_SoftwareComponentTemplate.pdf).

Adaptive Communication Management distinguishes methods, events and fields. SWAML's service contracts combine function signatures and events; an explicit getter/setter/change-event protocol represents a field. The language does not infer discovery, service-instance identifiers or ara::com configuration from a connector. [Communication Management R21-11](https://www.autosar.org/fileadmin/standards/R21-11/AP/AUTOSAR_SWS_CommunicationManagement.pdf).

The [complete architecture examples](ARCHITECTURE_PATTERNS.md) demonstrate a Classic climate component and an Adaptive diagnostic application. Their target bindings must preserve copied values, routes, response correlation, queue behavior, concurrency and timing. Model validation is not ARXML conformance or an RTE implementation.

## UML and object-oriented implementation

UML provides components, classes, interfaces, operations, activities, state machines and interactions. SWAML 1.3.1 supports Class/Component and Operation/Function category hierarchies while retaining bounded software architecture semantics. A backend may implement a modeled classifier as an implementation class, process, service or group of objects, provided it preserves ownership, private state and typed routes. The modeled class does not imply heap references, dynamic creation or unrestricted UML object semantics. [OMG UML 2.5.1](https://www.omg.org/spec/UML/2.5.1).

Component specialization is deliberately bounded: one base, explicit compatible replacement, fixed instances and no reference-valued payloads. It does not imply UML generalization semantics or dynamic object creation. See the [UML transition guide](UML_GUIDE.md) for correspondences and limits.

## SysML 2.0 and KerML

SysML uses definition/usage modeling and includes calculations with inputs and a return. SWAML adopts a similar readable input/output form while restricting a calculation to one pure expression local to its owning operation/function. This is an original subset choice, not a SysML importer or grammar alias. [SysML 2.0 Language, clause 7.19](https://www.omg.org/spec/SysML/2.0/Language/PDF).

An external `sysml:` deployment identity is an integration hook for a part or system described elsewhere. A host must resolve that identity and validate the allocation. Merely carrying a string does not load or validate a SysML model. The software hierarchy and the external system hierarchy keep distinct identities.

SWAML also defines a proposed [KerML mapping contract](spec/05-kerml-mapping.md). The Langium AST and coverage inventory are not a kernel export or conformance result. A real mapper needs a versioned library, kernel validation, source traces and round-trip tests. [KerML 1.0](https://www.omg.org/spec/KerML/1.0).

## Analysis and runtime boundaries

Architectural timing languages such as AADL emphasize explicit performance and deployment assumptions. SWAML includes timing contracts, but a deadline or external deployment reference alone supplies no scheduler or timing proof. [SEI introduction to AADL](https://www.sei.cmu.edu/library/the-architecture-analysis-design-language-aadl-an-introduction/).

For service and event-driven designs, SWAML makes queue capacity, overflow, duplicate delivery, partial fanout and timeout uncertainty explicit. A broker is modeled when its behavior matters. Storage, middleware and lifecycle guarantees remain part of a target binding. The [execution contract](spec/06-execution-contract.md) and [implementation matrix](IMPLEMENTATION_STATUS.md) identify what acceptance and bounded simulation establish.

[ADR 0007](decisions/0007-component-functions-and-calculations.md) records the 1.2 simplification. Primary-source links support the comparison; no external standard content or proprietary templates are redistributed.
