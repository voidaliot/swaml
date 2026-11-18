# States in the flow: reading samples

**Purpose:** prototype P3 of the design review, rewritten for revision 4 of [the proposal](STATES_IN_FLOW_PROPOSAL.md). Nine small behaviours, each with a sketch of its Flow View drawing and five plain questions. Read the text and the drawing cold, answer the questions, then compare with the answers at the end. If a question cannot be answered from the text and the drawing alone, the look has failed there.

Nothing here is accepted by a parser yet; the fences are plain text.

**How to read the text:**
- A state waits. Each time something happens to it (it is reached, a message it names arrives, its timer runs out, someone else writes a value it reads, or, every P, a release comes), it **looks** at what is inside its braces again, top to bottom, the braces of an enclosing state first.
- At a look, the line of what happened runs (`on receive m(x) { … }` for that message, `after D { … }` when D has passed since the state was reached), and every other statement in the braces runs. `if` checks now and skips when false; it never waits.
- The look stops at the first `exit;` (leave, go on with what is written next) or `to S;` (go to state `S`). The statements written before it run first, then `on exit`, then the next state's `on entry`.
- A look sees one message; several messages are looked at one after another, in the order they were delivered. A message that the state (and the states around it) does not name is dropped while it waits; one that arrives while the operation is busy waits for the next state that waits.
- A state whose braces end with inner states is a parent: what is written on it applies in every state inside.
- Released `on every P`, the operation looks once per release and keeps its place between releases.
- Short form: `after 250ms exit;` means `after 250ms { exit; }`; only `exit;` and `to S;` may drop their braces (owner decision O1).

**How to read the drawing:** rounded boxes are states, plain boxes are steps, `◇` is a decision (empty; its conditions `[c]` are on the lines that leave it), `⋄` a merge, `●` the start, `◉` the end. The header says how the operation is released. Lines inside a box are what the state does without leaving. Arrows out of a box are ways out, numbered in written order, labelled `event [condition] / what runs on the way`. Back jumps run up the left side, skips down the right side.

## 1. Lock controller

```text
operation control() {
  var wanted: bool = false;
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

**Questions.**
1. The lock is unlocked. A lock request arrives at 0 ms, and a second lock request at 100 ms, during the pulse. What happens to the second request?
2. A lock request arrives at 0 ms and an unlock request at 100 ms. When does the unlock pulse start, and how many pulses are there in total?
3. A status query arrives at 100 ms, during the lock pulse that started at 0 ms. When is it answered, and does the answer say locked or unlocked?
4. Lock at 0 ms, unlock at 100 ms, power-off at 300 ms. What happens, and what does `locked` say at the end?
5. After `reportShutdown()` has run, a lock request arrives. What happens?

## 2. Traffic light with a pedestrian request

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
  │ ╭───────▼──────╮
  │ │ yellow       │ after 3s ─► red ─ after 2s ─┐
  │ ╰──────────────╯                             ◇
  │                           [requested] ╱        ╲ [else]
  │                 ╭─────────▼────────╮            │
  │                 │ walk             │            │
  │                 │ entry/exit: …    │            │
  │                 ╰─────────┬────────╯            │
  │                           │ after 15s           │
  │                  [ requested = false ]          │
  │                           └──────►⋄◄────────────┘
  └───────────────────────────────────┘
```

**Questions.**
1. A pedestrian presses the button 3 s after green started. When does green end?
2. The button is pressed 20 s after green started. When does green end?
3. Nobody presses the button. What is the sequence of lamps, and is there a walk phase?
4. The button is pressed during the walk phase. Does it shorten the next green?
5. Green ended at 60 s without a request, and someone presses during yellow. Is there a walk phase in this cycle?

## 3. Mode manager (flat)

