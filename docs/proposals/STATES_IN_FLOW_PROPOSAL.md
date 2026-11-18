# swa.ml: states as steps of the flow

**Status:** design proposal for owner review, **revision 3**, 18 November 2026. Not normative. Nothing here changes the grammar, validator, simulator, standard version or a published artefact. All new syntax is in `text` fences because no parser accepts it. "Measured" numbers come from revision 1's prototypes, the design review's prototypes and the interpreter prototype P1 (flat states, waiting mode, the drop default). Parent states, conditions and periodic machines are not prototyped yet: everything about them is argued.

**Bases:**
- **Language:** main `adc0740` (2.3 candidate with WP1 to WP6 merged) and branch `v2.3/wp7-release-guards` (`28db1b3`, read for how schedule entries and release guards behave).
- **Owner direction (binding):** a state is an ordinary step of a flow, usable wherever a statement is; no `states { }` container, no `initial`; written order is the real priority, the input lines of one state forming one group in arrival order; plain steps between states; restricted jumps `to S;`; structured text; cues from Stateflow; the drawing shows nothing that repeats context. Since revision 2: one final release; every line says at its head whether it leaves; parent states; exits that apply in every state; conditions that are re-checked; periodic machines without a new keyword; an input that a state does not handle is dropped, as in 2.2; **the smallest possible set of words, and simplicity before expressiveness**: fewest words, fewest rules, no special case a reader must know.
- **Review:** the adversarial design review of revision 1, kept outside the repository at `E:\t\review-states-design.md` (B1 to B8, I1 to I11).
- **Drawing prototype P2:** `E:\GitHub\swaml-vsc-ext\.temp\kept\states-p2\` (drawings and hand-migrated texts of nine machines).
- **Interpreter prototype P1:** branch `prototype/states-in-flow-p1` (`f5b94fb`, worktree `E:\t\sw-p1`); summary and evidence in `E:\GitHub\swaml-vsc-ext\.temp\kept\states-p1\REPORT.md`.
- **Reading samples:** [STATES_IN_FLOW_READING_SAMPLES.md](STATES_IN_FLOW_READING_SAMPLES.md), rewritten for revision 3, with three new samples.

## The whole thing in ten sentences

1. A state is a statement: the flow reaches it, runs its `on entry` block, and waits.
2. The lines of a state say what it reacts to: an input `on receive m(x)`, a timer `after D`, or a condition `if (c)`; an input or timer line may add a condition `if (g)`.
3. A line that ends in a block reacts and the state keeps waiting; a line that says `exit` leaves for the next statement; a line that says `to S` leaves for state `S`; leaving runs `on exit`, then the line's block.
4. The lines are tried in written order and the first one that is ready is taken; the `on receive` lines of a state count as one line served in arrival order; a timer that expires at the instant a message arrives comes first.
5. Input that the current state does not mention is dropped while the state waits; input that arrives while the operation is busy waits for the next state that waits.
6. An `if` in the flow is checked when the flow gets there; an `if` on a line of a state is checked whenever the state chooses, which is on arrival, after a reaction, and whenever an input, a timer or a change of a value it reads could make a line ready.
7. A state may contain states after its lines: its lines then apply in every state inside and are tried before theirs, and the input and timer lines at the top of the operation apply in every state of the operation.
8. Between states is ordinary flow, and `to S;` goes back or skips to a state in the same statement list or an enclosing one, never into one.
9. Released `on start`, the operation waits for its lines; released `on every P`, each release takes at most one line and returns, keeping its state, and `if (true) { … }` written last is what a state does at a release where nothing else is ready.
10. Only an operation that a component owns directly, without parameters or result, released by exactly one `on start` or `on every` entry and never called, may contain states.

## Changes since revision 2

| Topic | Revision 2 | Revision 3 | Where |
| --- | --- | --- | --- |
| Scope | Stage 1 flat states; conditions, periodic machines and parents later | **One final release** (expected name 3.0) contains everything, ordered into implementation packages. The unreleased WP5 state forms are replaced in place and never ship. | 10 |
| Words | `stay`, `keep`, `ignore`, `until` added | **No word added; three removed** (`initial`, `final`, `when`). The state words are `state`, `on entry`, `on exit`, `on receive`, `after`, `if`, `exit`, `to`. | 1.2, 4.6 |
| Conditions and guards | `when (g)` guards, conditions sketched | **One word, `if`**, for guards (`on receive m(x) if (g) exit;`), condition lines (`if (c) to S;`) and the decision in the flow. The 2.2 guard `when (g)` is respelled by the migrator. | 1.1, 3.5 |
| Leaving or staying | `stay { … }` at the head; bare `;` or block leaves | A line with only a block **reacts and stays**. A line leaves only when its head says `exit` or `to S`. A bare `;` is an error. | 1.1 |
| One-exit state | `state X { … } until <trigger>;` | Gone: `after 250ms exit;` inside the state. | 1.1 |
| Unhandled input | `keep`/`ignore`, mandatory check | **Dropped while the state waits**, as in 2.2; nothing is written. No keep feature: a model that must remember an input stores it in a reaction. | 1.3, 3.8 |
| Jumps | at the head or at the end of a block | **Only at a line head**, plus the statement `to S;` at the end of a statement list of the flow (an `if` branch included). A block never jumps. | 1.9, 3.7 |
| Parent states (B8) | open problems | **Solved:** a state whose lines are followed by a `state` is a parent; its lines apply inside and are tried first; exits run innermost first. | 1.5, 3.6 |
| Operation-level lines | none | The operation is the outermost parent: input and timer lines at its top apply in all its states. | 1.6 |
| Conditions (B5) | open problems | **Solved:** level semantics, the same rule for waiting and periodic machines; wakes at writes and sample-cell updates; `StateLoop` for a condition reaction that repeats without anything changing. | 3.5 |
| Periodic machines (I7) | `stepped` sketched | **No keyword:** the schedule entry decides. One line per release; `if (true) { … }` written last is the per-step action. | 1.8, 3.9 |
| Which operations (B2) | `on start` only | One `on start` **or** one `on every` entry; other entry kinds are errors with a message; no plain receive statement in an operation with states. | 3.1 |
| When input is dropped | at every selection | **Only while a state waits** (P1: dropping at every selection changes fixture r5). | 3.8 |
| Taking queued input | not stated | **A state takes input only by waiting for it**; input that is already queued ends that wait in zero time, as in 2.2 (P1: 0 differences). | 3.4 |
| Named step or dead end | not stated | Decided by the text: a state waits iff it has a line other than `on entry`/`on exit`. A 2.2 non-final state without transitions has no counterpart; the migrator refuses it. | 1.1, 7 |
| Flow View | numbers out of sequence; `dropped` lines; condition inside the decision | Numbers in written order along the edge; one lane per target; nothing drawn for dropped input; **empty diamond, every condition `[c]` on a line**; compact boxes; parent boxes; operation frame kept. | 2.1 |
| One rule, two spellings | not addressed | One logical exit is spelled one way in every state that has it. | 2.9 |
| WP5/WP6 diagnostics | retargeted later | SIF-D11 (condition nothing can change) and SIF-D12 (condition always false) replace them now. | 4.4 |
| Trace reasons | `ignored`, `guard` | The 2.2 reasons: `inactiveOwner` for unhandled input, `noEnabledTransition` when no guard holds. | 3.11 |
| Measurement | migrated sources not run | **P1:** 0 verdicts and 1 final store change on 263 results (r10, delivery order); everything else identical, order-sensitive digests included. | 6 |

## 0. Summary

```text
operation control() {
  on receive status.query() { publish status.report(locked, pulses); }
  on receive power.off() to report;
  var unlockNext: bool = false;
  var lockNext: bool = false;
  state unlocked {
    on receive requests.request(lock) if (lock) exit;
  }
  state locking {
    on entry { pulses = pulses + 1; unlockNext = false; send motor.lockMotor(LockDrive.lockPulse); }
    on exit { send motor.lockMotor(LockDrive.idle); }
    after 250ms exit;
    on receive requests.request(lock) { unlockNext = not lock; }
  }
  locked = true;
  if (unlockNext) {
    to unlocking;
  }
  state isLocked {
    on receive requests.request(lock) if (not lock) exit;
  }
  state unlocking {
    on entry { pulses = pulses + 1; lockNext = false; send motor.lockMotor(LockDrive.unlockPulse); }
    on exit { send motor.lockMotor(LockDrive.idle); }
    after 250ms exit;
    on receive requests.request(lock) { lockNext = lock; }
  }
  locked = false;
  if (lockNext) {
    to locking;
  }
  to unlocked;
  state report {
    on entry { reportShutdown(); }
  }
}
```

**Impact on 2.2 sources.** Every 2.2 machine is rewritten by the migrator without added lines (2.2 dropped unhandled input too). **Measured by P1** on 263 executed results (115 from 2.2 machines), with the migrated sources run by a native interpreter of the flat rules: **0 verdicts and 1 final store change** (extended fixture r10: several queued inputs are served in delivery order, where 2.2 walked its queues in creation order). Everything else is identical, order-sensitive trace digests included. That is the one behaviour change of the migration.

**Open owner decisions:** section 11. The important ones: outer level first (recommended), level semantics for conditions (recommended), arrival ends a periodic step (recommended), no condition lines at the operation level (recommended).

## 1. How it looks: text

### 1.1 A state and its lines

```text
state name {
  /** documentation */
  on entry { … }                               // when the flow reaches the state
  on exit { … }                                // on every way out
  on receive p.m(x) [if (g)] { … }             // reaction: runs, the state stays
  after D [if (g)] { … }
  if (c) { … }
  on receive p.m(x) [if (g)] exit;             // leaves, continues with the next statement
  on receive p.m(x) [if (g)] exit { … }        // leaves, runs the block after the exit actions
  on receive p.m(x) [if (g)] to S;             // leaves for state S
  on receive p.m(x) [if (g)] to S { … }
  after D [if (g)] exit;  …                    // the same heads for timers
  if (c) exit;  if (c) to S;  …                // and for conditions
  state inner { … }                            // optional: from the first inner state on,
  …                                            // the body is the parent's inner flow (1.5)
}
```

**The head says what happens.**
- **A block alone:** a reaction. No exit, no entry, the timers keep their start. It is listed inside the state box in Flow View, never drawn as an arrow. `on receive m(x) { }` takes an input and does nothing, which is also what happens to an input that is not mentioned.
- **`exit`:** the state is left: its `on exit`, then the line's block, then the next statement. `exit` is the word of `on exit`; `next` or `leave` would add a word, so revision 3 uses `exit`.
- **`to S`:** the state is left the same way and the flow continues at state `S`.
- **A bare `;`** after an event is an error: `on receive m(x);` must say `{ }`, `exit;` or `to S;`.

**`if` in two positions.** On a line of a state, `if (c)` is checked whenever the state chooses, for as long as the state is active. In the flow, `if (c) { … } else { … }` is the ordinary decision, checked once when the flow gets there. The position is unambiguous: a state body holds lines up to its first inner `state`, and only flow after it (4.1).

**Order when a state is left:** its `on exit`, then the line's block (its bindings are in scope), then the target or the next statement. This is the 2.2 order exit, effect, entry (measured: putting the block first changes 1 verdict and 2 final stores of the corpus).

**Whether a state waits is decided by its own text.** A state waits exactly when it has at least one line other than `on entry` and `on exit`.
- **A state without such lines** does not wait: entry, exit, next statement. It is a named step: a jump target, a migrated 2.2 final state, the start of a parent's inner flow. It does not wait even inside a parent that has lines.
- **A state with only reactions** waits and never leaves by itself. When no enclosing level has a leaving line either, SIF-D19 warns that the operation stays there for good. This is the only way to wait forever, and it is visible.
- **A 2.2 state without transitions that is not final** (a dead end: it waits forever and drops its inputs) has no direct counterpart; the migrator refuses it and names the state (7, P1 defect D5).

### 1.2 The words

| Words for states, reactions and conditions | 2.2 | 2.3 candidate (WP5) | Revision 2 | Revision 3 |
| --- | --- | --- | --- | --- |
| `state`, `on`, `entry`, `exit`, `receive`, `after`, `to`, `if` | yes | yes | yes | **the whole list** |
| `when` | yes (guards) | yes (guards, completion) | yes | **removed**: guards and conditions are `if` |
| `initial`, `final` | yes | yes | removed | removed |
| `defer` | no | yes | removed | removed (never shipped) |
| `stay`, `keep`, `ignore` | no | no | added | **not added** |
| `until` after a state | no (loop word only) | no | added | **not added**; `until` stays a loop word |
| `during`, `stepped` | no | no | reserved | **not added** |

Section 4.6 lists the complete keyword set of the behaviour language before and after.

### 1.3 The lock controller

Section 0 is the full lock controller. How to read it:
- **Operation-level lines.** The two lines above the first statement apply in every state. A status query is answered wherever the lock is, also during a pulse. A power-off ends whatever state is current, the pulses included (their exit actions set the motor idle), and the flow continues at `report`.
- **Dropped by default.** In `unlocked`, an unlock request does not satisfy `if (lock)`: it is taken and dropped (`discardInput`, reason `noEnabledTransition`). Nothing else is mentioned in `unlocked`, so nothing else is kept there.
- **Remembering a request during a pulse.** There is no keep feature. A pulse state takes requests with a reaction and stores what matters in a local: `on receive requests.request(lock) { unlockNext = not lock; }`. The last request wins. After the pulse, plain flow decides: `if (unlockNext) { to unlocking; }`.
- **Plain flow between states.** `locked = true;` runs after the exit action set the motor idle.
- **Back and skip.** `to unlocked;` closes the cycle, `to locking` in the `if` restarts a pulse, and the operation-level power-off skips to `report`, a named step: `reportShutdown()` runs and the operation ends.

The 2.2 shape (`DiscardingLock`: requests during a pulse are lost, queries and power-off too) is the same text without the operation-level lines, without the pulse reactions and without the two `if` statements, with the query and power-off lines written in `unlocked` and `isLocked`.

### 1.4 The owner's picture

Start dot, `state0`, a decision with two branches to `state2` and `state1`, a merge, an operation step, `state4`, final marker.

```text
operation run() {
  var ok: bool = false;
  state state0 {
    on entry { send lamp.set(Lamp.waiting); }
    on receive cmd.go(v) exit { ok = v; }
  }
  if (ok) {
    state state2 {
      on entry { send lamp.set(Lamp.go); }
      after 10ms exit;
    }
  } else {
    state state1 {
      on entry { send lamp.set(Lamp.retry); }
      on receive cmd.retry() exit;
    }
  }
  process();
  state state4 {
    on entry { report(); }
  }
}
```

A `retry` that arrives while `state0` waits is dropped: `state0` does not handle it. `state4` has no lines: it is a named step, and the operation ends after it.

### 1.5 Parent states: the door window lifter

The 2.2 `WindowLifter.control()` of the door showcase has six states and 41 transitions, 33 of them back to `idle` (P2 drew it 2214 × 1982 px; P1's migrator writes it as 4 `exit` and 37 `to` lines). The same machine with two parent states:

```text
operation control() {
  var start: WindowRequest = WindowRequest.manualUp;
  state idle {
    on entry { drive(MotorDirection.stop); }
    on receive requests.request(command) if (command == WindowRequest.autoUp and oneTouchAllowed()) exit {
      start = WindowRequest.autoUp;
      oneTouchCloses = oneTouchCloses + 1;
    }
    on receive requests.request(command) if ((command == WindowRequest.manualUp or command == WindowRequest.autoUp) and motionAllowed()) exit {
      start = WindowRequest.manualUp;
    }
    on receive requests.request(command) if (command == WindowRequest.autoDown and oneTouchAllowed()) exit {
      start = WindowRequest.autoDown;
    }
    on receive requests.request(command) if ((command == WindowRequest.manualDown or command == WindowRequest.autoDown) and motionAllowed()) exit {
      start = WindowRequest.manualDown;
    }
  }
  state moving {
    /** Stops that apply to every movement, the pinch reversal included. */
    on receive supervision.sensorFault() to idle;
    on receive supervision.motionStalled() to idle { stalledStops = stalledStops + 1; }
    state driven {
      /** Movements requested by the switch; a withdrawn motion permission stops them, not the reversal. */
      on receive permissionIn.motionInhibited() to idle { inhibitedStops = inhibitedStops + 1; }
      state selecting { }
      if (start == WindowRequest.autoUp) {
        to autoUp;
      } else if (start == WindowRequest.manualDown) {
        to manualDown;
      } else if (start == WindowRequest.autoDown) {
        to autoDown;
      }
      state manualUp {
        on entry { drive(MotorDirection.up); }
        after 8s to idle { runTimeouts = runTimeouts + 1; }
        on receive supervision.pinchDetected() to reversing { pinchReversals = pinchReversals + 1; }
        on receive supervision.obstructed() to idle { obstructionStops = obstructionStops + 1; }
        on receive supervision.endPosition(closed) if (closed) to idle;
        on receive requests.request(command) if (command == WindowRequest.autoUp and oneTouchAllowed()) exit {
          oneTouchCloses = oneTouchCloses + 1;
        }
        on receive requests.request(command) if (command != WindowRequest.manualUp and command != WindowRequest.autoUp) to idle;
      }
      state autoUp {
        /** One-touch close: continues after the switch is released; a down request stops it. */
        on entry { drive(MotorDirection.up); }
        after 8s to idle { runTimeouts = runTimeouts + 1; }
        on receive supervision.pinchDetected() to reversing { pinchReversals = pinchReversals + 1; }
        on receive supervision.endPosition(closed) if (closed) to idle;
        on receive requests.request(command) if (command == WindowRequest.manualDown or command == WindowRequest.autoDown) to idle;
      }
      state manualDown {
        on entry { drive(MotorDirection.down); }
        after 8s to idle { runTimeouts = runTimeouts + 1; }
        on receive supervision.obstructed() to idle { obstructionStops = obstructionStops + 1; }
        on receive supervision.endPosition(closed) if (not closed) to idle;
        on receive requests.request(command) if (command == WindowRequest.autoDown and oneTouchAllowed()) exit;
        on receive requests.request(command) if (command != WindowRequest.manualDown and command != WindowRequest.autoDown) to idle;
      }
      state autoDown {
        on entry { drive(MotorDirection.down); }
        after 8s to idle { runTimeouts = runTimeouts + 1; }
        on receive supervision.obstructed() to idle { obstructionStops = obstructionStops + 1; }
        on receive supervision.endPosition(closed) if (not closed) to idle;
        on receive requests.request(command) if (command == WindowRequest.manualUp or command == WindowRequest.autoUp) to idle;
      }
    }
    state reversing {
      /** Pinch reversal: switch requests and a withdrawn motion permission are dropped here. */
      on entry { drive(MotorDirection.down); }
      after 1600ms to idle { runTimeouts = runTimeouts + 1; }
      on receive supervision.reversalComplete() to idle;
      on receive supervision.endPosition(closed) if (not closed) to idle;
      on receive supervision.obstructed() to idle { obstructionStops = obstructionStops + 1; }
    }
  }
}
```

How to read it:
- **`moving`** holds the two stops that the 2.2 machine repeats in all five moving states; **`driven`** the stop it repeats in the four switch-driven states but not in `reversing`. The 2.2 machine also leaves out `obstructed` in `autoUp`, so `obstructed` stays in the four states that have it: two overlapping groups cannot both be parents.
- **Entering a parent.** `idle` leaves with `exit` into `moving`, whose inner flow starts with `driven`, whose inner flow starts with the named step `selecting` and a decision on `start`. A parent is entered only at its top (single entry); the decision chooses the substate, as a Stateflow default transition into a junction does. A parent's inner flow starts with a state, so the decision follows the named step.
- **Leaving.** `to idle` from a substate leaves `driven` and `moving` (exit actions innermost first; these parents have none), then runs the block, then enters `idle`. The ways out of `moving` and `driven` are written once and drawn once.
- **Inputs.** Every input that a state, its parents and the operation do not mention is dropped there while it waits, exactly as the 2.2 machine dropped it: `obstructed` in `autoUp`, `motionInhibited` and switch requests in `reversing`, supervision events in `idle`.
- **Not a migration.** The behaviour is the 2.2 behaviour except at a selection where several lines are ready at once: a parent's stop is tried before the substate's timer and inputs (3.4). The migrator never introduces parents (7).

**Exit count.**

| | 2.2 and flat migration | With parents |
| --- | --- | --- |
| Leaving arrows | 41 | **30** (idle 4, `moving` 2, `driven` 1, manualUp 6, autoUp 4, manualDown 5, autoDown 4, reversing 4) |
| Arrows to `idle` | 33 | **22**, drawn in one shared lane |
| Decision lines into substates | 0 | 4 (three jumps and the `[else]` line to `manualUp`) |

If the 8 s run-time limit is meant per movement rather than per state, `after 8s to idle { … }` moves to `driven`: 27 arrows, 19 to `idle`. That changes behaviour (the 8 s would no longer restart from `manualUp` to `autoUp`), so it is the owner's choice for the showcase, not something a tool may do.

### 1.6 An exit that applies in every state: the mode manager

The operation is the outermost parent: an input or timer line written at the top of the operation applies in all its states. It is an input like any other, here the port member `ecu.shutdown`; it is written once and drawn once, on the operation frame.

```text
operation modes() {
  on receive ecu.shutdown() exit { send status.mode(Mode.off); }
  while (true) {
    state off {
      on entry { send status.mode(Mode.off); }
      on receive key.ignitionOn() exit;
    }
    state powered {
      on receive key.ignitionOff() exit;
      state standby {
        on entry { send status.mode(Mode.standby); }
        on receive cmd.go() exit;
        on receive diag.enter() to diagnostic;
      }
      state running {
        on entry { send status.mode(Mode.running); send drive.enable(true); }
        on exit { send drive.enable(false); }
        on receive cmd.halt() to standby;
        on receive diag.enter() exit;
      }
      state diagnostic {
        on entry { send status.mode(Mode.diagnostic); }
        on receive diag.leave() to standby;
      }
    }
  }
}
```

- **`ecu.shutdown`** in `running`: `running`'s exit disables the drive, `powered` is left (no exit action), the block reports off, and the operation ends: `exit` at the operation level continues after the operation's last statement. Later input of its members is discarded (`inactiveOwner`).
- **`key.ignitionOff`** is written once on `powered` (the flat sample writes it three times). `exit` leaves `powered`; the loop starts again at `off`.
- **Dropped commands.** `cmd.go` arriving while `off` waits is dropped.
- **Member names** avoid the reserved words `on`, `start` and `exit` (P1: revision 2's `pwr.on`, `cmd.start` and `diag.exit` do not parse).

### 1.7 Conditions

A condition line `if (c)` is ready whenever `c` holds when the state chooses. `c` may read the component's attributes, whoever writes them, the sampled port members of WP6, the operation's locals and constants; it may call operations that are pure or read state; it may not read `now()` (3.5).

**Anti-pinch from a sampled port member.** The motor current arrives as an attribute member with an initial value, so `sense.current` is a sampled read (WP6-S01), re-checked at every delivery of a new value.

```text
port def MotorSense {
  provides attribute current: uint = 0;          // mA; the initial value makes it sampled
}
component def Lifter {
  reversed port sense: MotorSense;
  reversed port requests: WindowRequests;
  const attribute pinchLimit: uint = 4500;
  attribute pinchReversals: uint = 0;
  operation control() {
    state idle {
      on entry { drive(MotorDirection.stop); }
      on receive requests.request(c) if (c == WindowRequest.autoUp) exit;
    }
    state closing {
      on entry { drive(MotorDirection.up); }
      if (sense.current > pinchLimit) to reversing { pinchReversals = pinchReversals + 1; }
      on receive requests.request(c) if (c == WindowRequest.halt) to idle;
      after 8s to idle;
    }
    state reversing {
      on entry { drive(MotorDirection.down); }
      after 400ms to idle;
    }
  }
  schedule {
    on start control();
  }
}
```

**The same condition on an attribute written by a periodic operation.** A filter runs every millisecond and writes `motorCurrent`; the machine reads it. In the owner's words the value "must come from somewhere": here a port, read by the filter.

```text
component def Lifter {
  reversed port sense: MotorSense;
  attribute motorCurrent: uint = 0;
  operation filter() {
    motorCurrent = (motorCurrent * 3 + sense.current) / 4;
  }
  operation control() {
    …
    state closing {
      on entry { drive(MotorDirection.up); }
      if (motorCurrent > pinchLimit) to reversing { pinchReversals = pinchReversals + 1; }
      …
    }
    …
  }
  schedule {
    on start control();
    on every 1ms filter();
  }
}
```

- **When it is checked.** On arrival in `closing`, after a reaction, and whenever `filter()` has written `motorCurrent` and unlocked (a wake, 3.5).
- **Written order.** The condition is written before the input lines, so when the current is too high and a halt request is queued at the same choice, the reversal wins. Written after them, the halt would win.
- **What a condition does not see:** a value that rises above the limit and falls back within one run of the writer. A condition looks at values, not changes; a pulse that must not be missed is an event.

### 1.8 A periodic machine: the window controller every 10 ms

The schedule entry decides how an operation with states runs. Released `on every 10ms`, the operation takes one step per release and returns, keeping its state per occurrence: the AUTOSAR classic runnable style.

```text
component def WindowController {
  reversed port switch: SwitchIn;                // provides attribute position: SwitchPos = SwitchPos.neutral;
  reversed port sense: MotorSense;
  port motor: MotorOut;
  const attribute pinchLimit: uint = 4500;
  const attribute fullTravel: uint = 400;        // 4 s of travel in 10 ms steps
  attribute travel: uint = 0;
  operation step() {
    state idle {
      on entry { send motor.drive(MotorDirection.stop); }
      if (switch.position == SwitchPos.up and travel < fullTravel) exit;
      if (switch.position == SwitchPos.down and travel > 0) to opening;
    }
    state closing {
      on entry { send motor.drive(MotorDirection.up); }
      if (sense.current > pinchLimit) to reversing;
      if (switch.position != SwitchPos.up or travel >= fullTravel) to idle;
      after 8s to idle;
      if (true) { travel = travel + 1; }         // per-step action: ready when nothing above is
    }
    state opening {
      on entry { send motor.drive(MotorDirection.down); }
      if (switch.position != SwitchPos.down or travel == 0) to idle;
      if (true) { travel = travel - 1; }
    }
    state reversing {
      on entry { send motor.drive(MotorDirection.down); }
      after 400ms to idle;
      if (true) { if (travel > 0) { travel = travel - 1; } }
    }
  }
  schedule {
    on every 10ms step() deadline 2ms;
  }
}
```

How one step works (3.9):
- **The first release** (at 10 ms) runs the flow from the first statement until it reaches a waiting state: `idle`'s entry stops the motor, and the step returns.
- **Every later release** makes one choice in the current state. A leaving line runs exit actions, its block, the flow and the next state's entry actions, then the step returns. A reaction runs its block and the step returns. If nothing is ready, nothing runs.
- **The per-step action** is `if (true) { … }` written last: an ordinary condition that always holds, so by written order it is taken exactly when nothing before it is ready. No new word and no new rule.
- **The step that arrives** does not run the per-step action: arriving in `closing` at 50 ms starts the motor; `travel` counts from 60 ms.
- **`after 8s`** counts in time from the arrival and is checked at each release, so it is quantised up to the period.
- **Nothing wakes a periodic machine** between releases; its conditions are checked at each step.
- **A release guard** (WP7) on the entry skips whole steps: no choice, no per-step action, state and timer starts unchanged.

### 1.9 Going back and skipping

- **Restricted jump.** `to S` names a state `S` in the statement list that contains the jump (for a line: the list that contains its state), or in a list that encloses it, in the same operation. It never enters a branch, a loop body, a parent or another operation.
- **Where it is written:** at a line head, or as the statement `to S;` at the end of a statement list of the flow: the operation body, a parent's inner flow, or a branch or loop body there (`if (c) { to S; }`; P1 needed this for the rewritten completion transitions). Never in an entry, exit or line block: a block never jumps. A choice between targets is several lines with conditions, in written order.
- **After a jump,** in the same list only a state that is itself a jump target may follow.
- **Structured loops remain.** A cycle of states is often a `while (true) { … }` (mode manager, traffic light, connection manager, debounce in the reading samples). A jump out of a loop ends the loop.

## 2. How it looks: Flow View

### 2.1 Drawing rules

These rules hold for every flow, with or without states, unless the row says otherwise.

| Element | Drawing |
| --- | --- |
| Operation | The grey operation frame Flow View draws today: header `«operation» name : () returns void`, then one line per operation-level reaction (`status.query() : publish …`). It is the operation, not a states container, and it stays. |
| Decision | A plain **empty diamond**. Every condition is written `[c]` on an outgoing line, never inside: `if (ok) { … } else { … }` is one diamond with lines `[ok]` and `[else]`. `if / else if / else` is one diamond with one labelled line per branch in written order, `[else]` last; a missing `else` is an `[else]` line to the merge. A loop test is a diamond with `[c]` into the body and `[else]` out. No "yes/no", no hexagon. |
| Merge | A small empty diamond. |
| Plain step, call | Unchanged Flow View nodes. |
| State | A rounded box with a heavier outline and `«state»`, name at the top. Below a thin rule: `entry: …`, `exit: …` (first statement, ellipsis, full text on hover), then one line per reaction (`2 query() : publish …`, numbered when the state also has leaving lines). An empty reaction is one muted line, `request(c) { }`. |
| Parent state | The same rounded box, name and lines at the top, its inner flow drawn inside on a lightly tinted area below the lines. The incoming line enters at the top edge and continues to the first inner state; no inner start dot. The end of the inner flow leaves through the bottom edge. Its leaving lines are arrows from its bottom edge, like any state's. |
| Leaving line | One arrow from the bottom edge, labelled `number event [condition]`: `1 after 250ms`, `2a request(lock) [lock]`, and a condition line simply `[sense.current > pinchLimit]`. Numbers are written order; the input lines share one number with a letter each. A state with one leaving line draws it without a number. |
| Operation-level leaving line | One arrow from a small square on the left border of the operation frame (to a target state: along the left gutter; `exit`: to the final marker), labelled as above. Drawn once, never one arrow per state. |
| Exit order along the edge | **Exits leave the bottom edge in number order, left to right.** Below the box each line turns towards its target in an exit band, one lane high per line; lines may cross inside the band, drawn with a line hop and never under a label. |
| Shared lanes | **One lane per target state and gutter side.** Arrows to the same target join the lane with a junction dot; the lane ends in one arrowhead on the target's top edge. Back jumps use the left gutter, skips the right; lanes are nested by span. |
| Line block | Ordinary step nodes on the arrow, outside the box (they run after the exit actions). |
| `exit` and `to` the next statement | Both drawn straight down into the merge below the box: the drawing never shows which spelling was used. |
| Labels | `port.member(bindings)`; the port is dropped only when every member the operation handles comes through the same port. Enum qualifiers are dropped in conditions when the type makes them unambiguous (`[command == autoUp]`). A label wraps at 28 characters, the condition on its own line. |
| Compact box | A state with **more than three** leaving arrows lists its leaving lines inside the box (`2c obstructed() → idle`) and draws only the numbers on the arrows. |
| Box width | The content width (name, entry, exit, reaction lines), at least 160 px and at least 24 px per leaving arrow; never widened for labels: labels go in staggered rows below the edge, or the box is compact. |
| Per-step action | The `if (true)` reaction is the box's last line: `step: travel = travel + 1`. |
| End of the operation | The final marker. |

**Not drawn:** dropped input (nothing is written for it, so nothing is drawn); the run mode (Timing shows it); a timer that has fired; the phase rule "timer before same-instant delivery" (hover on a timer label says it); self-loops (a reaction is a line in the box; a line that re-enters its own state is a back arrow to its own top edge).

### 2.2 The lock controller (section 0)

```text
 «operation» control : () returns void
   status.query() : publish status.report(locked, pulses)
 ■ power.off() ─────────────────────────────────────────────────────┐ (frame border)
               ●                                                    │
       [ var unlockNext = false ]  [ var lockNext = false ]         │
      ┌───────►┤                                                    │
      │  ╭─────▼─────────────────────╮                              │
      │  │ unlocked                  │                              │
      │  ╰─────┬─────────────────────╯                              │
      │        │ requests.request(lock) [lock]                      │
      │┌──────►┤                                                    │
      ││ ╭─────▼────────────────────────────────────╮               │
      ││ │ locking                                  │               │
      ││ │ entry: pulses = pulses + 1; …            │               │
      ││ │ exit:  send motor.lockMotor(idle)        │               │
      ││ │ 2 requests.request(lock) : unlockNext = …│               │
      ││ ╰─────┬────────────────────────────────────╯               │
      ││       │ 1 after 250ms                                      │
      ││ [ locked = true ]                                          │
      ││       ◇                                                    │
      ││       ├──[unlockNext]──────────┐                           │
      ││       │ [else]                 │                           │
      ││ ╭─────▼───────────────────╮    │                           │
      ││ │ isLocked                │    │                           │
      ││ ╰─────┬───────────────────╯    │                           │
      ││       │ requests.request(lock) [not lock]                  │
      ││       ⋄◄───────────────────────┘                           │
      ││ ╭─────▼────────────────────────────────────╮               │
      ││ │ unlocking                                │               │
      ││ │ entry: pulses = pulses + 1; …            │               │
      ││ │ exit:  send motor.lockMotor(idle)        │               │
      ││ │ 2 requests.request(lock) : lockNext = …  │               │
      ││ ╰─────┬────────────────────────────────────╯               │
      ││       │ 1 after 250ms                                      │
      ││ [ locked = false ]                                         │
      ││       ◇                                                    │
      │└──[lockNext]                                                │
      │        │ [else]                                             │
      └────────┘ to unlocked                                        │
         ╭──────────────────────────╮                               │
         │ report                   │◄──────────────────────────────┘
         │ entry: reportShutdown()  │
         ╰─────┬────────────────────╯
               ◉
