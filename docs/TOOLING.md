# Langium setup and VS Code integration

## Package contract

The current package is a reusable language core. It is marked `private` to prevent accidental npm publication. The existing `voidaliot/swaml-vsc-ext` repository can consume a reviewed version through a local workspace dependency or a future published package; that repository has not been modified by this setup.

This edition parses headerless **SWAML 1.1** only. The extension must pin its language-core dependency and identify 1.1 in project/workspace settings before source loading; these settings belong to the host, not to an undocumented model grammar. The repository CLI is itself pinned to 1.1. Unsupported requested editions must be rejected explicitly; a host must never silently upgrade models to the latest parser. Read the [migration guide](MIGRATION_1_1.md) before consuming this incompatible source update.

The source of concrete syntax is [swaml.langium](../src/language/swaml.langium). Langium generates AST types, grammar metadata, reflection and TextMate syntax. Generated files and `out/` are ignored; rebuild them after checkout.

The implementation follows Langium's grammar → generated AST → references → validation workflow. [Langium grammar reference](https://langium.org/docs/reference/grammar-language/), [reference-resolution guide](https://langium.org/docs/learn/workflow/resolve_cross_references/).

## Reproducible commands

```sh
npm ci
npm run build
npm test
npm run validate:examples
npm run check
node out/src/cli/main.js examples/01-hello.swaml
node out/src/server/main.js --stdio
```

Node 22 and 24 are the CI targets; Node 22+ is required. Dependencies are pinned in `package-lock.json`. `npm run build` regenerates the grammar before compiling. Never hand-edit generated files.

The package exports `createSwamlServices` from `out/src/language/swaml-module.js`, and AST declarations from `out/src/language/generated/ast.js`. Example usage after a build:

```ts
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from './out/src/language/swaml-module.js';

const { Swaml } = createSwamlServices(EmptyFileSystem);
const parse = parseHelper(Swaml);
const document = await parse(source, { validation: true });
console.log(document.diagnostics);
```

For multiple files, create all documents first and build them together so that imported declarations are available. CLI arguments are the complete loaded workspace. Definitions in unloaded files cannot resolve.

## Services and source ownership

| File | Responsibility |
| --- | --- |
| [swaml-module.ts](../src/language/swaml-module.ts) | Dependency injection and registration |
| [swaml-document-builder.ts](../src/language/swaml-document-builder.ts) | Conservative workspace revalidation for paths and negative lookups |
| [swaml-scope.ts](../src/language/swaml-scope.ts) | Local-owner scopes, imported/qualified declarations, ambiguity |
| [semantic.ts](../src/language/semantic.ts) | Instance/port/member paths, type identities, time conversion |
| [swaml-validator.ts](../src/language/swaml-validator.ts) | Model invariants and typed behavior validation |
| [CLI](../src/cli/main.ts) | File loading, diagnostics, exit status |
| [LSP server](../src/server/main.ts) | Standard language-server transport and startup |

Cross-references use Langium references for declarations, functions, local operations, states and nodes. Composite endpoint/value/view paths are strings with explicit SWAML resolution. This keeps encapsulation checks explicit, but **generic rename/find-references/navigation does not cover those strings**. The extension must supply those providers before advertising full refactoring.

The current scope provider scans loaded documents for clarity. Every changed/added/deleted document conservatively relinks and revalidates all loaded SWAML models, including string paths and previously absent declarations. This favors correct editor diagnostics over incremental performance. Large-model dependency indexing and cancellation-aware expensive checks remain optimization work. The validator skips semantic checks after parser/lexer errors; built-in diagnostics still report malformed input.

## Desktop extension scaffold contract

The extension manifest should register:

```json
{
  "activationEvents": ["onLanguage:swaml"],
  "contributes": {
    "languages": [{ "id": "swaml", "aliases": ["SWAML"], "extensions": [".swaml"], "configuration": "./language-configuration.json" }],
    "grammars": [{ "language": "swaml", "scopeName": "source.swaml", "path": "./syntaxes/swaml.tmLanguage.json" }]
  }
}
```

This is a contribution fragment, not a complete publishable `package.json`. Supply the extension's own name, publisher, version, VS Code engine, entry point and client dependency. Copy the generated TextMate file from this package's `syntax/` after building.

Use a `vscode-languageclient` client compatible with the selected `vscode-languageserver` version. Launch a bundled `src/server/main.ts` Node target with IPC or stdio. For example, the server entry already accepts `--stdio`; the host should not send logs on stdout. Diagnostics must be presented in Problems and linked to source ranges.

A language-configuration file can declare `//`, `/* */`, bracket pairs `{}`, `[]`, `()`, and matching quotes. Do not use semantic indentation that changes SWAML meaning.

Suggested host commands: `swaml.validateWorkspace`, `swaml.openBrowser`, `swaml.showView`, `swaml.openDeclaration`, `swaml.restartLanguageServer`. These are proposed command IDs; this repository does not register them in VS Code.

## Browser extension path

The reusable grammar/validator should remain independent of Node filesystem APIs. The server and CLI import `NodeFileSystem`; the language core does not. A browser host can create services with an in-memory/browser filesystem, bundle a web-worker language server, and supply model documents through LSP. The current Node server is not a browser-worker bundle, so a web extension needs a separate entry point and transport integration.

Test browser dependency bundling and import resolution explicitly. Do not carry the CLI's filesystem assumptions into `vscode.dev` or `github.dev`.

## Graphical architecture

Implement a semantic projection layer between Langium and diagrams. It should produce stable node/edge IDs, instance-aware paths, source ranges, declaration references, roles, signatures, diagnostics and presentation kinds. View renderers consume that projection, never parse source text independently.

All edits go through a source-edit service. Layout-only edits update a presentation sidecar. Semantic edits update `.swaml`, then parse/link/validate. Reject silent creation of unmodeled exchanges. [Graphical contract](GRAPHICAL_NOTATION.md).

## Kernel backend boundary

Build a separate normalized model from the linked/validated authoring AST, then lower through a versioned SWAML semantic library onto KerML. Keep kernel IDs and authoring IDs traceable. The [mapping chapter](spec/05-kerml-mapping.md) defines obligations; the JSON inventory is design metadata, not serialized KerML.

## Validation and release gates

Before an extension consumes a new language-core version, run `npm ci && npm run check`, inspect the spec/grammar changes and update versioned fixtures. A grammar change, even if additive, can reserve an identifier previously used in source. Release notes must explain migration.

Tests cover valid fixtures, illegal interface access, scoping, type errors, QoS, state/timing rules and the LSP transport lifecycle. Broader conformance claims require the additional tests in [implementation status](IMPLEMENTATION_STATUS.md).

## Simulation API for a separate host

After linking and validating every referenced document, call `simulate(models, "Package::Root", options)` from the package's `./simulation` export. It has no Node filesystem dependency. The host supplies a finite horizon and may supply manual releases, transport fault schedule and resource limits. The [profile contract](SIMULATION.md) defines the exact scheduler, observability and limits. The CLI adapter adds file loading and SHA-256 source digests.

Present `outcome` and `status` together: a run can quiesce after a failed activation, and a bounded horizon is not a proof of liveness. A future extension can connect trace source lines and occurrence paths to FV/IV/GRV selections. That UI belongs in the extension repository; it must not introduce an independent runtime meaning or bypass validation.
