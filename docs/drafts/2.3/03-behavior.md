# 3. Operations, schedules and states: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 3](../../spec/03-behavior.md). Examples are `text` fences until their work package lands. Decisions: [ADR 0022](../../decisions/0022-values-places-and-expressions.md), [ADR 0023](../../decisions/0023-state-reactions.md) and [ADR 0025](../../decisions/0025-real-time-placement-and-binding.md).

## 3.1 Operations and effects

| ID | Rule |
| --- | --- |
| WP1-S04 | Moved to [chapter 3.1](../../spec/03-behavior.md#31-operations-and-effects) in WP1. |
| WP2-S04 | Moved to [chapter 3.1](../../spec/03-behavior.md#31-operations-and-effects) in WP2. |
| WP3-S01 | Moved to [chapter 3.1](../../spec/03-behavior.md#31-operations-and-effects) in WP3. The constant-sublanguage clause applied with WP4-S05 (WP4); the completion-guard clause applied with WP5-S03 (WP5); both reject a call for which `isClockRead` (`semantic.ts`) is true. |
| WP3-S02 | Moved to [chapter 3.4](../../spec/03-behavior.md#34-suspension-and-locks) in WP3. |

## 3.2 Failure

| ID | Rule |
| --- | --- |
| WP4-R01 | Moved to [chapter 3.2](../../spec/03-behavior.md#32-failure) in WP4. |

## 3.3 Statements and scopes

| ID | Rule |
| --- | --- |
| WP1-S05 | Moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP1. |
| WP1-S07 | Moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP1. |
| WP1-R01 | Moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP1. |
| WP1-R02 | Moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP1. |
| WP2-S05 | Moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP2. |
| WP4-S03 | Moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP4. |

The computed-wait examples moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP4.

## 3.4 Suspension and locks

| ID | Rule |
| --- | --- |
| WP1-R03 | Moved to [chapter 3.4](../../spec/03-behavior.md#34-suspension-and-locks) in WP1. |
| WP6-R07 | Moved to [chapter 3.4](../../spec/03-behavior.md#34-suspension-and-locks) in WP6. |
| WP1-M01 | Moved to [chapter 3.4](../../spec/03-behavior.md#34-suspension-and-locks) in WP1. |

## 3.5 Schedule

| ID | Rule |
| --- | --- |
| WP4-S04 | Moved to [chapter 3.5](../../spec/03-behavior.md#35-schedule) in WP4. |
| WP4-S05 | Moved to [chapter 3.5](../../spec/03-behavior.md#35-schedule) in WP4. |
| WP4-S06 | Moved to [chapter 3.5](../../spec/03-behavior.md#35-schedule) in WP4. |
| WP4-S07 | Moved to [chapter 3.5](../../spec/03-behavior.md#35-schedule) in WP4. |
| WP4-M02 | Moved to [chapter 3.5](../../spec/03-behavior.md#35-schedule) in WP4. |
| WP7-S01 | Moved to [chapter 3.5](../../spec/03-behavior.md#35-schedule) in WP7. |
| WP7-S02 | Moved to [chapter 3.5](../../spec/03-behavior.md#35-schedule) in WP7. |
| WP7-S03 | Moved to [chapter 3.5](../../spec/03-behavior.md#35-schedule) in WP7. |

The release-guard fragments that stood here are complete validated sources now: the `swaml` fence in [chapter 3.5](../../spec/03-behavior.md#35-schedule) and the [LIN master](../../../examples/50-lin-master-mode-gating.swaml) and [ComMain](../../../examples/51-com-main-release-guard.swaml) examples.

The computed-period example moved to [chapter 3.5](../../spec/03-behavior.md#35-schedule) in WP4.

Applied in WP7: the release rows of the trigger table gain "unless its release guard is false (chapter 6.2)". The runtime rules of release guards moved to [chapter 6.2](../../spec/06-execution-contract.md#62-lock-and-snapshot) (WP7-R01 to WP7-R06).

## 3.6 States

Applied in WP5: the first paragraph's last sentence reads "There are no transition names or priorities.", followed by the 2.3 state members. The fragments that stood here are complete validated sources now: the `swaml` fence in [chapter 3.6](../../spec/03-behavior.md#36-states) and the [session completion](../../../examples/44-session-completion.swaml), [lock deferral](../../../examples/45-lock-deferral.swaml) and [breaker](../../../examples/46-breaker-internal.swaml) examples.

| ID | Rule |
| --- | --- |
| WP4-S08 | Moved to [chapter 3.6](../../spec/03-behavior.md#36-states) in WP4. |
| WP5-S02 | Moved to [chapter 3.6](../../spec/03-behavior.md#36-states) in WP5. |
| WP5-S03 | Moved to [chapter 3.6](../../spec/03-behavior.md#36-states) in WP5. |
| WP5-S04 | Moved to [chapter 3.6](../../spec/03-behavior.md#36-states) in WP5. |
| WP5-S05 | Moved to [chapter 3.6](../../spec/03-behavior.md#36-states) in WP5. |
| WP5-S06 | Moved to [chapter 3.6](../../spec/03-behavior.md#36-states) in WP5. |
| WP5-S07 | Moved to [chapter 3.6](../../spec/03-behavior.md#36-states) in WP5. |
| WP5-S08 | Moved to [chapter 3.6](../../spec/03-behavior.md#36-states) in WP5. |
| WP5-S09 | Moved to [chapter 3.6](../../spec/03-behavior.md#36-states) in WP5. |
| WP5-S10 | Moved to [chapter 3.6](../../spec/03-behavior.md#36-states) in WP5. |

The runtime rules for these forms moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) (WP5-R01 to WP5-R13) in WP5.

## 3.7 Case scripts

| ID | Rule |
| --- | --- |
| WP1-S06 | Moved to [chapter 3.7](../../spec/03-behavior.md#37-case-scripts) in WP1. |
| WP1-S08 | Moved to [chapter 3.7](../../spec/03-behavior.md#37-case-scripts) in WP1. |
| WP6-S09 | Moved to [chapter 3.7](../../spec/03-behavior.md#37-case-scripts) in WP6. |

The case-script paragraph on assignment gained "Assignment targets are places rooted in the script's own locals or `on call` out bindings (WP1-S05)" in WP1.
