# 4. Deployment, cases, views and conformance

Normative chapter of [swa.ml 2.2](../LANGUAGE_SPECIFICATION.md).

## 4.1 Deployment

Swaml::Platform supplies Node, Platform, Partition and Process component definitions. Node specialization owns only const attributes and child Nodes, with no operations, ports, connectors or schedule. Optional ref: string retains an external model identity for the host; it is not required for swa.ml validity and is never silently resolved as a software path. Buses, hardware timing, core/task allocation and operating-system scheduling are target-translation concerns.

A package deployment Name of Root on PlatformRoot owns placements. deploy on nodePath places the software root; deploy childPath on nodePath places that occurrence and descendants. A more specific path overrides an ancestor; an indexed path overrides a multiplicity family path. Exact paths are unique within one deployment. Every software path and literal index resolves in that root; every target resolves to a Node occurrence of that platform root. Only components are deployed. A top-level occurrence has at most one deployment in the workspace (SW2009 on each later one, at its root reference), and a package or component run applies it to that occurrence's tree; absence remains unallocated.

## 4.2 Requirements, cases and package links

A requirement owns immutable typed attributes and at most one doc. Requirements may be imported. Every relation that records intent about requirements and cases is a package member, never a component member, and none of them proves fulfillment.

A case is written use case Name of subject { … } or test Name of subject { … }. Cases are package members only; components never own cases. The of clause is optional and names a top-level component occurrence declared in the same package: the subject, the system under consideration. A case of a part is written in a package where that component is a top-level occurrence. A case without of, or without statements, records intent only. The case body owns optional documentation followed by optional statements; an executable subject must be a non-multiple software occurrence; platform roots do not execute. A case with statements is a script that may call its primary subject's operations and act through the ports of associated interface-only components (section 3.7), and runs in a fresh run of its package (section 6.7).

associate Occurrence to Case; records that a top-level component occurrence of the same package takes part in a use case or test of the same package. The occurrence is not the case's subject and each pair is associated at most once. In a use case, associated occurrences are its actors. In a test, an associated software occurrence also establishes an explicit white-box participant reference; it may have its own behavior, and its single parts and literally indexed members of its part families may be read or called under section 3.7. Neither kind of case owns those components. Interface-only participants act as actor port proxies; they communicate with the subject only through ports and package connections, and a case script acts through the ports of the interface-only ones.

| ID | Rule |
| --- | --- |
| WP2-S06 | **Association lists.** `associate a, b to 'X', 'Y';` associates every listed occurrence with every listed case: its pairs are each listed occurrence with each listed case, occurrences in list order and, for each, the cases in list order. Each pair follows the rules above (SW2010), reported at its listed reference. A pair repeated within one statement or across statements is an error at the later reference (SW2010, WP2-D03): the repeated occurrence or case of a list, otherwise the occurrence of the later pair. A repeat between two single-pair statements keeps its 2.2 message `Duplicate associate {occurrence} to {case}.` at the later statement. |

```swaml
package Fleet {
  port def Telemetry {
    provides event position(km: int);
  }
  component def Vehicle {
    port uplink: Telemetry;
  }
  component def Backend {
    reversed port truckIn: Telemetry;
    reversed port vanIn: Telemetry;
    attribute positions: uint = 0;
    operation track(km: int) {
      positions = positions + 1;
    }
    schedule {
      on receive truckIn.position(km) track(km);
      on receive vanIn.position(km) track(km);
    }
  }
  component truck: Vehicle;
  component van: Vehicle;
  component backend: Backend;
  connect (truck.uplink, backend.truckIn);
  connect (van.uplink, backend.vanIn);
  use case 'Monitor live position' of backend {
    publish truck.uplink.position(12);
    publish van.uplink.position(40);
    wait 1ms;
  }
  test 'Positions counted' of backend {
    publish van.uplink.position(41);
    wait 1ms;
    assert backend.positions == 1;
  }
  associate truck, van to 'Monitor live position', 'Positions counted';
}
```

satisfy Requirement by design; claims that a component satisfies a requirement. design is a component definition or a top-level component occurrence declared in this package, optionally followed by nested parts such as Workbench.editor or cells[1]; a literal index is within the multiplicity. The claim is written in the package that declares the head of the design path; the requirement may be imported. Each requirement and design pair is claimed at most once.

verify Requirement by Test; claims that a test of this package verifies a requirement. A use case never verifies. The relation is many-to-many; each requirement and test pair is written at most once; the requirement may be imported.

The 2.0 and ADR 0018 case forms are removed rather than deprecated: verification case, cases inside components, actor roles, include and extend between cases, verify inside cases, declarative steps with from, to, via and after, satisfy inside components and satisfy … of. They are ordinary syntax errors.

## 4.3 Views

Swaml::Views provides General, Interconnect, Case, Sequence, Grid, Flow and Timing. A view is typed by a definition, uses compact of subject or one or more include clauses, and owns optional documentation. Include may expand recursive descendants and apply a restricted Boolean where filter over name, kind and path, string comparisons, and/or/not. Filters never call operations or execute behavior. Selection is a union of occurrence identities in first-selection order; duplicates are removed stably.

General and Grid select named semantic elements except views. Interconnect selects components. Case selects packages, cases and components; Sequence selects operations, cases, components and packages. A selected package contributes its cases. Case draws each selected case inside the boundary of its subject occurrence, its associated occurrences outside it, and the satisfy and verify intent links of the package. Flow and Timing select operations, use cases and tests. Paths preserve definition/occurrence identity and explicit multiplicity indexes. Browser is navigation rather than an eighth view kind. General Box in box and Tree layouts retain exactly the same selected identities and topology; layout/collapse/geometry stay in presentation sidecars.

