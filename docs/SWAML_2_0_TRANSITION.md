# SWAML 2.0 transition specification

**Status:** final proposal, 2026-10-21 · **From:** SWAML 1.4.0 development · **To:** SWAML 2.0.0 · **Normative after:** acceptance as an ADR and integration into the specification chapters

This document fixes the complete set of language changes from 1.4 to 2.0. It consolidates the decisions recorded in [specification improvements](SPEC_IMPROVEMENTS.md), section F, into one design. Until the ADR is accepted, [the 1.4 specification](LANGUAGE_SPECIFICATION.md) remains normative and published 1.x artifacts remain unchanged. Examples use `text` fences because they are not valid 1.4 source.

## 1. Goals and principles

1. **One concept per idea.** One structural kind (`component`), one executable kind (`operation`), one port concept without interface kinds or port roles.
2. **Definition and usage.** A `def` states what something is; a usage states where it lives and when it runs. A usage body is an anonymous specialization. Replacement is always of a whole member.
3. **Few keywords after a declaration.** A declaration has the form `modifiers keyword name : Type = value returns T { body }`. Activation lives in `schedule`, policies in typed library definitions, flags in prefixes.
4. **Libraries instead of keywords.** QoS, view kinds, numeric helpers, failure reasons and deployment platforms are library definitions.
5. **Natural, AI-native reading.** Words instead of special symbols wherever a symbol's meaning is SWAML-specific; no arrows; every argument with a non-obvious role is named by a word, including the loop limit (`3 times`). One canonical textual form, explicit types and named members, and machine-readable diagnostics with suggested fixes (section 13.1).
6. **Preserved invariants.** Private occurrence stores, explicit typed routes between components, single handler ownership, copied values, no global state, no free events and no SysML import. `.swaml` remains the semantic source of truth; presentation stays in sidecars.

## 2. Unchanged constructs

Packages, imports and qualified names; `datatype`, `enum`, records, fixed arrays and primitive value domains; expressions and operator precedence; `specializes` and `redefines`; requirements, `satisfy`, `useCase`, `verificationCase` and `verify`; ordinary comments; acyclic containment and call graphs; definition and occurrence identity rules.

## 3. Structure

### 3.1 Components

```text
component def Sensor { … }
component def FastSensor specializes Sensor { … }

component def Car {
  component front: Sensor;
  component wheels: FastSensor[4];
  component left: Sensor { redefines attribute gain: real = 3.0; }
}

component Demo: Car;
component Lab { component probe: Sensor; }
```

- `component` is the only structural kind. `class` is removed.
- A package-level usage is an execution root. Root profiles are removed.
- A usage body is an anonymous specialization of the usage's definition. It may redefine inherited members and add members. This applies equally to child usages and typed roots.
- Multiplicity `[n]` declares n occurrences with separate stores, addressed `wheels[i]` with a literal index in connector, deployment, case and view paths. Connector loops and port arrays are not part of 2.0.

### 3.2 Attributes and locals

```text
attribute count: int = 0;          // component state
const attribute limit: int = 10;   // fixed per occurrence; redefinable per usage
var next: int = count + 1;         // local of an activation or block
```

- `attribute` is component-owned state that lives for the run, is part of the type, is redefinable per usage and is guarded by the serial lock. `const attribute` cannot be assigned.
- `var` declares an activation or block local. Requirement attributes keep their syntax and are implicitly constant.
- Types remain explicit; there is no type inference.

## 4. Operations

### 4.1 Declarations, definitions and usages

```text
operation def Clamp(v: real, lo: real, hi: real) returns real {
  if (v < lo) { return lo; }
  if (v > hi) { return hi; }
  return v;
}

component def Controller {
  attribute gain: real = 2.0;

  operation scale(x: real) returns real { return x * gain; }
  operation split(in x: real, out hi: real, out lo: real) { … }
  operation limit: Clamp;
  operation tight: Clamp { return lo; }
  operation reset() { gain = 2.0; }
}
```

