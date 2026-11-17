# Grammar delta for 2.3 (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: `src/language/swaml.langium`, the normative concrete grammar. Only the productions below change. Each change is tagged with the work package that applies it. The complete delta was verified with Langium 4.4.0 `createServicesForGrammar` on Node 26: 0 generation warnings and 0 parser-construction warnings, every new form parsed, and every contextual word parsed in every name position ([proposal §1.1](../../proposals/NEXT_MINOR_PROPOSAL.md#11-delta)).

Productions that several packages touch are written here in their final form. A package applies only its own alternatives and leaves the others in their 2.2 form until their package lands. Every intermediate grammar must also be free of warnings (gate 3).

## Productions

| ID | Rule |
| --- | --- |
| WP1-G01 | `Assign: target=ValuePath ('[' index=Expression ']' selectors+=Selector*)? '=' value=Expression ';';` with the new `Selector: '.' field=Name \| '[' index=Expression ']';`. `ForUpdate infers Assign: target=Name '=' value=Expression;` is unchanged. |
| WP1-G02 | `ReferenceExpression: path=ValuePath ('[' index=Expression ']' selectors+=Selector*)?;` |
| WP1-G03 | `CallExpression: target=Path '(' (args+=Expression (',' args+=Expression)*)? ')';` (was `ValuePath`; `Path` admits literal indexes only). |
| WP2-G01 | `Expression returns Expression: ConditionalExpression \| OrExpression;` with `ConditionalExpression: 'if' '(' condition=Expression ')' then=Expression 'else' otherwise=Expression;`. The declared `type Expression` union gains `ConditionalExpression`. `PrimaryExpression` is unchanged, so `'(' Expression ')'` admits a parenthesized conditional as an operand. |
| WP2-G02 | `ExpressionStatement: expression=OrExpression ';';` (was `Expression`): a conditional is never a statement. |
| WP2-G03 | `Association: 'associate' occurrence=[ComponentUsage:Name] (',' moreOccurrences+=[ComponentUsage:Name])* 'to' target=[Scenario:Name] (',' moreTargets+=[Scenario:Name])* ';';` and `Name` gains `'view' \| 'state' \| 'in' \| 'out'`. |
| WP4-G01 | `PolicySetting: name=Name '=' value=Expression ';';`: one alternative, so a 2.2 duration setting is now `Literal{duration}` (normalization N1 of gate 1). |
| WP4-G02 | `Literal: {infer Literal} (number=Numeric \| text=STRING \| boolean=('true'\|'false') \| duration=Duration);` |
| WP4-G03 | `Wait: 'wait' (duration=Duration \| '(' delay=Expression ')') ';';` and `Receive: … ('or' 'after' (timeout=Duration \| '(' timeoutValue=Expression ')') timeoutBody=Block)?;` |
| WP4-G04 | `ScheduleEntry`: `kind='every' (period=Duration \| '(' periodValue=Expression ')')` and `('deadline' (deadline=Duration \| '(' deadlineValue=Expression ')'))?`; `Transition`: `'after' (delay=Duration \| '(' delayValue=Expression ')')`. |
| WP5-G01 | `Transition: ( 'on' 'receive' endpoint=MemberPath '(' (bindings+=Name (',' bindings+=Name)*)? ')' ('when' '(' guard=Expression ')')? \| 'after' (delay=Duration \| '(' delayValue=Expression ')') ('when' '(' guard=Expression ')')? \| 'when' '(' guard=Expression ')' ) ('to' target=Name)? effect=Block;` |
| WP5-G02 | `State: (final?='final')? 'state' name=Name '{' documentation=Documentation? (actions+=StateAction \| transitions+=Transition \| deferrals+=Deferral)* '}';` with `Deferral: 'defer' endpoints+=MemberPath (',' endpoints+=MemberPath)* ';';` |
| WP5-G03 | `Name` gains `'defer'` (contextual from its introduction). |
| WP6-G01 | `PortMember: … kind=('attribute'\|'event'\|'operation') name=Name (':' type=TypeRef ('=' initial=Expression)? \| '(' … ')' ('returns' result=TypeRef)?) documentation=Documentation? ';';` |
| WP6-G02 | `Connect: (redefines?='redefines')? 'connect' (name=Name)? (':' policy=[QosPolicy:QualifiedName])? '(' source=Path ',' target=Path ')' (documentation=Documentation? ';' \| '{' documentation=Documentation? memberPolicies+=MemberPolicy+ '}');` with `MemberPolicy: member=Name ':' policy=[QosPolicy:QualifiedName] documentation=Documentation? ';';` |
| WP7-G01 | `ScheduleEntry` gains `('when' '(' guard=Expression ')')?` after the operation call and before `deadline`. |

