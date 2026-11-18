import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, valid } from './helpers.js';
import { staleWrite } from '../../src/language/stale-read.js';
import { SwamlValidator } from '../../src/language/swaml-validator.js';
import { isComponentUsage, isOperation } from '../../src/language/generated/ast.js';

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
    const machine = (entry: string) => `attribute n: int = 1; reversed port input: Ticks; operation lamp() { state A { on entry { if (n > 0) { n = 2; } } on receive input.tick(v) exit; } state B { on entry { ${entry} } } } schedule { on start lamp(); }`;
    // A read in one reaction does not reach a write after a wait in another reaction.
    assert.deepEqual(await stale(machine('wait 1ms; n = 3;'), ports), []);
    // Within one reaction the rule still applies.
    assert.deepEqual(await stale(machine('var x: int = n; wait 1ms; n = x;'), ports), ['n = x;']);
    // The condition of an event line's if is read before its block.
    assert.deepEqual(await stale(`attribute n: int = 1; reversed port input: Ticks; operation lamp() { state A { on receive input.tick(v) { if (n > 0) { wait 1ms; n = 0; exit; } } } state B { } } schedule { on start lamp(); }`, ports), ['n = 0;']);
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

// SIF-R09: leaving runs in text order, the line's block, then on exit, then the next state's on entry (2.2 ran exit,
// effect, entry, so a 2.2 exit that suspends no longer comes before the block's write).
const leaving = (a: string, effect: string, b: string) => `attribute n: int = 1; reversed port input: Ticks; operation lamp() { state A { ${a} on receive input.tick(v) { if (n > 0) { ${effect} exit; } } } state B { ${b} } } schedule { on start lamp(); }`;
test('SW2011 analyses one reaction as the line\'s block, exit and target entry under the if', async () => {
    assert.deepEqual(await stale(leaving('', 'wait 1ms; n = 0;', ''), ports), ['n = 0;']);
    assert.deepEqual(await stale(leaving('on exit { wait 1ms; }', 'n = 0;', ''), ports), []);
    assert.deepEqual(await stale(leaving('', 'wait 1ms;', 'on entry { if (n > 0) { n = 0; } }'), ports), []);
    assert.deepEqual(await stale(leaving('on exit { n = 2; }', 'n = 0;', 'on entry { n = 3; }'), ports), []);
});
test('SW2011 follows a leave into on exit and the next state\'s on entry', { todo: 'the analysis stops at the leave' }, async () => {
    assert.deepEqual(await stale(leaving('on exit { wait 1ms; }', '', 'on entry { n = 0; }'), ports), ['n = 0;']);
    assert.deepEqual(await stale(leaving('on exit { n = 0; }', 'wait 1ms;', ''), ports), ['n = 0;']);
    assert.deepEqual(await stale(leaving('', 'wait 1ms;', 'on entry { n = 0; }'), ports), ['n = 0;']);
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

test('SW2011 reports both a helper\'s own stale write and the one its caller makes stale', async () => {
    const r = await valid(wrap('attribute n: int = 1; attribute m: int = 0; attribute k: int = 0; operation h(v: int) { var x: int = n; wait 1ms; n = x; m = v; } operation f() { h(k); } schedule { on start f(); }'));
    assert.deepEqual(r.warnings.filter(w => w.code === 'SW2011').map(w => r.doc.textDocument.getText(w.range)).sort(), ['h(k)', 'n = x;']);
    // With a neutral argument only the helper's own finding remains.
    assert.deepEqual(await stale('attribute n: int = 1; attribute m: int = 0; operation h(v: int) { var x: int = n; wait 1ms; n = x; m = v; } operation f() { h(0); } schedule { on start f(); }'), ['n = x;']);
});

test('SW2011 summaries stay small and fast on valid graphs that once hit the analysis cap', async () => {
    const timed = async (source: string, label: string) => {
        const started = performance.now(), r = await parse(source), elapsed = performance.now() - started;
        assert.ok(elapsed < 1500, `${label}: ${elapsed} ms`);
        assert.deepEqual(r.warnings.filter(w => w.code === 'SW2013'), [], label);
        return r;
    };
    // A chain where each operation calls the next twice with different attribute arguments.
    for (const depth of [14, 20]) {
        let ops = '', attributes = '';
        for (let i = 0; i < depth; i++) {
            attributes += `attribute a${i}: int = 0; attribute b${i}: int = 0; `;
            ops += `operation o${i}(v: int) { o${i + 1}(v + a${i}); o${i + 1}(v + b${i}); } `;
        }
        const r = await timed(wrap(`attribute n: int = 1; ${attributes} ${ops} operation o${depth}(v: int) { n = v; } operation f() { wait 1ms; o0(0); } schedule { on start f(); }`), `chain ${depth}`);
        assert.deepEqual(r.errors, []);
    }
    // An acyclic graph of looping operations that each call three others, and a recursive variant (an error).
    const graph = (count: number, cyclic: boolean) => {
        let ops = '', attributes = '';
        for (let i = 0; i < 200; i++)
            attributes += `attribute q${i}: int = 0; `;
        for (let i = 0; i < count; i++)
            ops += `operation r${i}(v: int) { while (v > 0, 3 times) { ${[0, 1, 2].map(j => cyclic ? `r${(i + j + 1) % count}(v + q${(i * 7 + j) % 200});` : i + j + 1 < count ? `r${i + j + 1}(v + q${(i * 7 + j) % 200});` : '').join(' ')} wait 1ms; q${i % 200} = v; } } `;
        return `package Test { component Demo { ${attributes} ${ops} schedule { on start r0(1); } } }`;
    };
    for (const count of [20, 40, 60]) {
        const r = await timed(graph(count, false), `graph ${count}`);
        assert.deepEqual(r.errors, []);
        assert.equal(r.warnings.filter(w => w.code === 'SW2011').length, count - 1);
        await timed(graph(count, true), `recursive graph ${count}`);
    }
});

test('the stale-read work limit stops the analysis without claiming a stale read', async () => {
    const r = await valid(wrap('attribute n: int = 1; operation f() { var x: int = n; wait 1ms; n = x; } schedule { on start f(); }'));
    const demo = r.model.packages[0].elements.find(isComponentUsage)!, f = demo.members.find(isOperation)!;
    const ctx = (limit?: number) => ({ attributes: new Set(['n']), target: () => undefined, effects: () => ({ reads: true, writes: true, communicates: false, suspends: true }), summaries: new Map(), budget: { work: 0, limit } });
    assert.deepEqual(staleWrite(f, ctx(2)), { limit: true });
    assert.equal((staleWrite(f, ctx()).write as { target?: string } | undefined)?.target, 'n');
});

test('SW2011 keeps every real finding when a helper writes many attributes under many conditions', async () => {
    const attributes = (count: number) => Array.from({ length: count }, (_, i) => `attribute q${i}: int = 0; `).join('');
    // One helper assigning 300 attributes: a summary per condition, not per attribute.
    const reset = Array.from({ length: 300 }, (_, i) => `q${i} = 0;`).join(' ');
    assert.deepEqual(await stale(`attribute n: int = 1; ${attributes(300)} operation reset() { ${reset} } operation f() { var k: int = n; wait 1ms; reset(); n = k; } operation g() { var k: int = n; wait 1ms; n = k; } schedule { on start f(); on start g(); }`), ['n = k;', 'n = k;']);
    // A decoder writing every attribute in each of its branches.
    const decoder = (count: number, branches: number, value: string) => {
        const writes = (b: number) => Array.from({ length: count }, (_, i) => `q${i} = ${value === 'v' ? 'v' : b};`).join(' ');
        let body = writes(branches - 1);
        for (let b = branches - 2; b >= 0; b--)
            body = `if (mode == ${b}) { ${writes(b)} } else { ${body} }`;
        return body;
    };
    for (const [count, branches] of [[100, 9], [257, 1], [4, 80]])
        assert.deepEqual(await stale(`attribute mode: int = 0; attribute n: int = 1; ${attributes(count)} operation decode() { ${decoder(count, branches, 'b')} } operation f() { var k: int = n; wait 1ms; decode(); n = k; } schedule { on start f(); }`), ['n = k;'], `${count} attributes, ${branches} branches`);
    // Beyond the records a summary keeps apart (80 conditions), a write the call site makes stale is still found.
    assert.deepEqual(await stale(`attribute mode: int = 0; attribute n: int = 1; ${attributes(4)} operation decode(v: int) { wait 1ms; ${decoder(4, 80, 'v')} } operation f() { decode(n); } schedule { on start f(); }`), ['decode(n)']);
});

test('the stale-read work limit is reported once as SW2013 at the operation name, not as a stale read', async () => {
    const saved = SwamlValidator.staleReadWorkLimit;
    SwamlValidator.staleReadWorkLimit = 3;
    try {
        const r = await valid(wrap('attribute n: int = 1; operation f() { var k: int = n; wait 1ms; var a: int = 0; var b: int = 0; n = k; } operation g() { var k: int = n; wait 1ms; n = k; } schedule { on start f(); on start g(); }'));
        const limits = r.warnings.filter(w => w.code === 'SW2013');
        assert.equal(limits.length, 1);
        assert.equal(r.doc.textDocument.getText(limits[0].range), 'f');
        assert.match(String(limits[0].message), /reference validation limit of 3 statement visits at operation f; SW2011 is not checked for f or for the operations validated after it in this document\. Other validation is unaffected\./);
        assert.deepEqual(r.warnings.filter(w => w.code === 'SW2011'), []);
    }
    finally {
        SwamlValidator.staleReadWorkLimit = saved;
    }
    // At the normal limit the same document gets both stale reads and no limit.
    assert.deepEqual(await stale('attribute n: int = 1; operation f() { var k: int = n; wait 1ms; var a: int = 0; var b: int = 0; n = k; } operation g() { var k: int = n; wait 1ms; n = k; } schedule { on start f(); on start g(); }'), ['n = k;', 'n = k;']);
});

test('SW2011 judges a helper\'s own findings per write before merging writes into one record', async () => {
    const attributes = 'attribute n: int = 1; attribute m: int = 0; attribute s: int = 0; attribute x: int = 0; attribute y: int = 0;';
    const helper = (writes: string) => `operation h(v: int) { if (s > 0) { wait 1ms; if (x > 0 and n > 0) { if (v > 0 and y > 0 and m > 0) { ${writes} } } } }`;
    // m = v + y writes the argument, read from n before the helper's wait: a stale read at the call.
    assert.deepEqual(await stale(`${attributes} ${helper('n = x + v; m = v + y;')} operation f() { wait 1ms; h(n); } schedule { on start f(); }`), ['h(n)']);
    assert.deepEqual(await stale(`${attributes} ${helper('m = v + y;')} operation f() { wait 1ms; h(n); } schedule { on start f(); }`), ['h(n)']);
});

test('merged SW2011 summaries report every operation that unmerged summaries report', async () => {
    let seed = 20261118;
    const random = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const pick = <T>(xs: T[]) => xs[random(xs.length)];
    const names = ['n', 'm', 's', 'x', 'y'];
    const term = () => pick([...names, 'v', 'v', '1']);
    const expression = () => Array.from({ length: 1 + random(3) }, term).join(' + ');
    const statements = (depth: number): string => Array.from({ length: 1 + random(4) }, () => {
        const kind = random(depth > 2 ? 3 : 5);
        return kind === 0 ? 'wait 1ms;' : kind < 3 ? `${pick(names)} = ${expression()};` : `if (${term()} > 0 and ${term()} > 0) { ${statements(depth + 1)} }`;
    }).join(' ');
    let compared = 0;
    for (let i = 0; i < 250; i++) {
        const source = `package Test { component Demo { ${names.map(n => `attribute ${n}: int = 0;`).join(' ')}\n`
            + `operation h(v: int) { ${statements(0)} }\n`
            + `operation g(v: int) { ${statements(0)} h(${expression()}); }\n`
            + `operation f() { ${random(2) ? `var k: int = ${pick(names)};` : 'var k: int = 0;'} ${random(2) ? 'wait 1ms;' : ''} g(${pick(['k', 'n', '0', 'x + y'])}); ${random(2) ? `h(k);` : ''} }\n`
            + `schedule { on start f(); } } }`;
        const lines = async (unmerged: boolean) => {
            SwamlValidator.staleReadUnmerged = unmerged;
            try {
                const r = await parse(source);
                return r.errors.length ? undefined : new Set(r.warnings.filter(w => w.code === 'SW2011').map(w => w.range.start.line));
            }
            finally {
                SwamlValidator.staleReadUnmerged = false;
            }
        };
        const merged = await lines(false), reference = await lines(true);
        if (!merged || !reference)
            continue;
        compared++;
        for (const line of reference)
            assert.ok(merged.has(line), `model ${i}: the merged analysis misses a warning in line ${line + 1}\n${source}`);
    }
    assert.ok(compared > 200, `${compared} valid models compared`);
});

test('merged SW2011 summaries keep caller-induced findings of helpers with sibling writes', async () => {
    // Two writes in one innermost block under nested conditions after a wait, each condition re-reading one
    // write's attributes, called from a single-statement caller so its only possible warning is this call.
    // With own findings judged after merging (the defect fixed together with this test) 14 of these 100
    // models lose the caller's warning; judged per write, none does.
    let seed = 7;
    const random = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const pick = <T>(xs: T[]) => xs[random(xs.length)];
    const names = ['n', 'm', 's', 'x', 'y'];
    let compared = 0, warned = 0;
    for (let i = 0; i < 100; i++) {
        const [a, t1, x, y, t2] = Array.from({ length: 5 }, () => pick(names));
        const helper = `if (${a} > 0) { wait 1ms; if (${t1} > 0 and ${x} > 0) { if (v > 0 and ${y} > 0 and ${t2} > 0) { ${t1} = ${x} + v; ${t2} = v + ${y}; } } }`;
        const source = `package Test { component Demo { ${names.map(n => `attribute ${n}: int = 0;`).join(' ')}\noperation h(v: int) { ${helper} }\noperation f() { wait 1ms; h(${pick(names)}); }\nschedule { on start f(); } } }`;
        const lines = async (unmerged: boolean) => {
            SwamlValidator.staleReadUnmerged = unmerged;
            try {
                const r = await parse(source);
                return r.errors.length ? undefined : new Set(r.warnings.filter(w => w.code === 'SW2011').map(w => w.range.start.line));
            }
            finally {
                SwamlValidator.staleReadUnmerged = false;
            }
        };
        const merged = await lines(false), reference = await lines(true);
        if (!merged || !reference)
            continue;
        compared++;
        if (reference.size)
            warned++;
        for (const line of reference)
            assert.ok(merged.has(line), `model ${i}: the merged analysis misses a warning in line ${line + 1}\n${source}`);
    }
    assert.ok(compared >= 90 && warned >= 20, `${compared} models compared, ${warned} with warnings`);
});