- `operation` is the only executable keyword. `function` and `calc` are removed. An operation with a result maps to a KerML Function and a void operation to a KerML Behavior; authors never write KerML terms.
- Results use `returns T`; `:` always means "typed by". A declaration always has parentheses; a usage never has parentheses or `returns`.
- Parameters are `in` (default) or `out`. Out values are copied back only on successful return.
- A package-level `operation def` may use only its parameters and nested operations. A component-owned operation may read and write the component's attributes.
- `operation x: D;` inherits the body of D; `operation x: D { … }` replaces the whole body. The signature always comes from D.
- Operations may own nested operations. A nested operation sees its own parameters, its nested operations and the owning component's attributes; it never captures enclosing parameters or locals.
- In an inherited body, a call to a local operation resolves by name in the effective members of the concrete occurrence. A redefinition must keep the signature, so the call stays well typed.
- Names are unique; overloading, default parameter values, generics and `super` are absent. Recursion is forbidden.

### 4.2 Calls and effects

- A call is an expression: `if (scale(x) > 1.0)`. A void operation is called as a statement: `reset();`. A call with `out` arguments is a statement. Discarding a non-void result is an error. `call` and `as` are removed.
- The validator infers each operation's effect class through the acyclic call graph: **pure**, **reads state**, **writes state**, **communicates** or **suspends**.

| Context | Permitted effect classes |
| --- | --- |
| state guards, view filters | pure, reads state |
| attribute initializers | pure |
| operations bound by `concurrent` schedule entries | no write, including through callees |
| expressions other than the forms below | anything except suspends |
| a whole `var` initializer, a whole assignment right side, a statement | anything |

### 4.3 Failure and `try`

- A runtime failure fails the current activation and unwinds it without rolling back committed effects.
- `try(expression, fallback)` catches every runtime failure raised while evaluating `expression`: remote request failures, arithmetic, range and index failures, failed `assert` and `fail` in called operations. Static errors are never caught; `try` applies only to valid models.
- The fallback must be assignable to the expression's type and is evaluated only on failure. `try(e)` on a void expression ignores failure; `try(e, f())` runs a void fallback.
- Interrupts are not failures. Deadline misses, activation overflow and resource limits are contract violations and are not caught.
- The failure reason is recorded in the trace as a `Swaml::Calls::CallFailure` value or a local failure kind; it is not observable in the model.

```text
var level: real = try(store.get(key), 0.0);
var v: real = try(primary.get(k), try(backup.get(k), 0.0));
var ratio: real = try(a / b, 0.0);
try(cfg.reset(), log("reset failed"));
```

### 4.4 Statements

| Statement | Meaning |
| --- | --- |
| `var x: T = e;` / `x = e;` | local declaration / assignment to a local, `out` parameter or attribute |
| `if (c) { … } else { … }` | conditional |
| `while (c) { … }` / `while (c, n times) { … }` | test first; optional limit of n iterations |
| `until (c) { … }` / `until (c, n times) { … }` | body at least once, stop when c is true; optional limit of n iterations |
| `for (var i: int = 0; i < n; i = i + 1) { … }` | counted loop |
| `for (x: T in values) { … }` | iterate a copied fixed array |
| `wait D;` | suspend for D |
| `on receive p.m(args) { … } or … or after D { … }` | wait for one of several inputs or a timeout |
| `interruptible { … } on receive p.m(args) { … }` | cancel the protected body when input arrives |
| `send p.a(value);` / `publish p.e(args);` | update a provided attribute / emit a provided event |
| `return;` / `return e;` / `fail "reason";` / `assert c;` | unchanged |
| `try(…);` | statement form of `try` |

- A loop limit `n times` takes a `uint` expression evaluated once at entry; `times` is contextual and remains usable as a name. Reaching it exits the loop normally. `bound`, `do` and `forEach` are removed; termination is an analysis concern, detected at run time by deadlines and the simulator's step budget.
- A receive statement owns its members exclusively. Input that arrives before the statement waits stays queued under the connector policy. Without `after`, the wait is unbounded and only the deadline limits it.
- An interruptible region is unnamed and may appear in any non-stateful operation, including operations reached through local calls; it is armed only while its body runs. Input to its member while the region is inactive is discarded and observable; the validator warns. A pending remote request inside the region is cancelled on interrupt; the server is not.

