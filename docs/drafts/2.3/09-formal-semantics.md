# 9. Formal semantics: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 9](../../spec/09-formal-semantics.md). These schemas restate rules owned by chapters 1–7. They carry a package tag, not a rule identifier.

## 9.1 Domains

The configuration gains sample cells S, per port occurrence and member [WP6], and the retained-input marks of each machine's queued messages [WP5]:

```text
C = (D, O, σ, S, Q, A, M, R, L, B, t)
```

## 9.2 Typing schemas

| Construct | Premises and result | Package |
| --- | --- | --- |
| `x[i].f…` / `x[i][j]…` | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP1. | [WP1] |
| `place = e` | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP1. | [WP1] |
| `if (c) a else b` | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP2. | [WP2] |
| `now()` | Result uint; effect reads state; not in initializers, completion guards or constant expressions | [WP3] |
| duration literal | Result uint (nanoseconds), representable | [WP4] |
| computed duration `(e)` | e integral; dynamic positions non-suspending (wait, timeout) or read-only (state timer); static positions in the constant sublanguage | [WP4] |
| completion guard | bool; pure or reads state; no `now()` | [WP5] |
| timer guard | bool; pure or reads state | [WP5] |
| `p.m` sampled | p an owned, non-forwarded port; m a required attribute with an initial value; result the member type; effect reads state | [WP6] |
| release guard | bool; pure or reads state; scope: attributes, sampled ports, `now()`, receive bindings | [WP7] |

## 9.3 Transition schemas

| Rule | Configuration change and observation | Package |
| --- | --- | --- |
| place write | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP1. | [WP1] |
| completion | After entry or an internal reaction: the first enabled completion transition in order, then exit, effect, update, entry; a revisited state in a completion chain is a `CompletionLoop` violation | [WP5] |
| guarded timer | At expiry, a false guard consumes the timer generation for this entry (`discardTimer`) | [WP5] |
| internal reaction | Effect only; M (timer generations) unchanged | [WP5] |
| retain | A deferred member's message stays in Q, marked retained (`defer` once); it is consumed in offer-ordinal order on entering a handling state | [WP5] |
| sample | At the delivery event of a value, S[p, m] := value, with a `sample` observation; a read sees the updates ordered before it in the event order (time, phase, insertion ordinal) | [WP6] |
| guarded dispatch | At the first execution step. Guard false: cancel the deadline, record `skip`, release `after` targets as on completion, release L[o]. Guard failure: `failure`, no successors | [WP7] |
| ordered selection | Equal (t, phase) items ordered by descending priority, then in-task position, then insertion ordinal | [WP8] |

The state paragraph "Select an already elapsed timer after entry completes before queued input" becomes "After entry completes, evaluate completion transitions, then select an already elapsed timer, then queued input" [WP5].
