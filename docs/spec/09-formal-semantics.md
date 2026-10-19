# 9. Formal core and simulation relation

Normative chapter of the [SWAML 1.4 development specification](../LANGUAGE_SPECIFICATION.md). These judgments constrain implementations alongside chapters 1–8. They make explicit the distinction between static validity, allowed executions, and a particular target's choice among them. They do not assert a mechanically proved metatheory.

These judgments apply to class/component usages and operation/function executables alike. Component <: Class and Function <: Operation are software-kind relations, not permission to introduce reference values, runtime casts or arbitrary object calls. The kind information remains explicit in D and its occurrence typing.

## 9.1 Domains and judgments

Let D be the resolved declaration graph; O the finite expanded occurrence tree; Γ a lexical environment mapping names to types; σ an occurrence-indexed store of copied values; ρ an activation's parameter/local store; Q the connector queues; A the live activations; M the machine states and timer generations; R the correlation table; L the component serial locks; B the released lifecycle/timer work; and t an integer nanosecond time. A runtime configuration is:

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

A value is a bool, bounded byte/uint/int, finite real, string, nominal enum literal, finite nominal record of values, or fixed array of values. void has no inhabitants. Record identity includes its qualified declaration identity; arrays include element type and extent. Values never contain references into O, σ, A or Q. An environment binding also carries its declared type; widening an int into a real binding preserves real type even when its mathematical value is integral.

Assignment compatibility includes identity and scalar widening byte ≤ uint ≤ int ≤ real. Integral assignment into uint or byte additionally requires a destination-domain range check, statically for known constants and at runtime for computed values. real never implicitly narrows. Integral arithmetic yields int; division or a real operand yields real. Numeric array literals preserve a common identical type; mixed types yield real when any element is real, otherwise int when any is int, otherwise uint. A literal checked against a declared array type checks each element against that destination domain. Existing array values retain invariant element type and length. A scope extension Γ[x:T] requires x absent from the live environment. Block-local extensions are discarded at block exit; assignments to existing cells remain.

## 9.2 Static rule schemas

The schemas below apply recursively, together with the name, ownership, route and contract restrictions in chapters 1–4. A failed premise rejects the construct, rather than adding an implicit conversion or exchange.

| Construct | Premises | Conclusion |
| --- | --- | --- |
| Reference x | x:T in Γ | Γ ⊢ x:T |
| Enum T.literal | no first-segment value T in the current expression environment Γ; one unambiguous accessible enum T; literal in its domain | nominal value:T |
| Qualified enum P::T.literal | loaded package P declares enum T and its literal | nominal value:P::T, independent of lexical T |
| Field e.f | e has nominal record T; T declares f:U | e.f:U |
| Index e[i] | e:T[n], i:byte/uint/int | e[i]:T; runtime requires 0 ≤ i < n |
| Record T | one value for every declared field; each value assignable to that field | constructed value:T |
| Array | nonempty values have one nominal type or numeric common type T | value:T[n] |
| Arithmetic | numeric operands, `%` additionally integral operands | `/`:real; `%`:int; other operators:real when either operand is real, otherwise int |
| Boolean/comparison | chapter 1 operand conditions | result:bool |
| f(args) | calculation f owned by enclosing function; signature-compatible copied args; pure acyclic graph | result has f's declared non-void type |
| var x:T=e | e:U, U assignable to T with required range check, fresh x | Γ ⇒ Γ[x:T] |
| x=e | x:T in Γ, e:U, U assignable to T with required range check; activation effect rules permit write | Γ ⇒ Γ |
| call f(args) [as x] | same-component untriggered flow function; compatible copied args; acyclic graph; fresh x required exactly for non-void | Γ ⇒ Γ[x:result] for value return, otherwise Γ ⇒ Γ |
| send/publish p.m | p owned by current component; correct outward member and verb; compatible args | Γ ⇒ Γ |
| call p.m as x | p owned by component; outward RPC; compatible args; positive timeout; fresh x and failure name; failure block cannot fall through | Γ ⇒ Γ[x:result] on success; void x is reserved but uninhabited |
| return e | e assignable to owning function result | current function terminates |
| if / while / assert | condition:bool; loop bound positive safe integer | each nested block checked in a fresh child scope |
| for | fresh typed initializer local; condition:bool; typed update in header scope; positive literal bound | header scope encloses fresh body scopes and is discarded after the loop |
| forEach | copied nonempty fixed array; compatible explicit element type; fresh binding | one fresh copied element/body scope per array position |
| do | positive literal bound; body checked first; enclosing condition:bool | at least one body; body locals absent from the condition |
| interruptible | triggered serial flow owner; unique local incoming member; typed payload bindings | normal and interrupt branches share outer scope, activation and deadline; protected locals cannot escape |
| transition | states in same function; legal stimulus; bool guard; effect typed with payload; distinct competing priorities | transition belongs directly to its function |

