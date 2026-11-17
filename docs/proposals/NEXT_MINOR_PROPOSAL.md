# swa.ml next minor (2.3): language gaps from the showcase models

**Status:** design proposal for owner approval. Not normative. Nothing here changes the grammar, validator, standard version or a published artefact. **Base:** swa.ml 2.2 (`v2.2`, `spec/standard.json` 2.2, implementation 3.1.0, `swaml-reference/2.2`), main `e6fd783`. **Evidence:** `examples/showcase/*.swaml` on branch `showcase/all` (`361173a`): door = `autosar-classic-door-controller.swaml`, v2x = `autosar-adaptive-v2x-telemetry.swaml`, cloud = `cloud-fleet-monitoring.swaml`. Item numbers B1–B21 follow the limitation list (section B); section A (tool defects) is referenced only where it interacts.

Recommendation labels: **add** (grammar and/or semantics), **library-only**, **reject** (keep by design), **defer**.

## 0. Summary

| Item | Recommendation | Tier | One-line syntax |
| --- | --- | --- | --- |
| B1 in-place element/field assignment | add | 1 | `statuses[index].confirmed = true;` |
| B2 index followed by member access | add | 1 | `recent[i].vehicleId == vehicle` |
| B3 conditional expression | add | 1 | `dutyPercent = if (stop) 0 else dutyPercent;` |
| B4 numeric/text library | library-only (+ enum pseudo-type in Tier 2) | 1 / 2 | `Swaml::Numeric::sqrt(d2)`, `Swaml::Text::intText(n)` |
| B5 logical clock | library-only | 1 | `lastRxNs = now();` |
| B6 computed durations | add | 1 | `after (pulseMs * 1ms) to locked { }` |
| B7 completion / guarded timer / result transitions | add | 1 | `when (sessionId > 0) to Connected { }` |
| B8 internal transitions | add | 1 | `on receive stream.accepted(t) { shed = shed + 1; }` |
| B9 deferral | add | 1 | `defer pages.page;` |
| B10 entry picks transition | covered by B7 | 1 | `when (not nvmStored) to postRun { }` |
| B11 multiplicity | add (indexed test paths); reject port arrays, per-index config | 1 | `assert backend.twins[0].link == LinkState.online;` |
| B12 boundary port to several children | add (member split) | 2 | `connect (service, intake.service); connect (service, tracker.service);` |
| B13 policy per member | add | 1 | `connect bodyCan: BodyCanFrames (bcm.bus, dcu.canBus) { crash: CanEvent; }` |
| B14 synchronous read of a required attribute | add | 1 | `when (not door.ajar)` |
| B15 reserved member names | add (contextual) | 1 | `attribute state: SessionState = …;` |
| B16 associate per pair; absence assertion | add list form; keep absence idiom | 1 | `associate truck, alderDispatcher to 'Monitor live position', 'Command a vehicle';` |
| B17 runnable-level deployment | add (semantic only) | 1 | `deploy ioHwAb.protect on doorModules[0].core0.task5ms;` |
| B18 task period/priority/preemption/budget | add `Swaml::Os` + ordering (Tier 1); timed profile (Tier 2) | 1 / 2 | `component task5ms: Task { redefines const attribute priority: uint = 30; }` |
| B19 mode-dependent schedules | add (entry guard) | 1 | `on every 20ms poll() when (mode.current != PowerMode.sleep);` |
| B20 end-to-end latency chain | defer (B5 makes it testable now) | 2 | `assert now() - t0 <= 150ms;` |
| B21 service discovery | reject | — | static connection + `provides attribute available: bool` |

All Tier 1 additions are syntax-preserving: every valid 2.2 source stays valid with unchanged meaning, provided library additions go into **new** library packages (decision D5; the door model itself would break if `clampInt` were added to `Swaml::Math`, because `DoorEcu` imports both `Swaml::Math` and `DoorEcu::Types`, which declares `clampInt`).

## 1. Consolidated grammar delta

Only these productions change. Everything not listed is unchanged. Fragments use the style of `src/language/swaml.langium`.

```text
// B1, B2, B11: places (assignment targets and references) with selectors
Assign: target=ValuePath ('[' index=Expression ']' selectors+=Selector*)? '=' value=Expression ';';
ForUpdate infers Assign: target=Name '=' value=Expression;                        // unchanged
ReferenceExpression: path=ValuePath ('[' index=Expression ']' selectors+=Selector*)?;
Selector: '.' field=Name | '[' index=Expression ']';
CallExpression: target=Path '(' (args+=Expression (',' args+=Expression)*)? ')';  // was ValuePath (B11)

// B3: conditional expression
type Expression = BinaryExpression | UnaryExpression | Literal | CallExpression | TryExpression
                | ConditionalExpression | ReferenceExpression | RecordLiteral | ArrayLiteral;
PrimaryExpression returns Expression: Literal | TryExpression | ConditionalExpression | CallExpression
                | ReferenceExpression | RecordLiteral | ArrayLiteral | '(' Expression ')';
ConditionalExpression: 'if' '(' condition=Expression ')' then=Expression 'else' otherwise=Expression;

// B6: durations are values; computed durations are parenthesized expressions
Literal: {infer Literal} (number=Numeric | text=STRING | boolean=('true'|'false') | duration=Duration);
Wait: 'wait' (duration=Duration | '(' delay=Expression ')') ';';
Receive: 'on' branches+=ReceiveBranch ('or' branches+=ReceiveBranch)*
         ('or' 'after' (timeout=Duration | '(' timeoutValue=Expression ')') timeoutBody=Block)?;

// B6, B19: schedule entries with computed period/deadline and a release guard
ScheduleEntry: ('on' (kind='start'
                     | kind='every' (period=Duration | '(' periodValue=Expression ')')
                     | kind=('receive'|'call') endpoint=MemberPath '(' (bindings+=Name (',' bindings+=Name)*)? ')')
               | kind='after' predecessor=Name)
               operation=Name '(' (args+=Expression (',' args+=Expression)*)? ')'
               ('when' '(' guard=Expression ')')?
               ('deadline' (deadline=Duration | '(' deadlineValue=Expression ')'))?
               (concurrent?='concurrent')? ';';

// B6, B7, B8, B9, B10: states
State: (final?='final')? 'state' name=Name '{' documentation=Documentation?
       (actions+=StateAction | transitions+=Transition | deferrals+=Deferral)* '}';
Transition: ( 'on' 'receive' endpoint=MemberPath '(' (bindings+=Name (',' bindings+=Name)*)? ')' ('when' '(' guard=Expression ')')?
            | 'after' (delay=Duration | '(' delayValue=Expression ')') ('when' '(' guard=Expression ')')?
            | 'when' '(' guard=Expression ')' )
            ('to' target=Name)? effect=Block;
Deferral: 'defer' endpoints+=MemberPath (',' endpoints+=MemberPath)* ';';

// B13: per-member policy
Connect: (redefines?='redefines')? 'connect' (name=Name)? (':' policy=[QosPolicy:QualifiedName])?
         '(' source=Path ',' target=Path ')'
         (documentation=Documentation? ';' | '{' documentation=Documentation? memberPolicies+=MemberPolicy+ '}');
MemberPolicy: member=Name ':' policy=[QosPolicy:QualifiedName] documentation=Documentation? ';';

// B14: optional initial value of an attribute member (sample cell)
PortMember: direction=('provides'|'requires') (idempotent?='idempotent')? kind=('attribute'|'event'|'operation') name=Name
            (':' type=TypeRef ('=' initial=Expression)? | '(' (parameters+=Argument (',' parameters+=Argument)*)? ')' ('returns' result=TypeRef)?)
            documentation=Documentation? ';';

// B16: association lists (cross product)
Association: 'associate' occurrence=[ComponentUsage:Name] (',' moreOccurrences+=[ComponentUsage:Name])*
             'to' target=[Scenario:Name] (',' moreTargets+=[Scenario:Name])* ';';

// B15, B9: contextual words
Name returns string: ID | UNRESTRICTED_NAME | 'reversed' | 'to' | 'times' | 'name' | 'kind' | 'path' | 'use' | 'case'
                   | 'test' | 'associate' | 'by' | 'ns' | 'us' | 'ms' | 's'
                   | 'defer' | 'view' | 'state' | 'in' | 'out';
```

