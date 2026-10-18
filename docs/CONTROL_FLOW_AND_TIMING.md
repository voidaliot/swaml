# Loops, interrupts and function timing

SWAML 1.3 adds three loop forms and interruptible regions. FV presents flow, states and interruptible regions. The dedicated TV presents function timing from the same component-owned behavior model. The 1.3.1 development correction retains parser family and simulation profile 1.3; see the [migration guide](MIGRATION_1_3_1.md) and [ADR 0012](decisions/0012-timing-view-and-structure-layouts.md).

## Choose a loop

| Form | Test and bound | Scope |
| --- | --- | --- |
| `while (condition) bound n { … }` | Test first; zero or more iterations; explicit bound. | Fresh body locals each iteration. |
| `for (var i: int = 0; i < 3; i = i + 1) bound 3 { … }` | Initialize once; test first; update after body; explicit bound. | Header variable remains inside the loop. |
| `forEach (item: int in values) { … }` | Visit each element of one copied fixed-size array. | Fresh typed element and body locals each iteration. |
| `do { … } while (condition) bound n;` | Execute at least once, then test; explicit bound. | Body locals are not visible in the condition. |

The spelling is `forEach`, following lower camel case keywords. Conditional bounds must be positive safe-integer literals. If a condition is still true after the permitted number of body executions, execution fails before an extra iteration. A return or failure exits the enclosing function/frame. There are no break, continue, range shorthand or unbounded loops.

```swaml
package LoopGuide {
    component Demo {
        var total: int = 0;
        function run() on start {
            for (var i: int = 0; i < 3; i = i + 1) bound 3 {
                total = total + i;
            }
            forEach (value: int in [1, 2, 3]) {
                total = total + value;
            }
            do { total = total + 1; } while (total < 10) bound 2;
            assert total == 10;
        }
    }
}
```

The complete [loop model](../examples/18-control-loops.swaml) also demonstrates nested loops and mutation of the original array during snapshot iteration.

## Interrupt a protected region

Use an owned input port member to interrupt a named region:

```text
function run() on start {
    interruptible work {
        call job.perform() as value within 50 ms
            otherwise { fail "Job failed"; };
        status = value;
    } on receive control.stop {
        status = 2;
        why = reason;
    }
    // Both normal completion and the interrupt handler continue here.
}
```

Here control.stop is an event with a string parameter named reason. A sender reaches it through the ordinary typed connector; an external actor label cannot deliver it directly. The [complete interrupt model](../examples/19-interruptible-function.swaml) includes the contracts, sender, server, routes and a simulation configuration.

The handler replaces the remaining protected work. It retains the same activation and deadline; it does not run concurrently with the protected body. Previous changes remain committed. If a request is pending, its continuation is cancelled and its later reply cannot resume the function. The server may still finish and retain its effects. Input arriving before entry or after exit is explicitly discarded.

The reference example starts a request at 0 ms, commits the server effect at 5 ms, receives the stop event at 7 ms, completes the interrupt handler at 7 ms and discards the late reply at 10 ms. The final worker status is 2 and the server's committed count remains 1.

Interruptible regions require a triggered serial flow function. Receive transitions remain the stateful-function mechanism. Nested regions are supported with distinct interrupt members; an outer interrupt unwinds the active inner region. A protected region can call helpers, but helpers cannot declare their own interrupt endpoint. Handler payload bindings cannot shadow enclosing values.

## Read a TV timing diagram

Select **Timing View (tv)** in the showcase. The [timing model](../examples/17-function-timing.swaml) provides two independent clients and servers, including repeated activations. Four trace scenarios show delayed success, timeout with a late reply, an observation horizon and a deadline stop. Select a function occurrence or activation to inspect its events and source.

Select one function with `view observed tv of Demo.first.poll;`. The timing model's block explicitly selects both client and server function occurrences; its root-owned input driver remains in the complete trace. To include every descendant function, including a driver, use `view allTiming tv { include Demo recursive where kind == "function"; }`. Compact component-root/definition subjects are invalid. Timing contracts and triggers are not required merely to select a function. A view declaration does not run it.

In the success run, driver publications occur at 0, 0 and 1 ms. Input transport releases the client activations at 2, 2 and 3 ms. Repeated `first.poll` activations complete at 6 and 10 ms; the second waits for its serial owner between 3 and 6 ms. The timeout run shows the first timeout at 32 ms and late reply at 36 ms, with a queued activation still open at the explicit 40 ms observation horizon. The separate deadline scenario stops at 49 ms.

| Drawing | Meaning |
| --- | --- |
| Release and dispatch markers | Activation readiness and the start of its dispatch. |
| Ready interval | Waiting before dispatch, including serial backlog. |
| Running marker or interval | Observed active phase; zero-cost steps retain zero duration. |
| Request-wait interval | Suspension while the caller awaits its correlation. |
| Completion, failure or interrupt marker | The observed lifecycle event for that activation. |
| Open interval at the boundary | Still unfinished when the trace stops or its horizon is reached. |
| Declared deadline marker | Absolute release-plus-deadline contract boundary. |

WCET, deadline and concurrency are shown separately as declared values. Waiting time is not CPU execution time. A bounded logical-time trace supplies observations, not physical WCET measurement, production schedulability or a universal verification result. Trace identity, profile, selected root and source digest remain inspectable.

The portable `projectFunctionTiming` API consumes trace evidence and optional occurrence contracts. It retains source ordinals, activation/correlation identity, cancellation and late responses without mutating the supplied evidence. The checked-in showcase projection is regenerated with `node scripts/build-timing-demo.mjs` and verified by the normal language gate.
