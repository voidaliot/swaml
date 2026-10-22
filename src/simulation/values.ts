export type Value = {
    type: string;
    data: number | boolean | string | Value[] | {
        [key: string]: Value;
    } | null;
};
export type Cell = {
    type: string;
    value: Value;
};
export type Environment = Map<string, Cell>;
export const copy = <T>(v: T): T => structuredClone(v);
export const scalar = (type: string, data: number | boolean | string | null): Value => ({ type, data });
export const voidValue = (): Value => scalar('void', null);
export class RuntimeFault extends Error {
    constructor(public code: string, message = code) { super(message); }
}
export class ContractViolation extends Error {
    constructor(public code: string, message = code) { super(message); }
}
export function plain(v: Value): unknown { if (Array.isArray(v.data))
    return v.data.map(plain); if (v.data !== null && typeof v.data === 'object')
    return Object.fromEntries(Object.entries(v.data).map(([k, v]) => [k, plain(v)])); return v.data; }
export function checked(type: string, n: number | bigint): Value {
    if (typeof n === 'bigint') {
        if (n < -9007199254740991n || n > 9007199254740991n)
            throw new RuntimeFault('Arithmetic', 'Integer overflow');
        n = Number(n);
    }
    if (!Number.isFinite(n) || type !== 'real' && !Number.isSafeInteger(n) || type === 'uint' && n < 0 || type === 'byte' && (n < 0 || n > 255))
        throw new RuntimeFault('Bounds', `Value outside ${type}`);
    return scalar(type, Object.is(n, -0) ? 0 : n);
}
export function widen(v: Value, type: string): Value {
    const m = /^(.*)\[(\d+)\]$/.exec(type);
    if (m && Array.isArray(v.data) && v.data.length === Number(m[2]))
        return { type, data: v.data.map(x => widen(x, m[1])) };
    if (['byte', 'uint', 'int', 'real'].includes(type) && ['byte', 'uint', 'int', 'real'].includes(v.type) && (v.type !== 'real' || type === 'real'))
        return checked(type, v.data as number);
    if (v.type !== type)
        throw new RuntimeFault('Type', `Expected ${type}, received ${v.type}`);
    return copy(v);
}
export function bind(env: Environment, name: string, type: string, value: Value): void { env.set(name, { type, value: widen(value, type) }); }
function equal(l: Value, r: Value): boolean { if (typeof l.data !== 'object' || l.data === null || r.data === null || typeof r.data !== 'object')
    return l.data === r.data; if (Array.isArray(l.data) && Array.isArray(r.data))
    return l.data.length === r.data.length && l.data.every((v, i) => equal(v, (r.data as Value[])[i])); if (Array.isArray(l.data) || Array.isArray(r.data))
    return false; return Object.keys(l.data).length === Object.keys(r.data).length && Object.entries(l.data).every(([k, v]) => !!(r.data as Record<string, Value>)[k] && equal(v, (r.data as Record<string, Value>)[k])); }
export function binary(op: string, l: Value, r: Value): Value {
    const x = l.data as number, y = r.data as number;
    if (op === '==' || op === '!=')
        return scalar('bool', op === '==' ? equal(l, r) : !equal(l, r));
    if (['<', '<=', '>', '>='].includes(op))
        return scalar('bool', op === '<' ? x < y : op === '<=' ? x <= y : op === '>' ? x > y : x >= y);
    if (op === 'and' || op === 'or')
        return scalar('bool', op === 'and' ? !!x && !!y : !!x || !!y);
    if (op === '+' && l.type === 'string')
        return scalar('string', String(l.data) + String(r.data));
    if ((op === '/' || op === '%') && y === 0)
        throw new RuntimeFault('Arithmetic', 'Division by zero');
    const type = op === '/' || l.type === 'real' || r.type === 'real' ? 'real' : 'int';
    if (type === 'int') {
        const a = BigInt(x), b = BigInt(y);
        return checked(type, op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a % b);
    }
    return checked(type, op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : op === '/' ? x / y : x % y);
}
