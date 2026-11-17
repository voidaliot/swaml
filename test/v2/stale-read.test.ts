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
    // Re-checking every attribute the write depends on clears a stale condition, even one that read more.
    assert.deepEqual(await stale('attribute n: int = 1; attribute m: int = 1; operation f() { if (m > 0 and n > 0) { wait 1ms; if (n > 0) { n = 0; } } } schedule { on start f(); }'), []);
    // A partial re-check that covers neither the condition nor the write leaves the stale input.
    assert.deepEqual(await stale('attribute n: int = 1; attribute m: int = 1; attribute k: int = 0; operation f() { if (m > 0 and n > 0) { wait 1ms; if (n > 0) { k = 0; } } } schedule { on start f(); }'), ['k = 0;']);
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

test('SW2011 does not read out-argument targets and follows out values', async () => {
    // The out argument is only written by the call; the value written was not read before a suspension.
    assert.deepEqual(await stale('attribute n: int = 1; operation fetch(out v: int) { wait 1ms; v = 5; } operation f() { fetch(n); } schedule { on start f(); }'), []);
    // An out value computed from an input read before the callee suspended is stale.
    assert.deepEqual(await stale('attribute n: int = 1; attribute m: int = 0; operation fetch(k: int, out v: int) { wait 1ms; v = k; } operation f() { fetch(m, n); } schedule { on start f(); }'), ['fetch(m, n)']);
    // An out local carries the out value onward.
    assert.deepEqual(await stale('attribute n: int = 1; attribute m: int = 0; operation fetch(k: int, out v: int) { wait 1ms; v = k; } operation f() { var x: int = 0; fetch(m, x); n = x; } schedule { on start f(); }'), ['n = x;']);
});

test('SW2011 analyses one reaction as exit, transition effect and target entry under the guard', async () => {
    const machine = (a: string, effect: string, b: string) => `attribute n: int = 1; reversed port input: Ticks; operation lamp() { initial A; state A { ${a} on receive input.tick(v) when (n > 0) to B { ${effect} } } state B { ${b} } } schedule { on start lamp(); }`;
    assert.deepEqual(await stale(machine('on exit { wait 1ms; }', 'n = 0;', ''), ports), ['n = 0;']);
    assert.deepEqual(await stale(machine('', 'wait 1ms;', 'on entry { n = 0; }'), ports), ['n = 0;']);
    assert.deepEqual(await stale(machine('', 'wait 1ms;', 'on entry { if (n > 0) { n = 0; } }'), ports), []);
    assert.deepEqual(await stale(machine('on exit { n = 2; }', 'n = 0;', 'on entry { n = 3; }'), ports), []);
});

test('SW2011 on the showcase shapes: a re-check of what the write depends on clears a stale condition', async () => {
    const shape = (op: string) => `attribute active: bool = true; attribute running: bool = true; attribute speed: int = 0; attribute lastSpeed: int = 0; attribute sent: int = 0; attribute up: bool = true; attribute count: int = 3; operation sign() { wait 1ms; } ${op} schedule { on start f(); }`;
    // A repetition counted after the event ended while signing: a real hazard.
    assert.deepEqual(await stale(shape('operation f() { if (active) { sign(); sent = sent + 1; } }')), ['sent = sent + 1;']);
    // Re-reading the condition after signing, with an early return, clears it.
    assert.deepEqual(await stale(shape('operation f() { if (active) { sign(); if (not active) { return; } sent = sent + 1; } }')), []);
    // Recording the value read before signing after leaving running is re-checked, but the value is stale.
    assert.deepEqual(await stale(shape('operation f() { var frame: int = speed; sign(); if (not running) { return; } lastSpeed = frame; }')), ['lastSpeed = frame;']);
    // A loop condition input not involved in the write, whose own input is re-checked first: no warning.
    assert.deepEqual(await stale(shape('operation f() { var proceed: bool = up; while (proceed and count > 0, 4 times) { sign(); if (count > 0) { count = count - 1; } proceed = up; } }')), []);
});

test('SW2011 interrupt handlers start from every suspension of the protected body', async () => {
    assert.deepEqual(await stale('attribute n: int = 1; reversed port input: Ticks; operation f() { var x: int = 0; interruptible { x = n; wait 1ms; x = 0; wait 1ms; } on receive input.tick(v) { n = x; } } schedule { on start f(); }', ports), ['n = x;']);
    assert.deepEqual(await stale('attribute n: int = 1; reversed port input: Ticks; operation f() { var x: int = 0; interruptible { wait 1ms; x = n; } on receive input.tick(v) { n = v; } } schedule { on start f(); }', ports), []);
});

test('SW2011 loops reach a fixed point through long chains of locals', async () => {
    const chain = (k: number) => `attribute n: int = 1; operation f() { ${Array.from({ length: k }, (_, i) => `var x${i}: int = 0;`).join(' ')} while (true, 9 times) { n = x${k - 1}; ${Array.from({ length: k - 1 }, (_, i) => `x${k - 1 - i} = x${k - 2 - i};`).join(' ')} x0 = n; wait 1ms; } } schedule { on start f(); }`;
    for (const k of [4, 6, 12])
        assert.deepEqual(await stale(chain(k)), [`n = x${k - 1};`]);
});

test('SW2011 stays fast on deep call graphs with shared callees inside loops and branches', async () => {
    const model = (depth: number, calls: number, loop: boolean) => {
        let ops = '';
        for (let i = 0; i < depth; i++)
            ops += `operation o${i}() { ${loop ? 'while (n > 0, 2 times)' : 'if (n > 0)'} { ${Array.from({ length: calls }, () => `o${i + 1}();`).join(' ')} } } `;
        return `${ops}operation o${depth}() { n = n + 1; } operation f() { wait 1ms; o0(); } schedule { on start f(); }`;
    };
    await stale('attribute n: int = 1; ' + model(2, 2, true));
    for (const depth of [12, 20])
        for (const calls of [2, 3])
            for (const loop of [true, false]) {
                const started = performance.now();
                assert.deepEqual(await stale('attribute n: int = 1; ' + model(depth, calls, loop)), []);
                // Generous: these took seconds to minutes when every call site was followed again.
                assert.ok(performance.now() - started < 1500, `depth ${depth}, ${calls} calls, ${loop ? 'loop' : 'if'}: ${performance.now() - started} ms`);
            }
});
