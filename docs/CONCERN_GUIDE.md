# Language reference by concern

Use this alphabetical map to navigate SWAML 1.2 by architectural question. The [alphabetical keyword reference](KEYWORD_REFERENCE.md) provides the other reading order; the [complete Markdown edition](SWAML-1.2.1-Reference.md) contains both maps, all normative chapters, user guidance, grammar and model examples in one document. Rules are normative where their source chapter says so; a tutorial or illustration never overrides those rules.

## Architecture selection and platform correspondence

Start with the [architecture comparison](ARCHITECTURE_COMPARISON.md). SWAML borrows strict interface boundaries from component/service architectures and familiar structural/behavioral concepts from UML/SysML. Its authoring model is deliberately software-specific. A Classic-like control loop uses sampled senderReceiver members, periodic functions and explicit timing. A service architecture uses function/event contracts, correlated requests, timeout handling and static subscriber connections. A gateway explicitly translates between these through its own component ports.

Choose a root component profile (`realtime`, `service` or `mixed`) according to the contracts you intend to supply. The choice does not turn the model into AUTOSAR configuration or prove a scheduling property. Use an adapter component when hardware or middleware behavior matters to the architecture. External devices cannot enter a case through an untyped actor shortcut.

## Behavior and state ownership

See [functions, flow and states](spec/03-behavior.md) and the [operational contract](spec/06-execution-contract.md). Components own executable functions directly. A calculation evaluates a pure expression from typed inputs; an untriggered flow function is a local helper with an optional result; a triggered function is a root activation. The same component may also compose child components; each child retains its own private store and activation lock.

Choose a statement body for sequential calculation and requests. Choose a state body when the function remains in named states between inputs. States, guards and transitions remain inside that function. There are no independent actions or performers. The function's flow/state body is the subject of fv. Entry/exit cannot read a transition payload; save a needed value in private component data in the effect.

## Cases, requirements and evidence

See [root components and cases](spec/04-systems-and-conformance.md). Requirements are named natural-language obligations. A case describes permitted interface exchanges in a chosen root component and may claim requirement coverage. Case steps reference actual top-level connectors and member paths. `after` gives causality; independent steps remain unordered.

A reply needs one unanswered matching request in its causal ancestry. Route validity is checked statically. A simulation or analysis witness is separate evidence that the function bodies can realize the described case. Neither a `satisfy` keyword nor a green line in a diagram establishes that evidence. cv shows coverage claims; sv shows the causal exchanges.

## Communication and interface boundaries

See [interfaces and communication](spec/02-communication.md). Choose senderReceiver for data, clientServer for RPC, publishSubscribe for events, or service for RPC plus provider events. Contracts are nominal and versioned. Component ports bind contracts to local functions or delegate them through the hierarchy. Connect owned or immediate-child ports at each composition level. An explicit route may also connect two complementary ports of the same instance.

A sender/publisher can fan out. A subscriber can receive multiple publisher routes, each with its own queue. A receiver/client/requires port has at most one route. Required ports must be connected in a selected closed root component; optional unbound RPC reports Unavailable. Reading another component's fields, invoking its function directly, sending a free event, or adding a topic string outside a contract is invalid.

Queue delivery, order, capacity and overflow are mandatory. Data/event admission can partially succeed across fanout, so atomic broadcast needs an explicit protocol. Requests wait for one correlated result and require a failure branch. Timeout does not cancel server effects. A field-like service property is modeled as getter, setter and changed event, with private storage; see [the setting example](../examples/08-service-field.swaml).

## Conformance and formal accuracy

Read the [obligation classification](spec/08-conformance-obligations.md), [formal rules](spec/09-formal-semantics.md) and [implementation matrix](IMPLEMENTATION_STATUS.md). S means grammar support, V static validity, K kernel mapping, E execution and G graphical editing. Their obligations are distinct. The reference implementation supplies parsing, broad static checks and a defined logical simulation binding; independent complete certification is not asserted.

A parsed but invalid model is not executable. A valid model may deliberately fail an assertion, overflow a queue, exceed a loop bound, time out, or violate a timing contract at runtime. Report those observations; do not weaken the language to make every accepted model look successful. Unknown syntax and unsupported requested editions must be rejected. The host pins the parser edition; historical file headers are not 1.2 syntax.

## Graphical views and navigation

See [graphical notation](GRAPHICAL_NOTATION.md) and the [canonical concept catalog](GRAPHICAL_CATALOG.md), with original SVG/PNG drawings and graphical/textual notation tables. The Model Browser exposes ownership and definition/occurrence identity. gv shows general structure, iv connections, cv cases/coverage, sv exchanges, grv tabular properties, and fv function flow or states. A selected occurrence retains its instance path when its shared declaration is displayed.

