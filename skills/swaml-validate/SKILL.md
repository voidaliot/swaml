---
name: swaml-validate
description: Validate, diagnose and exercise swa.ml 2.0 source using machine-readable diagnostics and bounded reference traces. Use for .swaml correctness or simulation requests; do not treat finite runs as production scheduling or universal verification.
---

# Validate and exercise swa.ml 2.0

Read [AI diagnostics guidance](https://github.com/voidaliot/swaml/blob/main/docs/AI_GUIDE.md), [execution semantics](https://github.com/voidaliot/swaml/blob/main/docs/spec/06-execution-contract.md) and [support status](https://github.com/voidaliot/swaml/blob/main/docs/IMPLEMENTATION_STATUS.md). The repository selects parser 2.0 and swaml-reference/2.0; pin the exact package revision for reproduction. Do not silently accept or convert 1.x source.

Build the parser/core, then run node out/src/cli/main.js --json over every application dependency together. Inspect errorCount and the stable diagnostic code, range, declaration and resolved occurrence metadata. Syntax recovery does not supply a valid model. Preserve nominal records/enums, explicit port routes, private scopes, single input ownership and whole-member redefinition when repairing errors. Recheck ambiguous/negative name lookups after workspace changes.

For an authorized implementation change, add meaningful positive/negative tests and malformed recovery cases, plus observable traces/final stores for changed runtime semantics. Run npm run check. Complete swaml documentation fences are executable fixtures. Regenerate inventories/references/diagrams through repository scripts; never hand-edit generated parser files or books. Preserve published historical artifacts.

For simulation, use a source-emitting driver through ordinary typed ports/routes. Create an explicit options JSON with untilNs and relevant finite resource/transport assumptions. Run node out/src/cli/simulate.js Package::Root options.json model.swaml dependencies.swaml. Inspect failure/caught/timeout/lateReply/overflow/discard/interrupt/violation observations and final occurrence stores. Repeat a deterministic run only when it tests reproducibility or a changed assumption.

Separate expression failures caught by try from uncaught interruption/deadline/resource violations. Check committed effects, success-only out copy-back, suspension unlock/live reads versus concurrent snapshots, request terminal immutability and success-only fresh after activations. Keep timing declared/observed evidence distinct and live intervals open at the horizon. Report actual outcomes and limits; source acceptance, case links and a passing finite run do not prove scheduling, race freedom, requirement fulfillment, kernel export or complete graphical editability.

Locate a host pinned to parser 2.0 before running commands. A configured swaml CLI accepts --language-version 2.0 --json. Otherwise use the companion source checkout identified by the user/project, build it there, and run its out/src/cli/main.js or simulate.js with absolute model/dependency paths. Do not assume the model workspace contains the language implementation, install global tools without authorization or silently use an older host.
