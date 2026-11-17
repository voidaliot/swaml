# ADR 0022: Values, places and expressions

Status: accepted for the unreleased standard 2.3, 18 November 2026. Owner approval of the 2.3 scope and decisions D1, D2, D4, D5, D6 and D14 of the [2.3 proposal](../proposals/NEXT_MINOR_PROPOSAL.md). Not implemented: each rule lands with the work package named in the [2.3 chapter drafts](../drafts/2.3/README.md). This ADR is normative where it differs from the proposal. Amends the indexed-path clause of [ADR 0020](0020-associated-test-access.md). Published editions remain unchanged.

Items: B1 element and field assignment, B2 index followed by member access, B3 conditional expression, B4 numbers and text, B5 logical clock, B6 computed durations, B11a indexed parts in tests. Work packages: WP1 (B1, B2, B11a), WP2 (B3), WP3 (B4, B5), WP4 (B6). The compatibility gates are added by the allocation package WP1a.

## Context

The three showcase models at `showcase/all` `cc16c25` (door, v2x and cloud; line numbers below refer to that commit) work around missing value forms with code that hides intent:

- **Whole-array rebuilds instead of element writes.** Door `Dem` (967–975, 1008–1040) rebuilds a six-element array with `pickInt(index == k, value, counters[k])` for each slot and replaces a whole `DtcStatus` record to change one flag. Cloud `WithValue`/`WithView`/`WithAlert` (330–380) and v2x `withNeighbour`/`withBatch` repeat the pattern.
- **Copies before member access.** Cloud `AlertRouter.findOpen` (1405–1412) copies `recent[i]` into a local to read one field; its test (2307) copies `backend.fleet.views[0]`. Tests cannot reach any twin of `backend.twins` at all, so the breaker is tested on a separate top-level `writer` with stubs (2927–2978).
- **Selection functions instead of a conditional.** Door `DoorEcu::Types` declares `pickInt`/`pickStatus` (137–148).
- **Hand-written numerics.** v2x `AdaptiveV2x::Types` (399–409) implements `squareRoot` by 24 Newton steps.
- **Counted time.** Door `ComMain` (774–798) and v2x `camCycle` (1013) and `TelemetryAggregator` (1394) count elapsed time with `rxAgeMs = rxAgeMs + 20`, which is only correct while the period does not change.
- **Literal-only durations.** v2x `hazardLifecycle` (1066–1079) repeats `ownHazardValidityMs` as the literal `after 5s`, and `UplinkTransfer.backoff` (1589–1606) waits in 250 ms steps because `wait` cannot take a computed delay.

The adversarial review of the proposal (17 November 2026) found that a naive `Literal{duration}` makes `PolicySetting` ambiguous and silently changes the AST of every 2.2 QoS duration, including the bundled library (finding 1); that computed periods had no identity, evaluator or per-occurrence projection (finding 4); that the state timer was evaluated before entry actions changed its operands (finding 5); that the place and conditional rules left evaluation order, out arguments, statement use and precedence open (finding 9); that host trigonometry and `realText` ties are not reproducible (finding 11); and that read and call index forms disagreed (finding 12). This decision adopts the revised rules.

## Decision

### Places (B1, WP1)

An assignment target is a place: a value path followed, after a first `[index]`, by any sequence of `.field` and `[index]` selectors, as in `statuses[index].confirmed = true;`. A dotted target without an index (`record.field = v;`) is a place as well.

