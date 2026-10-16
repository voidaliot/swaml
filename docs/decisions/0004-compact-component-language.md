# ADR 0004 — Compact component language

Status: accepted for SWAML 1.1. Date: 2026-10-14.

The ownership/authoring decisions in this historical record are superseded for the unpublished 1.2 candidate by [ADR 0007](0007-component-functions-and-calculations.md).

The owner requested a smaller authoring language, retaining `def` to make reusable types clear in the SysML style, removing redundant `system`/`machine` layers, and preserving the original architecture and simulation requirements. The selected release is 1.1.0. This is an intentional incompatible syntax migration, despite using a minor version; no backward-compatible parser claim is made.

## Decision

A component usage can be the selected execution root. `component Demo { … }` supplies inline composition; `component Demo: Assembly;` instantiates a reusable component definition. Roots may contain units directly. Omitted profile means service. A typed root may add nodes/deployment in a binding body, but cannot extend topology. Definition identity, root occurrence identity and child occurrence paths remain distinct.

Operations own states directly. A state body starts with `initial`, followed by states and transitions, so parsing can distinguish it from a statement block. `StateBody` is syntax grouping and normalization contributes to the owning operation. No independent machine, action or performer allocation is introduced.

The language header is removed. The CLI/parser is pinned to 1.1; external hosts must pin an explicit supported edition before loading source. A file does not silently choose the latest parser, and no unimplemented configuration format is presented as language syntax.

No-result operation/signature annotations may be omitted. Assignment, local pure function calls, arrays and enum values use familiar punctuation without `set`, `compute`, `array` or `enumValue`. Enum resolution is lexical-first; qualification selects the nominal package enum explicitly. Functions retain explicit non-Void results, and reusable component/unit declarations retain `def`.

## Consequences

The reserved vocabulary decreases from 129 to 122 words. This count includes primitive types, time units, role names, view kinds and policy values; it is not the number of independent modeling concepts. Further removal needs evidence of a redundant meaning, not only a lower token count. Explicit QoS, timeouts, interface identity, port ownership and boundary routing continue to express necessary architectural choices.

The specification, grammar, validators, normalized mapping, simulator, examples, keyword index and graphical illustrations must describe the same 1.1 edition. Old release assets remain immutable. The [migration guide](../MIGRATION_1_1.md) documents changes to source and host API. The specification defines every supported construct and its simulation contract; graphical tooling and KerML export have their own implementation and conformance obligations.