```text
operation modes() {
  while (true) {
    state off {
      on entry { send status.mode(Mode.off); }
      on receive key.ignitionOn() { exit; }
    }
    state standby {
      on entry { send status.mode(Mode.standby); }
      on receive key.ignitionOff() { to off; }
      on receive cmd.go() { exit; }
      on receive diag.enter() { to diagnostic; }
    }
    state running {
      on entry { send status.mode(Mode.running); send drive.enable(true); }
      on exit { send drive.enable(false); }
      on receive key.ignitionOff() { to off; }
      on receive cmd.halt() { to standby; }
      on receive diag.enter() { exit; }
    }
    state diagnostic {
      on entry { send status.mode(Mode.diagnostic); }
      on receive key.ignitionOff() { to off; }
      on receive diag.leave() { to standby; }
    }
  }
}
```

`on receive key.ignitionOff() { to off; }` is written in three states. Sample 7 writes it once, on a parent state.

```text
 «operation» modes · on start
              ●
   ┌─────────►◇ [true]
   │  ╭───────▼───────────────────╮
   │  │ off                       │
   │  │ entry: send mode(off)     │
   │  ╰───────┬───────────────────╯
   │          │ key.ignitionOn()
   │ ┌───────►┤
   │ │ ╭──────▼───────────────────────────────╮
   │ │ │ standby                              │
   │ │ │ entry: send mode(standby)            │
   │ │ ╰──┬───────────────┬──────────────┬────╯
   ├─┼────┘1 ignitionOff  │2 cmd.go()    │3 diag.enter() ──────────┐
   │ │ ╭──────────────────▼───────────────────╮                    │
   │ │ │ running                              │                    │
   │ │ │ entry: send mode(running); enable    │                    │
   │ │ │ exit:  send drive.enable(false)      │                    │
   │ │ ╰──┬───────────────┬──────────────┬────╯                    │
   ├─┼────┘1 ignitionOff  │2 cmd.halt()  │3 diag.enter()           │
   │ ├────────────────────┘              │                         │
   │ │ ╭─────────────────────────────────▼────╮                    │
   │ │ │ diagnostic                           │◄───────────────────┘
   │ │ │ entry: send mode(diagnostic)         │
   │ │ ╰──┬───────────────┬───────────────────╯
   └─┼────┘1 ignitionOff  │2 diag.leave()
     └────────────────────┘
```

**Questions.**
1. `cmd.go` arrives while the mode is off, then `key.ignitionOn`. Does the manager go to running?
2. In running, `cmd.halt` and `key.ignitionOff` arrive at the same instant, `cmd.halt` first. Which mode is it in afterwards?
3. In running, `diag.enter` arrives. Is the drive disabled? Where does `diag.leave` lead?
4. In standby, `diag.leave` arrives. What happens?
5. Can this operation ever end?

## 4. Connection manager with retry, timeout and backoff

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

**Questions.**
1. The peer never answers. At which times are the hellos sent, and when does the cooldown start?
2. During the second attempt, at 12 ms, a late `ack(1)` arrives. What does it change?
3. `ack(2)` arrives at exactly 30 ms, the instant at which the second attempt's timer runs out. Is the link up?
4. The link is connected and `link.down` arrives. What happens next?
5. An `ack` arrives during the cooldown. What does it change?

## 5. Debounce

Written in the short form (owner decision O1); the braces form is `on receive sw.level(v) { if (v) { exit; } }`.

```text
operation debounce() {
  while (true) {
    state low {
      on receive sw.level(v) { if (v) exit; }
    }
    state risingCheck {
      on receive sw.level(v) { if (not v) to low; }
      after 20ms { publish out.pressed(); exit; }
    }
    state high {
      on receive sw.level(v) { if (not v) exit; }
    }
    state fallingCheck {
      on receive sw.level(v) { if (v) to high; }
      after 20ms { publish out.released(); exit; }
    }
  }
}
```

