# SysML-style specification review

The review used the official **OMG SysML 2.0, Part 1: Language Specification**, document formal/2026-03-02, March 2026. Section 7 presents representative element/graphical/textual notation tables; section 8.2.3 defines graphical notation in more detail. These serve complementary reading purposes. [Official language PDF](https://www.omg.org/spec/SysML/2.0/Language/PDF).

| Reviewed clause | Presentation concern | SWAML treatment |
| --- | --- | --- |
| 8.2.3.5 | Namespaces and packages | namespace frame and explicit import reference |
| 8.2.3.6 | Definition and usage | mandatory def distinction and occurrence typing |
| 8.2.3.12–14 | Ports, connections, interfaces | boundary squares, nominal contracts, explicit routes |
| 8.2.3.17 | Actions | owned function flow only |
| 8.2.3.18 | States | flat states directly owned by a function |
| 8.2.3.21 | Requirements | prose obligations and claimed coverage |
| 8.2.3.26 | Views and viewpoints | existing SWAML view families |

Visual inspection included printed pages 20, 199, 210 and 232. It confirmed the separation of representative tables from graphical productions and the use of explicit headers and compartments. This is a review of organization, not evidence of language compatibility.

SWAML's [normative notation](GRAPHICAL_NOTATION.md) and [canonical catalog](GRAPHICAL_CATALOG.md) are original designs. Their coverage includes every grammar production and keyword, while distinguishing glyphs, compartments, labels and text-only syntax. Each concept has reproducible SVG/PNG examples and contextual constraints. No OMG figure or text is copied into those assets. SWAML does not add performers, free actions/events, hierarchical states or other unsupported constructs to resemble another language's diagrams.