- **Root.** The first segment is a mutable local, an `out` parameter or a non-const attribute of the executing component. In case scripts it is one of the script's own locals or an `on call` out binding. `in` parameters, const attributes, ports, child components and qualified names are rejected (SW2006).
- **Typing.** `.f` selects a field of a record type; `[i]` indexes a fixed array with an integral index. A literal index outside the extent is a static error. All are SW2002.
- **`out` roots.** An `out` parameter used as a root must be definitely assigned before the place assignment (SW2006).
- **Out arguments.** A place is not an out argument in 2.3; out arguments stay bare names (SW2006, the existing rule).
- **`for` updates.** The `for` header update keeps a bare name.
- **Evaluation order.** Evaluate the target's index expressions left to right, then the right side, then read the root cell, check every index against the value read, and write the root with exactly one place replaced. A write performed by the right side, as in `counters[i] = bump();` where `bump` writes `counters`, is therefore kept.
- **Failure.** An index outside the extent at runtime is the runtime failure `Bounds`; the root is unchanged.
- **Effects and evidence.** A place assignment has the write effect of its root; an attribute root is an attribute write. The trace records one `write` observation of the root whose `value` is the new whole root value and whose new field `place` holds the evaluated place text, for example `statuses[2].confirmed`. Values remain copies (invariant I4); no reference value is introduced.
- **Locks.** The read-modify-write happens under the serial lock after any resumption, so a suspension never splits it. The conservative stale-read warning (SW2011, tool fix A2) treats a place write as a write of its root and tracks index values read before a suspension.

### Indexed reads and test paths (B2, B11a, WP1)

A value reference may continue after a first `[index]` with selectors, as in `recent[i].vehicleId`. A read yields a copy and follows the place typing rules (SW2002); index expressions evaluate left to right.

In test inspection paths, a component segment with multiplicity takes a literal index, for reads (`backend.twins[0].link`) and for helper calls (`backend.twins[0].currentView()`). This amends ADR 0020, which left intermediate component indexes unsupported.

- A non-literal index on a component segment is an error (SW2010). Reads and calls therefore agree: the call grammar admits only literal indexes, and the validator holds reads to the same rule.
- A literal index outside the multiplicity is an error (SW2002).
- Roots stay non-multiple top-level occurrences (ADR 0020). Only parts inside the root are indexed. Association paths stay unindexed.
- Outside test scripts, a call path that contains an index is an error (SW2006), because operations never call another component by a structural path.

### Conditional expression (B3, WP2)

`if (c) a else b` is an expression only as a whole expression: the right side of an assignment or declaration, an argument, a return value, a guard, an index, or a parenthesized operand. As an operand it needs parentheses: `(if (p) 0 else q) + 1`.

- It is never a statement. `if (c) g() else h();` is a syntax error, so void branches cannot occur.
- Within a whole conditional, `else` extends to the end: `assert if (p) a else b == 3;` reads `if (p) a else (b == 3)`. `if (a) 1 else if (b) 2 else 3` chains. The formatter never drops parentheses.
- `c` is `bool`. The result type is the common type of the branches under widening; records, enums and arrays must be identical (SW2002). The conditional is not a known literal, so the general computed-assignment rule of chapter 1.4 applies when it initializes a smaller integral domain.
- The effect is the union of condition and both branches. A suspending call may appear in neither (SW2006).
- Only the selected branch is evaluated.
- KerML: `ControlFunctions::'if'`. The existing keywords `if`/`else` gain the `ConditionalExpression` production.

### Library additions (B4, B5, WP3)

New source packages are loaded like the existing libraries and imported explicitly. `Swaml::Math` and `Swaml::Platform` are not extended, because door `DoorEcu` imports both `Swaml::Math` and `DoorEcu::Types`, which already declares `clampInt`; an addition to `Swaml::Math` would make that model ambiguous (SW2001).

| Package | Operations | Semantics |
| --- | --- | --- |
| `Swaml::Numeric` | `minInt`, `maxInt`, `clampInt(v, low, high)` on `int`; `clamp(v, low, high)` on `real`; `sqrt(v: real) returns real` | Source bodies except `sqrt`. `sqrt` is a host intrinsic, IEEE-754 correctly rounded; an argument below zero is the runtime failure `Arithmetic`. |
| `Swaml::Text` | `intText(v: int)`, `realText(v: real, decimals: uint)`, `boolText(v: bool)`, all `returns string` | `intText` writes decimal digits with `-` for negatives. `realText` rounds the exact binary value of `v` to `decimals` fraction digits, ties away from zero, and writes plain decimal notation with no exponent. A result that rounds to zero has no sign, so `realText(-0.0001, 2)` is `0.00`. `decimals` above 15, or an absolute value of `v` of at least 1e21, is the runtime failure `Bounds`. `boolText` is source. |
| `Swaml::Time` | `now() returns uint` | Host intrinsic: the logical time of the evaluating step in nanoseconds since the run epoch. |