```text
 «operation» debounce · on start
            ●
  ┌────────►◇ [true]
  │ ┌──────►┤
  │ │ ╭─────▼──────────────────────╮
  │ │ │ low                        │
  │ │ ╰─────┬──────────────────────╯
  │ │       │ level(v) [v]
  │ │ ╭─────▼──────────────────────╮
  │ │ │ risingCheck                │
  │ │ ╰─────┬────────────────┬─────╯
  │ └───────┘1 level(v)      │ 2 after 20ms
  │            [not v]       │   / publish out.pressed()
  │ ┌──────►┌────────────────┘
  │ │ ╭─────▼──────────────────────╮
  │ │ │ high                       │
  │ │ ╰─────┬──────────────────────╯
  │ │       │ level(v) [not v]
  │ │ ╭─────▼──────────────────────╮
  │ │ │ fallingCheck               │
  │ │ ╰─────┬────────────────┬─────╯
  │ └───────┘1 level(v) [v]  │ 2 after 20ms
  │                          │   / publish out.released()
  └──────────────────────────┘
```

**Questions.**
1. The switch reports `true` at 0 ms, `false` at 5 ms and `true` at 8 ms, then stays. When is `pressed` published?
2. The switch reports `true` at 0 ms and `true` again at 10 ms. Does the second report restart the 20 ms?
3. The switch reports `true` at 0 ms and `false` at exactly 20 ms. Is `pressed` published?
4. The switch reports `false` while the debounce is in `low`. What happens?
5. After `pressed`, the switch reports `false` at 100 ms, `true` at 105 ms and `false` at 110 ms, then stays. When is `released` published?

## 6. The owner's picture

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

**Questions.**
1. `go(false)` arrives. Which state comes next, and what does it wait for?
2. `retry` arrives at 5 ms while in `state0`, then `go(false)` at 10 ms. Does the flow leave `state1` at once?
3. `go(true)` arrives at 0 ms and another `go` at 5 ms. What happens to the second one?
4. After `go(true)` at 0 ms, when does `process()` run?
5. What happens after `state4`? Does the flow return to `state0`?

## 7. Mode manager with parent states

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

**Questions.**
1. In running, `ecu.shutdown` arrives. What runs, in which order, and what happens next?
2. In diagnostic, `key.ignitionOff` arrives. Where does the manager go, and does anything in `diagnostic` or `powered` run on the way?
3. In standby, `cmd.halt` arrives. What happens?
4. In running, `cmd.halt`, `cmd.go` and `key.ignitionOff` arrive at the same instant, in that order. Where does the manager end, and does it pass through running again?
5. Can this operation end, and how?

## 8. Anti-pinch condition

```text
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
```

`sense.current` is a sampled port member (an attribute with an initial value; `pinchLimit` is 4500 mA). A variant reads `motorCurrent` instead, an attribute written every millisecond by another operation, `filter()`: `motorCurrent = (motorCurrent * 3 + sense.current) / 4;`.

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

**Questions.**
1. 100 ms after closing started, a current value of 5000 is delivered. What happens?
2. A halt request and a current value of 5000 are delivered at the same instant, the request first. Does the window reverse?
3. The current is already 5000 when `closing` is entered. What happens?
4. In the filtered variant, with `motorCurrent` at 3000, the raw current is 9000 for one millisecond and then 3000 again. Does the window reverse?
5. Exactly 8 s after closing started, a current value of 5000 is delivered. What happens?

## 9. Periodic window controller

```text
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
  on every 10ms step() if (supply.ok) deadline 2ms;
}
```

`switch.position` and `sense.current` are sampled port members; `travel` starts at 0 and `fullTravel` is 400. The release guard is written with the proposed `if` spelling of WP7's guard.

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

**Questions.**
1. The switch goes up at 25 ms. At which release does the motor start?
2. At which release does `travel` first increase?
3. The switch returns to neutral at 95 ms. At which release does the motor stop?
4. At one release, the current is above the limit and the switch is back to neutral. Which state comes next?
5. `reversing` is entered at 150 ms. `supply.ok` is false for the releases from 500 ms to 600 ms. When does `reversing` end?

## Answers

