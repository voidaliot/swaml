# Grammar delta for 2.3 (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: `src/language/swaml.langium`, the normative concrete grammar. Only the productions below change. Each change is tagged with the work package that applies it. The complete delta was verified with Langium 4.4.0 `createServicesForGrammar` on Node 26: 0 generation warnings and 0 parser-construction warnings, every new form parsed, and every contextual word parsed in every name position ([proposal §1.1](../../proposals/NEXT_MINOR_PROPOSAL.md#11-delta)).

Productions that several packages touch are written here in their final form. A package applies only its own alternatives and leaves the others in their 2.2 form until their package lands. Every intermediate grammar must also be free of warnings (gate 3).

## Productions

| ID | Rule |
| --- | --- |
| WP1-G01 | **Applied in WP1** to `src/language/swaml.langium`. `Assign: target=ValuePath ('[' index=Expression ']' selectors+=Selector*)? '=' value=Expression ';';` with the new `Selector: '.' field=Name \| '[' index=Expression ']';`. `ForUpdate infers Assign: target=Name '=' value=Expression;` is unchanged. |
| WP1-G02 | **Applied in WP1.** `ReferenceExpression: path=ValuePath ('[' index=Expression ']' selectors+=Selector*)?;` |
| WP1-G03 | **Applied in WP1.** `CallExpression: target=Path '(' (args+=Expression (',' args+=Expression)*)? ')';` (was `ValuePath`; `Path` admits literal indexes only). |
| WP2-G01 | **Applied in WP2** as `Expression returns Expression: ConditionalExpression \| UnaryExpression ({infer BinaryExpression.left=current} operator=('*'\|'/'\|'%') right=UnaryExpression)* ({infer BinaryExpression.left=current} operator=('+'\|'-') right=MultiplicativeExpression)* ({infer BinaryExpression.left=current} operator=('<'\|'<='\|'>'\|'>=') right=AdditiveExpression)* ({infer BinaryExpression.left=current} operator=('=='\|'!=') right=RelationalExpression)* ({infer BinaryExpression.left=current} operator='and' right=EqualityExpression)* ({infer BinaryExpression.left=current} operator='or' right=AndExpression)*;` with `ConditionalExpression: 'if' '(' condition=Expression ')' then=Expression 'else' otherwise=Expression;`. `OrExpression` and the rules below it are unchanged and still used for right operands and by `ExpressionStatement`. This is equivalent to the drafted `Expression returns Expression: ConditionalExpression \| OrExpression;`: every binary chain from `*` up to `or` is written into `Expression`, one loop per precedence level, each taking its right operands from the next higher level, so the tree is the same and a nesting level costs three parser rule calls instead of nine (WP2-D05). The language and the AST are the same. The CST changes: the CST node of a binary expression of any operator built at the top of an `Expression` has the grammar rule `Expression`, not `OrExpression`, `AndExpression`, `EqualityExpression`, `RelationalExpression`, `AdditiveExpression` or `MultiplicativeExpression`; a consumer that recognises an operator by the CST grammar rule name (for example `grammarRule === 'OrExpression'`) must use the AST (`BinaryExpression.operator`) or the token instead. The declared `type Expression` union gains `ConditionalExpression`. `PrimaryExpression` is unchanged, so `'(' Expression ')'` admits a parenthesized conditional as an operand. |
| WP2-G02 | **Applied in WP2.** `ExpressionStatement: expression=OrExpression ';';` (was `Expression`): a conditional is never a statement. |
| WP2-G03 | **Applied in WP2.** `Association: 'associate' occurrence=[ComponentUsage:Name] (',' moreOccurrences+=[ComponentUsage:Name])* 'to' target=[Scenario:Name] (',' moreTargets+=[Scenario:Name])* ';';` and `Name` gains `'view' \| 'state' \| 'in' \| 'out'`. |
| WP4-G01 | **Applied in WP4** to `src/language/swaml.langium`. `PolicySetting: name=Name '=' value=Expression ';';`: one alternative, so a 2.2 duration setting is now `Literal{duration}` (normalization N1 of gate 1); `settingDuration` reads it (WP4-M01). |
| WP4-G02 | **Applied in WP4.** `Literal: {infer Literal} (number=Numeric \| text=STRING \| boolean=('true'\|'false') \| duration=Duration);` |
| WP4-G03 | **Applied in WP4.** `Wait: 'wait' (duration=Duration \| '(' delay=Expression ')') ';';` and `Receive: … ('or' 'after' (timeout=Duration \| '(' timeoutValue=Expression ')') timeoutBody=Block)?;` |
| WP4-G04 | **Applied in WP4.** `ScheduleEntry`: `kind='every' (period=Duration \| '(' periodValue=Expression ')')` and `('deadline' (deadline=Duration \| '(' deadlineValue=Expression ')'))?`; `Transition`: `'after' (delay=Duration \| '(' delayValue=Expression ')')`. |
| WP5-G01 | **Applied in WP5** to `src/language/swaml.langium`. `Transition: ( 'on' 'receive' endpoint=MemberPath '(' (bindings+=Name (',' bindings+=Name)*)? ')' ('when' '(' guard=Expression ')')? \| 'after' (delay=Duration \| '(' delayValue=Expression ')') ('when' '(' guard=Expression ')')? \| 'when' '(' guard=Expression ')' ) ('to' target=Name)? effect=Block;` |
| WP5-G02 | **Applied in WP5.** `State: (final?='final')? 'state' name=Name '{' documentation=Documentation? (actions+=StateAction \| transitions+=Transition \| deferrals+=Deferral)* '}';` with `Deferral: 'defer' endpoints+=MemberPath (',' endpoints+=MemberPath)* ';';` |
| WP5-G03 | **Applied in WP5.** `Name` gains `'defer'` (contextual from its introduction; a basic name in every edition, `KEYWORDS_FROM_2_3` in `src/language/names.ts`). An unclosed reaction block ends where the next state member clearly starts (`on receive p.m(…) to`/`when`, `defer` and a name), so the following transitions and deferrals are kept (`stateMemberStart` in `src/language/swaml-syntax.ts`). |
| WP6-G01 | **Applied in WP6** to `src/language/swaml.langium`. `PortMember: … kind=('attribute'\|'event'\|'operation') name=Name (':' type=TypeRef ('=' initial=Expression)? \| '(' … ')' ('returns' result=TypeRef)?) documentation=Documentation? ';';` |
| WP6-G02 | **Applied in WP6.** `Connect: … '(' source=Path ',' target=Path ')' (documentation=Documentation? ';' \| '{' documentation=Documentation? memberPolicies+=MemberPolicy+ '}');` with `MemberPolicy: member=Name ':' policy=[QosPolicy:QualifiedName] documentation=Documentation? ';';` |
| WP7-G01 | **Applied in WP7** to `src/language/swaml.langium`. `ScheduleEntry` gains `('when' '(' guard=Expression ')')?` after the operation call and before `deadline`. |

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
| `qos def P: Policy { requestTimeout = 1s; … }` | parses as `PolicySetting{value: Literal{duration}}` (WP4, applied) |
| `attribute state: SessionState = SessionState.offline;` | parses (after WP2) |