```

The query reaction and the power-off exit appear once, in the frame. The pulse boxes show the stored request as a reaction line. Nothing says "dropped".

### 2.3 The owner's picture (section 1.4)

```text
 «operation» run : () returns void
                 ●
          [ var ok = false ]
       ╭─────────▼──────────╮
       │ state0             │
       │ entry: send …      │
       ╰─────────┬──────────╯
                 │ go(v)
             [ ok = v ]
                 ◇
          [ok] ╱   ╲ [else]
   ╭─────────▼──╮ ╭──▼──────────╮
   │ state2     │ │ state1      │
   │ entry: …   │ │ entry: …    │
   ╰─────┬──────╯ ╰──────┬──────╯
         │ after 10ms    │ retry()
         └──────►⋄◄──────┘
                 │
           [ process() ]
       ╭─────────▼──────────╮
       │ state4             │
       │ entry: report()    │
       ╰─────────┬──────────╯
                 ◉
```

Both members come through port `cmd`, so the labels drop the port.

### 2.4 The window lifter with parents (section 1.5)

Schematic: labels shortened, compact boxes list their exits inside.

```text
 «operation» control : () returns void
                          ●
             [ var start = manualUp ]
   ┌─────────────────────►┤        (one lane: the 22 arrows to idle join it)
   │  ╭───────────────────▼────────────────────────────────────╮
   │  │ idle                       entry: drive(stop)          │
   │  │ 1a request(command) [autoUp and oneTouchAllowed()]     │
   │  │ 1b request(command) [(manualUp or autoUp) and …]       │
   │  │ 1c request(command) [autoDown and oneTouchAllowed()]   │
   │  │ 1d request(command) [(manualDown or autoDown) and …]   │
   │  ╰────┬───────────┬───────────┬───────────┬──────────────╯
   │       │1a         │1b         │1c         │1d
   │  [start = autoUp] [start =    [start =    [start =
   │  [oneTouch… + 1]   manualUp]   autoDown]   manualDown]
   │       └──────────►⋄◄──────────┴───────────┘
   │  ╭────────────────▼──── moving ──────────────────────────────╮
   │  │ ╭──────────────▼──── driven ────────────────────────────╮ │
   │  │ │          ╭───▼──────╮                                 │ │
   │  │ │          │selecting │                                 │ │
   │  │ │          ╰───┬──────╯                                 │ │
   │  │ │              ◇                                        │ │
   │  │ │ [start == autoUp] [start == manualDown]               │ │
   │  │ │ [start == autoDown] [else]                            │ │
   │  │ │  manualUp ▸ autoUp ▸ manualDown ▸ autoDown (compact)  │ │
   │  │ │  pinch arrows → reversing (right gutter, one lane)    │ │
   │  │ ╰───┬───────────────────────────────────────────────────╯ │
   │  │     │ motionInhibited() → idle                            │
   │  │ ╭───▼──────────────── reversing ────────────────────────╮ │
   │  │ │ entry: drive(down)   (4 exits → idle)                 │ │
   │  │ ╰───────────────────────────────────────────────────────╯ │
   │  ╰──┬─────────────────────┬──────────────────────────────────╯
   │     │1a sensorFault()     │1b motionStalled()
   │     │               [ stalledStops + 1 ]
   └─────┴─────────────────────┘