### 1. Lock controller
1. `powered`'s request line takes it and sets `wanted` to true again; `locking` keeps pulsing. At 250 ms the pulse ends (the motor goes idle), `isLocked` is reached, its entry sets `locked = true`, and its look finds `not wanted` false: it waits. One pulse, the lock stays locked.
2. At 250 ms. The unlock request at 100 ms sets `wanted` to false. At 250 ms the lock pulse ends, `isLocked` is reached (`locked = true`), and its arrival look finds `not wanted` true: it leaves at once for `unlocking`. Unlock pulse from 250 to 500 ms, then `to unlocked`, whose entry sets `locked = false` and whose look finds `wanted` false. Two pulses.
3. At once, at 100 ms: the query line on `powered` applies in every state inside, also during the pulse, and its look does not stop the pulse. It says unlocked: `locked` is set when `isLocked` is reached, after the pulse.
4. Lock pulse 0 to 250 ms; at 250 ms `isLocked` sets `locked = true` and leaves at once for the unlock pulse. The power-off at 300 ms is a line of `powered`: `unlocking`'s exit sets the motor idle, `powered` is left, `reportShutdown()` runs and the operation ends. `unlocked` was never reached again, so `locked` still says true although the unlock pulse ran for 50 ms.
5. It is discarded. The operation has ended; nothing answers requests or queries any more.

### 2. Traffic light
1. At 10 s. The press sets `requested` (a line of `green`, which applies in `minimum`). At 10 s `minimum` leaves for `extended`, whose arrival look finds `requested` true and leaves `extended` and `green`. Then yellow 3 s, red 2 s, walk 15 s, and green again.
2. At 20 s, at the press: in `extended`, the press is looked at; `green`'s line sets `requested` first, then `extended`'s `if (requested)` is checked and leaves.
3. Green 60 s (the 60 s timer of `green` counts from the start of green), yellow 3 s, red 2 s, then the decision finds no request and skips the walk phase; green again. A cycle without request lasts 65 s.
4. No. Presses outside green are dropped (only `green` names the button), and `requested` is cleared after the walk. The next green ends at 10 s only if someone presses during it, otherwise at 60 s.
5. No. The press during yellow is dropped, the decision after red finds no request, and the walk phase is skipped. The pedestrian must press again during the next green.

### 3. Mode manager
1. No. `cmd.go` is dropped while `off` waits (it does not name it). After `key.ignitionOn`, standby waits for a new `cmd.go`.
2. Off. `cmd.halt` is looked at first (it was delivered first): running's exit disables the drive and the flow jumps to standby. Standby is then looked at with `key.ignitionOff` and jumps to off.
3. Yes: running's exit action disables the drive before diagnostic is entered. `diag.leave` leads to standby, not back to running.
4. It is dropped; standby stays.
5. No. Every way out of `diagnostic`, the last state of the loop, is a jump, and every other state either jumps or goes on to the next state; the loop never ends.

### 4. Connection manager
1. Hellos at 0, 10, 30, 70 and 150 ms (timeouts of 10, 20, 40, 80 and 160 ms). The fifth timeout is at 310 ms; the inner loop ends with `up` false, and the cooldown runs from 310 ms to 30.31 s. Then everything starts again from attempt 1 with a 10 ms timeout.
2. Nothing. It is taken, its `if` is false, nothing runs. The second attempt's 20 ms timer keeps running from 10 ms, and the third hello goes out at 30 ms.
3. No. The timer that runs out at 30 ms is looked at first: the backoff doubles to 40 ms, the loop sends `hello(3)` and a new `awaiting` waits. The `ack(2)` delivered at that same instant is looked at by the new `awaiting`, whose `attempt` is 3, so nothing runs.
4. The exit publishes `connected(false)`, the outer loop starts again with attempt 0, a 10 ms timeout and `up` false, and `hello(1)` goes out at once.
5. Nothing. The cooldown does not name acks, so they are dropped; the cooldown ends 30 s after it started.

