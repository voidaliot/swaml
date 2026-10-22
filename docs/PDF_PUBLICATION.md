# Publication and historical editions

swa.ml 2.0.0 is the current reference edition, with parser 2.0 and profile swaml-reference/2.0. Its [reference book](SWAML-2.0.0-Reference.md), PDF, source manifest and checksum use dedicated versioned files. No compatibility parser or migration guide is part of this restart.

Preserve every published 1.x Markdown/PDF, source manifest, checksum and historical figure file. Their embedded sources retain their own grammar and provenance. The pinned 1.3.1 builder refuses a different workspace edition; do not relabel current development as an archived release. [The tooling pin](../scripts/publication-tooling-1.3.1.json) and archive/rebuild scripts retain the original source/tool hashes. Archive-aware checks compare an older PDF to its own embedded manifest rather than the evolving current chapters.

## Preparing a new edition

Run npm ci on a fresh checkout or after dependency changes, then npm run check. Regenerate the current library, inventories as needed, vector worked examples, notation and consolidated reference. Verify figure reproducibility with python scripts/build-graphical-examples.py --check and python scripts/build-notation.py --check. SVG, PNG, scene JSON and model-subject manifests must agree. Do not hand-edit generated books or parser output.

The versioned scripts/build-spec-pdf-2.0.py and scripts/check-spec-pdf-2.0.py identify edition 2.0.0, source/package revision, included source bytes, original diagrams, fonts and dependency identities. It must produce a PDF, per-source manifest and SHA-256 checksum under a new versioned filename. Preserve clickable contents/bookmarks/links, selectable code, readable tables and vector figures. Unsupported Markdown must fail rather than disappear.

Before release, render every page with Poppler or a verified PDF renderer and inspect all pages for clipping, overlap, tiny text, broken figures, orphan headings and excessive whitespace. Inspect dense tables and code at full resolution as well as contact sheets. Automated text/bounds checks supplement visual review. Commit synchronized source/book/PDF/manifest/checksum only after that review. No 2.0 release may reuse 1.x artifacts as if generated from current sources.

## GitHub Pages

The site is the existing showcase project. Build the validated source/trace data with node scripts/build-showcase-data.mjs, then npm run build --prefix showcase. Test all seven views, source selection, copy/download links, theme persistence, keyboard controls and narrow layouts. Show the concrete design before publishing, as explicitly requested by the owner. Local preview does not imply approval to deploy. GitHub Pages remains a manually dispatched workflow after approval; a source push alone must not publish it.

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
