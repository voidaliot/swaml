# 4. Systems, timing, cases and conformance

Normative chapter of the [SWAML 0.1 specification](../LANGUAGE_SPECIFICATION.md).

## 4.1 Systems and profiles

A system is a closed architecture assembly. Its top-level occurrences are components. Several systems in one package may describe alternative assemblies of the same definitions. Instantiation recursively creates children and local variable storage, resolves delegation and connectors, and then enables startup/periodic activation. No unit may publish during a partially connected startup phase.

The system profile is `service`, `realtime` or `mixed`:

| Obligation | service | realtime | mixed |
| --- | --- | --- | --- |
| Explicit connector QoS | required | required | required |
| Operation WCET/deadline/concurrency | optional | required for all used operations | required for all used operations |
| Connector maxLatency | optional | required | required |
| Sampled data maxAge | optional | required | required |
| Interface isolation and handler checks | required | required | required |
| Production scheduling evidence | target dependent | required for hard realtime claims | required for realtime claims |

The mixed profile is intentionally conservative: all used operations and connectors carry timing contracts. It does not infer that a cloud-facing operation has no timing requirement. A future subassembly profile can relax this with explicit partitioning; no such implicit relaxation exists in 0.1.

A timing contract declares positive `wcet`, positive `deadline`, and `concurrency serial|reentrant`. WCET MUST be no larger than deadline. For periodic operations, deadline MUST be no larger than the period. A stateful operation's timing contract applies separately to each run-to-completion reaction, including entry/exit/effect and any completion microsteps, not to the lifetime of the machine.

WCET is active CPU execution time for the activation including synchronous local helpers. Deadline is elapsed time from activation release to completion, including waiting and interference. Connector maxLatency excludes destination dispatch wait. For a chain of operations, the end-to-end bound must account for release delay, queue delay, interference, transport, WCET and response delay; simply summing WCET is insufficient.

A conforming validator checks arithmetic consistency. A conforming target backend must additionally prove or measure its declared timing assumptions with an appropriate execution model. The core specifies no rate-monotonic/EDF policy, task mapping, interrupt priorities, memory size, hardware access mechanism or clock synchronization algorithm. Such a backend MUST supply a named external deployment profile, and MUST NOT claim timing conformance without evidence for those obligations.

## 4.2 Deployment

An execution node is named and has kind `mcu`, `process` or `container`. A deployment maps an existing component or descendant unit/component instance path onto a node declared in the same system. It does not reference a definition. The same explicit instance path may occur in only one deployment.

A component deployment applies to all its descendants by default. A deployment of a more specific descendant overrides that inherited location for its subtree. If no deployment exists for an instance or ancestor, the instance is logically modeled but unallocated. An unallocated architecture can be valid; an executable target configuration cannot silently pick a node and call it specified.

Deployment does not change interfaces, connector identity, callback ownership or private-data visibility. Interprocess or intermachine implementations must preserve value and correlation semantics. Serialization formats, discovery identifiers, service addresses, credentials, broker topics and physical channels belong to a separate target binding document. Any exported backend MUST record the SWAML element identity for every generated mapping.

## 4.3 Requirements and cases

`requirement Name "text";` declares a named natural-language obligation. `case Name for System satisfies Requirement, … { … }` defines a scenario and optional trace links. A `satisfies` link is an assertion of intended coverage, not verified fulfillment. Verification evidence belongs to a test, analysis or review artifact linked by an implementation tool.

A case step has a kind (`send`, `publish`, `request`, `reply`), two endpoint-member paths, a named top-level system connector, an optional earlier-step predecessor and a unique label. Case endpoints must be visible system-level component ports; internal component interactions require a separate scenario in a system assembled at that abstraction level. This limitation keeps case paths subject to the same hierarchy rule as structural connectors.

Both endpoints MUST identify the same member of the connector's interface. Sender–receiver steps use data, publish steps use events, and request/reply steps use operation signatures. A request follows client → server or requires → provides orientation; a reply reverses the matching request. A service publish goes from provides → requires; ordinary pub/sub follows publisher → subscriber.

