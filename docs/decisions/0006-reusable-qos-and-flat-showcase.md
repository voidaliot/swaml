# ADR 0006 — Reusable QoS and flat architecture views

Status: accepted for SWAML 1.2. Date: 2026-10-16.

Repeated connector policies obscure small software architectures. The owner requested simpler language authoring, flat graphics, an interactive React Flow demonstration and a GitHub Pages showcase in the language repository.

## Decision

Add package-owned `qos def Name { ... }` declarations. A connector explicitly selects either `qos Name` or its existing inline `qos { ... }` block. Policy names follow the ordinary package/import/qualified-name and ambiguity rules. Every policy body includes delivery, ordering, positive capacity and overflow in the existing order, with optional latency and age bounds. Policies cannot extend other policies, override fields or provide implicit defaults.

Resolution elaborates the selected body into each connector's effective policy. Sharing a policy never shares queues: queue identity remains connector occurrence, direction and interface member. Sampled buffering, idempotent RPC and realtime completeness are checked at each use. Declaration values and durations are checked even when a policy is unused. An unresolved policy is an error, never a fallback to another policy or defaults.

The headerless parser/host now pins language 1.2 and rejects requests for unsupported editions. Existing valid 1.1 source remains valid under 1.2; hosts must deliberately update the pin. The reference simulation profile remains `swaml-reference/1.1`, because this authoring elaboration does not change scheduling or delivery semantics. The normalized model preserves policy declaration identity, reference provenance and effective per-connector values.

All maintained graphics use flat two-dimensional geometry. Execution locations use front-facing frames instead of cuboids. Browser, gv, iv, cv, sv, grv and operation-owned flow/state fv remain the complete surfaces. Layout may change; semantic ownership and typed routes may not.

The static React Flow showcase is hosted from `showcase/` and demonstrates checked-in models. Selection, filtering and dragging change presentation only. It is not a graphical source editor or execution backend. GitHub Pages deployment is prepared through a repository workflow; public publication remains a separately authorized action.

## Consequences

The vocabulary remains unchanged: `qos` and `def` are existing keywords. The concrete grammar adds `QosPolicy` and `QosBody`; inventories, normalization, validation, simulation, tests and reference material account for both. Inline models need no source migration. See [migration to 1.2](../MIGRATION_1_2.md) and [release evidence](../RELEASE_1_2_0.md).

Historical Markdown/PDF editions remain unchanged. The new edition includes regenerated flat assets and independently checked publication artifacts. The core still does not claim production timing proof, a KerML exporter or graphical editing conformance.
