// WP2 of swa.ml 2.3: the whole-expression conditional (WP2-G01, WP2-G02, WP2-S02..S05, WP2-R01, WP2-D01,
// WP2-D02, WP2-D04, WP2-M02), the contextual words view, state, in and out (WP2-G03, WP2-S01, WP2-M01) and
// association lists (WP2-G03, WP2-S06, WP2-D03, WP2-M03, WP2-M04); the formatter (WP2-M05).
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AstUtils, CstUtils, EmptyFileSystem, GrammarAST, URI } from 'langium';
import { createServicesForGrammar } from 'langium/grammar';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { formatDocument, verifyFormatting, ASSOCIATION_LINE_WIDTH } from '../../src/language/formatter.js';
import { semanticIndex } from '../../src/language/path-services.js';
import { projectModel } from '../../src/language/projection.js';
import { associatedOccurrences, associationPairs, expressionTypes } from '../../src/language/semantic.js';
import { CONTEXTUAL_KEYWORDS, CONTEXTUAL_KEYWORDS_2_2, MESSAGE_SPELLING, RESERVED_WORDS, RESERVED_WORDS_2_2, formatName, formatPath, formatQualifiedName, isBasicName, namesFor, reservedWords } from '../../src/language/names.js';
import { CONDITIONAL_STATEMENT_MESSAGE, RECOVERS_STATEMENTS, SwamlValueConverter, applyStatementRecovery } from '../../src/language/swaml-syntax.js';
import { runCase, simulate } from '../../src/simulation/simulator.js';
import { SwamlGrammar } from '../../src/language/generated/grammar.js';
import type { Model } from '../../src/language/generated/ast.js';
import * as a from '../../src/language/generated/ast.js';
import { invalid, parse, valid } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });

const root = new URL('../../../', import.meta.url);
const wrap = (body: string) => `package Test {
  enum Color { red, green }
  datatype R { n: int; ok: bool; }
  datatype Q { n: int; ok: bool; }
  component def D {
    ${body}
  }
  component Demo: D;
}`;
const errors = async (source: string) => (await parse(source)).errors.map(e => [e.code, e.message]);
const syntax = async (source: string) => { const r = await parse(source); return [...r.doc.parseResult.lexerErrors, ...r.doc.parseResult.parserErrors].map(e => e.message); };
const operation = (m: Model, name: string) => AstUtils.streamAllContents(m).filter(a.isOperation).find(o => o.name === name)!;
const silently = async <T>(fn: () => Promise<T>): Promise<{ value: T; logged: string[] }> => {
    const logged: string[] = [], saved = [console.log, console.warn, console.error];
    console.log = console.warn = console.error = (...args: unknown[]) => { logged.push(args.join(' ')); };
    try {
        return { value: await fn(), logged };
    }
    finally {
        [console.log, console.warn, console.error] = saved;
    }
};
/** The kept 2.2 grammar (the 3.1.0 parser), for recovery comparisons. */
const kept22 = async () => {
    const { parsers } = await import(new URL('scripts/compatibility-2-2.mjs', root).href) as { parsers(): Promise<{ kept: { parser: { LangiumParser: { parse(text: string): { value: unknown; parserErrors: unknown[]; lexerErrors: unknown[] } } } } }> };
    return (await parsers()).kept.parser.LangiumParser;
};

// ---------------------------------------------------------------- conditional: grammar

test('WP2-G01 the conditional is a whole expression: assignment, declaration, argument, return, guard, index and parenthesized operand', async () => {
    const r = await valid(wrap(`attribute x: int = 0; attribute xs: int[2] = [0, 0];
      operation id(v: int) returns int { return if (v > 0) v else 0 - v; }
      operation f(c: bool) {
        x = if (c) 1 else 2;
        var y: int = if (c) x else id(if (not c) 3 else 4);
        xs[if (c) 0 else 1] = 1 + (if (c) 2 else 3) + 4;
        assert if (c) true else x == 2;
      }
      schedule { on start f(true); }`));
    const f = operation(r.model, 'f'), [assign, local, place, check] = f.body!.statements;
    assert.ok(a.isConditionalExpression((assign as a.Assign).value));
    const decl = (local as a.LocalVariable).value as a.ConditionalExpression;
    assert.ok(a.isConditionalExpression(((decl.otherwise as a.CallExpression).args[0])));
    assert.ok(a.isConditionalExpression((place as a.Assign).index));
    const sum = (place as a.Assign).value as a.BinaryExpression;
    assert.equal(sum.operator, '+');
    assert.ok(a.isConditionalExpression((sum.left as a.BinaryExpression).right), 'the parenthesized operand is the conditional itself');
    // WP2-S03: within a whole conditional, else extends to the end: if (c) true else (x == 2).
    const assertion = (check as a.Assert).condition as a.ConditionalExpression;
    assert.ok(a.isLiteral(assertion.then) && a.isBinaryExpression(assertion.otherwise) && assertion.otherwise.operator === '==');
});

test('WP2-G01 WP2-S03 else if chains, and else extends to the end of the expression', async () => {
    const r = await valid(wrap(`attribute x: int = 0; operation f(a: bool, b: bool) { x = if (a) 1 else if (b) 2 else 3 + 4; } schedule { on start f(false, false); }`));
    const value = (operation(r.model, 'f').body!.statements[0] as a.Assign).value as a.ConditionalExpression;
    assert.ok(a.isConditionalExpression(value.otherwise));
    assert.ok(a.isBinaryExpression((value.otherwise as a.ConditionalExpression).otherwise), 'the last else takes 3 + 4');
    const result = simulate([r.model], 'Test::Demo', { untilNs: 1000 });
    assert.equal(result.stores.Demo.x, 7);
});

test('WP2-G01 WP2-S03 an unparenthesized conditional operand is a syntax error that explains the parentheses', async () => {
    for (const text of ['x = 1 + if (c) 2 else 3;', 'x = -if (c) 2 else 3;', 'x = not if (c) true else false;', 'x = (1 < if (c) 2 else 3);']) {
        const messages = await syntax(wrap(`attribute x: int = 0; operation f(c: bool) { ${text} }`));
        assert.ok(messages.length > 0, text);
        assert.match(messages[0], /as an operand it is written in parentheses, as in \(if \(c\) a else b\)/, text);
    }
});

test('WP2-G02 WP2-S05 WP2-D04 a conditional is never a statement: if (c) g() else h(); is a syntax error', async () => {
    const messages = await syntax(wrap('operation g() { } operation h() { } operation f(c: bool) { if (c) g() else h(); }'));
    assert.equal(messages[0], CONDITIONAL_STATEMENT_MESSAGE);
    assert.equal(CONDITIONAL_STATEMENT_MESSAGE, 'A conditional expression is not a statement; use an if block.');
    for (const text of ['if (c) g() else { h(); }', 'if (c) (g()) else h();', 'if ((c)) g() else h();'])
        assert.equal((await syntax(wrap(`operation g() { } operation h() { } operation f(c: bool) { ${text} }`)))[0], CONDITIONAL_STATEMENT_MESSAGE, text);
    // An if statement without a block and without else keeps the parser's own message.
    assert.match((await syntax(wrap('attribute x: int = 0; operation f(c: bool) { if (c) x = 1; }')))[0], /Expecting token of type '\{'/);
    // The if statement keeps its block form, with and without else.
    await valid(wrap('attribute x: int = 0; operation f(c: bool) { if (c) { x = 1; } else { x = 2; } if (not c) { x = 3; } } schedule { on start f(true); }'));
    // A conditional is not an expression statement value either: the statement form is the if block.
    const r = await parse(wrap('attribute x: int = 0; operation f(c: bool) { x = if (c) 1 else 2; } schedule { on start f(true); }'));
    assert.ok(!AstUtils.streamAllContents(r.model).some(n => a.isExpressionStatement(n) && a.isConditionalExpression(n.expression)));
});

