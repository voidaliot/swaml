# SWAML 1.3.1 release notes

**Edition:** 1.3.1 · **Date:** 2026-10-18 · **Parser family:** 1.3 · **Reference simulation profile:** 1.3

- Add general `class` classifiers and `operation` behavior/signatures. `component` specializes `class`; `function` specializes `operation`. Preserve the authored category through definitions, usages, views and mapping, with compatible narrowing and separate private stores.
- Use ball/socket notation for clientServer and service ports: server/provides use a ball, client/requires use a socket. Typed routes, contract versions, QoS and reverse replies/events retain their meaning.
- Reassess UML notation and semantic transformation with the expanded categories. No XMI adapter is included.

- Add `tv`, a dedicated timing view selecting executable function declarations or occurrences. `fv` continues to present statement flow, states and interruptible regions.
- Add Box in box and Tree presentations of `gv`, preserving the same ownership hierarchy and occurrence identities.
- Remove `on manual` and direct simulator function releases. Operator and test inputs use named, typed events published by ordinary driver functions through explicit routes.
- Align the showcase, examples, keyword and notation inventories, and specification with the revised view taxonomy.

Read the [migration guide](MIGRATION_1_3_1.md) before upgrading: `tv` becomes reserved, authored timing views change from `fv` to `tv`, and the old manual trigger/configuration is rejected. Drivers use the existing lifecycle, event and timer semantics; input transport now contributes to the demonstrated timing observations. Declared contracts remain distinct from observed timing evidence.

`class`, `operation` and `tv` are newly reserved. Existing component/function models retain their behavior; rename colliding identifiers before migrating. Read [ADR 0014](decisions/0014-classes-operations-and-uml-notation.md) and the [UML transformation assessment](UML_COMPATIBILITY.md). Published 1.3.0 reference files and release assets are preserved.
