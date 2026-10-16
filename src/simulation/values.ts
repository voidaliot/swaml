import * as a from '../language/generated/ast.js';
import { owner } from '../language/swaml-scope.js';
import { resolveEnumLiteral, typeKey } from '../language/semantic.js';

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
    const array = /^(.*)\[(\d+)\]$/.exec(type);
    if (array && Array.isArray(v.data) && v.data.length === Number(array[2])) {
        return { type, data: v.data.map(element => widen(element, array[1])) };
    }
    if (type === 'real' && integral(v.type)) return scalar('real', v.data as number);
    if (integral(type) && integral(v.type)) {
        const n = v.data as number;
        if (!Number.isSafeInteger(n) || (type === 'uint' && n < 0) || (type === 'byte' && (n < 0 || n > 255))) throw new RuntimeFault('Bounds', `Value ${n} is outside ${type}`);
        return scalar(type, n);
    }
    if (v.type !== type) throw new RuntimeFault('Type', `Expected ${type}, received ${v.type}`);
    return copy(v);
}
const integral = (type: string): boolean => ['byte', 'uint', 'int'].includes(type);
const numericType = (type: string): boolean => integral(type) || type === 'real';
export function bind(env: Environment, name: string, type: string, value: Value): void {
    env.set(name, { type, value: widen(value, type) });
}
function numeric(type: string, n: number | bigint): Value {
    if (typeof n === 'bigint') {
        if (n < -9007199254740991n || n > 9007199254740991n) throw new RuntimeFault('Arithmetic', 'int overflow');
        n = Number(n);
    }
    if (!Number.isFinite(n) || (integral(type) && !Number.isSafeInteger(n))) throw new RuntimeFault('Arithmetic', 'Non-finite or out-of-range arithmetic');
    return scalar(type, Object.is(n, -0) ? 0 : n);
}
function equal(l: Value, r: Value): boolean {
    if (numericType(l.type) && numericType(r.type)) return l.data === r.data;
    if (l.type !== r.type) return false;
    if (Array.isArray(l.data) && Array.isArray(r.data)) return l.data.length === r.data.length && l.data.every((v, i) => equal(v, (r.data as Value[])[i]));
    if (typeof l.data === 'object' && typeof r.data === 'object' && !Array.isArray(l.data) && !Array.isArray(r.data)) {
        return Object.keys(l.data).every(k => equal((l.data as Record<string, Value>)[k], (r.data as Record<string, Value>)[k]));
    }
    return l.data === r.data;
}
export function evaluate(e: a.Expression, env: Environment, fuel: () => void, models: readonly a.Model[], context?: a.Component | a.RootComponent): Value {
    fuel();
    const ev = (x: a.Expression) => evaluate(x, env, fuel, models, context);
    if (a.isLiteral(e)) {
        if (e.number !== undefined) return numeric(e.$cstNode!.text.includes('.') ? 'real' : 'int', e.number);
        if (e.boolean !== undefined) return scalar('bool', e.boolean === 'true');
        return scalar('string', e.text!);
    }
    if (a.isReferenceExpression(e)) {
        const literal = resolveEnumLiteral(e, models, env);
        if (literal) return scalar(`${owner(literal.type, a.isPackage)!.name}::${literal.type.name}`, literal.literal);
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
    if (a.isArrayLiteral(e)) {
        const values = e.values.map(ev);
        const types = new Set(values.map(v => v.type));
        const type = types.size === 1 ? values[0].type : values.every(v => numericType(v.type)) ? (types.has('real') ? 'real' : types.has('int') ? 'int' : 'uint') : values[0].type;
        return { type: `${type}[${values.length}]`, data: values.map(v => widen(v, type)) };
    }
    if (a.isCalculationCall(e)) {
        const f = e.calculation.ref!, args = e.args.map(ev), scope: Environment = new Map();
        f.parameters.forEach((p, i) => bind(scope, p.name, typeKey(p.type), args[i]));
        return widen(evaluate(f.value, scope, fuel, models, context), typeKey(f.result));
    }
    if (a.isUnaryExpression(e)) {
        const v = ev(e.operand);
        return e.operator === 'not' ? scalar('bool', !v.data) : numeric(integral(v.type) ? 'int' : 'real', integral(v.type) ? -BigInt(v.data as number) : -(v.data as number));
    }
    const l = ev(e.left);
    if (e.operator === 'and' && l.data === false) return scalar('bool', false);
    if (e.operator === 'or' && l.data === true) return scalar('bool', true);
    const r = ev(e.right), x = l.data as number, y = r.data as number;
    switch (e.operator) {
        case 'and': case 'or': return scalar('bool', r.data as boolean);
        case '==': return scalar('bool', equal(l, r));
        case '!=': return scalar('bool', !equal(l, r));
        case '<': return scalar('bool', x < y);
        case '<=': return scalar('bool', x <= y);
        case '>': return scalar('bool', x > y);
        case '>=': return scalar('bool', x >= y);
    }
    if ((e.operator === '/' || e.operator === '%') && y === 0) throw new RuntimeFault('Arithmetic', 'Division by zero');
    const type = e.operator === '/' || l.type === 'real' || r.type === 'real' ? 'real' : 'int';
    if (type === 'int') {
        const b = BigInt(x), c = BigInt(y);
        return numeric(type, e.operator === '+' ? b + c : e.operator === '-' ? b - c : e.operator === '*' ? b * c : b % c);
    }
    return numeric(type, e.operator === '+' ? x + y : e.operator === '-' ? x - y : e.operator === '*' ? x * y : x / y);
}
