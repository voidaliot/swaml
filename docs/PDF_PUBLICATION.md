# PDF specification and release publication

The [complete PDF](../output/pdf/SWAML-1.3.1-Specification.pdf) contains the normative chapters, flat notation, grammar, mapping inventory, complete example models, the notation fixture and project guidance. It includes clickable contents, bookmarks, links, vector figures, selectable numbered code, repeated table headings and embedded sources. This edition also includes the [ontology and view guide](ONTOLOGY_AND_VIEWS.md), [migration notes](MIGRATION_1_3_1.md), [release notes](RELEASE_1_3_1.md) and [control-flow and timing decision](decisions/0011-loops-interrupts-and-function-timing.md).

## Version identifiers

This edition is specification/package **1.3.1**, with a pinned **1.3** parser and headerless source. The full [Markdown reference](SWAML-1.3.1-Reference.md) and PDF are generated from maintained chapters. The PDF additionally includes project guidance, a complete mapping inventory and embedded source/figure files. Keyword navigation covers every current reserved word; the concern guide is alphabetical.

The v1.0.0, v1.1.0 and v1.1.1 Markdown/PDF editions retain their historical syntax, semantics and inventories. The copies distributed in this repository received an editorial correction on 2026-10-16 to make tooling guidance platform-neutral and describe views directly. Their regenerated manifests identify that correction and the previous PDF digest; source attachments match each corrected historical edition. Existing Git tags and remotely published release assets are unchanged. Current publication checks target 1.3 sources and write new artifacts under a versioned filename.

Historical v0.1.0 packages draft/core revision 0.1.1 with header 0.1 and has the same editorial correction to its guidance. The current reference simulation profile is **1.3**: unified components, executable functions, pure calculations and effective inherited members are interpreted with separate instance stores. Historical embedded traces retain their original profile identity. Physical timing proof, KerML export and a source-editing graphical workbench remain separate implementations.

The published v1.2.0, v1.2.1, v1.3.0 and v1.3.1 consolidated Markdown, PDF, manifest, checksum and release assets are preserved. The current workspace is **unpublished 1.4 development**. Its separate development Markdown reference does not publish a 1.4 PDF. The 1.3.1 builder refuses to build from a different workspace revision, preventing development chapters from being mislabeled as an existing edition. See the [timing and structure view decision](decisions/0012-timing-view-and-structure-layouts.md) and [1.4 migration](MIGRATION_1_4.md).

## Rebuild the book

Use Python 3.10+ and the pinned dependencies below. Install DejaVu fonts (`fonts-dejavu-core` on Debian/Ubuntu), or supply a directory containing DejaVu Sans regular/bold/oblique/bold-oblique and Sans Mono TTF files with `--font-dir` or `SWAML_PDF_FONT_DIR`. The two regular/bold fonts in `resources/fonts` pin notation rendering; a full PDF build additionally requires the oblique and monospace faces. All source and scene files are read as UTF-8 on every platform.

```sh
python3 -m venv .venv-pdf
. .venv-pdf/bin/activate
python3 -m pip install -r scripts/pdf-requirements.txt
python3 scripts/check-spec-pdf.py
git fetch --no-tags --depth=1 origin 7e3cc2df00292127fdee20aa078100f520a8a16e
python3 scripts/rebuild-archived-pdf.py --output tmp/pdfs/rebuilt.pdf --font-dir /usr/share/fonts/truetype/dejavu
python3 scripts/check-spec-pdf.py --pdf tmp/pdfs/rebuilt.pdf
```

On Windows, activate `.venv-pdf\Scripts\Activate.ps1` in PowerShell. If the supplied Python runtime cannot create a virtual environment, install into a repository-local target and set `PYTHONPATH` for the build:

```powershell
New-Item -ItemType Directory -Force .venv-pdf/tmp | Out-Null
$env:TEMP = (Resolve-Path .venv-pdf/tmp).Path
$env:TMP = $env:TEMP
python -m pip install --no-cache-dir --target .venv-pdf/packages -r scripts/pdf-requirements.txt
$env:PYTHONPATH = (Resolve-Path .venv-pdf/packages).Path
python scripts/check-spec-pdf.py
python scripts/rebuild-archived-pdf.py --output tmp/pdfs/rebuilt.pdf --font-dir path/to/dejavu/ttf
```

The archive checker verifies every attachment against that PDF's own manifest and uses its embedded keyword/notation inventories. When the workspace version equals the PDF revision, all maintained source bytes must also match. For an older edition, maintained chapters may evolve, while its versioned complete Markdown reference remains immutable.

The archive did not embed its builder or font binaries. The separate [tooling pin](../scripts/publication-tooling-1.3.1.json) records the trusted original Git revision and builder/helper/requirements/font hashes. Rebuilding verifies every embedded source against that revision, extracts those sources and original tooling into a fresh ignored directory, and executes that original builder. It never imports the evolving workspace helper or replaces the published PDF. The two regular/bold font files are recovered from the pinned revision; oblique and monospace faces come from the explicitly supplied font directory, as in the original build. All font and dependency identities are recorded in the rebuild report. Fonts remain external dependencies, not claimed PDF attachments.

Rebuild verification requires identical archived source bytes and normalized per-page text/page count. PDF byte identity is not required because build metadata may vary. The checker also validates links, bookmarks and page bounds. These automated checks do not replace visual publication review.

For a deliberately prepared **new** edition, first version its builder and run `python3 scripts/build-graphical-examples.py`, `python3 scripts/build-notation.py`, `node scripts/build-traceability-demo.mjs` and `npm run docs:build`. The explicit source list is built directly; unsupported Markdown fails the build. Mermaid illustrations become vector figures. Canonical PNGs are exported from the same geometry with Pillow and the pinned DejaVu Sans files in `resources/fonts` (with their separate license); check exports with `scripts/build-notation.py --check`. Poppler is used for final PDF visual inspection. Keyword links jump to individual entries. Every grammar line is preserved; wrapped continuations have no new line number. Attachments preserve exact source bytes.

The graphical ontology and modeling walkthrough use `spec/modeling-overview.json` for both the website and static diagrams. Regenerate their SVG/vector scenes with `python3 scripts/build-modeling-overview.py`, and verify reproducibility with its `--check` option. The PDF includes the overview guide, diagram inventory and exact scene/SVG attachments.

Outputs are the PDF, a JSON source/hash manifest and a SHA-256 checksum under `output/pdf/`. The checksum identifies the generated artifact; PDF metadata may vary between builds. The manifest allows readers to verify exactly which source content an edition contains.

## Quality and release gate

Run `npm run check`, build the PDF, and run the PDF checker. Render all pages with Poppler and inspect them for clipped text, overlapping elements, unreadable tables, broken figures, orphan headings and excessive blank pages. Check dense tables and code at full resolution as well as page contact sheets. Automated extraction cannot replace that visual review.

Create the downloadable SVG/PNG bundle with `python3 scripts/package-notation.py --output /tmp/SWAML-1.3.1-Graphical-Assets.zip`. It contains all canonical and worked assets, the notation inventory, license and per-file checksums.

Commit the reviewed source, builder and final artifacts together. The release must target the reviewed commit, with the PDF, source manifest and checksum attached. Use `--notes-file` for release notes and verify the published tag and assets after upload. Preserve release assets once published; issue a new documented edition for corrections.
