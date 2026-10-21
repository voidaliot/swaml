# ADR 0011 — Loops, interruptible flow and function timing

> Superseded for development 2.0 by [ADR 0016](0016-swaml-2-0.md). Preserved as the historical 1.x decision.

Status: accepted for SWAML 1.3.0. Date: 2026-10-18.

The FV timing presentation below records the 1.3.0 decision. [ADR 0012](0012-timing-view-and-structure-layouts.md) supersedes that presentation with dedicated `tv` timing views in 1.3.1. The control-flow, interrupt and timing execution rules remain in effect.

## Control flow

Add counted `for`, copied-array `forEach` and post-test `do … while` alongside `while`. Conditional loops require an explicit positive safe-integer literal bound. `forEach` is bounded by its fixed array length and accepts no second bound. These forms preserve copied values, lexical scope, range checks and statement-boundary scheduling.

The counted header contains one `var` initializer, one Boolean condition and one assignment update. The initializer executes once; the condition executes before each iteration; the update executes after a normally completed body. Header variables exist only in the header and body. Each body iteration has a fresh child scope. A `forEach` evaluates and copies its array once, then supplies a fresh copied, typed element to each iteration. Changes to the source array or element local do not alter that snapshot. A do loop executes its body before its first test; body locals are not visible in its condition.

## Interruptible regions

`interruptible work { … } on receive control.stop { … }` defines a named protected region and one interrupt handler. The endpoint is an incoming data/event member of a typed port owned by the same component. The function owns the receiving behavior; delivery uses the existing explicit route and queue. There is no global interrupt or new architectural participant.

Regions are limited to triggered serial flow functions. Stateful functions use their receive transitions; reentrant functions and untriggered helpers cannot declare regions. Helpers called from a protected body can be unwound. Region names are unique in their function, and an interrupt member cannot also be an activation trigger or another region's interrupt member. Existing single-handler and delegation rules still apply.

A region is armed from entry to normal exit or interruption. Available input outside that interval is discarded with an explicit undeliverable-interrupt observation. Delivery selects the active region for its member, disarms it, and transfers control at a statement boundary to the handler. Nested regions unwind when an outer region is interrupted. The handler sees enclosing values and copied payload bindings, but cannot see protected-body locals. After normal handler completion, execution continues after the region.

Interruption retains the activation identity, serial lock, snapshot and deadline. It cancels an outstanding caller-side request continuation, including its otherwise branch, and makes a still-pending correlation terminal with an Interrupted reason. It does not cancel server execution or roll back effects. A late reply is discarded. Existing terminal outcomes remain immutable: timeout wins its correlation race at expiry, even if a later interrupt transfers control before the queued failure continuation runs. Already scheduled continuations cannot resume the unwound stack.

Return and failure still terminate their function/frame and disarm regions. A region does not catch ordinary runtime failures. Interrupt dispatch bypasses ordinary activation dispatch only to resume its existing serial activation; it creates no parallel handler activation. This is cooperative model-level cancellation, with no claim of processor-interrupt latency or physical preemption.

## Function timing diagrams

Timing is a further FV projection, alongside statement flow and function-owned states. Keep the existing view kinds. A timing projection shows selected function occurrences, activation identities, release/dispatch, ready/running/request-wait phases, completion/failure, interruption and correlated late responses on a common logical-time axis.

Declared WCET, deadline and concurrency remain distinct contract values. Observed bars come from an identified trace with model/run provenance. Zero-cost simulation execution remains a zero-duration marker; it must not become a measured CPU duration. Horizon or stopped runs retain open intervals, and missing completion is not invented. Reused definitions and concurrent activations keep distinct lanes. Layout cannot create scheduling or verification evidence.

## Edition and evidence

The new keywords can conflict with earlier identifiers. The current parser and simulator therefore select language/profile 1.3 explicitly; archived 1.2 releases retain their grammar and evidence. Source migration is described in the 1.3 guide.

Acceptance covers positive and malformed parsing, scope/type/bound failures, observable loop stores, interruption of suspended and nested execution, timeout ties, duplicate/inactive input, independent occurrence identities and reproducible timing projections. The canonical catalog and interactive showcase use source-backed contexts. Target bindings still supply physical scheduling and cancellation-latency evidence.
