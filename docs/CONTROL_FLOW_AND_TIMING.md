# Control flow and timing

swa.ml 3.0.

Use operation-owned flow for sequential work and states for an explicit lifecycle. A schedule owns startup, periodic, receive, call and after bindings; operation headers carry only signature information. Entry deadlines include backlog and suspension. Every entries default to their period. WCET belongs to a target binding with identified evidence.

while tests before its body; until tests afterward. Optional n times evaluates once and exits normally. Counted for scopes its initializer; for in copies a fixed array before iterating. There is no bound/do/forEach syntax. See [all loop forms](../examples/18-control-loops.swaml).

wait, requests and receive release serial locks. Resuming work reads live attributes, so recheck predicates before writing. Concurrent entries are transitively non-writing and retain a dispatch snapshot throughout. try catches expression failures without rolling back prior effects; deadlines, interruption and resources bypass it.

Receive statements queue early input and can select a timeout. Interrupt regions are armed only over their body/callees, cancel protected continuation in the same activation, and discard inactive input observably. [Interrupt example](../examples/19-interruptible-function.swaml).

States are steps of the flow: a state runs its `on entry` once, then looks at its event lines and statements each time something happens to it, and `exit;` or `to S;` leave it ([usage guide](USER_GUIDE.md#model-behaviour-over-time-with-states)). An operation with states is parameterless void with exactly one `on start` entry (a waiting machine) or one `on every` entry (a periodic machine). The end of a waiting machine's flow completes it once and releases its after dependents; a waiting state does not. [State example](../examples/04-stateful-function.swaml).

A periodic machine keeps its place, locals and timers between releases and looks once per release at the values as they are then; a newly reached state looks in the same release, and a state reached a second time in one release waits for the next. Its timers count from their state's arrival, keep running across releases (skipped ones too) and are looked at at the first release at or after their moment, so a 50 ms timer in a 10 ms machine is seen at the fifth release after the arrival. The deadline applies to each release and covers every state reached in it. When the flow reaches its end, the next release starts it again from the top. The supply monitor reports a fault when the voltage stays low for 50 ms and clears it only above a higher threshold:

```swaml
package Undervoltage {
  port def Supply {
    provides attribute millivolts: uint = 12000;
  }
  component def Monitor {
    reversed port supply: Supply;
    attribute fault: bool = false;
    attribute faults: uint = 0;
    operation supervise() {
      while (true) {
        state normal {
          if (supply.millivolts < 9000) exit;
        }
        state low {
          if (supply.millivolts >= 9000) to normal;
          after 50ms exit;
        }
        state failed {
          on entry {
            fault = true;
            faults = faults + 1;
          }
          on exit {
            fault = false;
          }
          if (supply.millivolts >= 10500) exit;
        }
      }
    }
    schedule {
      on every 10ms supervise() deadline 2ms;
    }
  }
  component def Battery {
    /** Interface-only actor: the supply voltage. */
    port toMonitor: Supply;
  }
  component monitor: Monitor;
  component battery: Battery;
  connect (battery.toMonitor, monitor.supply);
  associate battery to 'A short dip is no fault', 'A long dip is a fault';
  test 'A short dip is no fault' of monitor {
    wait 5ms;
    send battery.toMonitor.millivolts(8000);
    wait 30ms;
    send battery.toMonitor.millivolts(12000);
    wait 60ms;
    assert not monitor.fault and monitor.faults == 0;
  }
  test 'A long dip is a fault' of monitor {
    wait 5ms;
    send battery.toMonitor.millivolts(8000);
    wait 60ms;
    assert monitor.fault and monitor.faults == 1;
    send battery.toMonitor.millivolts(10000);
    wait 20ms;
    assert monitor.fault;
    send battery.toMonitor.millivolts(11000);
    wait 10ms;
    assert not monitor.fault and monitor.faults == 1;
  }
}
```

A dip between two releases is never seen; a sampled value is read as it is at the release. A waiting machine needs an `extended` Task when it is deployed on Swaml::Os; a periodic machine may run on a `basic` Task when nothing it runs in a release can suspend ([chapter 4](spec/04-systems-and-conformance.md), T4). A model that loops through states without time passing ends at the step limit, whose report names the instant and the activations that ran. [Turn signal flasher](../examples/57-turn-signal-flasher.swaml).

Timing views use Swaml::Views::Timing. Declared mode shows schedule/deadlines/waits; observed mode adds identified trace phases, lock gaps and message latency. Horizon intervals stay open and zero-cost logical steps are never measured WCET. [Timing model](../examples/17-function-timing.swaml).
