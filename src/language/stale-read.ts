import type { AstNode } from 'langium';
import * as a from './generated/ast.js';
import { body, isExecutable, signature, type Effect, type Executable } from './semantic.js';

/**
 * SW2011 (docs/spec/03-behavior.md, 3.4): a pre-suspension state read that may affect a later write.
 *
 * The analysis follows the statements of one activation in execution order. A value carries the component
 * attributes it was derived from, split into fresh reads and reads made before a later suspension (stale).
 * Suspension (wait, receive, an interrupt handler's entry, a request or a call to a suspending operation)
 * turns every fresh derivation held in locals, pending operands and enclosing conditions stale. A write is
 * reported when its value is stale or when it runs under a stale condition that no condition evaluated
 * after resuming re-checks. Writes include attribute assignments and attribute out arguments. A call to an
 * operation of the component is followed with the caller's argument values and conditions, so a write moved
 * into a helper is still found; it is reported at the call unless the helper reports it itself. Each entry
 * action, exit action and transition of a state machine is a separate reaction; nested operations are
 * analysed on their own.
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

class Flow {
    constructor(readonly locals = new Map<string, Value>(), public guards: Value[] = []) { }
    copy(): Flow { return new Flow(new Map(this.locals), [...this.guards]); }
    suspend(): void {
        for (const [k, v] of this.locals)
            this.locals.set(k, aged(v));
        this.guards = this.guards.map(aged);
    }
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

/** Calls are followed this deep; recursion is invalid (SW2006), so this only bounds long call chains. */
const MAX_CALL_DEPTH = 8;

class Analysis {
    /** Counts suspensions so that operands evaluated before one become stale. */
    private suspensions = 0;
    found?: AstNode;
    /** Values returned by a followed callee. */
    returned?: Value;
    constructor(private readonly ctx: StaleReadContext, private readonly depth = 0, private readonly own = new Map<Executable, boolean>()) { }

    private suspend(flow: Flow): void {
        this.suspensions++;
        flow.suspend();
    }
    private write(node: AstNode, value: Value, flow: Flow): void {
        if (this.found)
            return;
        const stale = (g: Value) => g.stale.size > 0;
        // A condition that reads every stale input of a condition again after resuming re-checks it; this
        // includes a condition comparing a live attribute with the value read before the suspension.
        const unchecked = flow.guards.some((g, i) => stale(g) && !flow.guards.slice(i).some(inner => [...g.stale].every(k => inner.fresh.has(k))));
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
    expression(e: a.Expression | undefined, flow: Flow): Value {
        if (!e)
            return none();
        if (a.isReferenceExpression(e)) {
            const head = e.path.split('.')[0], index = e.index ? this.expression(e.index, flow) : none();
            const own = this.ctx.attributes.has(head) ? { fresh: new Set([head]), stale: new Set<string>() } : flow.locals.get(head) ?? none();
            return join(own, index);
        }
        if (a.isBinaryExpression(e))
            return this.sequence([e.left, e.right], flow).reduce(join, none());
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
        let args = this.sequence(call.args, flow);
        const target = this.ctx.target(call);
        if (!target || !isExecutable(target)) {
            // A request (or an unresolved call) waits for its reply; the reply itself is not component state.
            this.suspend(flow);
            return none();
        }
        const effect = this.ctx.effects(target), parameters = signature(target)?.parameters ?? [], b = body(target);
        const outToAttribute = parameters.some((p, i) => p.direction === 'out' && a.isReferenceExpression(call.args[i]) && this.ctx.attributes.has((call.args[i] as a.ReferenceExpression).path));
        let result: Value, unfollowed = false;
        if ((effect.reads || effect.writes) && b && !b.states.length && this.depth < MAX_CALL_DEPTH) {
            // Follow the call with the caller's argument values and conditions. A finding that the callee
            // also has with neutral inputs is the callee's own SW2011 and is reported there.
            const run = (inputs: Value[], guards: Value[]) => {
                const callee = new Analysis(this.ctx, this.depth + 1, this.own);
                callee.returned = none();
                let f = new Flow(new Map(parameters.map((p, i) => [p.name, inputs[i] ?? none()])), [...guards]);
                for (const st of b.statements)
                    f = callee.statement(st, f);
                return callee;
            };
            const actual = run(args, flow.guards);
            if (actual.found && !this.found && !this.own.has(target))
                this.own.set(target, !!run([], []).found);
            if (actual.found && !this.found && !this.own.get(target))
                this.found = call;
            result = actual.returned!;
        }
        else {
            result = effect.reads ? { fresh: new Set(['call:' + call.target]), stale: new Set() } : none();
            unfollowed = effect.writes;
        }
        if (effect.suspends) {
            this.suspend(flow);
            args = args.map(aged);
        }
        if (outToAttribute || unfollowed)
            this.write(call, join(args.reduce(join, none()), result), flow);
        return result;
    }
    /** Runs code under a condition; the condition no longer guards what follows. */
    private guarded(condition: Value, flow: Flow, run: (inner: Flow) => Flow): Flow {
        const inner = flow.copy();
        inner.guards.push(condition);
        const out = run(inner);
        out.guards = flow.guards;
        return out;
    }
    /** Runs a loop body until the locals reach a fixpoint, so suspension in one iteration ages the next. */
    private loop(flow: Flow, iteration: (inner: Flow) => Flow): Flow {
        const result = flow.copy();
        for (let i = 0; i < 4 && !this.found; i++)
            if (!result.merge(iteration(result.copy())) && i)
                break;
        return result;
    }
    block(b: a.Block | undefined, flow: Flow): Flow {
        let current = flow;
        for (const s of b?.statements ?? [])
            current = this.statement(s, current);
        return current;
    }
    statement(s: a.Statement, flow: Flow): Flow {
        if (this.found)
            return flow;
        if (a.isLocalVariable(s))
            flow.locals.set(s.name, this.expression(s.value, flow));
        else if (a.isAssign(s)) {
            const v = this.expression(s.value, flow);
            if (this.ctx.attributes.has(s.target))
                this.write(s, v, flow);
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
            const protectedEnd = this.block(s.body, flow.copy());
            // The handler runs when input arrives while the protected body is suspended.
            const handler = flow.copy();
            handler.merge(protectedEnd);
            this.suspend(handler);
            s.bindings.forEach(n => handler.locals.set(n, none()));
            const handled = this.block(s.handler, handler);
            protectedEnd.merge(handled);
            return protectedEnd;
        }
        return flow;
    }
}

/** The first write of op that a pre-suspension state read may influence, if any. */
export function staleWrite(op: Executable, ctx: StaleReadContext): AstNode | undefined {
    const b = body(op);
    if (!b)
        return undefined;
    const analysis = new Analysis(ctx);
    const parameters = () => new Flow(new Map((signature(op)?.parameters ?? []).map(p => [p.name, none()])));
    if (!b.states.length) {
        let flow = parameters();
        for (const s of b.statements)
            flow = analysis.statement(s, flow);
        return analysis.found;
    }
    // Every entry action, exit action and transition is its own reaction.
    for (const state of b.states) {
        for (const action of state.actions)
            analysis.block(action.body, parameters());
        for (const t of state.transitions) {
            const flow = parameters();
            t.bindings.forEach(n => flow.locals.set(n, none()));
            const guard = analysis.expression(t.guard, flow);
            const inner = flow.copy();
            inner.guards.push(guard);
            analysis.block(t.effect, inner);
        }
        if (analysis.found)
            return analysis.found;
    }
    return analysis.found;
}
