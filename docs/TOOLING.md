# Tool integration

swa.ml 3.0.

The language core is portable TypeScript over Langium 4.4.0 and the normative grammar. Node CLI/server adapters own file access and source hashing. Build with npm run build; validate with node out/src/cli/main.js --json and explicitly load all application dependencies. The host selects parser 3.0; unsupported edition flags are errors.

JSON diagnostics expose stable SW2xxx codes, range, URI and identity metadata. --format applies canonical token-preserving whitespace, printing places and selectors without spaces inside the path, as in statuses[i].confirmed = true; (WP1-M03), conditionals with every parenthesis of the source, as in x = 1 + (if (c) 2 else 3) + 4;, and association lists on one line when they fit in 100 characters, otherwise with one occurrence or case per continuation line; a list that contains a comment is not wrapped (WP2-M05); --check-format checks it without writing. It prints computed durations in parentheses, as in wait (n * 1ms); and on every (periodMs * 1ms) poll() deadline (periodMs * 1ms / 2);, and literal durations without them, as in wait 5ms; (WP4-M08). It prints one state item per line in source order and keeps a body written without braces short, as in after 250ms exit; and if (wanted) exit;, and a braced body braced. It prints a release guard between the operation call and `deadline`, as in on every 20ms slot() if (mode.current != PowerMode.sleep) deadline 2ms; (WP7-M03). It keeps else if on one line, with any comment between else and if, as in } else if (b) { (SIF-G01). The LSP exposes full-document formatting. Source repairs must be validated against the complete workspace before application.

node scripts/mutations-wp8.mjs [M1,X7,...] applies the WP8 mutations (the author's M1 to M26, the review's X1 to X17 and the review fixes) one at a time to the build output, runs the WP8 unit tests, the example cases and the extended 2.2 sets, and prints which mutations each kills. It edits out/ in place: run it only after npm run build and never beside other work on the same build. It is not part of npm run check.

swaml binding check [--language-version 3.0] [--json] binding.json file.swaml [more files...] validates a target binding (schema swaml-binding/1, spec/binding.schema.json, versioned independently of the language edition; a root "$schema" string for editors is allowed; WP8-M02, WP8-M03) and resolves its identities against the validated sources: the deployment by its canonical qualified identity (DoorEcu::'Front left door'), operations as occurrence path plus operation name from the deployed root (dcu.comMain.rxMainFunction), Tasks as Swaml::Os Task occurrence paths of the platform (vehicle.doorModules[0].core1.task20ms) and connections as route identities (owner.name, owner.@connectN counting every connect member, name or @packageN for package connections). Identities use canonical spelling (a quoted name keeps its quotes, app.'my link'), while traces record decoded names, so a route id with a quoted name differs from its binding identity by the quotes. It prints one line per finding, error|finding {JSON Pointer} {identity}: {reason}. (the root pointer is printed "", as in --json), then a summary; --json prints schema, deployment, errorCount, findingCount, modelErrors and findings. Exit 0: every identity resolves (placed operations without a cost are findings and do not fail). Exit 1: a schema error (an unknown or missing property, a wrong type or range, another schema version), an unresolved or duplicate identity, bcetNs > wcetNs, a file that is not JSON, or sources with errors. Exit 2: a usage error or a file that cannot be read. It computes no schedule; a resolved binding is not schedulability evidence (WP8-M05).

The simulator requires validated models and records swaml-reference/3.0, sources, options, trace, final stores and deployment. Source digests are added by the CLI. Its finite logical run does not supply production timing or universal verification.


## Migrating 2.2 state machines

swa.ml 3.0 replaces the state machines of 2.2 by states that are steps of the flow ([chapter 3.6](spec/03-behavior.md#36-states)). A 2.2 source with a machine (`initial S;`, `final state`, ordered transitions such as `on receive p.m(x) when (g) to T { … }`) does not parse in 3.0. The validator reports it once, at the machine, as SW2000 `This is swa.ml 2.2 state-machine syntax (initial S;, final state, ordered transitions with when and to T { … }), which 3.0 replaces by states that are steps of the flow; swaml migrate <file> rewrites it.`, instead of the parser's first error. The migration guide `docs/MIGRATION_3_0.md` explains the changes; this section documents the command.

```sh
swaml migrate [--write] file.swaml|directory [more files or directories...]
```

- **Dry run by default.** For each file that changes, it prints the machines it rewrites (`line:column Package::Component.operation: N state(s)`), what it removed or changed (transitions and timers that 2.2 never took, renamed bindings, exit actions copied into leaving blocks, notes) and the changed lines, old (`-`) then new (`+`). Nothing is written. `--write` writes the files.
- **Directories.** A directory is walked recursively for `.swaml` files in name order; `node_modules`, `out` and hidden directories are skipped. A file named twice is migrated once.
- **Release guards.** A release guard written `when (g)` after the operation call of a schedule entry, as in drafts of 3.0, is rewritten to `if (g)`.
- **Validation.** Every migrated text is validated with the 3.0 language as one workspace together with the other files given, unchanged ones included, so give every file a model needs. Nothing is written for any file unless every file migrates or has nothing to migrate and every migrated file validates.
- **The rewrite** (the recipe of the [proposal](proposals/STATES_IN_FLOW_PROPOSAL.md), section 7.1): the initial state comes first and final states last; each 2.2 timer becomes a line `after D { … }` and the transitions on one member one line `on receive p.m(x) { … }` whose block is an `if`/`else if` chain in their 2.2 order; a leave to the state written next is `exit;`, any other `to T;`, and a body that is only the leave is written short; a final state becomes a state at the end of the flow, so the operation completes when it is reached. No parents are introduced. Unhandled input needs nothing: 2.2 dropped it while a machine waited, and so does 3.0. The migrated text gives the 2.2 results apart from two accepted differences: queued input is looked at in delivery order, and an `if` test in a migrated block is no scheduling step (compatibility gates B and C of the [release notes](RELEASE_3_0.md#compatibility-gates)).

A dry run over a directory with the 2.2 [state example](../examples/04-stateful-function.swaml) prints:

```text
mig/04-stateful-function.swaml: 1 state machine(s)
  6:7 States::Demo.lamp: 3 state(s)
    @@ line 6 @@
    -      initial Off;
    -      state Off {
    -        after 2ms to On {
    -        }
    -      }
    …
    +      state Off {
    +        after 2ms exit;
    +      }
    …
Dry run: 1 file(s) would change, 0 file(s) have nothing to migrate; nothing written (run again with --write).
```

A file that cannot be migrated is reported as `file:line:column refused: reason` (or, after validation, `file: the migrated text does not validate, nothing written` with the errors), and nothing is written:

- a file that parses neither as 3.0 nor as 2.2, such as one that mixes 3.0 syntax with a 2.2 machine, refused at its first syntax error; a file that parses only as 2.2 but has no machine to migrate;
- the forms of the unreleased 3.0 drafts (completion transitions, internal transitions, guarded timers and `defer`), each refused with how to write it by hand;
- a machine the recipe cannot rewrite: a state that is not final and has no transitions, a final initial state, a binding rename that would capture a name, a binding written before `.` (a port or field named like it), or an end of the flow that would not match the reachability of a final state;
- a migrated text that does not validate. The known case is about 2% of generated 2.2 machines (8 of 387 in the verification review): removing a transition that 2.2 never took deletes the only `publish` of a member, which then has no emitting operation. Rewrite such a machine by hand.

Exit codes: 0 when every file migrates or has nothing to migrate (a dry run included); 1 when a file is refused or a migrated file has errors; 2 on a usage error (an unknown option or no path) or a file or directory that cannot be read. The repository's compatibility gates use the same migration through `scripts/migrate-machines.mjs`, which also returns the identity map from new statement identities to 2.2 ones for traces.

## Editors

The adjacent editor repository has separate acceptance, diagram, refactoring and packaging gates. Paths with multiplicity, port members, schedules, nested operations, deployments, cases and views need semantic path-aware navigation/rename; generic Langium references alone are insufficient. Preserve occurrence identity and validated source transactions, with geometry in sidecars. See [implementation status](IMPLEMENTATION_STATUS.md) for the current evidence boundary.
