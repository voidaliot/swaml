import { AstUtils, DocumentState, type AstNode } from 'langium';
import * as a from '../language/generated/ast.js';
import { SWAML_REFERENCE_PROFILE } from '../language/edition.js';
import { deploymentPlan } from '../language/placement.js';
import { flowStates, innerStates, stateItems, inputEndpoints, memberQos, sampledMembers, sampledReadForm, LIBRARY_2_3_URI, libraryIntrinsic, type LibraryIntrinsic, caseRead, caseTarget, isPlace, placeRoot, valueSteps, executableCase, softwareRoots, expressionTypes, workspaceModels, body, container, direction, effectiveQos, endpoint, identity, isExecutable, localOperation, memberEndpoint, members, nanos, nodes, occurrences, owner, packageEndpoint, portMembers, resolve, runTarget, schedule, signature, statementIdentity, typeKey, entryPeriod, entryDeadline, type Executable, type Policy, type RunTarget, type Structure } from '../language/semantic.js';
import { binary, bind, checked, ContractViolation, copy, intText, plain, realText, RuntimeFault, scalar, squareRoot, voidValue, widen, type Environment, type Value } from './values.js';
export { projectOperationTiming } from './timing.js';
export interface SimulationOptions {
    untilNs: number;
    maxSteps?: number;
    maxPending?: number;
    maxConcurrent?: number;
    latencyNs?: number;
    faults?: {
        offer: number;
        kind: 'drop' | 'duplicate' | 'transport';
        delayNs?: number;
    }[];
}
const OPTION_KEYS = ['untilNs', 'maxSteps', 'maxPending', 'maxConcurrent', 'latencyNs', 'faults'];
const FAULT_KEYS = ['offer', 'kind', 'delayNs'];
/**
 * Why options are not valid simulation options, or undefined when they are. With partial, untilNs may be
 * omitted (options that are completed by defaults elsewhere, such as an example's own options).
 */
export function simulationOptionsProblem(options: unknown, partial = false): string | undefined {
    if (!options || typeof options !== 'object' || Array.isArray(options))
        return 'Simulation options must be an object';
    const o = options as Record<string, unknown>;
    for (const k of Object.keys(o))
        if (!OPTION_KEYS.includes(k))
            return `Unknown simulation option ${k}`;
    for (const k of ['untilNs', 'maxSteps', 'maxPending', 'maxConcurrent', 'latencyNs']) {
        const v = o[k];
        if (v === undefined && (k !== 'untilNs' || partial))
            continue;
        if (!Number.isSafeInteger(v) || (v as number) < (k === 'untilNs' || k === 'latencyNs' ? 0 : 1))
            return `Invalid ${k}`;
    }
    if (o.faults === undefined)
        return undefined;
    if (!Array.isArray(o.faults))
        return 'Invalid fault';
    const seen = new Set<number>();
    for (const f of o.faults as Record<string, unknown>[]) {
        if (!f || typeof f !== 'object' || Object.keys(f).some(k => !FAULT_KEYS.includes(k)) || !Number.isSafeInteger(f.offer) || (f.offer as number) < 1 || seen.has(f.offer as number) || !['drop', 'duplicate', 'transport'].includes(f.kind as string) || f.delayNs !== undefined && (!Number.isSafeInteger(f.delayNs) || (f.delayNs as number) < 0))
            return 'Invalid fault';
        seen.add(f.offer as number);
    }
    return undefined;
}
export interface TraceEvent {
    timeNs: number;
    ordinal: number;
    kind: string;
    subject: string;
    /** The statementIdentity of the statement or schedule entry that caused this observation, when one did. */
    source?: string;
    [key: string]: unknown;
}
/** The execution profile this reference interpreter implements; recorded by every run and test report. */
export const REFERENCE_PROFILE = SWAML_REFERENCE_PROFILE;
export interface SimulationResult {
    profile: typeof REFERENCE_PROFILE;
    /** What ran: a whole package context, or one top-level component alone with its ports open. */
    target: {
        kind: 'package' | 'component';
        identity: string;
    };
    options: SimulationOptions;
    outcome: 'failure-observed' | 'no-failure-observed';
    /** stopped: a case run ended when its script completed or failed. */
    status: 'quiescent' | 'horizon' | 'violation' | 'limit' | 'stopped';
    timeNs: number;
    steps: number;
    sources: {
        uri: string;
        text: string;
    }[];
    trace: TraceEvent[];
    stores: Record<string, Record<string, unknown>>;
    machines: Record<string, {
        state: string;
        live: boolean;
    }>;
    deployments: Record<string, string | null>;
}
type Reply = {
    value?: Value;
    out?: Value[];
    failure?: string;
    input?: Message;
    branch?: a.ReceiveBranch;
};
type Yield = {
    kind: 'step';
} | {
    kind: 'wait';
    duration: number;
    /** The evaluated value of a computed wait, recorded on its wait observation (WP4-T01). */
    durationNs?: number;
} | {
    kind: 'request';
    endpoint: string;
    site?: a.CallExpression;
    args: Value[];
} | {
    kind: 'receive';
    branches: a.ReceiveBranch[];
    timeout?: number;
    /** A state of an operation with states waits (SIF-R05); named: the members its levels name. */
    flow?: { named: Set<string> };
    /** The zero-time wait of SIF-R05 step 3: it ends at an event of the same instant, which picks the message again. */
    zero?: boolean;
    /** The evaluated value of a computed receive timeout, recorded on its receiveWait observation (WP4-T01). */
    durationNs?: number;
};
/**
 * WP4-R01: a computed duration is checked as an integer before any widening to uint. A value that is not positive
 * or not a safe integer number of nanoseconds is the runtime failure DurationRange, never Bounds.
 */
function durationValue(v: Value): number {
    if (typeof v.data !== 'number' || !Number.isSafeInteger(v.data) || v.data <= 0)
        throw new RuntimeFault('DurationRange', `Duration ${String(v.data)} ns is not a positive representable duration`);
    return v.data;
}
/**
 * Whether an expression belongs to the computed duration of a wait, receive timeout or state timer, through
 * operators and call arguments but not into a called body: integer overflow there is DurationRange (WP4-R01).
 */
function inDuration(e: a.Expression): boolean {
    let root: AstNode = e;
    while (root.$container && a.isExpression(root.$container))
        root = root.$container;
    const p = root.$containerProperty;
    return a.isWait(root.$container) && p === 'delay' || a.isReceive(root.$container) && p === 'timeoutValue' || a.isEventLine(root.$container) && p === 'delayValue';
}
type Iterator = Generator<Yield, Value, Reply | undefined>;
/**
 * An out value that was never assigned (an unanswered on call out binding, copied back to its caller) is a
 * placeholder without fields or elements; selecting into it is the runtime failure Type, not a host error.
 */
function unassigned(v: Value | undefined, path: string): asserts v is Value {
    if (!v || v.data === null || typeof v.data !== 'object')
        throw new RuntimeFault('Type', `${path} has no assigned value to select from`);
}
type Component = {
    path: string;
    structure: Structure;
    store: Environment;
    lock?: Frame;
};
type Frame = {
    id: string;
    c: Component;
    op: Executable;
    entry: a.ScheduleEntry;
    released: number;
    iterator: Iterator;
    snapshot: Environment;
    done: boolean;
    suspended: boolean;
    started: boolean;
    reply?: Reply;
    correlation?: Correlation;
    waiting?: Yield;
    token: number;
    watches: Watch[];
    interrupted?: InterruptSignal;
    request?: Correlation;
    /** The node being executed, for statement identities of observations; any node inside a statement. */
    at?: AstNode;
    /** The case whose script this activation runs, acting at the ports of its associated actors. */
    script?: a.Scenario;
    /** Why the activation failed: the runtime code and its message. */
    failure?: { code: string; message: string };
    /** Current operation's parameter values, retained only for successful out copy-back. */
    out?: Value[];
    /**
     * Sample-cell values this activation has read since it last started or resumed (WP6-R03): activations of other
     * occurrences interleave by step, so a delivery between two reads of one segment must not change what it sees.
     */
    sampled?: Map<string, Value>;
    /**
     * Set when the release guard was false (WP7-R02): the activation ends as a skip, not a completion, and still counts
     * as a successful whole completion for after successors (WP7-R03). A receive entry's consumed input is kept here to
     * be discarded with reason releaseGuard (WP7-R04).
     */
    skipped?: { input?: Message };
    /** WP8-R01: the ordering key of an activation on a Swaml::Os Task; absent for unplaced and case-script activations. */
    key?: RunKey;
    /** A jump into a state inside the state about to be reached (direct entry, SIF-R09), and the leave that led there. */
    flowTarget?: string;
    flowTrigger?: AstNode;
    /** Statements run so far by the event line block that runs now (SIF-R06, SIF-T02); a false if test is no work. */
    lineWork?: number;
};
/** The state levels of an operation with states: each entered state, outermost first (SIF-R01, SIF-R11). */
type FlowLevel = {
    state: a.StateStep;
    /** The arrival time, from which its timers count (SIF-R01 step 2). */
    entered: number;
    /** Computed timer durations, evaluated once at arrival (SIF-R01 step 4). */
    delays: Map<a.EventLine, number>;
    /** Timers already present at a look of this arrival (SIF-R03): each is present at exactly one look per arrival. */
    presented: Set<a.EventLine>;
};
/** What is present at a look (SIF-R03) and what caused it. */
type Present = { input?: Message; timers: boolean; cause: 'arrival' | 'message' | 'timer' };
/** exit; or to S; run by a look (SIF-R09). */
class LeaveSignal {
    constructor(public node: a.Exit | a.Jump) { }
}
/** A jump out of every state of the machine, unwinding to the statement list that contains its target (SIF-R09, SIF-R10). */
class JumpSignal {
    constructor(public target: string, public node: a.Jump) { }
}
type Watch = {
    node: a.Interruptible;
    frame: Frame;
    active: boolean;
};
class ReturnValue {
    constructor(public value: Value) { }
}
class InterruptSignal {
    constructor(public watch: Watch, public message: Message) { }
}
type Route = {
    id: string;
    endpoints: [
        string,
        string
    ];
    policy: Policy;
    /** The effective policy of each member that has a member policy (WP6-R05); other members use policy. */
    members?: Map<string, Policy>;
};
/**
 * A sample cell of one port occurrence and sampled member (WP6-R01): the latest delivered value, and offer the offer
 * number of the message that carried it (0 for the initial value). A delivery of an older offer leaves it unchanged
 * (WP6-R02, owner decision B of WP6).
 */
type SampleCell = { value: Value; type: string; consumed: boolean; offer: number };
/** The member policies of a connection as effective policies per member (WP6-R05); none for a 2.2 connection. */
function routeMembers(l: a.Connect): { members?: Map<string, Policy> } {
    const complete = l.memberPolicies.filter(mp => mp.member !== undefined && mp.policy?.ref);
    return complete.length ? { members: new Map(complete.map(mp => [mp.member, memberQos(l, mp.member)] as const)) } : {};
}
type Message = {
    id: string;
    route: Route;
    source: string;
    target: string;
    /** Statement identity of the emitting send or publish, or of the call a request or reply belongs to. */
    origin?: string;
    member: string;
    args: Value[];
    emitted: number;
    correlation?: Correlation;
    kind: 'event' | 'attribute' | 'request' | 'reply';
    response?: Reply;

    /** The delivery ordinal: messages delivered earlier have smaller ones (SIF-R03 delivery order). */
    delivered?: number;
};
type Correlation = {
    id: string;
    frame: Frame;
    route: Route;
    state: 'pending' | 'succeeded' | 'failed' | 'interrupted';
    expiry: number;
    /** Statement identity of the requesting call. */
    origin?: string;
};
type Event = {
    time: number;
    phase: number;
    order: number;
    run: () => void;
    live: () => boolean;
    /** WP8-R01: the key of the activation the event releases, dispatches or resumes, when it is on a Task. */
    key?: RunKey;
};
/**
 * The ordering key of an activation on a Swaml::Os Task (WP8-R01): its Task's priority, the Task's declaration
 * rank on the platform and the entry's in-task position (WP8-M01).
 */
export type RunKey = { priority: number; rank: number; position: number; task: string; core: string };
/**
 * WP8-R01: at equal time and phase, descending Task priority (unplaced at priority 0), then activations on a Task
 * before unplaced ones of equal priority, then, on the same Task, in-task position; then the insertion ordinal. Two
 * Tasks of equal priority (on different Cores) are ordered by their declaration rank, so that the order is total
 * (owner decision WP8-B). Without Tasks every key is absent and the 2.2 order is unchanged.
 */