Flow covers statements, nested operation calls, loops, receive, interruption and function-owned states. Timing has declared and observed modes. Declared shows schedule release grid, causes, deadlines, static wait intervals and permitted concurrent overlap. Observed adds an identified trace, serial lock gaps, message latency, activation phases, terminal markers and open intervals; WCET/budget bars identify their target-binding/evidence source. A missing trace never produces fabricated observation. Views introduce no execution semantics.

## 4.4 Validation groups

| Code | Static group |
| --- | --- |
| SW2000 | Syntax and recovery diagnostics in machine-readable CLI output |
| SW2001 | Names, quoted-name spelling, imports, uniqueness and forbidden live-name shadowing |
| SW2002 | Value types, nominal shapes, domains, arguments/results and indexes |
| SW2003 | Definition/usage, specialization, containment and whole-member redefinition |
| SW2004 | Port shape, structural compatibility, endpoints, package connection ends, aliases, per-package closure/cardinality |
| SW2005 | Single input owner and emission provenance; interface-only components are exempt |
| SW2006 | Calls, nested scope, effects, returns, out arguments and suspension placement |
| SW2007 | Schedule identity, signatures, deadlines and after graph |
| SW2008 | Stateful signatures, scheduling, ordered states and reachability/finality |
| SW2009 | Node content, deployment paths, indexes and specificity |
| SW2010 | Requirement/case/view references, case subjects, associate, satisfy and verify links, the environment role and white-box access of case scripts |
| SW2011 | Conservative stale-read warning |
| SW2012 | Inactive interrupt-input discard warning |
| SW2013 | Complete typed policies and representable positive durations |
| SW2014 | Canonical formatting differs, only in explicit formatting-check mode |
| SW2015 | Retired in 2.1 together with the 2.0 case spellings; not reported |

Diagnostics added by 2.3. Message shapes are templates; implementations may add context but keep the leading clause stable. All are errors.

| ID | Code | Condition | Message shape |
| --- | --- | --- | --- |
| WP1-D01 | SW2006 | Place root is not a mutable local, `out` parameter or non-const attribute (WP1-S05) | `Cannot assign to {place}: {root} is {an in parameter \| a const attribute \| a port \| a child component \| a qualified name}.` The reference validator also names `an immutable binding` (an input binding or `for in` element), `a component occurrence` (in a case script) and `not a local, out parameter or attribute`. A bare name keeps its 2.2 message. |
| WP1-D02 | SW2006 | `out` root read before definite assignment (WP1-S07) | `Out parameter {name} must be assigned before {place} is assigned.` For an `on call` out binding: `Out binding {name} must be assigned before {place} is assigned.` or `… before {place} is read.` |
| WP1-D03 | SW2006 | Place as out argument (WP1-S04) | `An out argument must be a name; {place} is a place.` A 2.2 form such as `r.f` or `a[i]` keeps the 2.2 message `An out argument needs a mutable compatible local, out parameter or attribute.` |
| WP1-D04 | SW2002 | Selector typing (WP1-S02, WP1-S03) | `{type} has no field {field}.` / `{type} is not an array and cannot be indexed.` / `Index must be integral, found {type}.` / `Index {n} is outside {type}.` A read without selectors keeps its 2.2 messages. |
| WP1-D05 | SW2010 | Non-literal component index in a test path (WP1-S06) | `Component index in {path} must be a literal.` |
| WP1-D06 | SW2002 | Literal component index outside multiplicity (WP1-S06) | `Index {n} is outside the multiplicity {m} of {child}.` An index on a single part is `{part} is a single part and takes no index.` |
| WP1-D07 | SW2006 | Indexed call path outside a test (WP1-S08) | `{path}: an indexed call path is allowed only in a test.` |
| WP2-D01 | SW2002 | Conditional condition or branch types (WP2-S02) | `Condition must be bool, found {type}.` / `Conditional branches have no common type: {type1} and {type2}.` A void branch has the existing message `Void completion is not an expression value.` |
| WP2-D02 | SW2006 | Suspending call in a conditional (WP2-S04) | `A suspending call cannot appear in a conditional expression.` A suspending call outside conditionals keeps its 2.2 message. |
| WP2-D03 | SW2010 | Repeated association pair (WP2-S06) | `{occurrence} is already associated with {case}.` A repeat between two single-pair statements keeps the 2.2 message `Duplicate associate {occurrence} to {case}.` |
| WP2-D04 | SW2000 | Conditional in statement position (WP2-G02) | The syntax message explains it: `A conditional expression is not a statement; use an if block.` An unparenthesized conditional operand adds to the parser's message: `A conditional expression is a whole expression; as an operand it is written in parentheses, as in (if (c) a else b).` |

Every diagnostic includes a source range and stable code. Machine-readable diagnostics retain declaration identity and occurrence context when resolved. A suggested edit is supplied only for a safe unambiguous correction; tools must revalidate the resulting complete workspace before applying it. Parser recovery may suspend semantic checks on invalid syntax, but the document remains invalid and must not crash the service.

## 4.5 Evidence boundaries

S is syntax, V is static validity, E is reference execution behavior, A is an explicitly scoped analysis, K is validated kernel export and G is validated graphical source editing. Implementations report supported groups and evidence rather than promoting one level to another. [Chapter 8](08-conformance-obligations.md) defines the obligations and [status](../IMPLEMENTATION_STATUS.md) reports actual support. The reference simulator uses logical zero-cost execution and bounded resources; target deployment timing requires separate evidence.
