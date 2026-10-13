import { AstUtils, DocumentState } from 'langium';
import * as a from '../language/generated/ast.js';
import { owner } from '../language/swaml-scope.js';
import { nanos, typeKey } from '../language/semantic.js';
import { bind, copy, evaluate, plain, RuntimeFault, scalar, type Environment, type Value, widen } from './values.js';

export interface SimulationOptions {
    untilNs: number;
    maxSteps?: number;
    maxPending?: number;
    maxReentrant?: number;
    latencyNs?: number;
    manual?: { atNs: number; operation: string }[];
    faults?: { offer: number; kind: 'drop' | 'duplicate' | 'transport'; delayNs?: number }[];
}
export interface TraceEvent { timeNs: number; ordinal: number; kind: string; subject: string; [key: string]: unknown }
export interface SimulationResult {
    profile: 'swaml-reference/1.0'; system: string; options: SimulationOptions;
    outcome: 'failed' | 'no-failure-observed';
    status: 'quiescent' | 'horizon' | 'violation' | 'limit'; timeNs: number; steps: number;
    sources: { uri: string; text: string }[];
    trace: TraceEvent[]; stores: Record<string, Record<string, unknown>>;
    machines: Record<string, { state: string; live: boolean }>;
    deployments: Record<string, string | null>;
}
type Event = { time: number; phase: number; order: number; run: () => void };
type Unit = { path: string; definition: a.Unit; store: Environment; serial: boolean; active: number };
type Route = { path: string; source: string; target: string; qos: a.Qos };
type Response = { value?: Value; failure?: string };
type Message = { id: string; route: Route; source: string; target: string; member: string; args: Value[]; emitted: number; ready: number; response?: Response; correlation?: Correlation; copies: number; attempt: number; available: boolean; work?: Work };
type Queue = { key: string; items: Message[] };
type Correlation = { id: string; expiry: number; state: 'Pending' | 'Succeeded' | 'Failed'; frame: Frame; response?: Response };
type Machine = { unit: Unit; operation: a.Operation; state: a.State; generation: number; ready: boolean; live: boolean; reacting: boolean };
type Work = { unit: Unit; operation: a.Operation; released: number; args: Value[]; machine?: Machine; stimulus?: { kind: 'initialize' | 'receive' | 'after'; endpoint?: string; delay?: number; generation?: number }; message?: Message; done: boolean; frame?: Frame; id: string };
type Frame = { id: string; work: Work; snapshot: Environment; iterator: Generator<Yield, Value | undefined, Response | undefined>; waiting: boolean; done: boolean; serial: boolean };
type Yield = { kind: 'step' } | { kind: 'request'; endpoint: string; args: Value[]; timeout: number };
class ReturnValue { constructor(public value?: Value) {} }

