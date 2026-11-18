# 1. Structure, names and types

Normative chapter of [swa.ml 2.2](../LANGUAGE_SPECIFICATION.md).

## 1.1 Names and documentation

Files contain packages without a version header. Package names may contain several :: segments; packages do not nest. import P; exposes P's top-level declarations and requires that package in the loaded workspace. Qualified references are unambiguous; ambiguous short imports are errors independent of load order. Names are unique in their scope; a package's elements and named package connections share one namespace. No overloads or implicit imports exist. The contextual words associate, by, case, in, kind, name, out, path, reversed, state, test, times, to, use and view and the duration units ns, us, ms and s remain legal names outside their syntactic positions. Other literal words in the grammar are reserved.

A package is a closed context. It owns definitions, top-level component occurrences, package connections between those occurrences, use cases, tests and the associate, satisfy and verify links that record intent about them. Definitions, requirements and other declarations may be imported; occurrences are never connected, made a case subject or associated across packages.

A name is written as a basic name, an ASCII letter or underscore followed by ASCII letters, digits or underscores, or as a quoted name between single quotes, such as 'Withdraw cash', 'Bestellübersicht' or 'operation'. Inside quotes, `\'` writes a quote and `\\` a backslash; other escapes, line breaks and control characters are invalid. The name is the quoted content: 'Pump' and Pump are the same name, and a quoted reserved word is an ordinary name. A quoted name is not empty, contains no '.', ':', '[' or ']', which delimit paths, and separates words by single spaces without leading or trailing space (SW2001). Tools write a basic name whenever one is legal and quote otherwise. Qualified names and paths combine spellings, as in Shop::'Order Service'.port; a string literal holding a path, such as a view filter value, contains the unquoted names.

| ID | Rule |
| --- | --- |
| WP2-S01 | **Contextual words.** From 2.3, `view`, `state`, `in` and `out` are contextual: they keep their keyword roles (views, states and `initial`, parameter directions, `for … in`) and are legal names in every name position: attribute, local, parameter, operation, state, initial state, component, port, port member and endpoint, view, enum literal, field, package segment, and both positions of `for (x: T in values)`. `defer` is an ordinary basic name until the work package that introduces the `defer` keyword makes it contextual (WP5-S01). |
| WP2-M01 | **Edition-aware spelling.** Name services (`formatName`, `formatQualifiedName` and `formatPath` in `src/language/names.ts`) take the workspace edition. For a 2.3 workspace they write a contextual word as a basic name; for a 2.2 or earlier workspace they keep quoting `view`, `state`, `in` and `out`, which are reserved there. A quoted spelling such as 'state' remains valid and denotes the same name. |

The words keep their keyword roles next to their name uses:

```swaml
package Uplink {
  enum Mode {
    offline, online
  }
  port def Link {
    provides event coverage(in: bool);
  }
  operation def count(in values: bool[3], out out: uint) {
    out = 0;
    for (in: bool in values) {
      out = out + (if (in) 1 else 0);
    }
  }
  component def Session {
    reversed port in: Link;
    attribute state: Mode = Mode.offline;
    attribute view: bool[3] = [false, false, false];
    operation track(covered: bool) {
      state = if (covered) Mode.online else Mode.offline;
      view[0] = covered;
    }
    schedule {
      on receive in.coverage(in) track(in);
    }
  }
}
```

Strings use double quotes and the portable escapes for quote, backslash, newline, carriage return and tab. Ordinary `//` and `/* */` comments are lexical annotations. Each declaration owns at most one formal `/** */` doc, first inside its body or immediately before the semicolon of a leaf. Documentation and comments do not execute.

## 1.2 Components and occurrences

component def declares a reusable type. component name: Type; creates a usage; a package-owned usage is a top-level occurrence and an execution root. An untyped package usage may own inline topology. Child usages require definitions. Closure is checked per package over all top-level occurrences and package connections (section 2.3). Definitions may be reusable open libraries; an unused definition is not an execution root.

