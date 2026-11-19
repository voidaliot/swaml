// Half-typed states (final package, review gaps L-1 of review 1 and F8 of review 2): each half-typed form gets one message
// that says what is missing, and a nameless state keeps the rest of the package.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import * as a from '../../src/language/generated/ast.js';
import { AFTER_OUTSIDE_STATE_MESSAGE, OR_IN_STATE_MESSAGE, STATE_IN_ACTION_MESSAGE, WHEN_IN_STATE_MESSAGE } from '../../src/language/swaml-syntax.js';
import { parse } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });

const model = (body: string, attributes = 'attribute x: uint = 0;') => `package R {
  port def P { provides event go(n: uint); provides event stop(); }
  component def C {
    reversed port p: P;
    ${attributes}
    operation run() {
      ${body}
    }
    operation ping() { send p.go(1); }
    schedule { on start run(); }
  }
  component def D { attribute y: uint = 0; }
}
`;
const first = async (source: string) => (await parse(source)).errors[0];
const components = async (source: string) => (await parse(source)).model.packages[0].elements.filter(a.isComponentDef).map(c => c.name);

test('to ; in a state with a value named to: one message that names the missing state', async () => {
    const r = await parse(model('state s { to ; }\n      state t { on receive p.stop() exit; }', 'attribute to: uint = 0; attribute x: uint = 0;'));
    assert.deepEqual(r.errors.filter(e => ['SW2006', 'SW2008'].includes(String(e.code))).map(e => [e.code, e.message]), [['SW2008', 'to needs the state it goes to, as in to S; (to alone reads a value named to).']]);
    // Outside a state, to; keeps its 2.2 messages.
    const flow = await parse(model('to;', 'attribute to: uint = 0;'));
    assert.deepEqual(flow.errors.filter(e => e.code === 'SW2006').map(e => e.message), ['A non-void result cannot be discarded.', 'Expression statements must call an operation or try.']);
});

test('after D { … } outside a state: the message says it is a line of a state and how the flow waits', async () => {
    const e = await first(model('after 10ms { x = 1; }'));
    assert.equal(e.code, 'SW2000');
    assert.equal(e.message, AFTER_OUTSIDE_STATE_MESSAGE);
    assert.equal(e.range.start.line, 6);
});

test('on receive … or receive … in a state: the message says one line per member', async () => {
    const e = await first(model('state s { on receive p.go(n) { x = n; } or receive p.stop() { exit; } }'));
    assert.equal(e.message, OR_IN_STATE_MESSAGE);
});

test('a state inside on entry: the message says where a state stands', async () => {
    const e = await first(model('state s { on entry { state u { } } on receive p.stop() exit; }'));
    assert.equal(e.message, STATE_IN_ACTION_MESSAGE);
});

test('a nameless inner state reports the missing name and keeps the rest of the package', async () => {
    const r = await parse(model('state s { on receive p.stop() exit; state { } state v { on receive p.go(n) exit; } }\n      state t { on receive p.stop() exit; }'));
    assert.deepEqual(r.errors.map(e => e.message), ['Expecting a name but found `{`.']);
    assert.deepEqual(await components(model('state { on receive p.stop() exit; }')), ['C', 'D']);
    const run = r.model.packages[0].elements.filter(a.isComponentDef)[0].members.filter(a.isOperation)[0];
    const s = run.body.statements[0] as a.StateStep;
    assert.deepEqual(s.statements.filter(a.isStateStep).map(x => x.name).slice(-1), ['v']);
});

test('an unclosed parent: the error names the state that is not closed instead of a reserved word', async () => {
    const e = await first(model('state s { on receive p.stop() exit;\n        state v { on receive p.go(n) exit; }\n      state t { on receive p.stop() exit; }'));
    assert.match(String(e.message), /^Expecting token of type '\}' but found `operation`. The state s is not closed: add its \}/);
    assert.ok(!String(e.message).includes('reserved word'));
    // A source without states keeps the 2.2 message.
    const plain = await first(model('if (x > 1) {\n        x = 2;'));
    assert.match(String(plain.message), /'operation' is a reserved word/);
});

test('the 2.2 machine-syntax error is not raised by documentation or comments that read like it', async () => {
    const source = model('/** The initial value 20; the final state { is a word here. */\n      x = ;');
    const e = await first(source);
    assert.ok(!String(e.message).startsWith('This is swa.ml 2.2 state-machine syntax'), String(e.message));
    const machine = await first(model('initial a;\n      state a { }\n      final state b { }'));
    assert.match(String(machine.message), /^This is swa\.ml 2\.2 state-machine syntax/);
});

