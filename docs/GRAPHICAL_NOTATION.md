# SWAML graphical notation

**Language:** 1.2 · **Notation edition:** 1.2.1 · **Status:** normative

This chapter defines how every SWAML language concern is represented and inspected graphically. The [canonical notation catalog](GRAPHICAL_CATALOG.md) pairs each element or property with original graphical and textual notation, contextual constraints, and downloadable SVG/PNG examples. The [worked view examples](GRAPHICAL_EXAMPLES.md) show those ideas in complete architectures. The [notation inventory](../spec/notation.json) records coverage of the concrete grammar and reserved vocabulary.

The organization separates a concept catalog from construction and interaction rules, informed by the [SysML specification review](SYSML_STYLE_REVIEW.md). The drawings and rules here are original SWAML material. They do not claim SysML graphical conformance or introduce language constructs absent from the SWAML grammar. A shipped renderer, editable workbench and kernel exporter remain separate implementation milestones.

## 1. Scope, authority and coverage

The textual grammar and normative language chapters determine model meaning. A graphical representation MUST preserve that meaning. The catalog supplies canonical depictions of that model; it cannot legalize a missing connector, unsupported state region, free event, cross-component reference or invalid source fragment.

Every grammar production and reserved keyword MUST have an explicit coverage entry in the inventory. Coverage either names a catalog concept or identifies a text-only contribution with a reason. Lexical trivia, precedence productions and grouping rules need no independently editable glyph. Their textual or ownership role must still be accounted for. Every view family also has a canonical projection example.

The classification is precise:

| Classification | Graphical contribution | Examples |
| --- | --- | --- |
| Node | a bounded selectable semantic element | component, function, calculation, state, interface |
| Edge | a relationship with typed endpoints | connector, delegation, deployment, case exchange |
| Compartment | owned content inside a node | parameters, members, entry/exit statements |
| Label | a value or modifier attached to its actual owner | timing, role, optionality, profile, guard, QoS |
| Projection | a view of existing identities and relationships | Browser, gv, iv, cv, sv, grv, fv |
| Text-only coverage | source syntax contributing to an owner without a separate glyph | comments, punctuation, expression precedence and grammar unions |

A label sample drawn inside a card is not a new model node. Catalog IDs, concern headings and drawing templates are documentation identifiers, not additional SWAML keywords. Fragments in the textual-notation column require the stated context; only complete model examples can be parsed alone.

The chapter, catalog rules and inventory MUST agree. A conflicting image, label or rule is a notation defect to fix, not permission for tools to invent a third meaning. Normalization and runtime semantics remain those of the language specification.

## 2. Canonical drawing vocabulary

Canonical SVG and PNG assets use dark strokes/text on a white background. Shape, line style and explicit wording carry meaning. Color is optional presentation data in a workbench or worked example and MUST NOT be the only carrier of type, role, direction, optionality or error state.

All SWAML graphical projections MUST use flat two-dimensional geometry. External deployment targets use ordinary labeled rectangles, like the other allocation and architecture frames; cuboids, isometric faces, perspective, extrusion, bevels, gradients and cast shadows MUST NOT be used. Containment and deployment are expressed by enclosure, labels and edges, never by apparent depth. This rule applies to canonical specimens, worked examples and interactive views.

A semantic node has a header and optional horizontally separated compartments. The header shows its kind and name, with typing where applicable. The project labels `«component»`, `«component def»` and similar guillemet labels identify SWAML concepts; they do not import a UML stereotype mechanism into the language.

| Element family | Required form and identification |
| --- | --- |
| Package | namespace frame with package name; a tab may identify its namespace role |
| Component definition | rectangular frame with component marker and `«component def» Name` |
| Component occurrence | corresponding frame with `name : Type` and occurrence context |
| Root component | component frame, root occurrence name, optional type and effective profile |
| Record/enum declaration | contract-style rectangle with kind/name and field/literal compartment |
| Interface | rectangle with kind, name, version and member signatures |
| Function | rounded node or owning frame labeled `«function»`, signature and activation source |
| Calculation | owned calculation compartment with purity indication, complete signature and expression |
| State | rounded rectangle, state name, optional entry and exit compartments |
| Requirement | rectangle with kind/name and text or inspectable synopsis |
| Case | rounded node or case frame with kind/name and selected root context |
| External deployment target | flat rectangle with `«external system»` and the exact reference identity; inspectable host-resolution status |

