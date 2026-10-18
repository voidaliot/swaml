# Migrating to SWAML 1.3

The published 1.3.0 edition added loops, interruptible flow and function timing diagrams. This page records that migration; the [1.3.1 revision](MIGRATION_1_3_1.md) moves timing to the dedicated tv kind and introduces GV layout choices. Pin the host/parser to **1.3** and use the `swaml-reference/1.3` simulation profile. The current parser rejects requests for older or inferred editions; use an archived 1.2 release to reproduce its exact grammar.

## Source changes

Existing 1.2.1 constructs retain their meaning, including `of` relations, component ownership, copied values and explicit communication routes. The new reserved words in 1.3.0 were `for`, `forEach`, `do` and `interruptible`; rename earlier identifiers with those spellings. Files remain headerless. The new loops are optional; bounded while loops continue to work.

Use `forEach`, not two separate words. Counted for headers require one var declaration, Boolean condition and assignment update. while, for and do loops require an explicit bound. forEach uses its array length and does not accept an additional bound. The complete syntax and scope rules are in the [control-flow guide](CONTROL_FLOW_AND_TIMING.md).

## Interrupts and traces

An interruptible region adds no free event or communication route. Bind its handler to an incoming member of an owned typed port and keep exactly one receiving owner. Functions that declare regions must be triggered serial flow functions. Regions cannot be introduced into reentrant helpers or state actions as a substitute for their existing behavior rules.

Interrupted pending requests gain a terminal caller-side cancellation observation. Earlier server effects remain committed, and late responses remain correlated and discarded. Trace consumers must recognize regionEnter, regionExit, interrupt and requestCancelled events. Do not reinterpret old profile traces as if they contained these observations.

## Timing presentation

In the published 1.3.0 edition, timing diagrams were an FV mode with no separate view-kind keyword. The 1.3.1 correction uses tv for timing and keeps fv for flow, interruptible regions and states. Both select executable functions; a root/definition context requires an explicit recursive include filtered to functions. Migrate timing declarations and identifiers that conflict with the newly reserved tv word using the [1.3.1 guide](MIGRATION_1_3_1.md). Trace-backed diagrams continue to keep declared contracts separate from observations and preserve unfinished intervals. Parser family 1.3 and `swaml-reference/1.3` remain unchanged.

Published 1.2.0, 1.2.1 and 1.3.0 consolidated references, PDFs, manifests, checksums and release assets retain their versioned filenames. Development generation targets the separate 1.3.1 revision; it does not replace the published 1.3.0 evidence.