test('WP2-G01 (gate 3) parsing and validating every conditional form prints nothing', async () => {
    const { logged } = await silently(async () => {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        for (const text of ['x = if (c) 1 else 2;', 'x = if (c) 1 else if (c) 2 else 3;', 'x = 1 + (if (c) 2 else 3) + 4;', 'assert if (c) true else x == 3;', 'x = (if (c) 1 else 2);', 'x = if (if (c) c else not c) 1 else 2;', 'x = if (c) if (c) 1 else 2 else 3;', 'xs[if (c) 0 else 1] = if (c) xs[0] else xs[1];', 'return if (c) 1 else 2;', 'x = f(if (c) 1 else 2, 3);'])
            Swaml.parser.LangiumParser.parse(wrap(`attribute x: int = 0; attribute xs: int[2] = [0, 0]; operation f(c: bool) { ${text} }`));
        await valid(readFileSync(new URL('examples/35-conditional-expression.swaml', root), 'utf8'));
    });
    assert.deepEqual(logged, []);
});

// ---------------------------------------------------------------- conditional: typing and effects

test('WP2-S02 WP2-D01 the condition is bool and the branches have a common type under scalar widening', async () => {
    const typeOf = async (body: string, expression: string) => {
        const r = await valid(wrap(`${body} attribute probe: int = 0; operation f(c: bool) { var t: bool = true; ${expression} } schedule { on start f(true); }`));
        const conditional = AstUtils.streamAllContents(r.model).find(a.isConditionalExpression)!;
        return expressionTypes.get(conditional);
    };
    assert.equal(await typeOf('attribute b: byte = 1; attribute u: uint = 2;', 'var v: uint = if (c) b else u;'), 'uint');
    assert.equal(await typeOf('attribute u: uint = 2; attribute i: int = -1;', 'var v: int = if (c) u else i;'), 'int');
    assert.equal(await typeOf('attribute i: int = 2;', 'var v: real = if (c) i else 2.5;'), 'real');
    assert.equal(await typeOf('attribute b: byte = 1;', 'var v: real = if (c) 1.5 else b;'), 'real');
    assert.equal(await typeOf('', 'var v: string = if (c) "a" else "b";'), 'string');
    assert.equal(await typeOf('', 'var v: Color = if (c) Color.red else Color.green;'), 'Test::Color');
    assert.equal(await typeOf('', 'var v: R = if (c) record R { n = 1; ok = true; } else record R { n = 2; ok = false; };'), 'Test::R');
    assert.equal(await typeOf('', 'var v: int[2] = if (c) [1, 2] else [3, 4];'), 'int[2]');
    assert.equal(await typeOf('', 'var v: bool = if (c) t else false;'), 'bool');
    const rejected = async (expression: string, message: string) => assert.ok((await errors(wrap(`operation f(c: bool, i: int) { ${expression} } schedule { on start f(true, 1); }`))).some(([code, m]) => code === 'SW2002' && m === message), `${expression}: ${message}`);
    await rejected('var v: int = if (i) 1 else 2;', 'Condition must be bool, found int.');
    await rejected('var v: int = if ("yes") 1 else 2;', 'Condition must be bool, found string.');
    await rejected('var v: int = if (c) 1 else true;', 'Conditional branches have no common type: int and bool.');
    await rejected('var v: int = if (c) 1 else "1";', 'Conditional branches have no common type: int and string.');
    await rejected('var v: R = if (c) record R { n = 1; ok = true; } else record Q { n = 1; ok = true; };', 'Conditional branches have no common type: Test::R and Test::Q.');
    await rejected('var v: Color = if (c) Color.red else 1;', 'Conditional branches have no common type: Test::Color and int.');
    // Arrays must be identical types: no element widening and no extent change.
    await rejected('var v: real[2] = if (c) [1, 2] else [1.5, 2.5];', 'Conditional branches have no common type: int[2] and real[2].');
    await rejected('var v: int[2] = if (c) [1, 2] else [1, 2, 3];', 'Conditional branches have no common type: int[2] and int[3].');
    // The result type follows the ordinary assignment rules.
    await rejected('var v: int = if (c) 1 else 2.5;', 'Expected int, received real.');
    await rejected('var v: bool = if (c) 1 else 2;', 'Expected bool, received int.');
});

test('WP2-S02 void branches are rejected', async () => {
    const found = await errors(wrap('attribute x: int = 0; operation g() { } operation h() returns int { return 1; } operation f(c: bool) { x = if (c) g() else h(); x = if (c) h() else g(); } schedule { on start f(true); }'));
    assert.equal(found.filter(([code, m]) => code === 'SW2002' && m === 'Void completion is not an expression value.').length, 2, JSON.stringify(found));
});

test('WP2-S02 a conditional is not a known literal: a smaller integral domain takes the computed-assignment rule', async () => {
    // A literal 300 is rejected for byte statically; a conditional with 300 is a computed value checked at run time.
    assert.ok((await errors(wrap('attribute b: byte = 0; operation f() { b = 300; } schedule { on start f(); }'))).some(([code]) => code === 'SW2002'));
    const r = await valid(wrap('attribute b: byte = 0; attribute u: uint = 0; operation f(c: bool) { b = if (c) 7 else 300; u = if (c) 5 else -1; } schedule { on start f(true); }'));
    assert.deepEqual(simulate([r.model], 'Test::Demo', { untilNs: 1000 }).stores.Demo, { b: 7, u: 5 });
    const failing = await valid(wrap('attribute b: byte = 0; operation f(c: bool) { b = if (c) 7 else 300; } schedule { on start f(false); }'));
    const result = simulate([failing.model], 'Test::Demo', { untilNs: 1000 });
    assert.equal(result.stores.Demo.b, 0, 'an out-of-domain selected branch fails at run time and leaves the attribute unchanged');
    assert.ok(result.trace.some(t => t.kind === 'fail' || t.kind === 'failure' || /fail/i.test(t.kind)), JSON.stringify(result.trace.map(t => t.kind)));
});

test('WP2-S04 WP2-D02 a suspending call cannot appear anywhere in a conditional; other effects are the union', async () => {
    const source = (statement: string) => `package Test {
  port def Api { provides operation get() returns int; }
  datatype R { n: int; ok: bool; }
  component def Server { port api: Api; operation get() returns int { return 3; } schedule { on call api.get() get(); } }
  component def Client {
    reversed port api: Api;
    attribute x: int = 0;
    attribute r: R = record R { n = 0; ok = false; };
    operation waits() returns int { wait 1ms; return 1; }
    operation f(c: bool) { ${statement} }
    schedule { on start f(true); }
  }
  component Demo { component client: Client; component server: Server; connect (client.api, server.api); }
}`;
    const message = 'A suspending call cannot appear in a conditional expression.';
    for (const statement of ['x = if (c) api.get() else 0;', 'x = if (c) 0 else waits();', 'x = if (api.get() > 0) 1 else 0;', 'x = if (c) try(api.get(), 0) else 1;', 'r = if (c) record R { n = api.get(); ok = true; } else r;', 'x = if (c) 1 + (if (c) waits() else 0) else 2;', 'var v: int = if (c) api.get() else 0;']) {
        const found = await errors(source(statement));
        assert.ok(found.some(([code, m]) => code === 'SW2006' && m === message), `${statement}: ${JSON.stringify(found)}`);
        assert.ok(!found.some(([, m]) => String(m).startsWith('Suspending calls must be standalone')), `${statement}: the 2.3 message replaces the 2.2 one inside a conditional`);
    }
    // Outside a conditional, a suspending call keeps its 2.2 rule and message.
    const outside = await errors(source('x = api.get() + 1;'));
    assert.ok(outside.some(([, m]) => String(m).startsWith('Suspending calls must be standalone statements')));
    await valid(source('var v: int = api.get(); x = if (c) v else 0;'));
});

test('WP2-S04 the effect of a conditional is the union of its condition and both branches', async () => {
    // A concurrent entry may not write through any callee, even through a branch that a run never takes.
    const found = await errors(wrap('attribute x: int = 0; operation bump() returns int { x = x + 1; return x; } operation f(c: bool) { var v: int = if (c) 0 else bump(); } schedule { on start f(true) concurrent; }'));
    assert.ok(found.some(([code, m]) => code === 'SW2006' && /Concurrent entries cannot write state/.test(String(m))), JSON.stringify(found));
    // An attribute initializer stays pure: a conditional with a call is rejected like any call.
    assert.ok((await errors(wrap('attribute y: int = 0; attribute x: int = if (true) 1 else 2; operation g() returns int { y = 1; return 1; } attribute z: int = if (true) 1 else g();'))).some(([code, m]) => code === 'SW2006' && m === 'Attribute initializers must be pure.'));
    await valid(wrap('attribute x: int = if (2 > 3) 4 else 3; attribute y: real = if (true) 1 else 2.5;'));
    // An out parameter read in a branch before its assignment is reported as in any expression.
    assert.ok((await errors(wrap('operation f(c: bool, out o: int) { var v: int = if (c) 1 else o; o = v; }'))).some(([code, m]) => code === 'SW2006' && m === 'Out parameter is read before assignment.'));
});

