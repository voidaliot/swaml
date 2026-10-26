# 4. Deployment, cases, views and conformance

Normative chapter of [swa.ml 2.0](../LANGUAGE_SPECIFICATION.md).

## 4.1 Deployment

Swaml::Platform supplies Node, Platform, Partition and Process component definitions. Node specialization owns only const attributes and child Nodes, with no operations, ports, connectors or schedule. Optional ref: string retains an external model identity for the host; it is not required for swa.ml validity and is never silently resolved as a software path. Buses, hardware timing, core/task allocation and operating-system scheduling are target-translation concerns.

A package deployment Name of Root on PlatformRoot owns placements. deploy on nodePath places the software root; deploy childPath on nodePath places that occurrence and descendants. A more specific path overrides an ancestor; an indexed path overrides a multiplicity family path. Exact paths are unique within one deployment. Every software path and literal index resolves in that root; every target resolves to a Node occurrence of that platform root. Only components are deployed. Several deployments may refer to one root and a host selects one explicitly; absence remains unallocated.

## 4.2 Requirements and cases

A requirement owns immutable typed attributes and at most one doc. satisfy Requirement of designPath; records design intent for a package-owned design path; inside a component, satisfy Requirement; claims that component and is inherited with its other members. Only a verification case owns verify Requirement. Neither relation proves fulfillment.

A case is written use case Name { … } or verification case Name { … }. It owns, in this order, optional documentation, actors, use case relations, verify links and steps. It never owns behavior or hidden actors that bypass ports.

The component that owns a case is its subject, the system under consideration. A case declared in a component definition or a usage body is a member of that component: it is inherited by usages and specializations like other members, and each occurrence of the subject carries it. A package-owned case has no subject; it states intent and owns no steps. actor name: ComponentDefinition; declares a typed role outside the subject boundary. Actor names are unique in the case and differ from the names of the subject's members, so a step path starts unambiguously with an actor or with a subject member. Actors are not occurrences of the model: a concrete root binds a role to the occurrence connected to the subject port the actor's steps use, and a host reports a binding as unavailable when it is absent or ambiguous.

include Case; and extend Case; are owned only by use cases and name another use case of the same subject, including inherited ones; a package use case names another package use case. include records that the owning use case incorporates the named one; extend records that the owning use case optionally extends the named base use case. The combined include and extend graph is acyclic and repeats no relation. These relations are intent: steps are not merged and no relation executes behavior.

A step has kind name from source to target, optional via connector and optional after step. Kinds are send, publish, request and reply. Each end is a port-member path: actor.port.member names a port of the actor's definition, port.member a port of the subject itself, and part.port.member a port of an occurrence inside the subject, indexing multiplicity. A step either crosses the subject boundary between an actor and a port of the subject itself, or stays inside the subject. A boundary step needs ports that could be connected: their members are structurally compatible, and it names no connector. An inner step must match a real connection inside the subject; via names that connector and may be omitted only when exactly one connection joins the ends. Actors do not exchange messages with each other, and an actor never reaches a part inside the subject directly. Direction, kind and payload/signature compatibility must match at both ends. Unnamed connectors cannot be selected by name. Forwarding aliases are resolved and do not create a case message.

Names are unique. An after predecessor names an earlier step; source order otherwise contributes display order only. A reply identifies one unanswered causal request ancestor with reversed endpoints, same member and route, where a boundary route is the actor port paired with the subject port. A reply on an independent branch cannot answer another branch's request. Multiple replies to one request or ambiguous causal candidates are errors. Partial scenarios may leave a request unanswered. Route-valid scenarios are intent until an identified witness execution supplies payloads, assumptions and trace evidence.

## 4.3 Views

Swaml::Views provides General, Interconnect, Case, Sequence, Grid, Flow and Timing. A view is typed by a definition, uses compact of subject or one or more include clauses, and owns optional documentation. Include may expand recursive descendants and apply a restricted Boolean where filter over name, kind and path, string comparisons, and/or/not. Filters never call operations or execute behavior. Selection is a union of occurrence identities in first-selection order; duplicates are removed stably.

General and Grid select named semantic elements except views. Interconnect selects components. Case and Sequence select components or cases; a selected component contributes the cases it owns. Case draws selected cases inside their subject boundary, their actors outside it, and their include, extend, satisfy and verify intent links. Flow/Timing select operations. Paths preserve definition/occurrence identity and explicit multiplicity indexes. Browser is navigation rather than an eighth view kind. General Box in box and Tree layouts retain exactly the same selected identities and topology; layout/collapse/geometry stay in presentation sidecars.

Flow covers statements, nested operation calls, loops, receive, interruption and function-owned states. Timing has declared and observed modes. Declared shows schedule release grid, causes, deadlines, static wait intervals and permitted concurrent overlap. Observed adds an identified trace, serial lock gaps, message latency, activation phases, terminal markers and open intervals; WCET/budget bars identify their target-binding/evidence source. A missing trace never produces fabricated observation. Views introduce no execution semantics.

## 4.4 Validation groups

| Code | Static group |
| --- | --- |
| SW2000 | Syntax and recovery diagnostics in machine-readable CLI output |
| SW2001 | Names, quoted-name spelling, imports, uniqueness and forbidden live-name shadowing |
| SW2002 | Value types, nominal shapes, domains, arguments/results and indexes |
| SW2003 | Definition/usage, specialization, containment and whole-member redefinition |
| SW2004 | Port shape, structural compatibility, endpoints, aliases, closure/cardinality |
| SW2005 | Single input owner and emission provenance |
| SW2006 | Calls, nested scope, effects, returns, out arguments and suspension placement |
| SW2007 | Schedule identity, signatures, deadlines and after graph |
| SW2008 | Stateful signatures, scheduling, ordered states and reachability/finality |
| SW2009 | Node content, deployment paths, indexes and specificity |
| SW2010 | Requirement/case/view references, direction, correlation, case subject/actor and include/extend rules |
| SW2011 | Conservative stale-read warning |
| SW2012 | Inactive interrupt-input discard warning |
| SW2013 | Complete typed policies and representable positive durations |
| SW2014 | Canonical formatting differs, only in explicit formatting-check mode |
| SW2015 | Retired in 2.1 together with the 2.0 case spellings; not reported |

Every diagnostic includes a source range and stable code. Machine-readable diagnostics retain declaration identity and occurrence context when resolved. A suggested edit is supplied only for a safe unambiguous correction; tools must revalidate the resulting complete workspace before applying it. Parser recovery may suspend semantic checks on invalid syntax, but the document remains invalid and must not crash the service.

## 4.5 Evidence boundaries

S is syntax, V is static validity, E is reference execution behavior, A is an explicitly scoped analysis, K is validated kernel export and G is validated graphical source editing. Implementations report supported groups and evidence rather than promoting one level to another. [Chapter 8](08-conformance-obligations.md) defines the obligations and [status](../IMPLEMENTATION_STATUS.md) reports actual support. The reference simulator uses logical zero-cost execution and bounded resources; target deployment timing requires separate evidence.
