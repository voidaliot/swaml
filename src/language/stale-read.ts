import type { AstNode } from 'langium';
import * as a from './generated/ast.js';
import { body, isClockRead, isExecutable, isPlace, placeRoot, signature, type Effect, type Executable } from './semantic.js';
/** The index expressions of a value reference or place, left to right: the first index, then each selector index. */
const indexExpressions = (n: a.ReferenceExpression | a.Assign): a.Expression[] => [...(n.index ? [n.index] : []), ...(n.selectors ?? []).flatMap(x => x.index ? [x.index] : [])];

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
 * A call to an operation of the component is followed, so a write moved into a helper is still found. Each
 * operation is summarised once per validation pass in terms of its parameters and its caller's conditions;
 * every call site instantiates the summary with its own argument values and conditions. A write the helper
 * reports by itself (with neutral inputs) stays the helper's finding; every other write of the helper that
 * this call site makes stale is reported at the call, so both are reported. Loops run to a fixed point over
 * the finite domain of attribute sets. The work per document is capped; past the cap the analysis stops and
 * the caller reports a reference validation limit instead of a stale read. One state machine reaction runs the source state's
 * exit action, the transition effect and the target state's entry action under the transition's guard; the
 * initial state's entry action runs on its own. Nested operations are analysed on their own.
 */
export interface StaleReadContext {
    readonly attributes: ReadonlySet<string>;
    target(call: a.CallExpression): Executable | a.PortMember | undefined;
    effects(op: Executable): Effect;
    /** Summaries of the component's operations, shared by every operation of one validation pass. */
    readonly summaries: Map<Executable, Summary>;
    /** Keeps every write of a summary apart (no merging, no cap): the reference the merged analysis is tested against. */
    readonly unmerged?: boolean;
    readonly budget: StaleReadBudget;
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

/** One write of a followed operation, in terms of its parameters (LABEL + index) and the caller's conditions (GUARD). */
type Rec = { value: Value, guards: Value[], targets: string[] };
/** What a call to an operation means to its callers, independent of the call site. */
export type Summary = { records: Rec[], returned: Value, outs: Value[] };
/** Work shared by every analysis of one validation pass of one document. */
export type StaleReadBudget = { work: number, limit?: number };
/** Statement visits allowed per document for SW2011 analysis, followed calls included. */
export const STALE_READ_WORK_LIMIT = 200000;
class WorkLimit extends Error { }

const LABEL = '\u0001', GUARD = LABEL + 'guard';
const isLabel = (k: string) => k.startsWith(LABEL) && k !== GUARD;
/** A value of the callee expressed in the caller's values: a parameter label stands for its argument. */
function instantiate(v: Value, args: readonly Value[]): Value {
    const out = none();
    for (const k of v.fresh) {
        if (!isLabel(k)) {
            out.fresh.add(k);
            continue;
        }
        const arg = args[Number(k.slice(1))] ?? none();
        arg.fresh.forEach(x => out.fresh.add(x));
        arg.stale.forEach(x => out.stale.add(x));
    }
    for (const k of v.stale) {
        if (!isLabel(k)) {
            out.stale.add(k);
            continue;
        }
        const arg = args[Number(k.slice(1))] ?? none();
        arg.fresh.forEach(x => out.stale.add(x));
        arg.stale.forEach(x => out.stale.add(x));
    }
    return out;
}
/** The callee's conditions at a write in the caller's terms: GUARD stands for every condition of the caller. */
function instantiateGuards(guards: readonly Value[], args: readonly Value[], caller: readonly Value[]): Value[] {
    return guards.flatMap(g => g.fresh.has(GUARD) ? [...caller] : g.stale.has(GUARD) ? caller.map(aged) : [instantiate(g, args)]);
}
/** The SW2011 rule for one write: a stale value, or a stale condition that no later condition re-checks. */
function isStaleWrite(value: Value, guards: readonly Value[], target?: string): boolean {
    const depends = new Set([...value.fresh, ...value.stale, ...(target ? [target] : [])]);
    const covers = (g: Value, wanted: Set<string>) => wanted.size > 0 && [...wanted].every(k => g.fresh.has(k));
    return value.stale.size > 0 || guards.some((g, i) => g.stale.size > 0 && !guards.slice(i).some(inner => covers(inner, g.stale) || covers(inner, depends)));
}
/** The rule for one write of several attributes (written under the same value and conditions): any of them. */
const isStaleWriteOf = (value: Value, guards: readonly Value[], targets: Iterable<string>) => [...targets].some(t => isStaleWrite(value, guards, t || undefined));
/**
 * Writes are recorded by their stale reads and conditions, with the set of attributes written that way, so a
 * summary grows with distinct conditions rather than with the number of attributes. Records that differ only
 * in the attributes their value read fresh are merged by joining those: a larger set can only make a
 * re-check harder, so the merge is conservative.
 */
const recordKey = (value: Value, guards: readonly Value[]) => [...value.stale].sort().join(',') + '/' + guards.map(key).join(';');
/**
 * Records a summary keeps separately. Beyond this, the records that depend on the call site are merged into
 * one conservative record: its value carries every stale and fresh input of every merged condition, so every
 * call site that any merged record would warn about is still warned about, possibly with extra warnings.
 */
const RECORD_LIMIT = 64;
function collapse(records: Rec[]): Rec[] {
    if (records.length <= RECORD_LIMIT)
        return records;
    const value = none(), targets = new Set<string>();
    let callerAged = false;
    for (const r of records) {
        r.targets.forEach(t => targets.add(t));
        const parts = [r.value, ...r.guards.filter(g => !g.fresh.has(GUARD) && !g.stale.has(GUARD))];
        for (const p of parts) {
            p.fresh.forEach(k => value.fresh.add(k));
            p.stale.forEach(k => value.stale.add(k));
        }
        callerAged ||= r.guards.some(g => g.stale.has(GUARD));
        // A stale condition of the callee becomes a stale input, so the merged record never misses it.
        r.guards.forEach(g => g.stale.forEach(k => k !== GUARD && value.stale.add(k)));
    }
    return [{ value, guards: [callerAged ? { fresh: new Set(), stale: new Set([GUARD]) } : { fresh: new Set([GUARD]), stale: new Set() }], targets: [...targets] }];
}

class Analysis {
    found?: AstNode;
    /** Values returned by an operation being summarised. */
    returned?: Value;
    /** The writes of an operation being summarised; undefined when its own writes are checked directly. */
    private readonly records?: Map<string, { value: Value, guards: Value[], targets: Set<string> }>;
    /** Flows at each suspension inside the protected bodies of the enclosing interrupt regions. */
    private readonly collectors: Flow[][] = [];
    private suspensions = 0;
    constructor(private readonly ctx: StaleReadContext, private readonly active: Set<Executable>, summarising = false) {
        if (summarising)
            this.records = new Map();
    }