// ---------------------------------------------------------------- conditional: runtime

test('WP2-R01 the condition is evaluated, then only the selected branch; side effects show it', async () => {
    const r = await valid(wrap(`attribute conditions: int = 0; attribute thens: int = 0; attribute others: int = 0; attribute x: real = 0.0; attribute last: real = 0.0;
      operation cond(v: bool) returns bool { conditions = conditions + 1; return v; }
      operation one() returns int { thens = thens + 1; return 1; }
      operation half() returns real { others = others + 1; return 0.5; }
      operation f() {
        x = if (cond(true)) one() else half();
        last = x;
        x = x + (if (cond(false)) one() else half());
        x = x + (if (cond(false)) one() else if (cond(true)) half() else one());
      }
      schedule { on start f(); }`));
    const result = simulate([r.model], 'Test::Demo', { untilNs: 1000 });
    assert.deepEqual(result.stores.Demo, { conditions: 4, thens: 1, others: 2, x: 2, last: 1 });
    // The int branch is widened to the common type real.
    const calls = result.trace.filter(t => t.kind === 'write' && (t as unknown as { subject: string }).subject.endsWith('.last')) as unknown as { value: unknown }[];
    assert.deepEqual(calls.map(w => w.value), [1]);
});

test('WP2-R01 a failing unselected branch never runs; a failing selected branch fails like any expression', async () => {
    const r = await valid(wrap(`attribute xs: int[2] = [1, 2]; attribute x: int = 0; attribute caught: int = 0;
      operation f(i: int) {
        x = if (i < 2) xs[i] else xs[0];
        x = x + (if (i >= 2) xs[i] else 10);
        caught = try(if (i < 2) xs[i + 5] else 0, -1);
      }
      schedule { on start f(1); }`));
    assert.deepEqual(simulate([r.model], 'Test::Demo', { untilNs: 1000 }).stores.Demo, { xs: [1, 2], x: 12, caught: -1 });
});

test('WP2-R01 a conditional in a test script, a guard and a send argument runs its selected branch', async () => {
    const source = `package Test {
  port def P { provides event level(v: int); }
  component def Sender { port p: P; attribute n: int = 0; operation run() { n = 3; publish p.level(if (n > 2) n * 10 else 0); } schedule { on start run(); } }
  component def Receiver {
    reversed port p: P;
    attribute got: int = 0;
    operation machine() {
      initial waiting;
      state waiting {
        on receive p.level(v) when (if (v > 0) v < 100 else false) to done { got = if (v == 30) v + 1 else v; }
      }
      final state done { }
    }
    schedule { on start machine(); }
  }
  component sender: Sender;
  component receiver: Receiver;
  connect (sender.p, receiver.p);
  test Levels of receiver {
    wait 1ms;
    var expected: int = if (sender.n == 3) 31 else 0;
    assert receiver.got == expected;
  }
  associate sender to Levels;
}`;
    const r = await valid(source);
    assert.equal(runCase([r.model], 'Test::Levels', { untilNs: 10000000 }).result, 'pass');
});

test('WP2-S04 SW2011 tracks attributes read by a conditional before a suspension elsewhere in the operation', async () => {
    const stale = await parse(wrap('attribute level: int = 0; attribute other: int = 0; operation bump() { level = level + 1; } operation f(c: bool) { var v: int = if (c) level else other; wait 1ms; level = v + 1; } schedule { on start f(true); on every 1ms bump(); }'));
    assert.ok(stale.warnings.some(w => w.code === 'SW2011'), JSON.stringify(stale.warnings.map(w => w.message)));
    const fresh = await parse(wrap('attribute level: int = 0; attribute other: int = 0; operation bump() { level = level + 1; } operation f(c: bool) { wait 1ms; var v: int = if (c) level else other; level = v + 1; } schedule { on start f(true); on every 1ms bump(); }'));
    assert.deepEqual(fresh.warnings.filter(w => w.code === 'SW2011'), []);
    // A condition read is tracked like a branch read.
    const condition = await parse(wrap('attribute level: int = 0; operation bump() { level = level + 1; } operation f() { var v: int = if (level > 0) 1 else 2; wait 1ms; level = v; } schedule { on start f(); on every 1ms bump(); }'));
    assert.ok(condition.warnings.some(w => w.code === 'SW2011'));
});

test('WP2-S02 places and selector reads take conditionals as index expressions; member access needs a value path', async () => {
    const r = await valid(wrap(`attribute rs: R[2] = [record R { n = 1; ok = false; }, record R { n = 2; ok = true; }]; attribute x: int = 0;
      operation f(c: bool) { rs[if (c) 0 else 1].n = 5; x = rs[if (c) 1 else 0].n + (if (rs[0].ok) 1 else 0); }
      schedule { on start f(true); }`));
    assert.deepEqual(simulate([r.model], 'Test::Demo', { untilNs: 1000 }).stores.Demo, { rs: [{ n: 5, ok: false }, { n: 2, ok: true }], x: 2 });
    // (if (c) r1 else r2).f is not a value path: selectors follow a path and its first index only (WP1-G02).
    assert.ok((await syntax(wrap('attribute x: int = 0; attribute r1: R = record R { n = 1; ok = true; }; operation f(c: bool) { x = (if (c) r1 else r1).n; }'))).length > 0);
});

// ---------------------------------------------------------------- conditional: recovery

const typing = (line: string) => `package Test {
  component def D {
    attribute x: int = 0;
    operation g() { }
    operation h() { }
    operation run(c: bool) {
      x = 1;
      ${line}
      x = 2;
      x = 3;
    }
    operation other() { x = 4; }
    schedule { on start run(true); }
  }
  component Demo: D;
}
package After { }`;
test('WP2-G01 WP2-G02 a malformed or unfinished conditional keeps the rest of its component and package', async () => {
    const old = await kept22(), { Swaml } = createSwamlServices(EmptyFileSystem);
    for (const line of ['x = if (c) 1;', 'x = if (c) 1', 'x = if (c) 1 else;', 'x = if (c) 1 else', 'x = if (c;', 'x = if (', 'x = if', 'x = if c 1 else 2;', 'x = 1 + if (c) 2 else 3;', 'if (c) g() else h();', 'if (c) g() else', 'if (c) g()', 'x = if (c) (1 else 2;', 'x = (if (c) 1 else 2;', 'g(if (c) 1 else);', 'x = if (c) 1 else if (c) 2;', 'x = if (c) 1 else 2']) {
        const text = typing(line), now = Swaml.parser.LangiumParser.parse(text), before = old.parse(text);
        const count = now.parserErrors.length + now.lexerErrors.length, limit = Math.max(1, before.parserErrors.length + before.lexerErrors.length);
        assert.ok(count > 0, `${line} is a syntax error`);
        assert.ok(count <= limit, `${line}: ${count} errors, 2.2 had ${limit}`);
        const model = now.value as Model, d = model.packages[0].elements.find((e): e is a.ComponentDef => a.isComponentDef(e) && e.name === 'D')!;
        const statements = AstUtils.streamAllContents(d.members.filter(a.isOperation).find(o => o.name === 'run')!).filter(a.isAssign).map(s => s.$cstNode?.text).toArray();
        assert.ok(statements.includes('x = 3;'), `${line}: ${JSON.stringify(statements)}`);
        assert.ok(d.members.some(m => a.isOperation(m) && m.name === 'other') && d.members.some(a.isSchedule), line);
        assert.deepEqual(model.packages.map(p => p.name), ['Test', 'After'], line);
        assert.ok(model.packages[0].elements.some(e => a.isComponentUsage(e) && e.name === 'Demo'), line);
    }
});

