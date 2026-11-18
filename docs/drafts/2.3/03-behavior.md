# 3. Operations, schedules and states: 2.3 changes (draft)

**Draft for the unreleased standard 2.3; see [the draft index](README.md).** Target: [chapter 3](../../spec/03-behavior.md). Examples are `text` fences until their work package lands. Decisions: [ADR 0022](../../decisions/0022-values-places-and-expressions.md), [ADR 0023](../../decisions/0023-state-reactions.md) and [ADR 0025](../../decisions/0025-real-time-placement-and-binding.md).

## 3.1 Operations and effects

| ID | Rule |
| --- | --- |
| WP1-S04 | Moved to [chapter 3.1](../../spec/03-behavior.md#31-operations-and-effects) in WP1. |
| WP2-S04 | Moved to [chapter 3.1](../../spec/03-behavior.md#31-operations-and-effects) in WP2. |
| WP3-S01 | **`now()` effect.** `now()` has the effect class *reads state*. It is therefore rejected in attribute and member initializers (SW2006). It is rejected in completion guards (WP5-S03) and in the constant sublanguage (WP4-S05). |
| WP3-S02 | **Stale reads.** The stale-read warning (SW2011, after tool fix A2) never reports a value obtained from `now()`. |

## 3.2 Failure

| ID | Rule |
| --- | --- |
| WP4-R01 | **`DurationRange`.** A computed duration (chapters 3.3, 3.6) is checked as an integer before any widening to `uint`. A value that is not positive, or not a representable duration, is the runtime failure `DurationRange` and never `Bounds`. It is an ordinary runtime failure of the statement or reaction that evaluated it. |

## 3.3 Statements and scopes

| ID | Rule |
| --- | --- |
| WP1-S05 | Moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP1. |
| WP1-S07 | Moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP1. |
| WP1-R01 | Moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP1. |
| WP1-R02 | Moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP1. |
| WP2-S05 | Moved to [chapter 3.3](../../spec/03-behavior.md#33-statements-and-scopes) in WP2. |
| WP4-S03 | **Computed waits.** `wait (e);` and `or after (e) { … }` take an integral, non-suspending expression (SW2002, SW2006), evaluated when the statement starts waiting. |

```text
wait (backoffMs * 1ms);                          // WP4
on receive ctl.ack(id) { … } or after (ackTimeoutMs * 1ms) { … }
```

## 3.4 Suspension and locks

| ID | Rule |
| --- | --- |
| WP1-R03 | Moved to [chapter 3.4](../../spec/03-behavior.md#34-suspension-and-locks) in WP1. |
| WP6-R07 | **Concurrent reads (amends 3.4).** The sentence on concurrent entries becomes: "Concurrent entries overlap and read attributes from the dispatch snapshot throughout, including after resumption; they read sample cells and `now()` live; they never write state." Each cell read copies the whole value atomically, so a record is never observed half-updated. The 2.2 snapshot guarantee is unaffected, because 2.2 models have no cells. |
| WP1-M01 | Moved to [chapter 3.4](../../spec/03-behavior.md#34-suspension-and-locks) in WP1. |

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
| WP1-S06 | Moved to [chapter 3.7](../../spec/03-behavior.md#37-case-scripts) in WP1. |
| WP1-S08 | Moved to [chapter 3.7](../../spec/03-behavior.md#37-case-scripts) in WP1. |
| WP6-S09 | **No sampling in scripts.** Case scripts do not sample ports. They keep `on receive` at actor ports (SW2010). |

The case-script paragraph on assignment gained "Assignment targets are places rooted in the script's own locals or `on call` out bindings (WP1-S05)" in WP1.
