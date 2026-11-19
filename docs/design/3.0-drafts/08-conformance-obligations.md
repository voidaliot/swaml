# 8. Conformance obligations: 2.3 changes (draft)

> **Historical record of swa.ml 3.0.** This file is one of the work-package checklists of the 3.0 edition, drafted under the name 2.3. Every rule has moved into the [specification chapters](../../LANGUAGE_SPECIFICATION.md), which are the only normative text; where a row here differs from them, the chapter wins. The 2.2 state machines and the WP5 state reactions some rows mention are not part of 3.0: states are steps of the flow ([chapter 3.6](../../spec/03-behavior.md#36-states), [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption)).

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 8](../../spec/08-conformance-obligations.md). These rows restate rules owned by chapters 1–7 for conformance reports. They carry a package tag, not a rule identifier.

## 8.1 Static obligations

| ID | Required validation | Diagnostic group | Package |
| --- | --- | --- | --- |
| V16 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP1. | | [WP1] |
| V17 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP2. | | [WP2] |
| V18 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP3. | | [WP3] |
| V19 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP4. | | [WP4] |
| V20 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP5. | | [WP5] |
| V21 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP6. | | [WP6] |
| V22 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP7. | | [WP7] |
| V23 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP8. | | [WP8] |

Existing rows change their text accordingly: V03 (selectors, done in WP1), V09 (conditional effects, done in WP2), V10 (computed periods, done in WP4, and release guards, done in WP7), V11 (completion and deferral), V12 (policy literals, done in WP4, and per-member policies), V13 (operation placement), V14 (association lists, done in WP2).

## 8.2 Runtime obligations

| ID | Required observable evidence | Package |
| --- | --- | --- |
| E12 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP1. | [WP1] |
| E13 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP2. | [WP2] |
| E14 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP3. | [WP3] |
| E15 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP4. | [WP4] |
| E16 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP5. | [WP5] |
| E17 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP6. | [WP6] |
| E18 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP7. | [WP7] |
| E19 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP8. | [WP8] |
| E20 | Moved to [chapter 8](../../spec/08-conformance-obligations.md) by WP1a. | [WP1a], rerun by every package and WP9 |

## 8.3 Analysis, kernel and graphical claims

Applied in WP8 after the schedulability sentence of [chapter 8.3](../../spec/08-conformance-obligations.md#83-analysis-kernel-and-graphical-claims): "A validated `Swaml::Os` task mapping and a resolved target binding (`swaml binding check`) are static evidence of a declared mapping. They are not schedulability evidence." [WP8]
