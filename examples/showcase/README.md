# Showcase models

Three larger swa.ml models, each one self-contained `.swaml` file. They are written to exercise the whole language in a realistic setting: typed ports and explicit routes, QoS policies, schedules with deadlines, state behaviour, deployment, requirements with `satisfy` and `verify`, executable use cases and tests, and all seven view kinds.

| Model | Domain |
| --- | --- |
| [autosar-classic-door-controller.swaml](autosar-classic-door-controller.swaml) | A real-time door control unit in the style of AUTOSAR Classic: application components, basic-software-like I/O, communication, diagnostics and mode management, the task schedule and a plant model as test bench. |
| [autosar-adaptive-v2x-telemetry.swaml](autosar-adaptive-v2x-telemetry.swaml) | A service-oriented vehicle-to-everything and telemetry application in the style of AUTOSAR Adaptive: awareness and hazard messages, security, store-and-forward uplink, consent, supervision and function-group states. |
| [cloud-fleet-monitoring.swaml](cloud-fleet-monitoring.swaml) | A vendor-neutral cloud backend for vehicle fleet monitoring: device gateways, ingestion, per-vehicle state, alert escalation, remote commands, tenant isolation and a circuit breaker. |

The example gate (`npm run check`) validates each model and runs its use cases and tests in the reference simulator; the expected results are in [../simulation/cases.json](../simulation/cases.json). Run one yourself with the CLI, for example `node out/src/cli/main.js test examples/showcase/cloud-fleet-monitoring.swaml` after `npm run build`.

These models are "in the style of" their domains. They do not claim conformance to AUTOSAR, ETSI, SAE or any other standard, and they contain no text from those standards. A reference run is bounded, deterministic evidence in logical time, not proof of target scheduling or timing.
