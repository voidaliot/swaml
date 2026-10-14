# PDF specification and release publication

The [complete PDF](../output/pdf/SWAML-1.1.0-Specification.pdf) contains the normative chapters, notation, grammar, mapping inventory, nine models and project guidance. It includes clickable contents, bookmarks, links, vector figures, selectable numbered code, repeated table headings and embedded sources.

## Version identifiers

This edition is specification/package **1.1.0**, with a pinned **1.1** parser and headerless source. The full [Markdown reference](SWAML-1.1.0-Reference.md) and PDF are generated from maintained chapters. The PDF additionally includes project guidance, a complete mapping inventory and embedded source/figure files. Keyword navigation covers every current reserved word; the concern guide is alphabetical.

The v1.0.0 tagged Markdown/PDF edition is preserved unchanged; its source header and keyword inventory belong to the historical grammar. Current publication checks target 1.1 sources.

Historical v0.1.0 packages draft/core revision 0.1.1 with header 0.1; its assets remain unchanged. Version 1.1 provides logical-time simulation; physical timing proof, KerML export and graphical editing remain separate implementations.

## Rebuild the book

Use Python 3.10+ and DejaVu fonts (`fonts-dejavu-core` on Debian/Ubuntu). Elsewhere, supply DejaVu Sans regular/bold/oblique/bold-oblique and Sans Mono TTF files with `--font-dir`.

```sh
python3 -m venv .venv-pdf
. .venv-pdf/bin/activate
python3 -m pip install -r scripts/pdf-requirements.txt
python3 scripts/build-spec-pdf.py --font-dir /usr/share/fonts/truetype/dejavu
python3 scripts/check-spec-pdf.py
```

First run `python3 scripts/build-graphical-examples.py` and `npm run docs:build` after changing source chapters or figures. The explicit source list is built directly; unsupported Markdown fails the build. Mermaid illustrations become vector figures. The eight examples share SVG/vector-scene sources across Markdown/PDF. Keyword links jump to individual entries. Every grammar line is preserved; wrapped continuations have no new line number. Attachments preserve exact source bytes.

Outputs are the PDF, a JSON source/hash manifest and a SHA-256 checksum under `output/pdf/`. The checksum identifies the generated artifact; PDF metadata may vary between builds. The manifest allows readers to verify exactly which source content an edition contains.

## Quality and release gate

Run `npm run check`, build the PDF, and run the PDF checker. Render all pages with Poppler and inspect them for clipped text, overlapping elements, unreadable tables, broken figures, orphan headings and excessive blank pages. Check dense tables and code at full resolution as well as page contact sheets. Automated extraction cannot replace that visual review.

Commit the reviewed source, builder and final artifacts together. The release must target the reviewed commit, with the PDF, source manifest and checksum attached. Use `--notes-file` for release notes and verify the published tag and assets after upload. Preserve release assets once published; issue a new documented edition for corrections.
