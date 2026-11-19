import { AstUtils, type AstNode } from 'langium';
import type { Range } from 'vscode-languageserver';
import * as a from './generated/ast.js';
import { SWAML_LANGUAGE_VERSION } from './edition.js';
import { flowStates, nodes, memberQos, sampledMembers, entryDeadline, entryPeriod, displayText, associationPairs, body, isAssociationList, direction, effectiveQos, identity, isExecutable, members, nanos, owner, portMembers, schedule, signature, typeKey, type Node } from './semantic.js';
import { documentationText, viewCandidates, type ViewSubject } from './presentation.js';
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
            /** The display text of an attribute member's initial value (WP6-S02); absent without one. */
            initial?: string;
        }[];
    }[];
    /** The members a component samples, as sorted port.member strings (WP6-M04); absent when it samples none. */
    sampled?: string[];
    schedule?: {
        trigger: string;
        target: string;
        periodNs?: number;
        deadlineNs?: number;
        /** The canonical text of a computed period, every (e) (WP4-M03); absent for a literal period. */
        periodExpression?: string;
        /** The canonical text of a computed deadline, deadline (e) (WP4-M03); absent for a literal deadline. */
        deadlineExpression?: string;
        /** The canonical text of a release guard's condition g, written if (g) (WP7-M01); absent on an entry without one. */
        guard?: string;
        concurrent: boolean;
        code: string;
    }[];
}
/** Interconnect labels of a connection's member policies (WP6-M01); an unfinished one without a member or policy name is left out. */
function memberPolicyLabels(c: a.Connect): Pick<ProjectionEdge, 'memberPolicies'> {
    const complete = c.memberPolicies.filter(mp => !!mp.member && !!(mp.policy?.ref?.name ?? mp.policy?.$refText));
    return complete.length ? { memberPolicies: complete.map(mp => ({ member: mp.member, policy: mp.policy.ref?.name ?? mp.policy.$refText, qos: memberQos(c, mp.member) })) } : {};
}
/** The state that exit; of state s reaches (SIF-R09): the state written next in its list, or, after the last inner state, what exit; of its parent reaches; undefined when the flow goes on with a plain statement or the end. */
function exitTarget(s: a.StateStep): a.StateStep | undefined {
    const list = (s.$container as { statements?: AstNode[] }).statements, next = list?.[list.indexOf(s) + 1];
    if (next)
        return a.isStateStep(next) ? next : undefined;
    return a.isStateStep(s.$container) ? exitTarget(s.$container) : undefined;
}
/** What leads to a leave: its event line's head and the conditions of the ifs on the way, as [c]; 'to S' (or 'exit') alone otherwise. */
function leaveLabel(leave: a.Jump | a.Exit, word = `to ${a.isJump(leave) ? leave.target : ''}`): string {
    const parts: string[] = [];
    for (let x: AstNode | undefined = leave.$container; x && !a.isStateStep(x); x = x.$container) {
        if (a.isIf(x))
            parts.unshift(`[${displayText(x.condition)}]`);
        if (a.isEventLine(x))
            parts.unshift(x.endpoint !== undefined ? x.endpoint : x.delayValue ? `after (${displayText(x.delayValue)})` : x.delay ? `after ${x.delay.value}${x.delay.unit}` : '');
    }
    return parts.length ? parts.join(' ') : word;
}
export interface ProjectionEdge {
    id: string;
    kind: string;
    source: string;
    target: string;
    label: string;
    policy?: ReturnType<typeof effectiveQos>;
    order?: number;
    /** For a link of an association list (2.3), the positions of its occurrence and case in their lists; absent for a single 2.2 statement. */
    pair?: { occurrence: number; case: number };
    /** The member policies of a connection with each member route's effective policy (WP6-M01); absent without them. */
    memberPolicies?: { member: string; policy: string; qos: ReturnType<typeof effectiveQos> }[];
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
    // The owner of a candidate is the candidate with the longest path that prefixes it before a '.',
    // or a package whose path prefixes it before '::'; the first such candidate wins among equal paths.
    // Index candidate paths once so each lookup probes only those prefixes of its own path that have a
    // candidate's length. A package without a name (while it is being typed) has no string path; such a
    // workspace keeps the direct search, including its failure when that package ties with another owner.
    const byPath = new Map<string, ViewSubject>(), packageByPath = new Map<string, ViewSubject>(), lengths = new Set<number>();
    for (const x of candidates) {
        if (!byPath.has(x.path))
            byPath.set(x.path, x);
        if (a.isPackage(x.node) && !packageByPath.has(x.path))
            packageByPath.set(x.path, x);
        lengths.add(x.path?.length);
    }
    const ownerOf = candidates.every(x => typeof x.path === 'string') ? (id: string): ViewSubject | undefined => {
        for (let i = id.length - 1; i >= 0; i--) {
            if (!lengths.has(i))
                continue;
            const found = id[i] === '.' ? byPath.get(id.slice(0, i)) : id.startsWith('::', i) ? packageByPath.get(id.slice(0, i)) : undefined;
            if (found)
                return found;
        }
        return undefined;
    } : (id: string): ViewSubject | undefined => candidates.filter(x => id.startsWith(x.path + '.') || a.isPackage(x.node) && id.startsWith(x.path + '::')).sort((a, b) => b.path.length - a.path.length)[0];
    for (const item of candidates) {
        const n = item.node as Node, id = item.path;
        // A state inside a parent is owned by its parent state (SIF-M01): both are named in their operation.
        const enclosing = a.isStateStep(n) && a.isStateStep(n.$container) ? byPath.get(`${id.slice(0, id.length - n.name.length - 1)}.${n.$container.name}`) : undefined;
        const parent = a.isPackage(n) ? undefined : enclosing ?? ownerOf(id);
        const p: ProjectionNode = { id, name: item.name, kind: item.kind, definition: item.definition, owner: parent?.path, source: source(n), code: n.$cstNode!.text, doc: documentationText({ documentation: n.documentation }) };
        if (a.isAttribute(n) || a.isLocalVariable(n) || a.isField(n))
            p.type = typeKey(n.type);
        if (isExecutable(n)) {
            const sig = signature(n);
            p.type = `(${sig?.parameters.map(x => (x.direction ?? 'in') + ' ' + x.name + ': ' + typeKey(x.type)).join(', ')}) returns ${typeKey(sig?.result)}`;
        }
        if (a.isComponentDef(n) || a.isComponentUsage(n)) {
            // Computed periods and deadlines are values of an occurrence: a usage shows the evaluated nanoseconds and the
            // expression text, a definition the expression text only (WP4-M03).
            const occurrence = a.isComponentUsage(n);
            p.ports = members(n).filter(a.isPortUsage).map(port => ({ name: port.name, optional: port.optional, reversed: port.reversed, members: portMembers(port).map(m => ({ name: m.name, kind: m.kind, direction: direction(port, m), type: typeKey(m.type ?? m.result), parameters: m.parameters.map(x => ({ name: x.name, type: typeKey(x.type), direction: x.direction ?? 'in' })), idempotent: m.idempotent, ...(m.initial ? { initial: displayText(m.initial) } : {}) })) }));
            const sampled = [...sampledMembers(n)].sort();
            if (sampled.length)
                p.sampled = sampled;
            p.schedule = schedule(n).map(e => ({ trigger: e.kind + (e.endpoint ? ' ' + e.endpoint : e.predecessor ? ' ' + e.predecessor : ''), target: e.operation, periodNs: entryPeriod(e, occurrence ? n : undefined), deadlineNs: entryDeadline(e, occurrence ? n : undefined), concurrent: e.concurrent, code: e.$cstNode!.text, ...(e.periodValue ? { periodExpression: displayText(e.periodValue) } : {}), ...(e.deadlineValue ? { deadlineExpression: displayText(e.deadlineValue) } : {}), ...(e.guard ? { guard: displayText(e.guard) } : {}) }));
            for (const c of members(n).filter(a.isConnect)) {
                const forward = c.source.split('.').length !== c.target.split('.').length;
                addEdge(forward ? 'forwarding' : 'connection', id + '.' + c.source, id + '.' + c.target, c.name ?? 'Default', forward ? {} : { policy: effectiveQos(c), ...memberPolicyLabels(c) });
            }
            for (const e of schedule(n))
                if (e.kind === 'after')
                    addEdge('after', id + '.' + e.predecessor, id + '.' + e.operation, e.$cstNode!.text);
        }
        // States in the flow (SIF-G01, SIF-M01): one transition edge per leave, in written order of the leaves of its state,
        // labelled with what leads to it: the event line and the if conditions on the way. to S reaches S; exit; reaches the
        // state written next (SIF-R09), and draws no edge when the flow goes on with a plain statement or the end.
        if (isExecutable(n))
            for (const state of flowStates(n)) {
                const leaves = nodes(state).filter((x): x is a.Exit | a.Jump => (a.isJump(x) || a.isExit(x)) && owner(x, a.isStateStep) === state);
                leaves.forEach((leave, order) => {
                    const target = a.isJump(leave) ? leave.target : exitTarget(state)?.name;
                    if (target !== undefined && state.name !== undefined)
                        addEdge('transition', id + '.' + state.name, id + '.' + target, a.isJump(leave) ? leaveLabel(leave) : leaveLabel(leave, 'exit'), { order });
                });
            }
        if (a.isScenario(n) && n.subject?.ref)
            // The subject is a top-level occurrence of the same package; a case without of has none.
            addEdge('subject', id, identity(n.subject.ref), 'subject');
        if (a.isPackage(n)) {
            // Package connections join ports of top-level occurrences; links record intent in the package.
            for (const c of n.connections)
                addEdge('connection', id + '::' + c.source, id + '::' + c.target, c.name ?? 'Default', { policy: effectiveQos(c), ...memberPolicyLabels(c) });
            // Every occurrence–case pair of a list statement is one link with its list positions (WP2-S06, WP2-M04).
            for (const x of n.associations)
                for (const pair of associationPairs(x))
                    if (pair.occurrence.ref && pair.target.ref)
                        addEdge('associate', identity(pair.occurrence.ref), identity(pair.target.ref), 'associate', isAssociationList(x) ? { pair: { occurrence: pair.occurrenceIndex, case: pair.targetIndex } } : {});
            // A link recovered from a parse error can lack a reference or the design path; it is left out.
            for (const x of n.satisfactions)
                if (x.requirement?.ref && x.design)
                    addEdge('satisfy', id + '::' + x.design, identity(x.requirement.ref), 'satisfy');
            for (const x of n.verifications)
                if (x.requirement?.ref && x.test?.ref)
                    addEdge('verify', identity(x.test.ref), identity(x.requirement.ref), 'verify');
        }
        result.nodes.push(p);
        if (parent)
            addEdge('ownership', parent.path, id, item.kind);
    }
    return result;
}
