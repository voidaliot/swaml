# Migrating to SWAML 1.2

The 1.2 language uses **components → functions → statements or states**, with **calculations** for pure expressions. This is a deliberate syntax change from 1.1 and earlier unpublished 1.2 drafts. Historical publications remain unchanged. [ADR 0007](decisions/0007-component-functions-and-calculations.md) records the ownership, reuse and integration decisions.

## Migrate 1.2.0 to 1.2.1

Version 1.2.1 intentionally corrects subject-assignment syntax at the owner's request. Replace case `for` and satisfaction `by` with `of`. Compact views already use `of`. These contextual edits preserve root selection, satisfaction direction, case traces and execution behavior. Do not replace ordinary prose, string contents, `on` triggers/deployment destinations or `as` result bindings.

| 1.2.0 fragment | 1.2.1 fragment |
| --- | --- |
| `useCase Start for App {}` | `useCase Start of App {}` |
| `verificationCase Check for App { verify Ready; }` | `verificationCase Check of App { verify Ready; }` |
| `satisfy Ready by App;` | `satisfy Ready of App;` |

The current parser rejects the old relation spellings. Hosts select the 1.2 family; the installed package revision determines this concrete grammar. Pin the package/release as well as the family when reproducing an older model. `for` has no relation meaning in 1.2.1; bounded `while (...) bound n` remains the supported loop syntax. See [ADR 0010](decisions/0010-consistent-subject-relations.md).

## Convert the model

| Earlier source | Current 1.2 source | Meaning |
| --- | --- | --- |
| `unit def Worker` | `component def Worker` | One software boundary may own both behavior and children. |
| `unit worker: Worker;` | `component worker: Worker;` | Each instance retains distinct private state. |
| `operation handle(...)` | `function handle(...)` | Apply to executable bodies and interface signatures. |
| `function twice(x: real): real = x * 2.0;` | `calc twice { in x: real; return result: real = x * 2.0; }` | Move each calculation into its owning function. Calls remain `twice(x)`. |
| `node ecu mcu; deploy controller on ecu;` | `deploy controller on "sysml:Vehicle::ecu";` | Resolve the external system/part identity in the host binding. |
| Manual input key `operation` | Manual input key `function` | Use reference simulation profile `swaml-reference/1.2`. |
| Component-owned `calc` | Declare it first inside each owning function | Calculations are function-local, including states and guards. Reuse across functions through a value-returning function. |
| `invoke helper();` | `call helper();` | A local void call. Use `as result` for a non-void return. |
| `request api.read() as value within …` | `call api.read() as value within …` | Keep the explicit route, timeout and failure branch. Case RPC steps also use `call`. |
| `let value: int = 0;` | `var value: int = 0;` | The enclosing block determines local storage. |

These are contextual fragments. Preserve each function's body, trigger, route, timeout and timing when renaming it. Convert old pure functions before renaming operations so effectful and pure behavior remain distinct. Obsolete spellings are rejected; the parser does not silently reinterpret them.

Components that previously only grouped child units can remain as meaningful boundaries. Both composite and leaf components can now own private state and functions. Functions own calculations. A parent function communicates with a child through a connector between an owned port and an immediate child port; private child access remains invalid. Remove a wrapper only after deliberately updating its paths, ports, delegation, cases, views and deployment references.

## Reuse a component type

`component def Tuned specializes Controller { … }` inherits one base. Prefix compatible inherited-member replacements with `redefines`; adding a distinct new member needs no prefix. Inherited-name collisions without the prefix are errors. Specialization and effective containment are acyclic, and every instance has its own inherited values and function state. The [specialization example](../examples/15-component-specialization.swaml) demonstrates the complete source form.

A typed root remains an instance with a deployment-only binding body. Use a specialized definition when changing reusable behavior or topology, then instantiate it. An inline root can own its own functions and variables as well as children. Deploying the root name establishes the default destination for its entire subtree.

## Keep data and communication explicit

bool, int, real, string, result-only void, records, enums and fixed arrays remain. uint adds nonnegative safe integers; byte adds values 0 through 255. Integral assignments into these narrower domains are checked. Scalar numeric widening preserves values; payloads remain copied values.

Named complete policies reduce repetition without merging queues:

```text
qos def LocalLink {
    delivery atMostOnce; ordering fifo; capacity 8; overflow reject;
}
connect frontLink: front.setting -> settings.api qos LocalLink;
connect rearLink: rear.setting -> settings.api qos LocalLink;
```

Every policy is complete, and every effective connector use is validated for its interface and timing obligations. Selecting the same policy never shares queues, correlations or private state. See the complete [policy model](../examples/10-reusable-qos.swaml).

## Update hosts and check fixtures

Pin the parser to language **1.2** before loading headerless source. The CLI uses its compiled 1.2 pin and rejects unsupported requested editions:

```sh
npm ci
npm run build
node out/src/cli/main.js --language-version 1.2 examples/15-component-specialization.swaml
```

Regenerate the AST. Executable functions use `FunctionDef`; pure calculations use `Calculation` and `CalculationCall`. The old Unit, UnitMember, Definition and Node rules are removed. ComponentMember includes structural members and executable functions. FunctionDef owns its calculations; FunctionFlow lowers to Block, with an absent flow meaning an empty body. LocalVariable replaces Let, LocalCall replaces Invoke, and RemoteCall replaces Request. Resolve effective inherited members before building diagrams, instance stores or path services. Deployment holds an external `system` string, and the host owns its resolution.

Update simulation input keys and collected evidence to `swaml-reference/1.2`; rerun fixtures rather than relabeling historical traces. Keep named-policy elaboration through the effective-policy helper. All diagrams remain flat and project the same checked semantic subjects. Historical 1.0 syntax first needs the [1.1 migration](MIGRATION_1_1.md), followed by the changes above.

## Final 1.2 authoring vocabulary

Change uppercase primitive/view keywords to lower camel case: `int`, `string`, `void`, `iv`, `fv` and their peers. Replace generic case declarations with `useCase` or `verificationCase`. Replace string-only requirements with bodies containing `doc /* ... */` and optional typed attributes. Replace case satisfies clauses with package-level `satisfy Requirement of Design.path;`; add `verify Requirement;` only to a verificationCase. A use case is not a satisfaction source. View blocks can now combine include clauses and filters. See [the requirements guide](REQUIREMENTS_AND_DOCUMENTATION.md).
