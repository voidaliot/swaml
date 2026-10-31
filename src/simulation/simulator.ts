import { AstUtils, DocumentState, type AstNode } from 'langium';
import * as a from '../language/generated/ast.js';
import { expressionTypes, workspaceModels, body, container, direction, effectiveQos, endpoint, identity, isExecutable, localOperation, memberEndpoint, members, nanos, nodes, occurrences, owner, packageEndpoint, portMembers, resolve, runTarget, schedule, signature, statementIdentity, typeKey, type Executable, type Policy, type RunTarget, type Structure } from '../language/semantic.js';
import { binary, bind, checked, ContractViolation, copy, plain, RuntimeFault, scalar, voidValue, widen, type Environment, type Value } from './values.js';
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
export interface TraceEvent {
    timeNs: number;
    ordinal: number;
    kind: string;
    subject: string;
    /** The statementIdentity of the statement or schedule entry that caused this observation, when one did. */
    source?: string;
    [key: string]: unknown;
}
export interface SimulationResult {
    profile: 'swaml-reference/2.0';
    /** What ran: a whole package context, or one top-level component alone with its ports open. */
    target: {
        kind: 'package' | 'component';
        identity: string;
    };
    options: SimulationOptions;
    outcome: 'failure-observed' | 'no-failure-observed';
    status: 'quiescent' | 'horizon' | 'violation' | 'limit';
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
    branch?: a.ReceiveBranch | a.Transition;
};
type Yield = {
    kind: 'step';
} | {
    kind: 'wait';
    duration: number;
} | {
    kind: 'request';
    endpoint: string;
    site?: a.CallExpression;
    args: Value[];
} | {
    kind: 'receive';
    branches: (a.ReceiveBranch | a.Transition)[];
    timeout?: number;
};
type Iterator = Generator<Yield, Value, Reply | undefined>;
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
};
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
};
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
};
/**
 * Runs a validated workspace. target names a package, which runs all its top-level software
 * occurrences with their package connections and deployments, or Package::component, which runs
 * that top-level occurrence alone: its package connections are absent and its ports stay open.
 */