Definition and occurrence markings MUST be distinguishable without color. The `def` indication is mandatory for reusable component types. A root usage has no `def`; a typed root retains its referenced type. The effective service profile may be shown as `service (default)` when omitted in source, with source spelling available on inspection. Diagrams MUST NOT add a `system` frame or authored `machine` node.

Empty compartments may be omitted. A nonempty collapsed compartment MUST have an omission indicator and a way to inspect its contents. Ordering of fields, parameters, statements and case dependencies follows language rules; visual sorting cannot change ordered semantics. Node size, location, elbow routing, typography and whitespace are layout choices unless a rule below assigns them meaning.

## 3. Names, ownership, types and values

Names on diagrams resolve through the same package, import and local-scope rules as source. A short name may be displayed only when its fully qualified identity is available and the shortening cannot mislead the reader. An instance view retains both its occurrence path and shared declaration identity. A selected component occurrence never denotes all same-type components' storage at once.

Semantic containment depicts real ownership. A view frame or explicitly labeled context frame identifies the projection’s subject; enclosure in that frame does not reparent elements. In particular, a case’s `of Root` context is a reference to the selected root, while the case remains owned by its package. Component frames may contain child component instances, ports, connections, private variables and functions. A function frame contains its local calculation compartments and statement flow or directly owned states. No performer lane or action-allocation edge is introduced. External software-facing devices must be modeled as components with ports.

A typing reference is explicitly labeled `type` and joins an occurrence to its definition. It is descriptive, does not transport data and does not denote inheritance. A separate `specializes` edge denotes a component definition's single base. A replacement member is marked `redefines` and links to the inherited member. Neither relation is a communication route. The `name : Type` header alone is sufficient when an additional typing edge would clutter the view.

Datatype fields show `field : Type`; enum compartments list their declared literals. Primitive names, fixed-array extents and result types are labels, not autonomous architecture nodes. A private variable may show its declared type and pure initializer. A local value belongs to its lexical function/block scope. Record, enum and array construction are expressions displayed as source text or expression subtrees in that owner.

An expression subtree MUST preserve operand order, precedence, short-circuit conditions and nominal typing. Qualified enum text remains distinguishable from a local field read. Graphical editing MUST use the current expression environment for that distinction. No value edge may expose another component's private state or imply reference-valued payloads. Whole-value assignment and copied payloads retain their source-language meaning.

## 4. Interfaces, members and ports

An interface node shows one of the four kinds, its nominal name and exact version. Its member compartment distinguishes data, events and function signatures:

| Kind | Member display | Permitted role pair |
| --- | --- | --- |
| senderReceiver | typed data with sampled/queued mode | sender / receiver |
| clientServer | ordered input parameters, result and optional idempotent label | client / server |
| publishSubscribe | event name and ordered payload parameters | publisher / subscriber |
| service | function signatures and event signatures | requires / provides |

A missing function result annotation has effective type void. The diagram may display void for clarity, but MUST expose whether it was explicit or omitted when editing source. Events have no result. An idempotent badge is an asserted contract property; it is not a verified-effects badge. A field-like service property remains separate getter/setter/event members with private storage, never a remotely writable attribute.

A port is a small square touching the boundary of its owning component. Its label identifies `name : Interface` and role. The exact interface version must be visible in an expanded label (`name : Interface @ version`) or available through the identified contract’s inspectable details. Full role text is canonical; a workbench may abbreviate to `S`, `R`, `C`, `Svr`, `Pub`, `Sub`, `Req`, or `Prov` only with an available legend and full accessible text. Contract kind cannot be inferred from a square alone. In an isolated port specimen, arrows illustrate the role’s direction, rather than declare a connector to an unnamed participant. A dashed reverse arrow illustrates RPC replies; service events use solid reverse message arrows in an exchange projection.

Optionality and connectivity are different properties. An optional port MUST carry `optional`; the boundary square remains white like other ports. No separate optionality glyph is required. A required port MUST NOT be inferred merely from dark fill or a drawn line. An unconnected required port in a closed root is visibly invalid, not visually erased. An optional unbound request retains Unavailable semantics; a blank diagram region is not an implicit service.

Port inspection MUST expose its contract members, role-derived directions, handler owner, emitting functions and resolved delegation chain. The diagram may show a local association from a member to a function as a labeled handler/emitter relationship. That association is not a second architectural connector and cannot point directly to a remote function.

## 5. Architectural edges, direction and communication policy

Every architectural exchange edge MUST terminate at visible port squares or an explicitly elided port endpoint whose full path is inspectable. A line ending at a function box or a component's unlabeled center cannot stand in for a typed communication route. Crossings do not create junctions; each connector keeps its own identity and queue policy.

