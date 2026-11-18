import { AstUtils, DocumentState, DefaultLinker, DefaultScopeProvider, MapScope, type AstNode, type AstNodeDescription, type LinkingError, type ReferenceInfo, type Scope, type LangiumCoreServices } from 'langium';
import { MESSAGE_SPELLING, decodeQuotedName, formatName, formatQualifiedName } from './names.js';
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
        const visible = this.globalScopeCache.get(key, () => scope(packages().filter(p => p === pkg || pkg.imports.some(i => i.namespace === p.name)).flatMap(p => p.elements.map(node => ({ node, name: node.name }))), global));
        // A case subject, an association and a verified test name elements of the same package.
        // They resolve there first; the imported fallback lets validation explain a cross-package reference.
        const local = a.isScenario(context.container) || a.isAssociation(context.container) || a.isVerification(context.container) && context.property === 'test';
        return local ? this.globalScopeCache.get(`local:${key}`, () => scope(pkg.elements.map(node => ({ node, name: node.name })), visible)) : visible;
    }
}
const KIND: Record<string, string> = { DataType: 'datatype', EnumType: 'enum', ComponentDef: 'component def', ComponentUsage: 'component', PortDef: 'port def', Operation: 'operation', QosPolicy: 'qos def', ViewDef: 'view def', Requirement: 'requirement', View: 'view', Deployment: 'deployment' };
const kindOf = (n: AstNode) => a.isScenario(n) ? (n.kind === 'test' ? 'test' : 'use case') : KIND[n.$type] ?? n.$type;
/** Explains a short name that the scope leaves unresolved because several visible declarations share it. */
export class SwamlLinker extends DefaultLinker {
    /** Package elements by package name and element name, built once per link pass. */
    private index?: Map<string, Map<string, AstNode[]>>;
    constructor(private readonly core: LangiumCoreServices) {
        super(core);
        core.shared.workspace.DocumentBuilder.onBuildPhase(DocumentState.IndexedContent, () => this.index = undefined);
    }
    private elements(): Map<string, Map<string, AstNode[]>> {
        if (!this.index) {
            this.index = new Map();
            for (const d of this.core.shared.workspace.LangiumDocuments.all)
                if (a.isModel(d.parseResult.value))
                    for (const p of d.parseResult.value.packages) {
                        const names = this.index.get(p.name) ?? this.index.set(p.name, new Map()).get(p.name)!;
                        for (const e of p.elements)
                            (names.get(e.name) ?? names.set(e.name, []).get(e.name)!).push(e);
                    }
        }
        return this.index;
    }
    override createLinkingError(refInfo: ReferenceInfo, targetDescription?: AstNodeDescription): LinkingError & { declarations?: AstNode[] } {
        const error = super.createLinkingError(refInfo, targetDescription);
        const text = refInfo.reference.$refText, name = text.startsWith("'") ? decodeQuotedName(text) : text, pkg = owner(refInfo.container, a.isPackage);
        if (targetDescription || !pkg || text.includes('::'))
            return error;
        const index = this.elements(), named = (p: string) => index.get(p)?.get(name) ?? [];
        const local = a.isScenario(refInfo.container) || a.isAssociation(refInfo.container) || a.isVerification(refInfo.container) && refInfo.property === 'test';
        const own = pkg.elements.filter(e => e.name === name);
        // Local references resolve in their own package first; only an ambiguity there is reported here.
        const visible = [pkg.name, ...pkg.imports.map(i => i.namespace).filter(n => n !== pkg.name)];
        const clashing = local && own.length ? own : [...new Set(visible.flatMap(named))];
        if (clashing.length < 2)
            return error;
        const qualified = (e: AstNode) => formatQualifiedName(owner(e, a.isPackage)!.name + '::' + (e as AstNode & { name: string }).name, MESSAGE_SPELLING);
        const described = clashing.map(e => `${kindOf(e)} ${qualified(e)}${owner(e, a.isPackage) === pkg ? '' : ' (imported)'}`);
        // Only suggest a qualified name that resolves: unique in its package and of the expected kind.
        const type = this.reflection.getReferenceType(refInfo);
        const alternatives = clashing.filter(e => named(owner(e, a.isPackage)!.name).length === 1 && this.reflection.isSubtype(e.$type, type)).map(qualified);
        const advice = alternatives.length ? `qualify the reference (${alternatives.join(' or ')}) or rename one declaration` : 'rename one declaration';
        return { ...error, declarations: clashing, message: `Ambiguous name ${formatName(name, MESSAGE_SPELLING)}: it names ${described.slice(0, -1).join(', ')} and ${described[described.length - 1]}. A short name must name one visible declaration; ${advice}.` };
    }
}
