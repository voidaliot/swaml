# swa.ml: states as steps of the flow

**Status:** design proposal for owner review, **revision 4**, 18 November 2026. Not normative. Nothing here changes the grammar, validator, simulator, standard version or a published artefact. New syntax is in `text` fences because no parser accepts it. "Measured" means measured by the interpreter prototype P1 (flat states, waiting mode, the drop rule) or by revision 1's prototypes; section 6 says which of those numbers still apply to this revision. Parents, values that are re-checked and periodic machines are not prototyped: everything about them is argued, and section 10 lists the prototypes that must exist before implementation is approved.

**Bases:**
- **Language:** main `1d5ef7e` (2.3 candidate, WP1 to WP6 merged) and branch `v2.3/wp7-release-guards` (schedule entries and release guards).
- **Owner direction (binding), in the order given:**
  1. A state is an ordinary step of a flow, usable wherever a statement is; no container, no `initial`. Simplicity outranks expressiveness; a really minimal set of keywords; nothing in a model may exist only to satisfy a rule.
  2. A message a state does not handle is dropped; nothing is written for it. Remembering something is done with a variable.
  3. One word for conditions: `if`. `when` leaves the language. All conditions have the same meaning.
  4. `to S` may name a state inside a parent directly; entry actions run outermost first. Jumps into `if` branches and loop bodies stay forbidden.
  5. Outside a state, a false `if` without `else` is skipped, as today; inside states the same, with the braces deciding what is looked at again.
  6. One final release with flat states, parents, an exit that applies to several states (the parent mechanism), conditions that are re-checked (reading only things that come from somewhere), and machines released `on every N` through the schedule with no new keyword.
  7. Drawing: a decision is an empty diamond with the conditions on the outgoing lines; no extra information on diagrams.
  8. **Confirmed for this revision:** "`if` never waits. The state waits, and looks at what is inside its braces again each time something happens to it."
  9. **Short form:** a single statement without braces may be considered wherever a block is expected, if it does not add effort (evaluated in 1.3).
