# 0013 — Event-driven operator and test inputs

> Amended for development 2.0 by [ADR 0016](0016-swaml-2-0.md): named from/to case steps, library view definitions and source-operation schedule activation replace the 1.x forms. Historical evidence remains below.

**Status:** accepted for the 1.3.1 revision · **Date:** 2026-10-18

## Decision

Remove the `on manual` function trigger and the simulator's `manual` release option. Operator commands, test inputs and device notifications are named, typed events in `publishSubscribe` or `service` interfaces. A receiving function uses `on receive port.member`; its signature matches that member's payload. States and interruptible regions use the same routed inputs.

An operator, device adapter or test driver is represented by ordinary component-owned behavior. Its functions publish the declared events through owned ports and explicit connectors or delegation. These messages retain the normal route queues, delivery policy, copying, latency, ownership and cancellation rules. There is no direct harness activation of a function, destination-port injection or implicit event source.

Reproducible simulations author a driver using existing `on start`, `on every` or function-owned states with `on after` transitions. A finite state schedule can emit several named events at specified times and then terminate. Local helper functions may organize a source component's publications; they remain local calls. No extra scheduling keyword or driver element enters the software ontology.

A host that generates a test schedule must generate ordinary SWAML source, include it in the validated workspace and preserve it with the run evidence. Generating a driver does not grant access to private behavior or bypass topology closure. The portable simulator accepts resource limits, horizon and transport faults; model stimuli are authored behavior.

## Migration and evidence

This updates the unpublished 1.3.1 candidate. Parser family and reference simulation profile remain 1.3; exact reproduction pins the package revision and source hashes. Published historical editions retain their syntax and artifacts.

Replace each former manual entry point with a named incoming event and an explicit emitting function/route. Where a function is only an internal helper, omit the trigger and call it locally from its owner. Remove old `manual` JSON configuration; the simulator rejects it rather than silently ignoring it. It likewise does not accept a replacement destination-event injection option.

Positive tests demonstrate typed payloads, finite schedules, independent occurrence stores, queueing, timeouts and interruptions through real routes. Negative tests reject the retired trigger/API and retain type, ownership, routing and parser-recovery diagnostics. Timing evidence includes input transport and driver activations; a Timing View selects its displayed function occurrences explicitly.