The `Name` production after WP2 and WP5:

```text
Name returns string: ID | UNRESTRICTED_NAME | 'reversed' | 'to' | 'times' | 'name' | 'kind' | 'path' | 'use' | 'case'
                   | 'test' | 'associate' | 'by' | 'ns' | 'us' | 'ms' | 's'
                   | 'defer' | 'view' | 'state' | 'in' | 'out';
```

## Parses the grammar must produce

| Input | Result |
| --- | --- |
| `x = 1 + if (c) 2 else 3;` | syntax error |
| `x = 1 + (if (c) 2 else 3) + 4;` | parses |
| `if (c) g() else h();` | syntax error: a conditional is never a statement |
| `x = if (a) 1 else if (b) 2 else 3;` | parses |
| `assert if (p) a else b == 3;` | parses as `if (p) a else (b == 3)` |
| `backend.twins[i].currentView()` | syntax error: call paths take literal indexes |
| `backend.twins[i].link` | parses; rejected by WP1-S06 (SW2010) |
| `qos def P: Policy { requestTimeout = 1s; … }` | parses as `PolicySetting{value: Literal{duration}}` |
| `attribute state: SessionState = SessionState.offline;` | parses (after WP2) |

## Compatibility gates

| ID | Rule |
| --- | --- |
| WP1a-M01 | **Gate 1: corpus AST identity.** `test/compatibility-2-2.test.ts` parses every repository `.swaml` file, including the showcase models at `examples/showcase/*.swaml`, with the 2.2 grammar, kept as a test fixture, and the current grammar. It compares the ASTs (references as text; positions and empty defaults stripped) after exactly one normalization, N1, applied to both sides: `PolicySetting{duration: d}` is rewritten to `PolicySetting{value: Literal{duration: d}}`. A file with 2.2 parse errors is skipped and listed. Any difference fails. |
| WP1a-M02 | **Gate 2: behaviour identity.** WP1a records a fixture once with the 3.1.0 implementation, before any 2.3 change, and names that implementation's commit in the fixture. It covers every run in `examples/simulation/runs.json`, every case of every example (`examples/simulation/cases.json`) and every test of the showcase models as merged at `examples/showcase/*.swaml` at the commit where WP1a records the fixture. Showcase tests run through the API or `swaml test --json`, never the text mode, which exhausts memory on the long door case (tool fix A7). Per run or case, the fixture stores the status, the full final stores, machines and deployments, the case verdict and message, the trace length, the count of each observation kind, and the SHA-256 of the trace serialized as canonical JSON (UTF-8, object keys sorted, no whitespace). `profile` and `languageVersion` are removed before hashing and comparing. A mismatch fails and reports the run or case identity, every differing store key, verdict or status with expected and actual values, and for a trace both digests, lengths and kind counts. It also writes the actual trace to a file, so that a reviewer can diff it against the trace regenerated with the recorded 3.1.0 commit. |
| WP1a-M03 | **Gate 3: warning-free grammar.** A unit test captures `console.warn` during `createSwamlServices` and fails on any output. `langium generate` emits no ambiguity warning. |

WP1a adds the three gates before any language change. Every later package and WP9 run them. A rule that adds trace information adds it only for new syntax, as a new optional field or a new observation kind, so gate 2 holds.

## Formatter

The formatter must print every new form before a showcase model is reformatted (tool fix A1 is a prerequisite).

| ID | Rule |
| --- | --- |
| WP1-M03 | Prints places and selectors without spaces inside the path (`statuses[i].confirmed`). |
| WP2-M05 | Prints conditionals and never drops or adds parentheses that change the parse. Prints association lists on one line when they fit, otherwise one occurrence or case per continuation line. |
| WP4-M08 | Prints computed durations in parentheses (`wait (n * 1ms);`) and literal durations without them. |
| WP5-M04 | Prints completion transitions, internal transitions, timer guards and `defer` lines, keeping every state member in source order. |
| WP6-M05 | Prints member-policy bodies with one member per line and attribute initial values. |
| WP7-M03 | Prints a release guard between the operation call and `deadline`. |

## AST consequences

These are tagged with the package that introduces them; together they justify implementation package 4.0.0 (ADR 0022, D2).
- **Newly optional:** only `Transition.target` (WP5) and `Wait.duration` (WP4). `Transition.delay`, `ScheduleEntry.period`/`deadline` and `Receive.timeout` are already optional in 2.2.
- **Silent widenings:**
  - `Assign.target` may be dotted and carries `index` and `selectors` (WP1);
  - `CallExpression.target` may contain `[n]` (WP1);
  - `Association` holds several pairs (WP2);
  - `PolicySetting.duration` is removed (WP4).
