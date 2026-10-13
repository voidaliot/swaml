# 5. KerML semantic mapping

Normative SWAML mapping contract, with implementation status stated explicitly. Part of the [SWAML 1.0 specification](../LANGUAGE_SPECIFICATION.md).

## 5.1 Foundation and boundary

SWAML defines software-specific specializations and constraints over a normalized KerML model. Its concrete syntax is independent: a `.swaml` file is not automatically valid `.kerml` text. The Langium AST is an authoring representation, not itself the KerML abstract syntax.

The selected foundation is [OMG KerML 1.0](https://www.omg.org/spec/KerML/1.0). KerML supplies structural classifiers/features, behavior classifiers/steps, connectors, successions and expressions. The relevant normative kernel concepts are in clauses 7.3–7.4 and their abstract-syntax/semantic counterparts. SWAML's mapping below is this project's proposed specialization contract, not an OMG-approved extension. [KerML specification](https://www.omg.org/spec/KerML/1.0/PDF).

The [mapping inventory](../../spec/kerml-mapping.json) is a machine-readable design contract. This release does not implement or validate a KerML exporter, does not bundle a kernel semantic library, and does not claim K conformance. Implementers must test the normalized representation against the selected KerML metamodel and library before making that claim.

## 5.2 Semantic specializations

| SWAML element | Proposed KerML base/representation | SWAML restriction or additional meaning |
| --- | --- | --- |
| Package | Package | flat authoring namespace |
| Component definition | Structure | only composition, interfaces and connectors |
| Unit definition | Structure | encapsulated state and local executable features |
| Component/unit instance | composite Feature typed by its Structure | exactly-one multiplicity and acyclic composition |
| Value datatype / enum | DataType | finite value semantics; enum domain restriction |
| Interface contract | Classifier | nominal version, legal members and communication mode |
| Port | Feature typed by contract Classifier | direction/role projection and boundary ownership |
| Operation signature | Behavior plus typed parameter Features | no implementation; copied request/result contract |
| Operation implementation | Behavior and an owning-unit executable Step typed by it | direct ownership, activation, serialization and timing |
| Pure function | Function | parameter-only environment and no side effects |
| Connector | Connector between port Features | permitted interface exchange and QoS obligations |
| Delegation | Connector plus identity-preserving forwarding constraint | same role and contract; no extra queue |
| Ordered flow | contained Steps and Successions | structured branches/loops, bounded execution |
| Message emission | Step typed by a SWAML-library communication Behavior | source activation, route and correlation metadata |
| State / transition | contained behavior steps, state predicate and succession relations | SWAML state-selection and reaction semantics |
| Requirement / case / view | annotated named elements and trace memberships | SWAML-specific interpretation |

The table establishes a mapping target, not a claim that names such as “SWAML state” already exist as native KerML metaclasses. A full exporter needs a versioned SWAML semantic library for the additional predicates, activation and communication constraints. [Chapter 7](07-normalized-model.md) completes the information model, reference edges and lowering rules for every syntax family; the inventory covers all 80 grammar rule/type names.

## 5.3 Normalization algorithm

A mapper MUST perform the following in dependency order:

1. Validate the complete workspace and resolve every textual reference. Allocate stable IDs for package declarations and each named semantic element. Retain file URI and source range as provenance, not as identity.
2. Create value types and interface classifiers. Materialize every data/event/operation parameter and result as a typed feature with copied-value semantics. Preserve interface version and member order.
3. Create component/unit structures and owned instance features, with membership and typing links. Keep definition identity separate from every instance-path identity. A reused definition must not merge the states of its occurrences.
4. Create each port feature in its owning structure. Apply role-specific direction to each member projection: RPC inputs/results have opposite directions; service events run provider-to-consumer. Do not assign a single simplistic “out” bit to an entire bidirectional service contract.
5. Create operation behaviors within their unit's ownership. Add a synthetic owned executable step typed by that behavior and a unit-instance context binding. This lowering artifact gives execution a structural context; it is not a user-visible performer or a second editable allocation model.
6. Lower statement blocks to structured steps with explicit sequencing. A branch has a Boolean selection predicate and branch result control; a bounded loop has condition, body, count and failure edge. Lower expressions as typed expressions/functions. A mapper must preserve source order and short-circuit evaluation.
7. Lower each stateful operation to one state identity feature per activation, nested state-entry/exit/effect behaviors, trigger predicates, priority selection and succession relationships. Preserve finality, timer start/cancel and the run-to-completion relation. A bare succession graph without these constraints is not an equivalent mapping.
8. Lower communication statements to message occurrences linked to the emitting activation, sending port, interface member, connector/delegation route and destination port. Requests additionally carry correlation, timeout and response/error continuation. An event cannot become an unowned signal merely because a kernel target permits it.
9. Materialize queues, policy constraints, timing/deployment annotations and case happens-before relations in the SWAML semantic library vocabulary. Keep queue identity per connector/direction/member.
10. Produce a reverse mapping from every generated element to its authoring element, including synthetic lowering elements. Validate kernel typing/membership constraints and SWAML constraints separately. Report failures at the source element, not only at generated IDs.

## 5.4 Required extension predicates

The semantic library MUST define, or a mapper MUST carry as explicit constrained metadata, at least:

- `ownsExecutable(unit, operation)` and instance-local `contextOf(activation)`;
- `contractOf(port)`, `roleOf(port)`, `memberOf(contract, member)`;
- `route(sourcePort, destinationPort, connectorPath)`;
- `emits(activation, port, member, copiedPayload)` and `handles(operation, port, member)`;
- `correlates(request, response)`, `expiresAt(request)` and `lateResponseDiscarded(response)`;
- `queueOf(connector, direction, member)`, capacity, overflow, ordering and delivery policy;
- `currentState(activation)`, `enabled(transition, stimulus)`, priority and final-state completion;
- `wcet(operation)`, `deadline(operation)`, `period(operation)` and instance allocation;
- `happensBefore(caseStepA, caseStepB)` and `tracesTo(case, requirement)`.

These predicates are part of SWAML meaning even if an exchange format stores them as metadata. A consumer lacking their interpretation MUST report a partial import and MUST NOT execute a “best guess.” A generic KerML consumer can preserve structural content while lacking SWAML runtime semantics.

## 5.5 Interchange and round-trip obligations

A future exporter SHOULD use the standard KerML interchange representation supported by its chosen backend, with a declared SWAML semantic library version. No new unregistered MIME type, XMI metamodel URI, or fake OMG namespace is assigned by this document. SWAML library identifiers must use a project-controlled namespace when published.

Round-trip tests MUST compare semantic identities, typing, owned instances, routes, triggers, guards, flow ordering, queue policies, timing and trace dependencies. Byte-for-byte textual equality is not required. Comments, formatting and diagram layouts are separate preservation requirements for an authoring tool.

Dropping a guard, converting a queued event to a sampled value, merging per-subscriber queues, or omitting a request's response path is a semantic loss and must be reported as an error for K conformance. The mapping must not infer a performer allocation that changes the operation's direct owning unit.
