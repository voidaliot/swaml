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
| WP4-S01 | **Duration literals as values.** A duration literal in an expression is a `uint` value in nanoseconds (`1us` = 1000). Its value is representable or the literal is a static error. Computed durations (chapter 3) are integral expressions; `real` is rejected. |

```text
counter = clampInt((if (previous < 0) 0 else previous) + stepUp, passedThreshold, failedThreshold);
var lastRxNs: uint = 0;   // compared with now() - lastRxNs >= rxTimeoutMs * 1ms
```

## 1.5 Reuse and library boundaries

The library sentence becomes: "The versioned source libraries are Swaml::Math, Swaml::Numeric, Swaml::Text, Swaml::Time, Swaml::Calls, Swaml::Qos, Swaml::Views, Swaml::Platform and Swaml::Os."

| ID | Rule |
| --- | --- |
| WP3-L01 | `Swaml::Numeric` declares `operation def minInt(a: int, b: int) returns int`, `maxInt(a: int, b: int) returns int`, `clampInt(v: int, low: int, high: int) returns int` and `clamp(v: real, low: real, high: real) returns real` with swa.ml source bodies (as in [proposal B4](../../proposals/NEXT_MINOR_PROPOSAL.md#b4-numbers-and-text)), and `sqrt(v: real) returns real` as a host intrinsic. |
| WP3-L02 | `Swaml::Text` declares `intText(v: int) returns string` and `realText(v: real, decimals: uint) returns string` as host intrinsics and `boolText(v: bool) returns string` with a source body. |
| WP3-L03 | `Swaml::Time` declares `now() returns uint` as a host intrinsic. |
| WP3-L04 | No operation is added to `Swaml::Math` or `Swaml::Platform`. A workspace that imports one of the new packages and declares a same-named operation follows the existing ambiguity rule (SW2001); the WP3 tests show that no corpus model becomes ambiguous. |
| WP3-M01 | The new packages are part of the versioned library source (`libraries/`), loaded like the existing libraries and imported explicitly. Intrinsic bodies are documentation-only, as for the `Swaml::Math` intrinsics. |
| WP3-R01 | `sqrt` is IEEE-754 correctly rounded. An argument below zero is the runtime failure `Arithmetic`. |
| WP3-R02 | `intText` writes decimal digits, with `-` for negatives and no leading zeros. `realText` rounds the exact binary value of `v` to exactly `decimals` fraction digits, ties away from zero, and writes plain decimal notation with no exponent: `realText(2.5, 0)` is `3` and `realText(-2.5, 0)` is `-3`. A result that rounds to zero has no sign: `realText(-0.0001, 2)` is `0.00`. `decimals` above 15, or `abs(v)` of at least 1e21, is the runtime failure `Bounds`. This is not the tie rule of `Swaml::Math::round`, which rounds ties toward positive infinity. An implementation must not rely on JavaScript `toFixed` alone, which writes `-0.00` and switches to exponent notation from 1e21. |
| WP3-R03 | `now()` returns the logical time of the evaluating step, in nanoseconds since the run epoch. A concurrent activation reads live time, not its dispatch snapshot. |
| WP8-L01 | `Swaml::Os` declares `enum TaskKind { basic, extended, isr }`, `component def Core specializes Node { }` and `component def Task specializes Process` with the const attributes `kind: TaskKind = TaskKind.basic`, `priority: uint = 0`, `preemptive: bool = true`, `periodNs: uint = 0` and `responseNs: uint = 0`, documented as in ADR 0025. It imports `Swaml::Platform`. |

Tier 2, not part of 2.3: trigonometry as swa.ml source in `Swaml::Numeric` and enum conversions with the library-only `enum` parameter type (ADR 0022).
