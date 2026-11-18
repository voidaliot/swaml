// States in the flow, package 1 (docs/proposals/STATES_IN_FLOW_PROPOSAL.md, SIF-G01): one word for conditions. A release
// guard is written if (g) after the call (the WP7 candidate spelling when (g) is a syntax error), and an if statement's
// else may be followed by another if (else if), which runs exactly as the 2.2 form else { if … } and has its own stable
// statement identities (…/otherwise/if).
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { AstUtils, type AstNode } from 'langium';
import { formatDocument } from '../../src/language/formatter.js';
import { projectModel } from '../../src/language/projection.js';
import { resolveStatement, statementIdentity } from '../../src/language/semantic.js';
import { suspendSite } from '../../src/language/placement.js';
import { semanticIndex } from '../../src/language/path-services.js';
import { viewCandidates } from '../../src/language/presentation.js';
import { simulate } from '../../src/simulation/simulator.js';
import type { Model } from '../../src/language/generated/ast.js';
import * as a from '../../src/language/generated/ast.js';
import { parse, valid, workspace } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
const root = new URL('../../../', import.meta.url);

/** A component C with attributes n, log, a, b and an operation f with the given body, released every 10 ms, and Demo. */
const model = (body: string, more = '') => `package Test {
  component def C {
    attribute n: int = 0;
    attribute log: int = 0;
    attribute a: bool = true;
    attribute b: bool = false;
    operation f() {
      n = n + 1;
      ${body}
    }
    ${more}
    schedule { on every 10ms f(); }
  }
  component Demo: C;
}
`;
const chain = 'if (n == 1) { log = 10; } else if (n == 2) { log = 20; } else if (n == 3) { log = 30; } else { log = 40; }';
const nested = 'if (n == 1) { log = 10; } else { if (n == 2) { log = 20; } else { if (n == 3) { log = 30; } else { log = 40; } } }';
const diagnostics = async (source: string) => ((await parse(source)).doc.diagnostics ?? []).map(d => `${d.severity} ${d.code} ${d.message}`);
const statementIdentities = (m: Model) => [...AstUtils.streamAst(m)].filter(n => n.$containerProperty === 'statements' && AstUtils.getContainerOfType(n, a.isOperation)).map(n => `${n.$type} ${statementIdentity(n)}`);

test('SIF-G01 a release guard is written if (g); when (g) on a schedule entry is a syntax error that names the spelling', async () => {
    const entry = (guard: string) => `package Test { component def C { attribute awake: bool = true; operation f() { } schedule { on every 10ms f() ${guard} deadline 2ms; } } component Demo: C; }`;
    const ok = await valid(entry('if (awake)'));
    const e = ok.model.packages[0].elements.filter(a.isComponentDef)[0].members.filter(a.isSchedule)[0].entries[0];
    assert.equal(e.guard?.$cstNode?.text, 'awake');
    assert.equal(e.deadline?.value, 2);
    const old = await parse(entry('when (awake)'));
    assert.deepEqual(old.errors.map(d => [d.code, d.message]), [['SW2000', "Expecting token of type ';' but found `when`. A release guard is written if (condition) after the call, as in f() if (ready) deadline 2ms."]]);
    // when keeps its 2.2 meaning in state machines: a guarded receive transition still parses and validates.
    await valid(`package Test { port def P { provides event e(v: int); } component def C { reversed port p: P; attribute k: int = 0;
      operation m() { initial A; state A { on receive p.e(v) when (v > 0) to B { k = v; } } final state B { } }
      schedule { on start m(); } } component def S { port p: P; } component Demo { component s: S; component c: C; connect (s.p, c.p); } }`);
});

test('SIF-G01 else if parses as an ElseIf holding one If; a chain nests to the right and a final else belongs to the last if', async () => {
    const { model: m } = await valid(model(chain));
    const op = m.packages[0].elements.filter(a.isComponentDef)[0].members.find(a.isOperation)!;
    const first = op.body.statements[1] as a.If;
    assert.ok(a.isIf(first) && a.isElseIf(first.otherwise));
    const second = (first.otherwise as a.ElseIf).statements[0];
    assert.equal(second.condition.$cstNode?.text, 'n == 2');
    const third = (second.otherwise as a.ElseIf).statements[0];
    assert.equal(third.condition.$cstNode?.text, 'n == 3');
    assert.ok(a.isBlock(third.otherwise) && third.otherwise.statements.length === 1);
    // The 2.2 form keeps its blocks: else { if … } is a Block whose only statement is an If.
    const { model: m2 } = await valid(model(nested));
    const outer = m2.packages[0].elements.filter(a.isComponentDef)[0].members.find(a.isOperation)!.body.statements[1] as a.If;
    assert.ok(a.isBlock(outer.otherwise) && a.isIf(outer.otherwise.statements[0]));
    // An else if without an else: the final if has no otherwise; an else after it belongs to it, never to the outer if.
    const { model: m3 } = await valid(model('if (a) { log = 1; } else if (b) { log = 2; } else { log = 3; }'));
    const top = m3.packages[0].elements.filter(a.isComponentDef)[0].members.find(a.isOperation)!.body.statements[1] as a.If;
    const inner = (top.otherwise as a.ElseIf).statements[0];
    assert.equal((inner.otherwise as a.Block).statements[0].$cstNode?.text, 'log = 3;');
    assert.equal((top.otherwise as a.ElseIf).statements.length, 1);
});