test('the statement-recovery lookahead wrapper is installed, and a parser library change fails clearly', async () => {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const wrapper = (Swaml.parser.LangiumParser as unknown as { wrapper: { lookaheadStrategy: Record<symbol, unknown> } }).wrapper;
    assert.equal(wrapper.lookaheadStrategy[RECOVERS_STATEMENTS], true, 'recoverStatements wraps the lookahead strategy of the Langium parser');
    assert.throws(() => applyStatementRecovery({}), /swa\.ml statement recovery needs the Chevrotain lookahead strategy/);
    assert.throws(() => applyStatementRecovery({ wrapper: { lookaheadStrategy: { buildLookaheadForAlternation() { return () => 0; } } } }), /parser library changed/);
    // And it works: a place being typed keeps the following statements (WP1 review F1).
    const parsed = Swaml.parser.LangiumParser.parse(typing('xs[0].'));
    const run = AstUtils.streamAllContents(parsed.value as Model).filter(a.isOperation).find(o => o.name === 'run')!;
    assert.ok(run.body!.statements.some(s => s.$cstNode?.text === 'x = 3;'));
});

// ---------------------------------------------------------------- contextual words

test('WP2-S01 WP2-G03 view, state, in and out are contextual: names in every position, keywords in their own', async () => {
    const { value: r, logged } = await silently(() => valid(readFileSync(new URL('examples/36-contextual-words.swaml', root), 'utf8')));
    assert.deepEqual(logged, []);
    const names = AstUtils.streamAllContents(r.model).flatMap(n => typeof (n as { name?: unknown }).name === 'string' ? [`${n.$type}:${(n as unknown as { name: string }).name}`] : []).toArray();
    for (const expected of ['Attribute:state', 'Attribute:view', 'PortUsage:in', 'PortUsage:out', 'PortMember:state', 'Argument:in', 'Argument:out', 'Argument:state', 'View:view', 'View:state'])
        assert.ok(names.includes(expected), expected);
    assert.equal(runCase([r.model], 'UplinkSession::Session state is a plain name', { untilNs: 100000000 }).result, 'pass');
});

const everyPosition = `package view::state {
  import Swaml::Views;
  enum Mode { view, state, in, out }
  datatype Fields { view: int; state: Mode; in: bool; out: real; }
  port def Gate {
    provides event view(in: int, out: Mode);
    requires attribute in: int;
    requires operation out(in in: int) returns int;
  }
  operation def twice(in in: int, out out: int) {
    out = in * 2;
  }
  operation def total(values: int[3]) returns int {
    var out: int = 0;
    for (in: int in values) {
      out = out + in;
    }
    return out;
  }
  component def Session {
    attribute state: Mode = Mode.state;
    attribute view: Fields = record Fields { view = 1; state = Mode.out; in = true; out = 0.5; };
    attribute in: int[3] = [1, 2, 3];
    attribute sum: int = 0;
    port gate: Gate;
    operation run() {
      for (x: int in in) {
        sum = sum + x;
      }
      var out: int = 0;
      twice(total(in), out);
      state = if (in[0] > 0) Mode.in else Mode.out;
      view.view = out;
      publish gate.view(out, state);
    }
    operation machine() {
      initial state;
      state state {
        on entry { sum = sum + 100; }
        after 1ms to view { }
      }
      final state view { }
    }
    operation keep(value: int) { sum = sum + value; }
    schedule { on start run(); on start machine(); on receive gate.in(value) keep(value); }
  }
  component def Peer {
    reversed port gate: Gate;
    attribute state: Mode = Mode.view;
    attribute got: int = 0;
    operation out(in: int) returns int { return in + 1; }
    operation take(in: int, out: Mode) { state = out; got = in; }
    operation report() { send gate.in(7); }
    schedule { on receive gate.view(in, out) take(in, out); on call gate.out(in) out(in); on start report(); }
  }
  component in {
    component state: Session;
    component view: Peer;
    connect (state.gate, view.gate);
  }
  view out: General of in.state;
  view state: General {
    include in recursive where name == "state" or path != "view::state::in.view";
  }
  test Checks of in {
    wait 2ms;
    assert in.state.state == Mode.in and in.view.state == Mode.in and in.view.got == 12 and in.state.view.view == 12 and in.state.sum == 113;
  }
}`;
test('WP2-S01 the words in every name position: package, enum literal, field, member, parameter, local, operation, state, initial state, view, both for … in positions', async () => {
    const { value: r, logged } = await silently(() => valid(everyPosition));
    assert.deepEqual(logged, []);
    const names = AstUtils.streamAllContents(r.model).flatMap(n => typeof (n as { name?: unknown }).name === 'string' ? [`${n.$type}:${(n as unknown as { name: string }).name}`] : []).toArray();
    for (const expected of ['Attribute:state', 'Attribute:view', 'Attribute:in', 'Field:view', 'Field:state', 'Field:in', 'Field:out', 'PortMember:view', 'PortMember:in', 'PortMember:out', 'Argument:in', 'Argument:out', 'LocalVariable:out', 'Operation:out', 'State:state', 'State:view', 'ComponentUsage:in', 'ComponentUsage:state', 'ComponentUsage:view', 'View:out', 'View:state'])
        assert.ok(names.includes(expected), expected);
    assert.deepEqual(r.model.packages[0].elements.filter(a.isEnumType)[0].literals, ['view', 'state', 'in', 'out']);
    assert.equal(r.model.packages[0].name, 'view::state');
    const machine = operation(r.model, 'machine');
    assert.equal(machine.body!.initial, 'state');
    const loops = AstUtils.streamAllContents(r.model).filter(a.isForEach).toArray();
    assert.deepEqual(loops.map(l => [l.variable.name, (l.collection as a.ReferenceExpression).path]), [['in', 'values'], ['x', 'in']]);
    assert.equal(runCase([r.model], 'view::state::Checks', { untilNs: 5000000 }).result, 'pass');
    // A quoted spelling denotes the same name, so declaring both is a duplicate.
    assert.ok((await errors(wrap(`attribute state: int = 0; attribute 'state': int = 1;`))).some(([code]) => code === 'SW2001'));
    const quoted = await valid(wrap(`attribute state: int = 0; operation f() { 'state' = state + 1; state = 'state' + 1; } schedule { on start f(); }`));
    assert.deepEqual(simulate([quoted.model], 'Test::Demo', { untilNs: 1000 }).stores.Demo, { state: 2 });
});

test('WP2-M01 name services are edition-aware: 2.3 writes the words unquoted, 2.2 keeps quoting them', () => {
    for (const word of ['view', 'state', 'in', 'out']) {
        assert.equal(formatName(word), word);
        assert.equal(formatName(word, '2.3'), word);
        assert.equal(formatName(word, '2.2'), `'${word}'`);
        assert.equal(formatName(word, '2.1'), `'${word}'`);
        assert.ok(isBasicName(word) && !isBasicName(word, '2.2'));
    }
    // defer is no keyword before WP5, so every edition writes it as a basic name.
    assert.equal(formatName('defer'), 'defer');
    assert.equal(formatName('defer', '2.2'), 'defer');
    // Reserved words stay quoted in every edition.
    assert.equal(formatName('operation'), "'operation'");
    assert.equal(formatQualifiedName('view::state'), 'view::state');
    assert.equal(formatQualifiedName('view::state', '2.2'), "'view'::'state'");
    assert.equal(formatPath('P::in.state[2].out'), 'P::in.state[2].out');
    assert.equal(formatPath('P::in.state[2].out', '2.2'), "P::'in'.'state'[2].'out'");
    assert.equal(reservedWords('2.2'), RESERVED_WORDS_2_2);
    assert.equal(reservedWords(), RESERVED_WORDS);
});

test('WP2-M01 the 2.2 word sets match the kept 2.2 grammar and the 2.3 sets the current grammar', async () => {
    const words = (grammar: GrammarAST.Grammar) => {
        const all = new Set(AstUtils.streamAllContents(grammar).filter(GrammarAST.isKeyword).map(k => k.value).filter(k => /^[A-Za-z]\w*$/.test(k)));
        const contextual = new Set(AstUtils.streamAllContents(grammar.rules.find(r => r.name === 'Name')!).filter(GrammarAST.isKeyword).map(k => k.value));
        return { contextual: [...contextual].sort(), reserved: [...all].filter(k => !contextual.has(k)).sort() };
    };
    const kept = await createServicesForGrammar({ grammar: readFileSync(new URL('test/fixtures/compatibility-2-2/swaml-2.2.langium', root), 'utf8'), module: { parser: { ValueConverter: () => new SwamlValueConverter() } } });
    assert.deepEqual(words(kept.Grammar), { contextual: [...CONTEXTUAL_KEYWORDS_2_2].sort(), reserved: [...RESERVED_WORDS_2_2].sort() });
    assert.deepEqual(words(SwamlGrammar()), { contextual: [...CONTEXTUAL_KEYWORDS].sort(), reserved: [...RESERVED_WORDS].sort() });
});

