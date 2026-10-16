import type { AstNode } from 'langium';
import * as a from './generated/ast.js';
import { owner } from './swaml-scope.js';

export type Container = a.Component | a.RootComponent;
/** Reusing a policy shares only its declared values; connectors retain their own queues. */
export function effectiveQos(qos: a.Qos | undefined): a.QosBody | undefined {
    return qos?.body ?? qos?.policy?.ref?.body;
}
/** Inheritance creates effective features, never a shared runtime instance/store. */
export function members(c: Container, seen = new Set<a.Component>()): AstNode[] {
    if (a.isRootComponent(c)) return c.definition?.ref ? [...members(c.definition.ref, seen), ...c.members] : c.members;
    if (seen.has(c)) return [];
    const next = new Set(seen).add(c);
    const inherited = c.specializes?.ref ? members(c.specializes.ref, next) : [];
    const key = (n: AstNode) => a.isDelegate(n) ? `delegate:${n.outer.$refText}` : 'name' in n ? `name:${n.name}` : undefined;
    const replacements = new Set(c.members.map(key));
    return [...inherited.filter(n => !replacements.has(key(n))), ...c.members];
}
export function specializes(component: a.Component, base: a.Component): boolean {
    const seen = new Set<a.Component>();
    let current: a.Component | undefined = component;
    while (current && !seen.has(current)) {
        if (current === base) return true;
        seen.add(current); current = current.specializes?.ref;
    }
    return false;
}
/** Resolve inherited helper references in the concrete component context. */
export function effectiveFunction(fn: a.FunctionDef, c: Container): a.FunctionDef {
    const found = named(c, fn.name); return found && a.isFunctionDef(found) ? found : fn;
}
export function named(c: Container, name: string): AstNode | undefined {
    return members(c).find(n => 'name' in n && n.name === name);
}
export function container(n: AstNode): Container | undefined {
    return owner(n, (x): x is Container => a.isComponent(x) || a.isRootComponent(x));
}
export function resolvePath(c: Container, path: string): AstNode | undefined {
    const segments = path.split('.');
    let found: AstNode | undefined = c;
    for (const segment of segments) {
        if (found && a.isInstance(found)) found = found.definition.ref;
        if (found && (a.isComponent(found) || a.isRootComponent(found))) found = named(found, segment);
        else if (found && a.isPort(found)) found = found.interface.ref?.members.find(m => m.name === segment);
        else return undefined;
    }
    return found;
}
export function endpoint(n: AstNode, path: string, context = container(n)): { port: a.Port; member: a.InterfaceMember } | undefined {
    const parts = path.split('.');
    if (!context || parts.length !== 2) return undefined;
    const port = named(context, parts[0]);
    if (!port || !a.isPort(port)) return undefined;
    const member = port.interface.ref?.members.find(m => m.name === parts[1]);
    return member ? { port, member } : undefined;
}
export function isIntegralType(type: string): boolean { return ['byte', 'uint', 'int'].includes(type); }
export function isNumericType(type: string): boolean { return isIntegralType(type) || type === 'real'; }
/** Integral narrowing is checked against the target range when evaluating values. */
export function numericAssignable(actual: string, expected: string): boolean {
    return isIntegralType(actual) && isNumericType(expected);
}
export function integralInRange(value: number, type: string): boolean {
    return Number.isSafeInteger(value) && (type !== 'uint' || value >= 0) && (type !== 'byte' || (value >= 0 && value <= 255));
}
export function typeKey(t: a.TypeRef | undefined): string {
    if (!t) return 'void';
    const d = t.type?.ref;
    return (t.primitive ?? (d ? `${owner(d, a.isPackage)?.name}::${d.name}` : '?')) + (t.size !== undefined ? `[${t.size}]` : '');
}
export function nanos(d: a.Duration): number {
    return d.value * ({ ns: 1, us: 1000, ms: 1000000, s: 1000000000 }[d.unit]);
}

/** Resolve nominal enum syntax only when an unqualified lexical value does not shadow it.
 * Namespace ambiguity considers every declaration kind, exactly like ordinary references.
 * The literal is returned even when absent so callers can report the stable SW027 diagnostic.
 */
export function resolveEnumLiteral(expression: a.ReferenceExpression, models: readonly a.Model[], locals?: { has(name: string): boolean }): { type: a.EnumType; literal: string } | undefined {
    const parts = expression.path.split('.');
    if (parts.length !== 2 || locals?.has(parts[0])) return undefined;
    const [name, literal] = parts;
    const pkg = owner(expression, a.isPackage);
    const qualified = name.includes('::');
    const candidates = models.flatMap(model => model.packages.flatMap(p => p.elements.filter(e => qualified
        ? `${p.name}::${e.name}` === name
        : (p === pkg || pkg?.imports.some(i => i.namespace === p.name)) && e.name === name)));
    return candidates.length === 1 && a.isEnumType(candidates[0]) ? { type: candidates[0], literal } : undefined;
}