### 4.5 Suspension and the serial lock

- `wait`, remote requests and receive statements suspend the activation and **release the component's serial lock**. Other activations of the component may run meanwhile, and attributes may change across every suspension point.
- After resumption the activation reads live attribute values. `concurrent` activations read their dispatch snapshot throughout.
- The validator warns when an attribute read before a suspension point influences a write after it (stale read). The fix is to check again after resuming:

```text
operation withdraw(in amt: int) {
  if (balance >= amt) {
    var ok: bool = try(bank.authorize(amt), false);
    if (ok and balance >= amt) { balance = balance - amt; }
  }
}
```

## 5. Schedule and timing

```text
component def Controller {
  attribute y: int = 0;
  reversed port cmd: Commands;
  port cfg: Settings;

  operation o(in v: int) { … }
  operation lookup(in k: string) returns real { … }
  operation notify() { … }

  schedule {
    on start o(y);
    on every 10ms o(y) deadline 5ms;
    on receive cmd.set(n) o(n);
    on call cfg.get(k) lookup(k) concurrent;
    after o notify();
  }
}
```

- Each component has at most one `schedule` block. An entry is identified by its (trigger, operation) pair; a duplicate pair is an error. A specialization redefines an entry by repeating the pair. One operation may have several entries.
- Triggers:
  - `on start` releases once after initialization.
  - `on every D` releases at start + kD for k ≥ 1.
  - `on receive p.m(args)` releases once per received event or attribute update.
  - `on call p.m(args)` serves a provided operation; the bound operation's result is the reply and must be assignable to the declared result.
  - `after op` releases a fresh activation after each successful completion of `op`. `op` must be an operation of the same component, including an inherited one; paths, port members and qualified names are rejected. Failure releases nothing. The `after` graph is acyclic.
- Arguments are evaluated and copied at dispatch, under the lock.
- `deadline D` is optional; `on every` entries default to their period. Requiring deadlines everywhere is a host validation setting or a requirement on the root.
- `concurrent` permits overlapping activations of that entry and is valid only if the operation does not write state. Stateful operations cannot be concurrent.
- WCET is not part of source. It belongs to the target binding and its evidence. The `timing` block is removed.

### 5.1 Single ownership of inputs

Every required event or attribute and every provided operation of a port is owned by exactly one of: a schedule entry, a state transition set of one stateful operation, a receive statement, or an interruptible region.

### 5.2 Timing view

The timing view keeps all trace-based drawings: release, dispatch, ready, running, request wait, completion, failure and interrupt markers and open intervals. It has two modes:

| Mode | Drawn from |
| --- | --- |
| Declared | schedule release grid, release causes (`o ← every 10ms`, `notify ← after o`), deadlines, static `wait` intervals, concurrent overlap |
| Observed | a trace over the declared mode: lock gaps during suspension, message latency between lanes, WCET or budget bars labeled with their binding or evidence source |

## 6. Ports and communication

### 6.1 Ports

```text
port def SpeedService {
  provides attribute speed: real;
  provides event overspeed(limit: real);
  provides operation reset();
  requires idempotent operation calibrate(f: real) returns bool;
}

component def Sensor  { port svc: SpeedService; }
component def Display { reversed port svc: SpeedService; }

component def Probe {
  optional port raw {
    provides attribute speed: byte;
  }
}
```

- Interfaces are replaced by ports whose members carry a direction. `interface`, its four kinds, `version` and all port roles are removed.
- A provided attribute is sent by this side; a provided event is emitted by this side; a provided operation is implemented by this side. `requires` is the opposite.
- Attribute members carry the latest value only. Events are queued. Queued data in 1.4 becomes an event with one parameter.
- `port p: P;` uses a port definition; `reversed port p: P;` uses it with every direction flipped; `port p { … }` declares an inline port. `optional` is a prefix.
- `idempotent` is an operation member prefix.

### 6.2 Structural compatibility

Two connected ports are compatible when, matching members **by name**:

