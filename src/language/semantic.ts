import { AstUtils, type AstNode } from 'langium';
import * as a from './generated/ast.js';
/** Shared semantic algorithms have no filesystem or host dependencies. */
export type Node = AstNode & {
    [key: string]: any;
};
export const expressionTypes = new WeakMap<a.Expression,string>();
export const workspaceModels = new WeakMap<a.Model, a.Model[]>();
export type Structure = a.ComponentDef | a.ComponentUsage;
export type Executable = a.Operation | a.OperationUsage;
export const nodes = (n: AstNode): Node[] => [n, ...AstUtils.streamAllContents(n)] as Node[];
export function owner<T extends AstNode>(n: AstNode | undefined, test: (n: AstNode) => n is T): T | undefined {
    for (let p = n?.$container; p; p = p.$container)
        if (test(p))
            return p;
    return undefined;
}
export const container = (n: AstNode) => owner(n, (x): x is Structure => a.isComponentDef(x) || a.isComponentUsage(x));
export function identity(n: AstNode): string {
    const p = owner(n, a.isPackage);
    const parts: string[] = [];
    for (let x: Node | undefined = n as Node; x && x !== p; x = x.$container as Node)
        if (x.name)
            parts.unshift(x.name);
    return p ? `${p.name}::${parts.join('.')}` : parts.join('.');
}
export function resolve(n: AstNode, name: string, models: readonly a.Model[]): a.Element | undefined {
    const pkg = a.isPackage(n) ? n : owner(n, a.isPackage);
    const matches = models.flatMap(m => m.packages.flatMap(p => p.elements.filter(e => name.includes('::') ? `${p.name}::${e.name}` === name : e.name === name && (p === pkg || pkg?.imports.some(i => i.namespace === p.name)))));
    return matches.length === 1 ? matches[0] : undefined;
}
export function members(c: Structure, seen = new Set<Structure>()): a.ComponentMember[] {
    if (seen.has(c))
        return [];
    seen.add(c);
    const base = a.isComponentDef(c) ? c.specializes?.ref : c.definition?.ref;
    const inherited = base ? members(base, seen) : [];
    const own = c.members.filter(x => !a.isSchedule(x));
    const names = new Set(own.filter(x => 'name' in x && x.name).map(x => (x as Node).name));
    return [...inherited.filter(x => !('name' in x) || !names.has(x.name)), ...own];
}
export function entryKey(e: a.ScheduleEntry): string { return `${e.kind}:${e.endpoint ?? e.predecessor ?? (e.period ? nanos(e.period) : '')}:${e.operation}`; }
export function schedule(c: Structure, seen = new Set<Structure>()): a.ScheduleEntry[] {
    if (seen.has(c))
        return [];
    seen.add(c);
    const base = a.isComponentDef(c) ? c.specializes?.ref : c.definition?.ref;
    const out = new Map((base ? schedule(base, seen) : []).map(e => [entryKey(e), e]));
    for (const e of c.members.filter(a.isSchedule).flatMap(s => s.entries))
        out.set(entryKey(e), e);
    return [...out.values()];
}
export function signature(op: Executable): a.Operation | undefined { return a.isOperation(op) ? op : op.definition.ref; }
export function body(op: Executable): a.OperationBody | undefined { return op.body ?? signature(op)?.body; }
export const isExecutable = (n: AstNode): n is Executable => a.isOperation(n) || a.isOperationUsage(n);
export function localOperation(n: AstNode, name: string, c?: Structure): Executable | undefined {
    const op = isExecutable(n) ? n : owner(n, isExecutable);
    // The enclosing operation's siblings are deliberately absent: no closure capture.
    const nested = op && body(op)?.operations.find(x => x.name === name);
    if (nested)
        return nested;
    if (op?.name === name)
        return op;
    return (c ?? container(n)) && members((c ?? container(n))!).filter(isExecutable).find(x => x.name === name);
}
export function typeKey(t?: a.TypeRef): string {
    if (!t)
        return 'void';
    const base = t.primitive ?? (t.type?.ref ? identity(t.type.ref) : '?');
    return t.size !== undefined ? `${base}[${t.size}]` : base;
}
export const numeric = (t: string) => ['byte', 'uint', 'int', 'real'].includes(t);
export const integral = (t: string) => ['byte', 'uint', 'int'].includes(t);
export function assignable(from: string, to: string, literal?: number): boolean {
    if (from === '?' || to === '?')
        return true;
    if (from === to)
        return true;
    if (numeric(from) && numeric(to)) {
        if (['byte', 'uint', 'int', 'real'].indexOf(from) <= ['byte', 'uint', 'int', 'real'].indexOf(to))
            return true;
        return integral(from) && literal !== undefined && integral(to) && Number.isSafeInteger(literal) && (to === 'int' || literal >= 0 && (to !== 'byte' || literal <= 255));
    }
    return false;
}
export function constantNumber(e?: a.Expression): number | undefined {
    if (a.isLiteral(e))
        return e.number;
    if (a.isUnaryExpression(e) && e.operator === '-') {
        const n = constantNumber(e.operand);
        return n === undefined ? undefined : -n;
    }
    return undefined;
}
export function nanos(d: a.Duration): number { return d.value * ({ ns: 1, us: 1000, ms: 1000000, s: 1000000000 }[d.unit]); }
export function portMembers(p: a.PortUsage): a.PortMember[] { return p.definition?.ref?.members ?? p.members; }
export function direction(p: a.PortUsage, m: a.PortMember): 'provides' | 'requires' { return p.reversed ? m.direction === 'provides' ? 'requires' : 'provides' : m.direction; }
export function endpoint(c: Structure, path: string): {
    port: a.PortUsage;
    structure: Structure;
    child: boolean;
    path: string;
} | undefined {
    const parts = path.split('.');
    let structure = c;
    if (parts.length === 2) {
        const match = /^(.+?)(?:\[(\d+)\])?$/.exec(parts[0]);
        const child = match && members(c).filter(a.isComponentUsage).find(x => x.name === match[1]);
        if (!child || (child.size !== undefined ? match![2] === undefined || Number(match![2]) >= child.size : match![2] !== undefined))
            return undefined;
        structure = child;
    }
    else if (parts.length !== 1)
        return undefined;
    const port = members(structure).filter(a.isPortUsage).find(x => x.name === parts.at(-1));
    return port && { port, structure, child: parts.length === 2, path };
}
export function memberEndpoint(c: Structure, path: string): {
    port: a.PortUsage;
    member: a.PortMember;
} | undefined {
    const [p, m, extra] = path.split('.');
    if (extra)
        return undefined;
    const port = members(c).filter(a.isPortUsage).find(x => x.name === p);
    const member = port && portMembers(port).find(x => x.name === m);
    return port && member ? { port, member } : undefined;
}
export function compatibility(left: a.PortUsage, right: a.PortUsage, forwarding = false): string[] {
    const errors: string[] = [];
    const check = (requiredPort: a.PortUsage, providedPort: a.PortUsage) => {
        for (const r of portMembers(requiredPort)) {
            if (direction(requiredPort, r) !== 'requires')
                continue;
            const p = portMembers(providedPort).find(x => x.name === r.name);
            const expected = forwarding ? 'requires' : 'provides';
            if (!p || direction(providedPort, p) !== expected || p.kind !== r.kind) {
                errors.push(`${providedPort.name}.${r.name}: missing ${expected} ${r.kind}`);
                continue;
            }
            if (r.kind === 'attribute' && !assignable(typeKey(p.type), typeKey(r.type)))
                errors.push(`${r.name}: attribute payload is incompatible`);
            if (r.kind !== 'attribute') {
                if (r.parameters.length !== p.parameters.length)
                    errors.push(`${r.name}: parameter count differs`);
                else
                    r.parameters.forEach((v, i) => { const q = p.parameters[i]; if ((v.direction ?? 'in') !== (q.direction ?? 'in') || !(r.kind === 'operation' && v.direction !== 'out' ? assignable(typeKey(v.type), typeKey(q.type)) : assignable(typeKey(q.type), typeKey(v.type))))
                        errors.push(`${r.name}: parameter ${i + 1} is incompatible`); });
                if (r.kind === 'operation' && !assignable(typeKey(p.result), typeKey(r.result)))
                    errors.push(`${r.name}: result is incompatible`);
            }
        }
    };
    if (!forwarding) {
        check(left, right);
        check(right, left);
    }
    else {
        for (const m of portMembers(left)) {
            const n = portMembers(right).find(x => x.name === m.name);
            if (!n || n.kind !== m.kind || direction(left, m) !== direction(right, n))
                errors.push(`${m.name}: forwarding needs the same member direction and kind`);
            else {
                const provided = direction(left, m) === 'provides';
                if (m.kind === 'attribute' && !assignable(typeKey(provided ? n.type : m.type), typeKey(provided ? m.type : n.type)))
                    errors.push(`${m.name}: incompatible forwarded attribute`);
                if(m.kind!=='attribute'){if(m.parameters.length!==n.parameters.length)errors.push(m.name+': incompatible forwarded parameter count');else m.parameters.forEach((p,i)=>{const q=n.parameters[i],out=p.direction==='out',from=m.kind==='operation'?(provided!==out?p:q):(provided?q:p),to=from===p?q:p;if((p.direction??'in')!==(q.direction??'in')||!assignable(typeKey(from.type),typeKey(to.type)))errors.push(m.name+': incompatible forwarded parameter '+(i+1));});if(m.kind==='operation'&&!assignable(typeKey(provided?n.result:m.result),typeKey(provided?m.result:n.result)))errors.push(m.name+': incompatible forwarded result');}
            }
        }
        for (const n of portMembers(right))
            if (direction(right, n) === 'requires' && !portMembers(left).some(m => m.name === n.name))
                errors.push(`${n.name}: child requirement is absent from boundary`);
    }
    return errors;
}
export type Policy = {
    delivery: string;
    ordering: string;
    capacity: number;
    overflow: string;
    requestTimeout: number;
    maxLatency?: number;
    maxAge?: number;
};
export const defaultPolicy: Policy = { delivery: 'atMostOnce', ordering: 'fifo', capacity: 16, overflow: 'reject', requestTimeout: 1000000000 };
export function effectiveQos(c?: a.Connect | a.QosPolicy): Policy {
    const q = a.isConnect(c) ? c.policy?.ref : c;
    if (!q)
        return { ...defaultPolicy };
    const result: any = {};
    for (const s of q.settings)
        result[s.name] = s.duration ? nanos(s.duration) : a.isReferenceExpression(s.value) ? s.value.path.split('.').at(-1) : a.isLiteral(s.value) ? s.value.number ?? s.value.text : undefined;
    return result;
}
export type Effect = {
    reads: boolean;
    writes: boolean;
    communicates: boolean;
    suspends: boolean;
};
export function effects(op: Executable, c?: Structure, seen = new Set<Executable>()): Effect {
    // Package definitions have no caller-owned state, including when a parameter
    // happens to share an attribute's name at a call site.
    if (!container(body(op) ?? op))
        c = undefined;
    const result: Effect = { reads: false, writes: false, communicates: false, suspends: false };
    if (seen.has(op))
        return result;
    seen.add(op);
    const b = body(op);
    if (!b)
        return result;
    const attributes = new Set(c ? members(c).filter(a.isAttribute).map(x => x.name) : []);
    const contents = nodes(b).filter(n => owner(n, isExecutable) === (op.body ? op : signature(op)));
    for (const n of contents) {
        if (a.isReferenceExpression(n) && attributes.has(n.path.split('.')[0]))
            result.reads = true;
        if (a.isAssign(n) && attributes.has(n.target))
            result.writes = true;
        if (a.isSend(n))
            result.communicates = true;
        if (a.isWait(n) || a.isReceive(n) || a.isTransition(n) || a.isInterruptible(n))
            result.suspends = true;
        if (a.isCallExpression(n)) {
            if (n.target.includes('.')) {
                result.communicates = true;
                result.suspends = true;
                const ep = c && memberEndpoint(c, n.target);
                if (ep?.member.parameters.some((p, i) => p.direction === 'out' && a.isReferenceExpression(n.args[i]) && attributes.has((n.args[i] as a.ReferenceExpression).path)))
                    result.writes = true;
            }
            else {
                const model = AstUtils.getDocument(n).parseResult.value as a.Model;
                const target = localOperation(n, n.target, c) ?? resolve(n, n.target, workspaceModels.get(model) ?? [model]);
                const called = target && isExecutable(target) ? target : undefined;
                if (called && signature(called)?.parameters.some((p, i) => p.direction === 'out' && a.isReferenceExpression(n.args[i]) && attributes.has((n.args[i] as a.ReferenceExpression).path)))
                    result.writes = true;
                if (called) {
                    const e = effects(called, c, new Set(seen));
                    for (const k of Object.keys(result) as (keyof Effect)[])
                        result[k] ||= e[k];
                }
            }
        }
    }
    return result;
}
export const OCCURRENCE_LIMIT = 10000;
export function occurrenceCount(c: Structure, seen = new Set<Structure>()): number { const def = a.isComponentUsage(c) ? c.definition?.ref ?? c : c; if (seen.has(def))
    return 0; let count = 1; for (const child of members(c).filter(a.isComponentUsage)) {
    count += (child.size ?? 1) * occurrenceCount(child, new Set([...seen, def]));
    if (count > OCCURRENCE_LIMIT || !Number.isSafeInteger(count))
        return OCCURRENCE_LIMIT + 1;
} return count; }
export type Occurrence = {
    path: string;
    structure: Structure;
    definition: Structure;
    parent?: string;
};
export function occurrences(root: Structure, prefix = root.name, seen = new Set<Structure>()): Occurrence[] {
    if (!seen.size && occurrenceCount(root) > OCCURRENCE_LIMIT)
        throw new Error('Reference occurrence limit exceeded');
    const def = a.isComponentUsage(root) ? root.definition?.ref ?? root : root;
    if (seen.has(def))
        return [];
    const out: Occurrence[] = [{ path: prefix, structure: root, definition: def }];
    const next = new Set([...seen, def]);
    for (const ch of members(root).filter(a.isComponentUsage))
        for (let i = 0; i < (ch.size ?? 1); i++) {
            const path = `${prefix}.${ch.name}${ch.size !== undefined ? `[${i}]` : ''}`;
            const children = occurrences(ch, path, next);
            if (children[0])
                children[0].parent = prefix;
            out.push(...children);
        }
    return out;
}
export function isNode(c: Structure, seen = new Set<Structure>()): boolean {
    if (seen.has(c))
        return false;
    seen.add(c);
    if (identity(c) === 'Swaml::Platform::Node')
        return true;
    const base = a.isComponentDef(c) ? c.specializes?.ref : c.definition?.ref;
    return !!base && isNode(base, seen);
}