Parse notes (Langium 4.4, ALL(*) lookahead): `if (c) {` (statement) and `if (c) e else f` (expression) differ at the token after `)`; an expression never starts with `{`. `a.b = …;` versus `a.b(…);` already relies on unbounded lookahead. `5ms` lexes as INT + `ms`; no other expression position accepts an integer followed by a name except the loop-limit `times`, which is not a unit. `to` stays contextual although now optional: after `)`/a duration/a guard, a Name can only be the transition target. `state`, `view`, `in`, `out` as names: `state` only starts a State after `initial X;`; `view` only starts a package element; `in`/`out` as a parameter name is followed by `:` (LL(2)). The implementer must run the Langium ambiguity report and add parser tests for each contextual word in every name position.

AST compatibility: every existing property keeps its type and meaning for 2.2 sources, except `Transition.target` and `Wait.duration`/`Transition.delay`/`ScheduleEntry.period`/`deadline`, which become optional. That is an exported TypeScript API change (decision D2).

## 2. Items

Each item: problem and before, recommendation (syntax, static rules, runtime, diagnostics, library, views, inventories), after, interactions, cost. Cost scale: S ≤ 1 day, M ≤ 3 days, L ≤ 2 weeks of one agent including tests. "Ext" is `E:\GitHub\swaml-vsc-ext`.

### B1 In-place element and field assignment

**Problem.** `Assign` takes a bare name (`target=Name`; spec 1.4: "In-place field/index assignment and reference values are absent"). All three models rebuild arrays through helper operations, one per element type.

```text
// door, Dem (lines 791-810, 853-862)
operation withCounter(index: uint, value: int) {
  counters = [
    pickInt(index == 0, value, counters[0]),
    pickInt(index == 1, value, counters[1]),
    …
    pickInt(index == 5, value, counters[5])
  ];
}
…
if (counter <= 0 and status.testFailed) {
  withStatus(index, record DtcStatus {
    testFailed = false;
    testFailedThisCycle = status.testFailedThisCycle;
    pending = status.pending;
    confirmed = status.confirmed;
    occurrences = status.occurrences;
  });
}
```

(cloud `WithValue`, `WithView`, `WithAlert`; v2x `withNeighbour`, `withBatch`, `placeBatch`, `placeNeighbour` are the same pattern.)

**Recommendation: add.** Grammar: `Assign` with `selectors` (section 1). Static rules (SW2006 for mutability, SW2002 for types):

| Rule | Text |
| --- | --- |
| Root | The first segment of `target` is a mutable local, `out` parameter or non-const component attribute of the executing operation (case scripts: own locals and `on call` out bindings only, as today). Dotted segments after the root are record fields. A qualified name, a port, a child component or an `in` parameter as root is an error. |
| Path typing | Each `.f` selects a field of a nominal record; each `[i]` indexes a fixed array with an integral index. The final place type is the destination type for the usual assignability rule. A literal out-of-range index is SW2002. |
| `out` roots | A selector write to an `out` parameter reads the rest of the value, so the parameter must be definitely assigned before (SW2006, same analysis as today). |
| Effects | A selector write to an attribute is a write effect on that attribute (and a read of it). Concurrent entries still cannot reach it. |
| `for` update | `ForUpdate` keeps a bare name. |

Runtime (reference run, chapter 6.3): evaluate the index expressions of the target left to right, then the right side, then check every index against its extent; on success replace the root cell with a copy that differs only at the place. A failed index check is a runtime failure (catchable only by moving the computation into an operation called inside `try`, as for every statement) and leaves the root unchanged. The write is one `write` observation of the root with an added `place` field (for example `statuses[2].confirmed`) and the new root value. Values remain copied (I4): no references are introduced, and `var s: DtcStatus = statuses[i]; s.confirmed = true;` changes only `s`.

Serial lock and suspension: the right side cannot suspend unless it is the whole value (existing rule); the read-modify-write is evaluated under the serial lock after any resumption, so it uses live state. Snapshots: unchanged (concurrent entries cannot write). Determinism: unchanged.

Views: Flow shows the statement text with the place; the statement edit/creation forms accept a place. KerML: `Assign` keeps its mapping (`FeatureValue` write lowering); `Selector` is a grouping node lowered into the assignment's target chain. Keywords: none. Notation: one concept row update ("assignment") with an element/field example.

**After.**

```text
operation report(fault: FaultId, failed: bool) {
  reports = reports + 1;
  var index: uint = indexOf(fault);
  var previous: int = counters[index];
  var counter: int = 0;
  if (failed) {
    counter = clampInt((if (previous < 0) 0 else previous) + stepUp, passedThreshold, failedThreshold);
  } else {
    counter = clampInt((if (previous > 0) 0 else previous) - stepDown, passedThreshold, failedThreshold);
  }
  if (counter == previous) {
    return;
  }
  counters[index] = counter;
  if (counter >= failedThreshold and not statuses[index].testFailed) {
    statuses[index].testFailed = true;
    statuses[index].testFailedThisCycle = true;
    statuses[index].pending = true;
    statuses[index].confirmed = true;
    statuses[index].occurrences = statuses[index].occurrences + 1;
  }
  if (counter <= 0 and statuses[index].testFailed) {
    statuses[index].testFailed = false;
  }
  derivePermission();
}
```

`withCounter`, `withStatus`, `pickInt`, `pickStatus` disappear (`clampInt` comes from `Swaml::Numeric`, B4).

**Interactions.** `const` attributes and `in` parameters stay immutable (rejected roots). Concurrent snapshot rule unchanged. Stale reads: an element write is a write of the root for SW2011; the index computed from a pre-suspension read is exactly what A2's flow-sensitive fix must track. B2 shares `Selector`. A1: the formatter must print places.

**Cost.** Grammar S; validator M (place typing, definite assignment, effect); simulator S (place write + trace field); formatter S; projection S (statement text); Ext M (`statement-edits.ts`, `diagram-edits.ts` assignment templates, `field-completion.ts` for `.`/`[` after a place, Flow statement labels, creation card validation); docs S (chapters 1.4, 3.3, 9.2).

### B2 Index followed by member access

**Problem.** `ReferenceExpression: path=ValuePath ('[' index=Expression ']')?` ends at the index. Every row read needs a local copy.

```text
// cloud, AlertRouter.findOpen (lines 1342-1349) and a test (line 2149)
for (var i: int = 0; i < 4; i = i + 1) {
  var a: Alert = recent[i];
  if (a.vehicleId == vehicle and a.kind == kind and a.status != AlertStatus.resolved) {
    return i;
  }
}
…
var truckView: VehicleView = backend.fleet.views[0];
assert truckView.vehicleId == "TRK-101" and truckView.lastSequence == 2;
```

**Recommendation: add.** `ReferenceExpression` gains `selectors` (section 1). Typing as for B1 places. Runtime: evaluate index expressions left to right; bounds failure is a runtime failure; the value is a copy (I4). Test inspection paths (ADR 0020) accept the same selectors after an attribute. No new diagnostics (SW2002). KerML: `Selector` lowering. Views: Flow text only.

**After.**

```text
for (var i: int = 0; i < 4; i = i + 1) {
  if (recent[i].vehicleId == vehicle and recent[i].kind == kind and recent[i].status != AlertStatus.resolved) {
    return i;
  }
}
…
assert backend.fleet.views[0].vehicleId == "TRK-101" and backend.fleet.views[0].lastSequence == 2;
```

**Interactions.** Each read of `recent[i]` in a serial activation reads the live store; between two reads without suspension nothing can interleave, so no consistency issue. Concurrent activations read their snapshot. B11 reuses the grammar for component multiplicity segments.

**Cost.** Grammar S; validator S; simulator S; formatter S; Ext S (completion after `]`); docs S.

### B3 Conditional expression

**Problem.** No conditional value form; the door model declares one helper per type.

```text
// door, DoorEcu::Types (lines 137-148) and WindowLifter.drive (1483-1489)
operation def pickInt(condition: bool, whenTrue: int, otherwise: int) returns int {
  if (condition) {
    return whenTrue;
  }
  return otherwise;
}
operation def pickStatus(condition: bool, whenTrue: DtcStatus, otherwise: DtcStatus) returns DtcStatus { … }
…
var duty: uint = 0;
if (direction != MotorDirection.stop) {
  duty = dutyPercent;
}
send motor.windowMotor(record MotorCommand { direction = direction; dutyPercent = duty; });
```

