// The migration of 2.2 state machines (chapter 3.6, docs/MIGRATION_3_0.md): rewrites every 2.2 machine
// (`initial I; state … { … }`) of a source as states that are steps of the flow, and returns the new text, an identity map
// (new statement identity -> 2.2 statement identity, for traces and overlays) and a report. `swaml migrate` (src/cli/migrate.ts)
// is the user command; scripts/migrate-machines.mjs re-exports this module for the repository's gates.
//
// The source is read with the kept 2.2 grammar (generated into grammar-2-2.ts from
// test/fixtures/compatibility-2-2/swaml-2.2.langium at build time), so the migration keeps working after the 2.2 machine
// syntax has left the language. The recipe:
//  1. the operation already has one on start entry, no parameters and returns void (2.2 enforced it);
//  2. state order: initial first, finals last in source order, otherwise the order that maximises states whose next
//     state is a target of theirs (exhaustive up to 9 states, greedy beyond), ties by the smallest displacement;
//  3. each state: on entry unchanged; timer transitions first, sorted by literal duration (stable), each a line
//     after D { effect; leave; }; then one on receive line per member in order of first declaration, whose block is the
//     member's transitions as an if / else if chain in declaration order (an unguarded one is the final else); a
//     transition after an unguarded one on the same member was never taken and is removed (reported); bindings of later
//     transitions are renamed to the first transition's names (reported), and a rename that would capture is refused;
//  4. a state whose on exit is not empty and that has a leaving transition with an effect loses its on exit, whose
//     statements are written at the start of every leaving block (2.2's exit, effect, entry order under text order);
//  5. a leave to the next state is exit;, every other leave to T;; a body that is only the leave is written short;
//  6. an unguarded timer not shorter than an earlier unguarded one was never taken and is removed (reported);
//  7. nothing is written for inputs: 2.2 dropped unhandled input while waiting, and so does the new text;
//  8. finals become named steps; with several finals, return; follows each final step except the last statement;
//  9. a non-final state without transitions (a dead end) refuses the machine;
// 10. the end check: the end of the operation is reachable iff a final state was;
// 11. no parents are introduced;
// 12. the report lists removals, renames, copied exits and refusals.
// The forms of the unreleased 2.3 candidate (completion transitions, internal transitions, guarded timers, defer) were never
// released: a source that uses them is refused and rewritten by hand. A release guard of that candidate spelled
// when (g) is rewritten to if (g) by migrateReleaseGuards.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GrammarUtils } from 'langium';

type AnyNode = any;
/** The report of one machine. */
export interface MachineReport {
    operation: string;
    states: number;
    /** 1-based line and column of the machine's initial keyword in the source. */
    line?: number;
    column?: number;
    refused: string[];
    removedTransitions: string[];
    removedTimers: string[];
    renamedBindings: string[];
    copiedExits: string[];
    notes: string[];
}
/** The result of migrateSource: text is undefined when nothing changes or the source is refused as a whole. */
export interface MigrationResult {
    text?: string;
    map: Record<string, string>;
    machines: MachineReport[];
    refused: string[];
    /** The replaced ranges of the source, for a dry run: [start, end) offsets and the text written there. */
    edits?: { start: number; end: number; text: string }[];
}
export type Parse = (text: string) => { value: AnyNode; lexerErrors: any[]; parserErrors: any[] };
export type Identity = (node: AnyNode) => string;

const durationNs = (d: AnyNode) => Number(d.value) * ({ ns: 1, us: 1e3, ms: 1e6, s: 1e9 } as Record<string, number>)[d.unit];
const kind = (t: AnyNode) => t.endpoint ? 'receive' : (t.delay || t.delayValue) ? 'timer' : 'completion';
const text = (n: AnyNode): string => n.$cstNode.text;
const escape = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = (name: string) => new RegExp(`(?<![\\w'.])${escape(name)}(?![\\w'])`, 'g');
/** String literals, quoted names and comments of a text, which renames never touch: one pattern, and [start, end) offsets. */
const LITERAL = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const literals = (str: string) => [...str.matchAll(LITERAL)].map(m => [m.index!, m.index! + m[0].length]);
/** Whether name is written before '.' outside literals: a port or a field of that name, which the text cannot tell apart. */
const qualifies = (str: string, name: string) => new RegExp(`(?<![\\w'.])${escape(name)}\\s*\\.`).test(str.replace(LITERAL, ' '));
/**
 * Renames every name of pairs at once (one pass over the text, so swapped names never collapse), outside string literals,
 * quoted names and comments. The caller refuses a rename of a name written before '.' (qualifies), so a port spelled like
 * a binding is never renamed.
 */