A component whose effective members, including specialization, have ports but no operations, schedule entries or parts is interface-only. It needs no implementation: the emission and input-owner rules of section 2.1 do not apply to it. In a run it does nothing on its own; only a case script acts through its ports. Actors (external systems) and test stubs are written as interface-only components.

A usage body is an anonymous specialization with explicit whole-member replacement and added members, including typed roots. Single specializes inheritance is acyclic. An inherited member with the same name requires redefines; a nonexistent inherited target is an error. Replacement preserves category, types, operation signature and body category. Child component definitions may specialize the replaced type. Port replacement preserves directed compatibility and optionality. Attributes preserve constness and type. No partial operation-body merge, super dispatch or implicit shadowing exists.

A literal positive multiplicity [n] on a child creates n separate occurrences. Paths index every array usage with a literal in range, as in wheels[2].svc; a test's inspection path indexes part families the same way (section 3.7, WP1-S06). Connector loops and port arrays do not exist. Composition is finite and acyclic. Definition identity does not identify an occurrence or a store.

## 1.3 State and lexical values

attribute declares component-owned mutable state; const attribute fixes its value per occurrence. Both are explicitly typed and may be redefined with a different compatible initializer in a usage. Initializers are pure and cannot read mutable state. Requirements own immutable typed attributes regardless of the const spelling.

var declares an activation/block local. in is the default parameter direction and is immutable; out parameters are mutable with success-only copy-back. Live names cannot shadow another live local, parameter or attribute. A nested operation sees its own parameters, its nested operations and the owning component's attributes, never enclosing parameters or locals. Local data access never traverses child components or ports.

| ID | Rule |
| --- | --- |
| WP1-S01 | Places (section 3.3) are rooted in locals, `out` parameters and non-const attributes only; a place never selects a child component or a port. |

## 1.4 Value domains

bool, byte (0–255), uint (0–9007199254740991), int (−9007199254740991 through 9007199254740991), finite real and string are primitive domains. void has no values and is only an operation result. Records and enums are nominal by qualified declaration identity. A datatype declares every field explicitly; a record construction supplies each once, with no extra fields. Enum literals use Type.literal; a live value named Type takes precedence, so a qualified enum reference avoids ambiguity.

Fixed arrays have positive safe extents, copied elements and invariant element type/extent. Array literals are checked elementwise against their destination type. Index expressions are integral; literal out-of-range indexes fail statically and dynamic bounds fail at runtime.

| ID | Rule |
| --- | --- |
| WP1-S02 | **Selectors.** After a first `[index]`, a value reference or assignment target continues with any sequence of `.field` and `[index]` selectors. `.f` selects a field of a record type and `[i]` indexes a fixed array with an integral index; the result type is the field or element type. Index expressions evaluate left to right. A read takes its root first, then applies each selector in turn (WP1-R04); a place reads its root after its right side (WP1-R01). A read yields a copy. Reference values remain absent. |
| WP1-S03 | **Static index range.** A literal index outside the extent of the indexed array type is a static error, at every selector position. |

Both are SW2002 (WP1-D04). A place such as `statuses[index].confirmed` is assigned in place (section 3.3); a read such as `recent[i].vehicleId` copies one field of one element:

```swaml
package Values {
  datatype DtcStatus {
    confirmed: bool;
    occurrences: uint;
  }
  datatype Alert {
    vehicleId: string;
    open: bool;
  }
  component def Memory {
    attribute statuses: DtcStatus[2] = [record DtcStatus { confirmed = false; occurrences = 0; }, record DtcStatus { confirmed = false; occurrences = 0; }];
    attribute recent: Alert[2] = [record Alert { vehicleId = "TRK-101"; open = true; }, record Alert { vehicleId = "VAN-7"; open = false; }];
    operation confirm(index: uint) {
      statuses[index].confirmed = true;
      statuses[index].occurrences = statuses[index].occurrences + 1;
    }
    operation findOpen(vehicle: string) returns int {
      for (var i: int = 0; i < 2; i = i + 1) {
        if (recent[i].vehicleId == vehicle and recent[i].open) {
          return i;
        }
      }
      return -1;
    }
  }
}
```

