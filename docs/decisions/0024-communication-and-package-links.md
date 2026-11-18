# ADR 0024: Sampled reads, member policies, association lists and contextual words

Status: accepted for the unreleased standard 2.3, 18 November 2026. Owner approval of the 2.3 scope and decisions D7 and D12 of the [2.3 proposal](../proposals/NEXT_MINOR_PROPOSAL.md). Not implemented: each rule lands with the work package named in the [2.3 chapter drafts](../drafts/2.3/README.md). This ADR is normative where it differs from the proposal. It amends the "per-use overrides do not exist" sentence of chapter 2.4 and the one-owner rule of chapter 2.1 for sampled attributes. Published editions remain unchanged. WP6 implements B13 and B14 (chapter 2.6, rules WP6-*); see *Implementation in WP6* below for the two choices it made to keep every 2.2 source unchanged.

Items: B13 policy per member, B14 sampled read of a required attribute, B15 reserved member names, B16 association lists. Rejected: B11b port arrays (an additive 2.4 candidate), B11c per-index configuration, B16 absence construct, B21 service discovery. Deferred: B12 boundary port to several children (Tier 2). Work packages: WP2 (B15, B16), WP6 (B13, B14).

## Context

Showcase evidence at `showcase/all` `cc16c25`:

- **Store handlers instead of reads (B14).** Door `ComMain` (754–760, 811–816) keeps `doorAjar` and `windowState` copies only to read the latest required attribute value in `txMainFunction`. Each copy needs a `store…` operation and a receive entry. The model's own documentation (444–455) says swa.ml "has no non-activating read of a required attribute". The door mode is broadcast as an event (`ModeBroadcast.changed`), so eight consumers keep a `sleeping` or `powerMode` copy.
- **One policy per connection (B13).** Door `BodyCanFrames` (163–174, connection at 2779) must give event-triggered frames and cyclic frames one policy, although a body CAN queues and retransmits the first and keeps only the latest of the second.
- **Reserved words as names (B15).** v2x 1452 names a state attribute `sessionState` because `state` is reserved. Its tests at 2322, 2363, 2379 and 2391 read it.
- **Repeated links (B16).** Cloud 2256–2266 writes eleven `associate` statements for four cases.
- **Port selection by `if` (B11b).** Cloud router 896–916 selects `slot0`/`slot1` by an `if` ladder.

The review (finding 7) required:
- a mandatory initial value, because a failing read inside a guard has no meaning;
- the wording "sampling is not ownership";
- rejecting forwarded boundaries;
- an honest account of the edge handlers that remain.

It (finding 12c) corrected the port-array rationale: static port arrays with literal-index connects select among statically closed routes and are not dynamic topology. It (finding 14) required the chapter 2.4 wording change and a rule for `redefines connect`.

## Decision

### Sampled reads (B14, WP6)

In an operation body or a guard of the owning component, `p.m` reads a sample cell when `p` is an owned port of that component and `m` is a required attribute member of `p`, after reversal.

| Aspect | Rule |
| --- | --- |
| Port | `p` is owned by the executing component and is not a forwarded boundary (SW2005). A child's port is not readable (SW2006, unchanged). |
| Cell | One per port occurrence and sampled member, initialized to the member's initial value before startup work is released. |
| Update instant | A cell takes a value at the instant the value is delivered to the port: the message's delivery time after the route's latency and fault delay. This is independent of consumption by any receive owner. A dropped offer never updates the cell; each duplicate copy updates it again at its own delivery instant. Within an instant, a read sees the cell updates ordered before it in the deterministic event order. A zero-latency delivery produced later in the same instant is seen only by later reads (worked example in the chapter 2 draft, WP6-R02). |
| Initial value (D7) | Mandatory. When any component samples a member, the sampling port's effective member declaration has `= e`, a pure expression assignable to the member type (SW2004, port shape; typing SW2002). The provider side's initial value, if written, has no runtime meaning in 2.3. Reads never fail, including in transition, completion, timer and release guards. |
| Ownership | Sampling is not ownership. A sampled required attribute has zero or one consuming owner. An unsampled one keeps exactly one owner (SW2005). |
| Effects | Reads state. Every read, serial or concurrent, reads the cell live and copies the whole value atomically. Cells are not part of a concurrent dispatch snapshot, like `now()`; concurrent entries still read attributes from their snapshot (WP6-R07 amends chapter 3.4). A guard and the body of one activation see the same value unless the body suspends in between. A body read after a suspension sees the newer value. |
| Forbidden positions | Attribute initializers (pure), the constant sublanguage (ADR 0022) and case scripts. Scripts keep `on receive` at actor ports. |
| Trace | A cell update is a new `sample` observation, separate from `deliver`, which keeps meaning consumption by an owner. Reads are not traced. |

