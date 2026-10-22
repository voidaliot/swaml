import { AstUtils, CstUtils, GrammarUtils, EmptyFileSystem, type AstNode, type CstNode, type LangiumDocument } from 'langium';
import type { LangiumServices, RenameProvider, DefinitionProvider, ReferencesProvider } from 'langium/lsp';
import type { DefinitionParams, Location, LocationLink, Range, ReferenceParams, RenameParams, TextDocumentPositionParams, WorkspaceEdit, TextEdit } from 'vscode-languageserver';
import * as a from './generated/ast.js';
import { viewCandidates, selectView } from './presentation.js';
import { body, connectionRoutes, container, isExecutable, localOperation, memberEndpoint, members, nodes, owner, resolve, signature, OCCURRENCE_LIMIT, occurrenceCount, type Node, type Structure } from './semantic.js';
export interface SemanticSymbol {
    key: string;
    node: AstNode;
    name: string;
    property: string;
    index?: number;
    uri: string;
    range: Range;
    type?: a.TypeRef;
}
export interface SemanticReference {
    symbol: SemanticSymbol;
    uri: string;
    range: Range;
    declaration: boolean;
}
const property = (n: AstNode, p: string, i?: number): CstNode | undefined => GrammarUtils.findNodeForProperty(n.$cstNode, p as never, i);
/** Includes strings deliberately outside Langium's reference index. No filesystem access. */
export function semanticIndex(models: readonly a.Model[]): SemanticReference[] {
    const symbols: SemanticSymbol[] = [], refs: SemanticReference[] = [], byNode = new Map<AstNode, SemanticSymbol[]>();
    const make = (n: Node, p: string, name: string, i?: number, type?: a.TypeRef) => {
        const cst = property(n, p, i);
        if (!cst)
            return undefined;
        const uri = AstUtils.getDocument(n).uri.toString(), symbol: SemanticSymbol = { key: `${uri}#${cst.offset}`, node: n, name, property: p, index: i, uri, range: cst.range, type };
        symbols.push(symbol);
        byNode.set(n, [...(byNode.get(n) ?? []), symbol]);
        refs.push({ symbol, uri, range: cst.range, declaration: true });
        return symbol;
    };
    const symbol = (n: AstNode | undefined, p = 'name', i?: number) => n && byNode.get(n)?.find(s => s.property === p && s.index === i);
    for (const model of models)
        for (const n of nodes(model)) {
            if (n.name && !a.isPolicySetting(n) && !a.isFieldValue(n))
                make(n, 'name', n.name, undefined, n.type);
            if (a.isEnumType(n))
                n.literals.forEach((v, i) => make(n, 'literals', v, i));
            if (a.isScheduleEntry(n) || a.isReceiveBranch(n) || a.isInterruptible(n) || a.isTransition(n))
                n.bindings.forEach((v, i) => { const c = container(n), ep = c && n.endpoint && memberEndpoint(c, n.endpoint); make(n, 'bindings', v, i, ep ? ep.member.kind === 'attribute' ? ep.member.type : ep.member.parameters[i]?.type : undefined); });
        }
    const add = (n: AstNode, cst: CstNode | undefined, target: SemanticSymbol | undefined, start = 0, length?: number, logical?: string) => { if (!cst || !target)
        return;
        if (logical !== undefined) {
            const names = [...logical.matchAll(/[_A-Za-z]\w*/g)], leaves = CstUtils.flattenCst(cst).filter(l => !l.hidden && /^[_A-Za-z]\w*$/.test(l.text)).toArray();
            if (names.length === leaves.length && names.every((name, i) => name[0] === leaves[i].text)) {
                const first = names.findIndex(name => name.index! <= start && start < name.index! + name[0].length), end = start + (length ?? logical.length), last = names.findIndex(name => name.index! < end && end <= name.index! + name[0].length);
                if (first >= 0 && last >= 0) {
                    const from = leaves[first].offset - cst.offset + start - names[first].index!;
                    length = leaves[last].offset - cst.offset + end - names[last].index! - from;
                    start = from;
                }
            }
        }
        const d = AstUtils.getDocument(n), from = cst.offset + start; refs.push({ symbol: target, uri: d.uri.toString(), range: { start: d.textDocument.positionAt(from), end: d.textDocument.positionAt(from + (length ?? cst.length)) }, declaration: false }); };
    const native = (n: AstNode, cst: CstNode | undefined, target: AstNode | undefined) => { const s = symbol(target); if (!s || !cst)
        return; const logical = CstUtils.flattenCst(cst).filter(l => !l.hidden).map(l => l.text).join(''), head = logical.split('.')[0]; const offset = head.lastIndexOf(s.name); add(n, cst, s, Math.max(0, offset), s.name.length, logical); const colon = head.lastIndexOf('::'); if (colon >= 0) {
        const pkg = models.flatMap(m => m.packages).find(p => p.name === logical.slice(0, colon));
        add(n, cst, symbol(pkg), 0, colon, logical);
    } };
    const isWithin = (node: AstNode, ancestor: AstNode) => { for (let x: AstNode | undefined = node; x; x = x.$container)
        if (x === ancestor)
            return true; return false; };
    const valueSymbol = (origin: AstNode, name: string): SemanticSymbol | undefined => {
        let child = origin;
        for (let p = origin.$container; p; child = p, p = p.$container) {
            if (a.isBlock(p) || a.isOperationBody(p)) {
                const index = child.$containerProperty === 'statements' ? child.$containerIndex ?? 0 : p.statements.length;
                const local = p.statements.slice(0, index).filter(a.isLocalVariable).reverse().find(v => v.name === name);
                if (local)
                    return symbol(local);
            }
            if ((a.isScheduleEntry(p) || a.isReceiveBranch(p) || a.isTransition(p) || a.isInterruptible(p) && isWithin(origin, p.handler)) && p.bindings.includes(name))
                return symbol(p, 'bindings', p.bindings.indexOf(name));
            if (a.isForEach(p) && isWithin(origin, p.body) && p.variable.name === name)
                return symbol(p.variable);
            if (a.isFor(p) && !isWithin(origin, p.initializer) && p.initializer.name === name)
                return symbol(p.initializer);
            if (isExecutable(p)) {
                const param = signature(p)?.parameters.find(x => x.name === name);
                if (param)
                    return symbol(param);
                break;
            }
        }
        const c = container(origin);
        return c && symbol(members(c).find(x => a.isAttribute(x) && x.name === name));
    };
    const childNode = (parent: Node, part: string): Node | undefined => {
        const name = part.replace(/\[\d+\]$/, '');
        if (a.isComponentDef(parent) || a.isComponentUsage(parent))
            return members(parent).find(m => (m as Node).name === name) as Node;
        if (isExecutable(parent))
            return [...(body(parent)?.operations ?? []), ...(body(parent)?.states ?? []), ...(signature(parent)?.parameters ?? [])].find(n => n.name === name) as Node;
        if (a.isPortUsage(parent))
            return (parent.definition?.ref?.members ?? parent.members).find(n => n.name === name) as Node;
        if (a.isPortDef(parent))
            return parent.members.find(n => n.name === name) as Node;
        if (a.isRequirement(parent))
            return parent.attributes.find(n => n.name === name) as Node;
        if (a.isDataType(parent))
            return parent.fields.find(n => n.name === name) as Node;
        if (a.isScenario(parent))
            return parent.steps.find(n => n.name === name) as Node;
        return undefined;
    };
    const pathRefs = (n: AstNode, p: string, path: string, start?: Node, offset = 0) => {
        const cst = property(n, p);
        if (!cst)
            return;
        const parts = path.split('.');
        let current = start, pos = offset;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i], name = part.replace(/\[\d+\]$/, '');
            if (!current) {
                const decl = resolve(n, name, models);
                current = decl as Node | undefined;
                if (!current) {
                    const pkg = models.flatMap(m => m.packages).find(p => p.name === name);
                    current = pkg as Node | undefined;
                }
                if (current) {
                    const textName = symbol(current)?.name;
                    if (textName) {
                        const index = part.lastIndexOf(textName);
                        add(n, cst, symbol(current), pos + Math.max(index, 0), textName.length, path);
                    }
                    const colon = part.lastIndexOf('::');
                    if (colon >= 0)
                        add(n, cst, symbol(models.flatMap(m => m.packages).find(p => p.name === part.slice(0, colon))), pos, colon, path);
                }
            }
            else {
                current = childNode(current, part);
                if (current)
                    add(n, cst, symbol(current), pos, name.length, path);
            }
            pos += part.length + 1;
        }
    };
    for (const model of models)
        for (const n of nodes(model)) {
            for (const r of AstUtils.streamReferences(n))
                native(n, r.reference.$refNode, 'ref' in r.reference ? r.reference.ref : undefined);
            if (a.isImport(n))
                add(n, property(n, 'namespace'), symbol(models.flatMap(m => m.packages).find(p => p.name === n.namespace)));
            const c = container(n);
            if (a.isConnect(n) && c) {
                pathRefs(n, 'source', n.source, c as Node);
                pathRefs(n, 'target', n.target, c as Node);
            }
            if (a.isSend(n) || a.isReceiveBranch(n) || a.isInterruptible(n) || a.isTransition(n) && n.endpoint || a.isScheduleEntry(n) && n.endpoint)
                if (c)
                    pathRefs(n, 'endpoint', n.endpoint!, c as Node);
            if (a.isScheduleEntry(n) && c) {
                add(n, property(n, 'operation'), symbol(members(c).filter(isExecutable).find(x => x.name === n.operation)));
                if (n.predecessor)
                    add(n, property(n, 'predecessor'), symbol(members(c).filter(isExecutable).find(x => x.name === n.predecessor)));
            }
            if (a.isCallExpression(n)) {
                if (n.target.includes('.') && c)
                    pathRefs(n, 'target', n.target, c as Node);
                else
                    native(n, property(n, 'target'), localOperation(n, n.target, c) ?? resolve(n, n.target, models));
            }
            if (a.isAssign(n))
                add(n, property(n, 'target'), valueSymbol(n, n.target));
            if (a.isReferenceExpression(n)) {
                const cst = property(n, 'path'), parts = n.path.split('.');
                let s = valueSymbol(n, parts[0]), pos = 0;
                if (!s) {
                    const en = resolve(n, parts[0], models);
                    if (a.isEnumType(en)) {
                        native(n, cst, en);
                        const i = en.literals.indexOf(parts[1]);
                        add(n, cst, symbol(en, 'literals', i), parts[0].length + 1, parts[1]?.length, n.path);
                    }
                }
                else {
                    add(n, cst, s, 0, parts[0].length, n.path);
                    pos = parts[0].length + 1;
                    for (const field of parts.slice(1)) {
                        const type = s?.type?.type?.ref;
                        if (!a.isDataType(type))
                            break;
                        s = symbol(type.fields.find(f => f.name === field));
                        add(n, cst, s, pos, field.length, n.path);
                        pos += field.length + 1;
                    }
                }
            }
            if (a.isFieldValue(n) && a.isRecordLiteral(n.$container))
                add(n, property(n, 'name'), symbol(n.$container.type.ref?.fields.find(f => f.name === n.name)));
            if (a.isOperationBody(n) && n.initial)
                add(n, property(n, 'initial'), symbol(n.states.find(s => s.name === n.initial)));
            if (a.isTransition(n)) {
                const b = owner(n, a.isOperationBody);
                add(n, property(n, 'target'), symbol(b?.states.find(s => s.name === n.target)));
            }
            if (a.isView(n) && n.subject)
                pathRefs(n, 'subject', n.subject);
            if (a.isFilterComparison(n) && n.field === 'path')
                pathRefs(n, 'value', n.value, undefined, 1);
            if (a.isFilterComparison(n) && n.field === 'name') {
                const v = owner(n, a.isView), selection = owner(n, a.isViewSelection);
                if (v && selection) {
                    const candidates = selectView({ ...v, subject: undefined, selections: [{ ...selection, filter: undefined }] }, models).filter(x => x.name === n.value);
                    const targets = new Set(candidates.map(c => c.node));
                    if (targets.size === 1)
                        add(n, property(n, 'value'), symbol([...targets][0]), 1, n.value.length);
                }
            }
            if (a.isViewSelection(n))
                pathRefs(n, 'subject', n.subject);
            if (a.isSatisfaction(n))
                pathRefs(n, 'source', n.source);
            if (a.isQosPolicy(n) && n.base)
                native(n, property(n, 'base'), resolve(n, n.base, models));
            if (a.isPlacement(n)) {
                const d = owner(n, a.isDeployment);
                if (d?.root.ref && n.target)
                    pathRefs(n, 'target', n.target, d.root.ref as Node);
                if (d?.platform.ref)
                    pathRefs(n, 'node', n.node, d.platform.ref as Node);
            }
            if (a.isScenarioStep(n)) {
                const scenario = owner(n, a.isScenario), root = scenario?.root.ref;
                if (root) {
                    pathRefs(n, 'source', n.source, root as Node);
                    pathRefs(n, 'target', n.target, root as Node);
                    if (n.connector && occurrenceCount(root) <= OCCURRENCE_LIMIT) {
                        const { links, leaf } = connectionRoutes(root);
                        const ports = [n.source, n.target].map(path => leaf(root.name + '.' + path.slice(0, path.lastIndexOf('.'))));
                        const connects = links.filter(l => l.node.name === n.connector && ports.every(p => l.ends.includes(p)));
                        if (connects.length === 1)
                            add(n, property(n, 'connector'), symbol(connects[0].node));
                    }
                }
                if (scenario && n.predecessor)
                    add(n, property(n, 'predecessor'), symbol(scenario.steps.find(s => s.name === n.predecessor)));
            }
        }
    const unique = new Map<string, SemanticReference>();
    for (const r of refs)
        unique.set(r.uri + ':' + JSON.stringify(r.range) + ':' + r.symbol.key, r);
    return [...unique.values()];
}
export class SwamlPathServices implements RenameProvider, DefinitionProvider, ReferencesProvider {
    constructor(private services: LangiumServices) { }
    private models(): a.Model[] { return this.services.shared.workspace.LangiumDocuments.all.map(d => d.parseResult.value).filter(a.isModel).toArray(); }
    private selected(document: LangiumDocument, params: TextDocumentPositionParams, index: SemanticReference[]): SemanticReference | undefined {
        const offset = document.textDocument.offsetAt(params.position);
        return index.filter(r => r.uri === document.uri.toString() && document.textDocument.offsetAt(r.range.start) <= offset && document.textDocument.offsetAt(r.range.end) >= offset).sort((x, y) => document.textDocument.offsetAt(x.range.end) - document.textDocument.offsetAt(x.range.start) - (document.textDocument.offsetAt(y.range.end) - document.textDocument.offsetAt(y.range.start)))[0];
    }
    prepareRename(document: LangiumDocument, params: TextDocumentPositionParams): Range | undefined { const r = this.selected(document, params, semanticIndex(this.models())); return r && !r.symbol.uri.startsWith('builtin:') ? r.range : undefined; }
    getDefinition(document: LangiumDocument, params: DefinitionParams): LocationLink[] { const r = this.selected(document, params, semanticIndex(this.models())); return r ? [{ originSelectionRange: r.range, targetUri: r.symbol.uri, targetRange: r.symbol.node.$cstNode!.range, targetSelectionRange: r.symbol.range }] : []; }
    findReferences(document: LangiumDocument, params: ReferenceParams): Location[] { const index = semanticIndex(this.models()), r = this.selected(document, params, index); return r ? index.filter(x => x.symbol.key === r.symbol.key && (params.context.includeDeclaration || !x.declaration)).map(x => ({ uri: x.uri, range: x.range })) : []; }
    async rename(document: LangiumDocument, params: RenameParams): Promise<WorkspaceEdit | undefined> {
        const models = this.models(), index = semanticIndex(models), selected = this.selected(document, params, index);
        if (!selected || selected.symbol.uri.startsWith('builtin:'))
            return undefined;
        if (!/^[_a-zA-Z]\w*(?:::[_a-zA-Z]\w*)*$/.test(params.newName))
            return undefined;
        const documents = models.filter(m => AstUtils.getDocument(m).uri.scheme !== 'builtin').map(AstUtils.getDocument);
        if (documents.some(d => d.diagnostics?.some(x => x.severity === 1)))
            return undefined;
        const family = new Set([selected.symbol.key]), target = selected.symbol.node as Node, structure = container(target);
        if (structure && target.$container === structure)
            for (const m of models)
                for (const n of nodes(m)) {
                    if (n.name !== selected.symbol.name || !n.redefines)
                        continue;
                    let c = container(n), seen = new Set<Structure>();
                    while (c && !seen.has(c)) {
                        seen.add(c);
                        if (c === structure) {
                            const symbol = index.find(r => r.declaration && r.symbol.node === n);
                            if (symbol)
                                family.add(symbol.symbol.key);
                            break;
                        }
                        c = a.isComponentDef(c) ? c.specializes?.ref : c.definition?.ref;
                    }
                }
        const changes = new Map<string, TextEdit[]>();
        for (const r of index.filter(r => family.has(r.symbol.key))) {
            const list = changes.get(r.uri) ?? [];
            if (!list.some(x => JSON.stringify(x.range) === JSON.stringify(r.range)))
                list.push({ range: r.range, newText: params.newName });
            changes.set(r.uri, list);
        }
        const renamedNodes = new Set(index.filter(r => r.declaration && family.has(r.symbol.key)).map(r => r.symbol.node));
        const pathChanges = viewCandidates(models).filter(s => renamedNodes.has(s.node)).map(s => { const suffix = /\[\d+\]$/.exec(s.path)?.[0] ?? ''; return { before: s.path, after: s.path.slice(0, s.path.length - selected.symbol.name.length - suffix.length) + params.newName + suffix }; }).sort((a, b) => b.before.length - a.before.length);
        const expectedPath = (path: string) => { const change = pathChanges.find(c => path === c.before || path.startsWith(c.before + '.') || path.startsWith(c.before + '::')); return change ? change.after + path.slice(change.before.length) : path; };
        const snapshots = documents.map(d => ({ d, version: d.textDocument.version, text: d.textDocument.getText() }));
        const { createSwamlServices } = await import('./swaml-module.js');
        const trial = createSwamlServices(EmptyFileSystem), proposed = [];
        for (const { d, text } of snapshots) {
            let next = text;
            const edits = changes.get(d.uri.toString()) ?? [];
            for (const edit of [...edits].sort((a, b) => d.textDocument.offsetAt(b.range.start) - d.textDocument.offsetAt(a.range.start)))
                next = next.slice(0, d.textDocument.offsetAt(edit.range.start)) + edit.newText + next.slice(d.textDocument.offsetAt(edit.range.end));
            const doc = trial.shared.workspace.LangiumDocumentFactory.fromString(next, d.uri);
            trial.shared.workspace.LangiumDocuments.addDocument(doc);
            proposed.push(doc);
        }
        await trial.shared.workspace.DocumentBuilder.build(proposed, { validation: true });
        if (proposed.some(d => d.diagnostics?.some(x => x.severity === 1)) || snapshots.some(s => s.version !== s.d.textDocument.version || s.text !== s.d.textDocument.getText()))
            return undefined;
        const trialModels = proposed.map(d => d.parseResult.value).filter(a.isModel);
        // A valid reparse alone does not prevent capture. Compare every binding by
        // stable AST position, translating reference offsets through the edit set.
        const locator = this.services.workspace.AstNodeLocator;
        const translated = (uri: string, offset: number) => {
            const d = documents.find(d => d.uri.toString() === uri);
            return offset + (changes.get(uri) ?? []).reduce((delta, edit) => {
                const end = d!.textDocument.offsetAt(edit.range.end), start = d!.textDocument.offsetAt(edit.range.start);
                return delta + (end <= offset ? edit.newText.length - (end - start) : 0);
            }, 0);
        };
        const bindings = (refs: SemanticReference[], translate: boolean) => refs.map(r => {
            const referenceDoc = (translate ? this.services : trial.Swaml).shared.workspace.LangiumDocuments.all.find(d => d.uri.toString() === r.uri)!;
            const from = referenceDoc.textDocument.offsetAt(r.range.start), to = referenceDoc.textDocument.offsetAt(r.range.end);
            return JSON.stringify([r.uri, translate ? translated(r.uri, from) : from, translate ? translated(r.uri, to) : to, r.declaration, r.symbol.uri, locator.getAstNodePath(r.symbol.node), r.symbol.property, r.symbol.index]);
        }).sort();
        const trialIndex = semanticIndex(trial.shared.workspace.LangiumDocuments.all.map(d => d.parseResult.value).filter(a.isModel).toArray());
        if (JSON.stringify(bindings(index, true)) !== JSON.stringify(bindings(trialIndex, false)))
            return undefined;
        for (const snapshot of snapshots) {
            const before = nodes(snapshot.d.parseResult.value).filter(a.isView), after = nodes(proposed.find(d => d.uri.toString() === snapshot.d.uri.toString())!.parseResult.value).filter(a.isView);
            for (let i = 0; i < before.length; i++)
                if (JSON.stringify(selectView(before[i], models).map(s => expectedPath(s.path))) !== JSON.stringify(selectView(after[i], trialModels).map(s => s.path)))
                    return undefined;
        }
        return { documentChanges: [...changes].map(([uri, edits]) => ({ textDocument: { uri, version: documents.find(d => d.uri.toString() === uri)?.textDocument.version ?? null }, edits })) };
    }
}
