import { AstUtils, DefaultDocumentBuilder, DefaultDocumentValidator, type LangiumDocument, type AstNode, type BuildOptions, type LinkingError, type ValidationOptions } from 'langium';
import type { CancellationToken, Diagnostic } from 'vscode-languageserver';
import { isModel, isPackage } from './generated/ast.js';
import { formatQualifiedName } from './names.js';
/** Semantic string paths and negative lookups participate in workspace invalidation. */
export class SwamlDocumentBuilder extends DefaultDocumentBuilder {
    override async build<T extends AstNode>(documents: LangiumDocument<T>[], options?: BuildOptions, cancelToken?: CancellationToken): Promise<void> {
        const libraries = this.langiumDocuments.all.filter(d => d.uri.scheme === 'builtin' && !documents.some(x => x === d)).toArray();
        await super.build<AstNode>([...documents, ...libraries], options, cancelToken);
    }
    protected override shouldRelink(document: LangiumDocument, changedUris: Set<string>): boolean { return changedUris.size > 0 && isModel(document.parseResult.value) || super.shouldRelink(document, changedUris); }
}
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
                d.relatedInformation = error.declarations.filter(n => n.$cstNode).map(n => ({ location: { uri: AstUtils.getDocument(n).uri.toString(), range: n.$cstNode!.range }, message: 'Declaration ' + formatQualifiedName((AstUtils.getContainerOfType(n, isPackage)?.name ?? '') + '::' + (n as AstNode & { name: string }).name) }));
        });
    }
    override async validateDocument(document: LangiumDocument, options?: ValidationOptions, cancelToken?: CancellationToken): Promise<Diagnostic[]> {
        const diagnostics = await super.validateDocument(document, options, cancelToken);
        return diagnostics.map(d => {
            if (d.code !== undefined)
                return d;
            const code = d.data?.code === 'linking-error' ? 'SW2001'
                : ['lexing-error', 'parsing-error'].includes(d.data?.code) ? 'SW2000' : undefined;
            return code ? { ...d, code } : d;
        });
    }
}