Scalar widening is byte to uint to int to real. Known integral literals may initialize smaller integral domains if in range. General computed integral assignments are range-checked by the backend where permitted by the type rule; real never implicitly narrows. Integral arithmetic yields int; slash or a real operand yields real. Integer operations are exact within the safe domain and overflow fails. Division/remainder by zero and non-finite reals fail. Equality is recursive and type-compatible; ordering is numeric. Only and/or short-circuit. The grammar defines precedence.

| ID | Rule |
| --- | --- |
| WP2-S02 | **Conditional typing.** `if (c) a else b` requires `c: bool`. Its type is the common type of `a` and `b` under scalar widening (byte → uint → int → real). bool, string, records, enums and arrays must be identical types, so an array branch neither widens its elements nor changes its extent. A void branch is rejected (`Void completion is not an expression value.`). All are SW2002 (WP2-D01). The conditional is not a known literal, so initializing a smaller integral domain from it follows the general computed-assignment rule and is range-checked at run time. The branches are typed on their own, without the destination type: `b = if (c) [1, 2] else [3, 4];` with `b: byte[2]` is rejected (the branches are `int[2]`), and `b = if (c) 300 else b;` with `b: byte` is valid and fails at run time when it selects 300. |
| WP2-S03 | **Conditional precedence.** The conditional is a whole expression (grammar WP2-G01): the right side of an assignment or declaration, an argument, a return value, an assertion, a guard, an index or a parenthesized operand. As an operand it is parenthesized, as in `(if (p) 0 else q) + 1`; an unparenthesized operand is a syntax error. Within it, `else` extends to the end of the expression, so `assert if (p) a else b == 3;` reads `if (p) a else (b == 3)`, and `if (a) 1 else if (b) 2 else 3` chains. Member access needs a value path, so `(if (c) r1 else r2).f` is not a read; index the selection instead, as in `rs[if (c) 0 else 1].f`. |

Only the selected branch is evaluated (WP2-R01). A debounce counter selects values in place of selection helpers:

```swaml
package Debounce {
  operation def clampInt(value: int, low: int, high: int) returns int {
    return if (value < low) low else if (value > high) high else value;
  }
  component def Counter {
    const attribute stepUp: int = 3;
    attribute counter: int = 0;
    operation report(failed: bool) {
      var previous: int = counter;
      counter = if (failed) clampInt((if (previous < 0) 0 else previous) + stepUp, -4, 6) else clampInt((if (previous > 0) 0 else previous) - 1, -4, 6);
    }
  }
}
```

**Durations (2.3).** A duration literal such as `250ms` is an expression value from 2.3: a `uint` number of nanoseconds, so `pulseMs * 1ms` is a computed duration and `const attribute timeoutNs: uint = 5ms;` is an ordinary const attribute. Computed durations are written in parentheses in waits, receive timeouts, state timers, periods and deadlines (chapter 3; the [computed backoff](../../examples/41-computed-backoff.swaml), [lock pulse](../../examples/42-lock-pulse.swaml) and [derived period](../../examples/43-derived-period.swaml) examples).

