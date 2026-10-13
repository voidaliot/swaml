# ADR 0001 — Ownership and communication boundaries

Status: accepted for SWAML 0.1. Date: 2026-10-14.

The repository owner confirmed that units and components communicate only through interfaces, while local calls and variables can remain internal to a unit. The authoring hierarchy is component → unit → operation, with states directly inside stateful operations. Components may compose other components. Pure functions support local value computation.

An operation is the executable primitive. A contract operation signature and its implementation are separate because the interface must remain reusable across implementations. The handler declaration binds them explicitly. There is no performer or independently allocated action object in the user language.

Events belong to interfaces; publishing statements identify a unit-owned port and member. Each outgoing event/data member has a syntactic emitting operation. Each incoming member has exactly one handler owner. This supplies traceable provenance without pretending to prove runtime reachability.

Consequences: more ports are required when decomposing a component into several units. Shared-memory shortcuts cannot be introduced as “internal implementation” across a modeled unit boundary. Keep tightly coupled helpers inside one unit, or model the shared-state service through a contract.

The view names confirmed by the owner are General, Interconnect, Case and Sequence. GRV retains Aliot's Grid convention. Browser remains navigation. FV covers operation flow and owned-state behavior. GEV and separate AFV/STV view IDs are excluded.
