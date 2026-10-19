# 4. Root components, timing, cases and conformance

Normative chapter of the [SWAML 1.4 development specification](../LANGUAGE_SPECIFICATION.md).

## 4.1 Root components and profiles

The structural rules in this chapter apply to class and component roots/usages, and executable rules apply to operation and function members. Component specializes Class and Function specializes Operation; the category compatibility rules in chapters 1–3 remain in force. Both alternatives retain closed-root validation, private occurrence stores and explicit typed routes.

A root component is the closed occurrence selected for validation, deployment and execution. It uses the same component concept as reusable architecture: an inline `component Demo { … }` owns component children and connectors, while `component Demo: Assembly;` obtains them from a component definition. Several named roots in one package may instantiate the same definition independently or describe alternative assemblies. Root selection is explicit in the simulator/host by package-qualified name, and is not inferred from file order.

A typed root's optional body is a deployment binding only: deployments may reference existing instances; structural members and behavior MUST NOT be added there. An inline root may contain child components and its own private data, functions and ports. All paths in cases, deployment and simulation are relative to the selected root; the root name is not an extra child segment.

Instantiation recursively creates children and local variable storage, resolves delegation and connectors, checks closure, and then enables startup/periodic activation. No component may publish during a partially connected startup phase.

The root profile is `service`, `realtime` or `mixed`; omission means `service`. A root profile selects timing obligations independently of interface kinds: a `service` root may use any interface kind, and a `realtime` root may use a `service` interface. Only the service profile defaults; QoS, interface versions, timeouts and realtime obligations remain explicit:

| Obligation | service | realtime | mixed |
| --- | --- | --- | --- |
| Explicit connector QoS | required | required | required |
| Function WCET/deadline/concurrency | optional | required for all used functions | required for all used functions |
| Connector maxLatency | optional | required | required |
| Sampled data maxAge | optional | required | required |
| Interface isolation and handler checks | required | required | required |
| Production scheduling evidence | target dependent | required for hard realtime claims | required for realtime claims |

The mixed profile is intentionally conservative: all used functions and connectors carry timing contracts. It does not infer that a cloud-facing function has no timing requirement. A future subassembly profile can relax this with explicit partitioning; no such implicit relaxation exists in 1.4.

A timing contract declares positive `wcet`, positive `deadline`, and `concurrency serial|reentrant`. WCET MUST be no larger than deadline. For periodic functions, deadline MUST be no larger than the period. A stateful function's timing contract applies separately to each run-to-completion reaction, including entry/exit/effect and any completion microsteps, not to the lifetime of the machine.

WCET is active CPU execution time for the activation including synchronous local helpers. Deadline is elapsed time from activation release to completion, including waiting and interference. Connector maxLatency excludes destination dispatch wait. For a chain of functions, the end-to-end bound must account for release delay, queue delay, interference, transport, WCET and response delay; simply summing WCET is insufficient.

A conforming validator checks arithmetic consistency. A conforming target backend must additionally prove or measure its declared timing assumptions with an appropriate execution model. The core specifies no rate-monotonic/EDF policy, task mapping, interrupt priorities, memory size, hardware access mechanism or clock synchronization algorithm. Such a backend MUST supply a named external deployment profile, and MUST NOT claim timing conformance without evidence for those obligations.

## 4.2 Deployment

`deploy instance.path on "sysml:Vehicle::ecu";` associates an existing component instance with an external system or part identity. `system:production::checkout` is another valid reference form. The quoted destination MUST be nonempty and use a URI-like scheme followed by a nonempty identity. The scheme and identity are preserved exactly for a host or target binding to resolve. SWAML does not declare a second hardware/system ontology or load external models through this statement.

A deployment references an instance, not a reusable definition. The root name may be used as its own deployment target, for example `deploy Demo on "system:production";`, to place root-owned behavior and establish its subtree default. If an immediate child has the same name as the root, using that ambiguous name as a deployment target is invalid (SW070). The same explicit instance path may occur in only one deployment. A component deployment applies to that instance and its descendants by default; a more specific descendant deployment overrides the inherited destination. Without a deployment on an instance or ancestor, its effective destination is Unallocated. A valid logical model may be unallocated; a target must supply and validate the placement needed for execution.