| ID | Rule |
| --- | --- |
| WP4-S01 | **Duration literals as values.** A duration literal in an expression is a `uint` value in nanoseconds (`1us` is 1000; `5 ms` with layout between value and unit is the same literal). It must be a safe integer number of nanoseconds or it is SW2013 `Duration must be positive safe integer nanoseconds.`; inside an expression `0ms` is the value 0, while every 2.2 position (`wait 5ms`, `or after`, state `after`, `every`, `deadline` and a policy setting) still requires a positive literal. Like an integer literal, a duration literal initializes a smaller integral domain when its value is in range (`var b: byte = 200ns;`). The unit words `ns`, `us`, `ms` and `s` stay contextual names: `ms * 2` reads a name. A computed duration (chapter 3.3, 3.5, 3.6) is an integral expression (`byte`, `uint` or `int`); any other type, `real` included, is SW2002 `A duration must be integral, found {type}.` (WP4-D02). |

## 1.5 Reuse and library boundaries

Package operation definitions use only parameters and nested operations. Their usages inherit the signature; an optional body replaces the whole body. Calls in an inherited component body resolve by name in the concrete occurrence's effective members, with signature preservation checked on redefinition. Call graphs are acyclic. No other component's operation or calculation is a fallback name resolution target.

The versioned source libraries are Swaml::Math, Swaml::Numeric, Swaml::Text, Swaml::Time, Swaml::Calls, Swaml::Qos, Swaml::Views and Swaml::Platform. They are always loaded but imported explicitly. Math provides abs, min, max, checked floor/round/trunc conversion to int, Unicode scalar length and concat. floor/round/trunc/length are explicitly identified host intrinsics in the reference library; round ties toward positive infinity. Their backend semantics and range failures remain required.