export const compareKeys = (x: RunKey | undefined, y: RunKey | undefined): number => {
    if (x === y)
        return 0;
    const px = x?.priority ?? 0, py = y?.priority ?? 0;
    if (px !== py)
        return py - px;
    if (!x || !y)
        return x ? -1 : y ? 1 : 0;
    return x.rank - y.rank || x.position - y.position;
};
const before = (x: Event, y: Event): boolean => x.time !== y.time ? x.time < y.time : x.phase !== y.phase ? x.phase < y.phase : (x.key || y.key ? compareKeys(x.key, y.key) || x.order - y.order : x.order - y.order) < 0;
/**
 * Pending events, ordered by time, then phase, then scheduling order; order is unique, so the order is
 * total and ties keep the order in which they were scheduled. A binary heap makes each step logarithmic
 * in the pending events. Dead events (live() false) are skipped when they reach the front and compacted
 * once they outnumber the live ones: live() never becomes true again once it is false.
 */
class EventQueue {
    private heap: Event[] = [];
    private compactAt = 1024;
    get size(): number { return this.heap.length; }
    push(e: Event): void {
        const h = this.heap;
        h.push(e);
        this.up(h.length - 1);
        if (h.length > this.compactAt) {
            this.heap = h.filter(x => x.live());
            for (let i = (this.heap.length >> 1) - 1; i >= 0; i--)
                this.down(i);
            this.compactAt = Math.max(1024, 2 * this.heap.length);
        }
    }
    /** The earliest live event, after discarding dead events before it. */
    peek(): Event | undefined {
        while (this.heap.length && !this.heap[0].live())
            this.pop();
        return this.heap[0];
    }
    pop(): Event | undefined {
        const h = this.heap, top = h[0], last = h.pop();
        if (h.length && last) {
            h[0] = last;
            this.down(0);
        }
        return top;
    }
    some(test: (e: Event) => boolean): boolean { return this.heap.some(test); }
    private up(i: number): void {
        const h = this.heap, e = h[i];
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (!before(e, h[p]))
                break;
            h[i] = h[p];
            i = p;
        }
        h[i] = e;
    }
    private down(i: number): void {
        const h = this.heap, e = h[i], n = h.length;
        while (true) {
            let c = 2 * i + 1;
            if (c >= n)
                break;
            if (c + 1 < n && before(h[c + 1], h[c]))
                c++;
            if (!before(h[c], e))
                break;
            h[i] = h[c];
            i = c;
        }
        h[i] = e;
    }
}
/**
 * Runs a validated workspace. target names a package, which runs all its top-level software
 * occurrences with their package connections and deployments, or Package::component, which runs
 * that top-level occurrence alone: its package connections are absent and its ports stay open.
 */
export function simulate(models: a.Model[], target: string, options: SimulationOptions): SimulationResult {
    const selected = runTarget(models, target);
    return new Interpreter(workspace(models), selected, options).run();
}
/** Checks that a run receives a linked, validated and complete workspace; returns it with the built-in libraries. */
function workspace(models: a.Model[]): a.Model[] {
    for (const model of models) {
        const d = AstUtils.getDocument(model);
        if (d.parseResult.value!==model || d.state < DocumentState.Validated || d.diagnostics?.some(x => x.severity === 1))
            throw new Error('Simulation requires a linked, validated workspace without errors.');
    }
    const builtin = (workspaceModels.get(models[0]) ?? []).filter(m => AstUtils.getDocument(m).uri.scheme === 'builtin');
    const supplied = new Set(models);
    // The 2.3 library document (WP3-M01) joins a run, and so its result's sources, only when a supplied model
    // imports one of its packages or references one of its declarations; a run that does not use it, every
    // 2.2 run among them, keeps exactly the 2.2 workspace and sources.
    const used = new Set<a.Model>();
    const library23 = new Set(builtin.filter(m => AstUtils.getDocument(m).uri.toString() === LIBRARY_2_3_URI));
    const use = (doc: { parseResult: { value: unknown } }) => { if (library23.has(doc.parseResult.value as a.Model)) used.add(doc.parseResult.value as a.Model); };
    for (const model of models) {
        const workspace = workspaceModels.get(model) ?? models;
        for (const pkg of model.packages)
            for (const i of pkg.imports) {
                if (!i.namespace.startsWith('Swaml::') && !models.some(m => m.packages.some(p => p.name === i.namespace)))
                    throw new Error('Supply every imported application source.');
                for (const library of library23)
                    if (library.packages.some(p => p.name === i.namespace))
                        used.add(library);
            }
        for (const n of nodes(model)) {
            for (const ref of AstUtils.streamReferences(n)) {
                const target = 'ref' in ref.reference ? ref.reference.ref : undefined;
                if (target) {
                    const doc = AstUtils.getDocument(target);
                    use(doc);
                    if (doc.uri.scheme !== 'builtin' && !supplied.has(doc.parseResult.value as a.Model))
                        throw new Error('Supply every referenced application source.');
                }
            }
            if (a.isCallExpression(n) || a.isReferenceExpression(n)) {
                const path = a.isCallExpression(n) ? n.target : n.path;
                const target = path.includes('::') && resolve(n, path.split('.')[0], workspace);
                if (target) {
                    const doc = AstUtils.getDocument(target);
                    use(doc);
                    if (doc.uri.scheme !== 'builtin' && !supplied.has(doc.parseResult.value as a.Model))
                        throw new Error('Supply every qualified application source.');
                }
            }
        }
    }
    const libraries = builtin.filter(m => !library23.has(m) || used.has(m));
    return [...new Set([...models, ...libraries])];
}
/** The result of one use case or test: pass, fail, inconclusive or no checks. */
export interface CaseResult {
    /** The case identity, such as Banking::Withdraw. */
    case: string;
    kind: 'useCase' | 'test';
    /** The subject occurrence identity, such as Banking::atm, when the case names one. */
    subject?: string;
    /**
     * pass: the script completed, no assert or fail failed and the run observed no uncaught failure
     * or contract violation. A failure caught by try is not one: a passing case may carry
     * run.outcome 'failure-observed' with caught events in its trace. fail: the first failure in the
     * run, the script's own or an uncaught failure or contract violation of the run. inconclusive:
     * the run ended before the script completed without a failure, at the horizon, the step limit or
     * stalled (the script waits but no further event can occur). no checks: the case has no
     * statements and records intent only.
     */
    result: 'pass' | 'fail' | 'inconclusive' | 'no checks';
    /** For fail: Assertion, Failure, a runtime failure code, run-failure or violation. For inconclusive: horizon, limit or stalled. */
    reason?: string;
    message?: string;
    /** The statement identity where the case failed or stopped waiting, or of the observed failure. */
    source?: string;
    /** The occurrence or activation subject of an observed run failure. */
    observed?: string;
    timeNs?: number;
    /** The package run of an executable case, with its trace; absent for no checks. */
    run?: SimulationResult;
}
/** Every use case and test of the supplied application sources, in declaration order. */
export function workspaceCases(models: readonly a.Model[]): a.Scenario[] {
    return models.flatMap(m => m.packages).filter(p => AstUtils.getDocument(p).uri.scheme !== 'builtin').flatMap(p => p.elements.filter(a.isScenario));
}
/**
 * Runs one use case or test, named by its identity such as Banking::Withdraw. A case with
 * statements runs in its own fresh run of its package: the script is released after every on start
 * entry at 0 ns, acts at the ports of its associated interface-only components and the run stops
 * when the script completes or fails, or at the horizon or step limit.
 */
export function runCase(models: a.Model[], name: string, options: SimulationOptions): CaseResult {
    const matches = workspaceCases(models).filter(s => identity(s) === name);
    if (matches.length !== 1)
        throw new Error(matches.length ? `Ambiguous case ${name}.` : `Unknown case ${name}; name a use case or test as Package::Case.`);
    return caseResult(workspace(models), matches[0], options);
}
/** Runs every case of the supplied sources, optionally only one package's or one case's (by identity or name). */
export function runTests(models: a.Model[], options: SimulationOptions, select: { package?: string; case?: string } = {}): CaseResult[] {
    return [...eachTest(models, options, select)];
}
/**
 * Runs the same cases as runTests one at a time: each case runs only when the previous result has been
 * consumed, so a caller that keeps only what it reports never holds more than one case's run.
 */
