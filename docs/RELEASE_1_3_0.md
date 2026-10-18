# SWAML 1.3.0 release notes

Release date: 2026-10-18. Language family and reference simulation profile: 1.3.

The 1.3 edition adds counted `for`, copied-array `forEach` and bounded post-test `do … while` loops. Named interruptible regions receive typed input through existing routes and transfer control to a handler within the same serial activation. FV adds function timing and interrupt examples alongside flow and states.

The parser and simulator explicitly select the 1.3 family/profile. New keywords require contextual identifier migration; existing 1.2.1 semantics and component boundaries remain intact. See the [migration guide](MIGRATION_1_3.md), [control-flow guide](CONTROL_FLOW_AND_TIMING.md) and [design decision](decisions/0011-loops-interrupts-and-function-timing.md).

Validation includes loop parsing/type/scope/bound and observable-store regressions; typed interrupt routing, cancellation, nested unwind, inactive/duplicate input and timeout ties; portable timing projection tests; source-backed showcase metadata; complete example simulations; and exhaustive keyword, mapping and graphical coverage.

The reference simulator remains a bounded logical-time model. Interrupts are cooperative cancellation at statement boundaries. Timing diagrams distinguish declared limits from observed phases and retain open intervals at trace boundaries. Neither supplies processor preemption guarantees, measured physical WCET or production scheduling proof.