**Recommendation: add** `if (c) a else b` as an expression, reusing `if`/`else`. Static: `c` is `bool`; result type is the common type of `a` and `b` under the existing widening (byte < uint < int < real; integral literals adapt); records, enums and arrays must be the same nominal type/shape (SW2002). Effect is the union of all three operands. Neither branch may contain a suspending call (SW2006, existing rule "suspending calls cannot be embedded"). Precedence: a primary expression whose `else` operand extends as far as possible: `(if (p) 0 else q) + 1` needs parentheses; the formatter keeps them. Runtime: evaluate `c`, then only the selected branch (lazy, like `try` fallback). Guards and initializers may use it when their operands are allowed there. KerML: map to the KerML `if` operator expression (`ControlFunctions::'if'`); inventory kind `element`. Keywords: `if`, `else` gain production `ConditionalExpression`. Notation: Flow shows the text only.

**After.**

```text
send motor.windowMotor(record MotorCommand {
  direction = direction;
  dutyPercent = if (direction == MotorDirection.stop) 0 else dutyPercent;
});
```

**Interactions.** B1 example uses it. Short-circuit list grows: `and`, `or`, conditional. Statement `if` unchanged.

**Cost.** Grammar S; validator S; simulator S; formatter S; Ext S (expression completion/hover, Flow labels); docs S.

### B4 Numeric and text library

**Problem.** `Swaml::Math` has real-only `min`/`max`, no square root, no trigonometry, no number/enum to string conversion.

```text
// v2x, AdaptiveV2x::Types (lines 387-397); door clampInt (149-157)
operation def squareRoot(v: real) returns real {
  /** Newton iteration; the language library has no square root. */
  if (v <= 0.0) {
    return 0.0;
  }
  var x: real = max(v, 1.0);
  for (var i: int = 0; i < 24; i = i + 1) {
    x = (x + v / x) / 2.0;
  }
  return x;
}
```

**Recommendation: library-only** in new packages (no overloading exists, so integer variants get distinct names):

```text
package Swaml::Numeric {
  operation def minInt(a: int, b: int) returns int { if (a < b) { return a; } return b; }
  operation def maxInt(a: int, b: int) returns int { if (a > b) { return a; } return b; }
  operation def clampInt(v: int, low: int, high: int) returns int { if (v < low) { return low; } if (v > high) { return high; } return v; }
  operation def clamp(v: real, low: real, high: real) returns real { if (v < low) { return low; } if (v > high) { return high; } return v; }
  operation def sqrt(v: real) returns real { /** Host intrinsic: IEEE-754 correctly rounded square root; negative input fails. */ }
  operation def sin(radians: real) returns real { /** Host intrinsic. */ }
  operation def cos(radians: real) returns real { /** Host intrinsic. */ }
  operation def atan2(y: real, x: real) returns real { /** Host intrinsic, radians in [-pi, pi]. */ }
  operation def pi() returns real { return 3.141592653589793; }
}
package Swaml::Text {
  operation def intText(v: int) returns string { /** Host intrinsic: decimal, leading '-' for negatives. */ }
  operation def realText(v: real, decimals: uint) returns string { /** Host intrinsic: fixed decimals, ties to even; decimals <= 15. */ }
  operation def boolText(v: bool) returns string { if (v) { return "true"; } return "false"; }
}
```

Intrinsics are pure, deterministic per host and explicitly identified, like `floor`/`round`. `sqrt` is exact under IEEE-754; `sin`/`cos`/`atan2` are not correctly rounded on every host, so results may differ in the last bit between hosts; traces record host identity and reference examples never compare trig results for exact equality (decision D6).

Enum conversion (Tier 2): `ordinal(v)` and `literalText(v)` need a parameter that accepts any enum, which the closed type system does not have. Proposed narrow form: `TypeRef` primitive `'enum'` (already a keyword) allowed only in parameters of `Swaml::*` library intrinsics (SW2002 elsewhere): `operation def ordinal(v: enum) returns uint` in `Swaml::Numeric`, `operation def literalText(v: enum) returns string` in `Swaml::Text`. This replaces the door `Dem.indexOf` ladder with `counters[ordinal(fault)]`.

Views: none. KerML: library operations; intrinsics are `Function`s with host-intrinsic metadata. Keywords: none (Tier 2 adds `enum` to `TypeRef`).

**After.** `var d: real = sqrt(distanceSquared(a, b));` with `import Swaml::Numeric;`; `"page " + intText(page.alertId)`.

**Interactions.** Must not be added to `Swaml::Math` (D5): `DoorEcu` imports `Swaml::Math` and `DoorEcu::Types`, both would export `clampInt`, and the 2.2 model becomes ambiguous (SW2001).

**Cost.** Library S; simulator S (intrinsics); validator S (intrinsic registry, Tier 2 `enum` param M); Ext S (bundled library reference, completion of new packages); docs S (1.5, library listing).

### B5 Logical clock

**Problem.** No read of the current time; models keep counters advanced by periodic entries.

```text
// door, ComStack (lines 613-625)
operation rxMainFunction() {
  /** 20 ms: deadline monitoring, active only while the network is requested (run). */
  if (not rxSeen or not networkActive() or timedOut) {
    return;
  }
  rxAgeMs = rxAgeMs + 20;
  if (rxAgeMs >= rxTimeoutMs) { … }
}
// v2x, V2xMessageService.camCycle (855-857): nowMs = nowMs + 100;
```

**Recommendation: library-only.**

```text
package Swaml::Time {
  operation def now() returns uint { /** Host intrinsic: current logical time in nanoseconds since the run epoch. */ }
}
```

Effect class: **reads state** (not pure), so it is forbidden in attribute initializers and allowed in guards (which may read state), schedule guards, case scripts and concurrent entries. Runtime: the current logical time of the step that evaluates it; zero-cost steps mean consecutive calls in one step return the same value. A value outside the safe `uint` domain is the existing `ClockRange` violation. Determinism unchanged (logical time). Concurrent activations read live time, not the dispatch snapshot (time is not occurrence state); this is stated explicitly. A target backend maps `now()` to a monotonic counter; precision and epoch are target-binding evidence. Views: none. KerML: library `Function` with intrinsic metadata.

**After.**

```text
attribute lastRxNs: uint = 0;
operation rxVehicleStatus(pdu: VehicleStatusPdu) {
  lastRxNs = now();
  …
}
operation rxMainFunction() {
  if (not rxSeen or timedOut) {
    return;
  }
  if (now() - lastRxNs >= rxTimeoutMs * 1ms) {
    timedOut = true;
    …
  }
}
```

(`rxMainFunction` loses `networkActive()` through B19.) In tests: `var t0: uint = now(); send …; on receive … { assert now() - t0 <= 150ms; }`.

**Interactions.** B6 gives the unit (`1ms` is `uint` 1000000). A stale `now()` value captured before a suspension is a legitimate measurement, so SW2011 must not treat it as a stale attribute read (A2). B20 uses it.

**Cost.** Library S; simulator S; validator S (effect class of intrinsic); Ext S; docs S (6.1, library).

### B6 Computed durations

**Problem.** `Duration: value=INT unit=…` is a literal everywhere; configurable periods and backoff use loops of fixed waits, and const attributes holding durations are unused.

```text
// door, LockControl: const attribute pulseMs: uint = 250;  … but the timer is a literal
after 250ms to locked { … }
// v2x, UplinkTransfer.backoff (1373-1387)
interruptible {
  var waited: uint = 0;
  while (waited < delay) {
    wait 250ms;
    waited = waited + 250;
  }
  backoffsCompleted = backoffsCompleted + 1;
  publish ctl.backoffElapsed();
} on receive ctl.backoffAborted() { … }
```

**Recommendation: add.** A `Duration` literal is also an expression of type `uint` with value in nanoseconds (`250ms` = 250000000). Computed durations are a parenthesized `uint` expression at each duration position (section 1):

