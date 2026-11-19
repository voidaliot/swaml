import { AstUtils, CstUtils, type AstNode, type Reference } from 'langium';
import { decodeQuotedName, formatName, type NameEdition } from './names.js';
import * as a from './generated/ast.js';
import { STANDARD_LIBRARY, STANDARD_LIBRARY_3_0 } from './standard-library.js';
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
/** The (trigger, operation) identity of a schedule entry, for inheritance replacement and duplicates (WP4-S07, WP4-M04). */
export function entryKey(e: a.ScheduleEntry): string { return `${e.kind}:${triggerIdentity(e)}:${e.operation}`; }
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
/** The states of an operation's own body (not of nested operations), parents before their inner states, in source order (SIF-G01). */
export function flowStates(op: Executable): a.StateStep[] {
    const b = body(op);
    if (!b)
        return [];
    const out: a.StateStep[] = [];
    const visit = (n: AstNode) => {
        for (const x of AstUtils.streamContents(n)) {
            if (isExecutable(x))
                continue;
            if (a.isStateStep(x))
                out.push(x);
            visit(x);
        }
    };
    visit(b);
    return out;
}
/** An operation with states (SIF-S01): an operation whose body contains a state statement. */
export function isStateful(op: Executable): boolean { return flowStates(op).length > 0; }
/** What a statement standing in a state reads (SIF-R07, SIF-R08): see statementReads. */
export type StatementReads = { attributes: Set<string>; cells: Set<string>; names: Set<string> };
/**
 * What a statement standing in a state reads, directly or through the operations it calls, resolved in the effective
 * structure c (a specialization's or a usage's redefinition replaces the base operation, SIF-R07):
 * - attributes: the attributes of c it reads that no visible local, parameter or binding hides;
 * - cells: the sample cells, as port|member, of its sampled reads (a binding or parameter named like the port hides it);
 * - names: every name it reads, the locals of the flow included, for the own-write re-look (SIF-R08); inside a called
 *   operation only its attribute reads count, since its own locals and parameters are not the machine's.
 * A remote call (a request through a port) reads nothing of c.
 */
export function statementReads(item: AstNode, c: Structure): StatementReads {
    const out: StatementReads = { attributes: new Set(), cells: new Set(), names: new Set() };
    const attributes = new Set(members(c).filter(a.isAttribute).map(x => x.name)), visited = new Set<AstNode>();
    const visit = (root: AstNode, own: boolean) => {
        for (const n of AstUtils.streamAst(root)) {
            if (a.isReferenceExpression(n)) {
                const head = (n.path ?? '').split('.')[0];
                if (!head)
                    continue;
                if (own)
                    out.names.add(head);
                if (localVisible(n, head))
                    continue;
                if (attributes.has(head)) {
                    out.attributes.add(head);
                    out.names.add(head);
                    continue;
                }
                const sampled = sampledReadForm(n, c);
                if (sampled)
                    out.cells.add(`${sampled.port.name}|${sampled.member.name}`);
            }
            else if (a.isCallExpression(n) && n.target && !n.target.includes('.')) {
                const op = localOperation(n, n.target, c), b = op && isExecutable(op) ? body(op) : undefined;
                if (b && !visited.has(b)) {
                    visited.add(b);
                    visit(b, false);
                }
            }
        }
    };
    visit(item, true);
    return out;
}
/** A state's inner states: the states standing in its braces (SIF-S03). */
export const innerStates = (s: a.StateStep): a.StateStep[] => s.statements.filter(a.isStateStep);
/** A state's items: everything in its braces before (and, in an invalid text, between) its inner states (SIF-S03). */
export const stateItems = (s: a.StateStep): Exclude<a.StateMember, a.StateStep>[] => s.statements.filter((x): x is Exclude<a.StateMember, a.StateStep> => !a.isStateStep(x));
/** A body written without braces (SIF-S08): only the concrete syntax tells it apart from { exit; } or { to S; }. */
export const isShortBody = (b: a.Block): boolean => !!b.$cstNode && !b.$cstNode.text.startsWith('{');
export const isExecutable = (n: AstNode): n is Executable => a.isOperation(n) || a.isOperationUsage(n);
/**
 * The host intrinsics of the 3.0 library packages (WP3-L01, WP3-L02, WP3-L03, WP3-M01): operation defs of the
 * built-in document swaml-3.0.swaml whose bodies are documentation only. A host evaluates them (chapter 6).
 * Swaml::Math keeps its 2.2 intrinsics and their handling unchanged (WP3-L04).
 */
export const LIBRARY_INTRINSICS: Readonly<Record<string, 'sqrt' | 'intText' | 'realText' | 'now'>> = { 'Swaml::Numeric::sqrt': 'sqrt', 'Swaml::Text::intText': 'intText', 'Swaml::Text::realText': 'realText', 'Swaml::Time::now': 'now' };
export type LibraryIntrinsic = 'sqrt' | 'intText' | 'realText' | 'now';
/** The URI of the built-in document of the 3.0 library packages (WP3-M01). */
export const LIBRARY_3_0_URI = 'builtin:/swaml-3.0.swaml';
const libraryText = (text: string) => text.replace(/^﻿/u, '').replaceAll('\r\n', '\n').replace(/\s+$/u, '');
const LIBRARY_TEXTS = [libraryText(STANDARD_LIBRARY), libraryText(STANDARD_LIBRARY_3_0)];
const LIBRARY_COPY_MIN = Math.min(...LIBRARY_TEXTS.map(t => t.length)), LIBRARY_COPY_MAX = 2 * Math.max(...LIBRARY_TEXTS.map(t => t.length)) + 4096;
/**
 * Whether text is a copy of a built-in library document, 2.2 or 3.0. Only a leading byte order mark, line ends and
 * whitespace at the end of the file may differ; any other change makes it user source. A text whose length rules
 * out a copy is never normalized.
 */
