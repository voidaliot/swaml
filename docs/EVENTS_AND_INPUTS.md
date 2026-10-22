# Events and inputs

swa.ml 2.0.

Inputs use the same source and routing rules as all communication. Define named event members on ports, emit from an ordinary operation and connect an emitting component to a receiving component. Use a schedule to release the source operation. An operator/test driver is validated source with recorded provenance; there is no manual trigger, direct simulator function release or destination-event injection.

A provided event is emitted with publish; a required event has one owner. Choose a schedule entry for independent activations, a receive statement for a queued wait inside an activation, a state transition set for lifecycle reactions, or an interrupt region for cancellation during an armed extent. Explicit bindings replace implicit payload/failure variables. [Routed hello](../examples/01-hello.swaml), [receive](../examples/21-receive-and-try.swaml), [interrupt](../examples/19-interruptible-function.swaml).

Attributes are latest-value updates emitted with send. Events queue under the connection policy. Bare connections select Default; atLeastOnce may duplicate and needs idempotent provided operations for requests. Optional ports waive only their own closure requirement. Forwarded boundaries have no extra handler or queue.

Record source bytes/hashes, root, profile, options and trace when a driver is generated. Cases describe intent and do not execute stimuli. Transport, dispatch and driver activations remain visible timing evidence.