- **Design review of revision 3:** `E:\t\review-states-design-r3.md` (blocking B1 to B7, important I1 to I11), outside the repository.
- **Interpreter prototype P1:** branch `prototype/states-in-flow-p1` (`f5b94fb`, worktree `E:\t\sw-p1`); summary in `E:\GitHub\swaml-vsc-ext\.temp\kept\states-p1\REPORT.md`.
- **Drawing prototype P2:** `E:\GitHub\swaml-vsc-ext\.temp\kept\states-p2\` (drawings of nine migrated machines, revision 2 spelling).
- **Reading samples:** [STATES_IN_FLOW_READING_SAMPLES.md](STATES_IN_FLOW_READING_SAMPLES.md), rewritten for this revision.

## The whole thing in ten sentences

1. A state is a step of the flow: the flow reaches it, runs its `on entry`, and the state waits until something inside its braces leaves; a state with nothing inside to look at does not wait.
2. Inside its braces a state holds `on entry` and `on exit` blocks, event lines (`on receive p.m(x) { … }` and `after D { … }`), ordinary statements, and, at the end, inner states.
3. `if` means the same everywhere: check now and skip when false; it never waits. What waits is the state.
4. A state looks at its contents when it is reached and each time something happens to it: a message that one of its lines or a parent's line names arrives, its timer or a parent's timer runs out, someone else writes a value its statements read, or, in a machine released `on every P`, a release comes.
5. A look goes through the contents in written order, the parents' contents first: it runs the event line of what happened and every statement, and it stops at the first `exit;` or `to S;` it runs.
6. A look sees one message, in the order of delivery; a message that no line of the state or its parents names is dropped while the state waits.
7. `exit;` leaves the state and goes on with what is written after it; `to S;` goes to state `S`, also straight into a state inside a parent, never into an `if` branch or a loop.
8. Leaving runs in the order of the text: the statements written before `exit;` or `to S;`, then `on exit` of every state left, innermost first, then `on entry` of every state entered, outermost first.
9. A parent is a state whose braces end with inner states: its lines and statements apply in every state inside it; inner states follow each other only through `exit;` and `to S;`.
10. Released `on start`, the operation runs once; released `on every P`, it is one machine that keeps its place, locals and loops between releases, looks once per release and never reaches its end; only an operation without parameters that a component owns directly, with exactly one such entry and never called, may contain states.

## Changes since revision 3

### Review findings

| Finding (review r3) | Revision 4 | Where |
| --- | --- | --- |
| **B1** per-event choice; sample 7 Q4 wrong | A look sees **one message**, in delivery order, at every level. Queued and freshly delivered messages behave the same, so the answer no longer depends on invisible insertion ordinals. Sample 7 Q4 corrected: the manager passes through `running` for zero time. | 3.4, samples 7 |
| **B2** outer reaction starves inner lines | A look **runs every present event line and every statement** and stops only at a leave. A query answered on a parent no longer suppresses pinch detection or travel counting; a suspending reaction no longer holds a pulse timer (timers that ran out meanwhile are looked at first when the state waits again). | 3.3, 3.4 |
| **B3** periodic mode not an execution model | **One persistent activation** per occurrence whose place, locals and loop state live between releases; one look per release; **reaching the end is an error**; SIF-D01 checks the sustained rate, not a burst. | 3.8 |
| **B4** two block orders for one arrow | **Text order is the real order**: statements before the leave, then `on exit` innermost first. Forced anyway by the block form (a leave inside an `if` is only known when it runs). The migrator copies a 2.2 `on exit` into the leaving blocks where 2.2 ran it first. | 3.6, 7 |
| **B5** parent lines do not guard plain flow inside the parent | No plain flow between inner states exists. What remains: a parent's lines are not looked at while an `on entry`, `on exit` or line block of a state inside it is suspended. Stated as run to completion, as in 2.2. | 3.7, 5 |
| **B6** named step inside a parent passes through | A state waits when it **or an enclosing parent** has something to look at. | 3.2 |
| **B7** rule artefacts (`selecting`, `start`, dummy first state, two lock flags, `if (true)`, operation-level look-alike) | All gone: direct jumps into parents; parents hold no flow; the lock uses one variable; per-step work is written plainly in the state; there are no operation-level lines. | 1.4 to 1.11 |
| **I1** measurement covers less than claimed | Section 6 lists what P1 still covers and what must be rerun (block form, text-order exits with copied exit actions, re-pick after the zero-time wait). | 6 |
| **I2** `if` on a timer reads as "check once" | It now **is** "check once": `after 10s { if (requested) { exit; } }` checks at 10 s. Timers are moments; a condition from a time on is a parent timer plus an inner state (traffic light). | 1.10, 3.4 |
| **I3** same text, different meaning by run mode | Same meaning, different moments: a statement runs at every look in both modes. The operation frame shows the release (`· every 10ms`) in place of the constant signature. A bare action in an `on start` machine is warned (SIF-D08). | 2.1, 3.8 |
| **I4** StateLoop definition, borrowed calls, D11 false positive | StateLoop is checked at looks, configuration defined, known misses listed; borrowed calls wake at every unlock; revision 3's D11 is folded into SIF-D10. | 3.5, 3.9 |
| **I5** outer first | Kept (parents first) and now harmless: with one message per look, outer first only orders lines on the same message, timers and statements. Shielding a substate is a guarded parent line. | 3.7 |
| **I6** input rule | Unchanged in substance (drop while waiting). SIF-D01 covers periodic machines; waiting machines rely on the 2.2 overflow checks. | 3.10 |
| **I7** fall-through into a sibling | `exit;` from an inner state goes to the next inner state by definition; nothing falls out of a parent unseen. | 3.6 |
| **I8** operation-level line looks like a plain receive | **No operation-level lines.** The operation body is flow; plain receive statements stay forbidden in operations with states. | 3.1 |
| **I9** two `if`s by position | One `if`. What differs is the place: inside a state's braces it is looked at again because the state looks again. | 1.1 |
| **I10** drawing | Release in the header, no `«state»`, no `step:` prefix, no `■`; one arrow per leave; a decision only where an event has two or more leaves. Back-jump stubs versus lanes stay a P2b question. | 2.1 |
| **I11** scope versus the door controller | `MirrorHeater.tick` fits as a periodic machine (1.9). | 1.9 |

### Owner decisions

| Decision | Handled in |
| --- | --- |
| 1, a state is a step; nothing for a rule | 1.1; the window lifter (1.6) and lock (1.5) have no artefact left; named steps are the one remaining special case (5). |
| 2, unhandled message dropped; remember with a variable | 3.10; the lock's single variable (1.5, 1.12). |
| 3, one `if`, `when` removed | 1.1, 4.6; guards are `if` inside the line's block. |
| 4, `to S` into a parent; entries outermost first | 3.6. |
| 5 and 8, `if` never waits; the state looks again | 1.1, 3.3. Where it does not hold: section 5. |
| 6, one release with everything | 10 (prototype order and cuts). |
| 7, empty diamonds, no extra information | 2.1. |
| 9, short form | 1.3: recommended in its narrowest form only; owner decision O1. |

## 0. Summary: the lock controller

```text
operation control() {
  var wanted: bool = false;                  // the latest request: true = lock
  state powered {
    on receive status.query() { publish status.report(locked, pulses); }
    on receive requests.request(lock) { wanted = lock; }
    on receive power.off() { exit; }
    state unlocked {
      on entry { locked = false; }
      if (wanted) { exit; }
    }
    state locking {
      on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.lockPulse); }
      on exit { send motor.lockMotor(LockDrive.idle); }
      after 250ms { exit; }
    }
    state isLocked {
      on entry { locked = true; }
      if (not wanted) { exit; }
    }
    state unlocking {
      on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.unlockPulse); }
      on exit { send motor.lockMotor(LockDrive.idle); }
      after 250ms { to unlocked; }
    }
  }
  reportShutdown();
}
```

- **One variable remembers.** Every request, in every state, sets `wanted`; the line is written once, on the parent. The states only ask `if (wanted)`.
- **Nothing starves.** A query during a pulse is answered at once (its own look), and the pulse timer still ends the pulse at 250 ms (its own look).
- **`if` never waits; the state does.** `unlocked` waits; each time a message arrives, it looks again and `if (wanted)` is checked again.
- **Power-off** leaves whatever state is current (its exit sets the motor idle) and `powered`; the flow goes on with `reportShutdown()` and the operation ends.

**Impact on 2.2 sources.** Every 2.2 machine is rewritten by the migrator, one line per event, guards as `if` chains (7). P1 measured the flat rules at **0 verdicts and 1 final store** (fixture r10: delivery order). The rules of this revision that P1 did not implement (block form, text-order exits with copied exit actions, re-pick after a zero-time wait) are equivalent on paper and must be rerun (6).

**Open owner decisions:** six, in section 11.

## 1. How it looks: text

### 1.1 A state and what is inside its braces

```text
state name {
  /** documentation */
  on entry { … }                     // once, when the state is reached
  on exit { … }                      // once, on every way out
  on receive p.m(x) { … }            // an event line: runs at the look that sees m
  after D { … }                      // an event line: runs at the look when D has passed since arrival
  if (c) { … } else { … }            // a statement: runs at every look
  …                                  // any other statement: also runs at every look
  state inner { … }                  // optional, last: the state is a parent
}
```

**The braces are what waits.** A state waits; whenever something happens to it, it looks at its contents again, in written order. An `if` inside the braces is therefore checked at every look, and an `if` anywhere else (in the flow, in a block) is checked when the flow gets there. There is one `if`; the place decides how often it is reached.

**Leaving is a statement.** `exit;` and `to S;` are ordinary statements. Inside a state they may stand as the last statement of an event line's block, of an `if` or `else` block inside a state (at any depth of `if`), or directly in the state's braces. They may not stand in `on entry`, `on exit`, a loop body or the flow outside states. A block that runs `exit;` or `to S;` leaves; any other block stays. A guard is an `if` inside the block:

```text
on receive requests.request(lock) {
  if (lock) { exit; }                // an unlock request is taken and nothing happens
}
```

**Guards and chains.** Several 2.2 transitions on one member become one line with an `if / else if` chain in declaration order. Each event is written once per state; two lines on the same member in one state are allowed and both run, in written order (no rule is needed to forbid it).

**What the state says about waiting.**
- **A state with something to look at** (an event line or a statement, in it or in an enclosing parent) waits until a look leaves.
- **A state with nothing to look at** (only `on entry`/`on exit`, and no enclosing parent has lines or statements) does not wait: entry, exit, next statement. It is a named step: a jump target, a migrated 2.2 final state, the owner's `state4`.
- **A state that can wait but never leave** is allowed and warned (SIF-D10).

### 1.2 One look, by hand

`closing` from the anti-pinch example (1.8), waiting mode:

```text
state closing {
  on entry { drive(MotorDirection.up); }
  if (sense.current > pinchLimit) { pinchReversals = pinchReversals + 1; to reversing; }
  on receive requests.request(c) { if (c == WindowRequest.halt) { to idle; } }
  after 8s { to idle; }
}
```

| What happens | The look |
| --- | --- |
| Arrival | The pinch `if` is checked. No message is present on arrival, no timer has run out. |
| A request arrives | The pinch `if` is checked (current value), then the request line runs; a halt leaves. |
| A new current value is delivered to `sense.current` | The pinch `if` is checked with the new value. The request line does not run (no request is present). |
| 8 s after arrival | The pinch `if` is checked, then the timer line leaves. |

### 1.3 The short form (owner question)

**The question.** May a single statement stand without braces wherever a block is expected, as in C: `after 250ms exit;`, `on receive power.off() to report;`, `if (c) to reversing;`, `if (x > 3) y = 1; else y = 2;`? The owner's condition: only if it adds no effort.

**The general rule (every block may be one statement): not recommended.** What it costs:

| Area | Cost of the general rule |
| --- | --- |
| Grammar | Every block position becomes `Block | Statement`. The dangling `else` (`if (a) if (b) x(); else y();`) becomes ambiguous; Langium's ALL(*) parser binds it to the nearest `if`, as C does, but the grammar build must be checked for ambiguity reports, and every `if` test gains the nested case. |
| Silent meaning changes in half-typed sources | Inside a state, `on receive m(x)` with its block not yet typed, followed by the next item `if (fault) { to safe; }`, parses as **one line**: the condition becomes the message's guard, and `fault` is no longer checked at every look. No error is reported. The same for `after 2s` followed by any statement. With braces required this is a syntax error. This is the decisive cost: it hides a behaviour change exactly in the position this design adds. |
| Parser recovery | More valid parses of broken text means fewer, later error messages while typing. |
| Formatter | Must keep the author's form, or normalise, for every block position, and handle comments between the head and the statement. |
| Validation messages | Messages that point at "the block of …" must handle the missing block (ranges, quick fixes). |
| Statement identities (diagrams, traces) | Safe if the parser always builds a block node with a `braced` flag; identities are then the same with or without braces. Needed in every position. |
| Flow View edits | Every edit that adds a statement to a body must add braces when the body is a single unbraced statement. One helper, but every creation path must use it and be tested. |
| 2.2 compatibility | A superset: every 2.2 source parses as before, the migrated corpus has braces everywhere, and the measurement gates cannot change. No cost here. |

**The narrow rule: recommended (owner decision O1).** A body that consists of **only `exit;` or only `to S;`** may be written without braces, after an event line head, after `if (…)` and after `else`:

```text
after 250ms exit;                    // same as  after 250ms { exit; }
on receive power.off() exit;         // same as  on receive power.off() { exit; }
if (wanted) exit;                    // same as  if (wanted) { exit; }
if (sense.current > pinchLimit) to reversing;
```

- **No ambiguity:** a short body is never an `if`, so there is no dangling `else`.
- **Half-typed sources:** `on receive m(x)` followed by `if (…)` is still a syntax error. Only a following bare `exit;` or `to S;` could be absorbed, which changes "leave on arrival" into "leave on m"; the formatter's join onto one line makes it visible.
- **Cost:** two grammar alternatives (event line body, `if`/`else` body), the `braced` flag, one formatter rule (keep the author's form), one edit helper (adding a statement adds braces). Small, but not zero; hence an owner decision.
- **No rule depends on the form.** Both forms build the same block; diagrams, traces, identities and every rule of section 3 see a block.

The examples below use braces; the short form is shown once per construct here and in the reading samples.

### 1.4 The owner's picture

Start, `state0`, a decision with two branches to `state2` and `state1`, a merge, an operation step, `state4`, end.

```text
operation run() {
  var ok: bool = false;
  state state0 {
    on entry { send lamp.set(Lamp.waiting); }
    on receive cmd.go(v) { ok = v; exit; }
  }
  if (ok) {
    state state2 {
      on entry { send lamp.set(Lamp.go); }
      after 10ms { exit; }
    }
  } else {
    state state1 {
      on entry { send lamp.set(Lamp.retry); }
      on receive cmd.retry() { exit; }
    }
  }
  process();
  state state4 {
    on entry { report(); }
  }
}
```

The `if` between the states is checked once, when the flow gets there. `state4` has nothing to look at, so it does not wait: `report()` runs and the operation ends.

### 1.5 The lock controller

Section 0 is the full text. Reading it with the ten sentences:
- **Parent lines first.** At a look of `unlocked` caused by a request, `powered`'s request line sets `wanted`, then `unlocked`'s `if (wanted)` is checked with the new value: the request is acted on in the same look.
- **During a pulse,** `locking` has only a timer. A request at 100 ms is taken by `powered`'s line (it sets `wanted`), and `locking` keeps pulsing. At 250 ms the timer leaves; `isLocked` is reached, its entry sets `locked = true`, and its arrival look checks `if (not wanted)`: an unlock request that came during the pulse starts the unlock pulse at once.
- **`locked`** is set by the entries of `isLocked` and `unlocked`, so it says what the lock is, not what was requested.
- **No decision, no second flag, no `to` in the flow.** The one back jump is `to unlocked` at the end of the unlock pulse.
- **Power-off** is a line of the parent: `unlocking`'s exit sets the motor idle, `powered` is left, `reportShutdown()` runs, and the operation ends; later messages are discarded.

**What is lost against 2.3's `defer`** (which never ships): `defer` replayed every deferred request in order. Lock, unlock, lock during one pulse would replay three requests; `wanted` keeps only the last. Section 1.12 states this precisely.

### 1.6 Parents and direct jumps: the door window lifter

The 2.2 `WindowLifter.control()` of the door showcase has six states and 41 transitions, 33 of them back to `idle`.

```text
operation control() {
  state idle {
    on entry { drive(MotorDirection.stop); }
    on receive requests.request(command) {
      if (command == WindowRequest.autoUp and oneTouchAllowed()) {
        oneTouchCloses = oneTouchCloses + 1;
        to autoUp;
      } else if ((command == WindowRequest.manualUp or command == WindowRequest.autoUp) and motionAllowed()) {
        to manualUp;
      } else if (command == WindowRequest.autoDown and oneTouchAllowed()) {
        to autoDown;
      } else if ((command == WindowRequest.manualDown or command == WindowRequest.autoDown) and motionAllowed()) {
        to manualDown;
      }
    }
  }
  state moving {
    /** Stops that apply to every movement, the pinch reversal included. */
    on receive supervision.sensorFault() { to idle; }
    on receive supervision.motionStalled() { stalledStops = stalledStops + 1; to idle; }
    state driven {
      /** Movements requested by the switch; a withdrawn motion permission stops them, not the reversal. */
      on receive permissionIn.motionInhibited() { inhibitedStops = inhibitedStops + 1; to idle; }
      state manualUp {
        on entry { drive(MotorDirection.up); }
        after 8s { runTimeouts = runTimeouts + 1; to idle; }
        on receive supervision.pinchDetected() { pinchReversals = pinchReversals + 1; to reversing; }
        on receive supervision.obstructed() { obstructionStops = obstructionStops + 1; to idle; }
        on receive supervision.endPosition(closed) { if (closed) { to idle; } }
        on receive requests.request(command) {
          if (command == WindowRequest.autoUp and oneTouchAllowed()) {
            oneTouchCloses = oneTouchCloses + 1;
            to autoUp;
          } else if (command != WindowRequest.manualUp and command != WindowRequest.autoUp) {
            to idle;
          }
        }
      }
      state autoUp {
        /** One-touch close: continues after the switch is released; a down request stops it. */
        on entry { drive(MotorDirection.up); }
        after 8s { runTimeouts = runTimeouts + 1; to idle; }
        on receive supervision.pinchDetected() { pinchReversals = pinchReversals + 1; to reversing; }
        on receive supervision.endPosition(closed) { if (closed) { to idle; } }
        on receive requests.request(command) {
          if (command == WindowRequest.manualDown or command == WindowRequest.autoDown) { to idle; }
        }
      }
      state manualDown {
        on entry { drive(MotorDirection.down); }
        after 8s { runTimeouts = runTimeouts + 1; to idle; }
        on receive supervision.obstructed() { obstructionStops = obstructionStops + 1; to idle; }
        on receive supervision.endPosition(closed) { if (not closed) { to idle; } }
        on receive requests.request(command) {
          if (command == WindowRequest.autoDown and oneTouchAllowed()) {
            to autoDown;
          } else if (command != WindowRequest.manualDown and command != WindowRequest.autoDown) {
            to idle;
          }
        }
      }
      state autoDown {
        on entry { drive(MotorDirection.down); }
        after 8s { runTimeouts = runTimeouts + 1; to idle; }
        on receive supervision.obstructed() { obstructionStops = obstructionStops + 1; to idle; }
        on receive supervision.endPosition(closed) { if (not closed) { to idle; } }
        on receive requests.request(command) {
          if (command == WindowRequest.manualUp or command == WindowRequest.autoUp) { to idle; }
        }
      }
    }
    state reversing {
      /** Pinch reversal: switch requests and a withdrawn motion permission are dropped here. */
      on entry { drive(MotorDirection.down); }
      after 1600ms { runTimeouts = runTimeouts + 1; to idle; }
      on receive supervision.reversalComplete() { to idle; }
      on receive supervision.endPosition(closed) { if (not closed) { to idle; } }
      on receive supervision.obstructed() { obstructionStops = obstructionStops + 1; to idle; }
    }
  }
}
```

How to read it:
- **Direct entry.** `to autoUp` from `idle` enters `moving`, then `driven` (their entries, outermost first; they have none), then `autoUp`. No `start` variable, no `selecting` state, no decision inside the parent.
- **Written once.** `sensorFault` and `motionStalled` are on `moving` (all five moving states had them); `motionInhibited` on `driven` (the four switch-driven states). `obstructed` is missing from 2.2's `autoUp`, so it stays in the four states that have it.
- **Behaviour.** Equal to 2.2 by construction: no member is named on two levels, a look sees one message, and the 8 s limit stays per state. Revision 3's contested choices between a parent line and a substate's queued input no longer exist. Only the trace gains `state` observations for `moving` and `driven` (P5 must confirm this, 10).

**Arrow count.**

| Version | Arrows | Notes |
| --- | --- | --- |
| 2.2, and the flat migration | 41 | 33 to `idle` |
| Revision 3 with parents | 30, plus 4 decision lines and the `selecting` state | 22 to `idle` |
| Review of revision 3 | 26 (stated) | I cannot reproduce 26: the review's own sketch keeps `idle`'s four lines. 30 minus the four decision lines is 30, because revision 3 counted those separately. |
| **Revision 4** | **30 leaves**, drawn as **25 arrows from box edges** plus **2 diamonds** (`idle`'s request with 4 lines, `manualUp`'s and `manualDown`'s requests with 2 lines each) | idle 4, `moving` 2, `driven` 1, manualUp 6, autoUp 4, manualDown 5, autoDown 4, reversing 4; 22 to `idle`, in one lane |

If the 8 s limit is meant per movement rather than per state, `after 8s { … to idle; }` moves to `driven`: 27 leaves. That changes behaviour (the limit no longer restarts from `manualUp` to `autoUp`), so it is the owner's choice for the showcase, not the migrator's.

### 1.7 An exit for several states: the mode manager

The shutdown is a line of a parent around all states. There are no operation-level lines.

```text
operation modes() {
  state system {
    on receive ecu.shutdown() { exit; }
    state off {
      on entry { send status.mode(Mode.off); }
      on receive key.ignitionOn() { exit; }
    }
    state powered {
      on receive key.ignitionOff() { to off; }
      state standby {
        on entry { send status.mode(Mode.standby); }
        on receive cmd.go() { exit; }
        on receive diag.enter() { to diagnostic; }
      }
      state running {
        on entry { send status.mode(Mode.running); send drive.enable(true); }
        on exit { send drive.enable(false); }
        on receive cmd.halt() { to standby; }
        on receive diag.enter() { exit; }
      }
      state diagnostic {
        on entry { send status.mode(Mode.diagnostic); }
        on receive diag.leave() { to standby; }
      }
    }
  }
  send status.mode(Mode.off);
}
```

- **Shutdown** in `running`: `running`'s exit disables the drive, `powered` and `system` are left, then the flow goes on: `send status.mode(Mode.off)`, and the operation ends.
- **Ignition off** is written once, on `powered`: `to off` leaves the inner state and `powered`, and enters `off`.
- **Cycle:** `to off` closes it; no `while` is needed inside a parent.
- **Short form, once:** `on receive ecu.shutdown() exit;`.

### 1.8 Re-checked conditions: anti-pinch

**On a sampled port member.** The motor current arrives as an attribute member with an initial value, so `sense.current` is a sampled read (WP6-S01). Each delivery of a new value is something that happens to `closing`: it looks again.

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
      on receive requests.request(c) { if (c == WindowRequest.autoUp) { exit; } }
    }
    state closing {
      on entry { drive(MotorDirection.up); }
      if (sense.current > pinchLimit) { pinchReversals = pinchReversals + 1; to reversing; }
      on receive requests.request(c) { if (c == WindowRequest.halt) { to idle; } }
      after 8s { to idle; }
    }
    state reversing {
      on entry { drive(MotorDirection.down); }
      after 400ms { to idle; }
    }
  }
  schedule {
    on start control();
  }
}
```

