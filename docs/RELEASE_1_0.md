# SWAML 1.0.0 release evidence

Version 1.0.0 aligns the specification and package version and uses source header 1.0. It builds on the immutable v0.1.0 publication. The language remains a closed software architecture core with explicit interfaces, direct operation/state ownership and a proposed KerML mapping contract.

## Tracked iterations

| Issue | Acceptance and evidence |
| --- | --- |
| [8: Formal baseline](https://github.com/voidaliot/swaml/issues/8) | Version migration, typing/evaluation/transition judgments, operational rules; parser/static tests and models updated. |
| [9: Reference simulation](https://github.com/voidaliot/swaml/issues/9) | Complete expression/statement execution, state machines, queues, RPC, snapshots, faults and bounded logical time; behavioral regressions and eight reproducible example runs. |
| [10: User-facing reference](https://github.com/voidaliot/swaml/issues/10) | Alphabetical concern guide, all 129 reserved words with contexts/examples, complete generated Markdown edition and drift checks. |
| [11: Graphical examples](https://github.com/voidaliot/swaml/issues/11) | Eight vector illustrations covering Browser, GV, IV, CV, SV, GRV, and both FV forms; source/subject validation and accessible labels. |
| [12: Publication](https://github.com/voidaliot/swaml/issues/12) | Synchronized full PDF/Markdown, source manifests, publication checks, repository guidance and release preparation. |

Each issue is resolved by a focused implementation commit. GitHub records the exact closure commit and review/CI evidence. The release publication gate is `npm run check`, reproducible figure checks, complete PDF source/navigation/bounds verification, and visual review of every rendered page. A passing build is evidence for the listed implementation checks, not an independent certification of every normative clause.

## Verification results

The release gate passes **138 tests**, validates and simulates **8 example systems**, covers **80 grammar rule/type mappings** and **129 reserved keywords**, and verifies **8 graphical subjects** across all view families. CI runs the language gate on Node 22 and 24 and independently verifies/rebuilds the PDF and vector examples. The regression suite remains distinct from an independent conformance certification.

## Scope and remaining backend work

The repository fully specifies SWAML 1.0's supported constructs and rejects unsupported syntax. It provides parsing, broad static validation and a deterministic reference simulator with explicit abstractions. It does not assert kernel-validated export, physical realtime schedulability, universal safety/liveness, exactly-once application effects, case realization from syntax alone, production middleware, or a graphical editor. The actual VS Code extension is implemented separately against these contracts.

The consolidated Markdown is generated from maintained chapters and contains the exact grammar and complete models. The PDF embeds exact sources and diagrams with a hash manifest. Published 0.1 artifacts remain historical; future corrections must identify the specification patch and whether any model meaning changes.
