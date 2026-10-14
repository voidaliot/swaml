# 9. Formal core and simulation relation

Normative chapter of the [SWAML 1.1 specification](../LANGUAGE_SPECIFICATION.md). These judgments constrain implementations alongside chapters 1–8. They make explicit the distinction between static validity, allowed executions, and a particular target's choice among them. They do not assert a mechanically proved metatheory.

## 9.1 Domains and judgments

Let D be the resolved declaration graph; O the finite expanded occurrence tree; Γ a lexical environment mapping names to types; σ an occurrence-indexed store of copied values; ρ an activation's parameter/local store; Q the connector queues; A the live activations; M the machine states and timer generations; R the correlation table; L the unit serial locks; B the released lifecycle/timer work; and t an integer nanosecond time. A runtime configuration is:

```text
C = (D, O, σ, Q, A, M, R, L, B, t)
D ⊢ O valid                  closed assembly validity
D; Γ ⊢ e : T                expression typing
D; Γ ⊢ s ⇒ Γ'               statement typing and resulting lexical scope
D; σ; ρ ⊢ e ⇓ v : T         successful pure expression evaluation
D; σ; ρ ⊢ e ⇑ f             expression failure
C —label→ C'                one permitted observable/local step
trace(C) = label₀ label₁ …   finite or infinite execution trace
```

A value is a Bool, bounded Int, finite Real, String, nominal enum literal, finite nominal record of values, or fixed array of values. Void has no inhabitants. Record identity includes its qualified declaration identity; arrays include element type and extent. Values never contain references into O, σ, A or Q. An environment binding also carries its declared type; widening an Int into a Real binding preserves Real type even when its mathematical value is integral.

The only assignment compatibility relation is T ≤ T and Int ≤ Real for scalars. Numeric common type is Real if either operand is Real, otherwise Int. There is no array covariance. A scope extension Γ[x:T] requires x absent from the live environment. Block-local extensions are discarded at block exit; assignments to existing cells remain.

## 9.2 Static rule schemas

The schemas below apply recursively, together with the name, ownership, route and contract restrictions in chapters 1–4. A failed premise rejects the construct, rather than adding an implicit conversion or exchange.

| Construct | Premises | Conclusion |
| --- | --- | --- |
| Reference x | x:T in Γ | Γ ⊢ x:T |
| Enum T.literal | no first-segment value T in the current expression environment Γ; one unambiguous accessible enum T; literal in its domain | nominal value:T |
| Qualified enum P::T.literal | loaded package P declares enum T and its literal | nominal value:P::T, independent of lexical T |
| Field e.f | e has nominal record T; T declares f:U | e.f:U |
| Index e[i] | e:T[n], i:Int | e[i]:T; runtime requires 0 ≤ i < n |
| Record T | one value for every declared field; each value assignable to that field | constructed value:T |
| Array | nonempty values have one nominal type or numeric common type T | value:T[n] |
| Arithmetic | numeric operands, `%` additionally Int operands | `/`:Real; `%`:Int; other operators:numeric common type |
| Boolean/comparison | chapter 1 operand conditions | result:Bool |
| f(args) | f owned by current unit; signature-compatible copied args; pure acyclic graph | result has f's declared non-Void type |
| let x:T=e | e:U, U ≤ T, fresh x | Γ ⇒ Γ[x:T] |
| x=e | x:T in Γ, e:U, U ≤ T; activation effect rules permit write | Γ ⇒ Γ |
| invoke f(args) | same-unit untriggered Void operation; signature-compatible args; acyclic graph | Γ ⇒ Γ |
| send/publish p.m | p owned by current unit; correct outward member and verb; compatible args | Γ ⇒ Γ |
| request p.m as x | p owned by unit; outward RPC; compatible args; positive timeout; fresh x and failure name; failure block cannot fall through | Γ ⇒ Γ[x:result] on success; Void x is reserved but uninhabited |
| return e | e assignable to owning operation result | current operation terminates |
| if / while / assert | condition:Bool; loop bound positive safe integer | each nested block checked in a fresh child scope |
| transition | states in same operation; legal stimulus; Bool guard; effect typed with payload; distinct competing priorities | transition belongs directly to its operation |

For root validity, an inline root expands only its authored component/unit children and connectors; a typed root expands exactly its referenced component definition. Both require an acyclic expansion, distinct occurrence stores and port closure. A typed root binding contains only nodes/deployments and introduces no topology. An omitted profile normalizes to service. An omitted operation/signature result normalizes to Void; parameter/data/function result types cannot be omitted. These are defined elaborations, not inference from body behavior.

Let F(op) be the set of unit-variable assignments in op and recursively in every locally invoked helper. For every reentrant activation root, F(op) = ∅. Pure functions have no unit-variable environment and no operation edges. These finite graphs are acyclic, so both checks terminate.

For every normalized connector (p,q), contracts(p) = contracts(q) by declaration identity and roles(p,q) are complementary in the orientation defined in chapter 2. Delegation preserves both identity and role and introduces no queue. Every cross-unit effect is an offer to a member projection of such a connector. Thus a successful path lookup into a remote private store is never an execution rule.