test('SIF-G01 the kept 2.2 grammar rejects else if and accepts else { if … }; every source with else if is new in 2.3', async () => {
    const { parsers } = await import(new URL('scripts/compatibility-2-2.mjs', root).href) as { parsers(): Promise<{ v22(text: string): { errors?: string[] }; current(text: string): { errors?: string[] } }> };
    const { v22, current } = await parsers();
    assert.ok(v22(model(chain)).errors?.length, '2.2 rejects else if');
    assert.equal(current(model(chain)).errors, undefined);
    assert.equal(v22(model(nested)).errors, undefined);
    assert.equal(current(model(nested)).errors, undefined);
});

test('SIF-G01 statement identities: else if names its if by the segment if; the 2.2 form keeps its index paths; both resolve', async () => {
    const { model: m } = await valid(model(chain));
    assert.deepEqual(statementIdentities(m), [
        'Assign Test::C.f/0', 'If Test::C.f/1', 'Assign Test::C.f/1/then/0',
        'If Test::C.f/1/otherwise/if', 'Assign Test::C.f/1/otherwise/if/then/0',
        'If Test::C.f/1/otherwise/if/otherwise/if', 'Assign Test::C.f/1/otherwise/if/otherwise/if/then/0',
        'Assign Test::C.f/1/otherwise/if/otherwise/if/otherwise/0'
    ]);
    // The 2.2 form keeps exactly the identities 2.2 gave it.
    const { model: m2 } = await valid(model(nested));
    assert.deepEqual(statementIdentities(m2), [
        'Assign Test::C.f/0', 'If Test::C.f/1', 'Assign Test::C.f/1/then/0',
        'If Test::C.f/1/otherwise/0', 'Assign Test::C.f/1/otherwise/0/then/0',
        'If Test::C.f/1/otherwise/0/otherwise/0', 'Assign Test::C.f/1/otherwise/0/otherwise/0/then/0',
        'Assign Test::C.f/1/otherwise/0/otherwise/0/otherwise/0'
    ]);
    for (const x of [m, m2])
        for (const n of AstUtils.streamAst(x).filter(n => n.$containerProperty === 'statements'))
            assert.equal(resolveStatement([x], statementIdentity(n)!), n, statementIdentity(n));
    // An index never names the if of an else if, and the segment if never names a block statement.
    assert.equal(resolveStatement([m], 'Test::C.f/1/otherwise/0'), undefined);
    assert.equal(resolveStatement([m2], 'Test::C.f/1/otherwise/if'), undefined);
    // The ElseIf node and the condition of an else if belong to the identity of their statements.
    const elseIf = AstUtils.streamAst(m).find(a.isElseIf)!;
    assert.equal(statementIdentity(elseIf), 'Test::C.f/1');
    assert.equal(statementIdentity(elseIf.statements[0].condition), 'Test::C.f/1/otherwise/if');
});

test('SIF-G01 else if runs as else { if … }: the same stores and trace, with the else if identities as sources', async () => {
    const runOf = async (body: string) => simulate([(await valid(model(body))).model], 'Test::Demo', { untilNs: 45_000_000 });
    const chained = await runOf(chain), plain = await runOf(nested);
    assert.deepEqual(chained.stores, plain.stores);
    assert.deepEqual(chained.stores, { Demo: { n: 4, log: 40, a: true, b: false } });
    const rename = (s: unknown) => typeof s === 'string' ? s.replaceAll('/otherwise/if', '/otherwise/0') : s;
    assert.deepEqual(chained.trace.map(o => 'source' in o ? { ...o, source: rename(o.source) } : o), plain.trace);
    assert.deepEqual([...new Set(chained.trace.filter(o => o.kind === 'write').map(o => o.source))], ['Test::C.f/0', 'Test::C.f/1/then/0', 'Test::C.f/1/otherwise/if/then/0', 'Test::C.f/1/otherwise/if/otherwise/if/then/0', 'Test::C.f/1/otherwise/if/otherwise/if/otherwise/0']);
});