test('WP2-M01 rename writes a contextual word unquoted in 2.3, and references find quoted and unquoted spellings', async () => {
    const source = wrap(`attribute level: int = 0; operation f() { level = level + 1; } schedule { on start f(); }`);
    const r = await valid(source), offset = source.indexOf('level: int');
    const edit = await r.Swaml.lsp.RenameProvider!.rename(r.doc, { textDocument: { uri: r.doc.uri.toString() }, position: r.doc.textDocument.positionAt(offset), newName: 'state' });
    const texts = (edit?.documentChanges ?? []).flatMap(c => 'edits' in c ? c.edits.map(e => 'newText' in e ? e.newText : '') : []);
    assert.deepEqual([...new Set(texts)], ['state']);
    const services = createSwamlServices(EmptyFileSystem), text = wrap(`attribute state: int = 0; operation f() { 'state' = state + 1; } schedule { on start f(); }`);
    const doc = services.shared.workspace.LangiumDocumentFactory.fromString(text, URI.parse('memory:///words.swaml'));
    services.shared.workspace.LangiumDocuments.addDocument(doc);
    await services.shared.workspace.DocumentBuilder.build([doc], { validation: true });
    const refs = semanticIndex([doc.parseResult.value as Model]).filter(x => x.symbol.name === 'state' && !x.declaration).map(x => text.slice(doc.textDocument.offsetAt(x.range.start), doc.textDocument.offsetAt(x.range.end)));
    assert.deepEqual(refs.sort(), ["'state'", 'state']);
});

// Each position of a contextual word, half-typed. The kept 2.2 grammar and the current one recover alike when
// the word is replaced by an ordinary name: the word must keep exactly what the ordinary name keeps.
const positions = [
    (w: string) => `attribute ${w}`,
    (w: string) => `attribute ${w}: int`,
    (w: string) => `attribute ${w}: int =`,
    (w: string) => `const attribute ${w}: int = 1`,
    (w: string) => `port ${w}`,
    (w: string) => `port ${w}:`,
    (w: string) => `reversed port ${w}: P`,
    (w: string) => `operation ${w}(`,
    (w: string) => `operation ${w}(a: int`,
    (w: string) => `operation f(${w}`,
    (w: string) => `operation f(${w}:`,
    (w: string) => `operation f(in ${w}`,
    (w: string) => `operation f(out ${w}: int`,
    (w: string) => `operation f() { var ${w}`,
    (w: string) => `operation f() { var ${w}: int = `,
    (w: string) => `operation f() { ${w} = `,
    (w: string) => `operation f() { ${w}.`,
    (w: string) => `operation f() { ${w}[0]`,
    (w: string) => `operation f() { x = ${w} + }`,
    (w: string) => `operation f() { for (${w}: int in ${w}) { }`,
    (w: string) => `operation f() { for (${w}: int in`,
    (w: string) => `operation f() { for (x: int in ${w}`,
    (w: string) => `operation f() { publish ${w}.`,
    (w: string) => `operation f() { send p.${w}(`,
    (w: string) => `operation f() { initial ${w}; state ${w} {`,
    (w: string) => `operation f() { initial ${w}`,
    (w: string) => `operation f() { initial s; state ${w}`,
    (w: string) => `component ${w}`,
    (w: string) => `component ${w}: `,
    (w: string) => `schedule { on receive ${w}.m(`,
    (w: string) => `schedule { on start ${w}(`,
];
const memberContext = (line: string) => `package Test {
  port def P { provides event m(); }
  component def D {
    attribute x: int = 0;
    ${line}
    attribute after1: int = 1;
    operation later() { x = 2; }
  }
  component Demo: D;
  component Other: D;
}
package After { }`;
const kept = (model: unknown) => {
    const m = model as Model;
    return { packages: m.packages.map(p => p.name), elements: m.packages.flatMap(p => p.elements.map(e => e.$type + ':' + ((e as { name?: string }).name ?? ''))), members: AstUtils.streamAllContents(m).filter(n => a.isAttribute(n) || a.isOperation(n)).map(n => (n as { name: string }).name).filter(n => n === 'after1' || n === 'later').toArray() };
};
test('WP2-S01 a contextual word half-typed in each name position keeps what an ordinary name keeps, also under the 2.2 grammar', async () => {
    const old = await kept22(), { Swaml } = createSwamlServices(EmptyFileSystem);
    for (const position of positions)
        for (const word of ['view', 'state', 'in', 'out']) {
            const ordinary = memberContext(position('plain')), text = memberContext(position(word));
            const now = Swaml.parser.LangiumParser.parse(text), plain = Swaml.parser.LangiumParser.parse(ordinary), before = old.parse(ordinary);
            const label = position(word);
            assert.deepEqual(kept(now.value), kept(plain.value), label);
            assert.ok(kept(now.value).members.length >= kept(before.value).members.length, `${label}: 2.2 kept more`);
            assert.ok(kept(now.value).elements.length >= kept(before.value).elements.length, `${label}: 2.2 kept more elements`);
            assert.ok(now.parserErrors.length <= Math.max(1, before.parserErrors.length + before.lexerErrors.length), `${label}: ${now.parserErrors.length} errors, 2.2 had ${before.parserErrors.length}`);
        }
});

test('WP2-S01 defer stays an ordinary name; at statement start it is a name, and an unknown defer statement keeps the rest', async () => {
    await valid(wrap('attribute defer: int = 0; operation f(defer2: int) { defer = defer + defer2; } schedule { on start f(1); }'));
    const old = await kept22(), { Swaml } = createSwamlServices(EmptyFileSystem);
    for (const line of ['defer p.m;', 'defer = 1;', 'defer', 'defer p.m, q.n;']) {
        const text = typing(line), now = Swaml.parser.LangiumParser.parse(text), before = old.parse(text);
        const d = (now.value as Model).packages[0].elements.find(a.isComponentDef)!;
        assert.ok(AstUtils.streamAllContents(d).filter(a.isAssign).some(s => s.$cstNode?.text === 'x = 3;'), line);
        assert.ok(d.members.some(m => a.isOperation(m) && m.name === 'other'), line);
        assert.ok(now.parserErrors.length <= Math.max(1, before.parserErrors.length), line);
    }
});

test('WP2-S01 (gate 3) a contextual word next to its keyword use prints nothing while parsing', async () => {
    const { logged } = await silently(async () => {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        for (const word of ['view', 'state', 'in', 'out', "'state'", "'view'", "'in'", "'out'"])
            for (const position of positions)
                Swaml.parser.LangiumParser.parse(memberContext(position(word)));
        Swaml.parser.LangiumParser.parse(everyPosition);
    });
    assert.deepEqual(logged, []);
});

// ---------------------------------------------------------------- association lists

const cases = (links: string) => `package Shop {
  port def Till { provides event paid(amount: int); }
  component def Register { reversed port a: Till; reversed port b: Till; attribute total: int = 0; operation take(amount: int) { total = total + amount; } schedule { on receive a.paid(amount) take(amount); on receive b.paid(amount) take(amount); } }
  component def Customer { port till: Till; }
  component def Store { attribute kept: int = 3; }
  component register: Register;
  component alice: Customer;
  component bob: Customer;
  component store: Store;
  connect (alice.till, register.a);
  connect (bob.till, register.b);
  use case Pay of register { publish alice.till.paid(1); publish bob.till.paid(2); wait 1ms; }
  test Totals of register { publish bob.till.paid(5); wait 1ms; assert register.total == 5 and store.kept == 3; }
  ${links}
}`;
test('WP2-G03 WP2-S06 an association list associates every listed occurrence with every listed case', async () => {
    const r = await valid(cases('associate alice, bob, store to Pay, Totals;'));
    const x = r.model.packages[0].associations[0];
    assert.deepEqual([x.occurrence.$refText, x.moreOccurrences.map(o => o.$refText), x.target.$refText, x.moreTargets.map(t => t.$refText)], ['alice', ['bob', 'store'], 'Pay', ['Totals']]);
    assert.deepEqual(associationPairs(x).map(p => [p.occurrence.ref?.name, p.target.ref?.name, p.occurrenceIndex, p.targetIndex]), [['alice', 'Pay', 0, 0], ['alice', 'Totals', 0, 1], ['bob', 'Pay', 1, 0], ['bob', 'Totals', 1, 1], ['store', 'Pay', 2, 0], ['store', 'Totals', 2, 1]]);
    const scenarios = r.model.packages[0].elements.filter(a.isScenario);
    assert.deepEqual(scenarios.map(s => associatedOccurrences(s).map(o => o.name)), [['alice', 'bob', 'store'], ['alice', 'bob', 'store']]);
    assert.equal(runCase([r.model], 'Shop::Pay', { untilNs: 10000000 }).result, 'pass');
    assert.equal(runCase([r.model], 'Shop::Totals', { untilNs: 10000000 }).result, 'pass');
    // Every pair counts: without the last pair (store, Totals) the test may not inspect store.
    const missing = await errors(cases('associate alice, bob to Pay, Totals;'));
    assert.ok(missing.some(([code, m]) => code === 'SW2010' && /store is not an accessible occurrence/.test(String(m))), JSON.stringify(missing));
    // Quoted and unquoted spellings, a single 2.2 statement next to a list, and lists on either side.
    await valid(cases("associate 'alice', bob to Pay;\n  associate store to Totals;\n  associate alice, bob to 'Totals';"));
});

