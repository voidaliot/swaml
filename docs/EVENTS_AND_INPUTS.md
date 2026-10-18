# Events and external inputs

Represent operator commands, test inputs and asynchronous notifications as named interface events. Declare their payload types, publish them from an owned function, and receive them through a typed port and explicit route.

```swaml
package OperatorEvents {
    interface publishSubscribe Commands version "1.0.0" {
        event adjust(desired: int);
    }
    component def Controller {
        port commands: Commands subscriber;
        var setting: int = 20;
        function adjust(desired: int) on receive commands.adjust {
            setting = desired;
        }
    }
    component Demo {
        port operatorCommands: Commands publisher;
        component controller: Controller;
        connect input: operatorCommands -> controller.commands qos {
            delivery atMostOnce; ordering fifo; capacity 4; overflow reject;
        };
        function driveInputs() on start {
            publish operatorCommands.adjust(22);
        }
    }
}
```

The root component acts as the test driver in this small model. Its `driveInputs` function publishes `adjust(22)`; the connector delivers a copied `int` value to `Controller.adjust`. A larger architecture can place the operator, device adapter or test driver in a separate component with its own publisher port.

`on receive commands.adjust` names the exact incoming event. The same trigger form handles data reception. `on call` implements an interface function; an omitted trigger defines a local helper. `on start` and `on every` describe local lifecycle and periodic behavior.

For a one-shot delayed input, use a driver function with an initial waiting state and an `on after` transition to a final state whose entry publishes the event. Multiple timed states form a finite test sequence. The [operator lifecycle model](../examples/04-stateful-function.swaml), [function timing model](../examples/17-function-timing.swaml) and [interrupt model](../examples/19-interruptible-function.swaml) demonstrate authored event schedules.

The simulator executes the authored driver; it has no direct function-release or destination-event injection option. Operator and test messages therefore use the same interfaces, queues, delivery policy and transport timing as other messages. A host-generated driver remains ordinary source that is validated and recorded with the run. Use cases and verification cases describe intent; they do not generate inputs or prove a test result.

The [1.3.1 migration guide](MIGRATION_1_3_1.md) explains removal of `on manual`; [ADR 0013](decisions/0013-event-driven-external-inputs.md) records the design.
