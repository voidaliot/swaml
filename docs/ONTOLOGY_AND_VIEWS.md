# SWAML ontology and flat views

SWAML 1.3.1 models software with **Class → Component** and **Operation → Function** category specializations, plus pure calculations. Classes/components own child usages, private data, typed ports and executable operations/functions. Executable members expose statement flow or states; calculations produce pure values from explicit inputs. Start with the [graphical overview](MODELING_OVERVIEW.md), then use this inventory alongside the [normative specification](LANGUAGE_SPECIFICATION.md). The arrows here run from general to specialized category; they do not allocate objects or link runtime instances.

## Ownership and reuse

```text
Class / Component occurrence
├─ Child class/component occurrences, recursively
├─ Ports, connectors and boundary delegation
├─ Private values
└─ Operations / Functions
   ├─ Statement flow OR states and transitions
   └─ Calculations
      └─ Typed inputs → pure expression → named output
```

A package organizes names; it is not an extra software layer. `component def` declares a reusable type. `component child: Type;` creates an instance with separate state. A top-level component selects the root architecture. Definitions may specialize one base, with compatible inherited replacements marked `redefines`. Specialization is reuse of declarations, not shared runtime storage.

| Concept | Owns or contains | Meaning |
| --- | --- | --- |
| Package | Imports and declarations | Namespace for definitions, contracts and views. |
| Class / Component definition | Children, ports, private data, operations/functions and connections | Class is general; component is specialized. One compatible base. |
| Component instance | Effective members and separate private state | One use of a definition with a distinct path. Leaf and composite instances follow the same rules. |
| Root component | Inline members or one definition instance; deployment bindings | Closed architecture selected for execution. Omitted profile means service. |
| Operation / Function | Inputs/result, trigger, timing, local calculations and statements or states | Operation is general; function is specialized. Omitted result means void. |
| Calculation | Typed inputs and one named non-void output expression | Pure function-local computation; cannot read mutable values or communicate. |
| State / transition | Entry/exit blocks / guard, trigger, priority and effect | Control owned directly by one function. |
| Private variable | Type and pure initializer | Mutable copied-value storage inside one component instance. |
| Value type | Primitive domain, record fields, enum literals or fixed array extent | bool, byte, uint, int, real, string, result-only void and structured values. |
| Interface | Typed data, events or function signatures | Nominal versioned communication contract. Signatures and implementations have distinct owners. |
| Port | Contract, role and optionality | An owned boundary endpoint. |
| Connector | Typed endpoints and complete policy selection | Route between owned or immediate-child ports; its queues are independent. |
| Delegation | Outer and immediate-child port references | Boundary alias with the same contract and role; introduces no queue or handler. |
| QoS policy | Complete delivery, ordering, capacity, overflow and optional bounds | Reusable values selected explicitly on each connector. |
| Deployment | Instance path and external identity | Link to a host-resolved system or SysML part, with nearest-ancestor inheritance. |
| Requirement | Immutable typed attributes and one optional formal doc | Named obligation without a subject. Design elements may claim satisfaction; verification cases may record verification intent. |
| Use / verification case | Root-context reference, optional doc and routed exchanges; verify links only in a verification case | Intended use or verification intent. Claims and cases do not establish evidence. |
| Documentation | One formal specification attached to an eligible declaration | Ordinary comments remain separate lexical notes. |
| View | Kind and one or more ordered subject selections | Projection of existing model identities, with optional recursive expansion and pure filtering. |

The same component may implement an external contract and contain collaborating children. Local behavior cannot bypass those children's interfaces. An inherited function resolves local names against its specialized component's effective members, while another instance keeps its own state. The [specialization example](../examples/15-component-specialization.swaml) demonstrates this distinction.

## Communication contracts

| Interface kind | Members | Role pair | Direction |
| --- | --- | --- | --- |
| senderReceiver | Sampled/queued data | sender / receiver | Data travels sender → receiver. |
| publishSubscribe | Events with typed payloads | publisher / subscriber | Events travel publisher → subscriber. |
| clientServer | Function signatures | client / server | Request client → server; correlated result/failure returns. |
| service | Function signatures and events | requires / provides | Request requires → provides; result/failure and provider events return. |