/** Top-level component occurrences of a package: the roots its connections, cases and runs use. */
export function packageOccurrences(p: a.Package): a.ComponentUsage[] { return p.elements.filter(a.isComponentUsage); }
/** A package connection end: a port of a top-level component occurrence declared in the same package. */
export function packageEndpoint(p: a.Package, path: string): {
    port: a.PortUsage;
    structure: a.ComponentUsage;
    path: string;
} | undefined {
    const parts = path.split('.');
    if (parts.length !== 2)
        return undefined;
    const structure = packageOccurrences(p).find(x => x.name === parts[0]), port = structure && members(structure).filter(a.isPortUsage).find(x => x.name === parts[1]);
    return structure && port ? { port, structure, path } : undefined;
}
/**
 * Effective occurrence routes of one root, or of a whole package: every top-level occurrence
 * with its internal connections plus the package connections between top-level ports.
 * Forwarding aliases resolve each end to its leaf port.
 */
export function connectionRoutes(scope: Structure | a.Package) {
    const roots = a.isPackage(scope) ? packageOccurrences(scope).filter(r => occurrenceCount(r) <= OCCURRENCE_LIMIT) : [scope];
    const occ = roots.flatMap(r => occurrences(r)), aliases = new Map<string, string>(), links: {
        node: a.Connect;
        id: string;
        /** The occurrence path that owns the connection; undefined for a package connection. */
        owner?: string;
        ends: string[];
    }[] = [];
    for (const o of occ)
        for (const link of members(o.structure).filter(a.isConnect)) {
            const l = endpoint(o.structure, link.source), r = endpoint(o.structure, link.target);
            if (!l || !r)
                continue;
            const paths = [o.path + '.' + link.source, o.path + '.' + link.target];
            if (l.child !== r.child)
                aliases.set(paths[l.child ? 1 : 0], paths[l.child ? 0 : 1]);
            else
                links.push({ node: link, id: o.path + '.' + (link.name ?? '@' + links.length), owner: o.path, ends: paths });
        }
    if (a.isPackage(scope))
        scope.connections.forEach((link, i) => {
            if (packageEndpoint(scope, link.source) && packageEndpoint(scope, link.target))
                links.push({ node: link, id: link.name ?? '@package' + i, ends: [link.source, link.target] });
        });
    const leaf = (path: string) => { const seen = new Set<string>(); while (aliases.has(path) && !seen.has(path)) {
        seen.add(path);
        path = aliases.get(path)!;
    } return path; };
    for (const link of links)
        link.ends = link.ends.map(leaf);
    return { occurrences: occ, links, leaf };
}
/**
 * A component is interface-only when its effective members include ports but no operations,
 * schedule entries or parts. It needs no implementation; only a case acts through its ports.
 */
