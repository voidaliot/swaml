# ADR 0005 — Canonical graphical notation catalog

Status: accepted for notation edition 1.1.1; language version 1.1 unchanged. Date: 2026-10-14.

The graphical contract previously defined the seven view families and supplied eight worked illustrations. A complete language specification also needs concept-level reference notation: an author or implementer must be able to find how any supported declaration, relationship, behavior or property is drawn and how it relates to source.

## Decision

Use an original concept catalog organized by concern, with element/graphical/textual notation tables and an alphabetical term index. A machine-readable inventory explicitly covers every grammar production and keyword. Each concept has canonical SVG, PNG and scene artifacts, context, rules and an accessible description.

Distinguish semantic nodes and edges from compartments, labels, projections and text-only source contributions. A duration unit or policy value does not require a new independent glyph. All canonical drawings use monochrome line art with explicit names and labels. Reproduction checks compare SVG/scene content and decoded PNG pixels.

The normative chapter defines construction, direction, ownership, identity, editing and accessibility requirements; the inventory and catalog specialize those rules into concrete examples. Worked architectures remain available separately. Future graphical hosts must preserve one semantic model with source, rather than treating the image catalog as an alternate executable representation.

## Consequences

The notation edition is a publication refinement. It changes no language grammar, model semantics, parser version or simulation profile. Historical 1.1.0 artifacts remain available. SysML's specification organization informs the presentation, while SWAML drawings, text and software-specific constraints remain independently authored. No graphical conformance or shipped-editor claim follows from producing these static assets.
