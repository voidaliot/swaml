# swa.ml 1.4 specification improvements

**Date:** 2026-10-20, 2.0 direction added 2026-10-21 · **Scope:** review of the 1.4 development specification ([index](LANGUAGE_SPECIFICATION.md), normative chapters 1–9, [grammar](../src/language/swaml.langium)) with spot checks of the validator and reference simulator. Informative; no rule here is normative until adopted through the usual grammar/prose/ADR process.

Priority: **P1** fix before the next edition, **P2** clarify or decide soon, **P3** editorial or longer-term. Items marked *decision* change language design and need an ADR.

## A. Defects and inconsistencies

| ID | Priority | Improvement | Location |
| --- | --- | --- | --- |
| A1 | P1 | Replace stale version references: chapter 6 title says "swa.ml 1.3 specification"; in-place mutation "not part of 1.3"; pub/sub features "outside 1.3". | [06](spec/06-execution-contract.md), [01 §1.4](spec/01-structure-and-types.md), [02 §2.5](spec/02-communication.md) |
| A2 | P1 | Complete the §4.5 diagnostic table: add SW016 (class/component specialization direction), SW065 (interruptible regions) and SW066/SW067 (completion dependencies); remove the duplicated specialization/redefinition entry between *Reuse* and *Architecture*. | [04 §4.5](spec/04-systems-and-conformance.md), [08 §8.1](spec/08-conformance-obligations.md) |
| A3 | P1 | Use `MemberPath` (exactly `localPort.member`) for `send`/`publish`, `on receive`, `on call`, transition `on receive` and `interruptible … on receive`, matching §1.2 and the existing `RemoteCall` rule. | [grammar](../src/language/swaml.langium) |
| A4 | P2 | Either state the `priority` attribute-name exception in §1.1 ("every quoted word is reserved") or generalize it through contextual keywords (see C6). | [01 §1.1](spec/01-structure-and-types.md), [04 §4.3](spec/04-systems-and-conformance.md) |
| A5 | P2 | Align the language edition versioning policy with practice: 1.1, 1.2.1 and 1.3.1 changed syntax or added keywords in minor/patch editions, contrary to the semver intent stated for interfaces in §2.1. Either define a separate language-edition policy or follow semver. | [index §2](LANGUAGE_SPECIFICATION.md), [08 §8.5](spec/08-conformance-obligations.md), [CHANGELOG](../CHANGELOG.md) |
| A6 | P3 | Restrict the view filter grammar to the permitted subset (name/kind/path, string/Boolean literals, `== != and or not`, parentheses) instead of accepting any `Expression` and rejecting later with SW080. | [grammar](../src/language/swaml.langium), [04 §4.4](spec/04-systems-and-conformance.md) |
| A7 | P3 | Harmonize formal `doc` placement. Today it is first in braces (packages, types, states, cases), before `;` (leaf members), after the name (`interruptible`) and before the keyword (`transition` only). | [grammar](../src/language/swaml.langium), [04 §4.4](spec/04-systems-and-conformance.md) |

## B. Ambiguities to resolve

| ID | Priority | Improvement | Location |
| --- | --- | --- | --- |
| B1 | P1 | Forbid `concurrency reentrant` on stateful functions. §3.4 allows a reentrant reaction schedule while requiring at most one reaction in progress; §6.3 mentions reentrant machine snapshots; the validator currently accepts it. | [03 §3.4](spec/03-behavior.md), [06 §6.3](spec/06-execution-contract.md) |
| B2 | P1 | Define "used functions" for realtime/mixed timing obligations (all expanded executables, triggered ones, or reachable ones). | [04 §4.1](spec/04-systems-and-conformance.md) |
| B3 | P2 | Give the `mixed` profile distinct static obligations or remove it until explicit partitioning exists; today it equals `realtime` in every checked row. *Decision.* | [04 §4.1](spec/04-systems-and-conformance.md) |
| B4 | P2 | Specify whether a data/event emission over a failed bound route fails the emitting activation (as `reject` does) or is only observed. | [06 §6.4](spec/06-execution-contract.md) |
| B5 | P2 | List `Interrupted` as a terminal correlation reason in §2.4/§6.5 and state that `otherwise` never observes it. | [02 §2.4](spec/02-communication.md), [06 §6.5](spec/06-execution-contract.md) |
| B6 | P2 | Add a static warning when an interrupt-region member has no consumer outside armed intervals; such input is otherwise silently discarded. | [03 §3.2](spec/03-behavior.md), [06 §6.5](spec/06-execution-contract.md) |
| B7 | P3 | Wording fixes: §3.7 "dispatch-time snapshot **or** serial lock" should read "and"; §1.5 "Local call graphs MUST be acyclic" should name the calculation call graph. | [03 §3.7](spec/03-behavior.md), [01 §1.5](spec/01-structure-and-types.md) |

