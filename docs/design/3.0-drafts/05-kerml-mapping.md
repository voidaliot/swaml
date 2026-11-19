# 5. Proposed KerML mapping: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 5](../../spec/05-kerml-mapping.md) and `spec/kerml-mapping.json`. The mapping remains a proposed contract; no exporter exists. `scripts/check-docs.mjs` requires every grammar production to have exactly one mapping entry, so each package adds the entries for its productions in the same change.

| ID | Rule |
| --- | --- |
| WP1-M02 | Moved to [chapter 5.1](../../spec/05-kerml-mapping.md#51-representation) in WP1. |
| WP2-M02 | Moved to [chapter 5](../../spec/05-kerml-mapping.md) in WP2. |
| WP2-M03 | Moved to [chapter 5](../../spec/05-kerml-mapping.md) in WP2. |
| WP5-M02 | Moved to [chapter 5.1](../../spec/05-kerml-mapping.md#51-representation) and `spec/kerml-mapping.json` in WP5. |
| WP6-M02 | Moved to [chapter 5.1](../../spec/05-kerml-mapping.md#51-representation) in WP6. |
| WP6-M03 | Moved to [chapter 5.1](../../spec/05-kerml-mapping.md#51-representation) in WP6. |

Changed productions keep their mapping entry and update its semantic text in their package: `PolicySetting`, `Literal`, `Wait`, `Receive` and the duration positions of `ScheduleEntry` (WP4); `Assign`, `ReferenceExpression` and `CallExpression` (WP1, done); `Expression` and `ExpressionStatement` (WP2, done); `State` and `Transition` (WP5, done); `Connect` and `PortMember` (WP6); `ScheduleEntry` release guards (WP7, done). `Swaml::Os` is library content mapped like `Swaml::Platform` (WP8).
