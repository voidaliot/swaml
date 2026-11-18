import * as a from './generated/ast.js';
import { formatName, formatPath, formatQualifiedName } from './names.js';
import { deploymentPlan } from './placement.js';
import { endpoint, isExecutable, members, owner, packageEndpoint } from './semantic.js';
/**
 * The target binding of swa.ml 2.3 (WP8-M02, WP8-M03): the schema swaml-binding/1 of spec/binding.schema.json and
 * the resolution of its identities against a validated model. Portable: the host reads the file and the sources.
 * A binding check is static resolution of target assumptions; it computes no schedule and is neither an analysis
 * claim nor schedulability evidence (WP8-M05). The schema has a version of its own, independent of the language
 * edition (decision 3, review F6), so that renaming a language release does not invalidate binding files.
 */
export const BINDING_SCHEMA = 'swaml-binding/1';
/** A JSON Schema property of the binding, as spec/binding.schema.json declares it (without its description). */
export type BindingProperty =
    | { type: 'string'; minLength?: number }
    | { type: 'integer'; minimum: number; maximum: number }
    | { type: 'array' }
    | { const: string };
const TEXT = { type: 'string', minLength: 1 } as const;
const NS = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } as const;
/**
 * The shape spec/binding.schema.json declares, with every property's type and range; the checker enforces exactly
 * this, and a unit test keeps it equal to the schema file. `$schema` is the usual editor association (any string).
 */
export const BINDING_SHAPE = {
    root: { required: ['schema', 'deployment'], properties: { $schema: { type: 'string' }, schema: { const: BINDING_SCHEMA }, deployment: TEXT, costs: { type: 'array' }, budgets: { type: 'array' }, crossCoreLatencyNs: { type: 'array' } } },
    costs: { required: ['operation', 'wcetNs', 'source'], properties: { operation: TEXT, wcetNs: NS, bcetNs: NS, source: TEXT } },
    budgets: { required: ['task', 'budgetNs'], properties: { task: TEXT, budgetNs: NS } },
    crossCoreLatencyNs: { required: ['connection', 'maxNs'], properties: { connection: TEXT, maxNs: NS } },
} as const satisfies Record<string, { required: readonly string[]; properties: Record<string, BindingProperty> }>;
/** One finding of a binding check (WP8-D10): an error fails the check; a finding (a placed operation without a cost) does not. */
export interface BindingFinding {
    severity: 'error' | 'finding';
    /** The JSON Pointer (RFC 6901) of the offending value, or of the array that lacks an entry; the root is "". */
    pointer: string;
    /** The identity concerned, when there is one. */
    identity?: string;
    reason: string;
}
export interface BindingResult {
    deployment?: string;
    findings: BindingFinding[];
    /** The resolved identities by kind, for tools. */
    resolved: { operations: string[]; tasks: string[]; connections: string[] };
}
const pointer = (...parts: (string | number)[]) => parts.map(p => '/' + String(p).replaceAll('~', '~0').replaceAll('/', '~1')).join('');
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Schema validation (spec/binding.schema.json) with one finding per violation, in document order. */
export function bindingSchemaFindings(value: unknown): BindingFinding[] {
    const out: BindingFinding[] = [];
    const error = (at: string, reason: string) => out.push({ severity: 'error', pointer: at, reason });
    const check = (x: unknown, at: string, p: BindingProperty) => {
        if ('const' in p) {
            if (x !== p.const)
                error(at, `must be "${p.const}", found ${JSON.stringify(x)}`);
        }
        else if (p.type === 'string') {
            if (typeof x !== 'string' || x.length < (p.minLength ?? 0))
                error(at, p.minLength ? 'must be a non-empty string' : 'must be a string');
        }
        else if (p.type === 'integer') {
            if (typeof x !== 'number' || !Number.isInteger(x) || x < p.minimum || x > p.maximum)
                error(at, `must be an integer from ${p.minimum} to ${p.maximum}`);
        }
        else if (!Array.isArray(x))
            error(at, 'must be an array');
    };
    const object = (v: unknown, at: string, shape: { required: readonly string[]; properties: Record<string, BindingProperty> }): v is Record<string, unknown> => {
        if (!isObject(v)) {
            error(at, `must be an object, found ${Array.isArray(v) ? 'an array' : v === null ? 'null' : typeof v}`);
            return false;
        }
        for (const k of shape.required)
            if (!(k in v))
                error(at, `is missing the required property ${k}`);
        for (const [k, x] of Object.entries(v)) {
            const p = Object.hasOwn(shape.properties, k) ? shape.properties[k] : undefined;
            if (!p)
                error(at + pointer(k), 'is not a property of the schema');
            else
                check(x, at + pointer(k), p);
        }
        return true;
    };
    if (!object(value, '', BINDING_SHAPE.root))
        return out;
    for (const list of ['costs', 'budgets', 'crossCoreLatencyNs'] as const)
        if (Array.isArray(value[list]))
            (value[list] as unknown[]).forEach((item, i) => object(item, pointer(list, i), BINDING_SHAPE[list]));
    return out;
}
/** The canonical identity of a deployment: Package::name in the current spelling, for example DoorEcu::'Front left door'. */
export const deploymentIdentity = (d: a.Deployment): string => `${formatQualifiedName(owner(d, a.isPackage)?.name ?? '')}::${formatName(d.name)}`;
/**
 * Validates a parsed binding against the schema and resolves every identity against the validated models (WP8-M03):
 * the deployment by its qualified identity; operations among the operations of the deployed tree; Tasks among the
 * Swaml::Os Task occurrences of its platform; connections among the routes of the deployed tree and the package
 * connections that join a port of its root. Errors: schema violations, unresolved or duplicate identities and
 * bcetNs > wcetNs. Findings: every placed operation (one that an entry with an effective placement releases) without
 * a cost. The models must be free of errors; the host checks that first.
 */
