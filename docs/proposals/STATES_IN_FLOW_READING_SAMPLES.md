# States in the flow: reading samples

**Purpose:** prototype P3 of the design review, rewritten for revision 3 of [the proposal](STATES_IN_FLOW_PROPOSAL.md). Nine small behaviours, each with a sketch of its Flow View drawing and five plain questions. Read the text and the drawing cold, answer the questions, then compare with the answers at the end. If a question cannot be answered from the text and the drawing alone, the look has failed there. Samples 7 to 9 are new: a parent state, conditions and a periodic machine.

Nothing here is accepted by a parser yet; the fences are plain text.

**How to read the text:**
- A state's lines say what it reacts to: `on receive m(x)`, `after D`, or a condition `if (c)`; an input or timer line may add `if (g)`.
- A line that ends in a block reacts and the state keeps waiting. `exit` leaves for the next statement; `to S` leaves for state `S`. Leaving runs `on exit`, then the line's block.
- Lines are tried in written order and the first ready one is taken; the `on receive` lines of a state count as one line, served in the order the messages arrived. A timer that expires at the same instant as a message arrives comes first.
- Input that the current state does not mention is dropped while it waits; input that arrives while the operation is busy waits for the next state that waits.
- An `if` in the flow is checked when the flow gets there; an `if` on a line of a state is checked whenever the state chooses.
- Lines written on a parent state, or at the top of the operation, apply in every state inside and are tried before the inner state's own lines.
- Released `on every P`, the operation takes at most one line per release; `if (true) { … }` written last is what a state does at a release where nothing else is ready.

**How to read the drawing:** rounded boxes are states, plain boxes are steps, `◇` is a decision (empty; its conditions `[c]` are on the lines that leave it), `⋄` a merge, `●` the start, `◉` the end, `■` a line written at the top of the operation. Lines inside a box are reactions: the state does them without leaving. Arrows out of a box are ways out, numbered in written order (`1a`, `1b` share a group), each condition written `[c]` on its arrow. Back jumps run up the left side, skips down the right side.

## 1. Lock controller

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

```text
 «operation» control : () returns void
   status.query() : publish status.report(locked, pulses)
 ■ power.off() ─────────────────────────────────────────────────────┐
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
      after 10s if (requested) exit;
      after 60s exit;
    }
    state yellow {
      on entry { send lamps.set(Light.yellow); }
      after 3s exit;
    }
    state red {
      on entry { send lamps.set(Light.red); }
      after 2s exit;
    }
    if (requested) {
      state walk {
        on entry { send walkSign.set(true); }
        on exit { send walkSign.set(false); }
        after 15s exit;
      }
      requested = false;
    }
  }
}
```

```text
 «operation» cycle : () returns void
            ●
   [ var requested = false ]
            │
  ┌────────►◇ [true]
  │ ╭───────▼─────────────────────────────╮
  │ │ green                               │
  │ │ entry: send lamps.set(green)        │
  │ │ 1 ped.button() : requested = true   │
  │ ╰───────┬─────────────────┬───────────╯
  │         │ 2 after 10s     │ 3 after 60s
  │         │   [requested]   │
  │         ⋄◄────────────────┘
  │ ╭───────▼─────────────────╮
  │ │ yellow                  │
  │ │ entry: send …(yellow)   │
  │ ╰───────┬─────────────────╯
  │         │ after 3s
  │ ╭───────▼─────────────────╮
  │ │ red                     │
  │ │ entry: send …(red)      │
  │ ╰───────┬─────────────────╯
  │         │ after 2s
  │         ◇
  │ [requested] ╲  [else]
  │ ╭────▼──────────────╮  │
  │ │ walk              │  │
  │ │ entry: send …     │  │
  │ │ exit:  send …     │  │
  │ ╰────┬──────────────╯  │
  │      │ after 15s       │
  │ [ requested = false ]  │
  │      └──────►⋄◄────────┘
  └──────────────┘
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
      on receive key.ignitionOn() exit;
    }
    state standby {
      on entry { send status.mode(Mode.standby); }
      on receive key.ignitionOff() to off;
      on receive cmd.go() exit;
      on receive diag.enter() to diagnostic;
    }
    state running {
      on entry { send status.mode(Mode.running); send drive.enable(true); }
      on exit { send drive.enable(false); }
      on receive key.ignitionOff() to off;
      on receive cmd.halt() to standby;
      on receive diag.enter() exit;
    }
    state diagnostic {
      on entry { send status.mode(Mode.diagnostic); }
      on receive key.ignitionOff() to off;
      on receive diag.leave() to standby;
    }
  }
}
```

`on receive key.ignitionOff() to off;` is written in three states. Sample 7 writes it once, on a parent state.

