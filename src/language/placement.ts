import { AstUtils, type AstNode } from 'langium';
import * as a from './generated/ast.js';
import { formatName, formatPath, MESSAGE_SPELLING } from './names.js';
import { body, constantValue, displayText, entryDeadline, entryPeriod, isExecutable, LIBRARY_2_3_URI, localOperation, members, nodes, occurrenceCount, occurrences, owner, resolve, schedule, signature, workspaceModels, OCCURRENCE_LIMIT, type Executable, type Occurrence, type Structure } from './semantic.js';
/**
 * Operation placement, Swaml::Os tasks and the static task rules of swa.ml 2.3 (WP8, ADR 0025): one plan per
 * deployment, shared by the validator (WP8-S01 to WP8-S10), the reference run (WP8-R01) and the binding check
 * (WP8-M02, WP8-M03). Portable: no filesystem or host dependency.
 */
export type TaskKindName = 'basic' | 'extended' | 'isr';
/** The Swaml::Os role of a structure: the library's Task or Core, found through specialization and usage definitions. */
export function osRole(s: Structure | undefined): 'Task' | 'Core' | undefined {
    const seen = new Set<Structure>();
    for (let x: Structure | undefined = s; x && !seen.has(x); x = a.isComponentDef(x) ? x.specializes?.ref : x.definition?.ref) {
        seen.add(x);
        // Only the built-in declaration counts: a workspace's own Swaml::Os hides the library package (WP3-L04), and its
        // Task or Core keeps the 2.2 meaning of an ordinary Node.
        if (a.isComponentDef(x) && (x.name === 'Task' || x.name === 'Core') && owner(x, a.isPackage)?.name === 'Swaml::Os' && AstUtils.getDocument(x).uri.toString() === LIBRARY_2_3_URI)
            return x.name;
    }
    return undefined;
}
/** One Swaml::Os Task occurrence of a platform with its evaluated const attributes (WP8-L01). */
export interface OsTask {
    /** The platform occurrence path, from the platform root (vehicle.doorModules[0].core1.task20ms). */
    path: string;
    occurrence: Occurrence;
    /** The path of its nearest Core ancestor, or the platform root path for the implicit Core (WP8-S03). */
    core: string;
    implicitCore: boolean;
    /** Declaration order among the platform's Tasks, depth-first, indexes ascending. */
    rank: number;
    kind?: TaskKindName;
    priority?: bigint;
    preemptive?: boolean;
    periodNs?: bigint;
    responseNs?: bigint;
    /** Attributes whose effective value is not a constant of the right kind (WP8-D11). */
    problems: { attribute: string; node?: AstNode }[];
}
export interface PlacementInfo {
    node: a.Placement;
    /** Position of the deploy statement in its deployment. */
    index: number;
    /** The software path from the deployed root (root.name or root.name.target). */
    path: string;
    kind: 'occurrence' | 'operation' | 'unknown';
    /** For an operation placement: the occurrence or multiplicity family path, and the operation name. */
    prefix?: string;
    operation?: string;
    /** An unknown path that names an operation of an occurrence that no effective schedule entry releases (WP8-D01). */
    unreleased?: { occurrence: string; operation: string };
    /** The platform target, when it is a Node occurrence. */
    target?: Occurrence;
    task?: OsTask;
    /** The Core the target reaches (WP8-S10): explicit, or the implicit Core of a Task without a Core ancestor. */
    core?: string;
}
export interface EntryPlacement {
    occurrence: Occurrence;
    entry: a.ScheduleEntry;
    /** Index of the occurrence in the deployed tree, depth-first, indexes ascending. */
    occurrenceIndex: number;
    /** Index of the entry in the occurrence's effective schedule order (schedule()). */
    scheduleIndex: number;
    /** The effective placement (WP8-S02), if any. */
    placement?: PlacementInfo;
    task?: OsTask;
    core?: string;
    /** The in-task position, 0-based (WP8-M01), for an entry on a Task. */
    position?: number;
}
export interface DeploymentPlan {
    deployment: a.Deployment;
    root: a.ComponentUsage;
    platform: a.ComponentUsage;
    software: Occurrence[];
    platformOccurrences: Occurrence[];
    tasks: OsTask[];
    /** T1 to T6 apply (WP8-S04): the platform tree contains a Swaml::Os Task. */
    taskRules: boolean;
    /** T7 applies: the platform tree contains a Swaml::Os Core or Task. */
    coreRule: boolean;
    placements: PlacementInfo[];
    entries: EntryPlacement[];
    /** The entries of each software occurrence, in schedule order. */
    byOccurrence: Map<Occurrence, EntryPlacement[]>;
    /** Software occurrences by path. */
    occurrenceAt: Map<string, Occurrence>;
}
const plans = new WeakMap<a.Deployment, { key: unknown; plan: DeploymentPlan | undefined }>();
/** A family path covers its indexed members; a path covers itself. */
const covers = (prefix: string, path: string) => path === prefix || path.startsWith(prefix + '[') && /^\[\d+\]$/u.test(path.slice(prefix.length));
/** A path is within a placement's subtree: itself, a family member, or a descendant of either. */
const within = (prefix: string, path: string) => path === prefix || path.startsWith(prefix + '.') || path.startsWith(prefix + '[');
/**
 * The placement plan of one deployment (WP8-S01 to WP8-S03, WP8-M01): each deploy statement resolved to an
 * occurrence or operation placement, every Swaml::Os Task of the platform with its Core and attributes, and the
 * effective placement, Task, Core and in-task position of every effective schedule entry of the deployed tree.
 * Undefined when the root or platform does not resolve or exceeds the occurrence limit. Computed once per
 * deployment and workspace state (the deployment node, its root and platform references and the models).
 */
