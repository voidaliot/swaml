# 1. Structure, names and types

Normative chapter of the [SWAML 1.4 development specification](../LANGUAGE_SPECIFICATION.md).

## 1.1 Lexical model

Source files MUST use UTF-8 and the `.swaml` extension. Whitespace and ordinary `//` line comments and `/* … */` block comments are insignificant to execution outside strings. `doc /* … */` is a formal owned specification, retained in the semantic model. Block comments do not nest. Identifiers match `[_a-zA-Z][a-zA-Z0-9_]*` and are case sensitive. Every quoted word in the grammar and the lexical doc marker are reserved. All keywords use lower camel case, including primitive types and view kinds. This version has no escaped identifiers.

Strings use double quotes and backslash escapes. A conforming implementation MUST support `\"`, `\\`, `\n`, `\r`, and `\t`; other escape sequences are invalid in conforming source. Raw control characters U+0000–U+001F, including line breaks and tabs, MUST NOT occur inside strings; use the permitted escapes. The lexer enforces this portable subset.

Unsigned decimal integers and decimal real literals are supported; a minus sign is a unary operator. Decimal real literals require digits on both sides of the point. Hexadecimal, exponent and suffix forms are absent. Duration literals consist of a positive integer followed by `ns`, `us`, `ms` or `s`. A duration MUST normalize to an exact integer nanosecond count no larger than 2^53−1. Time has no implicit unit.

The document contains zero or more packages, with no language header. The parser and its host MUST select SWAML 1.4 explicitly before loading the workspace; the CLI in this edition supports exactly 1.4. A host MUST NOT silently select whichever language version is newest. Historical `swaml "1.0";` headers are rejected by this grammar. An empty model is valid as an editing/library artifact, but contains no root component to execute.

## 1.2 Namespaces and resolution

Packages are top-level and non-nested in 1.4. A package name MUST be unique in the loaded model workspace. A package is declared in one file, although one file may contain several packages. Named elements in the same namespace MUST be unique; overload resolution is not supported.

`A::Type` identifies a package declaration. `import A::*;` exposes A's top-level declarations by short name in the importing package. Imports are not transitive. A short reference MUST resolve to exactly one declaration across the local package and its direct imports. Ambiguity is an error even when one candidate is local. Fully qualified references do not require an import.

Periods express containment/feature paths, not package qualification. A structural instance path follows actual child instances. A behavior communication path has exactly two identifiers: `localPort.member`. Directly following another component's data or function is forbidden. Pure record field paths follow only values already in the function's local environment.

Local function references resolve only in the owning component. Calculation references resolve only among calculations declared by the enclosing function, including its state guards and action blocks. State names resolve only inside the owning function's state body. Deployment destinations are external system identities; they do not participate in source-name lookup. No lookup fallback may expose a similarly named declaration from another component.

## 1.3 Definitions, usages and specialization

`class def C` declares a reusable software class; `component def C` declares the specialized component kind. In the software metamodel, **Component specializes Class**. Both kinds own child class/component usages, typed ports, connectors, delegation, private variables and executable operations/functions. Both leaf and composite types may own behavior. Class is not a value datatype or a shared heap object: every usage has independent storage and retains the same port boundary rules.

`class item: C;` declares one usage of a class or component definition. `component item: C;` requires a component definition. Multiplicity is exactly one; repeated usages require separate declarations. The declared usage kind and its referenced definition kind are both preserved. A class usage typed by a component is legal because every component is a class; the reverse is invalid.

A package may declare a **class or component execution root**: `class Demo { … }` and `component Demo { … }` supply inline composition and local behavior; `class Demo: Assembly;` and `component Demo: Assembly;` instantiate a compatible definition. A typed root may have a deployment-only body, for example `component Demo: Assembly realtime { deploy controller on "sysml:Vehicle::ecu"; }`. Its architecture and behavior come entirely from its definition; the binding body MUST NOT extend or redefine them. Inline roots may own the same structural and behavioral members as a definition, plus deployment bindings. All roots are closed execution contexts: every required port, including a root-owned port, is checked for closure.

