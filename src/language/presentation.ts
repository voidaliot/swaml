import { AstUtils, CstUtils, type AstNode } from 'langium';
import * as a from './generated/ast.js';
import { OCCURRENCE_LIMIT, occurrenceCount, body, identity, isExecutable, members, occurrences, owner, resolve, type Node } from './semantic.js';
export function documentationText(n: {
    documentation?: a.Documentation;
}): string | undefined { return n.documentation?.text.slice(3,-2).replace(/^\s*\* ?/gm, '').trim(); }
export function modelComments(model: a.Model): {
    text: string;
    offset: number;
}[] { return model.$cstNode ? CstUtils.flattenCst(model.$cstNode).filter(n => n.hidden && ['ML_COMMENT', 'SL_COMMENT'].includes(n.tokenType.name)).map(n => ({ text: n.text, offset: n.offset })).toArray() : []; }
export type ViewSubject = {
    path: string;
    name: string;
    kind: string;
    node: AstNode;
    definition: string;
};
export function viewCandidates(models: readonly a.Model[]): ViewSubject[] {
    const out: ViewSubject[] = [];
    const add = (n: Node, path: string) => {
        out.push({ path, name: n.name, kind: a.isComponentDef(n) || a.isComponentUsage(n) ? 'component' : isExecutable(n) ? 'operation' : a.isPortUsage(n) || a.isPortDef(n) ? 'port' : a.isPortMember(n) ? n.kind === 'operation' ? 'signature' : n.kind : a.isScenario(n) || a.isScenarioStep(n) ? n.kind : a.isDataType(n) ? 'datatype' : a.isEnumType(n) ? 'enum' : n.$type.replace(/^[A-Z]/, c => c.toLowerCase()), node: n, definition: a.isComponentUsage(n) && n.definition?.ref ? identity(n.definition.ref) : a.isOperationUsage(n) && n.definition.ref ? identity(n.definition.ref) : identity(n) });
        if (a.isPortUsage(n))
            for (const m of n.definition?.ref?.members ?? n.members)
                add(m as Node, path + '.' + m.name);
        if (a.isPortDef(n))
            for (const m of n.members)
                add(m as Node, path + '.' + m.name);
        if (a.isDataType(n))
            for (const f of n.fields)
                add(f as Node, path + '.' + f.name);
        if (a.isRequirement(n))
            for (const at of n.attributes)
                add(at as Node, path + '.' + at.name);
        if (a.isScenario(n))
            for (const step of n.steps)
                add(step as Node, path + '.' + step.name);
        if (isExecutable(n)) {
            for (const op of body(n)?.operations ?? [])
                add(op as Node, `${path}.${op.name}`);
            for (const state of body(n)?.states ?? [])
                add(state as Node, `${path}.${state.name}`);
        }
    };
    for (const m of models)
        for (const p of m.packages) {
            add(p as Node, p.name);
            for (const e of p.elements) {
                if (a.isView(e))
                    continue;
                if (a.isComponentUsage(e))
                    for (const o of occurrenceCount(e) <= OCCURRENCE_LIMIT ? occurrences(e) : [{ path: e.name, structure: e, definition: e }]) {
                        const path = `${p.name}::${o.path}`;
                        add(o.structure as Node, path);
                        for (const member of members(o.structure) as Node[])
                            if (!a.isComponentUsage(member) && member.name)
                                add(member, `${path}.${member.name}`);
                    }
                else {
                    add(e as Node, `${p.name}::${e.name}`);
                    if (a.isComponentDef(e))
                        for (const n of members(e) as Node[])
                            if (n.name)
                                add(n, `${p.name}::${e.name}.${n.name}`);
                }
            }
        }
    return out;
}
function filter(f: a.FilterExpression, s: ViewSubject): boolean { if (a.isFilterComparison(f))
    return f.operator === '==' ? s[f.field] === f.value : s[f.field] !== f.value; if (a.isFilterNot(f))
    return !filter(f.operand, s); return f.operator === 'and' ? filter(f.left, s) && filter(f.right, s) : filter(f.left, s) || filter(f.right, s); }
export function selectView(v: a.View, models: readonly a.Model[], candidates: readonly ViewSubject[] = viewCandidates(models)): ViewSubject[] {
    const result = new Map<string, ViewSubject>(), pkg = owner(v, a.isPackage);
    for (const sel of v.subject ? [{ subject: v.subject, recursive: false, filter: undefined }] : v.selections) {
        const [head, ...tail] = sel.subject.split('.'), decl = resolve(v, head, models), pack = models.flatMap(m => m.packages).find(p => p.name === sel.subject), path = decl && pack ? undefined : decl ? [identity(decl), ...tail].join('.') : pack?.name;
        if (!path)
            continue;
        for (const s of candidates)
            if ((s.path === path || sel.recursive && (s.path.startsWith(`${path}.`) || s.path.startsWith(`${path}::`))) && (!sel.filter || filter(sel.filter, s)))
                result.set(s.path, s);
    }
    return [...result.values()];
}
