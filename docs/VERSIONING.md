# Language and extension version policy

The language package, editor extension and websites have separate release lifecycles. Read this before changing versions, changelog entries, published references or release workflows.

## Language releases

The root `package.json` is the language package version; keep the root version and root package entry in `package-lock.json` synchronized. The parser family and reference profile, currently `2.0` and `swaml-reference/2.0`, describe compatibility and semantics. Do not change these identifiers just because a documentation or editor patch is being released.

Use a patch for compatible language/runtime corrections, a minor for compatible additions and a major for breaking language changes. A language version change requires review of the grammar, validator, runtime, examples, inventories and documentation affected by it. Do not pick a number solely to match the extension. An exact Git commit remains necessary for a host pin, even when several documentation commits share a package version.

Before allocating a version, inspect tags, GitHub releases and published edition manifests. Never move an existing release tag, reuse a published version for different release bytes or delete older editions. Version-changing commands must not create a tag automatically; prepare the manifest, lockfile and release notes in a reviewable PR first. Local checks, packaging and merge do not authorize publication.

## Changelog and publication history

Record work after a published edition under `## Unreleased` in `CHANGELOG.md`. Describe user-visible behavior and distinguish language changes from website/documentation changes. Finalize the selected notes under `## X.Y.Z — YYYY-MM-DD` only when preparing that language release; use the intended publication date and confirm publication separately. Several commits can belong to the same unreleased work. A website deployment does not by itself release the language package or require a language version bump.

Preserve published changelog sections and their original terminology. Add later corrections to the unreleased section instead of rewriting history. The published 2.0.0 edition is distinct from the maintained 2.0 documentation. Keep its frozen reference source under `history/2.0.0/docs`, its PDF, embedded sources, manifest and checksum intact. The archive check validates those frozen inputs. A new edition must pass the strict current-source publication checks and complete page-by-page review in [PDF_PUBLICATION.md](PDF_PUBLICATION.md); archive validation cannot replace that gate.

## Consumers and sites

The adjacent extension repository owns its version in `packages/extension/package.json`, its extension changelog and [its versioning workflow](https://github.com/voidaliot/swaml-vsc-ext/blob/main/docs/VERSIONING.md). For example, extension 2.0.1 can still bundle language 2.0.0. Do not edit the extension's version as a side effect of a core bump, or bulk-bump its vendored language package as part of an editor release. Update `UPSTREAM.json`, source checksums and bundled references only when deliberately integrating an exact reviewed core commit, then run that repository's required checks.

Web pages must distinguish the language edition from extension/download versions and link to actual published artifacts. Use the visible name **swa.ml**, preserve `.swaml` filenames and technical IDs, and preserve historical publication assets. Website design approval and deployment checks remain governed by `AGENTS.md` and the site repository; language or extension publication is a separate action.
