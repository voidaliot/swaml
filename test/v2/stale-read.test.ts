import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, valid } from './helpers.js';

const wrap = (members: string, extra = '') => `package Test { ${extra} component Demo { ${members} } }`;
const ports = 'port def Ticks { provides event tick(v: int); } component Source { port output: Ticks; operation go() { publish output.tick(1); } schedule { on start go(); } } connect (Source.output, Demo.input);';
/** The SW2011 warnings of a valid model, as the source text of each reported node. */
async function stale(members: string, extra = '') {
    const r = await valid(wrap(members, extra));
    return r.warnings.filter(w => w.code === 'SW2011').map(w => r.doc.textDocument.getText(w.range));
}

test('SW2011 reports a write whose value was read before a suspension', async () => {
    assert.deepEqual(await stale('attribute n: int = 1; operation f() { var before: int = n; wait 1ms; n = before + 1; } schedule { on start f(); }'), ['n = before + 1;']);
    // A value returned by an operation that reads state and then suspends is stale.
    assert.deepEqual(await stale('attribute n: int = 1; operation later() returns int { var x: int = n; wait 1ms; return x; } operation f() { var y: int = later(); n = y; } schedule { on start f(); }'), ['n = y;']);
    // Staleness survives loops: the read in one iteration reaches the write after the next wait.
    assert.deepEqual(await stale('attribute n: int = 1; operation f() { var x: int = 0; for (var i: int = 0; i < 2; i = i + 1) { n = x; x = n; wait 1ms; } } schedule { on start f(); }'), ['n = x;']);
});

test('SW2011 reports a write under a condition read before a suspension', async () => {
    assert.deepEqual(await stale('attribute n: int = 1; operation f() { if (n > 0) { wait 1ms; n = 0; } } schedule { on start f(); }'), ['n = 0;']);
    // Re-checking a different attribute does not re-check the stale condition.
    assert.deepEqual(await stale('attribute n: int = 1; attribute m: int = 1; operation f() { if (n > 0) { wait 1ms; if (m > 0) { n = 0; } } } schedule { on start f(); }'), ['n = 0;']);
});

test('SW2011 accepts a re-read after resuming and a condition re-checked after resuming', async () => {
    // Comparing the live attribute with the value read before the suspension re-checks it.
    assert.deepEqual(await stale('attribute n: int = 1; operation f() { var head: int = n; wait 1ms; if (n == head) { n = n + 1; } } schedule { on start f(); }'), []);
    // A condition that only partly re-checks still leaves its stale input.
    assert.deepEqual(await stale('attribute n: int = 1; attribute m: int = 1; operation f() { if (m > 0 and n > 0) { wait 1ms; if (n > 0) { n = 0; } } } schedule { on start f(); }'), ['n = 0;']);
    assert.deepEqual(await stale('attribute n: int = 1; operation f() { var before: int = n; wait 1ms; n = n + 1; } schedule { on start f(); }'), []);
    assert.deepEqual(await stale('attribute n: int = 1; operation f() { if (n > 0) { wait 1ms; if (n > 0) { n = n - 1; } } } schedule { on start f(); }'), []);
    assert.deepEqual(await stale('attribute n: int = 1; operation f() { while (n > 0, 3 times) { wait 1ms; if (n > 0) { n = n - 1; } } } schedule { on start f(); }'), []);
    // A value read after resuming may be written; one read before is only reported if it reaches the write.
    assert.deepEqual(await stale('attribute n: int = 1; attribute m: int = 0; operation f() { var x: int = m; wait 1ms; x = n; n = x + 1; } schedule { on start f(); }'), []);
    // A value read after a suspending call returns is fresh.
    assert.deepEqual(await stale('attribute n: int = 1; operation later() returns int { wait 1ms; return 1; } operation f() { var y: int = later(); n = y + n; } schedule { on start f(); }'), []);
});

test('SW2011 treats each state reaction separately', async () => {
    const machine = (entry: string) => `attribute n: int = 1; reversed port input: Ticks; operation lamp() { initial A; state A { on entry { if (n > 0) { n = 2; } } on receive input.tick(v) to B { } } state B { on entry { ${entry} } } } schedule { on start lamp(); }`;
    // A read in one reaction does not reach a write after a wait in another reaction.
    assert.deepEqual(await stale(machine('wait 1ms; n = 3;'), ports), []);
    // Within one reaction the rule still applies.
    assert.deepEqual(await stale(machine('var x: int = n; wait 1ms; n = x;'), ports), ['n = x;']);
    // A transition guard is read before its effect.
    assert.deepEqual(await stale(`attribute n: int = 1; reversed port input: Ticks; operation lamp() { initial A; state A { on receive input.tick(v) when (n > 0) to B { wait 1ms; n = 0; } } state B { } } schedule { on start lamp(); }`, ports), ['n = 0;']);
});

test('SW2011 follows calls to operations that write attributes', async () => {
    const helper = 'attribute n: int = 1; operation set(v: int) { n = v; }';
    // Moving the write into a helper no longer hides it.
    assert.deepEqual(await stale(helper + ' operation f() { var before: int = n; wait 1ms; set(before + 1); } schedule { on start f(); }'), ['set(before + 1)']);
    assert.deepEqual(await stale(helper + ' operation f() { if (n > 0) { wait 1ms; set(0); } } schedule { on start f(); }'), ['set(0)']);
    assert.deepEqual(await stale(helper + ' operation f() { wait 1ms; set(n + 1); } schedule { on start f(); }'), []);
    // A helper that suspends before writing a state-derived argument writes a stale value.
    assert.deepEqual(await stale('attribute n: int = 1; operation later(v: int) { wait 1ms; n = v; } operation f() { later(n + 1); } schedule { on start f(); }'), ['later(n + 1)']);
    // A nested operation is analysed on its own, not as part of its owner's statements.
    assert.deepEqual(await stale('attribute n: int = 1; operation f() { operation g() { n = 1; } var x: int = n; wait 1ms; g(); } schedule { on start f(); }'), []);
});

test('SW2011 keeps its identity metadata and recovers from malformed operations', async () => {
    const r = await valid(wrap('attribute n: int = 1; operation f() { var before: int = n; wait 1ms; n = before + 1; } schedule { on start f(); }'));
    const w = r.warnings.find(x => x.code === 'SW2011')!;
    assert.equal(w.severity, 2);
    assert.ok(w.data.declaration);
    const broken = await parse(wrap('attribute n: int = 1; operation f() { var before: int = n; wait 1ms; n = ; } schedule { on start f(); }'));
    assert.ok(broken.errors.some(e => e.code === 'SW2000'));
    assert.ok(!broken.warnings.some(x => x.code === 'SW2011'));
});