```

- **Parent exits** leave the parent's bottom edge once; P2 drew `sensorFault` and `motionStalled` ten times.
- **Lanes:** all 22 arrows to `idle` join one left-gutter lane; the two pinch arrows join one right-gutter lane into `reversing`.

### 2.5 The mode manager (section 1.6)

```text
 «operation» modes : () returns void
 ■ ecu.shutdown() ──────────────────────────────────────────┐
                ●                                           │
   ┌───────────►┤  ◇ [true] into the loop                   │
   │  ╭─────────▼──────────────────╮                        │
   │  │ off                        │                        │
   │  │ entry: send mode(off)      │                        │
   │  ╰─────────┬──────────────────╯                        │
   │            │ key.ignitionOn()                          │
   │  ╭─────────▼───────────── powered ─────────────────╮   │
   │  │  ┌─────►┤                                       │   │
   │  │  │ ╭────▼──────────────╮                        │   │
   │  │  │ │ standby           │                        │   │
   │  │  │ ╰──┬──────────┬─────╯                        │   │
   │  │  │    │1a cmd.go │1b diag.enter() ─────────┐    │   │
   │  │  │ ╭──▼───────────────╮                    │    │   │
   │  │  │ │ running          │                    │    │   │
   │  │  │ │ exit: enable(f…) │                    │    │   │
   │  │  │ ╰──┬──────────┬────╯                    │    │   │
   │  │  ├────┘1a halt   │1b diag.enter()          │    │   │
   │  │  │ ╭─────────────▼────╮◄───────────────────┘    │   │
   │  │  │ │ diagnostic       │                         │   │
   │  │  │ ╰──┬───────────────╯                         │   │
   │  │  └────┘ diag.leave()                            │   │
   │  ╰──┬──────────────────────────────────────────────╯   │
   │     │ key.ignitionOff()                                │
   └─────┘                                                  ▼
                                              [ send status.mode(off) ]
                                                            ◉
