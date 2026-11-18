# swa.ml: states as steps of the flow

**Status:** design proposal for owner review, **revision 2**, 18 November 2026. Not normative. Nothing here changes the grammar, validator, simulator, standard version or a published artefact. All new syntax is in `text` fences because no parser accepts it. Nothing in revision 2 has been prototyped: every "measured" number below comes from revision 1's prototypes or from the design review's prototypes, and every other expectation is marked as argued.

**Bases:**
- **Language:** main `adc0740` (2.3 candidate with WP1 to WP6 merged). WP6 sampled reads are read where they matter (guards, section 3.3).
- **Owner direction (binding):** a state is an ordinary step of a flow, mixed with plain steps, calls and decisions; no `states { }` container, no `initial`, no transition list. The owner approved the revised look: leaving or staying is visible at the head of each trigger line, written order is the real priority, `keep`/`ignore` once per operation with per-state overrides, `state X { … } until <trigger>;` for the one-exit state, plain flow between states, restricted jumps `to S;`. Stateflow is a source of concepts; the text stays structured. Safety comes before compatibility: this is swa.ml 3.0 with an automatic migration.
- **Review:** the adversarial design review of revision 1 (blocking defects B1 to B8, issues I1 to I11, alternatives A1 to A7, decisions D1 to D16, prototypes P1 to P3), kept outside the repository at `E:\t\review-states-design.md`.
- **Reading samples:** [STATES_IN_FLOW_READING_SAMPLES.md](STATES_IN_FLOW_READING_SAMPLES.md) (prototype P3).

## Changes since revision 1

| Finding | Where it is now | How |
| --- | --- | --- |
| B1 tie phase undefined, D16 | 3.4, D16 | One phase rule: a waiting state selects at the event that first makes a trigger ready; timer expiry precedes same-instant delivery (2.2 contract kept). Measured cost of the alternative given. |
| B2 single activation dropped, D15 | 3.1, D15 | 2.2 rule kept for stage 1: an operation with a state is directly component-owned, parameterless void, released only by its one `on start` entry, never called, no interrupt region. |
| B3 translation not writable | 3 (intro), 3.10 | Meaning is defined natively as execution-contract rules (SIF-R01 to SIF-R12). Plain-flow equivalences are kept only where they hold, with the cases where they do not. "Derived purely by translation" is dropped. |
| B4 first ready against drawn numbers | 3.3 | Written order is the priority among triggers ready at one selection; the inputs form one group served in delivery order, drawn `2a`, `2b`. Differing latencies and offer ordinals are settled. |
| B5 condition triggers | 9.1 (stage 2) | Out of stage 1. Open problems listed as work for stage 2's own design revision. |
| B6 "one input rule everywhere" | 3.7 | Claim dropped. Four regimes stated exactly; the disposition check covers every waiting point of an operation with states. |
| B7 migration recipe | 7 | Recipe rewritten: several finals, dead equal timers, per-trigger bindings (no merge, no rename), timer-first written order, exit-then-block order, state order chosen for fall-through (A5). |
| B8 parent states | 9.3 (stage 4) | Out of stage 1; open problems listed. |
| I1 fall-through surprises | 5.1, 2.7 | Checks SIF-D05 to SIF-D08; Flow View moves never change behaviour silently. |
| I2 stay invisible at the head | 1.1 | `stay` and `to S` are written at the head; a leaving trigger without actions is one line ending in `;`. |
| I3 false timer guard consumes | 3.3 | `after D when (g)` is ready when D has elapsed and g holds. No timer is consumed by a guard. Stage 1 restricts what g may read so that no wake is needed. |
| I4 mandatory dispositions ripple | 1.7 | One operation-level `keep`/`ignore` line; a state writes a line only where it differs. |
| I5 stale kept commands | 5.2 | SIF-D09 warns on a kept event without `maxAge`; every sample says what a kept input means. |
| I6 jump holes | 3.6 | Forward jump over a used declaration is an error; backward jumps re-run declarations; leaving loops, `until`, `n times` defined; `interruptible` cannot occur (3.1). |
| I7 stepped operations | 9.2 (stage 3) | Out of stage 1; open problems listed. |
| I8 WP5 removal cost | 8, D10 | Presented as an open decision with both costs. |
| I9 stage 1 too large | 0, 4 | Stage 1 is flat states, `on receive`, `after`, `stay`, `to`, `until`, dispositions, priority. |
| I10 extension cost | 2.7, 10 | Listed per gesture and in the plan. |
| I11 interleaving unmeasured | 6 | The review's tie measurement is quoted; the stage 1 phase rule keeps the 2.2 interleaving. |
| Notes: `machines`, attribute discards, unreachable states, summary claims | 3.9, 3.3, 5.1, 0 and 6 | Stated. The summary no longer says "zero by construction". |
| A1, A2, A4, A6, A7 | 1, 3 | Adopted. A3 adopted in a restricted stage 1 form (3.3), fully with stage 2. A5 is the migrator's ordering step. |

## 0. Summary

**The idea.** A state is a statement. The flow reaches it, runs its entry actions and waits until one of its triggers is ready. A **staying** trigger runs its block inside the state and the state waits again. A **leaving** trigger ends the state: exit actions, the trigger's own block, then the flow goes on with the next statement or, with `to S`, at state `S`. Between two states is plain flow: assignments, calls, decisions, loops.

```text
operation control() {
  keep requests.request, status.query, power.off;
  state unlocked {
    on receive status.query() stay { publish status.report(locked, pulses); }
    on receive requests.request(lock) when (lock);
    on receive power.off() to report;
  }
  state locking {
    on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.lockPulse); }
    on exit { send motor.lockMotor(LockDrive.idle); }
  } until after 250ms;
  locked = true;
  state isLocked {
    on receive status.query() stay { publish status.report(locked, pulses); }
    on receive requests.request(lock) when (not lock);
    on receive power.off() to report;
  }
  state unlocking {
    on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.unlockPulse); }
    on exit { send motor.lockMotor(LockDrive.idle); }
  } until after 250ms;
  locked = false;
  to unlocked;
  state report {
    on entry { reportShutdown(); }
  }
}
```

**Stage 1** (the content of 3.0) is flat states with `on receive` and `after` triggers, `stay`, `to`, `until`, operation-level `keep`/`ignore` with per-state overrides, and one priority rule. Condition triggers, stepped operations and parent states are later stages (section 9), each with its own design revision.

**The priority rule in one paragraph.** A state chooses at a *selection*. A selection happens when the flow arrives (after entry), after a staying block, and while it waits at the first event that makes a trigger ready: a timer expiry or a delivery for a member it handles. At a selection, the first ready trigger in written order is taken. All `on receive` triggers of a state form one group at the position of the first of them; within the group, the oldest delivered message is served first. Within one logical instant a timer expiry comes before a delivery (the 2.2 contract rule "receive timeout wins a tie with delivery", kept).

**Which operations may hold states (stage 1).** The 2.2 rule: directly component-owned, parameterless void, released only by its one `on start` entry, never called, no interrupt region. So every operation with states has exactly one activation.

