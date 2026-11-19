// Half-typed states (final package, review gaps L-1 of review 1 and F8 of review 2): each half-typed form gets one message
// that says what is missing, and a nameless state keeps the rest of the package.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import * as a from '../../src/language/generated/ast.js';
import { AFTER_OUTSIDE_STATE_MESSAGE, OR_IN_STATE_MESSAGE, STATE_IN_ACTION_MESSAGE } from '../../src/language/swaml-syntax.js';
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