`sqrt` is the only new numeric intrinsic (D6). `intText` and `realText` are text intrinsics with the exact rules above.

**Rounding of `realText`.** Round half away from zero is the conventional rule for decimal text, and it is not the rule of `Swaml::Math::round`, which rounds ties toward positive infinity: `round(-2.5)` is `-2`, while `realText(-2.5, 0)` is `-3`. JavaScript `toFixed` applies the same tie rule to the exact binary value, but it writes `-0.00` for small negatives and exponent notation from 1e21. An implementation must therefore not rely on `toFixed` alone; the conformance tests cover ties of both signs, values that round to zero and the 1e21 bound.

`now()` has the effect class *reads state*.
- It is not allowed in attribute initializers (which are pure, SW2006), in completion guards (SW2008, ADR 0023) or in the constant sublanguage below (SW2007).
- It is allowed in every other expression, including transition, timer and release guards.
- A concurrent activation reads live time, not its dispatch snapshot.
- The stale-read warning never reports a `now()` value.
- Clock overflow remains the existing `ClockRange` violation.

### Durations as values (B6, WP4)

A `Duration` literal in an expression is a `uint` value in nanoseconds: `5ms` is `5000000`. Computed durations are written in parentheses in four positions:

| Position | Evaluated | Allowed expression |
| --- | --- | --- |
| `wait (e);` and `or after (e) { … }` | when the statement starts waiting | any non-suspending expression (SW2006) |
| state `after (e) …` | once per state entry, when the entry actions finish; expiry = state-update time + value | pure or reads state, as a guard (SW2008) |
| `on every (e)` and `deadline (e)` | once per expanded occurrence, statically | the constant sublanguage (SW2007) |

The expression is integral (`byte`, `uint` or `int`); a `real` result is SW2002. The value is checked as an integer before any widening to `uint`. A value that is not positive or not a representable duration is one runtime failure, `DurationRange`, never `Bounds`. It is an ordinary runtime failure of the statement or state reaction: it unwinds to the nearest `try` around a calling expression or fails the activation. An expiry that leaves the clock range remains the `ClockRange` violation. If entry actions suspend past a computed state-timer expiry, the timer has already elapsed and is selected after the completion transitions (ADR 0023).

**Constant sublanguage.**
- **Allowed:** integer and duration literals; const attributes of the owning occurrence, with their effective value after redefinition, whose effective initializers are themselves in the sublanguage (acyclic); unary `-`; `+ - * / %`; comparisons; `and`/`or`/`not`; the conditional; parentheses.
- **Not allowed:** calls, mutable attributes, locals, parameters, sampled reads and `now()`.
- **Exact integral division.** In the constant sublanguage, `/` on two integral operands is integral and must divide exactly for every occurrence. `deadline (periodMs * 1ms / 2)` is valid when the period is even in nanoseconds. A non-exact quotient or a zero divisor is a named SW2013 error. Outside the constant sublanguage, `/` keeps the chapter 1.4 rule and yields `real`, so a dynamic computed duration (`wait`, timeouts, state timers) that uses `/` is rejected as non-integral (SW2002).
- **Evaluator.** One evaluator in `semantic.ts`, `constantValue(expression, occurrence)`, used by the validator, `projection.ts`, the simulator and consuming tools. It replaces `constantNumber`, which folds only literals and negation.
- **Where values are checked.** Values are checked per expanded occurrence of every top-level occurrence of a package: positivity and representability (SW2013) and `deadline ≤ period` for `every` entries (SW2007). A definition that is never instantiated is checked only for sublanguage membership and typing, because its default const values need not be meaningful.

