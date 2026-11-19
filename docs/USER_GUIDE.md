# swa.ml 3.0 usage guide

Start with a component, give each persistent value a typed attribute, and write named operations for behavior. Add a schedule to say when those operations run. Add directed ports and explicit connections when behavior crosses component boundaries.

This guide describes swa.ml 3.0. For repository validation use Node.js 26.12.0 from .node-version and npm 10.2.3+, then run npm ci and npm run build. Validate with node out/src/cli/main.js model.swaml; --language-version 3.0 names the edition explicitly. Files are headerless; the host and exact package revision select the edition. The published 2.2 and 2.1 references remain frozen; a 2.2 source with a state machine is rewritten with [swaml migrate](TOOLING.md#migrating-22-state-machines).

## A first model

```swaml
package Counter {
  component Demo {
    /** A small autonomous counter. */
    attribute count: int = 0;
    operation increment() {
      count = count + 1;
    }
    schedule {
      on every 10ms increment();
    }
  }
}
```

Demo is the execution root. count belongs to its occurrence for the run; a var inside increment would belong to that activation/block. The schedule releases at 10ms, 20ms and so on, with a default 10ms deadline. Operations without a schedule entry are local helpers. Unscheduled behavior is not automatically executed.

Create options.json containing {"untilNs": 25000000}, then run:

```sh
node out/src/cli/simulate.js Counter::Demo options.json model.swaml
```

The final Demo.count is 2. The JSON records sources, logical trace, limits and final stores. It is bounded reference evidence with zero physical CPU cost. It does not prove production timing.

## Reuse structure without sharing state

```swaml
package ReuseGuide {
  component def Counter {
    attribute count: int = 0;
    operation increment() { count = count + 1; }
    schedule { on start increment(); }
  }
  component Demo {
    component left: Counter {
      redefines attribute count: int = 10;
    }
    component right: Counter;
    component bank: Counter[3];
  }
}
```

left starts with its own count at 10, then reaches 11. right and every bank index reach 1 independently. A usage body adds members or explicitly redefines an inherited whole member. Single specializes inheritance follows the same rule. Definition identity is shared; occurrence state is separate. Use bank[0] in connector/deployment/view paths. Port arrays and connector loops are absent.

## Choose the value's lifetime

Use const attribute for a fixed per-occurrence configuration value, attribute for mutable component state, var for lexical activation data and typed parameters/results for copied calls. Requirements own immutable attributes. Never read another component's private state by a dotted path.

Primitive types are bool, byte, uint, int, real and string; arrays have fixed extents. Define nominal records with datatype and enums with enum. Construct records with every field, as in record Reading { value = 2.5; unit = "C"; }. Access an enum with Mode.active, or a qualified package name if a local value shadows Mode. Check [the values example](../examples/05-values-and-flow.swaml) for a complete model. Numeric overflow, division by zero and dynamic invalid indexes fail at runtime; narrowing real to int uses the checked Math conversions.

## Compute with operations

```swaml
package OperationGuide {
  operation def Clamp(v: real, lo: real, hi: real) returns real {
    if (v < lo) { return lo; }
    if (v > hi) { return hi; }
    return v;
  }
  component Demo {
    attribute result: real = 0.0;
    operation clamp: Clamp;
    operation calculate() {
      operation double(v: real) returns real { return v * 2.0; }
      result = clamp(double(4.0), 0.0, 5.0);
    }
    schedule { on start calculate(); }
  }
}
```

A declaration has parentheses and optional returns; a usage has a type and inherits its signature. Its optional body replaces the whole definition body. Nested operations come first and never capture the outer operation's parameters/locals. Pass values explicitly. Component operations may read/write their own attributes. Package definitions can use only parameters/nested operations. Calls are expressions; void calls are statements; a value result cannot be discarded. Out arguments name mutable compatible cells and copy back only after success. Recursion and overloading are absent.

Import Swaml::Math explicitly for abs/min/max/floor/round/trunc/length/concat. From 3.0, import Swaml::Numeric for minInt/maxInt/clampInt/clamp and the correctly rounded sqrt, Swaml::Text for intText/realText/boolText (realText(v, decimals) rounds ties away from zero and fails with Bounds above 15 decimals or from 1e21) and Swaml::Time for now(), the logical time in nanoseconds, which reads state and is not allowed in attribute initializers ([square root](../examples/38-square-root.swaml), [logical clock](../examples/39-logical-clock.swaml) and [number text](../examples/40-number-text.swaml) examples). View, QoS, CallFailure and Platform libraries are also loaded and explicitly imported when using their short names. Do not invent host built-ins or assume an arbitrary library exists.

## Connect components

[The hello model](../examples/01-hello.swaml) is the smallest complete routed example. A port definition declares provides event message(value: string). Sender owns a port of that type and emits with publish. Receiver uses reversed port, making that member requires, and binds it once in on receive. The root connects the two child ports.

Use provides/requires on each member, rather than assigning a role to the whole port. send updates a provided attribute; publish emits a provided event; p.operation(args) calls a required operation. Port definitions may differ if their members match structurally by name and compatible type. Records/enums remain nominal. A boundary-to-child same-direction connection forwards the boundary without queue/latency; it cannot have a policy or local handler.

A bare connect uses Swaml::Qos::Default: atMostOnce, fifo, capacity 16, reject, request timeout 1s. Select a named complete policy with connect link: Reliable (a.p, b.p). Reliable requests need an idempotent provided operation. Attributes retain the latest pending value regardless of event/request buffering. Nonoptional ports of every concrete root must resolve to a connection. optional only waives that port's closure requirement.

## Serve and request a value

See [the service example](../examples/07-client-server.swaml). The provider binds its provided operation through on call api.get(k) get(k). The consumer calls its own required member and usually chooses an explicit fallback:

```text
last = try(api.get(1), -1.0);
```

Timeout comes from the route policy. A bare failing call fails the activation; try catches runtime expression failures and evaluates fallback lazily. Static errors, interruption, deadlines and resource violations cannot be caught. Committed effects remain committed. The reason is trace evidence and is not an implicit model variable. A suspending call must be the whole initializer, assignment value or statement, optionally wrapped in try; avoid api.get(1) + 2.

## Schedule and suspend deliberately

on start runs once; on every D runs periodically; on receive binds an incoming event/attribute; on call serves a provided operation; after op runs after successful whole same-owner completion. One operation may have several entries, but the same trigger/operation pair cannot appear twice in one block. After dependencies are acyclic and release fresh parameterless void activations, with no forwarded arguments or result. [The chaining example](../examples/25-function-completion.swaml) shows this distinction.

wait, requests and receive statements release the component's serial lock. Another activation can change attributes before resumption. Recheck conditions after resuming before writing state. A concurrent entry cannot write state, even through a helper or out argument, and always reads its dispatch snapshot. Entry deadlines include suspension/backlog; an every entry defaults to its period. WCET belongs to target binding/evidence.

From 3.0 a duration literal such as 250ms is a uint value in nanoseconds, so durations can be computed. Write them in parentheses: wait (delayMs * 1ms);, or after (ackTimeoutMs * 1ms) { … }, a state timer after (pulseMs * 1ms) to locked; (evaluated when the state's on entry finishes) and on every (periodMs * 1ms) poll() deadline (periodMs * 1ms / 2);. A period or deadline uses only literals, const attributes, arithmetic with exact integral division, comparisons and the conditional, and is evaluated for each occurrence, so a usage that redefines periodMs gets its own period. Multiply by a unit: after (pulseMs) would count nanoseconds (warning SW2016). A computed delay that is not positive fails with DurationRange, which try catches ([computed backoff](../examples/41-computed-backoff.swaml), [lock pulse](../examples/42-lock-pulse.swaml) and [derived period](../examples/43-derived-period.swaml) examples).

while tests first; until tests after its body. An optional n times limit evaluates once and exits normally. Counted for and copied-array for in have lexical loop scopes. [The loop model](../examples/18-control-loops.swaml) covers every form. Unbounded loops are permitted but a finite run has a step budget/deadline.

## Receive and interrupt

[Receive statements](../examples/21-receive-and-try.swaml) wait for one of several explicitly bound inputs or a timeout, keeping early input queued. An [interruptible region](../examples/19-interruptible-function.swaml) is armed only during its body/callees and transfers within the same activation, preserving committed effects. Inactive region input is discarded observably; heed SW2012.

## Model behaviour over time with states

A state is a step of an operation's flow, like a call or an `if`. The flow reaches `state s { … }`, runs its `on entry` once and stays there, waiting. Each time something happens to the state (it is reached, a message it names arrives, its timer runs out, a value its statements read is written by another activation or updated by a delivery, or, in a periodic machine, a release comes), it **looks** at what is inside its braces again, top to bottom: the line of what happened runs (`on receive p.m(x) { … }` for that message, `after D { … }` once D has passed since the state was reached), and every other statement runs. `if` checks now and never waits. The look stops at the first `exit;`, which leaves the state and goes on with what is written next, or `to s;`, which goes to state `s`; `on exit` runs on the way out. Only these two may drop their braces: `after 30ms exit;` means `after 30ms { exit; }`.

A message that a waiting state does not name is dropped. When something must be remembered until a state can act on it, keep it in a variable. An operation with states is parameterless and void and has exactly one schedule entry: `on start` (a waiting machine, which waits between looks) or `on every P` (a periodic machine). It is never called.

**A state is a step.** The seat heater waits in `idle` and keeps the requested boost in a local; the decision after `idle` chooses whether `boosting` comes before `heating`, and the loop goes back to `idle`.

```swaml
package SeatHeater {
  port def Panel {
    provides event pressed(boost: bool);
    provides event off();
  }
  component def Heater {
    reversed port panel: Panel;
    attribute level: uint = 0;
    operation control() {
      while (true) {
        var boost: bool = false;
        state idle {
          on receive panel.pressed(b) {
            boost = b;
            exit;
          }
        }
        if (boost) {
          state boosting {
            on entry {
              level = 3;
            }
            after 30ms exit;
          }
        }
        state heating {
          on entry {
            level = 1;
          }
          on receive panel.off() exit;
        }
        level = 0;
      }
    }
    schedule {
      on start control();
    }
  }
  component def Seat {
    /** Interface-only actor: the button panel. */
    port toHeater: Panel;
  }
  component heater: Heater;
  component seat: Seat;
  connect (seat.toHeater, heater.panel);
  associate seat to 'Boost, then heat', 'Off is dropped while boosting';
  test 'Boost, then heat' of heater {
    publish seat.toHeater.pressed(true);
    wait 1ms;
    assert heater.level == 3;
    wait 30ms;
    assert heater.level == 1;
    publish seat.toHeater.off();
    wait 1ms;
    assert heater.level == 0;
  }
  test 'Off is dropped while boosting' of heater {
    publish seat.toHeater.pressed(true);
    wait 10ms;
    publish seat.toHeater.off();
    wait 25ms;
    assert heater.level == 1;
  }
}
```

An `off` pressed while `boosting` is dropped, because `boosting` does not name it; the heater still goes on to `heating`, as the second test shows. A `pressed` while `heating` is dropped the same way.

**A parent.** A state whose braces end with inner states is a parent: what is written on it applies in every state inside. The washer's release line and its 100 ms timer leave `washing` from `spraying` and from `wiping` alike, and its `on exit` switches the pump off however `washing` is left. The parent's timer counts from the parent's arrival and keeps running while the inner states change; `wiping` jumps back to `spraying` with `to spraying;`.

```swaml
package Washer {
  port def Stalk {
    provides event pull();
    provides event release();
  }
  component def WasherControl {
    reversed port stalk: Stalk;
    attribute pump: bool = false;
    attribute wipes: uint = 0;
    operation control() {
      while (true) {
        state idle {
          on receive stalk.pull() exit;
        }
        state washing {
          on exit {
            pump = false;
          }
          on receive stalk.release() exit;
          after 100ms exit;
          state spraying {
            on entry {
              pump = true;
            }
            after 20ms exit;
          }
          state wiping {
            on entry {
              pump = false;
              wipes = wipes + 1;
            }
            after 10ms to spraying;
          }
        }
      }
    }
    schedule {
      on start control();
    }
  }
  component def Steering {
    /** Interface-only actor: the washer stalk. */
    port toWasher: Stalk;
  }
  component washer: WasherControl;
  component steering: Steering;
  connect (steering.toWasher, washer.stalk);
  associate steering to 'Release stops spraying and wiping', 'The parent timer ends a long wash';
  test 'Release stops spraying and wiping' of washer {
    publish steering.toWasher.pull();
    wait 25ms;
    assert not washer.pump and washer.wipes == 1;
    wait 10ms;
    assert washer.pump;
    publish steering.toWasher.release();
    wait 1ms;
    assert not washer.pump and washer.wipes == 1;
  }
  test 'The parent timer ends a long wash' of washer {
    publish steering.toWasher.pull();
    wait 95ms;
    assert washer.pump and washer.wipes == 3;
    wait 10ms;
    assert not washer.pump and washer.wipes == 3;
  }
}
```

**A condition that is checked again.** A condition written in a state's braces is checked at every look, and a state looks again when a value its statements read is written by another activation or, for a sampled port member (an attribute member with an initial value), updated by a delivery. `idle` and `heat` below therefore look at every delivered temperature without a receive line, with a hysteresis between 2 and 8 degrees.

```swaml
package Defroster {
  port def Glass {
    provides attribute celsius: int = 20;
  }
  component def Defrost {
    reversed port glass: Glass;
    attribute heating: bool = false;
    operation control() {
      while (true) {
        state idle {
          if (glass.celsius < 2) exit;
        }
        state heat {
          on entry {
            heating = true;
          }
          on exit {
            heating = false;
          }
          if (glass.celsius > 8) exit;
        }
      }
    }
    schedule {
      on start control();
    }
  }
  component def Sensor {
    /** Interface-only actor: the glass temperature sensor. */
    port toDefrost: Glass;
  }
  component defrost: Defrost;
  component sensor: Sensor;
  connect (sensor.toDefrost, defrost.glass);
  associate sensor to 'Heats between the thresholds';
  test 'Heats between the thresholds' of defrost {
    send sensor.toDefrost.celsius(0);
    wait 1ms;
    assert defrost.heating;
    send sensor.toDefrost.celsius(5);
    wait 1ms;
    assert defrost.heating;
    send sensor.toDefrost.celsius(10);
    wait 1ms;
    assert not defrost.heating;
    send sensor.toDefrost.celsius(5);
    wait 1ms;
    assert not defrost.heating;
  }
}
```

When a line of a state writes a value that a statement above the line has already read in the same look, the state looks again at once ([cooling fan](../examples/56-cooling-fan.swaml)). Count events in a line's block, not in plain statements of a state: those run at every look. A condition that waits for time to pass is written `after D`, never `if (now() …)`: time passing wakes nothing (SW2006).

**A periodic machine.** Released `on every P`, an operation with states keeps its place, locals and timers between releases; each release makes one look at the current state, with the values as they are at that release. A timer counts from its state's arrival, across releases, and is looked at at the first release at or after its moment. A newly reached state looks at once, in the same release; a state reached a second time in one release waits for the next. When the flow reaches its end, the next release starts it again from the top. The key scanner counts a press held for 30 ms:

```swaml
package LongPress {
  port def Key {
    provides attribute down: bool = false;
  }
  component def Scanner {
    reversed port key: Key;
    attribute longPresses: uint = 0;
    operation scan() {
      while (true) {
        state released {
          if (key.down) exit;
        }
        state pressing {
          if (not key.down) to released;
          after 30ms exit;
        }
        longPresses = longPresses + 1;
        state holding {
          if (not key.down) exit;
        }
      }
    }
    schedule {
      on every 10ms scan();
    }
  }
  component def Panel {
    /** Interface-only actor: the key. */
    port toScanner: Key;
  }
  component scanner: Scanner;
  component panel: Panel;
  connect (panel.toScanner, scanner.key);
  associate panel to 'A long press counts once', 'A short press does not count';
  test 'A long press counts once' of scanner {
    wait 5ms;
    send panel.toScanner.down(true);
    wait 30ms;
    assert scanner.longPresses == 0;
    wait 10ms;
    assert scanner.longPresses == 1;
    wait 50ms;
    send panel.toScanner.down(false);
    wait 20ms;
    assert scanner.longPresses == 1;
  }
  test 'A short press does not count' of scanner {
    wait 5ms;
    send panel.toScanner.down(true);
    wait 20ms;
    send panel.toScanner.down(false);
    wait 50ms;
    assert scanner.longPresses == 0;
  }
}
```

A press that begins and ends between two releases is never seen. The [interior light](../examples/54-interior-light.swaml), [window auto-up](../examples/55-window-auto-up.swaml), [cooling fan](../examples/56-cooling-fan.swaml) and [turn signal flasher](../examples/57-turn-signal-flasher.swaml) examples show these forms in full; [the state example](../examples/04-stateful-function.swaml) completes when its flow reaches its end. The end of a waiting machine's flow completes it once and releases its `after` dependents; a waiting state does not. A 2.2 state machine (`initial`, `final`, ordered transitions with `when`) is a syntax error in 3.0 whose message names `swaml migrate`, which rewrites it ([tooling](TOOLING.md#migrating-22-state-machines)).

## Describe deployment, intent and views

Use a separate deployment declaration over software and platform roots. Targets are component occurrences specializing Swaml::Platform::Node. Const attributes may retain external ref identities; task/core scheduling stays in target adapters. [The deployment example](../examples/22-platform-deployment.swaml) shows family placement with an indexed override.

Requirements, satisfy and test/verify record intent. [The traceability example](../examples/16-requirements-and-views.swaml) includes a test of its root, satisfy and verify links and views. A case does not inject events at a destination; a case script acts through actor ports and its pass is evidence of one run, not proof.

A package is a closed context. Declare the system and its surroundings as top-level component occurrences and join their ports with package connections, connect (customer.panel, atm.panel);. Write use case Name of subject { … } or test Name of subject { … } in the package; the subject is its focal top-level occurrence. A case without statements records intent only and may omit of; a script requires of. Script-driven actors and stubs are interface-only components, component def Customer { port panel: Panel; }, which need no implementation; associate customer to 'Withdraw cash'; records participation. satisfy Requirement by design; claims a component definition or occurrence path of the package, and verify Requirement by Test; links a test. [The use case example](../examples/28-use-cases.swaml) shows these package links and quoted names.

A case body may continue after its documentation with statements acting through its associated interface-only actors: publish customer.panel.cashRequested(100); and on receive customer.panel.cashDispensed(amount) { assert amount == 100; } or after 2s { fail "no cash"; }. A script can answer a stub request with on call bank.link.authorize(amount) { return false; }. Both use cases and tests may call operations of their primary subject, such as var amount: int = atm.withdraw(20);. The operation runs in the subject's own context and may communicate, receive and wait; the case resumes when it returns. A test may additionally inspect private attributes and call eligible helpers on explicitly associated same-package roots and single parts. Use cases cannot inspect private state or directly call those extra owners. Association does not create components or permit impersonating an active collaborator's ports.

Subject calls are sequential. An event emitted by the subject can stay queued for a later actor receive, as in the [subject-call example](../examples/31-case-subject-calls.swaml). If the subject instead waits for a reply from an actor, a later reply branch in the same blocked case cannot run. Give that actor independent behavior, or start the subject with an actor event before handling its reply. An operation with states is never called by a case; it runs from its own schedule entry. Suspended calls use a whole initializer, assignment or statement; immediate calls may still appear in expressions.

swaml test runs every case in its own fresh whole-package run and reports pass, fail, inconclusive or no checks; [the executable cases example](../examples/29-executable-cases.swaml) adds an isolation package with a bank stub, and [the associated-component example](../examples/30-associated-integration.swaml) checks several implemented peers. Names containing spaces, letters outside ASCII or reserved words are written in single quotes, for example use case 'Withdraw cash' or attribute 'record': int = 0;. From 3.0, view, state, in and out are contextual words, so attribute state: SessionState = SessionState.offline; needs no quotes ([the contextual words example](../examples/36-contextual-words.swaml)). One associate statement may list several occurrences and cases, associate truck, van to 'Monitor live position', 'Command a vehicle';, and associates each listed occurrence with each listed case ([the association list example](../examples/37-association-lists.swaml)); a value chosen by a condition is written x = if (c) a else b; ([the conditional example](../examples/35-conditional-expression.swaml)).

Import Swaml::Views and type views by General, Interconnect, Case, Sequence, Grid, Flow or Timing. Compact of selects a subject; include/recursive/where builds a stable union. Filter kinds are component and operation for the structural/executable families. Browser navigates ownership; Flow combines statements/states; Timing separates declared schedule/deadline information from identified observed traces. Presentation layout belongs in sidecars, not language source.

## Validate and repair

```sh
node out/src/cli/main.js --json model.swaml
node out/src/cli/main.js --format model.swaml
node out/src/cli/main.js --check-format model.swaml
npm run check
```

Load every application dependency together. Fix syntax/names first, then ownership/routes, types/effects and schedules. JSON diagnostics expose stable codes/ranges and identity metadata. Always revalidate after a repair; formatting is not a semantic repair. Read [AI authoring](AI_GUIDE.md), the [keyword reference](KEYWORD_REFERENCE.md) and the [support matrix](IMPLEMENTATION_STATUS.md) for precise boundaries.

## Test explicitly associated components

A test may inspect its primary subject and the software components explicitly referenced by its `associate` links, including their single parts and, from 3.0, a member of a part family named by a literal index such as `backend.twins[0].link`. The components remain owned by the structural model. For example:

```swaml
package AssociatedTests {
  component def Counter { attribute count: int = 0; operation bump() { count = count + 1; } }
  component def Assembly { component worker: Counter; }
  component primary: Counter;
  component companion: Assembly;
  test Integration of primary {
    companion.worker.bump();
    assert primary.count == 0 and companion.worker.count == 1;
  }
  associate companion to Integration;
}
```

Without the association, access to `companion` is rejected. A use case gains no private state or direct peer/part access from that association. Normal calls on the exact primary subject work in both case kinds; helper calls on the extra test owners must neither communicate nor suspend, although they may change the target through its own operation. Direct attribute assignment stays forbidden. Communicate through the subject's own operation or associated interface-only actor ports and real connections; association does not let a script take over an active component's ports.

Every case still initializes and runs its whole package, and each run gets fresh stores. Associations do not select a subset, disable unrelated startup work, create an atomic snapshot or own components. Only executed, non-multiple software roots are accessible; nested singleton parts work, while intermediate component indexes remain unsupported. See the [ten-component routed integration](../examples/30-associated-integration.swaml) and [2.2 release notes](RELEASE_2_2.md).