From 2.3, three more packages supply numbers, text and the logical clock. They are new packages rather than additions to Swaml::Math, because a model that imports Swaml::Math next to its own clampInt (the door model's DoorEcu::Types) must stay unambiguous.

| ID | Rule |
| --- | --- |
| WP3-L01 | `Swaml::Numeric` declares `operation def minInt(a: int, b: int) returns int`, `maxInt(a: int, b: int) returns int`, `clampInt(v: int, low: int, high: int) returns int` and `clamp(v: real, low: real, high: real) returns real` with swa.ml source bodies, and `sqrt(v: real) returns real` as a host intrinsic. `clampInt` and `clamp` test `low` first: a value below `low` is `low`, otherwise a value above `high` is `high`. |
| WP3-L02 | `Swaml::Text` declares `intText(v: int) returns string` and `realText(v: real, decimals: uint) returns string` as host intrinsics and `boolText(v: bool) returns string` with a source body (`"true"` or `"false"`). |
| WP3-L03 | `Swaml::Time` declares `now() returns uint` as a host intrinsic. Its effect is *reads state* (chapter 3.1, WP3-S01). |
| WP3-L04 | No operation is added to `Swaml::Math` or `Swaml::Platform`; the 2.2 library source keeps its bytes. **A workspace that declares a package named like a 2.3 library package uses its own; the library package is not available there.** Such a package, declared in any document of the workspace other than a library copy, hides the built-in `Swaml::Numeric`, `Swaml::Text` or `Swaml::Time` of the same name for scope, linking, resolution, validation and runs (the others stay available); its operations are ordinary operations, never intrinsics, and no diagnostic is added, so a 2.2 source that declares such a package keeps its 2.2 meaning. Hiding is workspace-global, as package resolution and duplicate detection are: it applies to every document of the workspace and follows every change, a deleted or renamed declaration included. A workspace with such a package cannot reach the library operations of that name, by import or qualified name. Otherwise a workspace that imports one of the new packages and declares a same-named element follows the ambiguity rule: a reference that two visible declarations share is SW2001 (`Ambiguous name …`), and so is a short call name shared with a 2.3 library operation, reported with the same message and the declarations as related information; a short call name that only user packages share keeps the 2.2 SW2006 `Unknown operation …`. A component's own or nested operation is found first, as before. A qualified name resolves either. Because no 2.2 source can import the new packages, no 2.2 model becomes ambiguous. |
| WP3-M01 | The new packages are part of the versioned library source, `libraries/swaml-2.3.swaml`, loaded as a built-in document next to `libraries/swaml-2.0.swaml` and imported explicitly (a qualified name needs no import). Intrinsic bodies are documentation only, as for the `Swaml::Math` intrinsics; the return-path and package-definition checks exempt them by identity in the built-in document and in a copy of it that differs at most by a leading byte order mark, line ends and whitespace at the end of the file, as they exempt `Swaml::Math`. Only the built-in declarations are evaluated as intrinsics, and an operation usage of one without its own body is that intrinsic. Such a copy of a library document loaded as a workspace source duplicates the built-in packages (SW2001), as a copy of the 2.2 library always did, and hides nothing; a copy with any other change is user source and hides the library packages it declares. A run lists the 2.3 library document among its sources only when a supplied model imports or references one of its visible packages. |
| WP3-R01 | `sqrt` is IEEE-754 correctly rounded. An argument below zero is the runtime failure `Arithmetic`; `-0.0` is not below zero and its root is `0.0`. A real value is always finite (chapter 1.4), so no NaN or infinity reaches or leaves `sqrt`. |
| WP3-R02 | `intText` writes decimal digits, with `-` for negatives and no leading zeros. `realText` rounds the exact binary value of `v` to exactly `decimals` fraction digits, ties away from zero, and writes plain decimal notation with no exponent: `realText(2.5, 0)` is `3` and `realText(-2.5, 0)` is `-3`. A result that rounds to zero has no sign: `realText(-0.0001, 2)` is `0.00`. `decimals` above 15, or `abs(v)` of at least 1e21, is the runtime failure `Bounds`. This is not the tie rule of `Swaml::Math::round`, which rounds ties toward positive infinity. An implementation must not rely on JavaScript `toFixed` alone, which writes `-0.00` and switches to exponent notation from 1e21; the reference implementation computes in integers from the binary64 value. Because the exact binary value is rounded, `realText(1.005, 2)` is `1.00` and `realText(0.125, 2)` is `0.13`. |
| WP3-R03 | `now()` returns the logical time of the evaluating step, in nanoseconds since the run epoch, as `uint`. Every activation reads the live clock: a concurrent activation reads live time, not its dispatch snapshot, which holds attributes only (chapter 3.4). In a handler it is the delivery step, after latency and fault delays; after a wait it is the resumption step; in a case script it is the script's step. Clock overflow remains the `ClockRange` violation. Since WP4 a duration literal is a `uint` value in nanoseconds (WP4-S01), the unit of `now()`, so `now() - lastRxNs >= 100ms` compares like units. |

`sqrt`, `intText` and `realText` failures are ordinary runtime failures: `try` catches them and a caught one is a `caught` observation (chapter 6). A hazard distance, a reception age and a diagnostic label use all three packages:

```swaml
package LibraryUse {
  import Swaml::Numeric;
  import Swaml::Text;
  import Swaml::Time;
  component def Monitor {
    const attribute timeoutMs: uint = 100;
    attribute lastRxNs: uint = 0;
    attribute distanceM: real = 0.0;
    attribute label: string = "";
    attribute level: int = 0;
    operation onFrame(dx: real, dy: real, raw: int) {
      lastRxNs = now();
      distanceM = sqrt(dx * dx + dy * dy);
      level = clampInt(raw, 0, 10);
      label = "level " + intText(level) + " at " + realText(distanceM, 1) + " m, stale " + boolText(false);
    }
    operation check() {
      if (now() - lastRxNs >= timeoutMs * 1000000) {
        label = "stale for " + realText((now() - lastRxNs) / 1000000.0, 3) + " ms";
      }
    }
    operation guarded(v: real) returns real {
      return try(sqrt(v), 0.0);
    }
  }
}
```

The before-and-after examples are [square root](../../examples/38-square-root.swaml), [logical clock](../../examples/39-logical-clock.swaml) and [number text](../../examples/40-number-text.swaml). Trigonometry and enum conversions are not part of 2.3.
