# Publication and historical editions

Current development is the unpublished SWAML 2.0.0 candidate, parser 2.0 and profile swaml-reference/2.0. The generated [2.0 Markdown reference](SWAML-2.0.0-Reference.md) is a development artifact. There is no published 2.0 PDF or release yet. No compatibility parser or new migration guide is part of this restart.

Preserve every published 1.x Markdown/PDF, source manifest, checksum and historical figure file. Their embedded sources retain their own grammar and provenance. The pinned 1.3.1 builder refuses a different workspace edition; do not relabel current development as an archived release. [The tooling pin](../scripts/publication-tooling-1.3.1.json) and archive/rebuild scripts retain the original source/tool hashes. Archive-aware checks compare an older PDF to its own embedded manifest rather than the evolving current chapters.

## Preparing a new edition

Run npm ci on a fresh checkout or after dependency changes, then npm run check. Regenerate the current library, inventories as needed, vector worked examples, notation and consolidated reference. Verify figure reproducibility with python scripts/build-graphical-examples.py --check and python scripts/build-notation.py --check. SVG, PNG, scene JSON and model-subject manifests must agree. Do not hand-edit generated books or parser output.

A new PDF builder must identify edition 2.0.0, source/package revision, included source bytes, original diagrams, fonts and dependency identities. It must produce a PDF, per-source manifest and SHA-256 checksum under a new versioned filename. Preserve clickable contents/bookmarks/links, selectable code, readable tables and vector figures. Unsupported Markdown must fail rather than disappear.

Before release, render every page with Poppler or a verified PDF renderer and inspect all pages for clipping, overlap, tiny text, broken figures, orphan headings and excessive whitespace. Inspect dense tables and code at full resolution as well as contact sheets. Automated text/bounds checks supplement visual review. Commit synchronized source/book/PDF/manifest/checksum only after that review. No 2.0 release may reuse 1.x artifacts as if generated from current sources.

## GitHub Pages

The site is the existing showcase project. Build the validated source/trace data with node scripts/build-showcase-data.mjs, then npm run build --prefix showcase. Test all seven views, source selection, copy/download links, theme persistence, keyboard controls and narrow layouts. Show the concrete design before publishing, as explicitly requested by the owner. Local preview does not imply approval to deploy. GitHub Pages remains a manually dispatched workflow after approval; a source push alone must not publish it.

## Archived checks

The original scripts/test-publication-archive.py, scripts/check-spec-pdf.py and scripts/rebuild-archived-pdf.py retain historical responsibilities. They do not assert a 2.0 PDF exists or validate the new language. Their source pin and archived assets must remain unchanged unless a separately reviewed historical correction is explicitly requested.
