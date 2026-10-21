# SWAML 2.0 site

The GitHub Pages source is a static React/TypeScript site with monochrome light/dark/system themes, console-inspired typography, a source inspector and Browser plus seven model views. It is a clean replacement of the 1.x showcase. Historical source is retained under history/1.x for reference and is excluded from the build.

The controller model is validated and projected by scripts/build-showcase-data.mjs. Generated site data retains source hash, directed member/occurrence identities, schedules, case steps and a bounded swaml-reference/2.0 trace. Downloads are copied from current maintained source/guides/skills during the build. Diagrams do not edit semantic source and no production or kernel conformance claim is implied.

From the repository root:

```sh
npm ci
npm run build
npm ci --prefix showcase
npm run build --prefix showcase
npm run dev --prefix showcase -- --port 5188 --strictPort
```

Review the printed local URL, all seven tabs, source/copy/download controls, keyboard navigation, both explicit themes/system selection and narrow layouts. Relative Vite assets support GitHub Pages subpaths and local preview. No account or server backend is required by the built site.

Publication requires owner design approval. The Pages workflow builds pull requests and deploys only on an explicit dispatch from the default branch. Local preview and source changes do not publish it. See docs/design/2.0/REVIEW.md and docs/PDF_PUBLICATION.md in the repository.
