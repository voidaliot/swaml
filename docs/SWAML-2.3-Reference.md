# swa.ml 2.3 — Complete language reference

Unreleased draft reference for the 2.3 candidate. Its chapters are the maintained chapters, which still describe the 2.2 language that the candidate accepts unchanged; 2.3 additions are specified in docs/drafts/2.3 and move into these chapters with their work packages. Headerless parser 2.3; profile swaml-reference/2.3. Published PDFs and frozen release references, including the 2.0 reference under history/2.0.0, are unchanged. The release notes describe edition changes and the migration from 2.0; no compatibility parser is included.

## Contents

- [LANGUAGE_SPECIFICATION](#chapter-1)
- [QUICK_START](#chapter-2)
- [USER_GUIDE](#chapter-3)
- [AI_GUIDE](#chapter-4)
- [spec/01-structure-and-types](#chapter-5)
- [spec/02-communication](#chapter-6)
- [spec/03-behavior](#chapter-7)
- [spec/04-systems-and-conformance](#chapter-8)
- [spec/05-kerml-mapping](#chapter-9)
- [spec/06-execution-contract](#chapter-10)
- [spec/07-normalized-model](#chapter-11)
- [spec/08-conformance-obligations](#chapter-12)
- [spec/09-formal-semantics](#chapter-13)
- [GRAPHICAL_NOTATION](#chapter-14)
- [GRAPHICAL_CATALOG](#chapter-15)
- [GRAPHICAL_EXAMPLES](#chapter-16)
- [SIMULATION](#chapter-17)
- [ARCHITECTURE_PATTERNS](#chapter-18)
- [REQUIREMENTS_AND_DOCUMENTATION](#chapter-19)
- [ONTOLOGY_AND_VIEWS](#chapter-20)
- [KEYWORD_REFERENCE](#chapter-21)
- [IMPLEMENTATION_STATUS](#chapter-22)
- [REVIEW_2_0](#chapter-23)
- [RELEASE_2_0_0](#chapter-24)
- [RELEASE_2_1](#chapter-25)
- [RELEASE_2_2](#chapter-26)
- [TOOLING](#chapter-27)
- [decisions/0016-swaml-2-0](#chapter-28)
- [decisions/0017-readable-names-and-use-cases](#chapter-29)
- [decisions/0018-cases-belong-to-their-subject](#chapter-30)
- [decisions/0019-package-context](#chapter-31)
- [decisions/0020-associated-test-access](#chapter-32)
- [decisions/0021-case-subject-calls](#chapter-33)

<a id="chapter-1"></a>

# swa.ml 2.2 language specification

**Edition:** 2.3 (unreleased candidate) · **Parser:** 2.3 · **Reference profile:** swaml-reference/2.3 · **Status:** allocated draft; nothing in it is published. The candidate accepts the 2.2 language plus the rules of the work packages landed so far, which the maintained chapters carry (WP1: places, selector reads and literal component indexes in test paths; WP2: the whole-expression conditional, contextual words and association lists; WP3: the library packages Swaml::Numeric, Swaml::Text and Swaml::Time; [2.3 release draft](RELEASE_2_3.md)); the published 2.2 edition (10 November 2026), its [reference](SWAML-2.2-Reference.md) and the published 2.1 edition and their artifacts are unchanged. [2.2 release notes](RELEASE_2_2.md) describe syntax-preserving associated-component test access and normal primary-subject calls from both case kinds. [Release notes](RELEASE_2_1.md) describe the changes and the migration from 2.0; the published 2.0 edition remains under its legacy v2.0.0 tag.

swa.ml is the Software Architecture Modeling Language: a textual language for explicit software structure, communication and executable behavior. [ADR 0016](decisions/0016-swaml-2-0.md) accepts the clean restart; [ADR 0019](decisions/0019-package-context.md) adds the package context and executable cases of 2.1. The language has one component concept and one operation concept. It does not accept 1.x source. Published books and PDFs retain their original bytes.

## 1. Normative set

The [concrete grammar](../src/language/swaml.langium) defines tokens and parse structure. These chapters define validity and meaning:

1. [Structure and types](spec/01-structure-and-types.md)
2. [Ports and communication](spec/02-communication.md)
3. [Operations, schedules and states](spec/03-behavior.md)
4. [Deployment, cases, views and conformance](spec/04-systems-and-conformance.md)
5. [Proposed KerML mapping](spec/05-kerml-mapping.md)
6. [Execution contract](spec/06-execution-contract.md)
7. [Normalized model](spec/07-normalized-model.md)
8. [Conformance obligations](spec/08-conformance-obligations.md)
9. [Formal semantics](spec/09-formal-semantics.md)

[Graphical notation](GRAPHICAL_NOTATION.md), its [catalog](GRAPHICAL_CATALOG.md) and the [mapping inventory](../spec/kerml-mapping.json) complete the contract. [Usage](USER_GUIDE.md), [quick start](QUICK_START.md), [AI authoring](AI_GUIDE.md) and [examples](../examples) are informative. [Implementation status](IMPLEMENTATION_STATUS.md) distinguishes implemented checks from contracts and future evidence.

## 2. Precedence and scope

MUST and MUST NOT state requirements; SHOULD requires a documented reason for deviation; MAY grants permission. Grammar acceptance is insufficient when prose constraints fail. Unknown syntax and unsupported editions MUST be rejected. The host selects parser 2.2 and pins its package revision; files are headerless. Formatting never changes validity.

The language is closed. No generic UML/SysML constructs, host code, dynamic topology, generics, overloading, multiple inheritance, recursion or global mutable values are implicit. Platform Nodes model placement identities rather than hardware execution. A simulator run does not prove schedulability, absence of races, universal verification, KerML conformance or graphical editability.

## 3. Invariants

- **I1 Boundary:** every exchange between different component occurrences crosses owned typed port members and an explicit connection/forwarding route.
- **I2 Ownership:** components own private attributes, children and operations. Operations own nested operations and flow or states. Nested operations never capture enclosing locals/parameters.
- **I3 Provenance:** every provided event/attribute has an emitting operation; every required event/attribute and provided operation has exactly one input owner. Forwarded boundaries have no local handler/emitter.
- **I4 Values:** payloads, arguments, results, out values and array iterations are copied. Definition identity never merges occurrence stores. Records/enums retain nominal identity.
- **I5 Policy:** each connection occurrence has a complete effective pinned policy and independent queues. Forwarding has neither. Attributes keep latest values regardless of event/request capacity.
- **I6 Presentation:** views select existing semantic identities; drawings do not create behavior or routes. Layout stays separate; declared timing and observed evidence remain distinguishable.

Local calls, startup, periodic releases, waits, state timers and same-owner after dependencies are local lifecycle/computation. Operator and test inputs use ordinary source components, emitting operations, ports and routes; no destination injection or simulator function-release API exists.

## 4. Inventory

| Family | Ownership and meaning |
| --- | --- |
| Package, import | Flat multi-segment namespace and explicit visibility |
| datatype, enum, arrays | Finite nominal records/enums and copied fixed arrays |
| Component definition/usage | Reusable structure or distinct occurrence; usage body is anonymous specialization |
| Attribute/local/parameter | Occurrence state, lexical local, copied in or success-only out |
| Port definition/usage/member | Directed typed boundary; optional and reversed prefixes |
| Connection/forwarding | Policy-bearing opposite directions or queue-free boundary alias |
| Operation definition/declaration/usage | Reusable signature/body or owned executable, nested without captures |
| Schedule/entry | Trigger binding, dispatch arguments, deadline and concurrency |
| State/transition | Ordered nested receive/timer reactions; final completion |
| Deployment/placement | Software occurrences placed on platform Node occurrences |
| Requirement/case/view | Immutable intent; package-owned use cases and tests with an optional top-level subject occurrence, package associate/satisfy/verify links; stable selection union |

Definitions have qualified declaration identity. Occurrences have root plus indexed child paths. Activations add unique run identity. All transformations preserve these distinctions and source provenance.


---

<a id="chapter-2"></a>

# Quick start: swa.ml 2.2

Read a model in this order: components, attributes, ports, operations, schedule, connections. A def defines a reusable type/body; a usage creates a distinct occurrence. Every value has an explicit type. Every cross-component message has an owned port and explicit route.

```swaml
package HelloGuide {
  port def Greeting { provides event message(text: string); }
  component def Speaker {
    port output: Greeting;
    operation greet() { publish output.message("Hello, swa.ml"); }
    schedule { on start greet(); }
  }
  component def Listener {
    reversed port input: Greeting;
    attribute last: string = "";
    operation accept(text: string) { last = text; }
    schedule { on receive input.message(text) accept(text); }
  }
  component Demo {
    component speaker: Speaker;
    component listener: Listener;
    connect (speaker.output, listener.input);
  }
}
```

Install dependencies with npm ci, build with npm run build, then validate the saved file using node out/src/cli/main.js --json hello.swaml. To execute, create options.json with {"untilNs": 1000000} and run node out/src/cli/simulate.js HelloGuide::Demo options.json hello.swaml. Listener.last becomes Hello, swa.ml through a real routed event. Bare connect uses the pinned Default policy.

Continue with the [usage guide](USER_GUIDE.md), [complete examples](../examples), [AI guide](AI_GUIDE.md) and [support matrix](IMPLEMENTATION_STATUS.md). The 2.2 edition uses the same concrete grammar as 2.1; hosts must select its added test semantics deliberately. See the [2.2 release notes](RELEASE_2_2.md). Published references, including 2.1, remain unchanged; the [2.1 release notes](RELEASE_2_1.md) describe the migration from 2.0.


---

<a id="chapter-3"></a>

# swa.ml 2.2 usage guide

Start with a component, give each persistent value a typed attribute, and write named operations for behavior. Add a schedule to say when those operations run. Add directed ports and explicit connections when behavior crosses component boundaries.

This guide targets the host of the unreleased 2.3 candidate, which so far accepts exactly the 2.2 language with the unchanged 2.1 concrete grammar. For repository validation use Node.js 26.12.0 from .node-version and npm 10.2.3+, then run npm ci and npm run build. Validate with node out/src/cli/main.js --language-version 2.3 model.swaml. Files are headerless; the host and exact package revision select the edition. The published 2.1 reference remains frozen.

## A first model

```swaml
package Counter {
  component Demo {
    /** A small autonomous counter. */
    attribute count: int = 0;
    operation increment() {
      count = count + 1;
    }
    schedule {
      on every 10ms increment();
    }
  }
}
```

Demo is the execution root. count belongs to its occurrence for the run; a var inside increment would belong to that activation/block. The schedule releases at 10ms, 20ms and so on, with a default 10ms deadline. Operations without a schedule entry are local helpers. Unscheduled behavior is not automatically executed.

Create options.json containing {"untilNs": 25000000}, then run:

```sh
node out/src/cli/simulate.js Counter::Demo options.json model.swaml
```

The final Demo.count is 2. The JSON records sources, logical trace, limits and final stores. It is bounded reference evidence with zero physical CPU cost. It does not prove production timing.

## Reuse structure without sharing state

```swaml
package ReuseGuide {
  component def Counter {
    attribute count: int = 0;
    operation increment() { count = count + 1; }
    schedule { on start increment(); }
  }
  component Demo {
    component left: Counter {
      redefines attribute count: int = 10;
    }
    component right: Counter;
    component bank: Counter[3];
  }
}
```

left starts with its own count at 10, then reaches 11. right and every bank index reach 1 independently. A usage body adds members or explicitly redefines an inherited whole member. Single specializes inheritance follows the same rule. Definition identity is shared; occurrence state is separate. Use bank[0] in connector/deployment/view paths. Port arrays and connector loops are absent.

## Choose the value's lifetime

Use const attribute for a fixed per-occurrence configuration value, attribute for mutable component state, var for lexical activation data and typed parameters/results for copied calls. Requirements own immutable attributes. Never read another component's private state by a dotted path.

Primitive types are bool, byte, uint, int, real and string; arrays have fixed extents. Define nominal records with datatype and enums with enum. Construct records with every field, as in record Reading { value = 2.5; unit = "C"; }. Access an enum with Mode.active, or a qualified package name if a local value shadows Mode. Check [the values example](../examples/05-values-and-flow.swaml) for a complete model. Numeric overflow, division by zero and dynamic invalid indexes fail at runtime; narrowing real to int uses the checked Math conversions.

## Compute with operations

```swaml
package OperationGuide {
  operation def Clamp(v: real, lo: real, hi: real) returns real {
    if (v < lo) { return lo; }
    if (v > hi) { return hi; }
    return v;
  }
  component Demo {
    attribute result: real = 0.0;
    operation clamp: Clamp;
    operation calculate() {
      operation double(v: real) returns real { return v * 2.0; }
      result = clamp(double(4.0), 0.0, 5.0);
    }
    schedule { on start calculate(); }
  }
}
```

A declaration has parentheses and optional returns; a usage has a type and inherits its signature. Its optional body replaces the whole definition body. Nested operations come first and never capture the outer operation's parameters/locals. Pass values explicitly. Component operations may read/write their own attributes. Package definitions can use only parameters/nested operations. Calls are expressions; void calls are statements; a value result cannot be discarded. Out arguments name mutable compatible cells and copy back only after success. Recursion and overloading are absent.

Import Swaml::Math explicitly for abs/min/max/floor/round/trunc/length/concat. From 2.3, import Swaml::Numeric for minInt/maxInt/clampInt/clamp and the correctly rounded sqrt, Swaml::Text for intText/realText/boolText (realText(v, decimals) rounds ties away from zero and fails with Bounds above 15 decimals or from 1e21) and Swaml::Time for now(), the logical time in nanoseconds, which reads state and is not allowed in attribute initializers ([square root](../examples/38-square-root.swaml), [logical clock](../examples/39-logical-clock.swaml) and [number text](../examples/40-number-text.swaml) examples). View, QoS, CallFailure and Platform libraries are also loaded and explicitly imported when using their short names. Do not invent host built-ins or assume an arbitrary library exists.

## Connect components

[The hello model](../examples/01-hello.swaml) is the smallest complete routed example. A port definition declares provides event message(value: string). Sender owns a port of that type and emits with publish. Receiver uses reversed port, making that member requires, and binds it once in on receive. The root connects the two child ports.

Use provides/requires on each member, rather than assigning a role to the whole port. send updates a provided attribute; publish emits a provided event; p.operation(args) calls a required operation. Port definitions may differ if their members match structurally by name and compatible type. Records/enums remain nominal. A boundary-to-child same-direction connection forwards the boundary without queue/latency; it cannot have a policy or local handler.

A bare connect uses Swaml::Qos::Default: atMostOnce, fifo, capacity 16, reject, request timeout 1s. Select a named complete policy with connect link: Reliable (a.p, b.p). Reliable requests need an idempotent provided operation. Attributes retain the latest pending value regardless of event/request buffering. Nonoptional ports of every concrete root must resolve to a connection. optional only waives that port's closure requirement.

## Serve and request a value

See [the service example](../examples/07-client-server.swaml). The provider binds its provided operation through on call api.get(k) get(k). The consumer calls its own required member and usually chooses an explicit fallback:

```text
last = try(api.get(1), -1.0);
```

Timeout comes from the route policy. A bare failing call fails the activation; try catches runtime expression failures and evaluates fallback lazily. Static errors, interruption, deadlines and resource violations cannot be caught. Committed effects remain committed. The reason is trace evidence and is not an implicit model variable. A suspending call must be the whole initializer, assignment value or statement, optionally wrapped in try; avoid api.get(1) + 2.

## Schedule and suspend deliberately

on start runs once; on every D runs periodically; on receive binds an incoming event/attribute; on call serves a provided operation; after op runs after successful whole same-owner completion. One operation may have several entries, but the same trigger/operation pair cannot appear twice in one block. After dependencies are acyclic and release fresh parameterless void activations, with no forwarded arguments or result. [The chaining example](../examples/25-function-completion.swaml) shows this distinction.

wait, requests and receive statements release the component's serial lock. Another activation can change attributes before resumption. Recheck conditions after resuming before writing state. A concurrent entry cannot write state, even through a helper or out argument, and always reads its dispatch snapshot. Entry deadlines include suspension/backlog; an every entry defaults to its period. WCET belongs to target binding/evidence.

From 2.3 a duration literal such as 250ms is a uint value in nanoseconds, so durations can be computed. Write them in parentheses: wait (delayMs * 1ms);, or after (ackTimeoutMs * 1ms) { … }, a state timer after (pulseMs * 1ms) to Locked { } (evaluated when the state's entry actions finish) and on every (periodMs * 1ms) poll() deadline (periodMs * 1ms / 2);. A period or deadline uses only literals, const attributes, arithmetic with exact integral division, comparisons and the conditional, and is evaluated for each occurrence, so a usage that redefines periodMs gets its own period. Multiply by a unit: after (pulseMs) would count nanoseconds (warning SW2016). A computed delay that is not positive fails with DurationRange, which try catches ([computed backoff](../examples/41-computed-backoff.swaml), [lock pulse](../examples/42-lock-pulse.swaml) and [derived period](../examples/43-derived-period.swaml) examples).

while tests first; until tests after its body. An optional n times limit evaluates once and exits normally. Counted for and copied-array for in have lexical loop scopes. [The loop model](../examples/18-control-loops.swaml) covers every form. Unbounded loops are permitted but a finite run has a step budget/deadline.

## Receive, interrupt and model state

[Receive statements](../examples/21-receive-and-try.swaml) wait for one of several explicitly bound inputs or a timeout, keeping early input queued. An [interruptible region](../examples/19-interruptible-function.swaml) is armed only during its body/callees and transfers within the same activation, preserving committed effects. Inactive region input is discarded observably; heed SW2012.

For a state machine, write initial and state directly in an operation. Put transitions inside each source state, in the order they should be tested. Use on entry/on exit, on receive with optional when, after D to Target, and final state. A stateful operation has no parameters/result and exactly one on start schedule entry. [The state example](../examples/04-stateful-function.swaml) completes at its final state; idle reactions do not release after dependents.

## Describe deployment, intent and views

Use a separate deployment declaration over software and platform roots. Targets are component occurrences specializing Swaml::Platform::Node. Const attributes may retain external ref identities; task/core scheduling stays in target adapters. [The deployment example](../examples/22-platform-deployment.swaml) shows family placement with an indexed override.

Requirements, satisfy and test/verify record intent. [The traceability example](../examples/16-requirements-and-views.swaml) includes a test of its root, satisfy and verify links and views. A case does not inject events at a destination; a case script acts through actor ports and its pass is evidence of one run, not proof.

A package is a closed context. Declare the system and its surroundings as top-level component occurrences and join their ports with package connections, connect (customer.panel, atm.panel);. Write use case Name of subject { … } or test Name of subject { … } in the package; the subject is its focal top-level occurrence. A case without statements records intent only and may omit of; a script requires of. Script-driven actors and stubs are interface-only components, component def Customer { port panel: Panel; }, which need no implementation; associate customer to 'Withdraw cash'; records participation. satisfy Requirement by design; claims a component definition or occurrence path of the package, and verify Requirement by Test; links a test. [The use case example](../examples/28-use-cases.swaml) shows these package links and quoted names.

A case body may continue after its documentation with statements acting through its associated interface-only actors: publish customer.panel.cashRequested(100); and on receive customer.panel.cashDispensed(amount) { assert amount == 100; } or after 2s { fail "no cash"; }. A script can answer a stub request with on call bank.link.authorize(amount) { return false; }. Both use cases and tests may call operations of their primary subject, such as var amount: int = atm.withdraw(20);. The operation runs in the subject's own context and may communicate, receive and wait; the case resumes when it returns. A test may additionally inspect private attributes and call eligible helpers on explicitly associated same-package roots and single parts. Use cases cannot inspect private state or directly call those extra owners. Association does not create components or permit impersonating an active collaborator's ports.

Subject calls are sequential. An event emitted by the subject can stay queued for a later actor receive, as in the [subject-call example](../examples/31-case-subject-calls.swaml). If the subject instead waits for a reply from an actor, a later reply branch in the same blocked case cannot run. Give that actor independent behavior, or start the subject with an actor event before handling its reply. Stateful operations retain their on-start-only lifecycle. Suspended calls use a whole initializer, assignment or statement; immediate calls may still appear in expressions.

swaml test runs every case in its own fresh whole-package run and reports pass, fail, inconclusive or no checks; [the executable cases example](../examples/29-executable-cases.swaml) adds an isolation package with a bank stub, and [the associated-component example](../examples/30-associated-integration.swaml) checks several implemented peers. Names containing spaces, letters outside ASCII or reserved words are written in single quotes, for example use case 'Withdraw cash' or attribute 'record': int = 0;. From 2.3, view, state, in and out are contextual words, so attribute state: SessionState = SessionState.offline; needs no quotes ([the contextual words example](../examples/36-contextual-words.swaml)). One associate statement may list several occurrences and cases, associate truck, van to 'Monitor live position', 'Command a vehicle';, and associates each listed occurrence with each listed case ([the association list example](../examples/37-association-lists.swaml)); a value chosen by a condition is written x = if (c) a else b; ([the conditional example](../examples/35-conditional-expression.swaml)).

Import Swaml::Views and type views by General, Interconnect, Case, Sequence, Grid, Flow or Timing. Compact of selects a subject; include/recursive/where builds a stable union. Filter kinds are component and operation for the structural/executable families. Browser navigates ownership; Flow combines statements/states; Timing separates declared schedule/deadline information from identified observed traces. Presentation layout belongs in sidecars, not language source.

## Validate and repair

```sh
node out/src/cli/main.js --json model.swaml
node out/src/cli/main.js --format model.swaml
node out/src/cli/main.js --check-format model.swaml
npm run check
```

Load every application dependency together. Fix syntax/names first, then ownership/routes, types/effects and schedules. JSON diagnostics expose stable codes/ranges and identity metadata. Always revalidate after a repair; formatting is not a semantic repair. Read [AI authoring](AI_GUIDE.md), the [keyword reference](KEYWORD_REFERENCE.md) and the [support matrix](IMPLEMENTATION_STATUS.md) for precise boundaries.

## Test explicitly associated components

In the 2.2 semantics, a test may inspect its primary subject and the software components explicitly referenced by its `associate` links, including their single parts and, from 2.3, a member of a part family named by a literal index such as `backend.twins[0].link`. The components remain owned by the structural model. For example:

```swaml
package AssociatedTests {
  component def Counter { attribute count: int = 0; operation bump() { count = count + 1; } }
  component def Assembly { component worker: Counter; }
  component primary: Counter;
  component companion: Assembly;
  test Integration of primary {
    companion.worker.bump();
    assert primary.count == 0 and companion.worker.count == 1;
  }
  associate companion to Integration;
}
```

Without the association, access to `companion` is rejected. A use case gains no private state or direct peer/part access from that association. Normal calls on the exact primary subject work in both case kinds; helper calls on the extra test owners must neither communicate nor suspend, although they may change the target through its own operation. Direct attribute assignment stays forbidden. Communicate through the subject's own operation or associated interface-only actor ports and real connections; association does not let a script take over an active component's ports.

Every case still initializes and runs its whole package, and each run gets fresh stores. Associations do not select a subset, disable unrelated startup work, create an atomic snapshot or own components. Only executed, non-multiple software roots are accessible; nested singleton parts work, while intermediate component indexes remain unsupported. See the [ten-component routed integration](../examples/30-associated-integration.swaml) and [2.2 release notes](RELEASE_2_2.md).


---

<a id="chapter-4"></a>

# AI authoring with swa.ml 2.2

Treat swa.ml as typed source that must be validated, rather than prose to approximate. Start with [the usage guide](USER_GUIDE.md), inspect a relevant [complete example](../examples), and read the affected normative chapter. Pin parser 2.2 and the exact package revision. Use the portable repository skills [swaml-author](../skills/swaml-author/SKILL.md) and [swaml-validate](../skills/swaml-validate/SKILL.md); they are versioned with the language and may be installed in the user's agent skill directory. They do not authorize publication or external messages.

## Build a model from intent

Identify execution roots and reusable component definitions. Assign each persistent value to one component attribute, configuration to const attribute and scratch data to var. Identify every exchange before writing behavior: give its two sides owned port members with provides/requires, then an explicit connect route. Decide which inputs are queued events and which are latest attributes. Bind each input exactly once.

Write operations with explicit parameter/result types. Use return for values, expressions for calls and statements for void calls. Nested operations take explicit inputs; they do not capture enclosing locals. A package operation def is parameter-only reusable behavior. Use a usage to reuse its signature/body. No class/function/calc/interface, role suffixes, call/as syntax, profile or old transition syntax is accepted.

Put activation in one schedule. Use on start/every/receive/call or after same-owner operation. Select complete policy definitions where Default is unsuitable. Keep remote calls as whole initializer/assignment/statement forms, optionally in try. Recheck live attributes after suspension; use concurrent only when the transitive operation graph cannot write. Copy-back of out parameters occurs only on success.

Multiplicity is literal and paths are indexed explicitly. Deployment targets are platform Node occurrences. Requirements express intent. A case without statements records intent; a case with statements drives its primary subject through normal operation calls or associated interface-only actor ports and runs with swaml test, as bounded evidence rather than proof. A package is a closed context: declare top-level component occurrences, join their ports with package connections, connect (customer.panel, atm.panel);, and write use case Name of subject { … } or test Name of subject { … } as package members, where the subject is a top-level occurrence of the same package. Write script-driven external systems and stubs as interface-only components (ports only) and associate them with associate customer to Name;. Script endpoints use occurrence.port.member, and on call bank.link.authorize(amount) { return true; } answers a stub request. Private reads and direct helper calls on parts/peers remain test-only; a normal primary-subject call works in either case kind. Claims are package links: satisfy Requirement by design; and verify Requirement by Test;. Quote names that contain spaces, letters outside ASCII or reserved words, such as 'Withdraw cash'; from 2.3, view, state, in and out are contextual and need no quotes. One associate statement may list occurrences and cases, associate truck, van to 'A', 'B';, which associates every pair; never repeat a pair. Select a value with the whole-expression conditional x = if (c) a else b;, parenthesized as an operand, never as a statement. View definitions select existing identities, with geometry separate.

## Validate–fix loop

```sh
npm run build
node out/src/cli/main.js --json model.swaml dependency.swaml
node out/src/cli/main.js --format model.swaml
node out/src/cli/main.js --json model.swaml dependency.swaml
```

Inspect errorCount and diagnostic code/range/message/data. Resolve parser/name errors before reasoning from a recovered AST. Fix the smallest relevant declaration, keeping private scopes and explicit routes intact. A suggested edit is advice to revalidate, never permission to apply a stale edit. Validate the complete source workspace after changes, including negative lookups made ambiguous by newly loaded files. Never invent a library, untyped value, implicit port, hidden event or direct destination injection to silence diagnostics.

Run a bounded simulation only after validation. Choose the run target: a package runs its top-level occurrences with their package connections, Package::component runs one top-level occurrence with its ports open. Record source bytes/hashes, target, profile, options, deployments and trace; trace sources name the statements that caused each observation. Inspect final occurrence stores and relevant failure/timeout/discard/interrupt observations. A caught failure is still evidence of that runtime failure; no-failure-observed is a finite-run statement. Show declared timing separately from observed intervals and never label zero-cost logical steps as measured WCET.

## Common diagnostics

| Group | Repair direction |
| --- | --- |
| SW2001 | Load/import the correct package, disambiguate a name, remove shadowing |
| SW2002 | Correct explicit types, record shape, fallback/result or array bounds |
| SW2003 | Add explicit redefines only for a real compatible inherited member; break cycles |
| SW2004/2005 | Repair member direction/type/route/closure, emission provenance or exclusive input owner |
| SW2006 | Correct nested scope, return/out use, effects or whole-expression suspension |
| SW2007/2008 | Repair schedule identity/signature/after graph or ordered state ownership |
| SW2009/2010 | Resolve occurrence/Node paths, case subjects, associate/satisfy/verify targets in the same package, view subject, or a script actor that must be associated and interface-only |
| SW2011/2012 | Recheck live state after resumption; account for inactive interrupt input |
| SW2013 | Supply complete typed policy values and safe positive durations |

Keep diagnostics/evidence honest. Consult [implementation status](IMPLEMENTATION_STATUS.md) before claiming full V/E/G/K support. Publishing a page or release is a separate user-authorized action; this project requires a design preview before publication.

For 2.2 tests, resolve each inspection root to the subject or an explicit same-package `associate` occurrence. Follow only existing single parts and, from 2.3, members of part families named by a literal index such as `backend.twins[0].link` (WP1-S06); preserve effective inherited members and exact occurrence identity. Both case kinds may call operations of the exact primary subject normally, including its own port communication and waits; use cases gain no private reads, part calls or peer calls. Calls on extra test owners remain immediate noncommunicating helpers. Unassociated peers, same-prefix names, platform roots, unindexed multiplicity families and non-literal component indexes do not gain access. Association never owns an occurrence or narrows the whole-package run. Actor interaction keeps its associated interface-only port rules. See [ADR 0020](decisions/0020-associated-test-access.md) and [ADR 0021](decisions/0021-case-subject-calls.md).


---

<a id="chapter-5"></a>

# 1. Structure, names and types

Normative chapter of [swa.ml 2.2](LANGUAGE_SPECIFICATION.md).

## 1.1 Names and documentation

Files contain packages without a version header. Package names may contain several :: segments; packages do not nest. import P; exposes P's top-level declarations and requires that package in the loaded workspace. Qualified references are unambiguous; ambiguous short imports are errors independent of load order. Names are unique in their scope; a package's elements and named package connections share one namespace. No overloads or implicit imports exist. The contextual words associate, by, case, in, kind, name, out, path, reversed, state, test, times, to, use and view and the duration units ns, us, ms and s remain legal names outside their syntactic positions. Other literal words in the grammar are reserved.

A package is a closed context. It owns definitions, top-level component occurrences, package connections between those occurrences, use cases, tests and the associate, satisfy and verify links that record intent about them. Definitions, requirements and other declarations may be imported; occurrences are never connected, made a case subject or associated across packages.

A name is written as a basic name, an ASCII letter or underscore followed by ASCII letters, digits or underscores, or as a quoted name between single quotes, such as 'Withdraw cash', 'Bestellübersicht' or 'operation'. Inside quotes, `\'` writes a quote and `\\` a backslash; other escapes, line breaks and control characters are invalid. The name is the quoted content: 'Pump' and Pump are the same name, and a quoted reserved word is an ordinary name. A quoted name is not empty, contains no '.', ':', '[' or ']', which delimit paths, and separates words by single spaces without leading or trailing space (SW2001). Tools write a basic name whenever one is legal and quote otherwise. Qualified names and paths combine spellings, as in Shop::'Order Service'.port; a string literal holding a path, such as a view filter value, contains the unquoted names.

| ID | Rule |
| --- | --- |
| WP2-S01 | **Contextual words.** From 2.3, `view`, `state`, `in` and `out` are contextual: they keep their keyword roles (views, states and `initial`, parameter directions, `for … in`) and are legal names in every name position: attribute, local, parameter, operation, state, initial state, component, port, port member and endpoint, view, enum literal, field, package segment, and both positions of `for (x: T in values)`. `defer` is an ordinary basic name until the work package that introduces the `defer` keyword makes it contextual (WP5-S01). |
| WP2-M01 | **Edition-aware spelling.** Name services (`formatName`, `formatQualifiedName` and `formatPath` in `src/language/names.ts`) take the workspace edition. For a 2.3 workspace they write a contextual word as a basic name; for a 2.2 or earlier workspace they keep quoting `view`, `state`, `in` and `out`, which are reserved there. A quoted spelling such as 'state' remains valid and denotes the same name. |
| WP5-S01 | **`defer` is contextual.** `defer` is a keyword only at the start of a state member, where it begins a deferral (chapter 3.6); everywhere else it is a basic name in every name position, as it was in 2.2. Because 2.2 had no such word, `defer` is never reserved in any edition: name services (`formatName`, `formatPath`) write it unquoted for 2.2 and 2.3 workspaces alike, it is not one of `CONTEXTUAL_FROM_2_3` (the words that were reserved in 2.2) but of `KEYWORDS_FROM_2_3` in `src/language/names.ts`, and no 2.2 spelling, message or rename changes. A statement that starts with the name `defer` continues with `=`, `(`, `.` or `[`, never with a name, so it never reads as a deferral. |

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

var declares an activation/block local. in is the default parameter direction and is immutable; out parameters are mutable with success-only copy-back. Live names cannot shadow another live local, parameter or attribute. A nested operation sees its own parameters, its nested operations and the owning component's attributes, never enclosing parameters or locals. Local data access never traverses child components or ports, except a sampled read `p.m` of an owned port (chapter 2.6, WP6-S01).

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

**Durations (2.3).** A duration literal such as `250ms` is an expression value from 2.3: a `uint` number of nanoseconds, so `pulseMs * 1ms` is a computed duration and `const attribute timeoutNs: uint = 5ms;` is an ordinary const attribute. Computed durations are written in parentheses in waits, receive timeouts, state timers, periods and deadlines (chapter 3; the [computed backoff](../examples/41-computed-backoff.swaml), [lock pulse](../examples/42-lock-pulse.swaml) and [derived period](../examples/43-derived-period.swaml) examples).

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

The before-and-after examples are [square root](../examples/38-square-root.swaml), [logical clock](../examples/39-logical-clock.swaml) and [number text](../examples/40-number-text.swaml). Trigonometry and enum conversions are not part of 2.3.


---

<a id="chapter-6"></a>

# 2. Ports and communication

Normative chapter of [swa.ml 2.2](LANGUAGE_SPECIFICATION.md).

## 2.1 Directed port members

A port def owns named provides/requires attribute, event and operation members. An attribute carries one typed value, an event has copied in parameters, and an operation has in/out parameters and an optional returns result. Only operation members may be idempotent. Interfaces, interface kinds, versions, roles and separate signals do not exist.

A component uses port p: Definition; or an inline port body. reversed flips every member direction. optional is a prefix that waives that port's closure requirement; it does not waive required ports elsewhere on a forwarding chain. A provided attribute/event is emitted by this side; a provided operation is implemented by this side. Requires means the opposite.

Every provided attribute/event MUST have syntactic operation emission provenance. Every required event and provided operation, and every required attribute that is not sampled (section 2.6), MUST have exactly one owner: a schedule entry, one stateful operation's transition set, one receive statement or one interrupt region. Multiple alternative transitions in that one stateful operation are one owner. A sampled required attribute has zero or one consuming owner; sampling is not ownership. A forwarded boundary is never also locally handled or emitted. An interface-only component (section 1.2) is exempt from these provenance and owner rules.

| ID | Rule |
| --- | --- |
| WP6-S02 | **Initial value.** An attribute member may declare an initial value, `provides attribute ajar: bool = false;` (grammar WP6-G01). The expression is pure (SW2006) and assignable to the member type (SW2002), with the attribute-initializer messages (WP6-D04); it is checked once where the member is declared. Event and operation members have none (grammar). |
| WP6-S03 | **Mandatory when sampled.** A member is sampled only when its declaration in the sampling port's definition, the one the port has in the executing occurrence after redefinition, has an initial value (WP6-S01), so a read of a member without one keeps its 2.2 diagnostics. A port redefinition (`redefines port`, in a specialization or a usage) that removes the initial value of a member that inherited behaviour samples is SW2004 `Sampled attribute {member} of {portDefinition} needs an initial value: inherited {operation} samples {port}.{member}.` at the redefinition, and one that changes its type (which a forwarding-compatible redefinition may widen) is SW2004 `… must keep type {type}: …` (WP6-D02), because the inherited read was typed with the base's member; a redefinition may change the value, and the cell then starts with the value of the port the occurrence has. The provider side's initial value, if any, has no runtime meaning in 2.3. |
| WP6-S04 | **Ownership.** A sampled required attribute has zero or one consuming owner; sampling is not ownership. Two owners keep the SW2005 message `{port}.{member} needs exactly one input owner.`; a sampled member with no owner is not reported (WP6-D03). A member is sampled by a component when one of its executables or schedule-entry arguments contains a sampled read of it (`sampledMembers`). |

All input stimuli, including operator/test drivers, are ordinary typed emissions from validated source operations or case scripts through routes; a case script emits only at the ports of its associated interface-only occurrences. Hidden harness releases and destination injection are forbidden. An unconnected optional request fails unavailable. An optional unconnected event/attribute emission has no recipient and remains observable.

## 2.2 Structural compatibility

Connection compares names independently of declaration order or port-definition identity. Every requires member on either side has a provides member of the same name and kind on the peer. Extra provides are permitted. For attribute/event delivery the provided payload is assignable to the required payload. For operation in parameters the required type is assignable to the provided type; out parameters reverse this variance. The provided result is assignable to the required result. Directions and parameter arity agree. Records and enums are nominal; numeric widening is permitted. Every missing/mismatched member produces an individual diagnostic.

Forwarding compares a boundary and immediate child's port in the same direction. The child supplies every boundary member with preserved direction and compatible payload/signature. Child requirements cannot be lost at the boundary. This aliases identities rather than generating messages.

## 2.3 Connectors and closure

connect (a, b); joins owned ports or ports of immediate children. A child with multiplicity requires a literal index. Name and policy are optional: connect link: Reliable (a, b);. Endpoints are unordered.

| ID | Rule |
| --- | --- |
| WP6-S05 | **Member policies.** A connection may end in a body of member policies instead of `;` (grammar WP6-G02), `connect bodyCan: Cyclic (bcm.bus, dcu.canBus) { crash: CanEvent; }`. Each names a member present, by name, in both connected ports, and so routed by this connection, at most once per connection. A body on a derived forwarding is an error. Package connections may carry member policies. All are SW2004 (WP6-D06): `Member policies are not allowed on forwarding {connection}.`, `{member} is not a member of both ports of {connection}.`, `{member} has two policies in {connection}.`, where `{connection}` is the connection's name or `connect ({source}, {target})`. [Example 49](../examples/49-body-can-member-policies.swaml) queues event frames and keeps only the newest cyclic frame on one connection. |
| WP6-S06 | **Redefinition.** `redefines connect` replaces the whole inherited connection, including all its member policies; nothing is merged. |

A connect may also be a package member. Each end of a package connection is occurrence.port, where occurrence is a top-level component occurrence declared in the same package; a nested path, a definition or an imported occurrence is an error (SW2004). A package connection is always a connection, never forwarding, and follows the same compatibility, duplicate, policy and idempotence rules. It cannot redefine.

Boundary-to-child endpoints derive forwarding when same-direction compatibility holds. Forwarding has no queue or policy; a policy is an error. Each boundary and child port is forwarded at most once. Other endpoints derive a connection using opposite-direction compatibility. Invalid endpoints report the applicable compatibility failures. Self connections and duplicate endpoint pairs, including duplicates after forwarding resolution, are errors.

Closure is checked per package. Every nonoptional port of every occurrence of the package's top-level occurrences MUST resolve through any forwarding aliases to a connection: inside its component as before or, for a port of a top-level occurrence, through package connections. Closure inside a component is unchanged. A required attribute or operation has exactly one peer after forwarding. Event-only required ports permit multiple peers. A connector owns its queue identities per expanded occurrence, direction and member; sharing a named policy never shares queues. Distinct connections remain independent under fanout. Partial fanout effects committed before a failed offer remain committed.

## 2.4 Versioned policies and queues

A named qos def is typed by Swaml::Qos::Policy and supplies complete valid delivery, ordering, capacity, overflow and requestTimeout fields, plus optional maxLatency/maxAge. Values use the typed Delivery, Ordering and Overflow enums. Member policies select a named policy per member; inline policies and field overrides do not exist. Each effective use is checked, including inherited connections and idempotency obligations.

| ID | Rule |
| --- | --- |
| WP6-S07 | **Effective policy of a member route.** The effective policy of a member route is its member policy, else the connection policy, else `Swaml::Qos::Default` (`memberQos` in `semantic.ts`). Every completeness and idempotency check (SW2013) applies per member route (WP6-D07): an `atLeastOnce` member policy needs an idempotent provided operation, and a member policy that is not `atLeastOnce` lifts the obligation of an `atLeastOnce` connection policy for that member. A member policy names a `qos def`, whose completeness is checked at the definition. The deferral warning SW2018 (WP5-D09) uses the effective policy of the deferred member's route. |

| ID | Rule |
| --- | --- |
| WP4-S02 | **Policy setting values.** A setting is `name = Expression;` (grammar WP4-G01). `requestTimeout`, `maxLatency` and `maxAge` are duration literals, optionally parenthesized; a computed value such as `requestTimeout = 2 * 1s;` is SW2013 `{setting} must be a duration literal such as 1s.` (WP4-D01). Any other setting is not a duration: a duration literal inside a larger value, such as `capacity = 4ms * 2;`, is SW2013 `{setting} is not a duration setting.`. The 2.2 forms keep their 2.2 rules and messages: `capacity = 5ms;` stays SW2013 `capacity needs a positive integer count, not a duration.` and a timeout without a duration, such as `requestTimeout = 5;`, stays `requestTimeout needs a duration.`. |
| WP4-M01 | `settingDuration` (`semantic.ts`) is the duration literal of a 2.2-form setting (`Literal.duration` of the setting's value); `effectiveQos` and the validator read the duration through it, so the effective policies of 2.2 sources are unchanged (gate 1 under normalization N1, and the sixth extended 2.2 set). |

Default is atMostOnce, fifo, capacity 16, reject, requestTimeout 1s, without latency/age bounds. Latest is atMostOnce/fifo/1/dropOldest/1s. Reliable is atLeastOnce/fifo/16/reject/1s. BestEffort is bestEffort/unordered/16/dropNewest/1s. These are pinned library values, always inspectable. atLeastOnce requests require an idempotent provided operation declaration; the declaration alone does not prove actual idempotence.

Policy buffering applies to events and requests. Attribute members keep only the latest pending value independently of capacity and overflow. fifo preserves order within its queue. Unordered allows other orders, although the deterministic reference interpreter chooses insertion order. Overflow rejects the offer with a runtime failure or discards the selected oldest/newest message observably. Age discards are observable; latency assumptions are contract obligations. A backend identifies delivery and failure assumptions explicitly.

## 2.5 Requests, replies and failure

A required operation is called as p.member(args). Its timeout comes from the effective policy of its member route (WP6-S07). Each request has a unique correlation and its response returns on the same member/route in reverse. Successful result and out values are copied back together; failure copies neither. Timeout, unavailable, rejected, transport and remoteFailure are failure reasons recorded as Swaml::Calls::CallFailure values or local runtime kinds in evidence. The model cannot inspect the reason.

A request suspends and releases the caller's serial lock. Timeout and reply at the same timestamp resolve as timeout; terminal correlations never reopen. Late replies are suppressed observably. Interruption cancels the local request continuation and correlation; the server continues and its committed effects remain. The interrupted terminal is not a catchable failure. try catches expression failures and supplies a compatible lazy fallback; bare calls propagate failure to the activation.

## 2.6 Sampled reads

An attribute member opts in to sampling when it declares an initial value. A component reads the latest value delivered to such a required attribute without a receive handler, as `door.ajar`, where `door` is the port and `ajar` the member ([example 48](../examples/48-door-status-sampling.swaml)):

```text
port def DoorState { provides attribute ajar: bool = false; }
component def ComMain {
  reversed port door: DoorState;
  operation txMain() { publish tx.status(record StatusPdu { ajar = door.ajar; }); }
}
```

| ID | Rule |
| --- | --- |
| WP6-S01 | **Form.** In an operation body, in a transition, completion or timer guard, or in an argument or release guard (WP7-S02) of a schedule entry of the owning component (evaluated at dispatch, in the activation's first segment, WP6-R03, WP7-R01), `p.m` is a sampled read when `p` is an owned port of the executing component, its member `m`, in the definition the port has in the executing occurrence after redefinition, is an attribute that declares an initial value (the member opts in to sampling), and no local, parameter, loop variable or binding named `p` is visible at the read, by the scope rules of chapter 1.3 (a local of another branch, of a later statement or of a nested operation does not hide the port; `localVisible` in `semantic.ts`). `m` must be required after reversal (SW2006 `{port}.{member} is not a required attribute of an owned port.`, WP6-D05). Fields, an index and selectors may follow the member. The value is the member's type and the effect class is *reads state*. A reference `p.m` to a member that declares no initial value keeps its 2.2 meaning and diagnostics (SW2002 `Unknown local value p.m; …`), also when another member of the same port opts in, so no 2.2 source changes (owner decision A of WP6). |
| WP6-S08 | **Forbidden ports and positions.** Sampling a forwarded boundary port is SW2005 `{port}.{member} cannot be sampled: {port} is a forwarded boundary.` (WP6-D01). `p.m` on a child's port remains an error with its 2.2 diagnostic (SW2002). A sampled read is not allowed in an attribute initializer (SW2006 `A sampled read is not allowed in an initializer.`) or in the constant sublanguage of chapter 3.5 (SW2007 `A sampled read is not allowed in a constant duration.`, WP6-D05). A member's initial value is checked without a component, so a reference in it is unknown (SW2002). Case scripts do not sample (WP6-S09). |
| WP6-R01 | **Cell.** Each port occurrence holds one sample cell per sampled member, initialized to the member's initial value before startup work is released. A read never fails. |
| WP6-R02 | **Update instant.** A cell takes a value at the instant the value is delivered to the port: the message's delivery time after the route's latency and fault delay. This is independent of whether a receive owner consumes it, and of a newer value replacing it in the owner's pending queue. A dropped offer, and a value older than the route's `maxAge` at delivery (observed as `discardAge`), does not update the cell. Each duplicate copy updates it at its own delivery instant. A cell never goes back to an older value: a value whose offer precedes the offer of the value the cell holds, delivered later because of a fault delay or a longer latency, updates nothing and produces no observation (no `sample` and no other kind; its `offer` is the last observation of that value), so the cell agrees with the newest value offered among those delivered, as an owner's pending queue keeps the newest offer (owner decision B of WP6). Within one logical instant, events run in the deterministic event order (time, phase, insertion ordinal). An activation sees the cell updates ordered before its reading step in that order. A delivery produced later in the same instant, for example by a zero-latency send from an activation that runs in that instant, is seen only by reads ordered after it. Worked example: at t = 20 ms a periodic `producer.tick` sends `level.value(v)` over a zero-latency connection, and a periodic `consumer.slot()` of another component, whose body first tests `if (level.value > 0)`, is released at the same instant. If the consumer's first step is ordered before the producer's step, its test reads the previous value; the new value is delivered later in the same instant and is seen by the next activation that reads it after that delivery, at the latest the release at t = 40 ms (the rest of this activation keeps the value it read, WP6-R03). If the producer's step and the delivery come first, the test reads the new value. |
| WP6-R03 | **Live reads, stable within a segment.** Every activation, serial or concurrent, reads the live cell: cells are not part of a concurrent dispatch snapshot. The first read of a cell in an activation segment, after the activation starts or resumes, copies the live cell, and later reads of that cell until the next suspension see that copy, although the steps of activations of other occurrences interleave with them. So a guard and the body of one activation, and the schedule-entry arguments and release guard evaluated at dispatch, see the same value unless the body suspends in between, and a read after a suspension sees the newer value. |
| WP6-R04 | **No consumer.** A sampled member without a consuming owner has no pending-value queue and no `deliver` or `replaceAttribute` observation. Its cell is the only store, and its offers and drops remain observable. |

Sampled reads serve level-triggered use. Edge reactions, such as resetting on a mode change, switching outputs off on entering sleep or detecting wake-up, keep receive handlers. A release guard cannot detect an edge on the member its own `receive` entry consumes: the cell is updated at delivery (WP6-R02), before that entry is released, so in `on receive mode.current(p) onMode(p) when (p != mode.current);` the binding and the sampled read hold the same new value and the guard is always false. Completion guards are not re-evaluated when a cell is updated (WP5-R03); a completion guard that reads only cells gets SW2017 (WP5-D08).

B21 (service discovery) is rejected. A team models each binding as a static, optionally `optional`, connection, exposes availability as `provides attribute available: bool = false;` and samples it.


---

<a id="chapter-7"></a>

# 3. Operations, schedules and states

Normative chapter of [swa.ml 2.2](LANGUAGE_SPECIFICATION.md).

## 3.1 Operations and effects

An operation declaration always has parentheses and an optional returns T result; omission means void. operation def is package-owned reusable behavior. An operation usage has a type after a colon, no parentheses/result, and optionally replaces the whole inherited body. Names are unique and call graphs acyclic. Nested operations precede executable statements/states and never capture enclosing locals/parameters. A body owns flow or states directly; the body grouping has no executable identity.

Calls are expressions. A void call is a statement; a non-void result cannot be silently discarded. Calls with out arguments are statements; each out argument is a mutable compatible local, out parameter or component attribute. In/out values are copied and out copy-back occurs only after successful whole return. An operation of a component cannot invoke a different component by a structural path; it must use its own required port operation. Case scripts have the explicitly limited subject/helper access of section 3.7. Stateful operations are activated by their schedule rather than called locally.

| ID | Rule |
| --- | --- |
| WP1-S04 | **Out arguments.** Out arguments remain bare names; a place is not an out argument in 2.3 (SW2006, WP1-D03). |

Effects are inferred transitively through the acyclic call graph: pure, reads state, writes state, communicates, suspends. The implementation MUST also retain a writes flag when a higher effect dominates, so communicating/suspending callees cannot conceal a write. Passing an attribute as out is a write. A place assignment has the write effect of its root, and an attribute root is an attribute write. Attribute initializers are pure. State guards may only be pure or read state. Concurrent schedule entries cannot write state through any reachable callee or out argument.

| ID | Rule |
| --- | --- |
| WP3-S01 | **`now()` effect.** `Swaml::Time::now()` has the effect class *reads state*, like a read of an attribute, although it reads the run clock rather than component state. It is therefore rejected in attribute and member initializers, requirement attributes and redefined attribute values included (SW2006, WP3-D01), and a package operation definition that calls it is rejected like any package definition that reads state (`Package definitions may use only parameters and nested operations.`). It is allowed in every other expression: statements, return values, schedule arguments, receive and state guards, concurrent entries (which may read state) and case scripts. It is rejected in the constant sublanguage of periods and deadlines (SW2007, WP4-S05) and will be rejected in completion guards (WP5-S03) when they arrive. |

Suspending calls may be the whole var initializer, assignment right side or expression statement, optionally wrapped in try; these must be ordinary statement values, not for-header initializers or updates. Evaluate the call before the loop when its result is needed there. Suspending calls cannot be embedded in arithmetic, call arguments, return values or predicates. Other expressions can have nonsuspending effects. Arguments evaluate left to right; only and/or short-circuit. Declarations and source order do not select overloads or change resolution.

| ID | Rule |
| --- | --- |
| WP2-S04 | **Conditional effects.** The effect of a conditional is the union of its condition and both branches, whichever branch a run selects; a concurrent entry therefore cannot write through either branch. No suspending call may appear anywhere in a conditional, including inside try, a record or array literal or a nested conditional (SW2006, WP2-D02); store the result of a suspending call first. Outside conditionals the whole-expression suspension rule is unchanged. |

## 3.2 Failure

Runtime failures unwind the current expression/frame/activation without rolling back committed effects. try(e, fallback) catches all runtime expression failures from valid source, including arithmetic, ranges, indexes, assert/fail in called operations and remote failures. Fallback is assignable to the expression type and evaluated only on failure. Nested try is valid. Void try(e) explicitly ignores failure; a void fallback can run recovery behavior.

Static errors are never caught. Interrupts and deadline/activation/resource violations bypass try. The failure reason is recorded in evidence and unavailable as an implicit binding. Void has no value; completion is not a sentinel value. Non-void flow must structurally return or fail on every path; a positive-extent copied for-in body or an until body with a proven positive/no limit can establish this, while a dynamic possibly-zero limit cannot; bounded/unbounded loops that can execute zero times are insufficient to establish a return.

| ID | Rule |
| --- | --- |
| WP4-R01 | **`DurationRange`.** A computed duration (sections 3.3, 3.6) is checked as an integer before any widening to `uint`. A value that is not positive or not a safe integer number of nanoseconds, including an integer overflow of the duration expression's own arithmetic, is the runtime failure `DurationRange`, never `Bounds` or `Arithmetic`. It is an ordinary runtime failure of the statement or state reaction that evaluated it: it unwinds to the nearest `try` around a calling expression or fails the activation, and it is observed before any wait begins. An expiry that leaves the clock range remains the `ClockRange` violation. |

## 3.3 Statements and scopes

var declares a typed local; assignment replaces a copied mutable cell or one place inside it. if requires bool. while tests first; until executes at least once unless its explicit limit is zero, and stops when its bool condition becomes true. Optional n times takes a uint-compatible expression evaluated once at entry; reaching the limit exits normally. for uses an initializer-local scope, bool condition, body and assignment update. for (x: T in values) iterates one copied fixed-array snapshot with a fresh element/body scope each time. Locals do not leak from blocks. There is no break, continue, do, bound or forEach syntax.

wait D suspends for a positive duration. on receive p.m(bindings) { ... } or receive ... or after D { ... } waits for one input or optional timeout. Each payload is explicitly bound, each member has that statement as exclusive owner, and input received before the statement waits stays in the connector queue. Without timeout the wait is unbounded, subject to an entry deadline and host limits. Selecting a branch consumes one message once.

interruptible { body } on receive p.m(bindings) { handler } arms an unnamed region only while the protected body, including its called frames, is running or suspended. Input while inactive is discarded and traced; the validator warns. Input while armed transfers within the same activation, cancels protected continuation/local request, preserves outer locals/deadline and committed effects, and then executes the handler. Protected block locals do not escape. Nested regions unwind to the selected owning region. A server handling a cancelled request is not cancelled. Regions are prohibited in stateful operations; concurrent regions are permitted only when transitively non-writing and consume input once in activation order in the reference backend.

| ID | Rule |
| --- | --- |
| WP1-S05 | **Place roots.** The assignment target is a place (section 1.4). In an operation, its root is a mutable local, an `out` parameter or a non-const attribute of the executing component. In a case script, it is one of the script's own locals or an `on call` out binding. `in` parameters, const attributes, ports, child components and qualified names are rejected (SW2006, WP1-D01). A dotted target without an index is a place too. The `for` header update keeps a bare name. |
| WP1-S07 | **`out` roots.** An `out` parameter used as a place root must be definitely assigned before the assignment (SW2006, WP1-D02). In a case script, an `on call` out binding must be assigned as a whole before it is used as a place root or read with selectors (SW2006, WP1-D02); an empty reply and the 2.2 read forms keep their 2.2 rules. |
| WP1-R01 | **Place evaluation order.** Evaluate the target's index expressions left to right, then the right side, then read the root cell, check every index against the value read, and write the root with exactly one place replaced. Writes performed by the right side are kept. |
| WP1-R02 | **Place failure.** An index outside its extent at runtime is the runtime failure `Bounds`; the root is unchanged. |
| WP2-S05 | **No conditional statement.** A conditional is never a statement (grammar WP2-G02): `if (c) g() else h();` is a syntax error whose message explains it (WP2-D04), so a void branch cannot occur. The `if` statement keeps its block form. |

```swaml
package Places {
  datatype Status {
    confirmed: bool;
    occurrences: uint;
  }
  component def Memory {
    attribute counters: int[3] = [0, 0, 0];
    attribute statuses: Status[3] = [record Status { confirmed = false; occurrences = 0; }, record Status { confirmed = false; occurrences = 0; }, record Status { confirmed = false; occurrences = 0; }];
    operation note(index: uint, counter: int) {
      counters[index] = counter;
      statuses[index].occurrences = statuses[index].occurrences + 1;
    }
    operation copyOut(out result: Status[3]) {
      result = statuses;
      result[0].confirmed = true;
    }
  }
}
```

send p.attribute(v) updates a provided attribute; publish p.event(args) emits a provided event. Return completes a frame, fail fails it, assert requires a bool and fails when false. Private state writes, emissions and successful local call effects remain committed when a later statement fails.

| ID | Rule |
| --- | --- |
| WP4-S03 | **Computed waits.** `wait (e);` and `or after (e) { … }` take an integral expression without suspending calls (SW2002 with WP4-D02, SW2006), in the scope of the statement. It is evaluated when the statement starts waiting, before any queued input is taken; its reads happen before the suspension, so the stale-read warning (SW2011) treats them like other reads of the statement. A value that is not a positive representable duration is `DurationRange` (WP4-R01). Outside the constant sublanguage `/` yields `real` (chapter 1.4), so `wait (n * 1ms / 2);` is rejected. Without a unit, such as `wait (n);`, the duration counts nanoseconds and the validator warns (SW2016, WP4-D06). |

```swaml
package ComputedWaits {
  port def Ack {
    provides event ack(id: uint);
  }
  component def Retry {
    reversed port acks: Ack;
    const attribute ackTimeoutMs: uint = 20;
    attribute backoffMs: uint = 5;
    attribute acked: uint = 0;
    attribute lost: uint = 0;
    operation await() {
      wait (backoffMs * 1ms);
      on receive acks.ack(id) {
        acked = acked + 1;
      } or after (ackTimeoutMs * 1ms) {
        lost = lost + 1;
        backoffMs = backoffMs * 2;
      }
    }
    schedule {
      on start await();
    }
  }
  component def Peer {
    port acks: Ack;
    operation go() {
      wait 1ms;
      publish acks.ack(1);
    }
    schedule {
      on start go();
    }
  }
  component retry: Retry;
  component peer: Peer;
  connect (peer.acks, retry.acks);
}
```

## 3.4 Suspension and locks

Every component occurrence has one serial lock. Serial dispatch evaluates/copies schedule arguments under this lock. wait, requests, receive and idle state-machine waits release it. Resumption reacquires it and reads live attributes. Other activations may run and modify state while a serial activation is suspended. Activation locals remain its own copies. Concurrent entries overlap and read attributes from the dispatch snapshot throughout, including after resumption; they read sample cells and `now()` live; they never write state (WP6-R07).

| ID | Rule |
| --- | --- |
| WP6-R07 | **Concurrent reads (amends 3.4).** Concurrent entries read attributes from the dispatch snapshot throughout, including after resumption; they read sample cells (chapter 2.6) and `now()` live; they never write state. Each cell read copies the whole value atomically, so a record is never observed half-updated. The 2.2 snapshot guarantee is unaffected, because 2.2 models have no cells. |

| ID | Rule |
| --- | --- |
| WP1-R03 | A place assignment's read-modify-write happens under the serial lock after any resumption; no suspension splits it. |
| WP1-M01 | The stale-read warning (SW2011) treats a place write as a write of its root. Index values read before a suspension are tracked like other pre-suspension reads. |
| WP3-S02 | **Stale reads.** The stale-read warning (SW2011) never reports a value obtained from `now()`: the clock is not component state, so a time stamp taken before a suspension and used after it, directly, through a helper that returns it or in a condition, is not a stale read. An attribute read in the same expression is still tracked. A 2.2 operation that happens to be named `now` and reads an attribute is an ordinary operation and keeps its warnings. |

A stale-read warning identifies a pre-suspension state read that may affect a later write. Recheck live state after resuming. This warning is conservative and is not a race-freedom proof. A successful static check does not establish scheduling, termination or deadlock freedom.

## 3.5 Schedule

A component owns at most one schedule block. Effective entries inherit and are replaced by repeating their (trigger, operation) identity. Duplicate identities in one authored block are errors. Trigger identity includes a receive/call member, an every period, or an after predecessor. One operation can have several entries.

| Trigger | Release and signature |
| --- | --- |
| on start | Once after the initialization barrier |
| on every D | At root epoch + kD, k at least 1, unless its release guard is false (chapter 6.2); deadline defaults to D |
| on receive p.m(bindings) | One activation per received required event/attribute, unless its release guard is false (chapter 6.2) |
| on call p.m(bindings) | Serve a provided operation; typed result/out values form the reply |
| after predecessor | Fresh activation after successful whole same-owner predecessor completion and unlock, unless its release guard is false (chapter 6.2); a skipped predecessor counts as completed |

Entry arguments evaluate and copy at dispatch. Non-call entries bind void flow with no out parameters; after targets are parameterless void flow. Predecessors are scheduled same-owner operation names, never paths/qualified names/port members; the effective after graph is acyclic. Failure releases nothing. A fresh activation has its own release/deadline/locals/snapshot/backlog accounting; results and parameters are not forwarded. Stateful success means reaching final, not becoming idle after a reaction.

An explicit deadline is positive. An every entry's deadline cannot exceed its period. Deadline omission elsewhere is permitted; a host may impose additional documented validation requirements. concurrent is entry-local and requires a non-writing, non-stateful operation. Source WCET, timing blocks and root profiles do not exist; target bindings own execution-cost evidence.

**Computed periods and deadlines (2.3).** A period or deadline may be an expression of the constant sublanguage, which the validator evaluates for each expanded occurrence (the [derived period](../examples/43-derived-period.swaml) example).

| ID | Rule |
| --- | --- |
| WP4-S04 | **Computed periods and deadlines.** `on every (e)` and `deadline (e)` take an expression of the constant sublanguage (WP4-S05), evaluated once per expanded occurrence. Its value is integral (SW2002, WP4-D02); in this sublanguage `/` on integral operands is integral. |
| WP4-S05 | **Constant sublanguage.** Allowed: integer, duration and boolean literals; const attributes of the owning occurrence with their effective value after redefinition, whose effective initializers are themselves in the sublanguage (and acyclic; an attribute initializer cannot read another attribute in 2.3, so chains and cycles of const attributes cannot occur yet and the evaluator only guards against them); unary `-` and `not`; `+ - * / %`; comparisons; `and`, `or`; the conditional; parentheses. `/` on two integral operands is exact integral division and must divide exactly in every occurrence: a non-exact quotient or a zero divisor (of `/` or `%`) is SW2013 `{expression} divides {a} by {b} in {occurrence}, which is not an exact integral division.` (WP4-D07). Rejected with SW2007 `{expression} is not a constant duration: {kind} are not allowed.` (WP4-D03), where the kind is `calls` (calls and `try`), `mutable state` (non-const attributes, locals, parameters and receive bindings), `now()` (a call for which `isClockRead` is true, WP3-S01) or `values other than integers, durations and booleans` (enum literals, record or array values and fields of const attributes); sampled reads join with WP6. Literals of other types are left to the type rules (SW2002). |
| WP4-S06 | **Per-occurrence values.** For every expanded occurrence of every top-level occurrence of a package, each computed period and deadline is a positive, safe integer number of nanoseconds (SW2013 `{period \| deadline} of {entry} is {value} ns in {occurrence}; it must be a positive representable duration.`, WP4-D04) and an `every` entry's deadline does not exceed its period (SW2007 `Periodic deadline cannot exceed its period in {occurrence}.`, WP4-D05; two literals keep the 2.2 message without the occurrence). Each finding of an expression is reported once, for the first occurrence where it fails. The deadline is read with one precedence everywhere (`entryDeadline`): an explicit deadline, literal or computed, then the period, literal or computed. A definition that is never instantiated is checked for sublanguage membership and typing only, because its default const values need not be meaningful. |
| WP4-S07 | **Trigger identity.** The trigger of an `every` entry is identified by `triggerIdentity` (`semantic.ts`). A literal period (`every 20ms`) and a single literal in parentheses (`every (20ms)`) are their value in nanoseconds, exactly as 2.2 keyed literal periods, so `every 20ms`, `every 20000us` and `every (20ms)` are one trigger. Any other expression is its canonical text (`expressionText`, which is `displayText` for it): comments and layout removed, integers in decimal, names in canonical spelling, one space between tokens except none after `(` `[` `.` `::`, none before `)` `]` `,` `.` `::`, none before the index `[` of a value or the argument list `(` of a call or `try`, and none inside a duration literal; a parenthesized subexpression and an array literal are spaced like operands (`a * (b + c)`, `arr[0] * 1ms`). Tokens stay separated otherwise, so an operator sequence never equals a name. `every (2 * 10ms)` is therefore another trigger than `every 20ms`, even where both are 20 ms; the warning SW2019 (WP4-D08) reports such a pair in one occurrence. This identity drives inheritance replacement, duplicate detection (SW2007 `Duplicate (trigger, operation) entry.`) and `entryKey`; a release guard (WP7) is not part of it. |
| WP4-M02 | **One evaluator.** `constantValue(expression, occurrence)` in `semantic.ts` evaluates the sublanguage exactly (bigint) and reports the first membership or value problem. The validator, `projection.ts`, the simulator and consuming tools use it; consumers read an occurrence's period and deadline in nanoseconds with `entryPeriod(entry, occurrence)` and `entryDeadline(entry, occurrence)` and the trigger identity with `triggerIdentity(entry)`; `displayText(expression)` is the text shown in messages and projections. `constantNumber` stays the literal-only fold of the 2.2 type and index rules, so those keep their diagnostics. |

```swaml
package CyclePeriods {
  component def Poller {
    const attribute cyclePeriodMs: uint = 10;
    attribute polls: uint = 0;
    operation poll() {
      polls = polls + 1;
    }
    schedule {
      on every (cyclePeriodMs * 1ms) poll() deadline (cyclePeriodMs * 1ms / 2);
    }
  }
  component standard: Poller;
  component fast: Poller {
    redefines const attribute cyclePeriodMs: uint = 4;
  }
}
```

In `fast` the poller runs every 4 ms with a 2 ms deadline; in `standard` every 10 ms with a 5 ms deadline.

**Release guards (2.3).** `when (g)` after the operation call of an `every`, `receive` or `after` entry gates each release: a false guard skips it (chapter 6.2, WP7-R01 to WP7-R07). The [LIN master](../examples/50-lin-master-mode-gating.swaml) and [ComMain](../examples/51-com-main-release-guard.swaml) examples gate their periodic work by a sampled power mode instead of returning early from every release. A skip counts as a completion for `after` successors (WP7-R03) but has none of the skipped operation's effects, so a successor that depends on them must test the same condition in its own guard, as example 51 does; the validator does not detect a successor that relies on a skipped predecessor.

| ID | Rule |
| --- | --- |
| WP7-S01 | **Release guards.** `when (g)` may follow the operation call of an `every`, `receive` or `after` entry, before `deadline` and `concurrent` (WP7-G01). On a `start` or `call` entry it is an error (SW2007 `A release guard is allowed only on every, receive and after entries.`, WP7-D01), reported once, at the guard where the entry is written; such a guard is not typed. A guard that folds to false is a warning (SW2020, WP7-D03): the entry never runs its operation. |
| WP7-S02 | **Guard effects and scope.** A release guard is `bool` (SW2007 `Release guard must be bool, found {type}.`) and pure or reads state: a call of an operation that writes or communicates is SW2007 `Release guard must be pure or read state.`, at the call; an unresolved, remote or suspending call is reported by the call rules only (WP7-D02). Its scope is the scope of the entry's arguments: the component's attributes, its sampled ports (WP6-S01; a sampled read in a guard is a sampled read of the component for WP6-S03 and WP6-S04), `now()` and the entry's receive bindings, which hide a port of the same name. The operation's parameters are not in scope; a name outside the scope keeps its unresolved-name message (SW2002). Like the arguments, the guard of an inherited entry is typed in every effective structure, so a redefined helper that writes is reported before any run; a guard whose own document has syntax errors is typed nowhere until its syntax is fixed: the validation of a document with syntax errors reports only those errors, and a structure in another document that inherits the entry skips the guard, so a valid file that specializes it gets no error for the unfinished guard. |
| WP7-S03 | **Identity.** A release guard is not part of entry identity, so two entries that differ only in their guard are duplicates (SW2007 `Duplicate (trigger, operation) entry.`), and an entry of a specialization or usage with the same trigger and operation replaces an inherited entry together with its guard; a replacement without a guard removes it, which is a warning (SW2020, WP7-D04) unless the inherited guard folds to true: write `when (true)` to remove a guard deliberately. |

```swaml
package ReleaseGuards {
  enum PowerMode {
    run,
    sleep
  }
  port def ModeState {
    provides attribute current: PowerMode = PowerMode.run;
  }
  component def StateManager {
    /** Interface-only actor that broadcasts the power mode. */
    port mode: ModeState;
  }
  component def Slots {
    reversed port mode: ModeState;
    attribute headers: uint = 0;
    attribute checkpoints: uint = 0;
    operation slot() {
      headers = headers + 1;
    }
    operation checkpoint() {
      checkpoints = checkpoints + 1;
    }
    schedule {
      on every 20ms slot() when (mode.current != PowerMode.sleep) deadline 2ms;
      after slot checkpoint();
    }
  }
  component manager: StateManager;
  component lin: Slots;
  connect (manager.mode, lin.mode);
}
```

While the sampled mode is `sleep`, no `slot` runs, its 2 ms deadline is cancelled and its releases stay on the 20 ms grid; each skip still releases `checkpoint`.

## 3.6 States

A stateful operation is parameterless void and has exactly one on start entry. initial names one owned state. States own at most one on entry and one on exit block plus ordered receive/timer transitions. A receive transition binds payload, optionally tests a pure/read-state bool guard, and names its target with to. after D is relative to the state update, before entry actions begin. Entry actions finish before a transition can run; if entry suspends past a timer expiry, the earliest elapsed timer is selected on resumption before queued input. Timers with equal expiry use declaration order. Evaluate competing enabled transitions in declaration order and take the first. There are no transition names or priorities. From 2.3 a state may also own completion transitions `when (g) to S`, guarded timers `after D when (g)`, internal transitions without `to` and deferrals `defer p.m;`, in any order with its actions and transitions (rules below; runtime in chapter 6.5).

A reaction runs exit, transition effect, state update and entry in that order. Timers are invalidated by state exit and stale firings are observable discards. Unhandled input does not reset the current state timer. Every state is graph-reachable from initial; a final state has no outgoing transitions or exit action. Reaching final runs entry and completes the whole operation once. Hierarchical/orthogonal states and physical preemption are outside the language.

| ID | Rule |
| --- | --- |
| WP4-S08 | **Computed state timers.** `after (e) to S { … }` takes an integral expression that is pure or reads state (SW2008 `State timers may only be pure or read state.`), in the machine's scope, with the unit warning SW2016. It is evaluated once per state entry, when the entry actions finish, in declaration order with the state's other computed timers; its expiry is the state-update time plus the value, so a timer whose operands the entry actions change uses the new value: `state Backoff { on entry { delayMs = minInt(delayMs * 2, capMs); } after (delayMs * 1ms) to Connecting { } }` waits the doubled delay. If entry suspends past the expiry, the timer has elapsed and is selected on resumption, as for literal timers. Discarded input does not re-evaluate it; re-entering the state does. Timers with equal expiry, literal or computed, keep declaration order. A value that is not a positive representable duration is `DurationRange` and fails the machine's activation (WP4-R01). The [computed backoff](../examples/41-computed-backoff.swaml) and [lock pulse](../examples/42-lock-pulse.swaml) examples show both. |
| WP5-S02 | **Completion transitions.** `when (g) to S { … }` has no trigger: it is selected after the entry actions of its state finish and after every internal reaction (chapter 6.5, WP5-R01). It requires a target, `A completion transition needs a target state.` (SW2008, WP5-D01). A final state has none (WP5-D04). This reverses the 2.0 exclusion of completion transitions for guard-only completion only (ADR 0023). |
| WP5-S03 | **Completion guards.** A completion guard is `bool` and pure or reads state; a call that writes, communicates or suspends is SW2008 with the guard-effect message `State guards may only be pure or read state.` (WP5-D02). It does not call `now()`, directly or through a called operation (`isClockRead`): `A completion guard cannot call now(); it is not re-evaluated as time passes.` (SW2008, WP5-D02). |
| WP5-S04 | **Completion cycles.** A cycle of states connected only by completion transitions whose guard is the literal `true` (parentheses leave no node) is an error, reported once per cycle at the transition that leaves its first state in source order: `States A → B → A form a cycle of when (true) completion transitions.` (SW2008, WP5-D03). Only the first `when (true)` of a state can be taken, so a later one does not form a cycle. A cycle through other guards is a runtime matter (`CompletionLoop`, WP5-R07). As in WP5-R07, a cycle on which an entry action, exit action or effect can suspend (a wait, a receive, an interrupt region, a request, or a call to an operation that does) restarts its chain at every round and is not an error: `state A { on entry { n = n + 1; wait 1ms; } when (true) to A { } }` is a retry. |
| WP5-S05 | **Reachability.** Graph reachability from `initial` follows receive, timer and completion edges. Internal transitions add no edge. |
| WP5-S06 | **Timer guards.** `after D when (g) …` takes a `bool` guard that is pure or reads state (SW2008, the guard-effect message, WP5-D07). A receive guard keeps its 2.2 rule and code (SW2006). |
| WP5-S07 | **Internal transitions.** A receive or timer transition without `to` is internal: `on receive p.m(x) { … }`, `after 2s { … }`. A final state has no transitions of any form: the 2.2 forms keep `Final states have no transitions or exit action.`, and each completion, internal or guarded-timer transition is `Final state {state} cannot have transitions or deferrals.` (SW2008, WP5-D04). |
| WP5-S08 | **Deferral.** `defer p.m, …;` is a state member that names required events or attributes of the machine's component (`{member} is not an input of {operation}.`). Some state of the machine has a transition on each deferred member (`{member} is deferred, but no state of {operation} handles it.`, WP5-D05). No state both defers a member and has a transition on it (`State {state} defers {member} and also handles it.`), and a state defers a member at most once (`State {state} defers {member} twice.`, WP5-D06). A final state defers nothing (WP5-D04). All are SW2008 and reported at the member. |
| WP5-S09 | **Deferral and ownership.** A deferral belongs to the machine's single input ownership (SW2005): it counts as the machine, never as a second owner, so a member deferred by a machine and also received by a schedule entry has two owners. |
| WP5-S10 | **Explicit self transitions.** A transition `to` its own state keeps its 2.2 meaning: exit, effect, state update, entry, with timers restarted. Only a transition without `to` is internal. |

```swaml
package StateReactions {
  port def Requests {
    provides event request(lock: bool);
  }
  component def Lock {
    reversed port requests: Requests;
    attribute pulses: uint = 0;
    attribute retries: uint = 0;
    attribute locked: bool = false;
    operation control() {
      initial unlocked;
      state unlocked {
        on receive requests.request(lock) when (lock) to locking {
        }
      }
      state locking {
        /** Requests during the pulse stay queued until a state that handles them. */
        defer requests.request;
        on entry {
          pulses = pulses + 1;
        }
        after 250ms when (pulses < 3) to isLocked {
          locked = true;
        }
        after 250ms to failed {
        }
      }
      state isLocked {
        /** Internal: no exit, no entry, the state is unchanged. */
        on receive requests.request(lock) when (lock) {
          retries = retries + 1;
        }
        on receive requests.request(lock) when (not lock) to unlocked {
          locked = false;
        }
        when (retries > 2) to failed {
        }
      }
      final state failed {
      }
    }
    schedule {
      on start control();
    }
  }
  component def Body {
    port toLock: Requests;
  }
  component lock: Lock;
  component body: Body;
  connect: Swaml::Qos::Latest (body.toLock, lock.requests);
}
```

The [session completion](../examples/44-session-completion.swaml), [lock deferral](../examples/45-lock-deferral.swaml) and [breaker](../examples/46-breaker-internal.swaml) examples compare each form with its 2.2 shape.

## 3.7 Case scripts

A use case or test whose body holds statements after its optional documentation is a case script ([ADR 0019](decisions/0019-package-context.md)). Its statements are the statement language of section 3.3: var, assignment to places rooted in its own locals or on call out bindings (WP1-S05), send, publish, calls, on receive … or receive … or after D, wait, if, while, until, for, for in, assert, fail and return. A case owns no nested operations, states, schedule entries or interrupt regions. A case with statements needs of; a case without statements records intent only. Case scripts do not sample ports; they keep `on receive` at actor ports (WP6-S09): `occurrence.port.member` on a port that opts in to sampling is SW2010 `A case script cannot sample {port}.{member}; use on receive.` (WP6-D08).

A script is the environment of its subject. Its endpoints are occurrence.port.member, where occurrence is a top-level component occurrence of the case's package that is not the subject, is associated with the case by associate occurrence to Case; and is interface-only. send and publish emit a provided attribute or event of that actor port; on receive waits for a required attribute or event of it; a call such as customer.panel.withdraw(200) requests a required operation and suspends like any request. on call occurrence.port.op(bindings) { … } is a further branch of on … or …, allowed only in case scripts, that answers a request for a provided operation of the actor port. Inside it return v; is the reply exactly like the result of a served operation: out bindings are mutable and their values return with the reply, a non-void branch returns or fails on every path, and a failure inside the branch replies with a remote failure and fails the case. Any other return ends the case and has no value. Operations keep port.member endpoints and serve requests through schedule on call entries.

Both case kinds may call operations of their exact primary subject, such as atm.withdraw(20), using its normal serial context ([ADR 0021](decisions/0021-case-subject-calls.md)). The operation may communicate through its own ports, receive and wait; the case resumes on return. Stateful operations remain on-start only, and suspending calls obey the whole-expression rule. The call is local within the case activation, not a fresh schedule release or an implicit port request.

A use case cannot inspect private attributes or directly call subject parts or associated components. A test may additionally read attributes of its subject, explicitly associated software component occurrences and the parts inside those roots, including record fields and array elements, such as atm.dispensedToday, atm.dispenser.count or backend.twins[0].link. Helper calls on those extra owners remain restricted to operations that neither communicate nor suspend. A referenced root must be an executed, non-multiple software occurrence of the same package; platform roots have no runtime store. Association grants no ownership and does not select execution roots. Dotted value reads retain lexical local precedence; dotted operation calls retain their occurrence-call namespace. A case never assigns component attributes directly; assignment targets are places rooted in the script's own locals or on call out bindings (WP1-S05). Reads observe the live store under the target's serial lock. Calls borrow the occurrence's actual execution context; suspension releases its lock and resumption reads live state. Results and output values copy back only on successful return, after restoring the caller context.

| ID | Rule |
| --- | --- |
| WP1-S06 | **Indexed test paths.** In a test's inspection path, a component segment with multiplicity takes a literal index, for reads (`backend.twins[0].link`) and helper calls (`backend.twins[0].currentView()`). A non-literal index on a component segment is an error (SW2010, WP1-D05). A literal index outside the multiplicity is an error (SW2002, WP1-D06). Roots stay non-multiple top-level occurrences; only parts inside the root are indexed. This amends "Nested/indexed association paths and intermediate component indexes remain unsupported" of ADR 0020 for intermediate indexes only. Association paths stay unindexed. |
| WP1-S08 | **Indexed call paths elsewhere.** Outside test scripts, a call path that contains an index is an error (SW2006, WP1-D07). |

A single part takes no index, and an unindexed part family is not an inspection path (SW2002). Helper calls on an indexed part keep the restrictions of every extra owner: they neither communicate nor suspend.

```swaml
package Fleet {
  enum LinkState {
    offline, online
  }
  datatype VehicleView {
    vehicleId: string;
    speed: int;
  }
  component def Twin {
    attribute link: LinkState = LinkState.offline;
    attribute latest: VehicleView = record VehicleView { vehicleId = ""; speed = 0; };
    operation attach(vehicle: string) {
      link = LinkState.online;
      latest.vehicleId = vehicle;
    }
    operation currentView() returns VehicleView {
      return latest;
    }
  }
  component def Backend {
    component twins: Twin[2];
  }
  component backend: Backend;
  test 'Twin inspection' of backend {
    assert backend.twins[0].link == LinkState.offline;
    backend.twins[0].attach("TRK-101");
    var shown: VehicleView = backend.twins[0].currentView();
    assert shown.vehicleId == "TRK-101" and backend.twins[0].latest.vehicleId == "TRK-101";
    assert backend.twins[1].link == LinkState.offline;
  }
}
```

SW2010 reports a script without of, an actor that is not associated or not interface-only, the subject used as an actor, private reads or non-subject direct calls from a use case, and test inspection outside the subject and explicitly associated software roots. SW2004 reports emission and call endpoints of the wrong shape, kind or direction and SW2005 input endpoints; SW2006 reports on call outside case scripts, communicating or suspending test-helper calls outside the primary subject, on call branches without a reply on every path and interrupt regions in cases; SW2002 reports values, bindings and results.


---

<a id="chapter-8"></a>

# 4. Deployment, cases, views and conformance

Normative chapter of [swa.ml 2.2](LANGUAGE_SPECIFICATION.md).

## 4.1 Deployment

Swaml::Platform supplies Node, Platform, Partition and Process component definitions. Node specialization owns only const attributes and child Nodes, with no operations, ports, connectors or schedule. Optional ref: string retains an external model identity for the host; it is not required for swa.ml validity and is never silently resolved as a software path. Buses, hardware timing, core/task allocation and operating-system scheduling are target-translation concerns.

A package deployment Name of Root on PlatformRoot owns placements. deploy on nodePath places the software root; deploy childPath on nodePath places that occurrence and descendants. A more specific path overrides an ancestor; an indexed path overrides a multiplicity family path. Exact paths are unique within one deployment. Every software path and literal index resolves in that root; every target resolves to a Node occurrence of that platform root. Only components are deployed. A top-level occurrence has at most one deployment in the workspace (SW2009 on each later one, at its root reference), and a package or component run applies it to that occurrence's tree; absence remains unallocated.

## 4.2 Requirements, cases and package links

A requirement owns immutable typed attributes and at most one doc. Requirements may be imported. Every relation that records intent about requirements and cases is a package member, never a component member, and none of them proves fulfillment.

A case is written use case Name of subject { … } or test Name of subject { … }. Cases are package members only; components never own cases. The of clause is optional and names a top-level component occurrence declared in the same package: the subject, the system under consideration. A case of a part is written in a package where that component is a top-level occurrence. A case without of, or without statements, records intent only. The case body owns optional documentation followed by optional statements; an executable subject must be a non-multiple software occurrence; platform roots do not execute. A case with statements is a script that may call its primary subject's operations and act through the ports of associated interface-only components (section 3.7), and runs in a fresh run of its package (section 6.7).

associate Occurrence to Case; records that a top-level component occurrence of the same package takes part in a use case or test of the same package. The occurrence is not the case's subject and each pair is associated at most once. In a use case, associated occurrences are its actors. In a test, an associated software occurrence also establishes an explicit white-box participant reference; it may have its own behavior, and its single parts and literally indexed members of its part families may be read or called under section 3.7. Neither kind of case owns those components. Interface-only participants act as actor port proxies; they communicate with the subject only through ports and package connections, and a case script acts through the ports of the interface-only ones.

| ID | Rule |
| --- | --- |
| WP2-S06 | **Association lists.** `associate a, b to 'X', 'Y';` associates every listed occurrence with every listed case: its pairs are each listed occurrence with each listed case, occurrences in list order and, for each, the cases in list order. Each pair follows the rules above (SW2010), reported at its listed reference. A pair repeated within one statement or across statements is an error at the later reference (SW2010, WP2-D03): the repeated occurrence or case of a list, otherwise the occurrence of the later pair. A repeat between two single-pair statements keeps its 2.2 message `Duplicate associate {occurrence} to {case}.` at the later statement. |

```swaml
package Fleet {
  port def Telemetry {
    provides event position(km: int);
  }
  component def Vehicle {
    port uplink: Telemetry;
  }
  component def Backend {
    reversed port truckIn: Telemetry;
    reversed port vanIn: Telemetry;
    attribute positions: uint = 0;
    operation track(km: int) {
      positions = positions + 1;
    }
    schedule {
      on receive truckIn.position(km) track(km);
      on receive vanIn.position(km) track(km);
    }
  }
  component truck: Vehicle;
  component van: Vehicle;
  component backend: Backend;
  connect (truck.uplink, backend.truckIn);
  connect (van.uplink, backend.vanIn);
  use case 'Monitor live position' of backend {
    publish truck.uplink.position(12);
    publish van.uplink.position(40);
    wait 1ms;
  }
  test 'Positions counted' of backend {
    publish van.uplink.position(41);
    wait 1ms;
    assert backend.positions == 1;
  }
  associate truck, van to 'Monitor live position', 'Positions counted';
}
```

satisfy Requirement by design; claims that a component satisfies a requirement. design is a component definition or a top-level component occurrence declared in this package, optionally followed by nested parts such as Workbench.editor or cells[1]; a literal index is within the multiplicity. The claim is written in the package that declares the head of the design path; the requirement may be imported. Each requirement and design pair is claimed at most once.

verify Requirement by Test; claims that a test of this package verifies a requirement. A use case never verifies. The relation is many-to-many; each requirement and test pair is written at most once; the requirement may be imported.

The 2.0 and ADR 0018 case forms are removed rather than deprecated: verification case, cases inside components, actor roles, include and extend between cases, verify inside cases, declarative steps with from, to, via and after, satisfy inside components and satisfy … of. They are ordinary syntax errors.

## 4.3 Views

Swaml::Views provides General, Interconnect, Case, Sequence, Grid, Flow and Timing. A view is typed by a definition, uses compact of subject or one or more include clauses, and owns optional documentation. Include may expand recursive descendants and apply a restricted Boolean where filter over name, kind and path, string comparisons, and/or/not. Filters never call operations or execute behavior. Selection is a union of occurrence identities in first-selection order; duplicates are removed stably.

General and Grid select named semantic elements except views. Interconnect selects components; it labels member policies on their connection (WP6-M01: `ProjectionEdge.memberPolicies`, each with the member, the named policy and the effective policy of the member route). Case selects packages, cases and components; Sequence selects operations, cases, components and packages. A selected package contributes its cases. Case draws each selected case inside the boundary of its subject occurrence, its associated occurrences outside it, and the satisfy and verify intent links of the package. Flow and Timing select operations, use cases and tests. Paths preserve definition/occurrence identity and explicit multiplicity indexes. Browser is navigation rather than an eighth view kind. General Box in box and Tree layouts retain exactly the same selected identities and topology; layout/collapse/geometry stay in presentation sidecars.

Flow covers statements, nested operation calls, loops, receive, interruption and function-owned states. Timing has declared and observed modes. Declared shows schedule release grid, causes, deadlines, static wait intervals and permitted concurrent overlap. Observed adds an identified trace, serial lock gaps, message latency, activation phases, terminal markers and open intervals; WCET/budget bars identify their target-binding/evidence source. A missing trace never produces fabricated observation. Views introduce no execution semantics.


| ID | Rule |
| --- | --- |
| WP4-M03 | **Timing per occurrence.** The projection (`projectModel`) gives each schedule entry of an occurrence its evaluated `periodNs` and `deadlineNs` from `entryPeriod` and `entryDeadline`, and a computed period or deadline also its display text (`periodExpression`, `deadlineExpression`, from `displayText`: the source spelling in canonical layout, so `deadline (3ms)` shows `3ms`); a definition shows values only for literal periods and deadlines and the text for computed ones, whose values belong to its occurrences. All values come from `entryPeriod` and `entryDeadline`, as in the simulator and the validator. A computed state timer labels its transition `after ({display text})`. Entries with literal periods and deadlines gain no field, so the projections of 2.2 sources are unchanged. |
| WP5-M01 | **Flow and states.** The projection (`projectModel`) gives a completion transition an edge labelled `when (g)` with `completion: true`, a guarded timer edge its `guard` text, and gives a state node its internal transitions as `reactions` (label, order, guard) without an edge and its deferred members as `deferrals`. An internal transition never produces an edge. These fields appear only for the 2.3 forms. Flow shows completion edges with their guard, internal transitions as reactions of their state and deferrals as state annotations. |
| WP7-M01 | **Timing guards.** The projection (`projectModel`) gives a guarded schedule entry its `guard` text (`displayText`); the field is absent on an entry without a guard. Observed Timing (`projectOperationTiming`) ends an activation's interval at its `skip` and lists `skip` among its markers. |
## 4.4 Validation groups

| Code | Static group |
| --- | --- |
| SW2000 | Syntax and recovery diagnostics in machine-readable CLI output |
| SW2001 | Names, quoted-name spelling, imports, uniqueness and forbidden live-name shadowing |
| SW2002 | Value types, nominal shapes, domains, arguments/results and indexes |
| SW2003 | Definition/usage, specialization, containment and whole-member redefinition |
| SW2004 | Port shape, structural compatibility, endpoints, package connection ends, aliases, per-package closure/cardinality |
| SW2005 | Single input owner and emission provenance; interface-only components are exempt |
| SW2006 | Calls, nested scope, effects, returns, out arguments and suspension placement |
| SW2007 | Schedule identity, signatures, deadlines and after graph; release guards (2.3) |
| SW2008 | Stateful signatures, scheduling, ordered states and reachability/finality |
| SW2009 | Node content, deployment paths, indexes and specificity |
| SW2010 | Requirement/case/view references, case subjects, associate, satisfy and verify links, the environment role and white-box access of case scripts |
| SW2011 | Conservative stale-read warning |
| SW2012 | Inactive interrupt-input discard warning |
| SW2013 | Complete typed policies and representable positive durations; the reference resource limits: expression nesting in the validator, the work of the stale-read analysis, expanded component occurrences per top-level occurrence and the parser's bracket nesting and stack (WP2-D05) |
| SW2014 | Canonical formatting differs, only in explicit formatting-check mode |
| SW2015 | Retired in 2.1 together with the 2.0 case spellings; not reported |
| SW2016 | Warning (2.3): a computed duration without a time unit, which counts nanoseconds |
| SW2019 | Warning (2.3): two every entries of one occurrence for the same operation with equal periods but different triggers |
| SW2017 | Warning (2.3): a completion guard that reads nothing the machine writes, so it cannot change while the machine waits, or that folds to false, so its transition is never taken |
| SW2018 | Warning (2.3): a deferred event whose policy on a route into the occurrence rejects on overflow |
| SW2020 | Warning (2.3): a release guard that folds to false, so its entry never runs its operation, or a replacing schedule entry without a guard that drops an inherited release guard |

Diagnostics added by 2.3. Message shapes are templates; implementations may add context but keep the leading clause stable. All are errors except WP4-D06, WP4-D08, WP5-D08, WP5-D09, WP6-D09, WP6-D10, WP7-D03 and WP7-D04, which are warnings. A diagnostic of WP6 applies only to a reference `p.m` of a member that opts in to sampling (an attribute member with an initial value, 2.3 syntax), to behaviour inherited with such a reference or to a member-policy body, so every 2.2 source keeps its diagnostics.

| ID | Code | Condition | Message shape |
| --- | --- | --- | --- |
| WP1-D01 | SW2006 | Place root is not a mutable local, `out` parameter or non-const attribute (WP1-S05) | `Cannot assign to {place}: {root} is {an in parameter \| a const attribute \| a port \| a child component \| a qualified name}.` The reference validator also names `an immutable binding` (an input binding or `for in` element), `a component occurrence` (in a case script) and `not a local, out parameter or attribute`. A bare name keeps its 2.2 message. |
| WP1-D02 | SW2006 | `out` root read before definite assignment (WP1-S07) | `Out parameter {name} must be assigned before {place} is assigned.` For an `on call` out binding: `Out binding {name} must be assigned before {place} is assigned.` or `… before {place} is read.` |
| WP1-D03 | SW2006 | Place as out argument (WP1-S04) | `An out argument must be a name; {place} is a place.` A 2.2 form such as `r.f` or `a[i]` keeps the 2.2 message `An out argument needs a mutable compatible local, out parameter or attribute.` |
| WP1-D04 | SW2002 | Selector typing (WP1-S02, WP1-S03) | `{type} has no field {field}.` / `{type} is not an array and cannot be indexed.` / `Index must be integral, found {type}.` / `Index {n} is outside {type}.` A read without selectors keeps its 2.2 messages. |
| WP1-D05 | SW2010 | Non-literal component index in a test path (WP1-S06) | `Component index in {path} must be a literal.` |
| WP1-D06 | SW2002 | Literal component index outside multiplicity (WP1-S06) | `Index {n} is outside the multiplicity {m} of {child}.` An index on a single part is `{part} is a single part and takes no index.` |
| WP1-D07 | SW2006 | Indexed call path outside a test (WP1-S08) | `{path}: an indexed call path is allowed only in a test.` |
| WP2-D01 | SW2002 | Conditional condition or branch types (WP2-S02) | `Condition must be bool, found {type}.` / `Conditional branches have no common type: {type1} and {type2}.` A void branch has the existing message `Void completion is not an expression value.` |
| WP2-D02 | SW2006 | Suspending call in a conditional (WP2-S04) | `A suspending call cannot appear in a conditional expression.` A suspending call outside conditionals keeps its 2.2 message. |
| WP2-D03 | SW2010 | Repeated association pair (WP2-S06) | `{occurrence} is already associated with {case}.` A repeat between two single-pair statements keeps the 2.2 message `Duplicate associate {occurrence} to {case}.` |
| WP2-D04 | SW2000 | Conditional in statement position (WP2-G02) | The syntax message explains it: `A conditional expression is not a statement; use an if block.` An unparenthesized conditional operand adds to the parser's message: `A conditional expression is a whole expression; as an operand it is written in parentheses, as in (if (c) a else b).` |
| WP2-D05 | SW2013 | Bracket nesting beyond the reference parser's resource limits; not a language rule. A *statement* is the run of tokens between two `;`, `{` or `}` that occur while no bracket is open. Within it, an open bracket is a `(` or `[`, the `{` of a record literal, or any other `{` while a bracket is open; `)`, `]` and `}` close the innermost open bracket of their kind. The statement ends at the next `;`, `{` or `}` with no bracket open, or *unbalanced* at a `)`, `]` or `}` that does not match the innermost open bracket, at a `;` while a `(` other than the parenthesis of a `for` statement or a `[` is innermost, or at the end of the file. (a) More than 200 brackets open at once in a statement, at the first bracket beyond 200; the limit is above every depth the 2.2 reference implementation parses. (b) A statement that ends unbalanced after more than 32 brackets were open at once, at its first token. In (a) and (b) the tokens of the statement, from its first token to its end (an ending `;` included, an ending bracket or brace not), are not parsed; the rest of the file is. (c) A parse that the host's stack cannot hold despite (a) and (b), such as deeply nested unclosed blocks, at the first most deeply nested token; the file is not parsed. Brackets inside strings, comments and quoted names are not brackets. | `Bracket nesting exceeds the reference parser limit of 200 levels; this statement is not parsed.` / `Bracket nesting exceeds the reference parser limit of 32 levels for a statement that leaves brackets unclosed; this statement is not parsed.` / `Bracket nesting exceeds the reference parser limit: the parser ran out of stack space at this nesting, so this file is not parsed.` Each adds what to do. |
| WP3-D01 | SW2006 | `now()` in an initializer (WP3-S01) | The existing purity message, naming `now()`: `Initializer of {attribute} must be pure; now() reads state.` `{attribute}` is the attribute, requirement attribute or redefined attribute, spelled as in other messages (2.2 quoting). An initializer that reads the clock only through a helper keeps the 2.2 message `Attribute initializers must be pure.` |
| WP4-D01 | SW2013 | Policy setting value (WP4-S02) | `{setting} must be a duration literal such as 1s.` for a computed `requestTimeout`, `maxLatency` or `maxAge` / `{setting} is not a duration setting.` for a duration inside another setting's value. The 2.2 forms keep their 2.2 messages. |
| WP4-D02 | SW2002 | Non-integral computed duration (WP4-S01, WP4-S03, WP4-S04, WP4-S08) | `A duration must be integral, found {type}.` |
| WP4-D03 | SW2007 | Outside the constant sublanguage (WP4-S05) | `{expression} is not a constant duration: {calls \| mutable state \| now() \| values other than integers, durations and booleans \| cyclic const attributes} are not allowed.` The expression is its display text (WP4-S07); sampled reads join with WP6. |
| WP4-D04 | SW2013 | Per-occurrence value (WP4-S06) | `{period \| deadline} of {entry} is {value} ns in {occurrence}; it must be a positive representable duration.` The entry is named by its trigger and operation, such as `on every (periodMs * 1ms) poll`, the occurrence by its path. |
| WP4-D05 | SW2007 | Deadline above period per occurrence (WP4-S06) | `Periodic deadline cannot exceed its period in {occurrence}.` Two literals keep the 2.2 message `Periodic deadline cannot exceed its period.` |
| WP4-D06 | SW2016, warning | A computed duration expression that contains no duration literal, no `now()` call and no reference to a const attribute of the owner whose initializer, followed through const references, contains a duration literal. A const attribute's initializer can never contain `now()` (WP3-S01) or read another attribute, so only a duration literal in its own initializer counts. | `{expression} has no time unit and counts nanoseconds; multiply by a unit such as 1ms.` `after (pulseMs)` with `pulseMs = 250` warns; `wait (timeoutNs);` with `const attribute timeoutNs: uint = 5ms;` does not. |
| WP4-D07 | SW2013 | Non-exact or zero-divisor division in a constant duration, per occurrence (WP4-S05) | `{expression} divides {a} by {b} in {occurrence}, which is not an exact integral division.` for `/`; `{expression} takes the remainder of {a} by {b} in {occurrence}, which is not defined for a zero divisor.` for `%` by zero. The expression is the division itself. |
| WP4-D08 | SW2019, warning | Two effective `every` entries of one occurrence for the same operation whose periods are equal in that occurrence but whose trigger identities (WP4-S07) differ, such as a base `on every 20ms g();` and a specialization's `on every (2 * 10ms) g();`: neither replaces the other, so the operation is released twice per period. Literal periods are identified by their nanoseconds as in 2.2, so one of the two is computed and no 2.2 source gets it. Reported once, at the later entry. | `{entry} and {other entry} have the same period in {occurrence} but different triggers, so neither replaces the other and {operation} is released twice per period; write the same trigger to replace an entry.` |
| WP5-D01 | SW2008 | Completion transition without target (WP5-S02) | `A completion transition needs a target state.` |
| WP5-D02 | SW2008 | Completion guard calls `now()`, directly or through a callee, or has a wrong effect (WP5-S03) | `A completion guard cannot call now(); it is not re-evaluated as time passes.` at the call / `State guards may only be pure or read state.` |
| WP5-D03 | SW2008 | `when (true)` cycle on which no entry action, exit action or effect can suspend (WP5-S04) | `States {A} → {B} → {A} form a cycle of when (true) completion transitions.` |
| WP5-D04 | SW2008 | Completion, internal or guarded-timer transition or deferral in a final state (WP5-S02, WP5-S07, WP5-S08) | `Final state {state} cannot have transitions or deferrals.` at each; 2.2 forms keep `Final states have no transitions or exit action.` |
| WP5-D05 | SW2008 | Deferred member not an input, or not handled by any state (WP5-S08, WP5-S09) | `{member} is not an input of {operation}.` / `{member} is deferred, but no state of {operation} handles it.` |
| WP5-D06 | SW2008 | Defer and handle in one state, or deferred twice (WP5-S08) | `State {state} defers {member} and also handles it.` / `State {state} defers {member} twice.` |
| WP5-D07 | SW2008 | Timer guard effect (WP5-S06) | `State guards may only be pure or read state.` |
| WP5-D08 | SW2017, warning | Completion guard that reads no component attribute written by the machine's entry actions, exit actions or effects or their transitive callees; a sample cell (chapter 2.6) is not such an attribute, because completion is not re-evaluated when a cell is updated (WP5-R03; confirmed in WP6). Not reported for a guard that folds to true (the literal `true`, `1 == 1`, `not false`), for a guard that folds to false (WP6-D10 reports it), for a guard that already has an error, or in a polling state as WP6-D09 narrows it | `Completion guard of {state} reads nothing that {operation} writes; it cannot change while the machine waits.`, followed by ` Completion is not re-evaluated when a sample cell is updated.` when the guard reads a sample cell. |
| WP6-D01 | SW2005 | Sampling a forwarded boundary (WP6-S08) | `{port}.{member} cannot be sampled: {port} is a forwarded boundary.` |
| WP6-D02 | SW2004 | Port redefinition that removes the initial value, or changes the type, of a member that inherited behaviour samples (WP6-S03), at the redefinition, once per member | `Sampled attribute {member} of {portDefinition} needs an initial value: inherited {operation} samples {port}.{member}.` / `Sampled attribute {member} of {portDefinition} must keep type {type}: inherited {operation} samples {port}.{member}.` (`an inherited schedule entry` for a read in a schedule-entry argument) |
| WP6-D03 | SW2005 | Ownership of sampled and unsampled members (WP6-S04) | The existing owner messages; a sampled member with no owner is not reported. |
| WP6-D04 | SW2002, SW2006 | Initial value typing and purity (WP6-S02) | The existing initializer messages. |
| WP6-D05 | SW2006, SW2007 | `p.m` of a member that opts in to sampling, but not a required attribute, or in a forbidden position (WP6-S01, WP6-S08) | `{port}.{member} is not a required attribute of an owned port.` / `A sampled read is not allowed in an initializer.` (SW2006) / `A sampled read is not allowed in a constant duration.` (SW2007) |
| WP6-D06 | SW2004 | Member policy on forwarding, unknown member or repeated member (WP6-S05) | `Member policies are not allowed on forwarding {connection}.` / `{member} is not a member of both ports of {connection}.` / `{member} has two policies in {connection}.` |
| WP6-D07 | SW2013 | Member policy completeness or idempotency per member route (WP6-S07) | The existing policy messages, naming the member. |
| WP6-D08 | SW2010 | Sampled read in a case script (WP6-S09) | `A case script cannot sample {port}.{member}; use on receive.` |
| WP6-D09 | SW2017, warning | The polling exemption of WP5-D08, narrowed (WP5 review N2; a separate, revocable change while the owner reviews WP5-R03). A state polls when it has a self receive or timer transition, or an internal receive transition (an internal timer fires once per entry), whose guard is absent or does not fold to false; the exemption then applies only to a guard that reads an attribute that some executable of the component writes, or a sample cell. A self transition whose guard reads its input, such as `when (v > 100)`, still exempts the state, because whether it can be true is not decided statically | The WP5-D08 message. |
| WP6-D10 | SW2017, warning | Completion guard that folds to false in its definition (WP5 review N3, owner decision). Not reported when the guard names a const attribute of its component that an attribute redefinition in a specialization or usage of that component replaces (the same declaration, not only the same name), so that it may fold differently per occurrence | `Completion guard of {state} is always false; the transition is never taken.` |
| WP7-D01 | SW2007 | Release guard on a `start` or `call` entry (WP7-S01) | `A release guard is allowed only on every, receive and after entries.` |
| WP7-D02 | SW2007 | Release guard type or effect (WP7-S02) | `Release guard must be bool, found {type}.` / `Release guard must be pure or read state.` (a call that writes or communicates; unresolved, remote and suspending calls keep the call rules' messages); a name outside the scope keeps the existing unresolved-name message (SW2002). |
| WP7-D03 | SW2020, warning | Release guard of an `every`, `receive` or `after` entry that folds to false in the structure where the entry is written, so the entry never runs its operation (review F3, as WP6-D10 for completion guards). Reported once, at the guard. Not reported when the guard names a const attribute of its component that an attribute redefinition in a specialization or usage of that component replaces (the same declaration, not only the same name), so that it may fold differently per occurrence; a guard that folds to true or does not fold gets no diagnostic. It needs a release guard, so no 2.2 source has it | `Release guard when ({guard}) of {entry} is always false; the entry never runs {operation}.` {entry} is the trigger and operation (`on every 10ms slot`, `on receive inp.go take`, `after slot next`); names are spelled as in 2.2. |
| WP7-D04 | SW2020, warning | An entry without a release guard, written in a specialization or usage, that replaces (WP7-S03) an inherited entry of its effective base whose guard does not fold to true (review F2). Reported at the replacing entry, with the inherited entry as related information. A replacement with any guard, `when (true)` included, states its own condition and is not reported; an inherited guard in a document with syntax errors is not reported elsewhere. It needs a release guard, so no 2.2 source has it | `{entry} replaces the inherited entry of {component} without its release guard when ({guard}), so it runs {operation} whatever the guard says; repeat the guard, or write when (true) to remove it deliberately.` {component} is the definition or usage that wrote the inherited entry. |
| WP5-D09 | SW2018, warning | Deferred event with an effective `reject` overflow on a route into this occurrence (attributes never overflow) | `{member} is deferred in {state}, but policy {policy} of {connection} rejects on overflow; a full queue fails the sender. Give {connection} a policy that drops on overflow (Overflow.dropOldest or Overflow.dropNewest) or a capacity that holds the retained messages.` {connection} is the connection name or `connect (a, b)`. When a member policy is the rejecting effective policy (WP6-S07), {policy} names it and the advice reads `Give {member} of {connection} a member policy that drops on overflow …`; a connection without member policies, every 2.2 source included, keeps the message above. The library default policy rejects on overflow, so a deferral over a connection without a policy is reported: the warning is intended, because the sender's publish fails while the receiver defers. A deferral that already has an error (WP5-D04 to WP5-D06) is not reported. |

Every diagnostic includes a source range and stable code. Machine-readable diagnostics retain declaration identity and occurrence context when resolved. A suggested edit is supplied only for a safe unambiguous correction; tools must revalidate the resulting complete workspace before applying it. Parser recovery may suspend semantic checks on invalid syntax, but the document remains invalid and must not crash the service.

## 4.5 Evidence boundaries

S is syntax, V is static validity, E is reference execution behavior, A is an explicitly scoped analysis, K is validated kernel export and G is validated graphical source editing. Implementations report supported groups and evidence rather than promoting one level to another. [Chapter 8](spec/08-conformance-obligations.md) defines the obligations and [status](IMPLEMENTATION_STATUS.md) reports actual support. The reference simulator uses logical zero-cost execution and bounded resources; target deployment timing requires separate evidence.


---

<a id="chapter-9"></a>

# 5. Proposed KerML semantic mapping

Normative mapping contract of [swa.ml 2.2](LANGUAGE_SPECIFICATION.md), conditional on a backend claiming K conformance. No exporter or validated KerML semantic library is supplied by the current reference implementation. Langium AST generation and exhaustive inventory coverage do not establish KerML conformance.

## 5.1 Representation

Packages map to Package/namespace membership and imports. Datatypes/enums preserve nominal identity; arrays preserve copied shape. Components map to software Structure definitions and owned typed features. A usage creates an occurrence, including each multiplicity index; no shared private state is introduced. Specialization/redefinition retains the effective member set and base/replacement provenance.

A result-bearing operation maps to a Function; a void operation maps to a Behavior. This mapping does not make a result-bearing swa.ml operation pure. Effects remain explicit swa.ml constraints. Operation usages retain their shared signature and effective body. Nested operations are owned executables without lexical captures; states contribute to their owning operation rather than becoming an independent executable.

Ports map to owned typed features with per-member directional projections. Reversal flips each projection. Structural compatibility is retained as per-member typing constraints, not replaced by nominal port identity. Connections map to Connector instances with source occurrence/member route and independent policy queues. Forwarding maps to queue-free boundary aliases with preserved chains, not an extra message hop. Messages, transfer values, correlation and terminal failures require swa.ml semantics over suitable KerML Step/transfer structures.

| ID | Rule |
| --- | --- |
| WP1-M02 | `Selector`: kind `value`, normative `docs/spec/01-structure-and-types.md`. A place assignment lowers to a whole-value write of its root with one replaced feature value. It never becomes a reference feature. |
| WP2-M02 | `ConditionalExpression`: kind `value`, kernel `ControlFunctions::'if'`, normative `docs/spec/01-structure-and-types.md`. Only the selected branch is evaluated. |
| WP6-M02 | `MemberPolicy`: kind `reference`, normative `docs/spec/02-communication.md`. It references the effective policy of one member route of the owning connector. |
| WP6-M03 | `PortMember` with an initial value maps the initial value as the feature's default value. Sampled reads lower to a read of a per-port-occurrence sample feature. They are not a transfer step. `Connect` records its member policies. |
| WP2-M03 | `Association` keeps its entry. Its semantic text states that a list statement lowers to one reference per occurrence–case pair, with the statement and the list positions as provenance. |

The changed productions `Assign`, `ReferenceExpression` and `CallExpression` (WP1), `Expression` and `ExpressionStatement` (WP2) and `PolicySetting`, `Literal`, `Wait`, `Receive`, `ScheduleEntry` and `Transition` (WP4) and `State` and `Transition` (WP5) and `ScheduleEntry` (WP7, release guards) keep their mapping entries with updated semantic text in `spec/kerml-mapping.json`: a completion transition is a guard-only TransitionUsage without trigger, and an internal transition has no target change. WP5-M02: the new production `Deferral` has kind `lowering`, normative `docs/spec/03-behavior.md`, and lowers to a state-scoped retention constraint on the machine's input projection.

## 5.2 Required semantic library

A K-conforming backend MUST implement a pinned swa.ml semantic library specializing the selected KerML 1.0 library. It defines Component, Operation, Port, Connector, Message, Queue, Activation, Schedule, state-machine reactions, copied values, failure and interruption. It MUST preserve suspension/unlock/relock, snapshots, deadlines, queue identity, success-only out copy-back, after success releases, state transition ordering and cancellation/late-reply behavior. Merely attaching uninterpreted metadata is preservation rather than proof that a kernel tool understands the execution semantics.

No arbitrary metaclass name is invented as a kernel class. Abstract bases require concrete backend choices validated by that kernel. Unsupported meaning yields an explicit partial-export result. The [inventory](../spec/kerml-mapping.json) covers every grammar production/type as element, grouping, reference, value, lowering or lexical, with its normative home. Groupings/lexical nodes contribute to owners and must not create duplicate semantic elements.

## 5.3 Traceability and claims

Every lowered node/constraint retains source declaration identity, URI/range, occurrence context and a generation role. Inherited declarations and replacements retain both provenances. Requirements, satisfaction, verification, deployment, cases with their subject occurrence, associations, package connections and views retain typed metadata/references, without proof claims. Names keep their decoded spelling; quoted swa.ml names map to KerML unrestricted names. Timing observations reference their run and binding; layout stays separate.

A conforming backend identifies the exact source/package/library revisions, selected KerML implementation, checked constraints and evidence. Round trips preserve the [normalized model](spec/07-normalized-model.md) and cannot erase effects, merge occurrences/queues, reorder state transitions, invent routes, weaken contracts or convert copied values into references.


---

<a id="chapter-10"></a>

# 6. Reference execution contract

Normative contract of [swa.ml 2.3](LANGUAGE_SPECIFICATION.md) (unreleased candidate), profile **swaml-reference/2.3**. Every 2.2 run keeps its result and trace apart from `profile` and `languageVersion` ([E20](spec/08-conformance-obligations.md)). A run records parser/package identity, source bytes, run target, applied deployments, options, limits, fault assumptions and an ordinal logical trace. Host adapters load files and hash sources; the language core performs neither filesystem access nor hashing.

## 6.1 Lifecycle and time

A run target is a package or one top-level component occurrence of a package. A package run executes every top-level occurrence of the package except platform roots (occurrences that specialize Swaml::Platform::Node), with their internal connections and the package connections between their ports. A component run executes that one top-level occurrence: its package connections are absent and its top-level ports are open, so an emission through an open port has no route and a request through it fails as unavailable. A top-level occurrence has at most one deployment, and a run applies it to that occurrence's tree.

Expand the finite occurrence tree of every executed top-level occurrence and initialize separate private stores before releasing startup work. An uncaught initializer runtime failure ends initialization, records the occurrence, attribute, source range and reason, retains partial stores and source evidence, and releases no startup work. A caught initializer failure may recover and remains observable. Distinct targets are independent execution choices; the occurrences of one package run share its initialization barrier, clock and trace. The reference epoch is 0ns. Every D releases at kD for k at least 1. Schedule arguments evaluate and copy at dispatch, under the serial lock or the concurrent dispatch snapshot. Entry deadline is measured from release, including backlog, request transport, wait and receive. Periodic deadline defaults to period.

Time uses nonnegative safe integer nanoseconds. Durations are positive and must remain representable after conversion/addition. Reference CPU steps cost zero physical time; a step budget prevents runaway computation. Ordering is deterministic by timestamp, phase and insertion ordinal. Deadline/request timeout wins a tie with reply or ordinary work. Receive timeout wins a tie with delivery in the reference selection. A run explicitly records its horizon; live/waiting activations and future events yield horizon status with open intervals rather than invented completion.


| ID | Rule |
| --- | --- |
| WP4-R02 | **Computed durations.** A computed `wait` or receive timeout is evaluated when the statement starts waiting. A computed state timer is evaluated when the entry actions finish, and its expiry is the state-update time plus the value. Periods and deadlines use the per-occurrence constant values (WP4-S06), evaluated once per occurrence: an `every (e)` entry releases at root epoch + k·P of its occurrence and its deadline is release + D. A value that is not a positive representable duration is `DurationRange` (WP4-R01). An expiry outside the clock range stays the `ClockRange` violation. |
## 6.2 Lock and snapshot

One serial activation runs at a time per component occurrence. Nonsuspending local calls borrow its context and lock. wait, requests, receive and idle state waits release the lock. On readiness, serial work reacquires it before continuing and uses live attributes; locals remain copied cells. Concurrent entries may overlap, read one dispatch snapshot throughout and cannot write state even through callees or out arguments. Target backends must state how they realize the same snapshot semantics.

After a successful whole operation completes and unlocks, each effective after entry releases one fresh activation. No release occurs on failure, idle state reaction or intermediate local return. Each dependent has fresh deadline, locals and snapshot/backlog accounting. Correlated service reply transport and local completion dependencies are distinct observations. Duplicate dependencies are statically invalid and the graph is acyclic.

Release guards (2.3) decide at dispatch whether a released activation runs. A false guard is a skip, which counts as a completion for after successors.

| ID | Rule |
| --- | --- |
| WP7-R01 | **Evaluation.** A release guard is evaluated at the activation's first execution step (after its `release` and `dispatch` observations), before its dispatch arguments and in their scope. It sees every sample-cell update ordered before that step in the instant's event order (time, phase, insertion ordinal; WP6-R02), and none ordered after it. Serial entries evaluate under the serial lock and read live attributes. Concurrent entries read attributes from their dispatch snapshot and sample cells and `now()` live (WP6-R07). A cell the guard reads keeps its value for the arguments and the operation until the operation suspends (WP6-R03), so the guard, the arguments and the body read one value. The arguments are evaluated only after a true guard; an argument failure keeps its 2.2 meaning. |
| WP7-R02 | **False guard.** No argument is evaluated and no operation runs, so a guard may protect its own arguments (`use(sum % count) when (count != 0)` never divides by zero), and the deadline armed at release is cancelled. The serial lock is released, as on completion. The activation ends with `skip` (WP7-T01), never `complete`. |
| WP7-R03 | **Skip as completion.** A skip counts as a successful whole completion for `after` successors: each successor is released at the time of the skip, with the skipped activation as its `predecessorActivation`, and applies its own guard. |
| WP7-R04 | **Receive entries.** A `receive` entry consumes its input at release, as in 2.2. When its guard is false, that input is discarded (`discardInput` with reason `releaseGuard`, WP7-T02); it is never retained or offered to another receiver. |
| WP7-R05 | **Grid.** Periodic releases stay on the root-epoch grid `kD` whatever the guard results (D9). |
| WP7-R06 | **Guard failure.** A runtime failure inside a release guard is an uncaught failure of that release: the deadline is cancelled, no successor is released and the lock is released. Its `failure` names the entry as `source` when the guard expression itself fails, and the failing statement (`Pkg::C.op/N`) when the failure happens inside an operation the guard calls, as for a dispatch argument. |

## 6.3 Values, flow and failure

Evaluation is left to right with and/or short-circuit. Payloads, records, arrays, parameters/results and out copy-back are copied, with nominal identities and domain checks. for in uses one copied collection. A loop limit evaluates once, is checked in the uint domain, and exits normally at the count; termination beyond declared limits is not statically proved. Integer overflow, non-finite reals, zero division, invalid indexes and failed assert/fail are runtime failures.

| ID | Rule |
| --- | --- |
| WP2-R01 | **Conditional.** Evaluate the condition, then only the selected branch; the value takes the conditional's common type. A failure in the selected branch fails like any expression; the other branch is never evaluated. |
| WP1-R04 | **Places and reads.** Place assignment follows WP1-R01 to WP1-R03 (section 3.3). Selector reads evaluate index expressions left to right and return a copy; a dynamic index outside its extent is `Bounds`. A read takes the value of its root before evaluating any of its index expressions, then evaluates, checks and applies each index and field in turn, as 2.2 reads do; a place evaluates all its indexes, then the right side, and reads and writes its root last (WP1-R01). Selecting a field or element of an out value that was never assigned (an unanswered `on call` out binding copied back to its caller, a 2.2 case) is the runtime failure `Type`. |

Library host intrinsics follow chapter 1.5: `sqrt` (WP3-R01), `intText` and `realText` (WP3-R02) and `now()` (WP3-R03). The `sqrt` failure `Arithmetic` and the `realText` failure `Bounds` are recorded like every runtime failure, and a caught one is a `caught` observation. `now()` returns the logical time of the step that evaluates it, live in every activation, and adds no trace observation.

A local failure unwinds frames to the nearest try or fails the activation. Try fallback is lazy and type-compatible; prior state writes/emissions remain committed. Out values copy back only on successful return. Interrupt transfers and deadline/resource/activation violations are outside try. Resource failure is explicit evidence; no silently dropped activation is reported as successful execution.

## 6.4 Communication

Resolve boundary aliases before routing; forwarding adds neither queue nor latency. Each connection occurrence/direction/member owns a queue. Bare connections use the pinned Default. Check outgoing arguments against the emitting/requesting port member before routing, even when the peer accepts a wider domain. Request out cells initialize in the provider domain; successful replies convert at caller copy-back. Attribute queues replace the pending value; event/request queues obey capacity, delivery, ordering, overflow and optional age/latency assumptions. A reference run chooses insertion order for unordered queues. Fanout proceeds in route order and may partially commit before rejection.

A required request creates a unique pending correlation and suspends the caller. Result/out values and failure return through the same route in reverse. Timeout uses requestTimeout. First terminal transition is immutable; timeout wins equal-time delivery; late replies are traced and suppressed. AtLeastOnce may redeliver and requires an idempotent declaration. The reference fault model records offer-indexed drop, duplicate, transport and additional latency; retries/redelivery assumptions must be inspectable. Each duplicate copy independently obeys queue capacity and overflow; attribute copies preserve the single latest pending value. Accepted input comes only from validated source emissions; no destination injection exists.

| ID | Rule |
| --- | --- |
| WP6-R05 | **Per-member policy.** Each member route uses its effective policy (member policy, else connection policy, else `Default`; WP6-S07) for capacity, overflow, ordering, delivery, request timeout, latency and age. Queues remain per connection occurrence, direction and member. |
| WP6-R06 | **Sample cells.** Sample cells follow WP6-R01 to WP6-R04 (chapter 2.6). Updating a cell never consumes input and never releases work. A cell update is part of its delivery event and takes its place in the instant's event order like every other event. |
| WP6-T01 | `sample` (new): a cell update, with `subject` the port occurrence and member (`Demo.r.door.ajar`), `targetPort`, `member`, the copied `value`, the message identity `message` and `source` the emitting statement. `deliver` keeps meaning consumption by an owner, so a member that is both sampled and consumed produces one `sample` and one `deliver`. Reads are not observed. |

## 6.5 Input ownership and interruption

An event is consumed by its one owner. Input for a receive statement remains queued before that statement waits. Inputs for inactive interrupt regions are discarded and observed. An armed region includes suspended local callees; matching input cancels protected frames/continuation and any pending local request, but not a remote server. Transfer stays in the same activation/deadline, preserves outer locals and committed effects, and runs the handler. Terminal interrupted correlations suppress late replies. No physical scheduling/preemption guarantee is implied.

A state machine waits without the component lock. Each reaction selects the first enabled nested transition for the input/timer, runs exit/effect/state-update/entry, and releases the lock again when idle. The timer epoch is the state update before entry actions, including time spent suspended in entry. Entry completes before timer selection; elapsed timers precede queued input, with earliest expiry first and equal-expiry transitions in source order. Deadline ties still win. State entry owns timer generations; stale timers cannot fire after exit. Unhandled input does not restart a timer. Final entry completes the whole operation once; it can release after dependents.

The rules below define the selection of a stateful activation in 2.3; for a machine without the 2.3 forms they are exactly the 2.2 order above (WP5-R11).

| ID | Rule |
| --- | --- |
| WP5-R01 | **Selection order.** After the entry actions of a state finish (and its computed timers are evaluated, WP4-R02), the machine selects in this total order: (1) the first enabled completion transition in declaration order, taken at once (exit, effect, state update, entry); (2) the earliest elapsed armed timer, declaration order on equal expiry; (3) retained input in global offer-ordinal order (WP5-R09); (4) other queued input in the 2.2 order. If nothing is selectable, it waits without the lock. |
| WP5-R13 | **Input during a chain.** Input queued while entry actions run, or during a chain of completion reactions, stays queued and is selected in whatever state the chain reaches. If that state neither handles nor defers it, it is discarded there (`discardInput`, `inactiveOwner`). |
| WP5-R02 | **After internal reactions.** The same completion evaluation follows every internal reaction. |
| WP5-R03 | **No completion after discards.** Completion is not evaluated after `discardInput` (no enabled receive transition) or `discardTimer`: neither changes anything the machine owns. Completion guards are not re-evaluated when other operations change what they read (SW2017, WP5-D08). |
| WP5-R04 | **Guarded timers.** When a guarded timer is selected, its guard is evaluated. If the guard is false, the timer is consumed for this state entry (`discardTimer`, WP5-T02) and the next timer with the same expiry is tried in declaration order. Later timers stay armed. Re-entering the state arms it again. |
| WP5-R05 | **Internal reactions.** An internal transition runs only its effect: no exit, no entry, no state update, no `machines` change. The state's timers keep their epoch (the state-update time) and computed timers are not re-evaluated. An internal timer fires at most once per state entry. Its reaction leaves the other timers armed; an already elapsed one, including one with the same expiry, is selected after the completion evaluation that follows the reaction. |
| WP5-R06 | **Suspended effects.** If an entry action or an internal effect suspends, the timers keep their epoch. On resumption, the machine evaluates completion, then elapsed timers, then input, as after entry actions. |
| WP5-R07 | **`CompletionLoop`.** A completion chain starts when the stateful activation starts. It restarts at every consumption of input or a timer (internal reactions included) and at every suspension of an entry action, exit action or effect. A completion reaction that enters a state already entered in the current chain is the contract violation `CompletionLoop`, raised when the target state would be entered (after the exit actions and effect). It stops the run and bypasses `try`. A retry state whose entry suspends on a request and re-enters through completion is therefore allowed; a counting loop through completion transitions that never suspends is rejected even when bounded. |
| WP5-R08 | **Retention.** While the current state defers member `m`, input for `m` stays in its connection queue, and capacity, overflow, ordering and `maxAge` apply to it observably. A retained attribute keeps only its latest value. A message is retained from the first instant at which it is deliverable while the machine's current state defers its member, whether the machine then waits at its selection or runs an entry action, exit action or transition effect of that state (the effect of a transition into a deferring state runs in the state it leaves). It gets exactly one `defer` observation, at that instant (WP5-T03), and stays retained in later states until it is consumed or discarded. Example: `y` is offered at 0 ms and consumed in `A`, which creates its queue; `x` is offered at 1 ms and `y` at 2 ms while the machine is in `state Busy { defer a.x, a.y; on entry { wait 5ms; } when (true) to Both { } }`. Both are retained when they become deliverable, at 1 ms and 2 ms, although `Busy` never waits, and `Both` takes `x` before `y` (WP5-R09), as it does when `Busy` instead waits for `after 5ms to Both { }`. |
| WP5-R09 | **Retained order.** In a state that handles retained members, retained input precedes other queued input but follows completion transitions and elapsed timers (WP5-R01). It is consumed in global offer-ordinal order across all of the machine's queues: the order in which the messages were queued, not the order in which their queues were created. Input that was never retained follows in the 2.2 order. |
| WP5-R10 | **Retained discard.** On entering a state that neither handles nor defers `m`, retained input for `m` is discarded at the next wait with reason `inactiveOwner`. |
| WP5-R11 | **2.2 machines.** A machine without completion transitions, internal transitions, timer guards and deferrals selects and orders exactly as in 2.2, and its trace has no 2.3 observation or field. |


## 6.6 Evidence and resources

Trace ordinals distinguish equal-time observations. Record initialize, release, dispatch, ready, unlock, wait/requestWait/receiveWait, messages/offers/delivery, writes, states, interruption, completion/failure, caught failures, timeout, overflow/discards, late replies and violations. Retain activation/correlation/route identities where applicable. Each observation caused by a statement or schedule entry records its statement identity as source: writes, emissions, asserts, failures and suspensions name the executing statement, a state wait or reaction its state or transition, releases and dispatches the schedule entry, and every message lifecycle observation (offer, delivery, replacement, overflow, drop, retry, age or input discard, interruption, request, reply, timeout, cancellation, late reply) the statement that emitted or requested the message. Messages and correlations keep the identity of the emitting or requesting statement. Final stores are occurrence-indexed and timing projections leave live intervals open. No-failure-observed means only that finite run under its recorded assumptions. Step, backlog and concurrent limits are finite, explicit options. Production timing, real transport guarantees and universal verification remain separate claims.

New and extended observations of 2.3 appear only where new syntax is used, so a 2.2 model's trace is unchanged.

| ID | Observation | Fields and meaning |
| --- | --- | --- |
| WP1-T01 | `write` (extended) | A place assignment adds `place`, the evaluated place text such as `statuses[2].confirmed`, with decoded names and evaluated indexes. `value` is the new whole root value; `subject` is the root. A whole assignment has no `place`. |
| WP4-T01 | `wait`, `receiveWait` (extended, computed forms only); `timer` (new) | A wait or receive timeout whose duration is computed adds `durationNs`, the evaluated value. A computed state timer is evaluated when the entry actions finish, after the `state` observation of that entry and the entry's own observations, and records a `timer` observation: `subject` the machine, `state`, `source` the timer transition, `timerNs` the evaluated value and `expiresNs` the expiry time. Literal waits and literal state timers add no field and no `timer` observation. `DurationRange` (WP4-R01) is recorded like every runtime failure; a caught one is a `caught` observation. |
| WP5-T01 | `state` (extended) | An internal reaction is a `state` observation with `internal: true`, the unchanged `state`, the `activation` and the transition as `source`, recorded before its effect runs. A state entry has no `internal` field. |
| WP5-T02 | `discardTimer` (new) | A timer consumed because its guard was false: `subject` the machine, `activation`, `state`, `source` the timer transition, `reason: 'guard'`. |
| WP5-T03 | `defer` (new) | Exactly one per retained message, at its first retention (WP5-R08), whether the machine then waits or runs an action of the deferring state: `subject` the machine, `activation`, `state`, `member` (`port.member`), `source` the message origin and `message` the message identity. Deferred members are events or attributes, so there is no correlation. |
| WP5-T04 | `violation` (extended) | `code: 'CompletionLoop'` with the machine as `subject` and the completion transition as `source`; the other violations keep the run target as subject and no `source`. |
| WP7-T01 | `skip` (new) | A release whose guard was false: `subject` the operation occurrence (`c.slot`), `activation`, `source` the schedule entry (`Pkg::C/schedule/N`). It replaces `complete` and, like `complete`, follows the activation's `unlock`. A skipped release therefore records exactly `release`, `dispatch`, `unlock` (serial entries only), `skip` and, for a `receive` entry, `discardInput`: the activation exists from its release, the guard is its first step, and no argument or operation observation belongs to it. |
| WP7-T02 | `discardInput`, `failure` (extended) | A skipped `receive` entry's input is a `discardInput` directly after its `skip`, with `subject` the operation occurrence (`c.take`, as for the `skip` and for an activation's `noEnabledTransition` discard; the member is the delivered message's), `activation`, `source` the message origin, `message` the message identity and `reason: 'releaseGuard'`. A failing release guard is a `failure` with the entry, or the failing statement of an operation it calls, as `source` (WP7-R06). |

## 6.7 Case runs

Each case with statements runs in its own fresh run of its package target. The script is a serial activation of its own, released at 0 ns after every on start entry, so it starts after the initialization barrier. It may call operations of its exact primary subject and act at the ports of its associated interface-only occurrences, which do nothing else. Input that reaches an actor port before the script waits for it stays in that connection's queue under the connection's policy (capacity, overflow, ordering and age), and an attribute keeps only its latest value, so a later on receive consumes the oldest queued event or the latest attribute value. A request addressed to an actor port waits in its queue until an on call branch takes it or the caller's requestTimeout expires.

A primary-subject call waits for its serial lock, switches the actual running frame into the subject's operation context and restores the case context on return or failure. The operation uses its own ports and live store, and may suspend; suspension releases its lock and resumption reacquires it. This local call creates no new schedule activation, implicit port, route, QoS timeout or `after` release. The script waits for completion, with ordinary `try` and success-only result/output-copy semantics and the case's existing horizon and resource bounds. It cannot execute a later actor-reply branch while blocked in the call; use an independently behaving actor or an earlier actor event when that response must proceed concurrently.

Tests additionally inspect their subject and explicitly associated software roots and their parts, a part family member named by a literal index such as twins[0], under the target's serial lock. Helper calls on owners other than the exact primary subject may mutate through their operation but may neither communicate nor suspend. Use cases gain no private reads or part/peer calls. Associations preserve occurrence identity without cloning stores or changing package initialization, connections or execution roots.

Execution stores remain occurrence-local, but the trace records only the observations it emits. Local and white-box calls reuse their caller's activation, and individual reads and call invocations have no separate observation. A borrowed-call failure may be labelled with the case instead of its target. Consumers must retain available declaring-source, subject, activation and correlation context; a shared statement identity alone cannot attribute facts to every instance or invocation. Legal slash names can also produce ambiguous statement identities. Leave such attribution unknown, and never infer that a short-circuited expression or an unobserved return executed merely because its containing statement was reached.

The run stops with status stopped when the script completes or fails, otherwise at the horizon or step limit, or with status quiescent when no event remains while the script waits. The case result is pass when the script completed and the run observed neither an uncaught activation failure nor a contract violation; fail when a failure occurred, decided by the first in trace order with its statement identity, message and time: the script's own (a failed assert, fail or a runtime failure), an uncaught failure of another activation or a contract violation; inconclusive when the run ended before the script completed without a failure, at the horizon, at the step limit or stalled because the script waits while no further event can occur; and no checks for a case without statements, which does not run. A caught expression failure remains trace evidence and does not fail a case, so a passing case may record the failure-observed outcome. Observations of the script name the case identity as subject and carry its statement identities as source. A use case runs the same way as a test. A pass is bounded evidence of one deterministic run under its recorded assumptions, not proof.

| ID | Rule |
| --- | --- |
| WP5-R12 | A `CompletionLoop` violation fails a case: it is a contract violation in trace order, like the existing ones, with the verdict message `Contract violation CompletionLoop.`, and never an inconclusive step-limit stop. |
| WP7-R07 | A skipped release is neither a failure nor a completion of the case script, so it never decides a verdict. A failing release guard is an uncaught activation failure and fails the case (reason `run-failure`, `source` as in WP7-R06). |


---

<a id="chapter-11"></a>

# 7. Normalized model contract

Normative information-preservation contract of [swa.ml 2.2](LANGUAGE_SPECIFICATION.md). It defines what any exporter/target adapter must retain; it does not claim a kernel exporter exists.

## 7.1 Identity and provenance

A declaration identity is package plus owned-name path. An occurrence identity is the top-level occurrence plus indexed containment path; an operation occurrence additionally identifies its effective declaration. Activations/correlations/messages add unique run identities. Anonymous syntax/lowering nodes use an owner plus structural slot/generation role, not an invented user declaration. A statement identity is the identity of its owning operation or case, a slash and the statement path from that executable's body: statement indexes in each statement list and slot names with list indexes for nested blocks, branches, states, actions and transitions, as in Banking::ATM.serve/2/then/0. States and transitions are identified by the same path, as in Banking::ATM.run/states/0/transitions/1. A schedule entry is identified by its component and its index, as in Banking::ATM/schedule/0. Statement identities follow source structure and are trace provenance, not persistent editor identities. Source ranges are provenance rather than persistent identities. Every semantic node except a root has one owner; reference edges never imply containment.

Each normalized node/constraint retains source declaration URI/range and any inherited/replacement provenance. A persistent editor identity map is separate, preserving renames/moves atomically with source references and sidecars. Same-type multiplicity occurrences never share stores, queues or activation identity.

| ID | Rule |
| --- | --- |
| WP2-M04 | **Association pairs.** Each occurrence–case pair of an association list is one normalized link. Its provenance is the statement plus the positions of the occurrence and the case in their lists. Deleting one pair in a tool rewrites the list and keeps the other pairs. The reference projection (`projectModel`) gives each link of a list statement its positions as `pair: { occurrence, case }`; a single 2.2 statement has none. |
| WP4-M04 | **Entry identity.** A schedule entry keeps the identity `Component/schedule/N`. Its trigger identity for replacement and duplicates is the canonical form of WP4-S07 (`triggerIdentity`, `entryKey`). |

## 7.2 Families

| Family | Required content |
| --- | --- |
| Workspace/package | Edition, package revision, sources, imports, unique declaration namespaces |
| Record/enum/type use | Nominal identity, fields/literals, primitive domain, fixed array shape |
| Component definition/usage | Base, effective members, explicit replacements, anonymous usage specialization, multiplicity |
| Attribute/local/parameter | Owner/scope, explicit type, const/in/out, initializer, copied-cell lifetime |
| Operation | Signature, effective whole body, nested ownership without captures, inferred effect flags/class |
| Port/member | Definition or inline members, direction, reversal, optionality, payload/signature, idempotency, initial value of attribute members, sampled members per port (WP6) |
| Connection/forwarding | Endpoint occurrence references, alias provenance, structural member checks, effective policy, member policies with the effective policy per member route (WP6) |
| Policy | Pinned complete values and declaration/use provenance; no shared runtime queue |
| Schedule/entry | Trigger identity, effective target, dispatch arguments/bindings, period/deadline (a computed one as its expression text plus per-occurrence values, WP4), release guard (not part of trigger identity, WP7), concurrent |
| State/transition | Initial/final, entry/exit/effects, receive bindings/guard or timer (literal or computed delay, WP4), transition kind (receive, timer or completion), optional target (internal when absent), timer guard, state deferrals in order (WP5), ordered selection |
| Deployment | Software/platform roots, Node paths, family/index placements, effective specificity |
| Requirement/case/view | Immutable attributes/docs, package intent links (associate, satisfy, verify), case kind, subject occurrence and ordered script statements with resolved actor ports, exact normal primary-subject call targets, explicitly associated test access roots and exact inspection/helper targets, ordered selection union; association pairs from list statements with their list positions |

Expansion creates every literal multiplicity occurrence independently and keeps the definition reference. Inheritance produces an ordered effective set; replacement points to its inherited declaration. Late-bound local calls use that occurrence's effective operation name with the preserved signature. An operation usage retains the definition signature and either inherited or replacement body; no partial merge is inferred.

## 7.3 Routes and queues

Each port occurrence has per-member projections with effective provides/requires direction. Resolve forwarding to leaf port identities, retaining the full boundary chain without queue/storage/hop. Every resolved input projection references its unique owner and every provided attribute/event its emission sites. Outgoing operation projection is a request rather than an emission declaration.

A normalized connection records the two leaf ports, per-member directed routes and complete policy. Queue identity is connection occurrence, source/destination direction and member; requests/replies retain correlation separately. Attribute pending values use latest replacement, not event overflow rules. Extra provides remain contract members without fabricated peer requirements. Structural checks preserve each failed/matched member and nominal payload identity.

| ID | Rule |
| --- | --- |
| WP6-M04 | A normalized connection records the effective policy of each member route, and the member-policy declaration where one applies. Every sampled member of a port occurrence records its sample cell with its initial value, and its zero or one consuming owner. The reference API exposes them as `memberQos`, `memberPolicy` and `sampledMembers` (`semantic.ts`) and as `ProjectionEdge.memberPolicies`, `ProjectionNode.sampled` and the `initial` text of port members in `projectModel`. |

## 7.4 Executable lowering

Statements retain ordered operands, scopes, effects and success/failure continuations. Calls are expression nodes with a resolved local/port target, copied in/out/result types and effect flags. Try is a failure-catching node with a lazy fallback, never a rollback boundary. Wait/request/receive creates a suspended continuation plus unlock/readiness/relock; concurrent reads keep the captured dispatch snapshot. Loop limits evaluate once; for in owns one copied collection. Interrupt regions retain armed extent, input ownership, same-activation unwind, request cancellation and inactive/late-input observations.

A schedule entry lowers to a release mechanism and dispatch-time argument evaluation. After edges retain same-owner predecessor operation and completed activation identities, success-only release after unlock, fresh deadline/context and no implicit data forwarding/join. Stateful reactions retain source-order transitions, guards, timer generations and exit/effect/update/entry phases. WP5-M03: they retain source-order completion, timer and receive groups, internal reactions without a state update, timer guards and the deferral set per state. State bodies do not gain separate executable identities. Final entry completes the operation once.

| ID | Rule |
| --- | --- |
| WP7-M02 | A schedule entry with a release guard lowers to its release mechanism, then guard evaluation at dispatch before the arguments, then either the arguments and the activation or a skip that counts as completion for `after` edges. The skip cancels the release's deadline, releases the lock and discards a receive entry's consumed input. |

## 7.5 Presentation and equivalence

Views normalize to library definition plus ordered selected occurrences, retaining original include/filter clauses. General layouts preserve the same graph. Timing observations retain exact source/run/root/activation/correlation identities and open intervals; declared contracts remain independently identifiable. Geometry, collapse, routing bends and camera stay in sidecars.

Equivalence requires an identity-respecting correspondence preserving ownership, types/shapes, effective members, routes/policies, evaluation/effect order, schedule releases and release-guard skips, suspension, failures, cancellation, states, deployment, intent links and selected occurrence order. Whitespace/ordinary comments are outside execution equivalence but remain required for authoring round trips. Exporters cannot drop unsupported semantics silently or claim that carrying metadata supplies execution/kernel evidence.


---

<a id="chapter-12"></a>

# 8. Conformance obligations and evidence

Normative chapter of [swa.ml 2.2](LANGUAGE_SPECIFICATION.md). Acceptance levels are separate; implementations report the tested subset and limitations in their support matrix.

## 8.1 Static obligations

| ID | Required validation | Diagnostic group |
| --- | --- | --- |
| V01 | Headerless pinned edition, portable tokens, malformed recovery and literal domains | syntax, SW2000/2002 |
| V02 | Legal basic/quoted name spelling, unique names, explicit imports, unambiguous qualified/short references, no live-name shadowing | SW2001 |
| V03 | Finite nominal records/enums/fixed arrays, complete typed values, no void data, index ranges at every selector | SW2002 |
| V04 | Component-only definitions/usages, finite containment, acyclic single base, explicit compatible whole replacement, typed root additions, positive multiplicity | SW2003 |
| V05 | Directed port shape, reversal, nominal payloads and structural variance with per-member diagnostics | SW2004 |
| V06 | Immediate-child indexed routes, derived forwarding/connection, policy-free unique aliases, no duplicate resolved routes, package connections between top-level occurrences of one package, per-package closure/cardinality | SW2004 |
| V07 | Every required event/attribute and provided operation has one input owner; provided event/attribute emission provenance; interface-only components are exempt | SW2005 |
| V08 | Operation signatures, no nested captures, typed calls/out/result, acyclic graph, return paths, pure initializers | SW2002/2006 |
| V09 | Transitive effect inference, read-only guards, non-writing concurrent entries, suspension only in allowed whole expressions and never in a conditional | SW2006 |
| V10 | One schedule, unique effective identities (computed periods by canonical text), matching trigger/binding signatures, same-owner acyclic after, fresh void targets, period/deadline rules per occurrence and release guards (WP7) | SW2007 |
| V11 | Stateful parameterless void signature, exactly one start entry, reachable states, ordered transitions and final restrictions | SW2008 |
| V12 | Typed complete policies with duration literals for the time settings, effective-use idempotency, positive safe time/capacity domains | SW2013 |
| V13 | Node-only target content, root/occurrence/index placement resolution, unique exact paths and at most one deployment per top-level occurrence | SW2009 |
| V14 | Immutable requirements, case subjects in the same package, legal associate/satisfy/verify links, case script environment role and white-box access, seven library view kinds/subjects and stable selection union, association lists by pair | SW2010 |
| V15 | Stale-read and inactive interrupt-input warnings without a race-freedom claim | SW2011/2012 |
| V16 | Place roots, selector typing, `out` roots, no places as out arguments, literal component indexes in test paths | SW2002/2006/2010 |
| V17 | Conditional typing, whole-expression placement, no suspension; contextual words in every name position; association lists without repeated pairs | SW2000/2002/2006/2010 |
| V18 | `Swaml::Numeric`, `Swaml::Text` and `Swaml::Time` without new ambiguity for 2.2 sources; `now()` reads state and is rejected in initializers; no stale-read warning for `now()` values | SW2001/2006/2011 |
| V19 | Duration values, policy setting literals, the constant sublanguage per occurrence, trigger identity, unit warning | SW2002/2007/2008/2013/2016/2019 |
| V20 | Completion transitions, timer guards, internal transitions, deferral, completion-guard and deferral-overflow warnings | SW2005/2008/2017/2018 |
| V21 | Sampled-read ports and positions, mandatory initial values, zero-or-one owners of sampled members, member policies, dead completion guards | SW2004/2005/2006/2007/2010/2013/2017 |
| V22 | Release guards on every, receive and after entries only, bool with read-only effects, in the scope of the entry's arguments; not part of entry identity | SW2007 |

Validation MUST rebuild semantic string paths as well as indexed references after workspace changes/additions/deletions. Negative lookups matter: a newly loaded declaration may make a previously resolved short name ambiguous. Malformed source remains editable and invalid; recovery cannot silently accept a different program. Definite-return analysis may be conservative rather than solving arbitrary conditions. Dynamic numeric/index/termination failures remain runtime obligations.

## 8.2 Runtime obligations

| ID | Required observable evidence |
| --- | --- |
| E01 | Distinct occurrence/multiplicity stores, copied values, activation-local scopes and successful out copy-back |
| E02 | Initialization barrier, dispatch arguments, serial lock release/reacquisition and concurrent dispatch snapshots |
| E03 | Separate occurrence/direction/member queues, Default policy, latest attributes, overflow/order/age/delivery behavior |
| E04 | Unique routed correlations, result/out reply, failure propagation, timeout tie and terminal late-reply suppression |
| E05 | Ordered expression/flow execution, loop limits, copied iteration, checked arithmetic/indexes, lazy try without rollback |
| E06 | Ordered state reactions, live guards, timer generations, inactive input and final whole completion |
| E07 | Entry release/deadline accounting, finite step/backlog/concurrent resources and explicit violations outside try |
| E08 | Armed interrupt extent across callees/suspensions, same-activation unwind, terminal cancellation and no server rollback |
| E09 | One fresh after activation per successful whole completion after unlock, failure suppression and new context/deadline |
| E10 | Run/source/target/profile/option provenance, package and isolated component targets, trace ordinals with statement sources, occurrence stores and open observed timing intervals |
| E11 | Fresh package run per case script, release after startup entries, retained early actor input, on call replies, normal primary-subject calls with actual context/lock suspension and restoration, test inspection/helper access under its serial lock, stop on script completion or failure and pass/fail/inconclusive/no checks results with statement identities |
| E12 | Place evaluation order, kept right-side writes, `Bounds` with unchanged root, `write.place` |
| E13 | Conditional evaluates only the selected branch |
| E14 | `sqrt` correctly rounded and `Arithmetic` below zero; `intText`; `realText` with ties away from zero, unsigned zero, `Bounds` above 15 decimals and from 1e21; `now()` live logical time in every activation |
| E15 | Computed waits and timeouts evaluated when they start waiting, with `durationNs`; state timers evaluated after entry with `timer` observations; per-occurrence periods and deadlines; `DurationRange` |
| E16 | Completion, elapsed-timer and input order; no completion after discards; `discardTimer`; internal reactions keep timers; `CompletionLoop`; retention and offer-ordinal order; one `defer` per retained message |
| E17 | Sample cells updated at delivery (after latency and faults, ordered within the instant by the event order), independent of consumption, read live and stable within an activation segment, with `sample` observations; per-member policies |
| E18 | Release guards at dispatch before the arguments (a false guard evaluates none), deadline cancellation, skip as completion for successors, `skip` observations, `releaseGuard` discard, guard failure sourced at the entry or at the failing statement of a called operation, with no successor, unchanged grid |
| E20 | Every run, use case and test of the 2.2 corpus keeps its status, full final stores, machines, deployments, verdict and message and its complete trace, ignoring only `profile` and `languageVersion` (compatibility gate 2, compared with a fixture recorded with implementation 3.1.0) |

A deterministic reference run may choose one permitted order/delivery outcome. Its tests do not establish all possible traces or real transport reliability. A target implementation identifies additional scheduling/transport assumptions and evidence. Idempotency annotations are checked declarations, not proofs of side-effect behavior.

## 8.3 Analysis, kernel and graphical claims

Case realization needs a witness execution with payloads/assumptions; a passing case script is one such deterministic witness under its recorded assumptions, not a proof for every execution. Requirement fulfillment needs identified test/analysis/review evidence beyond satisfy/verify links. Schedulability needs target scheduler, cost and transport assumptions plus measurement/proof. Race/deadlock freedom requires analysis of suspension/interleaving and requests. A finite search without failure is not universal proof.

K requires the complete normalized model, a pinned semantic library/exporter, kernel validation and round trips. Inventory coverage is not K. G requires Browser plus seven source views, occurrence-aware identity, notation, source-validated edits, sidecar layout and atomic native undo/redo. LSP syntax/formatting alone is not G. Semantic paths need path-aware rename/reference/navigation; generic name references are insufficient.

Conformance reports identify edition, exact implementation revision, groups checked, unsupported capabilities, run limits and evidence links. [Implementation status](IMPLEMENTATION_STATUS.md) is the reference report; it must change when behavior or evidence changes.


---

<a id="chapter-13"></a>

# 9. Formal semantics

Normative schemas of [swa.ml 2.2](LANGUAGE_SPECIFICATION.md). These constrain implementations without claiming a mechanically proved metatheory.

## 9.1 Domains

Let D be the resolved declaration/effective-member graph, O the finite indexed occurrence tree, Γ a typed lexical environment, σ occurrence stores, ρ activation locals, Q per-connection/direction/member buffers, A activations, M state/timer generations, R correlations, L serial locks, B pending releases and t integer nanoseconds.

```text
C = (D, O, σ, Q, A, M, R, L, B, t)
D ⊢ O valid
D; Γ ⊢ e : T ! ε
D; Γ ⊢ s ⇒ Γ'
C —observation→ C'
```

The configuration also holds sample cells S, per port occurrence and sampled member (WP6), initialized to the member's initial value. The queued messages in Q carry a retained mark (WP5): a message that a deferring state retained, recorded once by `defer` and consumed in offer-ordinal order when a state handles it (chapter 6.5).

Values are bounded primitive scalars, nominal enums/records and fixed copied arrays; void has no inhabitant. Effect ε retains read/write/communication/suspension flags, with pure as empty. Transitive union over an acyclic call graph computes effects. The maximum class is a presentation of these flags rather than permission to erase a write beneath suspension.

## 9.2 Typing schemas

| Construct | Premises and result |
| --- | --- |
| x / x.field / x[i] | x in Γ; nominal record field or integral array index; result declared type; dynamic index must be in extent |
| x[i].f… / x[i][j]… | x in Γ; each selector is a record field or an integral array index; the result is the selected type; literal indexes are in extent; a copy |
| Enum.literal | No live first-segment value shadows the enum; unambiguous accessible nominal enum and literal |
| operation(args) | Resolved same-owner/nested or imported pure definition; copied typed in arguments; mutable compatible out targets; result declared type; effect is union of arguments and callee |
| p.member(args) | p is owned, member requires operation; arguments satisfy signature; effect communicates and suspends |
| case subject call | Exact primary software subject; copied typed arguments/results, actual serial operation context and normal effects; suspension releases/reacquires its lock, caller context restores on return/failure; local activation semantics, no implicit route or schedule release |
| test occurrence access | Resolved own-package executed software root is the subject or an explicit association, followed by single effective parts or part family members with literal indexes in range; reads use its live store under its lock, helper calls outside the exact primary subject neither communicate nor suspend; no ownership transfer or direct attribute assignment |
| try(e, f) | e:T and f:U assignable to T; lazy f; effect union; no fallback only when T is void |
| if (c) a else b | c : bool; a : T1, b : T2 with common type T under scalar widening, otherwise identical types; neither void; effect ε(c) ∪ ε(a) ∪ ε(b) without suspension; only the selected branch evaluates; a whole expression, never a statement |
| now() | result uint, the logical time t of the evaluating step; effect reads state; not in initializers or constant expressions (SW2007, WP4-S05) and not in completion guards (SW2008, WP5-S03); never a stale read |
| duration literal | Result uint (nanoseconds), a safe integer; positive in the 2.2 positions |
| computed duration `(e)` | e integral; in wait and receive timeouts without suspending calls; in state timers pure or reads state; in periods and deadlines in the constant sublanguage, with exact integral `/`, valued per occurrence |
| completion guard | bool; pure or reads state; no `now()`, directly or through a callee |
| `p.m` sampled | p an owned, non-forwarded port; m a required attribute that declares an initial value in the definition p has in the occurrence; result the member type; effect reads state (WP6) |
| timer guard | bool; pure or reads state |
| release guard | bool; pure or reads state; on every, receive and after entries; scope: attributes, sampled ports, `now()`, receive bindings, not the operation's parameters (WP7) |
| var x:T=e | Compatible value, fresh live name; Γ extends with mutable x; suspension allowed only when e is whole call/try |
| x=e | Mutable local/out/attribute, compatible type; attribute write adds write effect; same whole-expression suspension rule |
| place = e | The root is a mutable local, an assigned out or a non-const attribute; e is assignable to the place type; the effect adds a write of the root; the whole-expression suspension rule applies |
| return e | e assignable to owning operation result; expression does not suspend; success copy-back |
| if/while/until/assert | bool condition; optional loop limit uint-compatible and evaluated once |
| for | Fresh initializer scope; bool condition; mutable typed update; fresh body scope each iteration |
| for in | Collection T[n], explicit compatible element type; copied collection; fresh element/body scope |
| wait/receive | Suspended continuation; owned input with explicit payload binding for receive; no implicit failure/payload name |
| interruptible | Non-stateful operation, exclusive required input; protected and handler scopes share only outer locals |
| state guard | bool, effects pure or reads state; transitions selected in authored order |
| concurrent entry | Callee transitive effect has no write and body is not stateful |
| attribute initializer | Explicit destination type; empty state environment; pure effect |

Scalar type assignability uses widening, with checked integral value conversion in assignments/parameter initialization. Port compatibility is structural by member name with contravariant operation inputs and covariant output/result payloads. Nominal records/enums do not become structurally equivalent. Array values preserve invariant element type/extent; literals are checked elementwise.

## 9.3 Transition schemas

| Rule | Configuration change and observation |
| --- | --- |
| initialize | Expand O, create separate σ[o], initialize all before startup release |
| release | Add fresh activation to B with release time/cause/deadline; bounded admission or explicit violation |
| dispatch | Acquire L[o] for serial work; copy entry arguments under lock; concurrent work captures σ[o] snapshot |
| local step | Evaluate in ρ plus live serial σ or captured concurrent snapshot; update copied cells and emit source-provenanced observations |
| place write | Evaluate indexes, then the right side; read σ[o] or ρ at the root; check the indexes; write the root with one place replaced; `write` with `place` |
| suspend | Save continuation/ρ; remove serial lock; register wait timer, receive alternatives or pending request |
| computed duration | Evaluate e when the statement starts waiting, or for a state timer when the entry actions finish; v ≤ 0 or v unsafe is `DurationRange`; wait/timeout register expiry t + v with `durationNs`; a state timer registers expiry t_update + v with a `timer` observation |
| ready | Mark continuation ready; serial continuation must reacquire lock before reading current σ |
| offer | Resolve alias chain, select connection/member queue, copy payload, apply latest attribute replacement or policy overflow/delivery |
| request | Create unique pending R[r] with expiry t + requestTimeout; offer request; suspend caller |
| reply | Before expiry and while pending, set immutable succeeded/failed terminal, copy success result/out, ready caller |
| timeout | At expiry, pending becomes failed; ready failure continuation; tie beats reply |
| try success/failure | Return e value on success; on RuntimeFault evaluate fallback lazily with existing σ/Q effects retained |
| interrupt | Match active region; disarm/unwind protected continuation, cancel pending correlation as interrupted, retain activation/deadline/outer ρ and committed effects |
| state reaction | Select first enabled transition, exit/effect/update/entry, invalidate old timer generation; idle releases lock |
| completion | After entry or an internal reaction: the first enabled completion transition in order, then exit, effect, update, entry; a revisited state in a completion chain is a `CompletionLoop` violation |
| guarded timer | At expiry, a false guard consumes the timer generation for this entry (`discardTimer`) |
| internal reaction | Effect only; M (timer generations) unchanged |
| retain | A deferred member's message stays in Q, marked retained (`defer` once); it is consumed in offer-ordinal order on entering a handling state |
| sample | At the delivery event of a value whose offer is not older than the offer of the value S[p, m] holds, S[p, m] := value, with a `sample` observation; a read sees the updates ordered before it in the event order (time, phase, insertion ordinal), and one activation sees one value of a cell between two suspensions (WP6) |
| guarded dispatch | At the first execution step, before the arguments, evaluate the release guard. False (no argument is evaluated): cancel the deadline, release L[o], record `skip`, release `after` targets as on completion, and discard a receive entry's input (`discardInput`, `releaseGuard`). Failure: `failure` with the entry as source (the failing statement of a called operation), no successors (WP7) |
| complete | Finish activation and unlock; correlated reply is offered separately; successful whole completion releases after targets fresh |
| violation | Deadline, activation overflow, step/concurrent resource or clock failure stops the reference run and bypasses try |
| case script | A fresh package configuration adds one serial script activation after startup releases; direct primary-subject calls borrow its actual serial context, script emissions/requests/receives use actor ports, on call replies to the pending correlation, and script completion or failure stops the run |

At terminal correlation, later replies cannot change R. Inactive interrupt input is discarded observably. Receive statements preserve queued early input. A state's unhandled input leaves its entry time/timer generation intact. Set entry time at the state update, before entry actions. After entry completes, evaluate completion transitions, then select an already elapsed timer, then queued input (retained input first, in offer order); earliest expiry then declaration order determines competing timers. Deadline/timeout measurements include suspension and backlog; zero-cost interpreter steps do not supply physical cost evidence.

## 9.4 Projection and adequacy

A conforming reference trace records enough identity and order to reconstruct observable writes, messages, state changes, waits and terminals under its chosen assumptions, including the statement identity that caused each one. The initial configuration of a package target expands every top-level software occurrence and adds the package connection queues; a component target expands one top-level occurrence and adds none. A view is a pure identity selection function over D/O; Timing additionally projects a separately identified trace. No view transition changes C. A bounded run ending at a horizon retains live/open intervals. Source hashing belongs to hosts. Kernel/target refinement must preserve these observations or explicitly report unsupported semantics; syntax acceptance alone is insufficient.


---

<a id="chapter-14"></a>

# swa.ml 2.2 graphical notation

Original monochrome swa.ml notation uses thin rules, explicit labels and owned compartments. It does not claim OMG notation conformance. [The canonical catalog](GRAPHICAL_CATALOG.md) pairs every concept with context, source subject, drawing and constraints. [Worked diagrams](GRAPHICAL_EXAMPLES.md) retain source-backed model subjects. spec/notation.json covers every grammar/type family and every keyword, including a text-only rationale for lexical spelling.

Components show definition versus occurrence identity and indexed multiplicity. Private attributes stay in their component; operations show parameters/returns and nested ownership without closure captures. Schedule compartments show triggers, deadlines and concurrency separately from signatures. Do not draw performers or action allocations.

Port boundary squares expose direction per member: provides/requires attribute, event or operation. The square is a neutral container that may mix all three member kinds. Attribute/event arrows point outward for provides and inward for requires; a compact double arrow summarizes both directions only when both exist. A ball marks each provided operation and an open socket each required operation. Expanded labels preserve member names, kinds and signatures; these glyphs never assign a single kind or role to the whole port. Reversal flips every member arrow and swaps each operation ball/socket. Connection lines join opposite-compatible members and identify their effective policy; forwarding connects boundary to immediate child with the same member directions and is visibly labeled as a queue-free alias. Do not restore interface kinds, versions or whole-port roles.

Flow shows expressions/calls, decisions, loop forms, lazy try fallback, receive/wait suspension and armed interrupt transfer. States are inside an operation; transitions are nested/ordered and labeled by input/guard or after timer and target. State bodies have no separate executable identity. Final completion is distinguishable from idle reactions.

Platform Nodes own const attributes and child Nodes. Deployment edges refer to the separate placement declaration and preserve indexed occurrence identity. Requirement links are labeled «satisfy» and «verify» and show intent rather than proof. A Case view draws each case as an ellipse inside the boundary of its subject occurrence, labeled with the occurrence and its type, and each associated occurrence outside the boundary, labeled name: Type and joined to its cases by solid association lines. Use-case associations and interface-only test proxies use actor notation; active test collaborators retain component notation. A case without a subject has no boundary; a test is labeled «test». Sequence shows the subject, its parts and the associated occurrences as lifelines on real routes. Actor-port statements start on the interface-only actor whose port they use: send and publish are asynchronous arrows, calls are call arrows with dashed returns, on call answers with a dashed return, on … or after D is a timeout fragment and assert a check marker. Direct subject calls start on the source-backed case behavior context, named for the actual use case or test and marked accordingly; test-private reads and helper calls use that same test context. This context is not a component or the host runner. Local-like calls do not imply scheduled after successors. Flow shows a case script as a frame of its statements.

Browser remains navigation. General, Interconnect, Case, Sequence, Grid, Flow and Timing are imported view definitions. General Box in box/Tree preserve the same selected identities/topology. Timing declared mode shows schedules/deadlines/static waits; observed mode adds an identified run, lock gaps, message latency, terminals and open intervals. Missing evidence never becomes measured WCET. Geometry, collapse and routes stay in sidecars.

Regenerate with python scripts/build-notation.py and python scripts/build-graphical-examples.py, then run both with --check. SVG, PNG and scene JSON share the same original geometry. Current artifacts keep their established docs/notation/2.0 and docs/figures/2.0 paths so that existing links work; the directory names are not edition labels, and each drawing carries the current standard version. Historical publication assets remain untouched.


---

<a id="chapter-15"></a>

# swa.ml 2.3 canonical graphical catalog

Generated from spec/notation.json. Original monochrome notation; no OMG notation-conformance claim. Every drawing preserves source ownership and identity.

## Packages and imports

swa.ml 2.3; Hello::Demo.

![Packages and imports](notation/2.3/package.svg)

**Source:** [Hello::Demo](../examples/01-hello.swaml). **Grammar:** Model, Package, Import, QualifiedName.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Typed copied values

swa.ml 2.3; Values::Demo.

![Typed copied values](notation/2.3/values.svg)

**Source:** [Values::Demo](../examples/05-values-and-flow.swaml). **Grammar:** DataType, Field, EnumType, TypeRef, ValueType, RecordLiteral, FieldValue, ArrayLiteral.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Component definitions and usages

swa.ml 2.3; Reuse::Demo.

![Component definitions and usages](notation/2.3/components.svg)

**Source:** [Reuse::Demo](../examples/15-component-specialization.swaml). **Grammar:** ComponentDef, ComponentUsage, ComponentMember, Element.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Indexed occurrence identity

swa.ml 2.3; Multiplicity::Demo.

![Indexed occurrence identity](notation/2.3/multiplicity.svg)

**Source:** [Multiplicity::Demo](../examples/23-multiplicity.swaml).

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Attributes and lexical locals

swa.ml 2.3; Values::Demo.

![Attributes and lexical locals](notation/2.3/attributes.svg)

**Source:** [Values::Demo](../examples/05-values-and-flow.swaml). **Grammar:** Attribute, LocalVariable, Argument.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Mixed directed port members

swa.ml 2.3; Mixed::Boundary.

![Mixed directed port members](notation/2.3/ports.svg)

**Source:** [Mixed::Boundary](../examples/27-mixed-port.swaml). **Grammar:** PortDef, PortUsage, PortMember, MemberPath, Send.

One square boundary can contain attribute, event and operation members together. Arrowheads show data/event direction; an outward arrow means provides and inward means requires. A ball marks a provided operation; an open socket marks a required operation. These are member glyphs, not port types. A compact double arrow summarizes opposite data/event directions only; expanded labels retain each member name and type. Reversed flips every direction, arrow and operation glyph; geometry never adds members or routes. A canonical source-backed projection; geometry is separate from semantics.

## Policy-bearing connection

swa.ml 2.3; Policies::Demo.

![Policy-bearing connection](notation/2.3/connection.svg)

**Source:** [Policies::Demo](../examples/10-reusable-qos.swaml). **Grammar:** Connect, QosPolicy, PolicySetting.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Queue-free boundary forwarding

swa.ml 2.3; Boundary::Demo.

![Queue-free boundary forwarding](notation/2.3/forwarding.svg)

**Source:** [Boundary::Demo](../examples/26-boundary-forwarding.swaml).

Preserve owned source and distinct definition/occurrence identities. Boundary alias adds no queue, policy or message. A canonical source-backed projection; geometry is separate from semantics.

## Operations and nested ownership

swa.ml 2.3; OperationUsage::Demo.

![Operations and nested ownership](notation/2.3/operations.svg)

**Source:** [OperationUsage::Demo](../examples/24-operation-usage.swaml). **Grammar:** Operation, OperationUsage, Executable, OperationBody.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Expression calls and copied out values

swa.ml 2.3; ClientServer::Client.

![Expression calls and copied out values](notation/2.3/calls.svg)

**Source:** [ClientServer::Client](../examples/07-client-server.swaml). **Grammar:** CallExpression, ExpressionStatement, Return.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Runtime failure and lazy fallback

swa.ml 2.3; ClientServer::Client.

![Runtime failure and lazy fallback](notation/2.3/try.svg)

**Source:** [ClientServer::Client](../examples/07-client-server.swaml). **Grammar:** TryExpression, Fail, Assert.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Statements and decisions

swa.ml 2.3; Values::Demo.

![Statements and decisions](notation/2.3/flow.svg)

**Source:** [Values::Demo](../examples/05-values-and-flow.swaml). **Grammar:** Block, Statement, Assign, If.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Loops and copied iteration

swa.ml 2.3; Loops::Demo.

![Loops and copied iteration](notation/2.3/loops.svg)

**Source:** [Loops::Demo](../examples/18-control-loops.swaml). **Grammar:** While, Until, For, ForUpdate, ForEach.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Schedule entry and successful chaining

swa.ml 2.3; Chaining::Demo.

![Schedule entry and successful chaining](notation/2.3/schedule.svg)

**Source:** [Chaining::Demo](../examples/25-function-completion.swaml). **Grammar:** Schedule, ScheduleEntry.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Suspending wait and receive

swa.ml 2.3; Receiving::Receiver.

![Suspending wait and receive](notation/2.3/receive.svg)

**Source:** [Receiving::Receiver](../examples/21-receive-and-try.swaml). **Grammar:** Wait, Receive, ReceiveBranch.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Armed interrupt and cancellation

swa.ml 2.3; Interrupts::Receiver.

![Armed interrupt and cancellation](notation/2.3/interrupt.svg)

**Source:** [Interrupts::Receiver](../examples/19-interruptible-function.swaml). **Grammar:** Interruptible.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Ordered state transitions

swa.ml 2.3; States::Demo.lamp.

![Ordered state transitions](notation/2.3/states.svg)

**Source:** [States::Demo.lamp](../examples/04-stateful-function.swaml). **Grammar:** State, StateAction, Transition.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Platform Nodes and placement

swa.ml 2.3; Placement::Demo.

![Platform Nodes and placement](notation/2.3/deployment.svg)

**Source:** [Placement::Demo](../examples/22-platform-deployment.swaml). **Grammar:** Deployment, Placement.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Requirements and package intent links

swa.ml 2.3; Traceability::Delivery.

![Requirements and package intent links](notation/2.3/requirements.svg)

**Source:** [Traceability::Delivery](../examples/16-requirements-and-views.swaml). **Grammar:** Requirement, Satisfaction, Verification.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Use cases, tests and associations

swa.ml 2.3; Cash Machine::Withdraw cash.

![Use cases, tests and associations](notation/2.3/cases.svg)

**Source:** [Cash Machine::Withdraw cash](../examples/28-use-cases.swaml). **Grammar:** Scenario, CaseKind, Association.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Executable case scripts

swa.ml 2.3; AtmTests::Bank refusal.

![Executable case scripts](notation/2.3/scripts.svg)

**Source:** [AtmTests::Bank refusal](../examples/29-executable-cases.swaml). **Grammar:** EndpointPath.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Seven library view definitions

swa.ml 2.3; Traceability::Demo.

![Seven library view definitions](notation/2.3/views.svg)

**Source:** [Traceability::Demo](../examples/16-requirements-and-views.swaml). **Grammar:** ViewDef, View, ViewSelection, FilterExpression, FilterOr, FilterAnd, FilterPrimary, FilterBinary, FilterNot, FilterComparison.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Declared and observed timing

swa.ml 2.3; Timing::Demo.sample.

![Declared and observed timing](notation/2.3/timing.svg)

**Source:** [Timing::Demo.sample](../examples/17-function-timing.swaml).

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Owned documentation and lexical notes

swa.ml 2.3; Traceability::Delivery.

![Owned documentation and lexical notes](notation/2.3/documentation.svg)

**Source:** [Traceability::Delivery](../examples/16-requirements-and-views.swaml). **Grammar:** Documentation, DOC_COMMENT.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Typed expressions and operators

swa.ml 2.3; Values::Demo.

![Typed expressions and operators](notation/2.3/expressions.svg)

**Source:** [Values::Demo](../examples/05-values-and-flow.swaml). **Grammar:** Expression, OrExpression, AndExpression, EqualityExpression, RelationalExpression, AdditiveExpression, MultiplicativeExpression, UnaryExpression, PrimaryExpression, BinaryExpression, ReferenceExpression, ValuePath, Literal, Numeric.

Preserve owned source and distinct definition/occurrence identities. Drawing is a projection; it does not add execution semantics. A canonical source-backed projection; geometry is separate from semantics.

## Lexical and path spelling

swa.ml 2.3; Hello::Demo.

![Lexical and path spelling](notation/2.3/lexical.svg)

**Source:** [Hello::Demo](../examples/01-hello.swaml). **Grammar:** Duration, Name, Path, WS, ID, UNRESTRICTED_NAME, NUMBER, INT, STRING, ML_COMMENT, SL_COMMENT.

Text-only spelling; show as a source caption without invented semantic nodes. Drawing is a projection; it does not add execution semantics. Lexical spelling has no independent graphical identity.


---

<a id="chapter-16"></a>

# swa.ml 2.3 worked diagrams

Generated from original scene geometry; source subjects remain authoritative.

## Directed ports and explicit connections

![Directed ports and explicit connections](figures/2.3/architecture.svg)

Source: [Control::Demo](../examples/02-realtime-controller.swaml).

## Forwarding preserves boundary direction

![Forwarding preserves boundary direction](figures/2.3/forwarding.svg)

Source: [Boundary::Demo](../examples/26-boundary-forwarding.swaml).

## Schedule and success chaining

![Schedule and success chaining](figures/2.3/schedule.svg)

Source: [Chaining::Demo](../examples/25-function-completion.swaml).

## Operation-owned ordered states

![Operation-owned ordered states](figures/2.3/states.svg)

Source: [States::Demo.lamp](../examples/04-stateful-function.swaml).

## Indexed placement on platform Nodes

![Indexed placement on platform Nodes](figures/2.3/deployment.svg)

Source: [Placement::Demo](../examples/22-platform-deployment.swaml).

## Declared contracts and observed intervals

![Declared contracts and observed intervals](figures/2.3/timing.svg)

Source: [Timing::Demo.sample](../examples/17-function-timing.swaml).


---

<a id="chapter-17"></a>

# swa.ml 2.2 reference simulation

The portable interpreter selects **swaml-reference/2.3** (the unreleased 2.3 candidate; 2.2 models run unchanged) and requires linked, validated source. All activation comes from ordinary source schedules/ports/routes, including authored test drivers. [Execution semantics](spec/06-execution-contract.md) is normative; this guide covers the reference host.

```sh
npm ci
npm run build
node out/src/cli/main.js --json examples/01-hello.swaml
node out/src/cli/main.js simulate --until-ns 10000000 examples/28-use-cases.swaml
node out/src/cli/main.js simulate --target Hello::Demo --options examples/simulation/01-hello.json examples/01-hello.swaml
node out/src/cli/simulate.js Hello::Demo examples/simulation/01-hello.json examples/01-hello.swaml
node out/src/cli/main.js test examples/29-executable-cases.swaml
node out/src/cli/main.js test --json --case 'AtmTests::Bank refusal' examples/29-executable-cases.swaml
node scripts/check-simulations.mjs
```

A run target is a package or one top-level component occurrence (ADR 0019). A package target such as 'Cash Machine' runs every top-level software occurrence of the package with its internal connections, the package connections between top-level ports and each occurrence's deployment. Platform roots, top-level occurrences that specialize Swaml::Platform::Node, only describe deployment targets and do not run. A component target such as Hello::Demo runs that top-level occurrence alone: its package connections are absent and its top-level ports are open, so emissions find no route and requests fail as unavailable. swaml simulate takes --target Package or --target Package::component and defaults to the package when the supplied sources declare exactly one; it needs either --options file.json or --until-ns N. The positional swaml-simulate host takes the same targets. The core exports runTargets and runTarget for hosts that list or resolve targets.

Options include required untilNs and optional maxSteps (100000), maxPending (1024), maxConcurrent (64), latencyNs (0) and explicit offer-indexed faults. Unknown options are rejected. A top-level occurrence has at most one deployment (SW2009), and every run applies it to that occurrence's tree; there is no deployment selection option. faults contains an offer number, kind drop/duplicate/transport and optional delayNs. Faults operate on real routed source emissions/requests, never destination injection. The deterministic backend chooses insertion order for unordered queues and records its delivery assumptions.

Serial wait/request/receive suspensions release the component lock; resumption reads live state. Concurrent activations retain a dispatch snapshot and cannot write. Default connection policy is atMostOnce/fifo/16/reject/requestTimeout 1s. Attribute queues keep latest values independently. try catches runtime expression failures with lazy fallback and retained effects; deadlines/resources/interrupts bypass it. Requests retain route correlation, timeout wins ties and late replies are suppressed. After edges release fresh work after successful whole completion/unlock.

The JSON result records profile, target (kind package or component and its identity), options, logical trace ordinals/identities, sources, final occurrence stores, state machines and placements. Store and deployment keys are occurrence paths that begin with the top-level occurrence name, such as atm or Demo.receiver. Route identities are occurrence-relative: Demo.@connect0 inside a component, and the connection name or @packageN for the Nth package connection. CLI adds SHA-256 source digests. Status is quiescent, horizon, violation, limit, or stopped for a case run that ended with its script; a case run whose script still waits with no event left is quiescent. Failure observations remain evidence even when a caller catches them. Horizon retains live/open intervals. An event left pending without possible progress may be quiescent; that is not proof of useful behavior.

## Statement sources

Trace events carry source, the statementIdentity of the statement or schedule entry that caused them: write, publish, send, assert, failure, caught, arm, wait, receiveWait and requestWait name the executing statement; release and dispatch name the schedule entry; state names the entered state. Message lifecycle events name the statement that emitted or requested the message: offer, deliver, replaceAttribute, overflow, drop, retry, discardAge, discardInput and interrupt (which also records the armed interruptible statement as region) name the emitting send or publish or the requesting call; request, reply, timeout, lateReply and cancelRequest name the requesting call. A loop condition belongs to its loop statement on every iteration. In a state machine, the wait for a transition belongs to the state, and a guard and its failure to the transition. Offers record the leaf ports as sourcePort and targetPort, deliveries as targetPort. An assert event records passed; a failed assert also produces a failure.

A statement identity is the identity of its executable, a slash and a statement path, for example Hello::Sender.emit/0 or Banking::ATM.serve/2/then/0. The executable identity is the declaring operation, or a case, with decoded names; an operation usage that inherits its body names the definition. The path walks the abstract syntax from the executable's body: a statement contributes its index in the enclosing statement list and every other step its slot name, followed by an index for list slots: then, otherwise, body, branches/N, timeoutBody, handler, initializer, update, states/N, actions/N, transitions/N and effect. A state is itself identified as Executable/states/N and a transition, with its guard, as Executable/states/N/transitions/M. A schedule entry is the component identity followed by /schedule/N. resolveStatement maps an identity back to its node, trying the longest declared owner first because a quoted name may contain a slash. Legal names can therefore make it ambiguous: an operation 'run/0/then' with statement 0 and an operation run with statement path 0/then/0 both yield Pkg::Def.run/0/then/0, and resolveStatement selects the longer owner. Avoid such names when trace sources must be unambiguous. Identities follow source structure, so reordering statements changes them. Preserve available subject and activation fields; these often distinguish occurrences but cannot distinguish every borrowed-call failure or repeated invocation. Do not copy a shared declaration's facts to every instance, or claim that an individual read, short-circuited subexpression or return was observed when the trace provides no such observation.

The examples' expected final stores and placements are checked independently, every use case and test of the examples runs with its expected result (examples/simulation/cases.json), and deterministic reruns check reproducibility. The current [2.2 hello trace](../examples/simulation/2.2/hello-trace.json) uses the selected 2.2 profile; the [published 2.1 trace](../examples/simulation/hello-trace.json) stays frozen. Tests cover package and isolated component runs, adversarial requests, interruptions, failure effects and resource limits. Physical CPU/WCET, production transport/retry protocols, target scheduling and universal analysis remain outside this logical interpreter. Exporting a trace does not establish those claims.

Outcome failure-observed includes caught expression failures as well as failed activations; status separately records whether execution reached quiescence, a horizon or a resource/contract stop. The CLI returns 1 when a failure was observed, including a successfully handled fallback, so automation must inspect the trace and final stores when exercising expected failure scenarios.

## Use cases and tests

A use case or test with statements is a script ([behavior](spec/03-behavior.md), [case runs](spec/06-execution-contract.md)). swaml test runs the cases of the supplied sources:

```text
swaml test [--language-version 2.3] [--package P] [--case Package::Case|Case] [--json] [--options options.json | --until-ns N] file.swaml [more files...]
```

Each case with statements runs in its own fresh run of its package. The default horizon is 10 s of logical time (untilNs 10000000000); the run stops earlier when the script completes or fails. The script is one serial activation released at 0 ns after every on start entry. Both case kinds may call operations of the exact primary subject, including its own port communication, receive and wait behavior; the actual frame uses the subject's context, releases its lock while suspended and restores the caller context on return or failure. This remains a local call, with no new schedule release or implicit transport timeout. The script also acts at the ports of its associated interface-only occurrences. Input that reaches an actor port before the script waits for it is retained under the connection's policy and attributes keep their latest value. A request to an actor port waits until an on call branch answers it or the caller's request times out; a later branch in the same case cannot run while blocked in a synchronous subject call. A test additionally reads private attributes and calls eligible helpers of explicitly associated same-package roots and single parts. Those extra helper calls cannot communicate or suspend. Associations do not create occurrences or alter the whole-package run.

Results are pass, fail, inconclusive and no checks. The first failure in trace order decides a failed case, with its statement identity and time: the script's own (a failed assert reports Assertion and the assert source, fail reports its message, a runtime failure its code), an uncaught failure of another activation (run-failure, with the failing activation as observed), or a contract violation (violation). An earlier run failure, such as a request timeout of the subject at 1 s, therefore wins over a later fail of the script. A case is inconclusive when the run ends before the script completes without a failure: at the horizon (horizon), at the step limit (limit), or because the script waits but no further event can occur (stalled); a stalled case run has status quiescent, since nothing remains that could reach the script, while ordinary runs keep horizon for waiting activations so that their intervals stay open. A case without statements has no checks. Caught failures stay evidence without failing a case: a passing case can carry run.outcome failure-observed, with caught events in its trace, when a try fallback handled a failure, so consumers read result rather than outcome. The summary prints one line per case and a count; --json prints languageVersion, profile, options, summary and cases with case, kind, subject, result, reason, message, source, timeNs and the run (target, status, trace and stores, without source text), plus implementation identity and source digests. The exit code is 1 when a case fails or the sources are invalid, 2 for usage errors and 0 otherwise.

The core exports runCase(models, 'Package::Case', options), runTests(models, options, { package, case }) and workspaceCases(models), returning CaseResult values, and caseTarget from semantic, which resolves a script path to an actor port member, a white-box operation or an attribute. Script trace events name the case identity as subject, for example AtmTests::Bank refusal, and carry case statement identities such as AtmTests::Bank refusal/2/branches/0/body/0 as source; failure events also record the message of fail and of a failed case assert. A package run, without a case, leaves interface-only occurrences idle.


---

<a id="chapter-18"></a>

# Architecture patterns

swa.ml 2.2.

Start each pattern from owned component state and explicit typed boundary members. Components may be leaves or composites and both may own operations. A composite forwards a port to an immediate child with same-direction connect; peer connections use opposite-compatible directions and own queues.

A pipeline sends latest attributes when freshness matters and publishes events when every occurrence matters. [The controller model](../examples/02-realtime-controller.swaml) samples temperature, computes power and publishes an actuator command. Each receiver owns its input once; no private data is read through a sibling path.

A service uses required/provided operation members, on call schedule bindings and a policy request timeout. try supplies a lazy fallback. Suspension unlocks the caller; recheck live state before committing a decision. [Service model](../examples/07-client-server.swaml).

Publish/subscribe fanout uses event-only required ports and several explicit connections. Each connection occurrence has an independent policy queue; partial fanout may commit before a failed offer. Adding an attribute or operation requirement changes cardinality to exactly one peer.

Reusable components use single specializes inheritance and explicit compatible whole-member redefines. Usage bodies configure per-occurrence const/attribute values without sharing stores. [Reuse](../examples/15-component-specialization.swaml) and [multiplicity](../examples/23-multiplicity.swaml).

Classic, Adaptive, web and cloud example filenames illustrate these software patterns. They do not claim generated RTE/task, middleware, broker, infrastructure or production timing bindings. [Deployment](../examples/22-platform-deployment.swaml) places software on platform Node occurrences; target translation is separate.


---

<a id="chapter-19"></a>

# Requirements, documentation and intent

swa.ml 2.2.

A requirement owns immutable typed attributes and at most one formal doc. Use `/** ... */` first in a body or immediately before the semicolon of a leaf declaration. Ordinary `//` and `/* ... */` comments remain separate lexical annotations. Formal documentation is owned source, not an executable statement or proof.

satisfy Requirement by design; links intent from a component definition or occurrence path declared in the same package. verify Requirement by Test; links a test of the package; a use case never verifies. Use cases describe an intended interaction without asserting verification. A use case or test is a package member; of names its subject, a top-level occurrence of the same package, and associate Occurrence to Case; names the other occurrences that take part. A case without of or without statements records intent only; a case with statements is a script that swaml test runs.

Subjects, associations and design paths must resolve in the package. Cases do not create channels or inject events at a destination; a case script emits only through the ports of its associated interface-only actors. A passing script is an identified witness execution of one deterministic run; it does not prove realization in every execution. A requirement needs associated test/analysis/review evidence before fulfillment can be claimed.

[The complete traceability model](../examples/16-requirements-and-views.swaml) contains a documented requirement, satisfaction, a test with its verify link and selected views. General/Grid can inspect intent relations; Case/Sequence present cases. All preserve occurrence identity and retain unproven status where evidence is absent.


---

<a id="chapter-20"></a>

# Ontology and views

swa.ml 2.2.

The semantic families are package, nominal values/types, component definition/usage, attribute/local/parameter, port/member, operation definition/declaration/usage, schedule/entry, connection/forwarding, state/transition, deployment, requirement, case and view. A nested operation has no closure capture; an operation body has no independent executable identity. An indexed occurrence is distinct from its shared definition.

Browser navigates ownership. Seven imported library definitions provide source views: General, Interconnect, Case, Sequence, Grid, Flow and Timing. General and Grid can select named model identities; Interconnect selects components; Case selects packages, cases and components; Sequence also selects operations; Flow/Timing select operations, use cases and tests. General Box in box and Tree retain the same selected graph. Flow contains statements, loops, receive/interrupt regions and states.

Compact of selects one subject. Include/recursive/where selects a stable union with Boolean name/kind/path predicates. Structural/executable kinds are component and operation. Filters do not call behavior. Timing declared mode shows schedules/deadlines/static waits; observed mode requires a run identity and preserves open intervals. Geometry/routing/camera live in sidecars. See [normative view rules](spec/04-systems-and-conformance.md) and [traceability example](../examples/16-requirements-and-views.swaml).


---

<a id="chapter-21"></a>

# swa.ml 2.3 keyword reference

Generated from spec/keywords.json and the normative grammar. Examples here are grammar fragments; complete runnable models are in the usage guide and examples. 20 contextual words remain legal names outside their positions. call appears in the on call schedule trigger and in on call branches of case scripts.

[after](#keyword-after) · [and](#keyword-and) · [assert](#keyword-assert) · [associate](#keyword-associate) · [attribute](#keyword-attribute) · [bool](#keyword-bool) · [by](#keyword-by) · [byte](#keyword-byte) · [call](#keyword-call) · [case](#keyword-case) · [component](#keyword-component) · [concurrent](#keyword-concurrent) · [connect](#keyword-connect) · [const](#keyword-const) · [datatype](#keyword-datatype) · [deadline](#keyword-deadline) · [def](#keyword-def) · [defer](#keyword-defer) · [deploy](#keyword-deploy) · [deployment](#keyword-deployment) · [else](#keyword-else) · [entry](#keyword-entry) · [enum](#keyword-enum) · [event](#keyword-event) · [every](#keyword-every) · [exit](#keyword-exit) · [fail](#keyword-fail) · [false](#keyword-false) · [final](#keyword-final) · [for](#keyword-for) · [idempotent](#keyword-idempotent) · [if](#keyword-if) · [import](#keyword-import) · [in](#keyword-in) · [include](#keyword-include) · [initial](#keyword-initial) · [int](#keyword-int) · [interruptible](#keyword-interruptible) · [kind](#keyword-kind) · [ms](#keyword-ms) · [name](#keyword-name) · [not](#keyword-not) · [ns](#keyword-ns) · [of](#keyword-of) · [on](#keyword-on) · [operation](#keyword-operation) · [optional](#keyword-optional) · [or](#keyword-or) · [out](#keyword-out) · [package](#keyword-package) · [path](#keyword-path) · [port](#keyword-port) · [provides](#keyword-provides) · [publish](#keyword-publish) · [qos](#keyword-qos) · [real](#keyword-real) · [receive](#keyword-receive) · [record](#keyword-record) · [recursive](#keyword-recursive) · [redefines](#keyword-redefines) · [requirement](#keyword-requirement) · [requires](#keyword-requires) · [return](#keyword-return) · [returns](#keyword-returns) · [reversed](#keyword-reversed) · [s](#keyword-s) · [satisfy](#keyword-satisfy) · [schedule](#keyword-schedule) · [send](#keyword-send) · [specializes](#keyword-specializes) · [start](#keyword-start) · [state](#keyword-state) · [string](#keyword-string) · [test](#keyword-test) · [times](#keyword-times) · [to](#keyword-to) · [true](#keyword-true) · [try](#keyword-try) · [uint](#keyword-uint) · [until](#keyword-until) · [us](#keyword-us) · [use](#keyword-use) · [var](#keyword-var) · [verify](#keyword-verify) · [view](#keyword-view) · [void](#keyword-void) · [wait](#keyword-wait) · [when](#keyword-when) · [where](#keyword-where) · [while](#keyword-while)

## Keyword: after

Introduces a state timer, receive timeout or success schedule dependency.

**Context:** Ordered state transitions. **Grammar:** ScheduleEntry, Receive, Transition. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: and

Used in typed expressions and operators; see its grammar contexts and normative constraints.

**Context:** Typed expressions and operators. **Grammar:** FilterAnd, Expression, AndExpression. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: assert

Used in runtime failure and lazy fallback; see its grammar contexts and normative constraints.

**Context:** Runtime failure and lazy fallback. **Grammar:** Assert. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: associate

Records that a top-level occurrence of the package takes part in a use case or test other than as its subject.

**Context:** Use cases, tests and associations. **Grammar:** Association, Name. **Name use:** contextual.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: attribute

Declares typed occurrence state or an immutable requirement value.

**Context:** Attributes and lexical locals. **Grammar:** Attribute, PortMember. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: bool

Used in typed copied values; see its grammar contexts and normative constraints.

**Context:** Typed copied values. **Grammar:** TypeRef. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: by

Names the design that a satisfy claim refers to, or the test that a verify claim refers to.

**Context:** Requirements and package intent links. **Grammar:** Satisfaction, Verification, Name. **Name use:** contextual.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: byte

Used in typed copied values; see its grammar contexts and normative constraints.

**Context:** Typed copied values. **Grammar:** TypeRef. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: call

Serves a provided operation as an on call schedule trigger, or answers a request at an actor port as an on call branch of a case script.

**Context:** Schedule entry and successful chaining. **Grammar:** ScheduleEntry, ReceiveBranch. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: case

Completes the use case keyword pair use case.

**Context:** Use cases, tests and associations. **Grammar:** CaseKind, Name. **Name use:** contextual.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: component

Declares a reusable definition or a distinct owned occurrence.

**Context:** Component definitions and usages. **Grammar:** ComponentDef, ComponentUsage. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: concurrent

Permits overlapping non-writing snapshot activations.

**Context:** Schedule entry and successful chaining. **Grammar:** ScheduleEntry. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: connect

Joins compatible ports; boundary-to-child derives forwarding.

**Context:** Policy-bearing connection. **Grammar:** Connect. **Name use:** reserved.

[Normative rule](spec/02-communication.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: const

Makes an attribute immutable for its occurrence.

**Context:** Attributes and lexical locals. **Grammar:** Attribute. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: datatype

Used in typed copied values; see its grammar contexts and normative constraints.

**Context:** Typed copied values. **Grammar:** DataType. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: deadline

Used in schedule entry and successful chaining; see its grammar contexts and normative constraints.

**Context:** Schedule entry and successful chaining. **Grammar:** ScheduleEntry. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: def

Used in component definitions and usages; see its grammar contexts and normative constraints.

**Context:** Component definitions and usages. **Grammar:** ComponentDef, PortDef, QosPolicy, Operation, ViewDef. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: defer

Used in ordered state transitions; see its grammar contexts and normative constraints.

**Context:** Ordered state transitions. **Grammar:** Deferral, Name. **Name use:** contextual.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: deploy

Used in platform nodes and placement; see its grammar contexts and normative constraints.

**Context:** Platform Nodes and placement. **Grammar:** Placement. **Name use:** reserved.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: deployment

Places software root occurrences on platform Node occurrences.

**Context:** Platform Nodes and placement. **Grammar:** Deployment. **Name use:** reserved.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: else

Used in statements and decisions; see its grammar contexts and normative constraints.

**Context:** Statements and decisions. **Grammar:** If, ConditionalExpression. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: entry

Used in ordered state transitions; see its grammar contexts and normative constraints.

**Context:** Ordered state transitions. **Grammar:** StateAction. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: enum

Used in typed copied values; see its grammar contexts and normative constraints.

**Context:** Typed copied values. **Grammar:** EnumType. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: event

Used in directed port members; see its grammar contexts and normative constraints.

**Context:** Directed port members. **Grammar:** PortMember. **Name use:** reserved.

[Normative rule](spec/02-communication.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: every

Used in schedule entry and successful chaining; see its grammar contexts and normative constraints.

**Context:** Schedule entry and successful chaining. **Grammar:** ScheduleEntry. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: exit

Used in ordered state transitions; see its grammar contexts and normative constraints.

**Context:** Ordered state transitions. **Grammar:** StateAction. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: fail

Used in runtime failure and lazy fallback; see its grammar contexts and normative constraints.

**Context:** Runtime failure and lazy fallback. **Grammar:** Fail. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: false

Used in typed expressions and operators; see its grammar contexts and normative constraints.

**Context:** Typed expressions and operators. **Grammar:** Literal. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: final

Used in ordered state transitions; see its grammar contexts and normative constraints.

**Context:** Ordered state transitions. **Grammar:** State. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: for

Used in loops and copied iteration; see its grammar contexts and normative constraints.

**Context:** Loops and copied iteration. **Grammar:** For, ForEach. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: idempotent

Used in directed port members; see its grammar contexts and normative constraints.

**Context:** Directed port members. **Grammar:** PortMember. **Name use:** reserved.

[Normative rule](spec/02-communication.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: if

Used in statements and decisions; see its grammar contexts and normative constraints.

**Context:** Statements and decisions. **Grammar:** If, ConditionalExpression. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: import

Used in packages and imports; see its grammar contexts and normative constraints.

**Context:** Packages and imports. **Grammar:** Import. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: in

Used in attributes and lexical locals; see its grammar contexts and normative constraints.

**Context:** Attributes and lexical locals. **Grammar:** Argument, ForEach, Name. **Name use:** contextual.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: include

Adds a subject selection to a view.

**Context:** Seven library view definitions. **Grammar:** ViewSelection. **Name use:** reserved.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: initial

Used in ordered state transitions; see its grammar contexts and normative constraints.

**Context:** Ordered state transitions. **Grammar:** OperationBody. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: int

Used in typed copied values; see its grammar contexts and normative constraints.

**Context:** Typed copied values. **Grammar:** TypeRef. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: interruptible

Used in armed interrupt and cancellation; see its grammar contexts and normative constraints.

**Context:** Armed interrupt and cancellation. **Grammar:** Interruptible. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: kind

Used in seven library view definitions; see its grammar contexts and normative constraints.

**Context:** Seven library view definitions. **Grammar:** FilterComparison, Name. **Name use:** contextual.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: ms

Used in lexical and path spelling; see its grammar contexts and normative constraints.

**Context:** Lexical and path spelling. **Grammar:** Duration, Name. **Name use:** contextual.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: name

Used in seven library view definitions; see its grammar contexts and normative constraints.

**Context:** Seven library view definitions. **Grammar:** FilterComparison, Name. **Name use:** contextual.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: not

Used in typed expressions and operators; see its grammar contexts and normative constraints.

**Context:** Typed expressions and operators. **Grammar:** FilterPrimary, UnaryExpression. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: ns

Used in lexical and path spelling; see its grammar contexts and normative constraints.

**Context:** Lexical and path spelling. **Grammar:** Duration, Name. **Name use:** contextual.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: of

Used in use cases, tests and associations; see its grammar contexts and normative constraints.

**Context:** Use cases, tests and associations. **Grammar:** Deployment, Scenario, View. **Name use:** reserved.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: on

Used in ordered state transitions; see its grammar contexts and normative constraints.

**Context:** Ordered state transitions. **Grammar:** ScheduleEntry, Receive, Interruptible, StateAction, Transition, Deployment, Placement. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: operation

Declares executable behavior; def supplies a reusable signature/body.

**Context:** Operations and nested ownership. **Grammar:** PortMember, Operation, OperationUsage. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: optional

Used in directed port members; see its grammar contexts and normative constraints.

**Context:** Directed port members. **Grammar:** PortUsage. **Name use:** reserved.

[Normative rule](spec/02-communication.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: or

Used in suspending wait and receive; see its grammar contexts and normative constraints.

**Context:** Suspending wait and receive. **Grammar:** Receive, FilterOr, Expression, OrExpression. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: out

Used in attributes and lexical locals; see its grammar contexts and normative constraints.

**Context:** Attributes and lexical locals. **Grammar:** Argument, Name. **Name use:** contextual.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: package

Used in packages and imports; see its grammar contexts and normative constraints.

**Context:** Packages and imports. **Grammar:** Package. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: path

Used in seven library view definitions; see its grammar contexts and normative constraints.

**Context:** Seven library view definitions. **Grammar:** FilterComparison, Name. **Name use:** contextual.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: port

Used in directed port members; see its grammar contexts and normative constraints.

**Context:** Directed port members. **Grammar:** PortDef, PortUsage. **Name use:** reserved.

[Normative rule](spec/02-communication.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: provides

Offers an attribute/event or implements an operation member.

**Context:** Directed port members. **Grammar:** PortMember. **Name use:** reserved.

[Normative rule](spec/02-communication.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: publish

Used in directed port members; see its grammar contexts and normative constraints.

**Context:** Directed port members. **Grammar:** Send. **Name use:** reserved.

[Normative rule](spec/02-communication.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: qos

Used in policy-bearing connection; see its grammar contexts and normative constraints.

**Context:** Policy-bearing connection. **Grammar:** QosPolicy. **Name use:** reserved.

[Normative rule](spec/02-communication.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: real

Used in typed copied values; see its grammar contexts and normative constraints.

**Context:** Typed copied values. **Grammar:** TypeRef. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: receive

Used in suspending wait and receive; see its grammar contexts and normative constraints.

**Context:** Suspending wait and receive. **Grammar:** ScheduleEntry, ReceiveBranch, Interruptible, Transition. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: record

Used in typed copied values; see its grammar contexts and normative constraints.

**Context:** Typed copied values. **Grammar:** RecordLiteral. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: recursive

Used in seven library view definitions; see its grammar contexts and normative constraints.

**Context:** Seven library view definitions. **Grammar:** ViewSelection. **Name use:** reserved.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: redefines

Used in component definitions and usages; see its grammar contexts and normative constraints.

**Context:** Component definitions and usages. **Grammar:** ComponentUsage, Attribute, PortUsage, Connect, Operation, OperationUsage. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: requirement

Used in requirements and package intent links; see its grammar contexts and normative constraints.

**Context:** Requirements and package intent links. **Grammar:** Requirement. **Name use:** reserved.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: requires

Receives an attribute/event or requests an operation member.

**Context:** Directed port members. **Grammar:** PortMember. **Name use:** reserved.

[Normative rule](spec/02-communication.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: return

Used in expression calls and copied out values; see its grammar contexts and normative constraints.

**Context:** Expression calls and copied out values. **Grammar:** Return. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: returns

Declares the result type; omitted result is void.

**Context:** Operations and nested ownership. **Grammar:** PortMember, Operation. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: reversed

Flips each direction of a port usage.

**Context:** Directed port members. **Grammar:** PortUsage, Name. **Name use:** contextual.

[Normative rule](spec/02-communication.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: s

Used in lexical and path spelling; see its grammar contexts and normative constraints.

**Context:** Lexical and path spelling. **Grammar:** Duration, Name. **Name use:** contextual.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: satisfy

Records the intent that a component definition or occurrence path declared in the package satisfies a requirement.

**Context:** Requirements and package intent links. **Grammar:** Satisfaction. **Name use:** reserved.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: schedule

Owns trigger-to-operation bindings.

**Context:** Schedule entry and successful chaining. **Grammar:** Schedule. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: send

Used in directed port members; see its grammar contexts and normative constraints.

**Context:** Directed port members. **Grammar:** Send. **Name use:** reserved.

[Normative rule](spec/02-communication.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: specializes

Used in component definitions and usages; see its grammar contexts and normative constraints.

**Context:** Component definitions and usages. **Grammar:** ComponentDef. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: start

Used in schedule entry and successful chaining; see its grammar contexts and normative constraints.

**Context:** Schedule entry and successful chaining. **Grammar:** ScheduleEntry. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: state

Used in ordered state transitions; see its grammar contexts and normative constraints.

**Context:** Ordered state transitions. **Grammar:** State, Name. **Name use:** contextual.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: string

Used in typed copied values; see its grammar contexts and normative constraints.

**Context:** Typed copied values. **Grammar:** TypeRef. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: test

Declares a test: a package member that may name a top-level subject occurrence with of and is the target of verify links.

**Context:** Use cases, tests and associations. **Grammar:** CaseKind, Name. **Name use:** contextual.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: times

Introduces a once-evaluated uint loop limit.

**Context:** Loops and copied iteration. **Grammar:** While, Until, Name. **Name use:** contextual.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: to

Introduces a state transition target or the case of an associate link.

**Context:** Ordered state transitions. **Grammar:** Transition, Association, Name. **Name use:** contextual.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: true

Used in typed expressions and operators; see its grammar contexts and normative constraints.

**Context:** Typed expressions and operators. **Grammar:** Literal. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: try

Catches runtime expression failures with a lazy compatible fallback.

**Context:** Runtime failure and lazy fallback. **Grammar:** TryExpression. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: uint

Used in typed copied values; see its grammar contexts and normative constraints.

**Context:** Typed copied values. **Grammar:** TypeRef. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: until

Runs body then tests the stopping condition.

**Context:** Loops and copied iteration. **Grammar:** Until. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: us

Used in lexical and path spelling; see its grammar contexts and normative constraints.

**Context:** Lexical and path spelling. **Grammar:** Duration, Name. **Name use:** contextual.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: use

Starts the use case keyword pair use case: a package member that names a top-level occurrence of its package as subject with of.

**Context:** Use cases, tests and associations. **Grammar:** CaseKind, Name. **Name use:** contextual.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: var

Used in attributes and lexical locals; see its grammar contexts and normative constraints.

**Context:** Attributes and lexical locals. **Grammar:** LocalVariable. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: verify

Records the intent that a test of the package verifies a requirement; many-to-many.

**Context:** Requirements and package intent links. **Grammar:** Verification. **Name use:** reserved.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: view

Used in seven library view definitions; see its grammar contexts and normative constraints.

**Context:** Seven library view definitions. **Grammar:** ViewDef, View, Name. **Name use:** contextual.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: void

Used in typed copied values; see its grammar contexts and normative constraints.

**Context:** Typed copied values. **Grammar:** TypeRef. **Name use:** reserved.

[Normative rule](spec/01-structure-and-types.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: wait

Suspends for a duration and releases the serial lock.

**Context:** Suspending wait and receive. **Grammar:** Wait. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: when

Guards a receive, timer or completion transition, or (from 2.3) the release of an every, receive or after schedule entry (WP7-S01).

**Context:** Ordered state transitions. **Grammar:** ScheduleEntry, Transition. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: where

Used in seven library view definitions; see its grammar contexts and normative constraints.

**Context:** Seven library view definitions. **Grammar:** ViewSelection. **Name use:** reserved.

[Normative rule](spec/04-systems-and-conformance.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Keyword: while

Used in loops and copied iteration; see its grammar contexts and normative constraints.

**Context:** Loops and copied iteration. **Grammar:** While. **Name use:** reserved.

[Normative rule](spec/03-behavior.md) · [Graphical catalog](GRAPHICAL_CATALOG.md).

## Symbols and precedence

Colon means typed by; returns names results. Dot is containment/member access; :: qualifies packages. Brackets express fixed extents, multiplicity or indexing. Parentheses group conditions/arguments and connector endpoints. There are no source arrows. Operators in ascending precedence are or, and, equality, numeric comparison, addition/subtraction, multiplication/division/remainder and unary not/minus. Only and/or short-circuit. Formal docs use /** */; ordinary comments remain lexical.


---

<a id="chapter-22"></a>

# swa.ml 2.3 candidate implementation status

**Standard:** 2.3 (unreleased candidate) · **Implementation package:** 4.0.0 · **Selected host semantics:** 2.3 · **Reference profile:** swaml-reference/2.3. The candidate is allocated and work package WP1 has landed: assignment to places such as `statuses[i].confirmed = true;` and `r.f = v;` (indexes, then the right side, then one read-modify-write of the root; `Bounds` leaves the root unchanged; `write` observations gain `place`), member access after an index such as `recent[i].vehicleId`, and literal component indexes in test inspection paths such as `backend.twins[0].link` and `backend.twins[0].currentView()`. Work package WP2 has landed: the whole-expression conditional `if (c) a else b` (typed by the common type of its branches, never a statement, no suspension inside, only the selected branch evaluated), `view`, `state`, `in` and `out` as contextual words in every name position (edition-aware name services write them unquoted for a 2.3 workspace and quoted for 2.2) and association lists `associate a, b to 'X', 'Y';` (one link per pair, a repeated pair is SW2010). Work package WP3 has landed: the library packages `Swaml::Numeric` (`minInt`, `maxInt`, `clampInt`, `clamp`, and `sqrt` as a correctly rounded host intrinsic), `Swaml::Text` (`intText`, `realText` with ties away from zero, no exponent and no negative zero, `boolText`) and `Swaml::Time` (`now()`, the live logical time in nanoseconds, which reads state, is rejected in initializers and is never a stale read), in the separate built-in document `libraries/swaml-2.3.swaml`; a workspace that declares its own package of one of these names uses it and the library package is hidden there, so 2.2 sources keep their meaning. Work package WP4 has landed: a duration literal is a `uint` value in nanoseconds; `wait (e);`, `or after (e)`, state timers `after (e)` (evaluated when the entry actions finish), `on every (e)` and `deadline (e)` take computed durations; a value that is not a positive representable duration is the catchable runtime failure `DurationRange`; periods and deadlines use the constant sublanguage, evaluated per expanded occurrence (redefined const attributes included) by one evaluator, `constantValue`, with exact integral division and trigger identity by canonical text; `PolicySetting` has the single form `name = Expression;`; computed waits and timeouts record `durationNs` and computed state timers a `timer` observation; SW2016 warns on a computed duration without a unit. Otherwise the host accepts exactly the 2.2 language, and the three [compatibility gates](RELEASE_2_3.md#compatibility-gates) compare every corpus AST and every recorded run, case and trace with fixtures recorded from implementation 3.1.0. The published [2.2 reference](SWAML-2.2-Reference.md) and [PDF](../output/pdf/SWAML-2.2-Specification.pdf) record the 2.2 release sources. The published 2.1 [reference book](SWAML-2.1-Reference.md) and [complete PDF](../output/pdf/SWAML-2.1-Specification.pdf), manifest and checksum remain frozen. The strict current-source [publication gate](PDF_PUBLICATION.md) checks the new edition independently of historical publications. Work package WP5 has landed: completion transitions, guarded timers, internal transitions and deferral in states (ADR 0023), with `defer` as a contextual word. Work package WP6 has landed: sampled reads of required attributes that declare initial values and per-member connection policies (ADR 0024). Work package WP7 has landed: release guards `when (g)` on `every`, `receive` and `after` schedule entries (ADR 0025), evaluated at dispatch; a false guard is a `skip` that cancels the deadline and counts as a completion for `after` successors, a skipped receive entry discards its input (`discardInput` reason `releaseGuard`), and the periodic grid is unchanged.

The 2.0 core replaced the 1.x grammar, AST, resolver, validator and interpreter; 2.1 adds the package context, executable use cases and tests, package links, run targets and statement identities of [ADR 0019](decisions/0019-package-context.md). It does not accept 1.x or 2.0 source; the [release notes](RELEASE_2_1.md) describe the migration. Published 1.x and 2.0.0 books, PDFs, manifests/checksums and historical figure files remain unchanged. [ADR 0016](decisions/0016-swaml-2-0.md) defines the restart; [conformance obligations](spec/08-conformance-obligations.md) separate syntax, validation, execution, analysis, kernel and graphical claims.

## Reference implementation

The 2.2 edition adds explicit test access to the subject and associated software occurrence roots and their single parts, using the existing grammar. Both case kinds may call their exact primary subject's operations normally, including its own port communication and waits, with actual context/lock restoration and local activation semantics. Use cases gain no private reads or direct part/peer calls; extra test-owner calls remain restricted helpers. Actor port and whole-package run rules remain unchanged. [ADR 0020](decisions/0020-associated-test-access.md) and [ADR 0021](decisions/0021-case-subject-calls.md) specify the boundaries. The [ten-component integration](../examples/30-associated-integration.swaml) exercises real routes and checks explicitly associated occurrences.

| Capability | Implemented evidence and boundary |
| --- | --- |
| Syntax and recovery | Normative Langium grammar, generated AST/TextMate, quoted names with naming hints for spaces, reserved words, double quotes, non-ASCII letters and misplaced docs, malformed input and retired-syntax rejection tests |
| Components and values | Single specialization, whole redefinition, usage bodies, typed roots, indexed multiplicity, private copied stores, nominal records/enums/arrays and checked domains; 2.3 (WP1): places with record field and array element selectors, rooted in mutable locals, out parameters (after definite assignment) and non-const attributes, evaluated indexes first, then the right side, then one read-modify-write under the serial lock with `Bounds` leaving the root unchanged and a `write.place` trace field; selector reads after an index; SW2011 treats a place write as a write of its root. Places are not out arguments; 2.3 (WP2): the whole-expression conditional with branch typing under scalar widening and only the selected branch evaluated, view, state, in and out as contextual names, and association lists by pair |
| Operations | Definitions/usages, explicit returns, nested no-capture scope, expression calls, in/out, success-only copy-back, definite out assignment and acyclic calls |
| Effects and failures | Transitive write/read/communication/suspension flags, pure initializers, read-only guards, non-writing concurrency, lazy try and allowed suspension placement |
| Ports and routes | Per-member direction/reversal, structural compatibility with variance and individual diagnostics, connection/forwarding, package connections between top-level occurrences, per-package closure, resolved cardinality and ownership/emission provenance with the interface-only exemption |
| Policies | Versioned complete typed QoS definitions, Default/Latest/Reliable/BestEffort, per-use idempotency; occurrence/direction/member queues and latest attributes |
| Schedule and runtime | Start/every/receive/call/after entries, inherited entry replacement, dispatch copying, deadlines, lock release/reacquisition, live serial reads and concurrent snapshots; 2.3 (WP4): computed periods and deadlines in the constant sublanguage, evaluated per expanded occurrence by `constantValue` (exact bigint arithmetic, exact integral division, positive safe values checked per occurrence), trigger identity by canonical expression text, per-occurrence Timing projection |
| Flow and state | Loops and copied iteration, wait/receive, interruption across callees, ordered nested transitions, final completion and queued startup input; 2.3 (WP4): duration literals as `uint` values, computed waits and receive timeouts evaluated when they start waiting (`durationNs`), computed state timers evaluated after the entry actions (`timer` observation), `DurationRange` caught by `try`, SW2016; 2.3 (WP5): completion transitions `when (g) to S` evaluated after entry and after every internal reaction, guarded timers with `discardTimer`, internal transitions without `to` that keep the timer epoch (`state` with `internal: true`), deferral with one `defer` observation per retained message and global offer-ordinal order of retained input, the contract violation `CompletionLoop`, SW2017 and SW2018 |
| Correlation and adverse behavior | Routed results/out values, failures, timeout ties, terminal cancellation, late-reply suppression, policy overflow, age at eligibility and explicit resource limits |
| Deployment | Separate software/platform roots, Node-only contents/targets, indexed/family placements and most-specific selection |
| Requirements/cases/views | Immutable intent; package-owned use case/test with an optional subject that is a top-level occurrence of the same package; case scripts with the environment role of associated interface-only actors, on call replies, normal primary-subject operation calls in both case kinds and tests' private reads/helper calls (SW2010/SW2004/SW2005/SW2006); intent-only cases without statements; package associate, satisfy … by and verify … by links with SW2010 rules; seven library definitions, package/member subjects and stable occurrence unions |
| AI authoring | Usage and AI guides, portable author/validate skills, --json diagnostics with code/range/URI/declaration/occurrence metadata and selected safe repair edits |
| Authoring services | Canonical token-preserving full-document formatting; semantic index, definition/references and versioned multi-file rename over indexed paths, port members, nested operations, schedules, states, placements, package connection ends, case subjects, associate, satisfy and verify links and view subjects/eligible filters; rename writes quoted names where required and unquoted names inside string paths; portable name spelling helpers for hosts |
| Case runs | A fresh package run per case script released after startup entries, retained early actor input, on call replies, white-box access under the serial lock (in 2.3 also to part family members by a literal index, such as backend.twins[0]), stop on completion or failure, pass/fail/inconclusive/no checks with statement identities; swaml test with summary, JSON and exit codes; every example case runs with its expected result |
| Host behavior | CLI exit/JSON/edition checks and LSP negotiation pinned to 2.3 with the swaml-reference/2.3 profile and package identity, complete dependency enforcement, standard-library validation (both built-in documents, the 2.2 library and the 2.3 packages) and workspace negative-lookup invalidation; 2.3 (WP3): host intrinsics `sqrt` (IEEE-754), `intText`, `realText` (exact integer rounding of the binary64 value, never `toFixed`) and `now()` (the run clock) |
| Diagrams and page | Exhaustive notation/mapping inventories; original SVG/PNG/scenes labeled with the standard version and source-subject checks; generated source/trace site data, seven interactive views, light/dark/system themes and responsive preview |

The unit suite exercises observable positive/negative language behavior, malformed recovery, final stores/traces and validated authoring edits. The example gate validates every current model, checks explicit expected stores and deterministic reruns. These are reference implementation tests, not an independent formal certification of all possible executions.

## Deliberate implementation limits

The stale-read analysis behind warning SW2011 visits at most 200,000 statements per document, followed calls included. When a document reaches that work limit, the validator reports one SW2013 warning at the operation where the analysis stopped, and SW2011 is not checked for that operation or for the operations validated after it in the document; other validation is unaffected. An expression nested more than 1,000 levels deep (for example a sum of more than 1,000 terms) is reported with the SW2013 error instead of a stack overflow and is neither type-checked nor run; local variables avoid the limit. Bracket nesting exceeds the stack of the Langium parser itself much earlier. The binary chains of the expression grammar are written into one rule, so a nesting level costs three parser rule calls instead of the nine of 3.1.0. On Node.js 26.12.0 with the default stack, through the document builder, bracket nesting therefore parses deeper than in 3.1.0 for every form: in a fresh process, for example, 228 parentheses (3.1.0: 148), 205 indexes `a[a[…]]` (122), 236 calls (126) and 246 nested record literals (132); the [release draft](RELEASE_2_3.md#parser-nesting-wp2-d05) lists every form. Nested blocks take the same parser calls per level as in 3.1.0, and their deepest nesting varies with the state of the JavaScript engine by about 5% in either version (compatibility exception X1 in the [release draft](RELEASE_2_3.md#parser-nesting-wp2-d05)). To fail fast instead of overflowing the stack or exhausting memory, the lexer applies the parser nesting limits of WP2-D05 (SW2013, chapter 4.4): a statement with more than 200 brackets open at once (counting the braces of record literals and any brace inside brackets) or one that ends with brackets unclosed after more than 32 were open is reported (`Bracket nesting exceeds the reference parser limit of … levels`) and not parsed, and the rest of the file is parsed as usual. Without the limits, 800 unclosed `a[` overflowed the stack and 1,200 unclosed `f(record R { v =` exhausted memory after 35 s in 3.1.0; now each takes milliseconds. A statement left unclosed is bounded where its brackets stop matching (a `}` of the enclosing block, or a `;` while a parenthesis is innermost); unclosed parentheses and braces that keep pairing up with the brackets of the following members extend it, at worst to the end of the file. A parse that still overflows the stack within the limits, such as about 180 unclosed blocks or array literals nested about 175 to 200 levels deep in a fresh process, reports SW2013 (`Bracket nesting exceeds the reference parser limit: the parser ran out of stack space …`) for its file, which is then not parsed, instead of throwing; other documents are unaffected. These are reference resource boundaries, not language rules.

The reference validator expands at most 10000 component occurrences per top-level occurrence and reports SW2013 above that host limit; closure is not checked for a top-level occurrence that exceeds it. This is a reference resource boundary, not a new mathematical language multiplicity restriction. The reference simulator runs a package target (all top-level software occurrences with their package connections and deployments) or one top-level component alone with its ports open, and records statement identities as trace sources. A case script runs in one deterministic order; a pass is evidence of that run only. Script endpoints reach only top-level actors without multiplicity, white-box paths follow single parts and, from 2.3, part family members by a literal index and helper calls outside the exact primary subject cannot communicate or suspend. Normal primary-subject calls in both case kinds may use the subject's own ports and wait. An unassigned out binding of on call replies with its zero value. Stale-read analysis is conservative and may warn after a safe recheck. Definite-return/out assignment is conservative. Formatter range/on-type operations are not implemented. A rename that introduces an error, changes any indexed reference binding, or cannot preserve selected view identities is refused; persistent editor sidecar identity/native undo belongs to the editor integration.

Math abs/min/max/concat are ordinary source; floor/round/trunc/length are explicitly documented host intrinsics with checked semantics. The interpreter uses zero physical CPU cost and one deterministic permitted order, with finite resources and recorded fault assumptions. It does not implement a production scheduler, real network reliability protocol or universal analysis.

No validated KerML exporter or executable KerML semantic library exists; chapter 5 and the mapping inventory remain a proposed contract. No XMI adapter, generic UML/SysML importer or graphical conformance certification is claimed. The adjacent editor has its own pin, source-edit, desktop/browser and package gates; its completion must be reported separately from a passing core suite.

The 2.1 edition is published with the production website and a separately versioned [PDF](../output/pdf/SWAML-2.1-Specification.pdf), SWAML-2.1-Specification.pdf with its [manifest](../output/pdf/SWAML-2.1-Specification.manifest.json) and [checksum](../output/pdf/SWAML-2.1-Specification.sha256), under the [publication gate](PDF_PUBLICATION.md); see the [2.1 release notes](RELEASE_2_1.md). The 2.0 standard remains published under the legacy v2.0.0 tag with its [review resolution](REVIEW_2_0.md) and [release notes](RELEASE_2_0_0.md). Draft mockups are excluded; archived editions are never rebuilt from current sources.


---

<a id="chapter-23"></a>

# swa.ml 2.0 review resolution

The 22 October 2026 source review of revision 46044b5 identified the following defects. Each row records implemented corrections and evidence; pending rows are not acceptance claims. The reference interpreter remains bounded evidence under its recorded assumptions.

| Finding | Resolution and regression evidence |
| --- | --- |
| F01 Package operation out writes bypass concurrency validation | Fixed: resolve package callees and preserve the caller's out-target write effect; imported/transitive negative cases and serial/local positive cases in review-validation.test.ts |
| F02 Package calls capture component helpers | Fixed: Lexical package calls and reused bodies cannot capture occurrence helpers; inheritance still dispatches effective component members. Regression evidence in review-runtime.test.ts |
| F03 Rename changes reference binding | Fixed: Trial rename compares every indexed binding by stable AST identity and translated token ranges, rejecting capture even when validation passes. Regression evidence in review-authoring.test.ts |
| F04 Request out variance crashes | Fixed: Request out cells use the provider type before successful caller copy-back. Regression evidence in review-runtime.test.ts |
| F05 Port payloads bypass numeric domains | Fixed: Outgoing attribute/event/request values check the own port domain before offers, including wider peers. Regression evidence in review-runtime.test.ts |
| F06 Negative computed loop limits succeed | Fixed: Computed limits check uint once; negative counts fail and can be caught. Regression evidence in review-runtime.test.ts |
| F07 Initializer failure escapes evidence | Fixed: Initializer faults yield source-attributed failure evidence before startup; CLI returns JSON and exit 1. Regression evidence in review-runtime.test.ts |
| F08 QoS capacity accepts duration | Fixed: capacity is a positive integer count; duration/boolean/string/fraction/zero rejection in review-validation.test.ts |
| F09 Enum token indexing is ambiguous | Fixed: Enum heads use the first path segment with concrete token ranges, including qualified names and comments. Regression evidence in review-authoring.test.ts |
| F10 Inherited case via references are missing | Fixed: Case navigation shares effective occurrence/alias route resolution with validation, including inherited repeated occurrences. Regression evidence in review-authoring.test.ts |
| F11 Projection drops package containment | Fixed: Projection records package ownership without inventing namespace-prefix containment. Regression evidence in review-authoring.test.ts |
| F12 Ownerless redefines is accepted | Fixed: replacement requires a containing component's inherited member; package/nested negative and valid replacement tests |
| F13 Duplicate delivery exceeds queue capacity | Fixed: Every duplicate copy observes capacity/reject/dropNewest/dropOldest; committed copies remain observable. Regression evidence in review-runtime.test.ts |
| F14 Linking diagnostics have missing/wrong code | Fixed: shared DocumentValidator assigns SW2001 to linking and SW2000 to syntax; CLI and malformed-recovery regression checks |


All fourteen findings have implemented corrections and regression coverage. The validation, runtime and authoring groups passed npm run check with 185, 197 and 202 tests respectively, including example, simulation, documentation and inventory gates. Production site model data reflects corrected ownership. Final publication is gated separately on the versioned PDF, visual inspection and cross-platform checks. These results do not establish universal verification, production scheduling or kernel conformance.

Timers begin at state entry before entry actions, including suspension. Elapsed timers precede queued input after entry; equal expiry uses source order, deadline ties win, and final entry completes once. Tests cover each ordering and successful after dependencies.


---

<a id="chapter-24"></a>

# swa.ml 2.0.0 release

22 October 2026. Parser 2.0, package 2.0.0, reference profile swaml-reference/2.0.

The clean 2.0 language replaces the 1.x grammar and runtime with components, private attributes, reusable operations, mixed directed port members, explicit routes, schedules and operation-owned states. It accepts only 2.0 source. Published 1.x editions retain their original artifacts.

All fourteen findings from the source review have corrections and regression coverage in [the resolution record](REVIEW_2_0.md). The language gate passes 202 tests plus example, simulation, source/diagram inventory and documentation checks. These checks are bounded implementation evidence, not universal verification.

State timer epochs begin at state entry before entry actions. Time spent suspended in entry counts toward the delay. Entry finishes before a transition runs; an elapsed timer precedes queued input, equal-expiry timers follow declaration order, and deadlines win ties. Final entry completes once and releases successful after dependencies.

The port symbol is one square boundary with member-level glyphs: arrows for attribute/event direction and ball/socket for provided/required operations. Mixed members retain their individual names, types and directions.

The release includes the [reference book](SWAML-2.0.0-Reference.md), [PDF](../output/pdf/SWAML-2.0.0-Specification.pdf), [source manifest](../output/pdf/SWAML-2.0.0-Specification.manifest.json) and [checksum](../output/pdf/SWAML-2.0.0-Specification.sha256). The manifest identifies the source base commit, package revision and exact canonical source bundle, fonts and dependency versions. Embedded sources use repository LF text bytes; the final publication commit also contains the generated PDF itself.

The production website publishes the validated model views, current release downloads and mixed-port notation. Draft mockups are excluded. A bounded run does not establish production scheduling, real transport reliability, universal correctness or KerML export conformance; [implementation limits](IMPLEMENTATION_STATUS.md) remain explicit.


---

<a id="chapter-25"></a>

# swa.ml 2.1 release

1 November 2026. Standard 2.1, parser 2.1, reference profile swaml-reference/2.1, reference implementation package 3.0.0.

swa.ml 2.1 makes the package the context in which a system, its surroundings and the scenarios that exercise them live side by side, and makes use cases and tests executable. [ADR 0019](decisions/0019-package-context.md) records the design; it supersedes [ADR 0018](decisions/0018-cases-belong-to-their-subject.md), which was never published, and the case clauses of [ADR 0016](decisions/0016-swaml-2-0.md) and [ADR 0017](decisions/0017-readable-names-and-use-cases.md). The edition also includes the quoted names of ADR 0017.

This is an incompatible edition. The owner approved it as 2.1 because swa.ml has no external adopters. There is no compatibility parser, alias or deprecation period: removed forms are ordinary parse or validation errors, and a host selecting 2.1 rejects --language-version 2.0. The published 2.0 edition, its legacy v2.0.0 tag, PDF, manifest, checksum and [frozen reference](../history/2.0.0/docs/SWAML-2.0.0-Reference.md) remain unchanged.

The release includes the [reference book](SWAML-2.1-Reference.md). The [complete PDF](../output/pdf/SWAML-2.1-Specification.pdf), its [per-source manifest](../output/pdf/SWAML-2.1-Specification.manifest.json) and [SHA-256 checksum](../output/pdf/SWAML-2.1-Specification.sha256) are produced by the [publication gate](PDF_PUBLICATION.md).

## What is new

### Package context

A package is a closed context. connect may be a package member that joins ports of top-level component occurrences of the same package, with the existing forms connect (a.p, b.q);, connect name (a.p, b.q); and connect name: Policy (a.p, b.q);. Occurrences are never connected across packages; definitions may still be imported. Closure of top-level ports is checked per package: every required port of a top-level occurrence needs a peer through the package connections, and the existing compatibility, variance, duplicate and peer-count rules apply across the whole package.

### Interface-only components

A component with ports but no operations, schedule entries or parts is interface-only. It needs no implementation, so the emitter and input-owner rules of SW2005 do not apply to it, and it does nothing on its own in a run. Actors (external systems) and test stubs are written as interface-only components.

### Executable use cases and tests

use case X of y { … } and test X of y { … } are package members; test replaces verification case. The optional subject y is a top-level occurrence of the same package. A case without of, or without statements, records intent only.

After its documentation, a case body may contain statements: a script that acts as its associated interface-only actors through occurrence.port.member endpoints (send, publish, calls, on receive … or after D), answers requests at actor ports with on call actor.port.op(bindings) { return v; } branches, and, in a test only, reads and calls into its subject and the single parts inside it (atm.fee(20, 10), atm.dispenser.count) without assigning them. A white-box call may only target an operation that neither communicates nor suspends (SW2006). Statements require of.

Each case with statements runs in its own fresh deterministic package run. The script starts after the on start entries. Input that reaches an actor port before the script waits for it is retained under the connection policy, and attributes keep their latest value. The run stops when the script completes or fails. Results are pass, fail (the first failure in the run, with its statement identity, message, time and trace), inconclusive (horizon, step limit or a stalled script) and no checks. A failure caught by try does not fail a case; it remains evidence in the trace. A passing case is bounded evidence of one deterministic run, not proof.

swaml test [--package P] [--case X] [--json] [--options file | --until-ns N] runs the cases of the given sources, prints one line per case and a summary, and exits 1 when a case fails. See [the simulation guide](SIMULATION.md).

### Links live in the package

associate Z to X; associates a top-level occurrence Z with a use case or test X of the same package. satisfy R by X; claims that a component definition or a component occurrence path declared in the package satisfies R. verify R by T; links R to a test T of the package, never to a use case. Duplicate pairs and bad references are reported with SW2010 at the offending reference. Requirements and links remain intent, not proof.

### Run targets and statement identities

A run targets a whole package, with its top-level software occurrences, package connections and deployments, or one top-level component alone, with its package connections absent and its ports open. A top-level occurrence has at most one deployment (SW2009), and every run applies it. swaml simulate [--target Package|Package::component] (--options file | --until-ns N) selects the target and defaults to the package of single-package sources.

Every trace event carries source, the statement identity of the statement, state, transition or schedule entry that caused it, such as Banking::Controller.withdraw/1 or a case statement path. Offers record sourcePort and targetPort and deliveries targetPort; asserts are observed with their outcome.

### Readable names

Names may be quoted, such as 'Withdraw cash', 'Bestellübersicht' or 'state', for spaces, letters outside ASCII and reserved words. Quoted names exclude path separators and untidy spaces, and rename writes quoted names where required. test, associate, by, name, kind, path and the duration units ns, us, ms and s are contextual words. verification, actor, extend, request, reply, via and from are no longer keywords.

### Views

Case views draw the subject occurrence as the boundary with associated occurrences outside it; a selected package contributes its cases. Sequence views select cases, components, packages and operations; Flow and Timing views select use cases and tests.

## Removed forms

- useCase and verificationCase (2.0), verification case (ADR 0018) and the of root form of 2.0 cases.
- Declarative case steps: send, publish, request and reply with from, to, via and after.
- verify R; inside a case.
- Cases inside components, actor roles (actor customer: Customer;), and include and extend between cases.
- satisfy R of path (2.0) and satisfy R; inside a component (ADR 0018).
- SW2015 and the deprecated 2.0 case spellings it reported.

## Migration from 2.0 and ADR 0018 syntax

Components, operations, ports, schedules, states, deployments and views keep their 2.0 meaning. A concrete root component that owns and wires its parts remains valid. Only models with cases, requirement links or actors need changes:

1. Declare the system and its surroundings as top-level occurrences of the package and join them with package connections.
2. Write each actor or external system as an interface-only component: keep its ports and remove the behavior that only played a scenario.
3. Move every case into the package as use case X of subject or test X of subject. Replace verificationCase or verification case by test.
4. Replace actor roles by associate actor to X; and rewrite steps as a script, or keep the case as documentation-only intent. include and extend have no replacement; describe the relationship in documentation.
5. Rewrite satisfy R of path; as satisfy R by path; and verify R; inside a case as verify R by T; in the package.
6. Select parser 2.1 (--language-version 2.1, or initializationOptions languageVersion 2.1) and the profile swaml-reference/2.1.

### From 2.0

In 2.0 the actor had to emit its own scenario, the case was a list of declarative steps on a concrete root, and satisfy and verify used of and a nested verify:

```text
component def Visitor {
  port panel: Panel;
  operation arrive() {
    publish panel.order("tea");
  }
  schedule {
    on start arrive();
  }
}
component Demo {
  component visitor: Visitor;
  component counter: Counter;
  connect (visitor.panel, counter.panel);
}
satisfy Service of Demo.counter;
verificationCase Served of Demo {
  verify Service;
  publish order from visitor.panel.order to counter.panel.order;
  publish served from counter.panel.served to visitor.panel.served after order;
}
```

In 2.1 the visitor is interface-only, the occurrences and their connection are package members, and the test is a script that acts as the visitor and checks the result:

```swaml
package Kiosk {
  port def Panel {
    provides event order(item: string);
    requires event served(item: string);
  }
  component def Visitor {
    /** Actor: interface-only; a case script acts through its panel. */
    port panel: Panel;
  }
  component def Counter {
    reversed port panel: Panel;
    operation serve(item: string) {
      publish panel.served(item);
    }
    schedule {
      on receive panel.order(item) serve(item);
    }
  }
  requirement Service {
    /** Every order is served. */
    attribute description: string = "Serve each order";
  }
  component visitor: Visitor;
  component counter: Counter;
  connect (visitor.panel, counter.panel);
  test Served of counter {
    /** One order is served within a second. */
    publish visitor.panel.order("tea");
    on receive visitor.panel.served(item) {
      assert item == "tea";
    } or after 1s {
      fail "not served";
    }
  }
  associate visitor to Served;
  satisfy Service by counter;
  verify Service by Served;
}
```

swaml test reports pass Kiosk::Served. [Example 16](../examples/16-requirements-and-views.swaml) shows the same migration of the 2.0 traceability example.

### From ADR 0018

Development builds after 2.0 placed cases inside their subject component with typed actor roles, include and extend:

```text
component def 'ATM Controller' {
  reversed port panel: Panel;
  port bank: Authorization;
  use case 'Withdraw cash' {
    actor customer: Customer;
    actor issuer: Bank;
    include Authenticate;
    publish 'insert card' from customer.panel.cardInserted to panel.cardInserted;
    publish 'ask for cash' from customer.panel.cashRequested to panel.cashRequested after 'insert card';
  }
}
component def Bank {
  reversed port link: Authorization;
  satisfy 'Cash limit';
}
```

In 2.1 the case is a package member with a subject, the actors are associated top-level occurrences and the claim is a package link:

```text
component customer: Customer;
component atm: 'ATM Controller';
component bank: Bank;
connect (customer.panel, atm.panel);
connect (atm.bank, bank.link);
use case 'Withdraw cash' of atm {
  /** The customer inserts a card, asks for cash and receives it. */
  publish customer.panel.cardInserted("4711");
  publish customer.panel.cashRequested(100);
  on receive customer.panel.cashDispensed(amount) {
    assert amount == 100;
  } or after 2s {
    fail "no cash dispensed";
  }
}
associate customer to 'Withdraw cash';
associate bank to 'Withdraw cash';
satisfy 'Cash limit' by Bank;
```

[Example 28](../examples/28-use-cases.swaml) is the complete model. [Example 29](../examples/29-executable-cases.swaml) adds an isolation package with an interface-only bank stub answered by on call and white-box reads in tests.

### Hosts and programs

The reference implementation package is 3.0.0 because its exported API changed incompatibly:

| 2.0 (package 2.0.0) | 2.1 (package 3.0.0) |
| --- | --- |
| SimulationResult.root | target with kind package or component and its identity |
| simulate(models, root, options) | simulate(models, target, options), with a package or Package::component target |
| SimulationOptions.deployment | removed; each top-level occurrence has at most one deployment and every run applies it |
| offer and deliver fields source and target (port paths) | sourcePort and targetPort; source is the statement identity on every event |
| profile swaml-reference/2.0 | swaml-reference/2.1 (REFERENCE_PROFILE) |
| languageVersion 2.0 in CLI, LSP and projections | 2.1 (SWAML_LANGUAGE_VERSION) |
| Scenario root, steps, verifications and actors | Scenario subject and statements; Package connections, associations, satisfactions and verifications |

New exports include runCase, runTests, workspaceCases, runTarget, runTargets, statementIdentity and resolveStatement. [The implementation status](IMPLEMENTATION_STATUS.md) lists tested scope and limits.


---

<a id="chapter-26"></a>

# swa.ml 2.2 release

10 November 2026. Standard 2.2, parser/host semantics 2.2, reference profile `swaml-reference/2.2`, reference implementation package 3.1.0. The concrete grammar is unchanged from 2.1. Hosts select the new semantics and pin an exact implementation revision; source models need no new syntax.

## Primary-subject operation calls

Both use cases and tests may also call operations of their exact primary subject, including operations that communicate through their own ports, receive or wait. The call uses the subject's actual serial context, releases its lock during suspension and returns to the case on completion. It retains local-call semantics without a new schedule activation, route, transport timeout or `after` release. Caller context restores on return or failure; failing statements retain their actual source and outputs copy back only after success. Stateful operations remain on-start-only. See [ADR 0021](decisions/0021-case-subject-calls.md) and [example 31](../examples/31-case-subject-calls.swaml).

A case is sequential: a later actor reply branch cannot execute while that same case is blocked in a subject call. Use independently behaving actors or stimulate the subject asynchronously before serving its reply. Waiting calls occupy ordinary whole-value statements, declarations or assignments, with optional `try`; evaluate a call before a loop if its result is needed in the header.

## Referencing associated test components

Tests may inspect their subject, explicitly associated software component occurrences and those roots' single parts. Existing `associate` links and dotted paths express the references. Use cases gain no private reads or direct calls on parts or associated peers. Tests' helper calls outside the primary subject may change the target through its operation but must neither communicate nor suspend. Direct attribute assignment remains forbidden. See [ADR 0020](decisions/0020-associated-test-access.md) and the [ten-component integration](../examples/30-associated-integration.swaml).

Neither case kind owns components. Associations reference existing same-package software occurrences; they do not select execution roots, choose a fixture topology or suppress unrelated startup work. Every case still runs a fresh package configuration. Indexed component paths remain outside the grammar. Actor-port association, interface-only, direction and route rules are unchanged.

## Publication and compatibility

The release includes the [complete reference](SWAML-2.2-Reference.md), [PDF](../output/pdf/SWAML-2.2-Specification.pdf), [source manifest](../output/pdf/SWAML-2.2-Specification.manifest.json) and [SHA-256 checksum](../output/pdf/SWAML-2.2-Specification.sha256). The [publication gate](PDF_PUBLICATION.md) checks exact current sources, embedded attachments, navigation, readable bounds and every rendered page. A tagged release and uploaded artifacts establish publication; a source merge alone does not.

All published [2.1 reference](SWAML-2.1-Reference.md), [2.1 PDF](../output/pdf/SWAML-2.1-Specification.pdf), manifests, checksums, figures, release notes and tags retain their bytes, as do earlier editions. The 2.2 assets use their own paths. This edition extends the supported 2.1 behavior without a compatibility parser or source migration. Passing tests and example cases remain bounded evidence, not universal verification or production scheduling certification.


---

<a id="chapter-27"></a>

# Tool integration

swa.ml 2.2.

The language core is portable TypeScript over Langium 4.4.0 and the normative grammar. Node CLI/server adapters own file access and source hashing. Build with npm run build; validate with node out/src/cli/main.js --json and explicitly load all application dependencies. The host selects parser 2.2; unsupported edition flags are errors.

JSON diagnostics expose stable SW2xxx codes, range, URI and identity metadata. --format applies canonical token-preserving whitespace, printing places and selectors without spaces inside the path, as in statuses[i].confirmed = true; (WP1-M03), conditionals with every parenthesis of the source, as in x = 1 + (if (c) 2 else 3) + 4;, and association lists on one line when they fit in 100 characters, otherwise with one occurrence or case per continuation line; a list that contains a comment is not wrapped (WP2-M05); --check-format checks it without writing. It prints computed durations in parentheses, as in wait (n * 1ms); and on every (periodMs * 1ms) poll() deadline (periodMs * 1ms / 2);, and literal durations without them, as in wait 5ms; (WP4-M08). It prints completion transitions, internal transitions, timer guards and defer lines, as in when (sessionId > 0) to Connected {, on receive stream.accepted(t) {, after 250ms when (pulses < 3) to isLocked { and defer requests.request, keys.key;, keeping every state member in source order (WP5-M04). It prints a release guard between the operation call and `deadline`, as in on every 20ms slot() when (mode.current != PowerMode.sleep) deadline 2ms; (WP7-M03). The LSP exposes full-document formatting. Source repairs must be validated against the complete workspace before application.

The simulator requires validated models and records swaml-reference/2.3, sources, options, trace, final stores and deployment. Source digests are added by the CLI. Its finite logical run does not supply production timing or universal verification.

The adjacent editor repository has separate acceptance, diagram, refactoring and packaging gates. Paths with multiplicity, port members, schedules, nested operations, deployments, cases and views need semantic path-aware navigation/rename; generic Langium references alone are insufficient. Preserve occurrence identity and validated source transactions, with geometry in sidecars. See [implementation status](IMPLEMENTATION_STATUS.md) for the current evidence boundary.


---

<a id="chapter-28"></a>

# ADR 0016: swa.ml 2.0 restart

Status: accepted for implementation, 2026-10-21.

The accepted design is [the 2.0 proposal](SWAML_2_0_TRANSITION.md), sections 1–11 and 13–15. This is a clean restart: no compatibility parser, aliases, conversion tool or new migration guide. Published 1.x books, PDFs and their provenance remain immutable.

swa.ml has one structural kind, component, and one executable kind, operation. Attributes belong to occurrences; locals belong to activations. Nested operations never capture enclosing locals. Operation definitions supply reusable signatures and bodies. Usage bodies replace whole operations or explicitly redefine component members. Inherited calls resolve against effective occurrence members.

Ports own directed attribute, event and operation members. Compatibility is structural by name, with nominal records/enums. Reversal flips every direction. Connect derives connection or forwarding from boundary ownership and direction. Only connections own queues and policies; omission selects the pinned Default. Attributes retain the latest value independently of buffering.

One effective schedule binds triggers to operations. Suspension releases the serial lock. Serial resumptions read live attributes; concurrent activations retain their dispatch snapshot and cannot write state through any callee. After dependencies create new activations only after successful whole completion and unlock. Out parameters copy back only on success. Try catches expression failures, preserving committed effects; it cannot catch interruption or contract/resource violations.

State transitions are nested, ordered and unnamed. Stateful operations have exactly one on start entry. Receive statements exclusively own their members. Interrupt regions are armed only during their protected body, including suspended callees; inactive input is discarded with trace evidence. Concurrent operations may receive/interrupt if their transitive effects do not write state. Each input is consumed once, in activation order in the reference interpreter.

Deployment is separate and targets platform Node occurrences. Multiplicity expands separate stores. Views use General, Interconnect, Case, Sequence, Grid, Flow and Timing library definitions. Browser remains the editor navigation surface. Timing separates declared contracts from identified observations. Geometry stays in sidecars.

Libraries are versioned source. Any Math host intrinsics must be explicitly identified and implemented by a backend. KerML remains a proposed mapping until an exporter, semantic library and kernel validation exist.

Stable diagnostics: SW2001 names/imports; SW2002 types/values; SW2003 structure/redefinition; SW2004 ports/routes; SW2005 ownership/provenance; SW2006 operations/effects; SW2007 schedules; SW2008 states; SW2009 deployment; SW2010 cases/views; SW2011 stale reads; SW2012 inactive interrupt input; SW2013 policies/durations. Diagnostics retain ranges and identity; attach edits only when unambiguous.

Supersedes ADRs 0007, 0008, 0011, 0014 and 0015 for 2.0. Amends ADR 0010 with from/to and returns; ADR 0012 with library views and declared/observed timing; ADR 0013 with source operations and schedules. Their published-edition decisions remain historical evidence. ADRs 0001, 0002, 0006 and 0009 retain the boundary, evidence, queue, requirement and identity constraints.

Acceptance requires positive/negative language tests, malformed recovery, runtime traces/stores, synchronized inventories/diagrams, executable guides and an honest support matrix. Preview the site before publication. A release additionally requires the PDF and visual publication gate.

The proposal’s deployment illustration spelling component def Ecu: Node is resolved consistently with its unchanged single-inheritance rule: definitions use specializes Node; colon types usages. No alias is accepted. The reference host reports an explicit 10000-expanded-occurrence validation resource limit, without changing the language’s finite multiplicity domain.


---

<a id="chapter-29"></a>

# ADR 0017: Readable names and structured use cases

Status: accepted for implementation, 2026-10-25. Normative additions for the next minor standard edition, included in the 2.1 edition. The case root, subject and actor clauses and the deprecated 2.0 case spellings were superseded by [ADR 0018](decisions/0018-cases-belong-to-their-subject.md); all case clauses are superseded by [ADR 0019](decisions/0019-package-context.md). Quoted names remain in force.

## Context

A usability review of the language and its editor found three problems. Names were limited to ASCII identifiers, so a use case could not be called "Withdraw cash", common words such as name, kind, state or event could not name fields, and letters outside ASCII were rejected with raw parser messages. Cases were message scenarios only: a case root contained every participant, so a Case view could not separate the system under consideration from its actors and had no include or extend relations. The owner asked for cases to be written use case and verification case.

## Decision

Names are basic ASCII names or quoted names in single quotes, following the KerML unrestricted-name form. The quoted content is the name, so 'Pump' and Pump are equal and a quoted reserved word is an ordinary name. Quoted names exclude '.', ':', '[' and ']', which delimit swa.ml paths, control characters and untidy spaces. This keeps every semantic path, occurrence identity and sidecar key an unambiguous string. Tools write the basic spelling whenever it is legal. name, kind and path become contextual words because they are only syntax inside view filters.

Cases are written use case and verification case. The 2.0 spellings useCase and verificationCase remain valid and report the SW2015 warning with a safe replacement, so every 2.0 model keeps its meaning. The new words use, case, verification, subject, actor and extend are contextual, so no existing name becomes reserved.

A case may name a subject occurrence inside its root and actor occurrences outside the subject. Actors remain ordinary components: exchanges with them still use ports and routes, so invariant I1 is unchanged and no hidden actor is introduced. When a subject is declared, steps stay within the subject and its actors. Use cases of one root may include or extend each other in an acyclic graph. Subject, actor, include and extend are intent, like satisfy and verify; they merge no steps and execute nothing.

The parser explains spaces in names, double-quoted names, reserved words used as names, letters outside ASCII and misplaced documentation comments. Identical diagnostics produced for a definition and the usages that inherit it are reported once.

## Consequences

The grammar, normative chapters 1, 4, 5, 7 and 8, inventories, canonical notation and guides change together. The Case notation draws use case ellipses inside a subject boundary, stick-figure actors outside it with association lines, and labeled «include», «extend», «satisfy» and «verify» arrows. Rename writes quoted names where needed and unquoted names inside string paths. Hosts can reuse the portable name helpers exported as names.

The parser, profile and edition identifiers remain 2.0 until the edition is prepared under the version policy. A model using the new syntax needs this implementation or a later one. Leading /** */ documentation before a declaration remains invalid; only its diagnostic improves.


---

<a id="chapter-30"></a>

# ADR 0018: Cases belong to their subject

Status: superseded by [ADR 0019](decisions/0019-package-context.md) on 2026-11-01 before the 2.1 edition was prepared. Accepted for implementation on 2026-10-26; it superseded the case root, subject and actor clauses of ADR 0017.

## Context

A usability review of the editor found that the case root was the hardest concept in the language. use case Name of Root { subject part; actor other; } asked authors for a root that was neither the subject nor the place the case was written, and a use case could not be recorded before a concrete system existed. Authors read use case A of B as "B is the subject" and expected a use case to be placed where they were modeling, with a subject and actors.

## Decision

A case belongs to the component that owns it, and that component is its subject. Cases are component members, written use case Name { … } or verification case Name { … } in a component definition or usage body, and are inherited by usages and specializations like other members. A case declared in a package has no subject: it records intent with documentation, actors, include, extend and verify links, and owns no steps.

Actors are typed roles, actor customer: Customer;. They are not occurrences of the model, because a component definition does not know its surroundings. A step either crosses the subject boundary, between an actor's port and a port of the subject itself, or stays inside the subject along one of its real connections. A boundary step needs structurally compatible ports and names no connector. Actor names differ from the subject's member names so step paths are unambiguous. A concrete root binds each role to the occurrence connected to the subject port that the role's steps use; tools report an absent or ambiguous binding instead of guessing.

include and extend relate use cases of the same subject, including inherited ones, or package use cases of one package. Inside a component, satisfy Requirement; claims that component. A package satisfy keeps of designPath for claims about one occurrence. Deployments and views keep of: a deployment pairs two independent roots and a view selects from anywhere, so ownership would not remove the reference.

The of root form, the subject clause and the 2.0 spellings useCase and verificationCase are removed rather than deprecated. SW2015 is retired.

## Consequences

This is an incompatible change. The version policy calls for a new major number, but the owner approved it for the 2.1 edition on 2026-10-26 because swa.ml has no external adopters yet. Published 2.0.0 artifacts and their frozen sources remain unchanged. A 2.0 model moves a case into its root component, replaces subject part; with an owning part or a step through the subject's ports, and turns actor paths into typed roles.

Case views draw the owning component as the boundary and actor roles outside it. Sequence views show the subject, its parts and the actor roles as lifelines. Hosts that overlay a case on a concrete root resolve roles through connections and mark unresolved roles unavailable. Cases remain intent: they execute nothing and prove nothing.


---

<a id="chapter-31"></a>

# ADR 0019: Package context, executable cases and package links

Status: accepted for implementation, 2026-11-01. Normative change for the 2.1 standard edition, prepared on 2026-11-01 with the 2.1 notes in CHANGELOG.md and [the release notes](RELEASE_2_1.md). Supersedes [ADR 0018](decisions/0018-cases-belong-to-their-subject.md) and the case clauses of [ADR 0016](decisions/0016-swaml-2-0.md) and [ADR 0017](decisions/0017-readable-names-and-use-cases.md); quoted names from ADR 0017 stay.

Implementation is incremental. The package context, interface-only components, package-owned intent-only cases and the package links are implemented with this decision. Run targets and trace identity are implemented by the run targets change. Executable use cases and tests are implemented by the executable cases change. The parts implemented by follow-up changes are marked below.

## Context

ADR 0018 placed cases inside the component they describe and modeled actors as typed roles. Actors therefore were not occurrences of the model, a concrete root had to bind each role through connections, and a case could not be executed: its declarative steps described exchanges that no occurrence performed. Requirements, cases and their links were spread over components and packages. The owner asked for a model in which the system, its surroundings and the scenarios that exercise them live side by side and can be run.

## Decision

swa.ml has no external adopters, so 2.1 may break 2.0 and ADR 0018 syntax. No deprecations, aliases or compatibility parsing are added. Removed forms are ordinary parse or validation errors.

### Package context

A package is a closed context. connect is allowed as a package member between ports of the package's own top-level component occurrences, with the existing forms connect (a.p, b.q);, connect name (a.p, b.q); and connect name: Policy (a.p, b.q);. Definitions may be imported; occurrences may not be connected across packages. Each end of a package connection is occurrence.port, where occurrence is a top-level component occurrence declared in the same package (SW2004). A package connection is always a connection, never forwarding, and follows the existing compatibility, duplicate, policy and idempotence rules. Named package connections share the package namespace with its elements.

Closure moves from per root to per package for top-level ports: every required (non-optional) port of a top-level occurrence needs a peer through package connections, and the existing rules (exactly one peer for required attributes and operations, duplicates after forwarding, compatibility and variance) apply across the whole package. Closure inside a component stays as before. Diagnostics name the package: Unconnected required port atm.link in package Banking.

A run target is a whole package, with all its top-level occurrences and package connections, or one top-level component alone, with its package connections absent and its ports open. A package run applies at most one deployment per top-level occurrence. *Implemented by the run targets change:* a top-level occurrence has at most one deployment (SW2009) and every run applies it to that occurrence's tree. Platform roots, top-level occurrences that specialize Swaml::Platform::Node, describe deployment targets and are not executed or offered as targets. Results record target with kind package or component and its identity, the package name or Package::component. Trace events carry source, the identity of the statement or schedule entry that caused them: Executable/statement path, such as Banking::ATM.serve/2/then/0, or Component/schedule/N; the format is specified in the reference simulation guide and the normalized model chapter.

### Interface-only components

A component, as its effective definition including specialization or as a bodied usage, that has ports but no operations, no schedule entries and no parts is interface-only. It needs no implementation: the emitter and input-owner rules (SW2005) do not apply to it. In a run it does nothing on its own; only a case script can act through its ports. Actors (external systems) and test stubs are written as interface-only components. A component without ports is not interface-only; it has no port members to check either way.

### Use cases and tests

use case X of y { … } and test X of y { … } are package members only; components no longer own cases. test replaces verification case. y names a top-level component occurrence of the same package: the subject. of is optional. A case without of, or without statements, records intent only. A use case of a sub-component is written in a package where that component is a top-level occurrence. The case body owns optional documentation. Case kinds are useCase and test in the abstract syntax.

*Implemented by the executable cases change:* after the documentation, a case body owns the existing statement language: var, assignment to locals, send p.m(v);, publish p.e(args);, calls through ports, on receive … { } or receive … { } or after D { }, on call actor.port.op(a) { return v; }, wait D;, if, while, for, for … in, assert, fail "reason"; and return. Cases own no nested operations, states or schedules. Statements require of. Endpoints in case scripts are occurrence.port.member. Statements act as associated interface-only components, through their ports. A use case may act only through ports of associated interface-only components (black box). A test may do the same and may additionally call operations of the subject and of parts inside it and read their attributes, such as atm.fee(20, 10), atm.dispensedToday or atm.dispenser.count; it cannot assign them. on call answers a request addressed to an actor port, a provided operation of the actor's port; inside it return v; is the reply, exactly like a served operation. A top-level return ends the case. Each case with statements runs in its own fresh deterministic run of its package; the script starts after the initialization barrier and the run stops when the script completes or fails, or at the horizon or limit. Results are pass (script completed, no failed assert or fail, no failure observed in the run), fail (with location and trace), inconclusive (horizon or limit first) and no checks (intent-only case). swaml test runs them. A use case runs the same way as an executable example.

### Links live in the package

associate Z to X; names a top-level component occurrence Z of the same package that is not the subject of X, and a use case or test X of the same package; duplicates are errors. satisfy R by X; names a component definition or a component occurrence path declared in this package, top-level or nested such as Workbench.editor or cells[1]; the claim is written in the package that declares the head of the path, the path resolves through effective members and a literal index stays within the multiplicity; R may be imported. verify R by T; names a test T of this package, never a use case; the relation is many-to-many and R may be imported. Duplicate satisfy or verify pairs are errors. All link diagnostics use SW2010 with the range of the offending reference.

### Removed

Declarative steps (publish a from … to … via … after …, with send, request and reply), actor roles, include and extend between cases, verify inside cases, cases inside components, satisfy R; inside components, satisfy R of path and the verification case keyword.

### Names and keywords

The new words test, associate and by are contextual and remain usable as names, like use and case. The duration units ns, us, ms and s become contextual too: a duration is always an integer immediately followed by its unit, and no other production accepts an integer followed by a name, so the grammar stays unambiguous. Words that no production uses any more stop being keywords: verification, actor, extend, request, reply, via and from. include stays for views, to for transitions and associations, after for timers, timeouts and schedule dependencies, and of for deployments, views and case subjects.

### Views

Case subjects include packages, cases and components; Sequence subjects include cases, components and packages; a selected package contributes its cases. *Implemented by the executable cases change:* Flow and Timing subjects include use cases and tests, and Sequence subjects include operations.

### Versions

The edition is standard 2.1 in spec/standard.json, parser family 2.1 and execution profile swaml-reference/2.1, with implementation npm package 3.0.0 because the exported API changes incompatibly. *Prepared by the edition change on 2026-11-01:* spec/standard.json is 2.1, hosts select parser 2.1 and record swaml-reference/2.1, and the implementation package is 3.0.0.

## Implementation choices

Until run targets existed the simulator could run only one root, so the S1 change temporarily removed example 28's reference run, and Customer kept its behavior (an emitting start operation and a receiving operation) because no case script can act through an interface-only actor yet; Customer becomes an interface-only actor with the executable cases change. The run targets change restores the run as a package run of 'Cash Machine' with its expected stores.

The run targets change resolves Package or Package::component through runTarget, with runTargets listing every package with software roots followed by each software root alone; a name that selects both a package and a component is ambiguous. The deployment selection option is removed rather than kept for one deployment per root, since there is nothing left to choose. Package connection route identities are the connection name or @packageN. The pre-existing offer and deliver fields source and target that held port paths become sourcePort and targetPort, because source now means the statement identity on every event. Asserts are observed as assert events with their outcome so that case results can cite them. Replies, timeouts and late replies name the requesting call rather than the serving return, which keeps one source for a correlation. Statement identities follow source structure, so reordering statements changes them; a quoted name may contain a slash, so resolveStatement tries the longest declared owner first. A top-level port that is open or over-connected is reported on its top-level occurrence, at the occurrence name, with the port declaration as related information.

The abstract syntax keeps Scenario for cases, with subject as a reference to a component usage. Package owns connections, associations, satisfactions and verifications beside its elements. The references of of, associate and verify resolve in the owning package first and fall back to imports only so that validation can explain a cross-package reference instead of reporting an unresolved name. semantic exports packageOccurrences, packageEndpoint, interfaceOnly, designComponent and caseSubject; connectionRoutes accepts a whole package and resolves package connections through forwarding aliases. Projections add subject, associate, satisfy and verify edges and package connection edges.

### Executable cases (implementation choices)

The executable cases change implements the case scripts with these choices, each the closest option consistent with the existing semantics:

- Grammar. Scenario owns statements after its documentation. Send and ReceiveBranch take an EndpointPath of two or three names, and ReceiveBranch gains kind receive or call; the validator decides by context: occurrence.port.member only in case scripts, port.member in operations, and on call branches only in case scripts. Interrupt regions, schedule entries, states and nested operations stay outside cases; interruptible is rejected in a case (SW2006) because its endpoint form belongs to operations.
- Environment role. An endpoint occurrence is a top-level occurrence of the case's package, not the subject, associated with the case and interface-only (SW2010); its kind and direction follow the actor port (SW2004 for emissions and calls, SW2005 for inputs). Calls through actor ports use the existing call expression, and a white-box call is an ordinary expression call.
- White-box access. A test reads attributes, with record fields and indexes, and calls operations of its subject and of single (unindexed) parts inside it. Calls are restricted to operations that neither communicate nor suspend, so they can occur inside expressions such as assert atm.fee(20, 10) == 2;; they borrow the occurrence's context and serial lock like a local call, and reads observe the live store; both wait while another activation holds that lock. Assignment syntax names locals only, so a test cannot assign its subject.
- Early input. Input reaching an actor port before the script waits stays in the connection queue under its policy, attributes keep the latest value, and requests wait for an on call branch or the caller's timeout. This needs no new mechanism: an interface-only occurrence has no input owner, so the existing rule that receive input stays queued applies.
- Start and stop. The script is one serial activation, released at 0 ns after every on start entry, with the case identity as trace subject and case statement identities as sources. The run stops after the event that completes or fails the script, with the new status stopped; a case run whose script waits with no event left is quiescent.
- Results. A failure observed in the run means an uncaught activation failure or a contract violation; a caught expression failure is handled behavior and does not fail a case, so a test can check a fallback such as a refusal after a bank timeout. The first failure in trace order decides a failed case, so an earlier run failure wins over a later script failure. A script that waits while no further event can occur is inconclusive with reason stalled, like a script that reaches the horizon: the run ended before the script completed without a failed check, and the result must not depend on unrelated activity that merely moves the end of the run to the horizon. A passing case may carry the failure-observed run outcome when a try fallback handled a failure. A failure inside on call replies with a remote failure and fails the case; an out binding that the branch does not assign replies with its zero value.
- API and host. The core exports runCase, runTests and workspaceCases with CaseResult values (case, kind, subject, result, reason, message, source, observed, timeNs, run) and caseTarget, associatedOccurrences and executableCase from semantic. swaml test shares loading and option parsing with swaml simulate, defaults to a 10 s horizon, prints a summary or JSON without repeating source text, and exits 1 when a case fails.
- Examples. Customer in example 28 is an interface-only actor driven by its use cases; its reference run is now the run of the use case 'Withdraw cash' with the ATM's expected store, and every example case runs with its expected result in the simulation gate. Example 29 is the reference example of the design with a composite ATM, so that white-box reads reach parts such as atm.dispenser.count; its fee operation uses real values because division yields real.

## Consequences

This is an incompatible change, approved by the owner for the 2.1 edition because swa.ml has no external adopters. Published 2.0.0 artifacts and their frozen sources remain unchanged. A 2.0 or ADR 0018 model declares its system and surroundings as top-level occurrences joined by package connections, moves its cases into the package with of naming the subject, replaces actor roles by associated interface-only occurrences, drops include, extend and steps, and rewrites satisfy and verify as package links.

Case views draw the subject occurrence as the boundary and associated occurrences outside it. Sequence views show the subject, its parts and the associated occurrences as lifelines. A case without statements remains intent: it executes nothing and proves nothing. A passing case script is bounded evidence of one deterministic run, not proof.


---

<a id="chapter-32"></a>

# ADR 0020: Associated software components in tests

Status: accepted for standard 2.2, 10 November 2026. Amends the white-box access clauses of ADR 0019. Published 2.1 artifacts remain unchanged.

[ADR 0021](decisions/0021-case-subject-calls.md) subsequently allows normal calls on the exact primary subject from both case kinds. It supersedes the primary-subject call/effect restrictions below; the additional test inspection/helper boundary remains unchanged.

## Context

The 2.1 test script can inspect only its primary subject and that subject's single parts. An integration spanning existing peer components therefore cannot inspect all of its explicitly associated participants. The owner selected existing associations as the access boundary, with neither new reference syntax nor case-owned components.

## Decision

A test may read attributes and directly call operations of its subject and explicitly associated software component occurrences of its own package, following single effective child occurrences. A root must actually execute in the package run and have a non-multiple identity. Association is a reference to that same occurrence, never containment, cloning or an instruction to select execution roots.

Use cases remain black-box. Both case kinds may act through associated interface-only actor ports, with ordinary direction, ownership and route rules. Associating an active component permits test inspection and eligible direct calls; it does not permit impersonating that component's ports or schedule. A test's direct calls may mutate the target through its operation but must neither communicate nor suspend. Direct attribute assignment remains forbidden. Reads borrow the target's live serial context; calls keep the existing lock and success-only output-copy rules. Multi-component reads do not constitute an atomic snapshot.

Value reads retain lexical local precedence. Dotted operation calls retain their existing occurrence-call namespace. Resolve inherited effective members and preserve exact occurrence identity, including when several references share a definition. An unassociated same-prefix name, an imported foreign occurrence, a platform root or an unindexed multiplicity family does not gain access.

The concrete grammar is unchanged. Existing `of`, `associate` and dotted expression paths carry this meaning. Nested/indexed association paths and intermediate component indexes remain unsupported. `of` remains required for a script; an empty case remains intent only. Every case still starts a fresh whole-package configuration, including unrelated startup work, and stops under the existing bounded result rules.

## Consequences

Shared semantic helpers expose the exact permitted roots and single-part lookup to consumers. Validator, completion, graphical editing and inspection must use that rule consistently. Test collaborators should retain their component identity; an association does not turn an implemented component into a fictional external actor. Presentation visibility is not an access permission.

This is a compatible normative addition with a new 2.2 draft edition, implementation 3.1.0 and `swaml-reference/2.2`. Hosts select 2.2 semantics even though the source grammar is unchanged. The published 2.1 book/PDF and its source attachments, notes, manifests and checksums are immutable. No 2.2 publication is authorized by implementation alone.

Validation includes accepted associated roots and inherited parts, rejected unassociated roots/use-case access/effectful calls, quoted names, lexical precedence, per-run store isolation, actual routed ten-component integration and exact occurrence evidence in consuming tools.


---

<a id="chapter-33"></a>

# ADR 0021: Normal subject calls from use cases and tests

Status: accepted for standard 2.2, 10 November 2026. Amends the primary-subject call clauses of ADRs 0019 and 0020. Published editions remain unchanged.

## Decision

Both a use case and a test may call operations of their exact primary subject using the existing `subject.operation(arguments)` syntax. The subject remains a referenced top-level software occurrence of the case's package. The case owns no component, and no runner component, implicit port or connection is created.

The call borrows the subject's serial execution context as a local call. Its body may use the subject's own state and ports, communicate, receive and wait. Suspension releases the subject lock; resumption reacquires it and reads live state. The case continues only after the call returns. Stateful operations retain their existing on-start-only rule. Normal suspension-position rules apply: a suspending call is the whole value of an ordinary variable declaration or assignment, or a standalone statement, optionally in `try`. It cannot occupy a for-header initializer/update; evaluate it before the loop. Existing immediate expression calls remain legal.

The interpreter switches the actual running frame into the subject context for the call, rather than executing a copied case frame. It restores the case context and releases the subject lock on normal return and failure. Results and successful output values return to the caller; failed calls do not copy outputs. Ordinary runtime failures remain catchable by `try`; contract and resource violations remain outside it.

This is a local call within the case activation, not a fresh schedule release. It creates no transport queue, route, QoS policy or implicit request timeout and does not release `after` successors on return. The case horizon and existing runtime limits remain effective. Trace consumers preserve source, occurrence and activation context without inventing a separate invocation observation.

## Access boundary

A use case may call only its primary subject's own operations. It cannot inspect private component attributes or directly call subject parts or associated components. Tests additionally retain the private reads and helper calls authorized by ADR 0020: subject and explicitly associated software roots and their single parts. Calls on those extra owners must neither communicate nor suspend. Neither case kind assigns component attributes directly.

Actor interaction remains through associated interface-only actor ports with the existing direction, ownership and explicit-route rules. Association does not permit impersonating an active component's ports or choosing execution roots.

## Sequential actor replies

A direct call is synchronous from the script's perspective. An actor message sent before return remains queued for a later receive. If the subject waits for a reply that the same case would provide in a later `on call` branch, that branch cannot run while the case is blocked. Model an independently behaving actor, or stimulate the subject through an actor event before serving the reply. Do not silently execute later case statements concurrently or turn the call into a fire-and-forget invocation.

## Validation evidence

Require positive use-case and test calls with state/results, own-port emission and request/reply, waits with live-state interleaving, receive, failure/`try`, success-only outputs, context restoration and bounded unfinished calls. Reject use-case private reads, part/peer calls and subject-port impersonation; retain the test-helper restrictions. Graphical creation and completion use the same core call policy and retain the actual case source identity.


---

## Complete concrete grammar

```text
grammar Swaml

entry Model: packages+=Package*;
Package: 'package' name=QualifiedName '{' documentation=Documentation? (imports+=Import | elements+=Element | connections+=Connect | associations+=Association | satisfactions+=Satisfaction | verifications+=Verification)* '}';
Import: 'import' namespace=QualifiedName ';';
Element: DataType | EnumType | ComponentDef | ComponentUsage | PortDef | Operation | QosPolicy | ViewDef | Requirement | Scenario | View | Deployment;
DataType: 'datatype' name=Name '{' documentation=Documentation? fields+=Field* '}';
Field: name=Name ':' type=TypeRef documentation=Documentation? ';';
EnumType: 'enum' name=Name '{' documentation=Documentation? literals+=Name (',' literals+=Name)* '}';
TypeRef: (primitive=('bool'|'byte'|'uint'|'int'|'real'|'string'|'void') | type=[ValueType:QualifiedName]) ('[' size=INT ']')?;
type ValueType = DataType | EnumType;
Argument: (direction=('in'|'out'))? name=Name ':' type=TypeRef;
ComponentDef: 'component' 'def' name=Name ('specializes' specializes=[ComponentDef:QualifiedName])? '{' documentation=Documentation? members+=ComponentMember* '}';
ComponentUsage: (redefines?='redefines')? 'component' name=Name (':' definition=[ComponentDef:QualifiedName] ('[' size=INT ']')?)? (';' | '{' documentation=Documentation? members+=ComponentMember* '}');
ComponentMember: ComponentUsage | PortUsage | Attribute | Operation | OperationUsage | Connect | Schedule;
Attribute: (redefines?='redefines')? (constant?='const')? 'attribute' name=Name ':' type=TypeRef '=' value=Expression documentation=Documentation? ';';
PortDef: 'port' 'def' name=Name '{' documentation=Documentation? members+=PortMember* '}';
PortUsage: (redefines?='redefines')? (optional?='optional')? (reversed?='reversed')? 'port' name=Name (':' definition=[PortDef:QualifiedName] documentation=Documentation? ';' | '{' documentation=Documentation? members+=PortMember* '}');
PortMember: direction=('provides'|'requires') (idempotent?='idempotent')? kind=('attribute'|'event'|'operation') name=Name (':' type=TypeRef ('=' initial=Expression)? | '(' (parameters+=Argument (',' parameters+=Argument)*)? ')' ('returns' result=TypeRef)?) documentation=Documentation? ';';
Connect: (redefines?='redefines')? 'connect' (name=Name)? (':' policy=[QosPolicy:QualifiedName])? '(' source=Path ',' target=Path ')' (documentation=Documentation? ';' | '{' documentation=Documentation? memberPolicies+=MemberPolicy+ '}');
MemberPolicy: member=Name ':' policy=[QosPolicy:QualifiedName] documentation=Documentation? ';';
QosPolicy: 'qos' 'def' name=Name (':' base=QualifiedName)? '{' documentation=Documentation? settings+=PolicySetting* '}';
PolicySetting: name=Name '=' value=Expression ';';
Operation: (redefines?='redefines')? 'operation' (definition?='def')? name=Name '(' (parameters+=Argument (',' parameters+=Argument)*)? ')' ('returns' result=TypeRef)? body=OperationBody;
OperationUsage: (redefines?='redefines')? 'operation' name=Name ':' definition=[Operation:QualifiedName] (documentation=Documentation? ';' | body=OperationBody);
Executable: Operation | OperationUsage;
OperationBody: '{' documentation=Documentation? operations+=Executable* ('initial' initial=Name ';' states+=State+ | statements+=Statement*) '}';
Schedule: 'schedule' '{' entries+=ScheduleEntry* '}';
ScheduleEntry: ('on' (kind='start' | kind='every' (period=Duration | '(' periodValue=Expression ')') | kind=('receive'|'call') endpoint=MemberPath '(' (bindings+=Name (',' bindings+=Name)*)? ')') | kind='after' predecessor=Name) operation=Name '(' (args+=Expression (',' args+=Expression)*)? ')' ('when' '(' guard=Expression ')')? ('deadline' (deadline=Duration | '(' deadlineValue=Expression ')'))? (concurrent?='concurrent')? ';';
Block: '{' statements+=Statement* '}';
Statement: LocalVariable | Assign | Send | ExpressionStatement | Return | If | While | Until | For | ForEach | Wait | Receive | Interruptible | Fail | Assert;
LocalVariable: 'var' name=Name ':' type=TypeRef '=' value=Expression ';';
Assign: target=ValuePath ('[' index=Expression ']' selectors+=Selector*)? '=' value=Expression ';';
Selector: '.' field=Name | '[' index=Expression ']';
ExpressionStatement: expression=OrExpression ';';
Send: kind=('send'|'publish') endpoint=EndpointPath '(' (args+=Expression (',' args+=Expression)*)? ')' ';';
Return: 'return' value=Expression? ';';
If: 'if' '(' condition=Expression ')' then=Block ('else' otherwise=Block)?;
While: 'while' '(' condition=Expression (',' limit=Expression 'times')? ')' body=Block;
Until: 'until' '(' condition=Expression (',' limit=Expression 'times')? ')' body=Block;
For: 'for' '(' initializer=LocalVariable condition=Expression ';' update=ForUpdate ')' body=Block;
ForUpdate infers Assign: target=Name '=' value=Expression;
ForEach: 'for' '(' variable=Argument 'in' collection=Expression ')' body=Block;
Wait: 'wait' (duration=Duration | '(' delay=Expression ')') ';';
Receive: 'on' branches+=ReceiveBranch ('or' branches+=ReceiveBranch)* ('or' 'after' (timeout=Duration | '(' timeoutValue=Expression ')') timeoutBody=Block)?;
ReceiveBranch: kind=('receive'|'call') endpoint=EndpointPath '(' (bindings+=Name (',' bindings+=Name)*)? ')' body=Block;
Interruptible: 'interruptible' body=Block 'on' 'receive' endpoint=MemberPath '(' (bindings+=Name (',' bindings+=Name)*)? ')' handler=Block;
Fail: 'fail' reason=STRING ';';
Assert: 'assert' condition=Expression ';';
State: (final?='final')? 'state' name=Name '{' documentation=Documentation? (actions+=StateAction | transitions+=Transition | deferrals+=Deferral)* '}';
StateAction: 'on' kind=('entry'|'exit') body=Block;
interface Transition { endpoint?: string; bindings?: string[]; guard?: Expression; delay?: Duration; delayValue?: Expression; target?: string; effect: Block; }
Transition returns Transition: ('on' 'receive' endpoint=MemberPath '(' (bindings+=Name (',' bindings+=Name)*)? ')' ('when' '(' guard=Expression ')')? | 'after' (delay=Duration | '(' delayValue=Expression ')') ('when' '(' guard=Expression ')')? | 'when' '(' guard=Expression ')') ('to' target=Name)? effect=Block;
Deferral: 'defer' endpoints+=MemberPath (',' endpoints+=MemberPath)* ';';
Deployment: 'deployment' name=Name 'of' root=[ComponentUsage:QualifiedName] 'on' platform=[ComponentUsage:QualifiedName] '{' documentation=Documentation? placements+=Placement* '}';
Placement: 'deploy' target=Path? 'on' node=Path ';';
Requirement: 'requirement' name=Name '{' documentation=Documentation? attributes+=Attribute* '}';
Documentation: text=DOC_COMMENT;
Satisfaction: 'satisfy' requirement=[Requirement:QualifiedName] 'by' design=Path ';';
Verification: 'verify' requirement=[Requirement:QualifiedName] 'by' test=[Scenario:Name] ';';
Association: 'associate' occurrence=[ComponentUsage:Name] (',' moreOccurrences+=[ComponentUsage:Name])* 'to' target=[Scenario:Name] (',' moreTargets+=[Scenario:Name])* ';';
Scenario: kind=CaseKind name=Name ('of' subject=[ComponentUsage:Name])? '{' documentation=Documentation? statements+=Statement* '}';
CaseKind returns string: 'use' 'case' | 'test';
ViewDef: 'view' 'def' name=Name documentation=Documentation? ';';
View: 'view' name=Name ':' definition=[ViewDef:QualifiedName] ('of' subject=Path documentation=Documentation? ';' | '{' documentation=Documentation? selections+=ViewSelection+ '}');
ViewSelection: 'include' subject=Path (recursive?='recursive')? ('where' filter=FilterExpression)? ';';
type FilterExpression = FilterBinary | FilterNot | FilterComparison;
FilterExpression returns FilterExpression: FilterOr;
FilterOr returns FilterExpression: FilterAnd ({infer FilterBinary.left=current} operator='or' right=FilterAnd)*;
FilterAnd returns FilterExpression: FilterPrimary ({infer FilterBinary.left=current} operator='and' right=FilterPrimary)*;
FilterPrimary returns FilterExpression: {infer FilterNot} 'not' operand=FilterPrimary | FilterComparison | '(' FilterExpression ')';
FilterComparison: field=('name'|'kind'|'path') operator=('=='|'!=') value=STRING;
Duration: value=INT unit=('ns'|'us'|'ms'|'s');
Name returns string: ID | UNRESTRICTED_NAME | 'reversed' | 'to' | 'times' | 'name' | 'kind' | 'path' | 'use' | 'case' | 'test' | 'associate' | 'by' | 'ns' | 'us' | 'ms' | 's' | 'defer' | 'view' | 'state' | 'in' | 'out';
MemberPath returns string: Name '.' Name;
EndpointPath returns string: Name '.' Name ('.' Name)?;
Path returns string: QualifiedName ('[' INT ']')? ('.' Name ('[' INT ']')?)*;
QualifiedName returns string: Name ('::' Name)*;
ValuePath returns string: QualifiedName ('.' Name)*;
type Expression = ConditionalExpression | BinaryExpression | UnaryExpression | Literal | CallExpression | TryExpression | ReferenceExpression | RecordLiteral | ArrayLiteral;
// Expression is ConditionalExpression | OrExpression (WP2-G01). The binary chains of OrExpression down to
// MultiplicativeExpression are written out here rather than called, one loop per precedence level from the highest:
// each loop extends the expression so far as its left operand and takes its right operands from the next higher level,
// which builds the same tree as the called rules. A nesting level then costs three rule calls instead of nine, so valid
// nesting parses deeper than in 2.2 although the alternation adds a parser frame (WP2-D05). The rule stays on one line
// for the inventories (scripts/build-inventories.mjs reads productions line by line).
Expression returns Expression: ConditionalExpression | UnaryExpression ({infer BinaryExpression.left=current} operator=('*'|'/'|'%') right=UnaryExpression)* ({infer BinaryExpression.left=current} operator=('+'|'-') right=MultiplicativeExpression)* ({infer BinaryExpression.left=current} operator=('<'|'<='|'>'|'>=') right=AdditiveExpression)* ({infer BinaryExpression.left=current} operator=('=='|'!=') right=RelationalExpression)* ({infer BinaryExpression.left=current} operator='and' right=EqualityExpression)* ({infer BinaryExpression.left=current} operator='or' right=AndExpression)*;
ConditionalExpression: 'if' '(' condition=Expression ')' then=Expression 'else' otherwise=Expression;
OrExpression returns Expression: AndExpression ({infer BinaryExpression.left=current} operator='or' right=AndExpression)*;
AndExpression returns Expression: EqualityExpression ({infer BinaryExpression.left=current} operator='and' right=EqualityExpression)*;
EqualityExpression returns Expression: RelationalExpression ({infer BinaryExpression.left=current} operator=('=='|'!=') right=RelationalExpression)*;
RelationalExpression returns Expression: AdditiveExpression ({infer BinaryExpression.left=current} operator=('<'|'<='|'>'|'>=') right=AdditiveExpression)*;
AdditiveExpression returns Expression: MultiplicativeExpression ({infer BinaryExpression.left=current} operator=('+'|'-') right=MultiplicativeExpression)*;
MultiplicativeExpression returns Expression: UnaryExpression ({infer BinaryExpression.left=current} operator=('*'|'/'|'%') right=UnaryExpression)*;
UnaryExpression returns Expression: {infer UnaryExpression} operator=('not'|'-') operand=UnaryExpression | PrimaryExpression;
PrimaryExpression returns Expression: Literal | TryExpression | CallExpression | ReferenceExpression | RecordLiteral | ArrayLiteral | '(' Expression ')';
TryExpression: 'try' '(' expression=Expression (',' fallback=Expression)? ')';
CallExpression: target=Path '(' (args+=Expression (',' args+=Expression)*)? ')';
ReferenceExpression: path=ValuePath ('[' index=Expression ']' selectors+=Selector*)?;
Literal: {infer Literal} (number=Numeric | text=STRING | boolean=('true'|'false') | duration=Duration);
RecordLiteral: 'record' type=[DataType:QualifiedName] '{' fields+=FieldValue* '}';
FieldValue: name=Name '=' value=Expression ';';
ArrayLiteral: '[' (values+=Expression (',' values+=Expression)*)? ']';
Numeric returns number: NUMBER | INT;
hidden terminal WS: /\s+/;
terminal DOC_COMMENT: /\/\*\*(?:\/|[\s\S]*?\*\/)/;
terminal ID: /[_a-zA-Z][\w]*/;
terminal UNRESTRICTED_NAME: /'([^'\\\x00-\x1F\x7F]|\\['\\])*'/;
terminal NUMBER returns number: /[0-9]+\.[0-9]+/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"([^"\\\x00-\x1F]|\\["\\nrt])*"/;
hidden terminal ML_COMMENT: /\/\*(?!\*)[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
```

## Worked model sources

### 01-hello.swaml

```swaml
package Hello {
  port def Messages {
    provides event message(value: string);
  }
  component def Sender {
    port output: Messages;
    operation emit() {
      publish output.message("Hello, SWAML");
    }
    schedule {
      on start emit();
    }
  }
  component def Receiver {
    reversed port input: Messages;
    attribute last: string = "";
    operation accept(value: string) {
      last = value;
    }
    schedule {
      on receive input.message(value) accept(value);
    }
  }
  component Demo {
    component sender: Sender;
    component receiver: Receiver;
    connect (sender.output, receiver.input);
  }
}
```

### 02-realtime-controller.swaml

```swaml
package Control {
  import Swaml::Views;
  port def Temperature {
    provides attribute temperature: real;
  }
  port def Commands {
    provides event set(value: real);
  }
  component def Sensor {
    port reading: Temperature;
    operation sample() {
      wait 1ms;
      send reading.temperature(18.5);
    }
    schedule {
      on every 10ms sample();
    }
  }
  component def Controller {
    reversed port reading: Temperature;
    port command: Commands;
    attribute target: real = 21.0;
    operation regulate(measured: real) {
      var power: real = (target - measured) * 0.1;
      publish command.set(power);
    }
    schedule {
      on receive reading.temperature(t) regulate(t) deadline 5ms;
    }
  }
  component def Heater {
    reversed port command: Commands;
    attribute power: real = 0.0;
    operation apply(value: real) {
      power = value;
    }
    schedule {
      on receive command.set(value) apply(value);
    }
  }
  component Demo {
    component sensor: Sensor;
    component controller: Controller;
    component heater: Heater;
    connect samples (sensor.reading, controller.reading);
    connect commands (controller.command, heater.command);
  }
  requirement Responsive {
    attribute limitMs: uint = 5;
  }
  test ControlLoop of Demo {
    /** A sample reaches the controller, which commands the heater within its deadline. */
    wait 12ms;
    assert Demo.heater.power > 0.2 and Demo.heater.power < 0.3;
  }
  satisfy Responsive by Demo.controller;
  verify Responsive by ControlLoop;
  view overview: General of Demo;
  view intent: Case of ControlLoop;
  view sequence: Sequence of ControlLoop;
  view inventory: Grid of Demo;
  view architecture: Interconnect of Demo;
  view logic: Flow of Demo.controller.regulate;
  view timing: Timing of Demo.sensor.sample;
}
```

### 03-service-pubsub.swaml

```swaml
package Commerce {
  import Swaml::Qos;
  port def Catalog {
    provides idempotent operation get(key: int) returns real;
    provides event changed(key: int);
  }
  component def Store {
    port api: Catalog;
    attribute value: real = 4.5;
    operation get(key: int) returns real {
      wait 1ms;
      return value;
    }
    operation announce() {
      publish api.changed(1);
    }
    schedule {
      on call api.get(k) get(k);
      on start announce();
    }
  }
  component def Client {
    reversed port api: Catalog;
    attribute last: real = 0.0;
    attribute changedKey: int = 0;
    operation read() {
      last = try(api.get(1), - 1.0);
    }
    operation changed(key: int) {
      changedKey = key;
    }
    schedule {
      on start read();
      on receive api.changed(k) changed(k);
    }
  }
  component Demo {
    component store: Store;
    component client: Client;
    connect catalog: Reliable (store.api, client.api);
  }
}
```

### 04-stateful-function.swaml

```swaml
package States {
  import Swaml::Views;
  component Demo {
    attribute lit: bool = false;
    operation lamp() {
      initial Off;
      state Off {
        after 2ms to On {
        }
      }
      state On {
        on entry {
          lit = true;
        } on exit {
          lit = false;
        }
        after 3ms to Done {
        }
      }
      final state Done {
      }
    }
    schedule {
      on start lamp();
    }
  }
  view states: Flow of Demo.lamp;
}
```

### 05-values-and-flow.swaml

```swaml
package Values {
  import Swaml::Math;
  datatype Reading {
    value: real;
    unit: string;
  }
  enum Mode {
    idle, active
  }
  component Demo {
    attribute sum: int = 0;
    attribute mode: Mode = Mode.idle;
    attribute reading: Reading = record Reading {
      value = 4.5;
      unit = "C";
    };
    operation add(a: int, b: int) returns int {
      return a + b;
    }
    operation boot() {
      var values: int[3] =[1, 2, 3];
      for (value: int in values) {
        sum = add(sum, value);
      }
      mode = Mode.active;
    }
    schedule {
      on start boot();
    }
  }
}
```

### 06-mixed-gateway.swaml

```swaml
package Gateway {
  port def Messages {
    provides event message(value: int);
  }
  component def Sender {
    port output: Messages;
    operation emit() {
      publish output.message(9);
    }
    schedule {
      on start emit();
    }
  }
  component def Receiver {
    reversed port input: Messages;
    attribute last: int = 0;
    operation accept(value: int) {
      last = value;
    }
    schedule {
      on receive input.message(value) accept(value);
    }
  }
  component Demo {
    component sender: Sender;
    component receiver: Receiver;
    connect (sender.output, receiver.input);
  }
}
```

### 07-client-server.swaml

```swaml
package ClientServer {
  import Swaml::Qos;
  port def Catalog {
    provides idempotent operation get(key: int) returns real;
    provides event changed(key: int);
  }
  component def Store {
    port api: Catalog;
    attribute value: real = 4.5;
    operation get(key: int) returns real {
      wait 1ms;
      return value;
    }
    operation announce() {
      publish api.changed(1);
    }
    schedule {
      on call api.get(k) get(k);
      on start announce();
    }
  }
  component def Client {
    reversed port api: Catalog;
    attribute last: real = 0.0;
    attribute changedKey: int = 0;
    operation read() {
      last = try(api.get(1), - 1.0);
    }
    operation changed(key: int) {
      changedKey = key;
    }
    schedule {
      on start read();
      on receive api.changed(k) changed(k);
    }
  }
  component Demo {
    component store: Store;
    component client: Client;
    connect catalog: Reliable (store.api, client.api);
  }
}
```

### 08-service-field.swaml

```swaml
package Settings {
  import Swaml::Qos;
  port def Catalog {
    provides idempotent operation get(key: int) returns real;
    provides event changed(key: int);
  }
  component def Store {
    port api: Catalog;
    attribute value: real = 4.5;
    operation get(key: int) returns real {
      wait 1ms;
      return value;
    }
    operation announce() {
      publish api.changed(1);
    }
    schedule {
      on call api.get(k) get(k);
      on start announce();
    }
  }
  component def Client {
    reversed port api: Catalog;
    attribute last: real = 0.0;
    attribute changedKey: int = 0;
    operation read() {
      last = try(api.get(1), - 1.0);
    }
    operation changed(key: int) {
      changedKey = key;
    }
    schedule {
      on start read();
      on receive api.changed(k) changed(k);
    }
  }
  component Demo {
    component store: Store;
    component client: Client;
    connect catalog: Reliable (store.api, client.api);
  }
}
```

### 09-component-roots.swaml

```swaml
package Roots {
  component def Counter {
    attribute count: int = 0;
    operation increment() {
      count = count + 1;
    }
    operation boot() {
      increment();
    }
    schedule {
      on start boot();
    }
  }
  component def Fast specializes Counter {
    redefines operation increment() {
      count = count + 2;
    }
  }
  component Demo {
    component left: Counter {
      redefines attribute count: int = 10;
    }
    component right: Fast;
  }
}
```

### 10-reusable-qos.swaml

```swaml
package Policies {
  import Swaml::Qos;
  qos def Small: Policy {
    delivery = Delivery.atMostOnce;
    ordering = Ordering.fifo;
    capacity = 2;
    overflow = Overflow.reject;
    requestTimeout = 50ms;
  }
  port def Messages {
    provides event message(value: int);
  }
  component def Sender {
    port output: Messages;
    operation emit() {
      publish output.message(7);
    }
    schedule {
      on start emit();
    }
  }
  component def Receiver {
    reversed port input: Messages;
    attribute last: int = 0;
    operation accept(value: int) {
      last = value;
    }
    schedule {
      on receive input.message(value) accept(value);
    }
  }
  component Demo {
    component sender: Sender;
    component receiver: Receiver;
    connect delivery: Small (sender.output, receiver.input);
  }
}
```

### 11-autosar-classic.swaml

```swaml
package Classic {
  import Swaml::Views;
  port def Temperature {
    provides attribute temperature: real;
  }
  port def Commands {
    provides event set(value: real);
  }
  component def Sensor {
    port reading: Temperature;
    operation sample() {
      send reading.temperature(18.5);
    }
    schedule {
      on every 10ms sample();
    }
  }
  component def Controller {
    reversed port reading: Temperature;
    port command: Commands;
    attribute target: real = 21.0;
    operation regulate(measured: real) {
      var power: real = (target - measured) * 0.1;
      publish command.set(power);
    }
    schedule {
      on receive reading.temperature(t) regulate(t) deadline 5ms;
    }
  }
  component def Heater {
    reversed port command: Commands;
    attribute power: real = 0.0;
    operation apply(value: real) {
      power = value;
    }
    schedule {
      on receive command.set(value) apply(value);
    }
  }
  component Demo {
    component sensor: Sensor;
    component controller: Controller;
    component heater: Heater;
    connect samples (sensor.reading, controller.reading);
    connect commands (controller.command, heater.command);
  }
  view architecture: Interconnect of Demo;
  view logic: Flow of Demo.controller.regulate;
  view timing: Timing of Demo.sensor.sample;
}
```

### 12-autosar-adaptive.swaml

```swaml
package Adaptive {
  import Swaml::Qos;
  port def Catalog {
    provides idempotent operation get(key: int) returns real;
    provides event changed(key: int);
  }
  component def Store {
    port api: Catalog;
    attribute value: real = 4.5;
    operation get(key: int) returns real {
      wait 1ms;
      return value;
    }
    operation announce() {
      publish api.changed(1);
    }
    schedule {
      on call api.get(k) get(k);
      on start announce();
    }
  }
  component def Client {
    reversed port api: Catalog;
    attribute last: real = 0.0;
    attribute changedKey: int = 0;
    operation read() {
      last = try(api.get(1), - 1.0);
    }
    operation changed(key: int) {
      changedKey = key;
    }
    schedule {
      on start read();
      on receive api.changed(k) changed(k);
    }
  }
  component Demo {
    component store: Store;
    component client: Client;
    connect catalog: Reliable (store.api, client.api);
  }
}
```

### 13-web-application.swaml

```swaml
package Web {
  import Swaml::Qos;
  port def Catalog {
    provides idempotent operation get(key: int) returns real;
    provides event changed(key: int);
  }
  component def Store {
    port api: Catalog;
    attribute value: real = 4.5;
    operation get(key: int) returns real {
      wait 1ms;
      return value;
    }
    operation announce() {
      publish api.changed(1);
    }
    schedule {
      on call api.get(k) get(k);
      on start announce();
    }
  }
  component def Client {
    reversed port api: Catalog;
    attribute last: real = 0.0;
    attribute changedKey: int = 0;
    operation read() {
      last = try(api.get(1), - 1.0);
    }
    operation changed(key: int) {
      changedKey = key;
    }
    schedule {
      on start read();
      on receive api.changed(k) changed(k);
    }
  }
  component Demo {
    component store: Store;
    component client: Client;
    connect catalog: Reliable (store.api, client.api);
  }
}
```

### 14-cloud-service.swaml

```swaml
package Cloud {
  import Swaml::Qos;
  port def Catalog {
    provides idempotent operation get(key: int) returns real;
    provides event changed(key: int);
  }
  component def Store {
    port api: Catalog;
    attribute value: real = 4.5;
    operation get(key: int) returns real {
      wait 1ms;
      return value;
    }
    operation announce() {
      publish api.changed(1);
    }
    schedule {
      on call api.get(k) get(k);
      on start announce();
    }
  }
  component def Client {
    reversed port api: Catalog;
    attribute last: real = 0.0;
    attribute changedKey: int = 0;
    operation read() {
      last = try(api.get(1), - 1.0);
    }
    operation changed(key: int) {
      changedKey = key;
    }
    schedule {
      on start read();
      on receive api.changed(k) changed(k);
    }
  }
  component Demo {
    component store: Store;
    component client: Client;
    connect catalog: Reliable (store.api, client.api);
  }
}
```

### 15-component-specialization.swaml

```swaml
package Reuse {
  component def Counter {
    attribute count: int = 0;
    operation increment() {
      count = count + 1;
    }
    operation boot() {
      increment();
    }
    schedule {
      on start boot();
    }
  }
  component def Fast specializes Counter {
    redefines operation increment() {
      count = count + 2;
    }
  }
  component Demo {
    component left: Counter {
      redefines attribute count: int = 10;
    }
    component right: Fast;
  }
}
```

### 16-requirements-and-views.swaml

```swaml
package Traceability {
  import Swaml::Views;
  port def Messages {
    provides event message(value: string);
  }
  component def Sender {
    port output: Messages;
    operation emit() {
      publish output.message("Hello, SWAML");
    }
    schedule {
      on start emit();
    }
  }
  component def Receiver {
    reversed port input: Messages;
    attribute last: string = "";
    operation accept(value: string) {
      last = value;
    }
    schedule {
      on receive input.message(value) accept(value);
    }
  }
  requirement Delivery {
    /** One named routed message reaches the receiver. */
    attribute description: string = "Deliver startup message";
  }
  component Demo {
    component sender: Sender;
    component receiver: Receiver;
    connect (sender.output, receiver.input);
  }
  test Startup of Demo {
    /** The startup greeting reaches the receiver. */
    wait 1ms;
    assert Demo.receiver.last == "Hello, SWAML";
  }
  satisfy Delivery by Demo.receiver;
  verify Delivery by Startup;
  view overview: General of Demo;
  view delivery: Sequence of Startup;
}
```

### 17-function-timing.swaml

```swaml
package Timing {
  import Swaml::Views;
  component Demo {
    attribute count: int = 0;
    operation sample() {
      wait 1ms;
      count = count + 1;
    }
    schedule {
      on every 5ms sample() deadline 3ms;
    }
  }
  view observed: Timing of Demo.sample;
}
```

### 18-control-loops.swaml

```swaml
package Loops {
  component Demo {
    attribute count: int = 0;
    operation boot() {
      while (count < 2, 3 times) {
        count = count + 1;
      }
      until (count == 4, 5 times) {
        count = count + 1;
      }
      for (var i: int = 0; i < 2; i = i + 1) {
        count = count + i;
      }
      for (x: int in[1, 2]) {
        count = count + x;
      }
    }
    schedule {
      on start boot();
    }
  }
}
```

### 19-interruptible-function.swaml

```swaml
package Interrupts {
  port def Messages {
    provides event message(value: int);
  }
  component def Sender {
    port output: Messages;
    operation emit() {
      wait 2ms;
      publish output.message(5);
    }
    schedule {
      on start emit();
    }
  }
  component def Receiver {
    reversed port input: Messages;
    attribute last: int = 0;
    operation work() {
      interruptible {
        wait 8ms;
        last = 99;
      } on receive input.message(value) {
        last = value;
      }
    }
    schedule {
      on start work();
    }
  }
  component Demo {
    component sender: Sender;
    component receiver: Receiver;
    connect (sender.output, receiver.input);
  }
}
```

### 20-classes-and-operations.swaml

```swaml
package Operations {
  operation def Clamp(v: real, lo: real, hi: real) returns real {
    if (v < lo) {
      return lo;
    }
    if (v > hi) {
      return hi;
    }
    return v;
  }
  component Demo {
    attribute result: real = 0.0;
    operation clamp: Clamp;
    operation low: Clamp {
      return lo;
    }
    operation boot() {
      operation double(v: real) returns real {
        return v * 2.0;
      }
      result = clamp(double(4.0), 0.0, 5.0);
    }
    schedule {
      on start boot();
    }
  }
}
```

### 21-receive-and-try.swaml

```swaml
package Receiving {
  port def Messages {
    provides event message(value: int);
  }
  component def Sender {
    port output: Messages;
    operation emit() {
      publish output.message(8);
    }
    schedule {
      on start emit();
    }
  }
  component def Receiver {
    reversed port input: Messages;
    attribute last: int = 0;
    operation work() {
      wait 2ms;
      on receive input.message(value) {
        last = value;
      } or after 1ms {
        last = - 1;
      }
    }
    schedule {
      on start work();
    }
  }
  component Demo {
    component sender: Sender;
    component receiver: Receiver;
    connect (sender.output, receiver.input);
  }
}
```

### 22-platform-deployment.swaml

```swaml
package Placement {
  import Swaml::Platform;
  component def Worker {
    attribute count: int = 0;
    operation boot() {
      count = count + 1;
    }
    schedule {
      on start boot();
    }
  }
  component Demo {
    component workers: Worker[3];
  }
  component def Ecu specializes Node {
    const attribute cores: uint = 2;
    const attribute ref: string = "sysml:Vehicle::ecu";
    component os: Partition;
  }
  component Vehicle: Platform {
    component front: Ecu;
    component rear: Ecu[2];
  }
  deployment OnVehicle of Demo on Vehicle {
    deploy on front;
    deploy workers on rear[0];
    deploy workers[2] on rear[1];
  }
}
```

### 23-multiplicity.swaml

```swaml
package Multiplicity {
  component def Counter {
    attribute count: int = 0;
    operation increment() {
      count = count + 1;
    }
    operation boot() {
      increment();
    }
    schedule {
      on start boot();
    }
  }
  component def Fast specializes Counter {
    redefines operation increment() {
      count = count + 2;
    }
  }
  component Demo {
    component counters: Counter[3];
  }
}
```

### 24-operation-usage.swaml

```swaml
package OperationUsage {
  operation def Clamp(v: real, lo: real, hi: real) returns real {
    if (v < lo) {
      return lo;
    }
    if (v > hi) {
      return hi;
    }
    return v;
  }
  component Demo {
    attribute result: real = 0.0;
    operation clamp: Clamp;
    operation low: Clamp {
      return lo;
    }
    operation boot() {
      operation double(v: real) returns real {
        return v * 2.0;
      }
      result = clamp(double(4.0), 0.0, 5.0);
    }
    schedule {
      on start boot();
    }
  }
}
```

### 25-function-completion.swaml

```swaml
package Chaining {
  component Demo {
    attribute count: int = 0;
    operation load() {
      wait 1ms;
      count = 1;
    }
    operation report() {
      count = count + 1;
    }
    schedule {
      on start load();
      after load report();
    }
  }
}
```

### 26-boundary-forwarding.swaml

```swaml
package Boundary {
  port def Temperature {
    provides attribute temperature: real;
  }
  component def Sensor {
    port reading: Temperature;
    operation sample() {
      send reading.temperature(18.5);
    }
    schedule {
      on start sample();
    }
  }
  component def Composite {
    port boundary: Temperature;
    component child: Sensor;
    connect (boundary, child.reading);
  }
  component def Display {
    reversed port reading: Temperature;
    attribute last: real = 0.0;
    operation display(value: real) {
      last = value;
    }
    schedule {
      on receive reading.temperature(value) display(value);
    }
  }
  component Demo {
    component source: Composite;
    component display: Display;
    connect (source.boundary, display.reading);
  }
}
```

### 27-mixed-port.swaml

```swaml
package Mixed {
  /** One boundary may combine data, event and operation members. */
  port def Boundary {
    provides attribute value: real;
    requires event reset();
    provides operation read() returns real;
    requires operation acknowledge();
  }
}
```

### 28-use-cases.swaml

```swaml
package 'Cash Machine' {
  import Swaml::Views;
  port def Panel {
    provides event cardInserted(cardId: string);
    provides event cashRequested(amount: uint);
    requires event cashDispensed(amount: uint);
  }
  port def Authorization {
    requires operation authorize(cardId: string, amount: uint) returns bool;
  }
  component def Customer {
    /** Actor: a bank customer at the machine. Interface-only: the use cases act through its panel. */
    port panel: Panel;
  }
  component def 'ATM Controller' {
    /** The system under consideration: the subject of the machine's use cases. */
    reversed port panel: Panel;
    port bank: Authorization;
    attribute card: string = "";
    operation remember(cardId: string) {
      card = cardId;
    }
    operation withdraw(amount: uint) {
      var approved: bool = bank.authorize(card, amount);
      if (approved) {
        publish panel.cashDispensed(amount);
      }
    }
    schedule {
      on receive panel.cardInserted(cardId) remember(cardId);
      on receive panel.cashRequested(amount) withdraw(amount);
    }
  }
  component def Bank {
    /** Actor: the card issuer's authorization service. */
    reversed port link: Authorization;
    operation authorize(cardId: string, amount: uint) returns bool {
      return amount <= 500;
    }
    schedule {
      on call link.authorize(cardId, amount) authorize(cardId, amount);
    }
  }
  requirement 'Cash limit' {
    /** A single withdrawal never exceeds the limit. */
    attribute limit: uint = 500;
  }
  component customer: Customer;
  component atm: 'ATM Controller';
  component bank: Bank;
  connect (customer.panel, atm.panel);
  connect (atm.bank, bank.link);
  use case 'Withdraw cash' of atm {
    /** The customer inserts a card, asks for cash and receives it. */
    publish customer.panel.cardInserted("4711");
    publish customer.panel.cashRequested(100);
    on receive customer.panel.cashDispensed(amount) {
      assert amount == 100;
    } or after 2s {
      fail "no cash dispensed";
    }
  }
  use case Authenticate of atm {
    /** The machine reads the card before any transaction. */
    publish customer.panel.cardInserted("4711");
  }
  use case 'Print receipt' of atm {
    /** A receipt may follow a withdrawal. */
  }
  test 'Limit honoured' of atm {
    /** A request above the limit is refused by the bank: no cash, and the card stays known. */
    publish customer.panel.cardInserted("4711");
    publish customer.panel.cashRequested(600);
    on receive customer.panel.cashDispensed(amount) {
      fail "cash above the limit";
    } or after 1s {
    }
    assert atm.card == "4711";
  }
  use case 'Open a branch' {
    /** A use case without of states intent before its subject is chosen. */
  }
  associate customer to 'Withdraw cash';
  associate bank to 'Withdraw cash';
  associate customer to Authenticate;
  associate customer to 'Print receipt';
  associate customer to 'Limit honoured';
  associate bank to 'Limit honoured';
  satisfy 'Cash limit' by Bank;
  verify 'Cash limit' by 'Limit honoured';
  view 'use cases': Case of 'Cash Machine';
  view withdrawal: Sequence of 'Withdraw cash';
}
```

### 29-executable-cases.swaml

```swaml
package Banking {
  import Swaml::Views;
  port def Panel {
    provides attribute amount: uint;
    provides event cashRequested();
    requires event cashOut(paid: uint);
    requires event refused();
  }
  port def BankLink {
    requires operation authorize(amount: uint) returns bool;
  }
  port def Cash {
    provides event pay(amount: uint);
  }
  requirement 'Cash limit' {
    /** Withdrawals above the limit are refused. */
    attribute limit: uint = 500;
  }
  component def Customer {
    /** Actor: a customer at the machine. Interface-only: a case script acts through its panel. */
    port panel: Panel;
  }
  component def Controller {
    reversed port panel: Panel;
    port link: BankLink;
    port cash: Cash;
    attribute amount: uint = 0;
    operation remember(value: uint) {
      amount = value;
    }
    operation withdraw() {
      var requested: uint = amount;
      var approved: bool = link.authorize(requested);
      if (approved) {
        publish cash.pay(requested);
        publish panel.cashOut(requested);
      } else {
        publish panel.refused();
      }
    }
    schedule {
      on receive panel.amount(value) remember(value);
      on receive panel.cashRequested() withdraw();
    }
  }
  component def Dispenser {
    reversed port cash: Cash;
    attribute count: uint = 0;
    attribute dispensedToday: uint = 0;
    operation pay(amount: uint) {
      count = count + 1;
      dispensedToday = dispensedToday + amount;
    }
    schedule {
      on receive cash.pay(amount) pay(amount);
    }
  }
  component def ATM {
    /** The machine: a controller and a cash dispenser behind one panel and one bank link. */
    reversed port panel: Panel;
    port link: BankLink;
    component controller: Controller;
    component dispenser: Dispenser;
    connect (panel, controller.panel);
    connect (link, controller.link);
    connect (controller.cash, dispenser.cash);
    operation fee(amount: real, percent: real) returns real {
      return amount * percent / 100.0;
    }
  }
  component def BankHost {
    reversed port link: BankLink;
    operation authorize(amount: uint) returns bool {
      return amount <= 500;
    }
    schedule {
      on call link.authorize(amount) authorize(amount);
    }
  }
  component atm: ATM;
  component customer: Customer;
  component bank: BankHost;
  connect (customer.panel, atm.panel);
  connect (atm.link, bank.link);
  use case Withdraw of atm {
    /** A customer withdraws 200 within the limit. */
    send customer.panel.amount(200);
    publish customer.panel.cashRequested();
    on receive customer.panel.cashOut(paid) {
      assert paid == 200;
    } or after 2s {
      fail "no cash";
    }
  }
  associate customer to Withdraw;
  associate bank to Withdraw;
  satisfy 'Cash limit' by atm;
  view withdrawal: Sequence of Withdraw;
}
package AtmTests {
  /** An isolation package: the machine under test with an interface-only bank stub. */
  import Swaml::Views;
  import Banking;
  component def BankPeer {
    /** Stub: the test answers authorization requests itself. */
    reversed port link: BankLink;
  }
  component atm: ATM;
  component customer: Customer;
  component bank: BankPeer;
  connect (customer.panel, atm.panel);
  connect (atm.link, bank.link);
  test 'Fee rounding' of atm {
    assert atm.fee(20, 10) == 2;
  }
  test 'Bank refusal' of atm {
    /** The bank refuses: the machine refuses the customer and pays nothing. */
    send customer.panel.amount(100);
    publish customer.panel.cashRequested();
    on call bank.link.authorize(amount) {
      assert amount == 100;
      return false;
    } or after 1s {
      fail "no authorization request";
    }
    on receive customer.panel.refused() {
    } or after 1s {
      fail "not refused";
    }
    assert atm.dispenser.count == 0;
  }
  test 'Approved withdrawal' of atm {
    /** An approved request pays once and counts the amount. */
    send customer.panel.amount(300);
    publish customer.panel.cashRequested();
    on call bank.link.authorize(amount) {
      return amount <= 500;
    } or after 1s {
      fail "no authorization request";
    }
    on receive customer.panel.cashOut(paid) {
      assert paid == 300;
    } or after 1s {
      fail "no cash";
    }
    wait 1ms;
    assert atm.dispenser.count == 1 and atm.dispenser.dispensedToday == 300;
  }
  associate customer to 'Bank refusal';
  associate bank to 'Bank refusal';
  associate customer to 'Approved withdrawal';
  associate bank to 'Approved withdrawal';
  verify 'Cash limit' by 'Bank refusal';
  view refusal: Sequence of 'Bank refusal';
  view checks: Case of AtmTests;
}
```

### 30-associated-integration.swaml

```swaml
package AssociatedIntegration {
  import Swaml::Views;
  port def Values { provides event value(n: int); }
  component def Source {
    port output: Values;
    attribute sent: bool = false;
    operation emit() { sent = true; publish output.value(0); }
    schedule { on start emit(); }
  }
  component def Cell {
    reversed port input: Values;
    optional port output: Values;
    attribute last: int = -1;
    operation accept(n: int) { last = n + 1; publish output.value(last); }
    schedule { on receive input.value(n) accept(n); }
  }
  component source: Source;
  component c2: Cell;
  component c3: Cell;
  component c4: Cell;
  component c5: Cell;
  component c6: Cell;
  component c7: Cell;
  component c8: Cell;
  component c9: Cell;
  component c10: Cell;
  connect (source.output, c2.input);
  connect (c2.output, c3.input);
  connect (c3.output, c4.input);
  connect (c4.output, c5.input);
  connect (c5.output, c6.input);
  connect (c6.output, c7.input);
  connect (c7.output, c8.input);
  connect (c8.output, c9.input);
  connect (c9.output, c10.input);
  test Delivery of source {
    /** Nine real routed deliveries exercise ten existing components. */
    wait 1ns;
    assert source.sent;
    assert c2.last == 1 and c5.last == 4 and c10.last == 9;
  }
  associate c2 to Delivery;
  associate c3 to Delivery;
  associate c4 to Delivery;
  associate c5 to Delivery;
  associate c6 to Delivery;
  associate c7 to Delivery;
  associate c8 to Delivery;
  associate c9 to Delivery;
  associate c10 to Delivery;
  view integration: Sequence of Delivery;
}
```

### 31-case-subject-calls.swaml

```swaml
package SubjectCalls {
  import Swaml::Views;
  port def Status { provides event changed(value: int); }
  component def Counter {
    port status: Status;
    attribute count: int = 0;
    operation advance() returns int {
      count = count + 1;
      wait 1ns;
      publish status.changed(count);
      return count;
    }
  }
  component subject: Counter;
  component observer { reversed port status: Status; }
  connect (subject.status, observer.status);
  use case Advance of subject {
    /** Invoke the subject, then consume the actor message retained during the call. */
    var result: int = subject.advance();
    on receive observer.status.changed(value) {
      assert result == 1 and value == result;
    }
  }
  associate observer to Advance;
  test AdvanceAndInspect of subject {
    var result: int = subject.advance();
    on receive observer.status.changed(value) {
      assert result == 1 and value == subject.count;
    }
  }
  associate observer to AdvanceAndInspect;
  view behavior: Sequence of Advance;
}
```

### 32-calibration-bench.swaml

```swaml
package Calibration {
  /** A calibration bench. A probe reports raw byte counts, and a calibrator converts them through out parameters. Out values are copied back only after a whole successful return: an interrupted conversion leaves its target unchanged. Three bench variants redefine parts of the bench, and a test checks each. Some members are deliberately named with words that are keywords elsewhere (reversed, to, by, case, test, use, name, path, ns, us, ms): in 2.2 they stay ordinary names outside their keyword positions. */
  import Swaml::Qos;
  import Swaml::Views;
  enum Unit {
    ns, us, ms, s
  }
  datatype Approval {
    by: string;
    to: string;
    associate: string;
    case: uint;
  }
  port def Counts {
    provides event sample(raw: byte, times: uint) /** One raw count, seen times in a row. */;
    provides event abort(reason: string, code: uint);
  }
  port def Control {
    provides event hold(code: uint);
  }
  port def Service {
    provides operation calibrate(raw: byte, out gain: real, out unit: Unit);
  }
  operation def Scale(raw: byte, out value: real) returns void {
    value = raw / 255.0;
  }
  component def Probe {
    port reading: Counts;
    attribute reversed: bool = false;
    // Two counts at 1 ms; a reversed probe aborts the conversion of the count it caused at 3.5 ms.
    operation emit() {
      wait 1ms;
      publish reading.sample(200, 2);
      publish reading.sample(100, 1);
      if (reversed) {
        wait 2500us;
        publish reading.abort("reversed wiring", 7);
      }
    }
    schedule {
      on start emit();
    }
  }
  component def ReversedProbe specializes Probe {
    // A port redefinition keeps the port type (SW2003), so it changes no behaviour.
    redefines port reading: Counts /** The same counts, wired in reverse. */;
    redefines attribute reversed: bool = true;
  }
  component def Calibrator {
    port api: Service;
    reversed port input: Counts /** Raw counts from the probe. */;
    reversed port control: Control;
    attribute name: string = "bench";
    attribute path: string = "";
    attribute use: uint = 0;
    attribute test: real = 0.0;
    attribute last: byte = 0;
    attribute approval: Approval = record Approval {
      by = "lab";
      to = "bench";
      associate = "none";
      case = 0;
    };
    operation scale: Scale /** The shared scaling rule. */;
    operation convert(in raw: byte, out value: real) {
      wait 1ms;
      scale(raw, value);
    }
    operation calibrate(raw: byte, out gain: real, out unit: Unit) {
      operation half: Scale {
        value = raw / 510.0;
      }
      half(raw, gain);
      unit = Unit.ms;
    }
    // Takes one queued input at 3 ms: the oldest count, or a hold that arrived first.
    operation listen() {
      wait 3ms;
      on receive input.sample(raw, times) {
        last = raw;
        use = use + times;
        interruptible {
          convert(raw, test);
        } on receive input.abort(reason, code) {
          path = reason;
          approval = record Approval {
            by = name;
            to = path;
            associate = reason;
            case = code;
          };
        }
      } or receive control.hold(code) {
        path = "held";
        use = code;
      }
    }
    schedule {
      on start listen();
      on call api.calibrate(raw, gain, unit) calibrate(raw, gain, unit);
    }
  }
  component def Client {
    reversed port api: Service;
    port control: Control;
    attribute holdFirst: bool = false;
    attribute gain: real = 0.0;
    attribute unit: Unit = Unit.s;
    operation ask() {
      if (holdFirst) {
        publish control.hold(9);
      }
      api.calibrate(102, gain, unit);
    }
    schedule {
      on start ask();
    }
  }
  component def Bench {
    component probe: Probe;
    component calibrator: Calibrator;
    component client: Client;
    connect counts (probe.reading, calibrator.input) /** Raw counts, queued in order. */;
    connect (client.control, calibrator.control);
    connect service (calibrator.api, client.api);
  }
  component Demo: Bench;
  component Reversed: Bench {
    redefines component probe: ReversedProbe;
    redefines connect counts: Latest(probe.reading, calibrator.input) /** Keeps only the newest count. */;
  }
  component Scaled: Bench {
    redefines component calibrator: Calibrator {
      redefines operation scale: Scale {
        value = raw / 100.0;
      }
    }
  }
  component Held: Bench {
    redefines component client: Client {
      redefines attribute holdFirst: bool = true;
    }
  }
  view audit: General {
    include Demo recursive where not (kind == "port") and path != "Demo.client";
  }
  test 'Converted through out parameters' of Demo {
    wait 5ms;
    assert Demo.calibrator.test == 200 / 255.0 and Demo.calibrator.use == 2 and Demo.calibrator.last == 200;
    assert Demo.client.gain == 0.2 and Demo.client.unit == Unit.ms;
  }
  test 'Interrupted conversion copies nothing back' of Reversed {
    wait 5ms;
    assert Reversed.calibrator.last == 100 and Reversed.calibrator.use == 1;
    assert Reversed.calibrator.test == 0.0 and Reversed.calibrator.path == "reversed wiring";
    assert Reversed.calibrator.approval.case == 7 and Reversed.calibrator.approval.to == "reversed wiring";
  }
  test 'Redefined scaling' of Scaled {
    wait 5ms;
    assert Scaled.calibrator.test == 2.0;
  }
  test 'A hold arrives first' of Held {
    wait 5ms;
    assert Held.calibrator.path == "held" and Held.calibrator.use == 9 and Held.calibrator.test == 0.0;
  }
}
```

### 33-element-assignment.swaml

```swaml
package EventMemory {
  /** A diagnostic event memory written twice, as in the door controller's Dem. The 2.2 shape rebuilds the whole counter array with one selection per slot and replaces a whole status record to change one flag. The 2.3 shape assigns the element and the field directly: counters[index] = counter; and statuses[index].confirmed = true;. A test feeds both memories the same reports and checks that they end in the same state. */
  enum Fault {
    voltage, motor, hall
  }
  datatype DtcStatus {
    testFailed: bool;
    pending: bool;
    confirmed: bool;
    occurrences: uint;
  }
  port def Reports {
    provides event report(fault: Fault, failed: bool);
  }
  operation def indexOf(fault: Fault) returns uint {
    if (fault == Fault.voltage) {
      return 0;
    }
    if (fault == Fault.motor) {
      return 1;
    }
    return 2;
  }
  operation def clampInt(v: int, low: int, high: int) returns int {
    if (v < low) {
      return low;
    }
    if (v > high) {
      return high;
    }
    return v;
  }
  operation def pickInt(condition: bool, whenTrue: int, otherwise: int) returns int {
    if (condition) {
      return whenTrue;
    }
    return otherwise;
  }
  operation def pickStatus(condition: bool, whenTrue: DtcStatus, otherwise: DtcStatus) returns DtcStatus {
    if (condition) {
      return whenTrue;
    }
    return otherwise;
  }
  component def Memory {
    /** The counter rules both shapes share: a failed report counts up from zero or above, a passed report counts down from zero or below. */
    reversed port input: Reports;
    const attribute stepUp: int = 2;
    const attribute stepDown: int = 2;
    const attribute failedThreshold: int = 4;
    const attribute passedThreshold: int = -4;
    attribute reports: uint = 0;
    attribute counters: int[3] = [0, 0, 0];
    attribute statuses: DtcStatus[3] = [record DtcStatus {
      testFailed = false;
      pending = false;
      confirmed = false;
      occurrences = 0;
    }, record DtcStatus {
      testFailed = false;
      pending = false;
      confirmed = false;
      occurrences = 0;
    }, record DtcStatus {
      testFailed = false;
      pending = false;
      confirmed = false;
      occurrences = 0;
    }];
    operation next(previous: int, failed: bool) returns int {
      if (failed) {
        return clampInt(pickInt(previous < 0, 0, previous) + stepUp, passedThreshold, failedThreshold);
      }
      return clampInt(pickInt(previous > 0, 0, previous) - stepDown, passedThreshold, failedThreshold);
    }
    operation report(fault: Fault, failed: bool) {
    }
    schedule {
      on receive input.report(fault, failed) report(fault, failed);
    }
  }
  component def Rebuilding specializes Memory {
    /** The 2.2 shape: every change rebuilds a whole array. */
    operation withCounter(index: uint, value: int) {
      counters = [pickInt(index == 0, value, counters[0]), pickInt(index == 1, value, counters[1]), pickInt(index == 2, value, counters[2])];
    }
    operation withStatus(index: uint, value: DtcStatus) {
      statuses = [pickStatus(index == 0, value, statuses[0]), pickStatus(index == 1, value, statuses[1]), pickStatus(index == 2, value, statuses[2])];
    }
    redefines operation report(fault: Fault, failed: bool) {
      reports = reports + 1;
      var index: uint = indexOf(fault);
      var previous: int = counters[index];
      var counter: int = next(previous, failed);
      if (counter == previous) {
        return;
      }
      withCounter(index, counter);
      var status: DtcStatus = statuses[index];
      if (counter >= failedThreshold and not status.testFailed) {
        withStatus(index, record DtcStatus {
          testFailed = true; pending = true; confirmed = true; occurrences = status.occurrences + 1;
        });
      }
      if (counter <= 0 and status.testFailed) {
        withStatus(index, record DtcStatus {
          testFailed = false; pending = status.pending; confirmed = status.confirmed; occurrences = status.occurrences;
        });
      }
    }
  }
  component def Placing specializes Memory {
    /** The 2.3 shape: the element and the fields are assigned in place. */
    redefines operation report(fault: Fault, failed: bool) {
      reports = reports + 1;
      var index: uint = indexOf(fault);
      var previous: int = counters[index];
      var counter: int = next(previous, failed);
      if (counter == previous) {
        return;
      }
      counters[index] = counter;
      if (counter >= failedThreshold and not statuses[index].testFailed) {
        statuses[index].testFailed = true;
        statuses[index].pending = true;
        statuses[index].confirmed = true;
        statuses[index].occurrences = statuses[index].occurrences + 1;
      }
      if (counter <= 0 and statuses[index].testFailed) {
        statuses[index].testFailed = false;
      }
    }
  }
  component rebuilt: Rebuilding;
  component placed: Placing;
  component monitor {
    port output: Reports;
  }
  connect (monitor.output, rebuilt.input);
  connect (monitor.output, placed.input);
  test 'Same memory either way' of placed {
    /** Two failed voltage reports confirm the fault, one failed motor report leaves it pending, and three passed voltage reports heal the voltage counter. */
    publish monitor.output.report(Fault.voltage, true);
    publish monitor.output.report(Fault.voltage, true);
    publish monitor.output.report(Fault.motor, true);
    wait 1ms;
    assert placed.counters[0] == 4 and placed.statuses[0].confirmed and placed.statuses[0].occurrences == 1;
    assert placed.counters[1] == 2 and not placed.statuses[1].testFailed;
    publish monitor.output.report(Fault.voltage, false);
    publish monitor.output.report(Fault.voltage, false);
    publish monitor.output.report(Fault.voltage, false);
    wait 1ms;
    assert placed.counters[0] == -4 and not placed.statuses[0].testFailed and placed.statuses[0].confirmed;
    assert rebuilt.reports == placed.reports and rebuilt.counters == placed.counters and rebuilt.statuses == placed.statuses;
  }
  associate monitor to 'Same memory either way';
  associate rebuilt to 'Same memory either way';
  component def Ledger {
    /** The evaluation order of a place: its index first, then the right side, then one write of the root that keeps what the right side wrote. A bad index is Bounds and leaves the root unchanged. */
    attribute counters: int[3] = [0, 0, 0];
    attribute order: int = 0;
    operation pick() returns int {
      order = order * 10 + 1;
      return 1;
    }
    operation bump() returns int {
      order = order * 10 + 2;
      counters[2] = 40;
      return 7;
    }
    operation put(index: int, value: int) {
      counters[index] = value;
    }
    operation settle() {
      counters[pick()] = bump();
    }
    operation overflow() {
      try(put(3, 99));
      counters[0] = counters[0] + 5;
    }
  }
  component ledger: Ledger;
  test 'Place order and bounds' of ledger {
    ledger.settle();
    assert ledger.order == 12 and ledger.counters == [0, 7, 40];
    ledger.overflow();
    assert ledger.counters == [5, 7, 40];
  }
}
```

### 34-indexed-reads.swaml

```swaml
package FleetBackend {
  /** A fleet backend in the shape of the cloud model's AlertRouter and vehicle twins. The 2.2 shape copies an array element into a local to read one of its fields; the 2.3 shape reads the member after the index, as in recent[i].vehicleId. A test may now also inspect one twin of the family twins[2] by a literal index, reading backend.twins[0].link and calling backend.twins[0].currentView(), instead of testing the twin behaviour on a separate stand-in occurrence. */
  enum AlertStatus {
    open, acknowledged, resolved
  }
  enum LinkState {
    offline, online
  }
  datatype Alert {
    vehicleId: string;
    kind: string;
    status: AlertStatus;
  }
  datatype VehicleView {
    vehicleId: string;
    speed: int;
  }
  component def AlertRouter {
    attribute recent: Alert[4] = [record Alert {
      vehicleId = "TRK-101";
      kind = "overheat";
      status = AlertStatus.resolved;
    }, record Alert {
      vehicleId = "TRK-101";
      kind = "overheat";
      status = AlertStatus.open;
    }, record Alert {
      vehicleId = "VAN-7";
      kind = "overheat";
      status = AlertStatus.open;
    }, record Alert {
      vehicleId = "TRK-101";
      kind = "tyre";
      status = AlertStatus.open;
    }];
    operation findOpenByCopy(vehicle: string, kind: string) returns int {
      /** The 2.2 shape: a copy of each element before reading its fields. */
      for (var i: int = 0; i < 4; i = i + 1) {
        var a: Alert = recent[i];
        if (a.vehicleId == vehicle and a.kind == kind and a.status != AlertStatus.resolved) {
          return i;
        }
      }
      return -1;
    }
    operation findOpen(vehicle: string, kind: string) returns int {
      /** The 2.3 shape: member access after the index. */
      for (var i: int = 0; i < 4; i = i + 1) {
        if (recent[i].vehicleId == vehicle and recent[i].kind == kind and recent[i].status != AlertStatus.resolved) {
          return i;
        }
      }
      return -1;
    }
    operation acknowledge(vehicle: string, kind: string) returns int {
      var i: int = findOpen(vehicle, kind);
      if (i >= 0) {
        recent[i].status = AlertStatus.acknowledged;
      }
      return i;
    }
  }
  component def Twin {
    attribute link: LinkState = LinkState.offline;
    attribute latest: VehicleView = record VehicleView {
      vehicleId = "";
      speed = 0;
    };
    operation attach(vehicle: string) {
      link = LinkState.online;
      latest.vehicleId = vehicle;
    }
    operation report(speed: int) {
      latest.speed = speed;
    }
    operation currentView() returns VehicleView {
      return latest;
    }
  }
  component def Backend {
    component router: AlertRouter;
    component twins: Twin[2];
  }
  component backend: Backend;
  test 'Open alert lookup' of backend {
    /** Both shapes find the same open alert; acknowledging it updates one field of one element. */
    assert backend.router.findOpen("TRK-101", "overheat") == 1 and backend.router.findOpenByCopy("TRK-101", "overheat") == 1;
    assert backend.router.findOpen("VAN-7", "tyre") == -1 and backend.router.findOpenByCopy("VAN-7", "tyre") == -1;
    assert backend.router.acknowledge("VAN-7", "overheat") == 2;
    assert backend.router.recent[2].status == AlertStatus.acknowledged and backend.router.recent[2].vehicleId == "VAN-7";
    assert backend.router.recent[1].status == AlertStatus.open;
  }
  test 'Twin inspection' of backend {
    /** Each twin of the family is its own occurrence with its own store. */
    assert backend.twins[0].link == LinkState.offline;
    backend.twins[0].attach("TRK-101");
    backend.twins[0].report(72);
    var shown: VehicleView = backend.twins[0].currentView();
    assert shown.vehicleId == "TRK-101" and shown.speed == 72;
    assert backend.twins[0].latest.speed == 72 and backend.twins[1].link == LinkState.offline and backend.twins[1].latest.vehicleId == "";
  }
}
```

### 35-conditional-expression.swaml

```swaml
package FaultDebounce {
  /** A fault-memory debounce in the shape of the door model's DoorEcu::Types helpers. The 2.2 shape selects values through helper operations pickInt and pickStatus, which evaluate every argument; the 2.3 shape writes the whole-expression conditional if (c) a else b, which evaluates its condition and then only the selected branch. As an operand a conditional is parenthesized, as in clampInt((if (previous < 0) 0 else previous) + stepUp, …). */
  datatype DtcStatus {
    testFailed: bool;
    confirmed: bool;
    occurrences: uint;
  }
  operation def pickInt(condition: bool, whenTrue: int, otherwise: int) returns int {
    /** The 2.2 selection helper. */
    if (condition) {
      return whenTrue;
    }
    return otherwise;
  }
  operation def pickStatus(condition: bool, whenTrue: DtcStatus, otherwise: DtcStatus) returns DtcStatus {
    if (condition) {
      return whenTrue;
    }
    return otherwise;
  }
  operation def clampInt(value: int, low: int, high: int) returns int {
    return if (value < low) low else if (value > high) high else value;
  }
  component def Dem {
    /** Debounce counters per fault. failedThreshold and passedThreshold bound each counter. */
    const attribute stepUp: int = 3;
    const attribute stepDown: int = 1;
    const attribute failedThreshold: int = 6;
    const attribute passedThreshold: int = -4;
    attribute helperCounters: int[2] = [0, 0];
    attribute counters: int[2] = [0, 0];
    attribute statuses: DtcStatus[2] = [record DtcStatus {
      testFailed = false;
      confirmed = false;
      occurrences = 0;
    }, record DtcStatus {
      testFailed = false;
      confirmed = false;
      occurrences = 0;
    }];
    attribute helperStatuses: DtcStatus[2] = [record DtcStatus {
      testFailed = false;
      confirmed = false;
      occurrences = 0;
    }, record DtcStatus {
      testFailed = false;
      confirmed = false;
      occurrences = 0;
    }];
    operation reportByHelper(index: uint, failed: bool) {
      /** The 2.2 shape: pickInt evaluates both candidates. */
      var previous: int = helperCounters[index];
      var counter: int = 0;
      if (failed) {
        counter = clampInt(pickInt(previous < 0, 0, previous) + stepUp, passedThreshold, failedThreshold);
      } else {
        counter = clampInt(pickInt(previous > 0, 0, previous) - stepDown, passedThreshold, failedThreshold);
      }
      helperCounters[index] = counter;
      var status: DtcStatus = helperStatuses[index];
      helperStatuses[index] = pickStatus(counter >= failedThreshold and not status.testFailed, record DtcStatus {
        testFailed = true; confirmed = true; occurrences = status.occurrences + 1;
      }, status);
    }
    operation report(index: uint, failed: bool) {
      /** The 2.3 shape: a conditional per value. */
      var previous: int = counters[index];
      counters[index] = if (failed) clampInt((if (previous < 0) 0 else previous) + stepUp, passedThreshold, failedThreshold) else clampInt((if (previous > 0) 0 else previous) - stepDown, passedThreshold, failedThreshold);
      var status: DtcStatus = statuses[index];
      statuses[index] = if (counters[index] >= failedThreshold and not status.testFailed) record DtcStatus {
        testFailed = true;
        confirmed = true;
        occurrences = status.occurrences + 1;
      } else status;
    }
    operation readiness(index: uint) returns string {
      return if (statuses[index].confirmed) "failed" else if (counters[index] < 0) "passed" else "pending";
    }
  }
  component def Probe {
    /** Records which branch of a conditional was evaluated. */
    attribute evaluatedThen: uint = 0;
    attribute evaluatedOtherwise: uint = 0;
    attribute lastValue: real = 0.0;
    operation thenValue() returns int {
      evaluatedThen = evaluatedThen + 1;
      return 1;
    }
    operation otherwiseValue() returns real {
      evaluatedOtherwise = evaluatedOtherwise + 1;
      return 2.5;
    }
    operation select(choose: bool) {
      /** int and real branches have the common type real. */
      lastValue = if (choose) thenValue() else otherwiseValue();
    }
  }
  component dem: Dem;
  component probe: Probe;
  test 'Same counters either way' of dem {
    /** Both shapes reach the same counters and statuses through failures, passes and a confirmation. */
    dem.report(0, true);
    dem.reportByHelper(0, true);
    dem.report(0, true);
    dem.reportByHelper(0, true);
    dem.report(1, false);
    dem.reportByHelper(1, false);
    dem.report(1, true);
    dem.reportByHelper(1, true);
    assert dem.counters[0] == 6 and dem.counters[1] == 3;
    assert dem.counters[0] == dem.helperCounters[0] and dem.counters[1] == dem.helperCounters[1];
    assert dem.statuses[0].confirmed and dem.statuses[0].occurrences == 1 and not dem.statuses[1].confirmed;
    assert dem.statuses[0] == dem.helperStatuses[0] and dem.statuses[1] == dem.helperStatuses[1];
    var text: string = dem.readiness(0);
    assert text == "failed";
    dem.report(1, false);
    text = dem.readiness(1);
    assert text == "passed" and dem.counters[1] == -1;
  }
  test 'Only the selected branch runs' of probe {
    /** The condition is evaluated, then only the selected branch: each side-effecting branch counts its own evaluations. */
    probe.select(true);
    assert probe.evaluatedThen == 1 and probe.evaluatedOtherwise == 0 and probe.lastValue == 1.0;
    probe.select(false);
    probe.select(false);
    assert probe.evaluatedThen == 1 and probe.evaluatedOtherwise == 2 and probe.lastValue == 2.5;
  }
}
```

### 36-contextual-words.swaml

```swaml
package UplinkSession {
  /** A cloud uplink session in the shape of the V2X model's UplinkSessionManager. In 2.2 the words view, state, in and out were reserved, so the session state was an attribute named sessionState or a quoted 'state'. From 2.3 they are contextual: they keep their keyword roles (state machines, views, parameter directions, for … in) and are also ordinary names, here an attribute state, a port in, a member state, parameters in and out and a view named view. 'state' and state are the same name. */
  import Swaml::Views;
  enum SessionState {
    offline, connecting, connected
  }
  port def Link {
    /** The cellular link reports coverage and the state of the session it carries. */
    provides event coverage(in: bool);
    requires attribute state: SessionState;
  }
  operation def next(state: SessionState, in: bool) returns SessionState {
    return if (not in) SessionState.offline else if (state == SessionState.offline) SessionState.connecting else SessionState.connected;
  }
  operation def count(in values: bool[3], out out: uint) {
    out = 0;
    for (in: bool in values) {
      out = out + (if (in) 1 else 0);
    }
  }
  component def Modem {
    /** Reports coverage and keeps the latest session state it receives. */
    port out: Link;
    attribute state: SessionState = SessionState.offline;
    operation run() {
      publish out.coverage(true);
      wait 10ms;
      publish out.coverage(false);
    }
    operation keep(value: SessionState) {
      state = value;
    }
    schedule {
      on start run();
      on receive out.state(value) keep(value);
    }
  }
  component def SessionManager {
    /** The session state machine; its attribute is named state. */
    reversed port in: Link;
    attribute state: SessionState = SessionState.offline;
    attribute changes: uint = 0;
    attribute covered: uint = 0;
    attribute view: bool[3] = [false, false, false];
    operation enter(target: SessionState) {
      'state' = target;
      changes = changes + 1;
      view[if (changes > 2) 2 else changes] = state != SessionState.offline;
      send in.state(state);
    }
    operation session() {
      initial idle;
      state idle {
        on receive in.coverage(in) when (in) to working {
          enter(next(state, in));
        }
      }
      state working {
        on receive in.coverage(in) to idle {
          enter(next(state, in));
          count(view, covered);
        }
      }
    }
    schedule {
      on start session();
    }
  }
  component def Telematics {
    /** The boundary port in forwards to the session's port in. */
    reversed port in: Link;
    component session: SessionManager;
    connect (in, session.in);
  }
  component modem: Modem;
  component app: Telematics;
  connect (modem.out, app.in);
  view view: General of app.session;
  view state: General {
    include app recursive where name == "state" or name == "in";
  }
  test 'Session state is a plain name' of app {
    /** A test reads the attribute state of a part, unquoted and quoted. */
    wait 5ms;
    assert app.session.state == SessionState.connecting and app.session.'state' == app.session.state;
    wait 20ms;
    assert app.session.state == SessionState.offline and app.session.changes == 2;
    assert app.session.view[1] and not app.session.view[2] and app.session.covered == 1;
    assert modem.state == SessionState.offline;
  }
  associate modem to 'Session state is a plain name';
}
```

### 37-association-lists.swaml

```swaml
package FleetCases {
  /** Grouped associations in the shape of the cloud model's use cases and tests. In 2.2 each pair needed its own statement: associate truck to 'Monitor live position'; associate van to 'Monitor live position'; associate truck to 'Command a vehicle'; and so on. From 2.3 one statement lists occurrences and cases, associate truck, van to 'Monitor live position', 'Command a vehicle';, and associates every listed occurrence with every listed case. A pair repeated in one statement or across statements is an error. */
  port def Telemetry {
    provides event position(vehicle: string, km: int);
  }
  port def Commands {
    requires event command(vehicle: string, code: int);
  }
  component def Vehicle {
    /** An actor: interface-only, so a case acts through its ports. */
    port uplink: Telemetry;
    port downlink: Commands;
  }
  component def Backend {
    reversed port truckIn: Telemetry;
    reversed port vanIn: Telemetry;
    reversed port truckOut: Commands;
    reversed port vanOut: Commands;
    attribute positions: uint = 0;
    attribute lastKm: int = 0;
    attribute commands: uint = 0;
    operation track(vehicle: string, km: int) {
      positions = positions + 1;
      lastKm = km;
    }
    operation commandTruck(code: int) {
      commands = commands + 1;
      publish truckOut.command("truck", code);
    }
    operation commandVan(code: int) {
      commands = commands + 1;
      publish vanOut.command("van", code);
    }
    schedule {
      on receive truckIn.position(vehicle, km) track(vehicle, km);
      on receive vanIn.position(vehicle, km) track(vehicle, km);
    }
  }
  component def Archive {
    /** A separate software component that a test inspects. */
    attribute stored: uint = 0;
    operation store() {
      stored = stored + 1;
    }
    schedule {
      on start store();
    }
  }
  component truck: Vehicle;
  component van: Vehicle;
  component backend: Backend;
  component archive: Archive;
  connect (truck.uplink, backend.truckIn);
  connect (van.uplink, backend.vanIn);
  connect (backend.truckOut, truck.downlink);
  connect (backend.vanOut, van.downlink);
  use case 'Monitor live position' of backend {
    publish truck.uplink.position("truck", 12);
    publish van.uplink.position("van", 40);
    wait 1ms;
  }
  test 'Command a vehicle' of backend {
    /** Uses the second listed occurrence with the second listed case of the first list. */
    backend.commandVan(7);
    on receive van.downlink.command(vehicle, code) {
      assert vehicle == "van" and code == 7;
    }
    publish van.uplink.position("van", 41);
    wait 1ms;
    assert backend.commands == 1 and backend.lastKm == 41;
  }
  test 'Positions and archive' of backend {
    /** Uses the truck and inspects the archive, both associated by the second list. */
    publish truck.uplink.position("truck", 5);
    publish truck.uplink.position("truck", 6);
    wait 1ms;
    assert backend.positions == 2 and backend.lastKm == 6 and archive.stored == 1;
  }
  associate truck, van to 'Monitor live position', 'Command a vehicle';
  associate truck, archive to 'Positions and archive';
}
```

### 38-square-root.swaml

```swaml
package HazardDistance {
  /** Hazard relevance by distance, in the shape of the V2X model's AdaptiveV2x::Types. The 2.2 shape computes a square root by a fixed number of Newton steps, because the library had none; it is not correctly rounded and does not converge for large distances. The 2.3 shape imports Swaml::Numeric and calls sqrt, the host's IEEE-754 correctly rounded square root, whose argument below zero is the runtime failure Arithmetic. */
  import Swaml::Math;
  import Swaml::Numeric;
  datatype Position {
    eastM: real;
    northM: real;
  }
  operation def squareRoot(v: real) returns real {
    /** The 2.2 shape: 24 Newton steps from max(v, 1.0). */
    if (v <= 0.0) {
      return 0.0;
    }
    var x: real = max(v, 1.0);
    for (var i: int = 0; i < 24; i = i + 1) {
      x = (x + v / x) / 2.0;
    }
    return x;
  }
  component def Relevance {
    /** Distances in metres to the last hazard, computed both ways, and whether the hazard is within radiusM. */
    const attribute radiusM: real = 500.0;
    attribute newtonM: real = 0.0;
    attribute sqrtM: real = 0.0;
    attribute relevant: bool = false;
    attribute invalidInputs: uint = 0;
    operation squaredDistance(own: Position, hazard: Position) returns real {
      var dx: real = hazard.eastM - own.eastM;
      var dy: real = hazard.northM - own.northM;
      return dx * dx + dy * dy;
    }
    operation locate(own: Position, hazard: Position) {
      var d2: real = squaredDistance(own, hazard);
      newtonM = squareRoot(d2);
      sqrtM = sqrt(d2);
      relevant = sqrtM <= radiusM;
    }
    operation calibrated(d2: real, offset: real) returns real {
      /** A negative corrected square is an invalid input: sqrt fails with Arithmetic, caught here. */
      var root: real = try(sqrt(d2 - offset), -1.0);
      if (root < 0.0) {
        invalidInputs = invalidInputs + 1;
      }
      return root;
    }
  }
  component relevance: Relevance;
  test 'Same distance for a 3-4-5 triangle' of relevance {
    /** Small exact squares: both shapes agree. */
    relevance.locate(record Position {
      eastM = 100.0; northM = 200.0;
    }, record Position {
      eastM = 400.0; northM = 600.0;
    });
    assert relevance.newtonM == 500.0 and relevance.sqrtM == 500.0 and relevance.relevant;
  }
  test 'Correctly rounded' of relevance {
    /** sqrt(2) is the double nearest the exact root; 24 Newton steps end one unit in the last place away. */
    relevance.locate(record Position {
      eastM = 0.0; northM = 0.0;
    }, record Position {
      eastM = 1.0; northM = 1.0;
    });
    assert relevance.sqrtM == 1.4142135623730951 and relevance.sqrtM * relevance.sqrtM != 2.0;
    assert relevance.newtonM != relevance.sqrtM;
  }
  test 'Far hazard' of relevance {
    /** At 3,000 km the fixed Newton loop has not converged; sqrt is exact and the hazard is not relevant. */
    relevance.locate(record Position {
      eastM = 0.0; northM = 0.0;
    }, record Position {
      eastM = 0.0; northM = 3000000.0;
    });
    assert relevance.sqrtM == 3000000.0 and not relevance.relevant;
    assert relevance.newtonM > 3000080.0;
  }
  test 'Negative argument fails' of relevance {
    /** sqrt below zero is the runtime failure Arithmetic, which try catches; -0.0 is not below zero. */
    var root: real = relevance.calibrated(16.0, 7.0);
    assert root == 3.0 and relevance.invalidInputs == 0;
    root = relevance.calibrated(16.0, 16.5);
    assert root == -1.0 and relevance.invalidInputs == 1;
    root = relevance.calibrated(0.0, 0.0);
    assert root == 0.0 and relevance.invalidInputs == 1;
  }
}
```

### 39-logical-clock.swaml

```swaml
package ReceptionAge {
  /** A reception timeout in the shape of the door model's ComMain. The 2.2 shape counts the age of the last frame with rxAgeMs = rxAgeMs + 20, which is right only while the main function runs every 20 ms. The 2.3 shape stores the logical time of the last frame, lastRxNs = now(), and compares now() - lastRxNs with the timeout in nanoseconds, so it does not depend on the period. now() is the logical time of the evaluating step in nanoseconds since the run epoch; it reads state and is therefore not allowed in attribute initializers. */
  import Swaml::Time;
  port def Bus {
    provides event frame(rolling: uint);
  }
  component def ComCore {
    /** The reception logic, without its period. */
    reversed port bus: Bus;
    const attribute rxTimeoutMs: uint = 100;
    attribute rxAgeMs: uint = 0;
    attribute lastRxNs: uint = 0;
    attribute timedOutByTicks: bool = false;
    attribute timedOutByClock: bool = false;
    attribute frames: uint = 0;
    operation onFrame(rolling: uint) {
      frames = frames + 1;
      rxAgeMs = 0;
      lastRxNs = now();
      timedOutByTicks = false;
      timedOutByClock = false;
    }
    operation rxMainFunction() {
      // 2.2 shape: a counter that assumes the 20 ms period.
      rxAgeMs = rxAgeMs + 20;
      if (rxAgeMs >= rxTimeoutMs) {
        timedOutByTicks = true;
      }
      // 2.3 shape: the age is now() - lastRxNs.
      if (now() - lastRxNs >= rxTimeoutMs * 1000000) {
        timedOutByClock = true;
      }
    }
    operation ageNs() returns uint {
      return now() - lastRxNs;
    }
    schedule {
      on receive bus.frame(rolling) onFrame(rolling);
    }
  }
  component def ComMain20 specializes ComCore {
    /** The period the counter was written for. */
    schedule {
      on every 20ms rxMainFunction();
    }
  }
  component def ComMain10 specializes ComCore {
    /** The same logic every 10 ms: the counter now runs twice as fast. */
    schedule {
      on every 10ms rxMainFunction();
    }
  }
  component def Gateway {
    /** Interface-only actor that sends frames to both receivers. */
    port toSlow: Bus;
    port toFast: Bus;
  }
  component slow: ComMain20;
  component fast: ComMain10;
  component gateway: Gateway;
  connect (gateway.toSlow, slow.bus);
  connect (gateway.toFast, fast.bus);
  associate gateway to 'Timeout at 20 ms', 'Timeout at 10 ms';
  test 'Timeout at 20 ms' of slow {
    /** With its own period both shapes agree: no timeout at 90 ms, a timeout at 100 ms. */
    wait 90ms;
    assert not slow.timedOutByTicks and not slow.timedOutByClock;
    wait 10ms;
    assert slow.timedOutByTicks and slow.timedOutByClock;
  }
  test 'Timeout at 10 ms' of fast {
    /** At 50 ms the counter claims 100 ms; the clock age is 50 ms. A frame at 60 ms restarts both. */
    wait 50ms;
    assert fast.timedOutByTicks and not fast.timedOutByClock;
    var age: uint = fast.ageNs();
    assert age == 50000000 and now() == 50000000;
    wait 10ms;
    publish gateway.toFast.frame(1);
    wait 90ms;
    assert fast.frames == 1 and fast.lastRxNs == 60000000 and not fast.timedOutByClock;
    wait 10ms;
    assert fast.timedOutByClock and now() - fast.lastRxNs == 100000000;
  }
}
```

### 40-number-text.swaml

```swaml
package DiagnosticText {
  /** Diagnostic labels with numbers. In 2.2 a number could not become text, so a label named one of a fixed set of values through a selection helper. In 2.3 Swaml::Text writes intText(v) in decimal, realText(v, decimals) rounded to exactly decimals fraction digits (ties away from zero, no exponent and no negative zero; more than 15 decimals or a magnitude of at least 1e21 is the runtime failure Bounds) and boolText(v). */
  import Swaml::Math;
  import Swaml::Text;
  operation def levelName(level: int) returns string {
    /** The 2.2 shape: only the listed values have text. */
    if (level == 0) {
      return "0";
    }
    if (level == 1) {
      return "1";
    }
    if (level == 2) {
      return "2";
    }
    return "many";
  }
  component def Monitor {
    attribute legacy: string = "";
    attribute label: string = "";
    attribute tooPrecise: uint = 0;
    operation legacyReport(code: int, level: int) {
      legacy = concat("DTC level ", levelName(level));
    }
    operation report(code: int, voltage: real, latched: bool) {
      label = "DTC " + intText(code) + " at " + realText(voltage, 2) + " V, latched " + boolText(latched);
    }
    operation precise(v: real, decimals: uint) returns string {
      return try(realText(v, decimals), "?");
    }
    operation tooPreciseCount(v: real) {
      var text: string = precise(v, 16);
      if (text == "?") {
        tooPrecise = tooPrecise + 1;
      }
    }
  }
  component monitor: Monitor;
  test 'Labels' of monitor {
    /** A level of 7 has no 2.2 text; the 2.3 label writes every value. */
    monitor.legacyReport(4711, 7);
    assert monitor.legacy == "DTC level many";
    monitor.report(4711, 11.996, true);
    assert monitor.label == "DTC 4711 at 12.00 V, latched true";
    monitor.report(-12, -0.004, false);
    assert monitor.label == "DTC -12 at 0.00 V, latched false";
  }
  test 'Rounding' of monitor {
    /** Ties away from zero (unlike Swaml::Math::round, which rounds -2.5 to -2), no negative zero, exact binary values. */
    var a: string = monitor.precise(-2.5, 0);
    var b: string = monitor.precise(-0.0001, 2);
    var c: string = monitor.precise(0.125, 2);
    var d: string = monitor.precise(1.005, 2);
    assert a == "-3" and b == "0.00" and c == "0.13" and d == "1.00" and round(-2.5) == -2;
    var e: string = monitor.precise(999999999999999868928.0, 1);
    assert e == "999999999999999868928.0";
  }
  test 'Bounds' of monitor {
    /** More than 15 decimals or a magnitude of at least 1e21 is the runtime failure Bounds. */
    monitor.tooPreciseCount(1.0);
    var big: string = monitor.precise(1000000000000000000000.0, 0);
    var fifteen: string = monitor.precise(0.1, 15);
    assert monitor.tooPrecise == 1 and big == "?" and fifteen == "0.100000000000000";
  }
}
```

### 41-computed-backoff.swaml

```swaml
package Backoff {
  /** Retry backoff in the shapes of the V2X uplink and the cloud gateway. In 2.2 a wait takes a literal only, so the uplink waits out a computed delay in a loop of 250 ms steps, which rounds every delay up to the next multiple of 250 ms, and the gateway keeps a fixed table of delays. From 2.3 a duration literal is a uint value in nanoseconds and wait (e), or after (e) and state timers after (e) take a computed integral delay: the backoff doubles up to a cap and is waited exactly. A delay that is not positive is the runtime failure DurationRange, which try catches like any runtime failure. */
  import Swaml::Numeric;
  import Swaml::Time;
  component def CountedUplink {
    /** The 2.2 shape: a delay in milliseconds waited in 250 ms steps. */
    attribute waitedMs: uint = 0;
    attribute backoffs: uint = 0;
    operation backoff(delayMs: uint) {
      var waited: uint = 0;
      while (waited < delayMs) {
        wait 250ms;
        waited = waited + 250;
      }
      waitedMs = waited;
      backoffs = backoffs + 1;
    }
  }
  component def ComputedUplink {
    /** The 2.3 shape: the delay doubles from firstMs up to capMs and is waited exactly. */
    const attribute firstMs: uint = 100;
    const attribute capMs: uint = 1000;
    attribute delayMs: uint = 0;
    attribute backoffs: uint = 0;
    attribute lastWakeNs: uint = 0;
    operation backoff() {
      delayMs = if (delayMs == 0) firstMs else minInt(delayMs * 2, capMs);
      wait (delayMs * 1ms);
      lastWakeNs = now();
      backoffs = backoffs + 1;
    }
    operation pause(millis: int) returns bool {
      /** Waits millis milliseconds; a delay that is not positive fails with DurationRange. */
      wait (millis * 1ms);
      return true;
    }
  }
  port def Ack {
    provides event ack(id: uint);
  }
  component def Requester {
    /** Waits for an acknowledgement with a receive timeout that doubles after every loss: or after (timeoutMs * 1ms) is evaluated each time the statement starts waiting. */
    reversed port acks: Ack;
    attribute timeoutMs: uint = 10;
    attribute lost: uint = 0;
    attribute ackedAt: uint = 0;
    operation awaitAck() {
      var waiting: bool = true;
      var tries: uint = 0;
      while (waiting and tries < 5) {
        tries = tries + 1;
        on receive acks.ack(id) {
          ackedAt = now();
          waiting = false;
        } or after (timeoutMs * 1ms) {
          lost = lost + 1;
          timeoutMs = timeoutMs * 2;
        }
      }
    }
    schedule {
      on start awaitAck();
    }
  }
  component def Peer {
    /** Interface-only actor that acknowledges. */
    port acks: Ack;
  }
  component def Session {
    /** A connection machine whose Backoff state doubles the delay on entry and then waits it: the timer is evaluated when the entry actions finish, so it waits the new delay. */
    const attribute capMs: uint = 400;
    attribute delayMs: uint = 50;
    attribute attempts: uint = 0;
    attribute connectedAt: uint = 0;
    operation run() {
      initial Connecting;
      state Connecting {
        on entry {
          attempts = attempts + 1;
        }
        after 10ms to Backoff {
        }
      }
      state Backoff {
        on entry {
          delayMs = minInt(delayMs * 2, capMs);
        }
        after (delayMs * 1ms) to Retry {
        }
      }
      state Retry {
        on entry {
          connectedAt = now();
        }
        after 5ms to Connecting {
        }
      }
    }
    schedule {
      on start run();
    }
  }
  component requester: Requester;
  component peer: Peer;
  connect (peer.acks, requester.acks);
  associate peer to 'Timeout doubles after a loss';
  component counted: CountedUplink;
  component computed: ComputedUplink;
  component session: Session;
  test 'Counted loop rounds up' of counted {
    /** The 2.2 loop waits 500 ms for a 300 ms delay. */
    counted.backoff(300);
    assert counted.waitedMs == 500 and now() == 500000000;
  }
  test 'Computed wait is exact' of computed {
    /** The computed backoff waits 100, 200, 400, 800 and then the 1000 ms cap. */
    computed.backoff();
    assert now() == 100000000;
    computed.backoff();
    computed.backoff();
    computed.backoff();
    assert computed.delayMs == 800 and now() == 1500000000;
    computed.backoff();
    assert computed.delayMs == 1000 and computed.lastWakeNs == 2500000000 and computed.backoffs == 5;
  }
  test 'A delay that is not positive fails' of computed {
    /** pause(0) and pause(-5) fail with DurationRange before waiting; try catches it and time does not advance. */
    var ok: bool = try(computed.pause(0), false);
    assert not ok and now() == 0;
    ok = try(computed.pause(-5), false);
    assert not ok and now() == 0;
    ok = try(computed.pause(3), false);
    assert ok and now() == 3000000;
  }
  test 'Timeout doubles after a loss' of requester {
    /** The first 10 ms timeout expires at 10 ms; the second wait lasts 20 ms, so an acknowledgement at 25 ms is taken. */
    wait 25ms;
    publish peer.acks.ack(1);
    wait 1ms;
    assert requester.lost == 1 and requester.timeoutMs == 20 and requester.ackedAt == 25000000;
  }
  test 'Backoff timer uses the new delay' of session {
    /** Each Backoff entry doubles the delay first: 100 ms, then 200 ms, then the 400 ms cap. */
    wait 112ms;
    assert session.attempts == 1 and session.delayMs == 100 and session.connectedAt == 110000000;
    wait 215ms;
    assert session.attempts == 2 and session.delayMs == 200 and session.connectedAt == 325000000;
    wait 415ms;
    assert session.attempts == 3 and session.delayMs == 400 and session.connectedAt == 740000000;
  }
}
```

### 42-lock-pulse.swaml

```swaml
package LockPulse {
  /** A door lock actuator in the shape of the door model's LockControl. The pulse length is a calibration attribute, pulseMs. In 2.2 a state timer takes a literal only, so the locking state repeats the calibration as after 250ms and ignores a recalibration. From 2.3 the timer is after (pulseMs * 1ms): it is evaluated when the entry actions of the state finish, and each pulse uses the current calibration. Without the unit, after (pulseMs) would count nanoseconds; the validator warns about it (SW2016). */
  import Swaml::Time;
  port def Request {
    provides event lock();
  }
  component def LiteralLock {
    /** The 2.2 shape. */
    reversed port requests: Request;
    attribute pulseMs: uint = 250;
    attribute pulses: uint = 0;
    attribute pulseEndNs: uint = 0;
    operation calibrate(ms: uint) {
      pulseMs = ms;
    }
    operation control() {
      initial unlocked;
      state unlocked {
        on receive requests.lock() to locking {
        }
      }
      state locking {
        on entry {
          pulses = pulses + 1;
        }
        after 250ms to locked {
          pulseEndNs = now();
        }
      }
      state locked {
        on receive requests.lock() to locking {
        }
      }
    }
    schedule {
      on start control();
    }
  }
  component def ComputedLock {
    /** The 2.3 shape: the pulse follows the calibration. */
    reversed port requests: Request;
    attribute pulseMs: uint = 250;
    attribute pulses: uint = 0;
    attribute pulseEndNs: uint = 0;
    operation calibrate(ms: uint) {
      pulseMs = ms;
    }
    operation control() {
      initial unlocked;
      state unlocked {
        on receive requests.lock() to locking {
        }
      }
      state locking {
        on entry {
          pulses = pulses + 1;
        }
        after (pulseMs * 1ms) to locked {
          pulseEndNs = now();
        }
      }
      state locked {
        on receive requests.lock() to locking {
        }
      }
    }
    schedule {
      on start control();
    }
  }
  component def Body {
    /** Interface-only actor that requests locking. */
    port toLiteral: Request;
    port toComputed: Request;
  }
  component literal: LiteralLock;
  component computed: ComputedLock;
  component body: Body;
  connect (body.toLiteral, literal.requests);
  connect (body.toComputed, computed.requests);
  associate body, literal to 'Recalibrated pulse';
  test 'Recalibrated pulse' of computed {
    /** Both locks pulse 250 ms; after recalibration to 400 ms only the computed timer follows. */
    publish body.toLiteral.lock();
    publish body.toComputed.lock();
    wait 300ms;
    assert literal.pulseEndNs == 250000000 and computed.pulseEndNs == 250000000;
    computed.calibrate(400);
    literal.calibrate(400);
    publish body.toLiteral.lock();
    publish body.toComputed.lock();
    wait 500ms;
    assert literal.pulses == 2 and computed.pulses == 2;
    assert literal.pulseEndNs == 550000000 and computed.pulseEndNs == 700000000;
  }
}
```

### 43-derived-period.swaml

```swaml
package DerivedPeriod {
  /** A sampler whose period and deadline derive from a const attribute that each usage may redefine. In 2.2 periods and deadlines are literals, so a faster variant needs its own definition with its own schedule. From 2.3 on every (e) and deadline (e) take an expression of the constant sublanguage: integer and duration literals, const attributes with their effective value in the occurrence, arithmetic with exact integral division, comparisons and the conditional, without calls. The validator evaluates it for every occurrence: here every (periodMs * 1ms) is 20 ms in slow and 10 ms in fast, and the half-period deadline must divide exactly in every usage. */
  component def Sampler {
    const attribute periodMs: uint = 20;
    attribute samples: uint = 0;
    attribute busyMs: uint = 0;
    operation sample() {
      samples = samples + 1;
      if (busyMs > 0) {
        wait (busyMs * 1ms);
      }
    }
    operation load(ms: uint) {
      busyMs = ms;
    }
    schedule {
      on every (periodMs * 1ms) sample() deadline (periodMs * 1ms / 2);
    }
  }
  component def Logger {
    /** A literal period with a computed deadline: every 20ms, deadline (budgetMs * 1ms). The deadline is the constant value of each usage, the period stays the 2.2 literal. */
    const attribute budgetMs: uint = 5;
    attribute entries: uint = 0;
    attribute busyMs: uint = 0;
    operation log() {
      entries = entries + 1;
      if (busyMs > 0) {
        wait (busyMs * 1ms);
      }
    }
    operation load(ms: uint) {
      busyMs = ms;
    }
    schedule {
      on every 20ms log() deadline (budgetMs * 1ms);
    }
  }
  component logger: Logger {
    redefines const attribute budgetMs: uint = 3;
  }
  component slow: Sampler;
  component fast: Sampler {
    redefines const attribute periodMs: uint = 10;
  }
  component late: Sampler {
    redefines const attribute periodMs: uint = 8;
  }
  associate fast to 'Period per usage', 'Busy within the deadline';
  associate slow to 'Literal period, computed deadline';
  test 'Period per usage' of slow {
    /** In 100 ms slow samples five times and fast ten times. */
    wait 100ms;
    assert slow.samples == 5 and fast.samples == 10;
  }
  test 'Busy within the deadline' of slow {
    /** A 9 ms sample meets the 10 ms deadline of slow. In fast, whose deadline is 5 ms, it would be a Deadline violation. */
    slow.load(9);
    wait 100ms;
    assert slow.samples == 5 and fast.samples == 10;
  }
  test 'Literal period, computed deadline' of logger {
    /** logger logs every 20 ms; a 2 ms entry meets its redefined 3 ms deadline (5 ms in the definition). */
    logger.load(2);
    wait 100ms;
    assert logger.entries == 5 and slow.samples == 5;
  }
  test 'Deadline per usage' of late {
    /** late runs every 8 ms with a deadline of 4 ms, half its own period. A 5 ms sample released at 8 ms misses it at 12 ms: the run stops with the Deadline violation, so this case fails by design. With the 10 ms deadline of slow it would pass. */
    late.load(5);
    wait 20ms;
    assert late.samples >= 1;
  }
}
```

### 44-session-completion.swaml

```swaml
package SessionCompletion {
  /** An uplink session in the shape of the V2X model's UplinkSessionManager. In 2.2 a state machine cannot decide on a value its own entry action computed: LegacySession publishes openRequested, a second component, Transfer, performs the request and answers opened or refused, and two control events exist only to return that decision. From 2.3 one machine opens the session in its entry action and decides with completion transitions, when (sessionId > 0) to Connected, which are evaluated after the entry actions finish (chapter 3.6). A coverage loss queued during the request is taken in whatever state the decision reaches. */
  port def CloudApi {
    provides operation openSession(vehicle: uint) returns uint;
  }
  port def Coverage {
    provides event coverage(up: bool);
  }
  port def Control {
    provides event openRequested(attempt: uint);
    requires event opened(id: uint);
    requires event refused();
  }
  component def Cloud {
    /** Refuses the first two open requests, then grants sessions 101, 102 and so on. */
    port api: CloudApi;
    attribute calls: uint = 0;
    operation open(vehicle: uint) returns uint {
      calls = calls + 1;
      wait 2ms;
      if (calls <= 2) {
        return 0;
      }
      return 98 + calls;
    }
    schedule {
      on call api.openSession(vehicle) open(vehicle);
    }
  }
  component def Session {
    /** The 2.3 shape: one machine, completion transitions on the result of its own request. */
    reversed port cloud: CloudApi;
    reversed port network: Coverage;
    const attribute vehicleId: uint = 7;
    attribute sessionId: uint = 0;
    attribute attempts: uint = 0;
    attribute backoffs: uint = 0;
    attribute coverageLosses: uint = 0;
    operation run() {
      initial Connecting;
      state Connecting {
        on entry {
          attempts = attempts + 1;
          sessionId = try(cloud.openSession(vehicleId), 0);
        }
        when (sessionId > 0) to Connected {
        }
        when (true) to Backoff {
        }
        on receive network.coverage(up) when (not up) to Offline {
          coverageLosses = coverageLosses + 1;
        }
      }
      state Backoff {
        on entry {
          backoffs = backoffs + 1;
        }
        after 10ms to Connecting {
        }
        on receive network.coverage(up) when (not up) to Offline {
          coverageLosses = coverageLosses + 1;
        }
      }
      state Connected {
        on receive network.coverage(up) when (not up) to Offline {
          coverageLosses = coverageLosses + 1;
          sessionId = 0;
        }
      }
      state Offline {
        on receive network.coverage(up) when (up) to Connecting {
        }
      }
    }
    schedule {
      on start run();
    }
  }
  component def LegacySession {
    /** The 2.2 shape: the decision returns through two control events from Transfer. */
    port ctl: Control;
    reversed port network: Coverage;
    attribute sessionId: uint = 0;
    attribute attempts: uint = 0;
    attribute backoffs: uint = 0;
    attribute coverageLosses: uint = 0;
    operation run() {
      initial Connecting;
      state Connecting {
        on entry {
          attempts = attempts + 1;
          publish ctl.openRequested(attempts);
        }
        on receive ctl.opened(id) to Connected {
          sessionId = id;
        }
        on receive ctl.refused() to Backoff {
        }
        on receive network.coverage(up) when (not up) to Offline {
          coverageLosses = coverageLosses + 1;
        }
      }
      state Backoff {
        on entry {
          backoffs = backoffs + 1;
        }
        after 10ms to Connecting {
        }
        on receive network.coverage(up) when (not up) to Offline {
          coverageLosses = coverageLosses + 1;
        }
      }
      state Connected {
        on receive network.coverage(up) when (not up) to Offline {
          coverageLosses = coverageLosses + 1;
          sessionId = 0;
        }
      }
      state Offline {
        on receive network.coverage(up) when (up) to Connecting {
        }
      }
    }
    schedule {
      on start run();
    }
  }
  component def Transfer {
    /** The second component of the 2.2 shape: it performs the request and answers with an event. */
    reversed port ctl: Control;
    reversed port cloud: CloudApi;
    const attribute vehicleId: uint = 7;
    operation openSession(attempt: uint) {
      var id: uint = try(cloud.openSession(vehicleId), 0);
      if (id > 0) {
        publish ctl.opened(id);
      } else {
        publish ctl.refused();
      }
    }
    schedule {
      on receive ctl.openRequested(attempt) openSession(attempt);
    }
  }
  component def Car {
    /** Interface-only actor that reports radio coverage to both sessions. */
    port toSession: Coverage;
    port toLegacy: Coverage;
  }
  component session: Session;
  component legacy: LegacySession;
  component transfer: Transfer;
  component cloud: Cloud;
  component legacyCloud: Cloud;
  component car: Car;
  connect (session.cloud, cloud.api);
  connect (transfer.cloud, legacyCloud.api);
  connect (legacy.ctl, transfer.ctl);
  connect (car.toSession, session.network);
  connect (car.toLegacy, legacy.network);
  associate car, legacy, cloud to 'Opens after two refusals', 'Coverage loss during the request';
  test 'Opens after two refusals' of session {
    /** Both shapes open session 101 at the third attempt, after two refusals and two backoffs: at 2 + 10 + 2 + 10 + 2 = 26 ms. */
    wait 30ms;
    assert session.sessionId == 101 and session.attempts == 3 and session.backoffs == 2;
    assert legacy.sessionId == 101 and legacy.attempts == 3 and legacy.backoffs == 2;
    assert cloud.calls == 3;
  }
  test 'Coverage loss during the request' of session {
    /** The coverage loss arrives at 1 ms, while the first request is in flight. The refusal at 2 ms selects Backoff, which handles the queued loss and goes Offline. */
    wait 1ms;
    publish car.toSession.coverage(false);
    wait 5ms;
    assert session.coverageLosses == 1 and session.backoffs == 1 and session.attempts == 1;
    publish car.toSession.coverage(true);
    wait 30ms;
    assert session.sessionId == 101 and session.attempts == 3;
  }
}
```

### 45-lock-deferral.swaml

```swaml
package LockDeferral {
  /** A door lock in the shape of the door model's LockControl. A lock or unlock request that arrives during the 250 ms motor pulse has no transition in 2.2 and is discarded (discardInput, inactiveOwner): DiscardingLock ends unlocked although the last request was lock. From 2.3 the pulse states write defer requests.request; and the request stays in its connection queue until a state that handles it, so DeferringLock ends locked. Retained input keeps its queue slot: with a policy that rejects on overflow a full queue fails the sender, and the validator warns about it (SW2018); these connections use the Queued policy, which drops the oldest request instead. */
  import Swaml::Qos;
  qos def Queued: Policy {
    delivery = Delivery.atMostOnce;
    ordering = Ordering.fifo;
    capacity = 8;
    overflow = Overflow.dropOldest;
    requestTimeout = 1s;
  }
  port def Requests {
    provides event request(lock: bool);
  }
  component def DiscardingLock {
    /** The 2.2 shape. */
    reversed port requests: Requests;
    attribute locked: bool = false;
    attribute pulses: uint = 0;
    operation control() {
      initial unlocked;
      state unlocked {
        on receive requests.request(lock) when (lock) to locking {
        }
      }
      state locking {
        on entry {
          pulses = pulses + 1;
        }
        after 250ms to isLocked {
          locked = true;
        }
      }
      state isLocked {
        on receive requests.request(lock) when (not lock) to unlocking {
        }
      }
      state unlocking {
        on entry {
          pulses = pulses + 1;
        }
        after 250ms to unlocked {
          locked = false;
        }
      }
    }
    schedule {
      on start control();
    }
  }
  component def DeferringLock {
    /** The 2.3 shape: the pulse states retain requests. */
    reversed port requests: Requests;
    attribute locked: bool = false;
    attribute pulses: uint = 0;
    operation control() {
      initial unlocked;
      state unlocked {
        on receive requests.request(lock) when (lock) to locking {
        }
      }
      state locking {
        defer requests.request;
        on entry {
          pulses = pulses + 1;
        }
        after 250ms to isLocked {
          locked = true;
        }
      }
      state isLocked {
        on receive requests.request(lock) when (not lock) to unlocking {
        }
      }
      state unlocking {
        defer requests.request;
        on entry {
          pulses = pulses + 1;
        }
        after 250ms to unlocked {
          locked = false;
        }
      }
    }
    schedule {
      on start control();
    }
  }
  component def Body {
    /** Interface-only actor that sends lock requests to both locks. */
    port toDiscarding: Requests;
    port toDeferring: Requests;
  }
  component def Fob {
    /** Interface-only actor: a key fob with its own connection to the deferring lock, so its requests have their own queue. */
    port toDeferring: Requests;
  }
  component discarding: DiscardingLock;
  component deferring: DeferringLock;
  component body: Body;
  component fob: Fob;
  connect: Queued (body.toDiscarding, discarding.requests);
  connect: Queued (body.toDeferring, deferring.requests);
  connect: Queued (fob.toDeferring, deferring.requests);
  associate body, discarding to 'Requests during the pulse';
  associate body, fob to 'Request order across the pulse';
  test 'Requests during the pulse' of deferring {
    /** lock at 0 ms, then unlock at 100 ms and lock at 200 ms, both during the first pulse. The discarding lock drops both and stays locked after one pulse; the deferring lock takes unlock when the pulse ends at 250 ms, retains lock during the unlocking pulse and takes it at 500 ms, so it pulses three times and ends locked. */
    publish body.toDiscarding.request(true);
    publish body.toDeferring.request(true);
    wait 100ms;
    publish body.toDiscarding.request(false);
    publish body.toDeferring.request(false);
    wait 100ms;
    publish body.toDiscarding.request(true);
    publish body.toDeferring.request(true);
    wait 600ms;
    assert discarding.locked and discarding.pulses == 1;
    assert deferring.locked and deferring.pulses == 3;
  }
  test 'Request order across the pulse' of deferring {
    /** Two requests retained during one pulse are taken in offer order across their queues: the fob's unlock, then the body's lock, so the lock ends locked after three pulses. The body's queue is the older one (its first lock request started the pulse), so taking the queues in creation order would discard the lock in isLocked and end unlocked after two pulses. */
    publish body.toDeferring.request(true);
    wait 10ms;
    publish fob.toDeferring.request(false);
    publish body.toDeferring.request(true);
    wait 900ms;
    assert deferring.locked and deferring.pulses == 3;
  }
}
```

### 46-breaker-internal.swaml

```swaml
package BreakerInternal {
  /** A persistence circuit breaker in the shape of the cloud model's PersistenceWriter. In 2.2 every transition has a target: SelfBreaker writes an arrival in Closed with a self transition, to Closed, which exits and enters the state again, and trips only at the next arrival after the third failed write. In Open it must leave arrivals unhandled, because a self transition would restart the cool-down timer, so they appear only as discards. From 2.3 a transition without to is internal: it runs only its effect, without exit, entry or state update, and the state's timers keep their epoch. InternalBreaker writes arrivals internally, trips by a completion transition right after the third failed write, and counts the arrivals it sheds while Open without delaying the cool-down. */
  port def Stream {
    provides event accepted(t: uint);
  }
  port def StoreApi {
    provides operation put(t: uint) returns bool;
  }
  component def Store {
    /** Answers each put after 1 ms; while down, every put fails. */
    port api: StoreApi;
    attribute down: bool = false;
    attribute puts: uint = 0;
    operation handle(t: uint) returns bool {
      puts = puts + 1;
      wait 1ms;
      return not down and t >= 0;
    }
    operation setDown(value: bool) {
      down = value;
    }
    schedule {
      on call api.put(t) handle(t);
    }
  }
  component def InternalBreaker {
    /** The 2.3 shape. */
    reversed port stream: Stream;
    reversed port store: StoreApi;
    const attribute failureThreshold: uint = 3;
    attribute consecutiveFailures: uint = 0;
    attribute written: uint = 0;
    attribute shedArrivals: uint = 0;
    attribute trips: uint = 0;
    attribute halfOpenAtNs: uint = 0;
    operation write(t: uint) {
      var ok: bool = try(store.put(t), false);
      if (ok) {
        consecutiveFailures = 0;
        written = written + 1;
      } else {
        consecutiveFailures = consecutiveFailures + 1;
      }
    }
    operation circuit() {
      initial Closed;
      state Closed {
        on receive stream.accepted(t) {
          write(t);
        }
        when (consecutiveFailures >= failureThreshold) to Open {
          trips = trips + 1;
        }
      }
      state Open {
        on receive stream.accepted(t) {
          shedArrivals = shedArrivals + 1;
        }
        after 20ms to HalfOpen {
          halfOpenAtNs = Swaml::Time::now();
        }
      }
      state HalfOpen {
        on entry {
          consecutiveFailures = 0;
        }
        on receive stream.accepted(t) to Closed {
          write(t);
        }
      }
    }
    schedule {
      on start circuit();
    }
  }
  component def SelfBreaker {
    /** The 2.2 shape. */
    reversed port stream: Stream;
    reversed port store: StoreApi;
    const attribute failureThreshold: uint = 3;
    attribute consecutiveFailures: uint = 0;
    attribute written: uint = 0;
    attribute trips: uint = 0;
    attribute halfOpenAtNs: uint = 0;
    operation write(t: uint) {
      var ok: bool = try(store.put(t), false);
      if (ok) {
        consecutiveFailures = 0;
        written = written + 1;
      } else {
        consecutiveFailures = consecutiveFailures + 1;
      }
    }
    operation circuit() {
      initial Closed;
      state Closed {
        on receive stream.accepted(t) when (consecutiveFailures >= failureThreshold) to Open {
          trips = trips + 1;
        }
        on receive stream.accepted(t) to Closed {
          write(t);
        }
      }
      state Open {
        after 20ms to HalfOpen {
          halfOpenAtNs = Swaml::Time::now();
        }
      }
      state HalfOpen {
        on entry {
          consecutiveFailures = 0;
        }
        on receive stream.accepted(t) to Closed {
          write(t);
        }
      }
    }
    schedule {
      on start circuit();
    }
  }
  component def Feed {
    /** Interface-only actor that delivers arrivals to both breakers. */
    port toInternal: Stream;
    port toSelf: Stream;
  }
  component internal: InternalBreaker;
  component selfBreaker: SelfBreaker;
  component store: Store;
  component selfStore: Store;
  component feed: Feed;
  connect (internal.store, store.api);
  connect (selfBreaker.store, selfStore.api);
  connect (feed.toInternal, internal.stream);
  connect (feed.toSelf, selfBreaker.stream);
  associate feed, store, selfStore, selfBreaker to 'Store outage trips the breaker and recovers';
  test 'Store outage trips the breaker and recovers' of internal {
    /** Both stores are down; arrivals every 5 ms from 0 to 30 ms. The internal breaker trips right after its third failed write, at 11 ms, sheds the four arrivals at 15 to 30 ms while the cool-down keeps its epoch, and is half open at 31 ms. The 2.2 breaker trips only at the fourth arrival, at 15 ms, discards the arrivals while open and is half open at 35 ms. When the store is back, the next arrival closes both. */
    store.setDown(true);
    selfStore.setDown(true);
    for (var i: uint = 0; i <= 6; i = i + 1) {
      publish feed.toInternal.accepted(i);
      publish feed.toSelf.accepted(i);
      wait 5ms;
    }
    wait 1ms;
    assert internal.trips == 1 and internal.shedArrivals == 4 and internal.halfOpenAtNs == 31000000;
    assert selfBreaker.trips == 1 and selfBreaker.halfOpenAtNs == 35000000;
    assert store.puts == 3 and selfStore.puts == 3;
    store.setDown(false);
    selfStore.setDown(false);
    publish feed.toInternal.accepted(7);
    publish feed.toSelf.accepted(7);
    wait 5ms;
    assert internal.written == 1 and selfBreaker.written == 1 and internal.consecutiveFailures == 0;
  }
}
```

### 47-reaction-forms.swaml

```swaml
package ReactionForms {
  /** Every 2.3 state reaction form in one machine: completion transitions, internal and external timers with and without guards, literal and computed, internal receive transitions with and without guards, and a deferral of an event and an attribute in one line. defer stays a name elsewhere, here an attribute. */
  port def Feed {
    provides event tick(n: uint);
    provides attribute level: uint;
    provides event done();
  }
  component def Counter {
    reversed port feed: Feed;
    attribute total: uint = 0;
    attribute stepMs: uint = 2;
    attribute defer: uint = 0;
    attribute polls: uint = 0;
    operation run() {
      initial Warmup;
      state Warmup {
        defer feed.tick, feed.level;
        on entry {
          defer = defer + 1;
        }
        after 1ms {
          polls = polls + 1;
        }
        after (stepMs * 1ms) when (polls > 0) {
          polls = polls + 10;
        }
        after 3ms when (polls > 100) to Done {
        }
        after (stepMs * 2ms) when (polls == 11) to Counting {
        }
        when (defer > 1) to Done {
        }
      }
      state Counting {
        on receive feed.tick(n) when (n > 0) {
          total = total * 10 + n;
        }
        on receive feed.tick(n) {
          polls = polls + 100;
        }
        on receive feed.level(v) {
          total = total * 10 + v;
        }
        on receive feed.done() to Done {
        }
        when (total > 5000) to Done {
        }
      }
      final state Done {
      }
    }
    schedule {
      on start run();
    }
  }
  component def Source {
    port out: Feed;
  }
  component counter: Counter;
  component source: Source;
  connect: Swaml::Qos::Latest (source.out, counter.feed);
  associate source to 'Every form';
  test 'Every form' of counter {
    /** A level, a tick and a second level arrive during Warmup and are retained; the second level replaces the first (Latest keeps one value), so the level queue is older than the tick queue but holds the later offer. Counting (entered at 4 ms by the guarded computed timer) takes them in offer order, tick then level, folding total = total * 10 + value to 32 (queue order would give 23), then a zero tick, then done. */
    send source.out.level(1);
    publish source.out.tick(3);
    send source.out.level(2);
    wait 5ms;
    assert counter.total == 32 and counter.polls == 11;
    publish source.out.tick(0);
    publish source.out.done();
    wait 1ms;
    assert counter.polls == 111;
  }
}
```

### 48-door-status-sampling.swaml

```swaml
package DoorStatus {
  /** A transmit task in the shape of the door model's ComMain. In 2.2 it needs a store handler per required attribute (StoringCom: a receive entry and an attribute copy for each value it sends). From 2.3 an attribute member that declares an initial value is sampled: door.ajar reads the latest value delivered to the port without a handler (SamplingCom). The cell holds the initial value until the first delivery, takes each delivered value at its delivery instant whether or not an owner consumes it, and is read live, also after a suspension. */
  datatype StatusPdu {
    ajar: bool;
    window: int;
  }
  port def DoorState {
    provides attribute ajar: bool = false;
    provides attribute window: int = -1;
  }
  port def StatusFrames {
    provides event status(pdu: StatusPdu);
  }
  component def StoringCom {
    /** The 2.2 shape: one stored copy and one handler per sent value. */
    reversed port door: DoorState;
    port tx: StatusFrames;
    attribute ajarCopy: bool = false;
    attribute windowCopy: int = -1;
    attribute frames: uint = 0;
    operation storeAjar(v: bool) {
      ajarCopy = v;
    }
    operation storeWindow(v: int) {
      windowCopy = v;
    }
    operation txMain() {
      publish tx.status(record StatusPdu { ajar = ajarCopy; window = windowCopy; });
      frames = frames + 1;
    }
    schedule {
      on receive door.ajar(v) storeAjar(v);
      on receive door.window(v) storeWindow(v);
      on every 10ms txMain();
    }
  }
  component def SamplingCom {
    /** The 2.3 shape: ajar is sampled only; window is sampled and also consumed by a handler that counts its changes. */
    reversed port door: DoorState;
    port tx: StatusFrames;
    attribute sentAjar: bool = false;
    attribute sentWindow: int = 0;
    attribute frames: uint = 0;
    attribute windowChanges: uint = 0;
    attribute settled: int = 0;
    operation onWindow(v: int) {
      windowChanges = windowChanges + 1;
    }
    operation txMain() {
      sentAjar = door.ajar;
      sentWindow = door.window;
      publish tx.status(record StatusPdu { ajar = door.ajar; window = door.window; });
      frames = frames + 1;
    }
    operation settle() {
      /** Reads the window position, waits, and reads it again: the second read sees a value delivered during the wait. */
      var before: int = door.window;
      wait 4ms;
      settled = door.window - before;
    }
    schedule {
      on receive door.window(v) onWindow(v);
      on every 10ms txMain();
      on every 20ms settle();
    }
  }
  component def Sensors {
    /** Interface-only actor for the door sensors. */
    port toStoring: DoorState;
    port toSampling: DoorState;
  }
  component def Gateway {
    /** Interface-only actor that receives the status frames. */
    reversed port fromStoring: StatusFrames;
    reversed port fromSampling: StatusFrames;
  }
  component storing: StoringCom;
  component sampling: SamplingCom;
  component sensors: Sensors;
  component gateway: Gateway;
  connect (sensors.toStoring, storing.door);
  connect (sensors.toSampling, sampling.door);
  connect (storing.tx, gateway.fromStoring);
  connect (sampling.tx, gateway.fromSampling);
  associate sensors, gateway to 'Initial values before the first delivery', 'Latest value at each frame', 'Live read after a wait';
  test 'Initial values before the first delivery' of sampling {
    /** Nothing is sent: the 10 ms frame carries the declared initial values, false and -1 (not the zero value 0). */
    wait 15ms;
    assert sampling.frames == 1 and not sampling.sentAjar and sampling.sentWindow == -1;
  }
  test 'Latest value at each frame' of sampling {
    /** The door opens at 2 ms and the window moves to 30 and then 60 before the 10 ms frame; the frame carries the latest values. Only window is consumed, so ajar has no pending value and no deliver observation, and both window values are counted. At 11 ms the door closes; the 20 ms frame carries false. */
    wait 2ms;
    send sensors.toSampling.ajar(true);
    send sensors.toSampling.window(30);
    send sensors.toSampling.window(60);
    wait 9ms;
    assert sampling.frames == 1 and sampling.sentAjar and sampling.sentWindow == 60;
    send sensors.toSampling.ajar(false);
    wait 9ms;
    assert sampling.frames == 2 and not sampling.sentAjar and sampling.sentWindow == 60 and sampling.windowChanges == 2;
  }
  test 'Live read after a wait' of sampling {
    /** settle reads the window at 20 ms, waits 4 ms and reads again. A value delivered at 22 ms is seen by the second read: settled is the difference 50 - 10. */
    wait 5ms;
    send sensors.toSampling.window(10);
    wait 17ms;
    send sensors.toSampling.window(50);
    wait 8ms;
    assert sampling.settled == 40;
  }
}
```

### 49-body-can-member-policies.swaml

```swaml
package BodyCan {
  /** A body CAN link in the shape of the door model's BodyCanFrames. Event-triggered frames (crash) must be queued and kept in order, while a cyclic frame (lockStatus) only needs its latest value. In 2.2 one connection has one policy, so either cyclic frames pile up or crash frames are lost. From 2.3 a connection names a policy per member: connect bodyCan: Cyclic (bcm.bus, dcu.canBus) { crash: CanEvent; } queues crash frames with CanEvent and keeps only the newest lockStatus frame with Cyclic. The effective policy of a member route is its member policy, else the connection policy, else Swaml::Qos::Default. */
  import Swaml::Qos;
  qos def CanEvent: Policy {
    delivery = Delivery.atMostOnce;
    ordering = Ordering.fifo;
    capacity = 8;
    overflow = Overflow.dropOldest;
    requestTimeout = 1s;
  }
  qos def Cyclic: Policy {
    delivery = Delivery.atMostOnce;
    ordering = Ordering.fifo;
    capacity = 1;
    overflow = Overflow.dropOldest;
    requestTimeout = 1s;
  }
  port def BodyCanFrames {
    provides event crash(severity: int);
    provides event lockStatus(locked: bool);
  }
  component def DoorEcu {
    /** Takes one frame, then stays busy for 5 ms and retains the frames that arrive meanwhile in their connection queues, where each member route's policy applies. */
    reversed port canBus: BodyCanFrames;
    attribute crashes: uint = 0;
    attribute crashOrder: int = 0;
    attribute statuses: uint = 0;
    attribute locked: bool = false;
    operation run() {
      initial idle;
      state idle {
        on receive canBus.crash(severity) to busy {
          crashes = crashes + 1;
          crashOrder = crashOrder * 10 + severity;
        }
        on receive canBus.lockStatus(v) to busy {
          statuses = statuses + 1;
          locked = v;
        }
      }
      state busy {
        defer canBus.crash, canBus.lockStatus;
        after 5ms to idle {
        }
      }
    }
    schedule {
      on start run();
    }
  }
  component def Bcm {
    /** Interface-only actor: the body control module. */
    port bus: BodyCanFrames;
    port plainBus: BodyCanFrames;
  }
  component dcu: DoorEcu;
  component plain: DoorEcu;
  component bcm: Bcm;
  connect bodyCan: Cyclic (bcm.bus, dcu.canBus) {
    crash: CanEvent;
  }
  connect plainCan: Cyclic (bcm.plainBus, plain.canBus);
  associate bcm, plain to 'Per-member policies on one connection';
  test 'Per-member policies on one connection' of dcu {
    /** Three crash frames and three lock status frames in one burst. dcu takes the first status frame at once; while it is busy its status queue keeps only the newest of the two others (Cyclic, capacity 1, dropOldest) and its crash queue keeps every crash frame (CanEvent): two status frames, the last one true, and three crashes in the order 1, 2, 3. plain has the one policy Cyclic for both members, so it loses crash frames too: it handles crash 1 and then only crash 3. */
    publish bcm.bus.lockStatus(true);
    publish bcm.bus.lockStatus(false);
    publish bcm.bus.lockStatus(true);
    publish bcm.bus.crash(1);
    publish bcm.bus.crash(2);
    publish bcm.bus.crash(3);
    publish bcm.plainBus.crash(1);
    publish bcm.plainBus.crash(2);
    publish bcm.plainBus.crash(3);
    wait 100ms;
    assert dcu.statuses == 2 and dcu.locked;
    assert dcu.crashes == 3 and dcu.crashOrder == 123;
    assert plain.crashes == 2 and plain.crashOrder == 13;
  }
}
```

### 50-lin-master-mode-gating.swaml

```swaml
package LinMasterGating {
  /** A LIN master in the shape of the door model's LinMaster. In 2.2 it keeps a sleeping flag and returns early from every 20 ms slot, so the Timing view shows activations that do nothing. From 2.3 a release guard, when (g), gates the release: while the sampled power mode is sleep no slot runs and no header is sent, the deadline armed at the release is cancelled, and the skip counts as a completion, so the alive checkpoint after each slot still runs. A response that arrives while asleep is consumed and discarded by the guarded receive entry. Periodic releases stay on the 20 ms grid. */
  import Swaml::Time;
  enum PowerMode {
    startup,
    run,
    sleep
  }
  datatype LinResponse {
    switches: uint;
    alive: uint;
  }
  port def ModeState {
    provides attribute current: PowerMode = PowerMode.startup;
  }
  port def LinBus {
    provides event response(frame: LinResponse);
    requires event header(id: uint);
  }
  port def SwitchFrames {
    provides event frame(switches: uint);
  }
  component def LinMaster {
    /** One unconditional frame per 20 ms slot: each slot evaluates the response to the previous header and sends the next one. */
    reversed port bus: LinBus;
    reversed port mode: ModeState;
    port frames: SwitchFrames;
    attribute response: LinResponse = record LinResponse {
      switches = 0;
      alive = 256;
    };
    attribute received: bool = false;
    attribute lastAlive: uint = 256;
    attribute missed: uint = 0;
    attribute headers: uint = 0;
    attribute checkpoints: uint = 0;
    attribute lastSlotNs: uint = 0;
    operation storeResponse(frame: LinResponse) {
      response = frame;
      received = true;
    }
    operation slot() {
      /** No early return: the release guard decides whether the slot runs. */
      if (headers > 0) {
        if (received and response.alive != lastAlive) {
          missed = 0;
          lastAlive = response.alive;
          publish frames.frame(response.switches);
        } else {
          missed = missed + 1;
        }
      }
      received = false;
      headers = headers + 1;
      lastSlotNs = now();
      publish bus.header(16);
    }
    operation checkpoint() {
      /** The alive supervision checkpoint of the slot, awake or asleep. */
      checkpoints = checkpoints + 1;
    }
    schedule {
      on receive bus.response(frame) storeResponse(frame) when (mode.current != PowerMode.sleep);
      on every 20ms slot() when (mode.current != PowerMode.sleep) deadline 2ms;
      after slot checkpoint();
    }
  }
  component def Slave {
    /** Interface-only actor: the LIN slave that answers headers. */
    port bus: LinBus;
  }
  component def Ecu {
    /** Interface-only actor: the ECU state manager that broadcasts the power mode. */
    port mode: ModeState;
  }
  component def Gateway {
    /** Interface-only actor that receives the switch frames. */
    reversed port frames: SwitchFrames;
  }
  component lin: LinMaster;
  component slave: Slave;
  component ecu: Ecu;
  component gateway: Gateway;
  connect (slave.bus, lin.bus);
  connect (ecu.mode, lin.mode);
  connect (lin.frames, gateway.frames);
  associate slave, ecu, gateway to 'Headers every slot while awake', 'No headers while asleep, checkpoints continue', 'Responses while asleep are dropped', 'Slots stay on the grid after waking';
  test 'Headers every slot while awake' of lin {
    /** Slots at 20, 40 and 60 ms; the response to the first header is published at the second slot. */
    wait 25ms;
    publish slave.bus.response(record LinResponse { switches = 5; alive = 1; });
    wait 40ms;
    assert lin.headers == 3 and lin.checkpoints == 3 and lin.lastSlotNs == 60000000;
    assert lin.lastAlive == 1 and lin.missed == 1;
  }
  test 'No headers while asleep, checkpoints continue' of lin {
    /** The power mode becomes sleep at 30 ms: the slots at 40 to 100 ms are skipped, but every skip releases the checkpoint after it. */
    wait 30ms;
    send ecu.mode.current(PowerMode.sleep);
    wait 75ms;
    assert lin.headers == 1 and lin.checkpoints == 5 and lin.lastSlotNs == 20000000;
  }
  test 'Responses while asleep are dropped' of lin {
    /** A response at 25 ms is evaluated at 40 ms. The response at 50 ms arrives while asleep and is discarded, so after waking at 70 ms the slot at 80 ms counts a missed response instead of publishing a stale one. */
    wait 25ms;
    publish slave.bus.response(record LinResponse { switches = 5; alive = 1; });
    wait 20ms;
    send ecu.mode.current(PowerMode.sleep);
    wait 5ms;
    publish slave.bus.response(record LinResponse { switches = 9; alive = 2; });
    wait 20ms;
    send ecu.mode.current(PowerMode.run);
    wait 15ms;
    assert lin.headers == 3 and lin.lastAlive == 1 and lin.missed == 1 and not lin.received;
  }
  test 'Slots stay on the grid after waking' of lin {
    /** Asleep from 10 ms, awake again at 47 ms: the next slot runs at 60 ms on the 20 ms grid, not 20 ms after waking. */
    wait 10ms;
    send ecu.mode.current(PowerMode.sleep);
    wait 37ms;
    send ecu.mode.current(PowerMode.run);
    wait 18ms;
    assert lin.headers == 1 and lin.lastSlotNs == 60000000 and lin.checkpoints == 3;
  }
}
```

### 51-com-main-release-guard.swaml

```swaml
package ComMainGating {
  /** Com main functions in the shape of the door model's ComMain. In 2.2 txMainFunction returns early while the power mode is sleep. From 2.3 the after entry carries a release guard: reception runs every 20 ms whatever the mode, transmission only while awake, and its 100 ms timer pauses while asleep instead of advancing. The diagnostics entry is guarded by a helper that reads the sampled mode. */
  import Swaml::Time;
  enum PowerMode {
    startup,
    run,
    sleep
  }
  datatype DoorStatusPdu {
    ajar: bool;
    alive: uint;
  }
  port def ModeState {
    provides attribute current: PowerMode = PowerMode.run;
  }
  port def DoorState {
    provides attribute ajar: bool = false;
  }
  port def TxPdu {
    provides event doorStatus(pdu: DoorStatusPdu);
  }
  port def Diagnostics {
    provides event report(rxCycles: uint);
  }
  component def ComMain {
    reversed port mode: ModeState;
    reversed port door: DoorState;
    port tx: TxPdu;
    port diag: Diagnostics;
    const attribute txPeriodMs: uint = 100;
    attribute rxCycles: uint = 0;
    attribute txRuns: uint = 0;
    attribute txTimerMs: uint = 0;
    attribute txAlive: uint = 0;
    attribute framesSent: uint = 0;
    attribute lastFrameNs: uint = 0;
    attribute reports: uint = 0;
    operation networkActive() returns bool {
      return mode.current == PowerMode.run;
    }
    operation rxMainFunction() {
      /** 20 ms reception; it runs in every mode. */
      rxCycles = rxCycles + 1;
    }
    operation txMainFunction() {
      /** 20 ms: cyclic transmission of the door status every 100 ms of awake time. */
      txRuns = txRuns + 1;
      txTimerMs = txTimerMs + 20;
      if (txTimerMs >= txPeriodMs) {
        txTimerMs = 0;
        txAlive = (txAlive + 1) % 16;
        framesSent = framesSent + 1;
        lastFrameNs = now();
        publish tx.doorStatus(record DoorStatusPdu { ajar = door.ajar; alive = txAlive; });
      }
    }
    operation reportDiagnostics() {
      reports = reports + 1;
      publish diag.report(rxCycles);
    }
    schedule {
      on every 20ms rxMainFunction() deadline 2ms;
      after rxMainFunction txMainFunction() when (mode.current != PowerMode.sleep) deadline 5ms;
      on every 100ms reportDiagnostics() when (networkActive()) deadline 10ms;
    }
  }
  component def Ecu {
    /** Interface-only actor: the ECU state manager and the door sensor. */
    port mode: ModeState;
    port door: DoorState;
  }
  component def Gateway {
    /** Interface-only actor that receives the frames and the diagnostics. */
    reversed port tx: TxPdu;
    reversed port diag: Diagnostics;
  }
  component com: ComMain;
  component ecu: Ecu;
  component gateway: Gateway;
  connect (ecu.mode, com.mode);
  connect (ecu.door, com.door);
  connect (com.tx, gateway.tx);
  connect (com.diag, gateway.diag);
  associate ecu, gateway to 'Frames every 100 ms while awake', 'Transmission pauses while asleep, reception continues', 'The transmit timer resumes after waking';
  test 'Frames every 100 ms while awake' of com {
    wait 5ms;
    send ecu.door.ajar(true);
    wait 200ms;
    assert com.rxCycles == 10 and com.txRuns == 10 and com.framesSent == 2 and com.lastFrameNs == 200000000;
    assert com.reports == 2;
  }
  test 'Transmission pauses while asleep, reception continues' of com {
    /** Asleep from 50 ms: transmission ran at 20 and 40 ms only, its timer holds 40 ms, and no frame or report is sent. */
    wait 50ms;
    send ecu.mode.current(PowerMode.sleep);
    wait 155ms;
    assert com.rxCycles == 10 and com.txRuns == 2 and com.txTimerMs == 40 and com.framesSent == 0 and com.reports == 0;
  }
  test 'The transmit timer resumes after waking' of com {
    /** Asleep from 50 to 130 ms: the timer continues from 40 ms at 140 ms and reaches 100 ms at 180 ms, which sends the first frame. */
    wait 50ms;
    send ecu.mode.current(PowerMode.sleep);
    wait 80ms;
    send ecu.mode.current(PowerMode.run);
    wait 55ms;
    assert com.txRuns == 5 and com.framesSent == 1 and com.lastFrameNs == 180000000 and com.txTimerMs == 0;
    assert com.reports == 0;
  }
}
```