| Relation | Canonical line and endpoint | Required interpretation and label |
| --- | --- | --- |
| Sender–receiver connection | solid, filled triangular arrowhead at receiver port | sender → receiver; interface and data relation |
| Publish–subscribe connection | solid, filled triangular arrowhead at subscriber port | publisher → subscriber; interface and event relation |
| Client–server connection | solid, filled triangular arrowhead at server port | client → server; RPC request orientation |
| Service connection | solid, filled triangular arrowhead at provides port | requires → provides; reverse events/replies disclosed |
| Delegation | solid line without arrowhead between outer and child port | `delegate`, identical role/contract, no queue |
| Typing reference | dashed, hollow triangular arrowhead at definition | `type`, no exchange or inheritance |
| Specialization | solid, hollow triangular arrowhead at base definition | `specializes`, single inheritance |
| Member redefinition | reference link or inspectable inherited-member identity | `redefines`, compatible replacement |
| Import reference | dashed, open V arrowhead at imported package | `import`, no runtime relationship |
| Deployment | dashed, open V arrowhead at external target | `deploy`, no communication |
| Requirement trace | dashed, open V arrowhead at requirement | `satisfy` / `verify` until separate evidence exists |

A connector's arrow indicates the declaration's orientation, not a promise that the middleware is one-way. Service notifications and RPC responses travel in the reverse role direction on their existing route. Fanout draws distinct named connectors, not an unnamed event bus or a junction that merges queue identity. Receiver/client/requires cardinality and duplicate-route checks remain mandatory.

A package-owned reusable policy uses a flat rectangle labeled `«qos def» Name` and a property compartment. A connector selecting it carries `qos Name`; inspection exposes its qualified declaration identity and complete effective fields. This reference is not a communication edge and cannot share queues.

Expanded connector detail MUST show effective delivery, ordering, capacity and overflow. Optional maxLatency/maxAge appear with time units. A compact connector may show an inspectable QoS label or linked compartment, but cannot silently supply omitted mandatory fields. Sampled/queued, atLeastOnce, timeout and idempotent labels do not collapse into a single reliability icon.

Delegation is a forwarding alias. Its line MUST be visually distinguishable from an inter-child connector and labeled `delegate`; no queue, transform, handler or retry icon is added. Routing through a hierarchy preserves each boundary port. Drawing a shortcut to a grandchild without the corresponding chain is invalid.

## 6. Function signatures, triggers and control flow

A function header identifies its owning component, signature, effective result, trigger and optional timing contract. Its trigger may be start, manual, every with duration, receive with local port member, or call with local port member. Triggers are labels on functions, not free signal nodes. Missing trigger means a local helper subject to the normal invocation restrictions.

A calculation is a pure local expression with explicit non-void result. Its signature and expression occupy the owning function’s calculation compartment; a focused card depicts that compartment without introducing a separate architecture element. A local `call` node references an untriggered same-component flow function and shows its result binding when non-void; a calculation-call expression references a calculation in the enclosing function. These depictions MUST NOT allow arbitrary cross-object calls merely because an edge can be drawn.

fv statement nodes are owned by the displayed function/block. Text-only statements may be shown as a labeled rounded node or source compartment. Their text is authoritative, and they do not become independent action definitions. The minimum required forms are:

| Source concern | Required projection |
| --- | --- |
| var / assignment | typed declaration or assignment text in an ordered statement node |
| expression / calculation call | exact expression or inspectable ordered expression subtree |
| if / else | Boolean decision with true/false branches and a merge of control |
| bounded while | condition decision, body/back edge and explicit positive bound |
| assert | condition and failure outcome, distinct from a prose requirement |
| local call | function reference, optional typed result binding and continuation |
| send / publish | verb, local port.member and payload expressions |
| routed call | local port.member, inputs, result/completion binding, finite timeout and failure branch |
| return | completion node with bare or typed-result text |
| fail | failure terminal with its reason; no implicit event |

The first flow marker is a filled circle identifying local activation entry. Ordered flow edges are solid with filled triangular arrowheads; a Boolean decision is a diamond. Return/failure nodes retain explicit terminal labels so neither is mistaken for an interface message. Flow edges sequence local execution and cannot cross an owning component boundary. Decisions MUST show which branch is true/false; an absent else still has a false continuation. Loop depictions MUST show the bound and the bound-violation outcome, even if detailed failure edges are collapsed with an inspectable marker. A back edge is not permission for unbounded execution. Fork/join, parallel regions and arbitrary activity allocations have no notation because they have no SWAML 1.2 syntax.