export function* eachTest(models: a.Model[], options: SimulationOptions, select: { package?: string; case?: string } = {}): Generator<CaseResult> {
    const all = workspace(models), cases = workspaceCases(models).filter(s => (!select.package || owner(s, a.isPackage)!.name === select.package) && (!select.case || identity(s) === select.case || s.name === select.case));
    for (const s of cases)
        yield caseResult(all, s, options);
}
function caseResult(models: a.Model[], s: a.Scenario, options: SimulationOptions): CaseResult {
    const base: CaseResult = { case: identity(s), kind: s.kind as CaseResult['kind'], ...(s.subject?.ref ? { subject: identity(s.subject.ref) } : {}), result: 'no checks' };
    if (!executableCase(s))
        return base;
    const p = owner(s, a.isPackage)!, interpreter = new Interpreter(models, { kind: 'package', identity: p.name, package: p, roots: softwareRoots(p) }, options, s), run = interpreter.run(), f = interpreter.caseFrame;
    const fail = (reason: string, message: string, source: string | undefined, timeNs: number, extra: Partial<CaseResult> = {}): CaseResult => ({ ...base, result: 'fail', reason, message, ...(source ? { source } : {}), timeNs, ...extra, run });
    // The first failure in trace order decides: the script's own, an uncaught failure of another activation or a contract violation.
    const first = run.trace.find(t => t.kind === 'failure' || t.kind === 'violation' && run.status === 'violation');
    if (first?.kind === 'violation')
        return fail('violation', `Contract violation ${String(first.code)}.`, f && !f.done && f.at ? statementIdentity(f.at) : undefined, first.timeNs);
    if (first && f?.failure && first.activation === f.id)
        return fail(f.failure.code, f.failure.message, f.at && statementIdentity(f.at), first.timeNs);
    if (first)
        return fail('run-failure', `${first.subject} failed: ${String(first.reason)}${first.message ? ' (' + String(first.message) + ')' : ''}.`, first.source, first.timeNs, { observed: first.subject });
    if (f?.done)
        return { ...base, result: 'pass', timeNs: run.timeNs, run };
    // The run ended before the script completed, without a failed check.
    const waiting = f?.at ? statementIdentity(f.at) : undefined, reason = run.status === 'limit' ? 'limit' : interpreter.pending ? 'horizon' : 'stalled';
    const message = { limit: 'The step limit came before the script completed.', horizon: `The horizon of ${run.options.untilNs} ns came before the script completed.`, stalled: 'The script waits for input, but no further event can occur in the run.' }[reason];
    return { ...base, result: 'inconclusive', reason, message, ...(waiting ? { source: waiting } : {}), timeNs: run.timeNs, run };
}
/** The executable that owns a statement: an operation, or a case script. */
const executableOwner = (n: AstNode): n is Executable | a.Scenario => isExecutable(n) || a.isScenario(n);
class Interpreter {
    /** The activation of the case script, in a case run. */
    caseFrame?: Frame;
    /** True when work remained beyond the horizon. */
    pending = false;
    private ended = false;
    private components = new Map<string, Component>();
    private ports = new Map<string, {
        c: Component;
        p: a.PortUsage;
    }>();
    private aliases = new Map<string, string>();
    private routes: Route[] = [];
    private queues = new Map<string, Message[]>();
    /** Sample cells by port occurrence and member, `${port}|${member}` (WP6-R01). */
    private cells = new Map<string, SampleCell>();
    /** Activations that have not completed, in release order; completed ones never act again. */
    private frames = new Set<Frame>();
    /** Released activations not yet dispatched; an activation completes only after its dispatch. */
    private unstarted = 0;
    private events = new EventQueue();
    private trace: TraceEvent[] = [];
    private machines: SimulationResult['machines'] = {};
    private deployments: SimulationResult['deployments'] = {};
    /** WP8-R01: the ordering key of each entry on a Swaml::Os Task, per component occurrence. */
    private keys = new Map<Component, Map<a.ScheduleEntry, RunKey>>();
    private tasked = false;
    /**
     * WP8-R02: with Tasks, the not completed activations in dispatch-scan order (ascending keys, release order among
     * equal keys), kept sorted on release instead of sorting at every pump. Without Tasks the scan uses frames.
     */
    private ordered: Frame[] = [];
    /** WP8-R02: the activation that runs on each Core (RunKey.core) from its dispatch or resumption to its next wait or end. */
    private running = new Map<string, Frame>();
    /** WP8-R01: entries already numbered on each Task by the deployments applied so far (platform identity|Task path). */
    private taskEntries = new Map<string, number>();
    private time = 0;
    private steps = 0;
    private serial = 0;
    private order = 0;
    private offers = 0;
    /** Delivery events so far: the delivery order of queued input (SIF-R03, SIF-R05). */
    private deliveries = 0;
    private stop?: 'violation' | 'limit';
    private options: Required<SimulationOptions>;
    constructor(private models: a.Model[], private target: RunTarget, options: SimulationOptions, private script?: a.Scenario) {
        const problem = simulationOptionsProblem(options);
        if (problem)
            throw new Error(problem);
        this.options = { untilNs: options.untilNs, maxSteps: options.maxSteps ?? 100000, maxPending: options.maxPending ?? 1024, maxConcurrent: options.maxConcurrent ?? 64, latencyNs: options.latencyNs ?? 0, faults: options.faults ?? [] };
    }
    private id(prefix: string): string { return `${prefix}${++this.serial}`; }
    /** The trace subject of an activation: the operation, or the case whose script it runs. */
    private label(f: Frame): string { return f.script ? f.c.path : `${f.c.path}.${f.op.name}`; }
    /** Releases the case script as one serial activation of its own. */
    private startScript(): void {
        const s = this.script!, c: Component = { path: identity(s), structure: s.subject!.ref!, store: new Map() };
        const f: Frame = { id: this.id('a'), c, op: undefined!, entry: { concurrent: false } as a.ScheduleEntry, released: this.time, iterator: undefined!, snapshot: new Map(), done: false, suspended: false, started: false, token: 0, watches: [], script: s, at: s };
        f.iterator = this.scriptBody(f);
        this.addFrame(f);
        this.unstarted++;
        this.caseFrame = f;
        this.log('release', c.path, { activation: f.id, cause: 'case' });
    }
    private *scriptBody(f: Frame): Iterator {
        try {
            yield* this.block(f.script!, f, new Map());
        }
        catch (e) {
            // A top-level return ends the case.
            if (!(e instanceof ReturnValue))
                throw e;
        }
        return voidValue();
    }
    /** The component and port.member an endpoint names: the frame's own port, or for a script an actor's port. */
    private portOf(f: Frame, endpoint: string): { c: Component; local: string } {
        if (!f.script)
            return { c: f.c, local: endpoint };
        const [occurrence, ...rest] = endpoint.split('.');
        return { c: this.components.get(occurrence)!, local: rest.join('.') };
    }
    /** Whether a waiting branch takes a message that reached port.member of component c. */
    private listens(f: Frame, b: a.ReceiveBranch, c: Component, endpoint: string, kind: Message['kind']): boolean {
        if (f.script)
            return a.isReceiveBranch(b) && b.endpoint === `${c.path}.${endpoint}` && (b.kind === 'call') === (kind === 'request');
        return f.c === c && b.endpoint === endpoint;
    }
    /** White-box access of a test waits until no other activation holds the occurrence's serial lock. */
    private *borrow(f: Frame, target: Component): Iterator {
        while (target.lock && target.lock !== f && !target.lock.done)
            yield { kind: 'step' };
        return voidValue();
    }
    private source(n?: AstNode): string | undefined { return n && statementIdentity(n); }
    private log(kind: string, subject: string, details: Record<string, unknown> = {}): void { this.trace.push({ timeNs: this.time, ordinal: this.trace.length + 1, kind, subject, ...details }); }
    private fuel = (): void => { if (++this.steps > this.options.maxSteps)
        throw new ContractViolation('StepLimit'); };
    private at(time: number, phase: number, run: () => void, live: () => boolean = () => true, key?: RunKey): void { if (!Number.isSafeInteger(time))
        throw new ContractViolation('ClockRange'); this.events.push(key ? { time, phase, order: this.order++, run, live, key } : { time, phase, order: this.order++, run, live }); }
    private keyOf(c: Component, entry: a.ScheduleEntry): RunKey | undefined { return this.tasked ? this.keys.get(c)?.get(entry) : undefined; }
    /** The key of the entry a delivered message releases, or of the activation a reply resumes (WP8-R01). */
    private deliveryKey(m: Message): RunKey | undefined {
        if (!this.tasked)
            return undefined;
        if (m.kind === 'reply')
            return m.correlation?.frame.key;
        const destination = this.ports.get(m.target);
        const entry = destination && schedule(destination.c.structure).find(e => e.endpoint === `${destination.p.name}.${m.member}` && e.kind === (m.kind === 'request' ? 'call' : 'receive'));
        return destination && entry ? this.keyOf(destination.c, entry) : undefined;
    }
    /** The first not completed activation that satisfies test, in release order. */
    private findFrame(test: (f: Frame) => boolean): Frame | undefined { for (const f of this.frames)
        if (test(f))
            return f; return undefined; }
    private leaf(path: string): string { const seen = new Set<string>(); while (this.aliases.has(path) && !seen.has(path)) {
        seen.add(path);
        path = this.aliases.get(path)!;
    } return path; }
    private env(f: Frame, local: Environment): Environment { return new Map([...(f.entry.concurrent ? f.snapshot : f.c.store), ...local]); }
    private cell(f: Frame, local: Environment, name: string): {
        type: string;
        value: Value;
    } { const c = local.get(name) ?? f.c.store.get(name); if (!c)
        throw new RuntimeFault('Type', `Unknown value ${name}`); return c; }
    private assign(f: Frame, local: Environment, name: string, value: Value, site?: AstNode): void { const c = this.cell(f, local, name); c.value = widen(value, c.type); this.log('write', `${f.c.path}.${name}`, { activation: f.id, source: this.source(site ?? f.at), scope: local.has(name) ? 'local' : 'attribute', value: plain(c.value) }); }
    /**
     * A place assignment (WP1-R01 to WP1-R03): the target's index expressions left to right, then the right
     * side, then the root cell is read live, every index is checked against the value read and the root is
     * written with exactly one place replaced. A bad index is the runtime failure Bounds and leaves the root
     * unchanged. The read-modify-write runs without suspension, after the right side resumed under the lock.
     */
    private *assignPlace(s: a.Assign, f: Frame, local: Environment): Iterator {
        const steps = valueSteps(s), indexes: number[] = [];
        for (const step of steps)
            if (step.index !== undefined)
                indexes.push((yield* this.evaluate(step.index as a.Expression, f, local)).data as number);
        const value = yield* this.evaluate(s.value, f, local), root = placeRoot(s.target), cell = this.cell(f, local, root);
        const next = copy(cell.value);
        let parent: Value | undefined, key: string | number | undefined, current = next, i = 0, place = root;
        for (const step of steps) {
            parent = current;
            if (step.field !== undefined) {
                unassigned(current, place);
                key = step.field;
                current = (current.data as Record<string, Value>)[step.field];
                place += '.' + step.field;
                continue;
            }
            unassigned(current, place);
            const index = indexes[i++], array = current.data as Value[];
            if (!Number.isSafeInteger(index) || index < 0 || index >= array.length)
                throw new RuntimeFault('Bounds');
            key = index;
            current = array[index];
            place += `[${index}]`;
        }
        const replaced = widen(value, current.type);
        if (typeof key === 'number')
            (parent!.data as Value[])[key] = replaced;
        else
            (parent!.data as Record<string, Value>)[key!] = replaced;
        cell.value = next;
        this.log('write', `${f.c.path}.${root}`, { activation: f.id, source: this.source(f.at), scope: local.has(root) ? 'local' : 'attribute', value: plain(next), place });
        return voidValue();
    }
    run(): SimulationResult {
        let initializing: { c: Component; attribute: a.Attribute } | undefined;
        try {
            for (const o of this.target.roots.flatMap(r => occurrences(r))) {
                const c: Component = { path: o.path, structure: o.structure, store: new Map() };
                this.components.set(c.path, c);
                this.deployments[c.path] = null;
                for (const p of members(c.structure).filter(a.isPortUsage))
                    this.ports.set(`${c.path}.${p.name}`, { c, p });
            }
            for (const c of this.components.values()) {
                const fake = { c, entry: {}, snapshot: new Map() } as Frame;
                for (const v of members(c.structure).filter(a.isAttribute)) {
                    initializing = { c, attribute: v };
                    bind(c.store, v.name, typeKey(v.type), this.sync(this.evaluate(v.value, fake, new Map())));
                }
                initializing = undefined;
                this.initializeCells(c, fake);
                this.log('initialize', c.path, { definition: identity(c.structure) });
                for (const [connectorIndex,l] of members(c.structure).filter(a.isConnect).entries()) {
                    const left = endpoint(c.structure, l.source)!, right = endpoint(c.structure, l.target)!;
                    if (left.child !== right.child)
                        this.aliases.set(`${c.path}.${left.child ? l.target : l.source}`, `${c.path}.${left.child ? l.source : l.target}`);
                    else
                        this.routes.push({ id: `${c.path}.${l.name ?? `@connect${connectorIndex}`}`, endpoints: [`${c.path}.${l.source}`, `${c.path}.${l.target}`], policy: effectiveQos(l), ...routeMembers(l) });
                }
            }
            // A package run adds the package connections between its top-level ports; a component run leaves them open.
            if (this.target.kind === 'package')
                this.target.package.connections.forEach((l, i) => {
                    if (packageEndpoint(this.target.package, l.source) && packageEndpoint(this.target.package, l.target))
                        this.routes.push({ id: l.name ?? `@package${i}`, endpoints: [l.source, l.target], policy: effectiveQos(l), ...routeMembers(l) });
                });
            for (const r of this.routes)
                r.endpoints = r.endpoints.map(p => this.leaf(p)) as [
                    string,
                    string
                ];
            for (const root of this.target.roots)
                this.place(root);
            for (const c of this.components.values())
                for (const e of schedule(c.structure)) {
                    if (e.kind === 'start')
                        this.at(0, 2, () => this.release(c, e), undefined, this.keyOf(c, e));
                    if (e.kind === 'every') {
                        // A computed period is the constant value of this occurrence (WP4-S04, WP4-R02).
                        const period = entryPeriod(e, c.structure);
                        if (period === undefined)
                            throw new Error(`Period of ${c.path}.${e.operation} is not a positive representable duration`);
                        const key = this.keyOf(c, e), tick = () => { this.release(c, e); this.at(this.time + period, 2, tick, undefined, key); };
                        this.at(this.time + period, 2, tick, undefined, key);
                    }
                }
            // A case script starts after the initialization barrier, released after every on start entry.
            if (this.script)
                this.at(0, 2, () => this.startScript());
            while (true) {
                const next = this.events.peek();
                if (!next || next.time > this.options.untilNs)
                    break;
                const event = this.events.pop()!;
                this.time = event.time;
                this.fuel();
                event.run();
                this.pump();
                if (this.caseFrame?.done) {
                    this.ended = true;
                    break;
                }
            }
            this.pending = this.events.some(e => e.live());
        }
        catch (e) {
            if (e instanceof RuntimeFault && initializing) {
                const { c, attribute } = initializing;
                this.log('failure', `${c.path}.${attribute.name}`, { phase: 'initialization', reason: e.code, declaration: identity(attribute), uri: AstUtils.getDocument(attribute).uri.toString(), range: attribute.$cstNode!.range });
            }
            else if (e instanceof ContractViolation) {
                this.stop = e.code === 'StepLimit' ? 'limit' : 'violation';
                // A violation with details names its own subject and source; the others name the run target.
                // An ActivationOverflow of a run with Tasks also says which limit and which Core (WP8-R02); runs without
                // Tasks record the 2.2 observation.
                this.log('violation', e.details?.subject ?? this.target.identity, { code: e.code, ...(e.details?.source !== undefined ? { source: e.details.source } : {}), ...(e.code === 'ActivationOverflow' && e.message !== e.code ? { message: e.message } : {}) });
            }
            else
                throw e;
        }
        return { profile: REFERENCE_PROFILE, target: { kind: this.target.kind, identity: this.target.identity }, options: copy(this.options), outcome: this.stop || this.trace.some(t => t.kind === 'failure'||t.kind==='caught') ? 'failure-observed' : 'no-failure-observed', status: this.stop ?? (this.ended ? 'stopped' : this.script ? this.pending ? 'horizon' : 'quiescent' : this.events.size || this.frames.size ? 'horizon' : 'quiescent'), timeNs: this.time, steps: this.steps, sources: this.models.map(m => ({ uri: AstUtils.getDocument(m).uri.toString(), text: AstUtils.getDocument(m).textDocument.getText() })), trace: this.trace, stores: Object.fromEntries([...this.components].map(([path, c]) => [path, Object.fromEntries([...c.store].map(([n, v]) => [n, plain(v.value)]))])), machines: this.machines, deployments: this.deployments };
    }
    /** Applies the one deployment of a top-level occurrence, if it has one, to that occurrence's tree. */
    private place(root: a.ComponentUsage): void {
        const found = this.models.flatMap(m => m.packages.flatMap(p => p.elements.filter(a.isDeployment))).filter(d => d.root.ref === root);
        if (found.length > 1)
            throw new Error(`At most one deployment per top-level occurrence: ${identity(root)} has ${found.map(d => identity(d)).join(', ')}.`);
        const d = found[0];
        if (!d)
            return;
        for (const path of [...this.components.keys()].filter(p => p === root.name || p.startsWith(`${root.name}.`))) {
            const matches = d.placements.filter(p => !p.target || path === `${root.name}.${p.target}` || path.startsWith(`${root.name}.${p.target}.`) || path.startsWith(`${root.name}.${p.target}[`)).sort((a, b) => (b.target?.length ?? 0) - (a.target?.length ?? 0));
            this.deployments[path] = matches[0] ? `${identity(d.platform.ref!)}.${matches[0].node}` : null;
        }
        // WP8-R01: entries on Swaml::Os Tasks take their Task's priority and their in-task position. A platform without
        // Tasks adds no key, so the run keeps its 2.2 order. When two deployments place work on one Task, the entries of
        // the deployment applied later (the run applies its roots in declaration order) follow those applied earlier.
        const plan = deploymentPlan(d);
        if (!plan?.taskRules)
            return;
        const platform = identity(d.platform.ref!), counts = new Map<string, number>();
        for (const e of plan.entries) {
            const c = this.components.get(e.occurrence.path);
            if (!c || !e.task || e.position === undefined)
                continue;
            this.tasked = true;
            const id = `${platform}|${e.task.path}`, offset = this.taskEntries.get(id) ?? 0;
            counts.set(id, Math.max(counts.get(id) ?? 0, e.position + 1));
            const forComponent = this.keys.get(c) ?? this.keys.set(c, new Map()).get(c)!;
            forComponent.set(e.entry, { priority: Number(e.task.priority ?? 0n), rank: e.task.rank, position: offset + e.position, task: e.task.path, core: `${platform}|${e.task.core}` });
        }
        for (const [id, n] of counts)
            this.taskEntries.set(id, (this.taskEntries.get(id) ?? 0) + n);
    }
    private sync(g: Iterator): Value { let r = g.next(); while (!r.done && r.value.kind === 'step')
        r = g.next(); if (!r.done)
        throw new Error('A pure expression suspended.'); return r.value; }
    private release(c: Component, entry: a.ScheduleEntry, message?: Message, predecessor?: Frame): void {
        if (this.unstarted >= this.options.maxPending)
            throw new ContractViolation('ActivationOverflow', this.tasked ? this.overflowMessage() : undefined);
        const op = members(c.structure).filter(isExecutable).find(x => x.name === entry.operation)!;
        const f: Frame = { id: this.id('a'), c, op, entry, released: this.time, iterator: undefined!, snapshot: new Map(), done: false, suspended: false, started: false, token: 0, watches: [], correlation: message?.correlation, at: entry };
        const key = this.keyOf(c, entry);
        if (key)
            f.key = key;
        f.iterator = this.activate(f, message);
        this.addFrame(f);
        this.unstarted++;
        // The Task of an activation on a Swaml::Os Task, for Task lanes (WP8-M04); absent otherwise.
        this.log('release', `${c.path}.${op.name}`, { activation: f.id, source: this.source(entry), cause: entry.kind, predecessorActivation: predecessor?.id, ...(key ? { task: key.task } : {}) });
        // One precedence everywhere (entryDeadline): an explicit deadline, literal or computed, then the period (WP4-S04).
        const deadline = entry.deadlineValue || entry.periodValue ? this.computedDeadline(c, entry) : entryDeadline(entry, c.structure);
        if (deadline)
            this.at(this.time + deadline, 0, () => { if (!f.done)
                throw new ContractViolation('Deadline', f.id); }, () => !f.done);
    }
    /**
     * WP8-R02: with Tasks a Core holds back every release of an instant until the running activation waits or ends, so
     * the pending activations of one Core can reach the run option maxPending; the violation says which Core.
     */
    private overflowMessage(): string {
        const byCore = new Map<string, number>();
        let unkeyed = 0;
        for (const f of this.frames)
            if (!f.started) {
                if (f.key)
                    byCore.set(f.key.core, (byCore.get(f.key.core) ?? 0) + 1);
                else
                    unkeyed++;
            }
        const [core, n] = [...byCore].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0] ?? ['', 0];
        const where = core ? `; ${n} of them wait for core ${core.slice(core.indexOf('|') + 1)} of ${core.slice(0, core.indexOf('|'))}${unkeyed ? ` and ${unkeyed} are not on a task` : ''}` : '';
        return `ActivationOverflow: ${this.unstarted} activations are pending at ${this.time}ns, the limit set by the run option maxPending = ${this.options.maxPending}${where}.`;
    }
    /** Computed deadlines and periods are constant per occurrence (WP4-S04, WP4-R02); each is evaluated once. */
    private readonly deadlines = new Map<Component, Map<a.ScheduleEntry, number | undefined>>();
    private computedDeadline(c: Component, entry: a.ScheduleEntry): number | undefined {
        const known = this.deadlines.get(c) ?? this.deadlines.set(c, new Map()).get(c)!;
        if (!known.has(entry))
            known.set(entry, entryDeadline(entry, c.structure));
        return known.get(entry);
    }
    /** Adds a released activation; with Tasks also to the key-ordered scan, after every activation of an equal or lower key. */
    private addFrame(f: Frame): void {
        this.frames.add(f);
        if (!this.tasked)
            return;
        const list = this.ordered;
        let lo = 0, hi = list.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (compareKeys(list[mid].key, f.key) <= 0)
                lo = mid + 1;
            else
                hi = mid;
        }
        list.splice(lo, 0, f);
    }
    /** WP8-R02: the Core of an activation on a Task is free again when that activation waits or ends. */
    private leaveCore(f: Frame): void {
        if (f.key && this.running.get(f.key.core) === f)
            this.running.delete(f.key.core);
    }
    private pump(): void {
        this.consume();
        // WP8-R01: dispatches and ready continuations follow the ordering keys; without Tasks, the release order.
        // WP8-R02: an activation on a Task holds its Core from dispatch or resumption to its next wait or end, so no other
        // activation of that Core is dispatched or continued in between, whatever its key (no preemption).
        for (const f of this.tasked ? this.ordered : this.frames) {
            if (f.done || f.suspended || (f as Frame & {
                queued?: boolean;
            }).queued || (!f.entry.concurrent || !f.started) && f.c.lock && f.c.lock !== f)
                continue;
            const holder = f.key && this.running.get(f.key.core);
            if (holder && holder !== f)
                continue;
            if (f.key)
                this.running.set(f.key.core, f);
            if (f.entry.concurrent && !f.started && this.concurrent(f.c) >= this.options.maxConcurrent)
                throw new ContractViolation('ConcurrentOverflow');
            if (!f.started) {
                f.started = true;
                this.unstarted--;
                f.snapshot = new Map([...f.c.store].map(([n, v]) => [n, copy(v)]));
                this.log('dispatch', this.label(f), { activation: f.id, source: f.script ? undefined : this.source(f.entry), concurrent: f.entry.concurrent });
            }
            if (!f.entry.concurrent)
                f.c.lock = f;
            (f as Frame & {
                queued: boolean;
            }).queued = true;
            this.at(this.time, 4, () => { (f as Frame & {
                queued: boolean;
            }).queued = false; this.drive(f); }, undefined, f.key);
        }
    }
    /** Dispatched, not completed concurrent activations of c. */
    private concurrent(c: Component): number { let n = 0; for (const x of this.frames)
        if (x.c === c && x.entry.concurrent && x.started)
            n++; return n; }
    private unlock(f: Frame): void { if (f.c.lock === f) {
        f.c.lock = undefined;
        this.log('unlock', f.c.path, { activation: f.id });
    } }
    private resume(f: Frame, reply?: Reply): void { if (f.done)
        return; f.token++; f.waiting = undefined; f.suspended = false; f.reply = reply; this.log('ready', this.label(f), { activation: f.id }); }
    private drive(f: Frame): void {
        if (f.done)
            return;
        try {
            let step: IteratorResult<Yield, Value>;
            if (f.interrupted) {
                const signal = f.interrupted;
                f.interrupted = undefined;
                step = f.iterator.throw(signal);
            }
            else {
                const reply = f.reply;
                f.reply = undefined;
                step = f.iterator.next(reply);
            }
            this.fuel();
            if (step.done) {
                this.finish(f, step.value);
                return;
            }
            const y = step.value;
            if (y.kind === 'step')
                return;
            // A read after a suspension sees the newer value (WP6-R03).
            f.sampled = undefined;
            f.waiting = y;
            f.suspended = true;
            this.unlock(f);
            this.leaveCore(f);
            const token = ++f.token;
            // A computed wait or receive timeout records its evaluated value; literal ones add nothing (WP4-T01).
            this.log(y.kind === 'request' ? 'requestWait' : y.kind === 'receive' ? 'receiveWait' : 'wait', this.label(f), { activation: f.id, source: this.source(f.at), ...(y.kind !== 'request' && y.durationNs !== undefined ? { durationNs: y.durationNs } : {}) });
            if (y.kind === 'wait')
                this.at(this.time + y.duration, 2, () => { if (f.token === token)
                    this.resume(f); }, () => f.token === token && !f.done, f.key);
            if (y.kind === 'receive' && y.flow && y.zero) {
                // SIF-R05 steps 2 and 3: queued input of owned members not named here is dropped; the wait ends at an event
                // of the same instant (phase 2, next insertion ordinal), which picks the first-delivered named message again.
                const named = y.flow.named;
                this.dropUnnamed(f, named);
                this.at(this.time, 2, () => {
                    if (f.token !== token || !f.suspended)
                        return;
                    const h = this.flowHeads(f).find(x => named.has(x.endpointName));
                    this.resume(f, h ? { input: this.take(h.queue, h.m, h.endpointName, f.c) } : {});
                }, () => f.token === token && !f.done, f.key);
            }
            if (y.kind === 'receive' && y.timeout !== undefined)
                this.at(this.time + y.timeout, 1, () => { if (f.token === token && f.suspended)
                    this.resume(f, {}); }, () => f.token === token && !f.done, f.key);
            if (y.kind === 'request')
                this.request(f, y);
        }
        catch (e) {
            if (!(e instanceof RuntimeFault))
                throw e;
            this.finish(f, undefined, e.code, e.message);
        }
    }
    private finish(f: Frame, value?: Value, failure?: string, message?: string): void {
        f.done = true;
        if (this.frames.delete(f) && !f.started)
            this.unstarted--;
        if (this.tasked) {
            const i = this.ordered.indexOf(f);
            if (i >= 0)
                this.ordered.splice(i, 1);
            this.leaveCore(f);
        }
        if (failure)
            f.failure = { code: failure, message: message ?? failure };
        f.suspended = false;
        f.token++;
        for (const w of f.watches)
            w.active = false;
        this.unlock(f);
        // A waiting machine that completed or failed has no current state (SIF-R13).
        if (!f.script && this.machines[this.label(f)] && flowStates(f.op).length)
            this.machines[this.label(f)].live = false;
        // A false release guard (WP7-R02, WP7-T01, WP7-T02): skip names the entry, then a receive entry's input is discarded.
        // Both name the operation occurrence, as complete and an activation's noEnabledTransition discard do.
        const skipped = !failure ? f.skipped : undefined;
        if (skipped) {
            this.log('skip', this.label(f), { activation: f.id, source: this.source(f.entry) });
            if (skipped.input)
                this.log('discardInput', this.label(f), { activation: f.id, source: skipped.input.origin, message: skipped.input.id, reason: 'releaseGuard' });
        }
        else
            this.log(failure ? 'failure' : 'complete', this.label(f), { activation: f.id, source: failure ? this.source(f.at) : undefined, value: value ? plain(value) : undefined, reason: failure, message: failure && message !== failure ? message : undefined });
        if (f.correlation)
            this.respond(f.correlation, { value, failure: failure ? 'remoteFailure' : undefined, out: (f as Frame & {
                    out?: Value[];
                }).out });
        // A skip counts as a successful whole completion for after successors (WP7-R03); a failure releases none (WP7-R06).
        if (!failure && !f.script)
            for (const e of schedule(f.c.structure))
                if (e.kind === 'after' && e.predecessor === f.op.name) {
                    // WP8-R02: a successor of an activation on a Task is released in its predecessor's completion step
                    // (OSEK chaining), so that it competes for the freed Core with the work already released at this
                    // instant. A predecessor not on a Task keeps the 2.2 release, also in a run that has Tasks.
                    if (f.key)
                        this.release(f.c, e, undefined, f);
                    else
                        this.at(this.time, 2, () => this.release(f.c, e, undefined, f), undefined, this.keyOf(f.c, e));
                }
    }
    private *activate(f: Frame, message?: Message): Iterator {
        const env: Environment = new Map();
        if (message)
            this.bindInputs(env, f.entry.bindings, message);
        // WP7-R01: a release guard is evaluated at the first execution step, before the dispatch arguments, in their
        // scope: under the serial lock, or for a concurrent entry on its dispatch snapshot, with sample cells and now()
        // read live. A false guard evaluates no argument (WP7-R02), so a guard may protect its own arguments. A runtime
        // failure inside it is an uncaught failure of the release (WP7-R06); its source is the entry (f.at), or the
        // failing statement of an operation the guard calls, as for the arguments.
        if (f.entry.guard) {
            const released = yield* this.evaluate(f.entry.guard, f, env);
            if (released.data !== true) {
                f.skipped = { input: message };
                return voidValue();
            }
        }
        const args: Value[] = [];
        for (const e of f.entry.args)
            args.push(yield* this.evaluate(e, f, env));
        const sig = signature(f.op)!;
        const outNames = f.entry.args.map((arg, i) => sig.parameters[i]?.direction === 'out' && a.isReferenceExpression(arg) ? arg.path : undefined);
        const result = yield* this.call(f.op, args, f, env, outNames);
        if (f.entry.kind === 'call')
            (f as Frame & {
                out: Value[];
            }).out = f.entry.bindings.map(name => copy(env.get(name)!.value));
        return result;
    }
    private *call(op: Executable, args: Value[], f: Frame, caller?: Environment, outNames: (string | undefined)[] = []): Iterator {
        const sig = signature(op)!, local: Environment = new Map();
        sig.parameters.forEach((p, i) => bind(local, p.name, typeKey(p.type), args[i] ?? this.zero(typeKey(p.type))));
        let result = voidValue();
        const at = f.at;
        // Statements of a called operation are not statements of the calling event line (SIF-T02).
        const lineWork = f.lineWork;
        f.lineWork = undefined;
        try {
            if (identity(sig).startsWith('Swaml::Math::') && ['floor', 'round', 'trunc', 'length'].includes(sig.name))
                return this.intrinsic(sig.name, args);
            const host = libraryIntrinsic(op);
            if (host)
                return this.libraryIntrinsic(host, args);
            yield* this.block(body(op)!, f, local);
        }
        catch (e) {
            if (!(e instanceof ReturnValue))
                throw e;
            result = e.value;
        }
        finally {
            f.lineWork = lineWork;
        }
        // A failure keeps f.at on the failing statement; a successful callee hands execution back to the caller's statement.
        f.at = at;
        result = widen(result, typeKey(sig.result));
        if (op === f.op)
            (f as Frame & {
                out: Value[];
            }).out = sig.parameters.map(p => copy(local.get(p.name)!.value));
        if (caller)
            sig.parameters.forEach((p, i) => { if (p.direction === 'out' && outNames[i])
                this.assign(f, caller, outNames[i]!, local.get(p.name)!.value); });
        return result;
    }
    private zero(type: string): Value { if (type === 'bool')
        return scalar(type, false); if (type === 'string')
        return scalar(type, ''); if (type === 'void')
        return voidValue(); const m = /^(.*)\[(\d+)\]$/.exec(type); if (m)
        return { type, data: Array.from({ length: Number(m[2]) }, () => this.zero(m[1])) }; return scalar(type, 0); }
    private intrinsic(name: string, args: Value[]): Value { if (name === 'length')
        return checked('uint', [...String(args[0].data)].length); const n = args[0].data as number; return checked('int', name === 'floor' ? Math.floor(n) : name === 'round' ? Math.round(n) : Math.trunc(n)); }
    /**
     * The 2.3 library intrinsics (chapter 6): sqrt (WP3-R01), intText and realText (WP3-R02) and now (WP3-R03),
     * the logical time of the evaluating step. Every activation reads the live clock, a concurrent one too;
     * dispatch snapshots hold attributes only.
     */
    private libraryIntrinsic(name: LibraryIntrinsic, args: Value[]): Value {
        if (name === 'now')
            return checked('uint', this.time);
        if (name === 'sqrt')
            return checked('real', squareRoot(args[0].data as number));
        return scalar('string', name === 'intText' ? intText(args[0].data as number) : realText(args[0].data as number, args[1].data as number));
    }
    private *evaluate(e: a.Expression, f: Frame, local: Environment): Iterator {
        this.fuel();
        const env = this.env(f, local);
        if (a.isLiteral(e))
            // A duration literal is a uint value in nanoseconds (WP4-S01).
            return e.duration ? checked('uint', nanos(e.duration)) : e.number !== undefined ? checked(e.$cstNode!.text.includes('.') ? 'real' : 'int', e.number) : e.boolean !== undefined ? scalar('bool', e.boolean === 'true') : scalar('string', e.text!);
        if (a.isReferenceExpression(e)) {
            const head = e.path.split('.')[0];
            let value = env.get(head)?.value, steps = valueSteps(e);
            if (!value) {
                const en = resolve(e, head, this.models);
                if (a.isEnumType(en))
                    return scalar(identity(en), steps[0]?.field ?? '');
                // A sampled read copies the live cell of an owned port, in every activation, a concurrent one too (WP6-R03, WP6-R07).
                const sampled = !f.script ? sampledReadForm(e, f.c.structure) : undefined;
                if (sampled) {
                    // The first read of a cell in a segment copies the live cell; later reads in the segment see that copy.
                    const key = `${f.c.path}.${sampled.port.name}|${sampled.member.name}`, cell = this.cells.get(key);
                    if (!cell)
                        throw new RuntimeFault('Type', `${e.path} has no sample cell`);
                    f.sampled ??= new Map();
                    if (!f.sampled.has(key))
                        f.sampled.set(key, copy([cell.value])[0]);
                    value = copy([f.sampled.get(key)!])[0];
                    steps = sampled.steps;
                }
                // A test reads a live attribute of its subject or a part inside it, such as twins[0].link (WP1-S06).
                else {
                    const read = f.script && caseRead(f.script, e);
                    if (!read || read.kind !== 'attribute')
                        throw new RuntimeFault('Type', e.path);
                    const target = this.components.get(read.path);
                    if (!target)
                        throw new RuntimeFault('Type', `${read.path} does not run in this package`);
                    yield* this.borrow(f, target);
                    value = target.store.get(read.attribute.name)!.value;
                    steps = read.steps;
                }
            }
            // Selectors apply left to right; each index is evaluated, checked and applied in turn (WP1-R04).
            for (const step of steps) {
                unassigned(value, e.path);
                if (step.field !== undefined) {
                    value = (value.data as Record<string, Value>)[step.field];
                    continue;
                }
                const index = (yield* this.evaluate(step.index as a.Expression, f, local)).data as number;
                const array = value.data as Value[];
                if (!Number.isSafeInteger(index) || index < 0 || index >= array.length)
                    throw new RuntimeFault('Bounds');
                value = array[index];
            }
            return copy(value);
        }
        if (a.isArrayLiteral(e)) {
            const values: Value[] = [];
            for (const v of e.values)
                values.push(yield* this.evaluate(v, f, local));
            const type = values.some(v => v.type === 'real') ? 'real' : new Set(values.map(v=>v.type)).size===1 ? values[0].type : 'int';
            return { type: `${type}[${values.length}]`, data: values.map(v => widen(v, type)) };
        }
        if (a.isRecordLiteral(e)) {
            const data: Record<string, Value> = {};
            for (const v of e.fields)
                data[v.name] = widen(yield* this.evaluate(v.value, f, local), typeKey(e.type.ref!.fields.find(x => x.name === v.name)!.type));
            return { type: identity(e.type.ref!), data };
        }
        if (a.isTryExpression(e)) {
            try {
                return yield* this.evaluate(e.expression, f, local);
            }
            catch (error) {
                if (!(error instanceof RuntimeFault))
                    throw error;
                f.at = e;
                this.log('caught', f.op ? `${f.c.path}.${f.op.name}` : f.c.path, { activation: f.id, source: this.source(e), reason: error.code });
                return e.fallback ? widen(yield* this.evaluate(e.fallback, f, local),expressionTypes.get(e)!) : voidValue();
            }
        }
        if (a.isCallExpression(e)) {
            const scripted = f.script && e.target.includes('.') ? caseTarget(f.script, e.target) : undefined;
            const remote = e.target.includes('.') && scripted?.kind !== 'operation', op = scripted?.kind === 'operation' ? scripted.operation : remote ? undefined : localOperation(e, e.target, container(e) ? f.c.structure : undefined) ?? resolve(e, e.target, this.models), sig = op && isExecutable(op) ? signature(op) : scripted?.kind === 'port' ? scripted.member : memberEndpoint(f.c.structure, e.target)?.member;
            const args: Value[] = [], outs: (string | undefined)[] = [];
            for (let i = 0; i < e.args.length; i++) {
                if (sig?.parameters[i]?.direction === 'out') {
                    args.push(this.zero(typeKey(sig.parameters[i].type)));
                    outs[i] = (e.args[i] as a.ReferenceExpression).path;
                }
                else
                    args.push(widen(yield* this.evaluate(e.args[i], f, local), typeKey(sig!.parameters[i].type)));
            }
            if (scripted?.kind === 'operation') {
                // A case call executes on the actual driving frame. Switching only
                // a copied frame would emit through actor ports and retain the
                // target lock when drive() suspends its caller.
                const target = this.components.get(scripted.path);
                if (!target)
                    throw new RuntimeFault('Type', `${scripted.path} does not run in this package`);
                yield* this.borrow(f, target);
                const saved = { c: f.c, op: f.op, script: f.script, at: f.at, watches: f.watches, out: f.out };
                target.lock = f;
                f.c = target;
                f.op = scripted.operation;
                f.script = undefined;
                f.watches = [];
                let completed = false, result: Value, outputs: Value[] | undefined;
                try {
                    result = yield* this.call(scripted.operation, args, f);
                    outputs = f.out?.map(copy);
                    completed = true;
                }
                finally {
                    const failedAt = f.at;
                    this.unlock(f);
                    Object.assign(f, saved);
                    // A failure keeps its actual callee statement; a successful
                    // return and all out writes belong to the restored caller.
                    if (!completed)
                        f.at = failedAt;
                }
                sig!.parameters.forEach((parameter, i) => {
                    if (parameter.direction === 'out' && outs[i])
                        this.assign(f, local, outs[i]!, outputs![i], e);
                });
                return result!;
            }
            if (!remote && op && isExecutable(op))
                return yield* this.call(op, args, f, local, outs);
            const reply = yield { kind: 'request', endpoint: e.target, args, site:e };
            if (reply?.failure)
                throw new RuntimeFault(reply.failure);
            outs.forEach((n, i) => { if (n && reply?.out?.[i])
                this.assign(f, local, n, reply.out[i], e); });
            return widen(reply?.value ?? voidValue(), typeKey(sig?.result));
        }
        if (a.isConditionalExpression(e)) {
            // Evaluate the condition, then only the selected branch (WP2-R01); the value takes the conditional's type.
            const selected = (yield* this.evaluate(e.condition, f, local)).data ? e.then : e.otherwise;
            const value = yield* this.evaluate(selected, f, local), type = expressionTypes.get(e);
            return type && type !== '?' ? widen(value, type) : value;
        }
        if (a.isUnaryExpression(e)) {
            const v = yield* this.evaluate(e.operand, f, local);
            return e.operator === 'not' ? scalar('bool', !v.data) : checked(v.type === 'real' ? 'real' : 'int', -(v.data as number));
        }
        const left = yield* this.evaluate(e.left, f, local);
        if (e.operator === 'and' && left.data === false || e.operator === 'or' && left.data === true)
            return left;
        const right = yield* this.evaluate(e.right, f, local);
        try {
            return binary(e.operator, left, right);
        }
        catch (x) {
            // Integer overflow in a computed duration is DurationRange (WP4-R01); elsewhere it stays Arithmetic.
            if (x instanceof RuntimeFault && x.code === 'Arithmetic' && x.message === 'Integer overflow' && inDuration(e))
                throw new RuntimeFault('DurationRange', 'Duration is not a representable number of nanoseconds');
            throw x;
        }
    }
    private *block(b: a.Block | a.ElseIf | a.OperationBody | a.Scenario, f: Frame, parent: Environment): Iterator {
        const local = new Map(parent);
        // A jump lands in the statement list that contains its target state (SIF-R09, SIF-R10): the blocks and loops between
        // the jump and that list end as the signal unwinds them; a declaration between the target and the jump runs again.
        for (let i = 0; i < b.statements.length; i++) {
            try {
                yield* this.statement(b.statements[i], f, local);
            }
            catch (e) {
                if (!(e instanceof JumpSignal))
                    throw e;
                const j = b.statements.findIndex(x => a.isStateStep(x) && (x.name === e.target || !!this.pathInside(x, e.target)));
                if (j < 0)
                    throw e;
                f.flowTarget = e.target;
                f.flowTrigger = e.node;
                i = j - 1;
            }
        }
        return voidValue();
    }
    /** One statement, or one statement standing in a state's braces at a look. */
    private *statement(s: a.Statement | Exclude<a.StateMember, a.StateAction | a.EventLine | a.StateStep>, f: Frame, local: Environment): Iterator {
        this.fuel();
        f.at = s;
        // Work of an event line block (SIF-T02): every statement but an if test counts; a true test counts below.
        if (f.lineWork !== undefined && !a.isIf(s))
            f.lineWork++;
        // A state adds no step of its own after it ends: leaving continues into the next statement (SIF-R12).
        if (a.isStateStep(s))
            return yield* this.flowMachine(s, f, local);
        if (a.isExit(s) || a.isJump(s))
            throw new LeaveSignal(s);
        if (a.isLocalVariable(s))
            bind(local, s.name, typeKey(s.type), yield* this.evaluate(s.value, f, local));
        else if (a.isAssign(s) && isPlace(s))
            yield* this.assignPlace(s, f, local);
        else if (a.isAssign(s))
            this.assign(f, local, s.target, yield* this.evaluate(s.value, f, local));
        else if (a.isExpressionStatement(s))
            yield* this.evaluate(s.expression, f, local);
        else if (a.isReturn(s))
            throw new ReturnValue(s.value ? yield* this.evaluate(s.value, f, local) : voidValue());
        else if (a.isIf(s)) {
            const holds = !!(yield* this.evaluate(s.condition, f, local)).data;
            if (holds && f.lineWork !== undefined)
                f.lineWork++;
            if (holds)
                yield* this.block(s.then, f, local);
            else if (s.otherwise)
                yield* this.block(s.otherwise, f, local);
        }
        else if (a.isWhile(s) || a.isUntil(s)) {
            const limit = s.limit ? widen(yield* this.evaluate(s.limit, f, local), 'uint').data as number : Infinity;
            for (let i = 0; i < limit; i++) {
                this.fuel();
                // The body moves f.at; a condition belongs to the loop statement again.
                f.at = s;
                if (a.isWhile(s) && !(yield* this.evaluate(s.condition, f, local)).data)
                    break;
                yield* this.block(s.body, f, local);
                f.at = s;
                if (a.isUntil(s) && (yield* this.evaluate(s.condition, f, local)).data)
                    break;
            }
        }
        else if (a.isFor(s)) {
            const loop = new Map(local);
            f.at = s.initializer;
            bind(loop, s.initializer.name, typeKey(s.initializer.type), yield* this.evaluate(s.initializer.value, f, loop));
            while ((f.at = s, yield* this.evaluate(s.condition, f, loop)).data) {
                this.fuel();
                yield* this.block(s.body, f, loop);
                f.at = s.update;
                this.assign(f, loop, s.update.target, yield* this.evaluate(s.update.value, f, loop));
            }
        }
        else if (a.isForEach(s)) {
            const values = copy((yield* this.evaluate(s.collection, f, local)).data as Value[]);
            for (const v of values) {
                const loop = new Map(local);
                bind(loop, s.variable.name, typeKey(s.variable.type), v);
                yield* this.block(s.body, f, loop);
            }
        }
        else if (a.isWait(s) && s.delay) {
            // A computed wait is evaluated when the statement starts waiting (WP4-S03, WP4-R02).
            const duration = durationValue(yield* this.evaluate(s.delay, f, local));
            yield { kind: 'wait', duration, durationNs: duration };
        }
        else if (a.isWait(s))
            yield { kind: 'wait', duration: nanos(s.duration!) };
        else if (a.isReceive(s)) {
            // A computed timeout is evaluated when the statement starts waiting, before any input is taken (WP4-S03, WP4-R02).
            const computed = s.timeoutValue ? durationValue(yield* this.evaluate(s.timeoutValue, f, local)) : undefined;
            const reply = yield computed !== undefined ? { kind: 'receive', branches: s.branches, timeout: computed, durationNs: computed } : { kind: 'receive', branches: s.branches, timeout: s.timeout ? nanos(s.timeout) : undefined };
            if (reply?.input && reply.branch && a.isReceiveBranch(reply.branch)) {
                const scope = new Map(local);
                this.bindInputs(scope, reply.branch.bindings, reply.input);
                if (reply.branch.kind === 'call')
                    yield* this.answer(reply.branch, reply.input, f, scope);
                else
                    yield* this.block(reply.branch.body, f, scope);
            }
            else if (s.timeoutBody)
                yield* this.block(s.timeoutBody, f, local);
        }
        else if (a.isInterruptible(s)) {
            const watch: Watch = { node: s, frame: f, active: true };
            f.watches.push(watch);
            this.log('arm', `${f.c.path}.${s.endpoint}`, { activation: f.id, source: this.source(s) });
            try {
                yield* this.block(s.body, f, local);
            }
            catch (e) {
                if (!(e instanceof InterruptSignal) || e.watch !== watch)
                    throw e;
                watch.active = false;
                const scope = new Map(local);
                this.bindInputs(scope, s.bindings, e.message);
                yield* this.block(s.handler, f, scope);
            }
            finally {
                watch.active = false;
            }
        }
        else if (a.isSend(s)) {
            const args: Value[] = [];
            for (const e of s.args)
                args.push(yield* this.evaluate(e, f, local));
            this.emit(f, s.endpoint, args, s.kind === 'send' ? 'attribute' : 'event',s);
        }
        else if (a.isAssert(s)) {
            const passed = !!(yield* this.evaluate(s.condition, f, local)).data;
            f.at = s;
            this.log('assert', this.label(f), { activation: f.id, source: this.source(s), passed });
            if (!passed)
                throw new RuntimeFault('Assertion', f.script ? `Assertion failed: ${s.$cstNode!.text}` : 'Assertion');
        }
        else if (a.isFail(s))
            throw new RuntimeFault('Failure', s.reason);
        // A test is not a step (SIF-R12): an if written in a state's braces outside on entry and on exit takes no
        // scheduling step of its own; the statements it runs do. This keeps 2.2's interleaving, in which a guard was none.
        if (a.isIf(s) && this.inLookText(s))
            return voidValue();
        yield { kind: 'step' };
        return voidValue();
    }
    // ---- States in the flow (SIF-R01 to SIF-R06, SIF-R09 to SIF-R13): a waiting machine is an activation released on start
    // whose body contains states. A state is reached by the flow, a leave or a jump (enter), looks at its items (look),
    // waits between looks (wait) and is left in text order (leave). flowMachine runs one top-level state statement.
    /** The members the event lines of an operation with states name: the members it owns (SIF-R05, SIF-R06). */
    private ownedMembers = new Map<Executable, Set<string>>();
    private owned(op: Executable): Set<string> {
        let o = this.ownedMembers.get(op);
        if (!o) {
            o = new Set(flowStates(op).flatMap(s => s.statements.flatMap(x => a.isEventLine(x) && x.endpoint ? [x.endpoint] : [])));
            this.ownedMembers.set(op, o);
        }
        return o;
    }
    /** The operation with states of c that owns endpointName, if any. */
    private flowOwners = new Map<Structure, Map<string, Executable | undefined>>();
    private flowOwner(c: Component, endpointName: string): Executable | undefined {
        const known = this.flowOwners.get(c.structure) ?? this.flowOwners.set(c.structure, new Map()).get(c.structure)!;
        if (!known.has(endpointName))
            known.set(endpointName, members(c.structure).filter(isExecutable).find(op => flowStates(op).length > 0 && this.owned(op).has(endpointName)));
        return known.get(endpointName);
    }
    /**
     * The ready input heads of f's operation, in delivery order (SIF-R03): one head per queue addressed to f's occurrence
     * whose member the operation owns. A head older than its maxAge is discarded first, as consume() does.
     */
    private flowHeads(f: Frame): { queue: Message[]; m: Message; endpointName: string }[] {
        const heads: { queue: Message[]; m: Message; endpointName: string }[] = [], owned = this.owned(f.op);
        for (const queue of this.queues.values()) {
            while (queue.length) {
                const m = queue[0];
                if (!(m as Message & { ready?: boolean }).ready || m.kind === 'reply' || m.kind === 'request')
                    break;
                const destination = this.ports.get(m.target);
                if (!destination || destination.c !== f.c)
                    break;
                const policy = this.policyOf(m.route, m.member);
                if (policy.maxAge !== undefined && this.time - m.emitted > policy.maxAge) {
                    queue.shift();
                    this.log('discardAge', m.route.id, { source: m.origin, message: m.id });
                    continue;
                }
                const endpointName = `${destination.p.name}.${m.member}`;
                if (owned.has(endpointName))
                    heads.push({ queue, m, endpointName });
                break;
            }
        }
        return heads.sort((x, y) => (x.m.delivered ?? Infinity) - (y.m.delivered ?? Infinity));
    }
    /** Takes a queue head as delivered input, as consume() does (deliver observation, argument widening). */
    private take(queue: Message[], m: Message, endpointName: string, c: Component): Message {
        queue.shift();
        this.log('deliver', m.route.id, { source: m.origin, message: m.id, correlation: m.correlation?.id, targetPort: m.target });
        const ep = memberEndpoint(c.structure, endpointName);
        if (ep) {
            const types = ep.member.kind === 'attribute' ? [typeKey(ep.member.type)] : ep.member.parameters.map(p => typeKey(p.type));
            m.args = m.args.map((v, i) => widen(v, types[i]));
        }
        return { ...m, member: endpointName };
    }
    /** SIF-R05 step 2: queued input of owned members not named at the waiting state is dropped, in delivery order. */
    private dropUnnamed(f: Frame, named: Set<string>): void {
        for (let h = this.flowHeads(f).find(x => !named.has(x.endpointName)); h; h = this.flowHeads(f).find(x => !named.has(x.endpointName))) {
            const m = this.take(h.queue, h.m, h.endpointName, f.c);
            this.log('discardInput', h.endpointName, { source: m.origin, reason: 'inactiveOwner' });
        }
    }
    /** The chain of inner states from a child of p down to the state named name, or undefined (direct entry, SIF-S06). */
    private pathInside(p: a.StateStep, name: string): a.StateStep[] | undefined {
        for (const s of innerStates(p)) {
            if (s.name === name)
                return [s];
            const deeper = this.pathInside(s, name);
            if (deeper)
                return [s, ...deeper];
        }
        return undefined;
    }
    /** A state has something to look at when some level has an event line or a statement (SIF-R01 step 5, SIF-R11). */
    private hasSomething(levels: readonly FlowLevel[]): boolean { return levels.some(l => stateItems(l.state).some(x => !a.isStateAction(x))); }
    /** The members named at the current state: an on receive line on some level (SIF-R03). */
    private namedAt(levels: readonly FlowLevel[]): Set<string> { return new Set(levels.flatMap(l => l.state.statements.flatMap(x => a.isEventLine(x) && x.endpoint ? [x.endpoint] : []))); }
    private timerLines(l: FlowLevel): a.EventLine[] { return l.state.statements.filter((x): x is a.EventLine => a.isEventLine(x) && x.endpoint === undefined); }
    /** The moment a timer of a level runs out: its arrival plus its duration (SIF-R01 step 2). */
    private due(l: FlowLevel, t: a.EventLine): number { return l.entered + (t.delay ? nanos(t.delay) : l.delays.get(t)!); }
    private timersDue(levels: readonly FlowLevel[]): boolean { return levels.some(l => this.timerLines(l).some(t => !l.presented.has(t) && this.time >= this.due(l, t))); }
    /** Whether a node is written in a state's braces outside on entry and on exit (SIF-R12). */
    private inLookText(n: AstNode): boolean {
        for (let c = n.$container; c; c = c.$container) {
            if (a.isStateAction(c) || isExecutable(c))
                return false;
            if (a.isStateStep(c))
                return true;
        }
        return false;
    }
    /**
     * SIF-R01: reaching the states of path in order. Each gets its state observation, its timer start, its on entry once and
     * its computed timers (steps 1 to 4); parents on the way get only these, outermost first (direct entry). A parent reached
     * as the last of path is entered at its first inner state.
     */
    private *enter(levels: FlowLevel[], path: readonly a.StateStep[], f: Frame, local: Environment, key: string, trigger?: AstNode): Iterator {
        const queue = [...path];
        while (queue.length) {
            const s = queue.shift()!;
            const level: FlowLevel = { state: s, entered: this.time, delays: new Map(), presented: new Set() };
            levels.push(level);
            this.machines[key] = { state: s.name, live: true };
            f.at = s;
            this.log('state', key, { state: s.name, activation: f.id, source: this.source(s), ...(trigger ? { trigger: this.source(trigger) } : {}) });
            for (const action of s.statements.filter(a.isStateAction).filter(x => x.kind === 'entry'))
                yield* this.block(action.body, f, local);
            // Computed durations are evaluated once, when the entry actions finish (WP4-R02); the timer counts from arrival.
            for (const t of this.timerLines(level).filter(x => !!x.delayValue)) {
                f.at = t;
                const value = durationValue(yield* this.evaluate(t.delayValue!, f, local));
                level.delays.set(t, value);
                this.log('timer', key, { state: s.name, source: this.source(t), timerNs: value, expiresNs: level.entered + value });
            }
            if (!queue.length && innerStates(s).length)
                queue.push(innerStates(s)[0]);
        }
        return voidValue();
    }
    /** Runs on exit of every level at depth n or deeper, innermost first (SIF-R09 step 2). */
    private *exitTo(levels: FlowLevel[], n: number, f: Frame, local: Environment): Iterator {
        while (levels.length > n) {
            const l = levels.pop()!;
            for (const action of l.state.statements.filter(a.isStateAction).filter(x => x.kind === 'exit'))
                yield* this.block(action.body, f, local);
        }
        return voidValue();
    }
    /**
     * SIF-R02 to SIF-R04: one look. Levels outermost first; within a level its items in written order, skipping on entry and
     * on exit: an event line runs when its event is present, every statement runs. The look ends at the first exit; or to S;
     * it runs, which is returned with the level it was written at. Records the stay observation (SIF-T02) and the discard of
     * a message that no line acted on (SIF-R06).
     */
    private *look(levels: FlowLevel[], f: Frame, local: Environment, key: string, present: Present): Generator<Yield, { node: a.Exit | a.Jump; level: number } | undefined, Reply | undefined> {
        // Every timer of a level that has run out when the look starts and was not present before (SIF-R03).
        const timers = new Set<a.EventLine>();
        if (present.timers)
            for (const l of levels)
                for (const t of this.timerLines(l))
                    if (!l.presented.has(t) && this.time >= this.due(l, t)) {
                        timers.add(t);
                        l.presented.add(t);
                    }
        const input = present.input, leaf = levels.at(-1)!.state;
        let level = 0, lineRan = false, messageWork = 0, lineWork = 0, firstLine: a.EventLine | undefined, left: a.Exit | a.Jump | undefined;
        try {
            for (level = 0; level < levels.length; level++) {
                // A local declared in a state's braces is a local of the look (SIF-R10).
                const scope = new Map(local);
                for (const item of stateItems(levels[level].state)) {
                    if (a.isStateAction(item))
                        continue;
                    if (!a.isEventLine(item)) {
                        yield* this.statement(item, f, scope);
                        continue;
                    }
                    if (item.endpoint !== undefined ? input?.member !== item.endpoint : !timers.has(item))
                        continue;
                    const lineScope = new Map(scope);
                    if (input && item.endpoint !== undefined) {
                        this.bindInputs(lineScope, item.bindings, input);
                        lineRan = true;
                    }
                    f.at = item;
                    f.lineWork = 0;
                    try {
                        yield* this.block(item.body, f, lineScope);
                    }
                    finally {
                        const worked = (f.lineWork ?? 0) > 0;
                        f.lineWork = undefined;
                        if (worked) {
                            lineWork++;
                            firstLine ??= item;
                            if (item.endpoint !== undefined)
                                messageWork++;
                        }
                    }
                }
            }
        }
        catch (e) {
            if (!(e instanceof LeaveSignal))
                throw e;
            left = e.node;
        }
        if (input && !messageWork)
            this.log('discardInput', key, { activation: f.id, source: input.origin ?? this.source(leaf), reason: left && !lineRan ? 'leftBeforeLine' : 'noEnabledTransition' });
        else if (!left && lineWork && firstLine)
            this.log('state', key, { state: leaf.name, activation: f.id, source: this.source(firstLine), stay: true });
        return left ? { node: left, level } : undefined;
    }
    /**
     * SIF-R09: leaving in text order. The block before the leave has run; on exit of every state left runs, innermost first;
     * then the target is reached, entering parents on the way outermost first. Returns true when exit; (or a named step) leaves
     * the outermost state, so the next statement follows; a jump to a state outside this machine's levels is thrown to the
     * statement list that contains it.
     */
    private *leave(levels: FlowLevel[], level: number, node: a.Exit | a.Jump | undefined, f: Frame, local: Environment, key: string): Generator<Yield, boolean, Reply | undefined> {
        if (!node || a.isExit(node)) {
            // exit; at level L leaves L; the next inner state of L's parent follows, or after the last the parent is left too.
            for (let at = level; ; at--) {
                const left = levels[at].state;
                yield* this.exitTo(levels, at, f, local);
                const parent = levels[at - 1];
                if (!parent)
                    return true;
                const siblings = innerStates(parent.state), i = siblings.indexOf(left);
                if (i < siblings.length - 1) {
                    yield* this.enter(levels, [siblings[i + 1]], f, local, key, node);
                    return false;
                }
            }
        }
        // to T: leave every state up to the innermost level that contains T, then enter down to T (direct entry, SIF-R11).
        for (let k = levels.length - 1; k >= 0; k--) {
            const path = this.pathInside(levels[k].state, node.target);
            if (!path)
                continue;
            yield* this.exitTo(levels, k + 1, f, local);
            yield* this.enter(levels, path, f, local, key, node);
            return false;
        }
        yield* this.exitTo(levels, 0, f, local);
        throw new JumpSignal(node.target, node);
    }
    /**
     * SIF-R05: when a state begins to wait: timers that ran out first (a look now); then queued input of owned members not
     * named here is dropped in delivery order and a queued named message ends the wait in zero time, picked again at that
     * event (drive); otherwise the state waits for a timer (phase 1) or a named delivery (phase 2, consume), and input of
     * owned members not named here is dropped on arrival.
     */
    private *wait(levels: FlowLevel[], f: Frame): Generator<Yield, Present, Reply | undefined> {
        while (true) {
            if (this.timersDue(levels))
                return { timers: true, cause: 'timer' };
            const named = this.namedAt(levels);
            f.at = levels.at(-1)!.state;
            if (this.flowHeads(f).some(x => named.has(x.endpointName))) {
                const reply: Reply | undefined = yield { kind: 'receive', branches: [], flow: { named }, zero: true };
                if (reply?.input)
                    return { input: reply.input, timers: true, cause: 'message' };
                continue;
            }
            let expires: number | undefined;
            for (const l of levels)
                for (const t of this.timerLines(l))
                    if (!l.presented.has(t) && (expires === undefined || this.due(l, t) < expires))
                        expires = this.due(l, t);
            if (expires !== undefined && !Number.isSafeInteger(expires))
                throw new ContractViolation('ClockRange');
            const reply: Reply | undefined = yield { kind: 'receive', branches: [], timeout: expires === undefined ? undefined : Math.max(0, expires - this.time), flow: { named } };
            if (reply?.input)
                return { input: reply.input, timers: true, cause: 'message' };
            return { timers: true, cause: 'timer' };
        }
    }
    /**
     * A state standing in a statement list, reached by the flow or by a jump into it or into a state inside it (SIF-R01):
     * arrival, then looks until a look leaves; exit; from the outermost state returns to the list, which goes on with the
     * next statement. A state with nothing to look at is a named step: it is left at once, as by exit;.
     */
    private *flowMachine(top: a.StateStep, f: Frame, local: Environment): Iterator {
        const key = this.label(f), target = f.flowTarget, trigger = f.flowTrigger;
        f.flowTarget = f.flowTrigger = undefined;
        const levels: FlowLevel[] = [];
        yield* this.enter(levels, target !== undefined && target !== top.name ? [top, ...this.pathInside(top, target)!] : [top], f, local, key, trigger);
        let present: Present = { timers: true, cause: 'arrival' };
        while (true) {
            const left = this.hasSomething(levels) ? yield* this.look(levels, f, local, key, present) : { node: undefined, level: levels.length - 1 };
            if (left) {
                if (yield* this.leave(levels, left.level, left.node, f, local, key))
                    return voidValue();
                present = { timers: true, cause: 'arrival' };
                continue;
            }
            present = yield* this.wait(levels, f);
        }
    }
    /** A script's on call branch answers a request at an actor port; return inside it is the reply. */
    private *answer(branch: a.ReceiveBranch, input: Message, f: Frame, scope: Environment): Iterator {
        const t = caseTarget(f.script!, branch.endpoint), result = t?.kind === 'port' ? typeKey(t.member.result) : 'void';
        let value = voidValue();
        try {
            yield* this.block(branch.body, f, scope);
        }
        catch (e) {
            if (!(e instanceof ReturnValue)) {
                if (e instanceof RuntimeFault && input.correlation)
                    this.respond(input.correlation, { failure: 'remoteFailure' });
                throw e;
            }
            value = e.value;
        }
        if (input.correlation)
            this.respond(input.correlation, { value: widen(value, result), out: branch.bindings.map(n => copy(scope.get(n)!.value)) });
        return voidValue();
    }
    private bindInputs(env: Environment, bindings: string[], message: Message): void { bindings.forEach((n, i) => { if (message.args[i])
        bind(env, n, message.args[i].type, message.args[i]); }); }
    private emit(f: Frame, endpointName: string, args: Value[], kind: 'event' | 'attribute',site:a.Send): void {
        const { c, local } = this.portOf(f, endpointName), declared = memberEndpoint(c.structure, local)!.member;
        const types = declared.kind === 'attribute' ? [typeKey(declared.type)] : declared.parameters.map(p => typeKey(p.type));
        args = args.map((v, i) => widen(v, types[i]));
        const [port, member] = local.split('.'), source = this.leaf(`${c.path}.${port}`);
        const origin = this.source(site);
        this.log(kind === 'event' ? 'publish' : 'send', `${source}.${member}`, { activation: f.id, source: origin, emitter:{declaration:identity(owner(site,executableOwner)!),uri:AstUtils.getDocument(site).uri.toString(),range:site.$cstNode!.range}, args: args.map(plain) });
        for (const route of this.routes.filter(r => r.endpoints.includes(source))){const target=route.endpoints.find(p=>p!==source)!,destination=this.ports.get(target),memberTarget=destination&&portMembers(destination.p).find(m=>m.name===member&&m.kind===kind&&direction(destination.p,m)==='requires');if(!memberTarget)continue;this.offer({id:this.id('m'),route,source,target,member,args:copy(args),emitted:this.time,kind,origin});}
    }
    private request(f: Frame, y: Extract<Yield, {
        kind: 'request';
    }>): void {
        const { c, local } = this.portOf(f, y.endpoint), [port, member] = local.split('.'), source = this.leaf(`${c.path}.${port}`), route = this.routes.find(r => r.endpoints.includes(source));
        if (!route) {
            this.resume(f, { failure: 'unavailable' });
            return;
        }
        const correlation: Correlation = { id: this.id('r'), frame: f, route, state: 'pending', expiry: this.time + this.policyOf(route, member).requestTimeout, origin: this.source(y.site) };
        f.request = correlation;
        this.log('request', `${source}.${member}`, { activation: f.id, source: correlation.origin, correlation: correlation.id, route: route.id, caller:y.site?{declaration:identity(owner(y.site,executableOwner)!),uri:AstUtils.getDocument(y.site).uri.toString(),range:y.site.$cstNode!.range}:undefined });
        this.at(correlation.expiry, 0, () => { if (correlation.state === 'pending') {
            correlation.state = 'failed';
            this.log('timeout', y.endpoint, { source: correlation.origin, correlation: correlation.id });
            this.resume(f, { failure: 'timeout' });
        } }, () => correlation.state === 'pending', f.key);
        try {
            this.offer({ id: this.id('m'), route, source, target: route.endpoints.find(p => p !== source)!, member, args: copy(y.args), emitted: this.time, correlation, kind: 'request', origin: correlation.origin });
        }
        catch (e) {
            if (!(e instanceof RuntimeFault))
                throw e;
            correlation.state = 'failed';
            this.resume(f, { failure: e.code });
        }
    }
    private respond(correlation: Correlation, response: Reply): void {
        if (correlation.state !== 'pending') {
            this.log('lateReply', correlation.route.id, { source: correlation.origin, correlation: correlation.id, terminal: correlation.state });
            return;
        }
        const request = (correlation as Correlation & {
            message?: Message;
        }).message;
        if (!request)
            return;
        try {
            this.offer({ ...request, id: this.id('m'), source: request.target, target: request.source, emitted: this.time, kind: 'reply', args: [], response, correlation, origin: correlation.origin });
        }
        catch (e) {
            if (!(e instanceof RuntimeFault))
                throw e;
            correlation.state = 'failed';
            this.resume(correlation.frame, { failure: 'transport' });
        }
    }
    /** The effective policy of a member route: member policy, else connection policy, else Default (WP6-R05). */
    private policyOf(route: Route, member: string): Policy { return route.members?.get(member) ?? route.policy; }
    /**
     * WP6-R01: one sample cell per port occurrence and sampled member, holding the member's initial value before any
     * startup work is released. consumed records whether the occurrence also owns the member's input (WP6-R04).
     */
    private initializeCells(c: Component, f: Frame): void {
        const owned = inputEndpoints(c.structure);
        for (const path of [...sampledMembers(c.structure)].sort()) {
            const [port, member] = path.split('.'), ep = memberEndpoint(c.structure, path);
            if (!ep?.member.initial || !ep.member.type)
                continue;
            const type = typeKey(ep.member.type);
            this.cells.set(`${c.path}.${port}|${member}`, { value: widen(this.sync(this.evaluate(ep.member.initial, f, new Map())), type), type, consumed: owned.has(path), offer: 0 });
        }
    }
    private offer(message: Message): void {
        const { route } = message, policy = this.policyOf(route, message.member), key = `${route.id}|${message.source}|${message.target}|${message.member}|${message.kind === 'reply' ? 'reply' : 'input'}`;
        // A sampled member updates its cell at each delivery (WP6-R02); without a consuming owner it has no queue (WP6-R04).
        const cell = message.kind === 'attribute' ? this.cells.get(`${message.target}|${message.member}`) : undefined, queued = !cell || cell.consumed;
        let queue = this.queues.get(key);
        if (!queue && queued) {
            queue = [];
            this.queues.set(key, queue);
        }
        queue ??= [];
        const admit = (): boolean => {
            if (!queued)
                return true;
            if (message.kind === 'attribute') {
                if (queue.length)
                    this.log('replaceAttribute', route.id, { source: message.origin, count: queue.length });
                queue.length = 0;
            }
            else if (queue.length >= policy.capacity) {
                this.log('overflow', route.id, { source: message.origin, policy: policy.overflow, member: message.member });
                if (policy.overflow === 'reject')
                    throw new RuntimeFault('rejected');
                if (policy.overflow === 'dropNewest')
                    return false;
                queue.shift();
            }
            return true;
        };
        if (!admit())
            return;
        const offer = ++this.offers;
        const fault = this.options.faults.find(x => x.offer === offer);
        if (fault?.kind === 'transport')
            throw new RuntimeFault('transport');
        if (fault?.kind === 'drop' && policy.delivery !== 'atLeastOnce') {
            this.log('drop', route.id, { source: message.origin, message: message.id });
            return;
        }
        if (fault?.kind === 'drop' && policy.delivery === 'atLeastOnce') {
            this.log('drop', route.id, { source: message.origin, message: message.id, attempt: 1 });
            this.log('retry', route.id, { source: message.origin, message: message.id, attempt: 2 });
        }
        const copies = fault?.kind === 'duplicate' && policy.delivery !== 'atMostOnce' ? 2 : 1;
        for (let i = 0; i < copies; i++) {
            if (i && !admit())
                break;
            const m = i ? { ...message, id: this.id('m'), args: copy(message.args) } : message;
            if (queued)
                queue.push(m);
            const latency = this.options.latencyNs + (fault?.delayNs ?? 0);
            if (policy.maxLatency !== undefined && latency > policy.maxLatency)
                throw new ContractViolation('MaxLatency');
            this.log('offer', route.id, { source: m.origin, message: m.id, member: m.member, correlation: m.correlation?.id, sourcePort: m.source, targetPort: m.target });
            this.at(this.time + latency, 2, () => {
                if (cell) {
                    // The delivery event updates the cell, whether or not an owner consumes the value, unless the value
                    // is older than maxAge at delivery; replacement in the owner's queue does not affect it (WP6-R02).
                    if (policy.maxAge !== undefined && this.time - m.emitted > policy.maxAge) {
                        if (queue!.includes(m))
                            queue!.splice(queue!.indexOf(m), 1);
                        this.log('discardAge', route.id, { source: m.origin, message: m.id });
                        return;
                    }
                    // A cell never goes back: a value offered before the one it holds, delivered later because of a
                    // fault delay, does not update it and is not a sample (WP6-R02). Copies of one offer all update it.
                    if (offer >= cell.offer) {
                        cell.value = widen(copy(m.args)[0], cell.type);
                        cell.offer = offer;
                        this.log('sample', `${m.target}.${m.member}`, { source: m.origin, message: m.id, targetPort: m.target, member: m.member, value: plain(cell.value) });
                    }
                }
                if (!queue!.includes(m))
                    return;
                if (policy.maxAge !== undefined && this.time - m.emitted > policy.maxAge) {
                    queue!.splice(queue!.indexOf(m), 1);
                    this.log('discardAge', route.id, { source: m.origin, message: m.id });
                    return;
                }
                (m as Message & { ready: boolean }).ready = true;
                m.delivered = ++this.deliveries;
            }, undefined, this.deliveryKey(m));
        }
    }
    private consume(): void {
        // SIF-R05, SIF-R06: a waiting state takes the first-delivered message of a member it names, which makes a look; a
        // delivery of an owned member it does not name is dropped on arrival. A busy machine leaves its input queued.
        for (const f of this.frames) {
            const w = f.waiting;
            if (f.done || f.script || w?.kind !== 'receive' || !w.flow || w.zero)
                continue;
            for (let h = this.flowHeads(f)[0]; h; h = this.flowHeads(f)[0]) {
                const m = this.take(h.queue, h.m, h.endpointName, f.c);
                if (w.flow.named.has(h.endpointName)) {
                    this.resume(f, { input: m });
                    break;
                }
                this.log('discardInput', h.endpointName, { source: m.origin, reason: 'inactiveOwner' });
            }
        }
        for (const queue of this.queues.values()) {
            while (queue.length) {
                const m = queue[0];
                if (!(m as Message & {
                    ready?: boolean;
                }).ready)
                    break;
                if (this.policyOf(m.route, m.member).maxAge !== undefined && this.time - m.emitted > this.policyOf(m.route, m.member).maxAge!) {
                    queue.shift();
                    this.log('discardAge', m.route.id, { source: m.origin, message: m.id });
                    continue;
                }
                const remove = () => { queue.shift(); this.log('deliver', m.route.id, { source: m.origin, message: m.id, correlation: m.correlation?.id, targetPort: m.target }); };
                if (m.kind === 'reply') {
                    remove();
                    const c = m.correlation!;
                    if (c.state !== 'pending') {
                        this.log('lateReply', m.route.id, { source: c.origin, correlation: c.id, terminal: c.state });
                        continue;
                    }
                    c.state = m.response?.failure ? 'failed' : 'succeeded';
                    this.log('reply', m.route.id, { source: c.origin, correlation: c.id, state: c.state });
                    this.resume(c.frame, m.response);
                    continue;
                }
                const destination = this.ports.get(m.target);
                if (!destination) {
                    remove();
                    continue;
                }
                const { c, p } = destination, endpointName = `${p.name}.${m.member}`, ep = memberEndpoint(c.structure, endpointName)!;
                if (ep) {
                    const types = ep.member.kind === 'attribute' ? [typeKey(ep.member.type)] : ep.member.parameters.map(p => typeKey(p.type));
                    m.args = m.args.map((v, i) => m.kind === 'request' && ep.member.parameters[i]?.direction === 'out' ? this.zero(types[i]) : widen(v, types[i]));
                }
                if (m.kind === 'request' && m.correlation) {
                    if (m.correlation.state !== 'pending') {
                        remove();
                        continue;
                    }
                    (m.correlation as Correlation & {
                        message: Message;
                    }).message = m;
                }
                const entry = schedule(c.structure).find(e => e.endpoint === endpointName && e.kind === (m.kind === 'request' ? 'call' : 'receive'));
                if (entry) {
                    remove();
                    this.release(c, entry, m);
                    continue;
                }
                let watch: Watch | undefined;
                for (const f of this.frames) {
                    watch = f.watches.find(w => w.active && !w.frame.done && w.frame.c === c && w.node.endpoint === endpointName);
                    if (watch)
                        break;
                }
                if (watch) {
                    remove();
                    const f = watch.frame;
                    watch.active = false;
                    if (f.request?.state === 'pending') {
                        f.request.state = 'interrupted';
                        this.log('cancelRequest', endpointName, { source: f.request.origin, correlation: f.request.id });
                    }
                    f.interrupted = new InterruptSignal(watch, { ...m, member: endpointName });
                    this.log('interrupt', endpointName, { activation: f.id, source: m.origin, region: this.source(watch.node) });
                    this.resume(f);
                    continue;
                }
                const waiting = this.findFrame(f => !f.done && f.waiting?.kind === 'receive' && f.waiting.branches.some(b => this.listens(f, b, c, endpointName, m.kind)));
                if (waiting && waiting.waiting?.kind === 'receive') {
                    remove();
                    const branch = waiting.waiting.branches.find(b => this.listens(waiting, b, c, endpointName, m.kind))!;
                    this.resume(waiting, { input: { ...m, member: endpointName }, branch });
                    continue;
                }
                const flowOwner = this.flowOwner(c, endpointName);
                if (flowOwner) {
                    // Kept while the machine runs, for its next waiting state to decide; discarded after it completed (SIF-R06, SIF-R13).
                    if (this.findFrame(x => x.c === c && x.op === flowOwner && !x.done))
                        break;
                    remove();
                    this.log('discardInput', endpointName, { source: m.origin, reason: 'inactiveOwner' });
                    continue;
                }
                const inactive = members(c.structure).filter(isExecutable).some(op => body(op) && nodes(body(op)!).some(n => a.isInterruptible(n) && n.endpoint === endpointName));
                if (inactive) {
                    remove();
                    this.log('discardInput', endpointName, { source: m.origin, reason: 'inactiveOwner' });
                    continue;
                }
                break;
            }
        }
    }
}
