# Requirements, documentation and views

Capture an obligation as a requirement. Add only the attributes you need, write its formal specification in `doc`, and connect the design and verification intent explicitly.

```swaml
package Example {
    requirement Ready {
        doc /* The application shall initialize its result to 2. */
        attribute id: string = "REQ-001";
        attribute priority: uint = 1;
    }
    component App {
        doc /* Initialize application state. */
        // This value belongs to App.
        var result: int = 0;
        function initialize() on start {
            result = 2;
            assert result == 2;
        }
    }
    satisfy Ready of App;
    useCase Start of App {
        doc /* A user starts the application. */
    }
    verificationCase CheckStartup of App {
        doc /* Run startup and inspect the final result: it must equal 2. */
        verify Ready;
    }
    view coverage gv {
        include Ready;
        include App;
        include Start;
        include CheckStartup;
    }
    view behavior fv {
        include App recursive where kind == "function" and name == "initialize";
    }
}
```

| Concept | What it records | How it is displayed |
| --- | --- | --- |
| requirement | An obligation with typed attributes and optional formal text | Flat rectangle with attributes and doc compartments; one row in a requirements table |
| doc | One formal specification owned by a declaration | A labeled doc compartment or a doc table column |
| ordinary comment | One line or block of informal source explanation | A plain rectangular note inside its owner, or joined to it by a plain dashed line |
| satisfy | A design element claims to fulfill a requirement | Dashed arrow from the design element to the requirement, labeled satisfy |
| useCase | Intended use in a selected root context | Case frame labeled useCase, with optional routed exchanges |
| verificationCase | A verification procedure or scenario | Case frame labeled verificationCase; verify arrows point to requirements |

`doc /* ... */` preserves multiline text literally; string escape sequences are not interpreted. Write it first inside a declaration body. For a leaf such as a port, put it before the semicolon: `port input: Values receiver doc /* Receives the sensor sample. */;`. A declaration can have one doc and any number of ordinary comments. Each `//` line and each `/* ... */` block is separate. Blocks are not nested. A word `doc` inside an ordinary comment or string stays ordinary text.

Attributes are immutable metadata, not variables. They use the same value types as the software model, including records, enums and fixed arrays. Their expressions cannot read private data, call functions or capture other attributes. Requirements have no mandatory subject, identifier attribute, priority or verification method. `priority` is allowed as an attribute name even though it is also a transition keyword.

Use `satisfy` for the design and `verify` for verification intent. A use case cannot verify a requirement. A verification case may describe a manual inspection in its doc, a route-valid sequence of exchanges, or both. These declarations do not run a test or prove the requirement. Record actual simulation, test, analysis or review results separately with the model and tool version that produced them.

A compact view remains valid: `view wiring iv of App;`. A view block combines `include` entries. Each entry selects its subject, optionally its descendants with `recursive`, and optionally filters those candidates with `where`. Predicates use `name`, `kind` or `path`, string/Boolean literals, equality/inequality and Boolean combinations. Filters do not prune traversal: excluding a parent by name does not hide matching descendants. Repeated selections are deduplicated by occurrence path, in first-selection order. An empty result is valid; an empty block is not.

Common kinds are `component`, `function`, `requirement`, `useCase`, `verificationCase`, `port`, `interface`, `variable`, `calculation` and `state`. Names and paths are exact and case-sensitive. All selections resolve in the view's package. Each selected element must fit the view kind. A view never selects another view.

See the [complete example](../examples/16-requirements-and-views.swaml), [normative rules](spec/04-systems-and-conformance.md), [graphical catalog](GRAPHICAL_CATALOG.md) and [interactive showcase](https://voidaliot.github.io/swaml/#traceability).
