# Publication and historical editions

swa.ml 2.1 is the current standard, with parser 2.1 and profile swaml-reference/2.1. Its [reference book](SWAML-2.1-Reference.md), PDF, source manifest and checksum use dedicated X.Y files: SWAML-2.1-Reference.md and SWAML-2.1-Specification.pdf, .manifest.json and .sha256. The published 2.0 standard uses the legacy v2.0.0 tag and filenames; preserve those artifacts. Its frozen [reference](../history/2.0.0/docs/SWAML-2.0.0-Reference.md) stays under history/2.0.0, and docs/SWAML-2.0.0-Reference.md remains as a pointer so that existing links work. No compatibility parser is part of the language; the [2.1 release notes](RELEASE_2_1.md) describe the migration from 2.0.

Preserve every published 1.x Markdown/PDF, source manifest, checksum and historical figure file. Their embedded sources retain their own grammar and provenance. The pinned 1.3.1 builder refuses a different workspace edition; do not relabel current development as an archived release. [The tooling pin](../scripts/publication-tooling-1.3.1.json) and archive/rebuild scripts retain the original source/tool hashes. Archive-aware checks compare an older PDF to its own embedded manifest rather than the evolving current chapters.

## Preparing a new edition

Run npm ci on a fresh checkout or after dependency changes, then npm run check. Regenerate the current library, inventories as needed, vector worked examples, notation and consolidated reference. Verify figure reproducibility with python scripts/build-graphical-examples.py --check and python scripts/build-notation.py --check. SVG, PNG, scene JSON and model-subject manifests must agree. Do not hand-edit generated books or parser output.

The existing scripts/build-spec-pdf-2.0.py and scripts/check-spec-pdf-2.0.py identify the legacy 2.0.0 publication of standard 2.0. Preserve that tooling and its frozen inputs. For a new standard edition, prepare a builder/checker whose release and specificationRevision use X.Y and whose implementation package revision is recorded separately, following [VERSIONING.md](VERSIONING.md). Produce the PDF, per-source manifest and SHA-256 checksum under new X.Y filenames. Preserve clickable contents/bookmarks/links, selectable code, readable tables and vector figures. Unsupported Markdown must fail rather than disappear.

Before release, render every page with Poppler or a verified PDF renderer and inspect all pages for clipping, overlap, tiny text, broken figures, orphan headings and excessive whitespace. Inspect dense tables and code at full resolution as well as contact sheets. Automated text/bounds checks supplement visual review. Commit synchronized source/book/PDF/manifest/checksum only after that review. No 2.0 release may reuse 1.x artifacts as if generated from current sources.

## GitHub Pages

The site is the existing showcase project. Build the validated source/trace data with node scripts/build-showcase-data.mjs, then npm run build --prefix showcase. Test all seven views, source selection, copy/download links, theme persistence, keyboard controls and narrow layouts. Preview and inspect the concrete design before publication. Honor existing deployment authorization and explicit holds without asking for per-change approval. GitHub Pages remains a manually dispatched workflow; a source push alone must not publish it.

## Archived checks

The original scripts/test-publication-archive.py, scripts/check-spec-pdf.py and scripts/rebuild-archived-pdf.py retain historical responsibilities. They do not assert a 2.0 PDF exists or validate the new language. Their source pin and archived assets must remain unchanged unless a separately reviewed historical correction is explicitly requested.

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
python scripts/build-spec-pdf-2.0.py
python scripts/check-spec-pdf-2.0.py
```

The new builder embeds exact canonical repository LF text and binary assets, records their hashes and a bundle hash, identifies the source base commit and dependency versions, and uses the bundled DejaVu fonts. PNG reproducibility checks compare pixel bytes independently of platform compression, while SVG and scene JSON remain byte-exact.

## Preserving the published 2.0.0 book

The current swa.ml branding updates maintained chapters without replacing the published 2.0.0 PDF, source manifest or checksum. The original complete reference is frozen under history/2.0.0/docs/. CI uses check-spec-pdf-2.0.py --archive to verify every embedded source hash, the complete bundle, the frozen reference, navigation and page bounds. Inventories are read from the verified publication attachments.

Without --archive, the checker still requires every current workspace source to match the PDF. That strict mode remains the gate when preparing a new edition. Branding changes are not a new PDF release and do not claim a synchronized new manuscript.