export const isLibraryCopy = (text: string): boolean => {
    if (text.length < LIBRARY_COPY_MIN || text.length > LIBRARY_COPY_MAX)
        return false;
    const t = libraryText(text);
    return t === LIBRARY_TEXTS[0] || t === LIBRARY_TEXTS[1];
};
/** Copy detection per text document, recomputed only when its version or text changes (WP3 review R4). */
const copies = new WeakMap<object, { version: number; text: string; copy: boolean }>();
export function isLibraryCopyDocument(document: { uri: { scheme: string }; textDocument: { version: number; getText(): string } }): boolean {
    if (document.uri.scheme === 'builtin')
        return false;
    const text = document.textDocument.getText(), known = copies.get(document.textDocument);
    if (known && known.version === document.textDocument.version && known.text === text)
        return known.copy;
    const copy = isLibraryCopy(text);
    copies.set(document.textDocument, { version: document.textDocument.version, text, copy });
    return copy;
}
/**
 * A declared intrinsic of the 3.0 library, in the built-in document or a byte-equal copy of it: its body is
 * documentation only, so the return-path and package-definition checks exempt it by identity, as they exempt
 * Swaml::Math (WP3-M01). Only the built-in declaration is evaluated (libraryIntrinsic).
 */
export function declaredIntrinsic(op: AstNode | undefined): boolean {
    if (op && a.isOperationUsage(op))
        return !op.body && declaredIntrinsic(op.definition?.ref);
    if (!op ||!a.isOperation(op) || !op.definition || !a.isPackage(op.$container) || !Object.hasOwn(LIBRARY_INTRINSICS, identity(op)))
        return false;
    const document = AstUtils.getDocument(op);
    return document.uri.scheme === 'builtin' || isLibraryCopyDocument(document);
}
/** The 3.0 host intrinsic op is, if any: only the built-in library's declaration counts, never a same-named user operation. */
export function libraryIntrinsic(op: AstNode | undefined): LibraryIntrinsic | undefined {
    // A usage of an intrinsic definition without its own body is that intrinsic; a usage body replaces it.
    if (op && a.isOperationUsage(op))
        return op.body ? undefined : libraryIntrinsic(op.definition?.ref);
    if (!op || !a.isOperation(op) || !op.definition || !a.isPackage(op.$container) || !Object.hasOwn(LIBRARY_INTRINSICS, identity(op)))
        return undefined;
    return AstUtils.getDocument(op).uri.scheme === 'builtin' ? LIBRARY_INTRINSICS[identity(op)] : undefined;
}
/**
 * Swaml::Time::now, the logical clock (WP3-L03). Its effect class is reads state (WP3-S01): it is rejected in
 * attribute and member initializers (SW2006, WP3-D01) and never reported as a stale read (WP3-S02).
 * Hook for WP4-S05 (the constant sublanguage) and WP5-S03 (completion guards): both reject a call for which
 * this is true.
 */
export const isClockRead = (op: AstNode | undefined): boolean => libraryIntrinsic(op) === 'now';
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
/**
 * The type of a conditional expression (WP2-S02): the common type of its branches under scalar widening
 * byte, uint, int, real; any other types (bool, string, records, enums, arrays) must be identical. Undefined
 * when the branches have no common type. An unknown branch type ('?') yields the other branch's type.
 */
export function conditionalType(then: string, otherwise: string): string | undefined {
    if (then === '?' || then === otherwise)
        return otherwise;
    if (otherwise === '?')
        return then;
    const order = ['byte', 'uint', 'int', 'real'];
    return numeric(then) && numeric(otherwise) ? order[Math.max(order.indexOf(then), order.indexOf(otherwise))] : undefined;
}
/**
 * The value of an integer literal, optionally negated, as the 2.2 type and index rules fold it. A duration literal
 * folds to its nanoseconds (WP4-S01); no 2.2 source has one in an expression. This is not the constant sublanguage
 * of periods and deadlines, which constantValue evaluates (WP4-M02): this fold stays literal-only so that the 2.2
 * rules that use it keep their diagnostics.
 */
export function constantNumber(e?: a.Expression): number | undefined {
    if (a.isLiteral(e))
        return e.duration ? nanos(e.duration) : e.number;
    if (a.isUnaryExpression(e) && e.operator === '-') {
        const n = constantNumber(e.operand);
        return n === undefined ? undefined : -n;
    }
    return undefined;
}
export function nanos(d: a.Duration): number { return d.value * ({ ns: 1, us: 1000, ms: 1000000, s: 1000000000 }[d.unit]); }
/**
 * The duration literal of a policy setting written in its 2.2 form, such as requestTimeout = 1s; (WP4-M01). Since
 * 3.0 a setting has the single form name = Expression; (WP4-G01), so a 2.2 duration setting is Literal{duration}.
 */
export function settingDuration(s: a.PolicySetting): a.Duration | undefined { return a.isLiteral(s.value) ? s.value.duration : undefined; }
/** The keywords that the grammar also accepts as names (rule Name). */
const NAME_WORDS = new Set(['reversed', 'to', 'times', 'name', 'kind', 'path', 'use', 'case', 'test', 'associate', 'by', 'ns', 'us', 'ms', 's', 'view', 'state', 'in', 'out']);
/**
 * The canonical display text of an expression (WP4-S07): its tokens without comments or layout, integers in decimal
 * and names in canonical spelling, one space between tokens except none after ( [ . :: and none before ) ] , . ::,
 * none before the index [ of a value and the argument list ( of a call or try, and none inside a duration literal
 * (1ms). A parenthesized subexpression and an array literal are spaced like any operand: a * (b + c), [1, 2].
 * Messages and projections show this text; it keeps the unit of a literal (deadline (3ms) shows 3ms). With an
 * edition, every name is spelled for that edition instead, so a message can quote names as 2.2 does
 * (MESSAGE_SPELLING): a contextual word written unquoted in 3.0, such as view, is shown 'view'.
 */
