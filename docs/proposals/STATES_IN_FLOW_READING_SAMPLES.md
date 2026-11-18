# States in the flow: reading samples

**Purpose:** prototype P3 of the design review. Six small behaviours written in the revision 2 text of [the proposal](STATES_IN_FLOW_PROPOSAL.md), each with a sketch of its Flow View drawing and five plain questions. Read the text and the drawing cold, answer the questions, then compare with the answers at the end. If a question cannot be answered from the text and the drawing alone, the look has failed there.

Nothing here is accepted by a parser yet; the fences are plain text.

**How to read the text, in five lines:**
- `stay` at the head of a trigger: the state reacts and keeps waiting. Anything else at the head leaves the state.
- A leaving trigger that ends in `;` just leaves; `to S` leaves for state `S`; a block runs after the state's `on exit`.
- `} until <trigger>;` is the state's one way out.
- `keep` / `ignore` at the top of the operation: what happens to an input a state does not handle (waits for a later state, or is dropped).
- Among triggers that are ready together, the one written first wins; the `on receive` lines of a state count as one group, served in the order the messages arrived. A timer that expires at the same instant as a message arrives comes first.

**How to read the drawing:** rounded boxes are states, square boxes are plain steps, `◇` is a decision, `◆` a merge, `●` the start, `◉` the end. Lines inside a box are things the state does without leaving. Arrows out of a box are ways out, numbered in written order (`1a`, `1b` share a group). Back jumps run up the left side, skips down the right side.

## 1. Lock controller

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

**Questions.**
1. The lock is unlocked. A lock request arrives at 0 ms, and a second lock request at 100 ms, during the pulse. What happens to the second request?
2. A lock request arrives at 0 ms and an unlock request at 100 ms. When does the unlock pulse start, and how many pulses are there in total?
3. A status query arrives at 100 ms, during the lock pulse that started at 0 ms. When is it answered, and does the answer say locked or unlocked?
4. Lock at 0 ms, unlock at 100 ms, power-off at 300 ms. What happens, and in which position is the lock at the end?
5. After `reportShutdown()` has run, a lock request arrives. What happens?

## 2. Traffic light with a pedestrian request

```text
operation cycle() {
  ignore ped.button;
  var requested: bool = false;
  while (true) {
    state green {
      on entry { send lamps.set(Light.green); }
      on receive ped.button() stay { requested = true; }
      after 10s when (requested);
      after 60s;
    }
    state yellow {
      on entry { send lamps.set(Light.yellow); }
    } until after 3s;
    state red {
      on entry { send lamps.set(Light.red); }
    } until after 2s;
    if (requested) {
      state walk {
        on entry { send walkSign.set(true); }
        on exit { send walkSign.set(false); }
      } until after 15s;
      requested = false;
    }
  }
}
```

```text
 cycle()    ignore: ped.button
            ●
            │
   [ var requested = false ]
            │
  ┌────────►┤  while (true)
  │ ╭───────▼─────────────────────────────╮
  │ │ green                               │
  │ │ entry: send lamps.set(green)        │
  │ │ 1 ped.button() stay: requested = …  │
  │ ╰───────┬─────────────────┬───────────╯
  │         │ 2: after 10s    │ 3: after 60s
  │         │    [requested]  │
  │         ◆◄────────────────┘
  │ ╭───────▼─────────────────╮
  │ │ yellow                  │
  │ │ entry: send …(yellow)   │
  │ ╰───────┬─────────────────╯
  │         │ until after 3s
  │ ╭───────▼─────────────────╮
  │ │ red                     │
  │ │ entry: send …(red)      │
  │ ╰───────┬─────────────────╯
  │         │ until after 2s
  │         ◇ requested
  │   yes ╱   ╲ no
  │ ╭────▼──────────────╮  │
  │ │ walk              │  │
  │ │ entry: send …     │  │
  │ │ exit:  send …     │  │
  │ ╰────┬──────────────╯  │
  │      │ until after 15s │
  │ [ requested = false ]  │
  │      └──────►◆◄────────┘
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
  ignore pwr.on, pwr.off, diag.enter, diag.exit, cmd.start, cmd.stop;
  state off {
    on entry { send status.mode(Mode.off); }
  } until on receive pwr.on();
  state standby {
    on entry { send status.mode(Mode.standby); }
    on receive pwr.off() to off;
    on receive cmd.start();
    on receive diag.enter() to diagnostic;
  }
  state running {
    on entry { send status.mode(Mode.running); send drive.enable(true); }
    on exit { send drive.enable(false); }
    on receive pwr.off() to off;
    on receive cmd.stop() to standby;
    on receive diag.enter();
  }
  state diagnostic {
    on entry { send status.mode(Mode.diagnostic); }
    on receive pwr.off() to off;
    on receive diag.exit() to standby;
  }
}
```

