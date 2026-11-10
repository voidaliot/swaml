# ADR 0021: Normal subject calls from use cases and tests

Status: accepted for implementation in the unreleased 2.2 draft, 10 November 2026. Amends the primary-subject call clauses of ADRs 0019 and 0020. Published editions remain unchanged.

## Decision

Both a use case and a test may call operations of their exact primary subject using the existing `subject.operation(arguments)` syntax. The subject remains a referenced top-level software occurrence of the case's package. The case owns no component, and no runner component, implicit port or connection is created.

The call borrows the subject's serial execution context as a local call. Its body may use the subject's own state and ports, communicate, receive and wait. Suspension releases the subject lock; resumption reacquires it and reads live state. The case continues only after the call returns. Stateful operations retain their existing on-start-only rule. Normal suspension-position rules apply: a suspending call is the whole value of an ordinary variable declaration or assignment, or a standalone statement, optionally in `try`. It cannot occupy a for-header initializer/update; evaluate it before the loop. Existing immediate expression calls remain legal.

The interpreter switches the actual running frame into the subject context for the call, rather than executing a copied case frame. It restores the case context and releases the subject lock on normal return and failure. Results and successful output values return to the caller; failed calls do not copy outputs. Ordinary runtime failures remain catchable by `try`; contract and resource violations remain outside it.

This is a local call within the case activation, not a fresh schedule release. It creates no transport queue, route, QoS policy or implicit request timeout and does not release `after` successors on return. The case horizon and existing runtime limits remain effective. Trace consumers preserve source, occurrence and activation context without inventing a separate invocation observation.

## Access boundary

A use case may call only its primary subject's own operations. It cannot inspect private component attributes or directly call subject parts or associated components. Tests additionally retain the private reads and helper calls authorized by ADR 0020: subject and explicitly associated software roots and their single parts. Calls on those extra owners must neither communicate nor suspend. Neither case kind assigns component attributes directly.

Actor interaction remains through associated interface-only actor ports with the existing direction, ownership and explicit-route rules. Association does not permit impersonating an active component's ports or choosing execution roots.

## Sequential actor replies

A direct call is synchronous from the script's perspective. An actor message sent before return remains queued for a later receive. If the subject waits for a reply that the same case would provide in a later `on call` branch, that branch cannot run while the case is blocked. Model an independently behaving actor, or stimulate the subject through an actor event before serving the reply. Do not silently execute later case statements concurrently or turn the call into a fire-and-forget invocation.

## Validation evidence

Require positive use-case and test calls with state/results, own-port emission and request/reply, waits with live-state interleaving, receive, failure/`try`, success-only outputs, context restoration and bounded unfinished calls. Reject use-case private reads, part/peer calls and subject-port impersonation; retain the test-helper restrictions. Graphical creation and completion use the same core call policy and retain the actual case source identity.