1. every `requires` member on either side has a `provides` member of the same name and kind on the other side;
2. a provided attribute or event payload is assignable to the required type (`byte` fits `int`);
3. for operations, the requirer's parameter types are assignable to the provider's, and the provider's result is assignable to the requirer's;
4. records and enums are compared nominally.

Either side may provide more than the other requires. Order never matters. Forwarding (6.3) instead requires the child port to be compatible with the boundary port in the **same** direction. Every mismatched or missing member is reported individually.

### 6.3 Connectors, forwarding and cardinality

```text
component def Car {
  port svc: SpeedService;
  component sensor: Sensor;
  component display: Display;
  component logger: Logger;

  connect (svc, sensor.svc);                          // forwarding: same directions
  connect link: Reliable (sensor.svc, display.svc);   // connection with a named policy
  connect (sensor.svc, logger.svc);                   // bare connection: Default policy, no name
}
```

- `connect name: Policy (a, b);` joins two ports. The name and the policy are each optional: `connect (a, b);` is a bare connector. Endpoint order is irrelevant. Endpoints are owned ports or ports of immediate children, as in 1.4. `delegate` and connector arrows are removed.
- The kind is derived from the endpoints:
  - **Connection:** the ports are compatible with opposite directions (6.2). Without a policy, the connector uses `Swaml::Qos::Default`.
  - **Forwarding:** a boundary port of the owner and a port of an immediate child are compatible with the same directions. Forwarding has no queue, so a policy is an error. At most one forwarding exists per boundary port; a child port is forwarded at most once; a forwarded port is not handled by the owner's own operations.
  - Ports that satisfy neither rule are an error; the diagnostic states which rule was closer and which members fail.
- A port with any required attribute or operation connects to exactly one peer. A port that requires only events may connect to many. Duplicate connectors between the same two ports are errors.
- Unnamed connectors cannot be referenced by `via` in cases. A case step may omit `via` when exactly one connection joins its two ports.
- Required-port closure and optional ports are otherwise unchanged from 1.4.

### 6.4 QoS policies

```text
import Swaml::Qos;

qos def Fast: Policy {
  delivery = Delivery.atLeastOnce;
  ordering = Ordering.fifo;
  capacity = 16;
  overflow = Overflow.reject;
  maxLatency = 2ms;
  requestTimeout = 50ms;
}
```

- Every connection is typed by a QoS policy definition specializing `Swaml::Qos::Policy`, explicitly or through `Swaml::Qos::Default` for bare connectors. Inline QoS bodies are removed. The library provides `Default`, `Latest`, `Reliable` and `BestEffort`.
- `Default` is `atMostOnce`, `fifo`, capacity 16, `reject` and a request timeout of 1s, with no latency or age bound. Its values are part of the versioned library, so a bare connector always has a definite, inspectable policy.
- The policy applies to events and requests. Attribute members always keep only the latest value; the 1.4 rule forcing capacity 1 and dropOldest on whole interfaces is removed.
- Remote requests take their timeout from `requestTimeout`. `within` is removed. `atLeastOnce` requests require `idempotent` provided operations.

## 7. State machines

```text
operation lamp() {
  initial Off;

  state Off {
    on receive cmd.on() to On { }
  }
  state On {
    on entry { power = true; }
    on exit  { power = false; }
    on receive cmd.off() to Off { }
    on receive sensor.temp(t) when (t > 80.0) to Fault { level = t; }
    after 600s to Off { }
  }
  final state Fault {
    on entry { publish status.fault(level); }
  }
}

schedule { on start lamp(); }
```

- A stateful operation has no parameters, no result and exactly one schedule entry, `on start`.
- State actions are `on entry { … }` and `on exit { … }`. Transitions are nested in their source state: `on receive p.m(args) when (g) to Target { effect }` and `after D to Target { effect }`.
- Within a state, transitions are evaluated in declaration order and the first enabled one is taken. `priority`, transition names and the `transition` keyword are removed. Editors must support reordering.
- State completion transitions are removed. Work and decisions move into the triggering transition's effect and guards. Reaching a `final state` completes the operation.

## 8. Deployment

```text
import Swaml::Platform;

component def Ecu: Node {
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
  deploy controller on front.os;
  deploy wheels on rear[0];
  deploy wheels[2] on rear[1];
}
```

