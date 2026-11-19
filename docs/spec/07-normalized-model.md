# 7. Normalized model contract

Normative information-preservation contract of [swa.ml 2.2](../LANGUAGE_SPECIFICATION.md). It defines what any exporter/target adapter must retain; it does not claim a kernel exporter exists.

## 7.1 Identity and provenance

A declaration identity is package plus owned-name path. An occurrence identity is the top-level occurrence plus indexed containment path; an operation occurrence additionally identifies its effective declaration. Activations/correlations/messages add unique run identities. Anonymous syntax/lowering nodes use an owner plus structural slot/generation role, not an invented user declaration. A statement identity is the identity of its owning operation or case, a slash and the statement path from that executable's body: statement indexes in each statement list and slot names with list indexes for nested blocks, branches, states, actions and transitions, as in Banking::ATM.serve/2/then/0. The `if` of an `else if` is statement 0 of the `otherwise` slot of the `if` it continues, as the `if` of the 2.2 form `else { if … }` is, so both spellings give Banking::ATM.serve/2/otherwise/0/then/0 (SIF-G01). States and transitions are identified by the same path, as in Banking::ATM.run/states/0/transitions/1. A schedule entry is identified by its component and its index, as in Banking::ATM/schedule/0. Statement identities follow source structure and are trace provenance, not persistent editor identities. Source ranges are provenance rather than persistent identities. Every semantic node except a root has one owner; reference edges never imply containment.

Each normalized node/constraint retains source declaration URI/range and any inherited/replacement provenance. A persistent editor identity map is separate, preserving renames/moves atomically with source references and sidecars. Same-type multiplicity occurrences never share stores, queues or activation identity.

| ID | Rule |
| --- | --- |
| WP2-M04 | **Association pairs.** Each occurrence–case pair of an association list is one normalized link. Its provenance is the statement plus the positions of the occurrence and the case in their lists. Deleting one pair in a tool rewrites the list and keeps the other pairs. The reference projection (`projectModel`) gives each link of a list statement its positions as `pair: { occurrence, case }`; a single 2.2 statement has none. |
| WP4-M04 | **Entry identity.** A schedule entry keeps the identity `Component/schedule/N`. Its trigger identity for replacement and duplicates is the canonical form of WP4-S07 (`triggerIdentity`, `entryKey`). |
| WP8-M06 | **Placement identity.** An operation placement is identified by its deployment and exact path, like an occurrence placement. |

## 7.2 Families

| Family | Required content |
| --- | --- |
| Workspace/package | Edition, package revision, sources, imports, unique declaration namespaces |
| Record/enum/type use | Nominal identity, fields/literals, primitive domain, fixed array shape |
| Component definition/usage | Base, effective members, explicit replacements, anonymous usage specialization, multiplicity |
| Attribute/local/parameter | Owner/scope, explicit type, const/in/out, initializer, copied-cell lifetime |
| Operation | Signature, effective whole body, nested ownership without captures, inferred effect flags/class |
| Port/member | Definition or inline members, direction, reversal, optionality, payload/signature, idempotency, initial value of attribute members, sampled members per port (WP6) |
| Connection/forwarding | Endpoint occurrence references, alias provenance, structural member checks, effective policy, member policies with the effective policy per member route (WP6) |
| Deployment | Root and platform occurrences, placements in order with their kind (occurrence or operation), the Swaml::Os Tasks with their Core and attributes, and the effective placement, Task, Core and in-task position of every effective schedule entry (WP8, `deploymentPlan`) |
| Policy | Pinned complete values and declaration/use provenance; no shared runtime queue |
| Schedule/entry | Trigger identity, effective target, dispatch arguments/bindings, period/deadline (a computed one as its expression text plus per-occurrence values, WP4), release guard (not part of trigger identity, WP7), concurrent |
| State (2.3, states in the flow) | A state statement of an operation's flow: name, documentation, `on entry`/`on exit` blocks, event lines (receive member with bindings, or timer with a literal or computed delay) with their blocks, statements standing in the state, inner states; leaves `exit;` and `to S;` are statements with a statement identity. The 2.2 forms (initial/final, ordered transitions, guards with `when`, completion and internal transitions, deferral) are gone |
| Deployment | Software/platform roots, Node paths, family/index placements, effective specificity |
| Requirement/case/view | Immutable attributes/docs, package intent links (associate, satisfy, verify), case kind, subject occurrence and ordered script statements with resolved actor ports, exact normal primary-subject call targets, explicitly associated test access roots and exact inspection/helper targets, ordered selection union; association pairs from list statements with their list positions |

