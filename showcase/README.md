# SWAML interactive showcase

A static React + TypeScript site with React Flow diagrams, ready to build for GitHub Pages. The main page has two explorers: the language ontology and a gallery of diagram kinds. Source, properties and advanced display controls appear on demand. Every graphic is flat. No server, account or environment secret is required.

The gallery presents structure, connections, sequence, cases and requirements, grid, function flow, states, interrupts and timing. The last four are FV presentations. The model browser remains available from the diagram toolbar. Example headings and source downloads follow the selected model.

The Learn section opens the quick guide, end-to-end walkthrough, four domain architectures, requirements and verification example, and communication reference when requested. These longer examples are not stacked into the initial page. Existing `#explorer`, `#traceability`, `#modeling-overview`, `#architectures`, `#interfaces` and `#quick-start` links remain supported; individual diagrams can be linked with `#diagrams/timing` or another gallery ID.

## Run locally

Use Node.js 22.12+ and npm:

```sh
cd showcase
npm ci
npm run dev
```

Open the printed local URL. To check and build the production site:

```sh
npm run build
npm run preview
```

The production output is `showcase/dist/` (ignored). The repository Pages workflow builds and uploads this directory. Vite uses `base: './'`, so assets work at a repository path such as `https://voidaliot.github.io/swaml/`, at a custom domain, and in local preview. There is no history router or route fallback requirement. The workflow must be enabled in the repository's GitHub Pages settings before a deployment can be made.

## Explore the model

Start with **Overview** (`#modeling-overview`). **What can I model?** presents a graphical ontology of ownership and references. **Use case to structure** follows the WebShop example through five selectable stages: intent, case exchanges, the checkout function's flow, component-owned functions, and the final software structure. Select a node or relationship to inspect its meaning and model identity. Where applicable, expand the exact relevant source. The element picker provides a keyboard alternative to selecting directly in the graph; React Flow supplies pan, zoom and fit controls. Diagrams use fixed readable layouts while selection changes the inspector. Narrow screens retain readable graph text in a horizontally scrollable region, with zoom and fit controls kept in view.

All five stages describe [13-web-application.swaml](../examples/13-web-application.swaml). The buyer's goal is explanatory narrative; `ReserveBeforeAccept` and `Purchase` are the corresponding requirement and route-valid case. Production claims satisfaction and CheckPurchase describes verification intent; functions own executable behavior. The sequence represents publication and message dependencies, rather than a timeline of handler completion. The [visual guide](../docs/MODELING_OVERVIEW.md) includes the same figures.

Continue to **Quick start** for authoring. Select a step to see contract, function, composition and validation excerpts; open or copy the complete `hello.swaml` model. The complete source is imported from the executable code fence in [QUICK_START.md](../docs/QUICK_START.md), so documentation validation checks the same model shown on the site.

Select **Calculations and reuse** for the complete [specialization example](../examples/15-component-specialization.swaml): typed calculation inputs/results, inherited and redefined functions, specialized child components, separate instance stores and external deployment references.

The **Examples** section provides four independent, interactive architecture diagrams:

| Domain | Source / root |
| --- | --- |
| AUTOSAR Classic climate SW-C | [11-autosar-classic.swaml](../examples/11-autosar-classic.swaml), `ClassicClimate::Vehicle` |
| AUTOSAR Adaptive diagnostic application | [12-autosar-adaptive.swaml](../examples/12-autosar-adaptive.swaml), `AdaptiveDiagnostics::Vehicle` |
| Service-based web shop | [13-web-application.swaml](../examples/13-web-application.swaml), `WebShop::Production` |
| Cloud telemetry service | [14-cloud-service.swaml](../examples/14-cloud-service.swaml), `CloudTelemetry::Production` |

Select an instance for its definition, allocation and connected routes. Select a connector for the exact interface, roles, connector declaration and selected QoS policy. Move nodes, fit or reset the diagram, inspect complete source and download the model. These are logical architecture models; [Architecture patterns](../docs/ARCHITECTURE_PATTERNS.md) explains the platform mappings.

The main fixture is [`examples/08-service-field.swaml`](../examples/08-service-field.swaml), imported as raw source at build time. The `Settings::Cabin` root contains `settings : Service`, `front : Client` and `rear : Client`. The `LocalLink` QoS definition supplies policy values for two independent service routes. The Browser and Grid expose that definition and each connector's effective policy.

