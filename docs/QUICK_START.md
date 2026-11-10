# Quick start: swa.ml 2.2

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

Continue with the [usage guide](USER_GUIDE.md), [complete examples](../examples/), [AI guide](AI_GUIDE.md) and [support matrix](IMPLEMENTATION_STATUS.md). The unreleased 2.2 draft uses the same concrete grammar as 2.1; hosts must select its added test semantics deliberately. See the [draft changes](RELEASE_2_2.md). Published references, including 2.1, remain unchanged; the [2.1 release notes](RELEASE_2_1.md) describe the migration from 2.0.
