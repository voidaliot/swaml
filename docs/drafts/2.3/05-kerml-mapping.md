# 5. Proposed KerML mapping: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 5](../../spec/05-kerml-mapping.md) and `spec/kerml-mapping.json`. The mapping remains a proposed contract; no exporter exists. `scripts/check-docs.mjs` requires every grammar production to have exactly one mapping entry, so each package adds the entries for its productions in the same change.

| ID | Rule |
| --- | --- |
| WP1-M02 | Moved to [chapter 5.1](../../spec/05-kerml-mapping.md#51-representation) in WP1. |
| WP2-M02 | `ConditionalExpression`: kind `value`, kernel `ControlFunctions::'if'`, normative `docs/spec/01-structure-and-types.md`. |
| WP2-M03 | `Association` keeps its entry. Its semantic text states that a list statement lowers to one reference per occurrence–case pair. |
| WP5-M02 | `Deferral`: kind `lowering`, normative `docs/spec/03-behavior.md`. It lowers to a state-scoped retention constraint on the machine's input projection. Completion and internal transitions keep the `Transition` entry with updated semantic text: a completion transition is a guard-only `TransitionUsage` without trigger, and an internal transition has no target change. |
| WP6-M02 | `MemberPolicy`: kind `reference`, normative `docs/spec/02-communication.md`. It references the effective policy of one member route of the owning connector. |
| WP6-M03 | `PortMember` with an initial value maps the initial value as the feature's default value. Sampled reads lower to a read of a per-port-occurrence sample feature. They are not a transfer step. |

Changed productions keep their mapping entry and update its semantic text in their package: `PolicySetting`, `Literal`, `Wait`, `Receive` and the duration positions of `ScheduleEntry` (WP4); `Assign`, `ReferenceExpression` and `CallExpression` (WP1, done); `Expression` and `ExpressionStatement` (WP2); `State` and `Transition` (WP5); `Connect` and `PortMember` (WP6); `ScheduleEntry` release guards (WP7). `Swaml::Os` is library content mapped like `Swaml::Platform` (WP8).
