# 1. Structure, names and types

Normative chapter of the [SWAML 1.1 specification](../LANGUAGE_SPECIFICATION.md).

## 1.1 Lexical model

Source files MUST use UTF-8 and the `.swaml` extension. Whitespace and `//` line comments and `/* … */` block comments are insignificant outside strings. Block comments do not nest. Identifiers match `[_a-zA-Z][a-zA-Z0-9_]*` and are case sensitive. Every quoted word in the grammar is reserved. This version has no escaped identifiers.

Strings use double quotes and backslash escapes. A conforming implementation MUST support `\"`, `\\`, `\n`, `\r`, and `\t`; other escape sequences are invalid in conforming source. Raw control characters U+0000–U+001F, including line breaks and tabs, MUST NOT occur inside strings; use the permitted escapes. The lexer enforces this portable subset.

Unsigned decimal integers and decimal real literals are supported; a minus sign is a unary operator. Decimal real literals require digits on both sides of the point. Hexadecimal, exponent and suffix forms are absent. Duration literals consist of a positive integer followed by `ns`, `us`, `ms` or `s`. A duration MUST normalize to an exact integer nanosecond count no larger than 2^53−1. Time has no implicit unit.

The document contains zero or more packages, with no language header. The parser and its host MUST select SWAML 1.1 explicitly before loading the workspace; the CLI in this edition supports exactly 1.1. A host MUST NOT silently select whichever language version is newest. Historical `swaml "1.0";` headers are rejected by this grammar. An empty model is valid as an editing/library artifact, but contains no root component to execute.

## 1.2 Namespaces and resolution

Packages are top-level and non-nested in 1.1. A package name MUST be unique in the loaded model workspace. A package is declared in one file, although one file may contain several packages. Named elements in the same namespace MUST be unique; overload resolution is not supported.

`A::Type` identifies a package declaration. `import A::*;` exposes A's top-level declarations by short name in the importing package. Imports are not transitive. A short reference MUST resolve to exactly one declaration across the local package and its direct imports. Ambiguity is an error even when one candidate is local. Fully qualified references do not require an import.

Periods express containment/feature paths, not package qualification. A structural instance path follows actual child instances. A behavior communication path has exactly two identifiers: `localPort.member`. Directly following another unit's data or operation is forbidden. Pure record field paths follow only values already in the operation's local environment.

Local operation and function references resolve only in the owning unit. State names resolve only inside the owning operation's state body. Deployment nodes resolve only in the owning root component. No lookup fallback may expose a similarly named declaration from another unit.

## 1.3 Definitions and occurrences

`component def C` and `unit def U` declare reusable types. `component c: C;` and `unit u: U;` declare contained occurrences. The keyword MUST agree with the referenced definition kind. An instance has multiplicity exactly one in this version. Repeated instances require separate declarations.

A component definition owns ports, unit/component instances, connectors and delegation. A unit definition owns ports, private variables, functions and operations. `def` is required for each reusable component/unit type; it is never inferred from the presence of a body.

A package may also declare a **root component occurrence**: `component Demo { … }` supplies inline unit/component instances, connectors, execution nodes and deployments; `component demo: Assembly;` instantiates a reusable component definition. A typed root may use a body instead of its terminating semicolon, but that body MUST contain only execution nodes and deployments; its architecture comes entirely from its definition. For example, `component demo: Assembly realtime { node ecu mcu; deploy controller on ecu; }` binds existing descendants without adding, replacing or hiding them. Names declared in a typed root binding MUST NOT collide with the referenced definition's member names. Direct unit children are allowed in an inline root; an extra component wrapper is unnecessary.

A root has optional `service`, `realtime` or `mixed` profile following its name or type. Omission means `service`. It is a named occurrence, never a definition, and cannot be used as a child's type. Inline roots have no outward ports/delegations: they are closed execution contexts. For a typed root, all nonoptional definition ports and their aliases remain subject to closure; a required outward boundary port cannot acquire an invented external route.

The containment graph of component definitions MUST be acyclic. Every occurrence of a unit receives distinct variable storage and operation activations. Two instances of the same definition are distinct communication boundaries and still require ports between them.

Definitions are not runtime singletons. Defining an unused component or unit creates no runtime participant. Library definitions may leave their nonoptional ports unconnected until instantiated. A closed root component MUST connect every nonoptional port, including boundary aliases, after resolving delegation. An optional leaf cannot weaken a required boundary, nor the reverse.

