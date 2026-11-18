# 9. Formal semantics

Normative schemas of [swa.ml 2.2](../LANGUAGE_SPECIFICATION.md). These constrain implementations without claiming a mechanically proved metatheory.

## 9.1 Domains

Let D be the resolved declaration/effective-member graph, O the finite indexed occurrence tree, Γ a typed lexical environment, σ occurrence stores, ρ activation locals, Q per-connection/direction/member buffers, A activations, M state/timer generations, R correlations, L serial locks, B pending releases and t integer nanoseconds.

```text
C = (D, O, σ, Q, A, M, R, L, B, t)
D ⊢ O valid
D; Γ ⊢ e : T ! ε
D; Γ ⊢ s ⇒ Γ'
C —observation→ C'
```

The queued messages in Q carry a retained mark (WP5): a message that a deferring state retained, recorded once by `defer` and consumed in offer-ordinal order when a state handles it (chapter 6.5).

Values are bounded primitive scalars, nominal enums/records and fixed copied arrays; void has no inhabitant. Effect ε retains read/write/communication/suspension flags, with pure as empty. Transitive union over an acyclic call graph computes effects. The maximum class is a presentation of these flags rather than permission to erase a write beneath suspension.

## 9.2 Typing schemas

| Construct | Premises and result |
| --- | --- |
| x / x.field / x[i] | x in Γ; nominal record field or integral array index; result declared type; dynamic index must be in extent |
| x[i].f… / x[i][j]… | x in Γ; each selector is a record field or an integral array index; the result is the selected type; literal indexes are in extent; a copy |
| Enum.literal | No live first-segment value shadows the enum; unambiguous accessible nominal enum and literal |
| operation(args) | Resolved same-owner/nested or imported pure definition; copied typed in arguments; mutable compatible out targets; result declared type; effect is union of arguments and callee |
| p.member(args) | p is owned, member requires operation; arguments satisfy signature; effect communicates and suspends |
| case subject call | Exact primary software subject; copied typed arguments/results, actual serial operation context and normal effects; suspension releases/reacquires its lock, caller context restores on return/failure; local activation semantics, no implicit route or schedule release |
| test occurrence access | Resolved own-package executed software root is the subject or an explicit association, followed by single effective parts or part family members with literal indexes in range; reads use its live store under its lock, helper calls outside the exact primary subject neither communicate nor suspend; no ownership transfer or direct attribute assignment |
| try(e, f) | e:T and f:U assignable to T; lazy f; effect union; no fallback only when T is void |
| if (c) a else b | c : bool; a : T1, b : T2 with common type T under scalar widening, otherwise identical types; neither void; effect ε(c) ∪ ε(a) ∪ ε(b) without suspension; only the selected branch evaluates; a whole expression, never a statement |
| now() | result uint, the logical time t of the evaluating step; effect reads state; not in initializers or constant expressions (SW2007, WP4-S05) and not in completion guards (SW2008, WP5-S03); never a stale read |
| duration literal | Result uint (nanoseconds), a safe integer; positive in the 2.2 positions |
| computed duration `(e)` | e integral; in wait and receive timeouts without suspending calls; in state timers pure or reads state; in periods and deadlines in the constant sublanguage, with exact integral `/`, valued per occurrence |
| completion guard | bool; pure or reads state; no `now()`, directly or through a callee |
| timer guard | bool; pure or reads state |
| var x:T=e | Compatible value, fresh live name; Γ extends with mutable x; suspension allowed only when e is whole call/try |
| x=e | Mutable local/out/attribute, compatible type; attribute write adds write effect; same whole-expression suspension rule |
| place = e | The root is a mutable local, an assigned out or a non-const attribute; e is assignable to the place type; the effect adds a write of the root; the whole-expression suspension rule applies |
| return e | e assignable to owning operation result; expression does not suspend; success copy-back |
| if/while/until/assert | bool condition; optional loop limit uint-compatible and evaluated once |
| for | Fresh initializer scope; bool condition; mutable typed update; fresh body scope each iteration |
| for in | Collection T[n], explicit compatible element type; copied collection; fresh element/body scope |
| wait/receive | Suspended continuation; owned input with explicit payload binding for receive; no implicit failure/payload name |
| interruptible | Non-stateful operation, exclusive required input; protected and handler scopes share only outer locals |
| state guard | bool, effects pure or reads state; transitions selected in authored order |
| concurrent entry | Callee transitive effect has no write and body is not stateful |
| attribute initializer | Explicit destination type; empty state environment; pure effect |