Short form, once: `if (sense.current > pinchLimit) to reversing;` (without the counter).

**On an attribute written by a periodic filter.** The value "comes from somewhere": a port read by `filter()` every millisecond.

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
      if (motorCurrent > pinchLimit) { pinchReversals = pinchReversals + 1; to reversing; }
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

- **When it is checked:** on arrival, at every request or timer look, and each time `filter()` has written `motorCurrent` and unlocked: a write by another activation is something that happens to `closing` (3.5).
- **Written order:** the condition is written first, so a halt that arrives while the current is already too high still sees the reversal first.
- **What a condition does not see:** a value that rises above the limit and falls back within one run of the writer. A condition looks at values, not changes; a pulse that must not be missed is an event.

### 1.9 A periodic machine: the window controller every 10 ms

The schedule entry decides how the operation runs. Released `on every 10ms`, the operation is one machine that keeps its place between releases and looks once per release. Per-step work is simply written in the state.

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
      if (switch.position == SwitchPos.up and travel < fullTravel) { exit; }
      if (switch.position == SwitchPos.down and travel > 0) { to opening; }
    }
    state closing {
      on entry { send motor.drive(MotorDirection.up); }
      if (sense.current > pinchLimit) { to reversing; }
      if (switch.position != SwitchPos.up or travel >= fullTravel) { to idle; }
      after 8s { to idle; }
      travel = travel + 1;
    }
    state opening {
      on entry { send motor.drive(MotorDirection.down); }
      if (switch.position != SwitchPos.down or travel == 0) { to idle; }
      travel = travel - 1;
    }
    state reversing {
      on entry { send motor.drive(MotorDirection.down); }
      after 400ms { to idle; }
      if (travel > 0) { travel = travel - 1; }
    }
  }
  schedule {
    on every 10ms step() deadline 2ms;
  }
}
```

How it runs (3.8):
- **The first release** (10 ms) starts the machine: `idle`'s entry stops the motor, and `idle`'s arrival look checks its conditions.
- **Every later release** is one look at the current state. A look that leaves reaches the next state in the same release: its entry runs and its arrival look runs, so `travel` counts from the release that starts the motor.
- **Per-step work** (`travel = travel + 1;`) is written after the conditions, so it does not run in a look that leaves. Written first, it would.
- **`after 8s`** runs at the first release at or after 8 s from arrival (rounded up to the period, SIF-D12 warns when 8 s is not a multiple).
- **Nothing happens between releases:** no message, timer or value change causes a look; all are seen at the next release.
- **The end** cannot be reached: every way out of every state is `to` or `exit;` to the next state. A periodic machine that could reach its end is an error (SIF-D04).

**The door showcase's `MirrorHeater.tick`** (`on every 100ms`, off/heating with a 10-minute limit) becomes:

```text
operation tick() {
  while (true) {
    state off {
      if (requested) { exit; }
    }
    state heating {
      on entry { send drive.heaterPercent(heaterPercent); }
      on exit { send drive.heaterPercent(0); }
      if (not requested) { exit; }
      after 600s { requested = false; exit; }
    }
  }
}
```

### 1.10 A traffic light

```text
operation cycle() {
  var requested: bool = false;
  while (true) {
    state green {
      on entry { send lamps.set(Light.green); }
      on receive ped.button() { requested = true; }
      after 60s { exit; }
      state minimum {
        after 10s { exit; }
      }
      state extended {
        if (requested) { exit; }
      }
    }
    state yellow {
      on entry { send lamps.set(Light.yellow); }
      after 3s { exit; }
    }
    state red {
      on entry { send lamps.set(Light.red); }
      after 2s { exit; }
    }
    if (requested) {
      state walk {
        on entry { send walkSign.set(true); }
        on exit { send walkSign.set(false); }
        after 15s { exit; }
      }
      requested = false;
    }
  }
}
```

- **A timer is a moment.** "Green at least 10 s, then as soon as someone has pressed, at most 60 s" is a parent `green` with two inner states: `minimum` ends at 10 s, `extended` leaves as soon as `requested` holds (also on arrival). The 60 s timer is on the parent, so it counts from the start of green.
- **`exit;` from `extended`,** the last inner state, leaves `green` too; the flow goes on with `yellow`.
- **A press outside green** is dropped: only `green` names the button.

### 1.11 A connection manager with retry and backoff

```text
operation manage() {
  while (true) {
    var attempt: uint = 0;
    var backoffMs: uint = 10;
    var up: bool = false;
    while (attempt < 5 and not up) {
      attempt = attempt + 1;
      publish link.hello(attempt);
      state awaiting {
        on receive link.ack(id) { if (id == attempt) { up = true; exit; } }
        after (backoffMs * 1ms) {
          if (backoffMs < 1000) { backoffMs = backoffMs * 2; }
          exit;
        }
      }
    }
    if (up) {
      state connected {
        on entry { publish status.connected(true); }
        on exit { publish status.connected(false); }
        on receive link.down() { exit; }
      }
    } else {
      state cooldown {
        after 30s { exit; }
      }
    }
  }
}
```

States stand in loops and branches like any statement. A late `ack` with a stale id is taken, nothing runs, and it is recorded as `discardInput` reason `noEnabledTransition`.

### 1.12 Remembering requests

- **The rule:** a state takes what one of its lines (or a parent's) names; everything else is dropped while it waits.
- **Remembering is a variable written by a line** that applies where the request may come: a parent line (lock, 1.5) or a line in the busy state.
- **What it keeps is what it stores.** `wanted = lock` keeps the last request. 2.3's `defer` (never shipped) replayed every deferred request in order. With lock, unlock, lock during one pulse, `defer` gives up to three more pulses; the variable gives none (the lock is already locked). A model that must keep every request writes a counter or an array, explicitly.
- **The smallest honest version** is one variable and one condition in each state that acts on it, as in section 0.

### 1.13 Jumps

- `to S` names a state `S` of the same operation that is in the statement list containing the state where the jump is written, or in an enclosing list, or inside parents that stand directly in one of those lists (owner decision 4). Every construct between the list and `S` must be a parent: never an `if` branch or a loop body.
- Leaving and entering: 3.6. `to P`, where `P` is a parent, enters `P` at its first inner state.
- A jump out of a loop ends the loop; locals of the lists left end; a backward jump that passes a declaration runs it again. A forward jump over a declaration that is used at or after the target is an error.

## 2. How it looks: Flow View

### 2.1 Drawing rules

| Element | Drawing |
| --- | --- |
| Operation | The grey operation frame Flow View draws today. Its header names the operation and **how it is released**: `«operation» control · on start`, `«operation» step · every 10ms`. The release replaces `: () returns void`, which is the same for every operation with states. |
| Decision | An **empty diamond**; every condition `[c]` is written on an outgoing line, never inside. `if / else if / else` is one diamond with one labelled line per branch in written order, `[else]` last; a missing `else` is an `[else]` line to the merge. |
| Merge | A small empty diamond. |
| Plain step, call | Unchanged Flow View nodes. |
| State | A rounded box with a heavier outline, name at the top. Below a thin rule: `entry: …`, `exit: …`, then one line per thing that stays: an event line that does not leave (`query() : publish …`), a statement (`travel = travel + 1`, `if (travel > 0) …`). |
| Parent | The same rounded box, its lines at the top, its inner states drawn inside on a lightly tinted area. An arrow into an inner state crosses the border. |
| Leave | **One arrow per `exit;` or `to S;`**, from the bottom edge, labelled with what leads to it: the event and the conditions on the way, `after 250ms`, `request(lock) [lock]`, `[sense.current > pinchLimit]`. The statements before the leave are written after a slash: `pinchDetected() / pinchReversals + 1`. |
| Event with several leaves | One arrow from the edge with the event label, into an empty diamond, with one `[c]` line per leave. A single leave draws its condition in the label, without a diamond. |
| Numbers | Written order of the leaves, 1, 2, 3, along the bottom edge from left to right. A state with one leave draws no number. |
| `exit;` and `to` the next state | Both drawn straight down; the drawing never shows which spelling was used. |
| Shared lanes | One lane per target state and gutter side; arrows to one target join it with a junction dot; back jumps on the left gutter, skips on the right. |
| Compact box | A state with more than three leaves lists them inside the box (`3 obstructed() → idle`) and draws only numbers on the arrows (owner decision DN of revision 3, still to be tried in P2b against back-jump stubs). |
| End | The final marker; it never appears in a periodic operation (its end is unreachable). |

**Not drawn:** dropped input (nothing is written for it); a timer that has run out; the order "statements before exit actions" (it is the text order, and hover on an arrow says it); `«state»`; the `step:` prefix; the `■` square.

### 2.2 The owner's picture

```text
 «operation» run · on start
                 ●
          [ var ok = false ]
       ╭─────────▼──────────╮
       │ state0             │
       │ entry: send …      │
       ╰─────────┬──────────╯
                 │ go(v) / ok = v
                 ◇
          [ok] ╱   ╲ [else]
   ╭─────────▼──╮ ╭──▼──────────╮
   │ state2     │ │ state1      │
   │ entry: …   │ │ entry: …    │
   ╰─────┬──────╯ ╰──────┬──────╯
         │ after 10ms    │ retry()
         └──────►⋄◄──────┘
           [ process() ]
       ╭─────────▼──────────╮
       │ state4             │
       │ entry: report()    │
       ╰─────────┬──────────╯
                 ◉