Unit state is private to its instance. A variable has a declared type and a pure initializer. Initializers MUST be independent of other mutable variables and all communication. Operation/function parameters and local variables MUST NOT shadow unit variables or other live values in their scope. Blocks create nested lexical scopes; a variable declared in a branch does not exist after that branch. Parameters are copied input values; assignment changes the local copy only.

## 1.4 Value types

| Type | Domain / semantics |
| --- | --- |
| `Bool` | `true` or `false` |
| `Int` | exact signed integers between −(2^53−1) and 2^53−1 |
| `Real` | finite IEEE 754 binary64 values, with nearest-even arithmetic |
| `String` | finite Unicode text; no implicit encoding or transport size guarantee |
| `Void` | no result value; the default when an operation/signature omits `: Type`, never a variable, parameter, field, array or pure-function result |
| `datatype` | a finite record with named typed fields |
| `enum` | a nominal set of one or more unique literals |
| `T[n]` | a fixed array of exactly n values, n a positive safe integer |

Datatypes and enums are nominal: two declarations with identical members are distinct types. Recursive records, including recursion through arrays, MUST be rejected. There are no pointers, references, nullable values, dynamic collections, aliases, generics or inheritance in 1.1. Bounded strings and machine integer widths may be added by future target profiles; they are not inferred from these primitives.

`record T { field = expression; … }` MUST assign every field of T exactly once and no others. `T.Literal` MUST name a declared enum literal; a package-qualified form is `Package::T.Literal`. `[e1, e2, …]` constructs a nonempty fixed array; its elements MUST have one type, allowing numeric Int-to-Real promotion inside the literal. Arrays of differing lengths are incompatible.

Enum and local-value paths resolve deterministically. If the first segment of an unqualified dotted path is a live lexical/private value accessible in the current expression environment, the whole path is a local value read; a missing field is an error and MUST NOT fall back to an enum. Otherwise a two-segment `T.Literal` path resolves T among declarations in the current package and direct imports, checking ambiguity across all declaration kinds before requiring an enum. `Package::T.Literal` explicitly selects a loaded package enum without using the local-value environment. A wrong declaration kind, unknown literal, ambiguous name or array index applied to an enum is invalid. Pure functions expose only parameters to that environment, and variable initializers expose no mutable values. A unit variable therefore does not shadow an enum where that variable is inaccessible. No variant permits cross-unit private-value lookup.

Record fields may be read by `value.field.subfield`. `arrayValue[index]` reads one array element, with an Int index. Only one final index suffix is available in 1.1; a local variable can hold an intermediate array value. Bounds are zero inclusive to length exclusive. Out-of-bounds access fails the current operation at runtime and MUST NOT produce an undefined value. Whole-value assignment is supported; mutating a record field or array element in place is not part of 1.1.

Assignment, argument passing and return require the same nominal type and array length, with one exception: a scalar Int may widen to Real. Arrays do not implicitly widen. No numeric narrowing or conversion between enums and integers is implicit.

Numeric overflow, non-finite results, division by zero and invalid indexing fail execution. The parser/validator rejects out-of-range literal integers, but proving arithmetic ranges requires execution or additional analysis.

## 1.5 Expression rules

From lowest to highest precedence: `or`, `and`, `== !=`, `< <= > >=`, `+ -`, `* / %`, unary `not -`, primary expressions. Binary operators associate left. Parentheses override precedence. `and` and `or` short-circuit left-to-right. Other operands and call arguments are evaluated left-to-right.

Boolean operators require Bool operands. Ordered comparison and arithmetic require numeric operands. Equality compares equal nominal value types recursively (records by declared fields, arrays by ordered values), or two numerics after promotion. String equality is exact code-point equality with no normalization; no ordering or concatenation operator is defined. `%` is integer remainder with the sign of the dividend and requires Int operands. `/` always returns Real. Other arithmetic returns Real if either input is Real and Int otherwise.

A pure function has the syntax `function name(parameters): Type = expression;`. Its environment consists only of parameters, literals, record/enum/array construction and other functions in the same unit. It MUST NOT read unit variables, call operations, or communicate. Local call graphs MUST be acyclic in 1.1. `name(arguments)` evaluates the expression once with copied arguments and returns its value. The function's non-Void result annotation is mandatory. Parentheses distinguish a pure local function call from a value reference; no `compute` marker is required.

## 1.6 Requirements for tools

A reference that cannot be resolved, has the wrong target kind, or is ambiguous is an error. Tools MUST distinguish declaration paths, instance paths and local value paths even when their spelling is similar. A tool supporting rename MUST update cross-references and string-valued path references together; generic Langium rename alone is not sufficient for the latter in this prototype.
