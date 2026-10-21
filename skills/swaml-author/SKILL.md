---
name: swaml-author
description: Create or edit SWAML 2.0 architecture source with typed components, operations, directed ports, schedules and source-backed views. Use for .swaml modeling requests, not generic software diagrams or historical SWAML syntax.
---

# Author SWAML 2.0

Read [the usage guide](https://github.com/voidaliot/swaml/blob/main/docs/USER_GUIDE.md) and [AI guide](https://github.com/voidaliot/swaml/blob/main/docs/AI_GUIDE.md), then the relevant normative chapter linked from [the specification](https://github.com/voidaliot/swaml/blob/main/docs/LANGUAGE_SPECIFICATION.md). Prefer those documents from the configured 2.0 source checkout when available; resolve their paths from that checkout root. Online main must identify edition 2.0 before using it as guidance. Check [implemented support](https://github.com/voidaliot/swaml/blob/main/docs/IMPLEMENTATION_STATUS.md) before making evidence claims.

Use one component family and one operation family. A def supplies a reusable structure/signature/body; a usage creates a distinct occurrence. Type every attribute, local, parameter and result explicitly. Place operations, attributes and child usages in their owning component. Put nested operations first and pass enclosing values explicitly; they never capture enclosing locals/parameters. Use explicit redefines for compatible whole inherited members. Keep each multiplicity occurrence's private state separate.

For every cross-component exchange, declare owned provides/requires port members and an explicit connect route. Reversed flips all member directions. Use send for provided attributes, publish for provided events and expressions for required operation calls. Bind each input once in a schedule, state transition set, receive statement or interrupt region. Forwarded boundaries have no local owner, queue or policy. Bare connections use the pinned Default; choose complete named policies when needed. Never widen scopes or add hidden communication to make a model validate.

Activation belongs in one component schedule. Operations use parentheses and optional returns; usages use a colon and inherit their signature. A void call is a statement and a non-void result is used. Suspended calls are whole initializers, assignment values or statements, optionally in try. Suspension unlocks serial state; recheck live attributes after resumption. Concurrent entries cannot write through any callee/out argument and retain dispatch snapshots. After chains release fresh parameterless void flow only after successful whole completion.

Use indexed literal multiplicity paths. Deployment is separate and targets platform Node occurrences. Cases/requirements record intent; a view selects existing identities. Use the seven Swaml::Views definitions and keep geometry outside semantic source. For stimuli, author ordinary source emitters and routes; never inject a destination event or release a simulator function directly.

Validate the complete model workspace with node out/src/cli/main.js --json file.swaml dependencies.swaml after npm run build. Fix syntax/names, ownership/routes, types/effects and schedule errors in that order when dependencies require it. Revalidate after each meaningful repair. Format with --format and revalidate. Add bounded simulation evidence only for validated source; report root/profile/options, relevant observations and final stores. Read the support matrix before claiming execution/graphical/kernel conformance. Keep publication within the user's explicit authorization.

Locate a host pinned to parser 2.0 before running commands. A configured swaml CLI accepts --language-version 2.0 --json. Otherwise use the companion source checkout identified by the user/project, build it there, and run its out/src/cli/main.js or simulate.js with absolute model/dependency paths. Do not assume the model workspace contains the language implementation, install global tools without authorization or silently use an older host.