- Deployment targets are occurrences of components specializing `Swaml::Platform::Node`. A Node owns only child Nodes and `const` attributes: no operations, ports, connectors or schedules. Buses and hardware timing are out of scope and belong to target translations.
- `deployment Name of Root on PlatformRoot { … }` is a package-level declaration. A root may have several deployments. Roots contain no deployment statements.
- `deploy path on nodePath;` places a software occurrence and its descendants; `deploy on nodePath;` places the root. A more specific path overrides an inherited placement; `wheels[2]` overrides `wheels`. An exact path appears at most once per deployment.
- Only components are deployed. Mapping operations or schedule entries to tasks and cores is part of target translation.
- An optional `ref` attribute links a node to an external model element for the host to resolve. SWAML validates without it.

## 9. Views, cases and documentation

```text
import Swaml::Views;

view controllerTiming: Timing of Demo.controller.o;
view overview: General { include Demo recursive where kind == "operation"; }

verificationCase Startup of Demo {
  verify FastStart;
  request req from tester.diag.read to ecu.diag.read via diagLink;
  reply ans from ecu.diag.read to tester.diag.read via diagLink after req;
}
```

- View kinds are library definitions: `General`, `Interconnect`, `Case`, `Sequence`, `Grid`, `Flow` and `Timing` replace `gv`, `iv`, `cv`, `sv`, `grv`, `fv` and `tv`. Subject and filter rules are unchanged except that kinds are `component` and `operation` only.
- Case steps read like declarations: `kind name from source to target via connector [after step];`. Step kinds are `send`, `publish`, `request` and `reply`. `label` is removed.
- Formal documentation uses the common doc-comment form `/** … */` and replaces `doc /* … */`. It is the first item in a body, or immediately precedes `;` in a leaf declaration. Ordinary `/* … */` and `//` comments stay separate annotations.

## 10. Libraries

| Library | Written in | Contents |
| --- | --- | --- |
| `Swaml::Math` | SWAML | `abs`, `min`, `max`, `floor`, `round`, `trunc` (range-checked conversion to int), `length`, `concat` |
| `Swaml::Calls` | SWAML | `CallFailure`: `timeout`, `unavailable`, `rejected`, `transport`, `remoteFailure`, `interrupted` |
| `Swaml::Qos` | SWAML | `Delivery`, `Ordering`, `Overflow`, `Policy`, `Default`, `Latest`, `Reliable`, `BestEffort` |
| `Swaml::Views` | SWAML | the seven view definitions |
| `Swaml::Platform` | SWAML | `Node`, `Platform`, `Partition`, `Process` |
| SWAML semantic library | KerML | Component, Operation, Port, Connector, Message, Queue, Activation, Schedule and state-machine semantics as specializations of the KerML 1.0 semantic library, required by chapters 5 and 7 for any KerML export |

The standard libraries are versioned with the language, always loaded and imported explicitly with `import Swaml::Qos;`, which exposes all top-level declarations of that package. Package names may consist of several `::` segments; this is naming only, and packages still do not nest.

## 11. Keywords

**Removed (59):** `class`, `delegate`, `doc`, `function`, `calc`, `call`, `as`, `within`, `otherwise`, `bound`, `do`, `forEach`, `completion`, `timing`, `wcet`, `concurrency`, `serial`, `reentrant`, `realtime`, `service`, `mixed`, `interface`, `senderReceiver`, `clientServer`, `publishSubscribe`, `version`, `data`, `sampled`, `queued`, `sender`, `receiver`, `client`, `server`, `publisher`, `subscriber`, `delivery`, `ordering`, `capacity`, `overflow`, `maxLatency`, `maxAge`, `bestEffort`, `atMostOnce`, `atLeastOnce`, `fifo`, `unordered`, `dropOldest`, `dropNewest`, `reject`, `transition`, `priority`, `label`, `gv`, `iv`, `cv`, `sv`, `grv`, `fv`, `tv`. The implicit `payload` and `failure` bindings are also removed.

