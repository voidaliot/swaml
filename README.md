# swa.ml 2.2

**Software Architecture Modeling Language.** Readable source for software structure, typed communication and executable behavior.

swa.ml 2.2 is the current published edition; the repository prepares the unreleased 2.3 candidate, which so far accepts the 2.2 language plus work packages WP1, places such as `statuses[i].confirmed = true;`, member access after an index and literal component indexes in test paths, and WP2, the whole-expression conditional `if (c) a else b`, `view`, `state`, `in` and `out` as contextual words and association lists such as `associate truck, van to 'Monitor', 'Command';`, and WP3, the library packages `Swaml::Numeric` (with `sqrt`), `Swaml::Text` (`intText`, `realText`, `boolText`) and `Swaml::Time` (`now()`) ([2.3 release draft](docs/RELEASE_2_3.md)). The current host selects 2.3 (`--language-version 2.3`); the published 2.2 host is implementation 3.1.0.

swa.ml 2.2 uses the same concrete syntax as 2.1 and adds normal primary-subject calls in both use cases and tests, plus explicit associated-component access for tests. It retains one component concept, one operation concept and the package execution context. Hosts select an edition and an exact implementation revision. All published books, PDFs, manifests, checksums and figures retain their original bytes. See the [2.2 release notes](docs/RELEASE_2_2.md) and [complete 2.2 reference](docs/SWAML-2.2-Reference.md).

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

The production website presents validated source views and bounded reference evidence. The 2.2 release includes the [complete PDF](output/pdf/SWAML-2.2-Specification.pdf), [source manifest](output/pdf/SWAML-2.2-Specification.manifest.json) and [checksum](output/pdf/SWAML-2.2-Specification.sha256). See the historical [2.1 release notes](docs/RELEASE_2_1.md), with the migration from 2.0, the [frozen 2.1 reference](docs/SWAML-2.1-Reference.md) and the [complete 2.1 PDF](output/pdf/SWAML-2.1-Specification.pdf) with its [manifest](output/pdf/SWAML-2.1-Specification.manifest.json) and [checksum](output/pdf/SWAML-2.1-Specification.sha256). The published 2.0 edition keeps its [release notes](docs/RELEASE_2_0_0.md) and [complete PDF](output/pdf/SWAML-2.0.0-Specification.pdf). The standard uses major.minor versions; the existing v2.0.0 tag and download filenames identify the original 2.0 publication, and new editions use X.Y names such as v2.1. See the [version policy](docs/VERSIONING.md). License: [MIT](LICENSE).
