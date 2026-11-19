# swa.ml: states as steps of the flow

**Status:** **final specification, revision 6**, 19 November 2026 (revision 5 with the decisions taken after four adversarial reviews of the implementation, listed in "Revision 6" below; where an older section still says otherwise, revision 6, the maintained chapters 3.6, 4 and 6.5 and RELEASE_3_0 win), from which the language implementation is built. Not yet normative: the packages of section 11 make it normative, one by one. Nothing here changes the grammar, validator, simulator, standard version or a published artefact by itself. New syntax is in `text` fences because the released parser does not accept it.

Every runtime rule of this revision has been run by an interpreter prototype; "measured" means measured by one, and section 8 lists every measurement with its numbers. What remains argued and not measured is named where it is stated.

**Bases:**
- **Language:** main `1d5ef7e` (2.3 candidate: WP1 to WP7 merged; WP7's release guard is spelled `when (g)` there) and WP8 (ADR 0025, real-time placement).
- **Revision 4** of this document (`d117200`) and its reading samples.
- **Owner decisions (binding, given after revision 4):** listed in "Changes since revision 4"; they settle revision 4's open decisions O1 to O6 and add the periodic end rule.
- **Prototypes (all throwaway code, marked PROTOTYPE, never merged):**
  - **P1r and P5** (flat states, parents, the migrator, the grammar spike) and **P4 and P6** (wakes, `StateLoop`, periodic machines): branch `prototype/states-in-flow-r4b`, head `0e58970`; evidence kept outside this repository (states-p4 and states-p6).
  - **P7** (this revision's experiments: the machine's own writes, the bound within one release, `if` tests and scheduling steps): branch `prototype/states-in-flow-r5` (from `0e58970`); models and evidence kept outside this repository (states-p7). Rerun: `npm run build`, `bash p6/evidence.sh`; corpus: `P4_ROOT=<worktree> node p4/measure.mjs <worktree>/out <migrated corpus> <out.json>`, then `node p4/compare.mjs <base results> <out.json> <states-p4 identity map>`.
- **Design review of revision 3:** kept outside this repository (review-states-design-r3); every blocking and important finding is closed (revision 4 table, kept in the history of this file), except I10 (extension cost, section 12) and DN (compact boxes, a drawing question for the extension, 2.1).
- **Reading samples:** [STATES_IN_FLOW_READING_SAMPLES.md](STATES_IN_FLOW_READING_SAMPLES.md), updated for this revision; every answer of samples 1 to 10 has been run.

## The whole thing in ten sentences

1. A state is an ordinary step of the flow: the flow reaches it, its `on entry` runs once, and it stays entered, waiting, until a look leaves it; a state with nothing to look at does not wait.
2. Inside its braces a state holds `on entry`, `on exit`, event lines (`on receive p.m(x) { … }`, `after D { … }`), ordinary statements and, last, inner states; a state with inner states is a parent, and what is written on it applies in every state inside it.
3. `if` checks now and skips when false, everywhere; it never waits: what waits is the state, which looks at what is inside its braces again each time something happens to it.
4. Something happens to a state when it is reached, when a message that it or a parent names is delivered, when its or a parent's timer runs out, when someone else writes or a delivery updates a value its statements read, when one of its own lines writes a value that a statement before that line already read, and, in a machine released `on every P`, at every release.
5. A look goes through the parents' braces first, then the state's, in written order: the line of what happened runs, every statement runs (a plain statement in a state is "during" work), the look stops at the first `exit;` or `to S;`, and it reads every value as it is at the moment it runs.
6. A look sees at most one message, in delivery order, and takes it when a line on its member runs; a look that leaves before that line leaves the message queued for the state reached; a message that the state and its parents do not name is dropped while the state waits, nothing is written for it, and whatever must be remembered is remembered in a variable.
7. `exit;` leaves and goes on with what is written next, `to S;` goes to state `S`, also straight into a state inside a parent but never into an `if` branch or a loop; a leave written on a parent leaves everything inside it; these two are the only bodies that may drop their braces.
8. Leaving runs in the order of the text, the statements before the leave, then `on exit` of every state left (innermost first), then `on entry` of every state entered (outermost first), and the newly reached state does its work at once, in the same release; a parent reached is looked at before its first inner state is entered.
9. A timer runs once per entry of its state, counted from that entry; in a machine released `on every P` it keeps running across releases, skipped ones too, and is looked at at the first release at or after its moment.
10. Released `on start`, the operation runs once; released `on every P`, it keeps its place, locals and loops between releases, looks once per release, ends a release when a state (a named step too) is reached a second time in it, and when it reaches its end no state is active and the next release starts it again from the top; a machine that fails ends, either way.

## Revision 6: decisions after the adversarial reviews

Four adversarial reviews of the implementation (flat states and migration; parents; wakes and `StateLoop`; periodic machines) found mechanisms that were unsound or could not be stated simply. Following the owner's standing rules (simplicity, minimum rules, no pointless warnings, nothing unsound in a language that cannot change later), the orchestrator decided as follows; RELEASE_3_0 records each among the owner decisions of the states section, and chapters 3.6, 4 and 6.5 state the rules.

| Topic | Decision |
| --- | --- |
| `StateLoop` (3.17, SIF-R18) | **Cut.** Its configuration comparison stopped loops that would end (a loop through another occurrence; locals and call stacks of plain activations). A loop without time passing ends at the step limit; the `StepLimit` violation carries a message that names the instant and the activations that ran in it (with each machine's state). |
| SIF-D05 | **Cut.** It rejected valid models (a cycle whose `on entry` waits). |
| SIF-D04 | Only the condition of an `if` (or `else if`) standing directly in a state of a waiting machine that reads `now()`, directly or through a called operation: time passing wakes nothing. `now()` in plain statements, event line blocks, entry/exit and periodic machines is allowed. |
| SIF-D06, the periodic backlog | **Cut.** The warning fired on the natural form; a sender that overflows is reported by the run. The backlog was unreachable (deadline at most the period). |
| When a message is taken (3.3, 3.5, 3.6) | A message is taken when a line on its member runs for it; a look that leaves before (an earlier statement, a timer line or a parent's line left) leaves it queued at the head of its queue for the state reached. `leftBeforeLine` is gone. Waiting and periodic machines alike. |
| A wait that begins with input queued (3.5) | No zero-time wait: the state waits and its queued input is looked at as at a delivery, at the next scheduling point and in activation order, as 2.2 did (an older activation of the occurrence that became ready meanwhile runs first): owned input in delivery order, unnamed input dropped until a named message is taken; with none, a pending wake makes a look. At a release the same rule applies. |
| A sampled member a state both reads and names in a line | Its delivery makes one look, with the message, whether the machine was waiting or busy (no sample wake). |
| Leaves written on a parent (3.9) | A leave leaves the state it is written on and everything inside it; a target inside a state just left is entered again from there (its `on entry` runs, its timers restart). |
| A parent reached (3.2, 3.11) | It is looked at (its levels) before its first inner state is entered; if that look leaves, no inner state is entered; the inner state's arrival look then walks its own level only. |
| A `var` in a parent's braces (3.10) | A local of the look, seen by its later items and by the items of its inner states; not by `on entry`/`on exit`. |
| Timing and `machines` (4.5, 4.6) | A band ends when its state is left: new observation `leave` when the flow goes on outside every state; `machines["c.op"].state` is `''` then; a completed machine reports its last state. Nested states are owned by their parent in the projection. Periodic machines get the phases of a plain activation within each release (release, dispatch/ready, wait, requestWait) with the release number; bands carry `held`; states passed through are markers. |
| A periodic machine that fails (3.16) | It ends, like a waiting machine that fails: no `on exit`, later releases do nothing. |
| The release bound (3.15) | Named steps count: `while (true) { state pulse { on entry { … } } }` pulses once per release after the first. |
| The mirror heater (1.12) | Measured: the flag code switches off at 600.2 s, `after 600s` at 600.3 s (one period late). The rewrite writes `after 599900ms` (6000 releases counted from the arrival look are 5999 periods) and switches off at 600.2 s; the 600 s bench is a test. |
| Release guards | A periodic machine's `skip` follows its `unlock`, as every skip (ADR 0025). |
| Wakes (3.7, 3.8) | Kept. SIF-R08 counts a statement whose text names the value (short-circuited or untaken branches count). A pending wake records the cause of its first write. The number of looks in one instant can depend on the order of deliveries, so plain statements must not count events. |
| Migration (7.1, 7.2, 7.4) | Bindings renamed all at once (swapped names never collapse), never inside strings or comments; comments kept; the CLI validates what it wrote and writes nothing with an error. Accepted behaviour changes: r10 (owned input looked at in delivery order instead of 2.2's queue-creation order, which also decides what is dropped) and C-3 (an `if` test in a migrated block is no scheduling step: within 2.3 no store depends on it, but relative to 2.2 it can move a publish before or after a state change, which can change the order inside a component and, with the drop rule, which state takes or drops a message and so a stored value), each pinned by one model in gate B. |

### The counting table (periodic machines)

A state just reached looks at the same values that made the previous state leave (its arrival look counts as a look of that release). The usual habits, written correctly:

| Habit | Correct text |
| --- | --- |
| Debounce over N samples | `state checking { on entry { n = 0; } if (not pressed) to released; n = n + 1; if (n >= N) exit; }`: the arrival look counts the sample that led here, so start at 0 and count it. |
| A timeout of N releases | `state waiting { on entry { n = 0; } n = n + 1; if (n >= N + 1) exit; }` leaves N releases after the arrival; or write a timer. |
| A counter of N releases replaced by a timer | `after ((N - 1) * P)`: the release that reached the state counts as the first (the heater: 6000 releases of 100 ms are `after 599900ms`). |
| Hysteresis | `state low { if (v > hi) exit; } state high { if (v < lo) to low; }`: right as written (the conditions are disjoint). |
| Edge detection | `state up { if (not s) exit; } state down { if (s) { edges = edges + 1; to up; } }`: right as written. |
| A condition that must hold at two releases | `state low { if (v >= under) to normal; n = n + 1; if (n >= 2) exit; }` with `n = 0` on entry (sample 10): the arrival look is the first. |

## Changes since revision 4

### Owner decisions after revision 4

| Decision | Effect in this revision | Where |
| --- | --- | --- |
| A state is a step; no container, no `initial`/`final`; minimum keywords; nothing for a rule; no pointless warnings; no extra information on diagrams | Revision 4's warnings SIF-D02, D05, D07, D08, D09, D10 and D12 are deleted; six diagnostics remain, each with the reason a model cannot simply behave (4.4). | 4.4 |
| `if` never waits; one word for conditions; `when` leaves the language | Unchanged in substance. Correction: `when` stands in three places of the 2.3 candidate only, 2.2's transition guards, WP5's completion and WP7's release guard; plain receive statements never had a guard (revision 4 said they had). | 4.1, 7 |
| Unhandled message dropped; remember with a variable | Unchanged. | 3.6 |
| `to S` into a substate; never into an `if` branch or a loop | Unchanged. | 1.16, 3.9 |
| Narrow short form (O1) | **Adopted**: only `exit;` and `to S;` may drop their braces. | 1.3, 4.1 |
| A state is entered once and stays entered until it exits; in a periodic machine a release only looks; `on entry` runs once; a timer fires once per entry, keeps running across releases (also skipped ones) and is checked at releases | Stated as rules SIF-R01, R03, R14, R15. (O2 adopted.) | 3 |
| A newly reached state does its work in the same release (O3) | Adopted; its consequence for counting is shown with the supply monitor (1.13). | 3.14, 1.13 |
| Leaving in written order (O4) | Adopted. | 3.9 |
| A periodic machine that reaches its end: nothing happens, no state is active, the next release starts the flow again from the top | **Replaces** revision 4's "the end is unreachable" (revision 4's SIF-S07 and SIF-D04 deleted; `return` is allowed in the flow). The end marker means "until the next release" in a periodic operation. | 3.16 |
| A plain statement in a state runs at every look, no warning (O6) | SIF-D08 deleted. | 3.2 |
| Parents and a shared exit are one mechanism; periodic machines through the schedule, no new keyword; conditions read only things that come from somewhere | Unchanged. | 3.11, 3.14, 3.4 |
| One final release with everything; WP5's state forms replaced in place, never shipped | The implementation plan (section 11) is one release in six packages. | 11 |

### Prototype findings built in

| Finding (prototypes P1r, P5, P4, P6) | Revision 5 |
| --- | --- |
| Corpus, 267 results: 0 verdicts, 1 final store (r10), identical order once a false guard `if` in a line is not a scheduling step | **A test is not a step:** an `if` written in a state's braces (outside `on entry`/`on exit`) takes no scheduling step; the statements it runs do (SIF-R12). P7 measured the general form: same corpus result. |
| Window lifter with parents identical to 2.2 apart from the parents' `state` observations | Recorded as the parents gate (8). |
| Samples 1 to 7: 35 answers match | Kept; rerun under P7 (8). |
| Narrow short form: no ambiguity; half-typed text still fails to parse | Adopted (O1). |
| A timer becomes present when a look starts | SIF-R03: a timer that has run out is present at the next look that starts, whatever caused it. |
| A suspending line on a parent delays a substate's timer (250 ms pulse ended at 270 ms) | Run to completion stated as the rule, with this example (3.12, section 5). |
| "A substate can shield itself" needs a variable set in `on entry`/`on exit` | The shielding pattern is written that way (3.11). |
| `if` gains `else if` | **New against 2.2** (2.2's `else` takes a block only). Stated in the grammar delta (4.1). |
| A message taken by a look that left before its line ran | Revision 5: new reason `leftBeforeLine`; revision 6: the message is not taken and stays queued. |
| Pending wakes are needed (a waiting machine stalls silently without them) | SIF-R07: a write made while the machine is busy wakes it when it begins to wait. |
| `StateLoop` configuration must include what is present and exclude unbounded loop counters | SIF-R18 defines the configuration so. |
| A `wake` observation is needed | Trace kind `wake` (4.5). |
| Read sets per effective occurrence through helpers and redefinition work; only ports can be shadowed | SIF-R07 states it; the static rule that forbids a local named like an attribute stays the reason only ports can be shadowed. |
| Cost: nothing measurable on the door showcase; +35 % wall time for a condition on an attribute written every 1 ms | Section 5, point 9. |
| Known `StateLoop` misses: growing ping-pong, ping-pong through a zero-latency request | Stated with what stops them (the step limit) and how it is reported (3.17). |
| Periodic: a bound on arrivals within one release is needed | **Adopted and measured:** a state reached a second time in one release ends the release in that state (SIF-R16). |
| Periodic: message and expired timer at one release go by written order | Stated (SIF-R15). |
| Periodic: the backlog text is dead under deadline ≤ period | Deleted; the deadline rule says why (SIF-R15). |
| Periodic: Timing needs a periodic projection; skips carry no activation id | Timing projection defined (4.6); `skip` carries the machine's activation (4.5). |
| Sample 9 matches; door rewrites 36 of 36 identical; the natural three-state supply rewrite is wrong (the arrival look counts) | The supply monitor example shows the trap and the correct text (1.13). |
| WP5 examples 44, 46, 47 rewritten by hand: identical stores; `defer` becomes remembered variables | Migration section 7.3. |

### Points settled in this revision

| # | Point | Outcome | Evidence |
| --- | --- | --- | --- |
| 1 | The machine's own writes | **Adopted:** when a line's block writes a value that a statement already run in the same look reads, the state looks again at once, with nothing present (SIF-R08). It cannot repeat itself: a look with nothing present runs no line. Waiting machines only; a periodic machine sees its own write at the next release, because a second look would run its per-release work twice. Corpus unchanged; P4/P6 evidence unchanged except the one case that showed the trap. | P7 `p7-own-writes.txt`, `p4-values-and-wakes.txt` |
| 2 | Sample 8 answers | WP6-R03 unchanged: a look reads the values as they are when it runs. Sample 8 Q2 corrected (the window reverses), the flip added, Q5's reason restated. | `p4-sample8-sampled.txt` |
| 3 | The arrival-look counting trap | Shown with the supply monitor, with the correct text (1.13). No rule removes it without changing sample 9 or the owner's O3; one option for the owner is described, not adopted (5, point 7). | P7 `p6-heater-supply-bench.txt` |
| 4 | Bound within one release | **Adopted:** a state reached a second time in one release ends the release in that state; its look comes at the next release (SIF-R16). `StateLoop` is then never needed in periodic machines. | P7 `p7-release-bound.txt` |
| 5 | `StateLoop` | Final definition, waiting machines only; the two known misses stop at the step limit and are reported as `StepLimit` (3.17). | `p4-stateloop.txt` |
| 6 | Trace | Final kinds and reasons (4.5); Timing projection for periodic machines (4.6). | `p6-timing-projection.txt` |
| 7 | Operations with states; WP8 T4 | SIF-S01 (3.1); a waiting machine needs an extended task, a periodic machine may run on a basic task when nothing in it can suspend (9). | |
| 8 | Migration | Final recipe, hand rewrites, the user command, the compatibility gates (7). | P1r `migration-run.txt` |

## 0. Summary: the lock controller

```text
operation control() {
  var wanted: bool = false;                  // the latest request: true = lock
  state powered {
    on receive status.query() { publish status.report(locked, pulses); }
    on receive requests.request(lock) { wanted = lock; }
    on receive power.off() exit;
    state unlocked {
      on entry { locked = false; }
      if (wanted) exit;
    }
    state locking {
      on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.lockPulse); }
      on exit { send motor.lockMotor(LockDrive.idle); }
      after 250ms exit;
    }
    state isLocked {
      on entry { locked = true; }
      if (not wanted) exit;
    }
    state unlocking {
      on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.unlockPulse); }
      on exit { send motor.lockMotor(LockDrive.idle); }
      after 250ms to unlocked;
    }
  }
  reportShutdown();
}
```

- **One variable remembers.** Every request, in every state, sets `wanted`; the line is written once, on the parent. The states only ask `if (wanted)`.
- **Nothing starves.** A query during a pulse is answered at once, in its own look, and the pulse timer still ends the pulse at 250 ms.
- **`if` never waits; the state does.** `unlocked` waits; each time a message arrives it looks again and `if (wanted)` is checked again, after the parent's line has set `wanted`.
- **Power-off** leaves whatever state is current (its `on exit` sets the motor idle) and `powered`; the flow goes on with `reportShutdown()`, and the operation ends.
- **Measured:** sample 1, all five answers.

## 1. How it looks: text

### 1.1 A state and what is inside its braces

```text
state name {
  /** documentation */
  on entry { … }                     // once, when the state is reached
  on exit { … }                      // once, on every way out
  on receive p.m(x) { … }            // an event line: runs at the look that sees m
  after D { … }                      // an event line: runs at the first look once D has passed since arrival
  if (c) { … } else if (d) { … } else { … }   // a statement: runs at every look
  …                                  // any other statement: also runs at every look ("during")
  state inner { … }                  // optional, last: the state is a parent
}
```

**The braces are what waits.** A state waits; whenever something happens to it, it looks at its contents again, in written order. An `if` inside the braces is therefore checked at every look; an `if` anywhere else (in the flow, in a block) is checked when the flow gets there. There is one `if`; the place decides how often it is reached.

**Leaving is a statement.** `exit;` and `to S;` stand inside a state: directly in its braces, or at any depth of `if`/`else` blocks inside the braces or inside an event line's block. They never stand in `on entry`, `on exit`, a loop body, an interrupt region or the flow outside states. A block that runs `exit;` or `to S;` leaves; any other block stays. A guard is an `if` inside the block:

```text
on receive requests.request(lock) {
  if (lock) exit;                    // an unlock request is taken and nothing happens
}
```

**Several conditions on one event** are one line with an `if / else if / else` chain. Two lines on the same member in one state are allowed; both run, in written order.

**Waiting:**
- **A state with something to look at** (an event line or a statement, in it or in an enclosing parent) waits until a look leaves.
- **A state with nothing to look at** (only `on entry`/`on exit`, and no enclosing parent has lines or statements) does not wait: entry, exit, next statement. It is a named step: a jump target, a migrated 2.2 final state, the owner's `state4`.
- **A state that can wait but never leave** is allowed, without a warning: it waits for good, as a 2.2 state without transitions did.

### 1.2 One look, by hand

`closing` from the anti-pinch example (1.8), waiting mode:

```text
state closing {
  on entry { drive(MotorDirection.up); }
  if (sense.current > pinchLimit) { pinchReversals = pinchReversals + 1; to reversing; }
  on receive requests.request(c) { if (c == WindowRequest.halt) to idle; }
  after 8s to idle;
}
```

| What happens | The look |
| --- | --- |
| Arrival | The pinch `if` is checked with the current value. No message is present, no timer has run out. |
| A request arrives | The pinch `if` is checked with the current value as it is when the look runs, then the request line runs; a halt leaves. |
| A new current value is delivered to `sense.current` | The pinch `if` is checked with the new value; the request line does not run (no request is present). |
| 8 s after arrival | The pinch `if` is checked, then the timer line leaves. |

### 1.3 The short form

**Adopted (O1).** A body that consists only of `exit;` or only of `to S;` may be written without braces, after an event line head, after `if (…)` and after `else`:

```text
after 250ms exit;                    // same as  after 250ms { exit; }
on receive power.off() exit;         // same as  on receive power.off() { exit; }
if (wanted) exit;                    // same as  if (wanted) { exit; }
if (sense.current > pinchLimit) to reversing;
```

- **No ambiguity** (measured by the P1r grammar spike: no ambiguity report): a short body is never an `if`, so there is no dangling `else`.
- **Half-typed text still fails:** `on receive m(x)` followed by `if (…)` is a syntax error, as before.
- **No rule depends on the form.** Both forms build a block with a `braced` flag; diagrams, traces, statement identities (measured: the same with and without braces) and every rule of section 3 see a block.
- **Every other single statement needs braces.** The general C rule is rejected: it would let a half-typed `on receive m(x)` absorb the next statement as its body without an error.

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

The `if` between the states is checked once, when the flow gets there. `state4` has nothing to look at, so it does not wait: `report()` runs and the operation ends. Measured: sample 6.

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

### 1.5 The lock controller

Section 0 is the text.

```text
 «operation» control · on start
               ●
        [ var wanted = false ]
  ╭────────────▼──────────── powered ───────────────────────────╮
  │ status.query() : publish status.report(locked, pulses)       │
  │ requests.request(lock) : wanted = lock                       │
  │  ┌────────►┤                                                 │
  │  │ ╭───────▼───────────────╮                                 │
  │  │ │ unlocked              │                                 │
  │  │ │ entry: locked = false │                                 │
  │  │ ╰───────┬───────────────╯                                 │
  │  │         │ [wanted]                                        │
  │  │ ╭───────▼──────────────────────────╮                      │
  │  │ │ locking                          │                      │
  │  │ │ entry: pulses = pulses + 1; …    │                      │
  │  │ │ exit:  send motor.lockMotor(idle)│                      │
  │  │ ╰───────┬──────────────────────────╯                      │
  │  │         │ after 250ms                                     │
  │  │ ╭───────▼───────────────╮                                 │
  │  │ │ isLocked              │                                 │
  │  │ │ entry: locked = true  │                                 │
  │  │ ╰───────┬───────────────╯                                 │
  │  │         │ [not wanted]                                    │
  │  │ ╭───────▼──────────────────────────╮                      │
  │  │ │ unlocking                        │                      │
  │  │ │ entry: pulses = pulses + 1; …    │                      │
  │  │ │ exit:  send motor.lockMotor(idle)│                      │
  │  │ ╰───────┬──────────────────────────╯                      │
  │  └─────────┘ after 250ms                                     │
  ╰────────────┬─────────────────────────────────────────────────╯
               │ power.off()
       [ reportShutdown() ]
               ◉
```

- **Parent lines first.** At a look of `unlocked` caused by a request, `powered`'s request line sets `wanted`, then `unlocked`'s `if (wanted)` is checked with the new value: the request is acted on in the same look.
- **During a pulse** `locking` has only a timer. A request at 100 ms is taken by `powered`'s line (it sets `wanted`); `locking` keeps pulsing. At 250 ms the timer leaves; `isLocked` is reached, its entry sets `locked = true`, and its arrival look checks `if (not wanted)`: an unlock request that came during the pulse starts the unlock pulse at once.
- **What is lost against WP5's `defer`** (never shipped): `defer` replayed every deferred request in order; `wanted` keeps the last one. Lock, unlock, lock during one pulse gives no further pulse (the lock is already locked).

### 1.6 Parents and direct jumps: the door window lifter

The 2.2 `WindowLifter.control()` of the door showcase has six states and 41 transitions, 33 of them back to `idle`. With parents:

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
    on receive supervision.sensorFault() to idle;
    on receive supervision.motionStalled() { stalledStops = stalledStops + 1; to idle; }
    state driven {
      /** Movements requested by the switch; a withdrawn motion permission stops them, not the reversal. */
      on receive permissionIn.motionInhibited() { inhibitedStops = inhibitedStops + 1; to idle; }
      state manualUp {
        on entry { drive(MotorDirection.up); }
        after 8s { runTimeouts = runTimeouts + 1; to idle; }
        on receive supervision.pinchDetected() { pinchReversals = pinchReversals + 1; to reversing; }
        on receive supervision.obstructed() { obstructionStops = obstructionStops + 1; to idle; }
        on receive supervision.endPosition(closed) { if (closed) to idle; }
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
        on receive supervision.endPosition(closed) { if (closed) to idle; }
        on receive requests.request(command) {
          if (command == WindowRequest.manualDown or command == WindowRequest.autoDown) to idle;
        }
      }
      state manualDown {
        on entry { drive(MotorDirection.down); }
        after 8s { runTimeouts = runTimeouts + 1; to idle; }
        on receive supervision.obstructed() { obstructionStops = obstructionStops + 1; to idle; }
        on receive supervision.endPosition(closed) { if (not closed) to idle; }
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
        on receive supervision.endPosition(closed) { if (not closed) to idle; }
        on receive requests.request(command) {
          if (command == WindowRequest.manualUp or command == WindowRequest.autoUp) to idle;
        }
      }
    }
    state reversing {
      /** Pinch reversal: switch requests and a withdrawn motion permission are dropped here. */
      on entry { drive(MotorDirection.down); }
      after 1600ms { runTimeouts = runTimeouts + 1; to idle; }
      on receive supervision.reversalComplete() to idle;
      on receive supervision.endPosition(closed) { if (not closed) to idle; }
      on receive supervision.obstructed() { obstructionStops = obstructionStops + 1; to idle; }
    }
  }
}
```

- **Direct entry.** `to autoUp` from `idle` enters `moving`, then `driven` (their entries, outermost first; they have none), then `autoUp`.
- **Written once.** `sensorFault` and `motionStalled` are on `moving`; `motionInhibited` on `driven`. `obstructed` is missing from 2.2's `autoUp`, so it stays in the four states that have it.
- **Measured (P5):** every door showcase case gives the same verdicts, stores and order as 2.2; the trace differs only by the `state` observations of `moving` and `driven`.
- **30 leaves**, drawn as 25 arrows from box edges and 2 diamonds; 22 arrows to `idle`, in one lane.

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
   │  ╭─────────────────────────── moving ──────────────────────────╮
   │  │ ╭───────────────────────── driven ────────────────────────╮ │
   │  │ │ manualUp (6) ▸ autoUp (4) ▸ manualDown (5) ▸ autoDown (4)│ │
   │  │ │ (compact boxes; pinch arrows → reversing, right lane)    │ │
   │  │ ╰───┬──────────────────────────────────────────────────────╯ │
   │  │     │ motionInhibited() / inhibitedStops + 1 → idle           │
   │  │ ╭───────────────────────── reversing ─────────────────────╮ │
   │  │ │ entry: drive(down)   (4 leaves → idle)                   │ │
   │  │ ╰──────────────────────────────────────────────────────────╯ │
   │  ╰──┬──────────────────────┬─────────────────────────────────╯
   │     │1 sensorFault()       │2 motionStalled() / stalledStops + 1
   └─────┴──────────────────────┘
```

`idle`'s four arrows end on the top edges of the inner states, crossing the borders of `moving` and `driven`.

### 1.7 An exit for several states: the mode manager

```text
operation modes() {
  state system {
    on receive ecu.shutdown() exit;
    state off {
      on entry { send status.mode(Mode.off); }
      on receive key.ignitionOn() exit;
    }
    state powered {
      on receive key.ignitionOff() to off;
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
  send status.mode(Mode.off);
}
```

- **Shutdown** in `running`: `running`'s exit disables the drive, `powered` and `system` are left, then `send status.mode(Mode.off)` and the operation ends.
- **Ignition off** is written once, on `powered`.
- **Three messages at one instant** (`cmd.halt`, `cmd.go`, `key.ignitionOff`) are three looks in delivery order: the manager passes through `running` for zero time (measured: sample 7 Q4).

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

### 1.8 Conditions that are looked at again: anti-pinch

**On a sampled port member.** The motor current is an attribute member with an initial value, so `sense.current` is a sampled read (WP6-S01). Each delivery of a new value is something that happens to `closing`.

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
      on receive requests.request(c) { if (c == WindowRequest.autoUp) exit; }
    }
    state closing {
      on entry { drive(MotorDirection.up); }
      if (sense.current > pinchLimit) { pinchReversals = pinchReversals + 1; to reversing; }
      on receive requests.request(c) { if (c == WindowRequest.halt) to idle; }
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

**A look reads the values as they are when it runs** (WP6-R03, unchanged). A halt request and a current of 5000 delivered at one instant, the request first: the request causes a look, but the look runs after the second delivery has updated `sense.current`; the pinch condition is written first, so the window reverses, and the halt request is recorded as taken by a look that left before its line ran (`discardInput`, reason `leftBeforeLine`). Two values delivered at one instant (5000, then 3000) give one look that sees 3000. Measured: sample 8.

**On an attribute written by a periodic filter.** The value comes from somewhere: a port read by `filter()` every millisecond.

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

- **When it is checked:** on arrival, at every request or timer look, and each time `filter()` has written `motorCurrent` and unlocked: one look per write, an equal value included (measured: 1,000 looks in one second; +35 % wall time on that test).
- **What a condition does not see:** a value that rises above the limit and falls back within one run of the writer. A condition looks at values, not changes; a pulse that must not be missed is an event.

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

### 1.9 A periodic machine: the window controller every 10 ms

The schedule entry decides how the operation runs. Released `on every 10ms`, the operation is one machine that keeps its place between releases and looks once per release. Per-release work is written plainly in the state.

```text
component def WindowController {
  reversed port switch: SwitchIn;                // provides attribute position: SwitchPos = SwitchPos.neutral;
  reversed port sense: MotorSense;
  reversed port supply: SupplyIn;                // provides attribute ok: bool = true;
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
      travel = travel + 1;
    }
    state opening {
      on entry { send motor.drive(MotorDirection.down); }
      if (switch.position != SwitchPos.down or travel == 0) to idle;
      travel = travel - 1;
    }
    state reversing {
      on entry { send motor.drive(MotorDirection.down); }
      after 400ms to idle;
      if (travel > 0) { travel = travel - 1; }
    }
  }
  schedule {
    on every 10ms step() if (supply.ok) deadline 2ms;
  }
}
```

- **The first release** (10 ms) runs the flow to `idle`: its entry stops the motor and its arrival look checks its conditions.
- **Every later release** is one look at the current state. A look that leaves reaches the next state in the same release: its entry and its arrival look run, so `travel` counts from the release that starts the motor.
- **Per-release work** (`travel = travel + 1;`) is written after the conditions, so it does not run in a look that leaves.
- **`after 8s`** is looked at at the first release at or after 8 s from arrival.
- **Nothing happens between releases:** no message, timer or value change causes a look.
- **A false release guard** (`if (supply.ok)`, WP7's guard in its new spelling) skips the release: no look; timers keep counting.
- **Measured:** sample 9, all five answers.

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

No end marker: the flow never reaches the end of `step` (every way out of every state is a jump or goes on to the next state, and `reversing` jumps back).

### 1.10 A traffic light

```text
operation cycle() {
  var requested: bool = false;
  while (true) {
    state green {
      on entry { send lamps.set(Light.green); }
      on receive ped.button() { requested = true; }
      after 60s exit;
      state minimum {
        after 10s exit;
      }
      state extended {
        if (requested) exit;
      }
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

- **A timer is a moment.** "Green at least 10 s, then as soon as someone has pressed, at most 60 s" is a parent `green` with two inner states: `minimum` ends at 10 s, `extended` leaves as soon as `requested` holds (also on arrival). The 60 s timer is on the parent, so it counts from the start of green.
- **`exit;` from `extended`,** the last inner state, leaves `green` too; the flow goes on with `yellow`.
- **A press outside green** is dropped: only `green` names the button.
- **Measured:** sample 2 (on start) and the same machine released `on every 100ms` (identical lamp sequence, quantised to 100 ms).

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

States stand in loops and branches like any statement. A late `ack` with a stale id is taken, nothing runs, and it is recorded as `discardInput` reason `noEnabledTransition`. Measured: sample 4, and released `on every 100ms` (there a new `awaiting` reached in the release in which the previous one timed out is the second arrival of `awaiting` in that release, so its look waits for the next release, SIF-R16; nothing observable changes, because its arrival look has nothing to do).

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

### 1.12 The mirror heater as a periodic machine

The door showcase's `MirrorHeater.tick` (`on every 100ms`) is flag code with a tick counter for the 10-minute limit. As a periodic machine:

```text
operation tick() {
  while (true) {
    state off {
      if (requested) exit;
    }
    state active {
      on entry { heating = true; send drive.heaterPercent(heaterPercent); }
      on exit { heating = false; send drive.heaterPercent(0); }
      if (not requested) exit;
      after 599900ms { requested = false; exit; }   // 6000 releases counted from the arrival look
    }
  }
}
```

- **The counter is gone:** the 10-minute limit is a timer of `active`, counted from its entry and looked at at the first release at or after 600 s.
- **Measured (corrected in revision 6, review 4 P2):** all 36 door showcase cases identical to the flag code (with `SupplyMonitor.classify` rewritten too); none of them reaches the limit. In the 602-second bench the flag code switches off at 600.2 s (it counts the release that switches on: 6000th count at 300 ms + 5999 periods), and the revision 5 text `after 600s` at 600.3 s, one period late. Written `after 599900ms` (the counting table), the rewrite switches off at 600.2 s with identical sends and writes; the bench is a test (`test/v2/states-periodic.test.ts`, gate F).

```text
 «operation» tick · every 100ms
            ●
  ┌────────►◇ [true]
  │ ╭───────▼──────────────────────────╮
  │ │ off                              │
  │ ╰───────┬──────────────────────────╯
  │         │ [requested]
  │ ╭───────▼──────────────────────────╮
  │ │ active                           │
  │ │ entry: heating = true; send …    │
  │ │ exit:  heating = false; send …   │
  │ ╰───┬──────────────────┬───────────╯
  │     │1 [not requested] │2 after 599900ms / requested = false
  │     ⋄◄─────────────────┘
  └─────┘
```

### 1.13 The supply monitor: the arrival look counts

The door showcase's `SupplyMonitor.classify` (`on every 50ms`) reports undervoltage after two releases that see a low voltage (`supplyMv < 9000`), and clears it at a recovered voltage (`supplyMv >= 9500`); a voltage in between changes nothing. The natural three-state rewrite is **wrong**:

```text
operation classify() {                           // WRONG: one low release qualifies
  while (true) {
    state normal {
      if (supplyMv < underMv) exit;
    }
    state low {
      if (supplyMv >= recoverMv) to normal;
      if (supplyMv < underMv) exit;              // meant: a second low release
    }
    state under {
      on entry { undervoltage = true; }
      on exit { undervoltage = false; }
      if (supplyMv >= recoverMv) to normal;
    }
  }
}
```

At the release that sees the first low value, `normal` leaves, `low` is reached **in the same release** and its arrival look reads the same `supplyMv`: still low, so it leaves at once for `under`. One low release qualifies. Measured: a single low sample at 400 ms sets `undervoltage` in the trap version and not in the original.

**The correct text** counts the arrival look as the first qualifying release:

```text
operation classify() {
  while (true) {
    state normal {
      if (supplyMv < underMv) exit;
    }
    state low {
      on entry { lowSamples = 0; }
      if (supplyMv >= recoverMv) to normal;
      if (supplyMv < underMv) { lowSamples = lowSamples + 1; }
      if (lowSamples >= qualifySamples) exit;
    }
    state under {
      on entry { undervoltage = true; }
      on exit { undervoltage = false; }
      if (supplyMv >= recoverMv) to normal;
    }
  }
}
```

Measured: identical `undervoltage` writes to the original on the supply bench (two low releases separated by a middle one qualify at 200 ms, recovery at 300 ms, a single low release at 400 ms does not qualify).

**What a modeller must know, in one sentence:** a state reached in a release looks at once, at the same values that made the previous state leave, so a condition that must hold at two releases counts the arrival look as the first.

```text
 «operation» classify · every 50ms
            ●
  ┌────────►◇ [true]
  │ ╭───────▼──────────────────────────╮
  │ │ normal                           │◄──────────────┐
  │ ╰───────┬──────────────────────────╯               │
  │         │ [supplyMv < underMv]                     │
  │ ╭───────▼──────────────────────────╮               │
  │ │ low                              │               │
  │ │ entry: lowSamples = 0            │               │
  │ │ if (supplyMv < underMv) …        │               │
  │ ╰───┬──────────────────────┬───────╯               │
  │     │1 [supplyMv >=        │2 [lowSamples >=       │
  │     │   recoverMv] ────────┼── qualifySamples] ────┤
  │ ╭───────────────────────── ▼ ──────╮               │
  │ │ under                            │               │
  │ │ entry: undervoltage = true       │               │
  │ │ exit:  undervoltage = false      │               │
  │ ╰───────┬──────────────────────────╯               │
  │         │ [supplyMv >= recoverMv] ─────────────────┘
  └─ (never reached: every way out of under jumps back)
```

The counter-style original is no shorter as a machine; the owner's showcase keeps whichever reads better (the heater gains, the supply monitor does not).

### 1.14 Remembering

- **The rule:** a state takes what one of its lines (or a parent's) names; everything else is dropped while it waits.
- **Remembering is a variable written by a line** that applies where the request may come: a parent line (the lock, section 0) or a line in the busy state.
- **What it keeps is what it stores.** `wanted = lock` keeps the last request. A model that must keep every request writes a counter or an array.
- **Shielding a substate** from a parent's line is a variable too: the substate sets it in `on entry` and clears it in `on exit`, and the parent's line tests it: `on receive key.ignitionOff() { if (not flashing) exit; }`.

### 1.15 The machine's own writes

A state looks again when one of its own lines writes a value that a statement before that line already read in the same look (SIF-R08):

```text
operation run() {
  var n: uint = 0;
  state s {
    if (n > 2) exit;
    on receive in.x() { n = n + 1; }
  }
  done();
}
```

The third `x` sets `n` to 3 after `if (n > 2)` was checked with 2; the state looks again at once and leaves. Without this rule (revision 4) it would leave at the fourth `x`, or wait for good if none came. Writes made by statements standing in the state never cause a look: `k = k + 1;` written there counts looks, and a condition before it sees the count of the previous look. Measured: P7 `p7-own-writes.txt`.

### 1.16 Jumps

- `to S` names a state `S` of the same operation that stands in the statement list containing the state where the jump is written, or in an enclosing list, or inside parents that stand directly in one of those lists. Every construct between the list and `S` must be a parent: never an `if` branch or a loop body.
- `to P`, where `P` is a parent, enters `P` at its first inner state.
- A jump out of a loop ends the loop; locals of the lists left end; a backward jump that passes a declaration runs it again. A forward jump over a declaration that is used at or after the target is an error.

## 2. How it looks: Flow View

### 2.1 Drawing rules

| Element | Drawing |
| --- | --- |
| Operation | The grey operation frame Flow View draws today. Its header names the operation and how it is released: `«operation» control · on start`, `«operation» step · every 10ms`. The release replaces `: () returns void`, which is the same for every operation with states. |
| Decision | An **empty diamond**; every condition `[c]` is written on an outgoing line, never inside. `if / else if / else` is one diamond with one labelled line per branch in written order, `[else]` last; a missing `else` is an `[else]` line to the merge. |
| Merge | A small empty diamond. |
| Plain step, call | Unchanged Flow View nodes. |
| State | A rounded box with a heavier outline, name at the top. Below a thin rule: `entry: …`, `exit: …`, then one line per thing that stays: an event line that does not leave (`query() : publish …`), a statement (`travel = travel + 1`, `if (travel > 0) …`). |
| Parent | The same rounded box, its lines at the top, its inner states drawn inside on a lightly tinted area. An arrow into an inner state crosses the border. |
| Leave | **One arrow per `exit;` or `to S;`**, from the bottom edge, labelled with what leads to it: the event and the conditions on the way (`after 250ms`, `request(lock) [lock]`, `[sense.current > pinchLimit]`). Statements before the leave follow a slash: `pinchDetected() / pinchReversals + 1`. |
| Event with several leaves | One arrow from the edge with the event label into an empty diamond, one `[c]` line per leave. A single leave draws its condition in the label, without a diamond. |
| Numbers | Written order of the leaves, 1, 2, 3, along the bottom edge from left to right. A state with one leave draws no number. |
| `exit;` and `to` the next state | Both drawn straight down; the drawing never shows which spelling was used, nor whether a body has braces. |
| Shared lanes | One lane per target state and gutter side; arrows to one target join with a junction dot; back jumps on the left gutter, skips on the right. |
| Compact box | A state with more than three leaves may list them inside the box (`3 obstructed() → idle`) and draw only numbers on the arrows; whether this beats back-jump stubs is a drawing choice of the extension (review DN), not a language rule. |
| End | The final marker. In an `on start` operation the operation ends there; in an `on every` operation the machine has no state until the next release, which starts again from the top. No extra mark distinguishes the two: the header says the release. |

**Not drawn:** dropped input; a timer that has run out; the re-look after an own write; a release ended by the bound of SIF-R16; the order "statements before exit actions" (it is the text order; hover on an arrow says it); `«state»`; a `step:` prefix.

### 2.2 Editing gestures

Every gesture is one whole-workspace edit, validated before it is applied, with a dry-run preview (`swaml/previewEdit`) that lists every number and target that changes.

| Gesture | Text edit |
| --- | --- |
| Add a state as a step | Inserts `state X { <event> exit; }` at the drop position (short form for a single leave); the preview names the statement whose successor changes. |
| Add a leave | Adds `to S;` (or `exit;`) at the end of an event line's block, or a new event line; inside an existing chain, a new `else if` branch. |
| Add a staying line or statement (box "+") | Writes `on receive m(x) { }`, `after D { }` or a statement. |
| Retarget a leave (drag its end) | Rewrites that one `to S;`/`exit;`. Illegal targets are refused with SIF-D02's message. |
| Reorder | Moves an item; the preview says which numbers and which behaviour order change (item order is behaviour). |
| Move or delete a state | Keeps behaviour by writing explicit `to` where a successor would change, or refuses. |
| Group into a parent | Wraps consecutive states of one list in `state P { … }`; refused when plain flow stands between them. |
| Move a common line to the parent | Replaces an identical event line in every inner state by one line on the parent; offered only when every inner state has it and no inner state has another line on that member. |
| Add a statement to a short body | Writes the braces. |

## 3. Meaning: the execution contract

The meaning is defined natively, as additions to chapter 6 of the specification (and the static rules to chapter 3). Rule IDs are final; section 4 lists them.

**Terms.**
- An **operation with states** is an operation whose body contains a state. It is a **waiting machine** when released `on start`, a **periodic machine** when released `on every P`.
- **Items** of a state: its `on entry` and `on exit` blocks, event lines and statements, in written order, before its inner states. **Statements standing in a state** are the items that are neither `on entry`, `on exit` nor event lines.
- The **levels** of a state S: each parent that encloses S, outermost first, then S.
- S **has something to look at** when some level of S has an event line or a statement.
- A member is **named at S** when some level of S has an `on receive` line on it. A member is **owned** by the operation when some line of the operation names it.
- A **look** at S is one pass over the items of S's levels (SIF-R02).
- An **arrival** is the reaching of a state by the flow, a leave or a jump.

### 3.1 Which operations may contain states (SIF-S01)

An operation with states:
- is directly owned by a component definition, has no parameters and returns `void`;
- has exactly one effective schedule entry in every occurrence of its component: `on start`, or `on every P` with or without `deadline` and with or without a release guard, never `concurrent`;
- is never called: not by an operation, a helper, a guard, a schedule argument or a case script;
- contains no interrupt region and no plain receive statement.

Case scripts contain no states. Messages for the other entry kinds:
- `on receive x(…) op();`: "`op` contains states, so it keeps its place and can only be released by one `on start` or one `on every` entry. To react to `x`, write `on receive x(…) { … }` in its states."
- `after pred op();`: "… To start after `pred`, release `op` on start and let its first state wait for a value that `pred` sets."
- `on call p.m(…) op();`: "… An operation with states cannot answer calls; answer in a plain operation and let it set an attribute that a state reads."
- No entry, two entries, `concurrent`: "… needs exactly one `on start` or one `on every` entry, not concurrent."

**Why no plain receive statement:** it is the only construct with another input rule (exclusive ownership, input kept after the operation ends). A one-line state replaces it: `state waitGo { on receive cmd.go(v) { ok = v; exit; } }`.

**Consequence:** there is one current state per occurrence and operation, so `machines["c.op"]`, the trace subject and the Timing track are well defined.

### 3.2 Reaching a state (SIF-R01)

When the flow, a leave or a jump reaches state X at time t:
1. record a `state` observation (`source` the state, `trigger` the leave that led here, if any);
2. set X's timer start to t (X is entered once and stays entered until a leave goes out of it);
3. run X's `on entry` once (it may suspend; input arriving meanwhile stays queued);
4. evaluate X's computed `after` durations once (WP4-R02);
5. then:
   - **X is a parent:** reach its first inner state;
   - **X has nothing to look at:** run its `on exit` and continue with the next statement (a named step);
   - **otherwise:** in a periodic machine apply SIF-R16 first; then make the **arrival look** (SIF-R02). If it does not leave, X waits (SIF-R05) in a waiting machine, or the release ends in a periodic machine.

Parents entered on the way to a target (direct entry) run steps 1 to 4 each, outermost first, without step 5.

### 3.3 The look (SIF-R02, SIF-R03, SIF-R04)

**SIF-R02, the walk.** A look at S goes through the levels of S, outermost first; within a level, through its items in written order, skipping `on entry` and `on exit`:
- an **event line runs** when its event is present at this look; its bindings hold the message's payload in its block;
- a **statement runs**, always: a statement standing in a state is "during" work and runs at every look (arrival, message, timer, wake, re-look, release);
- the look **ends at the first `exit;` or `to S;` it runs** (SIF-R09), or after the last item of S.

**SIF-R03, what is present at a look:**
- **At most one message:** the message whose delivery caused the look, or, at the start of a wait, the first-delivered queued message of a member named at S, or, at a release of a periodic machine, the first-delivered queued message of a named member. Every event line on its member, at any level, runs, in walk order.
- **Every timer** of a level of S that has run out at the moment the look starts and has not been present at an earlier look. A timer is present at exactly one look per arrival of its level.
- **At an arrival look:** no message; timers that ran out while `on entry` was suspended.
- **At a wake or a re-look:** no message; timers that have run out meanwhile.

**SIF-R04, values.** A look reads every value as it is at the moment it runs (WP6-R03 unchanged): attributes, locals, sample cells. Deliveries applied between the event that caused a look and the moment the look runs are seen; what earlier items of the same look wrote is seen by later items.

### 3.4 What statements in a state may read (SIF-S05)

Attributes of the executing occurrence, whoever writes them; sampled port members (WP6-S01); locals visible at the statement; constants; calls of operations that read state. Not `now()`, not a non-sampled port member: both change without anything happening to the state, so a condition on them would never be looked at again when they change (SIF-D04). An event line's block may also read its bindings and anything a block may read in 2.2.

### 3.5 When a waiting machine looks (SIF-R05)

After the arrival look and after any look that did not leave, S **waits**. When it begins to wait, in this order:
1. **Timers that ran out** and have not been present: one look now, in zero time.
2. **Queued messages of owned members not named at S** are dropped, in delivery order (`discardInput`, `inactiveOwner`).
3. **A queued message of a member named at S, or a pending wake** (SIF-R07), ends the wait in zero time (the component lock is released; the wait end is an event of the same instant, phase 2, next insertion ordinal). At that event a look is made with the first-delivered named message queued when the wait began, or, if none was queued, a look with nothing present. (Revision 5 said "picked again at that event"; implementation package 4 found that nothing can change the queue between the start and the end of this wait, because an offer replaces or overflows a queue at its publication, the deliveries of an instant run between the steps of activations and no activation runs before that event, so the two rules cannot be told apart and the simpler one is kept: decision A8.) Every look clears the pending wake: one look serves all writes made while the machine was busy.
4. Otherwise S waits without the lock until one of:
   - **a timer of a level of S runs out** (phase 1): a look;
   - **a message of a member named at S is delivered** (phase 2): a look with it;
   - **a message of an owned member not named at S is delivered:** dropped on arrival (`inactiveOwner`), no look;
   - **a wake** (SIF-R07): a look.

**Consequences.**
- One message per look, in delivery order. Three messages delivered at one instant, or queued while the operation was busy, give three looks in delivery order, each at the levels current at that moment.
- A timer that runs out at t is looked at in phase 1, before deliveries at t.
- No starvation: a look runs every present line and statement; the next look after a suspended block begins with the timers that ran out meanwhile.

### 3.6 Inputs (SIF-R06)

| Where | What happens to a message |
| --- | --- |
| Plain operation | Unchanged 2.2: a receive statement owns its members; input stays queued, also after the operation ended. |
| Operation with states, busy (plain flow, blocks, entry and exit actions, a suspended look) | Stays queued under its route policy. |
| A state begins to wait | Queued messages of owned members not named at it are dropped (`inactiveOwner`); named ones are looked at one by one in zero time. |
| A state waits | A delivered message of a named member causes a look; one of an owned member not named is dropped on arrival (`inactiveOwner`). |
| Taken by a look whose present lines ran only `if` tests that were false | `discardInput`, reason `noEnabledTransition` (the 2.2 case "no guard holds"). |
| Present at a look that left before any line on its member ran | Not taken: it stays queued at the head of its queue for the state reached (revision 6; the candidate's `leftBeforeLine` is gone). |
| Waiting machine after it completed | Queued and later messages of its members are discarded (`inactiveOwner`), as after a 2.2 final state. |
| Periodic machine between releases | Stays queued. At a release, queued messages of owned members not named at the current state are dropped (`inactiveOwner`), then the first-delivered named one is present at the look. |
| Periodic machine after it reached its end, before the next release | Stays queued; decided by the state that looks at the following release. |

Members that no line of the operation names are untouched. Requests and calls never reach a state: `on receive` names events and attributes only.

### 3.7 Wakes: values written by others (SIF-R07)

**Read set.** Per effective occurrence: the attributes and sample cells (port occurrence, member) read by the statements standing in the levels of S, directly or through called operations, after specialization and redefinition, with the scope rules (a binding or helper parameter hides a port of the same name; a local or parameter named like an attribute is already an error, so only ports can be hidden). Event lines' blocks and `on entry`/`on exit` are not in the read set.

**Wakes are writes, not changes:** an assignment of an equal value wakes (measured: the filtered anti-pinch looks at every write).

A waiting state S makes a look when:
- **another activation of the same occurrence wrote an attribute in S's read set**, at the end of that activation's segment (its unlock at suspension, completion or failure). Case-script calls of the subject's operations and white-box helper calls, which run in the script's activation, wake at every unlock of the call, at its suspensions as well as at its return;
- **a sample cell in S's read set is updated** (WP6-R02), at its delivery event.

**Pending wakes.** A write or update that would wake S while the machine is busy (its look or its plain flow is running or suspended) is remembered; when S begins to wait, the next look serves all of them (SIF-R05 step 3). Measured necessary: without it a write made during a suspended look is lost and the machine waits for good.

Periodic machines are never woken: they read the values at each release.

### 3.8 The machine's own writes (SIF-R08)

**Rule.** In a waiting machine, when a look's event line block writes an attribute or a local that a statement standing in the levels of S, written before that line in walk order, reads (directly or through helpers), and the look does not leave, S looks again at once, in zero time, with nothing present (`wake` observation with `cause: own`).

- **Bounded by construction:** a look with nothing present runs no line, so a re-look never causes another re-look. At most one extra look per message or timer look; no new livelock, and `StateLoop` is not involved.
- **Statements' own writes never cause a look:** a statement standing in a state runs at every look; if its writes caused looks, `k = k + 1;` would run away. Its writes are seen by the items after it and at the next look.
- **Why only statements before the line:** a statement after the line already saw the new value in the same look; a second look would run its work again (an alarm would be published twice).
- **Periodic machines do not look again inside a release.** A statement in a periodic state is per-release work; a second look in the same release would run it twice (measured with the variant: `travel` counted twice in the release of the message). The write is seen at the next release, like every value.
- **Measured (P7):** the trap of revision 4 is gone (the third `x` leaves; the timer case leaves at 10 ms instead of waiting for good; a parent condition sees the inner line's write); the corpus is unchanged (0 verdicts, 1 store, identical order); the P4/P6 evidence is unchanged except the one test that asserted the trap.

### 3.9 Leaving (SIF-R09)

When a look runs `exit;` or `to T;` written at level L of S (L is S or a parent of S):
1. the statements written before it in the same block have already run;
2. **`on exit` of every state left, innermost first**: S, each parent up to and including the states the leave goes out of;
3. the **target is reached**, entering every parent on the way outermost first (SIF-R01 steps 1 to 4), then the target itself (SIF-R01), whose arrival look runs at once (in a periodic machine: in the same release, SIF-R16).

**What `exit;` goes on with.** `exit;` at level L leaves L. If L is an inner state and not the last of its parent, the next inner state is reached. If it is the last, the parent is left too, as by `exit;` written on the parent, and so on outwards. If L stands in a statement list of the flow, the next statement runs.

**What `to T;` leaves and enters.** All states from S up to (not including) the innermost statement list that contains both the jump and T's outermost enclosing parent (or T) are left, innermost first; then T's enclosing parents below that list are entered, outermost first; then T. `to P`, P a parent, enters P at its first inner state. `to S` naming the current state leaves it and reaches it again (a new arrival: entry, timers restart).

**Leaving adds no scheduling point:** steps 2 and 3 run in the segment of the look, unless an exit or entry action suspends.

### 3.10 Unwinding (SIF-R10)

A jump ends every block, loop and parent between it and the list that contains the target. A loop ended this way does not run its condition, update or remaining iterations; its counter and locals end. Locals live from their declaration to the end of their statement list; a backward jump that passes a declaration runs it again; locals declared before the target keep their values. A `var` standing in a state is a local of the look.

### 3.11 Parents (SIF-R11)

- **Shape:** a parent's braces hold its items, then its inner states only. There is no plain flow between inner states.
- **Order:** the parent's items are looked at before the inner state's, at every look. A parent line on a member that an inner state also names runs first; if it leaves, the inner line does not run.
- **Shielding:** a substate shields itself with a variable set in its `on entry` and cleared in its `on exit`, tested by the parent's line (1.14).
- **Timers of a parent** count from the parent's arrival, keep running while its inner states change, and are present at one look per parent arrival.
- **A state inside a parent with something to look at waits,** even if it has no items itself.

### 3.12 Run to completion and steps (SIF-R12)

- **A look runs to completion.** It holds the component lock, except while a block suspends (`wait`, a request, a suspending call). During that suspension nothing else of the operation is looked at; what happens meanwhile is seen at later looks. Measured consequence: a parent line that waits 20 ms delays an inner 250 ms timer to 270 ms. A step that must be interruptible is written as its own state.
- **A test is not a step.** The test of an `if` written in a state's braces outside `on entry` and `on exit` (standing in the state or in an event line's block, at any depth) is not a scheduling step; the statements it runs are. This keeps 2.2's interleaving, in which a guard evaluation was no step. Outside states, and in `on entry`/`on exit`, `if` keeps its 2.2 step accounting. Measured: the corpus order is identical only with this rule (P5: the door showcase's "Blocked window" case differed without it; P7: the general form gives the same corpus result as P5's narrow form).

### 3.13 Completion of a waiting machine (SIF-R13)

The end of the body or `return` completes the operation once; then its members' input is discarded (`inactiveOwner`); `after` dependents are released.

### 3.14 Periodic machines (SIF-R14, SIF-R15)

**SIF-R14, one persistent activation.** An operation with states released by one `on every P` entry is one activation per occurrence, created at the first release and never completed:
- its **place** (statement path, levels), **locals**, **loop state** and **timer starts** live between releases;
- the state current at the end of a release **stays entered**: its `on entry` does not run again, and the next release makes one look at it;
- **the first release** runs the flow from the first statement to the first state whose look does not leave (entries and arrival looks included);
- **every later release** makes one look at the current state (a **release look**) with what is present (SIF-R03);
- **a look that leaves** reaches the next state in the same release, with its entry and its arrival look, until a state's look does not leave (or SIF-R16 ends the release).

**SIF-R15, rules of releases:**
- **Timers** count in time from their level's arrival, keep running across releases (skipped ones too), and are present at the first look that starts at or after their moment: at a release look, or at an arrival look in the same release.
- **A message and a timer present at one release** run in written order of their lines (a look runs every present line).
- **Input:** at most one message per release; named messages queue under their route policy.
- **Deadline** per release (default the period) covers the release look and the states reached in that release. A deadline is at most the period, so a release never comes while the previous one runs: the previous one has already violated its deadline.
- **Release guards** (WP7, spelled `if (g)`): a false guard is a `skip`: no look; place, timers and queues unchanged.
- **`after` successors** are released after each release's work (a `skip` counts, WP7-R03).
- **`concurrent`** is rejected (SIF-S01).

### 3.15 The bound within one release (SIF-R16)

**Rule.** In a periodic machine, when a state is reached a second time in one release (the state current at the release counts as reached), it is entered as usual (observation, timer start, `on entry`), its arrival look is not made, and the release ends: the state is current, and its first look is the next release's look. The `state` observation of that arrival carries `held: true`.

- **Why:** a release must end. Without a bound a zero-time cycle of arrivals inside one release ran into `StateLoop` (configuration repeats) or, when the configuration grows, to the step limit. With it, a periodic machine passes each state at most once per release, and `StateLoop` is never needed in periodic machines (they are never woken and never re-look).
- **What it does to correct models:** nothing, unless they cycle within a release. A drain by re-arrival (`if (backlog > 0) { take(); to draining; }`) takes one item per release, which is what a periodic machine means.
- **Measured (P7):** the repeating cycle ends the release instead of stopping the run; the growing cycle ends the release instead of running to the step limit; the connection manager released `on every 100ms` reaches `awaiting` a second time in the release of each time-out and behaves identically (its arrival look had nothing to do); every other periodic result is unchanged (sample 9, the window controller cases, heater, supply, traffic light, door showcase 36 of 36).

### 3.16 What a periodic machine does at its end (SIF-R17)

When a periodic machine reaches the end of its body (or `return`): nothing happens, no state is active (`machines["c.op"]` is empty), a `periodicEnd` observation is recorded, and the next release starts the flow again from the top, declaring its locals again. Input stays queued meanwhile (3.6). This is the owner's decision; it lets a machine without `while (true)` restart by itself.

### 3.17 Looking forever in zero time: `StateLoop` (SIF-R18)

**Cut in revision 6.** The rule below was found unsound (it stopped loops that end through another occurrence or through locals of plain activations) and is not part of the language: a loop without time passing ends at the step limit, whose report names the instant and the activations that ran in it. The text is kept as the record of the decision.

**Where it can happen** (waiting machines only):
- a chain of arrivals whose arrival looks leave at once (`state a { if (ready) to b; } state b { if (ready) to a; }`);
- two waiting machines of one occurrence that wake each other (A: `if (n == 0) { n = 1; }`, B: `if (n == 1) { n = 0; }`).

It cannot happen inside one state alone (a state's next look needs something to happen, and an own-write re-look runs no line) or in a periodic machine (SIF-R16).

**Rule.** The contract violation `StateLoop` is raised at a look of state S when the **configuration** of the occurrence equals its configuration at an earlier look of S in the same instant, with only this occurrence's own activity between the two looks (no delivery from another occurrence, no reply, no case-script or borrowed write). It stops the run and bypasses `try`, like the other contract violations; the observation is `violation` with `source` the state.

**The configuration** of an occurrence at a look:
- its attributes and sample cells;
- its input queues: by member, payload, order and readiness (not message identity);
- for each of its activations: its place, its state levels with their arrival times and the timers already present, its locals, the counters of its bounded loops (`n times`, `for … in`), and its pending wake;
- **what is present at this look:** the message (member and payload) and the timers that have run out.

Not in it: message identities, trace ordinals, counters of unbounded loops (`while`, `until`), which would hide a repetition.

**When it is compared:** at every look of S from the second look of S in an instant; equal configurations with nothing external in between repeat forever, so the rule never stops a loop that would end. Cost: hashing starts at the second look of a state in an instant; nothing measurable on the door showcase.

**Allowed (bounded):** a drain by re-arrival; a retry counter; a four-step handshake between two machines of one occurrence (measured).

**Known misses** (measured):
- **a growing loop:** a wake ping-pong that also counts (`n = n + 1`), so the configuration never repeats;
- **a ping-pong through a zero-latency request** to another occurrence: each reply is external activity, so no two configurations are compared.

Both run, like a plain `while (true)`, until the **step limit**: the run ends with the result "inconclusive: limit" and a `violation` observation `StepLimit`, as today. The modeller sees the instant and the state in the trace.

**Static check** (SIF-D05): in a waiting machine, a cycle of states whose arrival looks leave without any condition (`exit;` or `to` standing directly in the braces) is an error: reached, it is certain to stop the run.

## 4. Rules

IDs: SIF (states in flow). G grammar, S static, R runtime, D diagnostic, T trace. This revision renumbers the diagnostics; 4.8 lists what was deleted.

### 4.1 Grammar delta (SIF-G01)

As built by the prototype grammar (`prototype/states-in-flow-r5`, `src/language/swaml.langium`), minus the 2.2 machine syntax that the prototype still parses for comparison:

```text
Block:      braced?='{' Statement* '}';
Body:       Block | ShortBody;                          // ShortBody: exactly one Leave, no braces (O1)
ShortBody:  Leave;
If:         'if' '(' Expression ')' Body ('else' ElseBody)?;
ElseBody:   Block | ShortBody | If;                      // 'else if' is new against 2.2
Statement:  LocalVariable | Assign | Send | ExpressionStatement | Return | If | While | Until | For
          | ForEach | Wait | Receive | Interruptible | Fail | Assert | StateStep | Leave;
StateStep:  'state' Name '{' Documentation? StateMember* '}';
StateMember: StateAction | EventLine | LocalVariable | Assign | Send | ExpressionStatement | Return | If
          | While | Until | For | ForEach | Wait | Interruptible | Fail | Assert | StateStep | Leave;
StateAction: 'on' ('entry' | 'exit') Block;
EventLine:  ('on' 'receive' MemberPath '(' (Name (',' Name)*)? ')'
          | 'after' (Duration | '(' Expression ')')) Body;
Leave:      'exit' ';' | 'to' Name ';';
ScheduleEntry: … Operation '(' Args ')' ('if' '(' Expression ')')? ('deadline' …)? 'concurrent'? ';';
Removed:    OperationBody's 'initial' Name ';' State+ alternative; State with 'final'; Transition with
            'when' guards, 'to' heads and completion 'when (g) to S'; Deferral ('defer'); 'when' everywhere.
```

**Parse notes.**
- Inside a state's braces the parser takes `on entry`, `on exit`, `on receive` and `after` as items; everything else is a statement. A plain receive statement (`on receive …` followed by `or`) cannot stand in a state: `StateMember` has no `Receive`.
- Inner states may be followed only by states (SIF-S03, checked by the validator, not the grammar).
- **`else if` is new.** 2.2's `else` takes a block only (`else { if … }`). The released 2.2 parser rejects `else if`; every 2.2 source still parses. The formatter keeps `else if` on one line.
- **The short form** builds the same `Block` node with `braced = false`; statement identities are the same with and without braces (P1r spike).
- `after` cannot start a statement outside a state's braces.
- **WP7's release guard** is respelled `if (g)` in the same position (before `deadline`). Its meaning is unchanged.

### 4.2 Static rules

| ID | Rule |
| --- | --- |
| SIF-S01 | Which operations may contain states (3.1); case scripts contain no states. |
| SIF-S02 | A state has at most one `on entry` and one `on exit`. State names are unique within an operation. |
| SIF-S03 | A state's braces hold items, then inner states only. |
| SIF-S04 | `exit;` and `to S;` stand only inside a state's braces: directly, or at any depth of `if`/`else` blocks standing there or inside an event line's block. Never in `on entry`, `on exit`, a loop body, an interrupt region or the flow outside states. `on entry`, `on exit` and event line blocks contain no state, no plain receive statement and no `return`; `return` does not stand in a state's braces. |
| SIF-S05 | What statements standing in a state may read (3.4). |
| SIF-S06 | Jump targets (1.16): a state in a list containing the jump's state or an enclosing list, or inside parents standing directly in such a list; never through an `if` branch or loop body; never over a declaration used at or after the target. |
| SIF-S07 | An event line's bindings are visible in its block only. |
| SIF-S08 | A body without braces is exactly `exit;` or `to S;` (grammar; anything else is a syntax error). |

### 4.3 Runtime rules

| ID | Rule |
| --- | --- |
| SIF-R01 | Reaching a state: observation, timer start, entry once, computed timers, then parent, named step or (after SIF-R16) arrival look (3.2). |
| SIF-R02 | A look: levels outermost first, items in written order; present event lines and every statement run; ends at the first leave (3.3). |
| SIF-R03 | Present: at most one message; every timer that has run out when the look starts and was not present before, once per arrival of its level (3.3). |
| SIF-R04 | A look reads values as they are when it runs (WP6-R03) (3.3). |
| SIF-R05 | Waiting: on beginning to wait, timers first, then drop, then a queued named message (picked when the wait begins, decision A8) or a pending wake in zero time; then timer (phase 1), delivery (phase 2) and wake looks (3.5). |
| SIF-R06 | Inputs: the regimes of 3.6, with the reasons `inactiveOwner` and `noEnabledTransition`; a message present at a look that left before its line stays queued (revision 6). |
| SIF-R07 | Wakes (waiting machines): writes of the read set by another activation of the occurrence at its unlock (borrowed calls at every unlock), sample-cell updates; pending wakes while busy (3.7). |
| SIF-R08 | Own writes: a line's write to a value read by a statement before it in the look makes one re-look; waiting machines only (3.8). |
| SIF-R09 | Leaving in text order: block, `on exit` innermost first, entries outermost first, target and its arrival look (3.9). |
| SIF-R10 | Unwinding of blocks, loops and parents; locals (3.10). |
| SIF-R11 | Parents: entered at their first inner state or directly; their items first at every look; their timers per parent arrival (3.11). |
| SIF-R12 | A look runs to completion holding the lock, except while a block suspends; leaving adds no scheduling point; an `if` test in a state's braces is not a step (3.12). |
| SIF-R13 | Waiting completion (3.13). |
| SIF-R14 | Periodic: one persistent activation; the current state stays entered; first release runs to the first state that does not leave; later releases make one look; leaving continues in the release (3.14). |
| SIF-R15 | Periodic timers, written order of message and timer, one message per release, deadline, release guards, `after` successors (3.14). |
| SIF-R16 | Periodic: a state reached a second time in one release ends the release in that state (3.15). |
| SIF-R17 | Periodic end: no state; the next release starts from the top (3.16). |
| SIF-R18 | *Cut in revision 6:* no loop detection; a loop without time passing ends at the step limit (`StepLimit` with a message naming the instant and the activations that ran). |

### 4.4 Diagnostics

Only six. For each: why the model cannot simply behave.

| ID | Code | Rule and message | Why it is necessary |
| --- | --- | --- | --- |
| SIF-D01 | SW2008 | Operation-kind violations of SIF-S01, with the messages of 3.1. | The operation would have no single place to keep, or would be entered by a call with no state to resume. There is no behaviour to give it. |
| SIF-D02 | SW2008 | Leave and jump violations (SIF-S04, SIF-S06), for example `` `to c` skips the declaration of `x`, which `c` uses. Declare `x` before the jump. `` | A leave outside a state, or a jump into a branch or loop, has no meaning: there is no state to leave or no defined place to arrive at. |
| SIF-D03 | SW2008 | Structure (SIF-S02, SIF-S03): `Duplicate on {entry/exit} in {state}`, `{state} has inner states; only states may follow the first one`, `Two states are named {name} in {op}`. | Two entry blocks have no order; flow after inner states would be flow inside a parent, which has no meaning (no plain flow between inner states); a duplicate name makes `to` ambiguous. |
| SIF-D04 | SW2006 | The condition of an `if` standing directly in a state of a waiting machine reads `now()`, directly or through a called operation (revision 6): `if ({condition}) in {state} reads now(); a waiting state tests it only when something wakes it and time passing wakes nothing, so write after D instead (SIF-D04).` |
| SIF-D05 | — | *Cut in revision 6* (it rejected valid models; a loop without time passing ends at the step limit). |
| SIF-D06 | — | *Cut in revision 6* (a warning on the natural form; the run reports a sender that overflows). |

All diagnostics are evaluated per effective occurrence, since a redefinition can change the schedule entry.

### 4.5 Trace

| ID | Observation | Fields |
| --- | --- | --- |
| SIF-T01 | `state` | At each arrival and each parent entered (outermost first): `source` the state, `trigger` the leave that led there (absent for an arrival by the flow), `held: true` when SIF-R16 ended the release at this arrival. |
| SIF-T02 | `state` with `stay: true` | A look with a message or a timer whose line ran a statement (a true test or any other statement) and did not leave; `source` the first such line. Arrival, wake, re-look and release looks without such a line add no observation. |
| SIF-T03 | `wake` | Before a look caused by a value: `state`, and `cause` one of `write` (with `writer` activation and `attributes`), `sample` (with `cell`), `own` (with the names written, SIF-R08); `pending: true` when it was recorded while the machine was busy. |
| SIF-T04 | `discardInput` | Reasons: `inactiveOwner` (dropped while waiting, on arrival, when a wait begins, at a release, after completion) and `noEnabledTransition` (taken; its lines ran only false tests). |
| SIF-T05 | `release`, `skip` | Periodic: per release, with the machine's one activation id (also on `skip`, which today carries none) and the release number. |
| SIF-T06 | `periodicEnd` | Periodic: the machine reached its end; `activation`, `release`. |
| SIF-T07 | `violation` | `StepLimit` with a `message` naming the instant and the activations that ran; `StateLoop` is cut (revision 6). New in revision 6: `leave` (SIF-T09), when the flow goes on outside every state. |
| SIF-T08 | `timer` | WP4-T01, for computed durations, at arrival. |
| SIF-T09 | never | `defer`, `discardTimer`, `CompletionLoop`, a separate observation for the release bound. |

`machines["c.op"]` is the innermost current state, or empty after a periodic end.

### 4.6 Timing projection

**Waiting machines:** unchanged phases of the operation's activation (`dispatch`, `run`, `ready`, `receiveWait` between looks), plus **state bands**: one band per state level over the time it is entered, nested for parents.

**Periodic machines** (new; today the machine shows as waiting between releases and skips have no activation):
- **one interval per release**, from the release to the end of that release's work (its look and the states reached in it), on the machine's track; between releases the track is idle, not `receiveWait`;
- **the state as a band** under the release intervals, changing at the release in which a new state is reached; a `held` arrival (SIF-R16) starts its band at that release;
- **skips** as markers on the same track, carrying the machine's activation;
- **the end** (`periodicEnd`) closes the band; the next release opens a new one at the first state;
- **deadline** marks per release, as for plain periodic operations.

### 4.7 Words of the behaviour language, before and after

| Word | 2.2 | 2.3 candidate (main) | After this specification |
| --- | --- | --- | --- |
| `operation`, `returns`, `var`, `const`, `return` | yes | yes | yes |
| `if`, `else`, `while`, `until`, `for`, `in`, `times` | yes | yes | yes (`if` is every condition; `else if` is new) |
| `wait`, `on`, `receive`, `or`, `after`, `send`, `publish` | yes | yes | yes |
| `try`, `assert`, `fail`, `interruptible` | yes | yes | yes |
| `true`, `false`, `not`, `and` | yes | yes | yes |
| `schedule`, `start`, `every`, `call`, `deadline`, `concurrent` | yes | yes | yes |
| `state`, `entry`, `exit`, `to` | yes | yes | yes (`exit;` and `to S;` are statements) |
| `when` | yes (guards) | yes (guards, completion, release guards) | **removed** (`if`) |
| `initial`, `final` | yes | yes | **removed** |
| `defer` | no | yes (WP5) | **never ships** |
| anything new | | | **none** |

Net change against 2.2: three words fewer, none added.

### 4.8 Deleted with this revision

| Revision 4 | Why it is gone |
| --- | --- |
| SIF-D02 (line on a member nobody delivers), SIF-D05 (fall through to the end), SIF-D07 (unreachable), SIF-D08 (bare action in a waiting machine), SIF-D09 (statement before the item that writes what it reads), SIF-D10 (waits for good), SIF-D12 (periodic timer not a multiple of the period) | Owner: no pointless warnings. D08 is a legal "during"; D09's case now behaves (SIF-R08); the others describe legal models (a test bench, a dead end, a quantised timer). Ordinary unreachable-code checks of the language stay as they are. |
| SIF-S07 and SIF-D04 (periodic end unreachable, no `return`) | Owner: a periodic machine that reaches its end restarts at the next release (SIF-R17). |
| SIF-D13 (short-form body that is not a leave) | It is a syntax error: the grammar accepts only a leave without braces. |
| "A look never causes another look of its own state" | Replaced by SIF-R08 (one re-look after an own line write). |
| The backlog rule of periodic releases | Dead under deadline ≤ period (SIF-R15). |
| `StateLoop` in periodic machines | Replaced by the bound within one release (SIF-R16). |
| "`when (g)` in plain receive statements is respelled" | 2.2 plain receive statements have no guard; there is nothing to respell. |

## 5. Where the model needs a second sentence

The model ("`if` never waits; the state looks again each time something happens to it") covers every example. These are the places where a reader needs one more sentence.

1. **A look reads the values when it runs, not when its cause happened.** A request and a new sensor value delivered at one instant are both seen by the request's look (sample 8 Q2).
2. **Timers are moments.** `after 10s { if (requested) exit; }` checks once, at 10 s; "from 10 s on, as soon as requested" is a parent timer plus an inner state (traffic light).
3. **Extra looks are not harmless:** statements act at every look, so what causes a look is behaviour. Read sets are exact (by name, per effective occurrence) and wakes are counted by writes.
4. **The same text runs at different moments by mode:** `travel = travel + 1;` counts releases in a periodic machine and looks in a waiting machine. The frame header shows the mode.
5. **Leaving runs in text order:** a line's statements run before the state's `on exit`. Readers trained on UML expect exit actions first; the migrator copies 2.2 exit actions to keep 2.2 results.
6. **One message per look:** three messages delivered at one instant are three looks; a state can be passed through for zero time (sample 7 Q4), which an actuator trace shows.
7. **The arrival look counts** (O3): a state reached in a release does its work at once, with the same values that made the previous state leave (supply monitor, 1.13). **Option for the owner, not adopted:** Stateflow's rule, "a state reached in a release makes no arrival look; its first look is at the next release", removes the trap, but changes sample 9 Q2 (`travel` would first increase at 40 ms, not 30 ms) and reverses O3; I found no rule that removes the trap and keeps both.
8. **Own writes:** a line's write is seen by a statement before it through one re-look (SIF-R08), in a waiting machine; in a periodic machine at the next release.
9. **Cost of a condition on a fast attribute:** one look per write (+35 % wall time on the 1 ms filter test; nothing measurable on the door showcase, whose machines have no statements in states).
10. **Run to completion:** a suspending line on a parent delays an inner timer (250 ms pulse ended at 270 ms); a step that must be interruptible is its own state.
11. **Named steps** are the one special case: a state with nothing to look at does not wait.
12. **A periodic release passes each state at most once** (SIF-R16): a drain by re-arrival takes one item per release.

## 6. Stateflow cues

| Cue | Decision |
| --- | --- |
| States and flow-chart logic in one chart | **adopt**: states are steps, decisions are `if` |
| entry, exit, on event | **adopt**: `on entry`, `on exit`, event lines |
| `during` | **adopt without a word**: statements in a state run at every look |
| Outer transitions tested first | **adopt**: parents first |
| Conditions in brackets on transitions | **adopt**: `[c]` on every arrow and diamond line |
| Transition action after exit | **reject**: text order |
| Default transition | **adapt**: arrival by flow; into a parent, its first inner state or a direct entry |
| `after` relative to state entry, at chart steps | **adopt** |
| Entering step runs no `during` | **reject** (O3): the arrival look runs; see section 5, point 7 |
| Super step bounded by states | **adopt in effect**: SIF-R16 |
| Parallel states, history junction | **reject** |

## 7. Migration

### 7.1 2.2 machines: the recipe

Input: a 2.2 machine (`initial I; state …`) in operation O, and every `when` of the source. Measured by P1r on the corpus (56 machines, 50 migrated, 272 transitions; the 6 not migrated use WP5 forms and are rewritten by hand, 7.3).

1. **Frame.** O satisfies SIF-S01 (2.2 already enforces one `on start` entry, no parameters, `void`).
2. **State order** to maximise fall-through: initial first, finals last in source order, otherwise the order that maximises states whose next state is a target of theirs (exhaustive up to 9 states, greedy beyond, ties by source order).
3. **Each state:** `on entry` unchanged; timer transitions first, sorted by literal duration, stable on declaration order, each `after D { effect; to T; }`; then **one `on receive` line per member**, in order of first declaration, whose block is the member's transitions as an `if / else if` chain in declaration order: `on receive m(x) when (g) to T { e }` becomes `if (g) { e; to T; }`; an unguarded transition becomes the final `else { e; to T; }` (or the whole block when it is the only one). Transitions after an unguarded one on the same member were never taken in 2.2; they are removed and reported. Bindings: transitions on one member with different binding names are renamed to the first transition's names inside their branches (reported); a name that would be captured is refused.
4. **Exit actions:** a state whose `on exit` is not empty and that has a leaving transition with a non-empty effect loses its `on exit`; its statements are written at the start of **every** leaving block of that state, before the effect. This keeps 2.2's exit, effect, entry order under text-order leaving exactly, because a flat 2.2 state is left only by its own transitions. Other states keep `on exit`. (Corpus: 10 copied, 1 kept.)
5. **Leaves:** `to T` to the next state is written `exit;`, everything else `to T;` (same behaviour, SIF-R09). A body that is only the leave uses the short form.
6. **Dead timers:** an unguarded timer whose duration is not smaller than an earlier-sorted unguarded one's was never taken; removed and reported (corpus: 9).
7. **Inputs:** nothing is written: 2.2 dropped unhandled input while waiting, and so does the new text.
8. **Finals** become named steps `state F { on entry { … } }`; with several finals, `return;` follows each final step except the last statement of the body.
9. **Dead ends are refused:** a non-final 2.2 state without transitions waits for ever; written with only its entry it would become a named step and pass through. The migrator refuses the machine and names the state; the author decides (give the state the event it waits for, or make it final).
10. **End check:** the migrator verifies "the end of O is reachable iff a final state was reachable".
11. **No parents:** the migrator never introduces parents; "move a common line to the parent" is an explicit Flow View edit.
12. **`when` elsewhere:** WP7's release guard `… when (g)` becomes `… if (g)`. 2.2 has no other `when` (plain receive statements never had guards).
13. **Report:** removed transitions and timers, renamed bindings, copied exit actions, refusals, and the **identity map** (new statement identity → 2.2 identity, per source) for traces and overlays.

**Selection order:** 2.2 took the first enabled transition in declaration order; the chain does the same. Between members a 2.2 state saw one message at a time too. The one difference is r10 (7.4).

### 7.2 The user migration command

`swaml migrate <files or folders>` (CLI, and the extension's command):
- **must** apply 7.1 to every 2.2 machine and respell every `when`; write the files in place only with `--write` (default: print the diff); print the report; write the identity map next to the sources (`.swaml-migration.json`) for overlays and old traces;
- **must** keep everything else byte-identical (2.2 sources without machines and without `when` are not touched);
- **must** validate the result as a complete workspace and refuse to write a file that has errors;
- **must refuse**, naming the state or line, and leave the file unchanged: a dead end (7.1 step 9); a binding rename that would capture a name; a source that does not parse as 2.2; a source using WP5 forms (`defer`, completion `when (g) to S`, internal transitions), which no release accepted;
- **must not** introduce parents, reorder lines beyond 7.1, or change behaviour silently: every removal is reported.

### 7.3 This repository's own sources

- **Examples 44 to 47 and 49 and the WP5 parts of the showcases** are rewritten by hand: completion transitions become `if (g) to S;` standing in the state (looked at at every look, which is what completion wanted, without `CompletionLoop`); internal transitions become staying lines; guarded timers become `after D { if (g) … }` (checked once; expectations rewritten where that differs); deferral becomes a variable written by a line, and the cases state that only what is stored is kept. **Measured:** 44, 46 and 47 rewritten give identical final stores to their WP5 versions. 45 and 49 (`defer`) are not measured: rewritten with a variable they keep the last request only, and their expectations are rewritten to say so (package 6).
- **Showcases** go through the migrator; the window lifter with parents (1.6) is a recorded design rewrite; `MirrorHeater.tick` may become the periodic machine of 1.12 (measured identical); `SupplyMonitor.classify` stays flag code (1.13: no gain).
- **WP7's examples and tests** respell the guard.

### 7.4 Compatibility gates after this change

| Gate | Holds | Measured |
| --- | --- | --- |
| **A. 2.2 sources without machines** | Parse, validation, runs and traces unchanged (the existing 2.2 compatibility suites). They contain no `when`. | P1r/P7: corpus results of plain operations identical. |
| **B. 2.2 machines, after migration** | On the migrated corpus (267 executed results): 0 verdict changes; final stores identical except **r10**; per-kind observation counts and per-component order-sensitive digests identical after mapping identities with the identity map and ignoring `state` observations of parents. | P7 (with SIF-R08, R12 general, R16): missing 0, verdict 0, stores 1 (r10), status 0, machines 0, kinds 0, order 0, 266 identical. |
| **C. The one accepted difference, r10** | Input for two members queued while the machine is busy is served in delivery order (2.2 served the queue created first). | Unchanged since P1. |
| **D. Parents** | The window lifter with parents: identical to 2.2 apart from the `state` observations of `moving` and `driven`. | P5. |
| **E. Reading samples 1 to 9** | Every documented answer, as cases. | P5/P7 (1 to 7), P6 (9), P4 (8, corrected). |
| **F. Periodic rewrites** | Door showcase with `MirrorHeater.tick` and `SupplyMonitor.classify` as periodic machines: 36 of 36 cases identical. | P6, P7. |

The old trace-digest gate (gate 2) cannot hold across the edition (identities change, parents add observations) and is replaced by B.

## 8. Measurements

| Prototype | What | Result |
| --- | --- | --- |
| P1r (r4b) | Corpus with the revision 4 migrator, re-pick after the zero-time wait, block form, text-order leaving with copied exits | 0 verdicts, 1 store (r10), order identical once a false guard test in a line is not a step. |
| P1r | Grammar spike, short form | No ambiguity; same identities with and without braces; half-typed text fails to parse. |
| P5 (r4b) | Window lifter with parents vs 2.2 | Identical apart from parents' `state` observations. |
| P5/P7 | Reading samples 1 to 7, 35 answers | All match (rerun with P7: identical output). |
| P4 (r4b) | Read sets per occurrence (helpers, redefinition, usage-level redefinition, shadowing by a helper parameter), case-call writes and suspensions, pending wakes | All as specified; without pending wakes a waiting machine stalls. |
| P4 | `StateLoop` | Drain by re-arrival and by a staying statement pass; wake ping-pong and arrival ping-pong stopped; four-step handshake passes; growing ping-pong and ping-pong through a request run to the step limit. |
| P4 | Cost | Door showcase: nothing measurable. Filtered anti-pinch at 1 ms: 1,000 wake looks per second, +35 % wall time on that test. |
| P4 | Sample 8 | Q1, Q3, Q4, Q5 as documented; Q2 reverses (the documented answer was wrong); a flip 5000 then 3000 at one instant gives one look that sees 3000. |
| P6 (r4b) | Periodic: sample 9; persistent activation; message and timer at one release; release guards; end and restart; deadline; WP5 rewrites 44, 46, 47 | All as specified; WP5 rewrites identical stores. |
| P6 | Door showcase with heater and supply as periodic machines | 36 of 36 identical; wall 8.8 s original, 10.1 s rewrite. |
| P6/P7 | Supply monitor | Three-state rewrite wrong (one low release qualifies); counted version identical to the original. |
| P7 | Own-write re-look (SIF-R08) | Corpus unchanged; the trap cases now leave at once; statement writes cause no look; an acting statement runs once more, not forever; periodic variant (rejected) counts per-release work twice. |
| P7 | Bound within one release (SIF-R16) | Repeating and growing zero-time cycles end the release; connection manager every 100 ms unchanged; all other periodic evidence unchanged. |
| P7 | A test is not a step, general form (SIF-R12) | Corpus unchanged; evidence unchanged except interleaving order of two observations within one instant in sample 8 Q5 (same outcome) and more wakes within the same step budget for the growing ping-pong. |

**Not prototyped:** the Flow View drawings beyond P2's (P2b: lanes, compact boxes, parent borders) and the reading test with the owner (P3b). Neither changes the language.

## 9. WP5 to WP9

- **WP5** (merged, unreleased): its state forms, rules (chapter 3.6 WP5-S02 to S10, 6.5 WP5-R01 to R13, WP5-T01 to T04), ADR 0023, examples 44 to 47 and 49, `test/v2/state-reactions.test.ts`, SW2017 as defined there and `CompletionLoop` are replaced in place and never ship. SW2018 is reused by SIF-D06.
- **WP6** (merged): sampled reads are read by statements in states; cell updates are wakes. WP6-R03 is unchanged and is SIF-R04's source. WP6-D09/D10 are replaced by SIF-D04.
- **WP7** (merged on main): a release guard on the `on every` entry of a periodic machine skips the release's look; its spelling becomes `if (g)` (package 1); `skip` carries the machine's activation.
- **WP8** (ADR 0025), **T4** "an activation that may suspend is placed only on an extended task":
  - **A waiting machine** is one activation released on start that waits between looks (for messages, timers and wakes) inside that activation. That wait is a suspension in T4's sense: **a waiting machine is placed only on an extended task.** ADR 0025's sentence that lets a 2.2 stateful operation use a basic task because "the idle wait between reactions does not count" is withdrawn: with states in the flow the wait stands between arbitrary flow (loops, locals, plain steps), and mapping each look to a basic-task activation would make the place, locals and loop state a code generator's invention, not the language's contract.
  - **A periodic machine** never waits inside a release: each release is one activation of its runnable that runs a look and the states reached, and returns; its place, locals, loop state and timer starts live in the runnable's static memory between releases. **It may be placed on a basic task when nothing it runs in a release can suspend** (no `wait`, request or suspending call in any item, entry, exit, line block or flow between states, transitively), and otherwise on an extended task, by T4 as written.
  - A periodic machine is one runnable per occurrence that keeps its state; its period and release guard map as for plain periodic operations.
- **WP9** (edition, notation, figures, showcases): the showcases go through the migrator (7.3); figures: state box, parent box, direct entry across a border, empty diamonds with `[c]` lines, the release in the frame header, the periodic Timing projection.

## 10. What consumers must handle

**The editor integration:**
- **Parsing:** the new grammar (states as statements, event lines, `exit;`/`to S;`, short bodies, `else if`, `if` release guards); `when`, `initial`, `final`, `defer` gone from completion, highlighting (TextMate grammar) and snippets. Until users migrate, a file with 2.2 machines is shown with a diagnostic that offers the migration command, not silently rejected.
- **Flow View drawing** (2.1): state and parent boxes, one arrow per leave, diamonds for events with several leaves, numbers in written order, lanes per target, arrows crossing parent borders, the release in the frame header, empty decision diamonds with `[c]` lines for every flow, the end marker in periodic operations. The State view of 2.2 machines retires (a machine is drawn in Flow View).
- **Flow View edits** (2.2): creation cards for states, parents, event lines, statements and leaves, with field completion for members, legal jump targets (SIF-S06) and conditions; dry-run previews that name changed numbers and behaviour order; braces written when a short body grows.
- **Sequence:** a state is a state invariant on the operation's lifeline; a parent an invariant region; a release of a periodic machine a found message on its lifeline.
- **Timing:** nested state bands for waiting machines; the periodic projection of 4.6 (one interval per release, state band, skip markers with activation, end).
- **Run overlays:** statement identities of the new text; old traces through the identity map; `state` with `trigger` and `held`, `wake` (with cause), `discardInput` reasons `inactiveOwner` and `noEnabledTransition`, `periodicEnd`, `StateLoop`.
- **Migration command:** runs 7.2 with its diff preview, report and identity map; applies only on confirmation as one workspace edit.

**Other consumers** (CLI, documentation site, PDF figures): the CLI gains `swaml migrate`; trace consumers handle the kinds of 4.5.

## 11. Implementation plan

One release, seven packages in dependency order. Each is one agent's work (with a hand-over note if it runs long), ends with `npm run check` passing on the pinned Node, and goes through an independent adversarial review before it merges. The prototype branch `prototype/states-in-flow-r5` is a reference to port from, never to merge: its code is throwaway (variant switches, statistics, harness scripts), and every ported function is rewritten to product standard with the rule IDs of this document in its comments.

| # | Package | Depends on | Ends with |
| --- | --- | --- | --- |
| 1 | `if` everywhere: WP7 guard respelled, `else if` | main | `when` only in 2.2 machine syntax; `else if` parsed, formatted, identified |
| 2a | Flat states as statements, beside the 2.2 machine syntax | 1 | New flat waiting machines run by SIF-R01 to R06, R09, R10, R12, R13 |
| 2b | 2.2 machine syntax and WP5 forms removed; migrator; migrated corpus; gate B | 2a | `when`, `initial`, `final`, `defer` gone; corpus migrated; gates A to C |
| 3 | Parents and direct entry | 2b | SIF-R11, direct entry; gate D |
| 4 | Wakes, own-write re-look, `StateLoop` | 3 | SIF-R07, R08, R18, SIF-D04, D05 |
| 5 | Periodic machines, release bound, periodic end, T4, Timing projection | 4 | SIF-R14 to R17, SIF-D06, T4, 4.6; gate F |
| 6 | Specification, docs, examples, showcases, reading samples as cases, consumer notes, `swaml migrate` | 5 | Gate E; the edition's documentation |

### Package 1: one word for conditions

- **Files and rules:** `src/language/swaml.langium` (`ScheduleEntry` guard `'if' '(' … ')'`; `If` with `ElseBody: Block | If`), `formatter.ts` (`else if` on one line), `semantic.ts`/`statementIdentity` (an `else if` is the `If` in `otherwise`; identities of existing `else { if … }` unchanged), `swaml-validator.ts` (WP7-D codes on the new position), `syntax/` (TextMate), examples and tests of WP7, `docs/LANGUAGE_SPECIFICATION.md` (WP7 chapter, `If` production), `docs/KEYWORD_REFERENCE.md`, `spec/kerml-mapping.json` for new productions.
- **Port:** grammar lines `ElseBody`, `ElseIf` and the guard spelling from the prototype grammar.
- **Tests:** parse and format of `else if` chains (depth 3, with comments between `else` and `if`); WP7 guard tests respelled; 2.2 sources with `else { if … }` keep identities and traces; the released 2.2 parser rejects `else if` (fixture).
- **Mutations to kill:** guard parsed after `deadline`; `else if` given a new identity scheme; formatter splitting `else if`; `else if` binding to the outer `if`.
- **Adversarial reviewer attacks:** dangling-else and comment placement; identity stability of existing sources; any leftover `when` in docs, completion data or error messages outside 2.2 machines.

### Package 2a: flat states as statements

- **Files and rules:** grammar (`StateStep`, `StateMember`, `StateAction` reuse, `EventLine`, `Body`/`ShortBody`, `Leave` with `braced` flag), `swaml-validator.ts` (SIF-S01 to S08 for flat states; SIF-D01, D02, D03), `semantic.ts` (`flowStates`, `isStateful` for both syntaxes), `stale-read.ts` (states are statements), `simulator.ts` (SIF-R01 to R06, R09, R10, R12, R13; trace SIF-T01, T02, T04, T08), `timing.ts` (state bands).
- **Port from `simulator.ts`:** `flowMachine`, `enter`, `exitTo`, `look` (without the P7 re-look parts), `leave`, `wait` (waiting branch, with re-pick), `dropUnnamed`, `flowHeads`, `take`, `owned`, `flowOwner`, `namedAt`, `timerLines`, `due`, `timersDue`, `hasSomething`, `stateItems`, `innerStates`, `inLookText` and the step rule in `statement`; `LeaveSignal`, `JumpSignal`. From the validator: `jumpRule`, `stateStep`, `flowOperation`, `enclosingLists`.
- **Tests:** every row of 3.2, 3.3, 3.5, 3.6, 3.9, 3.10 as a unit case; reading samples 3 to 6 as cases; the short form (identities equal to braced form); `noEnabledTransition` versus `leftBeforeLine`; capacity-1 `dropOldest` overflow during the zero-time wait (re-pick); timer before same-instant delivery; a test is not a step (two activations interleaving at one instant).
- **Mutations to kill:** walk order reversed within a level; a statement skipped at a message look; look continuing after a leave; `on exit` before the leave's block; dropping input while busy; a timer present twice per arrival; timer and delivery phases swapped; re-pick replaced by the picked message; the two discard reasons swapped; `if` test counted as a step; named step that waits; `exit;` from a flow-level state not continuing with the next statement; backward jump not re-running a declaration.
- **Adversarial reviewer attacks:** queued input across a suspended entry action; jumps out of nested loops (counters, locals); a state in a `for … in` body; identity of short bodies; messages at the end of the operation; one machine per occurrence with redefinitions.

### Package 2b: removal and migration

- **Files and rules:** grammar (remove `initial`/`State`/`final`/`Transition` with `when`/`Deferral`); validator (remove WP5 rules SW2017 and machine rules, keep SIF); simulator (remove `machine()` and WP5 selection, `CompletionLoop`, `defer`, `discardTimer`); a migrator module (`src/language/migrate.ts`) implementing 7.1 with report and identity map; the migrated corpus: `examples/`, `test/fixtures/compatibility-2-2-extended`, showcases (through the migrator; WP5 examples left for package 6 but made to parse by a minimal hand rewrite here); the gate B harness (`scripts/compatibility-2-2.mjs`, `compatibility-2-2-extended.mjs`) comparing against the stored 2.2 baseline with the identity map; `test/v2/state-reactions.test.ts` replaced.
- **Port:** `p4/migrate.mjs` (the P1r migrator: state ordering, chains, copied exits, dead timers, finals, refusal, identity map) rewritten against the product AST; `p4/compare.mjs` normalisation as the gate's comparison.
- **Tests:** migrator unit cases for every step of 7.1 (chains with and without `else`, removed transitions, renamed and captured bindings, copied exits, several finals, dead ends refused, end check); gate B on the full corpus (0 verdicts, 1 store r10, identical digests).
- **Mutations to kill:** chain order by target instead of declaration; exit actions copied only into some leaving blocks; dead-timer rule removing a smaller timer; finals without `return;`; dead end migrated as a named step; identity map off by one statement.
- **Adversarial reviewer attacks:** a 2.2 machine whose exit and effect both write the same attribute; equal timers; bindings shadowing attributes; a state whose only transition is a guarded timer; files with several machines; round-trip formatting of migrated text.

### Package 3: parents and direct entry

- **Files and rules:** validator (SIF-S03 items before inner states, SIF-S06 direct targets, SIF-D03), simulator (levels, parents first, entry outermost first, timers per parent arrival, B6 waiting rule), Timing (nested bands).
- **Port:** the level handling in `enter`, `exitTo`, `leave` and `look` (`pathInside`, levels loop), `hasSomething` over levels, `namedAt` over levels.
- **Tests:** gate D (window lifter with parents vs 2.2); samples 1, 2 and 7 as cases; the B2 counterexamples (parent query during a pulse, suspending parent line delaying an inner timer to 270 ms); shielding with a variable; `exit;` from the last inner state; `to P` into a parent; direct entry three levels deep.
- **Mutations to kill:** inner first; parent `on exit` before the inner's; parent timer restarting at inner changes; a leaf with no items inside a parent with lines not waiting; `exit;` from the last inner state not leaving the parent.
- **Adversarial reviewer attacks:** jump from a parent's line into a sibling's inner state; a parent line and an inner line on the same member; nested parents with timers due at one instant; sample 7 Q4.

### Package 4: wakes, own writes and `StateLoop`

- **Files and rules:** simulator (read sets, wakes, pending wakes, SIF-R08, SIF-R18; trace `wake`), validator (SIF-D04 reads, SIF-D05 unconditional cycles), `semantic.ts` (read set helpers shared with `stale-read.ts`).
- **Port:** `stateReads`, `readSet`, `wakeOrPend`, `flushWrites`, `noteWrite`, `cellUpdated`, `wakeFlow`, `noteExternal`, `configuration`, `checkLoop`, `itemNames`, the re-look parts of `look` and `flowMachine` (`lookWrites`, `relook`).
- **Tests:** P4 values cases (helpers, redefinition per occurrence, usage-level redefinition, shadowing by a helper parameter, case-call writes, suspended case calls, write while the look is suspended); P7 own-write cases (counter, timer, parent condition, acting statement once more, statement writes cause no look); `StateLoop` cases (drain, staying drain, wake ping-pong, arrival ping-pong, four-step handshake, and the two known misses reaching `StepLimit`); sample 8 with Q2 and the flip.
- **Mutations to kill:** wakes by change instead of write; read set including line blocks; read set ignoring redefinition; pending wake dropped; re-look also after statement writes; re-look position-free; re-look in periodic machines; configuration without what is present (corpus false positive r6/r7); configuration with unbounded loop counters; `StateLoop` from the first look.
- **Adversarial reviewer attacks:** a helper that reads many attributes; writes by `on exit` of another machine; two machines of one occurrence with overlapping read sets; a re-look that leaves into a state whose arrival look writes; sample-cell updates at one instant; cost on the door showcase and the 1 ms filter.

### Package 5: periodic machines

- **Files and rules:** simulator (persistent activation, release looks, SIF-R15 to R17, `skip` with activation, `periodicEnd`, `held`), validator (SIF-S01 on `every`, SIF-D06), placement (`T4` per 9), `timing.ts` (`projectOperationTiming` periodic mode, 4.6).
- **Port:** the periodic parts of `release`, `activate` (end and restart), `wait` (periodic branch), `flowMachine` (`reachedThisRelease`), input-before-first-release handling in `offer`.
- **Tests:** sample 9 as cases; P6 periodic cases (B2 queries per release, entered and left in one release, release bound with repeating and growing cycles, end and restart, deadline miss, messages between releases); traffic light and connection manager `every 100ms`; door showcase with the heater and supply rewrites (gate F); the supply trap and counted version; T4 placement cases (periodic machine with and without a suspending item; waiting machine on a basic task refused); Timing projection snapshot.
- **Mutations to kill:** `on entry` rerun at each release; timer reset or paused by a skipped release; two messages taken in one release; arrival look skipped (O3); bound counting the first arrival; bound applied in waiting machines; end treated as an error or as completion; skip without activation; deadline measured from the dispatch.
- **Adversarial reviewer attacks:** release guard false at the first release; a periodic machine whose first state is a named step; `return` in the flow of a periodic machine; a suspending line across a release boundary; computed `after` durations re-evaluated at releases; input queued before the first release.

### Package 6: documentation, examples and the migration command

- **Files:** `docs/LANGUAGE_SPECIFICATION.md` (chapters 3 and 6: this document's sections 3 and 4 as normative text), `docs/EVENTS_AND_INPUTS.md`, `docs/CONTROL_FLOW_AND_TIMING.md`, `docs/KEYWORD_REFERENCE.md`, `docs/GRAPHICAL_NOTATION.md` and figures, ADR replacing 0023 (and the T4 note on 0025), the migration guide, examples 44 to 47 and 49 rewritten by hand (7.3), showcases, the reading samples as executable cases (gate E), the consumer notes of section 10, `src/cli` (`swaml migrate`, 7.2), release notes.
- **Tests:** `check-docs`, examples and showcase checks, gate E, CLI tests for `swaml migrate` (write, dry run, refusals, byte-identity of untouched files).
- **Mutations to kill:** the CLI writing a file with errors; touching a file without machines; dropping the identity map.
- **Adversarial reviewer attacks:** every normative sentence against the simulator (a sample per rule); the migration guide against the refusals; documentation that still says `when`, `initial`, `final` or `defer`.

## 12. Risks and what is still open

- **One release.** A wrong rule cannot be fixed later; every runtime rule has been prototyped, and each package carries its gate.
- **Exact read sets:** a missed wake stalls a case silently; an extra wake acts twice. Package 4's reviewer must attack it.
- **Text order is behaviour:** every refactoring tool must treat item order and level as meaningful.
- **The arrival-look trap** (1.13) is real and only documented.
- **Extension cost** (review I10) is not estimated here: dual parsing until migration, Flow View for every flow, the migration command, overlays, State view retirement.
- **Not prototyped:** the drawings of P2b (lanes versus back-jump stubs, compact boxes, arrows across parent borders) and the reading test with the owner (P3b). Neither changes the language.

## 13. Questions for the owner

1. **The supply monitor trap.** When a machine released every 50 ms enters a state, that state looks at the same reading that made the previous state leave. Keep this (your earlier decision; the trap is documented and has a correct way to write it), rather than making a newly entered state wait for the next release? Recommended: **yes, keep.**
2. **Waiting machines and basic tasks.** A machine released on start waits inside one activation, so it would always need an extended task (ADR 0025 currently lets 2.2 machines use basic tasks). Accept that? Recommended: **yes.**
3. **The window lifter showcase.** Keep the 8 s limit per state (as in 2.2), rather than one 8 s limit per movement written once on `driven` (which changes behaviour)? Recommended: **yes, per state.**
