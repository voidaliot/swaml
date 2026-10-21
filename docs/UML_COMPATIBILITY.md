# UML relationship and boundaries

SWAML 2.0.

SWAML is independently authored and does not claim UML, SysML or XMI adapter conformance. Components, operation signatures, typed ports, state machines and views use familiar ideas with the explicit SWAML rules in [the specification](LANGUAGE_SPECIFICATION.md).

Any future transformation must preserve separate occurrence stores, directed member compatibility, queues, schedule releases, suspension lock release, snapshots, try/committed effects, success-only out values, ordered state transitions, cancellation and source provenance. A diagram resemblance is not a semantic transformation. Unsupported constructs need an explicit partial result, never silent approximation.

[The proposed KerML mapping](spec/05-kerml-mapping.md) and [normalized model](spec/07-normalized-model.md) are contracts until an exporter, pinned semantic library and kernel validation exist. Generated Langium ASTs do not supply that evidence.