| Position | Evaluation | Allowed effects | Non-positive / unrepresentable |
| --- | --- | --- | --- |
| `wait (e)` | when the statement runs | any non-suspending | runtime failure `DurationRange` of the activation |
| `or after (e)` | when the receive starts waiting | any non-suspending | runtime failure `DurationRange` |
| state `after (e)` | at the state update, before entry actions | pure or reads state (as guards) | runtime failure of the stateful operation |
| `on every (e)` / `deadline (e)` | once per occurrence at initialization | pure; reads only literals, const attributes and pure calls | SW2007 (statically evaluated per expanded occurrence); `deadline <= period` checked per occurrence |

Static: SW2002 for non-`uint`-assignable expressions; SW2007/SW2008 for effect violations; SW2013 extends to statically evaluated values. Runtime traces record the evaluated duration on `wait`, `receiveWait` and `state` events (`timeoutNs`). Determinism unchanged.

Timing view: declared mode keeps an exact release grid because periods/deadlines are evaluated per occurrence at validation time; `wait`/`after` with expressions are drawn as dynamic intervals labelled with the expression (no length) instead of static intervals. Flow labels show `after (expr)`. KerML: durations become `LiteralInteger` with a nanosecond unit annotation; computed durations are `Expression` features. Keywords: none.

**After.**

```text
after (pulseMs * 1ms) to locked { … }
// v2x: the backoff becomes a timer of the session state machine (with B7)
state Backoff {
  on entry {
    enter(SessionState.backoff);
    backoffs = backoffs + 1;
  }
  after (backoffDelayMs(attempts, backoffBaseMs, backoffCapMs) * 1ms) to Connecting { }
  on receive network.coverage(up) when (not up) to Offline {
    coverageLosses = coverageLosses + 1;
  }
}
```

**Interactions.** Deadline analysis: entry deadlines remain literal or statically evaluated, so a computed `wait` can exceed its entry deadline only at runtime (existing violation). B18: Task `periodNs` uses the same `uint` nanoseconds. B19: guards are not durations. Units are by convention only (D4).

**Cost.** Grammar S; validator M (static evaluation per occurrence, effect rules per position); simulator S; formatter S; projection/Timing M (declared grid from evaluated values, dynamic intervals); Ext M (Timing view `diagram-edit-timing.ts`, schedule entry creation form period/deadline fields accept expressions, Flow timer labels); docs S.

### B7 Completion, guarded timer and result-driven transitions

**Problem.** Transitions fire only on input or `after`; spec 3.6: "There are no transition names, priorities or completion transitions" (removed by the 2.0 transition, `SWAML_2_0_TRANSITION.md` §307: "decisions move into that transition's guards"). A decision that depends on the result of work done in the state cannot be expressed, so v2x splits the session state machine from the worker that makes the request, connected by four events.

```text
// v2x, UplinkSessionManager (1254-1266) + UplinkTransfer.openSession (1357-1368)
state Connecting {
  on entry {
    enter(SessionState.connecting);
    attempts = attempts + 1;
    publish ctl.openRequested(attempts);
  } on receive ctl.opened(id) to Connected {
    sessionId = id;
    sessionsOpened = sessionsOpened + 1;
  } on receive ctl.refused() to Backoff {
  } …
}
// in a second component:
operation openSession(attempt: uint) {
  var id: uint = try(cloud.openSession(vehicleId), 0);
  …
  if (id > 0) { sessionId = id; publish ctl.opened(id); } else { sessionRefusals = sessionRefusals + 1; publish ctl.refused(); }
}
```

**Recommendation: add** a guard-only *completion transition* `when (g) to S { … }` and an optional guard on timers `after D when (g) to S { … }`.

Static (SW2008): a completion transition has a guard and a target (no internal completion); guards are pure or read state (existing rule); a final state has none; reachability includes completion edges; a cycle of states connected only by `when (true)` completion transitions is an error. Order within a state stays declaration order per trigger kind.

Runtime (chapter 6.5 extension). After the entry actions of a state finish, and after every internal reaction (B8), the machine evaluates its completion transitions in declaration order; the first enabled one is taken immediately (exit, effect, state update, entry). Only when none is enabled does it select, as today, the earliest elapsed timer and then queued input. A timer whose guard is false at expiry is consumed for this state entry without a reaction (trace `discardTimer`), and the next timer with equal expiry is tried. Completion guards are not re-evaluated when other activations change attributes; a guard that becomes true later is seen only at the machine's next reaction. Chains of completion transitions run in one logical instant and are bounded by the step budget. Lock: unchanged (the machine holds the lock while reacting; entry may suspend and releases it).

Views: Flow draws a completion transition as an edge without trigger labelled `[g]`; timer guards as `after D [g]`. Sequence unchanged. KerML: completion transition maps to a state-machine reaction without trigger (`TransitionUsage` with guard only, in the proposed semantic library). Keywords: `when` gains the completion production; `to` becomes optional (B8).

**After.**

```text
state Connecting {
  on entry {
    enter(SessionState.connecting);
    attempts = attempts + 1;
    sessionId = try(cloud.openSession(vehicleId), 0);
  }
  when (sessionId > 0) to Connected {
    sessionsOpened = sessionsOpened + 1;
  }
  when (true) to Backoff {
    sessionRefusals = sessionRefusals + 1;
  }
  on receive network.coverage(up) when (not up) to Offline {
    coverageLosses = coverageLosses + 1;
  }
}
```

The session manager now owns the `cloud` port (or a split of it, B12) and `vehicleId`. `openRequested`, `opened`, `refused`, `backoffRequested`, `backoffElapsed`, `backoffAborted` and the second component's session operations disappear (with B6 Backoff above). A coverage loss during the open request stays queued until entry completes and is handled in the next state; this is stated in the model doc.

**Interactions.** Ordered nested transitions: completion first, then elapsed timers, then input; each group in declaration order. B8 internal reactions re-trigger completion evaluation, which makes counting-then-tripping state machines direct (B8 after). B10 is covered. B14 sampled reads and B5 `now()` are allowed in completion guards. A completion transition out of a state with a running request in entry cannot interrupt that request (entry completes first, existing rule). Formal semantics table 9.3 "state reaction" gains the completion step.

**Cost.** Grammar S; validator M (forms, reachability, cycle check); simulator M (`machine()` selection loop); formatter S; projection M (Flow state graph); Ext M (Flow transition kinds in `diagram-flow.ts`, transition creation card: trigger kind receive/timer/completion/internal, reorder gestures unchanged); docs M (3.6, 6.5, 9.3, ADR reversing the 2.0 removal).

### B8 Internal transitions

**Problem.** Every reaction leaves and re-enters its state, restarting timers and re-running entry actions.

```text
// cloud, PersistenceWriter.circuit (1222-1229)
state Open {
  /** Arrivals have no transition here and are discarded; a self-transition would restart the cool-down timer. */
  on entry {
    enter(Breaker.open);
  }
  after 2s to HalfOpen {
  }
}
```

**Recommendation: add.** A transition without `to` is internal: on selection it runs only its effect; no exit, no entry, no state update, timers keep their epoch and generation. A timer transition without `to` fires at most once per state entry. A completion transition requires `to`. Afterwards completion transitions are evaluated (B7). Explicit self transitions keep their 2.2 meaning (exit/entry, timer restart), so existing models are unchanged. Diagnostics SW2008. Trace: `state` event with `internal: true` and the transition source. Views: Flow lists internal transitions inside the state compartment as `trigger / effect`. KerML: reaction with no target state change.

**After.**

```text
state Closed {
  on entry {
    enter(Breaker.closed);
  }
  on receive stream.accepted(t) {
    write(t);
  }
  when (consecutiveFailures >= failureThreshold) to Open { }
}
state Open {
  on entry {
    enter(Breaker.open);
  }
  on receive stream.accepted(t) {
    shed = shed + 1;
  }
  after 2s to HalfOpen { }
}
```

The breaker now trips right after the third failed write instead of "on the next arrival", and shed arrivals are counted without restarting the cool-down.

**Interactions.** Single input owner unchanged (internal transitions are transitions of the same machine). B9: an internal transition on `m` and a deferral of `m` in the same state are mutually exclusive.

**Cost.** Grammar S (shared with B7); validator S; simulator S; formatter S; projection S; Ext S–M (Flow compartment, creation card "internal" option); docs S.

### B9 Deferral

**Problem.** An input without a transition in the current state is discarded (`discardInput` reason `inactiveOwner`), so the cloud router keeps its own waiting ring and a busy flag for the escalation desk.