export function displayText(e: a.Expression, edition?: NameEdition): string {
    const leaves = e.$cstNode ? CstUtils.flattenCst(e.$cstNode).filter(n => !n.hidden).toArray() : [];
    let text = '';
    leaves.forEach((leaf, i) => {
        const type = leaf.tokenType.name, word = edition !== undefined && !a.isDuration(leaf.astNode) && (type === 'ID' || type === leaf.text && NAME_WORDS.has(leaf.text));
        const image = type === 'UNRESTRICTED_NAME' ? formatName(decodeQuotedName(leaf.text), edition) : word ? formatName(leaf.text, edition) : type === 'INT' ? String(Number(leaf.text)) : leaf.text;
        const previous = leaves[i - 1];
        const glued = !previous || ['(', '[', '.', '::'].includes(previous.text) || [')', ']', ',', '.', '::'].includes(leaf.text)
            || a.isDuration(leaf.astNode) && previous.astNode === leaf.astNode
            || leaf.text === '(' && (a.isCallExpression(leaf.astNode) || a.isTryExpression(leaf.astNode))
            || leaf.text === '[' && !a.isArrayLiteral(leaf.astNode);
        text += (glued ? '' : ' ') + image;
    });
    return text;
}
/**
 * The trigger identity text of an expression (WP4-S07): a single integer or duration literal, parenthesized or not,
 * is its value in nanoseconds, so every (20ms) and every 20ms (and every 20000us) have the same identity; any other
 * expression is its display text, so every (2 * 10ms) is another trigger. Tokens stay separated by a space, so an
 * operator sequence such as a or b can never equal a name.
 */
export function expressionText(e: a.Expression): string {
    if (a.isLiteral(e) && e.duration)
        return String(nanos(e.duration));
    if (a.isLiteral(e) && e.number !== undefined && !e.$cstNode?.text.includes('.'))
        return String(e.number);
    return displayText(e);
}
/** Why an expression is not a constant duration, or why its value cannot be computed (WP4-S05, WP4-D03, WP4-D07). */
export type ConstantProblem =
    /** A call (try included); clock is true for Swaml::Time::now() (WP3-S01). */
    | { kind: 'call'; node: a.CallExpression | a.TryExpression; clock: boolean }
    /** A name that is not a const attribute of the occurrence: mutable attributes, locals, parameters, receive bindings. */
    | { kind: 'state'; node: a.ReferenceExpression }
    /** A value other than an integer, duration or boolean: array and record literals, enum literals, fields of const attributes. */
    | { kind: 'value'; node: a.Expression }
    /** A const attribute whose effective initializer refers back to itself. */
    | { kind: 'cycle'; node: a.ReferenceExpression; attribute: a.Attribute }
    /** A / whose quotient is not an exact integer, or a / or % whose divisor is zero, in this occurrence. */
    | { kind: 'division'; node: a.BinaryExpression; left: bigint; right: bigint }
    /** Operands of the wrong type, which the type rules report (SW2002). */
    | { kind: 'type'; node: a.Expression };
export type ConstantResult = { value: bigint | boolean; problem?: undefined } | { value?: undefined; problem: ConstantProblem };
/**
 * The constant sublanguage evaluator (WP4-S05, WP4-M02): the value of a period or deadline expression in one
 * expanded occurrence. Allowed are integer, duration and boolean literals; const attributes of the occurrence with
 * their effective value after redefinition (the members of the occurrence's structure), whose effective
 * initializers are themselves in the sublanguage and acyclic; unary - and not; + - * / %; comparisons; and, or; the
 * conditional; parentheses. In this sublanguage / on integers is exact integral division: a non-exact quotient or
 * a zero divisor is a problem of the occurrence. Arithmetic is exact (bigint); whether the result is a positive
 * representable duration is the caller's check (representableDuration, entryPeriod, entryDeadline). Membership
 * problems of the whole expression (both branches of a conditional and every const attribute it reaches) come
 * before value problems; within each, the first in evaluation order. The occurrence is the component usage of an
 * expanded occurrence, or a definition, whose own const attribute values a definition-level check uses.
 */
export function constantValue(e: a.Expression, occurrence: Structure): ConstantResult {
    const problem = constantMembership(e, occurrence, new Set());
    return problem ? { problem } : evaluateConstant(e, occurrence);
}
/** The const attribute a single-name reference names in the occurrence, if any. */
function constantAttribute(e: a.ReferenceExpression, occurrence: Structure): a.Attribute | undefined {
    if (e.path.includes('.') || e.index || e.selectors?.length)
        return undefined;
    const found = members(occurrence).filter(a.isAttribute).find(x => x.name === e.path);
    return found?.constant ? found : undefined;
}
function constantMembership(e: a.Expression, occurrence: Structure, visiting: Set<a.Attribute>): ConstantProblem | undefined {
    // Literals of other types (real, string) are left to the type rules (SW2002), which report them once.
    if (a.isLiteral(e))
        return undefined;
    if (a.isReferenceExpression(e)) {
        const attribute = constantAttribute(e, occurrence);
        if (!attribute) {
            const head = members(occurrence).filter(a.isAttribute).find(x => x.name === e.path.split('.')[0]);
            // A field or element of a const attribute, or an enum literal, is a value outside the sublanguage.
            return head ? head.constant ? { kind: 'value', node: e } : { kind: 'state', node: e } : e.path.includes('.') ? { kind: 'value', node: e } : { kind: 'state', node: e };
        }
        if (visiting.has(attribute))
            return { kind: 'cycle', node: e, attribute };
        visiting.add(attribute);
        const inner = constantMembership(attribute.value, occurrence, visiting);
        visiting.delete(attribute);
        return inner;
    }
    if (a.isCallExpression(e) || a.isTryExpression(e)) {
        const target = a.isCallExpression(e) ? resolveCall(e) : undefined;
        return { kind: 'call', node: e, clock: !!target && isExecutable(target) && isClockRead(target) };
    }
    if (a.isUnaryExpression(e))
        return constantMembership(e.operand, occurrence, visiting);
    if (a.isBinaryExpression(e))
        return constantMembership(e.left, occurrence, visiting) ?? constantMembership(e.right, occurrence, visiting);
    if (a.isConditionalExpression(e))
        return constantMembership(e.condition, occurrence, visiting) ?? constantMembership(e.then, occurrence, visiting) ?? constantMembership(e.otherwise, occurrence, visiting);
    return { kind: 'value', node: e };
}
/** The operation a call names, resolved as the effect analysis resolves it. */
function resolveCall(n: a.CallExpression): AstNode | undefined {
    if (n.target.includes('.'))
        return undefined;
    const model = AstUtils.getDocument(n).parseResult.value as a.Model;
    return localOperation(n, n.target, container(n)) ?? resolve(n, n.target, workspaceModels.get(model) ?? [model]);
}
function evaluateConstant(e: a.Expression, occurrence: Structure): ConstantResult {
    const type = (): ConstantResult => ({ problem: { kind: 'type', node: e } });
    if (a.isLiteral(e))
        return e.duration ? { value: BigInt(nanos(e.duration)) } : e.boolean !== undefined ? { value: e.boolean === 'true' } : e.number !== undefined && Number.isSafeInteger(e.number) ? { value: BigInt(e.number) } : type();
    if (a.isReferenceExpression(e))
        return evaluateConstant(constantAttribute(e, occurrence)!.value, occurrence);
    if (a.isUnaryExpression(e)) {
        const v = evaluateConstant(e.operand, occurrence);
        if (v.problem)
            return v;
        return e.operator === 'not' ? typeof v.value === 'boolean' ? { value: !v.value } : type() : typeof v.value === 'bigint' ? { value: -v.value } : type();
    }
    if (a.isConditionalExpression(e)) {
        const c = evaluateConstant(e.condition, occurrence);
        return c.problem ? c : typeof c.value !== 'boolean' ? type() : evaluateConstant(c.value ? e.then : e.otherwise, occurrence);
    }
    if (!a.isBinaryExpression(e))
        return type();
    const l = evaluateConstant(e.left, occurrence);
    if (l.problem)
        return l;
    const r = evaluateConstant(e.right, occurrence);
    if (r.problem)
        return r;
    const x = l.value, y = r.value, op = e.operator;
    if (op === 'and' || op === 'or')
        return typeof x === 'boolean' && typeof y === 'boolean' ? { value: op === 'and' ? x && y : x || y } : type();
    if (op === '==' || op === '!=')
        return typeof x === typeof y ? { value: (x === y) === (op === '==') } : type();
    if (typeof x !== 'bigint' || typeof y !== 'bigint')
        return type();
    if (['<', '<=', '>', '>='].includes(op))
        return { value: op === '<' ? x < y : op === '<=' ? x <= y : op === '>' ? x > y : x >= y };
    if ((op === '/' || op === '%') && (y === 0n || op === '/' && x % y !== 0n))
        return { problem: { kind: 'division', node: e, left: x, right: y } };
    return { value: op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : op === '/' ? x / y : x % y };
}
/** Whether a constant value is a duration: a positive integer number of nanoseconds that is a safe integer (WP4-S06). */
export const representableDuration = (v: bigint | boolean | undefined): v is bigint => typeof v === 'bigint' && v > 0n && v <= BigInt(Number.MAX_SAFE_INTEGER);
/**
 * The effective period of an every entry in an expanded occurrence, in nanoseconds (WP4-S04, WP4-S06, WP4-M02,
 * WP4-M03): the literal of every 20ms, or the constant value of every (e) in that occurrence. Undefined for other
 * entries and when the value is not a positive representable duration (a validation error). Consumers read
 * periods through this function rather than entry.period, which a computed period leaves undefined.
 */
