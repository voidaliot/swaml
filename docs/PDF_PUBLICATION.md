# Publication and historical editions

swa.ml 2.2 is the current release edition, with parser/host semantics 2.2 and profile swaml-reference/2.2. Its dedicated [reference](SWAML-2.2-Reference.md), PDF, source manifest and checksum use new 2.2 paths. Published 2.1 artifacts remain frozen: the [2.1 reference book](SWAML-2.1-Reference.md), PDF, source manifest and checksum use dedicated X.Y files, SWAML-2.1-Reference.md and SWAML-2.1-Specification.pdf, .manifest.json and .sha256. The published 2.0 standard uses the legacy v2.0.0 tag and filenames; preserve those artifacts. Its frozen [reference](../history/2.0.0/docs/SWAML-2.0.0-Reference.md) stays under history/2.0.0, and docs/SWAML-2.0.0-Reference.md remains as a pointer so that existing links work. No compatibility parser is part of the language; the [2.1 release notes](RELEASE_2_1.md) describe the migration from 2.0.

Preserve every published 1.x Markdown/PDF, source manifest, checksum and historical figure file. Their embedded sources retain their own grammar and provenance. The pinned 1.3.1 builder refuses a different workspace edition; do not relabel current development as an archived release. [The tooling pin](../scripts/publication-tooling-1.3.1.json) and archive/rebuild scripts retain the original source/tool hashes. Archive-aware checks compare an older PDF to its own embedded manifest rather than the evolving current chapters.

## Preparing a new edition

Run npm ci on a fresh checkout or after dependency changes, then npm run check. Regenerate the current library, inventories as needed, vector worked examples, notation and consolidated reference. Verify figure reproducibility with python scripts/build-graphical-examples.py --check and python scripts/build-notation.py --check. SVG, PNG, scene JSON and model-subject manifests must agree. Do not hand-edit generated books or parser output.

The existing scripts/build-spec-pdf-2.0.py and scripts/check-spec-pdf-2.0.py identify the legacy 2.0.0 publication of standard 2.0. Preserve that tooling and its frozen inputs. For a new standard edition, prepare a builder/checker whose release and specificationRevision use X.Y and whose implementation package revision is recorded separately, following [VERSIONING.md](VERSIONING.md). Produce the PDF, per-source manifest and SHA-256 checksum under new X.Y filenames. Preserve clickable contents/bookmarks/links, selectable code, readable tables and vector figures. Unsupported Markdown must fail rather than disappear.

Before release, render every page with Poppler or a verified PDF renderer and inspect all pages for clipping, overlap, tiny text, broken figures, orphan headings and excessive whitespace. Inspect dense tables and code at full resolution as well as contact sheets. Automated text/bounds checks supplement visual review. Commit synchronized source/book/PDF/manifest/checksum only after that review. No 2.0 release may reuse 1.x artifacts as if generated from current sources.

## GitHub Pages

The site is the existing showcase project. Build the validated source/trace data with node scripts/build-showcase-data.mjs, then npm run build --prefix showcase. Test all seven views, source selection, copy/download links, theme persistence, keyboard controls and narrow layouts. Preview and inspect the concrete design before publication. Honor existing deployment authorization and explicit holds without asking for per-change approval. GitHub Pages remains a manually dispatched workflow; a source push alone must not publish it.

## Archived checks

The original scripts/test-publication-archive.py, scripts/check-spec-pdf.py and scripts/rebuild-archived-pdf.py retain historical responsibilities. They do not assert a 2.0 PDF exists or validate the new language. Their source pin and archived assets must remain unchanged unless a separately reviewed historical correction is explicitly requested.

## Frozen publications

node scripts/check-frozen-publications.mjs runs in npm run check and source CI (test/ci/frozen-publications.test.mjs). It pins the SHA-256 of the PDF, .manifest.json and .sha256 file of every published edition under output/pdf (0.1.0, 1.0.0, 1.1.0, 1.1.1, 1.2.0, 1.2.1, 1.3.0, 1.3.1, 2.0.0, 2.1 and 2.2), so a rebuilt or edited publication fails even when its manifest and checksum agree with it. Source CI fetches the release tags, and the test compares the pins with the files at each release tag (v1.2.0 for 0.1.0 to 1.1.1, which that release rebuilt), so a pin cannot be edited silently; without tags that comparison is skipped with a notice.