```text
// cloud, AlertRouter.page / deskFree (1318-1341)
operation page(a: Alert) {
  paged = paged + 1;
  if (not deskBusy) {
    deskBusy = true;
    publish pages.page(a);
  } else {
    if (waitingCount < 4) {
      waiting = WithAlert(waiting, (waitingHead + waitingCount) % 4, a);
      waitingCount = waitingCount + 1;
    } else {
      droppedPages = droppedPages + 1;
    }
  }
}
```

(door: an unlock request during the 250 ms lock pulse is discarded in `locking`.)

**Recommendation: add** `defer p.m, …;` inside a state; `defer` is contextual.

Static (SW2008): each endpoint is an input member owned by this stateful operation's transition set; a state cannot both defer `m` and have a transition on `m`; a final state defers nothing; a deferred member must be handled by some transition in the machine (otherwise it could never be consumed).

Runtime: while the machine is in a state that defers `m`, input for `m` stays in its connection queue instead of being discarded. FIFO order per queue is preserved; retained input occupies capacity, so later offers obey the connection's overflow policy and `maxAge` discards at eligibility (all existing, observable). When the machine enters a state with a transition on `m`, it consumes the oldest retained input first; when it enters a state that neither handles nor defers `m`, retained input is discarded at its next wait (`discardInput`, reason `inactiveOwner`) as today. Attributes keep only their latest pending value. Trace: `defer` event once per retained message. Determinism unchanged.

Views: Flow lists `defer m` in the state compartment; Sequence shows the message delivered later (no change to the message identity). KerML: deferred trigger metadata on the state. Keywords: `defer` (contextual, production `Deferral`).

**After.**

```text
// EscalationDesk
state Paging {
  defer pages.page;
  on entry { … }
  …
}
state Escalated {
  defer pages.page;
  …
}
// AlertRouter.page
operation page(a: Alert) {
  paged = paged + 1;
  publish pages.page(a);
}
```

with `connect paging: PageBacklog (router.pages, desk.pages);` where `PageBacklog` has `capacity = 4; overflow = Overflow.dropNewest;` (drops become observable overflow events instead of a counter). `deskBusy`, `waiting`, `waitingHead`, `waitingCount`, `deskFree`, `WithAlert` go away. Door `state locking { defer requests.request; … }`.

**Interactions.** A5 (SW2012 on interrupt regions) is a different mechanism; deferral is states only. B8 exclusivity. B13: the member's effective policy governs retained capacity.

**Cost.** Grammar S; validator S; simulator M (do not discard while deferred; consume retained input on state change); formatter S; projection S; Ext S–M (Flow compartment, completion of `defer` endpoints, creation card); docs S.

### B10 Entry action picks a transition

**Problem.** An entry action cannot choose the next state from its own result.

```text
// door, ModeManager (1140-1151)
state sleep {
  on entry {
    var stored: bool = try(nvm.writeAll(), false);
    nvmStored = stored;
    sleeps = sleeps + 1;
    announce(PowerMode.sleep);
  }
  on receive wake.request(source) to wakeup { lastWake = source; }
}
```

**Recommendation: covered by B7** (no separate construct). Entry writes an attribute; completion transitions decide. Entry locals stay invisible to transitions (no capture, unchanged).

**After.**

```text
state shutdown {
  on entry {
    nvmStored = try(nvm.writeAll(), false);
  }
  when (nvmStored) to sleep { }
  when (true) to postRun {
    writeAllFailures = writeAllFailures + 1;
  }
}
state sleep {
  on entry {
    sleeps = sleeps + 1;
    announce(PowerMode.sleep);
  }
  on receive wake.request(source) to wakeup { lastWake = source; }
}
```

**Cost.** Included in B7.

### B11 Multiplicity

**Problem.** (a) Tests cannot inspect `twins[0]` (ADR 0020: "intermediate component indexes remain unsupported"); the cloud model adds a separate top-level `writer` to test the breaker. (b) No port arrays/connector loops (spec 1.2, `SWAML_2_0_TRANSITION.md` §41), so the router owns `slot0`/`slot1` and selects by `if`. (c) No per-index configuration.

```text
// cloud, TelemetryRouter.route (863-875)
if (t.slot == 0) {
  routed = routed + 1;
  publish slot0.reading(t);
} else {
  if (t.slot == 1) { routed = routed + 1; publish slot1.reading(t); } else { unroutable = unroutable + 1; }
}
```

**Recommendation.** (a) **add**: in test inspection paths a component multiplicity segment may carry a literal index, for reads (`ReferenceExpression`, B2 grammar) and helper calls (`CallExpression` target becomes `Path`). Rules: index literal in range (SW2010); only in test scripts; same ADR 0020 helper restrictions. (b) **reject, keep by design**: dynamic port selection is dynamic topology, which breaks static closure, per-connection queues and per-package analysis (spec §2 "no dynamic topology", ADR 0019). The model keeps one port per partition. (c) **reject**: multiplicity means identical replicas; declare distinct usages when configuration differs (`component puddle: CourtesyLamp { redefines const attribute stepPercent: uint = 10; }`).

**After.**

```text
test 'Silent vehicle detected offline' of backend {
  …
  assert backend.twins[0].link == LinkState.offline;
  var view: VehicleView = backend.twins[0].currentView();
  assert view.vehicleId == "TRK-101";
}
```

(A call result is not followed by selectors; that would need a further `CallExpression` change and is not proposed.)

**Interactions.** B2 grammar. Case/Sequence views: white-box lifelines may now be indexed parts. The existing reference limit "white-box paths follow single parts" is lifted for tests.

**Cost.** Grammar S; validator S (`testAccessRoots` index); simulator S; Ext S–M (`test-inspection.ts`, `testCanAccess`, completion after `twins[`); docs S (3.7, ADR 0020 amendment).

### B12 Boundary port forwarded to several children (Tier 2)

**Problem.** "Each boundary and child port is forwarded at most once" (spec 2.3), so a service whose members are served by different children needs one boundary port per child.

```text
// cloud, CommandService (1602-1619)
port api: CommandApi;
reversed port directory: VehicleLookup;
port downlink: CommandDownlink;
reversed port acks: CommandAcks;
…
connect (api, intake.api);
connect (downlink, tracker.downlink);
connect (acks, tracker.acks);
```

**Recommendation: add (member split)** without syntax: a boundary port may be forwarded to several immediate child ports when its members are partitioned among them. Rules (SW2004): every boundary member is supplied by exactly one forwarded child port with preserved direction and compatible payload; every requires member of each child port appears in the boundary; a child port is still forwarded at most once; required attributes/operations still have exactly one peer after resolution. Runtime: alias resolution is per member; no queue or hop added. Fan-out of one member to several children stays rejected (use connections inside). Views: Interconnect draws one forwarding edge per child labelled with its member subset. KerML: per-member alias projection (already per-member in 5.1).

**After.** `port vehicleSide: CommandVehiclePort;` with `connect (vehicleSide, tracker.vehicleSide); connect (vehicleSide, intake.vehicleSide);` where the child port definitions hold disjoint member subsets.

**Interactions.** B13: a member policy names a member of the connection, independent of the split.

**Cost.** Validator M (`connectionRoutes`, closure); simulator S; Ext M (Interconnect edge labels, forwarding creation that offers member subsets); docs S.

### B13 Policy per member

**Problem.** One `qos def` per connection; a bus with event frames and cyclic signals needs different policies per member.

```text
// door, DoorEcu::Interfaces (163-174) and the package connection
qos def BodyCanFrames: Policy {
  /** Body CAN: event-triggered frames are queued and retransmitted until acknowledged;
      cyclic frames are attributes and always keep only their latest value. */
  delivery = Delivery.atLeastOnce; ordering = Ordering.fifo; capacity = 8; overflow = Overflow.reject; requestTimeout = 1s; maxLatency = 5ms;
}
connect bodyCan: BodyCanFrames (bcm.bus, dcu.canBus);
```