## Compatibility gates

| ID | Rule |
| --- | --- |
| WP1a-M01 | **Gate 1: corpus AST identity.** (Done in WP1a.) `test/v2/compatibility-2-2.test.ts` parses every repository `.swaml` file, including the showcase models at `examples/showcase/*.swaml`, with the 2.2 grammar, kept as a test fixture, and the current grammar. It compares the ASTs (references as text; positions and empty defaults stripped) after exactly one normalization, N1, applied to both sides: `PolicySetting{duration: d}` is rewritten to `PolicySetting{value: Literal{duration: d}}`. A file with 2.2 parse errors is skipped and listed. Any difference fails. As extended in the WP1a review, it also compares, for every recorded source, the resolved target of every cross-reference, every diagnostic, the inferred type of every typed expression and the view projections and selections with fixtures recorded at the same 3.1.0 commit. `amendments.json` is the only way to change one recorded expectation: the message of a diagnostic (keeping severity, code and range), the removal of a warning that the cited rule retires, or an expression type to another known type. Each amendment names the file, the exact recorded and new values, a rule identifier defined in the 2.3 drafts or chapters (never WP1a) or an existing ADR that requires it, and a reason; a stale, unused, duplicate or unjustified amendment fails. A 2.2 source never gains an error or any new diagnostic in 2.3, never loses an error and never changes a diagnostic's severity, code or range; none of this is amendable. References and behaviour are never amended. New view-projection fields appear only for new syntax and are absent on 2.2 sources. |
| WP1a-M02 | **Gate 2: behaviour identity.** (Done in WP1a: `node scripts/compatibility-2-2.mjs runs` in `npm run check`.) WP1a records a fixture once with the 3.1.0 implementation, before any 2.3 change, and names that implementation's commit in the fixture. It covers every run in `examples/simulation/runs.json`, every case of every example (`examples/simulation/cases.json`) and every test of the showcase models as merged at `examples/showcase/*.swaml` at the commit where WP1a records the fixture. Showcase tests run through the API or `swaml test --json`, never the text mode, which exhausts memory on the long door case (tool fix A7). Per run or case, the fixture stores the status, the full final stores, machines and deployments, the case verdict and message, the trace length, the count of each observation kind, and the SHA-256 of the trace serialized as canonical JSON (UTF-8, object keys sorted, no whitespace). `profile` and `languageVersion` are removed before hashing and comparing. A mismatch fails and reports the run or case identity, every differing store key, verdict or status with expected and actual values, and for a trace both digests, lengths and kind counts. It also writes the actual trace to a file, so that a reviewer can diff it against the trace regenerated with the recorded 3.1.0 commit. |
| WP1a-M03 | **Gate 3: warning-free grammar.** (Done in WP1a.) A unit test captures `console.warn` during `createSwamlServices` and fails on any output. `langium generate` emits no ambiguity warning. As implemented, `test/v2/grammar-warnings.test.ts` fails on any console output during `createSwamlServices` and while parsing every corpus file, because the ALL(*) lookahead reports an ambiguity on `console.log` only when a parse reaches it; `scripts/langium-generate.mjs`, which `npm run build` uses, fails on any generation diagnostic, including information and hints such as an unused rule, which a multi-package grammar edit easily leaves behind. Because an ambiguity is reported only when a parse reaches it, every later package that adds syntax also adds complete, valid sources that use every new form and alternative (examples under `examples/` or files the corpus lists) in the same PR, so that the gate-3 test parses them. |

