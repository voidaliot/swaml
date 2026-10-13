import type { AstNode } from 'langium';
import * as a from './generated/ast.js';
import { owner } from './swaml-scope.js';

export type Container = a.Component | a.System | a.Unit;
export function members(c: Container): AstNode[] { return c.members; }
export function named(c: Container, name: string): AstNode | undefined {
    return members(c).find(n => 'name' in n && n.name === name);
}
export function container(n: AstNode): Container | undefined {
    return owner(n, (x): x is Container => a.isUnit(x) || a.isComponent(x) || a.isSystem(x));
}
export function resolvePath(c: Container, path: string): AstNode | undefined {
    const segments = path.split('.');
    let found: AstNode | undefined = c;
    for (const segment of segments) {
        if (found && a.isInstance(found)) found = found.definition.ref;
        if (found && (a.isUnit(found) || a.isComponent(found) || a.isSystem(found))) found = named(found, segment);
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
    if (!t) return '?';
    const d = t.type?.ref;
    return (t.primitive ?? (d ? `${owner(d, a.isPackage)?.name}::${d.name}` : '?')) + (t.size !== undefined ? `[${t.size}]` : '');
}
export function nanos(d: a.Duration): number {
    return d.value * ({ ns: 1, us: 1000, ms: 1000000, s: 1000000000 }[d.unit]);
}