### 5. Debounce
1. At 28 ms. `true` at 0 enters `risingCheck`; `false` at 5 goes back to `low`; `true` at 8 enters `risingCheck` again, whose 20 ms count from 8 ms.
2. No. In `risingCheck` a `true` report is taken, `if (not v)` is false, nothing runs; the 20 ms still count from 0, so `pressed` is published at 20 ms.
3. Yes. The 20 ms timer and the `false` report fall on the same instant, and the timer is looked at first: `pressed` at 20 ms, then `high` is looked at with the `false` report and goes to `fallingCheck`. `released` follows at 40 ms unless a `true` report comes first.
4. It is taken and nothing runs; `low` keeps waiting for `true`.
5. At 130 ms. `false` at 100 enters `fallingCheck`; `true` at 105 goes back to `high`; `false` at 110 enters `fallingCheck` again, and its 20 ms end at 130 ms.

### 6. The owner's picture
1. `state1`: the lamp shows retry, and the state waits for `cmd.retry`.
2. No. The `retry` at 5 ms was dropped while `state0` waited (it does not name `retry`). `state1` waits for a new `retry`.
3. It is dropped: `state2` does not name `go`.
4. At 10 ms: `state2` ends after 10 ms, the branches merge and `process()` runs.
5. `state4` has nothing to look at, so it does not wait: `report()` runs and the operation ends; there is no way back to `state0`. Later `go` and `retry` messages are discarded.

### 7. Mode manager with parent states
1. Running's exit disables the drive; `powered` and `system` are left (they have no exit actions); the flow goes on after `system`: `send status.mode(Mode.off)`; the operation ends. Later messages for the operation are discarded.
2. To `off`. The line on `powered` applies in every state inside it; `diagnostic` and `powered` have no exit actions, so nothing runs on the way; `off`'s entry sends the off mode.
3. It is dropped: neither standby, nor `powered`, nor `system` names `cmd.halt`.
4. In `off`, and it **does** pass through running, for zero time. The three messages are looked at one after another in delivery order. `cmd.halt`: running's exit disables the drive, standby is entered. `cmd.go`: standby leaves for running, whose entry enables the drive. `key.ignitionOff`: `powered`'s line leaves running (drive disabled again) and goes to `off`. A trace of the drive shows enable and disable at the same instant. (Revision 3 answered "without passing through running"; that was wrong under its own rules.)
5. Yes, only through `ecu.shutdown`, written once on `system`; every other way out stays inside `system`.

### 8. Anti-pinch condition
1. The window reverses at 100 ms: the delivery updates `sense.current`, `closing` looks again, the condition holds, `pinchReversals` is counted, `reversing` drives down for 400 ms and the flow returns to `idle`.
2. No. The request is delivered first, so `closing` looks at it while `sense.current` still holds the old value: the condition is false, the halt leaves for `idle`. The new current value arrives when `idle` waits, and `idle` does not read it.
3. It reverses at once: the condition is checked by the arrival look and holds already.
4. No. The filter writes 4500, which is not above the limit, and then lower values; `closing` looks at every write, but never sees more than 4500, never the raw 9000.
5. The window goes to `idle` without reversing: the 8 s timer is looked at before the delivery of the same instant, while the current still holds its old value.

### 9. Periodic window controller
1. At 30 ms. The first release at 10 ms reaches `idle` (the motor is stopped); the releases at 20 ms and 30 ms look at `idle`, and at 30 ms the switch is up, so `closing` is reached in that release and its entry starts the motor.
2. At 30 ms. Reaching `closing` is a look: its conditions are false, so `travel = travel + 1` runs in the release that starts the motor.
3. At 100 ms, the first release after the switch returned: the second condition of `closing` holds, and `idle`'s entry stops the motor in the same release.
4. `reversing`: the current condition is written first, and the look stops at the first leave.
5. At 610 ms. The 400 ms are due at 550 ms, but the releases from 500 ms to 600 ms are skipped and make no look; the first release that runs is at 610 ms, and its look takes the timer.