For `sysml:` references, the target integration must resolve the identified SysML part/system, preserve its external identity and establish allocation semantics. The string alone is not a SysML import, a validated cross-model link or evidence of SysML/KerML conformance. SWAML's parser checks its local path and reference form; the host checks external existence, kind, availability and execution suitability.

Deployment leaves interfaces, connector identity, handler ownership and private-data visibility unchanged. Serialization, addresses, credentials, task schedules and physical channels belong to the target binding. Every exported mapping must retain the SWAML instance identity and external destination.

### Architecture and target scope

The same component and interface constructs describe embedded, service-oriented, web and cloud architectures. Choose each component boundary around a coherent responsibility with private state, functions and optional child components. External deployment references connect this software model to system architecture without embedding a hardware metamodel.

| Architecture | Core model | Target binding supplies |
| --- | --- | --- |
| AUTOSAR Classic | components for atomic software-component behavior; components for compositions; sender–receiver and client–server contracts; periodic or input-triggered functions; MCU placement | software-component and port mapping, runnable/event mapping, RTE access semantics, task scheduling, ECU data representation and communication configuration |
| AUTOSAR Adaptive | application components; required/provided service contracts with methods and events; process placement | application and execution manifests, service-instance identities, discovery and availability policy, `ara::com` binding and transport configuration |
| Web / SOA | clients and services with explicit request, reply and notification routes; private service state; process/container placement | API and serialization mapping, endpoints, authentication, lifecycle, persistence and failure handling |
| Cloud services | independently placed services; explicit broker/storage adapters where they participate in the model; connector queues and retry contracts | broker and storage guarantees, infrastructure placement, resource limits, restart policy and replica routing |

These mappings are target obligations, not additional core syntax. A function is a behavior owner; mapping it to an AUTOSAR runnable or a web request handler requires an explicit activation and concurrency mapping. An external deployment reference alone does not establish that mapping. An interface's nominal version identifies its SWAML contract; it does not imply wire compatibility with a platform interface.

The 1.4 instance tree and connector topology are fixed for a selected root. Multiple replicas are separate authored occurrences with separate private stores. Discovery, replacement or scaling in a target system MUST preserve the modeled endpoint identities, routes and state isolation; changes to the modeled topology require a new root configuration. A deployment binding cannot introduce a new peer, a shared store or an unmodeled exchange.