Sampled reads serve level-triggered use. Edge reactions keep their receive handlers: resetting on a mode change, switching outputs off on entering sleep, detecting wake-up. In the door rewrite (WP6, WP9):
- a new `ModeState` port carries the mode as a level;
- `ModeManager` sends it, and eight consumers gain `reversed port mode: ModeState` and a connection;
- `ComMain.onMode`, `LinMaster.onMode`, `IoHwAbOutput.onMode` and the wake detection of `IoHwAbInput`/`CanInterface` keep their `ModeBroadcast` handlers.

### Member policies (B13, WP6)

A connection may name a policy per member:

```text
connect bodyCan: BodyCanFrames (bcm.bus, dcu.canBus) {
  crash: CanEvent;
  lockStatus: CanEvent;
}
```

- **Static (SW2004).** Not on forwarding. The member exists, by name, in both connected ports and is routed by this connection. At most one policy per member. Package connections may carry member policies.
- **Static (SW2013).** The policy is a complete `qos def`.
- **Effective policy of a member route:** the member policy, else the connection policy, else `Swaml::Qos::Default`. Every SW2013 check, including the idempotency obligation of `atLeastOnce` requests, applies per member route.
- **Redefinition.** `redefines connect` replaces the whole connection, including all its member policies. Member policies are never merged with the inherited connection's.
- **Runtime.** Queues are already per connection occurrence, direction and member. Only the policy lookup becomes per member.
- **Chapter 2.4 wording.** "Inline policies and per-use overrides do not exist" becomes "Member policies select a named policy per member; inline policies and field overrides do not exist."

### Contextual words (B15, WP2)

`view`, `state`, `in` and `out` become contextual words, legal as names outside their syntactic positions: attribute, local, parameter, operation, state, initial state, port endpoint, view and both `for … in` positions. `defer` (ADR 0023) is contextual from the start. For a 2.3 workspace, name services (`names.ts` `formatName`) write these words unquoted, since a basic name is legal. They are edition-aware: for a 2.2 workspace they keep quoting the words, which are reserved there. A quoted spelling such as `'state'` stays valid and denotes the same name.

### Association lists (B16, WP2)

`associate a, b to 'X', 'Y';` associates every listed occurrence with every listed case.
- Each pair follows the existing SW2010 rules.
- A pair repeated in one statement or across statements is an error (SW2010), reported at the later reference.
- The normalized model records pairs, each with its statement and list positions as provenance.
- A tool that deletes one pair must rewrite the list and keep the other pairs. A consumer that reads only the first occurrence and case of a statement misses pairs.

## Rejected and deferred

- **Port arrays and connector loops (B11b, D12): not in 2.3.** An additive 2.4 candidate. Static port arrays with literal-index connects and a runtime-indexed emission such as `publish slots[t.slot].reading(t);` (failing `Bounds` out of range) select among statically closed routes, exactly like the `if` ladder. They are not dynamic topology, so they can be added in a compatible minor later. They stay out of 2.3 to bound the scope.
- **Per-index configuration (B11c): rejected.** Distinct usages express different configurations more clearly than per-index overrides of one multiplicity family.
- **Service discovery (B21): rejected.** Dynamic topology is outside the language (chapter 2 of the specification, ADR 0019, invariants I1 and I5). Model each binding as a static, optionally `optional`, connection; expose availability as `provides attribute available: bool = false;`; read it by sampling and use it in release guards (ADR 0025). An unconnected optional request already fails `unavailable`.
- **A "did not arrive" construct (B16 absence assertion): rejected.** A bounded wait already expresses it and keeps the bound visible: `on receive … { fail "…"; } or after D { }`.
- **Boundary port to several children (B12): Tier 2.** No instance remains in the revised models: cloud `CommandService` splits its ports by multiplicity (1708–1735), which is B11b. A later addition would require:
  - exactly one forwarded child port for each boundary member;
  - every required member of each child in the boundary;
  - at most one forwarding of a child port;
  - one peer for required attributes and operations.