| Surface | Example projection |
| --- | --- |
| Browser | Filter a curated ownership inventory; distinguish definitions from instances. |
| gv | Expand Cabin ownership to the three component instances and their separate private stores. |
| iv | Inspect `front.setting → settings.api` and `rear.setting → settings.api`, their contracts, policy and boundary delegation. |
| cv | See Change's root context and Cabin's satisfy link to VisibleSetting, with evidence explicitly absent. |
| sv | Read Change's dependencies; the two notifications are independent after adjust and accepted follows frontNotice. |
| grv | Filter and sort identity-aware rows; inspect each element's owner, contract, allocation or policy. |
| fv | Follow the local `SettingStore.update` function, including range rejection, private assignment, publication and bool result. |

The fv **States** toggle explicitly switches to the separate [`examples/04-stateful-function.swaml`](../examples/04-stateful-function.swaml) fixture and its `Lifecycle::Device.lifecycle` function. It shows directly owned Idle/Running/Stopped states, receive/timer transitions and the final state. Its source dialog and download switch with it.

Select nodes, routes, rows or browser entries to inspect properties. Drag nodes to adjust layout, pan/zoom with React Flow controls, and reset the layout. The complete bundled fixture can be inspected, copied and downloaded. Keyboard users can navigate view buttons, select graph nodes, use zoom/fit controls, and inspect table/browser rows. Narrow screens use horizontal perspective navigation and put Properties below the canvas. Reduced motion is respected.

## Implementation boundary

This is a curated semantic showcase with local layout interactions. Source is imported from repository fixtures; projection metadata is maintained in [`src/model.ts`](src/model.ts), [`src/contracts.json`](src/contracts.json), [`src/architectures.json`](src/architectures.json) and the shared [`spec/modeling-overview.json`](../spec/modeling-overview.json). It must stay synchronized when those fixtures change. The repository's normal language gate validates the fixtures and metadata; the showcase build typechecks the presentation code.

The source text is not editable in the browser. Layout changes are temporary and never write to the model or repository. Case exchanges describe intent and dependency, not an observed execution. Deployment labels make no schedulability claim. State and flow steps stay owned by their functions. See the language [implementation matrix](../docs/IMPLEMENTATION_STATUS.md) and [graphical contract](../docs/GRAPHICAL_NOTATION.md).

React Flow attribution remains visible. Typography uses local system fonts; all diagrams and icon geometry are original SVG/CSS in the repository. The code retains the repository's MIT license.

## Interface reference

The formal contract reference includes queued data, sampled data, request/response, publication and combined service patterns from five validated source fixtures. Select a pattern, inspect either endpoint, and expand the complete source. Contract and connector text is extracted from the bundled repository source. `src/contracts.json` selects actual model subjects; `node scripts/check-showcase.mjs` (from the repository root after a language build) validates kinds, roles, endpoints and effective policies. All four interface kinds are covered.

The [UML transition guide](../docs/UML_GUIDE.md) explains conceptual correspondences and deliberate differences. This is a curated presentation; neither a UML importer nor a graphical source editor is implemented.

## Traceability explorer

The Traceability section offers diagram/table switching, formal doc compartments, ordinary comment notes and three authored views. Its metadata in [spec/traceability-demo.json](../spec/traceability-demo.json) is generated from [the complete model](../examples/16-requirements-and-views.swaml) by `node scripts/build-traceability-demo.mjs` after the language build. The normal gate checks it byte-for-byte against the parser and selection evaluator. The requirement table preserves attribute types and formal documentation. Filtering preserves separate instance paths.

## Extended function views

FV offers Flow, States, Timing and Interrupts. Timing presents the generated `spec/function-timing-demo.json` projection of four reproducible runs of example17, with occurrence/activation identity, source inspection, declared limits, observed phases and open horizon/stop intervals. Regenerate with `node scripts/build-timing-demo.mjs` after the language build. Interrupts presents the protected region, typed control.stop route, handler and continuation from example19; source checks verify the actual region and contracts. These modes inspect source and evidence; they do not edit the language or establish physical scheduling results.