```

The operation-level exit leaves the frame's border once and ends at the final marker with its block on the way.

### 2.6 The periodic controller (section 1.8)

```text
 «operation» step : () returns void          (Timing: on every 10ms, deadline 2ms)
             ●
   ┌────────►┤
   │ ╭───────▼───────────────────────────╮
   │ │ idle                              │
   │ │ entry: send motor.drive(stop)     │
   │ ╰───┬────────────────────┬──────────╯
   │     │1 [switch.position  │2 [switch.position == down
   │     │   == up and …]     │    and travel > 0] ──────────────┐
   │ ╭───▼───────────────────────────────╮                       │
   │ │ closing                           │                       │
   │ │ entry: send motor.drive(up)       │                       │
   │ │ step: travel = travel + 1         │                       │
   │ ╰───┬──────────────┬───────────┬────╯                       │
   │     │1 [sense.     │2 [switch… │3 after 8s                  │
   │     │ current > …] │  or …]    │                            │
   │     │              └───────────┴──► idle (left lane)        │
   │     └──► reversing (right lane)                             │
   │ ╭───────────────────────────────────╮◄──────────────────────┘
   │ │ opening                           │
   │ │ step: travel = travel - 1         │
   │ ╰───┬───────────────────────────────╯
   ├─────┘ [switch.position != down or travel == 0]
   │ ╭───────────────────────────────────╮
   │ │ reversing                         │
   │ │ step: if (travel > 0) …           │
   │ ╰───┬───────────────────────────────╯
   └─────┘ after 400ms
