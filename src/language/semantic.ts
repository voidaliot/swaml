import type { AstNode } from 'langium';
import * as a from './generated/ast.js';
import { owner } from './swaml-scope.js';

export type Container = a.Component | a.RootComponent | a.Unit;
export function members(c: Container): AstNode[] { return a.isRootComponent(c) && c.definition?.ref ? [...c.definition.ref.members, ...c.members] : c.members; }
export function named(c: Container, name: string): AstNode | undefined {
    return members(c).find(n => 'name' in n && n.name === name);
}
export function container(n: AstNode): Container | undefined {
    return owner(n, (x): x is Container => a.isUnit(x) || a.isComponent(x) || a.isRootComponent(x));
}
export function resolvePath(c: Container, path: string): AstNode | undefined {
    const segments = path.split('.');
    let found: AstNode | undefined = c;
    for (const segment of segments) {
        if (found && a.isInstance(found)) found = found.definition.ref;
        if (found && (a.isUnit(found) || a.isComponent(found) || a.isRootComponent(found))) found = named(found, segment);
        else if (found && a.isPort(found)) found = found.interface.ref?.members.find(m => m.name === segment);
        else return undefined;
    }
    return found;
}
export function endpoint(n: AstNode, path: string): { port: a.Port; member: a.InterfaceMember } | undefined {
    const unit = owner(n, a.isUnit);
    const parts = path.split('.');
    if (!unit || parts.length !== 2) return undefined;
    const port = named(unit, parts[0]);
    if (!port || !a.isPort(port)) return undefined;
    const member = port.interface.ref?.members.find(m => m.name === parts[1]);
    return member ? { port, member } : undefined;
}
export function typeKey(t: a.TypeRef | undefined): string {
    if (!t) return 'Void';
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