## 9.3 Local execution rules

Expressions evaluate operands left to right, except short-circuit `and`/`or`. A checked arithmetic operation either produces a value in its result domain or raises a local Arithmetic failure. Integer arithmetic is mathematically exact before checking the bounded result; implementations MUST NOT let floating-point rounding turn an out-of-range integer into a valid one. Remainder uses truncation toward zero. Real arithmetic uses binary64. Equality recursively compares typed values; Int/Real numerics compare after scalar promotion.

A let creates a new local cell initialized by a copied, widened value. An assignment evaluates first, then atomically replaces the target cell. An invoke pushes a copied parameter frame on the existing activation root, preserving its lock and snapshot. A helper return pops only that frame. Returning from the outermost activation frame completes the activation. A failure unwinds all frames of that activation root without rollback. A loop tracks completed body iterations: after n executions, it evaluates the condition once more and fails if still true.

A reentrant dispatch snapshots σ for its unit. All unit reads by that activation, including helpers after suspension, use that snapshot. A serial dispatch reads the live store and holds its lock through requests. Local statements may interleave with other enabled activation roots at statement boundaries, but no competing serial activation root can acquire the same lock.

## 9.4 Communication transition schemas

Let q be a route/direction/member queue, capacity k, m a copied message, and c a fresh correlation. `offer(q,m)` is atomic. Each accepted logical message retains its original timestamp through all attempts.

| Rule | Preconditions | State change and observation |
| --- | --- | --- |
| Admit | retained(q) < k | append/admit m; emit admission |
| Reject | full(q), overflow=reject | q unchanged; report rejection to producer/correlation |
| Drop newest | full(q), overflow=dropNewest | q unchanged; emit drop(m); producer admission succeeds |
| Drop oldest | full(q), overflow=dropOldest | discard oldest retained logical message; admit m; observe both |
| Ready | message has reached destination transport boundary | set ready time; check maxLatency against original emission |
| Expire | t − emitted(m) > maxAge | discard before dispatch; no receiver effect |
| Dispatch | m ready, live handler, lock/limit available; FIFO head when required | remove dispatchable occurrence; copy args into an activation frame; record delivery/release/dispatch |
| Request | outward RPC statement, no other awaited statement in that frame | create Pending c with expiry=t+timeout; offer request; suspend caller |
| Respond | handler returned/failed | offer copied result/RemoteFailure on reverse route referencing c |
| Complete | response ready, R(c)=Pending, t < expiry(c) | R(c)=Succeeded/Failed exactly once; resume caller |
| Timeout | R(c)=Pending, t ≥ expiry(c) | R(c)=Failed(Timeout); resume failure block |
| Late response | R(c) terminal | discard; no caller state change |

Fanout applies offer independently to every selected route before propagating any rejection. Running handlers are not queue entries. A dispatch or response cannot fabricate another member, route or correlation. Lifecycle releases, observations and local failures are not message offers. All queue loss and duplicate dispatch must be visible in a checking trace. Delivery policies constrain allowed traces, not source-language branches.

## 9.5 Stateful operation transition schemas

M(op) contains (state, generation, ready, live, reacting). One reaction at a time may execute. Initialization runs initial entry before setting ready. For stimulus z in state s, form candidates with matching source and trigger, evaluate their guards in the appropriate copied payload environment, and select the enabled candidate of maximum priority. No candidate means consume/ignore z. Selection is not applied across unrelated stimuli.

For selected transition s→u: invalidate s's timers; execute exit(s); execute effect with z's payload; change state to u and increase generation; execute entry(u); install one timer per distinct outgoing duration. Any return/failure stops these phases immediately. Final entry terminates the machine. Completion selection then repeats until no transition is enabled or the machine terminates, with at most 1,024 taken completion edges per reaction. Entry/exit lack payload bindings. Completion reconsideration also follows an ignored external stimulus.

A timer stores its machine generation. A stale timer has only a discard transition. A valid timer is released at entry-completion time plus duration, and competes with independent work under the target scheduler. A terminated machine never regains liveness inside the same run.

## 9.6 Time, traces and refinement

Logical time never decreases. A target may advance to the next release, transport availability, deadline or timer event when its scheduling policy permits. Time addition MUST remain exact; a simulator encountering an unrepresentable time stops with an explicit resource/clock failure. Deadline elapsed time includes dispatch delay and suspension; WCET active time excludes suspension. A zero-cost logical simulation can check ordering, queues and elapsed waits but cannot certify physical WCET or schedulability.

An implementation binding refines this specification when every trace it produces can be matched by the core relation, with any internal bookkeeping steps hidden, and it satisfies its declared progress/fairness assumptions. A deterministic simulator chooses one such trace. Passing that run does not establish universal safety or liveness across all allowed schedules, nor realize every descriptive case automatically.

The [reference simulation profile](../SIMULATION.md) specifies a concrete, bounded choice of these rules. Reproducible inputs include all model source digests, selected root component, profile version, time horizon, harness releases, transport parameters and resource limits. No theorem of type preservation, kernel compatibility or trace equivalence is claimed without a separately checked proof artifact.