`after label` imposes a happens-before dependency on an earlier declared step. No predecessor means no ordering is imposed relative to other steps. Source order is only a stable display tie-break, not an implicit total order. Thus unrelated notifications can remain concurrent in SV. A reply MUST be causally after an outstanding matching request on that connector/member; otherwise the case is invalid. Every step must ultimately be realizable by unit operations behind the exposed ports. These last two trace-realizability rules require more analysis than the prototype currently performs.

Cases describe representative traces, not exhaustive behavior. They do not execute a second program, introduce independent event definitions, or loosen operation guards. A complete behavioral verification must check traces against operation semantics and environmental assumptions.

## 4.4 View declarations

A view declaration names a view kind and a dot-separated subject in its own package. GV, IV and GRV may reference structural subjects; CV references a case or system, SV references a case or system (for case selection), and FV references an operation. A view of an instance resolves through its definition while retaining the occurrence path and identity.

View declarations carry no executable behavior. Layout, color, filters and collapsed regions are presentation data. The full [graphical contract](../GRAPHICAL_NOTATION.md) defines representation and source-edit invariants.

## 4.5 Static validity rule groups

The following groups collectively define semantic validity. Diagnostic numbers identify the present implementation's related checks, not a license to omit unimplemented clauses.

| Group | Required checks | Prototype family |
| --- | --- | --- |
| Names | version, uniqueness, imports, reference target kind, ambiguity, lexical scopes | SW001–SW004, linker |
| Contracts | interface kind/member compatibility, role compatibility, exact interface identity | SW010–SW013, SW031–SW032 |
| Values | nominal typing, arity, field completeness, enum membership, array shape, literal ranges, purity, no recursive value containment | SW020–SW028 |
| Architecture | acyclic composition, immediate-child boundaries, one delegation, no duplicate links/aliases, closure/cardinality | SW030–SW035 |
| Time/QoS | positive/bounded values, explicit policy, sampled buffering, WCET/deadline/period, realtime completeness | SW040–SW045 |
| Behavior | local-only calls/data, outgoing provenance, signatures, unique handlers, return coverage, terminating error paths, bounded loops, no recursion | SW050–SW059 |
| States | legal stateful signature, final-state rules, priority, reachability, completion-cycle restrictions | SW060–SW064 |
| Allocation | existing instances and nodes, no duplicate exact deployments | SW070 |
| Presentation/cases | subject kind, connector/member paths, happens-before, correlated replies, realizable exchanges | SW080–SW082 |

## 4.6 Conformance levels

**Syntax conformance (S):** the complete concrete grammar, exact version, tokenization and AST construction. Recovery during editing must retain syntax diagnostics; an incomplete AST is not a valid model.

**Static conformance (V):** S plus every static validity rule in this specification. A partial validator MUST enumerate checks that it lacks. It must not hide unresolved links or a validator crash as success.

**KerML mapping conformance (K):** V plus chapter 5's normalized elements and preserved SWAML semantic constraints, with a tested mapping against KerML 1.0 and its selected libraries. Export must retain a reverse trace map and stable identity. K does not automatically imply SWAML execution.

**Execution conformance (E):** V plus the operational, correlation, queue, timing-observation, failure and concurrency semantics. Target binding assumptions must be explicit. A simulator may abstract physical time while still reporting which timing obligations it does not check.

**Graphical conformance (G):** S and the graphical specification's projection and edit rules. G may present invalid models with diagnostics, but must not invent valid connectivity from layout. FV combines flow/state projection; GEV/AFV/STV are not SWAML view kinds.

A tool claiming `SWAML 0.1 S, partial V` accurately describes this repository's current core. It must not advertise K, E or G until those implementations and checks exist. Future versions must use a new language header when breaking syntax or semantics; migration tooling must not change the meaning of models silently.