export function deploymentPlan(d: a.Deployment): DeploymentPlan | undefined {
    const model = AstUtils.getDocument(d).parseResult.value as a.Model;
    const key = workspaceModels.get(model) ?? model;
    const known = plans.get(d);
    if (known && known.key === key && known.plan?.root === d.root.ref && known.plan?.platform === d.platform.ref)
        return known.plan;
    const plan = computePlan(d);
    plans.set(d, { key, plan });
    return plan;
}
function computePlan(d: a.Deployment): DeploymentPlan | undefined {
    const root = d.root?.ref, platform = d.platform?.ref;
    if (!root || !platform || !root.name || !platform.name || occurrenceCount(root) > OCCURRENCE_LIMIT || occurrenceCount(platform) > OCCURRENCE_LIMIT)
        return undefined;
    const software = occurrences(root), platformOccurrences = occurrences(platform);
    const byPath = new Map(platformOccurrences.map(o => [o.path, o]));
    const roles = new Map(platformOccurrences.map(o => [o.path, osRole(o.structure)]));
    const nearest = (path: string | undefined, role: 'Task' | 'Core'): string | undefined => {
        for (let p = path; p !== undefined; p = byPath.get(p)?.parent)
            if (roles.get(p) === role)
                return p;
        return undefined;
    };
    const tasks: OsTask[] = platformOccurrences.filter(o => roles.get(o.path) === 'Task').map((o, rank) => {
        const core = nearest(o.parent, 'Core');
        return { path: o.path, occurrence: o, core: core ?? platform.name, implicitCore: !core, rank, problems: [], ...taskAttributes(o.structure) };
    });
    for (const t of tasks)
        t.problems = taskProblems(t);
    const taskAt = new Map(tasks.map(t => [t.path, t]));
    const placements: PlacementInfo[] = (d.placements ?? []).map((p, index) => {
        const path = p.target ? `${root.name}.${p.target}` : root.name;
        const target = p.node !== undefined ? byPath.get(`${platform.name}.${p.node}`) : undefined;
        const taskPath = target && nearest(target.path, 'Task'), task = taskPath ? taskAt.get(taskPath) : undefined;
        const core = task ? task.core : target && nearest(target.path, 'Core');
        const info: PlacementInfo = { node: p, index, path, kind: 'unknown', target, task, core };
        if (!p.target || software.some(o => covers(path, o.path)))
            return { ...info, kind: 'occurrence' };
        const dot = path.lastIndexOf('.'), prefix = path.slice(0, dot), operation = path.slice(dot + 1);
        const owners = dot > 0 && !operation.includes('[') ? software.filter(o => covers(prefix, o.path)) : [];
        if (!owners.length)
            return info;
        // Every member of a family has the same structure, so one member decides whether an entry releases the operation.
        if (schedule(owners[0].structure).some(e => e.operation === operation))
            return { ...info, kind: 'operation', prefix, operation };
        if (members(owners[0].structure).some(m => isExecutable(m) && m.name === operation))
            return { ...info, unreleased: { occurrence: prefix, operation } };
        return info;
    });
    const entries: EntryPlacement[] = [];
    software.forEach((o, occurrenceIndex) => schedule(o.structure).forEach((entry, scheduleIndex) => {
        // WP8-S02: an operation placement overrides every occurrence placement; an indexed path overrides its family.
        const byOperation = placements.filter(p => p.kind === 'operation' && p.operation === entry.operation && covers(p.prefix!, o.path));
        const byOccurrence = placements.filter(p => p.kind === 'occurrence' && within(p.path, o.path));
        const longest = (list: PlacementInfo[]) => list.reduce<PlacementInfo | undefined>((best, p) => !best || (p.prefix ?? p.path).length > (best.prefix ?? best.path).length ? p : best, undefined);
        const placement = longest(byOperation) ?? longest(byOccurrence);
        entries.push({ occurrence: o, entry, occurrenceIndex, scheduleIndex, placement, task: placement?.task, core: placement?.core });
    }));
    // WP8-M01: deploy statement order, then the deployed tree depth-first, then schedule order.
    for (const t of tasks)
        entries.filter(e => e.task === t)
            .sort((x, y) => x.placement!.index - y.placement!.index || x.occurrenceIndex - y.occurrenceIndex || x.scheduleIndex - y.scheduleIndex)
            .forEach((e, position) => e.position = position);
    const taskRules = tasks.length > 0, coreRule = taskRules || [...roles.values()].includes('Core');
    const byOccurrence = new Map<Occurrence, EntryPlacement[]>();
    for (const e of entries)
        (byOccurrence.get(e.occurrence) ?? byOccurrence.set(e.occurrence, []).get(e.occurrence)!).push(e);
    return { deployment: d, root, platform, software, platformOccurrences, tasks, taskRules, coreRule, placements, entries, byOccurrence, occurrenceAt: new Map(software.map(o => [o.path, o])) };
}
/** The entries of the same occurrence whose completion releases an after entry (its predecessor operation's entries). */
export function predecessors(plan: DeploymentPlan, e: EntryPlacement): EntryPlacement[] {
    return e.entry.kind === 'after' ? (plan.byOccurrence.get(e.occurrence) ?? []).filter(x => x.entry.operation === e.entry.predecessor) : [];
}
const TASK_ATTRIBUTES =['kind', 'priority', 'preemptive', 'periodNs', 'responseNs'] as const;
function taskAttributes(s: Structure): Pick<OsTask, 'kind' | 'priority' | 'preemptive' | 'periodNs' | 'responseNs'> {
    const value = (name: string) => members(s).filter(a.isAttribute).find(x => x.name === name);
    const uint = (name: string) => { const x = value(name); const v = x?.constant && x.value ? constantValue(x.value, s).value : undefined; return typeof v === 'bigint' && v >= 0n && v <= BigInt(Number.MAX_SAFE_INTEGER) ? v : undefined; };
    const flag = value('preemptive'), preemptive = flag?.constant && flag.value ? constantValue(flag.value, s).value : undefined;
    const kindAttribute = value('kind'), kind = kindAttribute?.constant && kindAttribute.value ? taskKind(kindAttribute.value, s, new Set()) : undefined;
    return { kind, priority: uint('priority'), preemptive: typeof preemptive === 'boolean' ? preemptive : undefined, periodNs: uint('periodNs'), responseNs: uint('responseNs') };
}
/** The TaskKind literal an effective const initializer denotes: TaskKind.isr, a const attribute holding one, or a constant conditional. */
function taskKind(e: a.Expression, s: Structure, seen: Set<a.Attribute>): TaskKindName | undefined {
    if (a.isReferenceExpression(e) && !e.index && !e.selectors?.length) {
        const parts = e.path.split('.');
        if (parts.length === 2 && /(^|::)TaskKind$/u.test(parts[0]))
            return (['basic', 'extended', 'isr'] as const).find(k => k === parts[1]);
        const attribute = parts.length === 1 ? members(s).filter(a.isAttribute).find(x => x.name === e.path && x.constant) : undefined;
        if (!attribute?.value || seen.has(attribute))
            return undefined;
        seen.add(attribute);
        return taskKind(attribute.value, s, seen);
    }
    if (a.isConditionalExpression(e)) {
        const c = constantValue(e.condition, s).value;
        return typeof c === 'boolean' ? taskKind(c ? e.then : e.otherwise, s, seen) : undefined;
    }
    return undefined;
}
function taskProblems(t: OsTask): OsTask['problems'] {
    const attribute = (name: string) => members(t.occurrence.structure).filter(a.isAttribute).find(x => x.name === name);
    return TASK_ATTRIBUTES.filter(name => t[name] === undefined).map(name => ({ attribute: name, node: attribute(name) }));
}
/** A duration in nanoseconds in its largest exact unit: 20ms, 500us, 7ns. */
export function durationText(ns: bigint | number): string {
    const v = BigInt(ns);
    for (const [unit, scale] of [['s', 1000000000n], ['ms', 1000000n], ['us', 1000n]] as const)
        if (v !== 0n && v % scale === 0n)
            return `${v / scale}${unit}`;
    return `${v}ns`;
}
/** An entry as WP8 diagnostics name it, in the 2.2 spelling: on every 20ms poll, on receive can.rx store, after poll send. */
export function entryLabel(e: a.ScheduleEntry): string {
    const name = (x: string | undefined) => formatName(x ?? '', MESSAGE_SPELLING);
    const trigger = e.kind === 'every' ? `on every ${e.periodValue ? `(${displayText(e.periodValue, MESSAGE_SPELLING)})` : e.period ? `${e.period.value}${e.period.unit}` : ''}` : e.kind === 'after' ? `after ${name(e.predecessor)}` : e.kind === 'start' ? 'on start' : `on ${e.kind} ${formatPath(e.endpoint ?? '', MESSAGE_SPELLING)}`;
    return `${trigger} ${name(e.operation)}`;
}
/** A path in the 2.2 spelling of diagnostics. */
export const pathText = (path: string) => formatPath(path, MESSAGE_SPELLING);
/** A Core as diagnostics name it. */
export const coreText = (plan: DeploymentPlan, core: string) => core === plan.platform.name && osRole(plan.platform) !== 'Core' ? `the implicit core of ${pathText(core)}` : pathText(core);
/**
 * Where an activation of op may suspend, apart from the idle selection of a machine (WP8-S08, T4): the first
 * statement of op's own code that waits, receives, makes a request (a dotted call) or calls an operation that may
 * suspend in the same sense. A machine's transitions (its idle wait between reactions) are not suspension points;
 * its entry, exit and effect statements are ordinary statements. The rule is stated on this property, not on the
 * state syntax: any form whose reactions run to completion is accepted on a basic Task.
 */
