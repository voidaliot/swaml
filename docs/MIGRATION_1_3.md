# Migrating to SWAML 1.3

Version 1.3 adds loops, interruptible flow and function timing diagrams. Pin the host/parser to **1.3** and use the `swaml-reference/1.3` simulation profile. The current parser rejects requests for older or inferred editions; use an archived 1.2 release to reproduce its exact grammar.

## Source changes

Existing 1.2.1 constructs retain their meaning, including `of` relations, component ownership, copied values and explicit communication routes. New reserved words are `for`, `forEach`, `do` and `interruptible`; rename earlier identifiers with those spellings. Files remain headerless. The new loops are optional; bounded while loops continue to work.

Use `forEach`, not two separate words. Counted for headers require one var declaration, Boolean condition and assignment update. while, for and do loops require an explicit bound. forEach uses its array length and does not accept an additional bound. The complete syntax and scope rules are in the [control-flow guide](CONTROL_FLOW_AND_TIMING.md).

## Interrupts and traces

An interruptible region adds no free event or communication route. Bind its handler to an incoming member of an owned typed port and keep exactly one receiving owner. Functions that declare regions must be triggered serial flow functions. Regions cannot be introduced into reentrant helpers or state actions as a substitute for their existing behavior rules.

Interrupted pending requests gain a terminal caller-side cancellation observation. Earlier server effects remain committed, and late responses remain correlated and discarded. Trace consumers must recognize regionEnter, regionExit, interrupt and requestCancelled events. Do not reinterpret old profile traces as if they contained these observations.

## Timing presentation

Timing diagrams are an FV mode; there is no new view-kind keyword. Compact and block FV selections still target executable function occurrences. Trace-backed timing diagrams must keep declared contracts separate from observed phases and preserve unfinished activations at a horizon or stop. Existing flow/state views remain available.

The published 1.2.0 and 1.2.1 consolidated references, PDFs, manifests, checksums and release assets retain their versioned filenames. Current generation writes the separate 1.3.0 edition.