## C. Language design

| ID | Priority | Improvement |
| --- | --- | --- |
| C1 | P1 *decision* | Give `class`/`component` and `operation`/`function` a semantic difference or collapse each pair. Both pairs own identical members and share all execution rules; the distinction only adds keywords, compatibility rules and doubled view filters (`kind == "operation" or kind == "function"`). Possible differentiators: component as the deployable/allocatable boundary and class as internal structure only. |
| C2 | P2 *decision* | Address the KerML naming clash: swa.ml `class` maps to KerML Structure (KerML has its own Class); swa.ml `function` (side-effecting) maps to Behavior while `calc` maps to KerML Function. At minimum add a terminology table to chapter 5. |
| C3 | P2 | Map message emission and RPC onto KerML Interaction/Flow and the Transfers library rather than a custom communication Step type. |
| C4 | P1 *decision* | Add numeric conversions and basic built-ins: real→int (`floor`, `round`, `trunc` with checked range), `abs`, `min`/`max`; consider string concatenation/length. Note that `byte`/`uint` arithmetic always yields `int`. |
| C5 | P2 *decision* | Relax RPC failure handling: allow an explicit typed binding (`otherwise (f: CallFailure) { … }`) with a built-in failure enum instead of an implicit `failure: string`, and allow fall-through when a fallback value is established. Replace the implicit transition `payload` name with an explicit binding as well. |
| C6 | P2 *decision* | Reduce the reserved-word burden (~131 keywords, no escaped identifiers). Common domain names such as `state`, `data`, `event`, `version`, `capacity`, `label`, `record`, `initial` and `final` cannot be field or variable names. Use contextual keywords or an identifier escape. |
| C7 | P2 *decision* | Disambiguate overloaded keywords: `on` (trigger, deployment, interrupt), `after` (state timer, case predecessor), `call` (local, routed, trigger, case step) and especially `completion` (state transition vs `on completion A`); e.g. `after success of A`. |
| C8 | P3 | Replace `deploy RootName on …` with a dedicated self form (`deploy self on …`) so root-relative paths need no SW070 ambiguity rule. |
| C9 | P3 | Expressiveness: fixed multiplicity usages (`component s: Sensor[3];`) consistent with static topology; multiple `after` predecessors (joins) in case steps; `min`/`h` duration units; cross-package view selection. Document the ~104-day duration ceiling (2^53 ns). |
| C10 | P2 | Make string-path references real cross-references where possible (connector/deployment/view paths, case `via` connector and `after` predecessor) so rename, navigation and references work without bespoke resolution. |

## D. Definition, usage and calls

These follow from how the current implementation handles definitions, usages and local calls and should be preserved or made explicit before the editor implements related features.

| ID | Priority | Improvement |
| --- | --- | --- |
| D1 | P1 | State explicitly that local calls in inherited bodies are late-bound by name in the concrete occurrence's effective members (template-method dispatch). The linker binds `call helper()` to the base declaration, while the simulator executes the effective redefinition. §1.3 implies this; "no overloaded dispatch" can be misread as excluding it. |
| D2 | P1 | Keep the invariant that redefinition preserves parameters, result, trigger kind and body category; the validator checks local calls against the base declaration's signature and is only sound because of it. Add a regression test that a redefined helper with a changed signature is rejected. |
| D3 | P2 | Tooling contract: go-to-definition from an inherited body should offer the base declaration and, per occurrence, the effective redefinition; diagrams should distinguish definition identity from occurrence path. |
| D4 | P2 | Provide a modeled way to vary usage initial values without a new specialization (e.g. usage-level initializer bindings), since typed usages cannot override private initializers today. *Decision.* |

