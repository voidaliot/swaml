import { AstUtils, DefaultDocumentBuilder, DefaultDocumentValidator, DocumentState, type LangiumDocument, type AstNode, type BuildOptions, type LinkingError, type LangiumSharedCoreServices, type ValidationOptions } from 'langium';
import type { CancellationToken, Diagnostic } from 'vscode-languageserver';
import { isModel, isPackage, type Model, type Package } from './generated/ast.js';
import { LIBRARY_2_3_URI, isLibraryCopyDocument } from './semantic.js';
import { MESSAGE_SPELLING, formatQualifiedName } from './names.js';
import { BRACKET_NESTING_CLAUSE } from './swaml-syntax.js';
/** The packages of each built-in document as loaded, before any is hidden. */
const loadedPackages = new WeakMap<Model, Package[]>();
/**
 * WP3-L04: a workspace that declares a package named like a 2.3 library package (Swaml::Numeric, Swaml::Text,
 * Swaml::Time) uses its own; the library package is not available there. The built-in 2.3 document then lists
 * only its other packages, so scope, linking, resolution, validation and runs see exactly the 2.2 workspace.
 * A byte-equal copy of a built-in library is not a user package and hides nothing (it is a duplicate, as a copy of
 * the 2.2 library is). Hiding is workspace-global, as package resolution and duplicate detection are, and a
 * shadowing package cannot reach the library operations. Recomputed on every update (deletions included) and
 * every build before linking; returns the built-in documents whose visible packages changed.
 */
export function hideShadowedLibraryPackages(documents: Iterable<LangiumDocument>): LangiumDocument[] {
    const all = [...documents], own = new Set<string>(), changed: LangiumDocument[] = [];
    for (const d of all)
        if (d.uri.scheme !== 'builtin' && isModel(d.parseResult.value) && !isLibraryCopyDocument(d))
            for (const p of d.parseResult.value.packages)
                own.add(p.name);
    for (const d of all) {
        const model = d.parseResult.value;
        if (d.uri.toString() !== LIBRARY_2_3_URI || !isModel(model))
            continue;
        const loaded = loadedPackages.get(model) ?? loadedPackages.set(model, [...model.packages]).get(model)!;
        const visible = loaded.filter(p => !own.has(p.name));
        if (visible.length === model.packages.length && visible.every((p, i) => model.packages[i] === p))
            continue;
        model.packages.splice(0, model.packages.length, ...visible);
        // Keep node paths (the AST node locator reads $containerIndex) consistent with the visible list.
        visible.forEach((p, i) => (p as { $containerIndex?: number }).$containerIndex = i);
        changed.push(d);
    }
    return changed;
}
/** Semantic string paths and negative lookups participate in workspace invalidation. */
export class SwamlDocumentBuilder extends DefaultDocumentBuilder {
    constructor(services: LangiumSharedCoreServices) {
        super(services);
        // On update (a deletion-only update passes no document through a build phase) and again after indexing,
        // when changed documents hold their new parse. A change re-indexes the built-in document's exports.
        const hide = async () => {
            for (const library of hideShadowedLibraryPackages(this.langiumDocuments.all))
                await this.indexManager.updateContent(library);
        };
        this.onUpdate(hide);
        this.onBuildPhase(DocumentState.IndexedContent, hide);
    }
    override async build<T extends AstNode>(documents: LangiumDocument<T>[], options?: BuildOptions, cancelToken?: CancellationToken): Promise<void> {
        const libraries = this.langiumDocuments.all.filter(d => d.uri.scheme === 'builtin' && !documents.some(x => x === d)).toArray();
        await super.build<AstNode>([...documents, ...libraries], options, cancelToken);
    }
    protected override shouldRelink(document: LangiumDocument, changedUris: Set<string>): boolean { return changedUris.size > 0 && isModel(document.parseResult.value) || super.shouldRelink(document, changedUris); }
}
/** 2.2 state-machine syntax: initial S; in an operation, final state, or a transition when (g) to T (a release guard written with when keeps its own hint). */
const LEGACY_MACHINE = /\binitial\s+[A-Za-z_'][^;{}\n]*;|\bfinal\s+state\b|\bwhen\s*\([^;{}]*\)\s*to\b/;
export const LEGACY_MACHINE_MESSAGE = 'This is swa.ml 2.2 state-machine syntax (initial S;, final state, ordered transitions with when and to T { … }), which 2.3 replaces by states that are steps of the flow; node scripts/migrate-machines.mjs <file> --write rewrites it.';
/** The portable service supplies the same stable diagnostics to CLI and LSP hosts. */
export class SwamlDocumentValidator extends DefaultDocumentValidator {
    /** An ambiguous short name also points at each declaration that shares it. */
    protected override processLinkingErrors(document: LangiumDocument, diagnostics: Diagnostic[], options: ValidationOptions): void {
        const start = diagnostics.length;
        super.processLinkingErrors(document, diagnostics, options);
        const errors = document.references.map(r => r.error as (LinkingError & { declarations?: AstNode[] }) | undefined).filter(e => !!e);
        errors.forEach((error, i) => {
            const d = diagnostics[start + i];
            if (d && error.declarations)
                d.relatedInformation = error.declarations.filter(n => n.$cstNode).map(n => ({ location: { uri: AstUtils.getDocument(n).uri.toString(), range: n.$cstNode!.range }, message: 'Declaration ' + formatQualifiedName((AstUtils.getContainerOfType(n, isPackage)?.name ?? '') + '::' + (n as AstNode & { name: string }).name, MESSAGE_SPELLING) }));
        });
    }
    override async validateDocument(document: LangiumDocument, options?: ValidationOptions, cancelToken?: CancellationToken): Promise<Diagnostic[]> {
        let diagnostics = await super.validateDocument(document, options, cancelToken);
        // A 2.2 state machine (initial S;, final state, transitions with when) is a syntax error in 2.3: one error that says
        // so and names the migration replaces the parser's errors (review 1 D-1).
        const machine = document.parseResult.parserErrors.length ? LEGACY_MACHINE.exec(document.textDocument.getText()) : null;
        if (machine) {
            const start = document.textDocument.positionAt(machine.index), end = document.textDocument.positionAt(machine.index + machine[0].length);
            diagnostics = [{ severity: 1, range: { start, end }, message: LEGACY_MACHINE_MESSAGE, data: { code: 'parsing-error' }, source: 'swaml' } as Diagnostic, ...diagnostics.filter(d => d.data?.code !== 'parsing-error')];
        }
        return diagnostics.map(d => {
            if (d.code !== undefined)
                return d;
            const code = d.data?.code === 'linking-error' ? 'SW2001'
                : d.data?.code === 'lexing-error' && String(d.message).startsWith(BRACKET_NESTING_CLAUSE) ? 'SW2013'
                : ['lexing-error', 'parsing-error'].includes(d.data?.code) ? 'SW2000' : undefined;
            return code ? { ...d, code } : d;
        });
    }
}