**Trigger identity.** The trigger of `on every (e)` is identified by the normalized expression text: comments and whitespace removed, names in canonical spelling. A parenthesized single literal normalizes to its nanoseconds, so `every (20ms)` and `every 20ms` are the same identity, but `every (2 * 10ms)` is a different one. Identity drives inheritance replacement, duplicate detection and `semantic.ts` `entryKey`. A release guard (ADR 0025) is not part of identity.

**Timing projection** becomes per occurrence. A definition-level view shows the expression text; an occurrence-level view shows the evaluated nanoseconds.

**Policy settings (compatibility fix).** `PolicySetting` has the single form `name = Expression;`, and a 2.2 duration setting becomes `Literal{duration}`. The settings `requestTimeout`, `maxLatency` and `maxAge` must be a duration literal; computed policy values are not allowed. Any other setting must not be a duration literal, so `capacity = 5ms;` stays invalid. Both rules are SW2013. The validator and `semantic.ts` `effectiveQos` read `value.duration`.

**Unit warning (D4).** SW2016 is a new stable warning on a computed duration expression that contains none of the following:
- a duration literal;
- a `now()` call;
- a reference to a const attribute whose effective initializer, followed through const references with `constantValue` provenance, contains a duration literal or `now()`, for example `const attribute timeoutNs: uint = 5ms;`.

For example, `after (pulseMs)` with `pulseMs = 250` means 250 ns and warns, while `wait (timeoutNs);` does not.

### Tier 2 (not in 2.3)

- **Trigonometry** (`sin`, `cos`, `atan2`, `pi`) as swa.ml library source with documented range reduction and polynomial coefficients. Only IEEE `+ - * /` are used, so results are bit-identical on every binary64 host. A backend must not contract to fused multiply-add.
- **Enum conversions** `ordinal(v: enum)` and `literalText(v: enum)`, with `enum` as a parameter type allowed only in `Swaml::*` library operations (D14).

## Alternatives rejected

- **Keeping `PolicySetting` with two alternatives, reordered.** This restores 38 of 38 identical ASTs, but Langium still reports the ambiguity at parser construction (review finding 1). Gate 3 below requires a warning-free grammar.
- **A nominal `duration` type (D4 alternative).** Clearer units, but every arithmetic rule, library signature and comparison would need a second numeric family. The `uint` nanosecond reading together with the SW2016 unit warning catches the observed mistake (`after (pulseMs)`) at much lower cost.
- **Full static evaluation of periods**, including pure calls. This needs a static interpreter with loops and real arithmetic inside the validator (finding 4b). The constant sublanguage covers every showcase period and deadline.
- **Evaluating the state timer at the state update, before entry** (proposal revision 1). It reads stale operands: `on entry { delayMs = min(delayMs * 2, capMs); } after (delayMs * 1ms) …` would use the old delay (finding 5).
- **A conditional usable as an operand without parentheses.** `x = 1 + if (c) 2 else 3 + 4` silently means `1 + (if c 2 else 7)` (finding 9d).
- **A conditional statement form.** `if (c) g() else h();` parsed as an expression statement with void branches (finding 9c).
- **Places as out arguments.** Out copy-back into a place would add a second read-modify-write path with its own ordering rules. This is not needed by any showcase model and can be added compatibly later.
- **Adding the operations to `Swaml::Math`.** This breaks door `DoorEcu` by import ambiguity.
- **Trigonometry as host intrinsics (D6 alternative).** Results differ between hosts and Node versions, so stores, traces and control flow on them diverge (finding 11).
- **`realText` ties to even, or ties toward positive infinity.** Ties to even is unusual for decimal text. Ties toward positive infinity (the rule of `round`) writes `-2` for `-2.5`, which readers do not expect from a text conversion. Revision 2 claimed that `round` and `toFixed` agree; they disagree for negatives (finding 11 and the WP0 review).
- **`/` always yielding `real` in the constant sublanguage.** Without exact integral division, half-period deadlines need rescaling such as `periodMs * 500us`, and calls (`trunc`) are excluded.
- **Expression indexes in test call paths.** Read and call forms disagreed (finding 12a). Literal indexes keep component identity static.

## Consequences