## E. Document structure

| ID | Priority | Improvement |
| --- | --- | --- |
| E1 | P2 | Number or fold the unnumbered release-note sections in the index ("Local completion activation…", "Requirements and formal documentation", "Extended function flow and timing"). |
| E2 | P2 | Remove the identical "Requirement and presentation extension" paragraph repeated at the end of chapters 7, 8 and 9; keep one normative statement. |
| E3 | P3 | Move edition history (1.1, 1.2.1, 1.3, 1.3.1 notes in §8.5, §4.6 and the index) into a non-normative history annex. |
| E4 | P3 | Rename or mark [SPECIFICATION_AUDIT.md](SPECIFICATION_AUDIT.md) as the historical 0.1 audit in its file name. |

## F. Adopted direction for swa.ml 2.0

> The finalized design, including later decisions on ports, receive statements, suspension and deployment, is the [swa.ml 2.0 transition specification](SWAML_2_0_TRANSITION.md). Where this section differs, the transition specification wins; this section is kept as the decision history.

Decided on 2026-10-21; failure handling, loops, states, chaining, library and multiplicity refined the same day. These decisions replace several 1.4 invariants and therefore define a new breaking edition, 2.0. They are not yet specified, implemented or covered by an ADR. Examples use `text` fences because they are not valid 1.4 source.

Guiding rule: **a `def` says what something is; a usage says where it lives and when it runs.** A declaration has the shape `modifiers keyword name : Type = value returns T { body }`; nothing else trails the name. Activation moves into `schedule`, policies move into typed library definitions and flags become prefixes.

### F1. Structure

- `component` is the only structural kind; `class` is removed together with SW016 and the class/component narrowing rules.
- `component def` declares a type, `component x: T;` a usage and a package-level usage a root. A usage body is an anonymous specialization: it may redefine members, including attribute initializers, so per-usage values need no generated specialization (D4).
- Specialization, usage bodies and `redefines` share one rule: whole-member replacement, never partial merging.
- Fixed usage multiplicity is part of 2.0 in a restricted form: `component wheels: WheelSensor[4];` with per-index paths in connectors and deployments (`wheels[0].speed`, `deploy wheels[2] on …`). Every index is a separate occurrence with its own store. Connector loops and port arrays are excluded.

### F2. Attributes and locals

- `attribute name: T = value;` declares component-owned state that lives for the run, is part of the type, can be redefined per usage and is protected by the serial lock. `const attribute` cannot be assigned.
- `var name: T = value;` declares a local of an activation or block.
- Requirement attributes are the same concept on an element without behavior, so no special immutability rule is needed.
- Types stay explicit; there is no type inference.

### F3. Operations

- `operation` is the only executable keyword; `function` and `calc` are removed. Authors never write KerML terms: an operation with a result maps to a KerML Function, a void operation to a Behavior.
- Results use `returns T` (not `: T`), so `:` always means "typed by". Declarations always have parentheses; usages never do.
- `operation def F(...) returns T { … }` at package level may use only its parameters and nested operations, so it is effectively pure and reusable across components.
- `operation x: F;` is a usage that inherits the body; `operation x: F { … }` replaces the whole body. The signature always comes from the definition.
- Operations may own nested operations. Nested operations see their own parameters and the component's attributes, never the enclosing operation's parameters or locals.
- Calls are expressions: `if (scale(x) > 1.0)`; void operations are statements: `reset();`. `call` and `as` are removed. Discarding a non-void result is an error.
- `in`/`out` parameters are allowed. A call with `out` arguments is a statement; out values are copied back only on successful return.
- The validator infers an effect class for every operation (pure, reads state, writes state, communicates, suspends) through its acyclic call graph and enforces it by context:

| Context | Permitted effect classes |
| --- | --- |
| state guards, view filters | pure, reads state |
| attribute initializers | pure |
| `concurrent` schedule entries | no writes, including through callees |
| other expressions | anything except suspends |
| statements and `var` initializers | anything |