```

### 2.3 The lock controller

```text
 «operation» control · on start
               ●
        [ var wanted = false ]
  ╭────────────▼────────────── powered ─────────────────────────╮
  │ status.query() : publish status.report(locked, pulses)       │
  │ requests.request(lock) : wanted = lock                       │
  │  ┌────────►┤                                                 │
  │  │ ╭───────▼───────────────╮                                 │
  │  │ │ unlocked              │                                 │
  │  │ │ entry: locked = false │                                 │
  │  │ ╰───────┬───────────────╯                                 │
  │  │         │ [wanted]                                        │
  │  │ ╭───────▼─────────────────────────╮                       │
  │  │ │ locking                         │                       │
  │  │ │ entry: pulses = pulses + 1; …   │                       │
  │  │ │ exit:  send motor.lockMotor(idle)│                      │
  │  │ ╰───────┬─────────────────────────╯                       │
  │  │         │ after 250ms                                     │
  │  │ ╭───────▼───────────────╮                                 │
  │  │ │ isLocked              │                                 │
  │  │ │ entry: locked = true  │                                 │
  │  │ ╰───────┬───────────────╯                                 │
  │  │         │ [not wanted]                                    │
  │  │ ╭───────▼─────────────────────────╮                       │
  │  │ │ unlocking                       │                       │
  │  │ │ entry: pulses = pulses + 1; …   │                       │
  │  │ │ exit:  send motor.lockMotor(idle)│                      │
  │  │ ╰───────┬─────────────────────────╯                       │
  │  └─────────┘ after 250ms                                     │
  ╰────────────┬─────────────────────────────────────────────────╯
               │ power.off()
       [ reportShutdown() ]
               ◉
```

The query and request lines appear once, in the parent. Six arrows, one back jump.

### 2.4 The window lifter

Schematic, labels shortened; compact boxes list their leaves inside.

```text
 «operation» control · on start
                          ●
   ┌─────────────────────►┤   (one lane: the 22 arrows to idle join it)
   │  ╭───────────────────▼──────────────╮
   │  │ idle          entry: drive(stop) │
   │  ╰───────────────────┬──────────────╯
   │                      │ request(command)
   │                      ◇
   │  [autoUp and oneTouch…] / oneTouchCloses + 1 ──► autoUp
   │  [(manualUp or autoUp) and motion…] ──────────► manualUp
   │  [autoDown and oneTouch…] ────────────────────► autoDown
   │  [(manualDown or autoDown) and motion…] ──────► manualDown
   │  ╭─────────────────────────── moving ─────────────────────────╮
   │  │ ╭───────────────────────── driven ───────────────────────╮ │
   │  │ │ manualUp (6) ▸ autoUp (4) ▸ manualDown (5) ▸ autoDown (4) │ │
   │  │ │ (compact boxes; pinch arrows → reversing, right lane)   │ │
   │  │ ╰───┬─────────────────────────────────────────────────────╯ │
   │  │     │ motionInhibited() / inhibitedStops + 1 → idle          │
   │  │ ╭───────────────────────── reversing ────────────────────╮ │
   │  │ │ entry: drive(down)   (4 leaves → idle)                 │ │
   │  │ ╰─────────────────────────────────────────────────────────╯ │
   │  ╰──┬──────────────────────┬────────────────────────────────╯
   │     │1 sensorFault()       │2 motionStalled() / stalledStops + 1
   └─────┴──────────────────────┘
```

`idle`'s four arrows end on the top edges of the inner states, crossing the borders of `moving` and `driven`.

### 2.5 The mode manager

```text
 «operation» modes · on start
                ●
  ╭─────────────▼─────────────────── system ──────────────────╮
  │  ┌─────────►┤                                             │
  │  │ ╭────────▼─────────────────╮                           │
  │  │ │ off                      │                           │
  │  │ │ entry: send mode(off)    │                           │
  │  │ ╰────────┬─────────────────╯                           │
  │  │          │ key.ignitionOn()                            │
  │  │ ╭────────▼──────────────── powered ──────────────────╮ │
  │  │ │  ┌─────►┤                                         │ │
  │  │ │  │ ╭────▼──────────────╮                          │ │
  │  │ │  │ │ standby           │                          │ │
  │  │ │  │ ╰──┬──────────┬─────╯                          │ │
  │  │ │  │    │1 cmd.go  │2 diag.enter() ──────────┐      │ │
  │  │ │  │ ╭──▼───────────────╮                     │      │ │
  │  │ │  │ │ running          │                     │      │ │
  │  │ │  │ │ exit: enable(f…) │                     │      │ │
  │  │ │  │ ╰──┬──────────┬────╯                     │      │ │
  │  │ │  ├────┘1 halt    │2 diag.enter()            │      │ │
  │  │ │  │ ╭─────────────▼────╮◄────────────────────┘      │ │
  │  │ │  │ │ diagnostic       │                            │ │
  │  │ │  │ ╰──┬───────────────╯                            │ │
  │  │ │  └────┘ diag.leave()                               │ │
  │  │ ╰──┬───────────────────────────────────────────────╯ │
  │  └────┘ key.ignitionOff()                               │
  ╰───────┬─────────────────────────────────────────────────╯
          │ ecu.shutdown()
  [ send status.mode(off) ]
          ◉
```

### 2.6 Anti-pinch

```text
 «operation» control · on start
             ●
   ┌────────►┤
   │ ╭───────▼───────────────────╮
   │ │ idle                      │
   │ │ entry: drive(stop)        │
   │ ╰───────┬───────────────────╯
   │         │ request(c) [c == autoUp]
   │ ╭───────▼───────────────────╮
   │ │ closing                   │
   │ │ entry: drive(up)          │
   │ ╰───┬────────────┬──────┬───╯
   │     │1 [sense.   │2     │3 after 8s
   │     │ current >  │request(c)
   │     │ pinchLimit]│[c == halt]
   │     │ / pinchReversals + 1
   ├─────┼────────────┴──────┘
   │ ╭───▼───────────────────────╮
   │ │ reversing                 │
   │ │ entry: drive(down)        │
   │ ╰───┬───────────────────────╯
   └─────┘ after 400ms
```

The filtered variant is the same drawing with `[motorCurrent > pinchLimit]`.

### 2.7 The 10 ms window controller

```text
 «operation» step · every 10ms
             ●
   ┌────────►┤
   │ ╭───────▼───────────────────────────╮
   │ │ idle                              │
   │ │ entry: send motor.drive(stop)     │
   │ ╰───┬────────────────────┬──────────╯
   │     │1 [position == up   │2 [position == down
   │     │   and travel < …]  │   and travel > 0] ──────────────┐
   │ ╭───▼───────────────────────────────╮                      │
   │ │ closing                           │                      │
   │ │ entry: send motor.drive(up)       │                      │
   │ │ travel = travel + 1               │                      │
   │ ╰───┬──────────────┬───────────┬────╯                      │
   │     │1 [sense.     │2 [position│3 after 8s                 │
   │     │ current > …] │ != up or …]                           │
   │     │              └───────────┴──► idle (left lane)       │
   │     └──► reversing (right lane)                            │
   │ ╭───────────────────────────────────╮◄─────────────────────┘
   │ │ opening                           │
   │ │ travel = travel - 1               │
   │ ╰───┬───────────────────────────────╯
   ├─────┘ [position != down or travel == 0]
   │ ╭───────────────────────────────────╮
   │ │ reversing                         │
   │ │ if (travel > 0) travel = …        │
   │ ╰───┬───────────────────────────────╯
   └─────┘ after 400ms
```

No end marker: a periodic machine never ends.

### 2.8 The traffic light

```text
 «operation» cycle · on start
            ●
   [ var requested = false ]
  ┌────────►◇ [true]
  │ ╭───────▼──────────────── green ────────────────╮
  │ │ entry: send lamps.set(green)                  │
  │ │ ped.button() : requested = true               │
  │ │ ╭────────────╮                                │
  │ │ │ minimum    │                                │
  │ │ ╰─────┬──────╯                                │
  │ │       │ after 10s                             │
  │ │ ╭─────▼──────╮                                │
  │ │ │ extended   │                                │
  │ │ ╰─────┬──────╯                                │
  │ ╰───────┼──────────────┬────────────────────────╯
  │         │ [requested]  │ after 60s
  │         ⋄◄─────────────┘
  │ ╭───────▼──────╮  ╭──────────────╮
  │ │ yellow  3 s  │─►│ red  2 s     │  (each: after … )
  │ ╰──────────────╯  ╰──────┬───────╯
  │                          ◇
  │           [requested] ╱     ╲ [else]
  │ ╭────────▼─────────╮          │
  │ │ walk             │          │
  │ │ entry/exit: …    │          │
  │ ╰────────┬─────────╯          │
  │          │ after 15s          │
  │ [ requested = false ]         │
  │          └──────►⋄◄───────────┘
  └──────────────────┘
```

### 2.9 The connection manager

```text
 «operation» manage · on start
            ●
  ┌────────►◇ [true]
  │ [ attempt = 0; backoffMs = 10; up = false ]
  │ ┌──────►◇ [attempt < 5 and not up]
  │ │ [ attempt = attempt + 1 ]
  │ │ [ publish link.hello(attempt) ]
  │ │ ╭─────▼───────────────────────╮
  │ │ │ awaiting                    │
  │ │ ╰─────┬─────────────────┬─────╯
  │ │       │1 ack(id)        │2 after (backoffMs * 1ms)
  │ │       │ [id == attempt] │ / if (backoffMs < 1000) …
  │ │       │ / up = true     │
  │ │       ⋄◄────────────────┘
  │ └───────┘
  │         │ [else] (loop ends)
  │         ◇
  │    [up] ╱ ╲ [else]
  │ ╭────▼──────────────╮  ╭───▼──────────╮
  │ │ connected         │  │ cooldown     │
  │ │ entry/exit: …     │  ╰───┬──────────╯
  │ ╰────┬──────────────╯      │ after 30s
  │      │ link.down()         │
  │      └──────►⋄◄────────────┘
  └──────────────┘
