# Standard and implementation version policy

The swa.ml standard uses **MAJOR.MINOR only**. The current published edition is **2.2**, dated **10 November 2026**; the maintained source prepares the **unreleased 3.0 candidate**. Publication is established by the immutable `v2.2` tag and its verified reference/PDF/manifest/checksum, not by a local build or merge. The reference implementation, consuming tools and websites have separate release lifecycles. Read this before changing versions, changelog entries, published references or release workflows.

On 10 November 2026, the owner selected explicitly associated component access for tests using unchanged syntax. This is a normative addition, so it allocates draft standard 2.2, implementation 3.1.0 and selected host/profile 2.2 / `swaml-reference/2.2`. Remote tags/releases contained no 2.2 or 3.1.0 allocation. The complete 2.1 reference, PDF, manifests, checksums, release notes, tag and figure paths remain unchanged. New draft references and figures use 2.2 paths; no new PDF, release tag or publication is authorized by this work.

The owner subsequently selected primary-subject operation calls from both use cases and tests, including the subject's own messages and waits, without extending use-case private access. This continues the same unpublished 2.2 / 3.1.0 candidate under ADR 0021; it does not allocate a version per commit or alter any published artifact. Consumers pin the exact reviewed implementation commit, since execution observations can change within this draft profile.

The owner then explicitly authorized a fresh adversarial release review, correction of findings, release-preparation PRs and publication of swa.ml 2.2 and the consuming extension. This supersedes the earlier implementation-only hold. The standard remains 2.2 and implementation 3.1.0; no upstream npm package is published from this private workspace root. Every published artifact remains immutable.

On 18 November 2026, following the approved [2.3 release draft](RELEASE_3_0.md) and ADRs 0022 to 0025, work package WP1a allocated the unreleased **3.0 candidate**: `spec/standard.json` 3.0, selected parser/host semantics 3.0 and profile `swaml-reference/3.0`, and implementation 4.0.0, a major implementation version because later work packages widen existing AST properties. Remote tags and releases contained no 3.0 or 4.0.0 allocation. WP1a changes no language rule: the candidate accepts exactly the 2.2 language until WP1 lands, and the three compatibility gates compare it with fixtures recorded from 3.1.0. The 3.0 reference, figures, notation and trace are unreleased draft artifacts under 3.0 paths. The published 2.2 reference, PDF, manifest, checksum, release notes, figures, notation and trace keep their bytes. No 3.0 PDF, tag or publication is authorized by this work.

## Standard versions

[spec/standard.json](../spec/standard.json) owns the standard version. Use two nonnegative integers with no leading zeroes, patch component or prerelease suffix: 2.0, 2.1, 2.2, 3.0. Draft status belongs in prose or separate status metadata, never in a version such as 2.2.0 or 2.2-beta.

Increment the major number for incompatible syntax or semantic changes and reset minor to zero. Increment minor for compatible normative additions or corrections that require a new standard edition. Editorial corrections, website changes and fixes that bring an implementation into conformance do not create a standard version. Record them under Unreleased with the exact implementation commit as needed. Never silently change a published edition's normative meaning.

Generated keyword/notation inventories, maintained reference headings and draft website edition metadata use the standard version. The selected parser/host semantics and execution profile are currently 3.0 and swaml-reference/3.0 (the unreleased candidate), despite the concrete grammar so far unchanged from 2.1. Review these deliberately when standard semantics change; do not bump them for an implementation patch.

Future standard release titles, tags, changelog headings and new publication filenames use X.Y: for example, swa.ml 2.1, v2.1 and SWAML-2.1-Specification.pdf. Inspect existing tags, GitHub releases and manifests before allocating a version. Never move a release tag or reuse a published version for different bytes.

## Implementation packages

The root package.json owns the reference implementation's npm version. npm tooling uses three-part SemVer, currently 4.0.0 for the 3.0 candidate (3.1.0 implemented the published 2.2); this is not the displayed standard version. Keep both root version entries in package-lock.json synchronized. Implementation packages may receive patch versions while continuing to implement the same standard edition. A consuming tool has its independent version. Do not choose version numbers merely to match other products.

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

The frozen 2.0 reference remains under history/2.0.0/docs. Its PDF, embedded sources, manifest and checksum remain intact. The published docs/SWAML-2.1-Reference.md is frozen too. The published 2.2 reference docs/SWAML-2.2-Reference.md, its figures and simulation trace under edition-specific 2.2 paths are frozen as well. The 3.0 candidate reference is generated as docs/SWAML-3.0-Reference.md, with figures, notation and trace under 3.0 paths. Published figure paths and examples/simulation/hello-trace.json retain their bytes. The former maintained path docs/SWAML-2.0.0-Reference.md remains a historical pointer. Archive validation checks frozen inputs; it cannot replace the strict current-source gate for a new edition.

Keep published changelog sections and their original terminology. Record later corrections under Unreleased. Maintained documentation identifies the published **swa.ml 2.2** and the unreleased 3.0 candidate and distinguishes them from historical 2.1 artifacts; local website builds use the selected 3.0 candidate edition metadata. A local build does not deploy a website or publish an edition. Link to actual existing publications; older pages and artifacts keep their original names. Preserve .swaml filenames and technical IDs.