// ---------------------------------------------------------------- final-package review M1, m5, m6
const kept = (body: string) => `package S {
  port def In { provides event m(); provides event k(); }
  component def M {
    reversed port p: In;
    attribute x: uint = 0;
    attribute c: bool = false;
    operation run() {
      ${body}
    }
    schedule { on start run(); }
  }
  component def D { port toP: In; }
  component m: M;
  component d: D;
  connect (d.toP, m.p);
}
`;
/** The errors, and whether the schedule, the later component and occurrences and the connection are still in the AST. */
async function recovered(body: string) {
    const r = await parse(kept(body)), p = r.model.packages[0];
    const m = p.elements.filter(a.isComponentDef).find(x => x.name === 'M');
    return {
        errors: r.errors.map(e => String(e.message)),
        rest: [!!m?.members.some(a.isSchedule), p.elements.filter(a.isComponentDef).map(x => x.name).join(','), p.elements.filter(a.isComponentUsage).map(x => x.name).join(','), p.connections.length],
    };
}
const REST = [true, 'M,D', 'm,d', 1];

test('M1: after D { … } in the flow outside a state: one message, the rest of the package kept', async () => {
    assert.deepEqual(await recovered('after 5ms { x = 1; }\n      state a { on receive p.m() exit; on receive p.k() exit; }'), { errors: [AFTER_OUTSIDE_STATE_MESSAGE], rest: REST });
    assert.deepEqual(await recovered('after 5ms exit;\n      state a { on receive p.m() exit; on receive p.k() exit; }'), { errors: [AFTER_OUTSIDE_STATE_MESSAGE], rest: REST });
});

test('M1: an event line joined by or, in every spelling: one message, the first line kept, the rest of the package kept', async () => {
    for (const line of ['on receive p.m() or receive p.k() { exit; }', 'on receive p.m() or p.k() { exit; }', 'on receive p.m() or receive p.k() exit;', 'on receive p.m() { exit; } or receive p.k() { exit; }']) {
        const r = await recovered(`state a { ${line} }`);
        assert.deepEqual(r, { errors: [OR_IN_STATE_MESSAGE], rest: REST }, line);
    }
});

test('M1: when (c) { … } in a state: read as if, one message that names if, the rest kept', async () => {
    const r = await recovered('state a { on receive p.m() exit; on receive p.k() exit; when (c) { x = 1; } }');
    assert.deepEqual(r, { errors: [WHEN_IN_STATE_MESSAGE], rest: REST });
    const s = (await parse(kept('state a { on receive p.m() exit; on receive p.k() exit; when (c) { x = 1; } }'))).model.packages[0].elements.filter(a.isComponentDef)[0].members.filter(a.isOperation)[0].body.statements[0] as a.StateStep;
    assert.ok(a.isIf(s.statements[2]), 'when (c) is kept as an if');
    // when as a name stays a name.
    assert.deepEqual((await parse(model('var when: uint = 1;\n      state s { on receive p.stop() exit; }\n      when = when + 1;'))).errors.filter(e => e.code === 'SW2000'), []);
});

test('m6: a state inside on entry: one message, no follow-on error, the rest kept', async () => {
    assert.deepEqual(await recovered('state a { on entry { state u { } } on receive p.m() exit; on receive p.k() exit; }'), { errors: [STATE_IN_ACTION_MESSAGE], rest: REST });
});

test('m5: x = final with a missing ; before a state is the missing ;, not 2.2 machine syntax; no quoting hint', async () => {
    for (const word of ['final', 'initial']) {
        const r = await parse(kept(`x = ${word}\n      state a { on receive p.m() exit; on receive p.k() exit; }`).replace('attribute c: bool = false;', `attribute c: bool = false; attribute ${word}: uint = 0;`));
        assert.deepEqual(r.errors.map(e => String(e.message)), ['Expecting token of type \';\' but found `state`.'], word);
    }
});

test('m6: to ; in a state reports only the missing state', async () => {
    const r = await parse(kept('state a { to ; }\n      state b { on receive p.m() exit; on receive p.k() exit; }'));
    assert.deepEqual(r.errors.map(e => String(e.code)), ['SW2008']);
});

test('M1: after followed by no body, outside a state: the parser gives the same message at after', async () => {
    const e = (await parse(kept('after 5ms x = 1;\n      state a { on receive p.m() exit; on receive p.k() exit; }'))).errors[0];
    assert.equal(String(e.message), AFTER_OUTSIDE_STATE_MESSAGE);
});