```

### 2.10 Editing gestures

Every gesture is one whole-workspace edit, validated before it is applied, with a dry-run preview (`swaml/previewEdit`) that lists every number and target that changes.

| Gesture | Text edit |
| --- | --- |
| Add a state as a step | Inserts `state X { <event> { exit; } }` at the drop position; the preview names the statement whose successor changes. |
| Add a leave | Adds `to S;` (or `exit;`) at the end of an event line's block, or a new event line; inside an existing chain, as a new `else if` branch. |
| Add a staying line or statement (box "+") | Writes `on receive m(x) { }`, `after D { }` or a statement. |
| Retarget a leave (drag its end) | Rewrites that one `to S;`/`exit;`. Illegal targets are refused with SIF-D03's message. |
| Reorder | Moves an item; the preview says which numbers change. |
| Move or delete a state | Keeps behaviour by writing explicit `to` where a successor would change, or refuses. |
| Group into a parent | Wraps consecutive states of one list in `state P { … }`; refused when plain flow stands between them. |
| Move a common line to the parent | Replaces an identical event line (text equal) in every inner state by one line on the parent; offered only when every inner state has it. |
| Short form (if O1 is adopted) | An edit that adds a statement to a body written without braces writes the braces. |

## 3. Meaning: rules of the execution contract

The meaning is defined natively, as additions to chapter 6 of the specification.

**Terms.**
- An **operation with states** is an operation whose body contains a state.
- **Items** of a state: its `on entry` and `on exit` blocks, event lines and statements, in written order, before its inner states.
- The **levels** of a state S: each parent that encloses S, outermost first, then S.
- S **has something to look at** when some level of S has an event line or a statement.
- A member is **named** at S when some level of S has an `on receive` line on it. A member is **owned** by the operation when some line of the operation names it.
- A **look** at S is one pass over the items of S's levels (3.3).

### 3.1 Which operations may contain states (SIF-S01)

An operation with states:
- is directly owned by a component definition, has no parameters and returns `void`;
- has exactly one effective schedule entry in every occurrence of its component: `on start` (**waiting** machine) or `on every P`, with or without `deadline` and a WP7 release guard, never `concurrent` (**periodic** machine);
- is never called: not by an operation, a helper, a guard, a schedule argument or a case script;
- contains no interrupt region and no plain receive statement.

Case scripts contain no states. Other entry kinds are errors with a message (SIF-D11):
- `on receive x(…) op();`: "`op` contains states, so it keeps its place between releases and can only be released by one `on start` or one `on every` entry. To react to `x`, write `on receive x(…) { … }` in its states."
- `after pred op();`: "… To start after `pred`, release `op` on start and let its first state wait for a value that `pred` sets."
- `on call p.m(…) op();`: "… An operation with states cannot answer calls; answer in a plain operation and let it set an attribute that a state reads."
- No entry, two entries, `concurrent`: "… needs exactly one `on start` or one `on every` entry, not concurrent."

**Why no plain receive statement.** It is the only construct with another input rule (exclusive ownership, input kept after the operation ends). A one-line state replaces it: `state waitGo { on receive cmd.go(v) { ok = v; exit; } }`. Plain operations keep their receive statements.

**Consequence.** There is one current state per occurrence and operation, so `machines["c.op"]`, the trace subject and the Timing track stay well defined.

### 3.2 Reaching a state (SIF-R01)

When the flow, a leave or a jump reaches state X at time t:
1. record a `state` observation (`source` the state, `trigger` the line or statement that led here, if any);
2. set X's timer start to t;
3. run X's `on entry` (it may suspend; input arriving meanwhile stays queued);
4. evaluate X's computed `after` durations once (WP4-R02);
5. then:
   - **X is a parent:** reach its first inner state;
   - **X has nothing to look at:** run its `on exit`, continue with the next statement (a named step);
   - **otherwise:** make the **arrival look** (3.3); if it does not leave, X waits (3.4) in a waiting machine, or the release ends in a periodic machine.

Entering parents on the way to a target (direct entry, 3.6) runs steps 1 to 4 for each parent, outermost first, without step 5.

### 3.3 The look (SIF-R02, SIF-R03)

A look at S goes through the levels of S, outermost first; within a level, through its items in written order, skipping `on entry` and `on exit`:
- an **event line runs** when its event is present at this look (below); its bindings hold the message's payload in its block;
- a **statement runs**, always;
- the look **ends at the first `exit;` or `to S;` it runs** (leaving, 3.6), or after the last item of S.

**What is present at a look:**
- **At most one message:** the message whose delivery caused the look, or, for a zero-time look at the start of a wait, the first-delivered queued message of a member named at S. Every event line on its member, at any level, runs, in walk order.
- **Every timer** of a level of S that has run out since that level's arrival and has not been present at an earlier look. A timer is present at one look per arrival of its level.
- **At the arrival look:** no message; timers that ran out while `on entry` was suspended.
- **At a look caused by a value change (wake):** no message, no new timer.

**Statements are not events.** A statement does not need anything to be present: it runs at every look. `if (c) { … }` in a state is checked at every look.

**What a look writes it sees afterwards, not before.** A statement sees the values as they are when it runs, including what earlier items of this look wrote. Writes made by the look itself never cause another look (3.5); a statement written before the item that writes what it reads sees the change only at the next look (SIF-D09 warns).

**A look runs to completion** (SIF-R14). It holds the component lock, except while a block suspends (`wait`, a request, a suspending call). During that suspension nothing else of the operation is looked at; what happens meanwhile is seen at later looks.

### 3.4 When a waiting machine looks (SIF-R04, SIF-R05; B1, B2)

After the arrival look and after any look that did not leave, S **waits**. When it begins to wait, in this order:
1. **Timers that ran out** and have not been present: one look now, in zero time, with all of them present.
2. Otherwise, **queued messages of owned members not named at S** are dropped, in delivery order (`discardInput`, reason `inactiveOwner`).
3. Otherwise, if a **message of a member named at S is queued**, the wait ends in zero time (the component lock is released; the wait end is an event of the same instant, phase 2, next insertion ordinal), and at that event a look is made with the **first-delivered such message at that moment** (it is picked again, so a delivery that replaced or overflowed a queue meanwhile is respected).
4. Otherwise S waits without the lock until one of:
   - **a timer of a level of S runs out** (phase 1): a look with it;
   - **a message of a member named at S is delivered** (phase 2): a look with it;
   - **a delivery of an owned member not named at S**: dropped on arrival (`inactiveOwner`), no look;
   - **a wake** (3.5): a look with nothing present.

**Consequences.**
- **One message per look, in delivery order** (B1). Three messages delivered at one instant, or three messages queued while the operation was busy, give three looks in delivery order, each of them at the level structure current at that moment. Parents first orders only the lines that run at one look.
- **Timer before same-instant delivery** (2.2): a timer that runs out at t is looked at in phase 1, before deliveries at t.
- **No starvation** (B2): a look runs every present line and statement; the next look after a suspended block begins with the timers that ran out meanwhile.
- **Input arriving while the operation is busy** (plain flow, blocks, entry and exit actions, suspended calls) stays queued and is decided by the next state that waits: looked at if named there, dropped otherwise (P1: drop only while waiting).

### 3.5 Values that are re-checked: wakes (SIF-R06)

**What statements in a state may read (SIF-S05).** Attributes of the executing occurrence, whoever writes them; sampled port members (WP6-S01); locals visible at the statement; constants; calls of operations that are pure or read state. Not `now()` (time wakes nothing; use `after`), not a non-sampled port member. An event line's block may also read its bindings, and anything a block may read in 2.2.

**Read set.** Per effective occurrence: the attributes and sample cells (port occurrence, member) read by the statements standing in the levels of S, directly or through called operations, after specialization and redefinition, with the scope rules (a local or binding hides an attribute of the same name). Locals are not in the read set: only the machine writes them.

**The read set must be exact.** In revision 3 an extra wake was harmless, because every condition was false again. Here a look also runs statements that act (`travel = travel + 1`, `if (alarm) { publish … }`), so an extra look changes behaviour. The read set is therefore defined by names, statically, and the wake by **writes, not changes**: an assignment of an equal value still wakes.

**Wakes, waiting machines only.** A waiting state S makes a look with nothing present when, at time t:
- **another activation of the same occurrence wrote an attribute in S's read set**, at the end of that activation's segment (its unlock at suspension, completion or failure). Case-script calls of the subject's operations and white-box helper calls, which run in the script's activation (6.7), wake at every unlock of the call, at its suspensions as well as at its return;
- **a sample cell in S's read set is updated** (WP6-R02), at its delivery event.

Writes by the machine itself never wake it. Periodic machines are never woken: they read the values at each release.

### 3.6 Leaving, jumps and entering (SIF-R07, SIF-R08; B4)

**Leaving runs in the order of the text.** When a look runs `exit;` or `to T;` written at level L of S (L is S or a parent of S):
1. the statements written before it in the same block have already run;
2. **`on exit` of every state left, innermost first**: S, each parent up to and including the states the leave goes out of;
3. the **target is reached**, entering every parent on the way outermost first (3.2), then the target itself.

**What `exit;` goes on with.** `exit;` at level L leaves L. If L is an inner state and not the last of its parent, the next inner state is reached. If it is the last, the parent is left too, as by `exit;` written on the parent, and so on outwards. If L stands in a statement list of the flow, the next statement runs.

**What `to T;` leaves and enters.** All states from S up to (not including) the innermost statement list that contains both the jump and T's outermost enclosing parent (or T itself) are left, innermost first; then T's enclosing parents below that list are entered, outermost first; then T. `to P`, P a parent, enters P and reaches its first inner state.

**One order for one arrow** (B4). `exit;` from the last inner state of P and `to N;` with N the statement after P now run the same steps in the same order: block, inner `on exit`, P's `on exit`, N. Section 2.9 of revision 3 ("one logical exit, one spelling") is no longer a rule; the spellings are equivalent.

**Unwinding** (SIF-R08). A jump ends every block, loop and parent between it and the list that contains the target. A loop ended this way does not run its condition, update or remaining iterations; its counter and locals end. Locals live from their declaration to the end of their statement list; a backward jump that passes a declaration runs it again; locals declared before the target keep their values.

**Leaving adds no scheduling point** (P1 defect D3): steps 2 and 3 run in the segment of the look, unless an exit or entry action suspends.

### 3.7 Parents (SIF-R09; B5, B6)

- **Shape:** a parent's braces hold its items, then its inner states only. There is no plain flow between inner states.
- **Order:** the parent's items are looked at before the inner state's, at every look (parents first, Stateflow's order). A parent line on a member that an inner state also names runs first; if it leaves, the inner line does not run.
- **Shielding:** a parent that must not leave in one inner state guards its own line: `on receive key.ignitionOff() { if (not flashing) { exit; } }`, while the inner state `flashing` remembers it: `on receive key.ignitionOff() { offPending = true; }`.
- **Timers of a parent** count from the parent's arrival, keep running while its inner states change, and are present at one look per parent arrival.
- **A state inside a parent with something to look at waits** (B6), even if it has no items itself.
- **What parents do not guard** (B5): a parent's lines are looked at only at looks. While an `on entry`, `on exit` or block of a state inside it is suspended, nothing is looked at; a fault delivered meanwhile is looked at when the state waits again. This is 2.2's run to completion. A step that must be interruptible is written as its own state.

### 3.8 Periodic machines (SIF-R10, SIF-R11; B3)

**One persistent activation.** An operation with states released by one `on every P` entry is one activation per occurrence, created at the first release and never completed:
- Its **place** (the statement path, the levels), **locals**, **loop state** (iteration, `n times` counters, `for in` snapshots) and **timer starts** live between releases, exactly as in a waiting machine that waits.
- **Between releases it waits** in its current state, like a waiting machine, except that nothing but the next release ends the wait. The 2.2 waiting frame therefore also drops: unhandled deliveries are dropped on arrival and unhandled queued messages when the wait begins (no frame-less mechanism is needed).
- **Trace:** one activation identity for the life of the machine; each release records its `release` (or WP7 `skip`) observation and its deadline; observations of a release's look name the activation and that release.

**A release:**
1. **The first release** runs the flow from the first statement to the first state that waits, including entries and the arrival look.
2. **Every later release** makes one look at the current state with what is present (3.3): timers that ran out since the last look, the first-delivered queued message of a named member (one per release), the current values of attributes and sample cells (first read in the segment, WP6-R03).
3. **A look that leaves** reaches the next state in the same release, with its entry and its arrival look, until a state waits.

**Rules:**
- **Timers** count in time from their level's arrival and are present at the first release at or after it (rounded up to the period; SIF-D12).
- **Input:** at most one message per release; named messages queue under their route policy. A rejecting route into a periodic machine can make the sender fail when messages arrive faster than one per period on average, or while a release guard is false: SIF-D01 warns for every rejecting route that delivers a member named in a periodic machine.
- **Deadline** per release (default the period) covers its look and the states reached in that release. A release that comes while the previous look is suspended waits for it (2.2 backlog rule); its deadline is measured from its release time.
- **Release guards** (WP7): a false guard is a `skip`: no look; place, timers and queues unchanged; timers keep counting in time.
- **The end is unreachable** (SIF-S07, SIF-D04): a periodic operation with states may not reach the end of its body, contain `return`, or `exit;` from a state after which the end is reachable. It runs for as long as its component. This removes revision 3's "completion restarts at the top" and gives the end marker one meaning.
- **`concurrent`** is rejected (SIF-S01).
- **`after` successors** are released after each release's look (a `skip` counts, WP7-R03).

**Same text, both modes.** A statement in a state runs at every look in both modes. A waiting machine looks at irregular moments (messages, timers, wakes), a periodic one at every release. The frame header shows which (2.1); a bare action in a waiting machine is warned (SIF-D08).

### 3.9 Looking forever in zero time: `StateLoop` (SIF-R13)

**Where it can happen.**
- A chain of arrivals whose arrival looks leave at once (`state a { if (ready) { to b; } } state b { if (ready) { to a; } }`).
- Two waiting machines of one occurrence that wake each other (A: `if (n == 0) { n = 1; }`, B: `if (n == 1) { n = 0; }`).
- Not inside one state alone: a look never causes another look of its own state, and a waiting state's next look needs something to happen.

**Rule.** The contract violation **`StateLoop`** is raised at a look of state S when the **configuration** of the occurrence equals its configuration at an earlier look of S in the same instant, with only this occurrence's own activity between the two looks (no delivery from another occurrence, no reply, no timer of another occurrence). The configuration is: the occurrence's attributes and sample cells; its input queues by member, payload and order (not by message identity); for each of its activations, its place, locals, loop state and timer starts. An equal configuration with nothing external in between repeats forever, so the rule never stops a loop that would end. It stops the run and bypasses `try`, like the other contract violations.

**Allowed (bounded):** a drain by re-arrival `state draining { if (backlog > 0) { take(); to draining; } … }`; a retry counter; a four-step handshake between two machines of one occurrence.

**Stopped:** the arrival ping-pong above; the wake ping-pong `n = 1 - n`.

**Known misses** (they end at the step limit, like a plain `while (true)`): loops whose configuration grows (`n = n + 1`); loops whose looks make zero-latency requests to another occurrence (each reply is external).

**Cost.** Hashing is needed only from the second look of one state in one instant; P4 measures it on the door showcase.

**Static check** (SIF-D06): a cycle of states whose arrival looks leave without any condition (`exit;` or `to` standing directly in the braces) is an error.

### 3.10 Inputs (SIF-R05)

| Where | What happens to a message |
| --- | --- |
| Plain operation | Unchanged 2.2: a receive statement owns its members; input stays queued, also after the operation ended. |
| Operation with states, busy (plain flow, blocks, entry, exit, suspended call) | Stays queued under its route policy. |
| A state begins to wait | Queued messages of owned members not named at it are dropped (`inactiveOwner`); named ones are looked at one by one in zero time (3.4). |
| A state waits | A delivered message of a named member causes a look; one of an owned member not named is dropped on arrival (`inactiveOwner`). |
| Taken by a look, and no statement ran in its lines except `if` tests that were false | Recorded `discardInput`, reason `noEnabledTransition` (the 2.2 case "no guard holds"). |
| Waiting machine after it completed | Queued and later messages of its members are discarded (`inactiveOwner`), as after a 2.2 final state. |
| Periodic machine between releases | It waits: the two rows above apply; named messages wait for the next release, one per release. |

Members that no line of the operation names are untouched. Requests and calls never reach a state: `on receive` names events and attributes only, and an operation with states has no `on call` entry.

### 3.11 Trace (SIF-T01 to SIF-T06)

- **`state`** at each arrival, also for each parent entered (outermost first), `source` the state, `trigger` the leave that led there.
- **`state` with `stay: true`** when a look that had a message or a timer present ran a statement of its line and did not leave (`source` the line). Looks caused by arrival, wakes or releases add no observation of their own.
- **`discardInput`** with the 2.2 reasons `inactiveOwner` and `noEnabledTransition` (3.10).
- **`violation`** `StateLoop`, subject the operation, `source` the state.
- **Periodic:** one activation per machine; `release` and `skip` per release.
- **Never:** `defer`, `discardTimer`, `CompletionLoop`.
- **`machines["c.op"]`** is the innermost current state.

## 4. Rules

IDs: SIF (states in flow). G grammar, S static, R runtime, D diagnostic, T trace. Revision 4 renumbers; 4.7 lists what was deleted.

### 4.1 Grammar delta (SIF-G01, text only)

```text
State:      'state' Name '{' Documentation? StateItem* State* '}';
StateItem:  'on' 'entry' Block
          | 'on' 'exit' Block
          | EventLine
          | Statement;
