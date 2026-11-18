# 1. Structure, names and types: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 1](../../spec/01-structure-and-types.md). Examples are `text` fences until their work package lands.

## 1.1 Names and documentation

| ID | Rule |
| --- | --- |
| WP2-S01 | Moved to [chapter 1.1](../../spec/01-structure-and-types.md#11-names-and-documentation) in WP2. `defer` joins the list of contextual words with WP5-S01 and WP5-G03, which introduce the keyword. |
| WP5-S01 | `defer` is a contextual word from its introduction (ADR 0023). |
| WP2-M01 | Moved to [chapter 1.1](../../spec/01-structure-and-types.md#11-names-and-documentation) in WP2. |

## 1.2 Components and occurrences

No rule changes. The sentence "Connector loops and port arrays do not exist" stays: port arrays are rejected for 2.3 and are an additive 2.4 candidate (ADR 0024). Literal-index paths into multiplicity families are unchanged; their new use in test inspection paths is chapter 3.7 (WP1-S06).

## 1.3 State and lexical values

| ID | Rule |
| --- | --- |
| WP1-S01 | The places sentence moved to [chapter 1.3](../../spec/01-structure-and-types.md#13-state-and-lexical-values) in WP1. Still open, with WP6-S01: the sentence "Local data access never traverses child components or ports" gains "except a sampled read `p.m` of an owned port (chapter 2.6)". |

## 1.4 Value domains

WP1 replaced "In-place field/index assignment and reference values are absent." in chapter 1.4 with WP1-S02 and WP1-S03, and its examples are validated `swaml` fences there.

| ID | Rule |
| --- | --- |
| WP1-S02 | Moved to [chapter 1.4](../../spec/01-structure-and-types.md#14-value-domains) in WP1. |
| WP1-S03 | Moved to [chapter 1.4](../../spec/01-structure-and-types.md#14-value-domains) in WP1. |
| WP2-S02 | Moved to [chapter 1.4](../../spec/01-structure-and-types.md#14-value-domains) in WP2. |
| WP2-S03 | Moved to [chapter 1.4](../../spec/01-structure-and-types.md#14-value-domains) in WP2. |
| WP4-S01 | Moved to [chapter 1.4](../../spec/01-structure-and-types.md#14-value-domains) in WP4. |

```text
counter = clampInt((if (previous < 0) 0 else previous) + stepUp, passedThreshold, failedThreshold);
var lastRxNs: uint = 0;   // compared with now() - lastRxNs >= rxTimeoutMs * 1ms
```

## 1.5 Reuse and library boundaries

WP3 applied the library sentence for `Swaml::Numeric`, `Swaml::Text` and `Swaml::Time` in [chapter 1.5](../../spec/01-structure-and-types.md#15-reuse-and-library-boundaries). With WP8 it becomes: "The versioned source libraries are Swaml::Math, Swaml::Numeric, Swaml::Text, Swaml::Time, Swaml::Calls, Swaml::Qos, Swaml::Views, Swaml::Platform and Swaml::Os."

| ID | Rule |
| --- | --- |
| WP3-L01 | Moved to [chapter 1.5](../../spec/01-structure-and-types.md#15-reuse-and-library-boundaries) in WP3. |
| WP3-L02 | Moved to [chapter 1.5](../../spec/01-structure-and-types.md#15-reuse-and-library-boundaries) in WP3. |
| WP3-L03 | Moved to [chapter 1.5](../../spec/01-structure-and-types.md#15-reuse-and-library-boundaries) in WP3. |
| WP3-L04 | Moved to [chapter 1.5](../../spec/01-structure-and-types.md#15-reuse-and-library-boundaries) in WP3. |
| WP3-M01 | Moved to [chapter 1.5](../../spec/01-structure-and-types.md#15-reuse-and-library-boundaries) in WP3. |
| WP3-R01 | Moved to [chapter 1.5](../../spec/01-structure-and-types.md#15-reuse-and-library-boundaries) in WP3. |
| WP3-R02 | Moved to [chapter 1.5](../../spec/01-structure-and-types.md#15-reuse-and-library-boundaries) in WP3. |
| WP3-R03 | Moved to [chapter 1.5](../../spec/01-structure-and-types.md#15-reuse-and-library-boundaries) in WP3. |
| WP8-L01 | `Swaml::Os` declares `enum TaskKind { basic, extended, isr }`, `component def Core specializes Node { }` and `component def Task specializes Process` with the const attributes `kind: TaskKind = TaskKind.basic`, `priority: uint = 0`, `preemptive: bool = true`, `periodNs: uint = 0` and `responseNs: uint = 0`, documented as in ADR 0025. It imports `Swaml::Platform`. |

Tier 2, not part of 2.3: trigonometry as swa.ml source in `Swaml::Numeric` and enum conversions with the library-only `enum` parameter type (ADR 0022).
