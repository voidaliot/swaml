// States in the flow, package 3 (docs/proposals/STATES_IN_FLOW_PROPOSAL.md 3.9, 3.11, 3.12, 4.6, 7.4 gate D): parents and
// direct entry. SIF-R01 (parents entered on the way, outermost first), SIF-R09 (exits innermost first; exit; of the last
// inner state leaves the parent), SIF-R11 (a parent's items first at every look; its timers per parent arrival; a state
// with nothing to look at inside a parent with lines waits), SIF-R12 (a look runs to completion), SIF-S06 (direct jumps),
// the nested Timing bands of 4.6 and gate D (the door window lifter with parents against the migrated flat machine).
// Each runtime case names the mutation of the plan's package 3 it kills (scripts/mutations-sif2.mjs, C1 to C5).
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { eachTest, simulate, type SimulationOptions } from '../../src/simulation/simulator.js';
import { projectOperationTiming } from '../../src/simulation/timing.js';
import type { Model } from '../../src/language/generated/ast.js';
import { parseSample, sampleModel, traceLines, type Sample } from './states-flow-harness.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Observation = { kind: string; [field: string]: any };
const root = new URL('../../../', import.meta.url);

/** A controller with a port p of events m(v: uint), n() and k(), a port o with the provided event out(v: uint), and attributes x, y, z. */
const machine = (control: string): Sample => ({
    pkg: 'Parents', entry: 'run', control,
    ports: {
        p: [['m', 'requires event m(v: uint)'], ['n', 'requires event n()'], ['k', 'requires event k()']].filter(([m]) => control.includes(`p.${m}(`)).map(([, d]) => d),
        ...(control.includes('o.out(') ? { o: ['provides event out(v: uint)'] } : {}),
    },
    attributes: 'attribute x: uint = 0; attribute y: uint = 0; attribute z: uint = 0;',
});
async function drive(control: string, script: string, untilNs = 1e9) {
    const s = machine(control), p = await parseSample(sampleModel(s, script));
    assert.deepEqual(p.errors.map(e => e.message), [], 'model is valid');
    const r = simulate([p.model], s.pkg, { untilNs, maxSteps: 200000 });
    return { r, store: r.stores['c'] as Record<string, unknown>, lines: traceLines(r, s), trace: r.trace as Observation[] };
}
const states = (lines: string[]) => lines.filter(l => / state /.test(l)).map(l => l.replace(/ \(via .*\)$/, ''));

