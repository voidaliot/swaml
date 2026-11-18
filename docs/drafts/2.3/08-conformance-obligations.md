# 8. Conformance obligations: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 8](../../spec/08-conformance-obligations.md). These rows restate rules owned by chapters 1–7 for conformance reports. They carry a package tag, not a rule identifier.

## 8.1 Static obligations

| ID | Required validation | Diagnostic group | Package |
| --- | --- | --- | --- |
| V16 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP1. | | [WP1] |
| V17 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP2. | | [WP2] |
| V18 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP3. | | [WP3] |
| V19 | Moved to [chapter 8.1](../../spec/08-conformance-obligations.md#81-static-obligations) in WP4. | | [WP4] |
| V20 | Completion, timer guards, internal transitions, deferral, completion-guard and deferral-overflow warnings | SW2005/2008/2017/2018 | [WP5] |
| V21 | Sampled-read ports and positions, mandatory initial values, zero-or-one owners of sampled members, member policies | SW2004/2005/2006/2013 | [WP6] |
| V22 | Release guards on allowed entries with read-only effects and their scope | SW2007 | [WP7] |
| V23 | Operation placement, same Core, T1–T6 | SW2009 | [WP8] |

Existing rows change their text accordingly: V03 (selectors, done in WP1), V09 (conditional effects, done in WP2), V10 (computed periods, done in WP4, and release guards), V11 (completion and deferral), V12 (policy literals, done in WP4, and per-member policies), V13 (operation placement), V14 (association lists, done in WP2).

## 8.2 Runtime obligations

| ID | Required observable evidence | Package |
| --- | --- | --- |
| E12 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP1. | [WP1] |
| E13 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP2. | [WP2] |
| E14 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP3. | [WP3] |
| E15 | Moved to [chapter 8.2](../../spec/08-conformance-obligations.md#82-runtime-obligations) in WP4. | [WP4] |
| E16 | Completion, elapsed-timer and input order; no completion after discards; `discardTimer`; internal reactions keep timers; `CompletionLoop`; retention and offer-ordinal order; `defer` | [WP5] |
| E17 | Sample cells updated at delivery (after latency and faults, before same-instant guards), independent of consumption, read live, with `sample` observations; per-member policies | [WP6] |
| E18 | Release guards at dispatch, deadline cancellation, skip as completion for successors, `releaseGuard` discard, guard failure, unchanged grid | [WP7] |
| E19 | Priority and in-task ordering keys; unchanged order without Tasks | [WP8] |
| E20 | Moved to [chapter 8](../../spec/08-conformance-obligations.md) by WP1a. | [WP1a], rerun by every package and WP9 |

## 8.3 Analysis, kernel and graphical claims

Add after the schedulability sentence: "A validated `Swaml::Os` task mapping and a resolved target binding (`swaml binding check`) are static evidence of a declared mapping. They are not schedulability evidence." [WP8]
