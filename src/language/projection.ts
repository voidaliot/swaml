import { AstUtils, type AstNode } from 'langium';
import type { Range } from 'vscode-languageserver';
import * as a from './generated/ast.js';
import { body, caseSubject, direction, effectiveQos, identity, isExecutable, members, nanos, owner, portMembers, schedule, signature, typeKey, type Node } from './semantic.js';
import { documentationText, viewCandidates } from './presentation.js';
export interface ProjectionNode {
    id: string;
    name: string;
    kind: string;
    definition: string;
    owner?: string;
    source: {
        uri: string;
        range: Range;
    };
    code: string;
    doc?: string;
    type?: string;
    ports?: {
        name: string;
        optional: boolean;
        reversed: boolean;
        members: {
            name: string;
            kind: string;
            direction: string;
            type: string;
            parameters: {
                name: string;
                type: string;
                direction: string;
            }[];
            idempotent: boolean;
        }[];
    }[];
    schedule?: {
        trigger: string;
        target: string;
        periodNs?: number;
        deadlineNs?: number;
        concurrent: boolean;
        code: string;
    }[];
}
export interface ProjectionEdge {
    id: string;
    kind: string;
    source: string;
    target: string;
    label: string;
    policy?: ReturnType<typeof effectiveQos>;
    order?: number;
}
export interface Projection {
    languageVersion: '2.0';
    nodes: ProjectionNode[];
    edges: ProjectionEdge[];
}
export function projectModel(models: readonly a.Model[]): Projection {
    const candidates = viewCandidates(models), result: Projection = { languageVersion: '2.0', nodes: [], edges: [] };
    const source = (n: AstNode) => ({ uri: AstUtils.getDocument(n).uri.toString(), range: n.$cstNode!.range });
    const addEdge = (kind: string, from: string, to: string, label: string, extra: Partial<ProjectionEdge> = {}) => result.edges.push({ id: `${kind}:${from}:${to}:${result.edges.length}`, kind, source: from, target: to, label, ...extra });
    for (const item of candidates) {
        const n = item.node as Node, id = item.path, parent = a.isPackage(n) ? undefined : candidates.filter(x => id.startsWith(x.path + '.') || a.isPackage(x.node) && id.startsWith(x.path + '::')).sort((a, b) => b.path.length - a.path.length)[0];
        const p: ProjectionNode = { id, name: item.name, kind: item.kind, definition: item.definition, owner: parent?.path, source: source(n), code: n.$cstNode!.text, doc: documentationText({ documentation: n.documentation }) };
        if (a.isAttribute(n) || a.isLocalVariable(n) || a.isField(n))
            p.type = typeKey(n.type);
        if (isExecutable(n)) {
            const sig = signature(n);
            p.type = `(${sig?.parameters.map(x => (x.direction ?? 'in') + ' ' + x.name + ': ' + typeKey(x.type)).join(', ')}) returns ${typeKey(sig?.result)}`;
        }
        if (a.isComponentDef(n) || a.isComponentUsage(n)) {
            p.ports = members(n).filter(a.isPortUsage).map(port => ({ name: port.name, optional: port.optional, reversed: port.reversed, members: portMembers(port).map(m => ({ name: m.name, kind: m.kind, direction: direction(port, m), type: typeKey(m.type ?? m.result), parameters: m.parameters.map(x => ({ name: x.name, type: typeKey(x.type), direction: x.direction ?? 'in' })), idempotent: m.idempotent })) }));
            p.schedule = schedule(n).map(e => ({ trigger: e.kind + (e.endpoint ? ' ' + e.endpoint : e.predecessor ? ' ' + e.predecessor : ''), target: e.operation, periodNs: e.period ? nanos(e.period) : undefined, deadlineNs: e.deadline ? nanos(e.deadline) : e.period ? nanos(e.period) : undefined, concurrent: e.concurrent, code: e.$cstNode!.text }));
            for (const c of members(n).filter(a.isConnect)) {
                const forward = c.source.split('.').length !== c.target.split('.').length;
                addEdge(forward ? 'forwarding' : 'connection', id + '.' + c.source, id + '.' + c.target, c.name ?? 'Default', forward ? {} : { policy: effectiveQos(c) });
            }
            for (const e of schedule(n))
                if (e.kind === 'after')
                    addEdge('after', id + '.' + e.predecessor, id + '.' + e.operation, e.$cstNode!.text);
        }
        if (isExecutable(n) && body(n)?.states.length)
            for (const state of body(n)!.states)
                state.transitions.forEach((t, i) => addEdge('transition', id + '.' + state.name, id + '.' + t.target, t.endpoint ? 'on receive ' + t.endpoint : 'after ' + t.delay?.value + t.delay?.unit, { order: i }));
        if (a.isScenario(n)) {
            // The owning component, or each of its occurrences, is the subject. Actors are typed roles owned by the case.
            const subject = caseSubject(n) && parent;
            if (subject)
                addEdge('subject', id, subject.path, 'subject');
            for (const actor of n.actors)
                addEdge('actor', id, id + '.' + actor.name, actor.name);
            for (const r of n.relations)
                if (r.target.ref)
                    addEdge(r.kind, id, subject ? subject.path + '.' + r.target.ref.name : identity(r.target.ref), r.kind);
        }
        result.nodes.push(p);
        if (parent)
            addEdge('ownership', parent.path, id, item.kind);
    }
    return result;
}