**Measured and argued impact on 2.2 sources.** Every 2.2 machine is rewritten by the migrator. Measured on the 253-result corpus (revision 1 and review prototypes): each runtime choice that stage 1 makes is the 2.2 behaviour on the axes that were measured, except the order among several queued inputs at one selection, where arrival order (measured with the offer ordinal, close to stage 1's delivery order) changes one final store (extended fixture r10, built to pin the 2.2 queue walk). The migrated sources themselves have **not** been run: the expectation "no other verdict or store changes" is argued and must be measured by prototype P1 before stage 1 is approved. Traces change (statement identities, `keep` for `defer`, discard reasons).

**Open decisions** (section 11): D10, whether the WP5 state forms ship in 2.3, is open; the other recommended answers are in the table.

## 1. How it looks: text

### 1.1 A state and its triggers

```text
state name {
  /** documentation */
  on entry { … }                               // when the flow reaches the state
  on exit { … }                                // on every way out
  keep p.m;                                    // only where it differs from the operation default
  ignore q.n;
  on receive p.m(x) [when (g)] stay { … }      // staying reaction: the state does not end
  after D [when (g)] stay { … }
  on receive p.m(x) [when (g)];                // leaving, no actions: continue after the state
  on receive p.m(x) [when (g)] { … }           // leaving with actions; may end in to S;
  on receive p.m(x) [when (g)] to S;           // leaving to S
  on receive p.m(x) [when (g)] to S { … }      // leaving to S with actions
  after D [when (g)] …                         // same four leaving forms
}

state name { … } until <trigger>;              // the one leaving trigger, written after the box
```

**The head says what happens.**
- **`stay`** at the head: a staying reaction. No exit, no entry, the timers keep their start. It is listed inside the state box in Flow View, never drawn as an arrow.
- **Anything else** is leaving. A leaving trigger with no actions is one line that ends in `;`. With actions it keeps its block. The jump may be written at the head (`to report;`) or as the last statement of the block (`{ log(); to report; }`); both mean the same.
- **`until <trigger>`** after the box is the state's only leaving trigger. Such a state may still have entry, exit, dispositions and staying reactions inside.

**Order of what runs when a state is left:** the state's `on exit`, then the trigger's own block (its bindings are in scope), then either the jump target or the next statement. This is the 2.2 order "exit, effect, entry" (measured: putting the block before the exit actions changes 1 verdict and 2 final stores of the corpus). Statements written after the state, such as `locked = true;`, run after that and belong to every way out that falls through.

**A state without triggers** (no trigger inside, no `until`) does not wait: entry, exit, next statement. It is a named step, used as a jump target and for migrated 2.2 final states. A state with only staying reactions never leaves; nothing after it is reachable except by a jump.

### 1.2 The lock controller in full

Section 0 is the full lock controller. How to read it:
- **Operation default.** `keep requests.request, status.query, power.off;` says that a request, a query or a power-off that a state does not handle waits in its queue for the next state that does. Both pulse states handle nothing, so everything that arrives during a pulse is served right after it.
- **Staying reaction.** `on receive status.query() stay { … }` answers a query without leaving `unlocked` or `isLocked`. The pulse states do not answer; the query waits for the end of the pulse (kept).
- **One-exit states.** `locking` and `unlocking` end only by their timer: `} until after 250ms;`.
- **Plain flow between states.** `locked = true;` is an ordinary step after `locking`. It runs after the motor has been set idle by the exit action.
- **Back arrow and skip.** `to unlocked;` after `locked = false;` closes the cycle. `to report` (at the head of the power-off triggers) skips forward to the last state, which is a named step: `reportShutdown()` runs and the operation ends.
- **Guards.** `when (lock)` in `unlocked`: an unlock request that arrives while unlocked is taken and dropped (`discardInput` reason `guard`), as in 2.2.
- **2.2 `DiscardingLock` variant.** The same text with `ignore requests.request;` written inside `locking` and `unlocking` (a per-state override).

### 1.3 The owner's picture

Start dot, `state0`, a decision with yes/no branches to `state2` and `state1`, a merge, an operation step, `state4`, final marker.

```text
operation run() {
  ignore cmd.go, cmd.retry;
  var ok: bool = false;
  state state0 {
    on entry { send lamp.set(Lamp.waiting); }
  } until on receive cmd.go(v) { ok = v; }
  if (ok) {
    state state2 {
      on entry { send lamp.set(Lamp.go); }
    } until after 10ms;
  } else {
    state state1 {
      on entry { send lamp.set(Lamp.retry); }
    } until on receive cmd.retry();
  }
  process();
  state state4 {
    on entry { report(); }
  }
}
```

The decision is an ordinary `if` on a local set in the `until` block. `state4` has no triggers: it is a named step, and the operation ends after it.

### 1.4 A state inside a branch

```text
operation openDoor() {
  checkSupply();
  if (supplyOk) {
    state unlatching {
      on entry { send latch.release(true); }
      on exit { send latch.release(false); }
      on receive latch.opened();
      after 200ms { faults = faults + 1; }
    }
  } else {
    report(FaultId.lowSupply);
  }
  publish status.doorReleased(supplyOk);
}
schedule {
  on start openDoor();
}
```

The state is one step of the `then` branch; both of its leaving triggers continue after the `if`. Nothing jumps into or out of the branch.

### 1.5 A state with several exits

```text
state unlatching {
  on entry { send latch.release(true); attempts = attempts + 1; }
  on exit { send latch.release(false); }
  on receive handle.pulled() stay { publish status.busy(); }
  on receive latch.opened();
  on receive power.off() to shutdown;
  after 200ms when (attempts < 3) to unlatching { faults = faults + 1; }
  after 200ms to giveUp;
}
```

- **Numbers.** The inputs form group 1 (`1a` pulled, staying; `1b` opened; `1c` power-off). The guarded timer is 2, the plain timer 3.
- **Exits.** `opened` falls through to the next statement. `power.off` skips to `shutdown`. At 200 ms the guarded timer is ready while fewer than three attempts were made and re-enters `unlatching` (exit, block, entry, a new 200 ms); otherwise timer 3 leaves for `giveUp`. Two unguarded timers with the same duration would make the second dead (SIF-D06).

### 1.6 Going back and skipping

- **Restricted jump.** `to S;` names a state `S` in the same statement list or in a list that encloses it, in the same operation. It never enters a branch, a loop body or another operation.
- **Where it is written.** At the head or as the last statement of a leaving trigger's block, or as the last statement of a statement list of the operation body (as `to unlocked;` in section 0). Never in entry, exit or staying blocks.
- **After a jump.** In the same list, only a state that is itself a jump target may follow a `to` statement (`report` in section 0).
- **Structured loops remain.** A cycle of states is often a `while (true) { … }` (traffic light, debounce, connection manager in the reading samples). A jump out of a loop ends the loop.

### 1.7 Inputs: one default per operation, overrides per state

A variant of the lock controller that honours power-off only where a state handles it and drops requests during the lock pulse:

```text
operation control() {
  keep requests.request, status.query;        // the operation default: dispositions are written first
  ignore power.off;
  …
  state locking {
    ignore requests.request;                    // override: this state drops requests
    …
  }
}
```

- **Required.** Every input member the operation handles somewhere and does not handle at every waiting point needs an operation-level `keep` or `ignore` (SIF-D01, quick-fixes for both).
- **Overrides.** A state writes `keep` or `ignore` only where it differs from the default. Writing the default again is a warning (SIF-D10).
- **Plain receive statements** in such an operation apply the operation default to members they do not list.
- **Flow View** shows the default once in the operation header and an override as a muted line in the box.

## 2. How it looks: Flow View

### 2.1 Drawing rules

| Element | Drawing |
| --- | --- |
| Operation header | The name, and one muted line each for the default `keep` and `ignore` members. |
| State | A rounded box in the flow column, name at the top. Below a thin rule: `entry: …` and `exit: …` (first statement, ellipsis, full text on hover), then one line per staying reaction, `1a query() stay: publish …`, then the override dispositions in a muted font, then, when an input trigger has a guard, the muted line `other request(…): dropped`. |
| Plain step, call, decision, merge, loop | Unchanged Flow View nodes, also between two states. |
| First state | The start dot and the ordinary incoming arrow. There is no initial marker. |
| Leaving trigger | One arrow per leaving trigger from the bottom edge, labelled with its number and trigger: `1b request(lock) [lock]`, `2: after 250ms`. Numbers are the written order with the input group sharing one number and a letter per input trigger in written order. A state with one trigger draws it without a number. |
| Trigger block | Ordinary step nodes on that arrow, outside the box (they run after exit). A decision inside the block is the usual diamond on the arrow. |
| `until` | The single arrow out of the box, labelled `until after 250ms`, numbered only when the box lists staying reactions. |
| Fall-through | The arrows of every leaving trigger without a jump join at a merge node below the box, then the flow continues to the next statement. |
| Back jump | Routed on the left gutter, upwards, ending on the top edge of the target box. |
| Skip | Routed on the right gutter, downwards, ending on the top edge of the target box. |
| End of the operation | The final marker. |

**Not drawn as an arrow:** staying reactions (lines in the box), dispositions (header and muted box lines), inputs dropped by a false guard (the `dropped` line), a staying timer that has fired, and the operation default. No self-loop is ever drawn for a staying reaction; a leaving trigger that re-enters its own state (`to unlatching`) is a back arrow to the box's own top edge.

### 2.2 The lock controller (section 0)

```text
 control()    keep: requests.request, status.query, power.off
               ●
               │
      ┌───────►┤
      │  ╭─────▼────────────────────────────────╮
      │  │ unlocked                             │
      │  │ 1a status.query() stay: publish …    │
      │  │ other request(…): dropped            │
      │  ╰─────┬──────────────────────────┬─────╯
      │        │ 1b request(lock) [lock]  │ 1c power.off()
      │        │                          └────────────────────────┐
      │  ╭─────▼────────────────────────────────╮                  │
      │  │ locking                              │                  │
      │  │ entry: pulses = pulses + 1; send …   │                  │
      │  │ exit:  send motor.lockMotor(idle)    │                  │
      │  ╰─────┬────────────────────────────────╯                  │
      │        │ until after 250ms                                 │
      │  ┌─────▼──────────┐                                        │
      │  │ locked = true  │                                        │
      │  └─────┬──────────┘                                        │
      │  ╭─────▼────────────────────────────────╮                  │
      │  │ isLocked                             │                  │
      │  │ 1a status.query() stay: publish …    │                  │
      │  │ other request(…): dropped            │                  │
      │  ╰─────┬──────────────────────────┬─────╯                  │
      │        │ 1b request(lock)         │ 1c power.off()         │
      │        │    [not lock]            └───────────────────────►┤
      │  ╭─────▼────────────────────────────────╮                  │
      │  │ unlocking                            │                  │
      │  │ entry: pulses = pulses + 1; send …   │                  │
      │  │ exit:  send motor.lockMotor(idle)    │                  │
      │  ╰─────┬────────────────────────────────╯                  │
      │        │ until after 250ms                                 │
      │  ┌─────▼──────────┐                                        │
      │  │ locked = false │                                        │
      │  └─────┬──────────┘                                        │
      └────────┘ to unlocked                                       │
         ╭──────────────────────────╮                              │
         │ report                   │◄─────────────────────────────┘
         │ entry: reportShutdown()  │
         ╰─────┬────────────────────╯
               ◉
```

### 2.3 The owner's picture (section 1.3)

```text
 run()    ignore: cmd.go, cmd.retry
                 ●
                 │
       ╭─────────▼──────────╮
       │ state0             │
       │ entry: send …      │
       ╰─────────┬──────────╯
                 │ until go(v)
          ┌──────▼──────┐
          │ ok = v      │
          └──────┬──────┘
                 ◇ ok
           yes ╱   ╲ no
   ╭─────────▼──╮ ╭──▼──────────╮
   │ state2     │ │ state1      │
   │ entry: …   │ │ entry: …    │
   ╰─────┬──────╯ ╰──────┬──────╯
         │ until         │ until retry()
         │ after 10ms    │
         └──────►◆◄──────┘
                 │
          ┌──────▼──────┐
          │ process()   │
          └──────┬──────┘
       ╭─────────▼──────────╮
       │ state4             │
       │ entry: report()    │
       ╰─────────┬──────────╯
                 ◉
```

### 2.4 A state inside a branch (section 1.4)

```text
                 ●
                 │
          [ checkSupply() ]
                 │
                 ◇ supplyOk
           yes ╱   ╲ no
 ╭──────────▼──────────╮   [ report(lowSupply) ]
 │ unlatching          │            │
 │ entry: send …       │            │
 │ exit:  send …       │            │
 ╰──┬───────────┬──────╯            │
    │ 1: opened()│ 2: after 200ms   │
    │       [ faults = faults + 1 ] │
    ◆◄──────────┘                   │
    └────────────►◆◄────────────────┘
                  │
   [ publish status.doorReleased(supplyOk) ]
                  │
                  ◉
```

### 2.5 A state with several exits (section 1.5)

```text
                 │
       ┌────────►┤
       │ ╭───────▼──────────────────────────────────╮
       │ │ unlatching                               │
       │ │ entry: send …; attempts = attempts + 1   │
       │ │ exit:  send latch.release(false)         │
       │ │ 1a handle.pulled() stay: publish …       │
       │ ╰───┬──────────┬──────────────┬──────────┬─╯
       │     │          │              │          │
       │     │1b        │1c            │2         │3
       │     │opened()  │power.off()   │after     │after 200ms
       │     │          │              │200ms     │
       │     │          │              │[attempts │
       │     │          │              │ < 3]     │
       │     │          │   ┌──────────▼──────┐   │
       │     │          │   │ faults = … + 1  │   │
       │     │          │   └──────────┬──────┘   │
       └─────┼──────────┼──────────────┘          │
             │          └──► shutdown             └──► giveUp
             ▼               (skip, right gutter)      (skip, right gutter)
      (next statement)
```

`2` re-enters `unlatching`: a back arrow to the box's own top edge, not a self-loop.

### 2.6 Sequence and Timing

- **Sequence:** a state is a state invariant on the operation's lifeline at the point where the flow waits. Leaving triggers are the messages that end it; staying reactions are messages that do not end it.
- **Timing:** a state is an interval on the component's track from arrival to exit. Between two states the track shows plain flow (no state).

### 2.7 Editing gestures

Every gesture is one whole-workspace edit, validated before it is applied, with a dry-run preview (`swaml/previewEdit`). The preview lists every trigger number and every fall-through target that changes, so text order never changes behaviour silently.

| Gesture | Text edit | How order stays honest |
| --- | --- | --- |
| Add a state as a step (creation card: name, first leaving trigger) | Inserts `state X { } until <trigger>;` at the drop position, and the operation-level disposition lines the new member needs (SIF-D01) in the same edit. | Inserting a step changes the fall-through target of the statement before it only when that was a state; the preview names it. |
| Add an exit to a state | Appends a leaving trigger after the last trigger of its kind: an input trigger at the end of the input group, a timer after the last timer. An `until` state is rewritten to the inner form, its `until` trigger becoming the last inner trigger. | The preview shows the new number and every renumbered arrow. |
| Turn an exit into a jump (drag the arrow end onto a state) | Writes `to S` at the head of the trigger, or replaces the existing target. Dragging onto the merge node below the box removes the jump (fall-through). Illegal targets (inside a branch or loop body, another operation) are refused with SIF-D04's message. | Only the dragged trigger changes. |
| Reorder exits (drag a number, Move up/down) | Moves the trigger line. The input group moves as one unit; a move that would split it is refused (SIF-S06). | The preview says "priority change: 2 ↔ 3". |
| Add a staying reaction (box "+ reaction") | Writes `on receive m(x) stay { }` at the end of the input group, or `after D stay { }` where the user places it. Removes a now redundant state override. | The preview shows its number. |
| Move a state (drag the box) | Moves the statement. Every trigger whose fall-through target would change gets an explicit `to`, and jumps that become fall-through to the next statement are removed. | By construction the behaviour is unchanged; an explicit "move and change the flow" option exists and its preview lists every changed target. |
| Delete a state | Removes it; incoming jumps are retargeted to a state the user picks, or the edit is refused. | The preview lists retargeted arrows. |
| Convert a plain step into a state and back | Wraps the step as the entry action of `state X { } until …;`; unwraps a trigger-less state. | Unwrap is offered only for a trigger-less state that is not a jump target. |

The formatter never reorders statements or triggers. It only normalises an empty leaving block `{ }` to `;`.

## 3. Stage 1 meaning: rules of the execution contract

The meaning of states is defined natively by the rules below (SIF-R01 to SIF-R12), as additions to chapter 6 of the specification. Section 3.10 lists the plain-flow equivalences that really hold, as explanations only.

The terms:
- A **stateful operation** is an operation whose body contains a state statement (3.1).
- A **waiting point** of a stateful operation is a state with at least one trigger, or a plain receive statement.
- A member is **handled** by a state when the state has at least one `on receive` trigger on it (inside or as `until`).
- A state's **disposition** for a member it does not handle is its override, else the operation default.

### 3.1 Which operations may contain states (B2, D15)

The 2.2 single-activation rule is kept for stage 1 (SIF-S01):
- a stateful operation is directly component-owned and parameterless void;
- its only schedule entry is exactly one `on start` entry (no `every`, `on receive`, `after` dependent or `concurrent` entry);
- it is not called by any operation, case script or helper;
- it contains no interrupt region;
- its states are statements of its own body, never of a callee (a callee with a state would itself be a stateful operation that is called).

Consequences:
- **One activation.** There is exactly one activation per occurrence, so `machines["c.op"]`, the trace subject and the Timing track stay well defined.
- **Case scripts** contain no states (D13) and cannot call a stateful operation. They drive it only through actor ports, as in 2.2.
- **A stateful operation may still be a predecessor** of `after` dependents: they are released when it completes, as after a 2.2 final state.
- **Within the operation, a member may be handled at several waiting points** (states and plain receive statements). The operation is its single owner (SW2005 unchanged in spirit: no other schedule entry, region or operation may own it).

### 3.2 Reaching a state (SIF-R01)

When the flow reaches a state statement at time t:
1. record a `state` observation (subject `c.op`, `state` name, `source` the state statement);
2. set the state's timer start to t (the state-update time);
3. run `on entry` (it may suspend; input arriving meanwhile stays queued);
4. evaluate computed `after` durations once (WP4-R02);
5. make an **arrival selection** (3.3).

A state without triggers runs steps 1 and 3, then `on exit`, then continues with the next statement.

### 3.3 Selection (SIF-R02, SIF-R03; B4, I3)

A selection of state S at time t does, in order:
1. **Dispositions.** Every queued message of a member that S ignores is consumed in delivery order with `discardInput` reason `ignored`. Every queued message of a member that S keeps stays; it gets one `keep` observation the first time any waiting point keeps it.
2. **Written order.** S's triggers are walked in written order, the `until` trigger last. All `on receive` triggers form **one input group** placed at the position of the first of them (SIF-S06 requires them to be contiguous). The first ready entry is taken:
   - **A timer** `after D [when (g)]` is ready when it is armed (a staying timer that fired is disarmed for the rest of this entry), t ≥ timer start + D, and g, if present, evaluates true now.
   - **The input group** is ready when a handled member has a queued message. The message served is the one **delivered first**: smallest delivery event (time, phase, insertion ordinal) among the heads of S's handled queues, each queue's head being given by its ordering policy. The triggers on that message's member are tried in written order, binding the payload and evaluating the guard; the first whose guard holds is taken. If none holds, the message is consumed with `discardInput` reason `guard` and the group is examined again.
3. **Nothing ready.** S waits without the component lock. A timer event is scheduled at the earliest expiry later than t among the armed timers whose guard holds now (a timer guard cannot change while S waits, SIF-S05).

What "delivered first" settles (B4):
- **Differing route latencies.** Message `a` offered at 0 with 5 ms latency and message `b` offered at 1 ms with no latency: `b` is delivered at 1 ms, `a` at 5 ms, so `b` is served first. The offer ordinal plays no role. (Revision 1's measured "arrival order" variant used the offer ordinal; the two differ only across routes with different latencies or fault delays. P1 measures delivery order.)
- **Within one queue**, the queue's ordering policy decides, as today.
- **A timer written before the input group** wins over queued input when both are ready at one selection. A timer written after it loses. This is the drawn number.
- **An attribute member** keeps only its latest value in its queue; a false guard consumes that value. Read attributes as sampled reads (WP6) when the latest value must survive.

Guards (SIF-S05):
- **An input guard** may read anything a 2.3 transition guard may read, sampled reads included (WP6-S01). It is evaluated at the selection.
- **A timer guard** may read only constants, the operation's locals, and component attributes that only this operation's own body assigns (not its callees). It may not call `now()` and may not contain a sampled read. So nothing can change it while the state waits: it changes only through the operation's own staying blocks and entry actions, which are always followed by a selection. Example: `on receive ped.button() stay { requested = true; }` and `after 10s when (requested);` make green last at least 10 s and end as soon as a request is present (reading samples, traffic light). Wider timer guards come with condition wakes in stage 2.

### 3.4 When selections happen within an instant (SIF-R04; B1, D16)

The contract orders the events of one logical instant by phase, then insertion ordinal: deadline and request timeouts (phase 0), receive timeouts and state timers (phase 1), deliveries, wait ends and releases (phase 2), then dispatch and continuation of ready activations (phase 4).

**Rule.** A waiting state makes its selection at the **event that first makes one of its triggers ready**: its timer expiry at phase 1, or the delivery of a handled member at phase 2. The selection is fixed when it is made; the chosen block runs when the activation next holds the lock. Events later in the same instant, including deliveries of that instant after a phase-1 timer, are not part of that selection and wait for the next one. Arrival selections and selections after a staying block happen when the operation's flow gets there.

**Consequences.**
- **Timer against same-instant delivery.** A timer that expires at t is taken before a message delivered at t, whatever the written order. This is the 2.2 contract rule "Receive timeout wins a tie with delivery", applied identically to plain receive timeouts and state timers. It is the only rule that the drawn numbers do not show; Flow View's hover on a timer label says it.
- **Where written order decides:** at an arrival selection (input queued while the operation ran other steps or a suspended entry, against timers that elapsed meanwhile), after a staying block, among timers with the same expiry, and among the triggers of one member.
- **Revision 1's example** (`after 20ms` against a condition written by an `every` operation at 20 ms) is a stage 2 question (9.1).

**Measured consequence of the alternative** (evaluate the selection after the same-instant deliveries, so that written order decides exact ties): the design review moved the receive timeout from phase 1 to phase 3. Plain receives only: 0 verdicts, 0 final stores, 7 traces change. Plain receives and machine timers: 0 verdicts, **1 final store** (door "Lock and unlock": `dcu.comMain.framesSent` 8→9, `dcu.linIf.received` true→false), 52 traces. The emulation let input win the tie and also moved the timeout after unrelated phase-2 work, so it is an upper bound. The recommended rule changes nothing on this axis.

### 3.5 Leaving and staying (SIF-R05, SIF-R06)

- **Staying.** The trigger's block runs (bindings in scope); no exit, no entry, the timer start is unchanged; a staying timer is disarmed for the rest of this entry. Then a new selection. A `state` observation with `stay: true` and the trigger as `source` is recorded before the block.
- **Leaving.** The state's timers are invalidated, `on exit` runs, then the trigger's block. If a `to S` executed (at the head or as the block's last statement), the flow continues at S (3.6); otherwise at the statement after the state.
- **Blocks may suspend** (`wait`, requests, suspending calls), as 2.2 entry actions and effects do. A suspension releases the lock; input that arrives meanwhile stays queued for the next selection.
- **What blocks may not contain:** state statements and receive statements (in any state block); `to` (in entry, exit and staying blocks); `return` (in any state block).

### 3.6 Jumps and locals (SIF-R07; I6)

- **Unwinding.** `to S` ends every block between the jump and the statement list that contains S. A loop that is ended this way (`while`, `until`, `for`, `for in`, with or without `n times`) does not run its condition, update or remaining iterations; its limit counter and locals end. An `if` branch simply ends.
- **Locals.** A local lives from its declaration to the end of its statement list. A backward jump that passes a declaration again re-runs it: the local gets its initial value again, exactly as a loop body's declaration does on each iteration. Locals declared before the target keep their values.
- **Forward jumps over a declaration** are an error (SIF-D04) when the local is used at or after the target: `` `to c` skips the declaration of `x`, which `c` uses. Declare `x` before the jump. ``
- **`interruptible`** cannot occur in a stateful operation (3.1), so no jump leaves a region in stage 1.
- **`return;`** is allowed in a stateful operation as the last statement of a list of the operation body (not in state blocks). It ends the operation; the migrator uses it between several final steps (7).

### 3.7 Inputs: the four regimes (SIF-R08; B6)

The claim "one input rule everywhere" is dropped. Stage 1 has exactly these regimes:

| Where | What happens to input |
| --- | --- |
| Plain operation (no state) | Unchanged 2.2: a receive statement exclusively owns its members, input received before it waits stays queued, also after the operation ended. |
| Interrupt region (plain operations only) | Unchanged 2.2: discarded and observed while the region is inactive. |
| Stateful operation, from its start until it completes | Queued under its policy (capacity, overflow, ordering, `maxAge`). At each selection of a waiting point, its disposition applies (3.3 step 1). While a waiting point waits, a delivered message of an ignored member is consumed at once (`ignored`), of a kept member stays (`keep`), of a handled member starts a selection. During `wait`, requests, suspended blocks and plain steps, nothing is consumed. |
| Stateful operation after it completed | Queued messages of its members are discarded, and later deliveries are discarded on arrival, with `discardInput` reason `inactiveOwner`, as after a 2.2 final state. |

**The disposition check (SIF-D01) covers** every waiting point of a stateful operation (states and plain receive statements) and every member the operation owns. A plain receive statement applies the operation default to the members it does not list; it has no override.

### 3.8 Run to completion, determinism, termination (SIF-R09)

- **Run to completion.** From a selection until the flow reaches the next selection, no other trigger of the operation is selected. Input arriving meanwhile waits. Other activations of the component may run while the operation is suspended, as in 2.2.
- **Determinism.** Selection depends only on written order, delivery order, the phase rule and guard values. No choice depends on queue creation or container iteration order.
- **Termination.** A staying reaction consumes one message or fires one timer once per entry; timers are positive. A cycle of jumps that passes no waiting point and no possible suspension is a static error (SIF-D07); otherwise a zero-time loop is a plain `while (true) { }` and ends at the step limit. Stage 1 needs no `StateLoop` violation.

### 3.9 Trace and results (SIF-R10, SIF-T01 to SIF-T04)

- **`state`** at each arrival, with the state statement as `source`; with `stay: true` for a staying reaction, `source` the trigger.
- **`keep`** (respelled WP5 `defer`): once per message, the first time a waiting point keeps it.
- **`discardInput`** with reasons `ignored`, `guard` and `inactiveOwner` (2.2's `noEnabledTransition` becomes `guard`).
- **No `discardTimer`**: a timer guard no longer consumes a timer.
- **Unchanged:** `receiveWait` when a waiting point waits, `timer` for computed durations (WP4-T01), deliveries, writes.
- **`machines["c.op"]`** is the name of the last state entered. State names are unique within an operation (SIF-S02), so the name identifies the statement. Between two states it keeps the last name; Timing draws the gap as plain flow.

### 3.10 Equivalences with plain flow (explanatory only, B3)

These hold up to the `state` and `keep` observations and statement identities:
- `state S { on entry { EN } on exit { EX } } until on receive p.m(x) { B }`, in an operation where every other owned member is kept and `EN` does not suspend, behaves as `EN; on receive p.m(x) { EX; B }`.
- A state with several `on receive` triggers on different members, no timers and no guards, every other member kept, behaves as the plain receive statement with the same branches, **except** that among several queued messages the state serves the one delivered first, while a 2.2 receive statement walks its queues in creation order.

They do **not** hold, and no plain-flow spelling with the 2.3 constructs exists, when:
- a timer is involved: the state counts from arrival (before entry), a timer that elapsed during entry is ready at once, and a remaining duration of zero is invalid for `or after` (`DurationRange`); `wait D` ends at phase 2, a state timer at phase 1;
- a state ignores a member (a receive statement keeps everything it does not list);
- a state has staying reactions (needs a loop, remaining-time arithmetic and a fired-once flag per timer);
- jumps cross loops or declarations (a dispatch loop changes local scopes and re-initialisation).

## 4. Stage 1 rules

IDs: SIF (states in flow). G grammar, S static, R runtime, D diagnostic, T trace.

### 4.1 Grammar delta (SIF-G01, text only)

```text
OperationBody: '{' Documentation? Executable* Disposition* Statement* '}';
Statement: … | State | Jump;                       // Return unchanged, newly allowed in stateful operations
State: 'state' Name '{' Documentation? (StateAction | Disposition | Trigger)* '}'
       ('until' until=LeavingTrigger)?;
StateAction: 'on' ('entry' | 'exit') Block;         // unchanged spelling
Disposition: ('keep' | 'ignore') MemberPath (',' MemberPath)* ';';
Trigger: Event ('stay' Block | LeavingTail);
LeavingTrigger: Event LeavingTail;
Event: 'on' 'receive' MemberPath '(' (Name (',' Name)*)? ')' Guard?
     | 'after' (Duration | '(' Expression ')') Guard?;
Guard: 'when' '(' Expression ')';
LeavingTail: ';' | Block | 'to' Name (';' | Block);
Jump: 'to' Name ';';
Removed: the 'initial' Name ';' State+ body alternative, 'final', Transition, Deferral ('defer').
```

Lexical notes: `keep`, `ignore` and `stay` are contextual. After a state's `}`, `until` followed by `on` or `after` belongs to the state; `until (` starts the existing `until` loop.

### 4.2 Static rules

| ID | Rule |
| --- | --- |
| SIF-S01 | Stateful operations (3.1): directly component-owned, parameterless void, exactly one `on start` entry and no other entry, never called, no interrupt region. Case scripts and concurrent entries contain no states. |
| SIF-S02 | A state has at most one `on entry` and one `on exit`. State names are unique within an operation. |
| SIF-S03 | A state with `until` has no leaving trigger inside. A staying reaction has a non-empty block (to drop an input, write `ignore`). |
| SIF-S04 | Several triggers on one member, and several timers, are allowed; each trigger has its own bindings. |
| SIF-S05 | Guards are `bool` and pure or read state. Input guards: as 2.3 transition guards (sampled reads allowed). Timer guards: only constants, locals, and attributes assigned only in the operation's own body; no `now()`, no sampled read. |
| SIF-S06 | The `on receive` triggers of a state are written contiguously (counting `until` as the last trigger). Quick-fix: move them together, which the preview shows as a priority change. |
| SIF-S07 | `to S`: S is a state of the same operation in the jump's statement list or an enclosing one, not inside a branch, loop body or block that does not contain the jump. `to` appears only at a leaving trigger's head, as the last statement of a block inside a leaving trigger's block (at any depth, for example an `if` branch), or as the last statement of a statement list of the operation body outside state blocks. After `to` or `return` in the same list, only a state that is a jump target may follow. |
| SIF-S08 | State blocks contain no state or receive statement; entry, exit and staying blocks contain no `to`; no state block contains `return`. |
| SIF-S09 | Dispositions are written first in the operation body or inside a state; a member named in a disposition is owned by the operation and handled at some waiting point of it. |

### 4.3 Runtime rules

| ID | Rule |
| --- | --- |
| SIF-R01 | Reaching a state (3.2). |
| SIF-R02 | Selection: dispositions, then written order with the input group, timers ready when elapsed, armed and guarded true (3.3). |
| SIF-R03 | Input group: the message delivered first among handled queue heads; its member's triggers in written order; no true guard: consumed with `guard` and retried. |
| SIF-R04 | Phase: a waiting state selects at the event that first makes a trigger ready (timer phase 1, delivery phase 2); the selection is fixed; later events wait (3.4). |
| SIF-R05 | Staying: block, no exit or entry, timer start unchanged, a fired staying timer disarmed for this entry, new selection. |
| SIF-R06 | Leaving: timers invalidated, `on exit`, the trigger's block, then the jump target or the next statement. |
| SIF-R07 | Jumps: unwinding of blocks and loops, locals re-initialised on backward passes (3.6). |
| SIF-R08 | Inputs: the four regimes (3.7). |
| SIF-R09 | Run to completion between selections; a waiting state releases the component lock; resumption reacquires it. |
| SIF-R10 | `machines` holds the last state entered. |
| SIF-R11 | Plain receive statements in a stateful operation: selection as SIF-R03 among their branches, their timeout at phase 1, the operation default for unlisted members. |
| SIF-R12 | Completion: reaching the end of the body or `return` completes the operation once; then SIF-R08's last regime; `after` dependents are released. |

### 4.4 Diagnostics

| ID | Code | Rule and message shape |
| --- | --- | --- |
| SIF-D01 | SW2008 | Missing operation default: `{member} is not handled by every waiting point of {op}: add keep {member}; or ignore {member}; at the top of {op}.` Quick-fixes for both. |
| SIF-D02 | SW2018, warning | A kept event whose effective route policy rejects on overflow (WP6-S07 per member route). |
| SIF-D03 | warning | A kept member that no waiting point reachable from the keeping point handles. |
| SIF-D04 | SW2008 | Jump rule violations (SIF-S07), including a forward jump over a used declaration. |
| SIF-D05 | warning | In an operation that contains a back jump or a loop around states, a leaving trigger of a waiting state whose fall-through path reaches the end of the operation without passing another waiting point: `{state} can fall through to the end of {op}; afterwards its inputs are discarded. Jump back, or end on purpose with return;.` |
| SIF-D06 | warning | Dead trigger: an unguarded leaving timer after an unguarded leaving timer of smaller or equal constant duration; a leaving trigger after an unguarded leaving trigger on the same member. |
| SIF-D07 | SW2008 | A cycle of jumps and fall-through that passes no waiting point and nothing that can suspend. |
| SIF-D08 | warning | Unreachable statement or state (not reached by fall-through and not a jump target). |
| SIF-D09 | warning | An event member kept at a waiting point that has no leaving timer (so it may be kept for an unbounded time), whose effective route policy has no `maxAge`; once per member and operation (5.2). |
| SIF-D10 | warning | A state disposition equal to the operation default. |

### 4.5 Trace

| ID | Observation |
| --- | --- |
| SIF-T01 | `state` at arrival (`source` the state statement); `state` with `stay: true` for a staying reaction (`source` the trigger). |
| SIF-T02 | `keep` (replaces `defer`), once per message. |
| SIF-T03 | `discardInput` with reasons `ignored`, `guard`, `inactiveOwner`. |
| SIF-T04 | No `discardTimer`; `timer` (WP4-T01) for computed durations, `subject` the operation. |

## 5. Checks against surprises

### 5.1 Fall-through and text order (I1)

- **Operation ends where a cycle was meant:** SIF-D05. Deleting `to unlocked;` from the lock controller makes `unlocking` fall into `report`, which is a named step, and the operation ends: the warning names `unlocking`.
- **Unreachable states:** SIF-D08 (for example a state after one whose every leaving trigger jumps, which is no jump target).
- **Operation that can end where 2.2 could not:** the migrator checks that the migrated operation's end is reachable exactly when the 2.2 machine had a reachable final state, and refuses to write the edit otherwise (7).
- **Dead triggers:** SIF-D06.
- **Reordering is never silent:** the formatter does not reorder; every Flow View move or reorder previews its changed numbers and targets, and a state move writes jumps to keep behaviour (2.7).
- **A leaving block whose `if` jumps on one path only** is drawn as a decision on the arrow with one branch to the target and one to the merge, so the fall-through path is visible.

### 5.2 Stale kept input (I5)

A `keep` turns an old command into a new action when a state lasts long. SIF-D09 warns once per operation for each event member that is kept at a waiting point without a leaving timer and whose effective route policy has no `maxAge`, with a quick-fix to select a member policy that has one. A keep bounded by the keeping state's own timer, as in the lock controller's 250 ms pulses, is not reported. Every reading sample says what a kept input means. Attribute members are not reported: they keep only the latest value.

## 6. Compatibility: measured and argued

**Measured** (prototype patches of the 2.3 simulator over 253 runs and cases; revision 1 Appendix A, and the design review's reproduction and tie variants):

| Axis | 2.2 behaviour | Stage 1 choice | Measured |
| --- | --- | --- | --- |
| Unhandled input in a state | discarded while waiting | migrator writes `ignore`: same as 2.2 | the rejected alternative, keep by default: 8 verdicts, 7 stores, 21 trace-only |
| Exit actions against transition block | exit, effect, entry | exit, block, then target: same as 2.2 | the rejected alternative, block first: 1 verdict, 2 stores, 11 trace order |
| Timer against same-instant delivery | timer wins | timer wins (phase 1): same as 2.2 | the rejected alternative, delivery wins (upper bound): 0 verdicts, 1 store, 52 traces |
| Several queued inputs at one selection (machines; 6 of 554 selections are contested) | queue-creation walk | delivery order: **differs** | the nearest measured variant, offer-ordinal order: 1 store (extended r10); written order among inputs, rejected: 1 verdict, 3 stores (example 32) |
| Elapsed timer against earlier input | elapsed timer first | written order, migrator writes timers first: same as 2.2 | the rejected alternative, "first ready": 1 of 11 such selections (extended r5) |

**Argued, not measured:**
- Migrated sources reproduce 2.2 verdicts and final stores except r10. This needs P1: a native stage 1 interpreter and the migrator, then the 253-result comparison on the migrated sources.
- Delivery order and offer-ordinal order agree on the corpus except across routes with different latencies; P1 measures delivery order.
- `ignore` consumes at the same instants as the 2.2 discard: while waiting at delivery, otherwise at the next selection (the 2.2 simulator also leaves input queued while the machine is busy). Interaction with `maxAge` and overflow therefore matches.
- Plain operations are unchanged, so revision 1's "drop input for a flow receive that is not yet waiting" axis (4 to 19 verdicts) no longer applies.

**Static census** (204 parsed files, revision 1): 47 machines, 142 states, 274 transitions, 33 self transitions, 10 states with one member on several transitions, 6 states with several timers, 3 final states with entry actions, 5 states with WP5 forms, 3 with `defer`, 65 states (122 state-member pairs) that need a disposition. With the operation default, the migration writes at most one `ignore` line per machine plus 3 `keep` overrides (argued from the census; not counted per machine).

**Traces:** `source` identities become statement paths, `defer` becomes `keep`, discard reasons change. Gate 2 (trace digests) cannot hold across the edition. It is replaced by a migrated-corpus gate on verdicts, final stores, per-kind counts and per-component order-sensitive digests after mapping identities and renamed kinds; the migrator writes the identity map (old state and transition identity to new statement identity) that the extension's run overlays and recorded fixtures need.

## 7. Migration recipe (B7, A5)

Input: a 2.2 machine (`initial I; state …` body) or a 2.3 machine with WP5 forms, in operation O.

1. **Check the frame.** O already satisfies SIF-S01 (2.2 enforces it).
2. **Choose the state order** to maximise fall-through, A5. The initial state is first. Final states are last, in source order. For the others, choose the order that maximises the number of states whose textually next state is a target of one of their transitions; exhaustive for up to 9 non-final states, greedy beyond (follow the first-declared transition to an unplaced state); ties go to the order closest to source order.
3. **Write each state.** For state S: entry and exit unchanged; then **timers first**, sorted by literal duration ascending, stable on declaration order (this keeps "elapsed timers before queued input, earliest first, equal expiry in declaration order"); then the `on receive` transitions in declaration order (keeps "first enabled transition per member in declaration order"). Each transition `… when (g) to T { e }` becomes:
   - `… when (g);` or `… when (g) { e }` when T is the next state in the chosen order;
   - `… when (g) to T;` or `… when (g) to T { e }` otherwise, including `T == S` (2.2 self transitions exit and re-enter; so does `to S`).
   Each trigger keeps its own binding names; several transitions on one member stay several triggers, so nothing is merged or renamed.
4. **Use `until`** when S has exactly one transition and no WP5 internal transition: `state S { … } until <trigger>;`.
5. **Dead timers.** Every unguarded timer whose literal duration is greater than or equal to that of an earlier-sorted unguarded timer of the same state was never taken in 2.2 (all 2.2 timers leave); it is removed and reported (models-wp4 d3: `after 2000us to ns` after `after 2ms to us`).
6. **Dispositions.** Operation level: `ignore` every member that some state does not handle. WP5 `defer m` in S: the override `keep m;` in S.
7. **Final states.** Each final state F becomes a trigger-less named step `state F { on entry { … } }` (keeps the `state` observation at final entry). With several finals, `return;` follows every final step except the last statement of the body, so `to ok` never falls into `failed`.
8. **End of operation.** A machine without a reachable final state must not have a reachable end after migration: by construction every transition targets a state, and the last state's transitions are jumps. The migrator verifies "end reachable iff final reachable" and refuses otherwise.
9. **WP5 forms**, if 2.3 ships them (D10):
   - internal transitions: staying triggers `… stay { e }`;
   - guarded timers: `after D when (g) …`. A false guard no longer consumes the timer; the guard must satisfy SIF-S05, otherwise the migrator reports the timer (it needs stage 2);
   - completion transitions `when (g) to S`: stage 1 has no condition trigger. They cannot be migrated until stage 2, or until stage 1 includes the restricted selection-time `when (g)` of 9.1 (an open part of D10).
10. **Report.** Removed dead timers, WP5 notes, the r10-style contested-order risk, and the identity map.

## 8. WP5 and WP6

**What stage 1 replaces of the merged WP5 (PR #59):** chapter 3.6 WP5-S02 to S10, 6.5 WP5-R01 to R13, WP5-T01 to T04, ADR 0023, examples 44 to 47, `test/v2/state-reactions.test.ts`, SW2017 and SW2018, `CompletionLoop`. The runtime ideas carry over: timer start at the state update, retention as `keep` with one observation, internal reactions as `stay`.

**WP6 (merged on main `adc0740`):**
- WP6-S01's guard positions become: input guards (sampled reads allowed), timer guards (no sampled read in stage 1), conditions (stage 2).
- WP6-S07's per-member effective policy is what SIF-D02 and SIF-D09 check.
- WP6-D09 (narrowed polling exemption) and WP6-D10 (always-false completion guard) target completion guards, which stage 1 does not have; they are retargeted to stage 2 conditions.
- WP6-R02 cells are unchanged; in stage 2 they feed condition wakes.

**Open decision D10: do the WP5 state forms ship in 2.3?** Not decided.

| | Remove WP5 forms from 2.3 | Ship them in 2.3 |
| --- | --- | --- |
| Work now | Revert #59 and rework WP6 parts that reference it (S01 guard positions, S07's SW2018 wording, D09, D10, the formal-semantics retention marks, `state-reactions.test.ts`) | None |
| 2.3 users | No door deferral proof (example 45), no completion transitions, no internal transitions in 2.3 | Have them |
| 3.0 migration | Only 2.2 forms | Also WP5 forms: completion transitions need stage 2 conditions or a restricted stage 1 `when (g)` evaluated at selections (the WP5-R03 meaning) |
| Edition story | 2.3 compatible minor, no state forms that 3.0 replaces | 2.3 publishes forms that 3.0 removes a release later |

Recommendation, for the owner to decide: ship 2.3 **without** the WP5 state forms only if 3.0 is planned soon after; otherwise ship them and add the restricted selection-time `when (g)` to stage 1 so that the migrator covers every published form.

## 9. Later stages

Each later stage gets its own design revision, adversarial review and prototype. Stage 1 reserves the spellings below so that nothing in it has to change.

### 9.1 Stage 2: condition triggers

**Sketch.** `when (c);`, `when (c) { … }`, `when (c) to S;` and `when (c) stay { … }` as triggers, in written order like timers. A condition written before the input group wins over queued input (B4: `when (fault) to safe;` written first is taken before a stale `move`). Timer guards are widened to anything a condition may read.

**Forward compatibility.** The grammar's `Event` gains one alternative; the priority rule already places any non-input trigger by written order; the restricted timer guards of stage 1 are a subset.

**Open problems for stage 2's design revision (B5):**
- level or edge semantics, the same in waiting and stepped mode; the drain loop (`when (backlog > 0) stay { take(); }`) must be writable;
- the zero-time livelock between two operations of one occurrence (ping-pong on `n % 2`), and a bound (one wake per write epoch, or `StateLoop` across activations);
- wakes from case-script calls and white-box helpers, which reuse the caller's activation;
- read sets per effective occurrence (redefined operations), through callees and sampled cells;
- the phase of a wake within the instant (extension of D16), and revision 1's `after 20ms` against `when (n > 2)` example;
- WP6-D09 and D10 retargeted; SW2017 retired.

### 9.2 Stage 3: stepped operations

**Sketch.** `stepped operation step() { state … }` released `on every`. Each call resumes at the current state, makes one selection with conditions evaluated once, takes at most one trigger and runs the flow to the next state's entry, or runs the state's per-call action and returns.

**Open problems for stage 3's design revision (I7):**
- one-period actuator latency (E8 of revision 1) and the entry-versus-per-call-action rule, with a lint;
- whether the first call evaluates triggers when later entries do not;
- the timer base (entry call time or logical entry time) and quantisation to the period;
- several schedule entries sharing one position; `concurrent` rejected;
- the per-call action's keyword (`during` is reserved for stage 4).

### 9.3 Stage 4: parent states

**Sketch.** `state P { …; during { inner steps and states } }`, parent triggers armed during the inner steps, outer first.

**Open problems for stage 4's design revision (B8):**
- whether a parent trigger leaves cannot be decided before its block runs; with stage 1's head spelling (`stay` versus leaving) it is decided by the head, which removes the contradiction but must be checked against run to completion of the inner segment;
- exit order (inner exits, parent exit, trigger block) for a parent trigger;
- dispositions in substates for members an ancestor handles ("handled by an ancestor" exemption; SIF-D06 for an inner trigger shadowed by a parent trigger);
- `during` in stepped operations (hierarchical periodic charts);
- Flow View layout of nested boxes with gutters.

## 10. Edition and staged plan

**Edition.** States as steps replace the 2.2 machine syntax: swa.ml **3.0**, with the migrator as an extension command that writes one validated whole-workspace edit, and no alias parser.

1. **Before approval of stage 1 (prototypes):**
   - P1: native stage 1 interpreter plus migrator in scratch, rerun of the 253-result comparison on migrated sources (verdicts, stores, per-kind counts, order digests per component), with delivery order;
   - P2: Flow View drawings of three migrated showcase machines, door's largest included;
   - P3: the reading samples (done in this revision, for the owner).
2. **2.3:** per D10.
3. **Stage 1 (3.0 core):** section 4, the migrator, the migrated-corpus gate, Flow View boxes, numbered arrows, gutters and the gestures of 2.7. Extension work: dual-edition parsing, the migration command, retiring the State view's 2.2 projection, run-overlay identity remapping, Sequence state invariants.
4. **Stage 2:** condition triggers. **Stage 3:** stepped operations. **Stage 4:** parent states.

## 11. Owner decisions

| # | Decision | Recommended answer |
| --- | --- | --- |
| D1 | Jumps | Restricted `to S;` (SIF-S07) plus structured loops; forward jumps over used declarations rejected |
| D2 | Leaving or staying | Visible at the head: `stay` for staying, everything else leaves; `;` for a leaving trigger without actions (approved look) |
| D3 | False input guard | The input is consumed and dropped (`guard`), as in 2.2, and drawn as a muted `dropped` line. A false timer guard consumes nothing |
| D4 | Input rule | Kept or ignored by an operation default, overrides per state, mandatory where a member is not handled everywhere |
| D5 | Priority | Written order among triggers ready at one selection; one input group in delivery order (approved look) |
| D6 | Order when leaving | Exit actions, then the trigger's block, then the target (2.2 order) |
| D7 | Conditions | Stage 2, with its own design revision |
| D8 | Periodic charts | Stage 3 |
| D9 | Hierarchy | Stage 4; parallel states and history out of scope |
| D10 | WP5 state forms in 2.3 | **Open.** See section 8 for both costs and the conditional recommendation |
| D11 | 2.2 machine syntax in 3.0 | Removed, automatic migrator, after P1 |
| D12 | Interrupt regions | Keep their 2.2 discard; not allowed in stateful operations |
| D13 | States in case scripts | No; scripts cannot call stateful operations |
| D14 | Trigger-less states | Named steps (jump targets, migrated finals), with SIF-D08 |
| D15 | Which operations may contain states | The 2.2 single-activation rule (SIF-S01) for stage 1; relax later only with per-activation state identity in trace, `machines`, Timing and Flow View |
| D16 | Same-instant phase of a waiting state | Selection at the first event that makes a trigger ready; timer (phase 1) before delivery (phase 2), as the 2.2 contract. Alternative: postpone the selection after same-instant deliveries so that written order decides exact ties (measured upper bound: 1 store, 52 traces) |

## 12. Stateflow cues

| Cue | Decision |
| --- | --- |
| States and flow-chart logic in one chart; junctions are control flow | **adopt**: states are steps, decisions are `if`, merges are merge nodes |
| Numbered transition order is the priority | **adopt**, with the input group sharing one number |
| entry, exit, on event | **adopt**: `on entry`, `on exit`, staying reactions listed in the box |
| Transition action after exit, before entry | **adopt**: the trigger block |
| Condition actions before exit | **reject**: work done while staying is a staying reaction |
| Default transition | **adapt**: the flow's arrival |
| Temporal `after` | **adopt**: relative to arrival, once per entry |
| Conditions evaluated at each chart execution | **later** (stages 2 and 3) |
| Hierarchy | **later** (stage 4) |
| Parallel states, history junction | **reject** |

## 13. Risks

- **Nothing is prototyped in revision 2.** The stage 1 rules are written to be implementable, but P1 has to show that the migrated corpus keeps verdicts and stores.
- **The phase rule is one rule the numbers do not show** (timer before same-instant delivery). If the owner finds this unacceptable, D16's alternative costs the measured upper bound above.
- **Timer guard restriction** may reject WP5-style guards that read attributes written by other operations; those wait for stage 2.
- **Gutter layout** of back arrows and skips is unproven at showcase size (P2). A machine with many crossing jumps may read worse in one column than a 2D state diagram; a layout mode for such operations may be needed.
- **Text order is behaviour.** The gestures of 2.7 and the checks of 5.1 contain it, but every refactoring tool must treat state order and trigger order as meaningful.
- **Repeated reactions in flat machines** (the same power-off trigger in every state) are noise until stage 4; the reading samples show where.
- **Extension cost** (dual-edition parsing, migration command, overlays, State view retirement) is substantial and is not estimated here.

## Appendix A. Measurement method

Revision 1, in `E:\t\design-scratch\base` (a copy at `02e92c8`, nothing committed):

| File | Purpose |
| --- | --- |
| `measure.mjs <out> <result>` | Runs every run of `examples/simulation/runs.json`, every case of every example and showcase model, and every run and case of `test/fixtures/compatibility-2-2-extended/models*.json`. Records verdict, stores, status, per-kind counts and the trace digest. |
| `patch.mjs` | Variant builds: `out-keep`, `out-dropops`, `out-dropall`, `out-eff`, `out-order`, `out-arrival`, probes. |
| `compare.mjs`, `static.mjs` | Comparison and machine census. |

Design review, in `E:\t\rv-states-scratch\`: baseline reproduced (253 results, identical to revision 1); `keep`, `eff` and `dropops` reproduced exactly; `patch-tie.mjs` moves the receive timeout from phase 1 to phase 3 for plain receives (`tieflow`: 0 verdicts, 0 stores, 7 traces) or also for machine timers (`tieall`: 0 verdicts, 1 store, 52 traces).
