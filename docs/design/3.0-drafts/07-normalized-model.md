# 7. Normalized model contract: 2.3 changes (draft)

> **Historical record of swa.ml 3.0.** This file is one of the work-package checklists of the 3.0 edition, drafted under the name 2.3. Every rule has moved into the [specification chapters](../../LANGUAGE_SPECIFICATION.md), which are the only normative text; where a row here differs from them, the chapter wins. The 2.2 state machines and the WP5 state reactions some rows mention are not part of 3.0: states are steps of the flow ([chapter 3.6](../../spec/03-behavior.md#36-states), [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption)).

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 7](../../spec/07-normalized-model.md).

## 7.1 Identity and provenance

| ID | Rule |
| --- | --- |
| WP2-M04 | Moved to [chapter 7.1](../../spec/07-normalized-model.md#71-identity-and-provenance) in WP2. |
| WP4-M04 | Moved to [chapter 7.1](../../spec/07-normalized-model.md#71-identity-and-provenance) in WP4. |
| WP8-M06 | Moved to [chapter 7.1](../../spec/07-normalized-model.md#71-identity-and-provenance) in WP8. |

## 7.2 Families

The family table gains the following content:

| Family | Additional required content | Package |
| --- | --- | --- |
| Statement/expression | Places with root, ordered selectors and index expressions; conditional with condition and both branches | WP1, WP2 (applied) |
| Schedule/entry | Applied to [chapter 7.2](../../spec/07-normalized-model.md#72-families) in WP4 (period and deadline as expression text plus per-occurrence values) and WP7 (release guard). | WP4, WP7 |
| State/transition | Applied to [chapter 7.2](../../spec/07-normalized-model.md#72-families) in WP4 (computed delay) and WP5 (transition kind, optional target, timer guard, state deferrals in order). | WP4, WP5 |
| Port/member | Applied to [chapter 7.2](../../spec/07-normalized-model.md#72-families) in WP6 (initial values, sampled members). | WP6 |
| Connection/forwarding | Applied to [chapter 7.2](../../spec/07-normalized-model.md#72-families) in WP6 (member policies with their effective policy per member route). | WP6 |
| Deployment | Applied to [chapter 7.2](../../spec/07-normalized-model.md#72-families) in WP8. | WP8 |
| Requirement/case/view | Moved to [chapter 7.2](../../spec/07-normalized-model.md#72-families) in WP2. | WP2 |

## 7.3 Routes and queues

| ID | Rule |
| --- | --- |
| WP6-M04 | Moved to [chapter 7.3](../../spec/07-normalized-model.md#73-routes-and-queues) in WP6. |

## 7.4 Executable lowering

| ID | Rule |
| --- | --- |
| WP5-M03 | Moved to [chapter 7.4](../../spec/07-normalized-model.md#74-executable-lowering) in WP5. |
| WP7-M02 | Moved to [chapter 7.4](../../spec/07-normalized-model.md#74-executable-lowering) in WP7. |

## 7.5 Presentation and equivalence

Equivalence additionally preserves place evaluation order, conditional branch selection, per-occurrence period and deadline values, completion and timer selection order, deferral retention order, sample cell updates, per-member policies, release-guard skips and the priority and in-task ordering keys.