- A runtime failure propagates: it fails the current activation, without rollback of effects already committed. `try(expression, fallback)` stops that propagation for one expression:
  - It catches **every runtime failure** while evaluating `expression`, local or remote: remote call failures, arithmetic and range failures, invalid indexes, failed `assert` and `fail` in called operations. Static syntax and semantic errors are never caught; `try` applies only to valid models.
  - The fallback must be assignable to the expression's type and is evaluated only on failure, so fallbacks can nest: `try(primary.get(k), try(backup.get(k), 0.0))`.
  - Void forms: `try(cfg.reset(), log("reset failed"));` runs the fallback on failure; `try(cfg.reset());` explicitly ignores failure.
  - Effects committed before the failure remain. Interrupts are not failures and go to the region handler. Contract violations (deadline miss, activation overflow, resource limits) are not failures of the expression and are not caught.
  - The failure reason is not available in the model; it is recorded in the trace.
  - A `try` containing a remote call suspends, so it must be a whole `var` initializer, assignment right side or statement.
- `otherwise`, the `Reply` result idea and failure blocks are not part of 2.0.

```text
var level: real = try(store.get(key), 0.0);
gain = try(cfg.read("gain"), gain);
var ratio: real = try(a / b, 0.0);
try(cfg.reset(), log("reset failed"));
```

- Numeric conversions and helpers (`floor`, `round`, `trunc`, `abs`, `min`, `max`, string `length`/`concat`) ship as operation definitions in a pinned standard library (C4).
- Recursion remains forbidden; declaration order remains irrelevant; names stay unique (no overloading, default parameters, generics or `super`).

```text
operation def Clamp(v: real, lo: real, hi: real) returns real { … }

component def Controller {
  attribute gain: real = 2.0;
  operation scale(x: real) returns real { return x * gain; }
  operation limit: Clamp;
  operation reset() { gain = 2.0; }
}
```

#### Loops

- `while (c) { … }` tests first; `until (c) { … }` runs the body at least once and stops when `c` is true (replacing `do … while`).
- Both take an optional limit: `while (c, n)` and `until (c, n)`, where `n` is a `uint` expression evaluated once at loop entry. Reaching the limit exits the loop normally; test the condition afterwards if the reason matters.
- `for (var i: int = 0; i < n; i = i + 1) { … }` is the counted loop; `for (x: real in samples) { … }` iterates a copied fixed array (replacing `forEach`).
- `bound`, `do` and `forEach` are removed. Termination becomes an analysis concern; deadlines and the simulator's step budget detect runaway loops at run time.

```text
while (not connected, 3) { connected = connect(); }
if (not connected) { fail "no connection"; }
until (done, 100) { done = step(); }
```

### F4. Schedule and timing