`Settings::Panel` is a definition. `Settings::Cabin.front.panel` and `Settings::Cabin.rear.panel` are two instances with distinct `displayed` values and function activations. `Cabin.frontLink` and `Cabin.rearLink` may select the same LocalLink policy while retaining separate queues. The [service setting model](../examples/08-service-field.swaml) supplies these exact identities.

## How the views look

Browser is the navigation surface. gv, iv, cv, sv, grv, fv and tv are the seven declared view kinds. Every drawing uses flat geometry, explicit labels and stable source identities. Color supports grouping; it never carries the only semantic distinction.

| Surface | Subject | Flat appearance and purpose |
| --- | --- | --- |
| Browser | Workspace or selected subtree | Indented ownership tree with distinct definitions, inherited members and instance paths. |
| gv — General | Package or named semantic element | Box in box ownership frames or a Tree of the same selected identities, with child/data/function details and labeled type, specialization and deployment references. |
| iv — Interconnect | Class/component root, definition or occurrence | Owner/child cards, boundary ports with service balls/sockets, named typed connectors and boundary delegation. Locally handled ports remain visible. |
| cv — Case | Case or root | Use/verification cases show their root context and routed exchanges. satisfy arrows run from design elements to requirements; verify arrows run only from verification cases. |
| sv — Sequence | Case or root case selection | Participant headers, lifelines and typed messages with explicit dependencies and correlated replies. Vertical layout adds no ordering. |
| grv — Grid | Package or named semantic element | Filterable rows for identities, owners, contracts, functions, policies, external destinations and evidence. |
| fv — Flow | Executable operation/function | Owned statement flow with decisions, bounded loops, calls and interruptible regions, or directly owned states with guarded/timed transitions. |
| tv — Timing | Executable operation/function | Function occurrence/activation lanes on a time axis, with observed phases from an identified trace and separate declared contracts. |

Box in box and Tree are presentation choices within gv. Switching preserves the same occurrence paths, ownership and typed topology; it does not create another component tree or change communication routes.

A compact tv selects one function. To select functions under a root or reusable definition, use an explicit block such as `view timeline tv { include App recursive where kind == "function"; }`. A root itself, signature, calculation or state is not a tv subject. No trace evidence is implied by declaring a view.

External deployment targets are labeled reference cards, not software children. A `sysml:` string remains an unresolved external reference until the integration host supplies validation. The [graphical notation](GRAPHICAL_NOTATION.md), [canonical catalog](GRAPHICAL_CATALOG.md) and [worked examples](GRAPHICAL_EXAMPLES.md) define the detailed symbols.

## Start small

Begin with an inline root and the components that represent useful private-state boundaries. Add reusable definitions and specialization when they help express a real family of architectures. Keep a calculation local when it only transforms values. Add a typed port and route whenever work crosses a component boundary.

Use gv/iv for responsibility and communication, cv/sv for intended interactions, grv for contract review, fv for function flow/states and tv for timing. The showcase supports inspection and layout; arbitrary graphical source editing, production timing proof and cross-language export require the additional implementations listed in [implementation status](IMPLEMENTATION_STATUS.md).

The dedicated tv kind and GV layouts are documented in the [1.3.1 migration guide](MIGRATION_1_3_1.md) and [ADR 0012](decisions/0012-timing-view-and-structure-layouts.md). The parser family and execution profile remain 1.3.

## Requirements and formal documentation

Requirements own typed attributes and one optional `doc /* ... */` specification. Design elements link through `satisfy`; verification cases link through `verify`. Use cases describe intent. Ordinary comments remain independent notes. View kinds use lower camel case, and view blocks combine multiple selections and Boolean filters. See the [guide](REQUIREMENTS_AND_DOCUMENTATION.md) and [complete model](../examples/16-requirements-and-views.swaml).
