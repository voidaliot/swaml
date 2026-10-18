export { projectFunctionTiming } from './timing.js';
import { AstUtils, DocumentState } from 'langium';
import * as a from '../language/generated/ast.js';
import { owner } from '../language/swaml-scope.js';
import { effectiveFunction, effectiveQos, members, nanos, typeKey } from '../language/semantic.js';
import { bind, copy, evaluate, plain, RuntimeFault, scalar, type Environment, type Value, widen } from './values.js';

export interface SimulationOptions {
    untilNs: number;
    maxSteps?: number;
    maxPending?: number;
    maxReentrant?: number;
    latencyNs?: number;
    faults?: { offer: number; kind: 'drop' | 'duplicate' | 'transport'; delayNs?: number }[];
}
export interface TraceEvent { timeNs: number; ordinal: number; kind: string; subject: string; [key: string]: unknown }
export interface SimulationResult {
    profile: 'swaml-reference/1.3'; root: string; options: SimulationOptions;
    outcome: 'failed' | 'no-failure-observed';
    status: 'quiescent' | 'horizon' | 'violation' | 'limit'; timeNs: number; steps: number;
    sources: { uri: string; text: string }[];
    trace: TraceEvent[]; stores: Record<string, Record<string, unknown>>;
    machines: Record<string, { state: string; live: boolean }>;
    deployments: Record<string, string | null>;
}
type Event = { time: number; phase: number; order: number; run: () => void };
type ComponentInstance = { path: string; definition: a.Component | a.RootComponent; store: Environment; serial: boolean; active: number };
type Route = { path: string; source: string; target: string; qos: a.QosBody };
type Response = { value?: Value; failure?: string };
type Message = { id: string; route: Route; source: string; target: string; member: string; args: Value[]; emitted: number; ready: number; response?: Response; correlation?: Correlation; copies: number; attempt: number; available: boolean; work?: Work };
type Queue = { key: string; items: Message[] };
type Correlation = { id: string; expiry: number; state: 'Pending' | 'Succeeded' | 'Failed'; frame: Frame; response?: Response };
type Machine = { component: ComponentInstance; fn: a.FunctionDef; state: a.State; generation: number; ready: boolean; live: boolean; reacting: boolean };
type Work = { component: ComponentInstance; fn: a.FunctionDef; released: number; args: Value[]; machine?: Machine; stimulus?: { kind: 'initialize' | 'receive' | 'after'; endpoint?: string; delay?: number; generation?: number }; message?: Message; done: boolean; frame?: Frame; id: string };
type Frame = { id: string; work: Work; snapshot: Environment; iterator: Generator<Yield, Value | undefined, Response | undefined>; waiting: boolean; done: boolean; serial: boolean; epoch: number; correlation?: Correlation; watches: InterruptWatch[]; interruption?: InterruptSignal };
type InterruptWatch = { region: a.Interruptible; frame: Frame; active: boolean };
type Yield = { kind: 'step' } | { kind: 'request'; endpoint: string; args: Value[]; timeout: number };
class ReturnValue { constructor(public value?: Value) {} }
class InterruptSignal { constructor(public watch: InterruptWatch, public message: Message) {} }
const joined = (prefix: string, name: string): string => prefix ? `${prefix}.${name}` : name;

