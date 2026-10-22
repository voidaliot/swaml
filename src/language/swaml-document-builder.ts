import { DefaultDocumentBuilder, DefaultDocumentValidator, type LangiumDocument, type AstNode, type BuildOptions, type ValidationOptions } from 'langium';
import type { CancellationToken, Diagnostic } from 'vscode-languageserver';
import { isModel } from './generated/ast.js';
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
