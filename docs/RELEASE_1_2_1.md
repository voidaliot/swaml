# SWAML 1.2.1 release notes

SWAML **1.2.1** makes subject-assignment relations consistent. Cases and satisfaction claims now use `of`, matching compact views. It also fixes terminology found during the grammar and specification audit.

## Source changes

| Construct | 1.2.1 fragment |
| --- | --- |
| Use case root | `useCase Start of App {}` |
| Verification case root | `verificationCase Check of App { verify Ready; }` |
| Satisfaction source | `satisfy Ready of App;` |
| Compact view | `view wiring iv of App;` |

The parser rejects the former case `for` and satisfaction `by` spellings. This is an intentional source migration from 1.2.0; [ADR 0010](decisions/0010-consistent-subject-relations.md) records the compatibility change. Apply the contextual edits in the [migration guide](MIGRATION_1_2.md). Hosts select the 1.2 family; pin the package revision as well when reproducing models.

`for` has no relation meaning. Current loops remain bounded `while`; this release adds no new loop construct. `on` retains activation/location meaning, `as` retains result binding, and value assignments retain `=`. Case root selection, design-to-requirement direction, ownership, route checks, queues and runtime behavior are unchanged.

## Audit fixes

- Describe requirements as immutable typed attributes and optional formal documentation, with separate satisfaction and verification intent.
- Describe case endpoints as root-owned or immediate-child ports, matching validation.
- Describe views as stable unions of occurrence paths, including block selections and pure filters.
- Correct obsolete candidate/preparation wording and distinguish the installed parser revision from the selected 1.2 family.
- Synchronize examples, keyword and notation inventories, diagrams, showcase excerpts and release downloads. Preserve the published 1.2.0 edition and its assets.

## Validation

The release gate includes **387 tests**, **16 complete models**, **18 reproducible simulation scenarios**, **125 current keywords**, **86 grammar productions** and **101 canonical graphical concepts**. Twelve new regressions check the corrected relations, imports, qualification, legacy spelling rejection, alias duplicates and malformed input. Source-backed showcase checks and figure reproducibility cover the rendered notation; the consolidated reference and PDF are rebuilt as a separate 1.2.1 edition.

The repository implements parsing, documented static checking and bounded reference simulation. Satisfaction and verification links express claims and intent; they are not verification results. The static React Flow showcase supports inspection and layout interactions with checked-in models.