Let structuralKind(d) be class or component and executableKind(f) be operation or function. A component usage requires a component definition; a class usage accepts either structural kind. A class definition may specialize only class, while component may specialize class or component. A replacement may narrow class usage to component usage or operation to function, preserving the remaining contract; it cannot widen either specialized kind. An operation RPC signature accepts either executable kind, while a function RPC signature requires function.

For root validity, an inline class/component root expands its authored component children, connections and local behavior; a typed root expands exactly its compatible referenced class/component definition. Both require an acyclic expansion, distinct occurrence stores and port closure. A typed root binding contains only deployments and introduces no topology. An omitted profile normalizes to service. An omitted function/signature result normalizes to void; parameter/data/calculation result types cannot be omitted. These are defined elaborations, not inference from body behavior.

A connector selecting `qos P` requires one unambiguous package-visible QoS policy declaration P. Its effective policy equals P.body; an inline selection uses its own body. The base-field, sampled, idempotency and realtime premises are checked on that effective body for every use. Queue identity is still the connector occurrence, direction and member, independent of policy identity.

Before expansion, compute effective members by following the acyclic single-specialization relation. Every duplicate inherited name requires compatible explicit redefinition. Resolve inherited local references against the effective component context. Expansion then assigns a distinct store and lock to every instance, including a root with local behavior. Type reuse never identifies stores.

Let F(op) be the set of component-variable assignments in op and recursively in every locally invoked helper. For every reentrant activation root, F(op) = ∅. Calculations have no component-variable environment and no function edges. These finite graphs are acyclic, so both checks terminate.

For every normalized connector (p,q), contracts(p) = contracts(q) by declaration identity and roles(p,q) are complementary in the orientation defined in chapter 2. Delegation preserves both identity and role and introduces no queue. Every cross-component effect is an offer to a member projection of such a connector. Thus a successful path lookup into a remote private store is never an execution rule.

The integral domains are `byte = {0,…,255}`, `uint = {0,…,2^53−1}` and `int = {−(2^53−1),…,2^53−1}`. Scalar widening preserves value along byte → uint → int → real. A checked integral assignment into byte or uint either yields an in-range value or raises a range failure; it never wraps. Integral arithmetic produces int unless division or a real operand determines real. A calculation evaluates its one expression in a copied input-only environment and returns its named output value; it creates no component activation or shared store.

Operator and test publications are ordinary steps of source functions in O. Their message offers obey the communication transition rules below. The core has no separate external rule that directly releases a receiving function or inserts a destination message without a producing function and route. Initial, periodic and state-timer releases retain their existing local lifecycle semantics.

## 9.3 Local execution rules

Expressions evaluate operands left to right, except short-circuit `and`/`or`. A checked arithmetic operation either produces a value in its result domain or raises a local Arithmetic failure. Integer arithmetic is mathematically exact before checking the bounded result; implementations MUST NOT let floating-point rounding turn an out-of-range integer into a valid one. Remainder uses truncation toward zero. real arithmetic uses binary64. Equality recursively compares typed values; integral/real numerics compare after scalar promotion.

A local var creates a new local cell initialized by a copied, widened value. An assignment evaluates first, then atomically replaces the target cell. A call pushes a copied parameter frame on the existing activation root, preserving its lock and snapshot. A helper return copies and typechecks its result, pops only that frame, and binds the successful non-void result in the caller’s lexical environment. Returning from the outermost activation frame completes the activation. A failure unwinds all frames of that activation root without rollback. A loop tracks completed body iterations: after n executions, it evaluates the condition once more and fails if still true.

A counted loop evaluates its initializer once in a new header scope. Each true test permits one body while the count is below the bound, followed by its assignment update. A do loop starts with its body and then tests; a true test after the nth body fails before any extra execution. forEach evaluates/copies its array once and processes its ordered elements in fresh scopes; collection and element mutations do not change the saved sequence. Return/failure propagates without later update or condition effects.