```

A periodic machine is drawn like a waiting one; Timing shows the run mode.

### 2.7 Sequence and Timing

- **Sequence:** a state is a state invariant on the operation's lifeline where the flow waits; a parent is an invariant region around its substates' invariants. Leaving lines are the messages that end an invariant; reactions are messages that do not; a condition that is taken is a guard note `[c]` on the invariant's end.
- **Timing, waiting machines:** a state is an interval on the component's track from arrival to exit; parents are a band above their substates; between states the track shows plain flow.
- **Timing, periodic machines:** the release grid as ticks (a skipped release, WP7, as a hollow tick); the state band changes only at ticks; the step that took a line is marked on its tick.

### 2.8 Editing gestures

Every gesture is one whole-workspace edit, validated before it is applied, with a dry-run preview (`swaml/previewEdit`) that lists every line number and fall-through target that changes.

| Gesture | Text edit | How order stays honest |
| --- | --- | --- |
| Add a state as a step (creation card: name, first leaving line) | Inserts `state X { <event> exit; }` at the drop position. | The preview names the statement whose fall-through target changes. |
| Add an exit | Appends a leaving line after the last line of its kind (an input at the end of the input lines). | The preview shows the new number and renumbered arrows. |
| Add a reaction (box "+ reaction") | Writes `on receive m(x) { }`, `after D { }` or `if (c) { }`. | The preview shows its number. |
| Retarget an exit (drag its end) | Rewrites the head: `to S`, or `exit` when dropped on the merge below the box. Illegal targets are refused with SIF-D04's message. | Only that head changes. |
| Reorder lines | Moves the line; the input lines move as one unit. | The preview says "priority change: 2 ↔ 3". |
| Move a state | Moves the statement; every line whose fall-through target would change gets an explicit `to`. | Behaviour unchanged by construction. |
| Delete a state | Removes it; incoming jumps are retargeted to a state the user picks, or the edit is refused. | The preview lists retargeted arrows. |
| Group into a parent (consecutive states of one list) | Wraps them in `state P { … }`. Refused when a jump from outside targets a state other than the first (it would enter the parent); the card offers a named step and a decision at the top instead. | Grouping alone changes no behaviour apart from the `state` observation of `P`; the preview says so. |
| Move a common exit to the parent | Replaces the identical line (event, condition, head, block) in every substate by one line on the parent; offered only when every substate has it. | The preview says that the line is now tried before the substates' own lines. |
| Add a per-step action (periodic machines only) | Writes `if (true) { }` as the state's last line. | Refused in an `on start` operation (SIF-D13). |
| Unwrap a named step | Back to plain steps; offered only when the state is no jump target. | — |

### 2.9 One logical exit, one spelling

P2 found the same rule written two ways: `on receive crash.crashUnlock() to crashUnlocking;` in four lock states but `… exit;` in the state that happens to precede `crashUnlocking`.

**Rule.** A *logical exit* is a set of leaving lines in one operation with the same event, condition, block text and target state. When a logical exit occurs in two or more states and at least one of them needs `to T`, every occurrence is written `to T`, also where `T` is the next statement. `to T` to the next statement is legal and drawn exactly as `exit`, so the drawing does not change.
- **Migrator:** applies the rule (7, step 4).
- **Formatter:** never changes a head; it offers the code action "spell like the other states" on an `exit` that belongs to a logical exit spelled `to T` elsewhere.
- **No diagnostic:** both spellings are correct.

## 3. Meaning: rules of the execution contract

The meaning is defined natively by the rules below, as additions to chapter 6 of the specification.

**Simplicity checks applied.** For each rule the simpler alternative was tried first; the rule below is the simplest found that is sound and keeps 2.2 results:
- one way to leave (a head word), one way to stay (no head word), no keep, no ignore;
- one word for conditions, one condition semantics (level) for both run modes;
- one priority order (outer level first, then written order) with no per-member exception;
- one input rule for an operation with states (drop while waiting) and no other waiting point in it (no plain receive statements);
- the per-step action is an ordinary condition, not a construct;
- taking input is always a wait, also when the input is already there (no exception for queued input).

**Terms.**
- An **operation with states** is an operation whose body contains a state statement.
- The **levels** of a state S are: the operation (level 0), each parent that encloses S from the outermost inwards, and S itself.
- A **waiting state** is a state without inner flow that has at least one line other than `on entry`/`on exit`. A state without such lines and without inner flow is a **named step**. A state with inner flow is a **parent**.
- A member is **owned** by the operation when some `on receive` line of the operation, at any level, names it. A member is **handled** at waiting state S when some level of S has an `on receive` line on it.
- A **choice** (selection) of a waiting state S takes at most one line among the lines of all levels of S.

### 3.1 Which operations may contain states (B2)

**Rule SIF-S01.** An operation with states:
- is directly owned by a component definition, has no parameters and returns `void`;
- has exactly one effective schedule entry in every occurrence of its component, which is either `on start` (the operation **waits**) or `on every P`, with or without `deadline` and a WP7 release guard, never `concurrent` (the operation is **periodic**);
- is never called: not by an operation, a helper, a guard, a schedule argument or a case script;
- contains no interrupt region and no plain receive statement; its callees contain no states (follows from "never called").

Case scripts contain no states; they drive an operation with states only through actor ports, as in 2.2.

**Other entry kinds are errors with a message** (SIF-D15):
- `on receive x(…) op();`: "`op` contains states, so it keeps its state between releases and can only be released by one `on start` or one `on every` entry. To react to `x`, write `on receive x(…)` as a line in its states."
- `after pred op();`: "… To start after `pred`, release `op` on start and wait in its first state for a condition that `pred` sets."
- `on call p.m(…) op();`: "… An operation with states cannot answer calls; answer in a plain operation and let it set an attribute that a condition reads."
- No entry, two entries, `concurrent`: "… needs exactly one `on start` or one `on every` entry, not concurrent."

**Why not wider.** A called operation with states needs per-activation state identity in the trace subject, `machines`, Timing, Flow View overlays and a rule for several activations waiting on one member (review B2). Parents cover reuse inside one operation. In the last release nothing is widened that is not fully defined.

**Why no plain receive statements.** In an operation with states, `on receive m(x) { … }` at the top of a body is a reaction that stays (1.1); in the flow it would mean "wait once and continue", with another input rule. One construct per meaning: a one-exit state replaces it (`state waitGo { on receive cmd.go(v) exit { … } }`). Plain operations keep their receive statements unchanged.

**Consequences.** There is exactly one current state chain per occurrence, so `machines["c.op"]`, the trace subject and the Timing track stay well defined. An operation with states may be the predecessor of `after` dependents: they are released when it completes (waiting) or after each step (periodic).

### 3.2 Reaching a state (SIF-R01)

When the flow reaches a state statement X at time t:
1. record a `state` observation (subject `c.op`, `state` the name, `source` the statement, `trigger` the line that led here when there was one);
2. set X's timer start to t;
3. run `on entry` (it may suspend; input arriving meanwhile stays queued);
4. evaluate X's computed `after` durations once (WP4-R02);
5. then, by kind of X:
   - **parent:** continue with the first statement of its inner flow (always a state);
   - **named step:** run `on exit`, continue with the next statement;
   - **waiting state, waiting mode:** make a choice (3.4);
   - **waiting state, periodic mode:** end the step (3.9).

### 3.3 Leaving and staying, across levels (SIF-R05, SIF-R06)

| Case | What runs, in order |
| --- | --- |
| Reaction (any level) | `state` observation with `stay: true` and the line as `source` (an empty reaction records only its `discardInput`, 3.8); the block. No exit, no entry, every timer keeps its start; a reaction timer that fired is disarmed for the rest of its level's entry. Then a new choice (waiting mode) or the end of the step (periodic mode). |
| `exit` of a waiting state S, next statement in the same list | S's timers invalidated, S's `on exit`, the block, the next statement. |
| `exit` of S, the last statement of parent P's inner flow | S's `on exit`, the block; the inner flow has ended, so P is left as a named step is: P's `on exit`, then P's next statement. |
| `to T` from S, T in the same list | S's `on exit`, the block, T's arrival. |
| `to T` from S, T outside one or more parents | `on exit` of S and of every parent left, innermost first; the block (in the scope where the line is written); the locals of the lists left end; T's arrival. |
| Line of parent P with `exit` | `on exit` of the current waiting state and of every parent up to and including P, innermost first; the block; P's next statement. |
| Line of P with `to T` | The same exits; the block; T's arrival. `to P` re-enters P: its entry runs again and its inner flow restarts at its first state. |
| Operation-level `exit` | Every active `on exit`, innermost first; the block; the operation completes. |
| Operation-level `to T` (T in the operation body) | Every active `on exit`, innermost first; the block; T's arrival. |
| Statement `to T;` in P's inner flow, T outside P | The parents left run their `on exit`, innermost first; T's arrival. |
| `return;` in P's inner flow | The active parents run their `on exit`, innermost first; the operation completes. |
| End of the operation body | The operation completes. |

- **Leaving adds no scheduling point** (P1 defect D3). Exit actions, the block and the next statement or target run in the same segment, without releasing the lock, unless a block suspends.
- **Blocks** may suspend (`wait`, requests, suspending calls), as 2.2 entry actions and effects do; input that arrives meanwhile stays queued. Blocks contain no state statement, receive statement, `to` or `return`.
- **Parent lines do not preempt.** They are tried only when a waiting state inside chooses. While the inner flow runs plain steps, blocks or a suspended call, nothing is tried; a parent timer that expires meanwhile is ready at the next choice. If the inner flow reaches its end first, the parent is left without taking it. A step that must be interruptible is written as a state.

### 3.4 Choosing (SIF-R02 to SIF-R04; B1, B4, B8)

A choice of waiting state S at time t **walks the levels, the operation first, then each parent from the outermost inwards, then S**; within a level, its lines in written order, the level's `on receive` lines forming **one input group** at the position of the first of them (they are written contiguously, SIF-S06). The first ready entry is taken:
- **A timer** `after D [if (g)]` of level L is ready when it is armed (a reaction timer that fired is disarmed for the rest of L's entry), t ≥ L's timer start + D, and g, if present, holds now.
- **A condition** `if (c)` is ready when c holds now.
- **The input group of level L** is ready when a queued message exists whose member's **first handling level** (the outermost level of S with an `on receive` line on it) is L. The message served is the one **delivered first** among those (smallest delivery event: time, phase, insertion ordinal), each queue's head given by its ordering policy. Every line on that member is tried in walk order (L first, then the inner levels, each in written order), binding the payload and evaluating its condition; the first whose condition holds is taken. If none holds, the message is consumed with `discardInput` reason `noEnabledTransition` (the 2.2 reason; for an attribute member the latest value is lost, so read attributes as sampled reads when it must survive) and the group is examined again.

If nothing is ready, S waits without the component lock (waiting mode) or the step ends (periodic mode).

**A choice is made at the event that ends a wait** (SIF-R03, SIF-R04). While a state waits, the first event that makes one of its lines ready ends the wait, and the choice (a full walk) is made at that event; the state no longer waits after it, and messages delivered later stay queued for the next wait.

**Taking input is always a wait** (P1 clarification AY). When a walk outside a wait (on arrival, after a reaction) would take the input group, the state waits for the input, as a 2.2 machine does: since the message is already queued, the wait ends in zero time, at a wait-end event of the same instant (phase 2, next insertion ordinal), and the choice is made at that event. The activation releases the component lock meanwhile, so work of that instant ordered before the wait-end event runs in between: for example a newer delivery that overflows a capacity-1 `dropOldest` route. (The exact ordinal of the wait-end event is to be confirmed against P1's implementation of AY.) Measured by P1: without this, fixture wp6 s11's route stops overflowing (19 order-only trace differences), and on a rejecting route a verdict could change; with it, 0 differences. The simpler-looking alternative, taking queued input without releasing the lock, is an exception for "input already there" and changes 2.2 results; it is rejected.

**When choices happen within an instant** (SIF-R04; B1). The contract orders the events of one instant by phase, then insertion ordinal: deadlines and request timeouts (phase 0), receive timeouts and state timers (phase 1), deliveries, sample-cell updates, wait ends and releases (phase 2), dispatch and continuation (phase 4). A waiting state chooses at the **event that first makes one of its lines ready**: its timer at phase 1, a delivery of a handled member or a cell update at phase 2, an attribute-write wake at the writer's unlock in phase 4. The choice is a full walk, so it may take an earlier-written line that is also ready, for example a guarded timer whose guard now holds at another timer's expiry (P1 defect D8). Consequences:
- a timer that expires at t is taken before a message delivered at t and before a condition that becomes true at t (the 2.2 rule "receive timeout wins a tie with delivery", extended);
- written order decides wherever several lines are ready at one choice: on arrival, after a reaction, and at an event that makes two lines ready.

**Why the outer level first** (owner decision DA, recommended):
- **It is what the parent says.** "What is written on the parent applies to everything inside": a parent's stop or an operation-level shutdown cannot be overridden by a substate by accident. A substate line on the same member as an unguarded parent line is dead (SIF-D06 warns); with a guarded parent line, the substate gets the messages the parent's condition rejects.
- **It is safe.** A fault condition on a parent wins over a stale input queued for the substate (B4).
- **It is Stateflow's rule** (outer transitions are tested before inner ones), and the drawing reads that way: a frame's arrows come before anything inside the frame.
- **The cost:** a substate cannot shield itself from a parent's line. Where the 2.2 machine has an exception (`obstructed` not handled in `autoUp`), the line stays in the states that have it, or the parents are split (1.5).
- **Alternatives rejected for simplicity:** inner first (UML) lets substate input beat a parent's safety condition and makes the frame's arrows not the first; "outer first, but inner first per member" needs a second rule.

**Delivery order** (B4): with message `a` offered at 0 with 5 ms latency and `b` offered at 1 ms without latency, `b` is delivered first and served first. Within one queue, its ordering policy decides. This is the one measured change against 2.2 (r10, section 6).

### 3.5 Conditions (SIF-R13 to SIF-R16; B5)

**One rule for both run modes:** *a condition line is ready when its condition holds at the moment the state chooses.* What differs between the modes is only when a state chooses: a waiting machine chooses on arrival, after a reaction and at every event that can make a line ready (3.4); a periodic machine chooses once per release.

**Why level and not "fires once each time it becomes true" (edge).** The edge rule is not needed for any case, and it breaks two:

| Case | Level (chosen) | Edge (rejected) |
| --- | --- | --- |
| Drain loop `if (backlog > 0) { take(); }` | Takes one item per choice and chooses again at once until `backlog == 0`. | Takes one item, then waits for a new rising edge that never comes while items remain. |
| Condition already true on arrival (`if (fault) to safe;`) | Taken at the arrival choice, before queued input written after it. | Not taken until `fault` falls and rises again: unsafe. |
| Value that becomes true and false again between two choices | Missed: a condition looks at values; a pulse that must not be missed is an event. | Also missed unless latched, which adds hidden state. |
| `if (alarm) { publish siren.on(); }` (the one case that suggests edge) | The block does not change `alarm`, so the line would repeat at once: a static warning (SIF-D14) and `StateLoop` at run time. Written as intended with a state (`if (alarm) to sounding;`) or a flag (`if (alarm and not sounded) { … sounded = true; }`). | Publishes once per rising edge. |

The alarm case is the only one where edge would save a line; it is not worth a second meaning for `if`.

**What a condition may read (SIF-S05).** A `bool` expression that is pure or reads state: attributes of the executing occurrence, whoever writes them; sampled port members (WP6-S01); locals visible at the line; constants; calls of operations that are pure or read state. Not `now()`, not a non-sampled port member, not an input binding. The same holds for the condition of a timer line; the condition of an input line may also read its bindings. (Revision 2's narrower timer-guard rule is gone: P1 showed that without wakes a guarded timer on an attribute written by another operation never fires.)

**Read set (static, per effective occurrence).** The attributes of the occurrence and the sample cells (port occurrence, member) that the condition reads, directly or through called operations, resolved in the occurrence after specialization and redefinition. Names follow the scope rules (a local or binding with an attribute's or a port's name hides it, `localVisible`). Locals are not in the read set: only the operation itself writes them, and each of its writes is followed by a choice or the end of a step. An implementation may over-approximate the read set: an extra wake finds every condition false again (each was false at the state's last choice and evaluation is pure).

**Wakes (SIF-R14).** A waiting state with a condition (on a condition line or a timer line) at some level chooses again when, at time t:
- **an attribute in a read set is written by another activation of the same occurrence**, at the end of that activation's segment (its unlock at suspension, completion or failure). Case-script calls of the subject's operations and white-box helper calls, which run in the script's activation (6.7), end their segment for this rule when the call returns to the script: a test that calls `setTemp(40)` wakes `if (temp > 30) …`;
- **a sample cell in a read set is updated** (WP6-R02), at its delivery event.

**The zero-time loop rule (SIF-R15), replacing `CompletionLoop`.** A condition line that is taken is a step that takes no time. The contract violation **`StateLoop`** is raised when a condition line is taken in a configuration equal to the configuration at an earlier take of the same line in the same instant, with nothing but this occurrence's own steps processed between the two takes. The configuration is the occurrence's attributes, sample cells and input queues and, for each of its activations, its position (statement and level chain), locals and timer arming. Equal configurations with nothing external in between repeat forever, so the rule never stops a loop that would end. It stops the run and bypasses `try`, like the other contract violations.
- **Allowed:** `if (backlog > 0) { take(); }`, a retry counter `if (tries < 3) to connect { tries = tries + 1; }`, a four-step handshake between two operations of one occurrence.
- **Stopped:** `if (alarm) { publish siren.on(); }`, the toggling ping-pong `n = 1 - n` between two operations.
- **Not stopped:** loops that change the configuration every time (a counter that grows). They end at the step limit, like a plain `while (true)` loop.

**Periodic machines** check conditions once per step; nothing wakes them and `StateLoop` cannot occur.

### 3.6 Parents (SIF-R11, SIF-R12; B8)

- **A parent** is a state whose lines are followed by a state statement: from that state on, the body is its inner flow. An inner flow therefore starts with a state; a decision on which substate to start with follows a named step (1.5).
- **Classification is static.** A parent line's head says whether it leaves (`exit`, `to`) or stays (block only), so nothing must run before the decision. Since parent lines are tried only when a waiting state inside chooses, no inner segment is ever cancelled half-way.
- **Order:** outer level first, written order within a level (3.4).
- **Entry:** a parent is entered only at its top; no jump enters it from outside; `to P` targets the parent itself.
- **Timers of a parent** count from the parent's arrival and keep running while its substates change.
- **Leaving:** exits run innermost first, then the block, then the target (3.3).
- **Inputs:** a member handled at any level of S is handled at S; every other owned member is dropped while S waits (3.8).
- **Plain steps and locals of the inner flow:** a parent line is taken only while a substate waits, so no plain step is interrupted. Locals declared in a list that is left end after the block; loops in it end.
- **Periodic machines:** a step walks the same levels; at most one line of any level is taken. A per-step action belongs to a state without inner flow: `if (true) { … }` on a parent would be taken before anything inside it (SIF-D13).
- **Nesting depth:** no limit. Flow View indents each level; three levels are sketched here.

### 3.7 Jumps and locals (SIF-R07; I6)

- **Unwinding.** `to S` ends every block, loop and parent between the jump and the statement list that contains S. A loop ended this way (`while`, `until`, `for`, `for in`, with or without `n times`) does not run its condition, update or remaining iterations; its limit counter and locals end. Parents run their exit actions (3.3).
- **Locals.** A local lives from its declaration to the end of its statement list. A backward jump that passes a declaration again re-runs it. Locals declared before the target keep their values.
- **A forward jump over a declaration** is an error (SIF-D04) when the local is used at or after the target.
- **Single entry, structured exits.** No construct (state, parent, loop, branch) is entered except at its top. A construct has one normal exit, its bottom; a restricted jump leaves enclosing constructs by unwinding, as `return` does in structured languages.

### 3.8 Inputs (SIF-R08; B6)

There is no keep feature and no word for one. An operation with states drops what its current state does not handle, as a 2.2 machine does, and only while that state waits (P1 clarification DW).

| Where | What happens to input |
| --- | --- |
| Plain operation (no state) | Unchanged 2.2: a receive statement exclusively owns its members; input received before it waits stays queued, also after the operation ended. |
| Interrupt region (plain operations only) | Unchanged 2.2: discarded and observed while the region is inactive. |
| Operation with states, while it runs plain steps, entry, exit or line blocks, or a suspended call | Every message stays queued under its route policy (capacity, overflow, ordering, `maxAge`). Nothing is consumed. |
| Operation with states, **when a waiting state S begins to wait** (a choice found nothing ready, or the walk reached the input group and the state waits for it, zero time included) | Queued messages of owned members not handled at S are consumed in delivery order (`discardInput`, reason `inactiveOwner`, the 2.2 reason). |
| Operation with states, **while S waits** | A delivered message of an owned member not handled at S is consumed on arrival (`inactiveOwner`); one of a handled member ends the wait and the choice is made. From that event on S no longer waits, and later messages stay queued. |
| Operation with states, a choice that takes a timer or a condition at once | Nothing is dropped: the queued input stays for the next state that waits. |
| Operation with states after it completed (waiting mode) | Queued messages of its members are discarded and later deliveries are discarded on arrival (`inactiveOwner`), as after a 2.2 final state. |
| Periodic operation | Between steps, the current waiting state waits: at the end of each step it drops queued unhandled messages, and unhandled deliveries are dropped on arrival. Handled messages stay queued for the next step's choice. A skipped release (WP7) changes nothing. A periodic operation never completes for good (3.9). |

- **Why only while waiting (measured).** In fixture r5, state A's entry waits 5 ms; A's 2 ms timer has elapsed when the entry ends; messages `y` and `go` arrived meanwhile and are handled by the next state B. 2.2 takes the timer at once and keeps `y` and `go` for B. Dropping at every choice would drop them: P1 measured that this changes r5's final store.
- **A message that arrives in plain flow** is decided by the next state that waits: taken if handled there at any level, otherwise dropped. There is no other kind of waiting point in an operation with states (3.1).
- **Members the operation does not own** (no `on receive` line names them) are untouched.
- **Remembering an input** that arrives while the operation is busy is written explicitly: a reaction that stores what matters, and ordinary flow that acts on it (1.3). It keeps what the reaction stores (in the lock controller only the latest request); a model that must keep several writes a counter or an array.
- **An empty reaction** `on receive m(x) { }` consumes the message within the choice and records `discardInput` with reason `inactiveOwner` and `source` the line; since its block is empty it needs no other observation.
- **Requests and calls never reach a state.** `on receive` lines take events and attributes only; requests are answered by `on call` entries, which an operation with states cannot have (3.1). No dropped input leaves a sender waiting for a reply, so no hint for it is needed.

### 3.9 Periodic machines (SIF-R17 to SIF-R22; I7)

An operation with states released by one `on every P` entry is **periodic**. Each release whose guard (if any) holds is one **step**, a fresh activation with its own deadline:
1. **No position** (the first release, or the operation completed in the previous step): run from the first statement until the flow reaches a waiting state (after the entry actions of every level entered) or the end of the operation. Return.
2. **Otherwise** make one choice at the current waiting state (3.4). A reaction runs its block; a leaving line runs exits, block and flow until the next waiting state's arrival or the end of the operation. Return. If nothing is ready, return.

What follows:
- **One line per step.** A reaction ends the step; the next choice is at the next release.
- **The per-step action** is `if (true) { … }` written last; it is ready exactly when nothing before it is (no separate case in the rule).
- **Arrival ends the step.** Entry actions run in the step that takes the line, so an actuator command in `on entry` has no one-period latency (review I7). The step that arrives does not run the per-step action; SIF-D17 warns when a per-step action sends a member that the state's entry actions do not.
- **The first release** is at P (the 2.2 grid releases every P at kP, k ≥ 1). Plain steps before the first state run in it.
- **Timers** count in time from the arrival of their level and are checked at steps: `after D` is taken at the first step at or after arrival + D, so with arrival at a release the delay is rounded up to a multiple of P (SIF-D16 warns when D is not a multiple).
- **Input** delivered before the step's choice (earlier instants, or the release instant at a smaller phase or ordinal) is visible; at most one message is taken per step; handled messages wait for later steps under the route policy (SIF-D02 covers a rejecting route that can overflow within one period).
- **Conditions** are checked at each choice, reading live sample cells (first read in the segment, WP6-R03) and attributes.
- **Deadline** per release (default the period) covers its step. A step that suspends may miss it; the next release waits for the serial lock and is released on the grid, its deadline measured from release (2.2 backlog rule).
- **`concurrent`** is rejected: a concurrent activation reads a snapshot and may overlap the previous step, which writes the position.
- **Release guards** (WP7): a false guard is a `skip`: no choice, no per-step action; state, timer starts and queues unchanged; timers keep counting in time, so an `after` that became due is taken at the next step that runs. A skip counts as a completion for `after` successors (WP7-R03).
- **Completion:** a step that reaches the end of the operation (or `return;`, or an operation-level `exit`) completes and clears the position; the next release starts again at the first statement, as a plain `on every` operation does. Input of its members is not discarded as `inactiveOwner` after such a completion; it waits for the next step.
- **`after` successors** are released after each step. **`machines["c.op"]`** is the current waiting state between steps.

**Other entry kinds** are errors (3.1). A step per received message would duplicate the input group with a second, invisible queue; a step per predecessor completion would make a machine whose rate is another operation's, which a condition on an attribute expresses without a special case.

### 3.10 Run to completion, determinism, termination (SIF-R09)

- **Between choices** no other line of the operation is taken; input arriving meanwhile waits. The component lock is released only where 2.2 releases it: while a state waits (including the zero-time wait for queued input, 3.4) and while a block or step suspends. Other activations of the component may run then.
- **Determinism.** A choice depends only on levels, written order, delivery order, the phase rule and condition values. No choice depends on queue creation or container iteration order.
- **Termination.** A reaction consumes one message, fires one timer once per entry, or takes one condition; timers are positive. A cycle of jumps that passes no waiting state and nothing that can suspend is a static error (SIF-D07). A zero-time condition loop is `StateLoop` when the configuration repeats (3.5); otherwise it ends at the step limit.

### 3.11 Trace and results (SIF-T01 to SIF-T06)

- **`state`** at each arrival, `source` the state statement, with `trigger` the line that led there (absent after plain flow); with `stay: true` and `source` the line for a reaction with a non-empty block.
- **`discardInput`** keeps the 2.2 reasons: `inactiveOwner` for an owned member not handled while a state waits (also for an empty reaction, with `source` the line) and after completion; `noEnabledTransition` when no condition holds. WP7's `releaseGuard` is unchanged.
- **`violation`** with `code: 'StateLoop'`, subject the operation, `source` the condition line; it fails a case like the other contract violations.
- **No** `defer`, `discardTimer` or `CompletionLoop` (they never ship).
- **Unchanged:** `receiveWait` when a state waits, `timer` for computed durations (WP4-T01), deliveries, writes, `skip` (WP7).
- **Wakes** add no observation.
- **`machines["c.op"]`** is the name of the innermost state last entered (names are unique within an operation, SIF-S02).

## 4. Rules

IDs: SIF (states in flow). G grammar, S static, R runtime, D diagnostic, T trace.

### 4.1 Grammar delta (SIF-G01, text only)

```text
OperationBody: '{' Documentation? Executable* OperationLine* Statement* '}';
OperationLine: ReceiveEvent Head | TimerEvent Head;      // the operation level has no if lines (DK)
State:     'state' Name '{' Documentation? Line* (State Statement*)? '}';
Line:      'on' ('entry' | 'exit') Block
         | (ReceiveEvent | TimerEvent | ConditionEvent) Head;
