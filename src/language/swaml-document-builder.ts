import { DefaultDocumentBuilder, type LangiumDocument } from 'langium';
import { isModel } from './generated/ast.js';

/** String-valued paths and negative lookups are not Langium indexed references. */
export class SwamlDocumentBuilder extends DefaultDocumentBuilder {
    protected override shouldRelink(document: LangiumDocument, changedUris: Set<string>): boolean {
        return (changedUris.size > 0 && isModel(document.parseResult.value)) || super.shouldRelink(document, changedUris);
    }
}