## Alternatives rejected

- **An optional initial value, with early reads failing `unavailable` (D7 alternative).** A failure inside a transition, completion or release guard has no defined meaning, and no activation exists yet for a release guard (finding 7a).
- **Counting sampling as ownership.** This contradicts allowing a sampled attribute with no consumer (finding 7b).
- **Sampling forwarded boundaries.** A forwarded boundary is never locally handled (chapter 2.1), and its cell would duplicate the child's (finding 7c).
- **Field overrides in a member policy.** These are inline policies under another name. Named policies stay inspectable and checkable.
- **Merging member policies on `redefines connect`.** This makes the effective policy depend on inheritance order; whole-member redefinition is the 2.0 rule.
- **Quoting only (B15 status quo).** Quoting works but pushes reserved-word knowledge onto every author for common member names.

## Consequences

- **Grammar.** `PortMember` gains an optional initial value and `Connect` an optional member-policy body with `MemberPolicy` (WP6). `Association` takes lists and `Name` gains `view`, `state`, `in` and `out` (WP2). Inventories are regenerated in those packages.
- **AST.** `Association` holds several pairs, a silent widening of ADR 0022's 4.0.0 reasoning.
- **Validator.** SW2005 sampling and ownership changes; SW2004 initial values; SW2004 and SW2013 member policies; SW2010 list pairs and duplicates.
- **Simulator.** Sample cells and their `sample` observations; per-member policy lookup.
- **Formatter** (A1). Prints lists, member-policy bodies and initial values.
- **Name services.** Edition-aware unquoting of contextual words.
- **Projection.** Interconnect labels member policies.
- **Consuming tools.** Tools must read and edit every pair of a list statement, and must show sampled reads and member policies.

## Compatibility

The new forms are new syntax. A 2.2 source has no sampled reads, because 2.2 rejects `p.m` as a value. It also has no member-policy body, no initial value on a port member and no list association. The new contextual words were reserved in 2.2, so no valid 2.2 source uses them as basic names. Quoted uses keep their meaning. The SW2005 change only relaxes the rule for sampled members. Release gates: corpus AST identity, unchanged simulation results and a warning-free grammar (ADR 0022).

## Implementation in WP6

- **Opt-in by initial value, per member (compatibility; owner decision A of WP6, provisional).** `p.m` was already valid 2.2 syntax with a 2.2 diagnostic (SW2002 `Unknown local value p.m; …`, plus SW2005 for the unowned member). Recognizing every `p.m` on an owned port as a sampled read would change those diagnostics on 2.2 sources: the missing initial value of D7 would turn SW2002 into SW2004, a forwarded boundary SW2002 into SW2005, and the owner error SW2005 would disappear. WP6 therefore treats `p.m` as a sampled read only when the member `m` itself declares an initial value (2.3 syntax), in the definition the port has in the executing occurrence after redefinition; all the WP6 diagnostics apply there, and `p.m` of any other member keeps its 2.2 meaning and messages. A first version opted in per port (any attribute member with an initial value); the review showed that an initial value then changed the diagnostics of sibling members and of 2.2 files using a library port, and that a port redefinition could drop the opt-in under inherited reads (WP6 review F1). With the opt-in per member, D7's "mandatory initial value" is decidable only where a port redefinition removes the initial value of a member that inherited behaviour samples (WP6-D02, at the redefinition); a read of a member without one is not a sampled read. The owner may still accept the 2.2 diagnostic change instead.
- **Stable reads within a segment.** The reference interpreter interleaves the steps of activations of different occurrences within an instant, so a zero-latency delivery can fall between two reads of one activation. To honour "a guard and the body of one activation see the same value unless the body suspends in between", the first read of a cell after an activation starts or resumes copies it, and the later reads of that cell until the next suspension see that copy (WP6-R03).
- **Replaced and aged values.** A value replaced in the owner's pending queue still updates the cell at its delivery instant; a value older than `maxAge` at delivery is discarded (`discardAge`) and does not.

## Open items

- **When a sampled value becomes readable.** Decided by the owner for WP0: the delivery instant, ordered within the instant by the event order, with live reads; see the table above. Implemented in WP6 with the simulator's delivery events; `test/v2/sampled-reads.test.ts` shows that latency, drops, duplicates, fault delays and `maxAge` update the cell as stated, and the worked example in both orders.
- Port arrays: 2.4 candidate.
- B12: Tier 2.