EventLine:  'on' 'receive' MemberPath '(' (Name (',' Name)*)? ')' Body
          | 'after' (Duration | '(' Expression ')') Body;
Body:       Block
          | Leave;                                  // short form (decision O1): exit; or to S; without braces
If:         'if' '(' Expression ')' Body ('else' (If | Body))?;
Statement:  … | State | Leave;                      // If, loops and the rest unchanged
Leave:      'exit' ';' | 'to' Name ';';
Removed:    the 'initial' Name ';' State+ body, 'final', Transition with its 'to' head and 'when' guard,
            completion 'when (g) to S', Deferral ('defer'), and 'when' in every position.
```

**Parse notes.**
- Inside a state's braces, items come first, inner states last: after the first inner state only states may follow (SIF-S03). The parser never guesses: `on entry`, `on exit`, `on receive`, `after` start their items; everything else is a statement.
- `after` cannot start a statement elsewhere; `on receive` inside a state's braces is always an event line (plain receive statements are forbidden in operations with states).
- Without O1, `Body` is `Block` only.
- **Plain receive statements** in plain operations keep their meaning; their 2.2 branch guard `when (g)` is respelled `if (g)` in the same position by the migrator, so that `when` leaves the language. Its meaning (which branch takes a message) is unchanged; SIF-1 must state it in the new wording.

### 4.2 Static rules

| ID | Rule |
| --- | --- |
| SIF-S01 | Which operations may contain states (3.1); case scripts contain no states. |
| SIF-S02 | A state has at most one `on entry` and one `on exit`. State names are unique within an operation. |
| SIF-S03 | A state's braces hold items, then inner states only. |
| SIF-S04 | `exit;` and `to S;` stand only inside a state: as the last statement of an event line's block, of an `if` or `else` block nested in such a block or standing in the state's braces, or directly in the state's braces. Not in `on entry`, `on exit`, loop bodies or the flow outside states. |
| SIF-S05 | What statements standing in a state may read (3.5): not `now()`, not a non-sampled port member. |
| SIF-S06 | Jump targets (1.13): a state in a list containing the jump's state or an enclosing list, or inside parents standing directly in such a list; never through an `if` branch or loop body; never over a declaration used at or after the target. |
| SIF-S07 | A periodic operation with states cannot reach its end and contains no `return`. |
| SIF-S08 | An event line's bindings are visible in its block only. |
| SIF-S09 | (O1 only) A body without braces is exactly `exit;` or `to S;`. |

### 4.3 Runtime rules

| ID | Rule |
| --- | --- |
| SIF-R01 | Reaching a state: observation, timer start, entry, computed timers, then parent, named step or arrival look (3.2). |
| SIF-R02 | A look: levels outermost first, items in written order; present event lines and every statement run; ends at the first leave (3.3). |
| SIF-R03 | Present: at most one message; every timer that ran out and was not present before, once per arrival of its level (3.3). |
| SIF-R04 | Waiting: on beginning to wait, timers first, then drop, then queued named messages one by one in zero time with re-pick; then timer (phase 1), delivery (phase 2) and wake looks (3.4). |
| SIF-R05 | Inputs: dropped only while a state waits; the regimes of 3.10. |
| SIF-R06 | Wakes (waiting machines): writes of the read set by another activation of the occurrence at its unlock (borrowed calls at every unlock) and sample-cell updates (3.5). |
| SIF-R07 | Leaving in text order: block, `on exit` innermost first, entries outermost first, target (3.6). |
| SIF-R08 | Unwinding of blocks, loops and parents; locals (3.6). |
| SIF-R09 | Parents: entered at their first inner state or directly; their items first at every look; their timers per parent arrival (3.7). |
| SIF-R10 | Periodic: one persistent activation; first release runs to the first waiting state; later releases make one look (3.8). |
| SIF-R11 | Periodic timers, input, deadline, backlog and release guards (3.8). |
| SIF-R12 | Waiting completion: the end of the body or `return` completes the operation once; then its members' input is discarded; `after` dependents are released. |
| SIF-R13 | `StateLoop` on an equal configuration at a look of the same state in one instant with only own activity between (3.9). |
| SIF-R14 | A look runs to completion holding the lock, except while a block suspends; leaving adds no scheduling point. |

### 4.4 Diagnostics

| ID | Code | Rule and message shape |
| --- | --- | --- |
| SIF-D01 | SW2018, warning | A member named in a periodic machine is delivered over a route that rejects on overflow: `{member} is taken one per release by {op}; a faster sender, or a false release guard, fills its queue and makes the sender fail.` |
| SIF-D02 | warning | An `on receive` line on a member that no connection delivers to this occurrence. |
| SIF-D03 | SW2008 | Leave and jump violations (SIF-S04, SIF-S06), e.g. `` `to c` skips the declaration of `x`, which `c` uses. Declare `x` before the jump. `` |
| SIF-D04 | SW2008 | Periodic end reachable (SIF-S07): `{op} runs every {P} and keeps its place; it must not reach its end. Loop with while (true) or jump back with to.` |
| SIF-D05 | warning | Waiting machine whose body contains a loop or back jump around states, where a leave reaches the end of the operation: `{state} can fall through to the end of {op}; afterwards its inputs are discarded.` |
| SIF-D06 | SW2008 | A cycle of states whose arrival looks leave without a condition. |
| SIF-D07 | warning | Unreachable item, statement or state (after an unconditional leave, after the first inner state, a target nothing reaches). |
| SIF-D08 | warning | Waiting machine: a statement standing in a state that runs at every look without leaving and without changing what decides whether it runs (a bare action, or an `if` whose block writes nothing its condition reads): `{statement} in {state} runs again at every look (arrival, each message, timer or change it reads). To run it once, move it into on entry; to stop, add exit;.` |
| SIF-D09 | warning | A statement reads a value that an item written after it in the same look (same or inner level) writes: `{statement} in {state} is checked before {item} writes {value}; it sees the new value only at the next look. Move it after {item}.` |
| SIF-D10 | warning | A state that waits for good: no level has a leave, or every leave depends only on values nothing can write while it waits and no event line can leave: `{op} stays in {state} for good once it gets there.` |
| SIF-D11 | SW2008 | Operation-kind violations of SIF-S01 with the messages of 3.1. |
| SIF-D12 | warning | Periodic: `after D` whose constant value is not a multiple of the period: `after {D} in {state} is looked at every {P}; it is taken after {rounded}.` |
| SIF-D13 | SW2008 | (O1 only) A body without braces that is not `exit;` or `to S;`: `Only exit; or to S; may stand without braces; write { … }.` |
| SIF-D14 | SW2006 | A statement standing in a state reads `now()` or a non-sampled port member (SIF-S05): `{statement} in {state} reads {what}, which wakes nothing; use after D, or a sampled member.` |

All diagnostics are evaluated per effective occurrence, since a redefinition can change the schedule entry (review I4).

### 4.5 Trace

| ID | Observation |
| --- | --- |
| SIF-T01 | `state` at each arrival and parent entry (`source`, `trigger`). |
| SIF-T02 | `state` with `stay: true` for a look with a message or timer whose line ran a statement and did not leave. |
| SIF-T03 | `discardInput` with the 2.2 reasons `inactiveOwner` and `noEnabledTransition`. |
| SIF-T04 | `violation` `StateLoop`. |
| SIF-T05 | Periodic: one activation; `release`/`skip` per release; `timer` (WP4-T01) for computed durations. |
| SIF-T06 | No `defer`, `discardTimer` or `CompletionLoop`. |

### 4.6 Keywords of the behaviour language, before and after

Words of operations, flow, states and schedules; types, structure, requirements and views are unchanged.

| Word | 2.2 | 2.3 candidate (main + WP7) | 3.0 (this proposal) |
| --- | --- | --- | --- |
| `operation`, `returns`, `var`, `const`, `return` | yes | yes | yes |
| `if`, `else`, `while`, `until`, `for`, `in`, `times` | yes | yes | yes (`if` is also every guard) |
| `wait`, `on`, `receive`, `or`, `after`, `send`, `publish` | yes | yes | yes |
| `try`, `assert`, `fail`, `interruptible` | yes | yes | yes |
| `true`, `false`, `not`, `and` | yes | yes | yes |
| `schedule`, `start`, `every`, `call`, `deadline`, `concurrent` | yes | yes | yes |
| `state`, `entry`, `exit`, `to` | yes | yes | yes (`exit;` and `to S;` are statements) |
| `when` | yes (guards) | yes (guards, completion, release guards) | **removed** (respelled `if`) |
| `initial`, `final` | yes | yes | **removed** |
| `defer` | no | yes (WP5) | **never ships** |
| anything new | | | **none** |

Net change against 2.2: three words fewer, none added.

### 4.7 Deleted with this revision

| Revision 3 | Why it is gone |
| --- | --- |
| Line heads `exit`/`to S` with an optional block; the bare-`;` error (S03) | One form: a block; leaving is a statement. |
| Guards on event heads `on receive m(x) if (g)`, `after D if (g)`; SIF-R16 (a false timer guard consumes nothing) | Guards are `if` inside the block; a timer is a moment. |
| Condition lines as a line kind, `if (true) { … }` per-step action, SIF-D13, SIF-D17 (arrival step trap) | Statements in a state run at every look; per-step work is written plainly; the arrival look runs it. |
| The input group, "first handling level", contiguous receive lines (S06), "first ready entry is taken" | One message per look; every present line runs. |
| Choice made at the first event that makes a line ready (R04) | Per-event looks, which need no "ready" notion. |
| A fired staying timer "disarmed for the rest of its level's entry" (R05) | A timer is present at one look per arrival by definition. |
| Operation-level lines, SIF-S11, the shared receive node, the `■` frame exit | Exits for several states are parent lines. |
| "A parent's inner flow starts with a state"; plain flow inside parents; SIF-S09, SIF-S10; SIF-D18 | Parents hold items and states only. |
| "After a jump only a jump target may follow" (S07 part); flow-level `to S;` | Leaves stand only in states; SIF-D07 covers unreachable code. |
| "One logical exit, one spelling" (2.9) and its migrator step | The spellings are equivalent once leaving runs in text order. |
| Periodic completion restarting at the top (R21, DE) | The end of a periodic machine is unreachable. |
| SIF-D06 dead lines, SIF-D11 (nothing can change), SIF-D12 (always false), SIF-D14 (old), SIF-D19 | Replaced by SIF-D07, D08, D09, D10; constant conditions are ordinary lints. |
| StateLoop "at a condition take" | StateLoop at looks. |

## 5. Where the model does not hold, and what surprised me

The model ("`if` never waits; the state looks again each time something happens to it") is complete for every example in this document. These are the places where it needs a second sentence, or where a reader will be surprised.

1. **A look does not look again after its own writes.** A statement written before the line that changes what it reads sees the change only at the next look. Making the state look again after its own writes would restore zero-time loops inside one state (the alarm `if (alarm) { publish … }` would repeat forever) and bring `StateLoop` into every state. Written order is the rule; SIF-D09 points at the wrong order.
2. **Timers are moments, not conditions.** `after 10s { if (requested) { exit; } }` checks once, at 10 s. "From 10 s on, as soon as requested" needs a parent timer and an inner state (traffic light, 1.10). This is honest (2.2 timers are moments too) and costs one inner state; the alternative ("`after D` is present at every look from D on") would make `after 1s { send x(); }` repeat at every later look.
3. **Extra looks are not harmless.** Because statements act at every look, what causes a look is behaviour. Read sets must be exact and wakes counted by writes, not by changes (3.5). Revision 3 could over-approximate; this revision cannot. This is the main risk of P4.
4. **The same text runs at different moments by mode.** `travel = travel + 1;` in a state counts releases in a periodic machine and counts events in a waiting machine. The meaning is the same ("at every look"), the moments differ. SIF-D08 warns about the waiting case; the frame header shows the mode.
5. **Leaving runs in text order,** so a line's statements run before the state's `on exit`. That is what the text says, and it is forced by the block form, but readers trained on UML expect exit actions first. The migrator copies 2.2 exit actions to keep 2.2 results (7). The drawing cannot show this order; hover says it.
6. **One message per look removes revision 3's priority puzzle,** but parents first then only orders lines on the same message, timers and statements. Three messages delivered at one instant are handled one after another in delivery order: sample 7 Q4 now passes through `running` for zero time, which an actuator trace shows.
7. **The periodic arrival look** runs a state's per-step work in the release that reaches it. Stateflow does not (its `during` actions skip the entering step). The model is uniform across modes; Stateflow readers will be surprised once.
8. **Named steps** remain the one special case: a state with nothing to look at does not wait. Without it, the owner's `state4` would wait for ever.
9. **"`if (something)` waits for something"** holds only when the `if` stands in a state's braces and its block leaves: `state s { if (something) { exit; } }`. In `on entry`, `on exit`, a line's block or the flow, an `if` is checked once. The reader can see which: the enclosing braces.
10. **Surprise in the right direction:** with one message per look, the window lifter with parents behaves exactly as the 2.2 machine (no member is named on two levels), where revision 3 changed contested choices.
11. **The read set of a statement that calls a helper** includes what the helper reads; a helper that reads many attributes makes a state look often. The diagnostic SIF-D08 covers acting statements; looks that only test conditions are cheap.

## 6. Compatibility: what is measured and what must be rerun

**P1** (native interpreter of flat waiting states with the drop rule and the migrator; 263 executed results, 115 from 2.2 machines) measured **0 verdicts and 1 final store** (r10, delivery order), all other results identical with order-sensitive digests.

| Part of P1's result | Still applies to revision 4? |
| --- | --- |
| Drop only while waiting (DW); r5 parity | **Yes.** Same rule (3.4 step 2). |
| Delivery order across members (the r10 change) | **Yes.** One message per look in delivery order. |
| Timer before same-instant delivery | **Yes.** Phase 1 looks. |
| Zero-time wait for queued input (AY) | **Partly.** P1 took the message it had picked before the wait; revision 4 picks again at the wait end. **Rerun** with re-pick, and the capacity-1 `dropOldest` overflow case. |
| Migrated text: heads `exit`/`to S` with blocks; several lines per member | **No.** Revision 4 writes one line per member with an `if` chain and leaves as statements. Equivalent on paper (a look sees one message; the chain is in declaration order); **rerun** with the new migrator. |
| Exit, effect, entry order | **No.** Revision 4 runs the block before `on exit`; P1 ran 2.2's order. Revision 1 measured "block first" without copying exit actions at 1 verdict and 2 stores. **Rerun** with the migrator copying exit actions (7 step 4); expected 0. |
| Named steps for finals, dead-timer removal, refusal of dead ends | **Yes.** |
| Reason names `ignored`/`guard` | Names only: mapped to `inactiveOwner`/`noEnabledTransition`. |
| Keep-by-default rejected (9 verdicts, 8 stores) | **Yes**, for the record. |
| Corpus statistics (53 machines, 47 migrated, 251 transitions) | **Yes** for counts; the `exit`/`to` split changes nothing in behaviour. |

**Not measured at all:** parents, wakes and re-checked statements, periodic machines, `StateLoop`, direct entry, the short form. Section 10 orders the prototypes.

**Gate 2 (trace digests)** cannot hold across the edition: identities change and parents add `state` observations. It is replaced by a migrated-corpus gate on verdicts, final stores, per-kind counts and per-component order-sensitive digests after mapping identities with the migrator's identity map, which the extension's run overlays also need.

## 7. Migration from 2.2 machines

Input: a 2.2 machine (`initial I; state …`) in operation O, and every 2.2 `when` guard. The WP5 forms never ship and need no migration.

1. **Frame.** O satisfies SIF-S01 (2.2 enforces the `on start` rule).
2. **State order** to maximise fall-through: initial first, finals last in source order, otherwise the order that maximises states whose next state is a target of theirs (exhaustive up to 9, greedy beyond, ties by source order).
3. **Each state:** `on entry` unchanged; timer transitions first, sorted by literal duration, stable on declaration order, each `after D { effect; to T; }`; then **one `on receive` line per member**, in order of first declaration, whose block is the member's transitions as an `if / else if` chain in declaration order: `on receive m(x) when (g) to T { e }` becomes `if (g) { e; to T; }`, an unguarded transition becomes the final `else { e; to T; }` (or the whole block when it is the only one). Transitions after an unguarded one on the same member were never taken in 2.2 and are removed and reported. Bindings: transitions on one member with different binding names are renamed to the first transition's names inside their branches (a rename map is reported); a name that would be captured is refused and reported.
4. **Exit actions** (B4): a state whose `on exit` is not empty and that has a leaving transition with a non-empty effect loses its `on exit`; its statements are written at the start of **every** leaving block of that state (before the effect). This is exact: a flat 2.2 state is left only by its own transitions. Other states keep `on exit`.
5. **`to T` to the next state** is written `exit;`, everything else `to T;` (behaviour is the same, 3.6).
6. **Dead timers:** an unguarded timer whose duration is not smaller than an earlier-sorted one's was never taken; removed and reported.
7. **Inputs:** nothing is written: 2.2 dropped unhandled input while waiting, and so does 3.0.
8. **Final states** become named steps `state F { on entry { … } }`; with several finals, `return;` follows each final step except the last statement.
9. **Dead ends:** a non-final 2.2 state without transitions waits for ever and drops input; written with only its entry it would become a named step and pass through. The migrator refuses it and names it; the author decides (SIF-D10 shows a state that waits for good).
10. **End:** the migrator verifies "end reachable iff a final state was reachable".
11. **No parents:** the migrator never introduces parents; "move a common line to the parent" is an explicit Flow View edit (2.10). The window lifter in 1.6 is a showcase rewrite.
12. **Guards elsewhere:** `when (g)` in plain receive statements is respelled `if (g)`; release guards follow in WP7b.
13. **Report:** removed transitions and timers, renamed bindings, copied exit actions, refusals, the identity map.

**What happens to the measured selection order.** 2.2 evaluated competing enabled transitions in declaration order and took the first; the chain does the same, in declaration order. Between members, a 2.2 state saw one message at a time too, so the order of lines between members does not matter. The one difference P1 found remains (r10: delivery order).

**What happens to "no enabled transition" discards.** A message whose chain has no `else` and whose conditions are all false is taken, nothing runs, and `discardInput` reason `noEnabledTransition` is recorded: the 2.2 observation.

**Order of exit, effect, entry.** Kept by step 4: copied exit actions, then the effect, then `to T` (which runs no `on exit` any more), then the target's entry.

**WP5 examples 44 to 47 and 49** are rewritten by hand: completion transitions become `if (g) { to S; }` standing in the state (checked at every look, which is what WP5's completion wanted, without `CompletionLoop`); internal transitions become staying lines; guarded timers become `after D { if (g) { … } }`, which checks once, and the expectations are rewritten where that differs; deferral becomes a variable written by a line, and the cases state that only the last request is kept (1.12).

## 8. WP5 to WP9

- **WP5** (merged, unreleased): its state forms, rules (chapter 3.6 WP5-S02 to S10, 6.5 WP5-R01 to R13, WP5-T01 to T04), ADR 0023, examples 44 to 47, `test/v2/state-reactions.test.ts`, SW2017/SW2018 as defined there and `CompletionLoop` are replaced in place and never ship. P1 estimates 2,500 to 3,000 deleted and about 300 edited lines in about 50 files.
- **WP6** (merged): sampled reads are read by statements in states; cell updates are wakes (3.5). WP6-D09/D10 are replaced by SIF-D10 and SIF-D14.
- **WP7** (branch): a release guard on the `on every` entry of a periodic machine skips the release's look (3.8). Its spelling `when (g)` is respelled `if (g)` in a separate change (WP7b) so that `when` leaves the language.
- **WP8** (placement): a periodic machine is one runnable per occurrence that keeps its state; a waiting machine maps to an event-driven task.
- **WP9** (edition, notation, figures, showcases): the showcases go through the migrator; parents in the window lifter are a recorded design rewrite. Figures: state box, parent box, direct entry across a border, empty diamonds with `[c]` lines, the release in the frame header, periodic Timing.

## 9. Consequences for the VS Code extension

- **Flow View drawing:** state and parent boxes, one arrow per leave, diamonds for events with several leaves, numbers in written order, lanes per target, compact boxes, the release in the frame header, empty decision diamonds with `[c]` lines for every flow.
- **Flow View edits:** 2.10, with dry-run previews; creation cards for states, parents, event lines and statements in a state; field completion for members, legal jump targets and conditions.
- **Sequence:** a state is a state invariant on the operation's lifeline; a parent an invariant region.
- **Timing:** nested state bands; for periodic machines the release grid with skips.
- **Migration command** with the report of 7 step 13 and the identity map; dual-edition parsing until users migrate.
- **Run overlays:** identities through the identity map; `StateLoop` and `trigger`.

## 10. Prototypes required before implementation is approved

All extend P1 in a copy; P1 stays the flat reference. In build order:

| # | Prototype | Must build | Must measure or show |
| --- | --- | --- | --- |
| 1 | **P1r**, flat rerun | The look of 3.3 for flat states (one message, all present lines, statements), the new migrator (one line per member, `if` chains, copied exit actions, leaves as statements), re-pick after the zero-time wait; a Langium spike of the short form (O1) | 0 verdicts and 1 store again on the 263 results, or every difference listed; the capacity-1 `dropOldest` case; the grammar spike reports no ambiguity and the same identities with and without braces |
| 2 | **P5**, parents and direct entry | Levels, parents first, direct entry, B6's waiting rule, text-order leaving across parents | The window lifter of 1.6 against 2.2 (expected: identical apart from `state` observations); the mode manager with sample 7 Q4; the lock controller of section 0 against sample 1; the traffic light; the B2 counterexamples (suspending parent reaction, parent query during a pulse); the shielding pattern |
| 3 | **P4**, values and wakes | Exact read sets per effective occurrence (redefinition, helpers, white-box and borrowed calls with suspension), wakes by write, `StateLoop` by configuration hashing | Anti-pinch on a sampled member and on a filtered attribute; drain, handshake, alarm, both ping-pongs, the two known misses; the cost of hashing on the door showcase; SIF-D08, D09, D10 on the corpus without false positives in migrated machines |
| 4 | **P6**, periodic machines | One persistent activation, release looks, arrival looks within a release, timers by time, one message per release, release guards, SIF-D01, SIF-D04 | The 10 ms window controller (sample 9), `MirrorHeater.tick`, the traffic light and connection manager released `on every 100ms`, deadline and backlog with a suspending look |
| 5 | **P2b**, drawings | All eight sketches of section 2 | The lifter with lanes versus back-jump stubs; arrows crossing parent borders; diamonds after event lines; the release header |
| 6 | **P3b**, reading test | The rewritten reading samples, with the owner | Samples 2 (timer as a moment), 7 Q4, 9 Q2 (arrival look) |

**What to cut first if something cannot be made sound,** in this order:
1. **Wakes by other activations' writes** (keep sample-cell updates, which are deliveries). The owner loses re-checking an attribute written by another operation at the moment it is written, in waiting machines; such a condition is still checked at every other look and at every release of a periodic machine. Removes the exact-read-set risk (section 5, point 3).
2. **Periodic machines.** The owner loses AUTOSAR-runnable machines (`MirrorHeater.tick` stays flag code). Smaller than in revision 3, because a periodic machine is now a waiting machine whose looks come from releases, but the persistent activation, backlog and guards are unprototyped.
3. **Parents** last, if at all. The owner loses written-once exits (the window lifter back to 41 arrows, the lock's request line written in every state). They are the most conventional part and P5 expects no behaviour change on the corpus.

## 11. Open decisions for the owner

| # | Question (yes or no) | Recommendation |
| --- | --- | --- |
| O1 | May a body that is only `exit;` or `to S;` be written without braces (`after 250ms exit;`, `if (wanted) exit;`), and nothing else? | **Yes.** The general C rule hides a behaviour change in half-typed text inside states (1.3). |
| O2 | Does a timer happen once per arrival (so "from 10 s on, as soon as requested" is written with a parent and an inner state)? | **Yes.** It is how 2.2 timers behave and it never repeats by surprise. |
| O3 | When a machine released every 10 ms reaches a new state, does that state already do its every-release work in the same release? | **Yes.** One rule for both modes: reaching a state is a look. |
| O4 | When a state is left, do the statements written before `exit;` or `to S;` run before the state's `on exit`? | **Yes.** It is the text order; the migrator keeps 2.2 results by copying exit actions. |
| O5 | Is it an error if a machine released every 10 ms could reach its end? | **Yes.** It then always runs for as long as its component, and the end marker has one meaning. |
| O6 | In a machine released on start, is a plain action standing in a state (not under an `if` that changes what it tests) only a warning? | **Yes.** It runs at every look by the one rule; the warning catches the likely mistake without a second rule. |

Decided by the owner and no longer open: states as steps (1); drop and remember with a variable (2); one `if` (3); direct entry into parents (4); `if` never waits, the state looks again (5, 8); scope of the one release (6); empty diamonds (7). Decided here without asking: one message per look in delivery order (B1, option a, measured); parents first; named steps; no operation-level lines; no plain receive statements in operations with states.

## 12. Stateflow cues

| Cue | Decision |
| --- | --- |
| States and flow-chart logic in one chart | **adopt**: states are steps, decisions are `if` |
| entry, exit, on event | **adopt**: `on entry`, `on exit`, event lines |
| `during` | **adopt without a word**: statements in a state run at every look |
| Outer transitions tested first | **adopt**: parents first |
| Conditions in brackets on transitions | **adopt**: `[c]` on every arrow and diamond line |
| Transition action after exit | **reject**: text order, block first |
| Condition actions before exit | **adopt in effect**: statements before the leave |
| Default transition | **adapt**: arrival by flow; into a parent, its first inner state or a direct entry |
| `after` relative to state entry, at chart steps | **adopt** |
| Entering step runs no `during` | **reject**: the arrival look runs the state's statements (O3) |
| Parallel states, history junction | **reject** |

## 13. Risks

- **One final release.** A wrong rule cannot be fixed later; every runtime part has a prototype before its package (10).
- **Exact read sets and wakes** (section 5, point 3): a missed wake stalls a case silently; an extra wake acts twice.
- **`StateLoop` by configuration** needs hashing and an exact configuration definition (P4).
- **Text order of leaving** differs from UML; the drawing cannot show it.
- **Statements run at every look**: authors who expect "once" will write into `on entry` after one warning.
- **Dropped by default** loses input an author expected to wait; the variable pattern is explicit and keeps only what it stores.
- **Periodic quantisation** (SIF-D12) and one message per release (SIF-D01).
- **Text order is behaviour.** Every refactoring tool must treat item order and level as meaningful.
- **Plain receive guards** respelled `if` need their meaning restated in SIF-1 (4.1).
- **Extension cost** (dual-edition parsing, migration command, Flow View for every flow, overlays, State view retirement) is substantial and not estimated here.