A request has a success continuation and a terminating otherwise branch. The latter exposes Timeout, Unavailable, Rejected, Transport and RemoteFailure as possible interface outcomes and its local failure binding. The diagram MUST NOT suggest that timeout cancels committed server effects, that the result exists on failure, or that a void completion name is data. A remote request node is still a local function step; the architectural route is inspected through its port reference and iv.

## 7. Directly owned state behavior

The state projection is the fv of one function. It has a function frame, one initial reference marker, state nodes and transitions. There is no independent machine owner, state definition/usage layer, performer or behavior allocation.

A filled initial circle with an outgoing local-control edge selects the declared initial state. It projects the function’s unique initial reference, rather than adding another authored element. It denotes local initialization, not an interface event. Each state shows its name and optional entry/exit compartments. A final state remains a named state node and carries `final` plus a final marker consisting of an outer circle and filled center; it completes its function after entry. The marker cannot replace the state name or hide its entry behavior. Finality MUST remain apparent when a compartment is collapsed.

State transition edges are solid with filled triangular arrowheads at the destination state. Their labels preserve source and destination, trigger, optional guard, priority and effect. The canonical textual content is `trigger [guard] / effect`, with explicit `priority n` when supplied; absent priority has effective zero. The transition's source name or source identity remains inspectable even when the diagram places text on its edge.

Receive triggers name the owned `port.member` and contract payload. Delay triggers show `after duration`; completion is labeled `completion`. Timer and completion edges are local control, not communication channels. A guard is a Boolean condition, not a new state. Priority resolves competing transitions for one stimulus; it does not globally schedule unrelated inputs.

Transition inspection exposes the exit → effect → state update → entry order. Payload bindings are available only to the guard/effect, not entry/exit. A self-transition visibly returns to the same state and still exits/reenters, resetting timers. A return/failure inside any phase terminates the function and cancels timers; a graphic cannot imply later phases still occur.

Unconditional completion cycles remain invalid; guarded cycles retain the bounded completion-reaction rule. No-enabled-transition consumption, stale-timer discard and undeliverable input to a terminated function may appear in trace overlays. These overlays are observations, not new model messages. Hierarchical/orthogonal regions, history, do-activity compartments and state inheritance are absent.

## 8. Timing, profiles and deployment

Timing is a label/compartment attached to the function; it lists wcet, deadline and concurrency with exact durations. Every, maxLatency, maxAge and request timeout stay attached to their respective trigger, connector or request. Time units are always shown. A profile label belongs to the root component, not every nested component by visual implication.

The display distinguishes declared, defaulted and measured values. No timing declaration means unspecified physical timing, not zero execution cost. Serial/reentrant applies to function activation roots and their helper context; it does not make a component execute or reenter. Reentrant snapshot semantics and state-reaction non-overlap remain inspectable constraints.

A deployment edge joins an existing component instance to an external system/part identity. Direct and inherited allocations MUST be distinguishable in Properties or grv. A typed root's binding adds deployments only; a drawing editor cannot add behavior or topology there. External existence and suitability are host-checked properties, displayed separately from local path validity.

Runtime trace annotations may show elapsed deadlines, queue counts, timers and failures. They MUST identify the run/profile/source and distinguish observations from source contracts. Logical simulation results cannot be restyled as physical timing evidence.

## 9. Cases, requirements and sequence exchanges

A requirement node shows its identity, attributes and formal doc compartment. A useCase names intended use and its root. A verificationCase may own verify links to requirements. A satisfy arrow starts at a design element; a verify arrow starts at a verification case. Both point to the requirement. Verified status requires linked evidence with identity, assumptions and result; the source link alone never earns a verification checkmark.

sv lifelines represent component occurrences at the selected case's composition level. Each endpoint names its port and interface member. Exchange labels retain the case step label, kind, named connector and any predecessor. Requests follow client/server or requires/provides orientation; replies reverse their matched request; provider events follow provides/requires direction.

Sequence request/data/event arrows are solid with filled triangular arrowheads and explicit call/send/publish labels. A reply is dashed with an open V arrowhead in the reverse direction. Lifelines are dashed vertical guides; they are not channels. A request and its reply display one shared correlation reference derived from the uniquely matched causal request. A reply line does not create another interface member or independent return channel. An unanswered request remains visible as an incomplete partial trace, rather than receiving an invented reply.

An sv renderer MUST preserve `after` causality. Vertical location is a layout tie-break and MUST NOT impose order on independent steps. Independent groups must be marked as unordered/concurrent or expose the dependency relation explicitly. A reply with ambiguous or missing request ancestry is invalid even if its position looks plausible.

