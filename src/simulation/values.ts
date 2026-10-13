import * as a from '../language/generated/ast.js';
import { owner } from '../language/swaml-scope.js';
import { typeKey } from '../language/semantic.js';

export type Value = { type: string; data: number | boolean | string | Value[] | { [key: string]: Value } };
export type Cell = { type: string; value: Value };
export type Environment = Map<string, Cell>;
export class RuntimeFault extends Error {
    constructor(public code: string, message = code) { super(message); }
}
export const copy = <T>(v: T): T => structuredClone(v);
export const scalar = (type: string, data: number | boolean | string): Value => ({ type, data });
export function plain(v: Value): unknown {
    if (Array.isArray(v.data)) return v.data.map(plain);
    if (typeof v.data === 'object') return Object.fromEntries(Object.entries(v.data).map(([k, x]) => [k, plain(x)]));
    return v.data;
}
export function widen(v: Value, type: string): Value {
    if (type === 'Real' && v.type === 'Int') return scalar('Real', v.data as number);
    if (v.type !== type) throw new RuntimeFault('Type', `Expected ${type}, received ${v.type}`);
    return copy(v);
}
export function bind(env: Environment, name: string, type: string, value: Value): void {
    env.set(name, { type, value: widen(value, type) });
}
function numeric(type: string, n: number | bigint): Value {
    if (typeof n === 'bigint') {
        if (n < -9007199254740991n || n > 9007199254740991n) throw new RuntimeFault('Arithmetic', 'Int overflow');
        n = Number(n);
    }
    if (!Number.isFinite(n) || (type === 'Int' && !Number.isSafeInteger(n))) throw new RuntimeFault('Arithmetic', 'Non-finite or out-of-range arithmetic');
    return scalar(type, Object.is(n, -0) ? 0 : n);
}
function equal(l: Value, r: Value): boolean {
    if (['Int', 'Real'].includes(l.type) && ['Int', 'Real'].includes(r.type)) return l.data === r.data;
    if (l.type !== r.type) return false;
    if (Array.isArray(l.data) && Array.isArray(r.data)) return l.data.length === r.data.length && l.data.every((v, i) => equal(v, (r.data as Value[])[i]));
    if (typeof l.data === 'object' && typeof r.data === 'object' && !Array.isArray(l.data) && !Array.isArray(r.data)) {
        return Object.keys(l.data).every(k => equal((l.data as Record<string, Value>)[k], (r.data as Record<string, Value>)[k]));
    }
    return l.data === r.data;
}
export function evaluate(e: a.Expression, env: Environment, fuel: () => void): Value {
    fuel();
    const ev = (x: a.Expression) => evaluate(x, env, fuel);
    if (a.isLiteral(e)) {
        if (e.number !== undefined) return numeric(e.$cstNode!.text.includes('.') ? 'Real' : 'Int', e.number);
        if (e.boolean !== undefined) return scalar('Bool', e.boolean === 'true');
        return scalar('String', e.text!);
    }
    if (a.isReferenceExpression(e)) {
        const [root, ...fields] = e.path.split('.');
        let v = env.get(root)?.value;
        if (!v) throw new RuntimeFault('Type', `No live value ${root}`);
        for (const key of fields) v = (v.data as Record<string, Value>)[key];
        if (e.index) {
            const i = ev(e.index).data as number;
            if (!Number.isSafeInteger(i) || i < 0 || i >= (v.data as Value[]).length) throw new RuntimeFault('Bounds');
            v = (v.data as Value[])[i];
        }
        return copy(v);
    }
    if (a.isRecordLiteral(e)) {
        const type = e.type.ref!;
        const data: Record<string, Value> = Object.create(null);
        for (const f of e.fields) data[f.name] = widen(ev(f.value), typeKey(type.fields.find(x => x.name === f.name)!.type));
        return { type: `${owner(type, a.isPackage)!.name}::${type.name}`, data };
    }
    if (a.isEnumLiteral(e)) return scalar(`${owner(e.type.ref!, a.isPackage)!.name}::${e.type.ref!.name}`, e.literal);
    if (a.isArrayLiteral(e)) {
        const values = e.values.map(ev);
        const type = values.some(v => v.type === 'Real') && values.every(v => ['Int', 'Real'].includes(v.type)) ? 'Real' : values[0].type;
        return { type: `${type}[${values.length}]`, data: values.map(v => widen(v, type)) };
    }
    if (a.isFunctionCall(e)) {
        const f = e.function.ref!, args = e.args.map(ev), scope: Environment = new Map();
        f.parameters.forEach((p, i) => bind(scope, p.name, typeKey(p.type), args[i]));
        return widen(evaluate(f.value, scope, fuel), typeKey(f.result));
    }
    if (a.isUnaryExpression(e)) {
        const v = ev(e.operand);
        return e.operator === 'not' ? scalar('Bool', !v.data) : numeric(v.type, v.type === 'Int' ? -BigInt(v.data as number) : -(v.data as number));
    }
    const l = ev(e.left);
    if (e.operator === 'and' && l.data === false) return scalar('Bool', false);
    if (e.operator === 'or' && l.data === true) return scalar('Bool', true);
    const r = ev(e.right), x = l.data as number, y = r.data as number;
    switch (e.operator) {
        case 'and': case 'or': return scalar('Bool', r.data as boolean);
        case '==': return scalar('Bool', equal(l, r));
        case '!=': return scalar('Bool', !equal(l, r));
        case '<': return scalar('Bool', x < y);
        case '<=': return scalar('Bool', x <= y);
        case '>': return scalar('Bool', x > y);
        case '>=': return scalar('Bool', x >= y);
    }
    if ((e.operator === '/' || e.operator === '%') && y === 0) throw new RuntimeFault('Arithmetic', 'Division by zero');
    const type = e.operator === '/' || l.type === 'Real' || r.type === 'Real' ? 'Real' : 'Int';
    if (type === 'Int') {
        const b = BigInt(x), c = BigInt(y);
        return numeric(type, e.operator === '+' ? b + c : e.operator === '-' ? b - c : e.operator === '*' ? b * c : b % c);
    }
    return numeric(type, e.operator === '+' ? x + y : e.operator === '-' ? x - y : e.operator === '*' ? x * y : x / y);
}