**Recommendation: add** an optional body `{ member: Policy; … }` on `connect` (section 1). Static (SW2004/SW2013): forwarding cannot have member policies; each member names a member of the connected port pair present on both sides after compatibility; at most once per member; the effective policy of a member is its member policy, else the connection policy, else `Default`; idempotency obligations are checked per member against its effective policy. Runtime: queue identity is already per connection occurrence, direction and member; the effective policy is looked up per member. Normalized model 7.3 records the effective policy per member route. Views: Interconnect shows member policies in the connection label/tooltip; Grid adds a column. KerML: `MemberPolicy` → `value` binding on the connector's member projection. Keywords: none.

**After.**

```text
connect bodyCan: BodyCanFrames (bcm.bus, dcu.canBus) {
  crash: CanEvent;
  centralLock: CanEvent;
  lockStatus: CanEvent;
  vehicleStatus: Latest;
}
```

**Interactions.** B9 retained capacity; B12 independent. A per-member `requestTimeout` applies to operation members.

**Cost.** Grammar S; validator S–M; simulator S; formatter S; Ext M (Interconnect labels, connection property editor, creation card field with server completion of member names); docs S.

### B14 Synchronous read of a required attribute

**Problem.** A required attribute can only be consumed by its single owner, so every reader caches it through a receive-triggered operation.

```text
// door, LockControl (1704-1709, 1718-1723)
operation setAjar(value: bool) { ajar = value; }
operation setFeedback(value: bool) { switchLocked = value; }
…
on receive door.ajar(value) setAjar(value);
on receive feedback.lockSwitchLocked(value) setFeedback(value);
```

**Recommendation: add** *sampled reads*: inside an operation (not a case script), the value path `p.m`, where `p` is an owned port and `m` a required attribute member from this side, reads the member's sample cell.

| Aspect | Rule |
| --- | --- |
| Cell | Each port occurrence × required attribute member that is sampled anywhere in the component has one sample cell, updated with the delivered value at delivery eligibility (after latency and faults), independent of consumption. |
| Initial | `requires`/`provides attribute m: T = e;` gives the cell's initial value (pure initializer, assignable; meaningful only for the receiving side). Without it, a read before the first delivery is a runtime failure (`unavailable`), catchable by `try`. |
| Owners | Sampling is not consumption. The member has either exactly one consuming owner (as today) or none when it is sampled (SW2005 counts sampling as ownership for provenance). |
| Effects | A sampled read is a state read: allowed in guards, schedule guards (B19), completion guards; concurrent entries read the dispatch snapshot of the cell; serial resumption reads the live cell. |
| Name resolution | Lexical-first: a live local/parameter wins; component members share one namespace, so an attribute and a port cannot have the same name. |

Runtime trace: `deliver` events into a cell carry `sample: true`; reads are not traced (like attribute reads). Views: Flow shows the read in statement text; Interconnect/Sequence unchanged (the message arrow already exists); Grid lists sampled members. KerML: the cell is a feature of the port occurrence, reads are feature reads. Keywords: none.

**After.**

```text
port def ModeState { provides attribute current: PowerMode = PowerMode.startup; }
…
on receive requests.request(command) when (command == LockRequest.lock and not door.ajar) to locking { }
…
operation checkFeedback(expectLocked: bool) {
  publish diag.report(FaultId.lockActuator, feedback.lockSwitchLocked != expectLocked);
}
```

(`port def DoorAjar { provides attribute ajar: bool = false; }`, `port def LockFeedback { provides attribute lockSwitchLocked: bool = false; }`; `setAjar`, `setFeedback`, `ajar`, `switchLocked` and two schedule entries disappear.)

**Interactions.** I3 (single input owner) is refined, not weakened: one consumer at most, any number of readers in the owning component. Stale reads (A2): a sampled read before suspension is a state read. B19 uses it for modes. Attribute queue replacement semantics unchanged.

**Cost.** Grammar S (initial); validator M (resolution, owner rule, effects); simulator M (cells, snapshot); Ext M (completion of `port.member` in expressions and guards, hover, owner diagnostics, Flow labels); docs M (2.1, 3.1, 6.4, 9.2).

### B15 Reserved words as member names

**Problem.** `view`, `state`, `out` are reserved; names are quoted or bent.

```text
// v2x, UplinkSessionManager (1236)
attribute sessionState: SessionState = SessionState.offline;
```

**Recommendation: add** `view`, `state`, `in`, `out` (and the new `defer`) to the contextual words (grammar `Name`). Purely additive. Tools still write quoted names only where a basic name is illegal (`names.ts` reserved list shrinks). TextMate keeps highlighting them in keyword positions only where feasible.

**After.** `attribute state: SessionState = SessionState.offline;`

**Cost.** Grammar S; `names.ts` S; parser ambiguity tests S; Ext S (`swaml-name.ts` spelling, TextMate); docs S (1.1).

### B16 Associations per pair; absence assertions

**Problem.** One line per actor/case pair (28–30 lines per model).

```text
// cloud (2111-2120)
associate truck to 'Monitor live position';
associate alderDispatcher to 'Monitor live position';
associate truck to 'Command a vehicle';
associate alderDispatcher to 'Command a vehicle';
…
```

**Recommendation.** **Add** the list form (cross product, section 1). Every pair obeys the existing SW2010 rules; a duplicate pair, also across statements, is an error at the later reference. Rename/projection edit each reference. Case view: unchanged edges. KerML: one association link per pair. **Keep** the absence idiom: absence is only decidable within a bounded interval, which `on receive … { fail "…"; } or after D { }` states explicitly.

**After.** `associate truck, alderDispatcher to 'Monitor live position', 'Command a vehicle', 'Run a firmware campaign';`

**Cost.** Grammar S; validator S; formatter S; Ext S–M (`case-model.ts`, rename, associate creation/removal edits must split a list instead of deleting a line); docs S.

### B17 Runnable-level deployment

**Problem.** Placements target component occurrences; a component whose operations run in different tasks cannot be split.

```text
// door (2384-2406); IoHwAb has a 5 ms task (protect) and event-triggered acquire/distribute
deploy ioHwAb on doorModules[0].core0.task5ms;
deploy com on doorModules[0].core1.task20ms;
```

**Recommendation: add (semantic only).** A placement path may end at an operation of a component occurrence (`deploy ioHwAb.protect on …;`, existing `Path` grammar). Static (SW2009): the operation is the target of at least one effective schedule entry of that occurrence; the placement applies to every activation released by those entries; called operations run in their caller's activation and placement; an operation placement overrides the occurrence's placement; exact-path uniqueness applies. Runtime: the serial lock stays per component occurrence across tasks (cross-task contention appears as lock gaps, like an AUTOSAR exclusive area); placements are recorded per activation (`release`/`dispatch` events get `placement`). Placement granularity is the operation, not the individual schedule entry (D13). Views: General (deployment) draws operation-to-Node edges; Timing groups lanes by Task (B18). KerML: deployment metadata on the operation occurrence.

**After.**

```text
deploy ioHwAb on doorModules[0].core0.taskEvent;
deploy ioHwAb.protect on doorModules[0].core0.task5ms;
deploy com on doorModules[0].core1.task20ms;
deploy com.rxVehicleStatus on doorModules[0].core0.taskEvent;
```

**Interactions.** B18 gives placement scheduling meaning. Occurrence placement and specificity rules are unchanged for components.

**Cost.** Validator S; simulator S (placement per activation); projection S; Ext M (deployment edges and placement creation that offers operations, Timing grouping); docs S (4.1).

### B18 Task period, priority, preemption, budget

**Problem.** Task attributes are plain const attributes without meaning; the model documents an OS schedule that the run ignores.

```text
// door (2297-2312)
component def OsTask specializes Process {
  /** An OS task: activation period (0 = event-triggered) and priority (higher wins). */
  const attribute periodUs: uint = 0;
  const attribute priority: uint = 0;
}
component def SafetyCore specializes Partition {
  component task5ms: OsTask {
    redefines const attribute periodUs: uint = 5000;
    redefines const attribute priority: uint = 30;
  }
  …
}
```

**Recommendation.** Tier 1 **library + static meaning + ordering**; Tier 2 **timed profile** (D10).

```text
package Swaml::Os {
  import Swaml::Platform;
  component def Core specializes Node { }
  component def Task specializes Process {
    const attribute priority: uint = 0;
    const attribute periodNs: uint = 0 /** 0: no period constraint (event-triggered or mixed). */;
  }
}
```