Where hierarchy would later help: `on receive pwr.off() to off;` is written in three states. A parent state `on` around `standby`, `running` and `diagnostic` (stage 4 of the proposal) would hold it once.

```text
 modes()    ignore: pwr.on, pwr.off, diag.enter, diag.exit, cmd.start, cmd.stop
              ●
              │
   ┌─────────►┤
   │  ╭───────▼───────────────────╮
   │  │ off                       │
   │  │ entry: send mode(off)     │
   │  ╰───────┬───────────────────╯
   │          │ until pwr.on()
   │ ┌───────►┤
   │ │ ╭──────▼───────────────────────────────╮
   │ │ │ standby                              │
   │ │ │ entry: send mode(standby)            │
   │ │ ╰──┬─────────────┬──────────────┬──────╯
   ├─┼────┘1a pwr.off() │1b cmd.start()│1c diag.enter() ──────────┐
   │ │                  │              (skip, right gutter)       │
   │ │ ╭────────────────▼─────────────────────╮                   │
   │ │ │ running                              │                   │
   │ │ │ entry: send mode(running); enable    │                   │
   │ │ │ exit:  send drive.enable(false)      │                   │
   │ │ ╰──┬─────────────┬──────────────┬──────╯                   │
   ├─┼────┘1a pwr.off() │1b cmd.stop() │1c diag.enter()           │
   │ ├──────────────────┘              │                          │
   │ │ ╭───────────────────────────────▼──────╮                   │
   │ │ │ diagnostic                           │◄──────────────────┘
   │ │ │ entry: send mode(diagnostic)         │
   │ │ ╰──┬─────────────┬─────────────────────╯
   └─┼────┘1a pwr.off() │1b diag.exit()
     └──────────────────┘
```

**Questions.**
1. `cmd.start` arrives while the mode is off, then `pwr.on`. Does the manager go to running?
2. In running, `cmd.stop` and `pwr.off` arrive at the same instant, `cmd.stop` first. Which mode is it in afterwards?
3. In running, `diag.enter` arrives. Is the drive disabled? Where does `diag.exit` lead?
4. In standby, `diag.exit` arrives. What happens?
5. Can this operation ever end?

## 4. Connection manager with retry, timeout and backoff

```text
operation manage() {
  ignore link.ack, link.down;
  while (true) {
    var attempt: uint = 0;
    var backoffMs: uint = 10;
    var up: bool = false;
    while (attempt < 5 and not up) {
      attempt = attempt + 1;
      publish link.hello(attempt);
      state awaiting {
        on receive link.ack(id) when (id == attempt) { up = true; }
        after (backoffMs * 1ms) {
          if (backoffMs < 1000) { backoffMs = backoffMs * 2; }
        }
      }
    }
    if (up) {
      state connected {
        on entry { publish status.connected(true); }
        on exit { publish status.connected(false); }
      } until on receive link.down();
    } else {
      state cooldown { } until after 30s;
    }
  }
}
```