export function entryPeriod(e: a.ScheduleEntry, occurrence?: Structure): number | undefined {
    if (e.period)
        return nanos(e.period);
    if (!e.periodValue || !occurrence)
        return undefined;
    const v = constantValue(e.periodValue, occurrence).value;
    return representableDuration(v) ? Number(v) : undefined;
}
/**
 * The effective deadline of an entry in an expanded occurrence, in nanoseconds (WP4-S04, WP4-M02, WP4-M03): an
 * explicit deadline wins, literal (deadline 10ms) or computed (deadline (e)); without one, the period of an every
 * entry, literal or computed; otherwise undefined. The simulator, the validator and the projection all read it
 * here, so they cannot disagree. Without an occurrence (a definition), computed parts are undefined.
 */
export function entryDeadline(e: a.ScheduleEntry, occurrence?: Structure): number | undefined {
    if (e.deadline)
        return nanos(e.deadline);
    if (e.deadlineValue) {
        if (!occurrence)
            return undefined;
        const v = constantValue(e.deadlineValue, occurrence).value;
        return representableDuration(v) ? Number(v) : undefined;
    }
    return entryPeriod(e, occurrence);
}
/**
 * The trigger identity of a schedule entry (WP4-S07, WP4-M04): its receive or call member, its after predecessor, or
 * the period of an every entry, a literal or single parenthesized literal as nanoseconds, any other expression as
 * its canonical text (expressionText). A release guard (WP7) is not part of it.
 */
export function triggerIdentity(e: a.ScheduleEntry): string {
    return e.endpoint ?? e.predecessor ?? (e.period ? String(nanos(e.period)) : e.periodValue ? expressionText(e.periodValue) : '');
}
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
        result[s.name] = settingDuration(s) ? nanos(settingDuration(s)!) : a.isReferenceExpression(s.value) ? s.value.path.split('.').at(-1) : a.isLiteral(s.value) ? s.value.number ?? s.value.text : undefined;
    return result;
}
/** The member policy of a connection for one member, if any (WP6-S05). */
export function memberPolicy(c: a.Connect, member: string): a.MemberPolicy | undefined { return c.memberPolicies.find(p => p.member !== undefined && p.member === member); }
/**
 * The effective policy of one member route (WP6-S07, WP6-R05): its member policy, else the connection policy, else
 * Swaml::Qos::Default. A connection without member policies gives every member its effectiveQos, as in 2.2.
 */
export function memberQos(c: a.Connect, member: string): Policy {
    // An unfinished member policy, such as { e: ; } while typing, has no policy reference (review F4).
    const policy = memberPolicy(c, member)?.policy?.ref;
    return policy ? effectiveQos(policy) : effectiveQos(c);
}
/**
 * An attribute member that declares an initial value (3.0 syntax) opts in to sampled reads (WP6-S01, WP6-S02; owner
 * decision A of WP6): p.m of it is the 3.0 form, with the 3.0 diagnostics. p.m of any other member, also on a port
 * where a sibling member opts in, keeps its 2.2 meaning and diagnostics, so no 2.2 source changes.
 */
