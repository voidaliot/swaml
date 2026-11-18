# swa.ml: states as steps of the flow

**Status:** design proposal for owner review, revision 1, 18 November 2026. Not normative. Nothing here changes the grammar, validator, simulator, standard version or a published artefact. All new syntax below is in `text` fences because no parser accepts it.

**Bases:**
- **Language:** main `02e92c8` (2.3 candidate with WP1 to WP5 merged; WP6 under review on `v2.3/wp6-sampled-reads`).
- **Owner direction (relayed, three rounds):** only option 1, "states can be put anywhere in a flow". A state is an ordinary step of the flow, a step that lasts. There is no `states { }` container, no `initial` and no separate transition list. Decisions between states are ordinary `if`. Stateflow is a source of concepts and of drawing conventions, not a notation to copy. The look comes first.
- **Measurements:** throwaway prototypes in `E:\t\design-scratch\base` (not committed), run on Node 26.12.0 over 253 runs and cases: the 138 gate-2 runs and cases, the cases of the 2.3 examples 33 to 47 and the runs and cases of the seven extended 2.2 fixture sets. Appendix A lists the method.

The fallback, states and flows fully separated, is recorded in one sentence as the owner asked: it would keep the 2.2 machine body as the only place for states, forbid states in flows, and would still have to decide whether the merged WP5 forms stay.

## 0. Summary

**The idea.** A state is a statement. The flow reaches it, runs its entry actions and then waits until one of its triggers is ready. The trigger's block runs, the state is left (exit actions) and the flow continues with the next statement. Decisions between states are `if`. Loops between states are `while` or a restricted jump `to S;`. A state that contains steps and states is a parent state. A periodically called operation can execute its states one step per call (`stepped`).

```text
operation control() {
  state unlocked {
    on receive requests.request(lock) when (lock) { }
  }
  state locking {
    on entry { send motor.lockMotor(LockDrive.lockPulse); }
    on exit { send motor.lockMotor(LockDrive.idle); }
    keep requests.request;
    after 250ms { locked = true; }
  }
  state isLocked {
    on receive requests.request(lock) when (not lock) { }
  }
  state unlocking {
    on entry { send motor.lockMotor(LockDrive.unlockPulse); }
    on exit { send motor.lockMotor(LockDrive.idle); }
    keep requests.request;
    after 250ms { locked = false; to unlocked; }
  }
}
```

**Meaning in one paragraph.** The flow's control position is the state. Everything is defined by translation to the flow language. The translation needs three generalisations of the receive statement, which plain flows gain too:
- **G1:** an input member is owned by one operation, which may wait for it at several points.
- **G2:** a waiting point takes the trigger that became ready first, with ties broken by the written order.
- **G3:** a waiting point may wait for a condition, `or when (c)`, which is re-evaluated when what it reads changes.

One input rule holds everywhere: input stays queued until a waiting point takes it. In a state, every input of the operation must be listed explicitly: handled, `keep` or `ignore`. The validator checks this and offers a quick-fix, so no input is lost or kept silently.

**Measured impact on 2.2 sources.**

| Change if applied to 2.2 machines without migration | Verdicts changed | Final stores changed | Trace only |
| --- | --- | --- | --- |
| Keep unhandled input by default | 8 (5 door cases fail on a rejecting queue) | 7 | 21 |
| Drop input for a flow receive that is not yet waiting | 4 (operations), 19 (with case scripts) | 2 to 4 | 0 to 10 |
| Trigger block before exit actions (effect, exit, entry) | 1 | 2 | 11 |
| Inputs taken in written order | 1 (example 32) | 3 | 0 |
| Inputs taken in arrival order | 0 | 1 (pinning fixture r10) | 0 |
| Earliest ready first instead of "elapsed timer first" | 1 selection of 11, fixture r5 only | – | – |

The chosen design takes the safe row of each axis:
- keep at runtime, but explicit `keep`/`ignore` in every state, which the migration writes as `ignore` where 2.2 discarded;
- the 2.2 effect position kept as a transition action `to S { … }` after exit;
- arrival order.

With the automatic migration, the expected change in verdicts and stores of the corpus is zero by construction. The trace changes in source identities and in two observation kinds. This expectation is not prototyped; section 9.4 says what remains to verify.

The 2.2 machine syntax is replaced, so this is an incompatible edition. **Recommendation:** release 2.3 as the compatible minor without the WP5 state surface, and make states as steps the content of swa.ml 3.0, in three stages (section 12).

## 1. How it looks: text

### 1.1 What a state contains

```text
state name {
  /** documentation */
  on entry { … }            // runs when the flow reaches the state
  on exit { … }             // runs whenever the state is left
  during { … }              // a parent state's inner steps (waiting mode) or a per-call action (stepped mode)
  keep p.m, q.n;            // inputs that stay queued while in this state
  ignore r.k;               // inputs taken and dropped while in this state
  on receive p.m(x) [when (g)] { … }     // triggers, in the written order
  after D [when (g)] { … }
  when (c) { … }
}
```

**What makes the flow leave the state.**
- **A trigger block that ends.** The state is left: exit actions run, then the flow continues with the next statement. This is the default.
- **`stay;` at the end of a trigger block.** The state is not left: no exit, no entry, and the timers keep their start. This is the "on event" action of a state.
- **`to S;` at the end of a trigger block.** The state is left, and the flow continues at state `S` (section 1.3).
- **A false guard on the trigger (`when (g)`).** Condition not met: the input or timer is consumed and the state keeps waiting. `on receive m(x) when (g) { B }` means exactly `on receive m(x) { if (not g) { stay; } B }`.
- **A condition trigger `when (c)` that is false.** The state keeps waiting. It is evaluated again when `c` can have changed (section 6).

**A state without triggers** does not wait. It is a named step: entry actions, then exit actions, then the next statement. It can be a jump target and a box in the diagram. 2.2 final states with entry actions migrate to such steps.

### 1.2 Candidate spellings for leaving

Three spellings were compared on the lock controller with a shutdown: `unlocked`, `locking`, `isLocked`, `unlocking`, back to `unlocked`, and from `isLocked` on `power.off` to a report step and the end of the operation.

**Candidate A: trigger blocks continue, structured loops only.**

```text
operation control() {
  var running: bool = true;
  while (running) {
    state unlocked {
      ignore power.off;
      on receive requests.request(lock) when (lock) { }
    }
    state locking {
      on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.lockPulse); }
      on exit { send motor.lockMotor(LockDrive.idle); }
      keep requests.request; ignore power.off;
      after 250ms { locked = true; }
    }
    state isLocked {
      on receive requests.request(lock) when (not lock) { }
      on receive power.off() { running = false; }
    }
    if (running) {
      state unlocking {
        on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.unlockPulse); }
        on exit { send motor.lockMotor(LockDrive.idle); }
        keep requests.request; ignore power.off;
        after 250ms { locked = false; }
      }
    }
  }
  reportShutdown();
}
```

- **For:** no new control construct; every arrow is a loop or a branch.
- **Against:** every second exit needs a flag and an `if`. With three exits from one state this becomes unreadable, and the diagram shows the flag tests instead of the arrows.

**Candidate B (recommended): trigger blocks continue, plus a restricted jump `to S;`.**