```text
 manage()    ignore: link.ack, link.down
            ●
            │
  ┌────────►┤  while (true)
  │ [ attempt = 0; backoffMs = 10; up = false ]
  │         │
  │ ┌──────►┤  while (attempt < 5 and not up)
  │ │ [ attempt = attempt + 1 ]
  │ │ [ publish link.hello(attempt) ]
  │ │ ╭─────▼───────────────────────╮
  │ │ │ awaiting                    │
  │ │ │ other ack(…): dropped       │
  │ │ ╰─────┬─────────────────┬─────╯
  │ │       │ 1: ack(id)      │ 2: after (backoffMs * 1ms)
  │ │       │ [id == attempt] │
  │ │  [ up = true ]   ◇ backoffMs < 1000
  │ │       │          │ yes: [ backoffMs = backoffMs * 2 ]
  │ │       ◆◄─────────┘
  │ └───────┘
  │         │ (loop ends)
  │         ◇ up
  │   yes ╱   ╲ no
  │ ╭────▼──────────────╮  ╭───▼──────────╮
  │ │ connected         │  │ cooldown     │
  │ │ entry: publish …  │  ╰───┬──────────╯
  │ │ exit:  publish …  │      │ until after 30s
  │ ╰────┬──────────────╯      │
  │      │ until link.down()   │
  │      └──────►◆◄────────────┘
  └──────────────┘
```

Kept input: none. Every input that `awaiting`, `connected` or `cooldown` does not handle is dropped.

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
    state low { } until on receive sw.level(v) when (v);
    state risingCheck {
      on receive sw.level(v) when (not v) to low;
      after 20ms { publish out.pressed(); }
    }
    state high { } until on receive sw.level(v) when (not v);
    state fallingCheck {
      on receive sw.level(v) when (v) to high;
      after 20ms { publish out.released(); }
    }
  }
}
```

```text
 debounce()
            ●
            │
  ┌────────►┤  while (true)
  │ ┌──────►┤
  │ │ ╭─────▼──────────────────────╮
  │ │ │ low                        │
  │ │ │ other level(…): dropped    │
  │ │ ╰─────┬──────────────────────╯
  │ │       │ until level(v) [v]
  │ │ ╭─────▼──────────────────────╮
  │ │ │ risingCheck                │
  │ │ │ other level(…): dropped    │
  │ │ ╰─────┬────────────────┬─────╯
  │ └───────┘1: level(v)     │ 2: after 20ms
  │            [not v]       │
  │                 [ publish out.pressed() ]
  │ ┌──────►┌────────────────┘
  │ │ ╭─────▼──────────────────────╮
  │ │ │ high                       │
  │ │ │ other level(…): dropped    │
  │ │ ╰─────┬──────────────────────╯
  │ │       │ until level(v) [not v]
  │ │ ╭─────▼──────────────────────╮
  │ │ │ fallingCheck               │
  │ │ │ other level(…): dropped    │
  │ │ ╰─────┬────────────────┬─────╯
  │ └───────┘1: level(v) [v] │ 2: after 20ms
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

**Questions.**
1. `go(false)` arrives. Which state comes next, and what does it wait for?
2. `retry` arrives at 5 ms while in `state0`, then `go(false)` at 10 ms. Does the flow leave `state1` at once?
3. `go(true)` arrives at 0 ms and another `go` at 5 ms. What happens to the second one?
4. After `go(true)` at 0 ms, when does `process()` run?
5. What happens after `state4`? Does the flow return to `state0`?

## Answers

### 1. Lock controller
1. It waits (the operation keeps requests). At 250 ms the pulse ends, the motor goes idle, `locked = true`, and `isLocked` looks at the waiting request at once: it is a lock request, its guard `not lock` is false, so it is dropped. One pulse, the lock stays locked.
2. At 250 ms, right after `locked = true`: `isLocked` takes the kept unlock request at once. The unlock pulse runs from 250 to 500 ms, then `locked = false` and back to `unlocked`. Two pulses.
3. It waits until the pulse ends. At 250 ms `isLocked` answers it (staying, `1a`); `locked = true` has already run, so the answer says locked, with one pulse.
4. Lock pulse 0 to 250 ms; at 250 ms the kept unlock starts the unlock pulse (250 to 500 ms). Power-off at 300 ms waits (kept). At 500 ms the motor goes idle, `locked = false`, the flow returns to `unlocked`, which finds the power-off waiting and goes to `report`: `reportShutdown()` runs and the operation ends. The lock is unlocked and the motor idle.
5. It is discarded. The operation has ended; nothing answers requests or queries any more.

