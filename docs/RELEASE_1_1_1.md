# SWAML 1.1.1 graphical specification evidence

Specification edition 1.1.1 completes the canonical graphical notation catalog. It retains language 1.1 syntax, validation and reference execution semantics. The published v1.1.0 edition remains unchanged.

## Tracked scope

[Issue 22](https://github.com/voidaliot/swaml/issues/22) tracks the original concept drawings, graphical/textual notation tables, coverage inventory, semantic examples, export checks and full publication. The [SysML presentation review](SYSML_STYLE_REVIEW.md) identifies the official reference and the conventions adopted for the document. SWAML drawings and wording are independently authored; the catalog does not add unsupported SysML constructs.

The [canonical catalog](GRAPHICAL_CATALOG.md) specifies nodes, edges, compartments, labels and view projections. The catalog has 93 entries, each with SVG, PNG and vector-scene geometry. Each entry includes its context, textual example, required labels and constraints, plus downloadable SVG and PNG assets. Explicit coverage indexes account for every reserved keyword and grammar production, including text-only syntax with no independent glyph. The existing eight worked view illustrations show how symbols compose into larger diagrams.

## Verification

`npm run check` covers parser, validator, simulator, model and documentation regressions, plus the notation inventory and model contexts. `scripts/build-notation.py --check` verifies reproducible SVG/scene geometry and PNG export evidence. PDF checks cover exact source attachments and hashes, navigation, concept coverage and page bounds. Every exported diagram and every final PDF page undergoes visual review before release. The graphical asset ZIP includes per-file checksums and verifies its own contents after packaging.

The core regression baseline remains 212 passing tests and 11 expected simulation runs across nine main examples. The new notation examples exercise existing language constructs. Graphical documentation does not implement a graphical editor; the extension remains a separate project. KerML export and physical realtime scheduling retain their previously documented implementation boundaries.