```text
 «operation» modes : () returns void
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
   ├─┼────┘1a ignitionOff │1b cmd.go()   │1c diag.enter() ─────────┐
   │ │ ╭──────────────────▼───────────────────╮                    │
   │ │ │ running                              │                    │
   │ │ │ entry: send mode(running); enable    │                    │
   │ │ │ exit:  send drive.enable(false)      │                    │
   │ │ ╰──┬───────────────┬──────────────┬────╯                    │
   ├─┼────┘1a ignitionOff │1b cmd.halt() │1c diag.enter()          │
   │ ├────────────────────┘              │                         │
   │ │ ╭─────────────────────────────────▼────╮                    │
   │ │ │ diagnostic                           │◄───────────────────┘
   │ │ │ entry: send mode(diagnostic)         │
   │ │ ╰──┬───────────────┬───────────────────╯
   └─┼────┘1a ignitionOff │1b diag.leave()
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
        on receive link.ack(id) if (id == attempt) exit { up = true; }
        after (backoffMs * 1ms) exit {
          if (backoffMs < 1000) { backoffMs = backoffMs * 2; }
        }
      }
    }
    if (up) {
      state connected {
        on entry { publish status.connected(true); }
        on exit { publish status.connected(false); }
        on receive link.down() exit;
      }
    } else {
      state cooldown {
        after 30s exit;
      }
    }
  }
}
```

```text
 «operation» manage : () returns void
            ●
  ┌────────►◇ [true]
  │ [ attempt = 0; backoffMs = 10; up = false ]
  │         │
  │ ┌──────►◇ [attempt < 5 and not up]
  │ │ [ attempt = attempt + 1 ]
  │ │ [ publish link.hello(attempt) ]
  │ │ ╭─────▼───────────────────────╮
  │ │ │ awaiting                    │
  │ │ ╰─────┬─────────────────┬─────╯
  │ │       │ 1 ack(id)       │ 2 after (backoffMs * 1ms)
  │ │       │ [id == attempt] │
  │ │  [ up = true ]          ◇
  │ │       │   [backoffMs < 1000] [ backoffMs = backoffMs * 2 ]
  │ │       │                 │ [else]
  │ │       ⋄◄────────────────┘
  │ └───────┘
  │         │ [else] (loop ends)
  │         ◇
  │    [up] ╱ ╲ [else]
  │ ╭────▼──────────────╮  ╭───▼──────────╮
  │ │ connected         │  │ cooldown     │
  │ │ entry: publish …  │  ╰───┬──────────╯
  │ │ exit:  publish …  │      │ after 30s
  │ ╰────┬──────────────╯      │
  │      │ link.down()         │
  │      └──────►⋄◄────────────┘
  └──────────────┘
```

**Questions.**
1. The peer never answers. At which times are the hellos sent, and when does the cooldown start?
2. During the second attempt, at 12 ms, a late `ack(1)` arrives. What does it change?
3. `ack(2)` arrives at exactly 30 ms, the instant at which the second attempt's timer expires. Is the link up?
4. The link is connected and `link.down` arrives. What happens next?
5. An `ack` arrives during the cooldown. What does it change?

## 5. Debounce

```text
operation debounce() {
  while (true) {
    state low {
      on receive sw.level(v) if (v) exit;
    }
    state risingCheck {
      on receive sw.level(v) if (not v) to low;
      after 20ms exit { publish out.pressed(); }
    }
    state high {
      on receive sw.level(v) if (not v) exit;
    }
    state fallingCheck {
      on receive sw.level(v) if (v) to high;
      after 20ms exit { publish out.released(); }
    }
  }
}
```

```text
 «operation» debounce : () returns void
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
  │            [not v]       │
  │                 [ publish out.pressed() ]
  │ ┌──────►┌────────────────┘
  │ │ ╭─────▼──────────────────────╮
  │ │ │ high                       │
  │ │ ╰─────┬──────────────────────╯
  │ │       │ level(v) [not v]
  │ │ ╭─────▼──────────────────────╮
  │ │ │ fallingCheck               │
  │ │ ╰─────┬────────────────┬─────╯
  │ └───────┘1 level(v) [v]  │ 2 after 20ms
  │                          │
  │                 [ publish out.released() ]
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

**Questions.**
1. `go(false)` arrives. Which state comes next, and what does it wait for?
2. `retry` arrives at 5 ms while in `state0`, then `go(false)` at 10 ms. Does the flow leave `state1` at once?
3. `go(true)` arrives at 0 ms and another `go` at 5 ms. What happens to the second one?
4. After `go(true)` at 0 ms, when does `process()` run?
5. What happens after `state4`? Does the flow return to `state0`?

## 7. Mode manager with a parent state and an operation-level exit (new)

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

```text
 «operation» modes : () returns void
 ■ ecu.shutdown() ──────────────────────────────────────────┐
                ●                                           │
   ┌───────────►◇ [true]                                    │
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