A root has optional `service`, `realtime` or `mixed` profile following its name or type. Omission means `service`. A root is a named usage, never a definition, and cannot be used as a child's type. Definitions create no runtime participants until instantiated. The term root component in execution contracts includes either authored root kind unless a rule explicitly distinguishes them.

`class def Specialized specializes Base { … }` permits one class base. `component def Specialized specializes Base { … }` permits one class or component base. A class definition MUST NOT specialize a component definition, because that would erase the more specific component kind. The specialization graph MUST be acyclic. This is single inheritance of user definitions; the Component-to-Class metamodel relation is implicit and requires no built-in source declaration named Class.

Effective members consist of inherited members plus newly declared members, with explicit compatible replacements. Reusing an inherited name without `redefines` is an error; `redefines` without a matching inherited member is an error. For example, `redefines function initialize() on start { … }` may replace an inherited operation or function with the compatible specialized function kind. Redefinition replaces the whole member rather than merging bodies or private values. Inherited behavior resolves local member names in the effective specialized class/component.

Redefinition MUST retain the member family and exposed contract, with only kind-preserving or subtype-narrowing replacement. An operation may be replaced by a function; an inherited function MUST NOT become an operation. A class usage may be narrowed to a component usage with a compatible component type; an inherited component usage MUST NOT become a class usage. A port keeps its interface identity, role and optionality; a variable keeps its exact value type; a child usage keeps its declared definition type or specializes that type. An operation/function keeps its parameter names/types, result, statement/state body category, trigger kind/endpoint/period and concurrency contract, and does not increase a declared WCET or deadline. Connectors and delegations keep their endpoint paths. A replacement may change an initializer, compatible executable body (including its local calculations) or connector policy, subject to every ordinary validity rule. This reuse does not introduce dynamic creation, reference-valued objects, overloaded dispatch or unrestricted UML class semantics.

The effective containment graph MUST be acyclic, including inherited children. Every usage receives distinct private storage, local locks, activations and child usages. Two usages of the same definition require typed ports and explicit routes to communicate; sharing a definition never shares private state. Typed usage declarations cannot override private initializers; differing initial values require compatible generated specializations or an explicit modeled initialization protocol.

Library definitions may leave required ports unconnected until instantiated. A closed root MUST connect every nonoptional port after resolving delegation. A port can be handled by its owner's operations/functions or delegated to a child, but cannot simultaneously acquire two behavior owners. An optional port cannot weaken a required alias elsewhere on its route.

Class/component state is private to its usage. A variable has a declared type and a pure initializer independent of mutable variables and communication. Operation/function/calculation parameters and local variables MUST NOT shadow private variables or other live values in their scope. Blocks create lexical scopes. Parameters are copied input values; assignment changes the local copy only.

Throughout the remaining chapters, structural component ownership/execution rules apply to both class and component kinds, and executable function rules apply to both operation and function kinds, except where a signature or kind-compatibility rule distinguishes them. [ADR 0014](../decisions/0014-classes-operations-and-uml-notation.md) records this hierarchy.

## 1.4 Value types

| Type | Domain / semantics |
| --- | --- |
| `bool` | `true` or `false` |
| `int` | exact signed integers between −(2^53−1) and 2^53−1 |
| `uint` | exact integers from 0 through 2^53−1 |
| `byte` | exact integers from 0 through 255 |
| `real` | finite IEEE 754 binary64 values, with nearest-even arithmetic |
| `string` | finite Unicode text; no implicit encoding or transport size guarantee |
| `void` | no result value; the default when a function/signature omits `: Type`, never a variable, parameter, field, array or calculation result |
| `datatype` | a finite record with named typed fields |
| `enum` | a nominal set of one or more unique literals |
| `T[n]` | a fixed array of exactly n values, n a positive safe integer |

Datatypes and enums are nominal: two declarations with identical members are distinct types. Recursive records, including recursion through arrays, MUST be rejected. There are no pointers, references, nullable values, dynamic collections, aliases or generics in 1.4. `byte` is an unsigned eight-bit value domain. Other fixed-width encodings and bounded strings are target-binding choices; they are not inferred from these primitives.