A diagram is a projection of the same semantic model as the text. Layout belongs in a sidecar. Port/member paths and connector identities must remain discoverable; a drawing cannot create a hidden channel. Source edits require parse/link/validation and undo.

## Kernel foundation and interchange

Read [KerML mapping](spec/05-kerml-mapping.md) and the [normalized model](spec/07-normalized-model.md). They specify identities, ownership, value types, routes, behavior lowering, metadata and reverse traces. The [mapping inventory](../spec/kerml-mapping.json) covers every grammar rule and type alias, including syntax that contributes to an owner's semantics rather than creating its own kernel node.

SWAML is defined over a proposed KerML-based semantic contract. This release does not export a kernel-validated artifact or publish a formal SWAML KerML library. The Langium AST is an authoring representation. A backend must preserve SWAML-specific queues, copying, snapshots, correlation and reaction order through a versioned library; kernel metadata alone is not execution support.

## Names, structure and reusable types

See [structure, names and types](spec/01-structure-and-types.md). A package owns top-level declarations; `A::T` selects a package member, while dots follow structural or local-value paths. Imports are direct, not transitive. Short-name ambiguity is an error across declaration kinds. Local functions resolve in their owning component; calculations resolve only in their enclosing function.

`component def` explicitly declares a reusable type. Use `specializes` and compatible `redefines` members when a related type needs controlled variation. Instances create distinct boundaries, stores and activations. A root component is a named occurrence, either inline composition or an instance of a component definition. Both root and nested components may contain components. Only a root carries an execution profile and external deployment binding. Containment is acyclic. A component variable belongs to one occurrence and is initialized before any startup work runs. Reusing a definition never creates shared singleton state.

## Simulation and runtime failures

Use the [reference execution profile](SIMULATION.md). Every example has a checked run configuration. Supply the entire validated workspace, selected root component and finite horizon. The output records exact sources, options, chronological observations and final stores/states. Exercise adverse conditions with the offer-indexed fault schedule and inspect whether the intended offer occurred.

Simulation fixes one deterministic ordering among core-permitted schedules, uses bounded resources and zero local CPU cost. It can expose behavioral failures, queue effects and elapsed-time violations; it cannot prove all schedules safe or establish hardware schedulability. Keep evidence linked to exact source versions and target assumptions.

## Timing, deployment and concurrency

See [timing and deployment](spec/04-systems-and-conformance.md) and [dispatch rules](spec/06-execution-contract.md). WCET is active execution, deadline is elapsed time from release, maxLatency ends at destination readiness, and maxAge measures original message age until dispatch. Periodic deadlines cannot exceed their periods. A state machine's contract applies per reaction, not to its whole lifetime.

Serial activation roots retain their component lock across RPC waits; a callback to that same serial component may have to wait. Reentrant activation roots use read-only dispatch-time snapshots and may not mutate private component state through helpers. Allocation inherits from the nearest explicitly deployed ancestor. An external system/part reference does not supply a scheduler or bypass interface isolation.

## Values and calculation

See [value and expression rules](spec/01-structure-and-types.md). Values are bool, bounded int, finite binary64 real, string, nominal records/enums and fixed arrays. Parameters, locals and messages contain copies. There are no pointers, dynamic collections, implicit remote references or global mutable data.

Use whole-value assignment. Record field and final array-index reads are local value operations; field/index mutation is absent. Calculations cannot read component variables. Numeric widening is scalar; uint/byte assignments are range checked. Division returns real; integer remainder follows the dividend's sign. Arithmetic range, general array bounds and finite loop/microstep behavior are runtime obligations.

## Versioning and language evolution

The source is headerless; its parser/host is explicitly pinned to SWAML 1.2. This specification/package revision is 1.2.1. Interface versions remain independent nominal contract labels. Version 1.2 replaces separate units and operations with component-owned functions, adds calculations and explicit specialization, and uses external deployment references. Follow the [migration guide](MIGRATION_1_2.md) and preserve historical release artifacts.

Multiple inheritance, generics, dynamic instance/subscription/discovery lifecycle, unbounded arrays, reference payloads, hierarchical/orthogonal states, unrestricted fork/join and host-language code are outside this closed version. A proposal adding them must define syntax, ownership, typing, operational meaning, graphical projection, mapping, migration and tests before it is accepted. These concerns must not appear as undocumented backend shortcuts.
