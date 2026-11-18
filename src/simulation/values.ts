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
    /** details names the subject and source of a violation that has its own (a StateLoop of a state, SIF-T07); the others name the run target. */
    constructor(public code: string, message = code, public details?: { subject: string; source?: string }) { super(message); }
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
/** The most fraction digits realText writes, and the magnitude from which it fails (WP3-R02). */
export const REAL_TEXT_MAX_DECIMALS = 15;
export const REAL_TEXT_LIMIT = 1e21;
/** The exact value of a finite, non-negative binary64 number as mantissa * 2^exponent. */
function binary64(x: number): [bigint, number] {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, x);
    const bits = view.getBigUint64(0), biased = Number((bits >> 52n) & 0x7ffn), fraction = bits & ((1n << 52n) - 1n);
    return biased === 0 ? [fraction, -1074] : [fraction | (1n << 52n), biased - 1075];
}
/** Swaml::Text::intText (WP3-R02): decimal digits, '-' for negatives, no leading zeros. */
export function intText(v: number): string {
    if (!Number.isSafeInteger(v))
        throw new RuntimeFault('Bounds', 'Value outside int');
    return BigInt(v).toString();
}
/**
 * Swaml::Text::realText (WP3-R02): the exact binary value of v rounded to exactly decimals fraction digits,
 * ties away from zero, in plain decimal notation without exponent and without a signed zero. Computed in
 * integers from the binary64 bits, never with toFixed, which writes -0.00 and switches to exponent notation.
 */
export function realText(v: number, decimals: number): string {
    if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > REAL_TEXT_MAX_DECIMALS)
        throw new RuntimeFault('Bounds', `realText writes at most ${REAL_TEXT_MAX_DECIMALS} decimals`);
    if (!Number.isFinite(v) || Math.abs(v) >= REAL_TEXT_LIMIT)
        throw new RuntimeFault('Bounds', 'realText needs an absolute value below 1e21');
    const [mantissa, exponent] = binary64(Math.abs(v)), scale = 10n ** BigInt(decimals);
    let units: bigint;
    if (exponent >= 0)
        units = (mantissa << BigInt(exponent)) * scale;
    else {
        const numerator = mantissa * scale, denominator = 1n << BigInt(-exponent);
        units = numerator / denominator;
        // Ties away from zero: the magnitude rounds up when the remainder is at least one half.
        if ((numerator % denominator) * 2n >= denominator)
            units += 1n;
    }
    const digits = units.toString().padStart(decimals + 1, '0');
    const text = decimals ? `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}` : digits;
    return v < 0 && units !== 0n ? '-' + text : text;
}
/** Swaml::Numeric::sqrt (WP3-R01): IEEE-754 square root, correctly rounded; below zero is Arithmetic. */
export function squareRoot(v: number): number {
    if (v < 0)
        throw new RuntimeFault('Arithmetic', 'Square root of a negative number');
    return Math.sqrt(v);
}