test('SIF-G01 the validator treats else if as else { if … }: typing, returns, definite assignment, stale reads and effects', async () => {
    // Each pair is the same body with else if and with else { if … }; their diagnostics (code and message) agree.
    const pairs: [string, string, string?][] = [
        // A condition that is not bool.
        ['if (a) { log = 1; } else if (n) { log = 2; }', 'if (a) { log = 1; } else { if (n) { log = 2; } }'],
        // An unknown name in the condition and in the branch.
        ['if (a) { log = 1; } else if (zz) { log = qq; }', 'if (a) { log = 1; } else { if (zz) { log = qq; } }'],
        // A local of a then branch is not visible after it.
        ['if (a) { var t: int = 1; } else if (b) { log = t; }', 'if (a) { var t: int = 1; } else { if (b) { log = t; } }'],
        // Stale write across a wait in an else if branch (SW2011).
        ['var s: int = log; if (a) { log = 1; } else if (b) { wait 1ms; log = s + 1; }', 'var s: int = log; if (a) { log = 1; } else { if (b) { wait 1ms; log = s + 1; } }']
    ];
    for (const [chained, plain] of pairs) {
        const x = await diagnostics(model(chained)), y = await diagnostics(model(plain));
        assert.deepEqual(x, y, chained);
        assert.ok(x.length > 0, `${chained} is diagnosed`);
    }
    // Every path of if / else if / else returns: no missing-return error, as for the nested form; without the final
    // else both forms report the same missing return.
    const returning = (body: string) => `package Test { component def C { operation g(k: int) returns int { ${body} } } }`;
    assert.deepEqual(await diagnostics(returning('if (k > 0) { return 1; } else if (k < 0) { return 2; } else { return 3; }')), []);
    assert.deepEqual(await diagnostics(returning('if (k > 0) { return 1; } else if (k < 0) { return 2; } else { fail "zero"; }')), []);
    const missing = await diagnostics(returning('if (k > 0) { return 1; } else if (k < 0) { return 2; }'));
    assert.ok(missing.length > 0);
    assert.deepEqual(missing, await diagnostics(returning('if (k > 0) { return 1; } else { if (k < 0) { return 2; } }')));
    // Effects: a helper that writes in an else if branch is not pure, so a release guard may not call it.
    const guard = (body: string) => `package Test { component def C { attribute k: int = 0; operation w() returns bool { if (k > 0) { return true; } ${body} return false; } operation f() { } schedule { on every 10ms f() if (w()); } } component Demo: C; }`;
    assert.deepEqual((await diagnostics(guard('else if (k < 0) { k = 1; }'))), (await diagnostics(guard('else { if (k < 0) { k = 1; } }'))));
    assert.ok((await diagnostics(guard('else if (k < 0) { k = 1; }'))).some(d => d.includes('Release guard must be pure or read state.')));
    // WP8 T4 names the statement whose suspending call may suspend: the if of the else if, as for the if inside
    // else { … } (a suspending call in a condition is itself an error, but the site is found before validation).
    const site = async (body: string) => {
        const c = (await parse(model(body, 'operation ready() returns bool { wait 1ms; return true; }'))).model.packages[0].elements.filter(a.isComponentDef)[0];
        return statementIdentity(suspendSite(c.members.find(a.isOperation)!, c)!);
    };
    assert.equal(await site('if (a) { log = 1; } else if (b) { n = log + 1; } else if (ready()) { log = 2; }'), 'Test::C.f/1/otherwise/if/otherwise/if');
    assert.equal(await site('if (a) { log = 1; } else { if (ready()) { log = 2; } }'), 'Test::C.f/1/otherwise/0');
});

test('SIF-G01 rename and references cover names read and written in an else if', async () => {
    const r = await valid(model('if (a) { log = 1; } else if (b and n > 0) { log = n; }'));
    const refs = semanticIndex([r.model]).filter(x => ['n', 'b', 'log'].includes(x.symbol.name)).map(x => `${x.symbol.name} ${x.declaration ? 'declaration' : 'use'}`);
    const plain = await valid(model('if (a) { log = 1; } else { if (b and n > 0) { log = n; } }'));
    assert.deepEqual(refs, semanticIndex([plain.model]).filter(x => ['n', 'b', 'log'].includes(x.symbol.name)).map(x => `${x.symbol.name} ${x.declaration ? 'declaration' : 'use'}`));
    assert.ok(refs.filter(x => x === 'n use').length >= 4);
});

