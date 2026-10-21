# 0012 — Dedicated timing view and structure layouts

> Amended for development 2.0 by [ADR 0016](0016-swaml-2-0.md): named from/to case steps, library view definitions and source-operation schedule activation replace the 1.x forms. Historical evidence remains below.

**Status:** accepted for 1.3.1 · **Date:** 2026-10-18

## Decision

`tv` names the Timing View. `fv` presents function statement flow, states and interruptible regions. This supersedes the timing-as-FV presentation in [ADR 0011](0011-loops-interrupts-and-function-timing.md); its execution and cancellation rules remain in effect.

A Timing View selects executable operation/function declarations or occurrences using the same stable selection, union and filter rules as other views. Every selected element must be an operation or function. To select descendant functions from a component context, use explicit recursive expansion and filtering. Empty filtered results remain valid. No implicit expansion or filtering occurs. The host associates observed timing with an identified trace and concrete occurrence identities; the view declaration does not start execution. Declared timing contracts and observed activation spans remain separately labeled.

The General View, `gv`, supports **Box in box** and **Tree** layouts. Nested boxes express component ownership through containment. A tree expresses the same ownership through explicitly labeled parent-to-child edges. Both preserve definition versus occurrence identity, full occurrence paths, direct function ownership and independent private stores. External deployment targets remain references outside the software ownership hierarchy. Tree edges do not imply communication routes or activation order.

Layout is presentation metadata. It does not introduce a second structure view kind or source keywords. Switching layouts preserves semantic selections and identities.

## Compatibility and evidence

The parser family and reference simulation profile remain 1.3. Pin the package revision as well. `tv` becomes a reserved keyword in 1.3.1, so an existing identifier spelled `tv` must be renamed. Authored timing views migrate from `fv` to `tv`; flow and state views remain `fv`. Published 1.3.0 assets retain their original contents.

Positive and negative language tests cover compact and block timing selections, occurrence identity, filters, recovery and invalid subjects. The showcase demonstrates both structure layouts and dedicated timing navigation. Trace-backed timing is evidence about the identified reference run; it does not establish physical execution duration or schedulability.