- Triggers and timing move from operation headers into one `schedule` block per component. Entries have no names; the pair (trigger, operation) is their identity, and a duplicate pair is an error. A specialization redefines an entry by repeating its pair.
- Triggers: `on start`, `on every D`, `on receive port.member(args)`, `on call port.member(args)` (the operation's result is the reply and must match the signature) and `after op`. One operation may have several entries.
- `after op target();` releases a fresh activation of `target` after each successful completion of `op`. `op` must be an operation of the same component, including an inherited one; paths, interface members and qualified names are rejected. Failure releases nothing, and the `after` graph must be acyclic. This replaces 1.4's `on completion A` and lets a specialization extend a base operation without replacing its body.
- Arguments are evaluated and copied at dispatch time, under the lock.
- `deadline D` is optional per entry; cyclic entries default to their period. `concurrent` permits overlapping activations and is valid only for operations inferred not to write state; stateful operations cannot be concurrent (B1).
- `wait D;` is a statement. It suspends the activation, **releases the serial lock** and counts against the deadline. Remote request suspension follows the same rule, so the language has one suspension semantics.
- WCET leaves source; it belongs to the target binding and evidence. The `timing` block and `wcet`, `concurrency`, `serial` and `reentrant` are removed.
- Root profiles (`service`, `realtime`, `mixed`) are removed (B2, B3). Requiring deadlines on every entry becomes a host validation setting or a requirement on the root.

```text
component def Controller {
  attribute y: int = 0;
  requires port cmd: Commands;

  operation f(in x: int, out r: int) { … }
  operation o(in v: int) {
    if (v < 2) {
      var x: int = v + 1;
      wait 10s;
      f(x, y);
    }
  }

  operation notify() { … }

  schedule {
    on start o(y);
    on every 10ms o(y) deadline 5ms;
    on receive cmd.set(n) o(n);
    after o notify();
  }
}
```

The timing view keeps every trace-based drawing (release, dispatch, ready, running, request wait, completion/failure/interrupt, open intervals) and gains two modes:

| Mode | Drawn from |
| --- | --- |
| Declared | schedule release grid, release causes (`o ← every 10ms`), deadlines, statically known `wait` intervals and concurrent overlap |
| Observed | a trace overlaid on the declared mode, including lock gaps while an activation waits, message latency between lanes and WCET/budget bars labeled with their binding or evidence source |

### F5. Interfaces, ports and communication

- `interface def S { … }` replaces the four interface kinds; `version` is removed. Members are `data` (always sampled), `event` and `operation` signatures. Queued data becomes an event with one parameter. `idempotent` is a prefix.
- Ports have two roles: `provides port p: S;` and `requires port p: S;`, with `optional` as a prefix. The provider implements operations and emits data and events; the requirer issues requests and receives data and events.
- Connection cardinality follows from content: if an interface has operations or data, a requiring port has exactly one provider; an event-only interface permits many providers.
- QoS policies are definitions typed by a library policy definition with enum-valued attributes, including the request timeout. Inline QoS bodies are removed; the library ships common policies.
- Connectors are typed by their policy: `connect c: Reliable a.o -> b.i;`.
- Remote requests take their timeout from the connector policy. A failed request propagates like any runtime failure unless wrapped in `try` (F3):

```text
qos def Reliable: Policy {
  delivery = Delivery.atLeastOnce;
  ordering = Ordering.fifo;
  capacity = 16;
  overflow = Overflow.reject;
  requestTimeout = 50ms;
}

var level: real = try(store.get(key), 0.0);
```

### F6. States

- `final state Done { … }` uses a prefix. Reaching a final state completes the operation.
- State actions are `on entry { … }` and `on exit { … }`.
- Transitions are nested in their source state and have no names: `on receive port.member(args) when (g) -> B { effect }` and the timer form `after D -> B { effect }`. Within a state, transitions are evaluated in declaration order and the first enabled one is taken; `priority` is removed. Editors must therefore let users reorder transitions.
- State completion transitions are removed. Work that ran in `entry` before an automatic transition moves into the triggering transition's effect, and decisions move into that transition's guards.

```text
state Running {
  on entry { start(); }
  on exit  { stop(); }
  on receive cmd.halt -> Idle { }
  on receive sensor.sample(v) when (v > 10) -> Alarm { level = v; }
  after 5s -> Sleeping { }
}
```

### F7. Views, cases and documentation

- View kinds become library view definitions: `view v: Timing of X;`. The seven kind keywords are removed.
- Case steps put the name first: `n: send a -> b via c after s;`. `label` is removed.
- A formal `doc` is always first in a body, or immediately before `;` for leaf declarations (A7).

### F8. Libraries

Two versioned libraries ship with the language:

| Layer | Written in | Contents |
| --- | --- | --- |
| swa.ml standard library | swa.ml | `Swaml::Math` (`abs`, `min`, `max`, `floor`, `round`, `trunc`, `length`, `concat`); `Swaml::Calls` (`CallFailure` for traces: `timeout`, `unavailable`, `rejected`, `transport`, `remoteFailure`, `interrupted`); `Swaml::Qos` (`Delivery`, `Ordering`, `Overflow`, `Policy` and the predefined `Latest`, `Reliable`, `BestEffort`); `Swaml::Views` (`General`, `Interconnect`, `Case`, `Sequence`, `Grid`, `Flow`, `Timing`) |
| swa.ml semantic library | KerML | Component, Operation, Port, Connector, Message, Queue, Activation, Schedule and state machine semantics as specializations of the KerML 1.0 semantic library, as required by chapters 5 and 7 for any KerML export; base names to be checked against KerML 1.0 |

The standard library is always loaded and imported explicitly, so its short names never collide with user names.

### F9. Removed keywords

| Area | Removed |
| --- | --- |
| Kinds | `class`, `function`, `calc` |
| Calls and failure | `call`, `as`, `within`, `otherwise` |
| Loops and activation | `bound`, `do`, `forEach`, `completion` |
| Timing and profiles | `timing`, `wcet`, `concurrency`, `serial`, `reentrant`, `realtime`, `service`, `mixed` |
| Interfaces and ports | `senderReceiver`, `clientServer`, `publishSubscribe`, `version`, `sampled`, `queued`, `sender`, `receiver`, `client`, `server`, `publisher`, `subscriber` |
| QoS | `delivery`, `ordering`, `capacity`, `overflow`, `maxLatency`, `maxAge`, `bestEffort`, `atMostOnce`, `atLeastOnce`, `fifo`, `unordered`, `dropOldest`, `dropNewest`, `reject` (now library attributes and enums) |
| States, views and cases | `transition`, `priority`, `label`, `gv`, `iv`, `cv`, `sv`, `grv`, `fv`, `tv` |

New keywords: `attribute` (outside requirements), `const`, `returns`, `schedule`, `concurrent`, `wait`, `try`, `until`, `provides`, `requires` as prefixes, and `out`.

### F10. Open points before the ADR

Settled: AUTOSAR and other frameworks are target translations, so no further mapping check is needed before the ADR; library names and multiplicity are decided above.

Each of these needs a dedicated review:

1. **Suspension and the serial lock.** `wait` and remote requests release the lock, so attributes can change across every suspension point (check-then-act races). Restate interruptible regions, snapshots and the reentrancy analysis, and decide whether the validator warns about attribute reads before a suspension that decide writes after it.
2. **Deployment.** Whether only components are deployed or schedule entries can be placed on tasks/cores; string identities versus references to external model elements; placement inheritance with multiplicity (`wheels[2]`); deployment variants per root; replacing `deploy RootName` with a path-less `deploy on "…";` (C8).
3. **Interruptible regions.** Proposed spelling: an unnamed `interruptible { … } on receive port.member(args) { … }`, consistent with schedule entries; confirm together with item 1.

### F11. Effect on sections A–E

| Item | Status under 2.0 |
| --- | --- |
| A3, A6, C10, D3, E1–E4 | still apply |
| A5 | addressed by declaring 2.0 a breaking edition |
| A7 | resolved by F7 |
| B1, B2, B3 | resolved by F4 |
| B4, B6 | still apply |
| B5 | resolved: `interrupted` is a `CallFailure` value in traces (F8) |
| C1, C2 | resolved by F1 and F3 |
| C4 | resolved by the standard library (F8) |
| C5 | resolved by failure propagation and `try` (F3) |
| C6, C7 | resolved by F9 and by replacing `on completion` with `after op` and state `on entry`/`on exit` |
| C8 | part of the deployment review (F10.2) |
| C9 | multiplicity resolved by F1; joins, duration units and cross-package views still apply |
| D1, D2 | still apply to operation usages and redefinition |
| D4 | resolved by usage bodies in F1 |

## Suggested sequencing

1. One editorial/defect PR on 1.4: A1–A3, A6, B5, B7, E1–E2.
2. Hold the F10 reviews, then write the 2.0 ADR superseding ADR 0007, 0008, 0011, 0014 and 0015 and amending ADR 0010, 0012 and 0013.
3. Specify 2.0 chapter by chapter with a mechanical migration guide where possible; flag non-mechanical migrations (interface kinds and roles, inline QoS, RPC timeouts and failure blocks, transition priorities and completion transitions, loop bounds, lock release during suspension).
4. Update grammar, validator, simulator, keyword/notation/mapping inventories, examples and the editor extension.
5. KerML-facing work (C3) alongside the first exporter milestone.
