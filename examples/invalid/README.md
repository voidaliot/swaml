# Deliberately invalid models

These models are excluded from `validate:examples` and included in negative tests.

| File | Expected rejection |
| --- | --- |
| [bypass-port.swaml](bypass-port.swaml) | `SW050`: communication must identify an owned port and interface member |
| [free-event.swaml](free-event.swaml) | syntax error: event signatures can only belong to an interface |

Run one with `node out/src/cli/main.js examples/invalid/bypass-port.swaml`. Exit code 1 is expected. The test suite adds further mutations for wrong roles/types, unconnected ports, state conflicts, timeouts, imports and malformed source.
