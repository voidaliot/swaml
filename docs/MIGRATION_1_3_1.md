# Migrating to SWAML 1.3.1

Version 1.3.1 retains the headerless **1.3 parser family** and **1.3 reference simulation profile**. Pin the package revision when loading a model.

## Classes and operations

`class` is the general structural category and `component` its specialization. `operation` is the general executable/signature category and `function` its specialization. Existing component/function source retains its behavior. Both alternatives use the same ownership, isolation, typed communication, calculations, flow/states and execution contracts.

Use `class def` for a reusable class and `class name: Type;` for a static usage. A component definition may specialize a class or component; a class definition may specialize a class. A component usage needs a component definition; a class usage accepts either. Top-level class usages are closed execution roots, and typed root bodies still contain deployment bindings only.

Use `operation name(...)` wherever an executable member or interface callable signature is allowed. An operation signature accepts an operation or function implementation; a function signature requires a function implementation. Redefinition may narrow operation to function or class usage to component usage when the inherited contract remains compatible; widening is rejected.

View `kind` filters match exact authored categories. Select both executable categories with `where kind == "operation" or kind == "function"`. Both are valid fv/tv subjects; interface signatures remain descriptive contracts. `class` and `operation` become reserved, so rename colliding identifiers. See the [complete example](../examples/20-classes-and-operations.swaml) and [ADR 0014](decisions/0014-classes-operations-and-uml-notation.md).

## Service interface symbols

clientServer and service ports now show a boundary square with a stem and ball for server/provides or socket for client/requires. senderReceiver and publishSubscribe retain their directional notation. Contract labels, routes, QoS, replies and service events remain explicit. This graphical revision requires no connector-source migration.

## Timing views

Use `tv` for a function timing view. Keep `fv` for statement flow, states and interruptible regions.

```text
view polling tv of Demo.first.poll;

view timeline tv {
  include Demo recursive where kind == "function";
}
```

These fragments assume the existing `Demo` architecture in [example 17](../examples/17-function-timing.swaml). A compact timing subject must be an executable operation/function declaration or occurrence. A compact component root is invalid: select its descendant functions explicitly with `recursive` and `where`. Ordered union, filters, empty results and occurrence identity follow the existing view-selection contract. For observed timing, the host binds an identified run and concrete occurrence identities separately from the source view declaration.

`tv` is now reserved. Rename an existing identifier spelled `tv` and update its references. A 1.3.0 host rejects the new view keyword; source files do not silently select a parser version.

## Operator and test inputs

Remove `on manual`. Bind an application entry point to a named, typed event with `on receive port.member`. Declare the event in a `publishSubscribe` or `service` interface, give its source and receiver owned ports, and connect them through an explicit route. A local helper instead omits the trigger and is called only within its component.

The simulator no longer accepts the `manual` JSON option. It rejects direct function releases and has no replacement destination-event injection option. Author an ordinary driver function that publishes the event using `on start`, `on every`, or a finite state/timer sequence. A host may generate that source; it must validate and preserve it with the run evidence. See [events and external inputs](EVENTS_AND_INPUTS.md) and [ADR 0013](decisions/0013-event-driven-external-inputs.md).

Inputs now traverse their declared connectors, so observed activation times include input transport and queue delay. Update recorded traces, source hashes, activation identities and fault-offer ordinals. A recursive timing selection also includes driver functions; use explicit function selections when focusing a Timing View on application behavior.

`manual` is no longer reserved as an identifier. Its former trigger syntax remains invalid.

## Structure layouts

Existing `gv` declarations keep their meaning. Choose **Box in box** or **Tree** in the viewer. Both layouts show the same ownership paths. Save the choice in a presentation sidecar if persistence is needed; no model-source migration or new layout keyword is required.

Published [1.3.0 release notes](RELEASE_1_3_0.md) describe the earlier FV timing presentation. The [current decision](decisions/0012-timing-view-and-structure-layouts.md) records the revised view taxonomy.
