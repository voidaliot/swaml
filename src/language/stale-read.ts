import type { AstNode } from 'langium';
import * as a from './generated/ast.js';
import { body, isExecutable, signature, type Effect, type Executable } from './semantic.js';

/**
 * SW2011 (docs/spec/03-behavior.md, 3.4): a pre-suspension state read that may affect a later write.
 *
 * The analysis follows the statements of one activation in execution order. A value carries the component
 * attributes it was derived from, split into fresh reads and reads made before a later suspension (stale).
 * Suspension (wait, receive, an interrupt handler's entry, a request or a call to a suspending operation)
 * turns every fresh derivation held in locals, pending operands and enclosing conditions stale. Conditions
 * guard what they enclose, and an `if` whose branch returns or fails guards the rest of its block.
 *
 * A write (an attribute assignment or attribute out argument) is reported when its value is stale, or when a
 * stale condition guards it and is not re-checked: a condition evaluated after resuming re-checks a stale
 * condition when it reads again every attribute that condition read stale, or every attribute the write
 * depends on (its value's attributes and the written attribute).
 *
 * A call to an operation of the component is followed with the caller's argument values and conditions, so a
 * write moved into a helper is still found; it is reported at the call unless the helper reports it itself.
 * Each followed call is summarised once per distinct abstract input and reused at every call site, loops run
 * to a fixed point over the finite domain of attribute sets, and the total work is capped: an operation
 * that exceeds the cap gets the warning conservatively. One state machine reaction runs the source state's
 * exit action, the transition effect and the target state's entry action under the transition's guard; the
 * initial state's entry action runs on its own. Nested operations are analysed on their own.
 */
export interface StaleReadContext {
    readonly attributes: ReadonlySet<string>;
    target(call: a.CallExpression): Executable | a.PortMember | undefined;
    effects(op: Executable): Effect;
}

type Value = { fresh: Set<string>, stale: Set<string> };
const none = (): Value => ({ fresh: new Set(), stale: new Set() });
const join = (x: Value, y: Value): Value => ({ fresh: new Set([...x.fresh, ...y.fresh]), stale: new Set([...x.stale, ...y.stale]) });
const aged = (v: Value): Value => ({ fresh: new Set(), stale: new Set([...v.fresh, ...v.stale]) });
const same = (x: Value, y: Value) => x.fresh.size === y.fresh.size && x.stale.size === y.stale.size && [...x.fresh].every(k => y.fresh.has(k)) && [...x.stale].every(k => y.stale.has(k));
const key = (v: Value) => [...v.fresh].sort().join(',') + '|' + [...v.stale].sort().join(',');

class Flow {
    constructor(readonly locals = new Map<string, Value>(), public guards: Value[] = []) { }
    copy(): Flow { return new Flow(new Map(this.locals), [...this.guards]); }
    suspend(): void {
        for (const [k, v] of this.locals)
            this.locals.set(k, aged(v));
        this.guards = this.guards.map(aged);
    }
    /** Joins other's locals into this flow; true when that changed anything. */
    merge(other: Flow): boolean {
        let changed = false;
        for (const [k, v] of other.locals) {
            const mine = this.locals.get(k), joined = mine ? join(mine, v) : v;
            if (!mine || !same(mine, joined)) {
                this.locals.set(k, joined);
                changed = true;
            }
        }
        return changed;
    }
}

/** What a followed call means to its caller. */
type Summary = { found: boolean, returned: Value, outs: Value[] };

/** Statement visits allowed for one operation, its reactions and every call it follows. */
const WORK_LIMIT = 20000;
class WorkLimit extends Error { }

/** Shared by the analysis of one operation and of every call it follows. */
class Shared {
    work = 0;
    readonly summaries = new Map<string, Summary>();
    readonly own = new Map<Executable, boolean>();
    readonly active = new Set<Executable>();
    private readonly ids = new Map<Executable, number>();
    constructor(readonly ctx: StaleReadContext) { }
    id(op: Executable): number {
        if (!this.ids.has(op))
            this.ids.set(op, this.ids.size);
        return this.ids.get(op)!;
    }
}

class Analysis {
    found?: AstNode;
    /** Values returned by a followed callee. */
    returned?: Value;
    /** Flows at each suspension inside the protected bodies of the enclosing interrupt regions. */
    private readonly collectors: Flow[][] = [];
    private suspensions = 0;
    constructor(private readonly shared: Shared) { }
    private get ctx() { return this.shared.ctx; }

