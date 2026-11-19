# 9. Formal semantics: 2.3 changes (draft)

> **Historical record of swa.ml 3.0.** This file is one of the work-package checklists of the 3.0 edition, drafted under the name 2.3. Every rule has moved into the [specification chapters](../../LANGUAGE_SPECIFICATION.md), which are the only normative text; where a row here differs from them, the chapter wins. The 2.2 state machines and the WP5 state reactions some rows mention are not part of 3.0: states are steps of the flow ([chapter 3.6](../../spec/03-behavior.md#36-states), [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption)).

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 9](../../spec/09-formal-semantics.md). These schemas restate rules owned by chapters 1–7. They carry a package tag, not a rule identifier.

## 9.1 Domains

The configuration gains sample cells S, per port occurrence and member [WP6, applied to [chapter 9.1](../../spec/09-formal-semantics.md#91-domains)], and the retained-input marks of each machine's queued messages [WP5, applied to [chapter 9.1](../../spec/09-formal-semantics.md#91-domains)]:

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
| `p.m` sampled | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP6. | [WP6] |
| release guard | Moved to [chapter 9.2](../../spec/09-formal-semantics.md#92-typing-schemas) in WP7. | [WP7] |

## 9.3 Transition schemas

| Rule | Configuration change and observation | Package |
| --- | --- | --- |
| place write | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP1. | [WP1] |
| completion | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP5. | [WP5] |
| guarded timer | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP5. | [WP5] |
| internal reaction | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP5. | [WP5] |
| retain | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP5. | [WP5] |
| sample | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP6. | [WP6] |
| guarded dispatch | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP7. | [WP7] |
| ordered selection | Moved to [chapter 9.3](../../spec/09-formal-semantics.md#93-transition-schemas) in WP8. | [WP8] |

The state paragraph "Select an already elapsed timer after entry completes before queued input" became "After entry completes, evaluate completion transitions, then select an already elapsed timer, then queued input" [WP5, applied].
