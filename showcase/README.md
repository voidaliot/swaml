# swa.ml site

The GitHub Pages source is a static React/TypeScript site for software architects evaluating executable software models. It introduces component ownership, typed communication and operation activation, then connects the inspected source to a bounded reference trace and reproducible CLI commands. The restrained document layout uses sans-serif prose, monospace source, light/dark/system appearance and the inner swa.ml symbol derived from [aliot.dev](https://aliot.dev/assets/swaml-star.svg). The symbol has a transparent background, appears black in light mode and white in dark mode, and the favicon follows the selected appearance. The two favicon assets are public/swaml.svg and public/swaml-white.svg. Historical 1.x source is retained under history/1.x for reference and is excluded from the build.

The controller model is validated and projected by scripts/build-showcase-data.mjs. Generated site data retains source hash, directed member/occurrence identities, schedules, cases with their subjects, actors and requirement links, and a bounded reference trace of the current profile. The Execution section adds states as steps of the flow from examples/54-interior-light.swaml and the run of one of its tests. The Browser and seven views inspect this precomputed model; the page does not run or edit source. Downloads are current-edition sources only: the two example models, the mixed-port figure, the 29 ms run options and both run JSON files with their source fingerprints. Guides are read on the specification pages; skills link to the edition tag. scripts/check-showcase.mjs rejects another edition number on the front page and any code excerpt that is not taken from an example validated by the examples gate. Production deployment, physical timing and general verification are outside this demonstration.

From the repository root:

```sh
npm ci
npm run build
npm ci --prefix showcase
npm run build --prefix showcase
npm run dev --prefix showcase -- --port 5188 --strictPort
```

The specification reader under spec/ is generated at prebuild time by showcase/scripts/build-spec.mjs from the Markdown, grammar, models and license listed in the published PDF manifest of the edition, in the order of the book; it is not committed. scripts/check-site-spec.mjs (called by scripts/check-site-artifact.mjs) checks its sources, links, anchors, escapes and files. Preview it with `npm run preview --prefix showcase` and open /spec/.

Review the printed local URL, all seven tabs, source/copy/download controls, keyboard navigation, both explicit themes/system selection and narrow layouts. Relative Vite assets support GitHub Pages subpaths and local preview. No account or server backend is required by the built site.

Publication requires owner design approval. The Pages workflow builds pull requests and deploys only on an explicit dispatch from the default branch. Local preview and source changes do not publish it. See docs/design/2.0/REVIEW.md and docs/PDF_PUBLICATION.md in the repository.
