# Requirements, documentation and intent

swa.ml 2.0.

A requirement owns immutable typed attributes and at most one formal doc. Use /** ... */ first in a body or immediately before the semicolon of a leaf declaration. Ordinary // and /* ... */ comments remain separate lexical annotations. Formal documentation is owned source, not an executable statement or proof.

satisfy Requirement of designPath links intent from a design identity; inside a component, satisfy Requirement; claims the component. Only a verification case owns verify. Use cases describe an intended interaction without asserting verification. A case belongs to its subject, the component that owns it, names typed actor roles outside it, and uses named send/publish/request/reply steps from source to target: between an actor and the subject's own ports, or via a connection inside the subject, optionally after a predecessor. A use case may include or extend another use case of the same subject. A package use case has no subject and records intent only.

Routes, member kinds/directions and request/reply correlation must resolve to the root topology. Cases do not create channels or inject events. A route-valid case needs an identified witness execution before realization can be claimed. A requirement needs associated test/analysis/review evidence before fulfillment can be claimed.

[The complete traceability model](../examples/16-requirements-and-views.swaml) contains a documented requirement, satisfaction, verification case and selected views. General/Grid can inspect intent relations; Case/Sequence present cases and causality. All preserve occurrence identity and retain unproven status where evidence is absent.