```text
operation control() {
  state unlocked {
    ignore power.off;
    on receive requests.request(lock) when (lock) { }
  }
  state locking {
    on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.lockPulse); }
    on exit { send motor.lockMotor(LockDrive.idle); }
    keep requests.request; ignore power.off;
    after 250ms { locked = true; }
  }
  state isLocked {
    on receive requests.request(lock) when (not lock) { }
    on receive power.off() { to report; }
  }
  state unlocking {
    on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.unlockPulse); }
    on exit { send motor.lockMotor(LockDrive.idle); }
    keep requests.request; ignore power.off;
    after 250ms { locked = false; to unlocked; }
  }
  state report {
    on entry { reportShutdown(); }
  }
}
```

The normal cycle reads top to bottom. The back arrow is `to unlocked`, and the skip is `to report`. `report` has no triggers: it is a step, and the operation ends after it.

**Candidate C: `state X { … } until trigger;`.** The leaving trigger is written after the block, and the block holds entry, exit and the staying reactions. It reads well for one exit. With two exits it needs `until on receive a … or on receive b …` and still a way to tell them apart afterwards, so it falls back to A or B. Rejected.

**Recommendation: B.** Structured loops stay available, and a model may mix both. The jump rule keeps the safety properties (section 7):
- `to S;` is the last statement of a trigger block (tail position, also at the end of an `if`/`else` branch inside it);
- `S` is a state statement in the same statement list as the jumping state, or in a statement list that encloses it, in the same operation;
- never into a branch, a loop body, a parent's inner steps or another operation.

### 1.3 Transition actions

`to S { action }` runs `action` after the exit actions of the state being left and before the entry actions of `S`. This is Stateflow's transition action and the 2.2 position of a transition effect. Statements before `to` in the trigger block are condition actions: they run while still in the state.

- **The 2.2 order (exit, effect, entry)** is therefore written `on receive m(x) when (g) { to S { effect } }`, and the migration produces exactly this.
- **If the effect ran before the exit actions** (trigger block, exit, entry), 1 verdict and 2 final stores of the corpus would change (section 9.2).

### 1.4 A state inside a branch, decisions between states

```text
operation openDoor() {
  checkSupply();
  if (supplyOk) {
    state unlatching {
      on entry { send latch.release(true); }
      on exit { send latch.release(false); }
      ignore handle.pulled;
      on receive latch.opened() { }
      after 200ms { faults = faults + 1; }
    }
  } else {
    report(FaultId.lowSupply);
  }
  publish status.doorReleased(supplyOk);
}
```

The state is one step of the `then` branch. Leaving it continues after the `if`. Nothing jumps into or out of the branch.

### 1.5 A parent state with substates

```text
operation drive() {
  state active {
    on entry { powerUp(); }
    on exit { powerDown(); }
    on receive power.off() { to stopped; }           // applies in every substate
    during {
      state idle {
        on receive cmd.move(target) { goal = target; }
      }
      state moving {
        keep cmd.move;
        on receive sensor.arrived() { }
        after 5s { faults = faults + 1; }
      }
    }
  }
  state stopped {
    on entry { report(); }
  }
}
```

- **Running the inner steps.** `during { … }` holds the parent's inner steps. While they run, the parent's triggers are armed as well.
- **Parent triggers win.** A parent trigger that is ready is taken before the inner state's triggers. If it leaves, the inner flow is cancelled like an interrupted region: the innermost exit actions run first, then the parent's exit actions.
- **Inner steps that end.** When the inner steps end, the parent is left and the flow continues after it.

Here `moving` falls through to the end of `during`. So the parent `active` is left and the flow continues with `stopped`. A model that wants to return to `idle` writes `to idle` in `moving`; that jump stays inside `during`.

### 1.6 A periodically called operation (stepped)

```text
stepped operation windowStep() {
  state idle {
    when (switchUp and motionAllowed()) { }
    during { drive(MotorDirection.stop); }
  }
  state closing {
    when (not switchUp or position >= closedCounts) { to idle; }
    after 4s { faults = faults + 1; to idle; }
    during { drive(MotorDirection.up); }
  }
}
schedule {
  on every 10ms windowStep() deadline 2ms;
}
```

A `stepped` operation never waits inside an activation. Each call resumes at the state reached by the previous call, evaluates its triggers once in the written order, and either:
- takes the first ready trigger, runs its block and continues the flow up to the next state (entry actions only); or
- runs `during` and returns.

Reaching the end of the operation completes the cycle, and the next call starts at the first statement. This is the AUTOSAR classic runnable with a mode variable, without the hand-written `if (mode == …)` chain.

## 2. How it looks: Flow View

### 2.1 Drawing rules

These rules extend the existing Flow View of an operation. They add no new container and no dashed frame.

