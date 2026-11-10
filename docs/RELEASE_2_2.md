# swa.ml 2.2 draft

**Status: Unreleased.** Implementation package 3.1.0 selects language semantics 2.2 and profile `swaml-reference/2.2`. The concrete grammar is unchanged from 2.1. This source tree and its generated draft reference are not a published standard edition or a new PDF publication.

Tests may inspect their subject, explicitly associated software component occurrences and those roots' single parts. Existing `associate` links and dotted paths express these references; tests and use cases still own no components. Direct calls keep their nonsuspending/noncommunicating restriction, and direct attribute assignment remains forbidden. Use cases stay black-box and actor port rules do not change. See [ADR 0020](decisions/0020-associated-test-access.md).

Source models do not need new syntax. Consumers must deliberately select the 2.2 host/profile to use the added access rule. Associations do not restrict initialization, choose a fixture topology or suppress unrelated work: cases still run a fresh package configuration. Indexed component paths remain outside the grammar.

The published [2.1 reference](SWAML-2.1-Reference.md), [2.1 PDF](../output/pdf/SWAML-2.1-Specification.pdf), manifests, checksums, figures, release notes and tag keep their original bytes. New draft figures use edition-specific 2.2 paths. The [version policy](VERSIONING.md) and [PDF publication gate](PDF_PUBLICATION.md) apply before any separately authorized 2.2 release.
