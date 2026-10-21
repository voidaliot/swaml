import { AstUtils, DocumentState, DefaultScopeProvider, MapScope, type AstNode, type ReferenceInfo, type Scope, type LangiumCoreServices } from 'langium';
import * as a from './generated/ast.js';
import { owner } from './semantic.js';
export { owner } from './semantic.js';
export class SwamlScopeProvider extends DefaultScopeProvider {
    constructor(private services: LangiumCoreServices) {
        super(services);
        // Also cover explicit in-memory builds, which need not emit onUpdate.
        services.shared.workspace.DocumentBuilder.onBuildPhase(DocumentState.IndexedContent, () => this.globalScopeCache.clear());
    }
    override getScope(context: ReferenceInfo): Scope {
        const pkg = owner(context.container, a.isPackage);
        const type = this.reflection.getReferenceType(context);
        const packages = () => this.services.shared.workspace.LangiumDocuments.all.flatMap(d => a.isModel(d.parseResult.value) ? d.parseResult.value.packages : []).toArray();
        const scope = (entries: { node: AstNode; name: string }[], outer?: Scope) => {
            const counts = new Map<string, number>();
            for (const e of entries)
                counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
            // Ambiguity is decided before category filtering, never as a lookup fallback.
            return new MapScope(entries.filter(e => counts.get(e.name) === 1 && this.reflection.isSubtype(e.node.$type, type)).map(e => this.descriptions.createDescription(e.node, e.name)), outer);
        };
        const global = this.globalScopeCache.get(`qualified:${type}`, () => scope(packages().flatMap(p => p.elements.map(node => ({ node, name: `${p.name}::${node.name}` })))));
        if (!pkg)
            return global;
        const key = `visible:${AstUtils.getDocument(pkg).uri.toString()}:${pkg.$cstNode?.offset}:${type}`;
        return this.globalScopeCache.get(key, () => scope(packages().filter(p => p === pkg || pkg.imports.some(i => i.namespace === p.name)).flatMap(p => p.elements.map(node => ({ node, name: node.name }))), global));
    }
}
