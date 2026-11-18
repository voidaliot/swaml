# 7. Normalized model contract: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 7](../../spec/07-normalized-model.md).

## 7.1 Identity and provenance

| ID | Rule |
| --- | --- |
| WP2-M04 | Moved to [chapter 7.1](../../spec/07-normalized-model.md#71-identity-and-provenance) in WP2. |
| WP4-M04 | Moved to [chapter 7.1](../../spec/07-normalized-model.md#71-identity-and-provenance) in WP4. |
| WP8-M06 | **Placement identity.** An operation placement is identified by its deployment and exact path, like an occurrence placement. |

## 7.2 Families

The family table gains the following content:

| Family | Additional required content | Package |
| --- | --- | --- |
| Statement/expression | Places with root, ordered selectors and index expressions; conditional with condition and both branches | WP1, WP2 (applied) |
| Schedule/entry | Period and deadline as expression text plus per-occurrence values; release guard | WP4, WP7 |
| State/transition | Applied to [chapter 7.2](../../spec/07-normalized-model.md#72-families) in WP4 (computed delay) and WP5 (transition kind, optional target, timer guard, state deferrals in order). | WP4, WP5 |
| Port/member | Initial value of attribute members; sampled members per port | WP6 |
| Connection/forwarding | Member policies with their effective policy per member route | WP6 |
| Deployment | Operation placements, effective placement per entry, Task, Core and in-task position | WP8 |
| Requirement/case/view | Moved to [chapter 7.2](../../spec/07-normalized-model.md#72-families) in WP2. | WP2 |

## 7.3 Routes and queues

| ID | Rule |
| --- | --- |
| WP6-M04 | A normalized connection records the effective policy of each member route, and the member-policy declaration where one applies. Every sampled member of a port occurrence records its sample cell with its initial value, and its zero or one consuming owner. |

## 7.4 Executable lowering

| ID | Rule |
| --- | --- |
| WP5-M03 | Moved to [chapter 7.4](../../spec/07-normalized-model.md#74-executable-lowering) in WP5. |
| WP7-M02 | A schedule entry with a release guard lowers to its release mechanism, then guard evaluation at dispatch, then either the activation or a skip that counts as completion for `after` edges. |

## 7.5 Presentation and equivalence

Equivalence additionally preserves place evaluation order, conditional branch selection, per-occurrence period and deadline values, completion and timer selection order, deferral retention order, sample cell updates, per-member policies, release-guard skips and the priority and in-task ordering keys.