The check also requires each frozen workspace copy to equal the hash its edition's manifest records: for 2.2 the reference book, RELEASE_2_2.md, every file under docs/figures/2.2, docs/notation/2.2 and examples/simulation/2.2, and every script the 2.2 PDF embeds (its builder, checker, source inventory, archive verifier, publication test, requirements and the shared notation, figure, reference and version scripts); for 2.1 the reference book, RELEASE_2_1.md, examples/simulation/hello-trace.json, every file under docs/figures/2.0 and docs/notation/2.0 and the 2.1 publication scripts; for 2.0.0 the frozen reference under history/2.0.0 and pdf-requirements.txt; for 1.x the reference books and release and migration notes. A file added to a frozen directory fails as well. Every companion or script that a manifest lists and that changed after its release is a named exception in the script, with the commit that changed it. PDF, PNG and TTF files are compared byte for byte, every other file after CRLF is normalized to LF, as the builders hashed them. Maintained sources (docs/spec, the guides, src, examples and inventories) are not frozen. A new edition adds its pins when it is published; a later edition that needs to change a frozen script adds a new X.Y file, or moves the entry from the edition's files to its exceptions with the commit and reason and lowers its count, in a reviewed change.

## 2.2 commands

```sh
python scripts/check-spec-pdf-2.2.py --archive
python scripts/test-publication-2-2.py
```

scripts/build-spec-pdf-2.2.py is the historical release builder of the published edition. Do not run it: it would regenerate the PDF, manifest and checksum from the current sources, which the frozen-publication check rejects.

The 2.2 edition is published, and maintained sources it embeds (package.json and files under src among them) changed after v2.2. The Publication and compatibility workflow therefore runs check-spec-pdf-2.2.py --archive, as it does for 2.1. Archive mode verifies the PDF bytes against the manifest and the .sha256 file, every embedded source and figure against its recorded hash, the complete source bundle hash, the recorded versions, bookmarks, links, release-note content, page bounds and text size, without comparing the embedded sources with the workspace. The frozen-publication check compares the edition-specific workspace copies. Do not rebuild or edit the published 2.2 PDF, manifest or checksum.

Without --archive the 2.2 checker keeps its strict current-source behavior: every attached source must match the current workspace, including ADRs 0020/0021, examples 30/31, the 2.2 trace and edition-specific figure assets. That mode was the gate for releasing 2.2 and no longer passes on main; the next edition's own strict checker is its release gate. Run the Publication and compatibility workflow after the same checks pass locally. Render and inspect every new PDF page before publication. Preserve the published 2.1 and 2.2 builders, checkers and assets, and check them in archive mode.

## 2.1 commands

```sh
python scripts/check-spec-pdf-2.1.py --archive
python scripts/test-publication-2-1.py
```

scripts/build-spec-pdf-2.1.py is the historical release builder of the published edition. Do not run it.

The 2.1 builder refuses a workspace whose spec/standard.json or edition module selects another standard. Its manifest records release, specificationRevision and languageVersion 2.1, the simulation profile, the separate implementationRevision of the reference implementation package and the publicationDate. It embeds the current maintained sources, including SWAML-2.1-Reference.md, as exact canonical attachments. Unsupported Markdown tokens, comment markers parsed as emphasis, backslash escapes in prose outside code spans, unresolved section links and broken repository links fail the build. The checker verifies the source bundle, both versions, the edition module, bookmarks for every keyword and notation concept, internal link destinations, release-tag repository links, release-note content, page bounds and a minimum text size.

Without --archive the 2.1 checker retains its historical strict current-source behavior. The Publication and compatibility workflow runs check-spec-pdf-2.1.py --archive, which verifies the published PDF against its own manifest and attachments after the maintained sources move on.

## 2.0 commands

Install maintained validation dependencies from `scripts/ci-pdf-requirements.txt`.
The original `scripts/pdf-requirements.txt` is preserved as a publication input;
its old versions have known security advisories and are no longer installed in CI.
Reconstructing an archived edition with its original toolchain is a separate,
isolated manual task on trusted pinned sources, not a PR test.

Run the `Publication and compatibility` workflow before a new edition release.
It checks current and archived PDF integrity with maintained dependencies and
runs the Node 24 and Windows compatibility checks. Routine language CI keeps the
semantic tests and production website build; it does not rebuild a frozen 1.x book.

```sh
python scripts/check-spec-pdf-2.0.py --archive
```

scripts/build-spec-pdf-2.0.py is the historical release builder of the published 2.0.0 edition. Do not run it.

The new builder embeds exact canonical repository LF text and binary assets, records their hashes and a bundle hash, identifies the source base commit and dependency versions, and uses the bundled DejaVu fonts. PNG reproducibility checks compare pixel bytes independently of platform compression, while SVG and scene JSON remain byte-exact.

## Preserving the published 2.0.0 book

The current swa.ml branding updates maintained chapters without replacing the published 2.0.0 PDF, source manifest or checksum. The original complete reference is frozen under history/2.0.0/docs/. CI uses check-spec-pdf-2.0.py --archive to verify every embedded source hash, the complete bundle, the frozen reference, navigation and page bounds. Inventories are read from the verified publication attachments.

Without --archive, the checker still requires every current workspace source to match the PDF. That strict mode remains the gate when preparing a new edition. Branding changes are not a new PDF release and do not claim a synchronized new manuscript.
