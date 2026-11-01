import { AstUtils, type AstNode } from 'langium';
import type { Range } from 'vscode-languageserver';
import * as a from './generated/ast.js';
import { SWAML_LANGUAGE_VERSION } from './edition.js';
import { body, direction, effectiveQos, identity, isExecutable, members, nanos, owner, portMembers, schedule, signature, typeKey, type Node } from './semantic.js';
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
    languageVersion: typeof SWAML_LANGUAGE_VERSION;
    nodes: ProjectionNode[];
    edges: ProjectionEdge[];
}
export function projectModel(models: readonly a.Model[]): Projection {
    const candidates = viewCandidates(models), result: Projection = { languageVersion: SWAML_LANGUAGE_VERSION, nodes: [], edges: [] };
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
        if (a.isScenario(n) && n.subject?.ref)
            // The subject is a top-level occurrence of the same package; a case without of has none.
            addEdge('subject', id, identity(n.subject.ref), 'subject');
        if (a.isPackage(n)) {
            // Package connections join ports of top-level occurrences; links record intent in the package.
            for (const c of n.connections)
                addEdge('connection', id + '::' + c.source, id + '::' + c.target, c.name ?? 'Default', { policy: effectiveQos(c) });
            for (const x of n.associations)
                if (x.occurrence.ref && x.target.ref)
                    addEdge('associate', identity(x.occurrence.ref), identity(x.target.ref), 'associate');
            for (const x of n.satisfactions)
                if (x.requirement.ref)
                    addEdge('satisfy', id + '::' + x.design, identity(x.requirement.ref), 'satisfy');
            for (const x of n.verifications)
                if (x.requirement.ref && x.test.ref)
                    addEdge('verify', identity(x.test.ref), identity(x.requirement.ref), 'verify');
        }
        result.nodes.push(p);
        if (parent)
            addEdge('ownership', parent.path, id, item.kind);
    }
    return result;
}
