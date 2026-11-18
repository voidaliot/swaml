// States in the flow, migration of 2.2 state machines (docs/proposals/STATES_IN_FLOW_PROPOSAL.md 7.1): rewrites every
// 2.2 machine (`initial I; state … { … }`) of a source as states that are steps of the flow, and returns the new text, an
// identity map (new statement identity -> 2.2 statement identity, for traces and overlays) and a report.
//
//   node scripts/migrate-machines.mjs <file.swaml> …            prints the report and the diff summary of each file
//   node scripts/migrate-machines.mjs <file.swaml> … --write    rewrites the files in place
//   … --current                                                 reads with the repository's grammar instead of 2.2's
//
// The source is read with the kept 2.2 grammar (test/fixtures/compatibility-2-2/swaml-2.2.langium), so the script keeps
// working after the 2.2 machine syntax has left the language. The recipe (7.1):
//  1. the operation already satisfies SIF-S01 (2.2 enforces one on start entry, no parameters, void);
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
// 11. no parents are introduced; 12. 2.2 has no other when (WP7's release guard is spelled if since package 1);
// 13. the report lists removals, renames, copied exits and refusals.
// WP5 forms (completion transitions, internal transitions, guarded timers, defer) were never released: a source that
// uses them is refused and rewritten by hand (7.3).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { GrammarUtils } from 'langium';

const durationNs = d => Number(d.value) * { ns: 1, us: 1e3, ms: 1e6, s: 1e9 }[d.unit];
const kind = t => t.endpoint ? 'receive' : (t.delay || t.delayValue) ? 'timer' : 'completion';
const text = n => n.$cstNode.text;
const word = name => new RegExp(`(?<![\\w'.])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w'])`, 'g');
const permutations = list => list.length <= 1 ? [list.slice()] : list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map(p => [x, ...p]));

/** Step 2: the order of the states in the new text. */
function chooseOrder(states, initial) {
    const finals = states.filter(s => s.final), others = states.filter(s => !s.final && s.name !== initial), first = states.find(s => s.name === initial);
    const targets = s => new Set(s.transitions.filter(t => t.target !== undefined).map(t => t.target));
    const score = order => { const full = [...order, ...finals]; let n = 0; for (let i = 0; i < full.length - 1; i++) if (!full[i].final && targets(full[i]).has(full[i + 1].name)) n++; return n; };
    const displacement = order => order.reduce((sum, s, i) => sum + Math.abs(i - states.indexOf(s)), 0);
    if (others.length + 1 <= 9) {
        let best;
        for (const p of permutations(others)) {
            const order = [first, ...p], sc = score(order), d = displacement(order);
            if (!best || sc > best.sc || sc === best.sc && d < best.d)
                best = { order, sc, d };
        }
        return [...best.order, ...finals];
    }
    const placed = [first], rest = new Set(others);
    while (rest.size) {
        const next = placed.at(-1).transitions.filter(t => t.target !== undefined).map(t => others.find(s => s.name === t.target)).find(s => s && rest.has(s));
        const pick = next ?? others.find(s => rest.has(s));
        placed.push(pick);
        rest.delete(pick);
    }
    return [...placed, ...finals];
}

