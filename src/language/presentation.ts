import { AstUtils, CstUtils, type AstNode } from 'langium';
import * as a from './generated/ast.js';
import { members } from './semantic.js';
import { owner } from './swaml-scope.js';

/** Raw formal text: no string escapes, interpolation or executable meaning. */
export function documentationText(node: AstNode): string | undefined {
    const doc = (node as AstNode & { documentation?: a.Documentation }).documentation;
    return doc?.text.replace(/^doc\s*\/\*/, '').replace(/\*\/$/, '').trim();
}
export interface ModelComment { owner: AstNode; text: string; offset: number; end: number; kind: 'line' | 'block' }
/** Preserve each lexical comment separately; trailing comments attach to the preceding named element. */
export function modelComments(model: a.Model): ModelComment[] {
    if (!model.$cstNode) return [];
    const named = [model, ...AstUtils.streamAllContents(model)].filter(n => n === model || 'name' in n);
    return [...CstUtils.flattenCst(model.$cstNode)].filter(c => c.tokenType.name === 'SL_COMMENT' || c.tokenType.name === 'ML_COMMENT').map(c => {
        const containing = named.filter(n => n.$cstNode && n.$cstNode.offset <= c.offset && n.$cstNode.end >= c.end).sort((x,y) => x.$cstNode!.length - y.$cstNode!.length);
        const enclosing = containing.find(n => n !== model) ?? model;
        const trailing = named.filter(n => n !== model && n.$cstNode && n.$cstNode.end <= c.offset && n.$cstNode.range.end.line === c.range.start.line && n.$cstNode.offset >= (enclosing.$cstNode?.offset ?? 0)).sort((x,y) => y.$cstNode!.end - x.$cstNode!.end);
        return { owner: trailing[0] ?? enclosing, text: c.text, offset: c.offset, end: c.end, kind: c.tokenType.name === 'SL_COMMENT' ? 'line' : 'block' };
    });
}
export interface ViewElement { node: AstNode; path: string; name: string; kind: string }
const semanticKind = (n: AstNode) => a.isComponent(n) || a.isRootComponent(n) || a.isInstance(n) || a.isFunctionDef(n) || a.isScenario(n) ? n.kind : n.$type[0].toLowerCase() + n.$type.slice(1);
function namedChildren(n: AstNode): AstNode[] {
    if (a.isComponent(n) || a.isRootComponent(n)) return members(n).filter(x => 'name' in x);
    if (a.isPort(n)) return n.interface.ref?.members ?? [];
    return [...AstUtils.streamContents(n)].flatMap(x => 'name' in x ? [x] : namedChildren(x));
}
/** Occurrence paths are retained even when several usages share one definition. */
export function viewCandidates(pkg: a.Package): ViewElement[] {
    const result: ViewElement[] = [{ node: pkg, path: pkg.name, name: pkg.name, kind: 'package' }];
    const visit = (n: AstNode, path: string, seen: Set<AstNode>) => {
        if (a.isView(n)) return;
        result.push({ node:n, path, name:path.split('.').at(-1)!, kind:semanticKind(n) });
        const definition = a.isInstance(n) ? n.definition.ref : n;
        if (!definition || seen.has(definition)) return;
        for (const child of namedChildren(definition)) visit(child, `${path}.${(child as AstNode & {name:string}).name}`, new Set(seen).add(definition));
    };
    for (const e of pkg.elements) visit(e, e.name, new Set());
    return result;
}
export function resolvePresentationPath(pkg: a.Package, path: string): ViewElement | undefined {
    const candidates = viewCandidates(pkg);
    const matches = candidates.filter(x => x.path === path || (path.startsWith(pkg.name + '.') && x.path === path.slice(pkg.name.length + 1)));
    return matches.length === 1 ? matches[0] : undefined;
}
export function validViewFilter(e: a.Expression): boolean {
    if (a.isLiteral(e)) return e.text !== undefined || e.boolean !== undefined;
    if (a.isReferenceExpression(e)) return !e.index && ['name','kind','path'].includes(e.path);
    if (a.isUnaryExpression(e)) return e.operator === 'not' && validViewFilter(e.operand);
    if (a.isBinaryExpression(e)) return ['and','or','==','!='].includes(e.operator) && validViewFilter(e.left) && validViewFilter(e.right);
    return false;
}
function filterValue(e: a.Expression, candidate: ViewElement): string | boolean {
    if (a.isLiteral(e)) return e.text ?? e.boolean === 'true';
    if (a.isReferenceExpression(e)) return candidate[e.path as 'name'|'kind'|'path'];
    if (a.isUnaryExpression(e)) return !filterValue(e.operand, candidate);
    if (a.isBinaryExpression(e)) {
        const left = filterValue(e.left,candidate), right = filterValue(e.right,candidate);
        return e.operator === 'and' ? left === true && right === true : e.operator === 'or' ? left === true || right === true : e.operator === '==' ? left === right : left !== right;
    }
    return false;
}
/** Deterministic union in declaration order, deduplicated by occurrence path. Validated models only. */
export function selectView(view: a.View): ViewElement[] {
    const pkg = owner(view, a.isPackage);
    if (!pkg) return [];
    const candidates = viewCandidates(pkg), selected = new Map<string, ViewElement>();
    const selections = view.subject ? [{ subject:view.subject, recursive:false, filter:undefined }] : view.selections;
    for (const selection of selections) {
        const root = resolvePresentationPath(pkg, selection.subject);
        if (!root) continue;
        for (const c of candidates) if ((c.path === root.path || selection.recursive && (root.node === pkg || c.path.startsWith(root.path + '.'))) && (!selection.filter || validViewFilter(selection.filter) && filterValue(selection.filter,c) === true)) selected.set(c.path,c);
    }
    return [...selected.values()];
}