export function suspendSite(op: Executable, c: Structure | undefined, seen = new Set<Executable>()): AstNode | undefined {
    if (seen.has(op))
        return undefined;
    seen.add(op);
    const b = body(op);
    if (!b)
        return undefined;
    const own = op.body ? op : signature(op);
    for (const n of nodes(b)) {
        if (owner(n, isExecutable) !== own || a.isTransition(n) || owner(n, a.isTransition) && !owner(n, a.isBlock))
            continue;
        if (a.isWait(n) || a.isReceive(n))
            return n;
        if (a.isCallExpression(n)) {
            if (n.target.includes('.'))
                return statementOf(n);
            const model = AstUtils.getDocument(n).parseResult.value as a.Model;
            const target = localOperation(n, n.target, c) ?? resolve(n, n.target, workspaceModels.get(model) ?? [model]);
            if (target && isExecutable(target) && suspendSite(target, c, seen))
                return statementOf(n);
        }
    }
    return undefined;
}
const statementOf = (n: AstNode): AstNode => { let s: AstNode = n; while (s.$container && !a.isBlock(s.$container) && !a.isOperationBody(s.$container) && !isExecutable(s.$container)) s = s.$container; return s; };
/** The source text of a statement for diagnostics: whitespace collapsed, at most 60 characters, without the final semicolon. */
export function statementText(n: AstNode): string {
    const text = (n.$cstNode?.text ?? n.$type).replace(/\s+/gu, ' ').trim();
    const head = a.isReceive(n) ? text.replace(/\s*\{.*$/u, '') : text.replace(/;$/u, '');
    return head.length > 60 ? head.slice(0, 57) + '...' : head;
}