The [architecture patterns](../ARCHITECTURE_PATTERNS.md) provide complete examples and explain the additional platform decisions for each mapping. The execution obligations are defined in [chapter 6](06-execution-contract.md#67-execution-binding-contract).

## 4.3 Requirements and cases

`requirement Name { doc /* obligation */ attribute id: string = "REQ-001"; }` declares a named obligation with optional formal documentation and immutable typed attributes. Requirements have no subject. Attribute names are unique; values use the ordinary nominal type rules and cannot read private state, functions or other attributes. `priority` is also accepted as an attribute name.

`satisfy Requirement of Design.path;` is a package-owned relation from a resolvable design element to a requirement. Sources may be software declarations or occurrences in the same package, but not requirements, cases, views or the package itself. Requirement references use the ordinary import/qualification rules. Duplicate source/requirement pairs are invalid.

`useCase Name of Root { ... }` describes intended use. `verificationCase Name of Root { verify Requirement; ... }` describes verification intent. Only verification cases own verify relations, before their exchanges; duplicate targets are invalid. Both kinds may own one doc and zero or more exchanges. Neither satisfaction nor verification links establish fulfilled status or execute a test. Evidence belongs to a versioned external simulation, test, analysis or review result.

A case step has a kind (`send`, `publish`, `call`, `reply`), two endpoint-member paths, a named connector at the selected root composition level, an optional earlier-step predecessor and a unique label. Case endpoints must be visible ports of the root itself or its immediate child components. A typed root resolves those children and connectors through its definition. Internal interactions at a deeper level require a separate root component assembled at that abstraction level. This limitation keeps case paths subject to the same hierarchy rule as structural connectors.

Both endpoints MUST identify the same member of the connector's interface. Sender–receiver steps use data, publish steps use events, and request/reply steps use function signatures. A request follows client → server or requires → provides orientation; a reply reverses the matching request. A service publish goes from provides → requires; ordinary pub/sub follows publisher → subscriber.

`after label` imposes a happens-before dependency on an earlier declared step. No predecessor means no ordering is imposed relative to other steps. Source order is only a stable display tie-break, not an implicit total order. Thus unrelated notifications can remain concurrent in sv. A reply MUST have exactly one unanswered matching request among its transitive `after` ancestors, with reversed endpoints and the same connector/member. Zero or multiple candidates is an error (SW083); each request has at most one reply. A request may remain unanswered in a partial trace. A prior reply closes a candidate only when that reply is itself an ancestor of the current step. A reply on an independent causal branch cannot resolve ambiguity merely by appearing earlier in the file. Source order never chooses between ambiguous correlations. Realization by function bodies is a separate analysis claim requiring a witness; route-valid cases remain unverified until that evidence exists.

Cases describe representative traces, not exhaustive behavior. They do not execute a second program, introduce independent event definitions, or loosen function guards. A complete behavioral verification must check traces against function semantics and environmental assumptions.

### Relation vocabulary

Subject-assignment relations consistently use `of`: a case of a root, a satisfaction claim of a design element, or a compact view of a subject. The relation does not change containment: cases, views and satisfaction relations remain package-owned, and satisfaction still points from design to requirement. Case `for` and satisfaction `by` remain invalid after the 1.2.1 correction; see the [migration guide](../MIGRATION_1_2.md).

| Syntax | Meaning |
| --- | --- |
| `useCase C of Root` / `verificationCase C of Root` | Root context for routed case exchanges. |
| `satisfy R of Design.path;` | Design.path claims satisfaction of requirement R. |
| `view V iv of Subject;` / `include Subject;` | Select existing subjects for a projection. |
| `on` | Activation stimulus or external deployment location. |
| `as` | Local/routed call result or completion binding. |
| `:` / `=` | Type/header separator / value initialization or assignment. |
| `via` / `after` / `->` | Existing route / causal predecessor or timer / directed edge. |

`for` is used only by the counted-loop construct; it is unavailable for subject relations. The loop forms and their bounds are defined in chapter 3.

## 4.4 View declarations

A view declaration names a lower camel case view kind and one or more subjects in its own package. `view Name iv of Subject;` selects one subject. `view Name gv { include Subject; include Other recursive where kind == "function" and name != "debug"; }` selects a stable union. Each include resolves its subject before optional recursive expansion and filtering. Paths identify occurrences even when definitions are reused. Repeated paths are deduplicated in first-selection order. Empty results are valid; blocks require at least one include. Unknown or ambiguous paths are invalid. Filters use name, kind and path as strings; string/Boolean literals; ==, !=, and, or, not and parentheses. The whole predicate must be Boolean. Traversal is independent of filtering. Evaluation is pure presentation and cannot read stores or call behavior. gv and grv may reference any resolvable named semantic declaration or the owning package, except another view; iv requires a class/component root, definition or nested occurrence; cv references a case or root component, sv references a case or root component (for case selection), and fv/tv reference executable operations/functions. A view of an instance resolves through its definition while retaining the occurrence path and identity.

The seven source view kinds are gv, iv, cv, sv, grv, fv and tv. fv presents statement flow, interruptible regions or function-owned states. tv presents function timing. Both select executable operation/function declarations or occurrences; interface signatures, calculations and individual states are invalid subjects. A compact tv of a root or component definition is invalid. To select functions under that context, write an explicit block such as `view timeline tv { include App recursive where kind == "function"; }`. Selected results must all be executable operations/functions; no implicit kind filter or recursive expansion is added. Empty filtered results remain valid. Filters match exact authored kind: use `where kind == "operation" or kind == "function"` to select both executable categories. A timing selection does not require a trigger or declared timing contract and does not supply trace evidence.

View declarations carry no executable behavior. A tv presentation may reference an identified execution trace while keeping declared WCET/deadline/concurrency contracts separate from observed events. Missing traces or completions cannot be invented.

GV supports **Box in box** and **Tree** layouts of the same selected model. Box in box uses nested ownership frames; Tree uses an ownership hierarchy with explicit edges. Changing between them preserves declaration/occurrence paths, ownership, references, ports and routes. It does not instantiate, reparent or reconnect software. Layout, color and collapsed regions are presentation data. Authored include/filter clauses have the deterministic selection semantics above; they do not alter the selected model. The full [graphical contract](../GRAPHICAL_NOTATION.md) defines representation and source-edit invariants.

### Documentation and comments

`doc /* multiline text */` is the owning declaration’s formal specification. At most one is permitted. The grammar defines owner positions: first in a body, before a leaf semicolon, before a transition, or before a QoS policy body. Text is preserved literally, including line breaks and backslashes; blocks are non-nested and end at the first */ delimiter. Ordinary comments remain separate hidden lexical tokens: each // line and each /* */ block is one comment. Neither annotation affects execution. The lexical doc token includes its prefix and block; doc is included in the reserved-word inventory.

A comment belongs to the narrowest named declaration containing its source extent. A trailing comment on the same line as a completed declaration belongs to that declaration. File-level comments belong to the model. A formal doc belongs only to its grammar owner. Graphical tools draw each comment as a plain note inside the owner or connected with a plain dashed line. Formal doc is a labeled compartment or a table column; it must not be duplicated as a second owned specification. Hiding annotations never removes their source or ownership.

## 4.5 Static validity rule groups

The following groups collectively define semantic validity. Diagnostic numbers identify the present implementation's related checks, not a license to omit unimplemented clauses.

| Group | Required checks | Diagnostic family |
| --- | --- | --- |
| Reuse | acyclic single specialization; explicit compatible redefinition | SW014–SW015 |
| Names | pinned language edition, uniqueness, imports, reference target kind, ambiguity, lexical scopes | SW002–SW004, parser/linker |
| Contracts | interface kind/member compatibility, role compatibility, exact interface identity | SW010–SW013, SW031–SW032 |
| Values | nominal typing, arity, field completeness, enum membership, array shape, literal ranges, purity, no recursive value containment | SW020–SW028 |
| Architecture | acyclic specialization/composition, compatible explicit redefinition, local/immediate-child boundaries, one delegation, no duplicate links/aliases, closure/cardinality | SW030–SW035 |
| Time/QoS | positive/bounded values, explicit policy, sampled buffering, WCET/deadline/period, realtime completeness | SW040–SW045 |
| Behavior | local-only calls/data, outgoing provenance, signatures, unique handlers, return coverage, terminating error paths, bounded loops, no recursion | SW050–SW059 |
| States | legal stateful signature, final-state rules, priority, reachability, completion-cycle restrictions | SW060–SW064 |
| Allocation | existing instances, valid external destination identities, no duplicate exact deployments | SW070 |
| Requirements | immutable attribute typing, valid design sources, verification-case-only verify links, unique relations | SW090–SW091 |
| Presentation/cases | subject kind, connector/member paths, happens-before and uniquely correlated replies | SW080–SW083 |

## 4.6 Conformance levels

**Syntax conformance (S):** the complete concrete grammar, pinned host/parser version, tokenization and AST construction. Recovery during editing must retain syntax diagnostics; an incomplete AST is not a valid model.

**Static conformance (V):** S plus every static validity rule in this specification, classified explicitly in [chapter 8](08-conformance-obligations.md). A partial validator MUST enumerate checks that it lacks. It must not hide unresolved links or a validator crash as success.

**KerML mapping conformance (K):** V plus chapter 5's normalized elements and preserved SWAML semantic constraints, with a tested mapping against KerML 1.0 and its selected libraries. Export must retain a reverse trace map and stable identity. K does not automatically imply SWAML execution.

**Execution conformance (E):** V plus the operational, correlation, queue, timing-observation, failure and concurrency semantics. Target binding assumptions must be explicit. A simulator may abstract physical time while still reporting which timing obligations it does not check.

**Graphical conformance (G):** S and the graphical specification's projection and edit rules. G may present invalid models with diagnostics, but must not invent valid connectivity from layout. fv projects a function's statement flow or owned states; tv projects its timing with identified trace provenance and separate contracts. GV layout changes preserve model identity and topology.

The 1.3.1 revision introduces tv while retaining parser family 1.3 and simulation profile `swaml-reference/1.3`; exact reproduction also pins the package revision. See [ADR 0012](../decisions/0012-timing-view-and-structure-layouts.md) and the [1.3.1 migration guide](../MIGRATION_1_3_1.md).

A tool claiming `SWAML 1.4 development S, partial V` accurately describes this repository's current core. It must not advertise K, E or G until those implementations and checks exist. A language host must require an explicit supported edition, and incompatible changes require documented migration. Version 1.1 is an intentional syntax revision; it is not backward-compatible with 1.0 despite the minor version number. Migration tooling must not change the meaning of models silently.
