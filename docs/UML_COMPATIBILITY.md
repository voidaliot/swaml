# UML notation and transformation reassessment

SWAML 1.3.1 includes class/component and operation/function vocabulary, flat class compartments and clientServer/service ball/socket notation. **Component specializes Class; Function specializes Operation.** These are semantic kinds in one SWAML model, with shared ownership, port boundaries and execution rules. See [ADR 0014](decisions/0014-classes-operations-and-uml-notation.md).

This chapter reassesses UML-to-SWAML and SWAML-to-UML transformations against that language. It defines a decision table, not an import/export implementation. No XMI adapter is included or proposed by this release. The baseline is SWAML revision 1.3.1, parser family 1.3, and [OMG UML 2.5.1](https://www.omg.org/spec/UML/2.5.1/). Familiar notation does not establish UML conformance or executable equivalence.

## Reading the compatibility table

The **drawing** column compares the current SWAML notation with familiar UML symbols: **reuse** preserves a familiar symbol, **adapt** retains SWAML labels or a changed shape, and **omit** has no corresponding semantic relation. Notation coverage is distinct from a complete graphical editor.

The **UML→SWAML** column describes semantic feasibility: **subset** has a bounded mapping, **configured** needs explicit choices, and **outside core** needs redesign or external preservation. No row claims an implemented transformation. A future conversion would need source identities and an explicit account of every restriction or loss. The reverse direction is assessed separately below.

### Structure, contracts and values

| UML element | SWAML drawing and target | UML→SWAML conditions |
| --- | --- | --- |
| Package | **Reuse:** tabbed namespace frame; `package`, Browser/gv | **Subset:** flatten nested namespaces with an explicit identity/name map. SWAML imports expose a whole directly imported package and are not transitive; selective imports, aliases and visibility need normalization. |
| Component | **Reuse:** flat rectangle, component marker and compartments; `component def`, gv/iv | **Configured:** preserve the Component kind, which specializes Class. Choose the software boundary explicitly. UML realizing classifiers and indirect instantiation do not automatically identify a SWAML runtime component. Retain the SWAML definition marker. |
| Class | **Reuse:** flat class frame with `class def`, typed private compartments and operations/functions, gv | **Subset:** map an owned software class to Class; map an explicitly value-only type to datatype instead. SWAML Class has separate usage stores, owned ports and copied values; UML shared references, public object access, unrestricted dispatch and heap semantics do not follow from the spelling. |
| Composite part / property | **Reuse:** nesting; alternatively an explicitly labeled ownership edge in Tree, gv | **Subset:** one owned composite part becomes one child class/component usage. Shared aggregation, references, subsets, optional parts and variable object multiplicities do not map to single ownership. UML destruction semantics are not imported. |
| InstanceSpecification / object | **Adapt:** `name : Type` occurrence box, gv | **Configured:** static class/component usages only, with a selected complete root and one compatible type. Usage declarations cannot override private initializers; differing source slot values need explicit generated specializations or an initialization redesign. Typed root bodies permit deployment bindings only. Partial slots, shared objects, multiple classifiers and dynamic creation need redesign. Do not underline ordinary SWAML occurrences as if they were all UML InstanceSpecifications. |
| Generalization | **Reuse:** hollow triangle pointing to the base; `specializes`, gv | **Subset:** acyclic single inheritance. Component may specialize Class or Component; Class may specialize Class only. Multiple inheritance, generalization sets and abstract-class semantics have no direct mapping. |
| Redefined member | **Adapt:** explicit `redefines` badge and inherited-member reference | **Subset:** retain the member family and compatible contract. Operation may narrow to Function and Class usage to compatible Component usage; reverse widening is invalid. UML covariance or an inferred override is insufficient. |
| Interface | **Reuse:** interface rectangle with member compartment, iv | **Configured:** select one nominal contract, explicit version and interaction kind. Similar signatures alone do not establish contract identity. |
| Provided / required interface | **Reuse:** ball at server/provides and socket at client/requires, attached to owned ports for clientServer/service, iv | **Configured:** retain the role, contract and version. Service notifications still need explicit reverse-event semantics. Ball/socket does not represent senderReceiver or publishSubscribe. |
| Port | **Reuse:** square on the owning class/component boundary, iv | **Configured:** one interface and one valid role per port. Multiple provided/required contracts, conjugation and protocol-state semantics cannot be silently collapsed. |
| Assembly connector | **Adapt:** named connector between owned typed ports, iv | **Configured:** establish exact endpoints, direction, cardinality and a complete QoS policy. A UML line does not supply SWAML delivery, order, capacity or overflow values. |
| Delegation connector | **Reuse:** outer port to immediate child port, iv | **Subset:** same contract and role; no conversion, extra queue or new behavior. |
| Association / shared aggregation | **Omit:** no generic communication or ownership arrow | **Outside core:** a reference or open diamond cannot become a connector or child implicitly. An explicit redesign must establish ownership or a typed communication contract. |
| Dependency / realization | **Adapt:** a reference overlay only when backed by a mapped reference or interface implementation | **Configured:** a generic dependency has no executable meaning. Interface realization requires actual member implementation through mapped ports; it is not component inheritance. |
| Attribute | **Reuse:** typed private-value compartment, gv/grv | **Subset:** private initialized value with a compatible copied type. Public/protected/static/shared/reference-valued or read-only fields need explicit redesign; do not silently change their access or mutability. |
| DataType / Enumeration | **Reuse:** typed record or enum compartment, gv/grv | **Subset:** finite nominal copied values. Recursive records, object references, datatype operations and unbounded collections have no direct mapping. Map primitive ranges explicitly: UML Integer is not automatically SWAML's bounded `int`. |
| Multiplicity | **Adapt:** one explicit class/component occurrence; fixed extents only for copied values | **Subset:** a part has multiplicity one. Repeated components need separate usage declarations; object collections are not copied fixed arrays. Optional ports are independent of optional objects. |

### Functions, events and behavior

| UML element | SWAML drawing and target | UML→SWAML conditions |
| --- | --- | --- |
| Operation / method | **Reuse:** operation signature and implementation compartment; `operation` or specialized `function`, gv/fv | **Subset:** distinguish interface signature, local untriggered implementation and routed `on call port.member` implementation. Operation signatures accept either compatible implementation kind; Function signatures require Function. Input parameters and at most one result; overloads, out/inout parameters and multiple results need an explicit contract redesign. |
| Query operation | **Adapt:** class/component operation or function; locally owned `calc` only when its stronger rules hold | **Configured:** UML `isQuery` can still read object state. A SWAML calculation must be pure, input-only, operation/function-local and have exactly one named typed non-void result. |
| CallOperationAction | **Reuse:** labeled call action, fv | **Subset:** a local call remains inside the owning component. A remote call needs an interface route, timeout and failure branch. Arbitrary object-target calls and asynchronous RPC calls have no direct mapping. |
| Signal / Reception | **Adapt:** event signature and named receive activation, iv/fv | **Configured:** put the signal in an explicitly selected interface and map its publisher, receiving owner, ports and routes. Preserve payload names/order/types. No free events or implicit bus. |
| SendSignalAction / AcceptEventAction | **Adapt:** publication and receive labels, fv/sv | **Subset:** sends require an emitting operation/function. An entry reception may become `on receive`; arbitrary mid-flow waiting is not equivalent to activation. Interrupt reception needs the exact interruptible-region rules. |
| Activity / action | **Reuse:** rounded action boxes and control arrows in an operation/function-owned fv | **Subset:** supported structured sequential statements only. UML activity token semantics, object flows, performer lanes and arbitrary opaque bodies are not supplied by the drawing. |
| Decision / merge | **Reuse:** diamond with guarded alternatives, fv | **Subset:** structured `if`/`else` with valid Boolean expressions; no general token merge. Preserve branch scope and order. |
| LoopNode / ExpansionRegion | **Adapt:** loop frame with visible bound or copied array extent, fv | **Subset:** bounded `while`, `for`, `do` or copied fixed-array `forEach` when the source structure fits. Unbounded loops and parallel expansion require redesign. |
| Fork / join | **Omit:** no parallel bars in function flow | **Outside core:** do not serialize concurrent branches and claim preserved behavior. Separate activated components/functions require an explicit architectural redesign. |
| InterruptibleActivityRegion | **Adapt:** current explicit protected-region frame, fv | **Configured:** SWAML cancels the same serial activation at statement boundaries. Committed effects and server work survive; a UML interrupt edge alone does not establish these semantics. |
| State / transition | **Reuse:** rounded state, initial circle and labeled transition, fv | **Subset:** one flat operation/function-owned machine, started with `on start`. Preserve supported entry/exit effects, receive/after/completion triggers, explicit priorities and timer origins. |
| FinalState | **Adapt:** named SWAML state rectangle with final badge, fv | **Configured:** UML FinalState cannot own entry behavior; SWAML final states can. A bare UML bullseye would hide that behavior and the state identity. Preserve completion at the function scope. |
| Composite / orthogonal / history states | **Omit:** no corresponding state shapes | **Outside core:** hierarchy, history, deferred events, doActivity and submachines cannot be flattened silently. |
| Concurrency flags | **Adapt:** explicit SWAML function concurrency labels | **Configured:** UML operation concurrency is not automatically SWAML owner-wide serial exclusion or reentrant snapshot semantics. Reentrant SWAML operations/functions cannot mutate component state. |
| OpaqueBehavior / constraint / OCL | **Adapt:** source text or mapped Boolean expression at an explicit evaluation point | **Configured:** only a defined expression/statement subset can execute. Preserve other bodies in the conversion report; do not replace them with empty functions or claim arbitrary OCL support. |

### Cases, timing, documentation and deployment

| UML element | SWAML drawing and target | UML→SWAML conditions |
| --- | --- | --- |
| UseCase | **Adapt:** SWAML case frame for `useCase`, with `of Root` context, cv | **Subset:** map narrative and supported exchanges to a selected root. Keep verification cases visually distinct; `include`/`extend` have no direct relations. |
| Actor | **Adapt:** optional presentation glyph tied to an explicitly mapped class/component | **Configured:** an interacting actor needs a class/component with owned ports and named events/functions. An actor association supplies no stimulus: execution needs an owned emitting function, typed member and explicit route, plus an authored driver schedule when applicable. Do not infer actors from names or create a second participant identity beside the component. |
| Interaction / message | **Reuse:** occurrence lifelines, filled call heads, open event/data heads and dashed replies, sv | **Subset:** actual typed routes, supported case steps, explicit causal predecessors and unique reply correlation. Visual height cannot invent total order. Current canonical SWAML uses filled non-reply heads; a style change must update its inventory and fixtures together. |
| CombinedFragment / general ordering | **Adapt only when exact order is representable** | **Configured:** a case step has at most one named predecessor. Multiple-predecessor joins and alt/loop/par/critical/assert/neg fragments cannot be silently linearized. Cases describe exchanges; importing one does not implement a function. |
| Timing diagram | **Adapt:** shared time axis, intervals and event markers, tv | **Configured:** declared operation/function timing contracts can be shown without a trace. Observed intervals/events require trace provenance and remain separate from those contracts; UML state lifelines or constraints alone are not execution traces or measured WCET. |
| Comment | **Adapt:** plain linked note, retaining lexical ownership | **Configured:** map the UML comment's owner to one SWAML lexical owner; its annotated-element references are separate from ownership. Preserve additional annotation targets externally. Ordinary comments remain separate from the one formal `doc`. Keep the accepted flat plain-note convention. |
| Formal specification text | **Adapt:** owned doc compartment and table field | **Configured:** select at most one formal document per owner. Do not promote all UML comments to `doc`. |
| Requirement / satisfy / verify | **Adapt:** existing SWAML requirement/case notation | **Configured profile mapping:** these are not plain UML-core requirement constructs. Recognize an explicit SysML or testing-profile mapping; only verificationCase owns `verify`, and neither relation proves its claim. |
| Node / Artifact / Deployment | **Adapt:** flat external-target reference and deployment binding, gv | **Configured:** UML deployment allocates artifacts; map artifacts to software occurrences explicitly, then bind to host-resolved external identities. Preserve node/hardware models externally. No cuboids or hardware ontology enter SWAML. |
| Profile / stereotype | **Adapt:** explicitly mapped metadata only | **Configured:** recognize supported profiles by identity. Unknown stereotypes do not generate new keywords, execution rules or claims; retain them in the report for review. |

## Coverage of UML diagram families

Several UML diagrams can project the same SWAML model. They do not require additional SWAML view kinds.

| UML diagram family | SWAML surface | Projection scope |
| --- | --- | --- |
| Package | Browser / gv | Namespace navigation; imports retain SWAML scope. |
| Class | gv / grv | Class/component definitions, owned operations/functions and copied value types. |
| Object | gv | Static class/component usages with distinct paths/stores. |
| Component | gv / iv | Composition and typed software contracts. |
| Composite structure | gv / iv | Single-owned parts, ports, assembly and delegation. |
| Deployment | gv | External target references and software bindings only. |
| Profile | Conversion metadata | Recognized profile mappings; no new core view. |
| Use case | cv | Root-scoped use cases and separate verification coverage. |
| Activity | fv | Restricted structured operation/function flow. |
| State machine | fv | Flat operation/function-owned states. |
| Sequence | sv | Typed case exchanges and their exact supported partial order. |
| Communication | sv / iv | Exchanges or topology when actual routes are known. |
| Interaction overview | Browser / case navigation | Links between cases; no implicit executable composition. |
| Timing | tv | Declared function contracts, optionally accompanied by trace-backed observations. |

Browser and grv remain useful navigation/table surfaces without needing UML diagram labels. The gv Box in box and Tree layouts retain identical selected occurrence paths and topology.

## Reassessment by transformation direction

The added vocabulary removes forced Class-to-Component and Operation-to-Function renaming. It does not remove the semantic restrictions below. A future transformation is acceptable only for an explicitly selected supported subset, with identity and loss reporting. Diagram positions and repeated drawings never create new semantic identities.

| SWAML construct | SWAML→UML representation | Fidelity boundary |
| --- | --- | --- |
| Class / Component definitions and usages | Corresponding classifiers and owned composite properties; preserve authored kinds | Preserve one owner, multiplicity one, acyclic composition and separate usage stores. Do not turn copied value records into shared objects. |
| Operation / Function | UML Operation with a mapped method/behavior; preserve specialized Function kind in constrained metadata | UML has no automatic equivalent of SWAML Function's specialized kind. Preserve typed inputs/result, body category, trigger and local calculation scope. |
| Class/component single specialization and member redefinition | Generalization and explicitly linked redefined features | Preserve the legal subtype directions and full SWAML contract compatibility; a broader UML override is insufficient. |
| Typed ports, nominal interface and connector | Ports, interfaces, provided/required ball/socket and assembly/delegation | Preserve exact version and member identities, direction, cardinality, complete QoS and resolved routes. Ball/socket alone cannot preserve service reverse-event obligations. |
| Private values and copied types | Private properties, data types and enumerations | Constrain bounded numeric domains, fixed array extents, copied payloads and separate stores. Plain UML numeric names or reference properties do not establish these rules. |
| Local calculations | Explicit pure expression behavior scoped to the owning executable | Preserve typed inputs, one named non-void output and the ban on mutable captures or executable calls. Do not relabel an arbitrary UML query as a calculation. |
| Flow and flat states | Supported activity/state subset with explicit execution constraints | Preserve bound failure, serial locks, snapshots, state timers, interrupt cancellation and committed effects. A general UML activity/state diagram permits behaviors outside this subset. |
| Use/verification cases and ordered exchanges | Use cases and restricted interactions with explicit intent metadata | Preserve root context, exact partial order and correlated replies. Verification cases, satisfy and verify need a declared profile/interpretation; the links are not proof. |
| TV timing | Timing presentation plus identified source observations and separate contracts | Retain run/model/profile identities, activation IDs, ordinal ordering, open intervals and declared-versus-observed values. A declared bound is not a trace. |
| Deployment | Software occurrence-to-external-target reference, with explicit artifact correspondence | Preserve external system/part identities and resolution status. Hardware models remain outside SWAML. |

A semantic transformation must distinguish **directly represented**, **represented with explicit constraints/metadata**, **requires an explicit modeling choice**, and **unsupported/redesigned** elements. Dropping source material or choosing a default is not a lossless conversion. Complete source and target identity maps, all chosen policies, unsupported constructs and retained external information would be required evidence.

## Acceptance boundaries

A converted contract/value library or behavior-free structural subset may validate without an executable architecture. A port-owning architecture additionally needs actual handler and emitter behavior. Missing behavior remains a diagnosed draft; an invented empty body cannot establish an equivalent model. For accepted source, ordinary pinned SWAML parsing, linking, validation and concrete-root closure remain mandatory.

A reverse transformation must preserve the SWAML constraints in a declared, inspectable interpretation. A UML consumer that ignores those constraints can read structural content, but cannot claim equivalent queueing, concurrency, cancellation, copied-value or timing semantics. Bidirectional transformation and round-trip preservation are separate claims that require tests; neither is implemented by this release.

The revised assessment is therefore: **structural vocabulary and contract notation align more directly; bounded semantic transformation remains feasible with explicit constraints; general UML behavior/object transformation remains unsupported.** No adapter project or exchange-format implementation follows from this table.

## References

- [OMG UML 2.5.1 specification and normative metamodels](https://www.omg.org/spec/UML/2.5.1/).
- [SWAML guide for UML architects](UML_GUIDE.md), [structure and types](spec/01-structure-and-types.md), [communication](spec/02-communication.md) and [behavior](spec/03-behavior.md).
- [Classes, operations and notation decision](decisions/0014-classes-operations-and-uml-notation.md).
- [SWAML graphical notation](GRAPHICAL_NOTATION.md), [execution contract](spec/06-execution-contract.md), [normalized model](spec/07-normalized-model.md) and [conformance obligations](spec/08-conformance-obligations.md).
