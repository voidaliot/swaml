# SWAML 1.1.0 release evidence

Version 1.1.0 retains explicit reusable definitions and simplifies model authoring. The parser and host select language 1.1; files start with packages. Concrete component usages replace system declarations, states remain directly owned by operations, and unnecessary expression markers are removed. The [migration guide](MIGRATION_1_1.md) documents the intentionally incompatible syntax revision introduced in version 1.1. Runtime and interface isolation obligations are preserved.

## Tracked iterations

| Issue | Acceptance and evidence |
| --- | --- |
| [17: Compact language core](https://github.com/voidaliot/swaml/issues/17) | Grammar, explicit definition/usage identities, root closure, state ownership, expression resolution and static regressions. |
| [18: Reference execution](https://github.com/voidaliot/swaml/issues/18) | Typed and inline root expansion, private stores, deployment bindings, direct state behavior, pinned CLI version, behavioral regressions and reproducible examples. |
| [19: Complete language specification](https://github.com/voidaliot/swaml/issues/19) | Normative clauses, formal semantics, migration, user guide, grammar mapping and alphabetical keyword/concern navigation. |
| [20: Publication](https://github.com/voidaliot/swaml/issues/20) | Full Markdown/PDF, reviewed vector notation examples, exact source attachments and manifests, repository guidance, CI and release assets. |

Each issue is resolved by a focused commit with its verification evidence. CI runs on Node 22 and 24 and checks the committed PDF, an independent PDF rebuild and figure reproducibility. Earlier review fixes for required boundaries and terminated-state input deadlines are included.

## Verification and scope

The release gate passes **212 tests**, validates **nine example models**, checks **11 simulation runs**, covers **80 grammar rule/type mappings** and **122 reserved keywords**, and verifies **eight graphical subjects** across all seven view families and both FV forms. Cross-review regressions include imported-root diagnostic locations, enum-only workspace dependencies and lexical enum/value shadowing.

The publication gate runs `npm run check`, covering the full test suite, every model validation and expected simulation, the complete grammar mapping, keyword coverage and graphical subjects. PDF verification checks the source bytes and hashes, bookmarks, links and page bounds. Every rendered page is visually inspected before release.

The reference core provides parsing, broad static validation and bounded logical-time simulation. It remains S and partial V pending an independent conformance audit. It does not claim a kernel-validated exporter, physical realtime schedulability, universal safety/liveness, automatically realized cases, production middleware or a graphical editor. The VS Code extension is developed elsewhere against the documented language and host contracts.

The v0.1.0 release and v1.0.0 tagged edition remain immutable. Current artifacts are named 1.1.0 and embed their exact maintained sources; current syntax is not retroactively applied to historical editions.
