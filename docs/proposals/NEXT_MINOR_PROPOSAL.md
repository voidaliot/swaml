# swa.ml next minor (2.3): language gaps from the showcase models

**Design record.** The owner approved this proposal. The normative decisions are ADRs [0022](../decisions/0022-values-places-and-expressions.md), [0023](../decisions/0023-state-reactions.md), [0024](../decisions/0024-communication-and-package-links.md) and [0025](../decisions/0025-real-time-placement-and-binding.md), with the rules to implement in the [2.3 chapter drafts](../drafts/2.3/README.md). Where they differ from this proposal, the ADRs are normative. Changes include separate warning codes SW2016–SW2018 instead of one shared SW2016, and the state-machine rule T4.

**Status:** design proposal for owner approval, revision 2 (after the adversarial review of 17 November 2026). Not normative. Nothing here changes the grammar, validator, standard version or a published artefact.

**Bases:**
- **Language:** swa.ml 2.2 (`v2.2` published; `spec/standard.json` 2.2; implementation 3.1.0; profile `swaml-reference/2.2`), main `e6fd783`.
- **Evidence:** branch `showcase/all` at `cc16c25`. Door = `autosar-classic-door-controller.swaml` (3,479 lines), v2x = `autosar-adaptive-v2x-telemetry.swaml` (2,726), cloud = `cloud-fleet-monitoring.swaml` (3,136). Line numbers refer to that commit.

Item numbers B1–B21 follow the limitation list; A1–A7 are tool defects. Recommendation labels: **add**, **library-only**, **reject** (keep by design), **defer**.

## 0. One-page summary

### Tier 1 (2.3) and Tier 2 (later)

| Item | Recommendation | Tier | One line |
| --- | --- | --- | --- |
| B1 element/field assignment | add | 1 | `statuses[index].confirmed = true;` |
| B2 index then member | add | 1 | `recent[i].vehicleId == vehicle` |
| B3 conditional expression | add (whole-expression only) | 1 | `counter = clampInt((if (previous < 0) 0 else previous) + stepUp, …);` |
| B4 numbers and text | library-only: `sqrt`, integer min/max/clamp, `intText`/`realText`/`boolText` | 1 | `distanceM = sqrt(d2)` |
| B4 trigonometry | library swa.ml source (bit-reproducible) | 2 | `Swaml::Numeric::sin(x)` |
| B4 enum ordinal/text | add an `enum` parameter type, allowed only in library operations | 2 | `counters[ordinal(fault)]` |
| B5 logical clock | library-only `Swaml::Time::now()` | 1 | `lastRxNs = now();` |
| B6 computed durations | add; a duration literal is a `uint` in ns; `every`/`deadline` take a constant sublanguage | 1 | `after (ownHazardValidityMs * 1ms) to Idle { }` |
| B7 + B10 completion, guarded timers | add (guard-only completion transitions) | 1 | `when (sessionId > 0) to Connected { }` |
| B8 internal transitions | add (transition without `to`) | 1 | `on receive stream.accepted(t) { write(t); }` |
| B9 deferral | add (`defer`, still usable as a name) | 1 | `defer requests.request;` |
| B11 indexed parts in tests | add (literal index) | 1 | `assert backend.twins[0].link == LinkState.offline;` |
| B12 one boundary port to several children | add (member split) | 2 | no instance left in the revised models |
| B13 policy per member | add | 1 | `connect bodyCan: BodyCanFrames (bcm.bus, dcu.canBus) { crash: CanEvent; }` |
| B14 sampled read of a required attribute | add (mandatory initial value) | 1 | `ajar = door.ajar;` |
| B15 `view`/`state`/`in`/`out` as names | add (contextual) | 1 | `attribute state: SessionState = …;` |
| B16 association lists | add | 1 | `associate truck, alderDispatcher to 'Monitor live position', 'Command a vehicle';` |
| B17 operation-level deployment | add (no new syntax) | 1 | `deploy comMain.storePdu on doorModules[0].core1.isrCan;` |
| B18 tasks | add `Swaml::Os`, static rules, priority and in-task order, binding schema | 1 | `component task20ms: Task { redefines const attribute periodNs: uint = 20ms; }` |
| B18 timed run | binding-driven, fixed-priority scheduling per Core | 2 | `swaml simulate --binding door.binding.json` |
| B19 mode-dependent schedules | add release guard; a skip counts as completion for `after` successors | 1 | `on every 20ms slot() when (mode.current != PowerMode.sleep) deadline 2ms;` |
| B20 latency chains | defer; measurable in tests now | 2 | `assert now() - t0 <= 150ms;` |
| B21 service discovery | reject | — | static optional connection plus an availability attribute |

Rejected:
- B11 port arrays and connector loops for 2.3 (additive candidate for 2.4)
- B11 per-index configuration
- B16 absence construct
- B21

### Owner decisions (final recommendations)

| # | Question | Recommendation | Alternative |
| --- | --- | --- | --- |
| D1 | Release as standard 2.3? | Yes. Compatibility is shown by the corpus AST-identity gate (§1.2). | 3.0. |
| D2 | Implementation package 4.0.0? | Yes, because existing AST properties silently widen (§1.3). | 3.2.0 only with parallel new node types for every widened form. |
| D3 | Reintroduce completion transitions (guard-only)? | Yes, with the B7 restrictions. | Timer guards and internal transitions only. |
| D4 | Durations as `uint` ns? | Yes, plus the SW2016 unit warning. | Nominal `duration` type. |
| D5 | Library additions in new packages? | Yes: `Swaml::Numeric`, `Swaml::Text`, `Swaml::Time`, `Swaml::Os`. | Extend `Swaml::Math`/`Swaml::Platform`, which breaks the door model (`clampInt`). |
| D6 | Intrinsics? | `sqrt` is the only new intrinsic; trigonometry as swa.ml source in Tier 2. | Trigonometry intrinsics with host variance. |
| D7 | Initial value for sampled members? | Mandatory for every sampled member. | Optional, so early reads fail. |
| D8 | Deferral vs transitions on the same member? | Disjoint; retained input in global offer order. | UML-style pool with guard re-evaluation. |
| D9 | Skipped periodic releases? | Keep the root-epoch grid; a skip counts as completion for `after` successors. | Restart phase on guard change. |
| D10 | Where do timing assumptions live? | Costs and budgets in a binding file whose schema is defined in 2.3. Task kind, priority, preemptability, period and response bound in source. | Everything in source, or everything in the binding. |
| D11 | Task priorities? | Unique per Core. | Equal priorities with FIFO. |
| D12 | Port arrays and connector loops? | Not in 2.3; static port arrays with runtime-indexed emission are an additive 2.4 candidate. | Add now. |
| D13 | Placement granularity? | Per operation, with every placement of one component occurrence on one Core. Entries that need different Tasks use wrapper operations. | Per schedule entry (needs entry names). |
| D14 | Enum pseudo-type tier? | Tier 2. | Tier 1. |

### Work packages and dependencies

Prerequisites on branch `fix/showcase-tool-defects` (tool fixes, no standard change):
- **A1** formatter data loss and layout
- **A2** flow-sensitive SW2011
- **A4** per-model simulation options
- **A7** `swaml test` text mode exhausts the V8 heap on a long door case while `--json` completes

| WP | Content | Needs |
| --- | --- | --- |
| WP0 | ADRs 0022–0025, chapter drafts, `## Unreleased` | — |
| WP1 | Places, indexed reads, test indexes (B1, B2, B11) | A2 |
| WP2 | Conditional, contextual words, association lists (B3, B15, B16) | A1 |
| WP3 | `Swaml::Numeric`, `Swaml::Text`, `Swaml::Time` (B4, B5) | A2 |
| WP4 | Durations as values, `PolicySetting` change, constant evaluator, compatibility gate (B6) | WP3 |
| WP5 | Completion, guarded timers, internal transitions, deferral (B7–B10) | WP4 |
| WP6 | Sampled reads, member policies (B14, B13), then the WP5 completion-guard warning revisited | WP5 (warning) |
| WP7 | Release guards (B19) | WP4; WP6 for the showcase proof only |
| WP8 | Operation placement, `Swaml::Os`, task rules, in-task order, binding schema and `swaml binding check` (B17, B18) | WP4, WP7, A4 |
| WP9 | Edition: inventories, notation, reference book, showcase rewrites, site data, PDF | WP1–WP8, A1, A7 |
| Consuming tools | Integration against the consequences in §5.4 | the matching language WPs |

### What a door ECU team can and cannot derive after 2.3

**Statically checked:**
- the task set per Core: kind (basic, extended, ISR), priority, preemptability, period or response bound
- runnable-to-task mapping per operation, and the order within each task
- per-entry deadlines, consistent with periods and response bounds
- one Core per component; no event entries on periodic tasks; no suspension on basic tasks or ISRs
- level-triggered mode gating
- per-member communication policies
- typed data and behaviour precise enough for a backend to generate code