`record T { field = expression; … }` MUST assign every field of T exactly once and no others. `T.Literal` MUST name a declared enum literal; a package-qualified form is `Package::T.Literal`. `[e1, e2, …]` constructs a nonempty fixed array; its elements MUST have one nominal type or a numeric common type. Identical numeric element types are retained; mixed numeric types yield real if any is real, otherwise int if any is int, otherwise uint. A literal assigned to a declared array type checks each element against that element type, so `[0, 255]` can initialize `byte[2]`. Existing array values have invariant element type and extent. Arrays of differing lengths are incompatible.

Enum and local-value paths resolve deterministically. If the first segment of an unqualified dotted path is a live lexical/private value accessible in the current expression environment, the whole path is a local value read; a missing field is an error and MUST NOT fall back to an enum. Otherwise a two-segment `T.Literal` path resolves T among declarations in the current package and direct imports, checking ambiguity across all declaration kinds before requiring an enum. `Package::T.Literal` explicitly selects a loaded package enum without using the local-value environment. A wrong declaration kind, unknown literal, ambiguous name or array index applied to an enum is invalid. Calculations expose only parameters to that environment, and variable initializers expose no mutable values. A component variable therefore does not shadow an enum where that variable is inaccessible. No variant permits cross-component private-value lookup.

Record fields may be read by `value.field.subfield`. `arrayValue[index]` reads one array element, with an integral index. Only one final index suffix is available in 1.4; a local variable can hold an intermediate array value. Bounds are zero inclusive to length exclusive. Out-of-bounds access fails the current function at runtime and MUST NOT produce an undefined value. Whole-value assignment is supported; mutating a record field or array element in place is not part of 1.3.

Assignment, argument passing and return preserve nominal types and exact array lengths. Scalar numeric widening follows `byte → uint → int → real`. Assigning an integral value to `uint` or `byte` performs a range check: a known out-of-range constant is a static error, and a computed out-of-range value fails execution. real values do not implicitly narrow to integral types. Arrays do not implicitly widen or narrow. Enum/integer conversion is absent.

Numeric overflow, non-finite results, division by zero and invalid indexing fail execution. The parser/validator rejects out-of-range literal integers, but proving arithmetic ranges requires execution or additional analysis.

## 1.5 Expression rules

From lowest to highest precedence: `or`, `and`, `== !=`, `< <= > >=`, `+ -`, `* / %`, unary `not -`, primary expressions. Binary operators associate left. Parentheses override precedence. `and` and `or` short-circuit left-to-right. Other operands and call arguments are evaluated left-to-right.

Boolean operators require bool operands. Ordered comparison and arithmetic require numeric operands. Equality compares equal nominal value types recursively (records by declared fields, arrays by ordered values), or two numerics after promotion. string equality is exact code-point equality with no normalization; no ordering or concatenation operator is defined. `%` is integer remainder with the sign of the dividend and requires integral operands. `/` always returns real. Other arithmetic returns real if either input is real and int otherwise.

A calculation is declared only at the beginning of a function body, before its statement sequence or initial-state declaration. It is not a component member and cannot be independently inherited or redefined. Redefining the function replaces its whole calculation scope. A calculation has the syntax `calc twice { in x: real; return result: real = x * 2.0; }`. It declares zero or more ordered typed inputs and exactly one named non-void output defined by a pure expression. Its environment consists only of parameters, literals, record/enum/array construction and other calculations in the same function. It MUST NOT capture component variables, enclosing function parameters, block locals or state payloads, call functions, or communicate. Needed values must be passed as explicit arguments. Local call graphs MUST be acyclic in 1.4. `name(arguments)` evaluates the expression once with copied arguments and returns its value. The output name labels the result; it is not a mutable local or an input to its own expression. `twice(3.0)` supplies ordered copied inputs and yields the output value. Calculations can be used in local variable initializers, conditions, state guards/actions and other expressions of their enclosing function. Component variable initializers cannot call calculations. To reuse work across functions, define a local value-returning function and use a call statement. A calculation has no statement block, trigger, state or communication effect.

## 1.6 Requirements for tools

A reference that cannot be resolved, has the wrong target kind, or is ambiguous is an error. Tools MUST distinguish declaration paths, instance paths and local value paths even when their spelling is similar. A tool supporting rename MUST update declaration references and structural/member paths together, preserving the identity of each referenced occurrence.