/** Migrates one machine; returns { report } when it is refused, otherwise { report, map, text, start, end }. */
function migrateMachine(source, op, b, identity) {
    const opId = identity(op);
    const report = { operation: opId, states: b.states.length, refused: [], removedTransitions: [], removedTimers: [], renamedBindings: [], copiedExits: [], notes: [] };
    for (const s of b.states) {
        if (s.deferrals?.length)
            report.refused.push(`${s.name}: defer (WP5, never released) is rewritten by hand with a variable`);
        for (const t of s.transitions) {
            if (kind(t) === 'completion')
                report.refused.push(`${s.name}: a completion transition (WP5, never released) is rewritten by hand as if (g) to S;`);
            else if (t.target === undefined)
                report.refused.push(`${s.name}: an internal transition (WP5, never released) is rewritten by hand as a staying line`);
            else if (kind(t) === 'timer' && t.guard)
                report.refused.push(`${s.name}: a guarded timer (WP5, never released) is rewritten by hand as after D { if (g) … }`);
        }
        if (!s.final && !s.transitions.length && !s.deferrals?.length)
            report.refused.push(`${s.name}: a non-final state without transitions waits for ever in 2.2; give it the event it waits for, or make it final (7.1 step 9)`);
    }
    const initial = b.states.find(s => s.name === b.initial);
    if (!initial)
        report.refused.push(`${b.initial}: unknown initial state`);
    else if (initial.final)
        report.refused.push(`${b.initial}: the initial state is final`);
    if (report.refused.length)
        return { report };
    const order = chooseOrder(b.states, b.initial), steps = [];
    order.forEach((s, i) => { steps.push(s); if (s.final && i < order.length - 1) steps.push('return'); });
    const next = s => order[order.indexOf(s) + 1];
    const nameText = n => GrammarUtils.findNodeForProperty(n.$cstNode, 'name').text;
    const initialKeyword = GrammarUtils.findNodeForKeyword(b.$cstNode, 'initial');
    const indent = (() => { const all = source, at = initialKeyword.offset, lineStart = all.lastIndexOf('\n', at - 1); return all.slice(lineStart + 1, at).replace(/\S.*/, ''); })();
    const oldState = s => `${opId}/states/${b.states.indexOf(s)}`;
    const oldTransition = (s, t) => `${oldState(s)}/transitions/${s.transitions.indexOf(t)}`;
    const map = {}, lines = [];
    const emit = (depth, line) => lines.push(indent + '  '.repeat(depth) + line);
    steps.forEach((item, at) => {
        if (item === 'return') {
            emit(0, 'return;');
            return;
        }
        const s = item, id = `${opId}/${at}`;
        map[id] = oldState(s);
        emit(0, `state ${nameText(s)} {`);
        if (s.documentation)
            emit(1, text(s.documentation));
        let k = 0;
        const exitAction = s.actions.find(x => x.kind === 'exit'), exitStatements = exitAction ? exitAction.body.statements : [];
        const copyExit = exitStatements.length > 0 && s.transitions.some(t => t.effect.statements.length > 0);
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
        let timers = s.transitions.filter(t => kind(t) === 'timer');
        const computed = timers.some(t => t.delayValue);
        if (computed && timers.length > 1)
            report.notes.push(`state ${s.name}: a computed timer among several timers keeps declaration order`);
        if (!computed)
            timers = timers.slice().sort((x, y) => durationNs(x.delay) - durationNs(y.delay));
        const live = [];
        for (const t of timers) {
            if (t.delay && live.some(u => u.delay && durationNs(u.delay) <= durationNs(t.delay))) {
                report.removedTimers.push(`${s.name}: ${text(t).replace(/\s+/g, ' ')}`);
                continue;
            }
            live.push(t);
        }
        const members = [...new Set(s.transitions.filter(t => kind(t) === 'receive').map(t => t.endpoint))];
        /** One branch: copied exit statements, the effect and the leave, with their identities. */
        const branch = (depth, t, path, rename) => {
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
            emit(depth, target === next(s) ? 'exit;' : `to ${GrammarUtils.findNodeForProperty(t.$cstNode, 'target').text};`);
            return n === 0;
        };
        let refused;
        /** One line: its transitions as one chain in declaration order. */
        const line = (head, transitions, bindingNames) => {
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
                const pairs = names.map((x, i) => [x, bindingNames[i]]).filter(([x, y]) => y !== undefined && x !== y);
                if (!pairs.length)
                    return x => x;
                const written = [t.guard ? text(t.guard) : '', ...t.effect.statements.map(text)].join('\n');
                for (const [, y] of pairs)
                    if (word(y).test(written) && !names.includes(y))
                        refused = `the binding ${y} would be captured in ${s.name}`;
                report.renamedBindings.push(`${s.name}: ${pairs.map(([x, y]) => `${x} -> ${y}`).join(', ')}`);
                return str => pairs.reduce((acc, [x, y]) => acc.replace(word(x), y), str);
            });
            if (copyExit && bindingNames.some(x => exitStatements.some(st => word(x).test(text(st)))))
                refused = `a binding of ${head} would capture a name in the copied exit actions of ${s.name}`;
            if (transitions.length === 1 && !transitions[0].guard) {
                // A body that is only the leave is written without braces (7.1 step 5).
                const start = lines.length;
                emit(1, `${head} {`);
                if (branch(2, transitions[0], `${path}/body`, renames[0]) && !copyExit) {
                    const leave = lines.pop().trim();
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
            const transitions = s.transitions.filter(t => t.endpoint === member);
            const first = GrammarUtils.findNodesForProperty(transitions[0].$cstNode, 'bindings').map(n => n.text);
            line(`on receive ${GrammarUtils.findNodeForProperty(transitions[0].$cstNode, 'endpoint').text}(${first.join(', ')})`, transitions, first);
        }
        emit(0, '}');
        if (refused)
            report.refused.push(refused);
    });
    if (report.refused.length)
        return { report };
    // Step 10: the end of the operation is reachable iff a final state was reachable.
    const reachable = new Set(), visit = name => { if (reachable.has(name)) return; reachable.add(name); for (const t of b.states.find(x => x.name === name)?.transitions ?? []) visit(t.target); };
    visit(b.initial);
    const finalReachable = b.states.some(s => s.final && reachable.has(s.name)), last = order.at(-1);
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
export function migrateSource(source, parse, identity) {
    const result = parse(source);
    if (result.lexerErrors.length || result.parserErrors.length)
        return { machines: [], refused: ['the source does not parse as 2.2'] };
    const machines = [], edits = [];
    const visit = n => {
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
    const map = {};
    for (const e of edits.sort((x, y) => y.start - x.start)) {
        text = text.slice(0, e.start) + e.text + text.slice(e.end);
        Object.assign(map, e.map);
    }
    return { text, map, machines, refused };
}

/**
 * The parser and the product identity, built from the repository at root: the kept 2.2 grammar (for 2.2 sources, which is
 * what a user migrates), or with current the repository's own grammar while it still parses 2.2 machines beside 2.3
 * forms (used once, to migrate the repository's 2.3 candidate sources).
 */
export async function migrationTools({ root = new URL('..', import.meta.url), current = false } = {}) {
    const { identity } = await import(new URL('out/src/language/semantic.js', root).href);
    if (current) {
        const { EmptyFileSystem } = await import('langium');
        const { createSwamlServices } = await import(new URL('out/src/language/swaml-module.js', root).href);
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        return { parse: text => Swaml.parser.LangiumParser.parse(text), identity };
    }
    const { createServicesForGrammar } = await import('langium/grammar');
    const { SwamlValueConverter } = await import(new URL('out/src/language/swaml-syntax.js', root).href);
    const grammar = readFileSync(new URL('test/fixtures/compatibility-2-2/swaml-2.2.langium', root), 'utf8');
    const kept = await createServicesForGrammar({ grammar, module: { parser: { ValueConverter: () => new SwamlValueConverter() } } });
    return { parse: text => kept.parser.LangiumParser.parse(text), identity };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const files = process.argv.slice(2).filter(x => !x.startsWith('--')), write = process.argv.includes('--write');
    const { parse, identity } = await migrationTools({ current: process.argv.includes('--current') });
    let failed = false;
    for (const file of files) {
        const source = readFileSync(file, 'utf8'), r = migrateSource(source, parse, identity);
        if (!r.machines.length && !r.refused?.length) {
            console.log(`${file}: no 2.2 machine; unchanged`);
            continue;
        }
        if (r.refused.length) {
            failed = true;
            console.log(`${file}: refused, unchanged\n  ${r.refused.join('\n  ')}`);
            continue;
        }
        console.log(`${file}: ${r.machines.length} machine(s) migrated`);
        for (const m of r.machines)
            for (const [label, list] of [['removed transitions', m.removedTransitions], ['removed timers', m.removedTimers], ['renamed bindings', m.renamedBindings], ['copied exit actions', m.copiedExits], ['notes', m.notes]])
                if (list.length)
                    console.log(`  ${m.operation} ${label}: ${list.join('; ')}`);
        if (write)
            writeFileSync(file, r.text);
    }
    process.exitCode = failed ? 1 : 0;
}
