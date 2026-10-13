import { AstUtils, DefaultScopeProvider, MapScope, type AstNode, type ReferenceInfo, type Scope, type LangiumCoreServices } from 'langium';
import * as a from './generated/ast.js';

export function owner<T extends AstNode>(node: AstNode, test: (node: AstNode) => node is T): T | undefined {
    return AstUtils.getContainerOfType(node, test);
}
export class SwamlScopeProvider extends DefaultScopeProvider {
    constructor(private services: LangiumCoreServices) { super(services); }
    override getScope(context: ReferenceInfo): Scope {
        const node = context.container;
        let candidates: AstNode[] | undefined;
        if (a.isInvoke(node)) candidates = owner(node, a.isUnit)?.members.filter(a.isOperation);
        if (a.isFunctionCall(node)) candidates = owner(node, a.isUnit)?.members.filter(a.isFunctionDef);
        if (a.isTransition(node) || a.isMachine(node)) candidates = owner(node, a.isMachine)?.states;
        if (a.isDeployment(node)) candidates = owner(node, a.isSystem)?.members.filter(a.isNode);
        if (a.isDelegate(node)) candidates = owner(node, a.isComponent)?.members.filter(a.isPort);
        const type = this.reflection.getReferenceType(context);
        if (candidates !== undefined) return this.createScopeForNodes(candidates.filter(n => this.reflection.isSubtype(n.$type, type)));
        const pkg = owner(node, a.isPackage);
        const entries: { node: AstNode; name: string }[] = [];
        for (const doc of this.services.shared.workspace.LangiumDocuments.all) {
            if (!a.isModel(doc.parseResult.value)) continue;
            for (const p of doc.parseResult.value.packages) {
                for (const element of p.elements) {
                    if (!this.reflection.isSubtype(element.$type, type)) continue;
                    entries.push({ node: element, name: `${p.name}::${element.name}` });
                    if (p === pkg || pkg?.imports.some(i => i.namespace === p.name)) entries.push({ node: element, name: element.name });
                }
            }
        }
        // Ambiguous imports are errors, never dependent on file iteration order.
        const counts = new Map<string, number>();
        for (const e of entries) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
        return new MapScope(entries.filter(e => counts.get(e.name) === 1).map(e => this.descriptions.createDescription(e.node, e.name)));
    }
}
