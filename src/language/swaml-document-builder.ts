import { DefaultDocumentBuilder, type LangiumDocument, type AstNode, type BuildOptions } from 'langium';
import type { CancellationToken } from 'vscode-languageserver';
import { isModel } from './generated/ast.js';
/** Semantic string paths and negative lookups participate in workspace invalidation. */
export class SwamlDocumentBuilder extends DefaultDocumentBuilder {
    override async build<T extends AstNode>(documents: LangiumDocument<T>[], options?: BuildOptions, cancelToken?: CancellationToken): Promise<void> {
        const libraries = this.langiumDocuments.all.filter(d => d.uri.scheme === 'builtin' && !documents.some(x => x === d)).toArray();
        await super.build<AstNode>([...documents, ...libraries], options, cancelToken);
    }
    protected override shouldRelink(document: LangiumDocument, changedUris: Set<string>): boolean { return changedUris.size > 0 && isModel(document.parseResult.value) || super.shouldRelink(document, changedUris); }
}