export const optsIn = (m: a.PortMember | undefined): boolean => !!m && m.kind === 'attribute' && m.initial !== undefined;
/** A member that can be sampled through a port: a required attribute after reversal (WP6-S01). */
export const isSampledMember = (p: a.PortUsage, m: a.PortMember | undefined): m is a.PortMember => !!m && m.kind === 'attribute' && direction(p, m) === 'requires';
/** The effective ports of c by name, cached for one validation pass (see useEffectCache) or computed per call. */
function ownedPorts(c: Structure): Map<string, a.PortUsage> {
    const cache = effectCache?.ports, known = cache?.get(c);
    if (known)
        return known;
    const ports = new Map(members(c).filter(a.isPortUsage).map(p => [p.name, p] as const));
    cache?.set(c, ports);
    return ports;
}
/**
 * The sampled-read form p.m of a value reference in component c (WP6-S01): p is an effective port of c whose member
 * named m, in the definition that port has in c, opts in to sampling; steps are the fields, index and selectors after
 * the member. A visible local, parameter, loop variable or binding named p shadows the port (localVisible); an
 * attribute cannot share the port's name.
 */
export function sampledReadForm(e: a.ReferenceExpression, c: Structure): { port: a.PortUsage; member: a.PortMember; steps: Step[] } | undefined {
    const parts = e.path.split('.');
    if (parts.length < 2 || parts[0].includes('::'))
        return undefined;
    const port = ownedPorts(c).get(parts[0]), member = port && portMembers(port).find(m => m.name === parts[1]);
    if (!port || !member || !optsIn(member) || localVisible(e, parts[0]))
        return undefined;
    return { port, member, steps: valueSteps(e).slice(1) };
}
/** Owned ports of c that are forwarded boundaries (chapter 2.3); they are never sampled (WP6-S08). */
export function forwardedPorts(c: Structure): Set<string> {
    const result = new Set<string>();
    for (const link of members(c).filter(a.isConnect)) {
        const l = endpoint(c, link.source), r = endpoint(c, link.target);
        if (l && r && l.child !== r.child)
            result.add(l.child ? link.target : link.source);
    }
    return result;
}
/**
 * The members c samples, as port.member (WP6-S01, WP6-S04, WP6-M04): every sampled read of a required attribute, with
 * an initial value, of an owned port, in the executables of c and in the arguments and release guards of its schedule
 * entries.
 */
export function sampledMembers(c: Structure): Set<string> {
    return new Set(sampledReads(c).map(r => r.port.name + '.' + r.member.name));
}
export type SampledRead = { node: a.ReferenceExpression; port: a.PortUsage; member: a.PortMember };
/**
 * The sampled reads of required attributes in c (see sampledMembers), each with its port and member, in source order:
 * the bodies of its executables (nested operations included) and the arguments and release guards of its schedule
 * entries, which are evaluated at dispatch in the activation's first segment (WP6-R03, WP7-R01). Cached for one
 * validation pass.
 */
export function sampledReads(c: Structure): SampledRead[] {
    const cache = effectCache?.reads, known = cache?.get(c);
    if (known)
        return known;
    const result: SampledRead[] = [];
    const roots: AstNode[] = [...members(c).filter(isExecutable).flatMap(op => body(op) ? [body(op)!] : []), ...schedule(c).flatMap(e => e.guard ? [...e.args, e.guard] : e.args)];
    for (const root of roots)
        for (const n of nodes(root))
            if (a.isReferenceExpression(n)) {
                const form = sampledReadForm(n, c);
                if (form && isSampledMember(form.port, form.member))
                    result.push({ node: n, port: form.port, member: form.member });
            }
    cache?.set(c, result);
    return result;
}
/**
 * Whether a local, parameter, loop variable or input binding named name is visible at node n (chapter 1.3, WP6-S01),
 * by the scope rules the validator types with: parameters of the nearest executable (a nested operation captures no
 * enclosing local), locals declared earlier in an enclosing block, a for local in its condition, update and body, a
 * for-in element in its body, the bindings of a receive or call schedule entry in its arguments and release guard, of a receive branch
 * in its body, of an interrupt region in its handler and of a receive transition in its guard and effect.
 */
