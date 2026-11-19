# Events and inputs

swa.ml 3.0.

Inputs use the same source and routing rules as all communication. Define named event members on ports, emit from an ordinary operation and connect an emitting component to a receiving component. Use a schedule to release the source operation. An operator/test driver is validated source with recorded provenance; there is no manual trigger, direct simulator function release or destination-event injection.

A provided event is emitted with publish; a required event has one owner. Choose a schedule entry for independent activations, a receive statement for a queued wait inside an activation, states with event lines for lifecycle reactions (input a waiting state does not name is dropped; remember it in a variable), or an interrupt region for cancellation during an armed extent. Explicit bindings replace implicit payload/failure variables. [Routed hello](../examples/01-hello.swaml), [receive](../examples/21-receive-and-try.swaml), [interrupt](../examples/19-interruptible-function.swaml).

In an operation with states, a state looks at one message at a time, in the order the messages were delivered. A message is taken when a line on its member runs for it. While a state waits, a message of the operation that it and its parents do not name is dropped (`discardInput`, reason `inactiveOwner`); a message that arrives while the operation is busy waits for the next state that waits. To keep a request that arrives when the operation cannot act on it, write its line on a parent and remember it in a variable. The compressor must rest 20 ms after it stops; a request during the rest is kept in `wanted`, and `stopped` acts on it when the rest is over:

```swaml
package Compressor {
  port def Requests {
    provides event request(run: bool);
  }
  component def CompressorControl {
    reversed port panel: Requests;
    attribute running: bool = false;
    attribute starts: uint = 0;
    operation control() {
      var wanted: bool = false;
      state serving {
        on receive panel.request(run) {
          wanted = run;
        }
        state stopped {
          if (wanted) exit;
        }
        state started {
          on entry {
            running = true;
            starts = starts + 1;
          }
          on exit {
            running = false;
          }
          if (not wanted) exit;
        }
        state resting {
          after 20ms to stopped;
        }
      }
    }
    schedule {
      on start control();
    }
  }
  component def Climate {
    /** Interface-only actor: the climate panel. */
    port toCompressor: Requests;
  }
  component compressor: CompressorControl;
  component climate: Climate;
  connect (climate.toCompressor, compressor.panel);
  associate climate to 'A request during the rest is kept';
  test 'A request during the rest is kept' of compressor {
    publish climate.toCompressor.request(true);
    wait 5ms;
    publish climate.toCompressor.request(false);
    wait 5ms;
    publish climate.toCompressor.request(true);
    wait 5ms;
    assert not compressor.running and compressor.starts == 1;
    wait 11ms;
    assert compressor.running and compressor.starts == 2;
  }
}
```

The parent's line runs before the inner state's statements in the same look, so `started` and `stopped` see the new request at once. The [lock latest request](../examples/45-lock-latest-request.swaml) example keeps the latest lock request the same way. A sampled port member (a required attribute with an initial value) is read without any line, and a state that reads it looks again at each delivery.

Attributes are latest-value updates emitted with send. Events queue under the connection policy. Bare connections select Default; atLeastOnce may duplicate and needs idempotent provided operations for requests. Optional ports waive only their own closure requirement. Forwarded boundaries have no extra handler or queue.

Record source bytes/hashes, root, profile, options and trace when a driver is generated. Cases describe intent and do not execute stimuli. Transport, dispatch and driver activations remain visible timing evidence.
