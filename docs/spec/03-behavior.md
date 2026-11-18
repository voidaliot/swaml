# 3. Operations, schedules and states

Normative chapter of [swa.ml 2.2](../LANGUAGE_SPECIFICATION.md).

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

Every component occurrence has one serial lock. Serial dispatch evaluates/copies schedule arguments under this lock. wait, requests, receive and idle state-machine waits release it. Resumption reacquires it and reads live attributes. Other activations may run and modify state while a serial activation is suspended. Activation locals remain its own copies. Concurrent entries overlap and read the dispatch snapshot throughout, including after resumption, and never write state.

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
| on every D | At root epoch + kD, k at least 1; deadline defaults to D |
| on receive p.m(bindings) | One activation per received required event/attribute |
| on call p.m(bindings) | Serve a provided operation; typed result/out values form the reply |
| after predecessor | Fresh activation after successful whole same-owner predecessor completion and unlock |

Entry arguments evaluate and copy at dispatch. Non-call entries bind void flow with no out parameters; after targets are parameterless void flow. Predecessors are scheduled same-owner operation names, never paths/qualified names/port members; the effective after graph is acyclic. Failure releases nothing. A fresh activation has its own release/deadline/locals/snapshot/backlog accounting; results and parameters are not forwarded. Stateful success means reaching final, not becoming idle after a reaction.

An explicit deadline is positive. An every entry's deadline cannot exceed its period. Deadline omission elsewhere is permitted; a host may impose additional documented validation requirements. concurrent is entry-local and requires a non-writing, non-stateful operation. Source WCET, timing blocks and root profiles do not exist; target bindings own execution-cost evidence.

**Computed periods and deadlines (2.3).** A period or deadline may be an expression of the constant sublanguage, which the validator evaluates for each expanded occurrence (the [derived period](../../examples/43-derived-period.swaml) example).

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

## 3.6 States

A stateful operation is parameterless void and has exactly one on start entry. initial names one owned state. States own at most one on entry and one on exit block plus ordered receive/timer transitions. A receive transition binds payload, optionally tests a pure/read-state bool guard, and names its target with to. after D is relative to the state update, before entry actions begin. Entry actions finish before a transition can run; if entry suspends past a timer expiry, the earliest elapsed timer is selected on resumption before queued input. Timers with equal expiry use declaration order. Evaluate competing enabled transitions in declaration order and take the first. There are no transition names, priorities or completion transitions.

A reaction runs exit, transition effect, state update and entry in that order. Timers are invalidated by state exit and stale firings are observable discards. Unhandled input does not reset the current state timer. Every state is graph-reachable from initial; a final state has no outgoing transitions or exit action. Reaching final runs entry and completes the whole operation once. Hierarchical/orthogonal states and physical preemption are outside the language.

| ID | Rule |
| --- | --- |
| WP4-S08 | **Computed state timers.** `after (e) to S { … }` takes an integral expression that is pure or reads state (SW2008 `State timers may only be pure or read state.`), in the machine's scope, with the unit warning SW2016. It is evaluated once per state entry, when the entry actions finish, in declaration order with the state's other computed timers; its expiry is the state-update time plus the value, so a timer whose operands the entry actions change uses the new value: `state Backoff { on entry { delayMs = minInt(delayMs * 2, capMs); } after (delayMs * 1ms) to Connecting { } }` waits the doubled delay. If entry suspends past the expiry, the timer has elapsed and is selected on resumption, as for literal timers. Discarded input does not re-evaluate it; re-entering the state does. Timers with equal expiry, literal or computed, keep declaration order. A value that is not a positive representable duration is `DurationRange` and fails the machine's activation (WP4-R01). The [computed backoff](../../examples/41-computed-backoff.swaml) and [lock pulse](../../examples/42-lock-pulse.swaml) examples show both. |

## 3.7 Case scripts

A use case or test whose body holds statements after its optional documentation is a case script ([ADR 0019](../decisions/0019-package-context.md)). Its statements are the statement language of section 3.3: var, assignment to places rooted in its own locals or on call out bindings (WP1-S05), send, publish, calls, on receive … or receive … or after D, wait, if, while, until, for, for in, assert, fail and return. A case owns no nested operations, states, schedule entries or interrupt regions. A case with statements needs of; a case without statements records intent only.

A script is the environment of its subject. Its endpoints are occurrence.port.member, where occurrence is a top-level component occurrence of the case's package that is not the subject, is associated with the case by associate occurrence to Case; and is interface-only. send and publish emit a provided attribute or event of that actor port; on receive waits for a required attribute or event of it; a call such as customer.panel.withdraw(200) requests a required operation and suspends like any request. on call occurrence.port.op(bindings) { … } is a further branch of on … or …, allowed only in case scripts, that answers a request for a provided operation of the actor port. Inside it return v; is the reply exactly like the result of a served operation: out bindings are mutable and their values return with the reply, a non-void branch returns or fails on every path, and a failure inside the branch replies with a remote failure and fails the case. Any other return ends the case and has no value. Operations keep port.member endpoints and serve requests through schedule on call entries.

Both case kinds may call operations of their exact primary subject, such as atm.withdraw(20), using its normal serial context ([ADR 0021](../decisions/0021-case-subject-calls.md)). The operation may communicate through its own ports, receive and wait; the case resumes on return. Stateful operations remain on-start only, and suspending calls obey the whole-expression rule. The call is local within the case activation, not a fresh schedule release or an implicit port request.

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