test('WP2-S06 WP2-D03 a repeated pair is an error at the later reference, within a statement and across statements', async () => {
    const at = async (links: string) => {
        const r = await parse(cases(links)), text = cases(links);
        return r.errors.filter(e => e.code === 'SW2010' && /already associated|Duplicate associate/.test(String(e.message))).map(e => [e.message, text.slice(r.doc.textDocument.offsetAt(e.range.start), r.doc.textDocument.offsetAt(e.range.end)), r.doc.textDocument.offsetAt(e.range.start) - text.indexOf(links)]);
    };
    // A repeated occurrence of one list: at the second occurrence.
    assert.deepEqual(await at('associate alice, bob, alice to Pay;'), [['alice is already associated with Pay.', 'alice', 'associate alice, bob, '.length]]);
    // A repeated case of one list: at the second case.
    assert.deepEqual(await at('associate alice to Pay, Totals, Pay;'), [['alice is already associated with Pay.', 'Pay', 'associate alice to Pay, Totals, '.length]]);
    // Across statements, when a list is involved: at the later statement's occurrence.
    const links = 'associate alice, bob to Pay;\n  associate store, bob to Totals, Pay;';
    assert.deepEqual(await at(links), [['bob is already associated with Pay.', 'bob', links.lastIndexOf('bob')]]);
    assert.deepEqual(await at("associate alice to Pay;\n  associate bob, 'alice' to Pay;"), [['alice is already associated with Pay.', "'alice'", "associate alice to Pay;\n  associate bob, ".length]]);
    // Two single 2.2 statements keep the 2.2 message and range.
    const single = await at('associate alice to Pay;\n  associate alice to Pay;');
    assert.deepEqual(single.map(x => [x[0], x[1]]), [['Duplicate associate alice to Pay.', 'associate alice to Pay;']]);
    // As in 2.2, two single statements that spell the same pair differently keep the 2.2 message.
    assert.deepEqual((await at("associate alice to Pay;\n  associate 'alice' to Pay;")).map(x => [x[0], x[1]]), [['Duplicate associate alice to Pay.', "associate 'alice' to Pay;"]]);
});

test('WP2-S06 each pair follows the existing association rules, reported at the listed reference', async () => {
    const text = cases('associate alice, register to Pay, Totals;').replace('package Shop {', 'package Elsewhere { component def C { } component far: C; test Away of far { } }\npackage Shop {\n  import Elsewhere;');
    const r = await parse(text), found = r.errors.filter(e => e.code === 'SW2010' && /subject of/.test(String(e.message))).map(e => [e.message, text.slice(r.doc.textDocument.offsetAt(e.range.start), r.doc.textDocument.offsetAt(e.range.end))]);
    assert.deepEqual(found, [['register is the subject of Pay; associate names another participant.', 'register'], ['register is the subject of Totals; associate names another participant.', 'register']]);
    const elsewhere = await parse(text.replace('associate alice, register to Pay, Totals;', 'associate alice, far to Pay, Away;'));
    const messages = elsewhere.errors.filter(e => e.code === 'SW2010').map(e => e.message);
    assert.ok(messages.includes('associate names a top-level component occurrence of package Shop; far is declared elsewhere.'), JSON.stringify(messages));
    assert.ok(messages.includes('associate names a use case or test of package Shop; Away is declared elsewhere.'), JSON.stringify(messages));
    // An unresolved listed reference is a linking error at that reference.
    assert.ok((await parse(cases('associate alice, nobody to Pay;'))).errors.some(e => e.code === 'SW2001' && /nobody/.test(String(e.message))));
});

test('WP2-M04 the projection holds one link per pair with its list positions; a 2.2 statement has no positions', async () => {
    const r = await valid(cases('associate alice, bob to Pay, Totals;\n  associate store to Totals;'));
    const links = projectModel([r.model]).edges.filter(e => e.kind === 'associate').map(e => [e.source, e.target, e.pair ? `${e.pair.occurrence},${e.pair.case}` : '-']);
    assert.deepEqual(links, [['Shop::alice', 'Shop::Pay', '0,0'], ['Shop::alice', 'Shop::Totals', '0,1'], ['Shop::bob', 'Shop::Pay', '1,0'], ['Shop::bob', 'Shop::Totals', '1,1'], ['Shop::store', 'Shop::Totals', '-']]);
});

test('WP2-S06 rename and references see every listed occurrence and case', async () => {
    const source = cases('associate alice, bob to Pay, Totals;\n  associate store to Totals;');
    const r = await valid(source);
    const refs = semanticIndex([r.model]).filter(x => !x.declaration && x.uri === r.doc.uri.toString());
    const spelled = (name: string) => refs.filter(x => x.symbol.name === name).length;
    assert.equal(spelled('bob'), 4, 'connect, the use case and test scripts and the list');
    assert.equal(spelled('Totals'), 2);
    const edit = await r.Swaml.lsp.RenameProvider!.rename(r.doc, { textDocument: { uri: r.doc.uri.toString() }, position: r.doc.textDocument.positionAt(source.indexOf('Totals of register')), newName: 'Running totals' });
    let next = source;
    for (const change of edit?.documentChanges ?? [])
        if ('textDocument' in change)
            for (const e of [...change.edits].sort((x, y) => r.doc.textDocument.offsetAt(y.range.start) - r.doc.textDocument.offsetAt(x.range.start)))
                if ('newText' in e)
                    next = next.slice(0, r.doc.textDocument.offsetAt(e.range.start)) + e.newText + next.slice(r.doc.textDocument.offsetAt(e.range.end));
    assert.match(next, /associate alice, bob to Pay, 'Running totals';/);
    assert.match(next, /associate store to 'Running totals';/);
    await valid(next);
});

test('WP2-G03 a malformed association list keeps the rest of its package, at least what 2.2 keeps for the nearest single form', async () => {
    const old = await kept22(), { Swaml } = createSwamlServices(EmptyFileSystem);
    const context = (line: string) => `package Shop {\n  requirement R { }\n  component def C { }\n  component alice: C;\n  component bob: C;\n  use case Pay of alice { }\n  ${line}\n  associate bob to Pay;\n  satisfy R by alice;\n}\npackage After { }`;
    const pairs: [string, string][] = [['associate alice, to Pay;', 'associate alice to Pay;'], ['associate alice bob to Pay;', 'associate alice bob to Pay;'], ['associate alice, bob to Pay,;', 'associate alice to Pay;'], ['associate alice, bob to Pay Totals;', 'associate alice to Pay Totals;'], ['associate , alice to Pay;', 'associate to Pay;'], ['associate alice, bob', 'associate alice'], ['associate alice, bob to', 'associate alice to'], ['associate alice to Pay, ', 'associate alice to'], ['associate alice,', 'associate alice'], ['associate state, view to Pay;', 'associate alice to Pay;']];
    for (const [line, nearest] of pairs) {
        const now = Swaml.parser.LangiumParser.parse(context(line)), before = old.parse(context(nearest));
        const model = now.value as Model, previous = before.value as Model;
        assert.deepEqual(model.packages.map(p => p.name), ['Shop', 'After'], line);
        assert.equal(model.packages[0].satisfactions.length, 1, line);
        assert.ok(model.packages[0].associations.length >= previous.packages[0].associations.length, `${line}: 2.2 kept more associations for ${nearest}`);
        // A trailing comma leaves a name position open, like to in 2.2: the contextual word associate then
        // starts the next name, as it does after an unfinished associate alice to in 2.2.
        if (!line.trimEnd().endsWith(','))
            assert.ok(model.packages[0].associations.some(x => /associate bob to Pay;$/.test(x.$cstNode?.text ?? '')), `${line}: the following statement is kept`);
        assert.ok(now.parserErrors.length <= Math.max(1, before.parserErrors.length), `${line}: ${now.parserErrors.length} errors, 2.2 had ${before.parserErrors.length} for ${nearest}`);
    }
});