**Added:** `attribute` (component members), `const`, `returns`, `out`, `schedule`, `concurrent`, `wait`, `try`, `until`, `provides`, `requires`, `reversed`, `deployment`, `request` (case steps), `from`, `to` and `times`. `reversed`, `from`, `to`, `times` and `request` are contextual: they are special only in their syntactic position and remain usable as names.

**Symbols:** the language has no arrows and no conjugation symbol. `:` means only "typed by", `=` value, `.` containment, `::` package qualification, `[n]` multiplicity or array extent, `( )` grouping, arguments and connector endpoints, `{ }` bodies; operators are the usual arithmetic and comparison operators, with `and`, `or` and `not` as words.

**Kept with a narrower role:** `on` (schedule triggers, state actions and transitions, receive statements, interruptible handlers), `after` (timers and operation chaining), `deadline` (schedule entries), `deploy`, `idempotent`, `optional`, `final`, `initial`.

## 12. Migration from 1.4

| 1.4 | 2.0 | Mechanical |
| --- | --- | --- |
| `class def` / `class x: T` | `component def` / `component x: T` | yes |
| `function` | `operation` | yes |
| `calc n { in a: T; return r: R = e; }` | nested `operation n(a: T) returns R { return e; }` | yes |
| `(…): T` result | `(…) returns T` | yes |
| component `var` | `attribute` | yes |
| `call f(a) as r;` / `call f(a);` | `var r: T = f(a);` / `f(a);` | yes, with result type lookup |
| `call p.m(a) as r within D otherwise { … };` | `var r: T = try(p.m(a), fallback);` or propagation; timeout moves into the connector policy | no |
| operation trigger | schedule entry | yes |
| `timing { wcet; deadline; concurrency; }` | `deadline` and `concurrent` on the entry; WCET moves to the target binding | yes, WCET recorded outside source |
| `function B() on completion A` | `after A B();` | yes |
| `interface` with kind and roles | `port def` with member directions; consumer-side ports use `reversed port` | yes |
| `data x: T sampled;` / `queued;` | `provides attribute x: T;` / `provides event x(value: T);` | yes |
| `version "x.y.z"` | removed; compatibility is structural | yes |
| inline `qos { … }` | generated named `qos def` | yes |
| `connect c: a -> b qos P;` | `connect c: P (a, b);` | yes |
| `delegate outer -> child.port;` | `connect (outer, child.port);` | yes |
| `entry` / `exit` blocks | `on entry` / `on exit` | yes |
| `transition t: A -> B on … when (g) priority n { … }` | nested in A, ordered by descending priority | yes |
| `on after D` | `after D` | yes |
| state `on completion` transitions | moved into triggering transition effects and guards | no |
| `state S final` | `final state S` | yes |
| `while (c) bound n { … }` | `while (c, n times) { … } if (c) { fail "LoopBound"; }` | yes, meaning-preserving |
| `do { … } while (c) bound n;` | `until (not c, n times) { … } if (c) { fail "LoopBound"; }` | yes, meaning-preserving |
| `forEach (x: T in a)` | `for (x: T in a)` | yes |
| `interruptible name { … } on receive p.m { … }` | `interruptible { … } on receive p.m(args) { … }` | yes |
| root profile | host validation setting or requirement | no |
| `deploy x on "scheme:id";` in a root body | `deployment` declaration; each distinct string becomes a generated Node with `ref` | yes |
| `view v gv of X;` | `view v: General of X;` | yes |
| filter `kind == "function"` / `"class"` | `kind == "operation"` / `"component"` | yes |
| case `send a -> b via c label n;` | `send n from a to b via c;`; `call` steps become `request` | yes |
| `doc /* … */` | `/** … */` | yes |
| `import P::*;` | `import P;` | yes |

**Semantic changes that migration cannot preserve automatically:**

1. Lock release at suspension. Migrated serial activations that relied on holding the lock across a request may race; the stale-read warning identifies candidates.
2. Failure propagation from requests, which previously required a failure block.
3. Removal of state completion transitions.
4. Structural port compatibility, which may accept connections that nominal matching rejected.
5. Attribute members ignoring capacity and overflow.
6. Bare connections using `Swaml::Qos::Default` instead of the 1.4 requirement that every connector state its complete policy.