ReceiveEvent:   'on' 'receive' MemberPath '(' (Name (',' Name)*)? ')' Condition?;
TimerEvent:     'after' (Duration | '(' Expression ')') Condition?;
ConditionEvent: Condition;
Condition: 'if' '(' Expression ')';
Head:      Block                                   // reaction: the state stays
         | 'exit' (';' | Block)                    // leave, continue with the next statement
         | 'to' Name (';' | Block);                // leave for state Name
Statement: … | State | Jump;                       // If unchanged: the decision in the flow
Jump:      'to' Name ';';
Removed:   the 'initial' Name ';' State+ body alternative, 'final', Transition, Deferral ('defer'),
           and 'when' in every position (receive branch guards are respelled 'if').
```

**Parse notes.**
- **A state body has lines, then optionally an inner flow that starts with `state`.** Inside a state body, an `if` before the first inner state is always a line; after it, always the flow decision. The parser never has to guess.
- **At the operation level** an `if` is always the flow decision; operation-level lines are input and timer lines only (decision DK). `after` cannot start a statement, so an `after` line is unambiguous. `on receive m(x) { … }` before the first statement has the same tokens as a 2.2 receive statement: the parser produces one node kind for both, and it is a line exactly when the operation contains a state (SIF-S11); in a plain operation it stays a receive statement with its 2.2 meaning.
- **Guards in plain receive statements** are respelled from `when (g)` to `if (g)` by the migrator (`on receive m(x) if (g) { … } or …`); their meaning is unchanged.

### 4.2 Static rules

| ID | Rule |
| --- | --- |
| SIF-S01 | Which operations may contain states (3.1). Case scripts contain no states. |
| SIF-S02 | A state has at most one `on entry` and one `on exit`. State names are unique within an operation. |
| SIF-S03 | A line head is a block, `exit` or `to S`; a bare `;` after an event is an error: "say what `{event}` does: `{ }` to take it and stay, `exit;` to leave, `to S;` to go to S". |
| SIF-S04 | Several lines on one member, several timers and several conditions are allowed at one level; each line has its own bindings. |
| SIF-S05 | Conditions are `bool` and pure or read state; they read attributes, sampled members, visible locals, constants, and (input lines only) their bindings; not `now()`. |
| SIF-S06 | The `on receive` lines of one level are written contiguously. Quick-fix: move them together, previewed as a priority change. |
| SIF-S07 | `to S`: S is a state of the same operation in the statement list that contains the jump (for a line: the list that contains its state; for an operation-level line: the operation body), or in an enclosing list; never inside a branch, loop body or parent that does not contain the jump. A line of parent P may target P. The statement `to S;` ends a statement list of the flow (an `if` branch or loop body included); after `to` or `return`, only a state that is a jump target may follow. |
| SIF-S08 | Entry, exit and line blocks contain no state, receive statement, `to` or `return`. |
| SIF-S09 | A parent's inner flow starts with a state (grammar). |
| SIF-S10 | Lines are written before the inner flow of their state, and before the first statement of the operation body. |
| SIF-S11 | Operation-level lines are allowed only in an operation that contains a state; they are input and timer lines. |
| SIF-S12 | An operation with states contains no plain receive statement and no interrupt region. |

### 4.3 Runtime rules

| ID | Rule |
| --- | --- |
| SIF-R01 | Reaching a state: observation, timer start, entry, computed timers, then by kind (3.2). |
| SIF-R02 | Choice: walk the levels outer first, written order within a level, input lines as one group; the first ready entry is taken (3.4). |
| SIF-R03 | Input: first-delivered message among members whose first handling level the group is; its lines in walk order; none holds: consumed (`noEnabledTransition`). Taking input is a wait, zero time when the input is queued; the walk is made again on resumption. |
| SIF-R04 | Phase: a waiting state chooses at the event that first makes a line ready (timer phase 1; delivery and cell update phase 2; write wake phase 4). |
| SIF-R05 | Reaction: block, no exit or entry, timer starts unchanged, a fired reaction timer disarmed for its level's entry; then a new choice (waiting) or the end of the step (periodic). |
| SIF-R06 | Leaving: exits innermost first up to the level left, the block, then the target or the next statement, in the same segment (3.3). |
| SIF-R07 | Jumps: unwinding of blocks, loops and parents; locals re-initialised on backward passes (3.7). |
| SIF-R08 | Inputs: dropped only while a state waits; the regimes of 3.8. |
| SIF-R09 | Run to completion between choices; the lock is released only while waiting or suspended (3.10). |
| SIF-R10 | `machines` holds the innermost state last entered. |
| SIF-R11 | Parents: entered at the top, inner flow from its first state, timers from the parent's arrival, lines tried only when a state inside chooses (3.6). |
| SIF-R12 | Completion (waiting mode): end of the body, `return` or operation-level `exit` completes the operation once; then the last regime of 3.8; `after` dependents are released. |
| SIF-R13 | Conditions: ready when they hold at the choice (level), in both run modes. |
| SIF-R14 | Wakes: an attribute write by another activation of the occurrence (at its segment end; a borrowed script or helper call at its return) or a cell update in a read set makes the waiting state choose. |
| SIF-R15 | `StateLoop`: a condition line taken twice in an equal configuration in one instant with only this occurrence's steps between. |
| SIF-R16 | A false condition on a timer line consumes nothing; it is checked again at the next choice. |
| SIF-R17 | Periodic step: no position → flow to the first waiting state; otherwise one choice, at most one line, flow to the next arrival (3.9). |
| SIF-R18 | Periodic timers: measured in time from the level's arrival, checked at steps. |
| SIF-R19 | Periodic input: visible when delivered before the step's choice; at most one taken per step; unhandled input dropped while the state waits between steps. |
| SIF-R20 | Periodic deadline, backlog and release guard: per release; a skip makes no choice. |
| SIF-R21 | Periodic completion clears the position; the next release starts at the first statement. |
| SIF-R22 | Periodic operations are never concurrent; steps of one occurrence never overlap. |

### 4.4 Diagnostics

| ID | Code | Rule and message shape |
| --- | --- | --- |
| SIF-D02 | SW2018, warning | Periodic machine: an event member whose effective route policy rejects on overflow and whose queue can receive more messages in one period than its capacity: `{member} can arrive faster than {op} takes it (one per {period}); its queue can fill and make the sender fail.` |
| SIF-D03 | warning | An `on receive` line on a member that no connection delivers to this occurrence. |
| SIF-D04 | SW2008 | Jump rule violations (SIF-S07), including a forward jump over a used declaration: `` `to c` skips the declaration of `x`, which `c` uses. Declare `x` before the jump. `` |
| SIF-D05 | warning | Waiting mode, in an operation that contains a back jump or a loop around states: a leaving line whose fall-through path reaches the end of the operation without passing another waiting state: `{state} can fall through to the end of {op}; afterwards its inputs are discarded. Jump back, or end on purpose with return;.` |
| SIF-D06 | warning | Dead line: a line after an unguarded line on the same member at the same or an outer level (walk order); an unguarded leaving timer after an unguarded leaving timer of smaller or equal constant duration at the same level; any line after `if (true)` at the same level. |
| SIF-D07 | SW2008 | A cycle of jumps and fall-through that passes no waiting state and nothing that can suspend. |
| SIF-D08 | warning | Unreachable statement or state. |
| SIF-D11 | SW2017, warning | Condition that nothing can change while its state waits: its read set has no attribute that another executable of the component or a case script can write, no sample cell, and no reaction of its levels writes a local it reads: `if ({c}) in {state} reads nothing that can change while {state} waits; it is only checked when {state} is reached.` Not reported for a condition that folds to true or false, or in a periodic machine. |
| SIF-D12 | SW2017, warning | Condition that folds to false in its definition (WP6-D10's exemption for redefined constants kept): `if ({c}) in {state} is always false; it is never taken.` |
| SIF-D13 | SW2008 | `if (true)` with a block head in an operation released `on start` (a certain `StateLoop`), or on a parent: `if (true) { … } is a per-step action; it needs an on every release and belongs to a state without inner flow.` |
| SIF-D14 | warning | Waiting mode: a condition reaction whose block writes nothing its condition reads: `if ({c}) { … } in {state} does not change {c}; it repeats at once and stops with StateLoop.` |
| SIF-D15 | SW2008 | Operation-kind violations of SIF-S01, with the messages of 3.1. |
| SIF-D16 | warning | Periodic machine: `after D` whose constant value is not a multiple of the period: `after {D} in {state} is checked every {P}; it is taken after {rounded}.` |
| SIF-D17 | warning | Periodic machine: a per-step action that sends or publishes a member that the state's entry actions do not: `The step that reaches {state} does not run its per-step action; {member} is first sent one period later. Send it in on entry too.` |
| SIF-D18 | warning | A parent whose lines can never be taken, because nothing inside it waits. |
| SIF-D19 | warning | A waiting state that no line of any of its levels can leave: `{op} stays in {state} for good once it gets there.` |

Revision 2's SIF-D01 (mandatory dispositions), SIF-D09 (stale kept input) and SIF-D10 (redundant override) are withdrawn with `keep` and `ignore`. No other input diagnostic is needed: unhandled input is dropped as in 2.2, and requests cannot reach a state (3.8).

### 4.5 Trace

| ID | Observation |
| --- | --- |
| SIF-T01 | `state` at arrival (`source` the state statement, `trigger` when entered by a line). |
| SIF-T02 | `state` with `stay: true` for a reaction with a non-empty block (`source` the line). |
| SIF-T03 | `discardInput` with the 2.2 reasons `inactiveOwner` (unhandled while waiting, empty reaction, after completion) and `noEnabledTransition` (no condition holds). |
| SIF-T04 | `violation` `StateLoop` (subject the operation, `source` the condition line). |
| SIF-T05 | `timer` (WP4-T01) for computed durations, `subject` the operation. |
| SIF-T06 | No `defer`, `discardTimer` or `CompletionLoop`. |

### 4.6 The keyword set of the behaviour language

Words of operations, flow, states and schedules; types, structure, requirements and views are unchanged and not listed.

| Word | 2.2 | 2.3 candidate (main + WP7) | 3.0 (this proposal) |
| --- | --- | --- | --- |
| `operation`, `returns`, `var`, `const`, `return` | yes | yes | yes |
| `if`, `else`, `while`, `until`, `for`, `in`, `times` | yes | yes | yes (`if` also for conditions and guards) |
| `wait`, `on`, `receive`, `or`, `after`, `send`, `publish` | yes | yes | yes |
| `try`, `assert`, `fail`, `interruptible` | yes | yes | yes |
| `true`, `false`, `not`, `and` | yes | yes | yes |
| `schedule`, `start`, `every`, `call`, `deadline`, `concurrent` | yes | yes | yes |
| `state`, `entry`, `exit`, `to` | yes | yes | yes (`exit` and `to` also as line heads) |
| `when` | yes (guards) | yes (guards, completion, WP7 release guards) | **removed** (respelled `if`; the WP7 release guard follows in its own change, 8) |
| `initial`, `final` | yes | yes | **removed** |
| `defer` | no | yes (WP5) | **never ships** |
| `stay`, `keep`, `ignore`, `during`, `stepped` | no | no | **not added** |

Net change against 2.2: three words fewer (`initial`, `final`, `when`), none added.

## 5. Checks against surprises

- **Operation ends where a cycle was meant:** SIF-D05.
- **Unreachable states, dead lines, parents that never act, states that never leave:** SIF-D08, D06, D18, D19.
- **Operation that can end where 2.2 could not:** the migrator checks "end reachable iff a final state was reachable" and refuses otherwise (7).
- **Reordering is never silent:** the formatter never reorders; every Flow View move previews changed numbers and targets, and a state move writes jumps to keep behaviour (2.8).
- **A parent line that wins a tie:** shown by the drawing (frame arrows first) and by the preview of "move a common exit to the parent".
- **The same receive text in two kinds of operation:** `on receive m(x) { … }` at the top of a plain operation waits once; at the top of an operation with states it reacts in every state. Flow View draws the second in the operation frame; hover says "applies in every state of `op`". This is a reading risk (13).
- **`if` on a line and `if` in the flow** look alike and mean "check now" versus "check while the state is active". The position decides (4.1) and the drawing shows the difference: a line's `[c]` leaves a state box, a decision's `[c]` leaves a diamond.
- **An input that the author expected to wait** is dropped: the reading samples ask about it on purpose; the lock controller shows the store-and-act pattern.

## 6. Compatibility: measured and argued

**Measured by P1** (native interpreter of the flat rules with the drop default and no added lines, and the migrator; 263 executed results, 129 from models with a machine, 115 of them 2.2 forms; deterministic across runs):

| Interpreter | Verdicts | Final stores | Other differences |
| --- | --- | --- | --- |
| Rules as written in revision 2 | 0 | 2 (fixtures r5, r10) | 27 count-only, 17 order-only |
| + taking input is a wait (AY) | 0 | 2 | 19 order-only |
| + drop only while waiting (DW) | 0 | 1 (r10) | 28 count-only |
| **+ both: revision 3** | **0** | **1 (r10)** | **none: 266 of 267 identical** |

- **r10 is the one real semantic change:** several queued inputs are served in delivery order, where 2.2 walked its queues in creation order (`m.log` 13254 becomes 12345).
- **Keep by default, for the record** (rejected): 9 verdicts and 8 stores change; five door cases fail because a periodic event fills a rejecting queue while a state does not take it.
- **Corpus migrated by P1:** 53 machines, 153 states in 40 files; 47 migrated. 251 transitions: 94 became `exit` (37 %), 157 `to S` (33 self, 104 backward, 20 forward). Door WindowLifter: 4 `exit`, 37 `to`. Not migrated: 3 machines with completion transitions (examples 44, 46, 47), 2 with `defer` only (45, 49), 1 invalid fixture.

**Measured earlier (revision 1, review):**

| Axis | 2.2 | 3.0 | Measured cost of the rejected alternative |
| --- | --- | --- | --- |
| Exit actions against line block | exit, effect, entry | same | block first: 1 verdict, 2 stores, 11 trace order |
| Timer against same-instant delivery | timer wins | same (phase 1) | delivery wins (upper bound): 0 verdicts, 1 store, 52 traces |
| Elapsed timer against earlier input | elapsed timer first | written order, migrator writes timers first: same | "first ready": 1 of 11 such selections (extended r5) |
| Written order among inputs | queue walk | delivery order (above) | written order: 1 verdict, 3 stores (example 32) |

**Argued, not measured:**
- **Parents, conditions and periodic machines** have no 2.2 counterpart; their rules need prototypes P4 to P6 (10).
- **Respelling `when` to `if`** in guards is textual; P1's corpus run used `when` and is unaffected in meaning.
- **Traces:** statement identities change and `state` gains `trigger`; reasons keep their 2.2 names. Gate 2 (trace digests) cannot hold across the edition; it is replaced by a migrated-corpus gate on verdicts, final stores, per-kind counts and per-component order-sensitive digests after mapping identities with the migrator's identity map, which the extension's run overlays also need.

## 7. Migration recipe (B7, A5)

Input: a 2.2 machine (`initial I; state …` body) in operation O, and every 2.2 guard. There is no other input: the WP5 forms never ship (8).

1. **Check the frame.** O satisfies SIF-S01 (2.2 enforces the `on start` rule).
2. **Choose the state order** to maximise fall-through (A5). The initial state first, final states last in source order; for the others, the order that maximises the number of states whose next state is a target of one of their transitions; exhaustive up to 9 non-final states, greedy beyond; ties go to source order.
3. **Write each state.** Entry and exit unchanged; **timers first**, sorted by literal duration ascending, stable on declaration order; then the `on receive` transitions in declaration order. Each transition keeps its text with its head: `… to T { e }` stays (normalised to `… to T;` when `e` is empty); when T is the next state in the chosen order, `… exit;` or `… exit { e }`, unless step 4 says otherwise; a self transition stays `to S`. Each line keeps its own binding names; nothing is merged or renamed. `when (g)` becomes `if (g)`.
4. **One logical exit, one spelling** (2.9).
5. **Dead timers.** An unguarded timer whose literal duration is greater than or equal to that of an earlier-sorted unguarded timer of the same state was never taken in 2.2; it is removed and reported (models-wp4 d3).
6. **Inputs.** Nothing is written: 2.2 dropped unhandled input while waiting, and so does 3.0.
7. **Final states.** Each final state F becomes a named step `state F { on entry { … } }`. With several finals, `return;` follows every final step except the last statement of the body, so `to ok` never falls into `failed`.
8. **Dead ends.** A non-final 2.2 state without transitions is refused with a message naming it (1.1); the author decides (SIF-D19 shows the explicit way to stay for good).
9. **End of operation.** The migrator verifies "end reachable iff a final state was reachable" and refuses otherwise.
10. **No parents.** The migrator never introduces a parent: a parent changes the priority at contested choices and its timers count across substates, so equivalence would have to be proved choice by choice. Flow View offers "move a common exit to the parent" as an explicit edit (2.8); a showcase rewrite with parents is a design change, recorded as such.
11. **Guards everywhere.** Every `when (g)` guard of plain receive statements is respelled `if (g)`.
12. **Report.** Removed dead timers, refused dead ends, the r10-style contested-order risk, and the identity map.

**The WP5 forms and examples 44 to 47 (and 49).** The forms are replaced in place on the 2.3 branch and never ship. The examples are rewritten by hand:
- **Completion transitions (44, 46, 47).** P1 rewrote all four without condition lines (a named step followed by `if (…) { to S; }`, or `while (c) { state S { … } }`), and their cases pass with identical stores. With condition lines they are shorter: `if (sessionId > 0) to Connected;` and `if (true) exit;` written before the input lines, as WP5 put completion first.
- **Deferral (45, 47, 49).** `defer` has no successor under the drop default. The deferring state takes the input with a reaction that stores it and the flow acts on it afterwards (1.3). This keeps only what the reaction stores, in the lock pattern the latest request; not measured.
- **Internal transitions (46):** reactions. **Guarded timers (47):** `after D if (g) …`, which no longer consumes the timer when `g` is false; expectations rewritten.

## 8. WP5, WP6, WP7, WP8 and WP9

**WP5 (merged in #59, unreleased):** chapter 3.6 WP5-S02 to S10, 6.5 WP5-R01 to R13, WP5-T01 to T04, ADR 0023, examples 44 to 47, `test/v2/state-reactions.test.ts`, SW2017 and SW2018 as defined there, and `CompletionLoop` are replaced in place. P1 estimates the removal at 2,500 to 3,000 deleted and about 300 edited lines in about 50 files; the hard dependency is WP6 (S01, S07 with SW2018, D09, D10). The runtime ideas carry over: the timer start at the state update; internal reactions as reactions; completion transitions as condition lines.

**WP6 (merged):** WP6-S01's guard positions become: conditions of input lines, of timer lines and condition lines, all allowing sampled reads. WP6-R02 cell updates are wakes (3.5). WP6-S07's per-member effective policy is what SIF-D02 checks. WP6-D09 and D10 are replaced by SIF-D11 and SIF-D12; the polling exemption disappears because a reaction no longer polls.

**WP7 (branch `v2.3/wp7-release-guards`):** release guards apply to the `on every` entry of a periodic machine with WP7's meaning: a false guard skips the step (3.9). A guard on `on start` stays an error. **Spelling follow-up (not designed here):** the release guard `… when (awake)` would be respelled `… if (awake)` in a separate change, so that `when` leaves the language entirely.

**WP8 (placement, `Swaml::Os`, ordering keys):** a periodic machine is one runnable per occurrence whose state persists across releases; each step is a release of a periodic operation. A waiting machine maps to an event-driven task that blocks at its waiting states. The binding check reads the run mode from the schedule entry.

**WP9 (edition, notation, figures, showcase rewrites):** the showcase machines go through the migrator; a use of parents in a showcase is a deliberate design rewrite listed with its contested-choice differences (1.5). Notation figures: state box, parent box, operation-level exit, empty decision diamonds with `[c]` lines, compact box, periodic Timing.

## 9. Consequences for the VS Code extension

- **Flow View drawing:** state and parent boxes, numbered exits in written order, exit bands with line hops, shared lanes per target, operation-frame lines and border exits, compact boxes, and empty decision diamonds with `[c]` lines for every flow (a change for flows without states too).
- **Flow View edits:** the gestures of 2.8 with dry-run previews; creation cards for states, parents, condition lines and per-step actions; field completion for members, legal jump targets and condition expressions.
- **Sequence:** state invariants and parent regions on the operation's lifeline.
- **Timing:** nested state bands; for periodic machines the release grid with skipped releases and the steps that took a line.
- **State view:** the 2.2 projection is retired; if kept, the view becomes a filter of Flow View that shows only states, parents and their arrows.
- **Migration command** "Migrate to swa.ml 3.0": one validated whole-workspace edit, the report of 7 step 12, the identity map for run evidence.
- **Dual-edition parsing** until users migrate.
- **Run overlays:** identities remapped through the identity map; `StateLoop` violations and `trigger` fields.

## 10. Plan: implementation packages in dependency order

All packages belong to the one release.

| # | Package | Content | Needs first |
| --- | --- | --- | --- |
| SIF-0 | Prototypes and review | **P1 done** for flat waiting states (6). **P4 conditions:** wakes, read sets per occurrence with redefinition and white-box tests, `StateLoop` by configuration hashing and its cost, the drain, handshake, alarm and ping-pong cases. **P5 parents:** the window lifter and the mode manager, choice across levels, exit order, the lifter's contested-choice differences against 2.2. **P6 periodic:** the window controller with Timing, release guards and quantisation. **P2b drawings:** parent boxes, border exits, compact boxes, numbers in order with exit bands, `[c]` decision lines. **P3b** the rewritten reading samples with the owner. | Owner decisions of 11 |
| SIF-1 | Grammar, AST, formatter, names | 4.1; shared receive node; `when` respelled `if`; removal of `initial`, `final`, `defer`, Transition; formatter prints every form (A1) | P1 |
| SIF-2 | Static rules, flat | SIF-S01 to S12 for flat states, D04 to D08, D15, D19 | SIF-1 |
| SIF-3 | Runtime, flat waiting mode, migrator | SIF-R01 to R10, R12, trace; the migrator and the migrated-corpus gate; WP5 replaced in place; examples 44 to 47 and 49 rewritten | SIF-2 (P1 is the reference) |
| SIF-4 | Parents | SIF-R11, levels in the choice, D06 across levels, D18 | SIF-3, P5 |
| SIF-5 | Conditions | SIF-R13 to R16, read sets, wakes, `StateLoop`, D11 to D14; WP6-D09/D10 replaced | SIF-3, P4 |
| SIF-6 | Periodic machines | SIF-R17 to R22, D02, D16, D17, WP7 interplay, Timing data | SIF-5, P6 |
| SIF-7 | Specification and examples | chapters 3.6 and 6.5, an ADR superseding 0023, reference book, keyword inventory, new examples (parent, condition, periodic), figures | SIF-4 to SIF-6 |
| X-1 | Extension: dual edition, migration command | | SIF-3 |
| X-2 | Extension: Flow View drawing and edits | | SIF-4, P2b |
| X-3 | Extension: Sequence, Timing, overlays | | SIF-6 |
| WP7b | Release guard respelled `if` | | SIF-1 |
| WP8, WP9 | as in the 2.3 plan, on top of the above | | SIF-7 |

Each package gets its own adversarial review before merge.

## 11. Owner decisions

| # | Decision | Recommended answer |
| --- | --- | --- |
| DA | Order of levels at a choice | **Outer first** (operation, parents, state), written order within a level, as Stateflow. Alternative: inner first (UML). |
| DB | Condition semantics | **Level**, one rule for both run modes (3.5). Edge would only save a flag in the alarm case. |
| DC | Zero-time loop rule | **`StateLoop` on a repeated configuration** in one instant; other loops end at the step limit. Alternative: a fixed number of condition takes per instant (arbitrary, rejects bounded loops). |
| DD | Periodic step | **Arrival ends the step**; one line per step; `if (true) { … }` written last is the per-step action. |
| DE | Periodic completion | **The next release starts again at the first statement.** Alternative: the machine stays completed. |
| DF | Entry kinds | **`on start` or `on every` only**; `on receive`, `after`, `on call` are errors with a message. |
| DG | Plain receive statements in an operation with states | **Not allowed**; a one-exit state replaces them. |
| DH | Jump into a parent | **Not allowed**; enter at the top, start with a named step and decide (1.5). |
| DI | Named step | **A state without lines never waits**, also inside a parent with lines; a 2.2 dead end is refused by the migrator. |
| DJ | Taking queued input | **A wait of zero time, as 2.2** (P1: 0 differences). Alternative: no lock release, which changes 19 traces and can change a verdict on a rejecting route. |
| DK | Condition lines at the operation level | **None**: at the operation level `if` is always the flow decision; operation-wide conditions go on a parent around the states. Alternative: allow them before the first statement, at the price of an `if` that changes meaning when a state is added to the operation. |
| DL | Window lifter showcase | Parents as in 1.5, the 8 s limit per state (2.2 behaviour apart from contested choices). Alternative: 8 s per movement on `driven` (27 arrows). |
| DM | Label rule for ports | **`port.member`**, the port dropped only when every handled member comes through one port. |
| DN | Compact boxes | **More than three leaving arrows.** |
| D2 | Leaving word | **`exit`**, the 2.2 word (adopted). |
| D11 | 2.2 machine syntax in 3.0 | Removed, automatic migrator (P1 measured). |
| D12 | Interrupt regions | Keep their 2.2 discard; not allowed in operations with states. |
| D13 | States in case scripts | No; scripts cannot call operations with states. |

Decided and no longer open: restricted `to` (D1); a false input condition consumes the input, a false timer condition does not (D3); drop by default, no keep (D4); written order with the input group (D5); exit, block, target (D6); conditions, periodic machines and parents in the release (D7 to D9); WP5 forms never ship (D10); named steps (D14); which operations (D15); the phase rule (D16); one word `if` for conditions; decisions drawn as empty diamonds with `[c]` lines.

## 12. Stateflow cues

| Cue | Decision |
| --- | --- |
| States and flow-chart logic in one chart; junctions are control flow | **adopt**: states are steps, decisions are `if`, merges are merge nodes |
| Numbered transition order is the priority | **adopt**, with the input lines sharing one number |
| entry, exit, on event | **adopt**: `on entry`, `on exit`, reactions listed in the box |
| `during` | **adopt as a condition**: `if (true) { … }` written last, periodic machines only |
| Conditions in brackets on transitions | **adopt**: `[c]` on every line, out of a state or a diamond |
| Transition action after exit, before entry | **adopt**: the line's block |
| Condition actions before exit | **reject**: work done while staying is a reaction |
| Default transition | **adapt**: the flow's arrival; into a parent, its first state, with a decision after a named step for a choice |
| Temporal `after` | **adopt**: relative to the level's arrival, rounded to the step in periodic machines |
| Conditions evaluated at each chart execution | **adopt**: at each step in periodic machines; at choices and wakes in waiting machines |
| Hierarchy, outer transitions first | **adopt** |
| Inner transitions of a parent to its own substates | **reject**: a parent is re-entered at its top (`to P`) |
| Parallel states, history junction | **reject** |

## 13. Risks

- **One final release.** A wrong rule cannot be fixed later. Every runtime package has a prototype before it; parents, conditions and periodic machines are argued only.
- **`StateLoop` by configuration** must hash the occurrence's stores at each condition take; cost and exactness need P4.
- **Wake completeness.** Read sets through redefinition and helpers, and wakes from borrowed script and helper calls, are easy to get wrong; a missed wake silently stalls a case.
- **Outer-first surprises.** A parent line wins ties against a substate's own timer; readers trained on UML expect the inverse.
- **Two `if`s and two receive meanings by position.** `if` on a line versus in the flow, and `on receive m(x) { … }` at the top of a plain operation versus one with states. The position rules are exact and the drawing differs, but a reader moving text between positions can be surprised.
- **Dropped by default** loses input that an author expected to wait; the store-and-act pattern is explicit but longer, and keeps only what it stores.
- **Periodic quantisation and the arrival step** are classic off-by-one-period sources; SIF-D16 and SIF-D17 cover the common ones.
- **Text order is behaviour.** Every refactoring tool must treat state order, line order and level as meaningful.
- **Gutter layout** with nested parents is unproven beyond sketches (P2b).
- **Extension cost** (dual-edition parsing, migration command, Flow View for every flow because of the decision rule, overlays, State view retirement) is substantial and not estimated here.

## Appendix A. Measurement method

Revision 1, in `E:\t\design-scratch\base` (a copy at `02e92c8`, nothing committed): `measure.mjs <out> <result>` runs every run of `examples/simulation/runs.json`, every case of every example and showcase model, and every run and case of the extended 2.2 sets, recording verdict, stores, status, per-kind counts and the trace digest; `patch.mjs` builds the variants; `compare.mjs` and `static.mjs` compare and count.

Design review, in `E:\t\rv-states-scratch\`: baseline reproduced (253 results); `keep`, `eff` and `dropops` reproduced; `patch-tie.mjs` moves the receive timeout from phase 1 to phase 3 (`tieflow`: 0 verdicts, 0 stores, 7 traces; `tieall`: 0 verdicts, 1 store, 52 traces).

P1, in `E:\t\sw-p1` on Node 26.12.0: `npm run build`; `P1_MODE=none node p1/migrate.mjs <out>`; `node p1/measure.mjs <outDir> <sourceRoot> <result.json>` for `out-base` and `out` (variants `P1_ARRIVAL_YIELD=1`, `P1_DISPOSE_ON_WAIT=1`); `node p1/compare.mjs base.json variant.json <identity-map.json>`.