test('SIF-G01 the formatter keeps else if on one line, also with comments between else and if, and is idempotent', async () => {
    const format = async (body: string) => formatDocument((await parse(model(body))).doc as never);
    const flat = await format('if (a) {log = 1;}   else\n\n  if (b) { log = 2; } else if(n>2){ if (a) { log = 3; } else if (b) { log = 4; } } else { log = 5; }');
    assert.match(flat, /\n {6}\} else if \(b\) \{\n {8}log = 2;\n {6}\} else if \(n > 2\) \{\n {8}if \(a\) \{\n {10}log = 3;\n {8}\} else if \(b\) \{\n {10}log = 4;\n {8}\}\n {6}\} else \{\n {8}log = 5;\n {6}\}\n/u);
    assert.equal(formatDocument((await parse(flat)).doc as never), flat);
    const block = await format('if (a) { log = 1; } else /* why */ if (b) { log = 2; }');
    assert.match(block, /\} else \/\* why \*\/ if \(b\) \{/u);
    const line = await format('if (a) { log = 1; } else // why\n if (b) { log = 2; }');
    assert.match(line, /\} else \/\/ why\n {6}if \(b\) \{/u);
    const two = await format('if (a) { log = 1; } else /* a */ /* b */ if (b) { log = 2; }');
    assert.match(two, /\} else \/\* a \*\/ \/\* b \*\/ if \(b\) \{/u);
    for (const text of [block, line, two])
        assert.equal(formatDocument((await parse(text)).doc as never), text);
    // The guard is printed if (g) between the call and deadline.
    const entry = formatDocument((await parse('package Test { component def C { attribute awake: bool = true; operation f() { } schedule { on every 10ms f()if(awake)deadline 2ms; } } }')).doc as never);
    assert.match(entry, /on every 10ms f\(\) if \(awake\) deadline 2ms;/u);
});

test('SIF-G01 a malformed 2.2 else keeps its 2.2 diagnostics; a token after else that starts neither a block nor an if predicts the block', async () => {
    const schedule = "Expecting token of type '}' but found `schedule`. 'schedule' is a reserved word. If it is meant as a name, write it as a quoted name ('schedule') or choose another name.";
    const reserved = (w: string) => `Expecting token of type '{' but found \`${w}\`. '${w}' is a reserved word. If it is meant as a name, write it as a quoted name ('${w}') or choose another name.`;
    // Recorded from main before package 1 (e477daa), whose else took a block only, as in 2.2.
    const expected: [string, string[]][] = [
        ['if (a) { log = 1; } else log = 2;', ["Expecting token of type '{' but found `log`.", schedule]],
        ['if (a) { log = 1; } else ;', ["Expecting token of type '{' but found `;`."]],
        ['if (a) { log = 1; } else', ["Expecting token of type '{' but found `}`.", schedule]],
        ['if (a) { log = 1; } else return;', [reserved('return'), schedule]],
        ['if (a) { log = 1; } else while (a) { log = 2; }', [reserved('while'), schedule]],
        ['if (a) { log = 1; } else (log);', ["Expecting token of type '{' but found `(`.", schedule]],
        ['if (a) { log = 1; } else var y: int = 1;', [reserved('var'), schedule]],
        ['if (a) { log = 1; } else else { }', [reserved('else')]]
    ];
    for (const [body, messages] of expected)
        assert.deepEqual((await parse(model(body))).errors.map(d => d.message), messages, body);
});

test('SIF-G01 half-typed else if sources validate, project, index, build view candidates, format and run without throwing, alone and beside a valid file', async () => {
    const other = 'package V { import Test; component def D specializes C { } }';
    for (const body of ['if (a) { log = 1; } else if', 'if (a) { log = 1; } else if (', 'if (a) { log = 1; } else if (b', 'if (a) { log = 1; } else if (b)', 'if (a) { log = 1; } else if (b) {', 'if (a) { log = 1; } else if (b) log = 2;', 'if (a) { log = 1; } else if (b) { } else', 'if (a) { log = 1; } else if (b) { } else if', 'if (a) { } else if (b) { } else if (log', 'if (a) { log = 1; } else if if (b) { }']) {
        const source = model(body);
        const r = await parse(source);
        assert.ok(r.doc.parseResult.parserErrors.length, body);
        projectModel([r.model]);
        viewCandidates([r.model]);
        semanticIndex([r.model]);
        for (const n of AstUtils.streamAst(r.model).filter((x: AstNode) => x.$containerProperty === 'statements')) {
            const id = statementIdentity(n);
            if (id)
                resolveStatement([r.model], id);
        }
        assert.throws(() => simulate([r.model], 'Test::Demo', { untilNs: 1_000_000 }), (e: Error) => !(e instanceof TypeError), body);
        assert.throws(() => formatDocument(r.doc as never), /Fix syntax errors/u, body);
        const both = await workspace([source, other]);
        const models = both.docs.map(d => d.parseResult.value as Model);
        projectModel(models);
        viewCandidates(models);
        semanticIndex(models);
        assert.deepEqual((both.docs[1].diagnostics ?? []).filter(x => x.severity === 1).map(x => x.code), [], `${body}: the valid file`);
    }
});