A migration tool must report every non-mechanical rewrite and must never silently change model meaning.

## 13. Validation changes

| Area | New or changed rules |
| --- | --- |
| Structure | multiplicity indices in range; usage bodies obey redefinition rules; no class kinds |
| Operations | effect-class inference and context checks; `try` fallback typing; discarded results; `out` arguments assignable; nested-operation scope without capture |
| Schedule | one block; unique (trigger, operation) pairs; trigger signatures; `after` same-owner and acyclic; `concurrent` only for non-writing operations; single input ownership |
| Suspension | stale-read warning; remote calls only in whole `var` initializers, assignment right sides or statements |
| Ports | member directions; conjugation; name-based structural compatibility with per-member diagnostics; connection versus forwarding derived from directions; no policy on forwarding; derived cardinality |
| QoS | connectors typed by `Policy` specializations; `atLeastOnce` requires idempotent operations |
| States | ordered transitions; one `on start` entry; reachability; final states |
| Deployment | targets are Node occurrences; Node content restrictions; unique exact paths; index ranges |
| Interrupts | warning when region input can arrive while inactive |

### 13.1 AI-native authoring support

1. **Canonical form.** A formatter prints every construct in exactly one layout and keyword order, so generated and hand-written models are indistinguishable and diffs stay minimal. Validation never depends on formatting.
2. **No position-dependent meaning.** Arguments whose role is not obvious are introduced by a word (`from … to`, `via`, `after`, `deadline`, `times`). No argument depends on its position alone.
3. **Machine-readable diagnostics.** Every diagnostic has a stable code, the source range, the involved declaration and occurrence paths and, where one exists, a suggested source edit, for example: missing provided member `reset` on `display.svc`, insert `provides operation reset();`. Tools can repair models in a validate–fix loop.
4. **Explicit structure.** Types, member names, policies and schedule entries are always written; nothing is inferred from order, layout or naming conventions.

Diagnostic codes are assigned in the ADR. Removed rules include SW016, kind narrowing, priority uniqueness, completion-cycle limits and profile completeness.

## 14. Edition and artifacts

- The new edition is **2.0.0**, parser family 2.0, reference profile `swaml-reference/2.0`. Published 1.x sources, books and PDFs remain unchanged.
- The ADR supersedes [ADR 0007](decisions/0007-component-functions-and-calculations.md), [0008](decisions/0008-function-local-calculations-and-calls.md), [0011](decisions/0011-loops-interrupts-and-function-timing.md), [0014](decisions/0014-classes-operations-and-uml-notation.md) and [0015](decisions/0015-local-executable-completion.md), and amends [0010](decisions/0010-consistent-subject-relations.md), [0012](decisions/0012-timing-view-and-structure-layouts.md) and [0013](decisions/0013-event-driven-external-inputs.md).
- Affected artifacts: grammar, validator, scope provider, simulator, normative chapters 1–9, keyword, notation and KerML mapping inventories, standard and semantic libraries, examples, simulation fixtures, showcase, migration guide and the editor extension.
- Acceptance follows the existing gate: `npm run check`, the documentation and notation checks, positive and negative tests for every rule in section 13, migration tests over all 1.4 examples and an honest implementation matrix.

## 15. Choices made during finalization

These details were not discussed explicitly and were settled for consistency. Review them with the ADR.

1. Connectors are written `connect name: Policy (a, b);` without arrows; name and policy are optional, and forwarding is derived from same-direction endpoints instead of a `delegate` keyword. Bare connections use `Swaml::Qos::Default`.
2. Attribute members always hold the latest value, independent of QoS.
3. Parameters default to `in`.
4. Case steps use `request` instead of `call`.
5. Interruptible regions may be used in any non-stateful operation, not only triggered serial flow functions, since triggers moved to `schedule` and `reentrant` no longer exists. Whether a `concurrent` operation may contain one should be confirmed with the ADR.
6. Typed roots may have usage bodies like any other usage, because deployments no longer live there.
7. Requirements keep their 1.4 syntax.
8. Package names may have several `::` segments (`Swaml::Qos`) without introducing nested packages, so library names read naturally.
