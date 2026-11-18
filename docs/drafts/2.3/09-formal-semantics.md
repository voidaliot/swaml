# 9. Formal semantics: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 9](../../spec/09-formal-semantics.md). These schemas restate rules owned by chapters 1–7. They carry a package tag, not a rule identifier.

## 9.1 Domains

The configuration gains sample cells S, per port occurrence and member [WP6], and the retained-input marks of each machine's queued messages [WP5, applied to [chapter 9.1](../../spec/09-formal-semantics.md#91-domains)]:

```text
C = (D, O, σ, S, Q, A, M, R, L, B, t)
```

## 9.2 Typing schemas

| Construct | Premises and result | Package |
| --- | --- | --- |
| `x[i].f…` / `x[i][j]…` | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP1. | [WP1] |
| `place = e` | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP1. | [WP1] |
| `if (c) a else b` | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP2. | [WP2] |
| `now()` | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP3. The constant-expression clause applied with WP4; the completion-guard clause applied with WP5. | [WP3] |
| duration literal | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP4. | [WP4] |
| computed duration `(e)` | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP4. | [WP4] |
| completion guard | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP5. | [WP5] |
| timer guard | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP5. | [WP5] |
| `p.m` sampled | p an owned, non-forwarded port; m a required attribute with an initial value; result the member type; effect reads state | [WP6] |
| release guard | bool; pure or reads state; scope: attributes, sampled ports, `now()`, receive bindings | [WP7] |

## 9.3 Transition schemas

| Rule | Configuration change and observation | Package |
| --- | --- | --- |
| place write | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP1. | [WP1] |
| completion | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP5. | [WP5] |
| guarded timer | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP5. | [WP5] |
| internal reaction | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP5. | [WP5] |
| retain | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP5. | [WP5] |
| sample | At the delivery event of a value, S[p, m] := value, with a `sample` observation; a read sees the updates ordered before it in the event order (time, phase, insertion ordinal) | [WP6] |
| guarded dispatch | At the first execution step. Guard false: cancel the deadline, record `skip`, release `after` targets as on completion, release L[o]. Guard failure: `failure`, no successors | [WP7] |
| ordered selection | Equal (t, phase) items ordered by descending priority, then in-task position, then insertion ordinal | [WP8] |

The state paragraph "Select an already elapsed timer after entry completes before queued input" became "After entry completes, evaluate completion transitions, then select an already elapsed timer, then queued input" [WP5, applied].