test('SIF-R01 SIF-S06 direct entry three levels deep enters the parents outermost first; SIF-R09 a parent line leaves innermost first', async () => {
    const { store, lines } = await drive(`run() {
      state s {
        on entry { y = y + 1; }
        on receive p.n() to c;
      }
      state A {
        on entry { x = x * 10 + 1; }
        on exit { x = x * 10 + 6; }
        on receive p.m(v) to s;
        state a0 { on receive p.k() exit; }
        state B {
          on entry { x = x * 10 + 2; }
          on exit { x = x * 10 + 5; }
          state b0 { on receive p.k() exit; }
          state c {
            on entry { x = x * 10 + 3; }
            on exit { x = x * 10 + 4; }
            on receive p.k() exit;
          }
        }
      }
    }`, 'publish p.n(); wait 1ms; publish p.m(0);');
    // Entries A, B, c (1, 2, 3), then exits c, B, A (4, 5, 6), then s again.
    assert.equal(store.x, 123456);
    assert.equal(store.y, 2);
    assert.deepEqual(states(lines), ['0ms state s', '0ms state A', '0ms state B', '0ms state c', '1ms state s']);
    // The parents entered on the way carry the jump as their trigger, like the target.
    assert.ok(lines.filter(l => /^0ms state (A|B|c) \(via /.test(l)).length === 3, lines.join('\n'));
});

test('SIF-R11 to P enters a parent at its first inner state', async () => {
    const { lines } = await drive(`run() {
      state s { on receive p.n() to P; }
      state P {
        on entry { x = 1; }
        state a { on entry { y = 1; } on receive p.k() exit; }
        state b { on receive p.k() exit; }
      }
    }`, 'publish p.n();');
    assert.deepEqual(states(lines), ['0ms state s', '0ms state P', '0ms state a']);
});

test('SIF-R09 exit; of the last inner state leaves the parent too, and the flow goes on (kills C5)', async () => {
    const { store, lines } = await drive(`run() {
      state P {
        on entry { x = x * 10 + 1; }
        on exit { x = x * 10 + 9; }
        state a { on receive p.k() exit; }
        state b {
          on entry { x = x * 10 + 2; }
          on exit { x = x * 10 + 3; }
          on receive p.k() exit;
        }
      }
      y = 7;
      state last {
        on entry { x = x * 10 + 4; }
        on receive p.n() exit;
      }
    }`, 'publish p.k(); wait 1ms; publish p.k();');
    assert.equal(store.x, 12394);
    assert.equal(store.y, 7);
    assert.deepEqual(states(lines), ['0ms state P', '0ms state a', '0ms state b', '1ms state last']);
});

test('SIF-R11 a parent timer counts from the parent arrival and keeps running while its inner states change (kills C3)', async () => {
    const { lines } = await drive(`run() {
      state P {
        after 10ms to Q;
        state a { after 3ms exit; }
        state b { after 3ms exit; }
        state c { on receive p.k() exit; }
      }
      state Q { on receive p.n() exit; }
    }`, '');
    assert.deepEqual(states(lines), ['0ms state P', '0ms state a', '3ms state b', '6ms state c', '10ms state Q']);
});

test('SIF-R11 a parent timer is present once per parent arrival, not once per inner arrival', async () => {
    const { store } = await drive(`run() {
      state P {
        after 2ms { x = x + 1; }
        state a { after 1ms exit; }
        state b { after 1ms to a; }
      }
    }`, '', 20e6);
    // The parent is entered once; its 2 ms timer is present at one look, whatever its inner states do.
    assert.equal(store.x, 1);
});

test('SIF-R05 SIF-R11 input a state and its parents do not name is dropped across levels; a parent line is looked at in an inner state', async () => {
    const { store, lines } = await drive(`run() {
      state P {
        on receive p.n() { y = y + 1; }
        state a { on receive p.k() to Q; }
      }
      state Q { on receive p.m(v) { z = v; } }
    }`, 'publish p.m(5); publish p.n(); wait 1ms; publish p.k(); wait 1ms; publish p.m(7);');
    assert.equal(store.y, 1);
    assert.equal(store.z, 7);
    assert.equal(lines.filter(l => /discard .*\(inactiveOwner\)/.test(l)).length, 1, lines.join('\n'));
});

test('SIF-R11 a state with nothing to look at inside a parent with lines waits (kills C4)', async () => {
    const { store, lines } = await drive(`run() {
      state P {
        on receive p.n() exit;
        state a { on entry { x = 1; } }
      }
      state Q { on entry { y = 1; } on receive p.k() exit; }
    }`, 'wait 5ms; publish p.n();');
    assert.equal(store.x, 1);
    assert.equal(store.y, 1);
    assert.deepEqual(states(lines), ['0ms state P', '0ms state a', '5ms state Q']);
});

test('SIF-R11 a parent line runs before an inner line on the same member, and when it leaves the inner line does not run (kills C1)', async () => {
    const { store, lines } = await drive(`run() {
      state P {
        on receive p.m(v) {
          x = x * 10 + 1;
          if (v > 5) to Q;
        }
        state a { on receive p.m(v) { x = x * 10 + 2; } }
      }
      state Q { on receive p.k() exit; }
    }`, 'publish p.m(1); wait 1ms; publish p.m(9);');
    assert.equal(store.x, 121);
    assert.deepEqual(states(lines).at(-1), '1ms state Q');
});

test('SIF-R11 nothing starves: a parent query during a pulse is answered at once and the pulse still ends at 250 ms', async () => {
    const { store, lines } = await drive(`run() {
      state powered {
        on receive p.n() {
          z = z + 1;
          publish o.out(z);
        }
        state unlocked { on receive p.m(v) exit; }
        state locking {
          on entry { x = x + 1; }
          after 250ms exit;
        }
        state locked { on receive p.k() exit; }
      }
    }`, 'publish p.m(1); wait 100ms; publish p.n();');
    assert.ok(lines.includes('100ms publish o.out(1)'), lines.join('\n'));
    assert.ok(states(lines).includes('250ms state locked'), lines.join('\n'));
    assert.equal(store.x, 1);
});

test('SIF-R12 a look runs to completion: a suspending parent line delays an inner timer to its end', async () => {
    const { store, lines } = await drive(`run() {
      state P {
        on receive p.n() {
          wait 20ms;
          y = 1;
        }
        state pulse { after 250ms to done; }
      }
      state done { on receive p.k() exit; }
    }`, 'wait 240ms; publish p.n();');
    assert.equal(store.y, 1);
    // The 250 ms timer runs out while the parent line waits (240 to 260 ms); it is looked at when that look ends.
    assert.ok(states(lines).includes('260ms state done'), lines.join('\n'));
});

test('SIF-R11 a substate shields itself with a variable set in on entry and cleared in on exit', async () => {
    const { lines } = await drive(`run() {
      var shielded: bool = false;
      state P {
        on receive p.n() { if (not shielded) to Q; }
        state a { on receive p.k() exit; }
        state b {
          on entry { shielded = true; }
          on exit { shielded = false; }
          on receive p.k() to a;
        }
      }
      state Q { on receive p.m(v) exit; }
    }`, 'publish p.k(); wait 1ms; publish p.n(); wait 1ms; publish p.k(); wait 1ms; publish p.n();');
    assert.deepEqual(states(lines), ['0ms state P', '0ms state a', '0ms state b', '2ms state a', '3ms state Q']);
});

test('SIF-R11 nested parents with timers due at one instant: the outer parent\'s line runs first and its leave wins', async () => {
    const { store, lines } = await drive(`run() {
      state A {
        after 5ms { x = x * 10 + 1; to Q; }
        state B {
          after 5ms { x = x * 10 + 2; }
          state c { after 5ms { x = x * 10 + 3; } }
        }
      }
      state Q { on receive p.k() exit; }
    }`, '');
    assert.equal(store.x, 1);
    assert.deepEqual(states(lines).at(-1), '5ms state Q');
});

test('4.6 Timing: state bands nest for parents and a parent band spans its inner states', async () => {
    const { r } = await drive(`run() {
      state s { after 1ms to c; }
      state A {
        after 10ms to s;
        state a0 { after 1ms exit; }
        state B {
          state b0 { after 1ms exit; }
          state c { after 2ms to a0; }
        }
      }
    }`, '', 11.5e6);
    const bands = projectOperationTiming(r).states!.map(b => [b.state, b.depth, b.parent ?? '', b.startNs / 1e6, b.endNs === undefined ? -1 : b.endNs / 1e6]);
    // Direct entry opens A, B and c at 1 ms; c's to a0 closes c and B (a0 is A's) and keeps A; A's own timer at 10 ms after
    // its arrival closes everything at 11 ms.
    assert.deepEqual(bands, [
        ['s', 0, '', 0, 1],
        ['A', 0, '', 1, 11], ['B', 1, 'A', 1, 3], ['c', 2, 'B', 1, 3], ['a0', 1, 'A', 3, 4], ['B', 1, 'A', 4, 7], ['b0', 2, 'B', 4, 5], ['c', 2, 'B', 5, 7], ['a0', 1, 'A', 7, 8],
        ['B', 1, 'A', 8, 11], ['b0', 2, 'B', 8, 9], ['c', 2, 'B', 9, 11],
        ['s', 0, '', 11, -1],
    ]);
});

// ---------------------------------------------------------------- gate D (7.4)

/** The door showcase with WindowLifter.control written with the parents moving and driven (the prototype's design rewrite). */
const LIFTER_WITH_PARENTS = readFileSync(new URL('test/fixtures/states-in-flow/window-lifter-parents.swaml-fragment', root), 'utf8');
function withParents(showcase: string): string {
    const lifter = showcase.indexOf('  component def WindowLifter {'), start = showcase.indexOf('    operation control() {', lifter);
    let depth = 0, end = start;
    for (; end < showcase.length; end++) {
        if (showcase[end] === '{')
            depth++;
        else if (showcase[end] === '}' && --depth === 0)
            break;
    }
    return showcase.slice(0, start) + LIFTER_WITH_PARENTS.trimEnd() + showcase.slice(end + 1);
}
const PARENTS = new Set(['moving', 'driven']);
/** What gate D compares of one case: verdict, stores and the trace without the parents' state observations and without statement identities. */
function compared(result: ReturnType<typeof eachTest> extends Iterable<infer R> ? R : never) {
    const { run, ...verdict } = result as { run?: { trace: Observation[]; stores: unknown; status: string } };
    const trace = (run?.trace ?? []).filter(e => !(e.kind === 'state' && PARENTS.has(e.state))).map(({ ordinal: _o, source: _s, trigger: _t, profile: _p, languageVersion: _l, emitter: _e, caller: _c, ...e }) => e);
    return { verdict, status: run?.status, stores: run?.stores, trace };
}

test('gate D: the window lifter with parents moving and driven behaves as the migrated flat machine on every door-showcase case', async () => {
    const flat = readFileSync(new URL('examples/showcase/autosar-classic-door-controller.swaml', root), 'utf8').replaceAll('\r\n', '\n');
    const parents = withParents(flat);
    assert.notEqual(parents, flat);
    const load = async (text: string, uri: string) => {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        const document = await parseHelper<Model>(Swaml)(text, { documentUri: uri, validation: true });
        assert.deepEqual((document.diagnostics ?? []).filter(d => d.severity === 1).map(d => `${d.range.start.line + 1}: ${d.message}`), []);
        return [document.parseResult.value];
    };
    const uri = 'file:///examples/showcase/autosar-classic-door-controller.swaml';
    // The options the example cases run with (examples/simulation/cases.json).
    const options = { untilNs: 10_000_000_000, maxSteps: 200000 } as SimulationOptions;
    const before = [...eachTest(await load(flat, uri), options)], after = [...eachTest(await load(parents, uri), options)];
    assert.ok(before.length >= 30, `${before.length} door-showcase cases`);
    assert.equal(after.length, before.length);
    let parentObservations = 0;
    for (const [i, b] of before.entries()) {
        const x = compared(b), y = compared(after[i]);
        parentObservations += ((after[i] as { run?: { trace: Observation[] } }).run?.trace ?? []).filter(e => e.kind === 'state' && PARENTS.has(e.state)).length;
        assert.deepEqual(y.verdict, x.verdict, `verdict of ${String((b as { case?: string }).case)}`);
        assert.deepEqual(y.stores, x.stores, `stores of ${String((b as { case?: string }).case)}`);
        assert.deepEqual(y.trace, x.trace, `trace of ${String((b as { case?: string }).case)} apart from the parents' state observations`);
    }
    // The parents are entered on the way (direct entry), so the rewrite does add their observations.
    assert.ok(parentObservations > 0);
});