An armed region adds a typed receive watch to its current serial activation. Delivery disarms the selected watch and transfers control by unwinding to that region's handler boundary. Outer-scope cells and committed effects remain; protected locals and abandoned local-call frames disappear. A Pending caller correlation becomes terminal Interrupted; terminal correlations are unchanged. The new handler continuation retains the activation lock/snapshot/deadline, while all queued resumes of the abandoned continuation are invalid. The server has no cancellation transition implied by this local transfer. Region exit, return and failure remove the associated watch; unavailable watches produce explicit input discard observations.

A reentrant dispatch snapshots σ for its component. All component reads by that activation, including helpers after suspension, use that snapshot. A serial dispatch reads the live store and holds its lock through requests. Local statements may interleave with other enabled activation roots at statement boundaries, but no competing serial activation root can acquire the same lock.

### Successful completion release

Let `dep(o,A)` be the finite set of effective same-owner completion dependents of executable A in occurrence o. The static judgment requires a triggered A, a parameterless void flow body for each dependent and an acyclic effective dependency graph. On successful whole completion of activation a of A, terminate a and release its serial lock before adding one fresh lifecycle item `(o,B,t,cause=completion,predecessorActivation=a,predecessorFunction=A)` to B for each `B ∈ dep(o,A)`. Each release uses the normal bounded backlog, fresh activation identity, dispatch-time context and release-relative timing. Fanout has no specified order and supplies no implicit join.

The failure rule has no dependent-release effect. Returning from a borrowed local helper is not whole activation completion. For a stateful A, only final-entry completion or a bare return terminating the whole machine applies this success rule; ordinary reaction completion/quiescence does not. Successful RPC handler completion applies it independently of later response transport or correlation outcome. No source parameter/result or predecessor snapshot is copied into the new activation. A dependent failure cannot revise A's completed outcome. This lifecycle rule is local to one owner and is not a message offer or an external stimulus bypass.

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

## 9.5 Stateful function transition schemas

M(op) contains (state, generation, ready, live, reacting). One reaction at a time may execute. Initialization runs initial entry before setting ready. For stimulus z in state s, form candidates with matching source and trigger, evaluate their guards in the appropriate copied payload environment, and select the enabled candidate of maximum priority. No candidate means consume/ignore z. Selection is not applied across unrelated stimuli.

For selected transition s→u: invalidate s's timers; execute exit(s); execute effect with z's payload; change state to u and increase generation; execute entry(u); install one timer per distinct outgoing duration. Any return/failure stops these phases immediately. Final entry terminates the machine. Completion selection then repeats until no transition is enabled or the machine terminates, with at most 1,024 taken completion edges per reaction. Entry/exit lack payload bindings. Completion reconsideration also follows an ignored external stimulus.

A timer stores its machine generation. A stale timer has only a discard transition. A valid timer is released at entry-completion time plus duration, and competes with independent work under the target scheduler. A terminated machine never regains liveness inside the same run.

## 9.6 Time, traces and refinement

Logical time never decreases. A target may advance to the next release, transport availability, deadline or timer event when its scheduling policy permits. Time addition MUST remain exact; a simulator encountering an unrepresentable time stops with an explicit resource/clock failure. Deadline elapsed time includes dispatch delay and suspension; WCET active time excludes suspension. A zero-cost logical simulation can check ordering, queues and elapsed waits but cannot certify physical WCET or schedulability.

An implementation binding refines this specification when every trace it produces can be matched by the core relation, with any internal bookkeeping steps hidden, and it satisfies its declared progress/fairness assumptions. A deterministic simulator chooses one such trace. Passing that run does not establish universal safety or liveness across all allowed schedules, nor realize every descriptive case automatically.

The [reference simulation profile](../SIMULATION.md) specifies a concrete, bounded choice of these rules. Reproducible inputs include all model source digests, selected root component, profile version, time horizon, input schedules expressed by authored driver sources, transport parameters and resource limits. Generated drivers are ordinary validated model sources included in those digests. No theorem of type preservation, kernel compatibility or trace equivalence is claimed without a separately checked proof artifact.

## Requirement and presentation extension

The rules in [chapter 4](04-systems-and-conformance.md) preserve requirements as named obligations with immutable attributes and at most one owned formal doc. Satisfaction references a design identity and requirement identity; verification references a verificationCase identity and requirement identity. Use cases cannot own verification links. Ordinary comments retain source extents and owner identities separately from formal documentation. Cases and links express intent, with no automatic proof status. View include/filter clauses resolve to a stable union of occurrence paths and have no execution steps or store effects. These constructs remain part of the proposed mapping contract; no kernel exporter is implemented.