Tier 1 static (SW2009): Task priorities are unique among the Tasks of one Core (nearest `Core` ancestor; Tasks without one compete per platform root); every `on every` entry released on a Task with `periodNs > 0` has a period that is a positive multiple of `periodNs`; placements are on Tasks or ordinary Nodes as before. Tier 1 runtime: at equal logical time and phase, pending dispatches and ready continuations of activations placed on Tasks are ordered by descending Task priority, then by the existing insertion ordinal; unplaced activations have priority 0. With zero-cost steps this is the only observable effect; preemption and budgets have no meaning in the zero-cost profile and the documentation says so.

Tier 2 (follows): a **target binding** file (not source, per ADR 0016) supplies execution-cost assumptions per operation (and optionally per entry), plus `preemptive` and `budgetNs` per Task. A separate profile `swaml-reference-timed/2.x` runs fixed-priority scheduling per Core with costs: activations consume CPU time, a higher-priority release preempts at statement boundaries on preemptive Tasks, budget overruns and deadline misses are violations. Results are evidence under recorded cost assumptions, never schedulability proof.

Views: General shows Cores/Tasks as Nodes; Timing declared mode groups lanes by Task and orders them by priority; observed mode (Tier 2) shows CPU occupancy per Core. KerML: library definitions.

**After.**

```text
import Swaml::Os;
component def SafetyCore specializes Core {
  component taskEvent: Task { redefines const attribute priority: uint = 40; }
  component task5ms: Task {
    redefines const attribute priority: uint = 30;
    redefines const attribute periodNs: uint = 5ms;
  }
  …
}
```

**Interactions.** B17 placement; B6 `uint` nanoseconds; B19 guards skip releases on a Task's grid; A4 (per-model simulation options) is needed so the door model can use a 1 ms task without the default 100 000 step limit.

**Cost.** Tier 1: library S; validator S; simulator S–M (priority key in the event order); Ext M (Timing lanes by Task, deployment view). Tier 2: simulator L (cost model, per-core scheduler, preemption, profile), binding schema M, Timing observed CPU lanes M, docs M.

### B19 Mode-dependent schedules

**Problem.** Periodic entries keep releasing; each operation checks a cached mode.

```text
// door, LinMaster (701-708, 733-735, 741-746)
operation pollSwitchPanel() {
  /** 20 ms schedule-table slot: … no headers while asleep. */
  if (sleeping) {
    return;
  }
  …
}
operation onMode(current: PowerMode) { sleeping = current == PowerMode.sleep; }
schedule {
  on every 20ms pollSwitchPanel() deadline 2ms;
  …
  on receive modeIn.changed(current) onMode(current);
}
```

**Recommendation: add** a release guard `when (g)` on `every`, `receive` and `after` entries (SW2007 on `start` and `call`: a request must be answered by the operation). Static: `g` is `bool`, pure or reads state (attributes, sampled reads, `now()`). Runtime: the guard is evaluated at dispatch, under the serial lock (or in the concurrent snapshot), after argument evaluation. When false: no activation runs, no deadline is armed, no `after` successor is released, a `skip` event names the entry; for `receive` entries the consumed input is discarded (`discardInput`, reason `releaseGuard`). Periodic grids are unchanged (releases stay at kD from the root epoch; a skipped release is not shifted). Trace and Timing: declared mode draws guarded entries with their guard label; observed mode shows skip markers. KerML: guard constraint on the schedule entry trigger.

**After.**

```text
reversed port mode: ModeState;
schedule {
  on every 20ms pollSwitchPanel() when (mode.current != PowerMode.sleep) deadline 2ms;
  on receive bus.response(response) onResponse(response) deadline 2ms;
  on receive bus.wakeup() onWakeup();
  on every 100ms reportDiagnostics() when (mode.current != PowerMode.sleep);
}
```

(`sleeping`, `onMode` and the early returns disappear; `onWakeup` tests `mode.current == PowerMode.sleep`.)

**Interactions.** After chains: a skip releases nothing. Suspension: dispatch waits for the lock as today, so the guard sees the state at dispatch, not at release. Deadlines: none for skipped releases. B14 supplies the mode without a cache. B18 grid per Task unaffected.

**Cost.** Grammar S; validator S; simulator S; formatter S; Ext M (schedule entry creation form guard field with server completion, Timing declared/observed markers); docs S.

### B20 End-to-end latency chain (defer)

**Problem.** Chains are Timing view selections plus QoS `maxLatency` and script assertions.

```text
// v2x (2218-2223)
view 'awareness chain': Timing {
  include app.vehicleState.onSpeed;
  include app.v2x.camCycle;
  include app.security.signDigest;
  include app.channels[0].transmit;
}
```

**Recommendation: defer.** A declarative chain (`stimulus`, `response`, `within D`) needs a causal correlation across activations that the trace does not yet define for local fan-in (periodic sampling breaks message causality) and an analysis level (A) with stated assumptions; done badly it would read as a proof. With B5 the bounded check is expressible now in tests; the Timing view keeps the selection. Sketch for a later edition: package member `chain Name { from p.m; to q.n; within 150ms; }`, checked against observed traces only.

**After (now).**

```text
var t0: uint = now();
send vehicleBus.signals.speedMps(speed);
on receive otherVehicle.cch.frameOut(frame) {
  assert now() - t0 <= 150ms;
} or after 150ms {
  fail "no awareness message within 150 ms of a speed change";
}
```

**Cost.** None in this version.

### B21 Service discovery (reject)

**Problem.** Adaptive offer/find is dynamic binding of service instances.

**Recommendation: reject, keep by design.** Dynamic topology is outside the language (spec §2; closed packages, ADR 0019; static closure and per-connection queues, I1/I5). Model each potential provider binding as a static (optionally `optional`) connection and expose availability as data: `provides attribute available: bool = false;`, read with B14 and used in guards (B19). An unconnected optional request already fails `unavailable`.

## 3. Cross-item interactions (checklist)

| Rule | Interaction |
| --- | --- |
| In-place assignment vs const/in | Rejected roots (B1). |
| Snapshots / stale reads | Concurrent entries still never write (B1); sampled reads and guards use the dispatch snapshot (B14, B19); `now()` is live (B5). A2 must make SW2011 flow-sensitive over places and treat `now()` as non-stale. |
| Computed durations vs deadline analysis | Periods/deadlines statically evaluated per occurrence (exact declared grid); `wait`/`after` expressions are dynamic intervals; runtime deadline violations unchanged (B6). |
| Guards/completion vs ordered transitions | Completion → elapsed timers → input; declaration order within each (B7). |
| Internal transitions vs timers | No restart; once per entry for internal timers (B8). |
| Deferral vs queues | Retained input uses connection capacity/overflow/age (B9, B13). |
| Runnable deployment vs occurrence placement and Timing | Operation placement overrides; lock per component; Timing lanes per Task (B17, B18). |
| Mode-dependent schedules vs after chains and suspension | Skip releases no successors; guard at dispatch under lock (B19). |
| Formatter (A1) | Must support conditional, places, connect bodies, deferrals, guarded entries, association lists before any showcase rewrite is reformatted. |
| SW2012 (A5) | Unrelated to deferral; states never produce SW2012. |

## 4. Scope

### Tier 1 — in 2.3

B1, B2, B3, B4 (numeric/text/time libraries), B5, B6, B7 (+B10), B8, B9, B11a, B13, B14, B15, B16, B17, B18 (library, static rules, priority ordering), B19.

Reasoning: these remove every rebuild helper, counter clock, cached mode, second component and unused const duration in the three models, and give the door controller a task/runnable mapping whose periods, priorities and mode gating are validated and visible in the run. Each is small in grammar and local in semantics; none changes the meaning of a valid 2.2 source.

### Tier 2 — can follow (2.4 or later)

B4 enum pseudo-type (`ordinal`, `literalText`), B12 member-split forwarding, B18 timed profile (cost binding, preemption, budgets), B20 latency chains.

Reasoning: each needs a new concept (an any-enum parameter, per-member alias resolution, a cost model and scheduler, causal chains) with its own review, and each has a usable Tier 1 workaround.

### Rejected

B11b port arrays/connector loops, B11c per-index configuration, B16 absence construct, B21 service discovery.

### Owner decisions

