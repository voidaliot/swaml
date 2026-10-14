# SWAML — Software Architecture Modeling Language

SWAML is a software-focused modeling language designed on the KerML semantic foundation. It combines architectural structure, executable-operation contracts, state behavior, and interface-controlled communication for embedded realtime software and services.

**Version 1.1.1 defines the language and includes a working Langium parser, validator and reference simulator.** It is an independent project, informally motivated by an “unofficial UML 3.0”; it is not an OMG UML release, an AUTOSAR implementation, or a certified KerML tool.

## Read the complete specification

[Full Markdown reference](docs/SWAML-1.1.1-Reference.md) · [Full PDF](output/pdf/SWAML-1.1.1-Specification.pdf) · [By concern](docs/CONCERN_GUIDE.md) · [Alphabetical keywords](docs/KEYWORD_REFERENCE.md)

The specification covers every reserved word, formal syntax/typing/execution rules, static and dynamic architecture, communication policies, timing, deployment, cases and graphical notation. The PDF includes clickable navigation, all model examples, exact grammar, vector diagrams and embedded source files. [Publication and verification](docs/PDF_PUBLICATION.md) · [1.1.1 evidence](docs/RELEASE_1_1_1.md) · [Historical v0.1.0](https://github.com/voidaliot/swaml/releases/tag/v0.1.0).

## Start here

- [User guide](docs/USER_GUIDE.md): learn the language through complete models.
- [Normative document set](docs/LANGUAGE_SPECIFICATION.md): the rules and conformance obligations.
- [Reference simulation](docs/SIMULATION.md): execute models and inspect reproducible traces.
- [Graphical examples](docs/GRAPHICAL_EXAMPLES.md): Browser, GV, IV, CV, SV, GRV and both FV forms.
- [Architecture comparison](docs/ARCHITECTURE_COMPARISON.md): AUTOSAR Classic/Adaptive, UML, SysML and AADL.
- [Grammar](src/language/swaml.langium) and [tool integration](docs/TOOLING.md): reusable Langium core for a separately implemented VS Code extension.
- [Implementation status](docs/IMPLEMENTATION_STATUS.md) and [migration](docs/MIGRATION_1_1.md): precise scope and version changes.

## Canonical graphical notation

The [concept catalog](docs/GRAPHICAL_CATALOG.md) pairs each graphical concept with its SWAML textual notation and constraints, organized by concern and indexed by term. Download original [SVG and PNG assets](docs/notation/), or read the drawings in the full specification. The [coverage inventory](spec/notation.json) explicitly accounts for every grammar rule and keyword, including terms represented only as labels or text.

The presentation follows the concept/graphical/textual organization reviewed in the [official SysML v2 specification](docs/SYSML_STYLE_REVIEW.md), using SWAML-specific drawings and semantics. [Worked diagrams](docs/GRAPHICAL_EXAMPLES.md) cover all view families.

## Compact syntax, explicit meaning

Reusable types retain `def`. A top-level component usage is the runnable root, and operations own their states directly. Files begin with packages; select the pinned SWAML 1.1 parser through your tool or the CLI's `--language-version 1.1` option. The grammar removes the `swaml`, `system`, `machine`, `set`, `compute`, `array` and `enumValue` markers. See the [1.1 migration](docs/MIGRATION_1_1.md) before loading older models.

```swaml
package CounterExample {
    unit def Counter {
        var value: Int = 0;
        operation increment() on start { value = value + 1; }
    }
    component demo { unit counter: Counter; }
}
```

`component def Assembly { ... }` defines a reusable composition. `component demo: Assembly;` creates a named root from it. All exchange between distinct unit/component occurrences still requires typed ports and explicit connections.

## The model

```mermaid
flowchart TB
    C[Root component usage] --> N[Nested component usage]
    N --> U[Unit instance]
    C --> U[Unit instance]
    U --> O[Operation]
    O --> F[Control flow or owned states]
    U --> P[Typed port]
    P --> I[Interface contract]
    U --> FN[Pure function]
```

Components compose units and components. Units own data, operations and pure functions. Operations own their control flow or states directly. There are no performers or separate action allocations.

Every exchange between units or components crosses typed ports and an explicit connector. Interfaces support sender–receiver data, client–server operations, publish–subscribe events, and combined services. An event has an interface declaration, an emitting operation and a receiving operation or state transition. There is no global event bus hidden in the syntax.

## Parse, validate and simulate

Requires Node.js 22+ and npm 10.2.3+.

```sh
npm ci
npm run check
node out/src/cli/main.js examples/03-service-pubsub.swaml
node out/src/cli/simulate.js Commerce::Shop examples/simulation/03-service-pubsub.json examples/03-service-pubsub.swaml
```

`npm run check` generates the parser, typechecks the TypeScript, runs semantic, simulator and language-server tests, validates and simulates every example, checks documentation and keyword coverage, and verifies the complete grammar mapping inventory and graphical subjects. The CLI exits 0 for accepted models, 1 for validation errors, and 2 for invocation or I/O errors. Supply all related files together when a model imports another package.

## Models

| Example | What it demonstrates |
| --- | --- |
| [Hello](examples/01-hello.swaml) | Smallest complete exchange and composition |
| [Realtime controller](examples/02-realtime-controller.swaml) | Sampled data, periodic execution, WCET/deadline contracts, MCU deployment |
| [Services and pub/sub](examples/03-service-pubsub.swaml) | Client/server, service events, separate audit subscription, delegation, sequence case |
| [Stateful operation](examples/04-stateful-operation.swaml) | States inside an operation, port-bound triggers, timeouts, lifecycle |
| [Values and flow](examples/05-values-and-flow.swaml) | Records, enums, fixed arrays, functions, local calls, bounded loops |
| [Mixed gateway](examples/06-mixed-gateway.swaml) | Explicit conversion between sampled embedded data and service events |
| [Client–server](examples/07-client-server.swaml) | Standalone RPC, idempotent query, timeout and correlated reply |
| [Service field](examples/08-service-field.swaml) | Explicit getter/setter/event, multiple consumers, reentrant snapshot query |
| [Component roots](examples/09-component-roots.swaml) | Reusable definitions, typed roots, realtime deployment bindings and inline roots with direct unit children |
| [Invalid models](examples/invalid/README.md) | Rejected attempts to bypass an interface |

## Repository layout

```text
docs/                 Specification, guides, notation catalog, research, decisions
docs/notation/        Canonical SVG, PNG and vector-scene assets
src/language/         Grammar, scoping, validation and generated AST (build output)
src/cli/              Headless validation and simulation
src/simulation/       Portable logical-time reference interpreter
src/server/           Language Server Protocol entry point
examples/             Valid/invalid models, simulation options and trace evidence
spec/                 Mapping, keyword and graphical-source inventories
scripts/              Reference/figure/PDF builders and consistency checks
syntax/               Generated TextMate grammar (build output)
test/                 Static, behavioral, CLI and LSP integration tests
```

The simulator implements a documented deterministic logical-time profile. Passing a bounded run does not prove physical realtime schedulability or safety across every possible schedule. KerML serialization, platform export and graphical editing have defined language-side contracts and need their own backends. The actual VS Code extension is implemented elsewhere; this repository owns the language.

Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md). Coding agents follow [AGENTS.md](AGENTS.md). Original code and documentation use the existing [MIT license](LICENSE); referenced standards retain their own terms.