| Element | Drawing |
| --- | --- |
| State | Rounded step box in the same column as plain steps. Name at the top. Below a thin rule, one line each for `entry: …`, `during: …`, `exit: …` (first statement, ellipsis if longer, full text on hover). `keep` and `ignore` lines in a smaller muted font at the bottom. |
| Plain step (call, assignment, send) | Unchanged: a rectangular step node. |
| Arrival into a state | The ordinary incoming flow arrow. The first state of an operation has the start dot before it (Stateflow's default transition). There is no separate initial marker. |
| Trigger leaving the state | One outgoing arrow per trigger, from the bottom or right edge of the box, labelled `n: trigger [guard]` (`1: request(lock) [lock]`, `2: after 250ms`, `3: [temp > 30]` for a condition trigger). `n` is the written order. |
| Trigger block | If it has statements, they are drawn as ordinary flow nodes on that arrow, before it reaches its destination. Condition actions come before an `if`; the transition action of `to S { … }` is drawn as a step node labelled with a `/` prefix after the point where the arrow leaves the box. |
| Decision inside a trigger block | The existing decision diamond on the arrow; its branches are numbered in written order, `else` last. |
| Fall-through | The arrows of every trigger that ends without `to` join at the existing merge node below the box, and the flow continues to the next statement. |
| `stay;` | A loop arrow that leaves and re-enters the same box edge, labelled with its trigger. It is drawn inside the box's margin, not as a re-entry. |
| `to S;` back | A back arrow routed on the left gutter, upwards, ending on the top edge of `S`. |
| `to S;` forward | A skip arrow routed on the right gutter, downwards, ending on the top edge of `S`. |
| End of the operation | The existing final marker. Reaching it continues nothing; in a parent's `during`, the bottom of the inner flow leaves the parent. |
| Parent state | A larger rounded box. Its entry and exit lines are at the top. The `during` steps are drawn inside it as an ordinary nested flow, with its own start dot. Parent triggers leave from the outer box edge with their numbers. |
| Stepped operation | The same drawing. The header shows `stepped · every 10ms`, and the start dot is labelled `each call resumes here`. |

### 2.2 The lock controller (candidate B)

```text
        ●
        │
  ╭─────▼──────────────────╮
  │ unlocked               │◄────────────────────────┐
  │ ignore power.off       │                         │
  ╰─────┬──────────────────╯                         │
        │ 1: request(lock) [lock]                    │
  ╭─────▼──────────────────────────╮                 │
  │ locking                        │                 │
  │ entry: pulses = pulses + 1; …  │                 │
  │ exit: send motor.lockMotor(…)  │                 │
  │ keep requests.request          │                 │
  │ ignore power.off               │                 │
  ╰─────┬──────────────────────────╯                 │
        │ 1: after 250ms                             │
     [ locked = true ]                               │
        │                                            │
  ╭─────▼──────────────────╮  2: off()               │
  │ isLocked               ├──────────────────────┐  │
  ╰─────┬──────────────────╯                      │  │
        │ 1: request(lock) [not lock]             │  │
  ╭─────▼──────────────────────────╮              │  │
  │ unlocking                      │              │  │
  │ entry: pulses = pulses + 1; …  │              │  │
  │ exit: send motor.lockMotor(…)  │              │  │
  │ keep requests.request          │              │  │
  ╰─────┬──────────────────────────╯              │  │
        │ 1: after 250ms                          │  │
     [ locked = false ]── to unlocked ────────────┼──┘   (back arrow, left gutter in the real layout)
                                                  │
  ╭───────────────────────╮◄──────────────────────┘      (skip arrow, right gutter)
  │ report                │
  │ entry: reportShutdown │
  ╰─────┬─────────────────╯
        ◉
```

Order numbers restart per state. `isLocked` has two outgoing arrows, 1 and 2. A tie between them at one instant (both inputs ready at once) is decided by the number (section 5.2).

### 2.3 A state inside a branch (section 1.4)

```text
        ●
        │
   [ checkSupply() ]
        │
        ◇ supplyOk
   yes ╱ ╲ no
      ╱   ╲
╭────▼─────────────╮   [ report(lowSupply) ]
│ unlatching       │          │
│ entry: send …    │          │
│ exit: send …     │          │
│ ignore handle…   │          │
╰──┬────────┬──────╯          │
   │1:      │2: after 200ms   │
   │opened()│                 │
   │   [ faults = faults + 1 ]│
   ◆◄───────┘                 │   ◆ merge of the two triggers
   └──────────►◆◄─────────────┘   ◆ merge of the branches
               │
   [ publish status.doorReleased(supplyOk) ]
               │
               ◉
```

### 2.4 A parent state with two substates and a parent-level transition (section 1.5)

```text
        ●
        │
╭───────▼───────────────────────────────────────────╮
│ active                                            │  2: …
│ entry: powerUp();   exit: powerDown();            │
│                                                   │
│      ●                                            │
│      │                                            │
│  ╭───▼──────────╮                                 │
│  │ idle         │                                 │
│  ╰───┬──────────╯                                 │
│      │ 1: move(target)                            │
│   [ goal = target ]                               │
│  ╭───▼──────────────╮                             │
│  │ moving           │                             │
│  │ keep cmd.move    │                             │
│  ╰───┬─────────┬────╯                             │
│      │1:       │2: after 5s                       │
│      │arrived()│ [ faults = faults + 1 ]          │
│      ◆◄────────┘                                  │
│      ◉   (end of inner steps: leaves active)      │
╰──────┬───────────────────────┬────────────────────╯
       │ (inner steps ended)   │ 1: off()   (parent trigger, from the outer edge)
       ◆◄──────────────────────┘
       │
╭──────▼───────────╮
│ stopped          │
│ entry: report(); │
╰──────┬───────────╯
       ◉
```

The parent's trigger arrow leaves the outer box edge with its own number. While any substate is active, the parent's triggers are evaluated first.

### 2.5 Sequence and Timing

- **Sequence:** a state is a state invariant on the operation's lifeline (a rounded label across the lifeline at the point where the flow waits). Triggers are the incoming messages that end it, and `stay` reactions are messages that do not end it.
- **Timing:** a state is an interval on the component's track, from entry to exit, and the trace already carries `state` observations.

## 3. Worked examples and expected traces

Times are logical. Only the observations that matter are listed; the trace also keeps its 2.2 waits, deliveries and writes.

### E1. The door lock of example 45, with and without requests during the pulse

The lock of section 0 has `keep requests.request` in both pulse states. An `ignore` variant writes `ignore requests.request` there instead. The body sends `lock` at 0 ms, `unlock` at 100 ms and `lock` at 200 ms.

| Time | `keep` (expected = WP5 `DeferringLock`) | `ignore` (expected = 2.2 `DiscardingLock`) |
| --- | --- | --- |
| 0 | `unlocked` takes `request(true)`; enters `locking`, pulses 1 | same |
| 100 | `keep` observation for `request(false)`, queued | `discardInput` reason `ignored` |
| 200 | `keep` observation for `request(true)` | `discardInput` reason `ignored` |
| 250 | `after 250ms`: `locked = true`, exit (motor idle), `isLocked`; takes `request(false)` (arrived first), enters `unlocking`, pulses 2 | `locked = true`, `isLocked`, waits |
| 500 | `locked = false`, `to unlocked`; takes `request(true)`, `locking`, pulses 3 | – |
| 750 | `locked = true`, `isLocked` | – |
| End | `locked`, pulses 3 | `locked`, pulses 1 |

The second test of example 45 (`fob` unlock and body lock queued in one pulse) also passes: the two kept requests are taken in arrival order, the order WP5-R09 introduced.

### E2. Retry with timeout

```text
operation connect() {
  var attempt: uint = 0;
  while (attempt < 3 and not connected) {
    attempt = attempt + 1;
    publish link.hello(attempt);
    state awaitingAck {
      ignore link.noise;
      on receive link.ack(id) when (id == attempt) { connected = true; }
      after (backoffMs * 1ms) { backoffMs = backoffMs * 2; }
    }
  }
  if (not connected) { fail "no ack"; }
}
```

- **Peer acks only the third hello (after 1 ms):**
  - 0: `hello(1)`, `awaitingAck`;
  - 10: `after` (10 ms), `backoffMs = 20`, exit, loop; `hello(2)`;
  - 30: `after` (20 ms), `backoffMs = 40`; `hello(3)`;
  - 31: `ack(3)`, `connected = true`, exit; the loop ends.
- **Stale ack:** an `ack(1)` that arrives at 12 ms (during the second attempt) is consumed by the false guard, and the state stays. The trace shows `discardInput` reason `guard` (section 8), and the 20 ms timer keeps its start at 10 ms.
- **Old form:** the 2.2 machine needed three states and a counter, or an `on receive … or after` statement without a guard.

### E3. Initialisation steps, then states, then continuation

```text
operation session() {
  loadConfig();
  sessionId = try(cloud.openSession(vehicleId), 0);
  if (sessionId == 0) {
    state backoff {
      keep network.coverage;
      after 10ms { }
    }
    sessionId = try(cloud.openSession(vehicleId), 0);
  }
  state connected {
    on receive network.coverage(up) when (not up) { sessionId = 0; }
  }
  publish ctl.sessionClosed(sessionId);
}
```

The cloud refuses the first request after 2 ms and grants 101 after another 2 ms; coverage is lost at 1 ms.
- 0: `loadConfig`, request.
- 2: the request answers 0.
- 2 to 12: `backoff`. The coverage loss from 1 ms is kept.
- 12: the second request; 14: `sessionId = 101`.
- 14: `connected` takes the kept loss, which arrived at 1 ms: `sessionId = 0`, exit.
- 14: `sessionClosed(0)`, and the operation completes.

The "decision after entry" of WP5 (example 44) is a plain request followed by `if`: no completion transition is needed, because a request is already a step.

### E4. A state inside a branch

This is section 1.4.
- **`supplyOk` and `opened()` at 50 ms:** `unlatching` from 0 to 50 ms; exit sends `release(false)`; `doorReleased(true)` at 50 ms.
- **`supplyOk`, no `opened()`:** at 200 ms `faults = 1`; exit; `doorReleased(true)`.
- **Not `supplyOk`:** `report`, then `doorReleased(false)` at 0 ms; the state is never entered.

### E5. A nested state with an interruptible shutdown

This is section 1.5 with a move at 0 ms and `power.off` at 30 ms, while `moving` waits for `arrived`.
- 0: `active` entry (`powerUp`), `idle`, takes `move`, `moving`.
- 30: parent trigger 1, `off()`, is ready. The inner flow is cancelled at its waiting point: `moving` has no exit, then `active` exit (`powerDown`), then `to stopped`, `report`, end.
- **`arrived()` and `off()` both ready at 30 ms:** the parent trigger wins (outer first), and `arrived` stays queued. The operation then completes, so the queued input is discarded as `inactiveOwner` at the next delivery attempt, as in 2.2 after a final state.

The same shape works with an `interruptible` around a plain sequence of states, when the cancellation should not run the parent's exit actions:

```text
interruptible {
  state idle { on receive cmd.move(target) { goal = target; } }
  state moving { keep cmd.move; on receive sensor.arrived() { } }
} on receive power.off() {
  report();
}
```

Here the handler runs after the cancelled inner state's exit action, and no parent exit exists.

### E6. Condition triggers fed by a periodic operation and by a sampled read

```text
component def Heater {
  reversed port door: DoorState;          // WP6: provides attribute ajar: bool = false (sampled)
  attribute temp: real = 20.0;
  attribute alarms: uint = 0;
  operation sample() { temp = temp + 4.0; }
  operation guard() {
    state watching {
      when (temp > 30.0) { alarms = alarms + 1; }
      when (door.ajar) { stay; }           // first arrow: count nothing, keep watching
    }
    state cooling {
      after 1s { temp = 20.0; to watching; }
    }
  }
  schedule {
    on start guard();
    on every 10ms sample();
  }
}
```

- **Wake by an attribute write:** `sample` writes `temp` at 10, 20 and 30 ms. At each unlock of `sample` the waiting `guard` is woken, because `temp` is in the read set of its condition. At 30 ms (`temp = 32`) condition 1 is ready, `alarms = 1`, and the flow goes to `cooling`.
- **Wake by a cell update:** the door sensor sends `ajar = true` at 15 ms. The cell update wakes `guard`, condition 2 is true, and the `stay` block runs. Condition 2 is then disarmed until an evaluation sees `ajar == false`, so it does not fire again at the 20 ms wake.
- **Ties:** if both became ready at one wake, number 1 would win.

### E7. A state written as a plain flow, and as a state

```text
// plain flow (2.3 receive statement plus G1 to G3)
var leave: bool = false;
startPulse();
var t0: uint = now();
while (not leave) {
  // requests.request is not listed, so it stays queued (flow rule)
  on receive power.off() { }                       // taken and dropped; the loop waits again
  or after (t0 + 250ms - now()) { locked = true; leave = true; }
}
stopPulse();
```

```text
// state
state locking {
  on entry { startPulse(); }
  on exit { stopPulse(); }
  keep requests.request;
  ignore power.off;
  after 250ms { locked = true; }
}
```

Both have the same observable behaviour: the timer counts from the pulse start, `power.off` is taken and dropped without leaving, requests stay queued, and the exit action runs once. The plain form is exactly the translation of the state (section 4.2), so they mean the same; the state form is what the validator can check (dispositions) and what Flow View draws as one box. (The plain flow needs G1 to G3 only when the same member is also listed elsewhere in the operation.)

### E8. Stepped operation (section 1.6)

`switchUp` becomes true at 25 ms, and the window is closed after 70 ms of driving.
- **Calls at 10 and 20 ms:** `idle`; no trigger; `during` stops the motor.
- **30 ms:** trigger 1 of `idle` is ready, and the flow reaches `closing` (entry only). The call ends.
- **40 to 90 ms:** `closing`; `during` drives up.
- **100 ms:** `position >= closedCounts`, `to idle` (entry only). The call ends.

One trigger is taken per call; zero-time loops are impossible by construction. The trace has one `state` observation per state entered and no wait observations.

## 4. Meaning by translation

### 4.1 The three generalisations of the flow language

They apply to plain flows too and are the only additions to the flow core:

- **G1. Ownership per operation.** An input member is owned by exactly one schedule entry, interrupt region or operation (today: one receive branch). Several waiting points of the same operation may list it. This makes the plain-flow form of E7 possible. For 2.2 it only turns some SW2005 errors into valid sources.
- **G2. Ready order.** When a waiting point starts waiting or is woken, it takes the trigger that became ready first:
  - an input when it was offered (global offer ordinal);
  - a timer at its expiry;
  - a condition at the evaluation that found it true.

  Ties at one instant go to the written order. It is one rule for receive statements, states and case scripts.
- **G3. Condition branches.** `on receive … or when (c) { … }` is a branch that becomes ready when `c` is true at an evaluation (section 6).

### 4.2 One state, no jump

A state statement

```text
state S { on entry { EN } on exit { EX } keep K; ignore I;
          on receive m(x) when (g) { B1 } after D { B2 } when (c) { B3 } }
```

means, with fresh hidden locals `leave`, `t0` and `stayed`:

```text
EN
var t0: uint = now();            // the state-update time; timers count from here
var leave: bool = false;
while (not leave) {              // the waiting point
  on receive m(x) { if (g) { B1'; } }        // B1' sets leave = true unless it ends in stay
  or receive i(_) { }                        // one empty branch per ignored member of I
  or when (c) { B3'; }
  or after (t0 + D - now()) { B2'; }          // only while D has not fired in this entry; elapsed: ready at once
}
EX
```

Here `B'` is `B` with its tail rewritten: an ending without `stay` sets `leave = true`, and `stay;` becomes nothing. Members in `K` are simply not listed, so they stay queued: that is the flow rule. A timer that fired with `stay` is not armed again in this entry, which is the WP5 internal-timer rule. All runtime rules follow from this text plus G2:
- the timer start is the state update;
- elapsed timers and queued input compete by ready time;
- a false guard consumes the input and loops;
- run to completion holds because the receive statement takes nothing while its branch runs.

### 4.3 Jumps

A statement list that contains `to` targets is rewritten into a dispatch loop with a hidden position local (the structured-program construction):

```text
var pc: Pos = Pos.first;
while (pc != Pos.end) {
  if (pc == Pos.s1) { <s1 and the plain steps up to the next state>; pc = <next> }
  else if (pc == Pos.s2) { … }
}
```

`to S` sets `pc` to `S` after the exit actions and the transition action. A jump to a state in an enclosing list also sets that list's `pc` and makes every list in between end:
- a loop in between gains `and pc == Pos.none` in its condition;
- a `for` in loop is rewritten to an indexed `while`.

The jump is in tail position, so no statement after it can run, and no `break` is needed.

### 4.4 Parent states

`state P { …; on receive t(x) { BT } …; during { INNER } }` means:
- the inner flow `INNER`, in which every waiting point additionally lists `P`'s triggers first, in their own written order (outer first);
- a leaving parent trigger cancels the inner flow as a matched interrupt region does today (chapter 3.3);
- a staying one runs at the inner waiting point and loops.

When `INNER` ends, `P` is left. While the inner flow is suspended outside a state (in a `wait` or a request), only leaving parent triggers cancel it, exactly like an armed `interruptible`. Staying parent triggers wait until the next inner waiting point, so run to completion is kept.

### 4.5 Stepped operations

A `stepped` operation is translated like section 4.3, with `pc` kept in a hidden occurrence attribute instead of a local. Each waiting point becomes "evaluate the triggers once; if none is ready, run `during` and return". After a trigger, the flow runs until the next state's entry actions, then returns. A guard or condition is evaluated once per call, so no re-evaluation rule is needed.

## 5. Input, order and queues

### 5.1 One input rule

Input stays in its connection queue until a waiting point takes it. This is the 2.2 flow rule, unchanged.

To make the choice visible in states, the validator requires, for every state of an operation and every input member the operation owns (G1), exactly one of: a trigger on it, `keep` or `ignore`.
- **Error:** `State {state} does not say what happens to {member}: add a trigger, keep {member}; or ignore {member};` (SIF-D01).
- **Quick-fixes:** both lines. On migrated 2.2 machines the fix is `ignore`, which is the 2.2 discard.

Plain receive statements need no list. Their waiting point is visible, and anything not listed is kept by the flow rule; Flow View shows the kept members on the wait node.

**The queue bound.** A kept event occupies its connection queue, under its policy (capacity, overflow, ordering, `maxAge`); an attribute keeps one value.
- SIF-D02 (warning, today SW2018) reports `keep` of a member whose route rejects on overflow.
- SIF-D03 (warning) reports a kept member that no waiting point reachable after the state handles: the input would be kept until the queue drops it.

The measurement shows why this must be explicit. Keeping by default without the list made five door cases fail because a periodic CAN signal (`vehicle.signals`) that only `unlocked` handles filled a rejecting queue (section 9.2).

### 5.2 Order

G2 is the only selection rule: first ready, ties by written order. Diagram numbers are the written order.
- **Inputs among themselves:** arrival order. The measured alternative, written order among inputs, broke example 32 ("A hold arrives first"), which is the reason for this choice.
- **Timers and conditions:** these also compete by ready time. A timer that elapsed while entry actions were suspended competes with input by when each became ready.
- **What this replaces:** the WP5-R01 table (completion, then elapsed timers, then retained input, then other input).

## 6. Condition triggers

This section answers the five conditions of the WP6 review (`review-wp6.md`, end) and the WP6 author's points.

1. **The wake set.** A waiting point with condition branches is woken by exactly two kinds of change:
   - a write, by another activation of the same occurrence, to an attribute in the condition's read set (`attributeAccess`, transitively through callees);
   - a delivery that updates a sampled cell in that set (WP6-R02).

   The wake happens when the writing activation releases the lock: at its completion (`finish`) or suspension. The cell update wakes at its delivery. Unrelated writes wake nothing and add no observation. The waiting operation's own trigger blocks need no wake, because the waiting point is evaluated when the block ends.
2. **The phase.** A wake is queued like a resumption, at the dispatch phase of the current instant with the next insertion ordinal. Timer expiries (phase 1) and deliveries (phase 2) of the same instant are therefore already ready when the woken waiting point evaluates. All of them have the same ready time, so the written order decides. Example: `after 20ms` written before `when (n > 2)`, with `n` set at 20 ms by `on every 10ms` → the timer is taken. With the two lines swapped, the condition is taken.
3. **2.2 traces.** 2.2 sources have no condition branches, so the hook never fires for them. Gate 2 and models-wp5 stay at zero differences for this rule.
4. **Livelock and twice-true conditions.**
   - **Edge rule:** after a condition trigger fires and the state stays, the trigger is disarmed until an evaluation sees it false.
   - **Coalescing:** changes between two evaluations coalesce, so a condition that goes true, false and true again inside one activation's locked segment is observed once. This is the same rule as attribute replacement, and it is stated, not hidden.
   - **Two wakes in one instant:** two separate wakes are two evaluations, and a disarmed trigger fires again only after one of them saw it false.
   - **Leaving conditions:** a condition trigger that leaves is not disarmed. Zero-time loops through leaving conditions are caught by `StateLoop` (section 7).
5. **The warnings.** SW2017 (WP5-D08) is retired. It is replaced by SIF-D04, a warning for a condition whose read set contains nothing that any scheduled activation writes and no sampled cell, so that no wake can ever come. WP6-D09 is dropped. WP6-D10 (a condition that is always false) moves to condition triggers as a dead-trigger warning. `now()` stays forbidden in conditions (use `after`).

## 7. Safety properties

- **Single entry, structured exits.**
  - Every block is still entered only at its top. `to` never targets a statement inside a branch, a loop body or a parent's `during`.
  - Exits from nested blocks go only to states of enclosing lists (labelled-break discipline), and only from tail position.
  - The control-flow graph between waiting points is structured. The graph between states can be any graph, which is what a state graph is. Every segment between two waiting points is a structured, branching segment, and that is the unit a deadline or WCET analysis needs.
- **Determinism.** Selection is G2: ready time, then written order. Events keep the 6.1 order (time, phase, ordinal). Wakes have a fixed phase (section 6). No choice depends on queue creation or container iteration order.
- **Run to completion.** A trigger block, including the exit actions, the transition action and the entry actions up to the next waiting point, runs before any other trigger of that state or of the next state is considered. Input arriving meanwhile, even during a request inside the block, waits for the next waiting point. This is derived from the receive statement, which takes input only while it waits.
- **No zero-time livelock.**
  - **Inputs:** they are consumed, so their reactions are bounded by queues.
  - **Timers:** they are positive and fire once per entry.
  - **Staying conditions:** disarmed by the edge rule.
  - **Leaving cycles:** a cycle of states connected only by `when (true)` with no possible suspension is a static error (SIF-D05, today WP5-D03). At run time, `StateLoop` (today `CompletionLoop`, same chain rule: restart at each consumption and suspension) stops the run and fails a case. This is the one runtime check that is not derived from the translation. Without it, the loop would end at the step limit as an inconclusive run, which is what a plain `while (true) { }` does.
  - **Stepped operations:** one trigger per call, so no loop is possible.
- **Bounded queues.** These are the connection policies, plus SIF-D02 and SIF-D03.
- **Analysable schedule.**
  - A waiting operation is one activation. A state wait releases the component lock, like a receive, and resumption reacquires it.
  - The activation's deadline, if any, covers the whole flow, as for any suspending flow today. A state in an `on every` operation therefore has to finish within the period, and the validator warns (SIF-D06) because this is rarely intended. Use `stepped`.
  - A `stepped` operation never suspends: it is placeable on a basic Task (WP8 T-rules). Each call is one bounded segment.
- **Trace.** States keep the 2.2 `state` observation at each entry, now with the statement identity of the state as `source`. A taken trigger is visible through its existing observations (`deliver`, timer expiry, `write`). New observations:
  - `keep`, once per kept message (today `defer`);
  - `discardInput` with reason `ignored` or `guard`;
  - `wake` (subject the waiting operation, `source` the write or delivery that woke it), only for condition branches;
  - `violation` `StateLoop`.

## 8. Rules

IDs use the prefix SIF (states in flow). G = grammar, S = static, R = runtime, D = diagnostic, T = trace.

### 8.1 Grammar delta (text only, not applied)

```text
Statement: … | State | Jump | Stay;
State: 'state' name=Name '{' documentation=Documentation?
         (actions+=StateAction | triggers+=Trigger | dispositions+=Disposition | during=During)* '}';
StateAction: 'on' kind=('entry'|'exit') body=Block;               // unchanged spelling
During: 'during' body=Block;                                       // 'during' contextual
Trigger: ( 'on' 'receive' endpoint=MemberPath '(' (bindings+=Name (',' bindings+=Name)*)? ')' ('when' '(' guard=Expression ')')?
         | 'after' (delay=Duration | '(' delayValue=Expression ')') ('when' '(' guard=Expression ')')?
         | 'when' '(' condition=Expression ')' ) body=Block;
Disposition: kind=('keep'|'ignore') endpoints+=MemberPath (',' endpoints+=MemberPath)* ';';   // contextual words
Jump: 'to' target=Name (action=Block | ';');
Stay: 'stay' ';';                                                  // contextual
Receive: 'on' branches+=ReceiveBranch ('or' branches+=ReceiveBranch)*
         ('or' 'when' '(' condition=Expression ')' conditionBody=Block)*
         ('or' 'after' (timeout=Duration | '(' timeoutValue=Expression ')') timeoutBody=Block)?;
Operation modifier: 'stepped' before 'operation' (contextual).
Removed: OperationBody's 'initial' Name ';' State+ alternative; Transition; Deferral.
```

### 8.2 Static rules

| ID | Rule |
| --- | --- |
| SIF-S01 | A state is a statement of an operation body or of a block in it. Not in case scripts or concurrent entries (stage 1). |
| SIF-S02 | A state has at most one `on entry`, one `on exit` and one `during`. A `during` in a waiting operation contains at least one state. |
| SIF-S03 | Guards and conditions are `bool` and pure or read state. Conditions do not call `now()`. |
| SIF-S04 | At most one `on receive` trigger per member per state, and at most one `after` per literal duration. Alternatives on one trigger are `if`/`else if` in its block. |
| SIF-S05 | `to S` is in tail position of a trigger block. `S` is a state in the same statement list or an enclosing one of the same operation, not inside a branch, loop body or `during` that does not contain the jump. `to` never appears in entry, exit or `during` blocks or outside a trigger block. |
| SIF-S06 | `stay;` is in tail position of a trigger block. |
| SIF-S07 | Every state lists every input member of its operation once: trigger, `keep` or `ignore` (SIF-D01). |
| SIF-S08 | G1: each input member has one owner (schedule entry, interrupt region or operation). An operation may list it at several waiting points. |
| SIF-S09 | A `stepped` operation is parameterless void, contains at least one state, and has no `wait`, receive statement, request, suspending call or interrupt region. Its states may use `during` as a per-call action. |
| SIF-S10 | A state without triggers is a named step. It has no `during` and no dispositions. |

### 8.3 Runtime rules

| ID | Rule |
| --- | --- |
| SIF-R01 | Reaching a state: record `state`, run entry, set the timer start to the state-update time (before entry), evaluate computed timers once (WP4-R02), then wait. |
| SIF-R02 | Selection (G2): the trigger that became ready first; ties by written order; inputs by global offer ordinal. |
| SIF-R03 | Leaving by block end: block, exit, next statement. By `to S`: block, exit actions of every state being left (innermost first), transition action, `S`. |
| SIF-R04 | `stay`: no exit, no entry, timers keep their start, a fired timer is not re-armed in this entry, and a fired condition is disarmed until seen false. |
| SIF-R05 | Input: kept members stay queued (one `keep` observation each); ignored members are consumed with `discardInput ignored`; a false guard consumes with `discardInput guard`. |
| SIF-R06 | Condition wakes as in section 6. |
| SIF-R07 | `StateLoop` violation as `CompletionLoop` (WP5-R07), for leaving condition triggers. |
| SIF-R08 | Parent states: outer triggers first; a leaving parent trigger cancels the inner flow like a matched interrupt region; inner steps that end leave the parent. |
| SIF-R09 | Stepped: one evaluation per call; at most one trigger per call; the flow then runs to the next state's entry; the position persists per occurrence; the end of the operation restarts at the first statement next call. |
| SIF-R10 | Locks: state waits release the serial lock; blocks run under it except during their own suspensions. |

### 8.4 Diagnostics

| ID | Code | Rule |
| --- | --- | --- |
| SIF-D01 | SW2008 | Missing disposition (with keep/ignore quick-fixes) |
| SIF-D02 | warning (SW2018 respelled) | `keep` of a member whose route rejects on overflow |
| SIF-D03 | warning | Kept member not handled by any reachable later waiting point |
| SIF-D04 | warning (replaces SW2017) | Condition that no wake can ever change |
| SIF-D05 | SW2008 | Cycle of `when (true)` leaving triggers on which nothing can suspend |
| SIF-D06 | warning | State in an `every`-released, non-stepped operation |
| SIF-D07 | SW2008 | Jump rule violations (SIF-S05, S06) |

### 8.5 Trace

| ID | Observation |
| --- | --- |
| SIF-T01 | `state` (2.2 kind), at entry; `source` is the state statement |
| SIF-T02 | `keep` (replaces `defer`), first keep of each message |
| SIF-T03 | `discardInput` with reasons `ignored` and `guard` (2.2 reasons `inactiveOwner` and `noEnabledTransition` remain for non-state owners and after the operation ended) |
| SIF-T04 | `wake`, for condition branches only |
| SIF-T05 | `violation` `StateLoop` |

## 9. Compatibility (measured)

### 9.1 What is measured and how

Prototype patches of the built 2.3 simulator (`out/src/simulation/simulator.js`), each applied alone. Every run and case of the corpus, the showcase models and the extended 2.2 fixtures was rerun and compared with the unpatched build: verdict, final stores, status and trace digest. The unpatched build was rerun twice with byte-identical results. Total: 253 results.

| Group | Results |
| --- | --- |
| Gate-2 fixture (runs.json, 2.2 examples, three showcase models) | 138 |
| Cases of the 2.3 examples 33 to 47 | about 30 |
| Runs and cases of the extended 2.2 sets (models, wp2 to wp5) | the rest |

### 9.2 Results per behaviour axis

| Axis | 2.2 behaviour | Measured change if redefined | Where |
| --- | --- | --- | --- |
| Unhandled input in a state | discarded while waiting (`inactiveOwner`) | **keep by default:** 8 verdicts, 7 stores, 21 trace-only | Verdicts: door ×5 (`rxVehicleStatus failed: rejected`, a periodic signal kept in states that do not handle it fills a rejecting queue), cloud breaker test, examples 45 (its 2.2-shaped lock) and 46 (its 2.2-shaped breaker). Stores: door "Courtesy light afterglow", extended r1, r3, r5, r6, r7, r10. |
| Input for a flow receive not yet waiting | kept | **drop unless waiting:** operations 4 verdicts, 2 stores; with case scripts 19 verdicts, 4 stores, 10 trace-only | Example 32 ×4, example 21, extended d2; scripts: examples 31, 37, nine cloud and three v2x showcase tests |
| Exit action versus transition effect | exit, effect, entry | **effect first:** 1 verdict, 2 stores, 11 trace order | v2x "Repetition outlived by cancellation"; door "Lock and unlock"; extended r5 |
| Several queued inputs at one selection | queue-creation walk | **written order:** 1 verdict, 3 stores (example 32 ×4); **arrival order:** 1 store (extended r10, built to pin the 2.2 walk) | Contested selections: flows 4 of 50, scripts 0 of 279, machines 6 of 554 |
| Elapsed timer and earlier input | elapsed timer first | **first ready:** 1 of 11 elapsed-timer selections changes | Extended r5 only |
| Several transitions on one member | declaration order | none after migration to `if`/`else if` in the same order | 10 such states |
| Final state entry, timer start, timer invalidation, input during entry, lock release | as 2.2 | none by translation | – |

**Static census** of 204 parsed files (corpus, showcase, extended sets):

| Count | Value |
| --- | --- |
| Machines | 47 |
| States | 142 |
| Transitions | 274 |
| States that need a disposition line | 65 (122 state-member pairs) |
| States with an exit action and a non-empty effect | 7 |
| Self transitions | 33 |
| States with one trigger written twice | 10 |
| States with several timers | 6 |
| Final states with entry actions | 3 |
| States using WP5 forms | 5 |
| States using `defer` | 3 |

Per showcase model (state-member pairs needing a disposition):

| Model | Machines | Pairs |
| --- | --- | --- |
| door | 4 | 43 |
| v2x | 3 | 24 |
| cloud | 4 | 10 |
| examples 04, 36, 41 | 1 each | 0 |
| examples 42, 44, 45, 46, 47 | 1 to 2 each | 2, 6, 2, 1 and 1 |

### 9.3 What option 1 changes for 2.2 sources

Option 1 redefines states. The 2.2 body form (`initial X; state …` as the whole body) and the `Transition` syntax are removed, and every 2.2 machine must be rewritten. With the migration of section 9.4:
- **Sources:** all 47 machines change text.
- **Disposition lines:** 65 states gain one; the migration writes `ignore` to keep 2.2 discards.
- **Expected results:** verdicts and final stores unchanged by construction, except the two extended fixtures r5 and r10, which pin the 2.2 queue walk and the elapsed-timer-first rule.
- **Traces:** they change in `source` identities (new statement paths), `discardInput` reasons (`ignored`, `guard`), and `keep` replacing `defer`. Gate 2 (trace digests) cannot hold. It would be replaced by a migrated-corpus gate on verdicts, stores and per-kind counts.
- **The promise:** "2.3 is a compatible minor after 2.2" cannot hold for a release that contains option 1, so option 1 is an incompatible edition, **3.0**.

### 9.4 Migration recipe (and what a tool can do)

Mechanical and complete for 2.2 and WP5 machines:
1. **The body.** Write the states as state statements in source order, the initial state first.
2. **Transitions.** Each transition `on receive m(x) when (g) to T { e }` becomes the trigger `on receive m(x) when (g) { to T { e } }`. Several transitions on one member merge into one trigger, `if (g1) { to A { e1 } } else if (g2) { to B { e2 } } else { stay; }`, in declaration order. 2.2 timers become `after D [when (g)] { to T { e } }`, ordered by literal duration and then declaration order.
3. **Dispositions.** For each state, write `ignore` for every member of the machine it does not handle, and `keep` for every WP5 `defer`.
4. **Final states.** A final state becomes a trigger-less state placed last; `to F` stays. A final state without entry actions becomes the end of the operation: the last state jumps to it, which is a step.
5. **WP5 forms:**
   - completion `when (g) to S { e }` becomes `when (g) { to S { e } }`;
   - internal transitions become triggers ending in `stay`;
   - guarded timers keep their guard.

   The completion semantics change from "evaluated after entry and after internal reactions" to "re-evaluated on wakes", which is a deliberate change for the 5 WP5 states (examples 44, 46, 47).
6. **Stepped candidates.** These are not migrated automatically. 2.2 has no polled machines; periodic mode logic is plain flow and stays as it is.

A tool can do steps 1 to 5 exactly (it is a syntax transformation on the AST plus the member census) and report the two semantic notes (r5/r10-style contested orders cannot be found statically; completion re-evaluation). To verify the claim of zero result changes, implement the migrator in stage 1 before the parser change and run the full 253-result comparison on the migrated sources with a translation-based prototype. **This has not been done in this proposal.**

## 10. What happens to WP5 and WP6

Option 1 replaces the state surface, so every WP5 form is respelled; none survives as written.

| Form | Fate | Cost |
| --- | --- | --- |
| `initial` + `state` body, `Transition` | removed; migrated (section 9.4) | parser, validator, simulator `machine()`, formatter, projection, all examples with states, three showcase models |
| Completion `when (g) to S` | respelled `when (g) { to S; }`; re-evaluated on wakes (section 6) | examples 44 and 47 rewritten; ADR 0023 superseded |
| Internal transitions | respelled: trigger ending in `stay;` | example 46 rewritten |
| Guarded timers | kept on `after D when (g)` | none beyond respelling |
| `defer p.m;` | respelled `keep p.m;`, and every state must say keep or ignore | example 45; WP5-D05/D06 replaced by SIF-D01/D03 |
| WP5 selection rules R01 to R13 | replaced by G2 and the translation | spec 6.5 rewritten; WP5 extended fixtures r1 to r10 re-recorded |
| `CompletionLoop` | renamed `StateLoop`, same chain rule | trace consumers |
| SW2017 (WP5-D08) | retired; replaced by SIF-D04 | |
| SW2018 (WP5-D09) | kept as SIF-D02 with `keep` wording | |
| WP6-D09 (narrowed polling exemption) | dropped | the separable commit `01c23d9` is not merged |
| WP6-D10 (always-false guard) | re-targeted to condition triggers | message text |
| WP6 sampled reads and member policies | unchanged; cells feed condition wakes | WP6-R02 gains the wake hook |

If 2.3 ships without the WP5 surface (recommended), these respellings cost nothing in a published edition. The WP5 runtime ideas carry over:
- offer-ordinal order of retained input (now G2 for all inputs);
- timer start at the state update;
- the loop chain.

## 11. Other work packages and the editor

- **WP7 (release guards):** unaffected. A skipped call of a `stepped` operation is no step, and its position does not move.
- **WP8 (tasks, placement):**
  - T-rule "a state machine sits on a basic Task only if none of its reactions can suspend" becomes "a `stepped` operation may sit on a basic Task; a waiting operation with states needs an extended Task";
  - the in-task order and priority keys are unchanged.
- **WP9 (edition):**
  - new notation figures for the drawings of section 2;
  - showcase rewrites through the migrator;
  - reference book and PDF of 3.0;
  - inventories with the productions `Trigger`, `Disposition`, `Jump`, `Stay`, `During` and the changed `State` and `Receive`.
- **Flow View:** section 2. A state is a node kind of the operation flow, not a separate state diagram. The layout needs left-gutter back arrows and right-gutter skip arrows across nesting levels; the existing decision and merge nodes are reused.
- **Sequence:** state invariants on the lifeline; triggers as messages; `stay` reactions do not end the invariant.
- **Edit operations (`diagram-edits.ts`), each validated as a whole workspace:**
  - insert a state step (creation card: name, first trigger), with the quick-fix dispositions written in the same edit;
  - add, reorder (renumbers by moving text) and delete a trigger;
  - set or clear a guard;
  - drag an arrow end to a state, which writes or removes `to S` (refused targets per SIF-S05);
  - make a trigger stay;
  - add `keep` or `ignore` from the missing-disposition marker;
  - convert a plain step into a state (wraps it as the entry action) and back;
  - wrap a selection of steps into a parent's `during`;
  - delete a state (re-links the fall-through and removes jumps to it, or offers to retarget them).

## 12. Recommendation and staged plan

**Recommendation:** adopt option 1 as swa.ml 3.0, with candidate B (fall-through plus restricted `to`), keep-at-runtime with mandatory dispositions, G2 ready order, transition actions and condition wakes. Ship 2.3 as the compatible minor without the WP5 state surface.

1. **Stage 0 (2.3, now).** Remove the WP5 state forms from the 2.3 candidate before release (completion, internal, guarded timers, `defer`, SW2017/2018, `CompletionLoop`). Keep WP1 to WP4, WP6 without D09/D10, WP7 and WP8. Write ADR 0026 "states as steps" superseding ADR 0023. 2.3 stays a compatible minor.
2. **Stage 1 (3.0 core, coherent on its own).**
   - flat states as statements, triggers, `keep`/`ignore`, `stay`, `to` within one statement list and enclosing lists;
   - G1 to G3, condition wakes, `StateLoop`;
   - the migrator and the migrated-corpus gate;
   - Flow View boxes, numbered arrows, back and skip arrows.

   This already replaces every 2.2 and WP5 machine.
3. **Stage 2.** `stepped` operations (door-style periodic logic, basic Tasks).
4. **Stage 3.** Parent states (`during` with inner states, outer-first triggers) and their nested drawing.

Each stage is one work package with the usual adversarial review. Stage 1 must first prototype the translation and the migrator and rerun the 253-result comparison.

## 13. Owner decisions

| # | Decision | Recommended answer |
| --- | --- | --- |
| D1 | Jumps: structured loops only (A) or restricted `to S;` (B) | B: tail position, same or enclosing statement list, never into a block |
| D2 | What a trigger block does when it ends | Leave the state and continue with the next statement |
| D3 | Staying | `stay;` at the end of the block; a false guard on the trigger also stays |
| D4 | Input rule | Kept until a waiting point takes it, with mandatory `keep`/`ignore` per state and the migration writing `ignore` for 2.2 discards |
| D5 | Order among ready triggers | First ready, ties by written order; inputs by arrival; diagram numbers = written order |
| D6 | Position of a 2.2 effect | `to S { action }` after exit (exact 2.2 order); statements before `to` run in the state |
| D7 | Conditions | Re-evaluated on wakes (writes by other activations, cell updates), with the edge rule; no `now()` |
| D8 | Periodic charts | `stepped` operations, one trigger per call, no super-step |
| D9 | Hierarchy | Parent states with `during { … }`, outer triggers first, in stage 3; parallel (AND) states and history out of scope |
| D10 | Edition | 3.0 for states as steps; 2.3 released without the WP5 state surface |
| D11 | 2.2 machine syntax in 3.0 | Removed, with an automatic migrator; no alias parser (repository rule) |
| D12 | Interrupt regions | Keep their 2.2 discard while inactive; they cancel, they are not states |
| D13 | States in case scripts | Not in stage 1 |
| D14 | Trigger-less states | Allowed as named steps (jump targets, migrated finals) |

## 14. Stateflow cues

| Cue | Decision | Why |
| --- | --- | --- |
| States and flow-chart logic in one chart; junctions are control flow | **adopt** | This is the design: states are steps, decisions are `if`, merges are the existing merge nodes. |
| Explicit, numbered transition order | **adapt** | Numbers are the written order and decide ties at one instant and the evaluation order of conditions. Inputs are taken in arrival order, because written order among inputs broke example 32. |
| entry, during, exit, on event | **adapt** | entry and exit as 2.2. "on event" is a trigger ending in `stay`. `during` is the parent's inner steps in waiting mode and the per-call action in stepped mode. |
| Hierarchy: substates, parent transitions apply in all substates, inner transitions | **adapt** | Parent state with `during`, outer triggers first, `to` within the inner list. Stage 3. |
| Parallel (AND) states | **reject** | Concurrency belongs to schedule entries and components with explicit ports. |
| Default transition | **adapt** | The flow's arrival is the default transition; the start dot is drawn before the first state. |
| History junction | **reject** | Store a value and decide with `if`; a stepped operation already persists its position. |
| Temporal `after` | **adopt** | Relative to the state update, once per entry. |
| `every`, `at`, `before`, `temporalCount` | **reject for now** | `stay` plus `after` with re-entry (`to S`) covers periodic actions; a schedule `on every` is clearer. |
| Conditions evaluated at every chart execution | **adapt** | Stepped: per call. Waiting: on wakes (section 6), which removes stale guards without polling. |
| Events (not queued) versus messages (queued) | **adapt** | swa.ml events and requests are queued like messages, with explicit keep or ignore. Attributes and sampled cells are data. There are no unqueued broadcast events. |
| Condition actions and transition actions | **adopt** | Statements before `to` and the `to S { … }` block. |
| Super-step, run to completion, loop guard | **adapt** | Run to completion per trigger block; no super-step in stepped mode; `StateLoop` in waiting mode. |
| Graphical notation | **cue only** | Rounded boxes, numbered arrows, junction diamonds; the textual form stays primary and structured. |

## 15. Risks not closed

- **The migrator is not prototyped.** "Zero result changes after migration" is argued by construction, not measured. In particular, the 2.2 discard of input that arrives during entry and is then unhandled must map exactly onto `ignore` at the next waiting point. The prototype shows the mechanism (WP5 retention), not the migrated text.
- **The translation is not prototyped.** The trace-level claims (one `state` per entry, the step interleaving at equal times) depend on implementing states natively with the same step points as today's `machine()`. A literal desugaring would add steps and change same-instant interleaving.
- **Condition wakes:** the read-set computation must follow callees and sampled cells exactly (the WP6 review findings F2, F3 and F6 on `sampledMembers` and shadowing apply). Performance with many waiting conditions is unmeasured.
- **G1** lets two activations of one operation wait for the same member. 2.2 already allows this for one receive statement (the oldest activation is served); the rule should be stated, not inherited.
- **Jumps to enclosing lists** require loop-condition rewriting in the translation, and `for in` must become an indexed loop. A tool that reasons on the source must treat `to` as a labelled exit.
- **`during` has two meanings** (inner steps, per-call action). If the owner finds this confusing, use `steps { }` for the parent form.
- **Flow View layout** of back and skip arrows across nested parents is unproven at showcase size (door: 4 machines, up to 9 states each).
- **Schedule:** 3.0 lands after 2.3. Until then, the showcase keeps its 2.2 machines, and the WP5 proofs (v2x session, cloud breaker, door deferral) wait.
- **Unmeasured rows:** dispositions written by the migrator interact with `maxAge` and overflow exactly as 2.2 discards only if `ignore` is taken at the same instant the 2.2 discard happened. Equal-time ordering with other components' steps was not checked.

## Appendix A. Measurement method

All in `E:\t\design-scratch\base`, a copy of this worktree at `02e92c8` with a junction to its `node_modules`; nothing is committed.

| File | Purpose |
| --- | --- |
| `measure.mjs <out> <result>` | Runs every run of `examples/simulation/runs.json`, every case of every example and showcase model with its case options, and every run and case of `test/fixtures/compatibility-2-2-extended/models*.json`. Records verdict, stores, status, per-kind counts and the trace digest. |
| `patch.mjs` | Writes variant builds: `out-keep` (unhandled machine input treated as deferred), `out-dropops` and `out-dropall` (input for a flow or script receive that is not waiting is discarded), `out-eff` (effect before exit) and combinations. |
| `out-order`, `out-arrival` | Contested waiting points take the lowest written branch, or the lowest offer ordinal. |
| `out-probe*` | Count contested selections and elapsed-timer selections with an earlier input. |
| `compare.mjs`, `static.mjs` | Compare two result files; census of machines. |
| Results | `E:\t\design-scratch\r-*.json`, summary `E:\t\design-scratch\cmp.txt`. |

The baseline rerun is byte-identical. The gate-2 script on the same copy reports 138 of 138 runs and cases with 0 differences.