    private suspend(flow: Flow): void {
        this.suspensions++;
        flow.suspend();
        for (const c of this.collectors)
            c.push(flow.copy());
    }
    private write(node: AstNode, value: Value, flow: Flow, target?: string): void {
        if (this.found)
            return;
        const depends = new Set([...value.fresh, ...value.stale, ...(target ? [target] : [])]);
        const covers = (g: Value, wanted: Set<string>) => wanted.size > 0 && [...wanted].every(k => g.fresh.has(k));
        const unchecked = flow.guards.some((g, i) => g.stale.size > 0 && !flow.guards.slice(i).some(inner => covers(inner, g.stale) || covers(inner, depends)));
        if (value.stale.size || unchecked)
            this.found = node;
    }
    private sequence(values: a.Expression[], flow: Flow): Value[] {
        const result: Value[] = [];
        for (const e of values) {
            const before = this.suspensions, v = this.expression(e, flow);
            if (this.suspensions !== before)
                result.forEach((r, i) => result[i] = aged(r));
            result.push(v);
        }
        return result;
    }
    expression(root: a.Expression | undefined, flow: Flow): Value {
        if (!root)
            return none();
        // Chains of binary operators are walked iteratively, so long expressions cannot exhaust the stack.
        if (a.isBinaryExpression(root)) {
            const operands: a.Expression[] = [];
            let e: a.Expression = root;
            while (a.isBinaryExpression(e)) {
                operands.push(e.right);
                e = e.left;
            }
            operands.push(e);
            return this.sequence(operands.reverse(), flow).reduce(join, none());
        }
        const e = root;
        if (a.isReferenceExpression(e)) {
            const head = e.path.split('.')[0], index = e.index ? this.expression(e.index, flow) : none();
            const own = this.ctx.attributes.has(head) ? { fresh: new Set([head]), stale: new Set<string>() } : flow.locals.get(head) ?? none();
            return join(own, index);
        }
        if (a.isUnaryExpression(e))
            return this.expression(e.operand, flow);
        if (a.isTryExpression(e))
            return this.sequence(e.fallback ? [e.expression, e.fallback] : [e.expression], flow).reduce(join, none());
        if (a.isArrayLiteral(e))
            return this.sequence(e.values, flow).reduce(join, none());
        if (a.isRecordLiteral(e))
            return this.sequence(e.fields.map(f => f.value), flow).reduce(join, none());
        if (a.isCallExpression(e))
            return this.call(e, flow);
        return none();
    }
    private call(call: a.CallExpression, flow: Flow): Value {
        const target = this.ctx.target(call);
        const parameters: { direction?: string }[] = target ? (isExecutable(target) ? signature(target)?.parameters ?? [] : target.parameters) : [];
        const out = (i: number) => parameters[i]?.direction === 'out';
        // Out arguments are written by the call, not read.
        const inputs = call.args.map((arg, i) => ({ arg, i })).filter(x => !out(x.i));
        const values = this.sequence(inputs.map(x => x.arg), flow), argument = new Map(inputs.map((x, k) => [x.i, values[k]]));
        let summary: Summary;
        if (!target || !isExecutable(target)) {
            // A request (or an unresolved call) waits for its reply; the reply itself is not component state.
            this.suspend(flow);
            summary = { found: false, returned: none(), outs: parameters.map(() => none()) };
        }
        else {
            const effect = this.ctx.effects(target);
            summary = this.follow(target, effect, parameters.map((_, i) => argument.get(i) ?? none()), flow);
            if (summary.found && !this.found)
                this.found = call;
            if (effect.suspends)
                this.suspend(flow);
        }
        call.args.forEach((arg, i) => {
            if (!out(i) || !a.isReferenceExpression(arg))
                return;
            const name = arg.path.split('.')[0];
            if (this.ctx.attributes.has(name))
                this.write(call, summary.outs[i] ?? none(), flow, name);
            else
                flow.locals.set(name, summary.outs[i] ?? none());
        });
        return summary.returned;
    }
    /** The meaning of a call to target with these argument values under the caller's conditions. */
    private follow(target: Executable, effect: Effect, args: Value[], flow: Flow): Summary {
        const b = body(target), parameters = signature(target)?.parameters ?? [];
        const followable = (effect.reads || effect.writes) && b && !b.states.length && !this.shared.active.has(target);
        if (!followable) {
            // Not followed (a pure operation, or a recursive call that is itself an error): assume its writes
            // and outputs depend on every argument.
            const all = args.reduce(join, none()), result = effect.suspends ? aged(all) : all;
            const reads = effect.reads ? { fresh: new Set(['call:' + identityOf(target)]), stale: new Set<string>() } : none();
            const found = effect.writes && !!b && this.wouldReport(result, flow);
            return { found, returned: join(reads, result), outs: parameters.map(() => join(reads, result)) };
        }
        const run = (inputs: Value[], guards: Value[]): Summary => {
            const k = this.shared.id(target) + ':' + inputs.map(key).join(';') + '#' + guards.map(key).join(';');
            const cached = this.shared.summaries.get(k);
            if (cached)
                return cached;
            this.shared.active.add(target);
            try {
                const callee = new Analysis(this.shared);
                callee.returned = none();
                let f = new Flow(new Map(parameters.map((p, i) => [p.name, inputs[i] ?? none()])), [...guards]);
                f = callee.statements(b.statements, f);
                const summary = { found: !!callee.found, returned: callee.returned, outs: parameters.map(p => f.locals.get(p.name) ?? none()) };
                this.shared.summaries.set(k, summary);
                return summary;
            }
            finally {
                this.shared.active.delete(target);
            }
        };
        const actual = run(args, flow.guards);
        if (actual.found) {
            // A finding with neutral inputs is the callee's own SW2011 and is reported there.
            if (!this.shared.own.has(target))
                this.shared.own.set(target, run(parameters.map(() => none()), []).found);
            if (this.shared.own.get(target))
                return { ...actual, found: false };
        }
        return actual;
    }
    private wouldReport(value: Value, flow: Flow): boolean {
        const probe = new Analysis(this.shared);
        probe.write({} as AstNode, value, flow);
        return !!probe.found;
    }
    /** Runs code under a condition; the condition no longer guards what follows. */
    private guarded(condition: Value, flow: Flow, run: (inner: Flow) => Flow): Flow {
        const inner = flow.copy();
        inner.guards.push(condition);
        const out = run(inner);
        // Drop the condition but keep the outer conditions as the body left them (aged by its suspensions).
        out.guards = out.guards.slice(0, flow.guards.length);
        return out;
    }
    /** Runs a loop body until the locals reach a fixed point, so suspension in one iteration ages the next. */
    private loop(flow: Flow, iteration: (inner: Flow) => Flow): Flow {
        const result = flow.copy();
        while (!this.found && result.merge(iteration(result.copy())))
            ;
        return result;
    }
    statements(list: readonly a.Statement[], flow: Flow): Flow {
        const depth = flow.guards.length;
        let current = flow;
        for (const s of list) {
            current = this.statement(s, current);
            // An if whose only branch returns or fails guards the rest of the block with its condition.
            if (a.isIf(s) && !s.otherwise && terminates(s.then))
                current.guards = [...current.guards, this.conditions.get(s) ?? none()];
        }
        current.guards = current.guards.slice(0, depth);
        return current;
    }
    private readonly conditions = new Map<a.If, Value>();
    block(b: a.Block | undefined, flow: Flow): Flow {
        return this.statements(b?.statements ?? [], flow);
    }
    statement(s: a.Statement, flow: Flow): Flow {
        if (this.found)
            return flow;
        if (++this.shared.work > WORK_LIMIT)
            throw new WorkLimit();
        if (a.isLocalVariable(s))
            flow.locals.set(s.name, this.expression(s.value, flow));
        else if (a.isAssign(s)) {
            const v = this.expression(s.value, flow);
            if (this.ctx.attributes.has(s.target))
                this.write(s, v, flow, s.target);
            else
                flow.locals.set(s.target, v);
        }
        else if (a.isExpressionStatement(s))
            this.expression(s.expression, flow);
        else if (a.isSend(s))
            this.sequence(s.args, flow);
        else if (a.isReturn(s)) {
            const v = this.expression(s.value, flow);
            if (this.returned)
                this.returned = join(this.returned, v);
        }
        else if (a.isAssert(s))
            this.expression(s.condition, flow);
        else if (a.isWait(s))
            this.suspend(flow);
        else if (a.isIf(s)) {
            const c = this.expression(s.condition, flow);
            this.conditions.set(s, c);
            const then = this.guarded(c, flow, inner => this.block(s.then, inner));
            const otherwise = this.guarded(c, flow, inner => this.block(s.otherwise, inner));
            then.merge(otherwise);
            return then;
        }
        else if (a.isWhile(s) || a.isUntil(s))
            return this.loop(flow, inner => {
                const c = join(this.expression(s.condition, inner), this.expression(s.limit, inner));
                return this.guarded(c, inner, g => this.block(s.body, g));
            });
        else if (a.isFor(s)) {
            flow = this.statement(s.initializer, flow);
            return this.loop(flow, inner => {
                const c = this.expression(s.condition, inner);
                return this.guarded(c, inner, g => this.statement(s.update, this.block(s.body, g)));
            });
        }
        else if (a.isForEach(s)) {
            const collection = this.expression(s.collection, flow);
            return this.loop(flow, inner => this.guarded(collection, inner, g => {
                g.locals.set(s.variable.name, join(g.locals.get(s.variable.name) ?? none(), collection));
                return this.block(s.body, g);
            }));
        }
        else if (a.isReceive(s)) {
            this.suspend(flow);
            const outcomes = s.branches.map(br => {
                const inner = flow.copy();
                br.bindings.forEach(n => inner.locals.set(n, none()));
                return this.block(br.body, inner);
            });
            if (s.timeoutBody)
                outcomes.push(this.block(s.timeoutBody, flow.copy()));
            const result = outcomes[0] ?? flow;
            outcomes.slice(1).forEach(o => result.merge(o));
            return result;
        }
        else if (a.isInterruptible(s)) {
            // The handler runs when input arrives while the protected body is suspended: its entry state is
            // the join over every suspension in the body.
            const collected: Flow[] = [];
            this.collectors.push(collected);
            let protectedEnd: Flow;
            try {
                protectedEnd = this.block(s.body, flow.copy());
            }
            finally {
                this.collectors.pop();
            }
            const handler = flow.copy();
            if (collected.length)
                collected.forEach(c => handler.merge(c));
            handler.suspend();
            s.bindings.forEach(n => handler.locals.set(n, none()));
            const handled = this.block(s.handler, handler);
            protectedEnd.merge(handled);
            return protectedEnd;
        }
        return flow;
    }
}