export function simulate(models: a.Model[], target: string, options: SimulationOptions): SimulationResult {
    for (const model of models) {
        const d = AstUtils.getDocument(model);
        if (d.parseResult.value!==model || d.state < DocumentState.Validated || d.diagnostics?.some(x => x.severity === 1))
            throw new Error('Simulation requires a linked, validated workspace without errors.');
    }
    const selected = runTarget(models, target);
    const libraries = (workspaceModels.get(models[0]) ?? []).filter(m => AstUtils.getDocument(m).uri.scheme === 'builtin');
    const supplied = new Set(models);
    for (const model of models) {
        const workspace = workspaceModels.get(model) ?? models;
        for (const pkg of model.packages)
            for (const i of pkg.imports)
                if (!i.namespace.startsWith('Swaml::') && !models.some(m => m.packages.some(p => p.name === i.namespace)))
                    throw new Error('Supply every imported application source.');
        for (const n of nodes(model)) {
            for (const ref of AstUtils.streamReferences(n)) {
                const target = 'ref' in ref.reference ? ref.reference.ref : undefined;
                if (target) {
                    const doc = AstUtils.getDocument(target);
                    if (doc.uri.scheme !== 'builtin' && !supplied.has(doc.parseResult.value as a.Model))
                        throw new Error('Supply every referenced application source.');
                }
            }
            if (a.isCallExpression(n) || a.isReferenceExpression(n)) {
                const path = a.isCallExpression(n) ? n.target : n.path;
                const target = path.includes('::') && resolve(n, path.split('.')[0], workspace);
                if (target) {
                    const doc = AstUtils.getDocument(target);
                    if (doc.uri.scheme !== 'builtin' && !supplied.has(doc.parseResult.value as a.Model))
                        throw new Error('Supply every qualified application source.');
                }
            }
        }
    }
    return new Interpreter([...new Set([...models, ...libraries])], selected, options).run();
}
class Interpreter {
    private components = new Map<string, Component>();
    private ports = new Map<string, {
        c: Component;
        p: a.PortUsage;
    }>();
    private aliases = new Map<string, string>();
    private routes: Route[] = [];
    private queues = new Map<string, Message[]>();
    private frames: Frame[] = [];
    private events: Event[] = [];
    private trace: TraceEvent[] = [];
    private machines: SimulationResult['machines'] = {};
    private deployments: SimulationResult['deployments'] = {};
    private time = 0;
    private steps = 0;
    private serial = 0;
    private order = 0;
    private offers = 0;
    private stop?: 'violation' | 'limit';
    private options: Required<SimulationOptions>;
    constructor(private models: a.Model[], private target: RunTarget, options: SimulationOptions) {
        this.options = { untilNs: options.untilNs, maxSteps: options.maxSteps ?? 100000, maxPending: options.maxPending ?? 1024, maxConcurrent: options.maxConcurrent ?? 64, latencyNs: options.latencyNs ?? 0, faults: options.faults ?? [] };
        for (const k of Object.keys(options))
            if (!(k in this.options))
                throw new Error(`Unknown simulation option ${k}`);
        for (const k of ['untilNs', 'maxSteps', 'maxPending', 'maxConcurrent', 'latencyNs'] as const)
            if (!Number.isSafeInteger(this.options[k]) || this.options[k] < (k === 'untilNs' || k === 'latencyNs' ? 0 : 1))
                throw new Error(`Invalid ${k}`);
        const seen = new Set<number>();
        for (const f of this.options.faults) {
            if (!Number.isSafeInteger(f.offer) || f.offer < 1 || seen.has(f.offer) || !['drop', 'duplicate', 'transport'].includes(f.kind) || f.delayNs !== undefined && (!Number.isSafeInteger(f.delayNs) || f.delayNs < 0))
                throw new Error('Invalid fault');
            seen.add(f.offer);
        }
    }
    private id(prefix: string): string { return `${prefix}${++this.serial}`; }
    private source(n?: AstNode): string | undefined { return n && statementIdentity(n); }
    private log(kind: string, subject: string, details: Record<string, unknown> = {}): void { this.trace.push({ timeNs: this.time, ordinal: this.trace.length + 1, kind, subject, ...details }); }
    private fuel = (): void => { if (++this.steps > this.options.maxSteps)
        throw new ContractViolation('StepLimit'); };
    private at(time: number, phase: number, run: () => void, live: () => boolean = () => true): void { if (!Number.isSafeInteger(time))
        throw new ContractViolation('ClockRange'); this.events.push({ time, phase, order: this.order++, run, live }); }
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
                this.log('initialize', c.path, { definition: identity(c.structure) });
                for (const [connectorIndex,l] of members(c.structure).filter(a.isConnect).entries()) {
                    const left = endpoint(c.structure, l.source)!, right = endpoint(c.structure, l.target)!;
                    if (left.child !== right.child)
                        this.aliases.set(`${c.path}.${left.child ? l.target : l.source}`, `${c.path}.${left.child ? l.source : l.target}`);
                    else
                        this.routes.push({ id: `${c.path}.${l.name ?? `@connect${connectorIndex}`}`, endpoints: [`${c.path}.${l.source}`, `${c.path}.${l.target}`], policy: effectiveQos(l) });
                }
            }
            // A package run adds the package connections between its top-level ports; a component run leaves them open.
            if (this.target.kind === 'package')
                this.target.package.connections.forEach((l, i) => {
                    if (packageEndpoint(this.target.package, l.source) && packageEndpoint(this.target.package, l.target))
                        this.routes.push({ id: l.name ?? `@package${i}`, endpoints: [l.source, l.target], policy: effectiveQos(l) });
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
                        this.at(0, 2, () => this.release(c, e));
                    if (e.kind === 'every') {
                        const period = nanos(e.period!);
                        const tick = () => { this.release(c, e); this.at(this.time + period, 2, tick); };
                        this.at(period, 2, tick);
                    }
                }
            while (this.events.length) {
                this.events = this.events.filter(e => e.live());
                if (!this.events.length)
                    break;
                this.events.sort((x, y) => x.time - y.time || x.phase - y.phase || x.order - y.order);
                if (this.events[0].time > this.options.untilNs)
                    break;
                const event = this.events.shift()!;
                this.time = event.time;
                this.fuel();
                event.run();
                this.pump();
            }
        }
        catch (e) {
            if (e instanceof RuntimeFault && initializing) {
                const { c, attribute } = initializing;
                this.log('failure', `${c.path}.${attribute.name}`, { phase: 'initialization', reason: e.code, declaration: identity(attribute), uri: AstUtils.getDocument(attribute).uri.toString(), range: attribute.$cstNode!.range });
            }
            else if (e instanceof ContractViolation) {
                this.stop = e.code === 'StepLimit' ? 'limit' : 'violation';
                this.log('violation', this.target.identity, { code: e.code });
            }
            else
                throw e;
        }
        return { profile: 'swaml-reference/2.0', target: { kind: this.target.kind, identity: this.target.identity }, options: copy(this.options), outcome: this.stop || this.trace.some(t => t.kind === 'failure'||t.kind==='caught') ? 'failure-observed' : 'no-failure-observed', status: this.stop ?? (this.events.length || this.frames.some(f => !f.done) ? 'horizon' : 'quiescent'), timeNs: this.time, steps: this.steps, sources: this.models.map(m => ({ uri: AstUtils.getDocument(m).uri.toString(), text: AstUtils.getDocument(m).textDocument.getText() })), trace: this.trace, stores: Object.fromEntries([...this.components].map(([path, c]) => [path, Object.fromEntries([...c.store].map(([n, v]) => [n, plain(v.value)]))])), machines: this.machines, deployments: this.deployments };
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
    }
    private sync(g: Iterator): Value { let r = g.next(); while (!r.done && r.value.kind === 'step')
        r = g.next(); if (!r.done)
        throw new Error('A pure expression suspended.'); return r.value; }
    private release(c: Component, entry: a.ScheduleEntry, message?: Message, predecessor?: Frame): void {
        if (this.frames.filter(f => !f.done && !f.started).length >= this.options.maxPending)
            throw new ContractViolation('ActivationOverflow');
        const op = members(c.structure).filter(isExecutable).find(x => x.name === entry.operation)!;
        const f: Frame = { id: this.id('a'), c, op, entry, released: this.time, iterator: undefined!, snapshot: new Map(), done: false, suspended: false, started: false, token: 0, watches: [], correlation: message?.correlation, at: entry };
        f.iterator = this.activate(f, message);
        this.frames.push(f);
        this.log('release', `${c.path}.${op.name}`, { activation: f.id, source: this.source(entry), cause: entry.kind, predecessorActivation: predecessor?.id });
        const deadline = entry.deadline ? nanos(entry.deadline) : entry.period ? nanos(entry.period) : undefined;
        if (deadline)
            this.at(this.time + deadline, 0, () => { if (!f.done)
                throw new ContractViolation('Deadline', f.id); }, () => !f.done);
    }
    private pump(): void {
        this.consume();
        for (const f of this.frames) {
            if (f.done || f.suspended || (f as Frame & {
                queued?: boolean;
            }).queued || (!f.entry.concurrent || !f.started) && f.c.lock && f.c.lock !== f)
                continue;
            if (f.entry.concurrent && !f.started && this.frames.filter(x => x.c === f.c && x.entry.concurrent && x.started && !x.done).length >= this.options.maxConcurrent)
                throw new ContractViolation('ConcurrentOverflow');
            if (!f.started) {
                f.started = true;
                f.snapshot = new Map([...f.c.store].map(([n, v]) => [n, copy(v)]));
                this.log('dispatch', `${f.c.path}.${f.op.name}`, { activation: f.id, source: this.source(f.entry), concurrent: f.entry.concurrent });
            }
            if (!f.entry.concurrent)
                f.c.lock = f;
            (f as Frame & {
                queued: boolean;
            }).queued = true;
            this.at(this.time, 4, () => { (f as Frame & {
                queued: boolean;
            }).queued = false; this.drive(f); });
        }
    }
    private unlock(f: Frame): void { if (f.c.lock === f) {
        f.c.lock = undefined;
        this.log('unlock', f.c.path, { activation: f.id });
    } }
    private resume(f: Frame, reply?: Reply): void { if (f.done)
        return; f.token++; f.waiting = undefined; f.suspended = false; f.reply = reply; this.log('ready', `${f.c.path}.${f.op.name}`, { activation: f.id }); }
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
            f.waiting = y;
            f.suspended = true;
            this.unlock(f);
            const token = ++f.token;
            this.log(y.kind === 'request' ? 'requestWait' : y.kind === 'receive' ? 'receiveWait' : 'wait', `${f.c.path}.${f.op.name}`, { activation: f.id, source: this.source(f.at) });
            if (y.kind === 'wait')
                this.at(this.time + y.duration, 2, () => { if (f.token === token)
                    this.resume(f); }, () => f.token === token && !f.done);
            if (y.kind === 'receive' && y.timeout !== undefined)
                this.at(this.time + y.timeout, 1, () => { if (f.token === token && f.suspended)
                    this.resume(f, {}); }, () => f.token === token && !f.done);
            if (y.kind === 'request')
                this.request(f, y);
        }
        catch (e) {
            if (!(e instanceof RuntimeFault))
                throw e;
            this.finish(f, undefined, e.code);
        }
    }
    private finish(f: Frame, value?: Value, failure?: string): void {
        f.done = true;
        f.suspended = false;
        f.token++;
        for (const w of f.watches)
            w.active = false;
        this.unlock(f);
        this.log(failure ? 'failure' : 'complete', `${f.c.path}.${f.op.name}`, { activation: f.id, source: failure ? this.source(f.at) : undefined, value: value ? plain(value) : undefined, reason: failure });
        if (f.correlation)
            this.respond(f.correlation, { value, failure: failure ? 'remoteFailure' : undefined, out: (f as Frame & {
                    out?: Value[];
                }).out });
        if (!failure)
            for (const e of schedule(f.c.structure))
                if (e.kind === 'after' && e.predecessor === f.op.name)
                    this.at(this.time, 2, () => this.release(f.c, e, undefined, f));
    }
    private *activate(f: Frame, message?: Message): Iterator {
        const env: Environment = new Map();
        if (message)
            this.bindInputs(env, f.entry.bindings, message);
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
        try {
            if (identity(sig).startsWith('Swaml::Math::') && ['floor', 'round', 'trunc', 'length'].includes(sig.name))
                return this.intrinsic(sig.name, args);
            if (body(op)?.states.length)
                yield* this.machine(op, f, local);
            else
                yield* this.block(body(op)!, f, local);
        }
        catch (e) {
            if (!(e instanceof ReturnValue))
                throw e;
            result = e.value;
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
    private *evaluate(e: a.Expression, f: Frame, local: Environment): Iterator {
        this.fuel();
        const env = this.env(f, local);
        if (a.isLiteral(e))
            return e.number !== undefined ? checked(e.$cstNode!.text.includes('.') ? 'real' : 'int', e.number) : e.boolean !== undefined ? scalar('bool', e.boolean === 'true') : scalar('string', e.text!);
        if (a.isReferenceExpression(e)) {
            const [head, ...fields] = e.path.split('.');
            let value = env.get(head)?.value;
            if (!value) {
                const en = resolve(e, head, this.models);
                if (a.isEnumType(en))
                    return scalar(identity(en), fields[0]);
                throw new RuntimeFault('Type', e.path);
            }
            for (const key of fields)
                value = (value.data as Record<string, Value>)[key];
            if (e.index) {
                const index = (yield* this.evaluate(e.index, f, local)).data as number;
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
            const remote = e.target.includes('.'), op = remote ? undefined : localOperation(e, e.target, container(e) ? f.c.structure : undefined) ?? resolve(e, e.target, this.models), sig = op && isExecutable(op) ? signature(op) : memberEndpoint(f.c.structure, e.target)?.member;
            const args: Value[] = [], outs: (string | undefined)[] = [];
            for (let i = 0; i < e.args.length; i++) {
                if (sig?.parameters[i]?.direction === 'out') {
                    args.push(this.zero(typeKey(sig.parameters[i].type)));
                    outs[i] = (e.args[i] as a.ReferenceExpression).path;
                }
                else
                    args.push(widen(yield* this.evaluate(e.args[i], f, local), typeKey(sig!.parameters[i].type)));
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
        if (a.isUnaryExpression(e)) {
            const v = yield* this.evaluate(e.operand, f, local);
            return e.operator === 'not' ? scalar('bool', !v.data) : checked(v.type === 'real' ? 'real' : 'int', -(v.data as number));
        }
        const left = yield* this.evaluate(e.left, f, local);
        if (e.operator === 'and' && left.data === false || e.operator === 'or' && left.data === true)
            return left;
        return binary(e.operator, left, yield* this.evaluate(e.right, f, local));
    }
    private *block(b: a.Block | a.OperationBody, f: Frame, parent: Environment): Iterator {
        const local = new Map(parent);
        for (const s of b.statements) {
            this.fuel();
            f.at = s;
            if (a.isLocalVariable(s))
                bind(local, s.name, typeKey(s.type), yield* this.evaluate(s.value, f, local));
            else if (a.isAssign(s))
                this.assign(f, local, s.target, yield* this.evaluate(s.value, f, local));
            else if (a.isExpressionStatement(s))
                yield* this.evaluate(s.expression, f, local);
            else if (a.isReturn(s))
                throw new ReturnValue(s.value ? yield* this.evaluate(s.value, f, local) : voidValue());
            else if (a.isIf(s)) {
                if ((yield* this.evaluate(s.condition, f, local)).data)
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
            else if (a.isWait(s))
                yield { kind: 'wait', duration: nanos(s.duration) };
            else if (a.isReceive(s)) {
                const reply = yield { kind: 'receive', branches: s.branches, timeout: s.timeout ? nanos(s.timeout) : undefined };
                if (reply?.input && reply.branch && a.isReceiveBranch(reply.branch)) {
                    const scope = new Map(local);
                    this.bindInputs(scope, reply.branch.bindings, reply.input);
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
                this.log('assert', `${f.c.path}.${f.op.name}`, { activation: f.id, source: this.source(s), passed });
                if (!passed)
                    throw new RuntimeFault('Assertion');
            }
            else if (a.isFail(s))
                throw new RuntimeFault('Failure', s.reason);
            yield { kind: 'step' };
        }
        return voidValue();
    }
    private *machine(op: Executable, f: Frame, local: Environment): Iterator {
        const b = body(op)!;
        let state = b.states.find(s => s.name === b.initial)!;
        const key = `${f.c.path}.${op.name}`;
        while (true) {
            const entered = this.time;
            this.machines[key] = { state: state.name, live: !state.final };
            f.at = state;
            this.log('state', key, { state: state.name, activation: f.id, source: this.source(state) });
            for (const action of state.actions.filter(x => x.kind === 'entry'))
                yield* this.block(action.body, f, local);
            if (state.final)
                return voidValue();
            let selected: a.Transition | undefined, input: Message | undefined;
            while (!selected) {
                const timers = state.transitions.filter(t => !!t.delay).sort((x, y) => nanos(x.delay!) - nanos(y.delay!));
                const expires = timers[0] ? entered + nanos(timers[0].delay!) : undefined;
                if (expires !== undefined && !Number.isSafeInteger(expires))
                    throw new ContractViolation('ClockRange');
                const delay = expires === undefined ? undefined : Math.max(0, expires - this.time);
                // Entry actions move f.at; the wait and its selection belong to the state.
                f.at = state;
                // Entry may suspend past expiry. Select the elapsed timer before queued input.
                const reply: Reply | undefined = delay === 0 ? undefined : yield { kind: 'receive', branches: state.transitions, timeout: delay };
                input = reply?.input;
                const choices = input ? state.transitions.filter(t => t.endpoint === input!.member) : timers.filter(t => nanos(t.delay!) === nanos(timers[0].delay!));
                for (const t of choices) {
                    const scope = new Map(local);
                    if (input)
                        this.bindInputs(scope, t.bindings, input);
                    f.at = t;
                    if (!t.guard || (yield* this.evaluate(t.guard, f, scope)).data) {
                        selected = t;
                        break;
                    }
                }
                if (!selected)
                    this.log('discardInput', key, { activation: f.id, source: input?.origin ?? this.source(state), reason: 'noEnabledTransition' });
            }
            for (const action of state.actions.filter(x => x.kind === 'exit'))
                yield* this.block(action.body, f, local);
            const scope = new Map(local);
            if (input)
                this.bindInputs(scope, selected.bindings, input);
            yield* this.block(selected.effect, f, scope);
            state = b.states.find(s => s.name === selected!.target)!;
        }
    }
    private bindInputs(env: Environment, bindings: string[], message: Message): void { bindings.forEach((n, i) => { if (message.args[i])
        bind(env, n, message.args[i].type, message.args[i]); }); }
    private emit(f: Frame, endpointName: string, args: Value[], kind: 'event' | 'attribute',site:a.Send): void {
        const declared = memberEndpoint(f.c.structure, endpointName)!.member;
        const types = declared.kind === 'attribute' ? [typeKey(declared.type)] : declared.parameters.map(p => typeKey(p.type));
        args = args.map((v, i) => widen(v, types[i]));
        const [port, member] = endpointName.split('.'), source = this.leaf(`${f.c.path}.${port}`);
        const origin = this.source(site);
        this.log(kind === 'event' ? 'publish' : 'send', `${source}.${member}`, { activation: f.id, source: origin, emitter:{declaration:identity(owner(site,isExecutable)!),uri:AstUtils.getDocument(site).uri.toString(),range:site.$cstNode!.range}, args: args.map(plain) });
        for (const route of this.routes.filter(r => r.endpoints.includes(source))){const target=route.endpoints.find(p=>p!==source)!,destination=this.ports.get(target),memberTarget=destination&&portMembers(destination.p).find(m=>m.name===member&&m.kind===kind&&direction(destination.p,m)==='requires');if(!memberTarget)continue;this.offer({id:this.id('m'),route,source,target,member,args:copy(args),emitted:this.time,kind,origin});}
    }
    private request(f: Frame, y: Extract<Yield, {
        kind: 'request';
    }>): void {
        const [port, member] = y.endpoint.split('.'), source = this.leaf(`${f.c.path}.${port}`), route = this.routes.find(r => r.endpoints.includes(source));
        if (!route) {
            this.resume(f, { failure: 'unavailable' });
            return;
        }
        const correlation: Correlation = { id: this.id('r'), frame: f, route, state: 'pending', expiry: this.time + route.policy.requestTimeout, origin: this.source(y.site) };
        f.request = correlation;
        this.log('request', `${source}.${member}`, { activation: f.id, source: correlation.origin, correlation: correlation.id, route: route.id, caller:y.site?{declaration:identity(owner(y.site,isExecutable)!),uri:AstUtils.getDocument(y.site).uri.toString(),range:y.site.$cstNode!.range}:undefined });
        this.at(correlation.expiry, 0, () => { if (correlation.state === 'pending') {
            correlation.state = 'failed';
            this.log('timeout', y.endpoint, { source: correlation.origin, correlation: correlation.id });
            this.resume(f, { failure: 'timeout' });
        } }, () => correlation.state === 'pending');
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
    private offer(message: Message): void {
        const { route } = message, policy = route.policy, key = `${route.id}|${message.source}|${message.target}|${message.member}|${message.kind === 'reply' ? 'reply' : 'input'}`;
        let queue = this.queues.get(key);
        if (!queue) {
            queue = [];
            this.queues.set(key, queue);
        }
        const admit = (): boolean => {
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
            queue.push(m);
            const latency = this.options.latencyNs + (fault?.delayNs ?? 0);
            if (policy.maxLatency !== undefined && latency > policy.maxLatency)
                throw new ContractViolation('MaxLatency');
            this.log('offer', route.id, { source: m.origin, message: m.id, member: m.member, correlation: m.correlation?.id, sourcePort: m.source, targetPort: m.target });
            this.at(this.time + latency, 2, () => { if (!queue!.includes(m))
                return; if (policy.maxAge !== undefined && this.time - m.emitted > policy.maxAge) {
                queue!.splice(queue!.indexOf(m), 1);
                this.log('discardAge', route.id, { source: m.origin, message: m.id });
                return;
            } (m as Message & {
                ready: boolean;
            }).ready = true; });
        }
    }
    private consume(): void {
        for (const queue of this.queues.values()) {
            while (queue.length) {
                const m = queue[0];
                if (!(m as Message & {
                    ready?: boolean;
                }).ready)
                    break;
                if (m.route.policy.maxAge !== undefined && this.time - m.emitted > m.route.policy.maxAge) {
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
                const watch = this.frames.flatMap(f => f.watches).find(w => w.active && !w.frame.done && w.frame.c === c && w.node.endpoint === endpointName);
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
                const waiting = this.frames.find(f => !f.done && f.c === c && f.waiting?.kind === 'receive' && f.waiting.branches.some(b => b.endpoint === endpointName));
                if (waiting && waiting.waiting?.kind === 'receive') {
                    remove();
                    const branch = waiting.waiting.branches.find(b => b.endpoint === endpointName)!;
                    this.resume(waiting, { input: { ...m, member: endpointName }, branch });
                    continue;
                }
                const stateOwner = members(c.structure).filter(isExecutable).find(op => body(op)?.states.length && nodes(body(op)!).some(n => a.isTransition(n) && n.endpoint === endpointName));
                const stateFrame = stateOwner && this.frames.find(f => f.c === c && f.op === stateOwner && !f.done);
                if (stateFrame && stateFrame.waiting?.kind !== 'receive')
                    break;
                const inactive = !!stateOwner || members(c.structure).filter(isExecutable).some(op => body(op) && nodes(body(op)!).some(n => a.isInterruptible(n) && n.endpoint === endpointName));
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
