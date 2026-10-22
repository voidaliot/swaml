# SWAML 2.0

**Software Architecture Modeling Language.** Readable source for software structure, typed communication and executable behavior.

SWAML 2.0.0 is a clean restart with one component concept and one operation concept. It accepts only 2.0 source. Published 1.x books/PDFs remain archived.

```swaml
package CounterReadme {
  component Demo {
    attribute count: int = 0;
    operation increment() { count = count + 1; }
    schedule { on every 10ms increment(); }
  }
}
```

Start with the [usage guide](docs/USER_GUIDE.md), [quick start](docs/QUICK_START.md), [examples](examples/) and [AI authoring guide](docs/AI_GUIDE.md). Portable [authoring](skills/swaml-author/SKILL.md) and [validation](skills/swaml-validate/SKILL.md) skills ship with the source.

```sh
npm ci
npm run check
node out/src/cli/main.js --json examples/01-hello.swaml
node out/src/cli/simulate.js Hello::Demo examples/simulation/01-hello.json examples/01-hello.swaml
```

Components own private attributes, typed ports, child occurrences and operations. Directed members connect structurally through explicit routes. Schedules activate operations; suspension releases serial locks; try catches expression failures without rollback. Multiplicity retains separate state. Requirements/cases record intent and seven library views project existing identities.

Read the [normative specification](docs/LANGUAGE_SPECIFICATION.md), [ADR 0016](docs/decisions/0016-swaml-2-0.md), [support matrix](docs/IMPLEMENTATION_STATUS.md), [graphical catalog](docs/GRAPHICAL_CATALOG.md) and [contribution rules](CONTRIBUTING.md). A bounded reference run does not prove production scheduling, universal verification or KerML conformance.

The production website presents validated source views and bounded reference evidence. See the [2.0.0 release notes](docs/RELEASE_2_0_0.md) and [complete PDF](output/pdf/SWAML-2.0.0-Specification.pdf). License: [MIT](LICENSE).
