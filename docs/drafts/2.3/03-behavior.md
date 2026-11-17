# 3. Operations, schedules and states: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 3](../../spec/03-behavior.md). Examples are `text` fences until their work package lands. Decisions: [ADR 0022](../../decisions/0022-values-places-and-expressions.md), [ADR 0023](../../decisions/0023-state-reactions.md) and [ADR 0025](../../decisions/0025-real-time-placement-and-binding.md).

## 3.1 Operations and effects

| ID | Rule |
| --- | --- |
| WP1-S04 | **Out arguments.** Out arguments remain bare names; a place is not an out argument in 2.3 (SW2006). |
| WP2-S04 | **Conditional effects.** The effect of a conditional is the union of its condition and both branches. No suspending call may appear anywhere in a conditional (SW2006); the whole-expression suspension rule is unchanged. |
| WP3-S01 | **`now()` effect.** `now()` has the effect class *reads state*. It is therefore rejected in attribute and member initializers (SW2006). It is rejected in completion guards (WP5-S03) and in the constant sublanguage (WP4-S05). |
| WP3-S02 | **Stale reads.** The stale-read warning (SW2011, after tool fix A2) never reports a value obtained from `now()`. |

## 3.2 Failure

| ID | Rule |
| --- | --- |
| WP4-R01 | **`DurationRange`.** A computed duration (chapters 3.3, 3.6) is checked as an integer before any widening to `uint`. A value that is not positive, or not a representable duration, is the runtime failure `DurationRange` and never `Bounds`. It is an ordinary runtime failure of the statement or reaction that evaluated it. |

## 3.3 Statements and scopes

| ID | Rule |
| --- | --- |
| WP1-S05 | **Place roots.** The assignment target is a place (chapter 1.4). In an operation, its root is a mutable local, an `out` parameter or a non-const attribute of the executing component. In a case script, it is one of the script's own locals or an `on call` out binding. `in` parameters, const attributes, ports, child components and qualified names are rejected (SW2006). A dotted target without an index is a place too. The `for` header update keeps a bare name. |
| WP1-S07 | **`out` roots.** An `out` parameter used as a place root must be definitely assigned before the assignment (SW2006). |
| WP1-R01 | **Place evaluation order.** Evaluate the target's index expressions left to right, then the right side, then read the root cell, check every index against the value read, and write the root with exactly one place replaced. Writes performed by the right side are kept. |
| WP1-R02 | **Place failure.** An index outside its extent at runtime is the runtime failure `Bounds`; the root is unchanged. |
| WP2-S05 | **No conditional statement.** A conditional is never a statement (grammar WP2-G02). The `if` statement keeps its block form. |
| WP4-S03 | **Computed waits.** `wait (e);` and `or after (e) { … }` take an integral, non-suspending expression (SW2002, SW2006), evaluated when the statement starts waiting. |

```text
counters[index] = counter;                       // WP1
statuses[index].occurrences = statuses[index].occurrences + 1;
wait (backoffMs * 1ms);                          // WP4
on receive ctl.ack(id) { … } or after (ackTimeoutMs * 1ms) { … }
```

## 3.4 Suspension and locks

| ID | Rule |
| --- | --- |
| WP1-R03 | A place assignment's read-modify-write happens under the serial lock after any resumption; no suspension splits it. |
| WP1-M01 | The stale-read warning (SW2011, after tool fix A2) treats a place write as a write of its root. Index values read before a suspension are tracked like other pre-suspension reads. |

## 3.5 Schedule

| ID | Rule |
| --- | --- |
| WP4-S04 | **Computed periods and deadlines.** `on every (e)` and `deadline (e)` take an expression of the constant sublanguage, evaluated once per expanded occurrence. Its value is integral (SW2002). |
| WP4-S05 | **Constant sublanguage.** Allowed: integer and duration literals; const attributes of the owning occurrence with their effective value after redefinition, whose effective initializers are themselves in the sublanguage (acyclic); unary `-`; `+ - * / %`; comparisons; `and`/`or`/`not`; the conditional; parentheses. In this sublanguage, `/` on two integral operands is integral and must divide exactly for every occurrence. A non-exact quotient or a zero divisor is WP4-D07 (SW2013). Outside the sublanguage, `/` keeps the chapter 1.4 rule (real). Rejected (SW2007): calls, mutable attributes, locals, parameters, sampled reads and `now()`. |
| WP4-S06 | **Per-occurrence values.** For every expanded occurrence of every top-level occurrence of a package, each computed period and deadline is positive and representable (SW2013), and an `every` entry's deadline does not exceed its period (SW2007). A definition that is never instantiated is checked for sublanguage membership and typing only. |
| WP4-S07 | **Trigger identity.** The trigger of `on every (e)` is identified by the normalized expression text: comments and whitespace removed, names in canonical spelling. A parenthesized single literal normalizes to its nanoseconds, so `every (20ms)` is `every 20ms`. This identity drives inheritance replacement, duplicate detection (SW2007) and `semantic.ts` `entryKey`. |
| WP4-M02 | **One evaluator.** `semantic.ts` `constantValue(expression, occurrence)` evaluates the sublanguage. It is used by the validator, `projection.ts`, the simulator and consuming tools, and it replaces `constantNumber`. |
| WP7-S01 | **Release guards.** `when (g)` may follow the operation call of an `every`, `receive` or `after` entry. On a `start` or `call` entry it is an error (SW2007). |
| WP7-S02 | **Guard effects and scope.** A release guard is `bool`, pure or reads state (SW2007). Its scope is the component's attributes, its sampled ports, `now()` and the entry's receive bindings; the operation's parameters are not in scope. |
| WP7-S03 | **Identity.** A release guard is not part of entry identity, so two entries that differ only in their guard are duplicates (SW2007). |