export function localVisible(n: AstNode, name: string): boolean {
    let child = n, inAction = false;
    for (let p = n.$container; p; child = p, p = p.$container) {
        if (isExecutable(p))
            return (signature(p)?.parameters ?? []).some(x => x.name === name);
        if (a.isScheduleEntry(p))
            return p.bindings.includes(name);
        // A local declared in a state's braces is a local of the look (SIF-R10): seen by its later items and by the items of its
        // inner states, not by on entry or on exit, which run outside the look.
        if (a.isStateAction(child))
            inAction = true;
        if (a.isBlock(p) || a.isOperationBody(p) || a.isScenario(p) || a.isStateStep(p) && !inAction) {
            const index = child.$containerProperty === 'statements' ? child.$containerIndex ?? 0 : 0;
            if (p.statements.slice(0, index).some(s => a.isLocalVariable(s) && s.name === name))
                return true;
        }
        else if (a.isFor(p) ? child !== p.initializer && p.initializer.name === name : a.isForEach(p) && child === p.body && p.variable.name === name)
            return true;
        else if ((a.isReceiveBranch(p) && child === p.body || a.isInterruptible(p) && child === p.handler || a.isEventLine(p) && child === p.body) && (p.bindings ?? []).includes(name))
            return true;
    }
    return false;
}
/** The endpoints c consumes input from: receive and call entries, receive branches, interrupt handlers and event lines. */
export function inputEndpoints(c: Structure): Set<string> {
    const result = new Set<string>(schedule(c).flatMap(e => e.endpoint ? [e.endpoint] : []));
    for (const op of members(c).filter(isExecutable))
        for (const n of body(op) ? nodes(body(op)!) : []) {
            if ((a.isReceiveBranch(n) || a.isInterruptible(n) || a.isEventLine(n)) && n.endpoint)
                result.add(n.endpoint);
        }
    return result;
}
export type Effect = {
    reads: boolean;
    writes: boolean;
    communicates: boolean;
    suspends: boolean;
};
/** Effects computed during one validation pass of one workspace snapshot (see useEffectCache). */
let effectCache: { models: a.Model[], byStructure: Map<Structure | undefined, Map<Executable, Effect>>, attributeNames: Map<Structure, Set<string>>, ports: Map<Structure, Map<string, a.PortUsage>>, reads: Map<Structure, SampledRead[]> } | undefined;
/** Caches effects for the models of one validation pass; a later pass or another workspace snapshot replaces it. */
export function useEffectCache(models: a.Model[]): void {
    effectCache = { models, byStructure: new Map(), attributeNames: new Map(), ports: new Map(), reads: new Map() };
}
export function effects(op: Executable, c?: Structure, seen = new Set<Executable>(), memo?: Map<Executable, Effect>, attributeNames?: Map<Structure, Set<string>>): Effect {
    // Package definitions have no caller-owned state, including when a parameter
    // happens to share an attribute's name at a call site.
    if (!container(body(op) ?? op))
        c = undefined;
    if (!memo) {
        const model = AstUtils.getDocument(op).parseResult.value as a.Model;
        if (effectCache && workspaceModels.get(model) === effectCache.models) {
            memo = effectCache.byStructure.get(c) ?? effectCache.byStructure.set(c, new Map()).get(c)!;
            attributeNames = effectCache.attributeNames;
        }
        else
            memo = new Map();
    }
    attributeNames ??= new Map();
    const result: Effect = { reads: false, writes: false, communicates: false, suspends: false };
    // seen is the current call path (a cycle is an error reported elsewhere); memo holds each operation's
    // effect once computed, so a call graph with shared callees is walked once rather than once per path.
    const known = memo.get(op);
    if (known)
        return known;
    if (seen.has(op))
        return result;
    seen.add(op);
    try {
        const attributes = !c ? new Set<string>() : attributeNames.get(c) ?? attributeNames.set(c, new Set(members(c).filter(a.isAttribute).map(x => x.name))).get(c)!;
        effectsOf(op, c, seen, memo, result, attributes, attributeNames);
    }
    finally {
        seen.delete(op);
    }
    memo.set(op, result);
    return result;
}
function effectsOf(op: Executable, c: Structure | undefined, seen: Set<Executable>, memo: Map<Executable, Effect>, result: Effect, attributes: Set<string>, attributeNames: Map<Structure, Set<string>>): void {
    // The clock has no source body to infer from: reading it reads state (WP3-S01).
    if (isClockRead(op)) {
        result.reads = true;
        return;
    }
    const b = body(op);
    if (!b)
        return;
    const contents = nodes(b).filter(n => owner(n, isExecutable) === (op.body ? op : signature(op)));
    for (const n of contents) {
        if (a.isReferenceExpression(n) && attributes.has(n.path.split('.')[0]))
            result.reads = true;
        // A sampled read reads state (WP6-S01).
        else if (a.isReferenceExpression(n) && c && n.path.includes('.') && sampledReadForm(n, c))
            result.reads = true;
        // A place assignment writes its root (WP1-S05); a place write also reads the root it updates.
        if (a.isAssign(n) && attributes.has(placeRoot(n.target))) {
            result.writes = true;
            if (isPlace(n))
                result.reads = true;
        }
        if (a.isSend(n))
            result.communicates = true;
        if (a.isWait(n) || a.isReceive(n) || a.isInterruptible(n) || a.isStateStep(n))
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
                    const e = effects(called, c, seen, memo, attributeNames);
                    for (const k of Object.keys(result) as (keyof Effect)[])
                        result[k] ||= e[k];
                }
            }
        }
    }
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
const statementSlot = (n: AstNode) => n.$containerProperty === 'statements' || a.isFor(n.$container) && (n.$containerProperty === 'initializer' || n.$containerProperty === 'update');
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
 * The If of an else if (SIF-G01) is the one statement of its ElseIf and has the identity it has in the 2.2 form
 * else { if … }, for example Shop::Desk.serve/2/otherwise/0/then/0 in both spellings, so rewriting one spelling as the
 * other keeps every identity.
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
/** One occurrence–case pair of an associate statement with the positions of both references in their lists (WP2-M04). */
export interface AssociationPair {
    statement: a.Association;
    occurrence: Reference<a.ComponentUsage>;
    target: Reference<a.Scenario>;
    occurrenceIndex: number;
    targetIndex: number;
}
/** The listed occurrences of an associate statement in source order (associate a, b to …). */
export const associationOccurrences = (x: a.Association): Reference<a.ComponentUsage>[] => [x.occurrence, ...(x.moreOccurrences ?? [])];
/** The listed cases of an associate statement in source order (… to 'X', 'Y';). */
export const associationTargets = (x: a.Association): Reference<a.Scenario>[] => [x.target, ...(x.moreTargets ?? [])];
/** Whether an associate statement uses the 3.0 list form (WP2-G03) rather than the single 2.2 pair. */
export const isAssociationList = (x: a.Association): boolean => (x.moreOccurrences ?? []).length > 0 || (x.moreTargets ?? []).length > 0;
/**
 * Every occurrence–case pair of an associate statement (WP2-S06): each listed occurrence with each listed case,
 * occurrences in list order, and for each of them the cases in list order. A single 2.2 statement has one pair.
 * A statement recovered from a parse error can lack a listed reference (`associate a to ;`): a pair without either
 * side is left out, and the other pairs keep their list positions.
 */
export function associationPairs(x: a.Association): AssociationPair[] {
    const targets = associationTargets(x);
    return associationOccurrences(x).flatMap((occurrence, occurrenceIndex) => occurrence ? targets.flatMap((target, targetIndex) => target ? [{ statement: x, occurrence, target, occurrenceIndex, targetIndex }] : []) : []);
}
/** The top-level occurrences associated with a case by associate links of its package. */
export function associatedOccurrences(s: a.Scenario): a.ComponentUsage[] {
    const p = owner(s, a.isPackage);
    return p ? [...new Set(p.associations.flatMap(associationPairs).filter(x => x.target.ref === s).flatMap(x => x.occurrence.ref ? [x.occurrence.ref] : []))] : [];
}
/** Existing software occurrence roots a test may inspect or call directly.
 * Association is a reference, never containment or an execution-root selection.
 * Multiplicity families have no unindexed runtime store and platform roots do not execute. */
export function testAccessRoots(s: a.Scenario): a.ComponentUsage[] {
    const p = owner(s, a.isPackage);
    if (s.kind !== 'test' || !p || !s.subject?.ref)
        return [];
    const executed = new Set(softwareRoots(p).filter(root => root.size === undefined));
    return [...new Set([s.subject.ref, ...associatedOccurrences(s)])].filter(root => executed.has(root));
}
/** Whether a decoded occurrence-owner path names an exact permitted root or single part.
 * The path has no package prefix, member suffix or source quoting, like caseTarget().path. */