export function interfaceOnly(c: Structure): boolean {
    const effective = members(c);
    return effective.some(a.isPortUsage) && !effective.some(m => isExecutable(m) || a.isComponentUsage(m)) && !schedule(c).length;
}
/** A case's subject is the top-level occurrence named after of; a case without of has none. */
export function caseSubject(s: a.Scenario): a.ComponentUsage | undefined { return s.subject?.ref; }
/**
 * The component a satisfy claim names: a component definition or top-level occurrence declared
 * in the package, optionally followed by nested parts such as Workbench.editor or cells[1].
 */
export function designComponent(p: a.Package, path: string): Structure | undefined {
    const [head, ...tail] = path.split('.');
    let current: Structure | undefined = p.elements.find((e): e is Structure => (a.isComponentDef(e) || a.isComponentUsage(e)) && e.name === head);
    for (const part of tail) {
        const match = /^(.+?)(?:\[(\d+)\])?$/.exec(part)!, child: a.ComponentUsage | undefined = current && members(current).filter(a.isComponentUsage).find(x => x.name === match[1]);
        if (!child || match[2] !== undefined && (child.size === undefined || Number(match[2]) >= child.size))
            return undefined;
        current = child;
    }
    return current;
}
/** A run target: a whole package context, or one top-level component alone with its ports open. */
export type RunTarget = {
    kind: 'package' | 'component';
    /** The package name, or the component occurrence identity such as Banking::atm. */
    identity: string;
    package: a.Package;
    /** The executed top-level occurrences in declaration order. */
    roots: a.ComponentUsage[];
};
/**
 * The software roots of a package run: its top-level component occurrences except platform roots,
 * which only describe deployment targets.
 */
