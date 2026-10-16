# SWAML 1.2.0 release notes

SWAML **1.2.0** simplifies architecture around recursive components, executable functions and function-local calculations. It adds requirements, formal documentation, two case kinds and composable view selections. Read the [migration guide](MIGRATION_1_2.md) before upgrading a 1.1 model.

## Release scope

| Concern | Result |
| --- | --- |
| Structure | Components may own children, private values and local behavior; inline roots follow the same ownership rules. |
| Behavior | Functions own statement flow or states; calculations have typed inputs and one named pure output. |
| Reuse | Single specialization, explicit compatible redefinition and distinct inherited stores for every instance. |
| Values | bool, byte, uint, int, real, string, result-only void, nominal records/enums and fixed arrays. |
| Deployment | Component-instance references to external system/part identities; hosts resolve and validate them. |
| Communication | Explicit typed routes and complete inline/named QoS policies with independent queues. |
| Requirements | Immutable typed attributes, one formal doc, design satisfy links and verificationCase verify links. |
| Views | Lower camel case keywords; include/recursive/where selections and typed Boolean filters. |
| Presentation | Flat notation, graphical ontology, end-to-end walkthrough, React Flow views and static Pages build. |
| Guidance | Quick start, UML transition guide, Classic/Adaptive/web/cloud patterns and a component reuse example. |

The [specialization model](../examples/15-component-specialization.swaml) exercises inherited functions, function replacement with lexical calculations, child specialization, root behavior, uint/byte values and external deployment references. The four [architecture examples](ARCHITECTURE_PATTERNS.md) retain their port routes and behavior under the simpler terminology.

## Evidence boundary

The language core supplies parsing, documented static validation and bounded logical-time simulation. The current simulator profile is `swaml-reference/1.2`; inputs identify manual functions explicitly. Use cases describe intended use; verification cases describe verification intent. satisfy and verify links do not establish a passed result.

The showcase presents checked-in models with selection, source inspection and layout interactions. It is suitable for a static GitHub Pages deployment. It does not implement arbitrary graphical source editing, a production runtime, a KerML exporter or automatic SysML integration.

## Validation

Release validation includes 375 tests, 16 complete models, 18 reproducible simulation scenarios, 127 keywords, 86 grammar productions and 101 canonical graphical concepts. It also checks the source-backed showcase, the diagram/table traceability demo and publication artifacts. See [PDF publication](PDF_PUBLICATION.md) for reproduction commands:

- Run the complete language gate, including positive/negative semantics, documentation fixtures, simulation, source mappings and presentation checks.
- Build the showcase and inspect its views, source excerpts, navigation and desktop/mobile layout.
- Regenerate the keyword reference, consolidated Markdown, figures and catalog; check reproducibility.
- Build/check the current PDF, manifest and checksum; render and inspect all pages.
- Publish the reviewed commit as v1.2.0 with the PDF, source manifest, checksum, consolidated Markdown and graphical asset bundle.

Historical editions and their recorded semantics remain preserved. Updated current links may point to renamed example files; archived PDFs retain the exact historical embedded source.
