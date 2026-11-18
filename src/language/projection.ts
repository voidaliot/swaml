import { AstUtils, type AstNode } from 'langium';
import type { Range } from 'vscode-languageserver';
import * as a from './generated/ast.js';
import { SWAML_LANGUAGE_VERSION } from './edition.js';
import { memberQos, sampledMembers, isCompletion, isInternal, stateDeferrals, entryDeadline, entryPeriod, displayText, associationPairs, body, isAssociationList, direction, effectiveQos, identity, isExecutable, members, nanos, owner, portMembers, schedule, signature, typeKey, type Node } from './semantic.js';
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
    /** A state's internal transitions, reactions without a target edge, in declaration order (WP5-M01); absent without one. */
    reactions?: { label: string; order: number; guard?: string }[];
    /** A state's deferred members in source order (WP5-M01); absent when the state defers nothing. */
    deferrals?: string[];
}
/** Interconnect labels of a connection's member policies (WP6-M01); an unfinished one without a member or policy name is left out. */
function memberPolicyLabels(c: a.Connect): Pick<ProjectionEdge, 'memberPolicies'> {
    const complete = c.memberPolicies.filter(mp => !!mp.member && !!(mp.policy?.ref?.name ?? mp.policy?.$refText));
    return complete.length ? { memberPolicies: complete.map(mp => ({ member: mp.member, policy: mp.policy.ref?.name ?? mp.policy.$refText, qos: memberQos(c, mp.member) })) } : {};
}
/** The label of a state transition: its trigger, or for a completion transition its guard (WP5-M01). */
function transitionLabel(t: a.Transition): string {
    return t.endpoint ? 'on receive ' + t.endpoint : t.delayValue ? `after (${displayText(t.delayValue)})` : t.delay ? 'after ' + t.delay.value + t.delay.unit : `when (${t.guard ? displayText(t.guard) : ''})`;
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
    /** A completion transition, labelled when (g) (WP5-M01); absent for receive and timer transitions. */
    completion?: true;
    /** The guard text of a guarded timer transition (WP5-M01); absent otherwise. */
    guard?: string;
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
        const n = item.node as Node, id = item.path, parent = a.isPackage(n) ? undefined : ownerOf(id);
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
        // WP5-M01: a completion transition is an edge labelled with its guard; an internal transition is a reaction of its
        // state without an edge; a timer guard is the edge's guard. These fields appear only for the 2.3 forms.
        if (isExecutable(n) && body(n)?.states.length)
            for (const state of body(n)!.states)
                state.transitions.forEach((t, i) => { if (t.target !== undefined)
                    addEdge('transition', id + '.' + state.name, id + '.' + t.target, transitionLabel(t), { order: i, ...(isCompletion(t) ? { completion: true } : t.guard && !t.endpoint ? { guard: displayText(t.guard) } : {}) }); });
        if (a.isState(n)) {
            const reactions = n.transitions.flatMap((t, order) => isInternal(t) ? [{ label: transitionLabel(t), order, ...(t.guard ? { guard: displayText(t.guard) } : {}) }] : []), deferrals = stateDeferrals(n);
            if (reactions.length)
                p.reactions = reactions;
            if (deferrals.length)
                p.deferrals = deferrals;
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
