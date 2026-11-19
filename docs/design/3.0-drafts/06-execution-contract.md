# 6. Reference execution contract: 2.3 changes (draft)

> **Historical record of swa.ml 3.0.** This file is one of the work-package checklists of the 3.0 edition, drafted under the name 2.3. Every rule has moved into the [specification chapters](../../LANGUAGE_SPECIFICATION.md), which are the only normative text; where a row here differs from them, the chapter wins. The 2.2 state machines and the WP5 state reactions some rows mention are not part of 3.0: states are steps of the flow ([chapter 3.6](../../spec/03-behavior.md#36-states), [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption)).

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 6](../../spec/06-execution-contract.md). The profile became `swaml-reference/2.3` when the candidate was allocated (WP1a); the Tier 2 timed profile `swaml-reference-timed/2.4` is not part of 2.3. Every rule below leaves a 2.2 model's run unchanged: gate 2 (WP1a-M02) compares complete traces with the frozen 3.1.0 fixture, ignoring only `profile` and `languageVersion`. New trace information appears only where new syntax is used.

## 6.1 Lifecycle and time

| ID | Rule |
| --- | --- |
| WP4-R02 | Moved to [chapter 6.1](../../spec/06-execution-contract.md#61-lifecycle-and-time) in WP4. |
| WP8-R01 | Moved to [chapter 6.1](../../spec/06-execution-contract.md#61-lifecycle-and-time) in WP8. |
| WP8-R02 | Moved to [chapter 6.1](../../spec/06-execution-contract.md#61-lifecycle-and-time) in WP8. |

## 6.2 Lock and snapshot

Release guards (applied in WP7 as a new paragraph after the `after` paragraph):

| ID | Rule |
| --- | --- |
| WP7-R01 | Moved to [chapter 6.2](../../spec/06-execution-contract.md#62-lock-and-snapshot) in WP7. |
| WP7-R02 | Moved to [chapter 6.2](../../spec/06-execution-contract.md#62-lock-and-snapshot) in WP7. |
| WP7-R03 | Moved to [chapter 6.2](../../spec/06-execution-contract.md#62-lock-and-snapshot) in WP7. |
| WP7-R04 | Moved to [chapter 6.2](../../spec/06-execution-contract.md#62-lock-and-snapshot) in WP7. |
| WP7-R05 | Moved to [chapter 6.2](../../spec/06-execution-contract.md#62-lock-and-snapshot) in WP7. |
| WP7-R06 | Moved to [chapter 6.2](../../spec/06-execution-contract.md#62-lock-and-snapshot) in WP7. |

## 6.3 Values, flow and failure

| ID | Rule |
| --- | --- |
| WP1-R04 | Moved to [chapter 6.3](../../spec/06-execution-contract.md#63-values-flow-and-failure) in WP1. |
| WP2-R01 | Moved to [chapter 6.3](../../spec/06-execution-contract.md#63-values-flow-and-failure) in WP2. |

## 6.4 Communication

| ID | Rule |
| --- | --- |
| WP6-R05 | Moved to [chapter 6.4](../../spec/06-execution-contract.md#64-communication) in WP6. |
| WP6-R06 | Moved to [chapter 6.4](../../spec/06-execution-contract.md#64-communication) in WP6. |

## 6.5 Input ownership and interruption

Applied in WP5: the state-machine paragraph is followed by the 2.3 selection rules, which reduce to it for a machine without the 2.3 forms.

| ID | Rule |
| --- | --- |
| WP5-R01 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R13 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R02 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R03 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R04 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R05 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R06 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R07 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R08 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R09 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R10 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |
| WP5-R11 | Moved to [chapter 6.5](../../spec/06-execution-contract.md#65-input-ownership-and-interruption) in WP5. |

## 6.6 Evidence and resources

New and extended observations. Field names follow the existing trace (`timeNs`, `ordinal`, `kind`, `subject`, `source`).

| ID | Observation | Fields and meaning |
| --- | --- | --- |
| WP1-T01 | `write` | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP1. |
| WP4-T01 | `wait`, `receiveWait`, `timer` | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP4. |
| WP5-T01 | `state` (extended) | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP5. |
| WP5-T02 | `discardTimer` (new) | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP5. |
| WP5-T03 | `defer` (new) | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP5. |
| WP5-T04 | `violation` (extended) | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP5. |
| WP6-T01 | Moved to [chapter 6.4](../../spec/06-execution-contract.md#64-communication) in WP6. |
| WP7-T01 | `skip` (new) | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP7. |
| WP7-T02 | `discardInput`, `failure` (extended) | Moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP7. |

The `DurationRange` observation rule moved to [chapter 6.6](../../spec/06-execution-contract.md#66-evidence-and-resources) in WP4. (The `sqrt` and `realText` failures, WP3-R01 and WP3-R02, moved to [chapter 6.3](../../spec/06-execution-contract.md#63-values-flow-and-failure) in WP3.)

## 6.7 Case runs

| ID | Rule |
| --- | --- |
| WP5-R12 | Moved to [chapter 6.7](../../spec/06-execution-contract.md#67-case-runs) in WP5. |
| WP7-R07 | Moved to [chapter 6.7](../../spec/06-execution-contract.md#67-case-runs) in WP7. |
