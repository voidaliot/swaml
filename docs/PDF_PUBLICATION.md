# PDF specification and release publication

The [complete PDF](../output/pdf/SWAML-0.1.0-Specification.pdf) assembles the normative chapters, graphical notation, complete grammar, semantic inventory, all eight valid models, user guide, architecture comparison, implementation status, decisions and contributor/agent guidance. It has a clickable contents page, section bookmarks, internal and external links, vector figures, selectable numbered code, repeated table headings and embedded original source files.

## Version identifiers

The first GitHub release is **0.1.0**, tagged `v0.1.0`. It packages the reviewed **0.1.1 specification/reference-core revision** from the initial draft iterations. The source-language header is **0.1**. The release notes and PDF cover state all three identifiers; the existing draft history is preserved.

The language specification remains a draft. A GitHub release does not add runtime, KerML exporter, graphical editor, AUTOSAR conformance or certification claims.

## Rebuild the book

Use Python 3.10+ and DejaVu fonts. On Debian/Ubuntu, install `fonts-dejavu-core`; on other systems, point the builder at a directory containing the DejaVu Sans regular/bold/oblique/bold-oblique and DejaVu Sans Mono TTF files.

```sh
python3 -m venv .venv-pdf
. .venv-pdf/bin/activate
python3 -m pip install -r scripts/pdf-requirements.txt
python3 scripts/build-spec-pdf.py --font-dir /usr/share/fonts/truetype/dejavu
python3 scripts/check-spec-pdf.py
```

The builder reads the repository's source documents directly. Its source list is explicit; unsupported Markdown constructs fail the build instead of disappearing. Mermaid illustrations in the graphical chapter are rendered as corresponding vector figures. The code appendix preserves every grammar line; wrapped continuation rows have no new line number. Exact original bytes remain accessible through embedded attachments.

Outputs are the PDF, a JSON source/hash manifest and a SHA-256 checksum under `output/pdf/`. The checksum identifies the generated artifact; PDF metadata may vary between builds. The manifest allows readers to verify exactly which source content an edition contains.

## Quality and release gate

Run `npm run check`, build the PDF, and run the PDF checker. Render all pages with Poppler and inspect them for clipped text, overlapping elements, unreadable tables, broken figures, orphan headings and excessive blank pages. Check dense tables and code at full resolution as well as page contact sheets. Automated extraction cannot replace that visual review.

Commit the reviewed source, builder and final artifacts together. The release must target the reviewed commit, with the PDF, source manifest and checksum attached. Use `--notes-file` for release notes and verify the published tag and assets after upload. Preserve release assets once published; issue a new documented edition for corrections.
