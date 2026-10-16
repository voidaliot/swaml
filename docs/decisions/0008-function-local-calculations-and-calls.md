# ADR 0008 — Function-local calculations and one call syntax

Status: accepted for SWAML 1.2.0.

The owner requested calculations only inside functions and approved further reductions in authoring vocabulary. This refines [ADR 0007](0007-component-functions-and-calculations.md).

Components own private data, ports, children and executable functions. Each function declares its calculations first, followed by flow or states. A calculation resolves only in its enclosing function, including state guards and action blocks. Its expression sees only explicit copied inputs, constants and sibling calculations. It cannot capture mutable data or call executable behavior. Redefining a function replaces the complete body and calculation scope; calculations have no independent specialization or redefinition.

Local flow functions may return values. `call helper(args) as result;` binds a copied, typechecked value to a fresh caller local. void local calls omit the binding. The helper shares the caller's activation lock and snapshot, and a failure unwinds the local call stack without undoing earlier effects. Triggered and stateful functions cannot be called locally. Inherited calls select the effective function on the concrete component instance; calculation references remain lexical to the selected function.

`call port.member(args) as result within D otherwise { … };` preserves explicit typed RPC routes, correlation, timeout and failure handling. Case RPC steps also use `call`. Local and routed calls share one keyword while retaining distinct AST nodes and execution rules. Executable functions cannot appear in expressions.

`var` declares both private component storage and mutable block locals. Ownership determines lifetime and visibility. Live-value shadowing remains forbidden. The retired `invoke`, `request` and `let` spellings require migration and receive no compatibility fallback.

The reference parser, validator and simulator must cover result copying/ranges, lexical calculation isolation, inherited dispatch, state guards, malformed inputs and unchanged routing/failure behavior. This change adds no dynamic object construction, implicit cross-component access, production scheduling proof or external-language conformance.