- **Grammar.** `Assign`, `ReferenceExpression` and `Selector` (WP1); `CallExpression.target` becomes `Path` (WP1); `Expression`, `ConditionalExpression` and `ExpressionStatement` (WP2); `Literal`, `Wait`, `Receive`, `ScheduleEntry` periods and deadlines, `Transition` delays and `PolicySetting` (WP4). Inventories (`spec/keywords.json`, `spec/notation.json`, `spec/kerml-mapping.json`) are regenerated by the work package that changes a production, because `npm run check` verifies them.
- **AST (D2).** Only `Transition.target` and `Wait.duration` become optional. The breaking part is silent widening:
  - `Assign.target` may be dotted and carries `index` and `selectors`;
  - `CallExpression.target` may contain `[n]`;
  - `PolicySetting.duration` is removed.

  A consumer compiled against 3.1.0 keeps compiling and misreads these, so the implementation package becomes 4.0.0.
- **Validator.** Place roots and typing, the literal-index rule, conditional typing and effects, `now()` placement, the constant sublanguage per occurrence, trigger identity and the SW2016 warning.
- **Simulator.** Place evaluation order and `Bounds`; the `place` field on `write`; conditional evaluation; the `sqrt`, `intText`, `realText` and `now()` intrinsics; computed waits, timeouts and state timers; `DurationRange`.
- **Formatter** (prerequisite A1). Prints places, conditionals with their parentheses and computed durations.
- **Projection.** `constantValue` and per-occurrence Timing values.
- **Consuming tools.** A tool that compares an assignment target with a bare name, for example to find out parameters, must handle places. Test-path tools must accept literal component indexes. Tools must accept an absent `Wait.duration`. Timing tools must read periods and deadlines through `constantValue` per occurrence instead of a literal.

## Compatibility

Every valid 2.2 source stays valid with unchanged meaning. This is a compatible minor edition (D1), established by three release gates. The allocation package WP1a adds all three gates before any language change. It requires the showcase models merged to main as `examples/showcase/*.swaml` and tool fixes A1, A2, A4 and A7 merged. Every later package reruns them, and WP9 runs them on the final grammar.

1. **Corpus AST identity.** Parse every repository `.swaml` file, including the showcase models at `examples/showcase/*.swaml`, with the 2.2 grammar (kept as a test fixture) and the current grammar. Compare the ASTs (references as text; positions and empty defaults stripped) after exactly one normalization, N1, applied to both sides: `PolicySetting{duration: d}` is rewritten to `PolicySetting{value: Literal{duration: d}}`. The gate is `test/compatibility-2-2.test.ts`, which lists the corpus and N1. Prototype result: 39 files, 38 identical, 1 skipped (a 2.2 negative example with parse errors), 0 differences.
2. **Behaviour identity.** The result of every run in `examples/simulation/runs.json`, every case of every example (`examples/simulation/cases.json`) and every test of the showcase models (`examples/showcase/*.swaml` at the commit where WP1a records the fixture, run through the API or `--json`) is compared with a fixture recorded once with the 3.1.0 implementation. The fixture holds status, full final stores, case verdicts and a SHA-256 digest of the canonical JSON trace, with lengths and kind counts. Only `profile` and `languageVersion` are ignored. The exact fixture and mismatch report are rule WP1a-M02 of the drafts. New trace fields and observation kinds appear only where new syntax is used, so a 2.2 model's trace stays identical.
3. **Warning-free grammar.** `langium generate` and parser construction emit no ambiguity warning. A unit test captures `console.warn` during `createSwamlServices` and fails on any output.

The formatter may print a 2.2 source differently where a new form is shorter. Meaning does not change. Contextual words are written unquoted only for a 2.3 workspace (ADR 0024).

## Open items

- Places as out arguments: deliberately excluded; revisit only with a showcase need.
- Trigonometry and enum conversions: Tier 2.
- Whether consuming tools show definition-level period expressions or one value per occurrence in their Timing view is a presentation decision of each tool. The language requires only that occurrence values come from `constantValue`.