function renameAll(str: string, pairs: [string, string][]): string {
    if (!pairs.length)
        return str;
    const to = new Map(pairs), skip = literals(str);
    const pattern = new RegExp(`(?<![\\w'.])(?:${pairs.map(([x]) => escape(x)).sort((a, b) => b.length - a.length).join('|')})(?![\\w'])`, 'g');
    return str.replace(pattern, (m: string, offset: number) => skip.some(([s, e]) => offset >= s && offset < e) ? m : to.get(m)!);
}
/**
 * The comments of source between start and end that lie outside the given copied ranges (each [start, end)), so that the
 * migrated text keeps them (everything else stays as written). Strings are skipped.
 */
function commentsBetween(source: string, start: number, end: number, copied: number[][]): string[] {
    const out: string[] = [];
    for (const m of source.slice(start, end).matchAll(/"(?:[^"\\\n]|\\.)*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g)) {
        const at = start + m.index!;
        if (m[0].startsWith('"') || copied.some(([s, e]) => at >= s && at < e))
            continue;
        out.push(m[0]);
    }
    return out;
}
const permutations = <T>(list: T[]): T[][] => list.length <= 1 ? [list.slice()] : list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map(p => [x, ...p]));

/** Step 2: the order of the states in the new text. */
function chooseOrder(states: AnyNode[], initial: string): AnyNode[] {
    const finals = states.filter(s => s.final), others = states.filter(s => !s.final && s.name !== initial), first = states.find(s => s.name === initial);
    const targets = (s: AnyNode) => new Set(s.transitions.filter((t: AnyNode) => t.target !== undefined).map((t: AnyNode) => t.target));
    const score = (order: AnyNode[]) => { const full = [...order, ...finals]; let n = 0; for (let i = 0; i < full.length - 1; i++) if (!full[i].final && targets(full[i]).has(full[i + 1].name)) n++; return n; };
    const displacement = (order: AnyNode[]) => order.reduce((sum, s, i) => sum + Math.abs(i - states.indexOf(s)), 0);
    if (others.length + 1 <= 9) {
        let best: { order: AnyNode[]; sc: number; d: number } | undefined;
        for (const p of permutations(others)) {
            const order = [first, ...p], sc = score(order), d = displacement(order);
            if (!best || sc > best.sc || sc === best.sc && d < best.d)
                best = { order, sc, d };
        }
        return [...best!.order, ...finals];
    }
    const placed = [first], rest = new Set(others);
    while (rest.size) {
        const next = placed.at(-1).transitions.filter((t: AnyNode) => t.target !== undefined).map((t: AnyNode) => others.find(s => s.name === t.target)).find((s: AnyNode) => s && rest.has(s));
        const pick = next ?? others.find(s => rest.has(s));
        placed.push(pick);
        rest.delete(pick);
    }
    return [...placed, ...finals];
}