| # | Question | Recommendation | Alternative |
| --- | --- | --- | --- |
| D1 | Release these as standard 2.3 (compatible minor)? | Yes, 2.3. | 3.0 if any compatibility break is accepted. |
| D2 | Implementation package 4.0.0 (AST properties become optional)? | 4.0.0. | 3.2.0, keeping the old properties required by using new property names for every alternative. |
| D3 | Reintroduce state completion transitions in guard-only form (reverses a 2.0 removal)? | Yes. | Only timer guards and internal transitions; result-driven branching stays two components. |
| D4 | Durations as `uint` nanoseconds? | Yes (smallest). | A nominal `duration` type with its own arithmetic (safer, more rules and keywords). |
| D5 | Library additions in new packages (`Swaml::Numeric`, `Swaml::Text`, `Swaml::Time`, `Swaml::Os`)? | Yes, strictly compatible. | Extend `Swaml::Math`/`Swaml::Platform` and accept import ambiguities in existing models (the door model breaks). |
| D6 | Trigonometry intrinsics with host last-bit variance? | Include `sin`, `cos`, `atan2` with the documented caveat. | `sqrt` only. |
| D7 | Initial value on attribute port members for sampled reads? | Yes, optional `= e`. | No initializer; every early read uses `try`. |
| D8 | Deferral disjoint from transitions on the same member? | Yes. | UML-style deferral with guard re-evaluation pool (complex ordering). |
| D9 | Skipped periodic releases keep the root-epoch grid? | Yes. | Restart phase when the guard becomes true (needs change detection). |
| D10 | Execution costs live in a target-binding file, not source? | Yes (ADR 0016). | `cost`/`budget` attributes in source. |
| D11 | Unique Task priorities per Core? | Yes. | Equal priorities with FIFO tie-break. |
| D12 | Keep port arrays and connector loops out? | Yes. | Plan them for 3.0 with static expansion. |
| D13 | Placement granularity per operation? | Yes. | Per schedule entry (requires entry names, new syntax). |
| D14 | Enum pseudo-type in Tier 1? | No, Tier 2. | Tier 1 (removes `Dem.indexOf` now). |

## 5. Versioning and release

| Artefact | Value |
| --- | --- |
| Standard (`spec/standard.json`) | 2.3 (compatible normative additions; tags show `v2.2` published, no `v2.3`) |
| Parser/host semantics, profile | 2.3, `swaml-reference/2.3` (Tier 2 timed profile: separate id) |
| Implementation npm | 4.0.0 (D2), root and lockfile synchronized |
| Extension | own version per its `docs/VERSIONING.md`; `UPSTREAM.json` pin via `scripts/sync-language.mjs` |
| ADRs | 0022 expressions and places (B1–B6, B11a, B15, B16); 0023 state reactions (B7–B10, reverses `SWAML_2_0_TRANSITION.md` §307); 0024 ports and policies (B13, B14); 0025 tasks and runnable deployment (B17–B19) |
| Release notes | `docs/RELEASE_2_3.md`; no migration guide needed |

Publication gate (docs/VERSIONING.md, PDF_PUBLICATION.md): regenerate `spec/keywords.json`, `spec/notation.json`, `spec/kerml-mapping.json` (new productions: `Selector`, `ConditionalExpression`, `Deferral`, `MemberPolicy`; changed: `Assign`, `ReferenceExpression`, `CallExpression`, `Literal`, `Wait`, `Receive`, `ScheduleEntry`, `Transition`, `State`, `Connect`, `PortMember`, `Association`, `Name`); new notation figures under `docs/notation/2.3/` (completion/internal transition and deferral in Flow, guarded entry and Task lanes in Timing, member policy in Interconnect, runnable placement in General); graphical examples regenerated with `--check`; `npm run docs:build` → `docs/SWAML-2.3-Reference.md`; `SWAML-2.3-Specification.pdf` + manifest + sha256 with every page inspected; showcase site data (`build-showcase-data.mjs`) including the three rewritten showcase models; 2.2 artefacts untouched.

### Staged implementation plan

Each package is one draft PR with its adversarial review; order respects dependencies (one at a time, merged before the next).

| WP | Content | Depends | Tests | Showcase proof |
| --- | --- | --- | --- | --- |
| 0 | ADRs 0022–0025, chapter drafts, `## Unreleased`; edition bump to 2.3 / 4.0.0 at WP 9 | — | docs check | — |
| 1 | Places and selectors (B1, B2, B11a), `CallExpression: Path` | — | parse/recovery; mutability, out definite assignment, bounds, trace `place`, copy semantics, test indexed reads | Dem `report`, cloud `findOpen`, twins test |
| 2 | Conditional expression, contextual words, association lists (B3, B15, B16) | — | ambiguity tests per word/position, lazy branch, typing, list duplicates, rename of list refs | door `drive`, v2x `state`, cloud associations |
| 3 | Libraries `Swaml::Numeric`, `Swaml::Text`, `Swaml::Time` (B4, B5) | — | intrinsics domains/failures, `now()` effect class, no import ambiguity in 2.2 examples | v2x `sqrt`, ComStack timeout |
| 4 | Durations as values and computed durations (B6) | 3 | per-position effect rules, static per-occurrence evaluation, `DurationRange`, Timing declared grid | LockControl pulse, v2x backoff timer |
| 5 | State reactions: completion, timer guard, internal, defer (B7–B10) | 4 | selection order, cycle check, timer non-restart, retained queue/overflow/age, discard on leaving | v2x session machine, breaker, desk/router, ModeManager shutdown, LockControl |
| 6 | Sampled reads and member policies (B14, B13) | — | cell timing with latency/faults, initial/unavailable, owner rule, snapshots, per-member queues/idempotency | LockControl ajar/feedback, BodyCan |
| 7 | Schedule guards (B19) | 6 | skip trace, no deadline/after release, receive discard, grid | LinMaster, ComStack, IoHwAb |
| 8 | Runnable placement and `Swaml::Os` (B17, B18 Tier 1) | 4, 7 | placement validation, override, priority ordering at equal time, period multiples | door deployment |
| 9 | Edition: inventories, notation, reference book, showcase rewrites, site data, PDF | 1–8 | `npm run check`, figure `--check`, PDF gate | all three models |
| E1–E3 | Ext: sync, then (E1) text services/completion/creation forms for WP 1–4; (E2) Flow/Sequence for WP 5–6; (E3) Timing/Interconnect/deployment for WP 6–8; `npm run test:creation` | language WP merged | ext `npm run check`, `test:web`, creation suite | showcase views reviewed in the preview editor |

## 6. What still will not be expressible

| Topic | Status after 2.3 |
| --- | --- |
| Physical execution time, WCET, preemption effects | Zero-cost reference only; Tier 2 timed profile gives assumption-based evidence, never a schedulability proof. |
| OS configuration (alarms, counters, resources/spinlocks, ISR categories, stack sizes, OS-Applications, timing protection enforcement) | Target binding / configuration tools; swa.ml supplies tasks, priorities, periods, runnable mapping and mode gating as input. |
| Interrupt service routines and hardware interrupt latency | Interrupt regions are cooperative model cancellation (ADR 0011). |
| CAN/LIN signal packing (bit position, length, endianness, scaling), PDU layout, E2E profiles, DBC/LDF/ARXML | Out of scope: data are typed records; packing belongs to the communication configuration and code generator. |
| Fixed-width integers, bitfields, fixed-point arithmetic, overflow-wrapping counters | Not in the value domain (safe 53-bit integers, checked overflow). Wrapping is modelled with `%`. |
| Memory mapping, sections, NvM block layout, calibration (A2L) | Out of scope. |
| Code generation, RTE generation | Out of scope for the language; a backend must preserve chapter 6 semantics and report unsupported parts. |
| Dynamic topology, service discovery, port arrays, dynamic instances | Rejected by design. |
| Per-schedule-entry placement, per-index configuration | Not expressible (D13, B11c). |
| Declarative end-to-end latency contracts | Deferred (B20); bounded checks in tests only. |
| Proof of race freedom, termination, schedulability | Not claimed; runs are bounded evidence. |

The line: swa.ml 2.3 can describe the door controller's software architecture, its behaviour, its communication policies and its OS-level task/runnable/mode schedule precisely enough that a target generator has no open design decision about *what* runs *when* and *where*. *How* bytes are laid out, how the OS is configured in a vendor format and what code is emitted are target-binding concerns with their own evidence.
