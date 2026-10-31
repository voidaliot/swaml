# 8. Conformance obligations and evidence

Normative chapter of [swa.ml 2.0](../LANGUAGE_SPECIFICATION.md). Acceptance levels are separate; implementations report the tested subset and limitations in their support matrix.

## 8.1 Static obligations

| ID | Required validation | Diagnostic group |
| --- | --- | --- |
| V01 | Headerless pinned edition, portable tokens, malformed recovery and literal domains | syntax, SW2000/2002 |
| V02 | Legal basic/quoted name spelling, unique names, explicit imports, unambiguous qualified/short references, no live-name shadowing | SW2001 |
| V03 | Finite nominal records/enums/fixed arrays, complete typed values, no void data, index ranges | SW2002 |
| V04 | Component-only definitions/usages, finite containment, acyclic single base, explicit compatible whole replacement, typed root additions, positive multiplicity | SW2003 |
| V05 | Directed port shape, reversal, nominal payloads and structural variance with per-member diagnostics | SW2004 |
| V06 | Immediate-child indexed routes, derived forwarding/connection, policy-free unique aliases, no duplicate resolved routes, package connections between top-level occurrences of one package, per-package closure/cardinality | SW2004 |
| V07 | Every required event/attribute and provided operation has one input owner; provided event/attribute emission provenance; interface-only components are exempt | SW2005 |
| V08 | Operation signatures, no nested captures, typed calls/out/result, acyclic graph, return paths, pure initializers | SW2002/2006 |
| V09 | Transitive effect inference, read-only guards, non-writing concurrent entries, suspension only in allowed whole expressions | SW2006 |
| V10 | One schedule, unique effective identities, matching trigger/binding signatures, same-owner acyclic after, fresh void targets and period/deadline rules | SW2007 |
| V11 | Stateful parameterless void signature, exactly one start entry, reachable states, ordered transitions and final restrictions | SW2008 |
| V12 | Typed complete policies, effective-use idempotency, positive safe time/capacity domains | SW2013 |
| V13 | Node-only target content, root/occurrence/index placement resolution and unique exact paths | SW2009 |
| V14 | Immutable requirements, case subjects in the same package, legal associate/satisfy/verify links, seven library view kinds/subjects and stable selection union | SW2010 |
| V15 | Stale-read and inactive interrupt-input warnings without a race-freedom claim | SW2011/2012 |

Validation MUST rebuild semantic string paths as well as indexed references after workspace changes/additions/deletions. Negative lookups matter: a newly loaded declaration may make a previously resolved short name ambiguous. Malformed source remains editable and invalid; recovery cannot silently accept a different program. Definite-return analysis may be conservative rather than solving arbitrary conditions. Dynamic numeric/index/termination failures remain runtime obligations.

## 8.2 Runtime obligations

| ID | Required observable evidence |
| --- | --- |
| E01 | Distinct occurrence/multiplicity stores, copied values, activation-local scopes and successful out copy-back |
| E02 | Initialization barrier, dispatch arguments, serial lock release/reacquisition and concurrent dispatch snapshots |
| E03 | Separate occurrence/direction/member queues, Default policy, latest attributes, overflow/order/age/delivery behavior |
| E04 | Unique routed correlations, result/out reply, failure propagation, timeout tie and terminal late-reply suppression |
| E05 | Ordered expression/flow execution, loop limits, copied iteration, checked arithmetic/indexes, lazy try without rollback |
| E06 | Ordered state reactions, live guards, timer generations, inactive input and final whole completion |
| E07 | Entry release/deadline accounting, finite step/backlog/concurrent resources and explicit violations outside try |
| E08 | Armed interrupt extent across callees/suspensions, same-activation unwind, terminal cancellation and no server rollback |
| E09 | One fresh after activation per successful whole completion after unlock, failure suppression and new context/deadline |
| E10 | Run/source/root/profile/option provenance, trace ordinals, occurrence stores and open observed timing intervals |

A deterministic reference run may choose one permitted order/delivery outcome. Its tests do not establish all possible traces or real transport reliability. A target implementation identifies additional scheduling/transport assumptions and evidence. Idempotency annotations are checked declarations, not proofs of side-effect behavior.

## 8.3 Analysis, kernel and graphical claims

Case realization needs a witness execution with payloads/assumptions. Requirement fulfillment needs identified test/analysis/review evidence beyond satisfy/verify links. Schedulability needs target scheduler, cost and transport assumptions plus measurement/proof. Race/deadlock freedom requires analysis of suspension/interleaving and requests. A finite search without failure is not universal proof.

K requires the complete normalized model, a pinned semantic library/exporter, kernel validation and round trips. Inventory coverage is not K. G requires Browser plus seven source views, occurrence-aware identity, notation, source-validated edits, sidecar layout and atomic native undo/redo. LSP syntax/formatting alone is not G. Semantic paths need path-aware rename/reference/navigation; generic name references are insufficient.

Conformance reports identify edition, exact implementation revision, groups checked, unsupported capabilities, run limits and evidence links. [Implementation status](../IMPLEMENTATION_STATUS.md) is the reference report; it must change when behavior or evidence changes.