### 2. Traffic light
1. At 10 s. The press sets `requested` without leaving green (line `1`); from then on arrow `2` waits only for the 10 s minimum. Then yellow 3 s, red 2 s, walk 15 s, and green again.
2. At 20 s, immediately after the press: the 10 s have already passed, and the request makes arrow `2` ready.
3. Green 60 s (arrow `3`), yellow 3 s, red 2 s, then the decision finds no request and skips the walk phase; green again. A cycle without request lasts 65 s.
4. No. Presses outside green are dropped (the operation ignores the button), and `requested` is cleared after the walk. The next green waits for a new press, or ends after 60 s.
5. No. The press during yellow is dropped, the decision after red finds no request, and the walk phase is skipped. The pedestrian must press again during the next green.

### 3. Mode manager
1. No. `cmd.start` is dropped while off. After `pwr.on`, standby waits for a new `cmd.start`.
2. Off. `cmd.stop` is served first (it arrived first): running's exit disables the drive and the flow jumps to standby. Standby then finds `pwr.off` waiting and jumps to off.
3. Yes: running's exit action disables the drive before diagnostic is entered. `diag.exit` leads to standby, not back to running.
4. It is dropped; standby stays.
5. No. Every way out of `diagnostic`, the last state, is a jump, and every other state either jumps or continues to the next state.

### 4. Connection manager
1. Hellos at 0, 10, 30, 70 and 150 ms (timeouts of 10, 20, 40, 80 and 160 ms). The fifth timeout is at 310 ms; the inner loop ends with `up` false, and the cooldown runs from 310 ms to 30.31 s. Then everything starts again from attempt 1 with a 10 ms timeout.
2. Nothing. Its id does not match the current attempt, so it is dropped. The second attempt's 20 ms timer keeps running from 10 ms, and the third hello goes out at 30 ms.
3. No. The timer expiring at 30 ms comes first: the backoff doubles to 40 ms, the loop sends `hello(3)` and waits again. The `ack(2)`, which arrived at that same instant, is then looked at by the new wait and dropped, because its id is not 3.
4. The exit publishes `connected(false)`, the outer loop starts again with attempt 0, a 10 ms timeout and `up` false, and `hello(1)` goes out at once.
5. Nothing. Acks are dropped outside `awaiting`; the cooldown ends 30 s after it started.

### 5. Debounce
1. At 28 ms. `true` at 0 enters `risingCheck`; `false` at 5 goes back to `low`; `true` at 8 enters `risingCheck` again, whose 20 ms count from 8 ms.
2. No. In `risingCheck` a `true` report does not match `when (not v)` and is dropped; the 20 ms still count from 0, so `pressed` is published at 20 ms.
3. Yes. The 20 ms timer and the `false` report fall on the same instant, and the timer comes first: `pressed` at 20 ms, then `high` finds the `false` report waiting and goes to `fallingCheck`. `released` follows at 40 ms unless a `true` report comes first.
4. It is dropped; `low` keeps waiting for `true`.
5. At 130 ms. `false` at 100 enters `fallingCheck`; `true` at 105 goes back to `high`; `false` at 110 enters `fallingCheck` again, and its 20 ms end at 130 ms.

### 6. The owner's picture
1. `state1`: the lamp shows retry, and the state waits for `cmd.retry`.
2. No. The `retry` at 5 ms was dropped in `state0` (the operation ignores what a state does not handle). `state1` waits for a new `retry`.
3. It is dropped: `state2` does not handle `go`, and the operation ignores it.
4. At 10 ms: `state2` ends after 10 ms, the branches merge and `process()` runs.
5. `report()` runs and the operation ends; there is no way back to `state0`. Later `go` and `retry` messages are discarded.