/** Migrates one machine; returns { report } when it is refused, otherwise { report, map, text, start, end }. */
function migrateMachine(source: string, op: AnyNode, b: AnyNode, identity: Identity): { report: MachineReport; map?: Record<string, string>; text?: string; start?: number; end?: number } {
    const opId = identity(op);
    const report: MachineReport = { operation: opId, states: b.states.length, refused: [], removedTransitions: [], removedTimers: [], renamedBindings: [], copiedExits: [], notes: [] };
    const initialKeyword = GrammarUtils.findNodeForKeyword(b.$cstNode, 'initial')!;
    report.line = initialKeyword.range.start.line + 1;
    report.column = initialKeyword.range.start.character + 1;
    for (const s of b.states) {
        if (s.deferrals?.length)
            report.refused.push(`${s.name}: defer (never released) is rewritten by hand with a variable`);
        for (const t of s.transitions) {
            if (kind(t) === 'completion')
                report.refused.push(`${s.name}: a completion transition (never released) is rewritten by hand as if (g) to S;`);
            else if (t.target === undefined)
                report.refused.push(`${s.name}: an internal transition (never released) is rewritten by hand as a staying line`);
            else if (kind(t) === 'timer' && t.guard)
                report.refused.push(`${s.name}: a guarded timer (never released) is rewritten by hand as after D { if (g) … }`);
        }
        if (!s.final && !s.transitions.length && !s.deferrals?.length)
            report.refused.push(`${s.name}: a non-final state without transitions waits for ever in 2.2; give it the event it waits for, or make it final`);
    }
    const initial = b.states.find((s: AnyNode) => s.name === b.initial);
    if (!initial)
        report.refused.push(`${b.initial}: unknown initial state`);
    else if (initial.final)
        report.refused.push(`${b.initial}: the initial state is final`);
    if (report.refused.length)
        return { report };
    const order = chooseOrder(b.states, b.initial), steps: (AnyNode | 'return')[] = [];
    order.forEach((s, i) => { steps.push(s); if (s.final && i < order.length - 1) steps.push('return'); });
    const next = (s: AnyNode) => order[order.indexOf(s) + 1];
    const nameText = (n: AnyNode) => GrammarUtils.findNodeForProperty(n.$cstNode, 'name')!.text;
    const indent = (() => { const all = source, at = initialKeyword.offset, lineStart = all.lastIndexOf('\n', at - 1); return all.slice(lineStart + 1, at).replace(/\S.*/, ''); })();
    const oldState = (s: AnyNode) => `${opId}/states/${b.states.indexOf(s)}`;
    const oldTransition = (s: AnyNode, t: AnyNode) => `${oldState(s)}/transitions/${s.transitions.indexOf(t)}`;
    const map: Record<string, string> = {}, lines: string[] = [];
    const emit = (depth: number, line: string) => lines.push(indent + '  '.repeat(depth) + line);
    // Comments of the machine that no copied text holds: those before a state are written before it, those inside a state
    // (between its actions and transitions) at the start of its braces.
    const range = (n: AnyNode) => [n.$cstNode.offset, n.$cstNode.end];
    const copied = b.states.flatMap((s: AnyNode) => [...(s.documentation ? [range(s.documentation)] : []), ...s.actions.map(range), ...s.transitions.flatMap((t: AnyNode) => [...(t.guard ? [range(t.guard)] : []), ...t.effect.statements.map(range)])]);
    const before = new Map<AnyNode, string[]>(), inside = new Map<AnyNode, string[]>();
    b.states.forEach((s: AnyNode, i: number) => {
        before.set(s, commentsBetween(source, i === 0 ? initialKeyword.offset : b.states[i - 1].$cstNode.end, s.$cstNode.offset, copied));
        inside.set(s, commentsBetween(source, s.$cstNode.offset, s.$cstNode.end, copied));
    });
    steps.forEach((item, at) => {
        if (item === 'return') {
            emit(0, 'return;');
            return;
        }
        const s = item, id = `${opId}/${at}`;
        map[id] = oldState(s);
        for (const c of before.get(s)!)
            emit(0, c);
        emit(0, `state ${nameText(s)} {`);
        if (s.documentation)
            emit(1, text(s.documentation));
        for (const c of inside.get(s)!)
            emit(1, c);
        let k = 0;
        const exitAction = s.actions.find((x: AnyNode) => x.kind === 'exit'), exitStatements: AnyNode[] = exitAction ? exitAction.body.statements : [];
        const copyExit = exitStatements.length > 0 && s.transitions.some((t: AnyNode) => t.effect.statements.length > 0);
        if (copyExit)
            report.copiedExits.push(s.name);
        for (const action of s.actions) {
            if (copyExit && action === exitAction)
                continue;
            map[`${id}/${k}`] = `${oldState(s)}/actions/${s.actions.indexOf(action)}`;
            emit(1, text(action));
            k++;
        }
        // Timer lines first, sorted by literal duration (stable); a computed timer keeps declaration order (2.2 sorts by value).
        let timers = s.transitions.filter((t: AnyNode) => kind(t) === 'timer');
        const computed = timers.some((t: AnyNode) => t.delayValue);
        if (computed && timers.length > 1)
            report.notes.push(`state ${s.name}: a computed timer among several timers keeps declaration order`);
        if (!computed)
            timers = timers.slice().sort((x: AnyNode, y: AnyNode) => durationNs(x.delay) - durationNs(y.delay));
        const live: AnyNode[] = [];
        for (const t of timers) {
            if (t.delay && live.some(u => u.delay && durationNs(u.delay) <= durationNs(t.delay))) {
                report.removedTimers.push(`${s.name}: ${text(t).replace(/\s+/g, ' ')}`);
                continue;
            }
            live.push(t);
        }
        const members = [...new Set(s.transitions.filter((t: AnyNode) => kind(t) === 'receive').map((t: AnyNode) => t.endpoint))];
        /** One branch: copied exit statements, the effect and the leave, with their identities. */
        const branch = (depth: number, t: AnyNode, path: string, rename: (x: string) => string) => {
            let n = 0;
            if (copyExit)
                for (const [i, st] of exitStatements.entries()) {
                    map[`${path}/${n++}`] = `${oldState(s)}/actions/${s.actions.indexOf(exitAction)}/body/${i}`;
                    emit(depth, text(st));
                }
            for (const [i, st] of t.effect.statements.entries()) {
                map[`${path}/${n++}`] = `${oldTransition(s, t)}/effect/${i}`;
                emit(depth, rename(text(st)));
            }
            map[`${path}/${n}`] = oldTransition(s, t);
            const target = order.find(x => x.name === t.target);
            emit(depth, target === next(s) ? 'exit;' : `to ${GrammarUtils.findNodeForProperty(t.$cstNode, 'target')!.text};`);
            return n === 0;
        };
        let refused: string | undefined;
        /** One line: its transitions as one chain in declaration order. */
        const line = (head: string, transitions: AnyNode[], bindingNames: string[]) => {
            const path = `${opId}/${at}/${k++}`;
            map[path] = oldTransition(s, transitions[0]);
            const unguarded = transitions.findIndex(t => !t.guard);
            if (unguarded >= 0 && unguarded < transitions.length - 1) {
                for (const t of transitions.slice(unguarded + 1))
                    report.removedTransitions.push(`${s.name}: ${text(t).replace(/\s+/g, ' ')}`);
                transitions = transitions.slice(0, unguarded + 1);
            }
            const renames = transitions.map(t => {
                const names = t.endpoint ? GrammarUtils.findNodesForProperty(t.$cstNode, 'bindings').map(x => x.text) : [];
                const pairs = names.map((x, i) => [x, bindingNames[i]] as [string, string]).filter(([x, y]) => y !== undefined && x !== y);
                if (!pairs.length)
                    return (x: string) => x;
                const written = [t.guard ? text(t.guard) : '', ...t.effect.statements.map(text)].join('\n');
                for (const [, y] of pairs)
                    if (word(y).test(written) && !names.includes(y))
                        refused = `the binding ${y} would be captured in ${s.name}`;
                for (const [x] of pairs)
                    if (qualifies(written, x))
                        refused = `the binding ${x} of ${s.name} is written before '.' (a port or a field named like it); rename it by hand`;
                report.renamedBindings.push(`${s.name}: ${pairs.map(([x, y]) => `${x} -> ${y}`).join(', ')}`);
                return (str: string) => renameAll(str, pairs);
            });
            if (copyExit && bindingNames.some(x => exitStatements.some(st => word(x).test(text(st)))))
                refused = `a binding of ${head} would capture a name in the copied exit actions of ${s.name}`;
            if (transitions.length === 1 && !transitions[0].guard) {
                // A body that is only the leave is written without braces (step 5).
                const start = lines.length;
                emit(1, `${head} {`);
                if (branch(2, transitions[0], `${path}/body`, renames[0]) && !copyExit) {
                    const leave = lines.pop()!.trim();
                    lines.length = start;
                    emit(1, `${head} ${leave}`);
                }
                else
                    emit(1, '}');
                return;
            }
            emit(1, `${head} {`);
            let ifPath = `${path}/body/0`;
            transitions.forEach((t, i) => {
                if (t.guard) {
                    map[ifPath] = oldTransition(s, t);
                    emit(2, `${i === 0 ? '' : '} else '}if (${renames[i](text(t.guard))}) {`);
                    branch(3, t, `${ifPath}/then`, renames[i]);
                    ifPath = `${ifPath}/otherwise/0`;
                }
                else {
                    emit(2, '} else {');
                    branch(3, t, ifPath.replace(/\/0$/, ''), renames[i]);
                }
            });
            emit(2, '}');
            emit(1, '}');
        };
        for (const t of live)
            line(`after ${t.delay ? text(t.delay) : `(${text(t.delayValue)})`}`, [t], []);
        for (const member of members) {
            const transitions = s.transitions.filter((t: AnyNode) => t.endpoint === member);
            const first = GrammarUtils.findNodesForProperty(transitions[0].$cstNode, 'bindings').map(n => n.text);
            line(`on receive ${GrammarUtils.findNodeForProperty(transitions[0].$cstNode, 'endpoint')!.text}(${first.join(', ')})`, transitions, first);
        }
        emit(0, '}');
        if (refused)
            report.refused.push(refused);
    });
    if (report.refused.length)
        return { report };
    // Step 10: the end of the operation is reachable iff a final state was reachable.
    const reachable = new Set<string>(), visit = (name: string) => { if (reachable.has(name)) return; reachable.add(name); for (const t of b.states.find((x: AnyNode) => x.name === name)?.transitions ?? []) visit(t.target); };
    visit(b.initial);
    const finalReachable = b.states.some((s: AnyNode) => s.final && reachable.has(s.name)), last = order.at(-1);
    if (finalReachable !== !!last.final)
        report.refused.push('end check: the end of the operation would be reachable without a reachable final state, or the reverse');
    if (report.refused.length)
        return { report };
    return { report, map, text: lines.join('\n').slice(indent.length), start: initialKeyword.offset, end: b.states.at(-1).$cstNode.end };
}

