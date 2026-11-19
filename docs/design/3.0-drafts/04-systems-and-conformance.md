# 4. Deployment, cases, views and conformance: 2.3 changes (draft)

> **Historical record of swa.ml 3.0.** This file is one of the work-package checklists of the 3.0 edition, drafted under the name 2.3. Every rule has moved into the [specification chapters](../../LANGUAGE_SPECIFICATION.md), which are the only normative text; where a row here differs from them, the chapter wins. The 2.2 state machines and the WP5 state reactions some rows mention are not part of 3.0: states are steps of the flow ([chapter 3.6](../../spec/03-behavior.md#36-states), [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption)).

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 4](../../spec/04-systems-and-conformance.md). Examples are `text` fences until their work package lands. Decisions: [ADR 0024](../../decisions/0024-communication-and-package-links.md) for association lists and [ADR 0025](../../decisions/0025-real-time-placement-and-binding.md) for deployment.

## 4.1 Deployment

Applied in WP8: the sentence "Buses, hardware timing, core/task allocation and operating-system scheduling are target-translation concerns." became "Buses, hardware timing and operating-system scheduling are target-translation concerns. Core and task allocation may be declared with `Swaml::Os` (below); its costs belong to a target binding."

```text
import Swaml::Os;
component def SafetyCore specializes Core {
  component isrAdc: Task {
    redefines const attribute kind: TaskKind = TaskKind.isr;
    redefines const attribute responseNs: uint = 500us;
    redefines const attribute priority: uint = 60;
  }
  component task20ms: Task {
    redefines const attribute periodNs: uint = 20ms;
    redefines const attribute priority: uint = 30;
  }
}
deployment 'Front left door' of dcu on vehicle {
  deploy comMain on doorModules[0].core1.task20ms;
  deploy comMain.storePdu on doorModules[0].core1.isrCan;
  deploy comMain.onMode on doorModules[0].core1.taskEventLow;
}
```

| ID | Rule |
| --- | --- |
| WP8-S01 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-S02 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-S03 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-S04 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-S05 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-S06 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-S07 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-S08 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-S09 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-S10 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-M01 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-M02 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |
| WP8-M03 | Moved to [chapter 4.1](../../spec/04-systems-and-conformance.md#41-deployment) in WP8. |

The tables of `Swaml::Os` (WP8-L01) are in chapter 1.5. The run-order rule is in chapter 6.1 (WP8-R01). WP8 moved all its rules and added WP8-D11, and in its review WP8-D12 and WP8-D13, in [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups).

## 4.2 Requirements, cases and package links

| ID | Rule |
| --- | --- |
| WP2-S06 | Moved to [chapter 4.2](../../spec/04-systems-and-conformance.md#42-requirements-cases-and-package-links) in WP2. |

## 4.3 Views

| ID | Rule |
| --- | --- |
| WP4-M03 | Moved to [chapter 4.3](../../spec/04-systems-and-conformance.md#43-views) in WP4. |
| WP5-M01 | Moved to [chapter 4.3](../../spec/04-systems-and-conformance.md#43-views) in WP5. |
| WP7-M01 | Moved to [chapter 4.3](../../spec/04-systems-and-conformance.md#43-views) in WP7. |
| WP8-M04 | Moved to [chapter 4.3](../../spec/04-systems-and-conformance.md#43-views) in WP8. |
| WP6-M01 | Moved to [chapter 4.3](../../spec/04-systems-and-conformance.md#43-views) in WP6. |

## 4.4 Validation groups

The table keeps every existing code and adds three warnings:

| Code | Static group |
| --- | --- |
| SW2016 | Computed duration without a time unit (warning) |
| SW2017 | Completion guard that cannot change while the machine waits (warning) |
| SW2018 | Deferred member whose effective policy rejects on overflow (warning) |

Diagnostics added or extended by 2.3. Message shapes are templates in the existing style: a sentence with the offending names, ending with a period. Implementations may add context but keep the leading clause stable. All are errors unless marked as warnings.

| ID | Code | Condition | Message shape |
| --- | --- | --- | --- |
| WP1-D01 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D02 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D03 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D04 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D05 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D06 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP1-D07 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP1. | |
| WP2-D01 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP2. | |
| WP2-D02 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP2. | |
| WP2-D03 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP2. | |
| WP2-D04 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP2. | |
| WP2-D05 | — | Added and moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP2 (review of the conditional's parser limits). | |
| WP3-D01 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP3. | |
| WP4-D01 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP4. | |
| WP4-D02 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP4. | |
| WP4-D03 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP4. | |
| WP4-D04 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP4. | |
| WP4-D05 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP4. | |
| WP4-D06 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP4. | |
| WP4-D07 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP4. | |
| WP4-D08 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP4 (added in its review). | |
| WP5-D01 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP5. | |
| WP5-D02 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP5. | |
| WP5-D03 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP5. | |
| WP5-D04 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP5. | |
| WP5-D05 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP5. | |
| WP5-D06 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP5. | |
| WP5-D07 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP5. | |
| WP5-D08 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP5. | |
| WP5-D09 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP5. | |
| WP6-D01 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP6. | |
| WP6-D02 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP6. | |
| WP6-D03 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP6. | |
| WP6-D04 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP6. | |
| WP6-D05 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP6. | |
| WP6-D06 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP6. | |
| WP6-D07 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP6. | |
| WP6-D08 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP6. | |
| WP7-D01 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP7. | |
| WP7-D02 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP7. | |
| WP8-D01 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP8. | |
| WP8-D02 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP8. | |
| WP8-D03 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP8. | |
| WP8-D04 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP8. | |
| WP8-D05 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP8. | |
| WP8-D06 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP8. | |
| WP8-D07 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP8. | |
| WP8-D08 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP8. | |
| WP8-D09 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP8. | |
| WP8-D10 | — | Moved to [chapter 4.4](../../spec/04-systems-and-conformance.md#44-validation-groups) in WP8. | |

## 4.5 Evidence boundaries

| ID | Rule |
| --- | --- |
| WP8-M05 | Moved to [chapter 4.5](../../spec/04-systems-and-conformance.md#45-evidence-boundaries) in WP8. |
