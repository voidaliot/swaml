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
    problems: { attribute: string; node?: AstNode; tooLarge?: boolean }[];
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
    /**
     * A target in no Core whose subtree contains a Core that has Tasks (an ECU Node with OS Cores): the target's
     * platform path. Its entries are in the task rules and need a Task of one of those Cores (WP8-S04, T6).
     */
    region?: string;
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
    /** The Core its placement reaches (WP8-S03); undefined when unplaced or on a Node outside every Core. */
    core?: string;
    /** The Node with tasked Cores below it that its placement targets when that target is in no Core (WP8-S04). */
    region?: string;
    /** The in-task position, 0-based (WP8-M01), for an entry on a Task. */
    position?: number;
}
export interface DeploymentPlan {
    deployment: a.Deployment;
    root: a.ComponentUsage;
    platform: a.ComponentUsage;
    software: Occurrence[];
    platformOccurrences: Occurrence[];
    /** The Swaml::Os Task occurrences of the platform below its root, in declaration rank. */
    tasks: OsTask[];
    /** The platform root itself is a Swaml::Os Task (WP8-D13); no task rule applies then. */
    rootTask: boolean;
    /** Some Task lies in the platform tree below its root, so T1 to T6 can apply (WP8-S04). */
    taskRules: boolean;
    /** T7 applies: the platform tree contains a Swaml::Os Core or Task. */
    coreRule: boolean;
    /** The Cores that own at least one Task (explicit Core paths, or the platform root path for the implicit Core). */
    taskedCores: Set<string>;
    /** The Core of the platform root: the root itself when it is a Core, the implicit Core when there is one, else undefined. */
    rootCore?: string;
    /** The platform root path when it is in no Core and Cores with Tasks lie below it (WP8-S04): unplaced software is in the task rules. */
    rootRegion?: string;
    placements: PlacementInfo[];
    /** Computed on first use: a deployment on a platform without Swaml::Os needs only its placements. */
    entries: EntryPlacement[];
    /** The entries of each software occurrence, in schedule order. */
    byOccurrence: Map<Occurrence, EntryPlacement[]>;
    /**
     * The Core each software occurrence is deployed in (WP8-S04): the Core of its effective occurrence placement; for
     * an occurrence without one, the first Core its operation placements reach in schedule order; otherwise the Core
     * of the platform root. Undefined on a Node outside every Core.
     */
    occurrenceCore: Map<Occurrence, string | undefined>;
    /**
     * For an occurrence in no Core (WP8-S04): the Node it is deployed on (its effective occurrence placement target, or
     * the platform root without one) when Cores with Tasks lie below that Node. Undefined on a Node without tasked Cores
     * below it, which keeps the 2.2 meaning.
     */
    occurrenceRegion: Map<Occurrence, string | undefined>;
    /** Software occurrences by path. */
    occurrenceAt: Map<string, Occurrence>;
}
const plans = new WeakMap<a.Deployment, { key: unknown; plan: DeploymentPlan | undefined }>();
/** The multiplicity family path of an indexed path (a.b[2] gives a.b), or undefined. */
const familyOf = (path: string): string | undefined => { const m = /^(.*)\[\d+\]$/u.exec(path); return m ? m[1] : undefined; };
/**
 * The placement plan of one deployment (WP8-S01 to WP8-S04, WP8-M01): each deploy statement resolved to an
 * occurrence or operation placement, every Swaml::Os Task of the platform with its Core and attributes, and the
 * effective placement, Task, Core and in-task position of every effective schedule entry of the deployed tree.
 * Undefined when the root or platform does not resolve or exceeds the occurrence limit. Computed once per
 * deployment and workspace state (the deployment node, its root and platform references and the models), in time
 * linear in occurrences, entries and placements (each lookup walks the occurrence's ancestors); the entries are
 * computed only when first read.
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
    // WP8-D13: the platform root is never a Task; a Task needs a Core or Node above it.
    const rootTask = roles.get(platform.name) === 'Task';
    const tasks: OsTask[] = rootTask ? [] : platformOccurrences.filter(o => roles.get(o.path) === 'Task').map((o, rank) => {
        const core = nearest(o.parent, 'Core');
        return { path: o.path, occurrence: o, core: core ?? platform.name, implicitCore: !core, rank, problems: [], ...taskAttributes(o.structure) };
    });
    for (const t of tasks)
        t.problems = taskProblems(t);
    const taskAt = new Map(tasks.map(t => [t.path, t]));
    const implicit = tasks.some(t => t.implicitCore);
    const taskedCores = new Set(tasks.map(t => t.core));
    // WP8-S03: the Core of a placement target: its Task's Core, else its nearest Core, else the implicit Core when the
    // platform has one (it spans the platform tree outside the explicit Cores), else none.
    const coreOf = (target: Occurrence) => {
        const taskPath = nearest(target.path, 'Task'), task = taskPath ? taskAt.get(taskPath) : undefined;
        return task ? task.core : nearest(target.path, 'Core') ?? (implicit ? platform.name : undefined);
    };
    const rootCore = rootTask ? undefined : coreOf(byPath.get(platform.name)!);
    // WP8-S04: a target in no Core that contains a Core with Tasks (an ECU Node) is not outside the task rules.
    const regionOf = (target: Occurrence) => !rootTask && coreOf(target) === undefined && [...taskedCores].some(c => c.startsWith(`${target.path}.`) || c.startsWith(`${target.path}[`)) ? target.path : undefined;
    const rootRegion = rootTask ? undefined : regionOf(byPath.get(platform.name)!);
    const softwareAt = new Map(software.map(o => [o.path, o]));
    const families = new Map<string, Occurrence[]>();
    for (const o of software) {
        const family = familyOf(o.path);
        if (family !== undefined)
            (families.get(family) ?? families.set(family, []).get(family)!).push(o);
    }
    // A path names an occurrence, or a multiplicity family when the family is its last occurrence segment (WP8-S02).
    const owners = (path: string): Occurrence[] => { const o = softwareAt.get(path); return o ? [o] : families.get(path) ?? []; };
    const placements: PlacementInfo[] = (d.placements ?? []).map((p, index) => {
        const path = p.target ? `${root.name}.${p.target}` : root.name;
        const target = p.node !== undefined ? byPath.get(`${platform.name}.${p.node}`) : undefined;
        const taskPath = target && !rootTask ? nearest(target.path, 'Task') : undefined, task = taskPath ? taskAt.get(taskPath) : undefined;
        const info: PlacementInfo = { node: p, index, path, kind: 'unknown', target, task, core: target && !rootTask ? coreOf(target) : undefined, region: target ? regionOf(target) : undefined };
        if (!p.target || owners(path).length)
            return { ...info, kind: 'occurrence' };
        const dot = path.lastIndexOf('.'), prefix = path.slice(0, dot), operation = path.slice(dot + 1);
        const addressed = dot > 0 && !operation.includes('[') ? owners(prefix) : [];
        if (!addressed.length)
            return info;
        // Every member of a family has the same structure, so one member decides whether an entry releases the operation.
        if (schedule(addressed[0].structure).some(e => e.operation === operation))
            return { ...info, kind: 'operation', prefix, operation };
        if (members(addressed[0].structure).some(m => isExecutable(m) && m.name === operation))
            return { ...info, unreleased: { occurrence: prefix, operation } };
        return info;
    });
    let derived: Pick<DeploymentPlan, 'entries' | 'byOccurrence' | 'occurrenceCore' | 'occurrenceRegion'> | undefined;
    const derive = () => derived ??= planEntries(software, softwareAt, placements, rootCore, rootRegion);
    const taskRules = tasks.length > 0, coreRule = !rootTask && (taskRules || [...roles.values()].includes('Core'));
    return {
        deployment: d, root, platform, software, platformOccurrences, tasks, rootTask, taskRules, coreRule, taskedCores, rootCore, rootRegion, placements,
        get entries() { return derive().entries; }, get byOccurrence() { return derive().byOccurrence; }, get occurrenceCore() { return derive().occurrenceCore; }, get occurrenceRegion() { return derive().occurrenceRegion; },
        occurrenceAt: softwareAt,
    };
}
/** The entries of a plan (WP8-S02, WP8-M01) and the Core of each occurrence (WP8-S04), from indexes of the placements by path. */
function planEntries(software: Occurrence[], softwareAt: Map<string, Occurrence>, placements: PlacementInfo[], rootCore: string | undefined, rootRegion: string | undefined): Pick<DeploymentPlan, 'entries' | 'byOccurrence' | 'occurrenceCore' | 'occurrenceRegion'> {
    // The first placement of each exact path; a duplicate is an error (WP8-D09) and the first one wins.
    const byOperation = new Map<string, PlacementInfo>(), byPath = new Map<string, PlacementInfo>();
    for (const p of placements) {
        if (p.kind === 'operation' && !byOperation.has(`${p.prefix}\u0000${p.operation}`))
            byOperation.set(`${p.prefix}\u0000${p.operation}`, p);
        if (p.kind === 'occurrence' && !byPath.has(p.path))
            byPath.set(p.path, p);
    }
    // The most specific occurrence placement: the occurrence, its family, then each ancestor and its family.
    const occurrencePlacement = new Map<string, PlacementInfo | undefined>();
    const ofOccurrence = (path: string): PlacementInfo | undefined => {
        if (occurrencePlacement.has(path))
            return occurrencePlacement.get(path);
        const family = familyOf(path), parent = softwareAt.get(path)?.parent;
        const found = byPath.get(path) ?? (family !== undefined ? byPath.get(family) : undefined) ?? (parent !== undefined ? ofOccurrence(parent) : undefined);
        occurrencePlacement.set(path, found);
        return found;
    };
    const entries: EntryPlacement[] = [], byOccurrence = new Map<Occurrence, EntryPlacement[]>(), occurrenceCore = new Map<Occurrence, string | undefined>(), occurrenceRegion = new Map<Occurrence, string | undefined>();
    software.forEach((o, occurrenceIndex) => {
        const family = familyOf(o.path), own: EntryPlacement[] = [], occurrence = ofOccurrence(o.path);
        schedule(o.structure).forEach((entry, scheduleIndex) => {
            // WP8-S02: an operation placement overrides every occurrence placement; an indexed path overrides its family.
            const placement = byOperation.get(`${o.path}\u0000${entry.operation}`) ?? (family !== undefined ? byOperation.get(`${family}\u0000${entry.operation}`) : undefined) ?? occurrence;
            own.push({ occurrence: o, entry, occurrenceIndex, scheduleIndex, placement, task: placement?.task, core: placement?.core, region: placement?.region });
        });
        entries.push(...own);
        byOccurrence.set(o, own);
        const core = occurrence ? occurrence.core : own.find(e => e.core !== undefined)?.core ?? rootCore;
        occurrenceCore.set(o, core);
        occurrenceRegion.set(o, core !== undefined ? undefined : occurrence ? occurrence.region : rootRegion);
    });
    // WP8-M01: deploy statement order, then the deployed tree depth-first, then schedule order.
    const onTask = new Map<OsTask, EntryPlacement[]>();
    for (const e of entries)
        if (e.task)
            (onTask.get(e.task) ?? onTask.set(e.task, []).get(e.task)!).push(e);
    for (const list of onTask.values())
        list.sort((x, y) => x.placement!.index - y.placement!.index || x.occurrenceIndex - y.occurrenceIndex || x.scheduleIndex - y.scheduleIndex)
            .forEach((e, position) => e.position = position);
    return { entries, byOccurrence, occurrenceCore, occurrenceRegion };
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
    // A uint constant above 2^53 - 1 is a constant of its type but outside the range a run can order by (WP8-D11).
    const tooLarge = (x: a.Attribute | undefined) => { const v = x?.constant && x.value ? constantValue(x.value, t.occurrence.structure).value : undefined; return typeof v === 'bigint' && v > BigInt(Number.MAX_SAFE_INTEGER); };
    return TASK_ATTRIBUTES.filter(name => t[name] === undefined).map(name => { const node = attribute(name); return tooLarge(node) ? { attribute: name, node, tooLarge: true } : { attribute: name, node }; });
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
const statementOf = (n: AstNode): AstNode => { let s: AstNode = n; while (s.$container && !a.isBlock(s.$container) && !a.isElseIf(s.$container) && !a.isOperationBody(s.$container) && !isExecutable(s.$container)) s = s.$container; return s; };
/** The source text of a statement for diagnostics: whitespace collapsed, at most 60 characters, without the final semicolon. */
export function statementText(n: AstNode): string {
    const text = (n.$cstNode?.text ?? n.$type).replace(/\s+/gu, ' ').trim();
    const head = a.isReceive(n) ? text.replace(/\s*\{.*$/u, '') : text.replace(/;$/u, '');
    return head.length > 60 ? head.slice(0, 57) + '...' : head;
}
