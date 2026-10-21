# ADR 0007 — Components, functions and calculations

> Superseded for development 2.0 by [ADR 0016](0016-swaml-2-0.md). Preserved as the historical 1.x decision.

Status: accepted for SWAML 1.2.0. Date: 2026-10-16.

[ADR 0010](0010-consistent-subject-relations.md) records the 1.2.1 relation-syntax correction and its migration.

The software vocabulary uses nested components, functions for executable behavior, calculations for pure values and deployment references to an external system model. This decision supersedes the component/unit split and operation terminology in ADR 0001 and the corresponding restrictions in ADR 0004. Historical editions retain their original syntax and semantics.

## Ownership

A component is the software boundary for private state, typed ports and functions. It may also contain child components, connectors and delegation. Leaf and composite components use the same rules. Each instance has independent state and activation locks; containment does not permit direct access to a child's private values or functions. Local calls stay inside the owning component, while every cross-component exchange follows a typed port/interface/member route.

An executable `function` owns statements or directly owned states. Interface `function` signatures remain separate contracts whose handlers bind explicitly. As refined by [ADR 0008](0008-function-local-calculations-and-calls.md), calculations belong only to functions. A `calc` declares typed `in` inputs and one named non-void `return` expression. Calculations use copied inputs and other local calculations; they cannot read mutable state, communicate or call executable functions. The separation makes guards and value expressions effect-free without requiring an architectural participant for every calculation.

The input/result presentation draws on the calculation concepts in [SysML 2.0, clause 7.19](https://www.omg.org/spec/SysML/2.0/Language/PDF). SWAML's calculation is a deliberately bounded, original language rule; the similar vocabulary does not establish SysML syntax compatibility or kernel conformance.

## Reuse

`component def` defines a reusable type, and `component name: Type;` creates one concrete instance. `specializes Base` permits one base definition. `redefines` explicitly replaces an inherited member with a compatible member of the same category. Specialization and effective containment must remain acyclic. Local references in inherited behavior resolve against the effective specialized component, while every instance receives distinct storage.

Compatibility preserves ports, private value types, function signatures, triggers, concurrency and body category. Function timing cannot be weakened. A redefined child may use its original type or a specialization. Connectors and delegations retain endpoint paths. Unmarked inherited-name collisions are errors. This is controlled architectural reuse; a separate class construct, dynamic creation/destruction, reference payloads and multiple inheritance are outside the contract.

## Deployment and types

`deploy controller on "sysml:Vehicle::ecu";` links a component instance to an external system/part identity. General `system:` identities are also supported. SWAML validates the local path and reference form; a host resolves the external model and establishes platform suitability. The core does not define hardware nodes or claim an implemented SysML importer/exporter.

The value vocabulary is bool, int, uint, byte, real, string, result-only void, nominal records/enums and fixed arrays. byte and uint have checked bounded integral domains. Numeric conversion must preserve values or report a range failure; it must not wrap or truncate silently.

## Migration and evidence

This change intentionally breaks earlier 1.2 candidate and 1.1 source syntax. Update source, model fixtures, public guides, diagrams, keyword/mapping inventories and the reference simulation profile together. The selected language edition remains 1.2 because this is an unpublished candidate revision, not a silent change to a published edition. Profile `swaml-reference/1.2` records the new execution representation and function-based harness inputs. The [migration guide](../MIGRATION_1_2.md) supplies the conversion steps.

Acceptance requires parser and semantic negative cases, inherited behavior and independent-store traces, calculation purity, numeric bounds, external deployment checks, reproducible figures and current documentation fixtures. Source reuse, a bounded simulator run and an external identity string make no claim of production schedulability, universal verification or cross-language conformance.