/** A deterministic, zero CPU-cost reference interpreter. Requires a fully built, valid workspace. */
export function simulate(models: a.Model[], rootName: string, input: SimulationOptions): SimulationResult {
    if (!models.length) throw new Error('Supply a validated workspace.');
    for (const model of models) {
        const d = AstUtils.getDocument(model);
        if (d.state < DocumentState.Validated || d.diagnostics?.some(x => x.severity === 1)) throw new Error('Simulation requires all input documents to be linked and validated without errors.');
    }
    const supplied = new Set(models);
    const packages = new Set(models.flatMap(model => model.packages.map(pkg => pkg.name)));
    const requirePackage = (name: string): void => {
        if (!packages.has(name)) throw new Error('Supply every referenced document in the validated workspace.');
    };
    // Imports and enum value paths are semantic references rather than Langium cross-reference nodes.
    for (const model of models) {
        for (const pkg of model.packages) for (const imported of pkg.imports) requirePackage(imported.namespace);
        for (const node of AstUtils.streamAst(model)) if (a.isReferenceExpression(node) && node.path.includes('::')) {
            const type = node.path.split('.')[0];
            requirePackage(type.slice(0, type.lastIndexOf('::')));
        }
    }
    for (const model of models) for (const node of AstUtils.streamAst(model)) for (const reference of AstUtils.streamReferences(node)) {
        const target = 'ref' in reference.reference ? reference.reference.ref : undefined;
        if (target && !supplied.has(AstUtils.getDocument(target).parseResult.value as a.Model)) throw new Error('Supply every referenced document in the validated workspace.');
    }
    const roots = models.flatMap(m => m.packages.flatMap(p => p.elements.filter(a.isRootComponent).map(s => ({ id: `${p.name}::${s.name}`, root: s }))));
    const selected = roots.find(s => s.id === rootName);
    if (!selected) throw new Error(`Unknown root ${rootName}; use a qualified Package::Root name.`);
    return new Interpreter(models, selected.root, selected.id, input).run();
}
class Interpreter {
    private options: Required<SimulationOptions>;
    private components = new Map<string, ComponentInstance>();
    private aliases = new Map<string, string>();
    private ports = new Map<string, { component: ComponentInstance; port: a.Port }>();
    private routes: Route[] = [];
    private queues = new Map<string, Queue>();
    private machines: Machine[] = [];
    private pending: Work[] = [];
    private frames = new Set<Frame>();
    private events: Event[] = [];
    private trace: TraceEvent[] = [];
    private deployments: Record<string, string | null> = Object.create(null);
    private time = 0;
    private steps = 0;
    private serial = 0;
    private order = 0;
    private offers = 0;
    private stopped?: 'violation' | 'limit';
    constructor(private models: a.Model[], private root: a.RootComponent, private id: string, options: SimulationOptions) {
        this.options = { untilNs: options.untilNs, maxSteps: options.maxSteps ?? 100000, maxPending: options.maxPending ?? 1024, maxReentrant: options.maxReentrant ?? 64, latencyNs: options.latencyNs ?? 0, faults: copy(options.faults ?? []) };
        if (!Number.isSafeInteger(this.options.untilNs) || this.options.untilNs < 0) throw new Error('untilNs must be a nonnegative safe integer');
        for (const key of ['untilNs', 'maxSteps', 'maxPending', 'maxReentrant', 'latencyNs'] as const) { const value = this.options[key]; if (!Number.isSafeInteger(value) || value < (['maxSteps', 'maxPending', 'maxReentrant'].includes(key) ? 1 : 0)) throw new Error(`Invalid ${key}`); }
        if (!Array.isArray(this.options.faults)) throw new Error('faults must be an array');
        for (const key of Object.keys(options)) if (!(key in this.options)) throw new Error(`Unknown simulation option ${key}`);
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
    private expand(c: a.RootComponent | a.Component, prefix = '', allocation: string | null = null): void {
        const path = (name: string) => joined(prefix, name);
        const effective = members(c);
        const component: ComponentInstance = { path: prefix, definition: c, store: new Map(), serial: false, active: 0 };
        this.components.set(prefix, component);
        this.deployments[prefix] = allocation;
        for (const variable of effective.filter(a.isVariable)) bind(component.store, variable.name, typeKey(variable.type), evaluate(variable.value, new Map(), this.fuel, this.models, c));
        for (const port of effective.filter(a.isPort)) this.ports.set(path(port.name), { component, port });
        for (const fn of effective.filter(a.isFunctionDef)) if (fn.stateBody) this.machines.push({ component, fn, state: fn.stateBody.initial.ref!, generation: 0, ready: false, live: true, reacting: false });
        const definition = a.isRootComponent(c) && c.definition?.ref ? c.definition.ref : c;
        this.log('initialize', prefix, { definition: `${owner(definition, a.isPackage)!.name}::${definition.name}`, system: allocation });
        for (const member of effective) {
            this.fuel();
            if (a.isDelegate(member)) this.aliases.set(path(member.outer.ref!.name), path(member.target));
            if (a.isConnect(member)) this.routes.push({ path: path(member.name), source: path(member.source), target: path(member.target), qos: effectiveQos(member.qos)! });
            if (!a.isInstance(member)) continue;
            const p = path(member.name);
            const system = this.root.members.filter(a.isDeployment).find(d => d.target === p)?.system ?? allocation;
            this.expand(member.definition.ref!, p, system);
        }
    }
    run(): SimulationResult {
        try {
            this.expand(this.root, '', this.root.members.filter(a.isDeployment).find(d => d.target === this.root.name)?.system ?? null);
            for (const r of this.routes) { r.source = this.leaf(r.source); r.target = this.leaf(r.target); }
            for (const component of this.components.values()) for (const op of members(component.definition).filter(a.isFunctionDef)) {
                if (op.trigger?.kind === 'start') this.schedule(0, 1, () => this.release(component, op, this.machines.find(m => m.component === component && m.fn === op), { kind: 'initialize' }));
                if (op.trigger?.kind === 'every') {
                    const period = nanos(op.trigger.period!);
                    const recur = () => { this.release(component, op); this.schedule(this.addTime(this.time, period), 1, recur); };
                    this.schedule(period, 1, recur);
                }
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
        return { profile: 'swaml-reference/1.3', outcome: this.stopped || this.trace.some(t => t.kind === 'failure') ? 'failed' : 'no-failure-observed', root: this.id, options: copy(this.options), status: this.stopped ?? (this.events.length ? 'horizon' : 'quiescent'), timeNs: this.time, steps: this.steps,
            sources: this.models.map(m => ({ uri: AstUtils.getDocument(m).uri.toString(), text: AstUtils.getDocument(m).textDocument.getText() })).sort((x, y) => x.uri.localeCompare(y.uri)),
            trace: this.trace, stores: Object.fromEntries([...this.components].map(([p, u]) => [p, Object.fromEntries([...u.store].map(([n, v]) => [n, plain(v.value)]))])),
            machines: Object.fromEntries(this.machines.map(m => [joined(m.component.path, m.fn.name), { state: m.state.name, live: m.live }])), deployments: this.deployments };
    }
    private release(component: ComponentInstance, fn: a.FunctionDef, machine?: Machine, stimulus?: Work['stimulus']): void {
        if (machine && (!machine.live || (stimulus?.generation !== undefined && stimulus.generation !== machine.generation))) { this.log('discardTimer', joined(component.path, fn.name)); return; }
        if (this.pending.length >= this.options.maxPending) throw new RuntimeFault('ActivationOverflow');
        const work: Work = { id: this.uid('a'), component, fn, released: this.time, args: [], machine, stimulus, done: false };
        this.pending.push(work); this.released(work);
    }
    private released(work: Work): void {
        this.log('release', work.id, { function: joined(work.component.path, work.fn.name) });
        if (work.fn.timing) this.schedule(this.addTime(work.released, nanos(work.fn.timing.deadline)), 3, () => {
            if (!work.done) throw new RuntimeFault('Deadline', `Deadline missed: ${work.component.path}.${work.fn.name}`);
        });
    }
    private prepare(m: Message): void {
        if (m.response) return;
        const handler = this.handler(m);
        if (handler.interrupt) return;
        if (handler.machine && !handler.machine.live) return;
        m.work = { ...handler, id: this.uid('a'), released: m.ready, args: copy(m.args), message: m, done: false, stimulus: handler.machine ? { kind: 'receive', endpoint: `${this.ports.get(m.target)!.port.name}.${m.member}` } : undefined };
        this.released(m.work);
    }
    private discard(m: Message, reason: string): void { if (m.work && !m.work.frame) m.work.done = true; this.log('drop', m.id, { reason }); }
    private canDispatch(w: Pick<Work, 'component' | 'fn' | 'machine'>): boolean {
        return !(w.machine?.reacting) && (w.fn.timing?.concurrency === 'reentrant' ? w.component.active < this.options.maxReentrant : !w.component.serial);
    }
    private handler(m: Message): { component: ComponentInstance; fn: a.FunctionDef; machine?: Machine; interrupt?: boolean } {
        const p = this.ports.get(m.target);
        if (!p) throw new RuntimeFault('Route', `Unresolved target port ${m.target}`);
        const endpoint = `${p.port.name}.${m.member}`;
        const machine = this.machines.find(x => x.component === p.component && x.fn.stateBody!.transitions.some(t => t.kind === 'receive' && t.endpoint === endpoint));
        const functions = members(p.component.definition).filter(a.isFunctionDef);
        const regionOwner = functions.find(fn => [...AstUtils.streamAllContents(fn)].some(node => a.isInterruptible(node) && node.endpoint === endpoint));
        const fn = machine?.fn ?? regionOwner ?? functions.find(x => ['receive', 'call'].includes(x.trigger?.kind ?? '') && x.trigger?.endpoint === endpoint)!;
        if (!fn) throw new RuntimeFault('Handler', `No handler for ${m.target}.${m.member}`);
        return { component: p.component, fn, machine, interrupt: !!regionOwner };
    }
    private pump(): void {
        for (let i = 0; i < this.pending.length;) {
            const work = this.pending[i];
            if (work.machine && (!work.machine.live || (work.stimulus?.generation !== undefined && work.stimulus.generation !== work.machine.generation))) { work.done = true; this.pending.splice(i, 1); this.log('discardTimer', work.id); }
            else if (this.canDispatch(work)) { this.pending.splice(i, 1); this.start(work); } else i++;
        }
        for (const q of this.queues.values()) {
            // Undeliverable ready inputs must be cancelled even behind an in-flight FIFO head.
            for (let i = 0; i < q.items.length;) {
                const m = q.items[i];
                const machine = m.available && !m.response ? this.handler(m).machine : undefined;
                if (machine && !machine.live) { q.items.splice(i, 1); this.discard(m, 'Undeliverable'); }
                else i++;
            }
            while (q.items.length) {
                const m = q.items[0];
                if (!m.available) break;
                if (m.route.qos.maxAge && this.time - m.emitted > nanos(m.route.qos.maxAge)) { q.items.shift(); this.discard(m, 'Expired'); continue; }
                if (m.response) { if (--m.copies === 0) q.items.shift(); this.log('delivery', m.id, { correlation: m.correlation!.id, route: m.route.path }); this.complete(m.correlation!, m.response); continue; }
                const handler = this.handler(m);
                if (handler.interrupt) {
                    const endpoint = `${this.ports.get(m.target)!.port.name}.${m.member}`;
                    const frame = [...this.frames].find(frame => frame.work.component === handler.component && frame.work.fn === handler.fn && frame.watches.some(watch => watch.active && watch.region.endpoint === endpoint));
                    const watch = frame && [...frame.watches].reverse().find(watch => watch.active && watch.region.endpoint === endpoint);
                    if (!frame || !watch) { q.items.shift(); this.discard(m, 'UndeliverableInterrupt'); continue; }
                    if (frame.interruption) break;
                    if (--m.copies === 0) q.items.shift();
                    this.log('delivery', m.id, { attempt: ++m.attempt, route: m.route.path, source: `${m.source}.${m.member}`, target: `${m.target}.${m.member}` });
                    this.interrupt(frame, watch, m);
                    continue;
                }
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
        const serial = work.fn.timing?.concurrency !== 'reentrant';
        if (serial) work.component.serial = true;
        else work.component.active++;
        if (work.machine) work.machine.reacting = true;
        const frame: Frame = { id: work.id, work, snapshot: serial ? work.component.store : new Map([...work.component.store].map(([k, v]) => [k, copy(v)])), iterator: undefined!, waiting: false, done: false, serial, epoch: 0, watches: [] };
        frame.iterator = work.machine ? this.reaction(frame) : this.fn(frame, work.fn, work.args);
        work.frame = frame;
        this.frames.add(frame);
        this.log('dispatch', frame.id, { function: joined(work.component.path, work.fn.name), mode: serial ? 'serial' : 'reentrant' });
        this.resume(frame);
    }
    private resume(frame: Frame, response?: Response): void {
        const epoch = frame.epoch;
        this.schedule(this.time, 2, () => { if (epoch === frame.epoch) this.advance(frame, response); });
    }
    private interrupt(frame: Frame, watch: InterruptWatch, message: Message): void {
        watch.active = false;
        frame.interruption = new InterruptSignal(watch, message);
        frame.epoch++;
        const correlation = frame.correlation;
        if (correlation?.state === 'Pending') {
            correlation.state = 'Failed'; correlation.response = { failure: 'Interrupted' };
            this.log('requestCancelled', correlation.id, { activation: frame.id, reason: 'Interrupted', region: watch.region.name });
        }
        frame.correlation = undefined; frame.waiting = false;
        this.log('interrupt', frame.id, { region: watch.region.name, endpoint: watch.region.endpoint, message: message.id });
        this.resume(frame);
    }
    private advance(frame: Frame, response?: Response): void {
        if (frame.done) return;
        try {
            const interruption = frame.interruption;
            frame.interruption = undefined;
            const step = interruption ? frame.iterator.throw(interruption) : frame.iterator.next(response);
            if (step.done) { this.finish(frame, { value: step.value }); return; }
            if (step.value.kind === 'step') this.resume(frame);
            else {
                const request = step.value;
                const c: Correlation = { id: this.uid('r'), expiry: this.addTime(this.time, request.timeout), state: 'Pending', frame };
                frame.waiting = true; frame.correlation = c;
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
        this.frames.delete(frame);
        if (frame.serial) frame.work.component.serial = false; else frame.work.component.active--;
        const machine = frame.work.machine;
        if (machine) { machine.reacting = false; if (response.failure) { machine.live = false; machine.generation++; } }
        this.log(response.failure ? 'failure' : 'complete', frame.id, { function: joined(frame.work.component.path, frame.work.fn.name), code: response.failure, message, result: response.value ? plain(response.value) : undefined });
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
        if (c.frame.correlation === c) c.frame.correlation = undefined;
        this.log('requestComplete', c.id, { state: c.state, failure: response.failure, value: response.value ? plain(response.value) : undefined });
        this.resume(c.frame, response);
    }
    private emit(frame: Frame, endpoint: string, args: Value[], correlation?: Correlation): string | undefined {
        const [portName, member] = endpoint.split('.'), source = joined(frame.work.component.path, portName);
        const port = this.ports.get(source)!.port;
        const contract = port.interface.ref!.members.find(m => m.name === member)!;
        args = a.isDataMember(contract) ? [widen(args[0], typeKey(contract.type))] : contract.parameters.map((p, i) => widen(args[i], typeKey(p.type)));
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
    private scope(frame: Frame, parameters: (a.Argument | a.Parameter)[], args: Value[]): Environment {
        const env = new Map(frame.snapshot);
        parameters.forEach((p, i) => bind(env, p.name, typeKey(p.type), args[i]));
        return env;
    }
    private *fn(frame: Frame, fn: a.FunctionDef, args: Value[]): Generator<Yield, Value | undefined, Response | undefined> {
        const start = this.time;
        let finished = false;
        if (fn !== frame.work.fn && fn.timing) this.schedule(this.addTime(start, nanos(fn.timing.deadline)), 3, () => {
            if (!finished) throw new RuntimeFault('Deadline', `Helper deadline: ${fn.name}`);
        });
        try { if (fn.body) yield* this.block(frame, fn.body, this.scope(frame, fn.parameters, args)); }
        catch (e) { if (e instanceof ReturnValue) return e.value ? widen(e.value, typeKey(fn.result)) : undefined; throw e; }
        finally { finished = true; if (fn !== frame.work.fn && fn.timing && this.time - start > nanos(fn.timing.deadline)) throw new RuntimeFault('Deadline', `Helper deadline: ${fn.name}`); }
        return undefined;
    }
    private *block(frame: Frame, block: a.Block, parent: Environment): Generator<Yield, void, Response | undefined> {
        const env = new Map(parent), ev = (e: a.Expression) => evaluate(e, env, this.fuel, this.models, frame.work.component.definition);
        for (const s of block.statements) {
            this.fuel();
            if (a.isLocalVariable(s)) bind(env, s.name, typeKey(s.type), ev(s.value));
            else if (a.isAssign(s)) { const cell = env.get(s.target)!; cell.value = widen(ev(s.value), cell.type); }
            else if (a.isReturn(s)) throw new ReturnValue(s.value ? ev(s.value) : undefined);
            else if (a.isFail(s)) throw new RuntimeFault('Fail', s.reason);
            else if (a.isAssert(s)) { if (ev(s.condition).data !== true) throw new RuntimeFault('Assertion'); }
            else if (a.isIf(s)) { const b = ev(s.condition).data ? s.then : s.otherwise; if (b) yield* this.block(frame, b, env); }
            else if (a.isWhile(s)) { let count = 0; while (ev(s.condition).data) { if (count++ >= s.bound) throw new RuntimeFault('LoopBound'); yield* this.block(frame, s.body, env); yield { kind: 'step' }; } }
            else if (a.isFor(s)) {
                const local = new Map(env), initial = s.initializer;
                const evaluateLocal = (e: a.Expression) => evaluate(e, local, this.fuel, this.models, frame.work.component.definition);
                this.fuel(); bind(local, initial.name, typeKey(initial.type), ev(initial.value));
                this.log('statement', frame.id, { kindOfStatement: initial.$type, line: (initial.$cstNode?.range.start.line ?? 0) + 1 });
                yield { kind: 'step' };
                let count = 0;
                while (evaluateLocal(s.condition).data) {
                    if (count++ >= s.bound) throw new RuntimeFault('LoopBound');
                    yield* this.block(frame, s.body, local);
                    this.fuel();
                    const cell = local.get(s.update.target)!; cell.value = widen(evaluateLocal(s.update.value), cell.type);
                    this.log('statement', frame.id, { kindOfStatement: s.update.$type, line: (s.update.$cstNode?.range.start.line ?? 0) + 1 });
                    yield { kind: 'step' };
                }
            }
            else if (a.isForEach(s)) {
                const collection = copy(ev(s.collection));
                if (!Array.isArray(collection.data)) throw new RuntimeFault('Type', 'forEach requires a fixed-size array.');
                for (const item of collection.data) {
                    this.fuel();
                    const local = new Map(env); bind(local, s.variable.name, typeKey(s.variable.type), item);
                    yield* this.block(frame, s.body, local);
                    yield { kind: 'step' };
                }
            }
            else if (a.isDoWhile(s)) {
                let count = 0;
                do {
                    if (count++ >= s.bound) throw new RuntimeFault('LoopBound');
                    yield* this.block(frame, s.body, env); yield { kind: 'step' };
                } while (ev(s.condition).data);
            }
            else if (a.isInterruptible(s)) {
                const watch: InterruptWatch = { region: s, frame, active: true };
                frame.watches.push(watch);
                this.log('regionEnter', frame.id, { region: s.name, endpoint: s.endpoint });
                let outcome = 'unwound';
                try {
                    yield* this.block(frame, s.body, env);
                    outcome = 'completed';
                } catch (error) {
                    if (!(error instanceof InterruptSignal) || error.watch !== watch) throw error;
                    watch.active = false; outcome = 'interrupted';
                    const local = new Map(env), message = error.message;
                    const member = this.ports.get(message.target)!.port.interface.ref!.members.find(member => member.name === message.member)!;
                    if (a.isDataMember(member)) bind(local, 'payload', typeKey(member.type), message.args[0]);
                    else if (a.isEventMember(member)) member.parameters.forEach((input, i) => bind(local, input.name, typeKey(input.type), message.args[i]));
                    yield* this.block(frame, s.handler, local);
                } finally {
                    watch.active = false; frame.watches.splice(frame.watches.indexOf(watch), 1);
                    this.log('regionExit', frame.id, { region: s.name, outcome });
                }
            }
            else if (a.isLocalCall(s)) {
                const target = effectiveFunction(s.function.ref!, frame.work.component.definition);
                const value = yield* this.fn(frame, target, s.args.map(ev));
                if (s.name && value) bind(env, s.name, typeKey(target.result), value);
            }
            else if (a.isSend(s)) { const failure = this.emit(frame, s.endpoint, s.args.map(ev)); if (failure) throw new RuntimeFault(failure); }
            else if (a.isRemoteCall(s)) {
                const result = (yield { kind: 'request', endpoint: s.endpoint, args: s.args.map(ev), timeout: nanos(s.timeout) })!;
                if (result.failure) { const failed = new Map(env); bind(failed, 'failure', 'string', scalar('string', result.failure)); yield* this.block(frame, s.failure, failed); throw new RuntimeFault('Type', 'Failure block fell through'); }
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
        const times = new Set(machine.fn.stateBody!.transitions.filter(t => t.from.ref === machine.state && t.kind === 'after').map(t => nanos(t.delay!)));
        for (const delay of times) this.schedule(this.addTime(this.time, delay), 1, () => this.release(machine.component, machine.fn, machine, { kind: 'after', delay, generation }));
    }
    private *reaction(frame: Frame): Generator<Yield, undefined, Response | undefined> {
        const m = frame.work.machine!, flow = m.fn.stateBody!, payload = this.payload(frame);
        const block = (b?: a.Block, env = frame.snapshot) => b ? this.block(frame, b, env) : (function* (): Generator<Yield, void, Response | undefined> {})();
        const choose = (kind: string, env: Environment): a.Transition | undefined => flow.transitions.filter(t => t.from.ref === m.state && t.kind === kind && (kind !== 'receive' || t.endpoint === frame.work.stimulus?.endpoint) && (kind !== 'after' || nanos(t.delay!) === frame.work.stimulus?.delay) && (!t.guard || evaluate(t.guard, env, this.fuel, this.models, frame.work.component.definition).data === true)).sort((x, y) => (y.priority ?? 0) - (x.priority ?? 0))[0];
        const enter = function* (self: Interpreter): Generator<Yield, void, Response | undefined> {
            self.log('stateEntry', joined(m.component.path, m.fn.name), { state: m.state.name, generation: m.generation });
            yield* block(m.state.entry);
            if (m.state.final) { m.live = false; m.generation++; } else self.arm(m);
        };
        const take = function* (self: Interpreter, t: a.Transition, env: Environment): Generator<Yield, void, Response | undefined> {
            self.fuel(); m.generation++;
            self.log('transition', joined(m.component.path, m.fn.name), { transition: t.name, from: m.state.name, to: t.to.ref!.name });
            self.log('stateExit', joined(m.component.path, m.fn.name), { state: m.state.name });
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