export function checkBinding(value: unknown, models: readonly a.Model[]): BindingResult {
    const findings = bindingSchemaFindings(value), resolved: BindingResult['resolved'] = { operations: [], tasks: [], connections: [] };
    if (!isObject(value))
        return { findings, resolved };
    const error = (at: string, identity: string | undefined, reason: string) => findings.push({ severity: 'error', pointer: at, identity, reason });
    const list = (k: string) => Array.isArray(value[k]) ? value[k] as unknown[] : [];
    // bcetNs <= wcetNs is checked whether or not the deployment resolves.
    list('costs').forEach((c, i) => {
        if (isObject(c) && Number.isSafeInteger(c.wcetNs) && Number.isSafeInteger(c.bcetNs) && (c.bcetNs as number) > (c.wcetNs as number))
            error(pointer('costs', i, 'bcetNs'), typeof c.operation === 'string' ? c.operation : undefined, `bcetNs ${c.bcetNs} exceeds wcetNs ${c.wcetNs}`);
    });
    const name = typeof value.deployment === 'string' ? value.deployment : undefined;
    const deployments = models.flatMap(m => m.packages.flatMap(p => p.elements.filter(a.isDeployment)));
    const d = name !== undefined ? deployments.find(x => deploymentIdentity(x) === name) : undefined;
    const plan = d && deploymentPlan(d);
    if (name !== undefined && !plan) {
        error(pointer('deployment'), name, d ? 'the deployment does not resolve to a root and platform' : 'no deployment of the sources has this qualified identity');
        return { deployment: name, findings: sortFindings(findings), resolved };
    }
    if (!plan)
        return { findings: sortFindings(findings), resolved };
    resolved.operations = plan.software.flatMap(o => members(o.structure).filter(isExecutable).map(op => `${formatPath(o.path)}.${formatName(op.name)}`));
    resolved.tasks = plan.tasks.map(t => formatPath(t.path));
    const forwarding: string[] = [];
    for (const o of plan.software)
        members(o.structure).filter(a.isConnect).forEach((l, i) => {
            const id = `${formatPath(o.path)}.${l.name !== undefined ? formatName(l.name) : `@connect${i}`}`;
            const left = endpoint(o.structure, l.source), right = endpoint(o.structure, l.target);
            (left && right && left.child !== right.child ? forwarding : resolved.connections).push(id);
        });
    const pkg = owner(plan.root, a.isPackage);
    pkg?.connections.forEach((l, i) => {
        const ends = [packageEndpoint(pkg, l.source), packageEndpoint(pkg, l.target)];
        if (ends[0] && ends[1] && ends.some(e => e!.structure === plan.root))
            resolved.connections.push(l.name !== undefined ? formatName(l.name) : `@package${i}`);
    });
    const resolve = (key: 'costs' | 'budgets' | 'crossCoreLatencyNs', field: string, known: string[], what: string, hint?: (id: string) => string | undefined) => {
        const seen = new Map<string, number>(), set = new Set(known);
        list(key).forEach((item, i) => {
            const id = isObject(item) && typeof item[field] === 'string' ? item[field] as string : undefined;
            if (id === undefined || !id.length)
                return;
            if (!set.has(id))
                error(pointer(key, i, field), id, hint?.(id) ?? `no ${what} of ${name} has this identity`);
            else if (seen.has(id))
                error(pointer(key, i, field), id, `duplicates ${pointer(key, seen.get(id)!, field)}`);
            else
                seen.set(id, i);
        });
        return seen;
    };
    const costed = resolve('costs', 'operation', resolved.operations, 'operation of the deployed tree');
    resolve('budgets', 'task', resolved.tasks, 'Swaml::Os task of the platform', id => plan.platformOccurrences.some(o => formatPath(o.path) === id) ? `${id} is a platform occurrence of ${name} but not a Swaml::Os task` : undefined);
    resolve('crossCoreLatencyNs', 'connection', resolved.connections, 'connection route', id => forwarding.includes(id) ? `${id} is a forwarding connect, which has no route` : undefined);
    const placed = new Set<string>();
    for (const e of plan.entries)
        if (e.placement)
            placed.add(`${formatPath(e.occurrence.path)}.${formatName(e.entry.operation)}`);
    for (const id of placed)
        if (!costed.has(id))
            findings.push({ severity: 'finding', pointer: pointer('costs'), identity: id, reason: 'placed operation has no cost' });
    return { deployment: name, findings: sortFindings(findings), resolved };
}
/** Errors first, then findings; each group in the order it was found. */
function sortFindings(findings: BindingFinding[]): BindingFinding[] {
    return [...findings.filter(f => f.severity === 'error'), ...findings.filter(f => f.severity === 'finding')];
}
/** One line per finding (WP8-D10): severity, JSON Pointer (the root, "", printed as "" as in --json), identity and reason. */
export function bindingFindingText(f: BindingFinding): string {
    return `${f.severity} ${f.pointer === '' ? '""' : f.pointer}${f.identity !== undefined ? ' ' + f.identity : ''}: ${f.reason}.`;
}