export function softwareRoots(p: a.Package): a.ComponentUsage[] { return packageOccurrences(p).filter(r => !isNode(r)); }
/** Every run target of a workspace: each package with software roots, then each software root alone. */
export function runTargets(models: readonly a.Model[]): RunTarget[] {
    const packages = models.flatMap(m => m.packages).filter(p => AstUtils.getDocument(p).uri.scheme !== 'builtin');
    return [
        ...packages.filter(p => softwareRoots(p).length).map(p => ({ kind: 'package' as const, identity: p.name, package: p, roots: softwareRoots(p) })),
        ...packages.flatMap(p => softwareRoots(p).map(r => ({ kind: 'component' as const, identity: identity(r), package: p, roots: [r] })))
    ];
}
/**
 * Resolves Package or Package::component. A package name wins only when no component has the
 * same identity; a name that selects both is ambiguous.
 */
export function runTarget(models: readonly a.Model[], name: string): RunTarget {
    const matches = runTargets(models).filter(t => t.identity === name);
    if (matches.length > 1)
        throw new Error(`Ambiguous run target ${name}: it names both a package and a component.`);
    if (!matches[0])
        throw new Error(`Unknown run target ${name}; select a package or Package::component, a top-level software component occurrence.`);
    return matches[0];
}
// States and transitions have identities of their own, for state waits, reactions and guards.
const statementSlot = (n: AstNode) => n.$containerProperty === 'statements' || a.isState(n) || a.isTransition(n) || a.isFor(n.$container) && (n.$containerProperty === 'initializer' || n.$containerProperty === 'update');
const statementOwner = (n: AstNode) => isExecutable(n) || a.isScenario(n);
/**
 * Stable source identity of the statement or schedule entry that contains a node.
 *
 * A statement is written <executable identity>/<statement path>, for example
 * Hello::Sender.emit/0 or Shop::Desk.serve/2/then/0. The executable identity is the declaring
 * operation, or a case, with decoded names. The path walks the abstract syntax from that
 * executable's body: a statement contributes its index in the enclosing statement list, and every
 * other step contributes its slot name, followed by an index for list slots (then, otherwise, body,
 * branches/N, timeoutBody, handler, initializer, update, states/N, actions/N, transitions/N, effect).
 * A state is itself identified as <executable>/states/N and a transition, including its guard, as
 * <executable>/states/N/transitions/M. A schedule entry is written <component identity>/schedule/N with N counting the entries the
 * component declares. Identities follow source structure, so an edit that reorders statements
 * changes them; resolveStatement maps an identity back to its node.
 */