Expansion creates every literal multiplicity occurrence independently and keeps the definition reference. Inheritance produces an ordered effective set; replacement points to its inherited declaration. Late-bound local calls use that occurrence's effective operation name with the preserved signature. An operation usage retains the definition signature and either inherited or replacement body; no partial merge is inferred.

## 7.3 Routes and queues

Each port occurrence has per-member projections with effective provides/requires direction. Resolve forwarding to leaf port identities, retaining the full boundary chain without queue/storage/hop. Every resolved input projection references its unique owner and every provided attribute/event its emission sites. Outgoing operation projection is a request rather than an emission declaration.

A normalized connection records the two leaf ports, per-member directed routes and complete policy. Queue identity is connection occurrence, source/destination direction and member; requests/replies retain correlation separately. Attribute pending values use latest replacement, not event overflow rules. Extra provides remain contract members without fabricated peer requirements. Structural checks preserve each failed/matched member and nominal payload identity.

| ID | Rule |
| --- | --- |
| WP6-M04 | A normalized connection records the effective policy of each member route, and the member-policy declaration where one applies. Every sampled member of a port occurrence records its sample cell with its initial value, and its zero or one consuming owner. The reference API exposes them as `memberQos`, `memberPolicy` and `sampledMembers` (`semantic.ts`) and as `ProjectionEdge.memberPolicies`, `ProjectionNode.sampled` and the `initial` text of port members in `projectModel`. |

## 7.4 Executable lowering

Statements retain ordered operands, scopes, effects and success/failure continuations. Calls are expression nodes with a resolved local/port target, copied in/out/result types and effect flags. Try is a failure-catching node with a lazy fallback, never a rollback boundary. Wait/request/receive creates a suspended continuation plus unlock/readiness/relock; concurrent reads keep the captured dispatch snapshot. Loop limits evaluate once; for in owns one copied collection. Interrupt regions retain armed extent, input ownership, same-activation unwind, request cancellation and inactive/late-input observations.

A schedule entry lowers to a release mechanism and dispatch-time argument evaluation. After edges retain same-owner predecessor operation and completed activation identities, success-only release after unlock, fresh deadline/context and no implicit data forwarding/join. Stateful reactions retain source-order transitions, guards, timer generations and exit/effect/update/entry phases. WP5-M03: they retain source-order completion, timer and receive groups, internal reactions without a state update, timer guards and the deferral set per state. State bodies do not gain separate executable identities. Final entry completes the operation once.

| ID | Rule |
| --- | --- |
| WP7-M02 | A schedule entry with a release guard lowers to its release mechanism, then guard evaluation at dispatch before the arguments, then either the arguments and the activation or a skip that counts as completion for `after` edges. The skip cancels the release's deadline, releases the lock and discards a receive entry's consumed input. |

## 7.5 Presentation and equivalence

Views normalize to library definition plus ordered selected occurrences, retaining original include/filter clauses. General layouts preserve the same graph. Timing observations retain exact source/run/root/activation/correlation identities and open intervals; declared contracts remain independently identifiable. Geometry, collapse, routing bends and camera stay in sidecars.

Equivalence requires an identity-respecting correspondence preserving ownership, types/shapes, effective members, routes/policies, evaluation/effect order, schedule releases and release-guard skips, suspension, failures, cancellation, states, deployment, intent links and selected occurrence order. Whitespace/ordinary comments are outside execution equivalence but remain required for authoring round trips. Exporters cannot drop unsupported semantics silently or claim that carrying metadata supplies execution/kernel evidence.