/**
 * Migrates every 2.2 machine of one source. parse is the kept 2.2 parser (its parse function), identity the product's
 * declaration identity. Returns { text, map, machines } where map is new -> 2.2 statement identity; text is undefined
 * when the source does not parse as 2.2 or a machine is refused (the file is then left unchanged as a whole).
 */
export function migrateSource(source: string, parse: Parse, identity: Identity): MigrationResult {
    const result = parse(source);
    if (result.lexerErrors.length || result.parserErrors.length)
        return { machines: [], refused: ['the source does not parse as 2.2'], map: {} };
    const machines: MachineReport[] = [], edits: { report: MachineReport; map?: Record<string, string>; text?: string; start?: number; end?: number }[] = [];
    const visit = (n: AnyNode) => {
        for (const [key, value] of Object.entries(n)) {
            if (key.startsWith('$'))
                continue;
            for (const child of Array.isArray(value) ? value : [value])
                if (child && typeof child === 'object' && typeof child.$type === 'string') {
                    if (child.$type === 'OperationBody' && child.states?.length) {
                        const r = migrateMachine(source, child.$container, child, identity);
                        machines.push(r.report);
                        if (r.text !== undefined)
                            edits.push(r);
                    }
                    visit(child);
                }
        }
    };
    visit(result.value);
    const refused = machines.flatMap(m => m.refused.map(x => `${m.operation}: ${x}`));
    if (!machines.length || refused.length)
        return { machines, refused, map: {} };
    let text = source;
    const map: Record<string, string> = {};
    for (const e of edits.sort((x, y) => y.start! - x.start!)) {
        text = text.slice(0, e.start) + e.text + text.slice(e.end);
        Object.assign(map, e.map);
    }
    return { text, map, machines, refused, edits: edits.map(e => ({ start: e.start!, end: e.end!, text: e.text! })).sort((x, y) => x.start - y.start) };
}