The gate fixtures are under `test/fixtures/compatibility-2-2/`: the kept 2.2 grammar, `ast.json` (per recorded file, its source digest and the digest of its 2.2 AST under N1), `behaviour.json` (per run or case, its recorded options and results with full stores and trace digests), `resolution.json` (per corpus file, resolved references, diagnostics and expression types), `projection.json` (per corpus file, view projections and selections) and `behaviour-supplement.json` (resolved run options and the runs of the coverage example 32), added in the WP1a review, and `amendments.json`, the only editable file (see WP1a-M01). The recorded files were recorded with implementation 3.1.0 at commit `213f583`. They are never re-recorded or edited to make a gate pass. A package that deliberately changes a recorded source keeps the recorded bytes at `test/fixtures/compatibility-2-2/sources/<path>`, where both gates read them; a gate fails when a recorded source is missing. WP1a adds the three gates before any language change. Its prerequisites are P0, the showcase models merged to main as `examples/showcase/*.swaml`, and tool fixes A1, A2, A4 and A7 merged; without the showcase models on main, gates 1 and 2 cannot cover them. Every later package and WP9 run them. A rule that adds trace information adds it only for new syntax, as a new optional field or a new observation kind, so gate 2 holds.

## Formatter

The formatter must print every new form before a showcase model is reformatted (tool fix A1 is a prerequisite).

| ID | Rule |
| --- | --- |
| WP1-M03 | **Applied in WP1** (`src/language/formatter.ts`, [tooling guide](../../TOOLING.md)). Prints places and selectors without spaces inside the path (`statuses[i].confirmed`). |
| WP2-M05 | **Applied in WP2** (`src/language/formatter.ts`, [tooling guide](../../TOOLING.md)). Prints conditionals and never drops or adds parentheses that change the parse. Prints association lists on one line when they fit, otherwise one occurrence or case per continuation line. A list longer than 100 characters, indentation included, breaks after each comma and before `to`; a list that contains a comment keeps the token-preserving one-line layout and is not wrapped. |
| WP4-M08 | **Applied in WP4** (`src/language/formatter.ts`, [tooling guide](../../TOOLING.md)). Prints computed durations in parentheses (`wait (n * 1ms);`) and literal durations without them. |
| WP5-M04 | **Applied in WP5** (`src/language/formatter.ts`, [tooling guide](../../TOOLING.md)). Prints completion transitions, internal transitions, timer guards and `defer` lines, keeping every state member in source order. |
| WP6-M05 | **Applied in WP6** (`src/language/formatter.ts`, unchanged: the token printer already prints member-policy bodies with one member per line and attribute initial values; tested in `test/v2/sampled-reads.test.ts`). |
| WP7-M03 | **Applied in WP7** (`src/language/formatter.ts`, unchanged: the token printer already spaces `when (`; tested in `test/v2/release-guards.test.ts`, [tooling guide](../../TOOLING.md)). Prints a release guard between the operation call and `deadline`. |

## AST consequences

These are tagged with the package that introduces them; together they justify implementation package 4.0.0 (ADR 0022, D2).
- **Newly optional:** only `Transition.target` (WP5, applied) and `Wait.duration` (WP4, applied: a computed wait has `delay` instead). `Transition.delay`, `ScheduleEntry.period`/`deadline` and `Receive.timeout` are already optional in 2.2.
- **Silent widenings:**
  - `Assign.target` may be dotted and carries `index` and `selectors` (WP1, applied);
  - `CallExpression.target` may contain `[n]` (WP1, applied);
  - `Association` holds several pairs (WP2);
  - `PolicySetting.duration` is removed (WP4, applied); a 2.2 duration setting is `value: Literal{duration}`.
- **New optional properties (WP4, applied):** `Literal.duration`, `Wait.delay`, `Receive.timeoutValue`, `ScheduleEntry.periodValue` and `deadlineValue`, `Transition.delayValue`, each an `Expression` beside the 2.2 `Duration` property it can replace.
