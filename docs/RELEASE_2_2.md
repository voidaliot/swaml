# swa.ml 2.2 draft

**Status: Unreleased.** Implementation package 3.1.0 selects language semantics 2.2 and profile `swaml-reference/2.2`. The concrete grammar is unchanged from 2.1. This source tree and its generated draft reference are not a published standard edition or a new PDF publication.

Tests may inspect their subject, explicitly associated software component occurrences and those roots' single parts. Existing `associate` links and dotted paths express these references; tests and use cases still own no components. Direct attribute assignment remains forbidden. See [ADR 0020](decisions/0020-associated-test-access.md).

Both use cases and tests may also call operations of their exact primary subject, including operations that communicate through their own ports, receive or wait. The call uses the subject's actual serial context, releases its lock during suspension and returns to the case on completion. It retains local-call semantics without a new schedule activation or `after` release. Use cases gain no private reads or calls on parts/associated components; tests' additional helper calls outside the primary subject retain their noncommunicating/nonsuspending restriction. Actor port rules remain unchanged. See [ADR 0021](decisions/0021-case-subject-calls.md).

Source models do not need new syntax. Consumers must deliberately select the 2.2 host/profile to use the added access rule. Associations do not restrict initialization, choose a fixture topology or suppress unrelated work: cases still run a fresh package configuration. Indexed component paths remain outside the grammar.

The published [2.1 reference](SWAML-2.1-Reference.md), [2.1 PDF](../output/pdf/SWAML-2.1-Specification.pdf), manifests, checksums, figures, release notes and tag keep their original bytes. New draft figures use edition-specific 2.2 paths. The [version policy](VERSIONING.md) and [PDF publication gate](PDF_PUBLICATION.md) apply before any separately authorized 2.2 release.
