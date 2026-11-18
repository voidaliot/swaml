// WP5 of swa.ml 2.3: state reactions (ADR 0023). Completion transitions when (g) to S, guarded timers after D when (g),
// internal transitions without to, and defer p.m; in a state (WP5-G01..G03, WP5-S01..S10, WP5-R01..R13,
// WP5-D01..D09, WP5-T01..T04, WP5-M01..M04).
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AstUtils, EmptyFileSystem, TextDocument } from 'langium';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { formatDocument } from '../../src/language/formatter.js';
import { projectModel } from '../../src/language/projection.js';
import { CONTEXTUAL_KEYWORDS, CONTEXTUAL_KEYWORDS_2_2, KEYWORDS_FROM_2_3, MESSAGE_SPELLING, RESERVED_WORDS_2_2, formatName, formatPath, isBasicName } from '../../src/language/names.js';
import { attributeAccess, isCompletion, isInternal, stateDeferrals, transitionKind } from '../../src/language/semantic.js';
import { runCase, simulate } from '../../src/simulation/simulator.js';
import type { Model } from '../../src/language/generated/ast.js';
import * as a from '../../src/language/generated/ast.js';
import { parse, valid } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });

const root = new URL('../../../', import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Observation = { kind: string; [field: string]: any };
const allErrors = async (source: string) => (await parse(source)).errors.map(e => [String(e.code), String(e.message)]);
// The test machines declare more members than a state handles; input ownership (SW2005) is tested on its own.
const errors = async (source: string) => (await allErrors(source)).filter(([code]) => code !== 'SW2005');
const warnings = async (source: string) => (await parse(source)).warnings.map(e => [String(e.code), String(e.message)]);
/** The kept 2.2 grammar (the 3.1.0 parser), for recovery comparisons. */
const kept22 = async () => {
    const { parsers } = await import(new URL('scripts/compatibility-2-2.mjs', root).href) as { parsers(): Promise<{ kept: { parser: { LangiumParser: { parse(text: string): { value: unknown; parserErrors: unknown[]; lexerErrors: unknown[] } } } } }> };
    return (await parsers()).kept.parser.LangiumParser;
};
/**
 * One machine with a sender: m receives events x(n), y(n) and go() from s through a.(QoS policy given), and run is its
 * stateful operation. Only the members that the machine names (a.x, a.y, a.go) are declared, so each has one owner.
 */
const machine = (states: string, extra = '', sender = 'operation emit() { }', policy = '', initial = 'A') => {
    const used = (['x', 'y', 'go'] as const).filter(m => new RegExp(`\\ba\\.${m}\\b`).test(states + extra));
    const signature = (m: string) => m === 'go' ? 'go()' : `${m}(n: int)`, call = (m: string) => m === 'go' ? 'go()' : `${m}(0)`;
    return `package Test {
  port def P { ${used.map(m => `requires event ${signature(m)};`).join(' ')} }
  port def Q { ${used.map(m => `provides event ${signature(m)};`).join(' ')} }
  component def M {
    port a: P;
    attribute log: int = 0;
    attribute n: int = 0;
    attribute ok: bool = false;
    ${extra}
    operation run() {
      initial ${initial};
      ${states}
    }
    schedule { on start run(); }
  }
  component def S {
    port q: Q;
    ${sender}
    operation never() { if (false) { ${used.map(m => `publish q.${call(m)};`).join(' ')} } }
    schedule { on start emit(); on start never(); }
  }
  component m: M;
  component s: S;
  connect${policy} (s.q, m.a);
}`;
};
const kinds = (trace: readonly Observation[], ...k: string[]) => trace.filter(t => k.includes(t.kind));
const runOf = async (source: string, untilNs = 100000000, target = 'Test') => { const r = await valid(source); return simulate([r.model], target, { untilNs }); };
const NOISE = new Set(['release', 'dispatch', 'ready', 'unlock', 'initialize', 'complete', 'wait', 'publish', 'offer', 'receiveWait']);
/** The machine observations of a trace, compact: time in µs, kind, then the identifying fields. */
const story = (trace: readonly Observation[]) => trace.filter(t => !NOISE.has(t.kind)).map(t => {
    const us = t.timeNs / 1000;
    switch (t.kind) {
        case 'state': return `${us} ${t.internal ? 'internal' : 'state'} ${t.state}${t.internal ? ' ' + t.source.replace(/^.*\/states\//, '') : ''}`;
        case 'write': return `${us} write ${t.subject.split('.').pop()}=${JSON.stringify(t.value)}`;
        case 'defer': return `${us} defer ${t.state} ${t.member} ${t.message}`;
        case 'deliver': return `${us} deliver ${t.message}`;
        case 'discardInput': return `${us} discardInput ${t.reason} ${t.message ?? t.source?.replace(/^.*\//, '')}`;
        case 'discardTimer': return `${us} discardTimer ${t.state} ${t.source.replace(/^.*\/states\//, '')} ${t.reason}`;
        case 'discardAge': return `${us} discardAge ${t.message}`;
        case 'overflow': return `${us} overflow ${t.policy} ${t.member}`;
        case 'violation': return `${us} violation ${t.code} ${t.subject} ${t.source ?? ''}`.trimEnd();
        case 'timer': return `${us} timer ${t.state} ${t.timerNs}`;
        default: return `${us} ${t.kind}`;
    }
});

// ---------------------------------------------------------------- grammar and contextual word

test('WP5-G01 WP5-G02 the transition forms and deferrals parse with their AST shapes', async () => {
    const r = await valid(machine(`state A {
        defer a.x, a.y;
        on receive a.go() to B { }
        on receive a.go() when (n > 0) { }
      }
      state B {
        on receive a.x(v) { log = v; }
        on receive a.y(v) to B { }
        after 2ms when (n > 3) to C { }
        after (1ms) { n = n + 1; }
        when (n > 5) to C { }
      }
      final state C { }`));
    const ts = AstUtils.streamAllContents(r.model).filter(a.isTransition).toArray();
    assert.deepEqual(ts.map(t => [transitionKind(t), t.target ?? null, !!t.guard, isInternal(t), isCompletion(t)]), [
        ['receive', 'B', false, false, false], ['receive', null, true, true, false], ['receive', null, false, true, false], ['receive', 'B', false, false, false],
        ['timer', 'C', true, false, false], ['timer', null, false, true, false], ['completion', 'C', true, false, true]]);
    const states = AstUtils.streamAllContents(r.model).filter(a.isState).toArray();
    assert.deepEqual(states.map(stateDeferrals), [['a.x', 'a.y'], [], []]);
    assert.equal(states[0].deferrals[0].$type, 'Deferral');
    // The generated type matches the runtime shape: guard, target, endpoint and the delays are optional (review M2);
    // this assignment does not compile if the grammar's declared interface Transition loses an optional property.
    const shape: Pick<a.Transition, 'guard' | 'target' | 'endpoint' | 'delay' | 'delayValue'> = { guard: undefined, target: undefined, endpoint: undefined, delay: undefined, delayValue: undefined };
    assert.ok(Object.values(shape).every(v => v === undefined));
    const reflection = a.reflection.types.Transition.properties as Record<string, { name: string; optional?: boolean }>;
    assert.deepEqual(Object.entries(reflection).filter(([, p]) => p.optional).map(([n]) => n).sort(), ['bindings', 'delay', 'delayValue', 'endpoint', 'guard', 'target']);
});

test('WP5-S01 WP5-G03 defer is a contextual word: a basic name in every edition and position, a keyword only at a state member start', async () => {
    assert.ok(CONTEXTUAL_KEYWORDS.has('defer') && KEYWORDS_FROM_2_3.has('defer'));
    // defer was an ordinary name in 2.2: it is neither a 2.2 grammar word nor reserved there, so nothing about its spelling changes.
    assert.ok(!CONTEXTUAL_KEYWORDS_2_2.has('defer') && !RESERVED_WORDS_2_2.has('defer'));
    assert.deepEqual([formatName('defer'), formatName('defer', '2.2'), formatName('defer', MESSAGE_SPELLING), formatPath('defer.defer'), isBasicName('defer'), isBasicName('defer', '2.2')], ['defer', 'defer', 'defer', 'defer.defer', true, true]);
    const r = await valid(`package defer {
  enum Kind { defer, other }
  datatype R { defer: int; }
  port def In { requires event defer(defer: int); requires attribute 'when': int; }
  port def Out { provides event defer(defer: int); provides attribute 'when': int; }
  component def Machine {
    port defer: In;
    attribute total: int = 0;
    attribute kind: Kind = Kind.defer;
    operation run() {
      initial defer;
      state defer {
        defer defer.'when';
        on receive defer.defer(d) to to { var x: int = d; total = total + x; }
      }
      state to { on receive defer.'when'(v) to 'after' { total = total + v * 10; } }
      state 'after' { on receive defer.defer(d) to defer { } }
    }
    schedule { on start run(); }
  }
  operation def two() returns int { var defer: int = 2; return defer; }
  component def Src { port o: Out; attribute defer: int = 1; operation go() { var r: R = record R { defer = defer + 1; }; send o.'when'(r.defer); wait 1ms; publish o.defer(two()); } schedule { on start go(); } }
  component c: Machine;
  component s: Src;
  connect (s.o, c.defer);
}`);
    const deferral = AstUtils.streamAllContents(r.model).filter(a.isDeferral).toArray();
    assert.deepEqual(deferral.map(d => d.endpoints), [['defer.when']]);
    // The attribute is retained in state defer, then delivered in state to: 2 from the event, then 10 * 2.
    const out = simulate([r.model], 'defer', { untilNs: 10000000 });
    assert.deepEqual(out.stores['c'], { total: 22, kind: 'defer' });
});

test('WP5-G01 WP5-G02 (gate 3) the new forms parse without console output', async () => {
    const logged: string[] = [], saved = [console.log, console.warn, console.error];
    console.log = console.warn = console.error = (...args: unknown[]) => { logged.push(args.join(' ')); };
    try {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        for (const [context, pairs] of recovery)
            for (const [line] of pairs)
                Swaml.parser.LangiumParser.parse(context(line));
        for (const file of ['examples/44-session-completion.swaml', 'examples/45-lock-deferral.swaml', 'examples/46-breaker-internal.swaml', 'examples/47-reaction-forms.swaml'])
            Swaml.parser.LangiumParser.parse(readFileSync(new URL(file, root), 'utf8'));
    }
    finally {
        [console.log, console.warn, console.error] = saved;
    }
    assert.deepEqual(logged, []);
});

// ---------------------------------------------------------------- recovery

const statement = (line: string) => `package Test {
  port def P { requires event m(v: int); }
  component def D {
    attribute x: int = 0;
    port p: P;
    operation run() {
      x = 1;
      ${line}
      x = 2;
      x = 3;
    }
    operation other() { x = 4; }
    schedule { on start run(); }
  }
  component Demo: D;
}
package After { }`;
const member = (line: string) => `package Test {
  component def D {
    attribute x: int = 0;
    ${line}
    operation other() { x = 4; }
    operation run() { x = 2; x = 3; }
  }
  component Demo: D;
}
package After { }`;
const state = (line: string) => `package Test {
  port def P { requires event m(v: int); }
  component def D {
    attribute x: int = 0;
    port p: P;
    operation run() {
      initial A;
      state A {
        ${line}
        after 1ms to B { }
      }
      state B { after 2ms to C { } }
      final state C { }
    }
    operation other() { x = 4; }
    schedule { on start run(); }
  }
  component Demo: D;
}
package After { }`;
// A line before the next transition of the same state, for an internal transition followed by one that starts with a name
// position: the next state member after a transition body is always a keyword (on, after, when, defer) or }.
const stateNext = (line: string) => state(line).replace('after 1ms to B { }', 'on receive p.m(v) to B { x = v; }');
// A line at the end of a state, before the next state or a final state (review L5: since WP2 made state contextual, an
// unclosed block there read state B { as statements and lost B; 2.2 ended the block at the keyword state).
const stateEnd = (line: string) => state(line).replace('        after 1ms to B { }\n', '');
const stateEndFinal = (line: string) => stateEnd(line).replace('      state B { after 2ms to C { } }\n', '');
const keptItems = (m: Model) => ({
    packages: m.packages.map(p => p.name),
    elements: m.packages.flatMap(p => p.elements.map(e => (e as { name?: string }).name)).filter(n => ['D', 'Demo', 'P'].includes(n ?? '')),
    statements: AstUtils.streamAllContents(m).filter(a.isAssign).map(n => n.$cstNode?.text).filter(t => /^x = [234v];$/.test(t ?? '')).toArray(),
    operations: AstUtils.streamAllContents(m).filter(a.isOperation).map(n => n.name).filter(n => n === 'other' || n === 'run').toArray(),
    states: AstUtils.streamAllContents(m).filter(a.isState).map(n => n.name).filter(n => ['B', 'C'].includes(n)).toArray(),
    transitions: AstUtils.streamAllContents(m).filter(a.isTransition).map(n => n.$cstNode?.text).filter(t => t === 'after 1ms to B { }' || t === 'after 2ms to C { }' || t === 'on receive p.m(v) to B { x = v; }').toArray(),
});
type Parsed = { parserErrors: unknown[]; lexerErrors: unknown[] };
const positions = (r: Parsed) => new Set([...r.parserErrors.map(e => (e as { token: { startOffset: number } }).token.startOffset), ...r.lexerErrors.map(e => (e as { offset: number }).offset)]).size;
// Each unfinished or malformed new form, paired with the nearest 2.2 form of the same position.
const recovery: [(line: string) => string, [string, string][]][] = [
    [state, [['when (', 'on receive p.m(v) when ('], ['when (x', 'on receive p.m(v) when (x'], ['when (x > 0)', 'on receive p.m(v) when (x > 0)'], ['when (x > 0) to', 'after 5ms to'], ['when (x > 0) to B', 'after 5ms to B'],
        ['when x > 0 to B { }', 'on receive p.m(v) when x > 0 to B { }'], ['when () to B { }', 'on receive p.m(v) when () to B { }'], ['when', 'after'],
        ['after 5ms when (', 'on receive p.m(v) when ('], ['after 5ms when (x > 0)', 'on receive p.m(v) when (x > 0)'], ['after 5ms when (x > 0) to', 'after 5ms to'], ['after 5ms when', 'on receive p.m(v) when'], ['after (x * 1ms) when (', 'on receive p.m(v) when ('],
        ['on receive p.m(v) {', 'on receive p.m(v) to B {'], ['on receive p.m(v) { x = v;', 'on receive p.m(v) to B { x = v;'], ['on receive p.m(v) when (x > 0) {', 'on receive p.m(v) when (x > 0) to B {'], ['on receive p.m(v)', 'on receive p.m(v) to'],
        ['after 5ms {', 'after 5ms to B {'], ['after 5ms', 'after 5ms to'],
        ['defer', 'after'], ['defer p.', 'on receive p.'], ['defer p.m', 'on receive p.m'], ['defer p.m,', 'on receive p.m('], ['defer p.m, ;', 'on receive p.m(, );'], ['defer ;', 'after ;'], ['defer p;', 'on receive p;']]],
    [stateNext, [['on receive p.m(v) {', 'on receive p.m(v) to B {'], ['after 5ms { x = 1;', 'after 5ms to B { x = 1;'], ['defer p.m', 'on receive p.m'], ['when (x > 0)', 'on receive p.m(v) when (x > 0)']]],
    [stateEnd, [['on entry { on receive p.m(v) {', 'on entry { on receive p.m(v) {'], ['on entry { on receive p.m(v) { } or after 2ms {', 'on entry { on receive p.m(v) { } or after 2ms {'], ['on entry { x = 1;', 'on entry { x = 1;'],
        ['after 5ms to B { x = 1;', 'after 5ms to B { x = 1;'], ['on receive p.m(v) to B {', 'on receive p.m(v) to B {'], ['on exit { if (x > 0) {', 'on exit { if (x > 0) {']]],
    [stateEndFinal, [['on entry { on receive p.m(v) {', 'on entry { on receive p.m(v) {'], ['on entry { x = 1;', 'on entry { x = 1;'], ['after 5ms to C { x = 1;', 'after 5ms to C { x = 1;']]],
    [statement, [['defer', 'x'], ['defer =', 'x ='], ['defer.;', 'x.;'], ['defer p.m;', 'x p.m;'], ['defer = 1', 'x = 1'], ['when (x > 0) to B { }', 'when (x > 0) to B { }']]],
    [member, [['defer', 'x'], ['defer p.m;', 'x p.m;'], ['attribute defer: int =', 'attribute x2: int ='], ['when (x > 0) to B { }', 'when (x > 0) to B { }']]],
];
test('WP5-G01 WP5-G02 WP5-G03 an unfinished or malformed reaction keeps every following transition, state, statement, member and package that the kept 2.2 grammar keeps', async () => {
    const old = await kept22(), { Swaml } = createSwamlServices(EmptyFileSystem), misplaced: string[] = [];
    for (const [context, pairs] of recovery)
        for (const [line, nearest] of pairs) {
            const text = context(line), now = Swaml.parser.LangiumParser.parse(text), before = old.parse(text), near = old.parse(context(nearest));
            // Errors are counted by position: a block that is missing at a member start reports its { and } at one token.
            const count = positions(now), limit = Math.max(1, positions(before), positions(near));
            assert.ok(count > 0, `${line} is a syntax error`);
            // A completion transition typed outside a state (when is reserved in both grammars) resynchronizes differently:
            // more error positions than 2.2, but every item 2.2 keeps is kept (asserted below).
            if (!line.startsWith('when (x > 0) to B') || context === state)
                assert.ok(count <= limit, `${line}: ${count} errors, 2.2 had ${limit}`);
            else
                misplaced.push(`${line}: ${count} positions, 2.2 ${limit}`);
            const kept = keptItems(now.value as Model);
            for (const [label, reference] of [['the same text', keptItems(before.value as Model)], [nearest, keptItems(near.value as Model)]] as const)
                for (const [key, values] of Object.entries(reference))
                    for (const value of values as (string | undefined)[])
                        assert.ok((kept as Record<string, (string | undefined)[]>)[key].filter(x => x === value).length >= (values as (string | undefined)[]).filter(x => x === value).length, `${line}: ${key} ${value} is kept by the 2.2 grammar for ${label} but not now: ${JSON.stringify(kept)}`);
            assert.deepEqual(kept.packages, ['Test', 'After'], line);
            if (!line.startsWith('when (x > 0) to B') || context === state)
                assert.ok(kept.operations.includes('other') && kept.elements.includes('Demo'), line);
        }
    assert.deepEqual(misplaced.length, 2, misplaced.join('; '));
});

test('WP5-G01 WP5-G03 a block that the next state member ends is reported as missing its }, not as a reserved word', async () => {
    const hint = 'The block before it is not closed: add } before this state member.';
    for (const [line, at] of [['on receive p.m(v) to B { x = 1;\n        on receive p.m(v) to B { }', 'on'], ['on entry { x = 1;\n        defer p.m;', 'defer']]) {
        const messages = (await parse(state(line))).errors.map(e => e.message);
        assert.deepEqual(messages, ["Expecting token of type '}' but found `" + at + "`. " + hint], line);
    }
});

// ---------------------------------------------------------------- static rules

const states = (body: string, extra = '', initial = 'A') => machine(body, extra, 'operation emit() { }', '', initial);
test('WP5-S02 WP5-D01 WP5-D04 a completion transition needs a target and a final state has no transitions or deferrals of any form', async () => {
    assert.deepEqual(await errors(states('state A { on entry { n = 1; } when (n > 0) { } after 1ms to B { } } final state B { }')), [['SW2008', 'A completion transition needs a target state.']]);
    assert.deepEqual(await errors(states(`state A { after 1ms to B { } } final state B { when (n > 0) to A { } after 1ms { } defer a.x; }
      state C { on receive a.x(v) to C { } }`)), [['SW2008', 'Final state B cannot have transitions or deferrals.'], ['SW2008', 'Final state B cannot have transitions or deferrals.'], ['SW2008', 'Final state B cannot have transitions or deferrals.'], ['SW2008', 'Unreachable state C.']]);
    // The 2.2 form keeps its 2.2 message, once per state.
    assert.deepEqual(await errors(states('state A { after 1ms to B { } } final state B { after 1ms to A { } }')), [['SW2008', 'Final states have no transitions or exit action.']]);
});

test('WP5-S03 WP5-S06 WP5-D02 WP5-D07 completion and timer guards are bool and pure or read state (SW2008); receive guards keep SW2006', async () => {
    const extra = 'operation bump() returns bool { n = n + 1; return true; } operation peek() returns bool { return n > 0; }';
    const effect = 'State guards may only be pure or read state.';
    assert.deepEqual(await errors(machine('state A { on entry { n = 1; } when (bump()) to B { } } final state B { }', extra)), [['SW2008', effect]]);
    assert.deepEqual(await errors(machine('state A { on entry { n = 1; } after 1ms when (bump()) to B { } } final state B { }', extra)), [['SW2008', effect]]);
    assert.deepEqual(await errors(machine('state A { on receive a.go() when (bump()) to B { } } final state B { }', extra)), [['SW2006', effect]]);
    assert.deepEqual(await errors(machine('state A { on entry { n = 1; } when (peek()) to B { } after 1ms when (peek() and ok) to B { } } final state B { }', extra)), []);
    const types = await errors(machine('state A { on entry { n = 1; } when (n + 1) to B { } after 1ms when (n) to B { } } final state B { }'));
    assert.equal(types.length, 2, JSON.stringify(types));
    assert.ok(types.every(([code]) => code === 'SW2002'), JSON.stringify(types));
});

test('WP5-S04 WP5-D03 a cycle of when (true) completion transitions is an error, once per cycle; other completion cycles are runtime matters', async () => {
    assert.deepEqual(await errors(states('state A { when (true) to B { } } state B { when ((true)) to C { } } state C { when (true) to A { } }')), [['SW2008', 'States A → B → C → A form a cycle of when (true) completion transitions.']]);
    assert.deepEqual(await errors(states('state A { when (true) to A { } }')), [['SW2008', 'States A → A form a cycle of when (true) completion transitions.']]);
    // A cycle with an entry action, exit action or effect that can suspend restarts its chain at run time (WP5-R07) and is
    // not an error (review L2); a non-suspending action keeps the error.
    for (const cycle of ['state A { on entry { n = n + 1; wait 1ms; } when (true) to A { } }', 'state A { on exit { wait 1ms; } when (true) to B { } } state B { when (true) to A { } }',
        'state A { when (true) to B { } } state B { when (true) to A { pause(); } }', 'state A { on entry { ok = srv.ask(); } when (true) to A { } }'])
        assert.deepEqual(await errors(states(cycle, 'operation pause() { wait 1ms; } optional port srv { requires operation ask() returns bool; }')), [], cycle);
    assert.deepEqual(await errors(states('state A { on entry { n = n + 1; } on exit { log = 1; } when (true) to B { quiet(); } } state B { when (true) to A { } }', 'operation quiet() { n = 0; }')), [['SW2008', 'States A → B → A form a cycle of when (true) completion transitions.']]);
    // Only the first when (true) of a state is taken; a cycle through a later one, or through a guard that is not the literal true, is not static.
    assert.deepEqual(await errors(states('state A { on entry { n = n + 1; } when (true) to B { } when (true) to A { } } state B { on receive a.go() to A { } }')), []);
    assert.deepEqual(await errors(states('state A { on entry { n = n + 1; } when (n > 0 or true) to B { } } state B { on entry { n = n + 1; } when (n > 0) to A { } }')), []);
    // Names are spelled in the 2.2 quoting in the message.
    assert.deepEqual(await errors(states("state in { when (true) to 'Wait here' { } } state 'Wait here' { when (true) to in { } }", '', 'in')), [['SW2008', "States 'in' → 'Wait here' → 'in' form a cycle of when (true) completion transitions."]]);
});

test('WP5-S05 WP5-S07 reachability includes completion edges, internal transitions add none and are valid in any non-final state', async () => {
    assert.deepEqual(await errors(states('state A { on entry { n = 1; } when (n > 0) to B { } on receive a.x(v) { log = v; } } state B { after 1ms { n = 2; } on receive a.go() to C { } } final state C { }')), []);
    assert.deepEqual(await errors(states('state A { on receive a.x(v) { log = v; } after 1ms { } } state B { on receive a.go() to A { } }')), [['SW2008', 'Unreachable state B.']]);
});

test('WP5-S08 WP5-D05 WP5-D06 deferred members are required events or attributes the machine handles in some other state, once per state', async () => {
    const ports = 'port b: Q; port c { requires attribute level: int; provides attribute shown: int; requires event z(); } operation out() { send c.shown(1); }';
    const body = (state: string) => states(`${state} state H { on receive a.x(v) to A { } on receive c.level(v) to A { } after 1ms to F { } } final state F { }`, ports);
    assert.deepEqual((await errors(body('state A { defer a.x, c.level; on receive a.go() to H { } }'))).filter(([code]) => code === 'SW2008'), []);
    const all = await errors(body('state A { defer a.x, a.x, b.x, c.z, c.nope, c.shown; on receive a.go() to H { } on receive a.x(v) to F { } }'));
    assert.deepEqual(all.filter(([code]) => code === 'SW2008'), [
        ['SW2008', 'State A defers a.x and also handles it.'], ['SW2008', 'State A defers a.x twice.'], ['SW2008', 'State A defers a.x and also handles it.'],
        ['SW2008', 'b.x is not an input of run.'], ['SW2008', 'c.z is deferred, but no state of run handles it.'], ['SW2008', 'c.nope is not an input of run.'],
        ['SW2008', 'c.shown is not an input of run.']]);
});

test("WP5-S09 a deferral belongs to the machine's single input ownership (SW2005): never a second owner", async () => {
    const source = (entry: string) => states('state A { defer a.x; on receive a.go() to H { } } state H { on receive a.x(v) to A { } }', 'operation h(v: int) { }').replace('schedule { on start run(); }', `schedule { on start run(); ${entry} }`);
    assert.deepEqual((await allErrors(source(''))).filter(e => e[1].startsWith('a.x')), []);
    const two = await allErrors(source('on receive a.x(v) h(v);'));
    assert.ok(two.some(e => e[0] === 'SW2005' && e[1] === 'a.x needs exactly one input owner.'), JSON.stringify(two));
    // A member that only a deferral names is still owned by the machine, so no SW2005; it is unhandled (SW2008).
    const only = await allErrors(states('state A { defer a.y; on receive a.go() to A { } on receive a.x(v) to A { } }'));
    assert.deepEqual(only.filter(e => ['SW2005', 'SW2008'].includes(e[0])), [['SW2008', 'a.y is deferred, but no state of run handles it.']]);
});

test('WP5-D08 SW2017 warns on a completion guard that reads nothing the machine writes; WP6 confirms it for sampled cells (hook)', async () => {
    const message = 'Completion guard of A reads nothing that run writes; it cannot change while the machine waits.';
    const extra = 'operation tick() { n = n + 1; } operation set() { ok = true; } operation flag() returns bool { return ok; }';
    const warn = (body: string) => warnings(machine(body, extra).replace('schedule { on start run(); }', 'schedule { on start run(); on every 1ms tick(); }'));
    // n is written only by tick, another operation: the guard is not re-evaluated when it changes.
    assert.deepEqual(await warn('state A { when (n > 2) to B { } } final state B { }'), [['SW2017', message]]);
    assert.deepEqual(await warn('state A { when (ok and n > 0) to B { } after 1ms to C { } } state C { after 1ms to A { } } final state B { }'), [['SW2017', message]]);
    // Written by the machine: its entry action, an exit action, a transition effect, an internal effect or a callee.
    assert.deepEqual(await warn('state A { on entry { n = n + 1; } when (n > 2) to B { } } final state B { }'), []);
    assert.deepEqual(await warn('state A { on receive a.x(v) { log = v; } when (log > 2) to B { } } final state B { }'), []);
    assert.deepEqual(await warn('state A { on exit { ok = true; } after 1ms to C { } when (flag()) to B { } } state C { after 1ms to A { } } final state B { }'), []);
    assert.deepEqual(await warn('state A { on entry { set(); } when (flag()) to B { } } final state B { }'), []);
    // A literal true never waits and is not reported (review L1): nor is a guard that is constant after folding, true or false.
    assert.deepEqual(await warn('state A { when (true) to B { } } final state B { }'), []);
    for (const guard of ['1 == 1', 'not false', 'false', '(2 > 1) and not (1 == 2)'])
        assert.deepEqual(await warn(`state A { when (${guard}) to B { } after 1ms to B { } } final state B { }`), [], guard);
    // A guard that already has an error gets no SW2017 besides it: a writing callee, now() through a callee, a request.
    const faulty = 'operation bump() returns bool { n = n + 1; return true; } operation late() returns bool { return Swaml::Time::now() > 1ms; } optional port srv { requires operation ask() returns bool; }';
    for (const guard of ['bump()', 'late()', 'srv.ask()']) {
        const all = (await parse(machine(`state A { when (${guard}) to B { } after 1ms to B { } } final state B { }`, faulty))).doc.diagnostics ?? [];
        assert.ok(all.some(d => d.severity === 1) && !all.some(d => d.code === 'SW2017'), `${guard}: ${JSON.stringify(all.map(d => [d.code, d.message]))}`);
    }
    // The polling pattern: a state that re-enters itself through its own timer or receive transition evaluates the
    // guard again after each wait, so it is not reported; a timer to another state still is (above).
    assert.deepEqual(await warn('state A { after 20ms to A { } when (n > 2) to B { } } final state B { }'), []);
    assert.deepEqual(await warn('state A { on receive a.go() to A { } when (n > 2) to B { } } final state B { }'), []);
    assert.deepEqual(await warn('state A { after 20ms { } when (n > 2) to B { } } final state B { }'), [['SW2017', message]]);
});

test('WP5-D09 SW2018 warns on a deferred event whose route into the occurrence rejects on overflow, once per connection', async () => {
    const source = (policy: string, member = 'a.x') => machine(`state A { defer ${member}; on receive a.go() to H { } } state H { on receive a.x(v) to A { } on receive a.y(v) to A { } }`, '', 'operation emit() { }', policy);
    const advice = (connection: string) => ` Give ${connection} a policy that drops on overflow (Overflow.dropOldest or Overflow.dropNewest) or a capacity that holds the retained messages.`;
    // The library default rejects on overflow, so a deferral over a plain connect warns (review L3).
    assert.deepEqual(await warnings(source('')), [['SW2018', 'a.x is deferred in A, but policy Default of connect (s.q, m.a) rejects on overflow; a full queue fails the sender.' + advice('connect (s.q, m.a)')]]);
    assert.deepEqual(await warnings(source(': Swaml::Qos::Reliable')), [['SW2018', 'a.x is deferred in A, but policy Reliable of connect (s.q, m.a) rejects on overflow; a full queue fails the sender.' + advice('connect (s.q, m.a)')]]);
    assert.deepEqual(await warnings(source(' link: Swaml::Qos::Reliable')), [['SW2018', 'a.x is deferred in A, but policy Reliable of link rejects on overflow; a full queue fails the sender.' + advice('link')]]);
    // A deferral that already has an error gets no SW2018 besides it: in a final state, deferred and handled, twice, or never handled.
    const erroneous = machine('state A { defer a.x, a.x; on receive a.go() to H { } } state H { defer a.go; on receive a.go() to F { } on receive a.x(v) to A { } } final state F { defer a.x; } state Z { defer a.y; on receive a.go() to A { } }');
    const r = await parse(erroneous);
    const lines = erroneous.split('\n'), line = lines.findIndex(l => l.includes('defer a.x, a.x'));
    // Only the first listing of a.x in A warns: the second is the duplicate, H defers what it handles, F is final, a.y is unhandled.
    assert.deepEqual((r.doc.diagnostics ?? []).filter(d => d.code === 'SW2018').map(d => [d.range.start.line, d.range.start.character]), [[line, lines[line].indexOf('a.x')]]);
    assert.deepEqual(await warnings(source(': Swaml::Qos::Latest')), []);
    assert.deepEqual(await warnings(source(': Swaml::Qos::BestEffort')), []);
});

test('WP5-D08 WP5-D09 SW2017 and SW2018 are impossible on 2.2 sources: they need a completion guard or a deferral', async () => {
    // The 2.2 counterparts: a receive guard reading another operation's attribute, an unhandled member on a rejecting route.
    const source = machine('state A { on receive a.x(v) when (n > 2) to B { } on receive a.go() to A { } } state B { on receive a.y(v) to A { } }', 'operation tick() { n = n + 1; }').replace('schedule { on start run(); }', 'schedule { on start run(); on every 1ms tick(); }');
    assert.deepEqual(await warnings(source), []);
    const corpus = readFileSync(new URL('test/fixtures/compatibility-2-2/resolution.json', root), 'utf8');
    assert.ok(!/SW2017|SW2018/.test(corpus));
});

// ---------------------------------------------------------------- runtime rules

const go = 'publish q.go();';
test('WP5-R01 selection order: completion before an elapsed timer before input, after the entry actions', async () => {
    // Entry suspends past the 1 ms timer while go arrives at 1 ms; on resumption completion is evaluated first.
    const body = (guard: string) => `state A { on entry { wait 2ms; n = 1; } when (${guard}) to B { log = 1; } after 1ms to C { log = 2; } on receive a.go() to D { log = 3; } }
      state B { after 1ms to A { } } state C { after 1ms to A { } } state D { after 1ms to A { } }`;
    const sender = `operation emit() { wait 1ms; ${go} }`;
    const first = await runOf(machine(body('n == 1'), '', sender), 2500000);
    // go arrived during the entry action and stays queued; the chain ends in B, which neither handles nor defers it, so it
    // is discarded there (WP5-R13; 2.2 logs the removal as deliver, then discardInput).
    assert.deepEqual(story(first.trace), ['0 state A', '2000 write n=1', '2000 write log=1', '2000 state B', '2000 deliver m4', '2000 discardInput inactiveOwner 1']);
    const second = await runOf(machine(body('n == 2'), '', sender), 2500000);
    assert.deepEqual(story(second.trace), ['0 state A', '2000 write n=1', '2000 write log=2', '2000 state C', '2000 deliver m4', '2000 discardInput inactiveOwner 1']);
    const third = await runOf(machine(body('n == 2').replace('after 1ms to C', 'after 3ms to C'), '', sender), 2500000);
    assert.deepEqual(story(third.trace), ['0 state A', '2000 write n=1', '2000 deliver m4', '2000 write log=3', '2000 state D']);
});

test('WP5-R02 WP5-R05 WP5-T01 completion follows every internal reaction; an internal reaction runs only its effect and keeps the timers', async () => {
    const sender = 'operation emit() { wait 1ms; publish q.x(1); wait 1ms; publish q.x(2); wait 1ms; publish q.x(4); }';
    const out = await runOf(machine(`state A { on entry { log = log + 1; } on exit { log = log + 100; } on receive a.x(v) { n = n + v; } when (n >= 3) to B { } after 5ms to C { } }
      state B { on entry { log = log + 10; } on receive a.x(v) { n = n + v; } after 1ms to C { } }
      final state C { }`, '', sender));
    // A's 5 ms timer never fires; B's timer, armed at its entry at 2 ms, is selected at 3 ms before the x offered then.
    assert.deepEqual(story(out.trace), ['0 state A', '0 write log=1', '1000 deliver m4', '1000 internal A 0/transitions/0', '1000 write n=1', '2000 deliver m5', '2000 internal A 0/transitions/0', '2000 write n=3',
        '2000 write log=101', '2000 state B', '2000 write log=111', '3000 state C', '3000 deliver m6', '3000 discardInput inactiveOwner 5']);
    const internal = kinds(out.trace, 'state').filter(t => t.internal);
    assert.deepEqual(internal.map(t => [t.subject, t.state, t.source, t.internal, t.activation]), [['m.run', 'A', 'Test::M.run/states/0/transitions/0', true, 'a1'], ['m.run', 'A', 'Test::M.run/states/0/transitions/0', true, 'a1']]);
    // The 2.2 state observation has no internal field.
    assert.ok(kinds(out.trace, 'state').filter(t => !t.internal).every(t => !('internal' in t)));
    assert.deepEqual([out.stores['m'], out.machines['m.run']], [{ log: 111, n: 3, ok: false }, { state: 'C', live: false }]);
});

test('WP5-R03 no completion after discardInput or discardTimer: neither changes anything the machine owns', async () => {
    const tick = 'operation tick() { wait 500us; n = 1; }';
    const sender = 'operation emit() { wait 1ms; publish q.x(1); wait 1ms; publish q.x(9); }';
    const source = (state: string) => machine(state, tick, sender).replace('schedule { on start run(); }', 'schedule { on start run(); on start tick(); }');
    const input = await runOf(source('state A { on receive a.x(v) when (v > 5) to C { } when (n > 0) to B { } } state B { after 1ms to C { } } final state C { }'));
    // n became 1 at 0.5 ms, but the discard at 1 ms evaluates no completion: the machine stays in A until x(9).
    assert.deepEqual(story(input.trace), ['0 state A', '500 write n=1', '1000 deliver m5', '1000 discardInput noEnabledTransition 1', '2000 deliver m6', '2000 state C']);
    const timer = await runOf(source('state A { after 1ms when (n > 5) to C { } when (n > 0) to B { } on receive a.x(v) when (v > 5) to C { } } state B { after 1ms to C { } } final state C { }'));
    assert.deepEqual(story(timer.trace), ['0 state A', '500 write n=1', '1000 discardTimer A 0/transitions/0 guard', '1000 deliver m5', '1000 discardInput noEnabledTransition 1', '2000 deliver m6', '2000 state C']);
});

test('WP5-R04 WP5-T02 a false timer guard consumes the timer for this entry; the next equal expiry is tried; later timers stay armed; re-entry re-arms', async () => {
    const equal = await runOf(machine('state A { after 1ms when (n > 0) to B { } after 1ms to C { } after 2ms to B { } } final state B { } final state C { }'));
    assert.deepEqual(story(equal.trace), ['0 state A', '1000 discardTimer A 0/transitions/0 guard', '1000 state C']);
    const d = kinds(equal.trace, 'discardTimer')[0];
    assert.deepEqual(d, { timeNs: 1000000, ordinal: d.ordinal, kind: 'discardTimer', subject: 'm.run', activation: 'a1', state: 'A', source: 'Test::M.run/states/0/transitions/0', reason: 'guard' });
    const later = await runOf(machine('state A { after 1ms when (n > 0) to B { } after 1ms when (ok) to C { } after 2ms to D { } } final state B { } final state C { } final state D { }'));
    assert.deepEqual(story(later.trace), ['0 state A', '1000 discardTimer A 0/transitions/0 guard', '1000 discardTimer A 0/transitions/1 guard', '2000 state D']);
    const rearmed = await runOf(machine('state A { after 1ms when (n > 0) to B { } after 3ms to A { n = n + 1; } } final state B { }'));
    assert.deepEqual(story(rearmed.trace), ['0 state A', '1000 discardTimer A 0/transitions/0 guard', '3000 write n=1', '3000 state A', '4000 state B']);
});

test('WP5-R05 WP5-S10 an internal timer fires once per entry and leaves the other timers armed; an explicit self transition restarts them', async () => {
    const once = await runOf(machine('state A { after 1ms { n = n + 1; } after 1ms when (n == 1) to B { } after 5ms to C { } } final state B { } final state C { }'));
    // C22: the equal-expiry timer is selected after the completion evaluation that follows the internal reaction.
    assert.deepEqual(story(once.trace), ['0 state A', '1000 internal A 0/transitions/0', '1000 write n=1', '1000 state B']);
    const kept = await runOf(machine('state A { after 1ms { n = n + 1; } after 3ms to B { } } final state B { }'));
    assert.deepEqual(story(kept.trace), ['0 state A', '1000 internal A 0/transitions/0', '1000 write n=1', '3000 state B']);
    // A self transition exits, runs its effect, updates and enters again: timers restart from the new entry (2.2).
    const self = await runOf(machine('state A { on entry { log = log + 1; } on exit { log = log + 10; } after 2ms to B { } on receive a.x(v) to A { n = n + v; } } final state B { }', '', 'operation emit() { wait 1ms; publish q.x(5); }'));
    assert.deepEqual(story(self.trace), ['0 state A', '0 write log=1', '1000 deliver m4', '1000 write log=11', '1000 write n=5', '1000 state A', '1000 write log=12', '3000 write log=22', '3000 state B']);
});

test('WP5-R06 a suspended entry action or internal effect keeps the timers; on resumption completion comes first, then elapsed timers, then input', async () => {
    const sender = 'operation emit() { wait 500us; publish q.x(1); wait 1ms; publish q.go(); }';
    const out = await runOf(machine('state A { on receive a.x(v) { wait 3ms; n = n + v; } when (n > 5) to C { } after 2ms to B { } on receive a.go() to C { } } final state B { } final state C { }', '', sender));
    // The effect resumes at 3.5 ms: completion (false), then the timer that expired at 2 ms, before the go queued at 1.5 ms.
    assert.deepEqual(story(out.trace), ['0 state A', '500 deliver m4', '500 internal A 0/transitions/0', '3500 write n=1', '3500 state B', '3500 deliver m5', '3500 discardInput inactiveOwner 3']);
});

test('WP5-R07 WP5-T04 WP5-R12 CompletionLoop: a zero-time counting loop through completion is a violation that fails the case; a retry that suspends is not', async () => {
    const counting = await runOf(machine('state A { on entry { n = n + 1; } when (n < 3) to A { } when (n >= 3) to B { } } final state B { }'));
    assert.equal(counting.status, 'violation');
    assert.deepEqual(story(counting.trace), ['0 state A', '0 write n=1', '0 violation CompletionLoop m.run Test::M.run/states/0/transitions/0']);
    const v = kinds(counting.trace, 'violation')[0];
    assert.deepEqual([v.subject, v.code, v.source], ['m.run', 'CompletionLoop', 'Test::M.run/states/0/transitions/0']);
    // Two states: A -> B -> A within one instant without a restart.
    const pair = await runOf(machine('state A { on entry { n = n + 1; } when (n < 3) to B { } when (n >= 3) to C { } } state B { when (n > 0) to A { log = 1; } } final state C { }'));
    assert.deepEqual(story(pair.trace), ['0 state A', '0 write n=1', '0 state B', '0 write log=1', '0 violation CompletionLoop m.run Test::M.run/states/1/transitions/0']);
    // A retry whose entry suspends on a request in every round is bounded: no violation.
    const retry = machine(`state Try { on entry { ok = srv.attempt(); n = n + 1; } when (not ok and n < 3) to Try { } when (ok or n >= 3) to Done { } } final state Done { }`,
        'port srv { requires operation attempt() returns bool; }', 'operation emit() { }', '', 'Try').replace('component m: M;', `component def Srv { port p { provides operation attempt() returns bool; } attribute calls: int = 0; operation answer() returns bool { calls = calls + 1; wait 1ms; return calls >= 3; } schedule { on call p.attempt() answer(); } }
  component m: M;
  component srv: Srv;
  connect (srv.p, m.srv);`);
    const r = await runOf(retry);
    assert.equal(r.status, 'quiescent', JSON.stringify(story(r.trace)));
    assert.deepEqual([r.stores['m'], r.machines['m.run']], [{ log: 0, n: 3, ok: true }, { state: 'Done', live: false }]);
    // An entry that suspends only in its first round: the second round re-enters without a restart and is a violation.
    const once = await runOf(machine('state A { on entry { if (n == 0) { wait 1ms; } n = n + 1; } when (n < 5) to A { } when (n >= 5) to B { } } final state B { }'));
    assert.deepEqual(story(once.trace), ['0 state A', '1000 write n=1', '1000 state A', '1000 write n=2', '1000 violation CompletionLoop m.run Test::M.run/states/0/transitions/0']);
    // A case fails on it with the violation, not inconclusive at the step limit.
    const r2 = await valid(machine('state A { on entry { n = n + 1; } when (n < 3) to A { } when (n >= 3) to B { } } final state B { }').replace('  connect (s.q, m.a);', '  connect (s.q, m.a);\n  test Loop of m { wait 1ms; }'));
    const c = runCase([r2.model], 'Test::Loop', { untilNs: 10000000 });
    assert.deepEqual([c.result, c.message], ['fail', 'Contract violation CompletionLoop.']);
});

test('WP5-R08 WP5-T03 retention keeps input queued with its policy: one defer per message, overflow, maxAge and latest attributes observable', async () => {
    const qos = (settings: string) => `qos def Q2: Swaml::Qos::Policy { delivery = Swaml::Qos::Delivery.atMostOnce; ordering = Swaml::Qos::Ordering.fifo; requestTimeout = 1s; ${settings} }`;
    const body = 'state Busy { defer a.x; on receive a.go() to Free { } } state Free { on receive a.x(v) { log = log * 10 + v; } on receive a.go() to Busy { } }';
    const sender = 'operation emit() { publish q.x(1); wait 1ms; publish q.x(2); wait 1ms; publish q.x(3); wait 5ms; publish q.go(); }';
    const policy = (settings: string) => machine(body, '', sender, ': Q2', 'Busy').replace('  component m: M;', `  ${qos(settings)}\n  component m: M;`);
    const drop = await runOf(policy('capacity = 2; overflow = Swaml::Qos::Overflow.dropOldest;'), 20000000);
    assert.deepEqual(story(drop.trace), ['0 state Busy', '0 defer Busy a.x m4', '1000 defer Busy a.x m5', '2000 overflow dropOldest x', '2000 defer Busy a.x m6', '7000 deliver m7', '7000 state Free', '7000 deliver m5', '7000 internal Free 1/transitions/0', '7000 write log=2', '7000 deliver m6', '7000 internal Free 1/transitions/0', '7000 write log=23']);
    const d = kinds(drop.trace, 'defer')[0];
    assert.deepEqual(d, { timeNs: 0, ordinal: d.ordinal, kind: 'defer', subject: 'm.run', activation: 'a1', state: 'Busy', member: 'a.x', source: 'Test::S.emit/0', message: 'm4' });
    // reject: the sender's third offer fails (SW2018 warns about this policy).
    const reject = await runOf(policy('capacity = 2; overflow = Swaml::Qos::Overflow.reject;'), 20000000);
    assert.deepEqual(kinds(reject.trace, 'failure').map(t => [t.subject, t.reason]), [['s.emit', 'rejected']]);
    const aged = await runOf(policy('capacity = 4; overflow = Swaml::Qos::Overflow.dropOldest; maxAge = 6ms;'), 20000000);
    assert.deepEqual(story(aged.trace).filter(x => /discardAge|deliver|write/.test(x)), ['7000 discardAge m4', '7000 deliver m7', '7000 deliver m5', '7000 write log=2', '7000 deliver m6', '7000 write log=23']);
    // A retained attribute keeps only its latest value.
    const attribute = machine('state Busy { defer a.level; on receive a.go() to Free { } } state Free { on receive a.level(v) { log = v; } }', '', 'operation emit() { send q.level(1); wait 1ms; send q.level(2); wait 1ms; publish q.go(); }', '', 'Busy')
        .replace('requires event go(); }', 'requires event go(); requires attribute level: int; }').replace('provides event go(); }', 'provides event go(); provides attribute level: int; }');
    const latest = await runOf(attribute);
    assert.deepEqual(story(latest.trace), ['0 state Busy', '0 send', '0 defer Busy a.level m4', '1000 send', '1000 replaceAttribute', '1000 defer Busy a.level m5', '2000 deliver m6', '2000 state Free', '2000 deliver m5', '2000 internal Free 1/transitions/0', '2000 write log=2']);
    assert.deepEqual(kinds(latest.trace, 'replaceAttribute').map(t => t.timeNs), [1000000]);
});

test('WP5-R09 retained input is consumed in global offer-ordinal order across queues, before input that was never retained (review counterexample)', async () => {
    // The y queue exists from t=0 (a y discarded in Init); x is offered at 1 ms and y at 2 ms, both retained in Busy.
    // On entering Both, x (offered first) is delivered before y, although the y queue was created first.
    const sender = 'operation emit() { publish q.y(0); wait 1ms; publish q.x(1); wait 1ms; publish q.y(2); wait 1ms; publish q.go(); }';
    const out = await runOf(machine(`state Init { after 500us to Busy { } }
      state Busy { defer a.x, a.y; on receive a.go() to Both { } }
      state Both { on receive a.x(v) { log = log * 10 + v + 1; } on receive a.y(v) { log = log * 10 + v + 1; } on receive a.go() to Busy { } }`, '', sender, '', 'Init'));
    assert.deepEqual(story(out.trace), ['0 state Init', '0 deliver m4', '0 discardInput inactiveOwner 0', '500 state Busy', '1000 defer Busy a.x m5', '2000 defer Busy a.y m6', '3000 deliver m7', '3000 state Both',
        '3000 deliver m5', '3000 internal Both 2/transitions/0', '3000 write log=2', '3000 deliver m6', '3000 internal Both 2/transitions/1', '3000 write log=23']);
    // Retained input precedes input that was never retained: go, queued during Both's entry, waits behind both, although
    // its queue was created first (a go discarded at t=0).
    const before = 'operation emit() { publish q.go(); wait 1ms; publish q.x(1); wait 2ms; publish q.go(); wait 500us; publish q.go(); }';
    const ordered = await runOf(machine(`state Init { after 500us to Busy { } }
      state Busy { defer a.x; on receive a.go() to Both { } }
      state Both { on entry { wait 1ms; } on receive a.go() to Init { log = 9; } on receive a.x(v) { log = v; } }`, '', before, '', 'Init'));
    assert.deepEqual(story(ordered.trace), ['0 state Init', '0 deliver m4', '0 discardInput inactiveOwner 0', '500 state Busy', '1000 defer Busy a.x m5', '3000 deliver m6', '3000 state Both',
        '4000 deliver m5', '4000 internal Both 2/transitions/1', '4000 write log=1', '4000 deliver m7', '4000 write log=9', '4000 state Init', '4500 state Busy']);
});

test('WP5-R08 WP5-R09 WP5-T03 input is retained from the first instant it is deliverable in a deferring state, waiting or running an action: offer order in every shape (review D1)', async () => {
    // y at 0 ms is consumed in A, which creates the y queue first; x follows at 1 ms and y at 2 ms. Both handles x as *10+1
    // and y as *10+2, so offer order gives 912 and queue-creation order 921.
    const yx = 'operation emit() { publish q.y(0); wait 1ms; publish q.x(0); wait 1ms; publish q.y(0); }';
    const both = 'state Both { on receive a.x(v) to Both { log = log * 10 + 1; } on receive a.y(v) to Both { log = log * 10 + 2; } }';
    const busy = (state: string) => machine(`state A { on receive a.y(v) to Busy { log = 9; } } ${state} ${both}`, '', yx);
    const offer = ['0 state A', '0 deliver m4', '0 write log=9', '0 state Busy', '1000 defer Busy a.x m5', '2000 defer Busy a.y m6', '5000 state Both',
        '5000 deliver m5', '5000 write log=91', '5000 state Both', '5000 deliver m6', '5000 write log=912', '5000 state Both'];
    // Busy waits at its selection (D1a); Busy never waits: its entry suspends, then completion (D1b); its entry outlasts its timer (D1c).
    for (const state of ['state Busy { defer a.x, a.y; after 5ms to Both { } }', 'state Busy { defer a.x, a.y; on entry { wait 5ms; } when (true) to Both { } }',
        'state Busy { defer a.x, a.y; on entry { wait 5ms; } after 4ms to Both { } }']) {
        const out = await runOf(busy(state), 10000000);
        assert.deepEqual(story(out.trace), offer, state);
    }
    // The 2.2 shape (no defer) keeps the 2.2 queue walk: queue-creation order and no defer observation.
    const old = await runOf(busy('state Busy { on entry { wait 5ms; } after 4ms to Both { } }'), 10000000);
    assert.deepEqual(story(old.trace), ['0 state A', '0 deliver m4', '0 write log=9', '0 state Busy', '5000 state Both', '5000 deliver m6', '5000 write log=92', '5000 state Both', '5000 deliver m5', '5000 write log=921', '5000 state Both']);
    // A message that arrives during a suspended entry action of a deferring state is retained then, once (review D7i).
    const entry = await runOf(machine('state A { defer a.x; on entry { wait 5ms; } when (true) to H { } } state H { on receive a.x(v) to H { log = v; } }', '', 'operation emit() { wait 1ms; publish q.x(6); }'), 10000000);
    assert.deepEqual(story(entry.trace), ['0 state A', '1000 defer A a.x m4', '5000 state H', '5000 deliver m4', '5000 write log=6', '5000 state H']);
    // Deliverable for the first time during the effect of a transition into a deferring state: the effect runs in A, which
    // neither defers nor waits, so both stay ordinary queued input until Busy is entered at 4 ms and retains them there.
    const into = await runOf(machine(`state A { on receive a.y(v) { log = 9; } after 1ms to Busy { wait 3ms; } }
      state Busy { defer a.x, a.y; on entry { wait 2ms; } when (true) to Both { } } ${both}`, '', 'operation emit() { publish q.y(0); wait 2ms; publish q.x(0); wait 1ms; publish q.y(0); }'), 10000000);
    assert.deepEqual(story(into.trace), ['0 state A', '0 deliver m4', '0 internal A 0/transitions/0', '0 write log=9', '4000 state Busy', '4000 defer Busy a.y m6', '4000 defer Busy a.x m5',
        '6000 state Both', '6000 deliver m5', '6000 write log=91', '6000 state Both', '6000 deliver m6', '6000 write log=912', '6000 state Both']);
    // Deliverable during the effect of a transition out of a deferring state: Busy is still current, so it is retained.
    const out = await runOf(machine(`state Busy { defer a.x, a.y; after 1ms to Both { wait 4ms; } } ${both}`, '', 'operation emit() { publish q.y(0); wait 2ms; publish q.x(0); wait 1ms; publish q.y(0); }', '', 'Busy'), 10000000);
    assert.deepEqual(story(out.trace), ['0 state Busy', '0 defer Busy a.y m4', '2000 defer Busy a.x m5', '3000 defer Busy a.y m6', '5000 state Both', '5000 deliver m4', '5000 write log=2',
        '5000 state Both', '5000 deliver m5', '5000 write log=21', '5000 state Both', '5000 deliver m6', '5000 write log=212', '5000 state Both']);
});

test('WP5-R08 a retained head older than its maxAge is discarded before the queues are walked in the 2.2 order', async () => {
    // With 1 ms latency, x (offered at 0 ms, retained at 1 ms) ages past 3 ms with no event until z(2) becomes deliverable at
    // 4 ms. The z queue is older than the x queue, yet the aged retained head is discarded first.
    const source = machine('state Busy { defer a.x; on entry { wait 10ms; } on receive a.go() to H { } } state H { on receive a.x(v) { log = v; } }', '', 'operation emit() { publish q.x(1); wait 3ms; }', '', 'Busy')
        .replace('  component m: M;', `  qos def Young: Swaml::Qos::Policy { delivery = Swaml::Qos::Delivery.atMostOnce; ordering = Swaml::Qos::Ordering.fifo; requestTimeout = 1s; capacity = 4; overflow = Swaml::Qos::Overflow.dropOldest; maxAge = 3ms; }
  port def ZP { requires event z(n: int); }
  port def ZQ { provides event z(n: int); }
  component def Z { port q: ZQ; operation emit() { publish q.z(1); wait 3ms; publish q.z(2); } schedule { on start emit(); } }
  component def RZ { port b: ZP; attribute got: int = 0; operation take(v: int) { got = got * 10 + v; } schedule { on receive b.z(v) take(v); } }
  component z: Z;
  component rz: RZ;
  connect (z.q, rz.b);
  component m: M;`).replace('connect (s.q, m.a);', 'connect: Young (s.q, m.a);');
    const r = await valid(source);
    const out = simulate([r.model], 'Test', { untilNs: 20000000, latencyNs: 1000000 });
    assert.deepEqual(story(out.trace), ['0 state Busy', '1000 deliver m5', '1000 defer Busy a.x m6', '1000 write got=1', '4000 discardAge m6', '4000 deliver m8', '4000 write got=12']);
});

test('WP5-R07 the completion chain restarts at input and timer consumption and at entry, exit and effect suspension (exact stories)', async () => {
    // An internal reaction consumes input (or a timer): the chain restarts there, so A and B are entered once more before
    // the completion back into A closes a cycle (review D3d).
    const input = await runOf(machine('state A { when (true) to B { } } state B { on receive a.x(v) { n = n + 1; } when (n > 0) to A { } }', '', 'operation emit() { wait 1ms; publish q.x(0); }'));
    assert.deepEqual(story(input.trace), ['0 state A', '0 state B', '1000 deliver m4', '1000 internal B 1/transitions/0', '1000 write n=1', '1000 state A', '1000 state B', '1000 violation CompletionLoop m.run Test::M.run/states/1/transitions/1']);
    const timer = await runOf(machine('state A { when (true) to B { } } state B { after 1ms { n = n + 1; } when (n > 0) to A { } }'));
    assert.deepEqual(story(timer.trace), ['0 state A', '0 state B', '1000 internal B 1/transitions/0', '1000 write n=1', '1000 state A', '1000 state B', '1000 violation CompletionLoop m.run Test::M.run/states/1/transitions/1']);
    // An exit action or an effect that suspends restarts the chain: the two-state completion cycle progresses every 1 ms (review D3e, D3i).
    const exit = await runOf(machine('state A { on exit { wait 1ms; } when (n >= 0) to B { } } state B { when (n >= 0) to A { n = n + 1; } }'), 3500000);
    assert.deepEqual([exit.status, story(exit.trace)], ['horizon', ['0 state A', '1000 state B', '1000 write n=1', '1000 state A', '2000 state B', '2000 write n=2', '2000 state A', '3000 state B', '3000 write n=3', '3000 state A']]);
    const effect = await runOf(machine('state A { when (n >= 0) to B { } } state B { when (n >= 0) to A { wait 1ms; n = n + 1; } }'), 3500000);
    assert.deepEqual([effect.status, story(effect.trace)], ['horizon', ['0 state A', '0 state B', '1000 write n=1', '1000 state A', '1000 state B', '2000 write n=2', '2000 state A', '2000 state B', '3000 write n=3', '3000 state A', '3000 state B']]);
    // An entry action that suspends restarts the chain (review D3a).
    const entry = await runOf(machine('state A { on entry { n = n + 1; wait 1ms; } when (n < 3) to A { } when (n >= 3) to B { } } final state B { }'));
    assert.deepEqual([entry.status, story(entry.trace)], ['quiescent', ['0 state A', '0 write n=1', '1000 state A', '1000 write n=2', '2000 state A', '2000 write n=3', '3000 state B']]);
});

test('WP5-R09 WP5-T03 deferral across several states: one defer per message, kept until a handling state, never handled stays queued', async () => {
    const sender = 'operation emit() { publish q.x(5); wait 3ms; publish q.go(); }';
    const out = await runOf(machine(`state A { defer a.x; after 1ms to B { } } state B { defer a.x; after 1ms to A2 { } } state A2 { defer a.x; on receive a.go() to H { } }
      state H { on receive a.x(v) to F { log = v; } } final state F { }`, '', sender));
    assert.deepEqual(story(out.trace), ['0 state A', '0 defer A a.x m4', '1000 state B', '2000 state A2', '3000 deliver m5', '3000 state H', '3000 deliver m4', '3000 write log=5', '3000 state F']);
    // A machine that never leaves its deferring states keeps the message queued: no deliver, no discard, one defer.
    const never = await runOf(machine('state A { defer a.x; on receive a.go() to A { } after 1s to H { } } state H { on receive a.x(v) to A { } }', '', 'operation emit() { publish q.x(5); wait 1ms; publish q.go(); }'));
    assert.deepEqual(kinds(never.trace, 'defer', 'deliver', 'discardInput').map(t => t.kind + ' ' + (t.message ?? '')), ['defer m4', 'deliver m5']);
});

test('WP5-R10 retained input is discarded with inactiveOwner at the next wait in a state that neither handles nor defers it', async () => {
    const out = await runOf(machine('state A { defer a.x; on receive a.go() to N { } } state N { on entry { wait 1ms; } on receive a.go() to H { } } state H { on receive a.x(v) to A { log = v; } }', '', 'operation emit() { publish q.x(5); wait 1ms; publish q.go(); }'));
    assert.deepEqual(story(out.trace), ['0 state A', '0 defer A a.x m4', '1000 deliver m5', '1000 state N', '2000 deliver m4', '2000 discardInput inactiveOwner 0']);
});

test('WP5-R13 input queued during entry actions or a completion chain is selected in the state the chain reaches', async () => {
    const sender = 'operation emit() { wait 500us; publish q.x(7); }';
    const chain = (end: string) => machine(`state A { on entry { wait 1ms; n = 1; } when (n == 1) to B { } } state B { on entry { n = 2; } when (n == 2) to C { } } ${end}`, '', sender);
    const taken = await runOf(chain('state C { on receive a.x(v) to D { log = v; } } final state D { }'));
    assert.deepEqual(story(taken.trace), ['0 state A', '1000 write n=1', '1000 state B', '1000 write n=2', '1000 state C', '1000 deliver m4', '1000 write log=7', '1000 state D']);
    const discarded = await runOf(chain('state C { after 1ms to D { } } state D { on receive a.x(v) to C { } }'));
    assert.deepEqual(story(discarded.trace).slice(0, 7), ['0 state A', '1000 write n=1', '1000 state B', '1000 write n=2', '1000 state C', '1000 deliver m4', '1000 discardInput inactiveOwner 1']);
});

test('WP5-R11 a 2.2 machine selects exactly as in 2.2 and adds no WP5 observation or field', async () => {
    const out = await runOf(machine(`state A { on entry { wait 1ms; } after 500us to B { log = 1; } on receive a.x(v) when (v > 1) to B { log = v; } on receive a.x(v) to A { n = n + 1; } }
      state B { on exit { wait 1ms; } after 1ms to A { } on receive a.go() to A { } }`, '', 'operation emit() { publish q.x(1); wait 3ms; publish q.x(5); publish q.go(); wait 1ms; publish q.x(0); }'), 10000000);
    assert.ok(out.trace.every(t => !['defer', 'discardTimer'].includes(t.kind) && !('internal' in t)), JSON.stringify(out.trace.filter(t => ['defer', 'discardTimer'].includes(t.kind) || 'internal' in t)));
    assert.ok(kinds(out.trace, 'violation').every(t => t.subject === 'Test'));
});

test('WP5-R08 WP5-R09 deferral in a multiplicity family: each member has its own machine, queues and retention', async () => {
    const source = machine('state A { defer a.x; on receive a.go() to H { } } state H { on receive a.x(v) to A { log = log + v; } }', '', 'operation emit() { publish q.x(1); publish q.x(2); wait 1ms; publish q.go(); }')
        .replace('  component m: M;\n  component s: S;\n  connect (s.q, m.a);', '  component def Sys { component m: M[2]; component s: S[2]; connect (s[0].q, m[0].a); connect (s[1].q, m[1].a); }\n  component sys: Sys;');
    const out = await runOf(source);
    assert.deepEqual(kinds(out.trace, 'defer').map(t => t.subject), ['sys.m[0].run', 'sys.m[1].run', 'sys.m[0].run', 'sys.m[1].run']);
    // Each member takes go, then its first retained x: 1, and keeps the second retained in A again.
    assert.deepEqual([out.stores['sys.m[0]'].log, out.stores['sys.m[1]'].log, out.machines['sys.m[0].run'].state, out.machines['sys.m[1].run'].state], [1, 1, 'A', 'A']);
});

test('WP5 interactions: computed timers are not re-evaluated by internal reactions; places and conditionals in guards and effects; no interrupt regions', async () => {
    const timer = await runOf(machine('state A { after (n * 1ms + 2ms) to B { } on receive a.x(v) { n = n + v; } } final state B { }', '', 'operation emit() { wait 1ms; publish q.x(5); }'));
    // One timer observation at entry: the internal reaction at 1 ms does not re-evaluate it, so it still expires at 2 ms.
    assert.deepEqual(story(timer.trace), ['0 state A', '0 timer A 2000000', '1000 deliver m4', '1000 internal A 0/transitions/1', '1000 write n=5', '2000 state B']);
    const places = await runOf(machine(`state A { on entry { slots[1] = if (n == 0) 4 else 5; } when (slots[1] > 3 and (if (ok) false else true)) to B { slots[0] = slots[1] * 2; } }
      state B { on receive a.x(v) { slots[v] = v; } after 1ms to C { } } final state C { }`, 'attribute slots: int[2] = [0, 0];', 'operation emit() { publish q.x(1); }'));
    assert.deepEqual(places.stores['m'].slots, [8, 1]);
    // Interrupt regions cannot occur in stateful operations (2.2, SW2006), in internal effects neither.
    assert.deepEqual(await errors(machine('state A { on receive a.x(v) { interruptible { wait 5ms; } on receive a.go() { n = 2; } } after 3ms to B { } } final state B { }')), [['SW2006', 'Interrupt regions cannot occur in stateful operations.']]);
});

test('WP5-R05 WP5-R07 the stale-read analysis treats an internal reaction as its effect only and a completion reaction as exit, effect and entry', async () => {
    const stale = 'A read before suspension may influence this write. Recheck live attributes after resuming.';
    const extra = 'operation tick() { n = n + 1; }';
    const source = (transition: string) => machine(`state A { on exit { wait 1ms; } ${transition} } state B { after 1ms to A { } }`, extra).replace('schedule { on start run(); }', 'schedule { on start run(); on every 1ms tick(); }');
    // The guard reads n; with an exit that suspends before the effect writes, the external reaction is stale.
    assert.deepEqual(await warnings(source('on receive a.x(v) when (n > 0) to B { log = 1; }')), [['SW2011', stale]]);
    assert.deepEqual(await warnings(source('on receive a.x(v) when (n > 0) { log = 1; } after 1ms to B { }')), []);
    assert.deepEqual((await warnings(source('on receive a.x(v) to B { } when (n > 0) to B { log = 1; }'))).filter(([code]) => code === 'SW2011'), [['SW2011', stale]]);
});

// ---------------------------------------------------------------- model, projection, formatter and tools

test('WP5-M01 WP5-M03 projections: completion edges labelled with their guard, internal reactions on their state without an edge, deferrals as state annotations', async () => {
    const r = await valid(machine(`state A { defer a.x; on receive a.go() { n = n + 1; } after 1ms when (n > 1) { } on receive a.go() when (n > 5) to B { } when (n > 2) to B { } after (n * 1ms) when (ok) to B { } }
      state B { on receive a.x(v) to A { } }`));
    const p = projectModel([r.model]);
    const edges = p.edges.filter(e => e.kind === 'transition' && e.source.startsWith('Test::M.'));
    assert.deepEqual(edges.map(e => [e.source, e.target, e.label, e.order, e.completion ?? null, e.guard ?? null]), [
        ['Test::M.run.A', 'Test::M.run.B', 'on receive a.go', 2, null, null],
        ['Test::M.run.A', 'Test::M.run.B', 'when (n > 2)', 3, true, null],
        ['Test::M.run.A', 'Test::M.run.B', 'after (n * 1ms)', 4, null, 'ok'],
        ['Test::M.run.B', 'Test::M.run.A', 'on receive a.x', 0, null, null]]);
    assert.ok(p.edges.every(e => !e.target.endsWith('undefined')));
    const stateA = p.nodes.find(n => n.id === 'Test::M.run.A')!, stateB = p.nodes.find(n => n.id === 'Test::M.run.B')!;
    assert.deepEqual([stateA.reactions, stateA.deferrals], [[{ label: 'on receive a.go', order: 0 }, { label: 'after 1ms', order: 1, guard: 'n > 1' }], ['a.x']]);
    assert.ok(!('reactions' in stateB) && !('deferrals' in stateB));
    // A 2.2 machine projects without the new fields (the 2.2 projection fixture of gate 1 is unchanged).
    const old = projectModel([(await valid(machine('state A { on receive a.go() to B { } after 1ms to B { } } state B { on receive a.x(v) to A { } }'))).model]);
    assert.ok(old.edges.every(e => !('completion' in e) && !('guard' in e)) && old.nodes.every(n => !('reactions' in n) && !('deferrals' in n)));
});

test('WP5-M04 the formatter prints completion and internal transitions, timer guards and defer lines in source order, idempotently', async () => {
    const source = machine(`state A {   defer   a.x ,a.y ;
 on receive a.go( ){ n = n + 1; }
    after 1ms   when(n>1){ }
  when( n > 2 )to B { }
  after ( n * 1ms ) when ( ok ) to B{ } }
      state B { on receive a.x(v) to A { } on receive a.y(v) to A { } }`);
    const r = await valid(source);
    const formatted = formatDocument(r.doc);
    assert.match(formatted, /\n {6}state A \{\n {8}defer a\.x, a\.y;\n {8}on receive a\.go\(\) \{\n {10}n = n \+ 1;\n {8}\}\n {8}after 1ms when \(n > 1\) \{\n {8}\}\n {8}when \(n > 2\) to B \{\n {8}\}\n {8}after \(n \* 1ms\) when \(ok\) to B \{\n {8}\}\n {6}\}/u, formatted);
    const again = await valid(formatted);
    assert.equal(formatDocument(again.doc), formatted);
});

test('WP5-G02 rename and references see deferred members; the KerML inventory maps Deferral as a lowering (WP5-M02)', async () => {
    const source = machine('state A { defer a.x; on receive a.go() to H { } } state H { on receive a.x(v) to A { } }');
    // Renaming the port (a member rename would break the structural compatibility with Q and is refused).
    const r = await valid(source), offset = source.indexOf('a: P;');
    const edit = await r.Swaml.lsp.RenameProvider!.rename(r.doc, { textDocument: { uri: r.doc.uri.toString() }, position: r.doc.textDocument.positionAt(offset), newName: 'defer' });
    const changes = (edit?.documentChanges ?? []).flatMap(c => 'edits' in c ? c.edits : []);
    const renamed = TextDocument.applyEdits(TextDocument.create('memory:///x.swaml', 'swaml', 0, source), changes.map(e => ('newText' in e ? e : { range: e.range, newText: '' }) as { range: never; newText: string }));
    assert.match(renamed, /defer defer\.x;/u);
    assert.match(renamed, /on receive defer\.x\(v\) to A/u);
    assert.match(renamed, /connect \(s\.q, m\.defer\);/u);
    await valid(renamed);
    const mapping = JSON.parse(readFileSync(new URL('spec/kerml-mapping.json', root), 'utf8')) as { mapping: { source: string; kind: string; semantic: string; normative: string }[] };
    const deferral = mapping.mapping.find(m => m.source === 'Deferral')!;
    assert.deepEqual([deferral.kind, deferral.normative], ['lowering', 'docs/spec/03-behavior.md']);
    assert.match(deferral.semantic, /state-scoped retention constraint/u);
    assert.match(mapping.mapping.find(m => m.source === 'Transition')!.semantic, /guard-only TransitionUsage without trigger/u);
});

test('WP5-S03 WP5-D08 attributeAccess sees reads, writes, out arguments and the clock through callees', async () => {
    const r = await valid(machine('state A { on entry { set(); } when (flag()) to B { } } final state B { }', 'operation set() { ok = true; get(n); } operation get(out v: int) { v = 1; } operation flag() returns bool { return ok and log > 0; }'));
    const def = r.model.packages[0].elements.find(a.isComponentDef)!;
    const run = def.members.find(m => a.isOperation(m) && m.name === 'run') as a.Operation;
    const entry = run.body.states[0].actions[0].body, guard = run.body.states[0].transitions[0].guard!;
    const written = attributeAccess([entry], def), read = attributeAccess([guard], def);
    assert.deepEqual([[...written.writes].sort(), [...read.reads].sort(), written.clock], [['n', 'ok'], ['log', 'ok'], false]);
});

// ---------------------------------------------------------------- examples and determinism

test('WP5 examples: session completion, lock deferral and breaker internal transitions pass their cases, deterministically', async () => {
    const expected: Record<string, string[]> = {
        'examples/44-session-completion.swaml': ['SessionCompletion::Opens after two refusals', 'SessionCompletion::Coverage loss during the request'],
        'examples/45-lock-deferral.swaml': ['LockDeferral::Requests during the pulse', 'LockDeferral::Request order across the pulse'],
        'examples/46-breaker-internal.swaml': ['BreakerInternal::Store outage trips the breaker and recovers'],
        'examples/47-reaction-forms.swaml': ['ReactionForms::Every form'],
    };
    for (const [file, cases] of Object.entries(expected)) {
        const r = await parse(readFileSync(new URL(file, root), 'utf8'));
        assert.deepEqual(r.doc.diagnostics?.map(d => [d.code, d.message]), [], file);
        for (const name of cases) {
            const first = runCase([r.model], name, { untilNs: 10000000000 }), second = runCase([r.model], name, { untilNs: 10000000000 });
            assert.equal(first.result, 'pass', `${name}: ${first.message}`);
            assert.equal(JSON.stringify(first.run?.trace), JSON.stringify(second.run?.trace), `${name} is deterministic`);
        }
    }
    // The observations that only the new forms produce appear in the examples that use them.
    const trace = async (file: string, name: string) => runCase([(await parse(readFileSync(new URL(file, root), 'utf8'))).model], name, { untilNs: 10000000000 }).run!.trace as Observation[];
    assert.deepEqual(kinds(await trace('examples/45-lock-deferral.swaml', 'LockDeferral::Requests during the pulse'), 'defer').map(t => [t.timeNs, t.subject, t.state]), [[100000000, 'deferring.control', 'locking'], [200000000, 'deferring.control', 'locking']]);
    // The 2.2 shape discards both; an inactive-owner discard names the member without its occurrence, as in 2.2.
    assert.deepEqual(kinds(await trace('examples/45-lock-deferral.swaml', 'LockDeferral::Requests during the pulse'), 'discardInput').map(t => [t.timeNs, t.subject]), [[100000000, 'requests.request'], [200000000, 'requests.request']]);
    assert.equal(kinds(await trace('examples/46-breaker-internal.swaml', 'BreakerInternal::Store outage trips the breaker and recovers'), 'state').filter(t => t.internal && t.subject === 'internal.circuit').length, 3 + 4);
});
