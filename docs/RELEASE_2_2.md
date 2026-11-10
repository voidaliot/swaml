# swa.ml 2.2 release

10 November 2026. Standard 2.2, parser/host semantics 2.2, reference profile `swaml-reference/2.2`, reference implementation package 3.1.0. The concrete grammar is unchanged from 2.1. Hosts select the new semantics and pin an exact implementation revision; source models need no new syntax.

## Primary-subject operation calls

Both use cases and tests may also call operations of their exact primary subject, including operations that communicate through their own ports, receive or wait. The call uses the subject's actual serial context, releases its lock during suspension and returns to the case on completion. It retains local-call semantics without a new schedule activation, route, transport timeout or `after` release. Caller context restores on return or failure; failing statements retain their actual source and outputs copy back only after success. Stateful operations remain on-start-only. See [ADR 0021](decisions/0021-case-subject-calls.md) and [example 31](../examples/31-case-subject-calls.swaml).

A case is sequential: a later actor reply branch cannot execute while that same case is blocked in a subject call. Use independently behaving actors or stimulate the subject asynchronously before serving its reply. Waiting calls occupy ordinary whole-value statements, declarations or assignments, with optional `try`; evaluate a call before a loop if its result is needed in the header.

## Referencing associated test components

Tests may inspect their subject, explicitly associated software component occurrences and those roots' single parts. Existing `associate` links and dotted paths express the references. Use cases gain no private reads or direct calls on parts or associated peers. Tests' helper calls outside the primary subject may change the target through its operation but must neither communicate nor suspend. Direct attribute assignment remains forbidden. See [ADR 0020](decisions/0020-associated-test-access.md) and the [ten-component integration](../examples/30-associated-integration.swaml).

Neither case kind owns components. Associations reference existing same-package software occurrences; they do not select execution roots, choose a fixture topology or suppress unrelated startup work. Every case still runs a fresh package configuration. Indexed component paths remain outside the grammar. Actor-port association, interface-only, direction and route rules are unchanged.

## Publication and compatibility

The release includes the [complete reference](SWAML-2.2-Reference.md), [PDF](../output/pdf/SWAML-2.2-Specification.pdf), [source manifest](../output/pdf/SWAML-2.2-Specification.manifest.json) and [SHA-256 checksum](../output/pdf/SWAML-2.2-Specification.sha256). The [publication gate](PDF_PUBLICATION.md) checks exact current sources, embedded attachments, navigation, readable bounds and every rendered page. A tagged release and uploaded artifacts establish publication; a source merge alone does not.

All published [2.1 reference](SWAML-2.1-Reference.md), [2.1 PDF](../output/pdf/SWAML-2.1-Specification.pdf), manifests, checksums, figures, release notes and tags retain their bytes, as do earlier editions. The 2.2 assets use their own paths. This edition extends the supported 2.1 behavior without a compatibility parser or source migration. Passing tests and example cases remain bounded evidence, not universal verification or production scheduling certification.