**Runs:** in logical zero time, with equal-time work ordered by task priority and in-task position. A binding file can be validated against the model with the 2.3 schema.

**Not derived or checked:** response times or schedulability (Tier 2 timed run or external analysis), WCET, cross-core blocking, CAN signal packing, OS configuration format, memory mapping, generated code.

## 1. Grammar

### 1.1 Delta

Only these productions change. Verified with Langium 4.4.0 `createServicesForGrammar` on Node 26 (the review harness with this revision's grammar):
- 0 generation warnings and 0 parser-construction warnings
- 26 + 7 snippets for the new forms and for contextual words in every name position
- the corpus result in §1.2

```text
// B6 compatibility fix (review finding 1): one alternative. A 2.2 duration setting is now Literal{duration}.
PolicySetting: name=Name '=' value=Expression ';';

// B1, B2, B11: places with selectors; call targets allow literal indexes
Assign: target=ValuePath ('[' index=Expression ']' selectors+=Selector*)? '=' value=Expression ';';
ForUpdate infers Assign: target=Name '=' value=Expression;                                 // unchanged
ReferenceExpression: path=ValuePath ('[' index=Expression ']' selectors+=Selector*)?;
Selector: '.' field=Name | '[' index=Expression ']';
CallExpression: target=Path '(' (args+=Expression (',' args+=Expression)*)? ')';           // was ValuePath

// B3: the conditional is a whole expression; operand use needs parentheses; never a statement
type Expression = BinaryExpression | UnaryExpression | Literal | CallExpression | TryExpression
                | ConditionalExpression | ReferenceExpression | RecordLiteral | ArrayLiteral;
Expression returns Expression: ConditionalExpression | OrExpression;
ConditionalExpression: 'if' '(' condition=Expression ')' then=Expression 'else' otherwise=Expression;
ExpressionStatement: expression=OrExpression ';';                                          // was Expression
// PrimaryExpression unchanged: '(' Expression ')' admits a parenthesized conditional

// B6: durations are values; computed durations are parenthesized
Literal: {infer Literal} (number=Numeric | text=STRING | boolean=('true'|'false') | duration=Duration);
Wait: 'wait' (duration=Duration | '(' delay=Expression ')') ';';
Receive: 'on' branches+=ReceiveBranch ('or' branches+=ReceiveBranch)*
         ('or' 'after' (timeout=Duration | '(' timeoutValue=Expression ')') timeoutBody=Block)?;

// B6, B19: schedule entries
ScheduleEntry: ('on' (kind='start'
                     | kind='every' (period=Duration | '(' periodValue=Expression ')')
                     | kind=('receive'|'call') endpoint=MemberPath '(' (bindings+=Name (',' bindings+=Name)*)? ')')
               | kind='after' predecessor=Name)
               operation=Name '(' (args+=Expression (',' args+=Expression)*)? ')'
               ('when' '(' guard=Expression ')')?
               ('deadline' (deadline=Duration | '(' deadlineValue=Expression ')'))?
               (concurrent?='concurrent')? ';';

// B6–B10: states
State: (final?='final')? 'state' name=Name '{' documentation=Documentation?
       (actions+=StateAction | transitions+=Transition | deferrals+=Deferral)* '}';
Transition: ( 'on' 'receive' endpoint=MemberPath '(' (bindings+=Name (',' bindings+=Name)*)? ')' ('when' '(' guard=Expression ')')?
            | 'after' (delay=Duration | '(' delayValue=Expression ')') ('when' '(' guard=Expression ')')?
            | 'when' '(' guard=Expression ')' )
            ('to' target=Name)? effect=Block;
Deferral: 'defer' endpoints+=MemberPath (',' endpoints+=MemberPath)* ';';

// B13
Connect: (redefines?='redefines')? 'connect' (name=Name)? (':' policy=[QosPolicy:QualifiedName])?
         '(' source=Path ',' target=Path ')'
         (documentation=Documentation? ';' | '{' documentation=Documentation? memberPolicies+=MemberPolicy+ '}');
MemberPolicy: member=Name ':' policy=[QosPolicy:QualifiedName] documentation=Documentation? ';';

// B14: initial value of an attribute member (mandatory when sampled, D7)
PortMember: direction=('provides'|'requires') (idempotent?='idempotent')? kind=('attribute'|'event'|'operation') name=Name
            (':' type=TypeRef ('=' initial=Expression)? | '(' (parameters+=Argument (',' parameters+=Argument)*)? ')' ('returns' result=TypeRef)?)
            documentation=Documentation? ';';

// B16
Association: 'associate' occurrence=[ComponentUsage:Name] (',' moreOccurrences+=[ComponentUsage:Name])*
             'to' target=[Scenario:Name] (',' moreTargets+=[Scenario:Name])* ';';

// B9, B15
Name returns string: ID | UNRESTRICTED_NAME | 'reversed' | 'to' | 'times' | 'name' | 'kind' | 'path' | 'use' | 'case'
                   | 'test' | 'associate' | 'by' | 'ns' | 'us' | 'ms' | 's'
                   | 'defer' | 'view' | 'state' | 'in' | 'out';
```

Verified parses:

| Input | Result |
| --- | --- |
| `x = 1 + if (c) 2 else 3;` | syntax error |
| `x = 1 + (if (c) 2 else 3) + 4;` | parses |
| `if (c) g() else h();` | syntax error: a conditional is never a statement |
| `x = if (a) 1 else if (b) 2 else 3;` | parses |
| `backend.twins[i].currentView()` | syntax error: call paths take literal indexes |
| `backend.twins[i].link` | parses; the validator requires literal indexes on component multiplicity segments (SW2010), so reads and calls agree (finding 12a) |

Within a whole conditional, `else` extends to the end: `assert if (p) a else b == 3;` reads `if (p) a else (b == 3)`. The specification states this, and the formatter never drops parentheses.

### 1.2 Compatibility gate (release gate for D1)

"Every valid 2.2 source stays valid with unchanged meaning" is established by three release gates, run in WP4 and again in WP9.

1. **Corpus AST identity.** Parse every repository `.swaml` file plus the three showcase models with the 2.2 and 2.3 grammars. Compare the ASTs (references as text; positions and empty defaults stripped) after exactly one normalization, N1: a 2.2 `PolicySetting{duration: d}` equals a 2.3 `PolicySetting{value: Literal{duration: d}}`. The gate is `test/compatibility-2-2.test.ts`; the corpus list and N1 are in the test.
   - Prototype result: 39 files, 38 identical, 1 skipped (a 2.2 negative example with parse errors), 0 differences.
2. **Behaviour identity.** `scripts/check-simulations.mjs` reproduces every expected final store and case result of `examples/simulation/cases.json` unchanged.
3. **Warning-free grammar.** `langium generate` and parser construction emit no ambiguity warning. A unit test captures `console.warn` during `createSwamlServices` and fails on any output.
   - Only reordering the `PolicySetting` alternatives still warns, so the single-alternative form is required.

Validator consequence of N1:
- A setting named `requestTimeout`, `maxLatency` or `maxAge` must be a `Literal` with a `duration`; computed policy values are not allowed (SW2013).
- `swaml-validator.ts:248` and `semantic.ts:192` (`effectiveQos`) read `value.duration`.

### 1.3 AST API changes (D2)

Only two properties become optional: `Transition.target` and `Wait.duration`. `Transition.delay`, `ScheduleEntry.period`/`deadline` and `Receive.timeout` are already optional in the generated 2.2 AST.

The breaking part is that existing properties silently widen:
- `Assign.target` may be dotted and carry `index`/`selectors`
- `CallExpression.target` may contain `[n]`
- `Association` holds several pairs
- `PolicySetting.duration` is removed

A consumer compiled against 3.1.0 types keeps compiling but misreads these. Hence 4.0.0. The alternative, 3.2.0, is only honest if every widened form gets its own new node type (`PlaceAssign`, `IndexedCall`, `AssociationList`) and `PolicySetting` keeps its alternative; the last condition fails gate 3.

## 2. Items

Each item gives the problem with the current code (**before**), the recommendation, the same code rewritten (**after**), interactions and cost. Costs: S ≤ 1 day, M ≤ 3 days, L ≤ 2 weeks (one agent with tests). Consequences for consuming tools are in §5.4.

### B1 Element and field assignment

**Before** (door `Dem`, 967–975 and 1008–1040; same pattern in cloud `WithValue`/`WithView`/`WithAlert` 330–380 and v2x `withNeighbour`/`withBatch`):

```text
operation withCounter(index: uint, value: int) {
  counters = [
    pickInt(index == 0, value, counters[0]),
    …
    pickInt(index == 5, value, counters[5])
  ];
}
operation report(fault: FaultId, failed: bool) {
  reports = reports + 1;
  var index: uint = indexOf(fault);
  var previous: int = counters[index];
  var counter: int = 0;
  if (failed) {
    counter = clampInt(pickInt(previous < 0, 0, previous) + stepUp, passedThreshold, failedThreshold);
  } else {
    counter = clampInt(pickInt(previous > 0, 0, previous) - stepDown, passedThreshold, failedThreshold);
  }
  if (counter == previous) {
    return;
  }
  withCounter(index, counter);
  var status: DtcStatus = statuses[index];
  if (counter >= failedThreshold and not status.testFailed) {
    withStatus(index, record DtcStatus {
      testFailed = true;
      testFailedThisCycle = true;
      pending = true;
      confirmed = true;
      occurrences = status.occurrences + 1;
    });
  }
  if (counter <= 0 and status.testFailed) {
    withStatus(index, record DtcStatus {
      testFailed = false;
      testFailedThisCycle = status.testFailedThisCycle;
      pending = status.pending;
      confirmed = status.confirmed;
      occurrences = status.occurrences;
    });
  }
  derivePermission();
}
```

**Recommendation: add.**

| Rule | Text |
| --- | --- |
| Root | The first segment is a mutable local, an `out` parameter or a non-const attribute. In case scripts: own locals and `on call` out bindings. Rejected (SW2006): `in` parameters, const attributes, ports, children, qualified names. |
| Typing | `.f` selects a record field and `[i]` indexes a fixed array with an integral index. A literal out-of-range index is an error. (SW2002) |
| `out` root | Must be definitely assigned before (SW2006). |
| Out arguments | A place is not allowed as an out argument in 2.3; out arguments stay bare names (validator line 599 unchanged). |
| Order (finding 9a) | Evaluate the target's index expressions left to right, then the right side, then read the root cell, check the indexes, and write the root with one place replaced. Writes done by the right side (`counters[i] = bump();` where `bump` writes `counters`) are kept. |
| Failure | A failed index check is a runtime failure (`Bounds`); the root is unchanged. |
| Effects and trace | A write effect on the root attribute. One `write` observation of the root with a `place` field such as `statuses[2].confirmed`. Values remain copies (I4). |

Locks and snapshots are unchanged: a read-modify-write happens under the serial lock after any resumption.

**After** (the same operation; `withCounter`, `withStatus`, `pickInt` and `pickStatus` are removed; `clampInt` now comes from `Swaml::Numeric`, so `DoorEcu::Types::clampInt` is deleted to avoid an import ambiguity):

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

**Interactions.**
- SW2011 (A2) must treat a place write as a write of its root and track index values read before a suspension.
- B2 shares `Selector`.
- The formatter (A1) prints places.

**Cost.** Grammar S, validator M, simulator S, formatter S, projection S, docs S (1.4, 3.3, 9.2).

### B2 Index followed by member access

**Before** (cloud `AlertRouter.findOpen` 1405–1412; test 2307):

```text
for (var i: int = 0; i < 4; i = i + 1) {
  var a: Alert = recent[i];
  if (a.vehicleId == vehicle and a.kind == kind and a.status != AlertStatus.resolved) {
    return i;
  }
}
…
var truckView: VehicleView = backend.fleet.views[0];
```

**Recommendation: add.** `ReferenceExpression` gains `selectors`, with the B1 typing rules and left-to-right index evaluation. A read yields a copy. Diagnostics: SW2002.

**After:**

```text
for (var i: int = 0; i < 4; i = i + 1) {
  if (recent[i].vehicleId == vehicle and recent[i].kind == kind and recent[i].status != AlertStatus.resolved) {
    return i;
  }
}
…
assert backend.fleet.views[0].vehicleId == "TRK-101";
```

**Cost.** Grammar S, validator S, simulator S, docs S.

### B3 Conditional expression

**Before:** door `DoorEcu::Types` `pickInt`/`pickStatus` (137–148), used in `Dem.report` (B1).

**Recommendation: add** the whole-expression conditional (§1.1).
- `c` is `bool`. The result type is the common type under widening; records, enums and arrays must be identical (SW2002).
- The effect is the union of condition and branches. No suspending call in a branch (SW2006).
- Only the selected branch is evaluated.
- It is never a statement (grammar), so void branches cannot occur.
- KerML: `ControlFunctions::'if'`. Keywords: `if`/`else` gain the `ConditionalExpression` production.

**After:** see B1 (`(if (previous < 0) 0 else previous) + stepUp`); `pickInt` and `pickStatus` are deleted.

**Cost.** Grammar S, validator S, simulator S, formatter S, docs S.

### B4 Numbers and text

**Before** (v2x `AdaptiveV2x::Types` 399–409; caller 1145):

```text
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
… distanceM = squareRoot(d2); …
```

**Recommendation: library-only, in new packages (D5).** `sqrt` is the only new host intrinsic (D6).

```text
package Swaml::Numeric {
  operation def minInt(a: int, b: int) returns int { if (a < b) { return a; } return b; }
  operation def maxInt(a: int, b: int) returns int { if (a > b) { return a; } return b; }
  operation def clampInt(v: int, low: int, high: int) returns int { if (v < low) { return low; } if (v > high) { return high; } return v; }
  operation def clamp(v: real, low: real, high: real) returns real { if (v < low) { return low; } if (v > high) { return high; } return v; }
  operation def sqrt(v: real) returns real { /** Host intrinsic: IEEE-754 correctly rounded; a negative argument fails. */ }
}
package Swaml::Text {
  operation def intText(v: int) returns string { /** Host intrinsic: decimal, '-' for negatives. */ }
  operation def realText(v: real, decimals: uint) returns string { /** Host intrinsic: decimals <= 15; nearest decimal of the exact binary value, ties away from zero (ADR 0022 is normative). */ }
  operation def boolText(v: bool) returns string { if (v) { return "true"; } return "false"; }
}
```

Tier 2:
- **Trigonometry** (`sin`, `cos`, `atan2`, `pi`) as swa.ml source, with documented range reduction and polynomial coefficients. Only IEEE `+ - * /` are used, so results are bit-identical on every binary64 host. A backend must not contract to fused multiply-add.
- **Enum conversions** `ordinal(v: enum)`/`literalText(v: enum)`. `enum` is allowed as a parameter type only in `Swaml::*` library operations.

**After** (`import Swaml::Numeric;` in `AdaptiveV2x`; `squareRoot` deleted): `… distanceM = sqrt(d2); …`

**Interactions.** The additions must not go into `Swaml::Math`: `DoorEcu` imports both `Swaml::Math` and `DoorEcu::Types`, which already declares `clampInt`.

**Cost.** Library S, simulator S, validator S, docs S.

### B5 Logical clock

**Before** (door `ComMain` 774–798; v2x `camCycle` 1013 and `TelemetryAggregator` 1394 use `nowMs = nowMs + 200`):

```text
operation onMode(current: PowerMode) {
  powerMode = current;
  if (current != PowerMode.run) {
    rxAgeMs = 0;
  }
}
operation rxMainFunction() {
  if (fresh) {
    fresh = false;
    if (pending.rolling != lastRolling) {
      …
      rxAgeMs = 0;
      …
      return;
    }
    aliveErrors = aliveErrors + 1;
  }
  if (not rxSeen or not networkActive() or timedOut) {
    return;
  }
  rxAgeMs = rxAgeMs + 20;
  if (rxAgeMs >= rxTimeoutMs) { … }
}
```

**Recommendation: library-only.** `package Swaml::Time { operation def now() returns uint { /** Host intrinsic: logical time in ns since the run epoch. */ } }`
- Effect class: reads state. Not allowed in initializers or completion guards (B7); allowed elsewhere.
- Returns the logical time of the evaluating step. Concurrent activations read live time, not the snapshot.
- Overflow is the existing `ClockRange` violation.
- SW2011 (A2) must not report a `now()` value as a stale read.

**After** (same component; the mode comes from B14):

```text
attribute lastRxNs: uint = 0;
operation onMode(current: PowerMode) {
  if (current == PowerMode.run) {
    lastRxNs = now();
  }
}
operation rxMainFunction() {
  if (fresh) {
    fresh = false;
    if (pending.rolling != lastRolling) {
      …
      lastRxNs = now();
      …
      return;
    }
    aliveErrors = aliveErrors + 1;
  }
  if (not rxSeen or mode.current != PowerMode.run or timedOut) {
    return;
  }
  if (now() - lastRxNs >= rxTimeoutMs * 1ms) { … }
}
```

The mode-edge handler stays, because the reception age restarts when run is entered (finding 7d). `rxAgeMs`, `powerMode` and `networkActive()` are removed.

**Cost.** Library S, simulator S, validator S, docs S.

### B6 Computed durations

**Before** (v2x `hazardLifecycle` 1066–1079 and `UplinkTransfer.backoff` 1589–1606):

```text
state Active {
  /** … The validity timer repeats ownHazardValidityMs as a literal: transition delays cannot name an attribute. */
  …
  after 5s to Idle {
    hazardsExpired = hazardsExpired + 1;
  }
}
…
interruptible {
  var waited: uint = 0;
  while (waited < delay) {
    wait 250ms;
    waited = waited + 250;
  }
  …
```

**Recommendation: add.** A `Duration` literal in an expression is a `uint` in nanoseconds. Computed positions:

| Position | When evaluated | Allowed |
| --- | --- | --- |
| `wait (e)`, `or after (e)` | when the statement starts waiting | any non-suspending expression |
| state `after (e)` (finding 5) | when the entry actions finish; expiry = state-update time + value | pure or reads state, as for guards |
| `on every (e)`, `deadline (e)` (finding 4) | once per expanded occurrence, statically | constant sublanguage |

If entry suspended past the computed state-timer value, the timer has already elapsed and is selected after the completion transitions (B7).

**Constant sublanguage.**
- **Allowed:** integer and duration literals, const attributes of the owning occurrence (effective value after redefinition), unary `-`, `+ - * / %`, comparisons, `and`/`or`/`not`, the conditional, parentheses.
- **Not allowed:** calls, mutable state, sampled reads.
- **Evaluator:** one, `semantic.ts` `constantValue(expression, occurrence)`, used by the validator, `projection.ts`, the simulator and consuming tools. It replaces `constantNumber`, which today folds only literals and negation.
- **Trigger identity** of `every (e)`, used for inheritance replacement, duplicate detection and `semantic.ts:42 entryKey`: the normalized expression text (comments and whitespace removed, names canonical). A parenthesized single literal normalizes to its nanoseconds, so `every (20ms)` equals `every 20ms`. The release guard is not part of identity.
- **Timing projection** becomes per occurrence. At definition level it shows the expression text; at occurrence level, the evaluated nanoseconds.

**Diagnostics.**
- A non-positive or out-of-range computed duration is one runtime failure code, `DurationRange`. It is checked on the integer value before any `uint` widening, so a negative value is never reported as `Bounds`.
- Statically evaluated values use SW2007/SW2013.
- **SW2016** (new warning, finding 14): a computed duration expression that contains no duration literal and no `now()`, because `after (pulseMs)` would mean 250 ns.

**After:**

```text
state Active {
  /** Announced on entry and repeated by repeatHazard; the validity timer is ownHazardValidityMs. */
  …
  after (ownHazardValidityMs * 1ms) to Idle {
    hazardsExpired = hazardsExpired + 1;
  }
}
```

The backoff loop is replaced under B7.

**Cost.** Grammar S, validator M, constant evaluator M, simulator S, formatter S, projection M, docs S.

### B7 (with B10) Completion and guarded timer transitions

**Before** (v2x `UplinkSessionManager.session` 1470–1481 and 1492–1503, plus the second component `UplinkTransfer.openSession`/`backoff` 1572–1606):

```text
state Connecting {
  on entry {
    enter(SessionState.connecting);
    attempts = attempts + 1;
    publish ctl.openRequested(attempts);
  } on receive ctl.opened(id) to Connected {
    sessionId = id;
    sessionsOpened = sessionsOpened + 1;
  } on receive ctl.refused() to Backoff {
  } on receive network.coverage(up) when(not up) to Offline {
    coverageLosses = coverageLosses + 1;
  }
}
…
state Backoff {
  on entry {
    enter(SessionState.backoff);
    backoffs = backoffs + 1;
    publish ctl.backoffRequested(attempts);
  } on receive ctl.backoffElapsed() to Connecting {
  } on receive network.coverage(up) when(not up) to Offline {
    coverageLosses = coverageLosses + 1;
    publish ctl.backoffAborted();
  }
}
// UplinkTransfer
operation openSession(attempt: uint) {
  var id: uint = try(cloud.openSession(vehicleId), 0);
  sessionOpenAttempts = sessionOpenAttempts + 1;
  lastOpenAttempt = attempt;
  if (id > 0) {
    sessionId = id;
    publish ctl.opened(id);
  } else {
    sessionRefusals = sessionRefusals + 1;
    publish ctl.refused();
  }
}
```

**Recommendation: add** `when (g) to S { … }` (completion) and `after D when (g) to S { … }`. This reverses `SWAML_2_0_TRANSITION.md` §307 for guard-only completion (D3).

**Static (SW2008).**
- A completion transition has a target and no trigger.
- Its guard is pure or reads state, and must not call `now()` (finding 6a).
- A final state has no completion transitions.
- Reachability includes completion edges.
- A cycle connected only by `when (true)` is an error.
- **SW2017 warning** (ADR 0023; revision 2 said SW2016): a completion guard that reads nothing written by the stateful operation's own entry, exit or effect blocks (or their callees), because it cannot change while the machine waits.

**Runtime.**
- After the entry actions finish, and after every internal reaction (B8), completion transitions are evaluated in declaration order. The first enabled one is taken immediately. Otherwise the earliest elapsed timer is selected, then queued input.
- A timer whose guard is false is consumed for this entry (`discardTimer`), and the next timer with equal expiry is tried.
- Completion is **not** evaluated after `discardInput` or `discardTimer`.
- An internal effect that suspends (a request inside `write(t)`, B8) keeps the state timers; on resumption, completion is evaluated first, then elapsed timers, as for entry actions.
- A chain of completion reactions that enters the same state twice without consuming input or a timer is the contract violation `CompletionLoop`. It is not a step-limit stop, so a case fails rather than ending inconclusive (finding 6b).

**After.** One state machine:
- `UplinkSessionManager` gains `reversed port cloud: CloudApi`, `const attribute vehicleId`, and `sessionOpenAttempts`, `sessionRefusals`, `lastBackoffMs`.
- `UplinkTransfer` loses `openSession`, `backoffFor` and `backoff` and keeps the upload path.
- `ctl` loses `openRequested`, `opened`, `refused`, `backoffRequested`, `backoffElapsed`, `backoffAborted`.

```text
state Connecting {
  on entry {
    enter(SessionState.connecting);
    attempts = attempts + 1;
    sessionId = try(cloud.openSession(vehicleId), 0);
    sessionOpenAttempts = sessionOpenAttempts + 1;
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
…
state Backoff {
  on entry {
    enter(SessionState.backoff);
    backoffs = backoffs + 1;
    lastBackoffMs = backoffDelayMs(attempts, backoffBaseMs, backoffCapMs);
  }
  after (lastBackoffMs * 1ms) to Connecting { }
  on receive network.coverage(up) when (not up) to Offline {
    coverageLosses = coverageLosses + 1;
  }
}
```

Notes:
- A coverage loss queued during the open request is taken in the next state (Connected or Backoff), because both handle `network.coverage` (finding 6d).
- Tests that read `app.uplink.transfer.lastBackoffMs` and `backoffsCompleted` move to `app.uplink.session.lastBackoffMs` and `backoffs`.
- B10 (door) needs nothing beyond this: an entry action writes an attribute and a completion transition decides on it.

**Cost.** Grammar S, validator M, simulator M (`machine()` selection, `CompletionLoop`), formatter S, projection M, docs M (3.6, 6.5, 9.3, ADR 0023).

### B8 Internal transitions

**Before** (cloud `PersistenceWriter.circuit` 1254–1276):

```text
state Closed {
  on entry {
    enter(Breaker.closed);
  }
  on receive stream.accepted(t) when (consecutiveFailures >= failureThreshold) to Open {
    trippingArrivals = trippingArrivals + 1;
  }
  on receive stream.accepted(t) to Closed {
    write(t);
  }
}
state Open {
  /** Arrivals have no transition here and are discarded; a self-transition would restart the cool-down timer. */
  on entry {
    enter(Breaker.open);
  }
  after 2s to HalfOpen {
  }
}
```

**Recommendation: add.** A transition without `to` is internal: it runs only its effect, with no exit, entry or state update, and timers keep their epoch.
- An internal timer fires at most once per entry.
- A completion transition requires `to`.
- Completion transitions are evaluated after each internal reaction.
- Explicit self transitions keep their 2.2 meaning.
- Trace: a `state` event with `internal: true`.

**After** (same states):

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
    shedArrivals = shedArrivals + 1;
  }
  after 2s to HalfOpen { }
}
```

This is a deliberate behaviour change. The breaker trips right after the third failed write instead of at the next arrival (`trippingArrivals` disappears), and shed arrivals are counted instead of appearing only as discards. The test `'Store outage trips the breaker and recovers'` (2940) updates its expected counters.

**Cost.** Grammar S (shared), validator S, simulator S, docs S.

### B9 Deferral

**Before** (door `LockControl.control` 1924–1944): a lock or unlock request during the 250 ms pulse has no transition and is discarded.

```text
state locking {
  on entry {
    send motor.lockMotor(LockDrive.lockPulse);
  }
  on exit {
    send motor.lockMotor(LockDrive.idle);
  }
  on receive crash.crashUnlock() to crashUnlocking {
  }
  after 250ms to locked { … }
}
```

**Recommendation: add** `defer p.m, …;` in a state.

**Static (SW2008).**
- Each deferred member is owned by this machine's transitions.
- A state cannot both defer `m` and have a transition on `m` (D8).
- A final state defers nothing.
- Some state must handle `m`.
- **SW2018 warning** (ADR 0023; revision 2 said SW2016): a deferred member whose effective policy has `overflow = reject`, because a full queue fails the sender.

**Runtime.**
- In a deferring state, input for `m` stays in its connection queue. Capacity, overflow and `maxAge` apply observably.
- On entering a state that handles retained members, retained input is consumed in **global offer-ordinal order** across all of the machine's queues (finding 8). This is not queue-creation order; `simulator.ts:1125` must change for retained input.
- On entering a state that neither handles nor defers `m`, retained input is discarded at the next wait (`inactiveOwner`).
- Trace: one `defer` event per retained message.

**After:**

```text
state locking {
  defer requests.request;
  on entry {
    send motor.lockMotor(LockDrive.lockPulse);
  }
  on exit {
    send motor.lockMotor(LockDrive.idle);
  }
  on receive crash.crashUnlock() to crashUnlocking {
  }
  after 250ms to locked { … }
}
```

Notes:
- `unlocking` gets the same `defer requests.request;`.
- Both routes into `lock.requests`, `lockRequests: RteQueued` and `keyFob: CrossCore` (2274–2275), use `reject`, so SW2018 asks for a decision: keep capacity 8, or move to a `dropOldest` policy.
- The cloud `AlertRouter` waiting ring is **not** removed by deferral, because the router also drops waiting pages of alerts that resolved meanwhile (`stillOpen`, 1384–1390), which the desk cannot see. Revision 1's claim is withdrawn.

**Cost.** Grammar S, validator S, simulator M, docs S.

### B11 Indexed parts in tests; port arrays; per-index configuration

**Before.** Cloud tests can read `backend.fleet.views[0]` but no twin, so the breaker is tested on a separate top-level `writer` with stubs (2927–2978). The router selects ports by `if` (896–916):

```text
operation route(t: Telemetry) {
  if (t.slot == 0) {
    routed = routed + 1;
    publish slot0.reading(t);
  } else {
    if (t.slot == 1) {
      routed = routed + 1;
      publish slot1.reading(t);
    } else {
      unroutable = unroutable + 1;
    }
  }
}
```

**Recommendation.**
- **(a) Add.** In test inspection paths, a component multiplicity segment takes a literal index, for reads (B2 grammar) and helper calls (`CallExpression: Path`).
  - A non-literal index on a component segment is SW2010.
  - Roots stay non-multiple top-level occurrences (ADR 0020); only parts inside the root may be indexed.
- **(b) Not in 2.3.** Port arrays with literal-index connects plus a runtime-indexed emission (`publish slots[t.slot].reading(t);`, failing `Bounds` out of range) select among statically closed routes, exactly like the `if` ladder. They are not dynamic topology, so they are a clean additive candidate for 2.4 (D12). They stay out of 2.3 to limit scope.
- **(c) Reject** per-index configuration; use distinct usages.

**After (a)** (an existing backend test, 2620 onwards):

```text
assert backend.twins[0].link == LinkState.offline;
var view: VehicleView = backend.twins[0].currentView();
assert view.vehicleId == "TRK-101";
```

**Cost.** Grammar S, validator S (`testAccessRoots`), simulator S, docs S (3.7, ADR 0020 amendment).

### B12 Boundary port to several children (Tier 2)

**Evidence.** Revision 1 cited cloud `CommandService`. In `cc16c25` its ports are split by multiplicity (`downlink0/1`, `acks0/1`, 1708–1735), which is B11b, not member split. No instance remains in the three models.

**Recommendation:** keep as a Tier 2 addition without a showcase proof:
- each boundary member is supplied by exactly one forwarded child port;
- every required member of each child appears in the boundary;
- a child port is forwarded at most once;
- required attributes and operations keep one peer (SW2004).

### B13 Policy per member

**Before** (door 163–174 and 2779):

```text
qos def BodyCanFrames: Policy {
  /**
   * Body CAN: event-triggered frames are queued and retransmitted until acknowledged;
   * cyclic frames are attributes and always keep only their latest value.
   */
  delivery = Delivery.atLeastOnce; ordering = Ordering.fifo; capacity = 8; overflow = Overflow.reject; requestTimeout = 1s; maxLatency = 5ms;
}
connect bodyCan: BodyCanFrames (bcm.bus, dcu.canBus);
```

**Recommendation: add** an optional `connect … { member: Policy; }` body.
- **Static (SW2004/SW2013):** not on forwarding; the member exists in the connected pair; at most once per member.
- **Effective policy:** the member policy, else the connection policy, else `Default`. Idempotency is checked per member.
- **Redefinition:** `redefines connect` replaces the whole connection, including its member policies (whole-member redefinition).
- **Spec 2.4 wording:** "per-use overrides do not exist" becomes "member policies select named policies per member; field overrides do not exist".
- **Runtime:** queues are already per member; the policy lookup becomes per member.

**After.** `CanEvent` is a new `qos def` in `DoorEcu::Interfaces` holding the current `BodyCanFrames` values; `BodyCanFrames` becomes the policy for the cyclic frames.

```text
connect bodyCan: BodyCanFrames (bcm.bus, dcu.canBus) {
  crash: CanEvent;
  centralLock: CanEvent;
  comfortClose: CanEvent;
  lockStatus: CanEvent;
  remoteMirror: CanEvent;
}
```

**Cost.** Grammar S, validator S–M, simulator S, docs S.

### B14 Sampled read of a required attribute

**Before** (door `ComMain` 754–760 and 811–816; the door model's own doc at 444–455 says "swa.ml has no non-activating read of a required attribute"):

```text
operation storeAjar(ajar: bool) {
  doorAjar = ajar;
}
operation storeWindow(status: WindowStatus) {
  windowState = status;
}
…
on receive door.ajar(ajar) storeAjar(ajar);
on receive window.windowStatus(status) storeWindow(status);
```

**Recommendation: add.** In an operation, `p.m` reads a sample cell. `p` is an owned port, not a forwarded boundary (SW2005); `m` is a required attribute.

| Aspect | Rule |
| --- | --- |
| Cell | One per port occurrence × sampled member, updated at delivery eligibility (after latency and faults), independent of consumption. |
| Initial (D7) | Mandatory: when any component samples a member, its declaration must have `= e` (pure, assignable) (SW2005). Reads never fail, including inside transition, completion and release guards. |
| Ownership (finding 7b) | Sampling is not ownership. A sampled required attribute may have zero or one consuming owner; an unsampled one keeps exactly one. |
| Effects | A state read. Concurrent entries read the dispatch snapshot; serial resumption reads live. |
| Trace | A `deliver` into a cell carries `sample: true`; reads are not traced. (ADR 0024: a separate `sample` observation.) |

Sampled reads cover level-triggered use only. Edge reactions keep their receive handlers: resetting on a mode change, switching outputs off on entering sleep, detecting wake-up.

**After.** Port definitions gain initial values:
- `port def DoorState { provides attribute ajar: bool = false; }`
- `port def WindowStatusPort { provides attribute windowStatus: WindowStatus = record WindowStatus { positionCounts = 250; pinchActive = false; learned = false; }; }`

`storeAjar`, `storeWindow`, `doorAjar`, `windowState` and two schedule entries are removed. In `txMainFunction`:

```text
send tx.doorStatus(record DoorStatusPdu {
  ajar = door.ajar;
  locked = locked;
  windowCounts = window.windowStatus.positionCounts;
  pinchActive = window.windowStatus.pinchActive;
  powerMode = mode.current;
  alive = txAlive;
});
```

The mode as a level needs a new port definition; the existing `ModeBroadcast` stays as the edge:
- `port def ModeState { provides attribute current: PowerMode = PowerMode.startup; }`
- `ModeManager` gains `port modeState: ModeState` and `send modeState.current(next);` in `announce`.
- The eight consumers gain `reversed port mode: ModeState` and a connection (the pattern of 2302–2309).
- They keep their `ModeBroadcast` handlers where they react to edges: `ComMain.onMode`, `LinMaster.onMode` (poll reset), `IoHwAbOutput.onMode` (outputs off), and wake detection in `IoHwAbInput`/`CanInterface`.

**Cost.** Grammar S, validator M, simulator M, docs M (2.1, 3.1, 6.4, 9.2).

### B15 Reserved member names

**Before** (v2x 1452): `attribute sessionState: SessionState = SessionState.offline;`

**Recommendation: add** `view`, `state`, `in`, `out` and `defer` to `Name`. Verified in every name position: attribute, local, parameter, operation, state, initial state, port endpoint, view, and both `for` … `in` positions.

**After:** `attribute state: SessionState = SessionState.offline;` The tests at 2322, 2363, 2379 and 2391 then read `app.uplink.session.state`.

**Cost.** Grammar S, `names.ts` S, docs S.

### B16 Association lists; absence assertions

**Before** (cloud 2256–2266):

```text
associate truck to 'Monitor live position';
associate alderDispatcher to 'Monitor live position';
associate truck to 'Command a vehicle';
associate alderDispatcher to 'Command a vehicle';
associate truck to 'Respond to a critical alert';
associate pager to 'Respond to a critical alert';
associate onCall to 'Respond to a critical alert';
associate alderDispatcher to 'Respond to a critical alert';
associate truck to 'Run a firmware campaign';
associate van to 'Run a firmware campaign';
associate alderDispatcher to 'Run a firmware campaign';
```

**Recommendation.**
- **Add** the list form: every listed occurrence is associated with every listed case. Each pair follows SW2010; a duplicate pair, also across statements, is an error.
- **Keep** absence assertions as `on receive … { fail "…"; } or after D { }`, which is bounded by design.

**After:**

```text
associate truck, alderDispatcher to 'Monitor live position', 'Command a vehicle', 'Respond to a critical alert', 'Run a firmware campaign';
associate pager, onCall to 'Respond to a critical alert';
associate van to 'Run a firmware campaign';
```

**Cost.** Grammar S, validator S, formatter S, docs S. Consuming tools must rewrite lists when deleting one link (§5.4).

### B17 Operation-level deployment

**Before** (door 2786–2815 and the model's doc at 444–455). Components are split so that each occurrence's deadline-carrying runnables share one task: `IoHwAbInput`/`IoHwAbOutput` and `CanInterface`/`ComMain` are separate for that reason, and receive entries that only copy a value stand for RTE buffer updates.

```text
deploy ioIn on doorModules[0].core0.isrAdc;
deploy ioOut on doorModules[0].core0.taskEventHigh;
…
deploy canIf on doorModules[0].core1.isrCan;
deploy comMain on doorModules[0].core1.task20ms;
```

**Recommendation: add.** No new syntax; the existing `Path` already allows it.
- A placement may end at an operation that is the target of at least one effective schedule entry.
  - It applies to all activations released by those entries.
  - Callees run in their caller's placement.
  - It overrides the occurrence placement.
- **Same Core (finding 3a, SW2009):** all placements of one component occurrence, at component and operation level, resolve to Tasks of one Core (or to Nodes outside any Core). One serial lock therefore never spans Cores until the Tier 2 timed run defines cross-core blocking.
- **Granularity (D13):** per operation. An operation released both periodically and by an event that needs different Tasks is split with a wrapper operation (`operation pollEvent() { poll(); }`).

**After.** `comMain` keeps its periodic main functions on `task20ms`. The receive entries that would break B18 rule T2 move to event Tasks of the same Core:

```text
deploy comMain on doorModules[0].core1.task20ms;
deploy comMain.storePdu on doorModules[0].core1.isrCan;
deploy comMain.storeLock on doorModules[0].core1.taskEventLow;
deploy comMain.onMode on doorModules[0].core1.taskEventLow;
deploy linIf on doorModules[0].core0.task20ms;
deploy linIf.storeResponse on doorModules[0].core0.taskEventHigh;
deploy linIf.onMode on doorModules[0].core0.taskEventLow;
```

A team may now merge `ioIn` and `ioOut` (both on core0), and `canIf` and `comMain` (both on core1), back into single components. Whether that reads better is decided in the WP9 showcase rewrite; it is not required.

**Cost.** Validator M (placement targets, same Core), simulator S, docs S (4.1).

### B18 Tasks

**Before** (door 2667–2744):

```text
component def OsTask specializes Process {
  /**
   * An OS task: period (0 for an event-activated task or interrupt), response bound of an
   * event task, priority (higher wins) and category. The values document the target
   * configuration; the reference run does not schedule by them.
   */
  const attribute periodUs: uint = 0;
  const attribute responseUs: uint = 0;
  const attribute priority: uint = 0;
  const attribute category: string = "basic";
}
component def SafetyCore specializes Partition {
  …
  component isrAdc: OsTask {
    redefines const attribute responseUs: uint = 500;
    redefines const attribute priority: uint = 60;
    redefines const attribute category: string = "isr2";
  }
  …
  component task20ms: OsTask {
    redefines const attribute periodUs: uint = 20000;
    redefines const attribute priority: uint = 30;
  }
```

**Recommendation.** Tier 1: a source library, static rules, ordering and the binding schema. Tier 2: the timed run.

```text
package Swaml::Os {
  import Swaml::Platform;
  enum TaskKind { basic, extended, isr }
  component def Core specializes Node { }
  component def Task specializes Process {
    const attribute kind: TaskKind = TaskKind.basic;
    const attribute priority: uint = 0;
    const attribute preemptive: bool = true;
    const attribute periodNs: uint = 0 /** 0: event-activated. */;
    const attribute responseNs: uint = 0 /** Response bound of an event-activated task or ISR; 0: none. */;
  }
}
```

**Tier 1 static rules (SW2009).** The Tasks of a Core are those below their nearest `Core` ancestor.

| # | Rule |
| --- | --- |
| T1 | Priorities are unique among the Tasks of one Core (D11). |
| T2 | A Task with `periodNs > 0` receives only `every` entries whose period is a positive multiple of `periodNs`, plus `after` successors of entries on the same Task (finding 3b). Event entries (`receive`, `call`, `start`) go to Tasks with `periodNs = 0`. |
| T3 | An `isr` Task receives only `receive` entries and their `after` successors, has `periodNs = 0` and is preemptive. |
| T4 | An activation that may suspend (transitive suspend effect in a wait, request, receive, or a suspending entry/exit/effect) is placed only on an `extended` Task (finding 3c). The idle wait of a stateful operation between reactions does not count: each reaction runs to completion and maps to one activation of a basic task. |
| T5 | If `responseNs > 0`, every entry placed on the Task that has a deadline has `deadline >= responseNs`. |
| T6 | Once a deployment places anything on a Task, every schedule entry of the deployed tree must resolve to a Task (complete mapping). |
| T7 | Same Core per component occurrence (B17). |

**In-task order (finding 3d).** Expressed with existing syntax and specified: the position of an activation in its Task is the order of the `deploy` statements naming that Task in the deployment. A component placement contributes its entries in schedule order.

**Reference run (Tier 1).** Releases, dispatches and ready continuations at equal logical time and phase are ordered by descending Task priority, then in-task position, then the existing insertion ordinal. Unplaced activations have priority 0. With zero-cost steps, `preemptive`, `kind` and `responseNs` have no effect on the run beyond the static rules, and the documentation says so.

**Binding schema (defined in 2.3, WP8).** `spec/binding.schema.json`, `"schema": "swaml-binding/2.3"` (superseded: the schema shipped as `swaml-binding/1`, versioned independently of the language edition after the WP8 review, F6; this proposal keeps its original spelling as history):

```text
{
  "schema": "swaml-binding/2.3",
  "deployment": "DoorEcu::'Front left door'",
  "costs": [ { "operation": "dcu.comMain.rxMainFunction", "wcetNs": 80000, "bcetNs": 20000, "source": "measurement or analysis reference" } ],
  "budgets": [ { "task": "vehicle.doorModules[0].core1.task20ms", "budgetNs": 500000 } ],
  "crossCoreLatencyNs": [ { "connection": "dcu.@connect12", "maxNs": 1000000 } ]
}
```

`swaml binding check` resolves every identity against the validated model and deployment and reports placed operations that have no cost. It computes no schedule in 2.3.

**Tier 2.** A timed profile `swaml-reference-timed/2.4` uses the binding for:
- fixed-priority scheduling per Core
- preemption at statement boundaries
- budget and deadline violations
- cross-core blocking semantics

Its results are evidence under the stated assumptions.

**After** (same Cores and Tasks):

```text
import Swaml::Os;
component def SafetyCore specializes Core {
  /** Core 0: sensing, actuation, window, lock, mode management and supervision. */
  const attribute clockMhz: uint = 160;
  component isrAdc: Task {
    redefines const attribute kind: TaskKind = TaskKind.isr;
    redefines const attribute responseNs: uint = 500us;
    redefines const attribute priority: uint = 60;
  }
  …
  component task20ms: Task {
    redefines const attribute periodNs: uint = 20ms;
    redefines const attribute priority: uint = 30;
  }
  …
}
```

`OsTask` is deleted, and `taskBackground` becomes `kind = TaskKind.extended`.

**Cost.** Library S, validator M (T1–T7), simulator M (priority and position keys), binding schema and checker M, docs M.

### B19 Mode-dependent schedules

**Before** (door `LinMaster` 873–921 and `ComMain.txMainFunction` 799–803):

```text
operation slot() {
  /** 20 ms schedule-table slot; no headers while asleep. */
  if (sleeping) {
    return;
  }
  …
}
operation onMode(current: PowerMode) {
  sleeping = current == PowerMode.sleep;
  if (sleeping) {
    polls = 0;
  }
}
operation reportDiagnostics() {
  if (not sleeping) {
    publish diag.report(FaultId.linNoResponse, missed >= faultAfter);
  }
}
schedule {
  on receive bus.response(frame) storeResponse(frame);
  on receive modeIn.changed(current) onMode(current);
  on every 20ms slot() deadline 2ms;
  on every 100ms reportDiagnostics() deadline 10ms;
}
```

**Recommendation: add** `when (g)` on `every`, `receive` and `after` entries; on `start` and `call` entries it is SW2007.
- **Scope:** component attributes, sampled ports, `now()` and the entry's receive bindings. Dispatch arguments are evaluated first. *Superseded by ADR 0025 and WP7-R01 (owner decision E in the WP7 review): the guard is evaluated first, and the arguments only when it is true.*
- **Evaluation:** at dispatch, under the serial lock or in the concurrent snapshot.
- **False guard (finding 2):**
  - no operation runs, and the deadline armed at release is cancelled;
  - a `skip` event names the entry;
  - the skip **counts as a successful whole completion for `after` successors**: they are released and apply their own guards (AUTOSAR mode disabling suppresses one runnable, not its successors);
  - a `receive` entry's input is consumed and discarded (`releaseGuard`);
  - the periodic grid is unchanged (D9).
- **Runtime failure inside a guard:** an uncaught failure of that release. The trace records `failure` with the entry as source (*superseded by ADR 0025 and WP7-R06, owner decision H in the WP7 review: the entry when the guard's own expression fails, the failing statement when the failure happens inside an operation the guard calls*); the deadline is cancelled, no successors are released and the lock is released. With D7, sampled reads cannot cause it; arithmetic can.
- **Identity:** the guard is not part of entry identity.

**After** (`LinMaster` with `reversed port mode: ModeState`; `sleeping` is removed; the edge handler stays for the poll reset):

```text
operation slot() {
  /** 20 ms schedule-table slot. */
  if (polls > 0) {
    …
  }
  …
}
operation onMode(current: PowerMode) {
  if (current == PowerMode.sleep) {
    polls = 0;
  }
}
operation reportDiagnostics() {
  publish diag.report(FaultId.linNoResponse, missed >= faultAfter);
}
schedule {
  on receive bus.response(frame) storeResponse(frame);
  on receive modeIn.changed(current) onMode(current);
  on every 20ms slot() when (mode.current != PowerMode.sleep) deadline 2ms;
  on every 100ms reportDiagnostics() when (mode.current != PowerMode.sleep) deadline 10ms;
}
```

In `ComMain`, `after rxMainFunction txMainFunction() when (mode.current != PowerMode.sleep) deadline 5ms;` replaces the early return. `rxMainFunction` stays unguarded because it accepts frames in every mode (B5). `LinMaster` has no wake handler of its own in `cc16c25`, so wake-up latency is unchanged.

**Cost.** Grammar S, validator S, simulator S (deadline cancel, skip as completion), formatter S, docs S.

### B20 Latency chains (defer)

**Before:** the v2x Timing view `'awareness chain'` (2712–2718) and the test `'Awareness rate follows dynamics'`, which compares `generationTimeMs` gaps.

**Recommendation: defer.** A declarative chain needs causal correlation across sampling activations and an analysis level with stated assumptions. With B5 a test can already measure a bounded latency.

**After (now, in the same test):**

```text
var t0: uint = now();
send vehicleBus.signals.speedMps(speed);
on receive otherVehicle.cch.frameOut(frame) {
  assert now() - t0 <= 150ms;
} or after 150ms {
  fail "no awareness message within 150 ms of a speed change";
}
```

### B21 Service discovery (reject)

Dynamic topology is outside the language (spec §2, ADR 0019, I1/I5). Instead:
- Model each binding as a static (optionally `optional`) connection.
- Expose availability as `provides attribute available: bool = false;`, read with B14 and used in guards (B19).
- An unconnected optional request already fails `unavailable`.

## 3. Cross-item interactions

| Rule | Interaction |
| --- | --- |
| Places vs const/in, out arguments | Roots are rejected as listed; places are not out arguments (B1). |
| Snapshots, stale reads | Concurrent entries never write; sampled reads and release guards use the snapshot (*superseded by ADR 0024 and WP6-R07/WP7-R01: sample cells are read live, a concurrent entry reads only attributes from its snapshot*); `now()` is live; SW2011 (A2) tracks places and ignores `now()`. |
| Computed durations vs deadlines and Timing | Periods and deadlines come from the constant sublanguage per occurrence, so declared grids stay exact. `wait`/`after` expressions are dynamic intervals. State timers are evaluated after entry. |
| Completion vs ordered transitions | Completion, then elapsed timers, then input, each group in declaration order. No completion after discards. `CompletionLoop` violation. |
| Internal transitions vs timers | No restart; an internal timer fires once per entry; a suspending internal effect keeps the timers. |
| Deferral vs queues | Capacity, overflow and age apply; order by offer ordinal; SW2018 on `reject`. |
| Sampled reads vs owners | Zero or one consumer; mandatory initial value; no sampling of forwarded boundaries. |
| Release guards vs `after` and suspension | A skip counts as completion for successors; the deadline is cancelled; the guard is evaluated at dispatch. |
| Operation placement vs occurrence placement and Timing | Operation placement overrides; one Core per occurrence; in-task position from deploy order; Timing lanes per Task. |
| Formatter (A1) | Must support every new form before a showcase is reformatted. |

## 4. Diagnostics added or extended

| Code | Addition |
| --- | --- |
| SW2002 | Places, selectors, conditional typing |
| SW2004 | Member policies |
| SW2005 | Sampled-read ownership, mandatory initial value, forwarded boundary |
| SW2006 | Place roots, suspension in a conditional |
| SW2007 | Release guards, constant sublanguage, trigger identity |
| SW2008 | Completion, internal transitions, deferral |
| SW2009 | Operation placement, same Core, T1–T7 |
| SW2010 | Association lists, indexed test paths |
| SW2013 | Policy duration literals, constant durations |
| SW2016, SW2017, SW2018 (new, warnings; ADRs 0022, 0023) | Computed duration without a unit (SW2016); completion guard that reads only external state (SW2017); deferred member with `reject` overflow (SW2018) |

New runtime codes: `DurationRange`, and `CompletionLoop` (a violation). New trace events: `skip`, `defer`, `discardTimer`, `state.internal`, `deliver.sample` (ADR 0024: `sample`).

## 5. Versioning, publication, plan and costs

### 5.1 Versions

| Artefact | Value |
| --- | --- |
| Standard | 2.3 (`v2.2` exists, `v2.3` does not) |
| Parser/host semantics, profile | 2.3, `swaml-reference/2.3`; Tier 2 timed profile `swaml-reference-timed/2.4` |
| Implementation | 4.0.0 (§1.3); root and lockfile synchronized |
| Consuming tools | Own versions and pins |
| ADRs | 0022 expressions and places; 0023 state reactions (reverses §307); 0024 ports, sampled reads and member policies; 0025 tasks, operation placement and binding |
| Notes | `docs/RELEASE_2_3.md`; no migration guide (compatible) |

### 5.2 Publication gate

- §1.2 gates 1–3.
- Regenerated `spec/keywords.json`, `spec/notation.json` and `spec/kerml-mapping.json`:
  - new productions: `Selector`, `ConditionalExpression`, `Deferral`, `MemberPolicy`;
  - changed: `PolicySetting`, `Assign`, `ReferenceExpression`, `CallExpression`, `Literal`, `ExpressionStatement`, `Expression`, `Wait`, `Receive`, `ScheduleEntry`, `Transition`, `State`, `Connect`, `PortMember`, `Association`, `Name`.
- New figures under `docs/notation/2.3/`: Flow (completion, internal, deferral), Timing (guarded entry, Task lanes), Interconnect (member policy), General (operation placement). Graphical examples and notation pass `--check`.
- `docs/SWAML-2.3-Reference.md` built with `npm run docs:build`.
- `SWAML-2.3-Specification.pdf` with manifest and sha256; every page inspected.
- Showcase site data including the three rewritten models.
- 2.2 artefacts unchanged.

### 5.3 Work packages

One draft PR at a time, each with an adversarial review, merged before the next starts.

| WP | Needs | Tests | Showcase proof (fragments at cc16c25) |
| --- | --- | --- | --- |
| WP0 ADRs, chapters | — | docs check | — |
| WP1 places, indexed reads, test indexes | A2 | parse/recovery, roots, out definite assignment, evaluation order (`counters[i] = bump()`), `Bounds`, `place` trace, copies, literal-index rule | `Dem.report`, `AlertRouter.findOpen`, twins test |
| WP2 conditional, contextual words, association lists | A1 | operand and statement rejection, chains, every word in every name position, list duplicates and rename | `DoorEcu::Types`, v2x `state`, cloud associations |
| WP3 libraries | A2 | `sqrt`, text intrinsics (ties), `now()` effect class, no import ambiguity across the corpus | v2x `sqrt`, `ComMain` reception age |
| WP4 durations, `PolicySetting`, constant evaluator | WP3 | §1.2 gates; constant sublanguage; per-occurrence values; trigger identity; `DurationRange`; SW2016 unit warning | v2x hazard validity |
| WP5 state reactions | WP4 | ordering, discards, `CompletionLoop`, suspending internal effect, deferral order by offer ordinal, SW2017, SW2018 | v2x session, breaker, `LockControl` |
| WP6 sampled reads and member policies; completion-guard warning revisited | WP5 | cell timing with latency and faults, mandatory initial value, ownership, forwarded boundary, snapshots, per-member queues | `ComMain` stores, `BodyCan` |
| WP7 release guards | WP4 (WP6 for the proof) | skip as completion, deadline cancel, receive discard, guard failure, grid | `LinMaster`, `ComMain` |
| WP8 tasks, placement, binding | WP4, WP7, A4 | T1–T7, same Core, override, priority and position order, binding schema and check | door deployment |
| WP9 edition | WP1–WP8, A1, A7 | `npm run check`, figures, PDF | three models |

### 5.4 Consequences for consuming tools

A consuming tool that reads, edits or draws swa.ml source must follow the widened AST (§1.3) before it accepts 2.3 sources:
- **Association lists.** A tool that reads only the first occurrence and case of an `associate` statement misses pairs. A tool that deletes one link must rewrite the list and keep the other pairs.
- **Places and call paths.** `Assign.target` may be a place and `CallExpression.target` may contain `[n]`. Code that compares an assignment target with a bare name, for example to find out parameters, must handle places.
- **Durations.** `Wait.duration` and the literal duration properties of receive timeouts, schedule entries and transitions may be absent when a computed form is used. Timing code must use `constantValue` per occurrence for periods and deadlines instead of reading a literal.
- **Policies.** `PolicySetting.value` replaces `PolicySetting.duration`.
- **States.** `Transition.target` may be absent (internal transitions). Completion transitions have no trigger. States own deferrals.
- **Run evidence.** New observations (`skip`, `defer`, `discardTimer`, `sample`) and fields (`write.place`, `state.internal`) appear only for models that use the new forms.
- **Deployment.** Placements may name operations; Tasks, Cores and member policies are new presentation content.

Consuming tools plan their own integration work against these consequences; their costs are outside this proposal.

## 6. What still will not be expressible

| Topic | After 2.3 |
| --- | --- |
| Response times, schedulability, WCET | Not computed. The binding schema exists; the timed run is Tier 2 and gives assumption-based evidence. |
| Cross-core blocking, spinlocks, IOC configuration | Excluded by the same-Core rule; cross-core exchange is a connection with a policy. |
| Interrupt latency; hardware ISR priority vs task priority | Not modelled; interrupt regions remain cooperative. |
| CAN/LIN packing, PDU layout, E2E profiles, DBC/LDF/ARXML | Target configuration. |
| Fixed-width integers, bitfields, fixed point, wrapping counters | Not in the value domain; use `%`. |
| Memory mapping, NvM layout, calibration | Out of scope. |
| OS configuration format, RTE and code generation | Out of scope for the language; a backend preserves chapter 6 semantics. |
| Dynamic topology, service discovery, port arrays | Rejected (port arrays: a 2.4 candidate). |
| Per-entry placement, per-index configuration | Use wrapper operations and distinct usages. |
| Declarative latency contracts | Deferred; bounded test checks only. |
| Proofs (races, termination, schedulability) | Not claimed. |

**Where the line is.** After 2.3 the door model fixes a complete, statically checked task and runnable mapping:
- tasks per Core with kind, priority, preemptability, and period or response bound;
- each runnable's task and its position in that task;
- per-entry deadlines;
- level-triggered mode gating;
- per-member communication policies.

The model also carries precise behaviour and data semantics, and it runs deterministically in logical zero time with priority ordering.

It does **not** establish that this schedule meets its deadlines on the target. That needs costs (the binding) plus the Tier 2 timed run or external analysis. It also does not say how bytes, OS configuration or code look.

## Appendix A. Review dispositions

| # | Finding (review) | Disposition | What changed |
| --- | --- | --- | --- |
| 1 | `PolicySetting` ambiguity changes every 2.2 QoS duration | Accepted (mandatory) | `PolicySetting` reduced to `value=Expression`. Verified: 0 generation and 0 parser warnings; corpus 38/38 identical under N1. Three release gates in §1.2 (corpus AST identity, behaviour identity, warning-free grammar). Validator and `effectiveQos` read `value.duration`. Reordering alone was rejected because it still warns. |
| 2 | Skip breaks `after` chains; deadline contradiction | Accepted (mandatory) | A skip counts as completion for successors; the deadline is cancelled; guard scope and guard-failure meaning are defined (B19). The `ComMain` rewrite guards `txMainFunction`, not `rxMainFunction`. |
| 3 | Deployment leaves target decisions open | Accepted (mandatory) | Same-Core rule T7; T2 entry kinds per Task; T4 suspension only on extended Tasks (state-machine idle excluded); `kind`, `preemptive`, `responseNs` in `Swaml::Os` in Tier 1; in-task position from deploy order; binding schema and `swaml binding check` in 2.3; the §0 and §6 closing claims were rewritten. |
| 4 | Computed periods: identity, evaluator, projection, crashes | Accepted (mandatory) | Constant sublanguage; one evaluator `constantValue` in `semantic.ts`; trigger identity is the normalized text; per-occurrence projection; consuming-tool Timing cost raised to L with call sites (§5.4). |
| 5 | State timer evaluated before entry | Accepted (mandatory) | Evaluated when entry actions finish; expiry = state-update time + value (B6). |
| 6 | Completion traps | Accepted | `now()` forbidden in completion guards; SW2017 for guards reading only external state; `CompletionLoop` violation; no completion after discards; suspending internal effects specified; v2x note corrected. |
| 7 | Sampled reads | Accepted | D7 mandatory initial value; the "sampling is not ownership" wording; forwarded boundaries rejected; edge handlers kept, with showcase claims and costs corrected (`ModeState` port, eight consumers). |
| 8 | Deferral order | Accepted | Global offer-ordinal order for retained input (simulator change named); SW2018 on `reject`; the cloud claim is withdrawn (router `stillOpen`). |
| 9 | B1/B3 rule gaps | Accepted | Root read after index and right-side evaluation; places are not out arguments; a conditional is never a statement (grammar, verified); whole-expression conditional (grammar, verified). |
| 10 | D2 rationale, AST claim, consumer breakage | Accepted | §1.3 corrected (only two newly optional properties; silent widenings are the reason); D2 alternative restated; consumer consequences in §5.4. |
| 11 | Trigonometry and text rounding | Accepted | D6: `sqrt` is the only intrinsic; trigonometry as source in Tier 2; `realText` rounding (ADR 0022 fixes ties away from zero, because `round` and `toFixed` disagree for negatives). |
| 12 | Index forms, multiple roots, port-array rationale | Accepted | Literal-index rule for component segments (SW2010); roots stay non-multiple; port-array rationale and alternative corrected (additive 2.4). |
| 13 | Work-package prerequisites | Accepted | A1, A2, A4 (and A7) are prerequisites; WP7 → WP6 marked as proof-only; WP6 revisits the WP5 warning; D13 wrapper note. |
| 14 | Unit lint, negative durations, B13 spec wording | Accepted | SW2016 unit warning; one code `DurationRange`, checked before widening; spec 2.4 wording and the `redefines connect` rule. |

Other changes from re-taking the showcase snippets at `cc16c25`:
- The B9 example moved to door `LockControl`.
- B12 now has no instance.
- B10 needs nothing beyond B7.
- The B8 rewrite states its intended behaviour change and the test update.
- The B17/B18 snippets use the split IoHwAb/Com components and the ISR, event and periodic `OsTask` nodes.

## Appendix B. Unresolved

- **SW2016 groups three heuristic warnings under one new code.** Decided: separate codes SW2016–SW2018 (ADRs 0022, 0023).
- **T4 (decided in ADR 0025: a state machine uses a basic task only if no reaction can suspend) was my reading of how a state machine maps to basic tasks** (its idle wait does not count as suspension). A target team may want state machines on extended tasks only; that is a one-line rule change.
- **The instant a sampled cell is updated** ("delivery eligibility"). Decided in ADR 0024: at the delivery instant, before any activation dispatched at that instant evaluates its release guard. *Superseded by ADR 0024 as implemented (WP6-R02, WP7-R01): a cell is updated at the delivery step in the instant's event order, and a guard sees only the updates ordered before its own step, so a same-instant delivery ordered after the guard step is not seen.*
- **Not prototyped:** the runtime and validation rules (B6, B7, B9, B14, B18, B19). Only the grammar and the corpus gate were.