**Questions.**
1. In running, `ecu.shutdown` arrives. What runs, in which order, and what happens next?
2. In diagnostic, `key.ignitionOff` arrives. Where does the manager go, and does anything in `diagnostic` or `powered` run on the way?
3. In standby, `cmd.halt` arrives. What happens?
4. In running, `cmd.halt`, `cmd.go` and `key.ignitionOff` arrive at the same instant, in that order. Where does the manager end, and does it pass through running again?
5. Can this operation end, and how?

## 8. Anti-pinch condition (new)

```text
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
```

`sense.current` is a sampled port member (an attribute with an initial value, `pinchLimit` is 4500 mA). A variant reads `motorCurrent` instead, an attribute written every millisecond by `filter()`: `motorCurrent = (motorCurrent * 3 + sense.current) / 4;`.

```text
 «operation» control : () returns void
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
   │     │1 [sense.   │2a    │3 after 8s
   │     │ current >  │request(c)
   │     │ pinchLimit]│[c == halt]
   │ [ pinchReversals + 1 ]  │
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

## 9. Periodic window controller (new)

```text
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
    if (true) { travel = travel + 1; }
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
  on every 10ms step() if (supply.ok) deadline 2ms;
}
```

`switch.position` and `sense.current` are sampled port members; `travel` starts at 0 and `fullTravel` is 400. The release guard is written with the proposed `if` spelling of WP7's guard.

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

**Questions.**
1. The switch goes up at 25 ms. At which release does the motor start?
2. At which release does `travel` first increase?
3. The switch returns to neutral at 95 ms. At which release does the motor stop?
4. At one release, the current is above the limit and the switch is back to neutral. Which state comes next?
5. `reversing` is entered at 150 ms. `supply.ok` is false for the releases from 500 ms to 600 ms. When does `reversing` end?

## Answers

### 1. Lock controller
1. `locking` takes it with its reaction: `unlockNext = not true`, which is false. At 250 ms the pulse ends, the motor goes idle, `locked = true`, the decision finds no unlock request and the flow waits in `isLocked`. One pulse, the lock stays locked.
2. At 250 ms. The unlock request at 100 ms sets `unlockNext` in `locking`; at 250 ms the pulse ends, `locked = true`, and the decision jumps to `unlocking`: unlock pulse from 250 to 500 ms, then `locked = false`, no lock request stored, back to `unlocked`. Two pulses.
3. At once, at 100 ms: the query line at the top of the operation applies in every state, also during the pulse. It says unlocked (`locked` is set only after the pulse), with one pulse.
4. Lock pulse 0 to 250 ms; the unlock request stored at 100 ms starts the unlock pulse at 250 ms. The power-off at 300 ms is handled at the top of the operation in every state: `unlocking` is left at once (its exit sets the motor idle), the flow continues at `report`, `reportShutdown()` runs and the operation ends. `locked = false` never ran, so `locked` still says true although the unlock pulse ran for 50 ms.
5. It is discarded. The operation has ended; nothing answers requests or queries any more.

### 2. Traffic light
1. At 10 s. The press sets `requested` without leaving green (line `1`); from then on arrow `2` waits only for the 10 s minimum. Then yellow 3 s, red 2 s, walk 15 s, and green again.
2. At 20 s, immediately after the press: the 10 s have already passed, and the request makes arrow `2` ready.
3. Green 60 s (arrow `3`), yellow 3 s, red 2 s, then the decision finds no request and skips the walk phase; green again. A cycle without request lasts 65 s.
4. No. Presses outside green are dropped (no other state mentions the button), and `requested` is cleared after the walk. The next green waits for a new press, or ends after 60 s.
5. No. The press during yellow is dropped, the decision after red finds no request, and the walk phase is skipped. The pedestrian must press again during the next green.

### 3. Mode manager
1. No. `cmd.go` is dropped while `off` waits (it does not mention it). After `key.ignitionOn`, standby waits for a new `cmd.go`.
2. Off. `cmd.halt` is taken first (it arrived first): running's exit disables the drive and the flow jumps to standby. Standby then finds `key.ignitionOff` waiting and jumps to off.
3. Yes: running's exit action disables the drive before diagnostic is entered. `diag.leave` leads to standby, not back to running.
4. It is dropped; standby stays.
5. No. Every way out of `diagnostic`, the last state of the loop, is a jump, and every other state either jumps or continues to the next state; the loop never ends.

### 4. Connection manager
1. Hellos at 0, 10, 30, 70 and 150 ms (timeouts of 10, 20, 40, 80 and 160 ms). The fifth timeout is at 310 ms; the inner loop ends with `up` false, and the cooldown runs from 310 ms to 30.31 s. Then everything starts again from attempt 1 with a 10 ms timeout.
2. Nothing. Its id does not match the current attempt, so it is taken and dropped. The second attempt's 20 ms timer keeps running from 10 ms, and the third hello goes out at 30 ms.
3. No. The timer expiring at 30 ms comes first: the backoff doubles to 40 ms, the loop sends `hello(3)` and waits again. The `ack(2)`, which arrived at that same instant, waited while the operation was busy, and the new `awaiting` takes it and drops it, because its id is not 3.
4. The exit publishes `connected(false)`, the outer loop starts again with attempt 0, a 10 ms timeout and `up` false, and `hello(1)` goes out at once.
5. Nothing. The cooldown does not mention acks, so they are dropped; the cooldown ends 30 s after it started.

### 5. Debounce
1. At 28 ms. `true` at 0 enters `risingCheck`; `false` at 5 goes back to `low`; `true` at 8 enters `risingCheck` again, whose 20 ms count from 8 ms.
2. No. In `risingCheck` a `true` report does not satisfy `if (not v)` and is dropped; the 20 ms still count from 0, so `pressed` is published at 20 ms.
3. Yes. The 20 ms timer and the `false` report fall on the same instant, and the timer comes first: `pressed` at 20 ms, then `high` finds the `false` report waiting and goes to `fallingCheck`. `released` follows at 40 ms unless a `true` report comes first.
4. It is dropped; `low` keeps waiting for `true`.
5. At 130 ms. `false` at 100 enters `fallingCheck`; `true` at 105 goes back to `high`; `false` at 110 enters `fallingCheck` again, and its 20 ms end at 130 ms.

### 6. The owner's picture
1. `state1`: the lamp shows retry, and the state waits for `cmd.retry`.
2. No. The `retry` at 5 ms was dropped while `state0` waited (it does not mention `retry`). `state1` waits for a new `retry`.
3. It is dropped: `state2` does not mention `go`.
4. At 10 ms: `state2` ends after 10 ms, the branches merge and `process()` runs.
5. `report()` runs and the operation ends; there is no way back to `state0`. Later `go` and `retry` messages are discarded.

### 7. Mode manager with a parent
1. Running's exit disables the drive; `powered` is left (it has no exit action); the line's block sends `status.mode(off)`; the operation ends. Later messages for the operation are discarded.
2. To `off`. The line on `powered` applies in every state inside it; diagnostic and `powered` have no exit actions, so nothing runs on the way; the loop starts again at `off`, whose entry sends the off mode.
3. It is dropped: neither standby, nor `powered`, nor the operation mentions `cmd.halt` there.
4. In `off`, without passing through running. `cmd.halt` is taken when it arrives (running waits for it): the drive is disabled and the flow goes to standby. When standby begins its choice, `cmd.go` and `key.ignitionOff` are both waiting; the line on `powered` is tried before standby's own lines (outer level first), so `key.ignitionOff` wins although `cmd.go` arrived earlier. `off` then drops `cmd.go` when it begins to wait.
5. Yes, only through `ecu.shutdown`, written once at the top of the operation; every other way out loops.

### 8. Anti-pinch condition
1. The window reverses at 100 ms: the delivery updates `sense.current`, the condition is checked at that moment and holds, `pinchReversals` is counted, `reversing` drives down for 400 ms and the flow returns to `idle`.
2. No. The request is delivered first, so `closing` chooses at that event, when `sense.current` still holds the old value: the halt line is taken and the window stops in `idle`. The new current value arrives after the choice.
3. It reverses at once: the condition is checked when `closing` is reached and holds already.
4. No. The filter writes 4500, which is not above the limit, and then lower values; the condition only sees what the filter writes, never the raw 9000.
5. The window goes to `idle` without reversing: the 8 s timer and the delivery fall on the same instant, and the timer comes first.

### 9. Periodic window controller
1. At 30 ms. The first release at 10 ms runs `idle`'s entry; the releases at 20 ms and 30 ms check the conditions, and at 30 ms the switch is up, so `closing` is entered and its entry starts the motor.
2. At 40 ms. The release that arrives in `closing` does not run the per-step action; the next one does.
3. At 100 ms, the first release after the switch returned: line `2` of `closing` holds, `idle`'s entry stops the motor.
4. `reversing`: the current line is written first.
5. At 610 ms. The 400 ms are due at 550 ms, but the releases from 500 ms to 600 ms are skipped and make no choice; the first release that runs is at 610 ms, and it takes the timer line.