```text
on every (cyclePeriodMs * 1ms) poll() deadline (cyclePeriodMs * 1ms / 2);   // valid when exact in every occurrence (WP4-S05)
on every 20ms slot() when (mode.current != PowerMode.sleep) deadline 2ms;  // WP7
after rxMainFunction txMainFunction() when (mode.current != PowerMode.sleep) deadline 5ms;
```

The release rows of the trigger table gain "unless its release guard is false (chapter 6.2)". The runtime rules of release guards are in chapter 6.2 (WP7-R01 to WP7-R06).

## 3.6 States

Replace the first paragraph's last sentence, "There are no transition names, priorities or completion transitions.", with "There are no transition names or priorities." Then add the rules below.

```text
state Connecting {
  on entry { sessionId = try(cloud.openSession(vehicleId), 0); }
  when (sessionId > 0) to Connected { sessionsOpened = sessionsOpened + 1; }
  when (true) to Backoff { }
  on receive network.coverage(up) when (not up) to Offline { }
}
state Closed {
  on receive stream.accepted(t) { write(t); }          // internal: no exit, no entry
  when (consecutiveFailures >= failureThreshold) to Open { }
}
state locking {
  defer requests.request;
  after 250ms to locked { }
}
state Backoff { after (lastBackoffMs * 1ms) to Connecting { } }
```

| ID | Rule |
| --- | --- |
| WP4-S08 | **Computed state timers.** `after (e)` in a state takes an integral expression that is pure or reads state (SW2008). It is evaluated once per state entry, when the entry actions finish; expiry = state-update time + value. |
| WP5-S02 | **Completion transitions.** `when (g) to S { … }` has no trigger and requires a target (SW2008). A final state has none. |
| WP5-S03 | **Completion guards.** A completion guard is `bool`, pure or reads state, and does not call `now()` (SW2008). |
| WP5-S04 | **Completion cycles.** A cycle of states connected only by completion transitions whose guard is the literal `true`, after removing parentheses, is an error (SW2008). |
| WP5-S05 | **Reachability.** Graph reachability from `initial` includes completion edges. Internal transitions add no edge. |
| WP5-S06 | **Timer guards.** `after D when (g)` takes a `bool` guard that is pure or reads state (SW2008). |
| WP5-S07 | **Internal transitions.** A receive or timer transition without `to` is internal. A final state has no transitions of any form (SW2008). |
| WP5-S08 | **Deferral.** `defer p.m, …;` names required events or attributes that this stateful operation owns through its transitions. Some state of the machine has a transition on each deferred member. No state both defers a member and has a transition on it. A member is deferred at most once per state. A final state defers nothing. All are SW2008. |
| WP5-S09 | **Deferral and ownership.** A deferral belongs to the machine's single input ownership (SW2005); it is never a second owner. |
| WP5-S10 | **Explicit self transitions.** A transition `to` its own state keeps its 2.2 meaning: exit, effect, state update, entry, with timers restarted. |

The runtime rules for these forms are in chapter 6.5 (WP5-R01 to WP5-R13).

## 3.7 Case scripts

| ID | Rule |
| --- | --- |
| WP1-S06 | **Indexed test paths.** In a test's inspection path, a component segment with multiplicity takes a literal index, for reads (`backend.twins[0].link`) and helper calls (`backend.twins[0].currentView()`). A non-literal index on a component segment is an error (SW2010). A literal index outside the multiplicity is an error (SW2002). Roots stay non-multiple top-level occurrences; only parts inside the root are indexed. This amends "Nested/indexed association paths and intermediate component indexes remain unsupported" of ADR 0020 for intermediate indexes only. Association paths stay unindexed. |
| WP1-S08 | **Indexed call paths elsewhere.** Outside test scripts, a call path that contains an index is an error (SW2006). |
| WP6-S09 | **No sampling in scripts.** Case scripts do not sample ports. They keep `on receive` at actor ports (SW2010). |

The case-script paragraph on assignment gains: "Assignment targets are places rooted in the script's own locals or `on call` out bindings (WP1-S05)."