/** A deterministic, zero CPU-cost reference interpreter. Requires a fully built, valid workspace. */
export function simulate(models: a.Model[], systemName: string, input: SimulationOptions): SimulationResult {
    if (!models.length) throw new Error('Supply a validated workspace.');
    for (const model of models) {
        const d = AstUtils.getDocument(model);
        if (d.state < DocumentState.Validated || d.diagnostics?.some(x => x.severity === 1)) throw new Error('Simulation requires all input documents to be linked and validated without errors.');
    }
    const supplied = new Set(models);
    for (const model of models) for (const node of AstUtils.streamAst(model)) for (const reference of AstUtils.streamReferences(node)) {
        const target = 'ref' in reference.reference ? reference.reference.ref : undefined;
        if (target && !supplied.has(AstUtils.getDocument(target).parseResult.value as a.Model)) throw new Error('Supply every referenced document in the validated workspace.');
    }
    const systems = models.flatMap(m => m.packages.flatMap(p => p.elements.filter(a.isSystem).map(s => ({ id: `${p.name}::${s.name}`, system: s }))));
    const selected = systems.find(s => s.id === systemName);
    if (!selected) throw new Error(`Unknown system ${systemName}; use a qualified Package::System name.`);
    return new Interpreter(models, selected.system, selected.id, input).run();
}
class Interpreter {
    private options: Required<SimulationOptions>;
    private units = new Map<string, Unit>();
    private aliases = new Map<string, string>();
    private ports = new Map<string, { unit: Unit; port: a.Port }>();
    private routes: Route[] = [];
    private queues = new Map<string, Queue>();
    private machines: Machine[] = [];
    private pending: Work[] = [];
    private events: Event[] = [];
    private trace: TraceEvent[] = [];
    private deployments: Record<string, string | null> = Object.create(null);
    private time = 0;
    private steps = 0;
    private serial = 0;
    private order = 0;
    private offers = 0;
    private stopped?: 'violation' | 'limit';
    constructor(private models: a.Model[], private system: a.System, private id: string, options: SimulationOptions) {
        this.options = { untilNs: options.untilNs, maxSteps: options.maxSteps ?? 100000, maxPending: options.maxPending ?? 1024, maxReentrant: options.maxReentrant ?? 64, latencyNs: options.latencyNs ?? 0, manual: copy(options.manual ?? []), faults: copy(options.faults ?? []) };
        if (!Number.isSafeInteger(this.options.untilNs) || this.options.untilNs < 0) throw new Error('untilNs must be a nonnegative safe integer');
        for (const key of ['untilNs', 'maxSteps', 'maxPending', 'maxReentrant', 'latencyNs'] as const) { const value = this.options[key]; if (!Number.isSafeInteger(value) || value < (['maxSteps', 'maxPending', 'maxReentrant'].includes(key) ? 1 : 0)) throw new Error(`Invalid ${key}`); }
        if (!Array.isArray(this.options.manual) || !Array.isArray(this.options.faults)) throw new Error('manual and faults must be arrays');
        for (const key of Object.keys(options)) if (!(key in this.options)) throw new Error(`Unknown simulation option ${key}`);
        for (const release of this.options.manual) if (!Number.isSafeInteger(release.atNs) || release.atNs < 0 || release.atNs > this.options.untilNs) throw new Error('Invalid manual release time');
        const offerNumbers = new Set<number>();
        for (const fault of this.options.faults) {
            if (!Number.isSafeInteger(fault.offer) || fault.offer < 1 || offerNumbers.has(fault.offer) || !['drop', 'duplicate', 'transport'].includes(fault.kind) || (fault.delayNs !== undefined && (!Number.isSafeInteger(fault.delayNs) || fault.delayNs < 0))) throw new Error('Invalid or duplicate fault offer');
            offerNumbers.add(fault.offer);
        }
    }
    private log(kind: string, subject: string, detail: Record<string, unknown> = {}): void { this.trace.push({ timeNs: this.time, ordinal: this.trace.length + 1, kind, subject, ...detail }); }
    private uid(prefix: string): string { return `${prefix}${++this.serial}`; }
    private fuel = (): void => { if (++this.steps > this.options.maxSteps) throw new RuntimeFault('StepLimit'); };
    private addTime(t: number, d: number): number { const result = t + d; if (!Number.isSafeInteger(result)) throw new RuntimeFault('ClockRange'); return result; }
    private schedule(time: number, phase: number, run: () => void): void { this.events.push({ time, phase, order: this.order++, run }); }
    private leaf(path: string): string { while (this.aliases.has(path)) path = this.aliases.get(path)!; return path; }
    private expand(c: a.System | a.Component, prefix = '', allocation: string | null = null): void {
        const path = (name: string) => prefix ? `${prefix}.${name}` : name;
        for (const member of c.members) {
            this.fuel();
            if (a.isDelegate(member)) this.aliases.set(path(member.outer.ref!.name), path(member.target));
            if (a.isConnect(member)) this.routes.push({ path: path(member.name), source: path(member.source), target: path(member.target), qos: member.qos! });
            if (!a.isInstance(member)) continue;
            const p = path(member.name), definition = member.definition.ref!;
            const node = this.system.members.filter(a.isDeployment).find(d => d.target === p)?.node.ref?.name ?? allocation;
            this.deployments[p] = node;
            if (a.isComponent(definition)) this.expand(definition, p, node);
            else {
                const unit: Unit = { path: p, definition, store: new Map(), serial: false, active: 0 };
                this.units.set(p, unit);
                for (const variable of definition.members.filter(a.isVariable)) bind(unit.store, variable.name, typeKey(variable.type), evaluate(variable.value, new Map(), this.fuel));
                for (const port of definition.members.filter(a.isPort)) this.ports.set(`${p}.${port.name}`, { unit, port });
                for (const operation of definition.members.filter(a.isOperation)) if (operation.machine) this.machines.push({ unit, operation, state: operation.machine.initial.ref!, generation: 0, ready: false, live: true, reacting: false });
                this.log('initialize', p, { definition: `${owner(definition, a.isPackage)!.name}::${definition.name}`, node });
            }
        }
    }
    run(): SimulationResult {
        try {
            this.expand(this.system);
            for (const r of this.routes) { r.source = this.leaf(r.source); r.target = this.leaf(r.target); }
            for (const unit of this.units.values()) for (const op of unit.definition.members.filter(a.isOperation)) {
                if (op.trigger?.kind === 'start') this.schedule(0, 1, () => this.release(unit, op, this.machines.find(m => m.unit === unit && m.operation === op), { kind: 'initialize' }));
                if (op.trigger?.kind === 'every') {
                    const period = nanos(op.trigger.period!);
                    const recur = () => { this.release(unit, op); this.schedule(this.addTime(this.time, period), 1, recur); };
                    this.schedule(period, 1, recur);
                }
            }
            for (const manual of this.options.manual) {
                const parts = manual.operation.split('.'), name = parts.pop()!, unit = this.units.get(parts.join('.'));
                const op = unit?.definition.members.filter(a.isOperation).find(x => x.name === name && x.trigger?.kind === 'manual');
                if (!unit || !op) throw new Error(`Manual release requires a parameterless on manual operation: ${manual.operation}`);
                this.schedule(manual.atNs, 1, () => this.release(unit, op));
            }
            while (this.events.length && !this.stopped) {
                this.events.sort((x, y) => x.time - y.time || x.phase - y.phase || x.order - y.order);
                const event = this.events[0];
                if (event.time > this.options.untilNs) break;
                this.events.shift(); this.time = event.time; this.fuel(); event.run(); this.pump();
            }
        } catch (error) {
            if (!(error instanceof RuntimeFault)) throw error;
            this.stopped = error.code === 'StepLimit' ? 'limit' : 'violation';
            this.log('violation', this.id, { code: error.code, message: error.message });
        }
        return { profile: 'swaml-reference/1.0', outcome: this.stopped || this.trace.some(t => t.kind === 'failure') ? 'failed' : 'no-failure-observed', system: this.id, options: copy(this.options), status: this.stopped ?? (this.events.length ? 'horizon' : 'quiescent'), timeNs: this.time, steps: this.steps,
            sources: this.models.map(m => ({ uri: AstUtils.getDocument(m).uri.toString(), text: AstUtils.getDocument(m).textDocument.getText() })).sort((x, y) => x.uri.localeCompare(y.uri)),
            trace: this.trace, stores: Object.fromEntries([...this.units].map(([p, u]) => [p, Object.fromEntries([...u.store].map(([n, v]) => [n, plain(v.value)]))])),
            machines: Object.fromEntries(this.machines.map(m => [`${m.unit.path}.${m.operation.name}`, { state: m.state.name, live: m.live }])), deployments: this.deployments };
    }
    private release(unit: Unit, operation: a.Operation, machine?: Machine, stimulus?: Work['stimulus']): void {
        if (machine && (!machine.live || (stimulus?.generation !== undefined && stimulus.generation !== machine.generation))) { this.log('discardTimer', `${unit.path}.${operation.name}`); return; }
        if (this.pending.length >= this.options.maxPending) throw new RuntimeFault('ActivationOverflow');
        const work: Work = { id: this.uid('a'), unit, operation, released: this.time, args: [], machine, stimulus, done: false };
        this.pending.push(work); this.released(work);
    }
    private released(work: Work): void {
        this.log('release', work.id, { operation: `${work.unit.path}.${work.operation.name}` });
        if (work.operation.timing) this.schedule(this.addTime(work.released, nanos(work.operation.timing.deadline)), 3, () => {
            if (!work.done) throw new RuntimeFault('Deadline', `Deadline missed: ${work.unit.path}.${work.operation.name}`);
        });
    }
    private prepare(m: Message): void {
        if (m.response) return;
        const handler = this.handler(m);
        m.work = { ...handler, id: this.uid('a'), released: m.ready, args: copy(m.args), message: m, done: false, stimulus: handler.machine ? { kind: 'receive', endpoint: `${this.ports.get(m.target)!.port.name}.${m.member}` } : undefined };
        this.released(m.work);
    }
    private discard(m: Message, reason: string): void { if (m.work && !m.work.frame) m.work.done = true; this.log('drop', m.id, { reason }); }
    private canDispatch(w: Pick<Work, 'unit' | 'operation' | 'machine'>): boolean {
        return !(w.machine?.reacting) && (w.operation.timing?.concurrency === 'reentrant' ? w.unit.active < this.options.maxReentrant : !w.unit.serial);
    }
    private handler(m: Message): { unit: Unit; operation: a.Operation; machine?: Machine } {
        const p = this.ports.get(m.target)!;
        const endpoint = `${p.port.name}.${m.member}`;
        const machine = this.machines.find(x => x.unit === p.unit && x.operation.machine!.transitions.some(t => t.kind === 'receive' && t.endpoint === endpoint));
        const operation = machine?.operation ?? p.unit.definition.members.filter(a.isOperation).find(x => ['receive', 'call'].includes(x.trigger?.kind ?? '') && x.trigger?.endpoint === endpoint)!;
        return { unit: p.unit, operation, machine };
    }
    private pump(): void {
        for (let i = 0; i < this.pending.length;) {
            const work = this.pending[i];
            if (work.machine && (!work.machine.live || (work.stimulus?.generation !== undefined && work.stimulus.generation !== work.machine.generation))) { work.done = true; this.pending.splice(i, 1); this.log('discardTimer', work.id); }
            else if (this.canDispatch(work)) { this.pending.splice(i, 1); this.start(work); } else i++;
        }
        for (const q of this.queues.values()) {
            while (q.items.length) {
                const m = q.items[0];
                if (!m.available) break;
                if (m.route.qos.maxAge && this.time - m.emitted > nanos(m.route.qos.maxAge)) { q.items.shift(); this.discard(m, 'Expired'); continue; }
                if (m.response) { if (--m.copies === 0) q.items.shift(); this.log('delivery', m.id, { correlation: m.correlation!.id, route: m.route.path }); this.complete(m.correlation!, m.response); continue; }
                const handler = this.handler(m);
                if (handler.machine && !handler.machine.live) { q.items.shift(); this.discard(m, 'Undeliverable'); continue; }
                if (handler.machine && !handler.machine.ready) break;
                if (!this.canDispatch(handler)) break;
                if (--m.copies === 0) q.items.shift();
                const work = m.work!;
                this.log('delivery', m.id, { attempt: ++m.attempt, route: m.route.path, source: `${m.source}.${m.member}`, target: `${m.target}.${m.member}`, correlation: m.correlation?.id });
                this.start(work);
                if (m.copies > 0) this.prepare(m);
            }
        }
    }
    private start(work: Work): void {
        const serial = work.operation.timing?.concurrency !== 'reentrant';
        if (serial) work.unit.serial = true;
        else work.unit.active++;
        if (work.machine) work.machine.reacting = true;
        const frame = { id: work.id, work, snapshot: serial ? work.unit.store : new Map([...work.unit.store].map(([k, v]) => [k, copy(v)])), waiting: false, done: false, serial } as Frame;
        frame.iterator = work.machine ? this.reaction(frame) : this.operation(frame, work.operation, work.args);
        work.frame = frame;
        this.log('dispatch', frame.id, { operation: `${work.unit.path}.${work.operation.name}`, mode: serial ? 'serial' : 'reentrant' });
        this.schedule(this.time, 2, () => this.advance(frame));
    }
    private advance(frame: Frame, response?: Response): void {
        if (frame.done) return;
        try {
            const step = frame.iterator.next(response);
            if (step.done) { this.finish(frame, { value: step.value }); return; }
            if (step.value.kind === 'step') this.schedule(this.time, 2, () => this.advance(frame));
            else {
                const request = step.value;
                const c: Correlation = { id: this.uid('r'), expiry: this.addTime(this.time, request.timeout), state: 'Pending', frame };
                frame.waiting = true;
                this.log('request', c.id, { activation: frame.id, endpoint: request.endpoint, expiryNs: c.expiry });
                this.schedule(c.expiry, 0, () => { if (c.state === 'Pending') { this.log('timeout', c.id); this.complete(c, { failure: 'Timeout' }); } });
                const failure = this.emit(frame, request.endpoint, request.args, c);
                if (failure) this.complete(c, { failure });
            }
        } catch (error) {
            if (!(error instanceof RuntimeFault)) throw error;
            if (['StepLimit', 'ClockRange', 'ActivationOverflow', 'Deadline'].includes(error.code)) throw error;
            this.finish(frame, { failure: error.code }, error.message);
        }
    }
    private finish(frame: Frame, response: Response, message?: string): void {
        frame.done = true; frame.work.done = true;
        if (frame.serial) frame.work.unit.serial = false; else frame.work.unit.active--;
        const machine = frame.work.machine;
        if (machine) { machine.reacting = false; if (response.failure) { machine.live = false; machine.generation++; } }
        this.log(response.failure ? 'failure' : 'complete', frame.id, { operation: `${frame.work.unit.path}.${frame.work.operation.name}`, code: response.failure, message, result: response.value ? plain(response.value) : undefined });
        const request = frame.work.message;
        if (request?.correlation) {
            const reply: Response = response.failure ? { failure: 'RemoteFailure' } : response;
            const failure = this.offer(request.route, request.target, request.source, request.member, [], request.correlation, reply, frame.id);
            if (failure) this.complete(request.correlation, { failure });
        }
    }
    private complete(c: Correlation, response: Response): void {
        if (c.state !== 'Pending') { this.log('discardResponse', c.id, { reason: 'TerminalCorrelation' }); return; }
        if (!response.failure && this.time >= c.expiry) response = { failure: 'Timeout' };
        c.state = response.failure ? 'Failed' : 'Succeeded'; c.response = copy(response); c.frame.waiting = false;
        this.log('requestComplete', c.id, { state: c.state, failure: response.failure, value: response.value ? plain(response.value) : undefined });
        this.schedule(this.time, 2, () => this.advance(c.frame, response));
    }
    private emit(frame: Frame, endpoint: string, args: Value[], correlation?: Correlation): string | undefined {
        const [portName, member] = endpoint.split('.'), source = `${frame.work.unit.path}.${portName}`;
        const port = this.ports.get(source)!.port;
        const reverse = port.role === 'provides';
        const routes = this.routes.filter(r => (reverse ? r.target : r.source) === source);
        if (!routes.length) return correlation ? 'Unavailable' : undefined;
        let failure: string | undefined;
        for (const route of routes) failure = this.offer(route, source, reverse ? route.source : route.target, member, args, correlation, undefined, frame.id) ?? failure;
        return failure;
    }
    private offer(route: Route, source: string, target: string, member: string, args: Value[], correlation?: Correlation, response?: Response, activation?: string): string | undefined {
        const id = this.uid('m'), offer = ++this.offers;
        const fault = this.options.faults.find(f => f.offer === offer);
        this.log('emission', id, { offer, activation, route: route.path, source: `${source}.${member}`, target: `${target}.${member}`, payload: args.map(plain), correlation: correlation?.id, response: !!response });
        if (fault?.kind === 'transport') { this.log('drop', id, { reason: 'Transport' }); return 'Transport'; }
        if (fault?.kind === 'duplicate' && route.qos.delivery !== 'atLeastOnce') throw new Error('Duplicate injection requires atLeastOnce delivery.');
        const key = `${route.path}/${source === route.source ? 'forward' : 'reverse'}/${member}`;
        let queue = this.queues.get(key);
        if (!queue) { queue = { key, items: [] }; this.queues.set(key, queue); }
        if (queue.items.length >= route.qos.capacity) {
            if (route.qos.overflow === 'reject') { this.log('reject', id); return 'Rejected'; }
            if (route.qos.overflow === 'dropNewest') { this.log('drop', id, { reason: 'dropNewest' }); return undefined; }
            this.discard(queue.items.shift()!, 'dropOldest');
        }
        const delay = fault?.delayNs ?? this.options.latencyNs;
        const m: Message = { id, route, source, target, member, args: copy(args), emitted: this.time, ready: this.addTime(this.time, delay), correlation, response: response ? copy(response) : undefined, copies: fault?.kind === 'duplicate' ? 2 : 1, attempt: 0, available: false };
        queue.items.push(m); this.log('admission', id, { queue: key });
        if (fault?.kind === 'drop' && route.qos.delivery !== 'atLeastOnce') { queue.items.splice(queue.items.indexOf(m), 1); this.log('drop', id, { reason: 'InjectedLoss' }); return undefined; }
        if (fault?.kind === 'drop') { this.log('retry', id, { reason: 'InjectedAttemptLoss', originalEmissionNs: m.emitted }); m.ready = this.addTime(m.ready, Math.max(1, delay)); }
        if (route.qos.maxLatency) this.schedule(this.addTime(m.emitted, nanos(route.qos.maxLatency)), 3, () => { if (queue!.items.includes(m) && !m.available) throw new RuntimeFault('Latency', `Transport bound missed: ${route.path}`); });
        this.schedule(m.ready, 1, () => { if (queue!.items.includes(m)) { m.available = true; this.log('ready', m.id, { queue: key }); this.prepare(m); } });
        if (route.qos.maxAge) this.schedule(this.addTime(this.addTime(m.emitted, nanos(route.qos.maxAge)), 1), 1, () => {
            if (queue!.items.includes(m)) { queue!.items.splice(queue!.items.indexOf(m), 1); this.discard(m, 'Expired'); }
        });
        return undefined;
    }
    private scope(frame: Frame, parameters: a.Argument[], args: Value[]): Environment {
        const env = new Map(frame.snapshot);
        parameters.forEach((p, i) => bind(env, p.name, typeKey(p.type), args[i]));
        return env;
    }
    private *operation(frame: Frame, operation: a.Operation, args: Value[]): Generator<Yield, Value | undefined, Response | undefined> {
        const start = this.time;
        let finished = false;
        if (operation !== frame.work.operation && operation.timing) this.schedule(this.addTime(start, nanos(operation.timing.deadline)), 3, () => {
            if (!finished) throw new RuntimeFault('Deadline', `Helper deadline: ${operation.name}`);
        });
        try { yield* this.block(frame, operation.body!, this.scope(frame, operation.parameters, args)); }
        catch (e) { if (e instanceof ReturnValue) return e.value ? widen(e.value, typeKey(operation.result)) : undefined; throw e; }
        finally { finished = true; if (operation !== frame.work.operation && operation.timing && this.time - start > nanos(operation.timing.deadline)) throw new RuntimeFault('Deadline', `Helper deadline: ${operation.name}`); }
        return undefined;
    }
    private *block(frame: Frame, block: a.Block, parent: Environment): Generator<Yield, void, Response | undefined> {
        const env = new Map(parent), ev = (e: a.Expression) => evaluate(e, env, this.fuel);
        for (const s of block.statements) {
            this.fuel();
            if (a.isLet(s)) bind(env, s.name, typeKey(s.type), ev(s.value));
            else if (a.isAssign(s)) { const cell = env.get(s.target)!; cell.value = widen(ev(s.value), cell.type); }
            else if (a.isReturn(s)) throw new ReturnValue(s.value ? ev(s.value) : undefined);
            else if (a.isFail(s)) throw new RuntimeFault('Fail', s.reason);
            else if (a.isAssert(s)) { if (ev(s.condition).data !== true) throw new RuntimeFault('Assertion'); }
            else if (a.isIf(s)) { const b = ev(s.condition).data ? s.then : s.otherwise; if (b) yield* this.block(frame, b, env); }
            else if (a.isWhile(s)) { let count = 0; while (ev(s.condition).data) { if (count++ >= s.bound) throw new RuntimeFault('LoopBound'); yield* this.block(frame, s.body, env); yield { kind: 'step' }; } }
            else if (a.isInvoke(s)) yield* this.operation(frame, s.operation.ref!, s.args.map(ev));
            else if (a.isSend(s)) { const failure = this.emit(frame, s.endpoint, s.args.map(ev)); if (failure) throw new RuntimeFault(failure); }
            else if (a.isRequest(s)) {
                const result = (yield { kind: 'request', endpoint: s.endpoint, args: s.args.map(ev), timeout: nanos(s.timeout) })!;
                if (result.failure) { const failed = new Map(env); bind(failed, 'failure', 'String', scalar('String', result.failure)); yield* this.block(frame, s.failure, failed); throw new RuntimeFault('Type', 'Failure block fell through'); }
                if (result.value) bind(env, s.name, result.value.type, result.value);
            }
            this.log('statement', frame.id, { kindOfStatement: s.$type, line: (s.$cstNode?.range.start.line ?? 0) + 1 });
            yield { kind: 'step' };
        }
    }
    private payload(frame: Frame): Environment {
        const env = new Map(frame.snapshot), work = frame.work;
        if (work.stimulus?.kind === 'receive') {
            const m = work.message!, port = this.ports.get(m.target)!.port, member = port.interface.ref!.members.find(x => x.name === m.member)!;
            if (a.isDataMember(member)) bind(env, 'payload', typeKey(member.type), m.args[0]);
            else if (a.isEventMember(member)) member.parameters.forEach((p, i) => bind(env, p.name, typeKey(p.type), m.args[i]));
        }
        return env;
    }
    private arm(machine: Machine): void {
        const generation = machine.generation;
        const times = new Set(machine.operation.machine!.transitions.filter(t => t.from.ref === machine.state && t.kind === 'after').map(t => nanos(t.delay!)));
        for (const delay of times) this.schedule(this.addTime(this.time, delay), 1, () => this.release(machine.unit, machine.operation, machine, { kind: 'after', delay, generation }));
    }
    private *reaction(frame: Frame): Generator<Yield, undefined, Response | undefined> {
        const m = frame.work.machine!, flow = m.operation.machine!, payload = this.payload(frame);
        const block = (b?: a.Block, env = frame.snapshot) => b ? this.block(frame, b, env) : (function* (): Generator<Yield, void, Response | undefined> {})();
        const choose = (kind: string, env: Environment): a.Transition | undefined => flow.transitions.filter(t => t.from.ref === m.state && t.kind === kind && (kind !== 'receive' || t.endpoint === frame.work.stimulus?.endpoint) && (kind !== 'after' || nanos(t.delay!) === frame.work.stimulus?.delay) && (!t.guard || evaluate(t.guard, env, this.fuel).data === true)).sort((x, y) => (y.priority ?? 0) - (x.priority ?? 0))[0];
        const enter = function* (self: Interpreter): Generator<Yield, void, Response | undefined> {
            self.log('stateEntry', `${m.unit.path}.${m.operation.name}`, { state: m.state.name, generation: m.generation });
            yield* block(m.state.entry);
            if (m.state.final) { m.live = false; m.generation++; } else self.arm(m);
        };
        const take = function* (self: Interpreter, t: a.Transition, env: Environment): Generator<Yield, void, Response | undefined> {
            self.fuel(); m.generation++;
            self.log('transition', `${m.unit.path}.${m.operation.name}`, { transition: t.name, from: m.state.name, to: t.to.ref!.name });
            self.log('stateExit', `${m.unit.path}.${m.operation.name}`, { state: m.state.name });
            yield* block(m.state.exit); yield* block(t.effect, env); m.state = t.to.ref!; yield* enter(self); yield { kind: 'step' };
        };
        try {
            if (frame.work.stimulus?.kind === 'initialize') { yield* enter(this); m.ready = true; }
            else { const t = choose(frame.work.stimulus!.kind, payload); if (t) yield* take(this, t, payload); else this.log('ignored', frame.id, { stimulus: frame.work.stimulus!.kind }); }
            let count = 0;
            while (m.live) { const t = choose('completion', frame.snapshot); if (!t) break; if (++count > 1024) throw new RuntimeFault('MicrostepLimit'); yield* take(this, t, frame.snapshot); }
        } catch (e) { if (e instanceof ReturnValue) { m.live = false; m.generation++; return undefined; } throw e; }
        return undefined;
    }
}