const terminates = (b: a.Block | undefined) => { const last = b?.statements.at(-1); return !!last && (a.isReturn(last) || a.isFail(last)); };
const identityOf = (op: Executable) => op.name;

/** The first write of op that a pre-suspension state read may influence, if any. */
export function staleWrite(op: Executable, ctx: StaleReadContext): AstNode | undefined {
    const b = body(op);
    if (!b)
        return undefined;
    const shared = new Shared(ctx), analysis = new Analysis(shared);
    const parameters = () => new Flow(new Map((signature(op)?.parameters ?? []).map(p => [p.name, none()])));
    try {
        if (!b.states.length) {
            analysis.statements(b.statements, parameters());
            return analysis.found;
        }
        const actions = (state: a.State | undefined, kind: 'entry' | 'exit') => state?.actions.filter(x => x.kind === kind) ?? [];
        const run = (list: a.StateAction[], flow: Flow) => list.reduce((f, x) => analysis.block(x.body, f), flow);
        run(actions(b.states.find(x => x.name === b.initial), 'entry'), parameters());
        // One reaction: the guard selects the transition, then exit, effect and the target's entry run.
        for (const state of b.states)
            for (const t of state.transitions) {
                if (analysis.found)
                    return analysis.found;
                const flow = parameters();
                t.bindings.forEach(n => flow.locals.set(n, none()));
                const guard = analysis.expression(t.guard, flow), inner = flow.copy();
                inner.guards.push(guard);
                const target = b.states.find(x => x.name === t.target);
                run(actions(target, 'entry'), analysis.block(t.effect, run(actions(state, 'exit'), inner)));
            }
        return analysis.found;
    }
    catch (error) {
        if (!(error instanceof WorkLimit))
            throw error;
        // Too much to follow: warn conservatively at the first attribute write.
        return firstWrite(b, ctx) ?? op;
    }
}
function firstWrite(b: a.OperationBody, ctx: StaleReadContext): AstNode | undefined {
    const stack: AstNode[] = [b];
    while (stack.length) {
        const n = stack.shift()!;
        if (a.isAssign(n) && ctx.attributes.has(n.target))
            return n;
        for (const [k, v] of Object.entries(n))
            if (!k.startsWith('$'))
                for (const child of Array.isArray(v) ? v : [v])
                    if (child && typeof child === 'object' && '$type' in child && !isExecutable(child as AstNode))
                        stack.push(child as AstNode);
    }
    return undefined;
}
