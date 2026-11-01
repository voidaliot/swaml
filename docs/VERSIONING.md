# Standard and implementation version policy

The swa.ml standard uses **MAJOR.MINOR only**, currently **2.1**. The reference implementation, consuming tools and websites have separate release lifecycles. Read this before changing versions, changelog entries, published references or release workflows.

## Standard versions

[spec/standard.json](../spec/standard.json) owns the standard version. Use two nonnegative integers with no leading zeroes, patch component or prerelease suffix: 2.0, 2.1, 3.0. Draft status belongs in prose or separate status metadata, never in a version such as 2.1.0 or 2.1-beta.

Increment the major number for incompatible syntax or semantic changes and reset minor to zero. Increment minor for compatible normative additions or corrections that require a new standard edition. Editorial corrections, website changes and fixes that bring an implementation into conformance do not create a standard version. Record them under Unreleased with the exact implementation commit as needed. Never silently change a published edition's normative meaning.

Generated keyword/notation inventories, maintained reference headings and website edition metadata use the standard version. Parser compatibility and execution profiles, currently 2.1 and swaml-reference/2.1, must be reviewed deliberately when standard semantics change; do not bump them for an implementation patch.

Future standard release titles, tags, changelog headings and new publication filenames use X.Y: for example, swa.ml 2.1, v2.1 and SWAML-2.1-Specification.pdf. Inspect existing tags, GitHub releases and manifests before allocating a version. Never move a release tag or reuse a published version for different bytes.

## Implementation packages

The root package.json owns the reference implementation's npm version. npm tooling uses three-part SemVer, currently 3.0.0 (a major version for the incompatible 2.1 API); this is not the displayed standard version. Keep both root version entries in package-lock.json synchronized. Implementation packages may receive patch versions while continuing to implement the same standard edition; package 3.0.1 would still implement standard 2.1. A consuming tool at 2.0.1 may likewise implement standard 2.0. Do not choose version numbers merely to match other products.

When deliberately changing the implementation package version, use `npm version <X.Y.Z> --no-git-tag-version`, inspect both manifests, and run `npm run check`. Never run npm version merely to rename the standard. An exact source commit remains necessary for a host pin; unchanged package versions across documentation commits do not identify identical sources.

Do not bulk-bump consumers or vendored language packages. Follow each consumer's own version policy and update its source pin, checksums and bundled references only during an intentional integration.

## Preparing an edition

1. Record work under `## Unreleased` in CHANGELOG.md. Allocate a new standard version only for a reviewed normative change.
2. Update spec/standard.json and review grammar, validator, runtime, parser/profile identifiers, examples and affected normative chapters. Regenerate inventories with `node scripts/build-inventories.mjs`, the maintained reference with `npm run docs:build`, and site data with `node scripts/build-showcase-data.mjs`. Update remaining versioned source paths deliberately.
3. Run `npm run check` and the Publication and compatibility workflow. The standard-version gate rejects patch versions, mismatched generated metadata and unsynchronized implementation lockfiles.
4. Prepare new publication files under X.Y names. Pass strict current-source PDF checks and inspect every rendered page as required by [PDF_PUBLICATION.md](PDF_PUBLICATION.md).
5. Move the selected standard notes to `## X.Y — YYYY-MM-DD` using the intended publication date. Keep implementation-only changes identified separately. Prepare everything in a reviewable PR without creating a tag.
6. Publish only when authorized, then confirm the actual tag, assets, checksums and date. A local build, merge or website deployment does not publish a standard.

Several commits may belong to one unreleased version. Do not allocate a version per commit or label draft work as released.

## Existing publication history

Standard 2.0 was already published on 22 October 2026 under the legacy tag v2.0.0. This is the original publication of standard 2.0, not a separate patch-level standard. Preserve that tag, its release notes and all existing 1.x/2.0.0 artifacts and filenames. Do not create a duplicate v2.0 release or rename/rebuild its bytes merely to adopt the new numbering policy.

The frozen reference remains under history/2.0.0/docs. Its PDF, embedded sources, manifest and checksum remain intact. From 2.1 the maintained reference is generated as SWAML-X.Y-Reference.md, currently SWAML-2.1-Reference.md. The former maintained path docs/SWAML-2.0.0-Reference.md remains as a short pointer to the frozen copy and the current reference so that existing links work. Archive validation checks the frozen inputs; it cannot replace the strict current-source gate for a new edition.

Keep published changelog sections and their original terminology. Record later corrections under Unreleased. Public pages use the current standard, **swa.ml 2.1**, distinguish the standard from implementation/download versions and link to the actual existing artifacts; the 2.0 pages and artifacts keep their original names. Preserve .swaml filenames and technical IDs.