// ---------------------------------------------------------------- formatter

test('WP2-M05 the formatter prints conditionals with their parentheses, idempotently', async () => {
    const services = createSwamlServices(EmptyFileSystem), parseOnly = parseHelper<Model>(services.Swaml);
    const source = wrap('attribute x: int = 0;\n operation f(c: bool) { x = if(c)1 else 2; x = 1+( if (c) 2 else 3 )+4; x = if (c) (x + 1) else(x - 1); x = if (c)-1 else if (not c) 2 else 3; } schedule { on start f(true); }');
    const once = formatDocument(await parseOnly(source));
    assert.match(once, /x = if \(c\) 1 else 2;/);
    assert.match(once, /x = 1 \+ \(if \(c\) 2 else 3\) \+ 4;/);
    assert.match(once, /x = if \(c\) \(x \+ 1\) else \(x - 1\);/);
    assert.match(once, /x = if \(c\) -1 else if \(not c\) 2 else 3;/);
    assert.equal(formatDocument(await parseOnly(once)), once);
    const doc = await parseOnly(once);
    assert.equal(doc.parseResult.parserErrors.length, 0);
});

test('WP2-M05 association lists print on one line when they fit, otherwise one occurrence or case per continuation line', async () => {
    const services = createSwamlServices(EmptyFileSystem), parseOnly = parseHelper<Model>(services.Swaml);
    const short = formatDocument(await parseOnly(cases('associate   alice ,bob to Pay,Totals ;')));
    assert.match(short, /\n {2}associate alice, bob to Pay, Totals;\n/);
    const long = cases("associate alice, bob, store to Pay, Totals;").replace(/\bPay\b/g, "'Pay at the till with a card'").replace(/\bTotals\b/g, "'Totals add up after every single payment'");
    const formatted = formatDocument(await parseOnly(long));
    const lines = formatted.split('\n'), start = lines.findIndex(l => l.trimStart().startsWith('associate'));
    assert.deepEqual(lines.slice(start, start + 5), ['  associate alice,', '    bob,', '    store', "    to 'Pay at the till with a card',", "    'Totals add up after every single payment';"]);
    assert.ok(`  associate alice, bob, store to 'Pay at the till with a card', 'Totals add up after every single payment';`.length > ASSOCIATION_LINE_WIDTH);
    assert.equal(formatDocument(await parseOnly(formatted)), formatted, 'idempotent');
    // A single 2.2 statement is never wrapped, whatever its length.
    const single = formatDocument(await parseOnly(cases("associate alice to 'A use case whose name is long enough to pass the line width of one hundred characters';")));
    assert.match(single, /\n {2}associate alice to 'A use case whose name is long enough to pass the line width of one hundred characters';\n/);
    // A comment inside a long list keeps the token-preserving layout.
    const commented = cases("associate alice, /* the second */ bob, store to 'Pay at the till with a card', 'Totals add up after every single payment';");
    const kept = formatDocument(await parseOnly(commented));
    assert.match(kept, /\/\* the second \*\//);
    assert.equal(formatDocument(await parseOnly(kept)), kept);
});

test('WP2-M05 the formatter safety net accepts every new form and the new examples are canonical', async () => {
    const services = createSwamlServices(EmptyFileSystem), parseOnly = parseHelper<Model>(services.Swaml);
    for (const file of ['examples/35-conditional-expression.swaml', 'examples/36-contextual-words.swaml', 'examples/37-association-lists.swaml']) {
        const text = readFileSync(new URL(file, root), 'utf8').replaceAll('\r\n', '\n'), doc = await parseOnly(text);
        assert.equal(formatDocument(doc), text, `${file} is canonical`);
        const tokens = CstUtils.flattenCst(doc.parseResult.value.$cstNode!).filter(n => n.tokenType.name !== 'WS').toArray();
        assert.doesNotThrow(() => verifyFormatting(text, tokens, formatDocument(doc)));
    }
});

test('WP2-M02 WP2-M03 the KerML inventory maps the conditional to ControlFunctions::if and association lists to pairs', () => {
    const mapping = JSON.parse(readFileSync(new URL('spec/kerml-mapping.json', root), 'utf8')).mapping as { source: string; kind: string; kernel: string[]; semantic: string }[];
    const conditional = mapping.find(m => m.source === 'ConditionalExpression')!;
    assert.deepEqual([conditional.kind, conditional.kernel], ['value', ["ControlFunctions::'if'"]]);
    assert.match(conditional.semantic, /only the selected branch/);
    assert.match(mapping.find(m => m.source === 'Association')!.semantic, /one reference per occurrence–case pair/);
    const keywords = JSON.parse(readFileSync(new URL('spec/keywords.json', root), 'utf8')).entries as { keyword: string; contextual: boolean; productions: string[] }[];
    for (const word of ['view', 'state', 'in', 'out'])
        assert.equal(keywords.find(k => k.keyword === word)!.contextual, true, word);
    assert.ok(keywords.find(k => k.keyword === 'if')!.productions.includes('ConditionalExpression'));
});

// ---------------------------------------------------------------- review fixes (WP2 review H1, H2, M1, M3, L1, L2, L3, L6)

test('WP2-M01 diagnostics on 2.2 sources keep the 2.2 quoting of view, state, in and out (review H1)', async () => {
    const hint = await errors(`package Test {
  port def P { provides event e(v: int); }
  component def Env { port p: P; }
  component def Sys { reversed port p: P; attribute n: int = 0; operation h(v: int) { n = v; } schedule { on receive p.e(v) h(v); } }
  component sys: Sys;
  component 'in': Env;
  connect ('in'.p, sys.p);
  use case 'state' of sys {
    publish 'in'.p.e(1);
  }
}`);
    assert.ok(hint.some(([, m]) => m === "in takes part in state only when associated: write associate 'in' to 'state'; in package Test."), JSON.stringify(hint));
    const ambiguous = await parse(`package A { component def 'state' { } }
package B { component def 'state' { } }
package Test { import A; import B; component x: 'state'; }`);
    const d = ambiguous.errors.find(e => e.code === 'SW2001')!;
    assert.match(String(d.message), /^Ambiguous name 'state': it names component def A::'state' \(imported\)/);
    assert.deepEqual(d.relatedInformation?.map(r => r.message), ["Declaration A::'state'", "Declaration B::'state'"]);
});

test('WP2-M01 the name functions are safe as callbacks and have edition-bound variants (review M1)', () => {
    assert.deepEqual(['in', 'x', 'state', 'operation'].map(formatName), ['in', 'x', 'state', "'operation'"]);
    assert.deepEqual(['a.b', 'state.in'].map(formatPath), ['a.b', 'state.in']);
    assert.deepEqual(['view::state'].map(formatQualifiedName), ['view::state']);
    assert.deepEqual(['in', 'x'].map(isBasicName), [true, true]);
    const old = namesFor('2.2');
    assert.deepEqual(['in', 'x', 'state'].map(old.formatName), ["'in'", 'x', "'state'"]);
    assert.deepEqual(['P::in.state'].map(old.formatPath), ["P::'in'.'state'"]);
    assert.equal(old.reservedWords, RESERVED_WORDS_2_2);
    assert.equal(MESSAGE_SPELLING, '2.2');
});

test('the string-name hint always quotes its example (review L2)', async () => {
    assert.match((await syntax('package Test { component def "state" { } }')).join('\n'), /Names use single quotes, for example 'state'\./);
    assert.match((await syntax('package Test { component def "Pump" { } }')).join('\n'), /for example 'Pump'\./);
});

// An incomplete line typed directly above another statement: the conditional never takes if (…) { as its start.
const above = (line: string, next: string) => `package P {
  component def D {
    attribute n: int = 0;
    attribute xs: int[2] = [0, 0];
    operation foo(v: int) returns int { return v; }
    operation a() {
      n = 1;
      ${line}
      ${next}
      n = 9;
    }
    operation b() {
      n = 2;
    }
    schedule { on start a(); }
  }
  component Demo: D;
}
package After { }`;
test('WP2-G01 an incomplete line above an if, while, for, try or return statement keeps the rest of the component (review H2)', async () => {
    const old = await kept22(), { Swaml } = createSwamlServices(EmptyFileSystem);
    const lines = ['n =', 'var y: int =', 'return', 'assert', 'foo(', 'xs[', 'n = foo(1,', 'n = xs[0] +', 'n = if (n > 0) 1', 'n = (', 'xs[0] ='];
    const nexts = ['if (n > 0) {\n        n = 3;\n      }', 'if (n > 0) {\n        n = 3;\n      } else {\n        n = 4;\n      }', 'while (n > 0) {\n        n = n - 1;\n      }', 'for (var i: int = 0; i < 2; i = i + 1) {\n        n = i;\n      }', 'n = try(foo(1), 0);', 'return;'];
    for (const line of lines)
        for (const next of nexts) {
            const text = above(line, next), now = Swaml.parser.LangiumParser.parse(text), before = old.parse(text);
            const model = now.value as Model, d = model.packages[0]?.elements.find((e): e is a.ComponentDef => a.isComponentDef(e) && e.name === 'D');
            const label = `${line} / ${next.split('\n')[0]}`;
            assert.ok(d, label);
            assert.deepEqual(d.members.map(m => a.isSchedule(m) ? 'schedule' : (m as { name: string }).name), ['n', 'xs', 'foo', 'a', 'b', 'schedule'], label);
            assert.ok(model.packages[0].elements.some(e => a.isComponentUsage(e) && e.name === 'Demo'), label);
            assert.deepEqual(model.packages.map(p => p.name), ['P', 'After'], label);
            assert.ok(now.parserErrors.length <= Math.max(1, before.parserErrors.length), `${label}: ${now.parserErrors.length} errors, 2.2 had ${before.parserErrors.length}`);
        }
});

test('WP2-G01 a generated 5,000-line file with an incomplete line in every third line keeps all 250 operations (review H2)', () => {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const bad = ['n =', 'var y: int =', 'return', 'assert', 'foo(', 'xs[', 'xs[0].'], good = ['if (n > 0) { n = 2; }', 'n = 1;', 'while (n > 3) { n = n - 1; }', 'xs[0] = n;', 'if (n > 1) { n = 0; } else { n = 1; }', 'n = foo(n);'];
    const ops: string[] = [];
    for (let o = 0; o < 250; o++) {
        const lines: string[] = [];
        for (let l = 0; l < 18; l++)
            lines.push(l % 3 === 1 ? bad[(o + l) % bad.length] : good[(l + (l % 3 === 2 ? 0 : 1)) % good.length]);
        ops.push(`    operation op${o}() {\n      ${lines.join('\n      ')}\n      if (n > 0) {\n        n = 0;\n      }\n    }`);
    }
    const text = `package P {\n  component def D {\n    attribute n: int = 0;\n    attribute xs: int[2] = [0, 0];\n    operation foo(v: int) returns int { return v; }\n${ops.join('\n')}\n    schedule { on start op0(); }\n  }\n  component Demo: D;\n}\n`;
    assert.ok(text.split('\n').length > 5000);
    const started = performance.now(), parsed = Swaml.parser.LangiumParser.parse(text), d = (parsed.value as Model).packages[0].elements.find(a.isComponentDef)!;
    assert.equal(d.members.filter(m => a.isOperation(m) && m.name.startsWith('op')).length, 250);
    assert.ok(d.members.some(a.isSchedule));
    assert.ok(performance.now() - started < 20000, 'parsed within 20 s');
});

// The parser nesting limits (review M3, L1, N1–N3) are tested in nesting-limits.test.ts (WP2-D05).

test('WP2-S02 branch types unify without the expected type (review L3)', async () => {
    // Each branch is typed on its own: int[2] branches do not become byte[2], and a literal branch is not range-checked against the destination.
    assert.ok((await errors(wrap('attribute b: byte[2] = [0, 0]; operation f(c: bool) { b = if (c) [1, 2] else [3, 4]; }'))).some(([code, m]) => code === 'SW2002' && m === 'Expected byte[2], received int[2].'));
    await valid(wrap('attribute b: byte[2] = [0, 0]; operation f() { b = [1, 2]; }'));
    await valid(wrap('attribute b: byte = 0; operation f(c: bool) { b = if (c) 300 else b; }'));
});

test('WP2-S02 a conditional with an int and a real branch widens to real before the arithmetic (review L6)', async () => {
    const widened = await valid(wrap('attribute r: real = 0.0; operation f(c: bool) { r = (if (c) 9007199254740991 else 0.5) + 1; } schedule { on start f(true); }'));
    assert.equal(simulate([widened.model], 'Test::Demo', { untilNs: 1000 }).stores.Demo.r, 9007199254740992);
    const integral = await valid(wrap('attribute r: real = 0.0; operation f(c: bool) { r = (if (c) 9007199254740991 else 0) + 1; } schedule { on start f(true); }'));
    const run = simulate([integral.model], 'Test::Demo', { untilNs: 1000 });
    assert.equal(run.stores.Demo.r, 0, 'integer overflow fails the activation and leaves r unchanged');
});

test('WP2-S06 WP2-M04 unfinished associate, satisfy and verify lines project, validate and build view candidates without throwing; an unfinished link is left out', async () => {
    const { viewCandidates } = await import('../../src/language/presentation.js');
    const { workspace } = await import('./helpers.js');
    const lines = ['associate ;', 'associate a to ;', 'associate a, to t;', 'associate a to t,;', 'associate a, x to ;', 'satisfy by x;', 'satisfy R by ;', 'satisfy ;', 'verify by t;', 'verify R by ;', 'verify ;'];
    const valid22 = `package Q {\n  requirement S { }\n  component def D { }\n  component y: D;\n  component w: D;\n  test u of y { }\n  associate w to u;\n  satisfy S by y;\n  verify S by u;\n}\n`;
    for (const line of lines) {
        const source = `package P {\n  requirement R { }\n  component def C { }\n  component x: C;\n  component a: C;\n  test t of a { }\n  ${line}\n}\n`;
        const r = await parse(source);
        assert.ok(r.errors.length && r.errors.every(e => e.code === 'SW2000' || e.code === 'SW2001'), `${line}: ${JSON.stringify(r.errors.map(e => [e.code, e.message]))}`);
        const p = projectModel([r.model]);
        // A complete pair of a list keeps its link; every unfinished link is left out, none points to an undefined end.
        const kept = /^associate a, to t;|^associate a to t,;/u.test(line) ? [['associate', 'P::a', 'P::t']] : [];
        assert.deepEqual(p.edges.filter(e => ['associate', 'satisfy', 'verify'].includes(e.kind)).map(e => [e.kind, e.source, e.target]), kept, line);
        assert.ok(p.edges.every(e => !e.source.includes('undefined') && !e.target.includes('undefined')), line);
        assert.ok(viewCandidates([r.model]).length > 0, line);
        semanticIndex([r.model]);
        // In a workspace next to a valid file, validation and the joint projection keep the valid file's links.
        const ws = await workspace([source, valid22]);
        const models = ws.docs.map(d => d.parseResult.value as Model);
        assert.deepEqual(ws.docs[1].diagnostics?.filter(d => d.severity === 1).map(d => d.code), [], line);
        const joint = projectModel(models);
        assert.deepEqual(joint.edges.filter(e => ['associate', 'satisfy', 'verify'].includes(e.kind)).map(e => [e.kind, e.source, e.target]), [...kept, ['associate', 'Q::w', 'Q::u'], ['satisfy', 'Q::y', 'Q::S'], ['verify', 'Q::u', 'Q::S']], line);
        viewCandidates(models);
    }
    // A list with one unfinished entry keeps its complete pairs with their list positions.
    const partial = projectModel([(await parse('package P {\n  component def C { }\n  component x: C;\n  component a: C;\n  test t of a { }\n  associate a, x, to t;\n}\n')).model]);
    assert.ok(partial.edges.every(e => !e.target.includes('undefined')));
});