export function testCanAccess(s: a.Scenario, path: string): boolean {
    const [head, ...parts] = path.split('.');
    let current: Structure | undefined = testAccessRoots(s).find(root => root.name === head);
    for (const part of parts) {
        // A part of a multiplicity family is named with its literal index, as in twins[0] (WP1-S06).
        const [, name, index] = /^(.*?)(?:\[(\d+)\])?$/.exec(part)!;
        current = current && members(current).filter(a.isComponentUsage).find(child => child.name === name && (index === undefined ? child.size === undefined : child.size !== undefined && Number(index) < child.size));
        if (!current)
            return false;
    }
    return !!current;
}
/** Roots that supply direct calls to a case. Only the exact primary subject is
 * a normal call target; tests retain additional private helper roots. */
export function caseCallRoots(s: a.Scenario): a.ComponentUsage[] {
    const p = owner(s, a.isPackage), subject = caseSubject(s);
    if (!p || !subject || subject.size !== undefined || !softwareRoots(p).includes(subject))
        return [];
    return s.kind === 'test' ? testAccessRoots(s) : [subject];
}
export type CaseCallAccess = 'subject' | 'testHelper';
/** Decoded occurrence-owner path, without a member suffix or source quoting. */
export function caseCallAccess(s: a.Scenario, path: string): CaseCallAccess | undefined {
    const roots = caseCallRoots(s);
    if (!roots.length)
        return undefined;
    if (path === s.subject!.ref!.name)
        return 'subject';
    return testCanAccess(s, path) ? 'testHelper' : undefined;
}
/** The language-level call limit, shared with authoring hosts. Source call shape
 * and the ordinary placement of suspending calls remain separate checks. */
export function caseCallRestriction(s: a.Scenario, path: string, operation: Executable, structure: Structure): 'scope' | 'stateful' | 'effects' | undefined {
    const access = caseCallAccess(s, path);
    if (!access)
        return 'scope';
    if (isStateful(operation))
        return 'stateful';
    const effect = effects(operation, structure);
    return access === 'testHelper' && (effect.communicates || effect.suspends) ? 'effects' : undefined;
}
/** Normal suspension belongs to a whole statement value, optionally wrapped in
 * try. For initializers/updates are not these statement slots. */
export function allowsSuspendingCall(node: AstNode): boolean {
    let value = node;
    while (a.isTryExpression(value.$container))
        value = value.$container;
    const parent = value.$container;
    return a.isExpressionStatement(parent) && parent.expression === value
        || parent?.$containerProperty === 'statements' && (a.isLocalVariable(parent) || a.isAssign(parent)) && parent.value === value;
}
/** A case with statements is executable; a case without statements records intent only. */
export const executableCase = (s: a.Scenario): boolean => s.statements.length > 0;
/**
 * What a dotted path in a case script names. occurrence.port.member is a port member of a
 * top-level occurrence of the case's package, which a script uses as that occurrence. Any other
 * path walks single parts from a top-level occurrence and ends at an operation, or at an attribute
 * followed by record fields, which a test may call or read (white-box access).
 */
export type CaseTarget = {
    kind: 'port';
    occurrence: a.ComponentUsage;
    port: a.PortUsage;
    member: a.PortMember;
} | {
    kind: 'operation';
    /** The occurrence path of the owner, such as atm or atm.dispenser. */
    path: string;
    structure: Structure;
    operation: Executable;
} | {
    kind: 'attribute';
    path: string;
    structure: Structure;
    attribute: a.Attribute;
    fields: string[];
};
export function caseTarget(s: a.Scenario, path: string): CaseTarget | undefined {
    const p = owner(s, a.isPackage), [head, ...rest] = path.split('.');
    const occurrence = p && packageOccurrences(p).find(o => o.name === head);
    if (!occurrence || !rest.length)
        return undefined;
    const port = members(occurrence).filter(a.isPortUsage).find(x => x.name === rest[0]);
    if (port) {
        const member = rest.length === 2 ? portMembers(port).find(m => m.name === rest[1]) : undefined;
        return member && { kind: 'port', occurrence, port, member };
    }
    // A call path of a test may index a part family with a literal, as in backend.twins[0].currentView (WP1-S06).
    const walked = walkParts(occurrence, head, pathSteps(rest));
    if (walked.problem)
        return undefined;
    const { structure, path: at, next } = walked, steps = pathSteps(rest), step = steps[next];
    if (!step || step.field === undefined)
        return undefined;
    const name = step.field;
    const operation = members(structure).filter(isExecutable).find(x => x.name === name);
    if (operation)
        return next === steps.length - 1 ? { kind: 'operation', path: at, structure, operation } : undefined;
    const attribute = members(structure).filter(a.isAttribute).find(x => x.name === name);
    const fields = steps.slice(next + 1);
    return attribute && fields.every(x => x.field !== undefined) ? { kind: 'attribute', path: at, structure, attribute, fields: fields.map(x => x.field!) } : undefined;
}
/**
 * One step of a value path or place after its first name (WP1-S02): a record field or part name, or an
 * index. A literal index of a call path is a number; an index of a read or place is its expression.
 */
export type Step = { field: string; index?: undefined; node?: AstNode } | { field?: undefined; index: number | a.Expression; node?: AstNode };
/** The steps of a source path string such as twins[0].link (literal indexes only). */
export function pathSteps(parts: readonly string[]): Step[] {
    return parts.flatMap((part): Step[] => { const [, name, index] = /^(.*?)(?:\[(\d+)\])?$/.exec(part)!; return index === undefined ? [{ field: name }] : [{ field: name }, { index: Number(index) }]; });
}
/** The steps after the first name of a value reference or assignment target: dotted names, the first index and the selectors. */
export function valueSteps(n: a.ReferenceExpression | a.Assign): Step[] {
    const names = (a.isAssign(n) ? n.target : n.path).split('.').slice(1);
    return [...names.map(field => ({ field, node: n })), ...(n.index ? [{ index: n.index, node: n.index }] : []), ...(n.selectors ?? []).map(s => s.field !== undefined ? { field: s.field, node: s as AstNode } : { index: s.index!, node: s.index! as AstNode })];
}
/** The root name of an assignment target or value path: its first segment. */
export const placeRoot = (target: string): string => target.split('.')[0];
/** An assignment whose target is a place other than a bare name: dotted, qualified or indexed (WP1-S05). */
export const isPlace = (s: a.Assign): boolean => s.target.includes('.') || s.target.includes('::') || !!s.index;
/** The literal value of an index, or undefined when it is not an integral literal. */
export function literalIndex(index: number | a.Expression): number | undefined {
    if (typeof index === 'number')
        return index;
    return a.isLiteral(index) && index.number !== undefined && !index.$cstNode?.text.includes('.') ? index.number : undefined;
}
/** Why a component index of a test path is invalid (WP1-S06): not a literal, outside the multiplicity, or a single part indexed. */
export type PartProblem = { problem: 'literal' | 'range' | 'single'; child: a.ComponentUsage; index: number | a.Expression; path: string };
/**
 * Walks part names from an occurrence: a single part takes no index, and a part family takes one literal
 * index inside its multiplicity. Stops at the first step that is not a part name.
 */