Case diagrams never introduce free actor messages, topic names, hidden connectors or independent action execution. Their routes and member directions are statically checked; realization by function bodies still needs an execution/analysis witness.

## 10. Views and navigation

| Surface | Primary subject | Required content |
| --- | --- | --- |
| Browser — Model Browser | workspace or selected subtree | ownership, definition/occurrence identity, references, diagnostics |
| gv — General View | package or named semantic declaration except another view | declarations, ownership, types, properties and relationships |
| iv — Interconnect View | root/nested component occurrence or component definition | immediate children, boundary ports, connectors and delegation |
| cv — Case View | case or root component | cases, requirements and claimed coverage |
| sv — Sequence View | case or case selection from a root | port/member exchanges and explicit dependencies |
| grv — Grid View | package or named semantic declaration except another view | sortable identity-aware properties, contracts and allocation |
| fv — Flow View | function | statement/control-flow or directly owned states |

These are the complete view families. fv projects both statement flow and function-owned states. Browser is navigation, not a new declaration keyword. A package subject is its own name; nested view subjects retain occurrence context while resolving shared members through definitions.

The Browser follows packages → definitions/root occurrences → child occurrences → ports, variables and functions → calculations, statements or states. Opening a usage keeps its occurrence context. Open declaration selects the shared definition; Up selects the owner; Diagram chooses an applicable view. Selection updates Properties. These are host requirements, not commands already implemented by this repository.

grv minimum columns depend on concern: inventory identity/kind/owner; interface version/member/roles/emitter/handler; connection endpoints/QoS; function signature/trigger/timing; deployment explicit/effective external identity; requirement attributes/doc/satisfaction/verification/evidence status. Sorting and filtering change presentation only. Computed values reveal their source and cannot be edited as independent declarations.

## 11. Canonical assets and reproduction

Each catalog entry has a stable ID and an SVG, PNG and scene JSON under `docs/notation/`. The SVG is resolution-independent line art; the PNG provides the same drawing for tools that require raster images. Its pixels MUST depict the same geometry, labels and semantic distinctions. PNG compression or metadata differences are not semantic differences; reproduction checks compare decoded pixels.

The scene is a deterministic drawing source containing basic primitives and text, not another semantic model. Inventory entries identify the concept, classification, context, syntax fragment, normative rules and accessible description. The catalog also provides an alphabetical term index. Existing worked figures remain separately linked to complete validated models and illustrate composed views rather than replace concept coverage.

Run `python3 scripts/build-notation.py` to generate the canonical assets/catalog and `--check` to verify reproducibility. The semantic coverage checker validates exact keyword/production coverage and the declared contexts/links. A passed coverage check establishes documentation completeness, not parser correctness for arbitrary fragments, graphical-editor conformance or execution proof. Every edition also requires visual review of the assets and PDF renditions.

## 12. Editing, accessibility and graphical conformance

Text and diagrams project one semantic model. Layout sidecars may store view/subject identity, geometry, bends, collapsed regions, filters and styling. They MUST NOT duplicate ports, interfaces, routes, triggers or function bodies as independent semantics.

A graphical mutation resolves semantic identities, prepares a source edit, parses/links/validates the result, reports new errors and applies the edit atomically with undo. Incomplete editing states may be displayed only with visible diagnostics. Moving a node changes layout; reparenting changes ownership and must revalidate all affected scopes, routes and behavior.

Deleting a port reveals affected connectors and handlers. Renaming updates typed references and path-valued references together. Generated AST addresses and source offsets are not stable editor identities. A workbench must preserve a separate identity map or equivalent stable reference strategy.

All drawings and grids require keyboard navigation, visible selection, textual alternatives and non-color error indications. SVG examples contain accessible descriptions; PNG examples accompany those same captions. Labels must remain legible under scaling, and lines must not obscure text or make unrelated edges look joined. Hidden details must remain inspectable.

A graphical-conformance claim requires every applicable projection, identity rule, editing invariant and accessibility obligation in this chapter. Producing the canonical static catalog is useful reference material; it is not a claim that the repository already implements an interactive graphical editor.

## Formal documentation and ordinary notes

A formal doc appears once per owner in a labeled doc compartment, or as a doc column in grv. Every ordinary line or block comment is a separate plain rectangular note contained in its owner or connected by a plain dashed line without an arrowhead. Notes have no folded corner, depth or semantic verification status. Collapsing a note preserves its source and ownership. See [requirements and documentation](REQUIREMENTS_AND_DOCUMENTATION.md).
