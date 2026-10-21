import { DefaultScopeProvider, MapScope, type ReferenceInfo, type Scope, type LangiumCoreServices } from 'langium';
import * as a from './generated/ast.js';
import { owner } from './semantic.js';
export { owner } from './semantic.js';
export class SwamlScopeProvider extends DefaultScopeProvider {
    constructor(private services: LangiumCoreServices) { super(services); }
    override getScope(context: ReferenceInfo): Scope {
        const pkg = owner(context.container, a.isPackage);
        const type = this.reflection.getReferenceType(context);
        const entries = [];
        for (const doc of this.services.shared.workspace.LangiumDocuments.all) {
            if (!a.isModel(doc.parseResult.value))
                continue;
            for (const p of doc.parseResult.value.packages)
                for (const element of p.elements) {
                    entries.push({ node: element, name: `${p.name}::${element.name}` });
                    if (p === pkg || pkg?.imports.some(i => i.namespace === p.name))
                        entries.push({ node: element, name: element.name });
                }
        }
        const counts = new Map<string, number>();
        for (const e of entries)
            counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
        return new MapScope(entries.filter(e => counts.get(e.name) === 1 && this.reflection.isSubtype(e.node.$type, type)).map(e => this.descriptions.createDescription(e.node, e.name)));
    }
}
