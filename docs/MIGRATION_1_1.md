# Migrating from SWAML 1.0 to 1.1

SWAML **1.1.0** is the compact authoring edition. It retains explicit `def` type declarations, the component → unit → operation ownership model and every interface, behavior, timing and graphical requirement. It intentionally changes source syntax despite the minor version number. Do not treat 1.1 as a drop-in parser for 1.0 models.

Published 0.1 and 1.0 tags, PDFs and references remain historical artifacts. Keep an original model copy and its pinned tool version when preserving old simulation evidence. Interface versions such as `version "1.0.0"` are independent contract identities; syntax migration does not change them.

## Select the language edition in the host

Remove `swaml "1.0";` from source files. A 1.1 file begins with `package`, or is empty during editing. Use the 1.1 language-core package/CLI; an editor host must pin the supported edition before loading its workspace. No project configuration file format is invented by the model language, and the current CLI does not search for one. The 1.1 parser rejects old headers rather than silently accepting or guessing a version.

## Keep definitions explicit; make roots component occurrences

`component def Assembly` and `unit def Controller` remain unchanged. `def` is required for a reusable type. A type declaration never starts a singleton or selects a simulation root.

Replace a 1.0 assembly wrapper with a named root component while preserving its child names and connections:

```text
// 1.0
system Product realtime {
    component controller: Controller;
    node ecu mcu;
    deploy controller on ecu;
}

// 1.1 — same child path, routes and allocation
component Product realtime {
    component controller: Controller;
    node ecu mcu;
    deploy controller on ecu;
}
```

The profile can be `service`, `realtime` or `mixed`. Omitting it means service. Do not remove a realtime/mixed profile: doing so would weaken the model's required timing contracts.

An inline root can contain units directly. This avoids introducing a definition used only to hold one unit. Alternatively a root can instantiate a reusable assembly:

```text
component def Assembly {
    unit controller: Controller;
}
component Product: Assembly;
component DeployedProduct: Assembly {
    node application process;
    deploy controller on application;
}
```

The typed root's body is a deployment binding, containing only `node` and `deploy`. It cannot add units, components, ports, connectors or delegation. Its architecture comes entirely from `Assembly`. Binding names must not collide with members inherited from that definition. An inline root has its own composition, but no outward ports/delegation. Required boundary ports on a reused definition retain their closure obligations.

Selecting `Package::Product` executes that root occurrence. Simulation, deployment and case paths are relative to it: a child is `controller`, not `Product.controller`. Replacing a wrapper with `component Product: ExistingType;` may shorten the old child paths; make that structural refactoring separately and update every case, view, deployment, manual release and expected store path. Merely changing `system` to `component` preserves paths.

## Put states directly in their operation

Remove the `machine` marker. Keep the `initial` declaration first; states follow, then transitions. The operation still has no parameters, has a Void result, and starts with its unit.

```text
// 1.0
operation lifecycle(): Void on start machine {
    initial Idle;
    state Idle {}
}

// 1.1
operation lifecycle() on start {
    initial Idle;
    state Idle {}
}
```

This is still stateful behavior with the same entry/exit, guard, priority, timer, completion and finality rules. `StateBody` is a grammar grouping, not a second authored executable element. Runtime documentation may use the mathematical term “state machine” without reintroducing a source declaration or performer.

## Trim expressions and no-result annotations

| 1.0 source | 1.1 source | Meaning retained |
| --- | --- | --- |
| `operation stop(): Void` | `operation stop()` | missing result means Void; explicit `: Void` remains valid |
| `set count = count + 1;` | `count = count + 1;` | whole-value assignment to an existing permitted cell |
| `compute clamp(value)` | `clamp(value)` | pure function in the same unit |
| `array [1, 2, 3]` | `[1, 2, 3]` | nonempty fixed array value |
| `enumValue Status.Ready` | `Status.Ready` | nominal enum value, subject to lexical resolution |
| `enumValue Contracts::Status.Ready` | `Contracts::Status.Ready` | explicit package-qualified enum value |

Only operation implementations and interface signatures may omit result annotations. Function results remain explicit and non-Void. Variable, parameter, field and local types remain explicit. No arithmetic, copying, scope or communication behavior is inferred from these shorter spellings.

A local or unit value named `Status` that is accessible in the current expression environment makes `Status.Ready` a field read, even if an enum has that name. A missing field is an error; the resolver does not fall back to the enum. Qualify `Contracts::Status.Ready` when the enum is intended. Unqualified nominal names retain the usual local-package/direct-import ambiguity checks across declaration kinds. Pure functions expose only parameters, and variable initializers expose no mutable values; inaccessible unit variables do not shadow enums in those contexts. Qualified enum syntax never grants access to another unit's private values.

The removed words `swaml`, `system`, `machine`, `set`, `compute`, `array` and `enumValue` are no longer reserved. The current grammar has 122 reserved keywords, including type names, units, roles and policy values. Remaining words have defined modeling work: `record` identifies nominal construction, `invoke` distinguishes imperative local calls, and `request`/`send`/`publish` retain communication semantics.

## Preserve architecture and check evidence

No 1.1 simplification removes interface versions, typed ports, handler ownership, emission provenance, explicit connectors/delegation, mandatory QoS, RPC timeout/failure branches or bounded loops. All exchange between distinct units/components still follows interfaces. States and operations retain direct ownership. Browser, GV, IV, CV, SV, GRV and FV remain.

Run `npm run check` after migrating. It checks current examples, executable documentation, reserved-word coverage, grammar mapping, simulation values and trace freshness. The simulation binding is now `swaml-reference/1.1`; its selector and result field are named `root`, replacing `system`. Rebuild any host using generated AST types: `RootComponent`/`RootMember` replace `System`/`SystemMember`, `StateBody` replaces `Machine`, and enum values resolve from `ReferenceExpression` using `ValuePath` rather than an `EnumLiteral` node.

A successful migration should preserve expected stores and observable effects after accounting for intentional occurrence-path edits. Exact trace source lines and source digests change when text changes. Do not overwrite historical evidence to imply it was generated by the new parser. Logical-time simulation continues to require a finite horizon and explicit resource bounds; it is not a physical scheduling proof or a KerML-conformance claim.
