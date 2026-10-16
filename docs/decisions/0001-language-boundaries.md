# ADR 0001 — Ownership and communication boundaries

Status: accepted for SWAML 0.1. Date: 2026-10-14.

The ownership/authoring decisions in this historical record are superseded for the unpublished 1.2 candidate by [ADR 0007](0007-component-functions-and-calculations.md).

The repository owner confirmed that units and components communicate only through interfaces, while local calls and variables can remain internal to a unit. The authoring hierarchy is component → unit → operation, with states directly inside stateful operations. Components may compose other components. Pure functions support local value computation.

An operation is the executable primitive. A contract operation signature and its implementation are separate because the interface must remain reusable across implementations. The handler declaration binds them explicitly. There is no performer or independently allocated action object in the user language.

Events belong to interfaces; publishing statements identify a unit-owned port and member. Each outgoing event/data member has a syntactic emitting operation. Each incoming member has exactly one handler owner. This supplies traceable provenance without pretending to prove runtime reachability.

Consequences: more ports are required when decomposing a component into several units. Shared-memory shortcuts cannot be introduced as “internal implementation” across a modeled unit boundary. Keep tightly coupled helpers inside one unit, or model the shared-state service through a contract.

The view families are General, Interconnect, Case, Sequence, Grid and Flow. Browser provides ownership navigation. Flow View covers operation statement flow and owned-state behavior.
