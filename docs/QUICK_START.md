# Quick start: swa.ml 3.0

Read a model in this order: components, attributes, ports, operations, schedule, connections. A def defines a reusable type/body; a usage creates a distinct occurrence. Every value has an explicit type. Every cross-component message has an owned port and explicit route.

```swaml
package HelloGuide {
  port def Greeting { provides event message(text: string); }
  component def Speaker {
    port output: Greeting;
    operation greet() { publish output.message("Hello, swa.ml"); }
    schedule { on start greet(); }
  }
  component def Listener {
    reversed port input: Greeting;
    attribute last: string = "";
    operation accept(text: string) { last = text; }
    schedule { on receive input.message(text) accept(text); }
  }
  component Demo {
    component speaker: Speaker;
    component listener: Listener;
    connect (speaker.output, listener.input);
  }
}
```

Install dependencies with npm ci, build with npm run build, then validate the saved file using node out/src/cli/main.js --json hello.swaml. To execute, create options.json with {"untilNs": 1000000} and run node out/src/cli/simulate.js HelloGuide::Demo options.json hello.swaml. Listener.last becomes Hello, swa.ml through a real routed event. Bare connect uses the pinned Default policy.

Behaviour that waits for something is written with states, which are steps of an operation's flow. The courtesy lamp waits in `dark` until the door opens, then shines until the door closes or 30 s have passed, and the loop goes back to `dark`:

```swaml
package CourtesyLamp {
  port def Door {
    provides event opened();
    provides event closed();
  }
  component def Lamp {
    reversed port door: Door;
    attribute lit: bool = false;
    operation control() {
      while (true) {
        state dark {
          on receive door.opened() exit;
        }
        state shining {
          on entry {
            lit = true;
          }
          on exit {
            lit = false;
          }
          on receive door.closed() exit;
          after 30s exit;
        }
      }
    }
    schedule {
      on start control();
    }
  }
  component def Car {
    /** Interface-only actor: the door switch. */
    port toLamp: Door;
  }
  component lamp: Lamp;
  component car: Car;
  connect (car.toLamp, lamp.door);
  associate car to 'Lit while the door is open';
  test 'Lit while the door is open' of lamp {
    publish car.toLamp.opened();
    wait 1ms;
    assert lamp.lit;
    publish car.toLamp.closed();
    wait 1ms;
    assert not lamp.lit;
  }
}
```

A state runs `on entry` once and then looks at its lines each time something happens to it; `exit;` goes on with what is written next, and `on exit` runs on the way out. A message the waiting state does not name, such as `closed` while `dark`, is dropped. Run the test with node out/src/cli/main.js test lamp.swaml; the [usage guide](USER_GUIDE.md#model-behaviour-over-time-with-states) explains states, parents and periodic machines.

Continue with the [usage guide](USER_GUIDE.md), [complete examples](../examples/), [AI guide](AI_GUIDE.md) and [support matrix](IMPLEMENTATION_STATUS.md). swa.ml 3.0 replaces the state machines of 2.2 by states in the flow; [swaml migrate](TOOLING.md#migrating-22-state-machines) rewrites a 2.2 source. See the [3.0 release notes](RELEASE_3_0.md). Published references, including 2.2 and 2.1, remain unchanged; the [2.1 release notes](RELEASE_2_1.md) describe the migration from 2.0.