export function statementIdentity(n: AstNode): string | undefined {
    const entry = a.isScheduleEntry(n) ? n : owner(n, a.isScheduleEntry);
    if (entry) {
        const c = container(entry);
        return c && `${identity(c)}/schedule/${c.members.filter(a.isSchedule).flatMap(s => s.entries).indexOf(entry)}`;
    }
    let s: AstNode | undefined = n;
    while (s && !statementSlot(s)) {
        if (statementOwner(s))
            return undefined;
        s = s.$container;
    }
    if (!s)
        return undefined;
    const path: string[] = [];
    let x: AstNode = s;
    for (; x.$container && !statementOwner(x); x = x.$container) {
        if (a.isOperationBody(x) && isExecutable(x.$container))
            continue;
        if (x.$containerProperty === 'statements')
            path.unshift(String(x.$containerIndex));
        else
            path.unshift(...(x.$containerIndex === undefined ? [x.$containerProperty!] : [x.$containerProperty!, String(x.$containerIndex)]));
    }
    return statementOwner(x) ? `${identity(x)}/${path.join('/')}` : undefined;
}
/** The statement or schedule entry a statement identity names, or undefined when none does. */
export function resolveStatement(models: readonly a.Model[], source: string): AstNode | undefined {
    // A quoted name may itself contain '/', so try every declared owner whose identity prefixes the source, longest first.
    const owners = models.flatMap(m => nodes(m)).filter(n => statementOwner(n) || a.isComponentDef(n) || a.isComponentUsage(n)).map(n => ({ n, id: identity(n) })).filter(o => source.startsWith(o.id + '/')).sort((x, y) => y.id.length - x.id.length);
    for (const { n, id } of owners) {
        const segments = source.slice(id.length + 1).split('/');
        if (!statementOwner(n)) {
            const entries = (n as Structure).members.filter(a.isSchedule).flatMap(s => s.entries);
            if (segments.length === 2 && segments[0] === 'schedule' && /^\d+$/.test(segments[1]) && entries[Number(segments[1])])
                return entries[Number(segments[1])];
            continue;
        }
        let x: Node | undefined = (isExecutable(n) ? n.body : n) as Node | undefined;
        for (let i = 0; x && i < segments.length; i++) {
            const segment = segments[i];
            const value = /^\d+$/.test(segment) ? x.statements?.[Number(segment)] : x[segment];
            x = Array.isArray(value) ? /^\d+$/.test(segments[i + 1] ?? '') ? value[Number(segments[++i])] : undefined : value;
            if (x !== undefined && (typeof x !== 'object' || !('$type' in x)))
                x = undefined;
        }
        if (x && statementIdentity(x) === source)
            return x;
    }
    return undefined;
}