Scalar type assignability uses widening, with checked integral value conversion in assignments/parameter initialization. Port compatibility is structural by member name with contravariant operation inputs and covariant output/result payloads. Nominal records/enums do not become structurally equivalent. Array values preserve invariant element type/extent; literals are checked elementwise.

## 9.3 Transition schemas

| Rule | Configuration change and observation |
| --- | --- |
| initialize | Expand O, create separate σ[o], initialize all before startup release |
| release | Add fresh activation to B with release time/cause/deadline; bounded admission or explicit violation |
| dispatch | Acquire L[o] for serial work; copy entry arguments under lock; concurrent work captures σ[o] snapshot |
| local step | Evaluate in ρ plus live serial σ or captured concurrent snapshot; update copied cells and emit source-provenanced observations |
| place write | Evaluate indexes, then the right side; read σ[o] or ρ at the root; check the indexes; write the root with one place replaced; `write` with `place` |
| suspend | Save continuation/ρ; remove serial lock; register wait timer, receive alternatives or pending request |
| computed duration | Evaluate e when the statement starts waiting, or for a state timer when the entry actions finish; v ≤ 0 or v unsafe is `DurationRange`; wait/timeout register expiry t + v with `durationNs`; a state timer registers expiry t_update + v with a `timer` observation |
| ready | Mark continuation ready; serial continuation must reacquire lock before reading current σ |
| offer | Resolve alias chain, select connection/member queue, copy payload, apply latest attribute replacement or policy overflow/delivery |
| request | Create unique pending R[r] with expiry t + requestTimeout; offer request; suspend caller |
| reply | Before expiry and while pending, set immutable succeeded/failed terminal, copy success result/out, ready caller |
| timeout | At expiry, pending becomes failed; ready failure continuation; tie beats reply |
| try success/failure | Return e value on success; on RuntimeFault evaluate fallback lazily with existing σ/Q effects retained |
| interrupt | Match active region; disarm/unwind protected continuation, cancel pending correlation as interrupted, retain activation/deadline/outer ρ and committed effects |
| state reaction | Select first enabled transition, exit/effect/update/entry, invalidate old timer generation; idle releases lock |
| completion | After entry or an internal reaction: the first enabled completion transition in order, then exit, effect, update, entry; a revisited state in a completion chain is a `CompletionLoop` violation |
| guarded timer | At expiry, a false guard consumes the timer generation for this entry (`discardTimer`) |
| internal reaction | Effect only; M (timer generations) unchanged |
| retain | A deferred member's message stays in Q, marked retained (`defer` once); it is consumed in offer-ordinal order on entering a handling state |
| complete | Finish activation and unlock; correlated reply is offered separately; successful whole completion releases after targets fresh |
| violation | Deadline, activation overflow, step/concurrent resource or clock failure stops the reference run and bypasses try |
| case script | A fresh package configuration adds one serial script activation after startup releases; direct primary-subject calls borrow its actual serial context, script emissions/requests/receives use actor ports, on call replies to the pending correlation, and script completion or failure stops the run |

At terminal correlation, later replies cannot change R. Inactive interrupt input is discarded observably. Receive statements preserve queued early input. A state's unhandled input leaves its entry time/timer generation intact. Set entry time at the state update, before entry actions. After entry completes, evaluate completion transitions, then select an already elapsed timer, then queued input (retained input first, in offer order); earliest expiry then declaration order determines competing timers. Deadline/timeout measurements include suspension and backlog; zero-cost interpreter steps do not supply physical cost evidence.

## 9.4 Projection and adequacy

A conforming reference trace records enough identity and order to reconstruct observable writes, messages, state changes, waits and terminals under its chosen assumptions, including the statement identity that caused each one. The initial configuration of a package target expands every top-level software occurrence and adds the package connection queues; a component target expands one top-level occurrence and adds none. A view is a pure identity selection function over D/O; Timing additionally projects a separately identified trace. No view transition changes C. A bounded run ending at a horizon retains live/open intervals. Source hashing belongs to hosts. Kernel/target refinement must preserve these observations or explicitly report unsupported semantics; syntax acceptance alone is insufficient.