export function walkParts(start: Structure, path: string, steps: readonly Step[]): { structure: Structure; path: string; next: number; problem?: PartProblem } {
    let structure = start, at = path, i = 0;
    while (i < steps.length) {
        const step = steps[i];
        if (step.field === undefined)
            break;
        const child = members(structure).filter(a.isComponentUsage).find(x => x.name === step.field);
        if (!child)
            break;
        const next = steps[i + 1];
        if (child.size === undefined) {
            if (next && next.index !== undefined)
                return { structure, path: at, next: i, problem: { problem: 'single', child, index: next.index, path: at + '.' + child.name } };
            at += '.' + child.name;
            i++;
        }
        else {
            if (!next || next.index === undefined)
                break;
            const n = literalIndex(next.index);
            if (n === undefined)
                return { structure, path: at, next: i, problem: { problem: 'literal', child, index: next.index, path: at + '.' + child.name } };
            if (!Number.isSafeInteger(n) || n < 0 || n >= child.size)
                return { structure, path: at, next: i, problem: { problem: 'range', child, index: next.index, path: at + '.' + child.name } };
            at += `.${child.name}[${n}]`;
            i += 2;
        }
        structure = child;
    }
    return { structure, path: at, next: i };
}
/** What a value reference of a case script reads: an attribute of an accessible part, followed by value steps. */
export type CaseRead = { kind: 'attribute'; path: string; structure: Structure; attribute: a.Attribute; steps: Step[] } | { kind: 'problem'; problem: PartProblem };
/**
 * Resolves a value read of a case script that starts at a top-level occurrence of its package, such as
 * atm.dispenser.count or, in a test, backend.twins[0].link (WP1-S06). Part families take literal indexes;
 * the steps after the attribute select record fields and array elements of its value.
 */
export function caseRead(s: a.Scenario, e: a.ReferenceExpression): CaseRead | undefined {
    const p = owner(s, a.isPackage), head = e.path.split('.')[0];
    const occurrence = p && packageOccurrences(p).find(o => o.name === head);
    if (!occurrence)
        return undefined;
    const steps = valueSteps(e), walked = walkParts(occurrence, head, steps);
    if (walked.problem)
        return { kind: 'problem', problem: walked.problem };
    const step = steps[walked.next];
    if (!step || step.field === undefined || members(walked.structure).some(x => a.isPortUsage(x) && x.name === step.field))
        return undefined;
    const attribute = members(walked.structure).filter(a.isAttribute).find(x => x.name === step.field);
    return attribute && { kind: 'attribute', path: walked.path, structure: walked.structure, attribute, steps: steps.slice(walked.next + 1) };
}
// ---------------------------------------------------------------- read sets
/**
 * Component attributes that a group of nodes reads and writes, through the bodies of its transitive local callees
 * (the read sets of SIF-R07): an attribute reference reads, an assignment to a place or root writes, and an attribute passed as an
 * out argument of a local or port call is written. clock is true when the group or a callee calls
 * Swaml::Time::now.
 */
export type AttributeAccess = { reads: Set<string>; writes: Set<string>; clock: boolean; cells: Set<string> };
export function attributeAccess(roots: readonly AstNode[], c: Structure | undefined): AttributeAccess {
    const result: AttributeAccess = { reads: new Set(), writes: new Set(), clock: false, cells: new Set() }, seen = new Set<Executable>();
    const attributes = new Set(c ? members(c).filter(a.isAttribute).map(x => x.name) : []);
    // Only the nodes whose nearest executable is home count; nested operations are walked only when called.
    const walk = (root: AstNode, home: AstNode | undefined) => {
        for (const n of nodes(root)) {
            if (isExecutable(n) || owner(n, isExecutable) !== home)
                continue;
            if (a.isReferenceExpression(n) && attributes.has(n.path.split('.')[0]))
                result.reads.add(n.path.split('.')[0]);
            // A sampled read p.m reads the sample cell of an owned port (WP6-S01).
            else if (a.isReferenceExpression(n) && c) {
                const sampled = sampledReadForm(n, c);
                if (sampled && isSampledMember(sampled.port, sampled.member))
                    result.cells.add(sampled.port.name + '.' + sampled.member.name);
            }
            if (a.isAssign(n) && attributes.has(placeRoot(n.target)))
                result.writes.add(placeRoot(n.target));
            if (!a.isCallExpression(n))
                continue;
            const outs = (parameters: readonly a.Argument[] | undefined) => parameters?.forEach((p, i) => { const arg = n.args[i]; if (p.direction === 'out' && a.isReferenceExpression(arg) && attributes.has(arg.path))
                result.writes.add(arg.path); });
            if (n.target.includes('.')) {
                outs(c && memberEndpoint(c, n.target)?.member.parameters);
                continue;
            }
            const model = AstUtils.getDocument(n).parseResult.value as a.Model;
            const target = localOperation(n, n.target, c) ?? resolve(n, n.target, workspaceModels.get(model) ?? [model]);
            if (!target || !isExecutable(target))
                continue;
            outs(signature(target)?.parameters);
            if (isClockRead(target))
                result.clock = true;
            else if (!seen.has(target)) {
                seen.add(target);
                const b = body(target);
                if (b)
                    walk(b, target.body ? target : signature(target));
            }
        }
    };
    for (const root of roots)
        walk(root, owner(root, isExecutable));
    return result;
}
