# swa.ml 3.0

**Software Architecture Modeling Language.** Readable source for software structure, typed communication and executable behavior.

**swa.ml 3.0** (19 November 2026) is a major edition: states are steps of the flow (`state s { … }` with `on entry`, event lines, `exit;` and `to S;`, parent states and periodic machines released `on every P`), `if` is the one word for conditions, and 3.0 adds places, the whole-expression conditional, contextual words, association lists, the `Swaml::Numeric`, `Swaml::Text`, `Swaml::Time` and `Swaml::Os` libraries, durations as values, sampled reads, member policies, release guards and task placement ([3.0 release notes](docs/RELEASE_3_0.md)). Valid 2.2 models without a state machine keep their meaning; `swaml migrate` rewrites 2.2 state machines ([migration guide](docs/MIGRATION_3_0.md)). The current host selects 3.0 (`--language-version 3.0`, implementation 4.0.0); the published 2.2 host is implementation 3.1.0.

The previous edition, swa.ml 2.2, used the concrete syntax of 2.1 and added normal primary-subject calls in both use cases and tests, plus explicit associated-component access for tests; see the [2.2 release notes](docs/RELEASE_2_2.md) and [complete 2.2 reference](docs/SWAML-2.2-Reference.md). swa.ml 3.0 retains one component concept, one operation concept and the package execution context. Hosts select an edition and an exact implementation revision. All published books, PDFs, manifests, checksums and figures retain their original bytes. See the [3.0 release notes](docs/RELEASE_3_0.md) and [complete 3.0 reference](docs/SWAML-3.0-Reference.md).

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

Components own private attributes, typed ports, child occurrences and operations. Directed members connect structurally through explicit routes. Schedules activate operations; suspension releases serial locks; try catches expression failures without rollback. Multiplicity retains separate state. Use cases and tests are package members whose scripts act through interface-only actors and run with swaml test; requirement links record intent and seven library views project existing identities.

Read the [normative specification](docs/LANGUAGE_SPECIFICATION.md), [ADR 0016](docs/decisions/0016-swaml-2-0.md), [ADR 0019](docs/decisions/0019-package-context.md), [support matrix](docs/IMPLEMENTATION_STATUS.md), [graphical catalog](docs/GRAPHICAL_CATALOG.md) and [contribution rules](CONTRIBUTING.md). A bounded reference run does not prove production scheduling, universal verification or KerML conformance.

The production website presents validated source views and bounded reference evidence. The 3.0 release includes the [complete PDF](output/pdf/SWAML-3.0-Specification.pdf), [source manifest](output/pdf/SWAML-3.0-Specification.manifest.json) and [checksum](output/pdf/SWAML-3.0-Specification.sha256); the 2.2 release keeps its [PDF](output/pdf/SWAML-2.2-Specification.pdf), [manifest](output/pdf/SWAML-2.2-Specification.manifest.json) and [checksum](output/pdf/SWAML-2.2-Specification.sha256). See the historical [2.1 release notes](docs/RELEASE_2_1.md), with the migration from 2.0, the [frozen 2.1 reference](docs/SWAML-2.1-Reference.md) and the [complete 2.1 PDF](output/pdf/SWAML-2.1-Specification.pdf) with its [manifest](output/pdf/SWAML-2.1-Specification.manifest.json) and [checksum](output/pdf/SWAML-2.1-Specification.sha256). The published 2.0 edition keeps its [release notes](docs/RELEASE_2_0_0.md) and [complete PDF](output/pdf/SWAML-2.0.0-Specification.pdf). The standard uses major.minor versions; the existing v2.0.0 tag and download filenames identify the original 2.0 publication, and new editions use X.Y names such as v2.1. See the [version policy](docs/VERSIONING.md). License: [MIT](LICENSE).