    private suspend(flow: Flow): void {
        this.suspensions++;
        flow.suspend();
        for (const c of this.collectors)
            c.push(flow.copy());
    }
    private write(node: AstNode, value: Value, guards: readonly Value[], targets: Iterable<string> = ['']): void {
        if (this.records) {
            // Own findings are decided per write on its own value and conditions before any merge: a target the
            // operation reports by itself (with neutral inputs) is its own finding and is left out, so a joined
            // value can only add warnings at call sites, never hide one.
            const neutral = instantiate(value, []), neutralGuards = instantiateGuards(guards, [], []);
            const kept = [...targets].filter(t => !isStaleWrite(neutral, neutralGuards, t || undefined));
            if (!kept.length)
                return;
            const k = this.ctx.unmerged ? String(this.records.size) : recordKey(value, guards), known = this.records.get(k);
            if (known) {
                known.value = join(known.value, value);
                for (const t of kept)
                    known.targets.add(t);
            }
            else
                this.records.set(k, { value, guards: [...guards], targets: new Set(kept) });
        }
        else if (!this.found && isStaleWriteOf(value, guards, targets))
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
            const head = e.path.split('.')[0], indexes = this.sequence(indexExpressions(e), flow).reduce(join, none());
            const own = this.ctx.attributes.has(head) ? { fresh: new Set([head]), stale: new Set<string>() } : flow.locals.get(head) ?? none();
            return join(own, indexes);
        }
        if (a.isUnaryExpression(e))
            return this.expression(e.operand, flow);
        // A conditional joins its condition and both branches; it never suspends (WP2-S04).
        if (a.isConditionalExpression(e))
            return this.sequence([e.condition, e.then, e.otherwise], flow).reduce(join, none());
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
        const args = parameters.map((_, i) => argument.get(i) ?? none());
        let returned = none(), outs: Value[] = parameters.map(() => none());
        // The logical clock is never a stale read (WP3-S02): its value carries no attribute and it never suspends.
        if (isClockRead(target))
            return none();
        if (!target || !isExecutable(target))
            // A request (or an unresolved call) waits for its reply; the reply itself is not component state.
            this.suspend(flow);
        else {
            const effect = this.ctx.effects(target), summary = this.summary(target, effect);
            if (summary) {
                // The callee's own findings are reported at the callee; the others depend on this call site.
                for (const r of summary.records)
                    this.write(call, instantiate(r.value, args), instantiateGuards(r.guards, args, flow.guards), r.targets);
                returned = instantiate(summary.returned, args);
                outs = summary.outs.map(v => instantiate(v, args));
            }
            else {
                // Not followed (a pure operation, or a recursive call that is itself an error): its writes and
                // results depend on every argument.
                const all = args.reduce(join, none()), result = effect.suspends ? aged(all) : all;
                returned = join(effect.reads ? { fresh: new Set(['call:' + call.target]), stale: new Set<string>() } : none(), result);
                outs = parameters.map(() => returned);
                if (effect.writes && body(target))
                    this.write(call, result, effect.suspends ? flow.guards.map(aged) : flow.guards);
            }
            if (effect.suspends)
                this.suspend(flow);
        }
        call.args.forEach((arg, i) => {
            if (!out(i) || !a.isReferenceExpression(arg))
                return;
            const name = arg.path.split('.')[0];
            if (this.ctx.attributes.has(name))
                this.write(call, outs[i] ?? none(), flow.guards, [name]);
            else
                flow.locals.set(name, outs[i] ?? none());
        });
        return returned;
    }
    /** The call-site independent summary of target, computed once per validation pass and component. */
    private summary(target: Executable, effect: Effect): Summary | undefined {
        const b = body(target);
        if (!(effect.reads || effect.writes) || !b || b.states.length || this.active.has(target))
            return undefined;
        const cached = this.ctx.summaries.get(target);
        if (cached)
            return cached;
        const parameters = signature(target)?.parameters ?? [];
        this.active.add(target);
        try {
            const callee = new Analysis(this.ctx, this.active, true);
            callee.returned = none();
            let f = new Flow(new Map(parameters.map((p, i) => [p.name, { fresh: new Set([LABEL + i]), stale: new Set<string>() }])), [{ fresh: new Set([GUARD]), stale: new Set() }]);
            f = callee.statements(b.statements, f);
            // A target the callee reports by itself (with neutral inputs) is its own finding and is left out.
            const all = [...callee.records!.values()].map(r => ({ value: r.value, guards: r.guards, targets: [...r.targets] }));
            const records = this.ctx.unmerged ? all : collapse(all);
            const summary: Summary = { records, returned: callee.returned, outs: parameters.map(p => f.locals.get(p.name) ?? none()) };
            this.ctx.summaries.set(target, summary);
            return summary;
        }
        finally {
            this.active.delete(target);
        }
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
        if (++this.ctx.budget.work > (this.ctx.budget.limit ?? STALE_READ_WORK_LIMIT))
            throw new WorkLimit();
        if (a.isLocalVariable(s))
            flow.locals.set(s.name, this.expression(s.value, flow));
        else if (a.isAssign(s) && isPlace(s)) {
            // A place write is a write of its root (WP1-M01). Its indexes are evaluated before the right side,
            // so a suspension in the right side ages them; the root itself is read and written after it.
            const root = placeRoot(s.target), v = this.sequence([...indexExpressions(s), s.value], flow).reduce(join, none());
            if (this.ctx.attributes.has(root))
                this.write(s, v, flow.guards, [root]);
            else
                flow.locals.set(root, join(flow.locals.get(root) ?? none(), v));
        }
        else if (a.isAssign(s)) {
            const v = this.expression(s.value, flow);
            if (this.ctx.attributes.has(s.target))
                this.write(s, v, flow.guards, [s.target]);
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
        else if (a.isWait(s)) {
            // A computed wait is evaluated before the statement suspends (WP4-S03).
            this.expression(s.delay, flow);
            this.suspend(flow);
        }
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
            // A computed timeout is evaluated before the statement suspends (WP4-S03).
            this.expression(s.timeoutValue, flow);
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

/** The first write of op that a pre-suspension state read may influence; limit when the work budget ran out. */
export function staleWrite(op: Executable, ctx: StaleReadContext): { write?: AstNode, limit?: boolean } {
    const b = body(op);
    if (!b)
        return {};
    const analysis = new Analysis(ctx, new Set([op]));
    const parameters = () => new Flow(new Map((signature(op)?.parameters ?? []).map(p => [p.name, none()])));
    try {
        if (!b.states.length) {
            analysis.statements(b.statements, parameters());
            return { write: analysis.found };
        }
        const actions = (state: a.State | undefined, kind: 'entry' | 'exit') => state?.actions.filter(x => x.kind === kind) ?? [];
        const run = (list: a.StateAction[], flow: Flow) => list.reduce((f, x) => analysis.block(x.body, f), flow);
        run(actions(b.states.find(x => x.name === b.initial), 'entry'), parameters());
        // One reaction: the guard selects the transition, then exit, effect and the target's entry run.
        for (const state of b.states)
            for (const t of state.transitions) {
                if (analysis.found)
                    return { write: analysis.found };
                const flow = parameters();
                t.bindings.forEach(n => flow.locals.set(n, none()));
                const guard = analysis.expression(t.guard, flow), inner = flow.copy();
                inner.guards.push(guard);
                const target = b.states.find(x => x.name === t.target);
                run(actions(target, 'entry'), analysis.block(t.effect, run(actions(state, 'exit'), inner)));
            }
        return { write: analysis.found };
    }
    catch (error) {
        if (!(error instanceof WorkLimit))
            throw error;
        return { limit: true };
    }
}
