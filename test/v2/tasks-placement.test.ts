// WP8 of swa.ml 2.3: operation placement, Swaml::Os tasks, task rules T1 to T7, in-task order and ordering keys
// (ADR 0025, B17, B18): WP8-L01, WP8-S01..S10, WP8-D01..D11, WP8-M01, WP8-M04, WP8-M06, WP8-R01, WP8-R02.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { formatDocument } from '../../src/language/formatter.js';
import { projectModel } from '../../src/language/projection.js';
import { semanticIndex } from '../../src/language/path-services.js';
import { viewCandidates } from '../../src/language/presentation.js';
import { deploymentPlan, osRole } from '../../src/language/placement.js';
import { runTests, simulate } from '../../src/simulation/simulator.js';
import { projectOperationTiming } from '../../src/simulation/timing.js';
import type { Model } from '../../src/language/generated/ast.js';
import * as a from '../../src/language/generated/ast.js';
import { parse, valid, workspace } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
const root = new URL('../../../', import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Observation = { kind: string; [field: string]: any };
const errors = async (source: string) => (await parse(source)).errors.map(e => String(e.message));
type TaskSpec = { kind?: 'basic' | 'extended' | 'isr'; priority?: number; periodNs?: string; responseNs?: string; preemptive?: boolean };
/** A Swaml::Os Task usage with the given redefined attributes. */
const task = (name: string, t: TaskSpec = {}) => `component ${name}: Task { ${[
    t.kind && `redefines const attribute kind: TaskKind = TaskKind.${t.kind};`,
    t.priority !== undefined && `redefines const attribute priority: uint = ${t.priority};`,
    t.periodNs && `redefines const attribute periodNs: uint = ${t.periodNs};`,
    t.responseNs && `redefines const attribute responseNs: uint = ${t.responseNs};`,
    t.preemptive !== undefined && `redefines const attribute preemptive: bool = ${t.preemptive};`].filter(Boolean).join(' ')} }`;
/**
 * Package Test with component def C (attribute log; operations a, b, c that append 1, 2, 3; w that waits; take that
 * stores an event; the given schedule), software root Demo with the given members, platform hw: Board with the given
 * members, and deployment D of Demo on hw with the given deploy statements.
 */
const model = (schedule: string, demo: string, board: string, deploys: string, more = '') => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  port def P { provides event e(n: int); }
  port def R { requires operation ask() returns int; }
  component def C {
    reversed port inp: P;
    attribute log: int = 0;
    operation a() { log = log * 10 + 1; }
    operation b() { log = log * 10 + 2; }
    operation c() { log = log * 10 + 3; }
    operation w() { wait 1ms; log = log * 10 + 4; }
    operation take(v: int) { log = log * 10 + v; }
    operation helper() { }
    schedule { ${schedule} }
  }
  component def Src { port out: P; attribute k: int = 0; operation tick() { k = k + 1; publish out.e(k); } schedule { on every 10ms tick(); } }
  component def Board specializes Node { ${board} }
  component Demo { component s: Src; ${demo} }
  component hw: Board;
  deployment D of Demo on hw { ${deploys} }
  ${more}
}`;
const ONE = (schedule = 'on every 10ms a(); on every 10ms b(); on every 10ms c(); on receive inp.e(v) take(v);') => (board: string, deploys: string, more = '') => model(schedule, 'component x: C; connect (s.out, x.inp);', board, deploys, more);
const fast = task('fast', { priority: 5, periodNs: '10ms' }), slow = task('slow', { priority: 1, periodNs: '10ms' }), events = task('events', { priority: 3 });
const runOf = async (source: string, untilNs = 10000000) => { const r = await valid(source); return simulate([r.model], 'Test::Demo', { untilNs }); };
const kinds = (trace: Observation[], kind: string) => trace.filter(o => o.kind === kind);

test('WP8-L01 Swaml::Os declares TaskKind, Core and Task with the library defaults, and only the built-in Task and Core have an Os role', async () => {
    const r = await valid(ONE()(`${task('t')} component k: Core { }`, 'deploy x on t; deploy s on t;'));
    const os = r.shared.workspace.LangiumDocuments.all.map(d => d.parseResult.value as Model).toArray().flatMap(m => m.packages).find(p => p.name === 'Swaml::Os')!;
    assert.deepEqual(os.imports.map(i => i.namespace), ['Swaml::Platform']);
    assert.deepEqual(os.elements.map(e => e.name), ['TaskKind', 'Core', 'Task']);
    const t = os.elements.find(e => e.name === 'Task') as a.ComponentDef;
    assert.deepEqual(t.members.filter(a.isAttribute).map(x => [x.name, x.constant, x.value.$cstNode?.text]), [['kind', true, 'TaskKind.basic'], ['priority', true, '0'], ['preemptive', true, 'true'], ['periodNs', true, '0'], ['responseNs', true, '0']]);
    assert.equal(t.specializes?.ref?.name, 'Process');
    const plan = deploymentPlan(r.model.packages[0].elements.find(a.isDeployment)!)!;
    assert.deepEqual(plan.tasks.map(x => [x.path, x.kind, x.priority, x.preemptive, x.periodNs, x.responseNs, x.core]), [['hw.t', 'basic', 0n, true, 0n, 0n, 'hw']]);
    // A workspace's own Swaml::Os hides the library package; its Task is an ordinary Process, so no task rule applies.
    const own = await workspace([`package Swaml::Os { import Swaml::Platform; component def Core specializes Node { } component def Task specializes Process { const attribute priority: uint = 0; } }`,
        ONE()(`component t: Task; component u: Task;`, 'deploy x on t; deploy s on u;').replace('import Swaml::Os;', 'import Swaml::Os;')]);
    const docs = own.docs.map(d => [(d.diagnostics ?? []).filter(x => x.severity === 1).map(x => x.message)]);
    assert.deepEqual(docs, [[[]], [[]]]);
    const userTask = (own.docs[0].parseResult.value as Model).packages[0].elements.find(e => e.name === 'Task') as a.ComponentDef;
    assert.equal(osRole(userTask), undefined);
});

test('WP8-S01 a deploy path may end at an operation that an effective entry releases; WP8-D01 otherwise on a Swaml::Os platform', async () => {
    assert.deepEqual(await errors(ONE()(`${fast} ${events}`, 'deploy x on fast; deploy x.take on events; deploy s on fast;')), []);
    assert.deepEqual(await errors(ONE()(`${fast} ${events}`, 'deploy x on fast; deploy x.take on events; deploy s on fast; deploy x.helper on events;')), ['Demo.x.helper names operation helper, which no schedule entry of Demo.x releases.']);
    // A missing member or a non-operation keeps the 2.2 message; so does an unreleased operation on a platform without Swaml::Os.
    assert.deepEqual(await errors(ONE()(`${fast} ${events}`, 'deploy x on fast; deploy x.take on events; deploy s on fast; deploy x.log on events; deploy x.nothing on events;')), ['Unknown software occurrence Demo.x.log.', 'Unknown software occurrence Demo.x.nothing.']);
    assert.deepEqual(await errors(ONE()('component n: Process;', 'deploy x on n; deploy x.helper on n;')), ['Unknown software occurrence Demo.x.helper.']);
    // Without Swaml::Os an operation placement is valid and has no task meaning.
    assert.deepEqual(await errors(ONE()('component n: Process; component m: Process;', 'deploy x on n; deploy x.take on m;')), []);
    // WP8-D09: exact operation paths are unique.
    assert.deepEqual(await errors(ONE()(`${fast} ${events}`, 'deploy x on fast; deploy s on fast; deploy x.take on events; deploy x.take on events;')), ['Duplicate exact deployment path.']);
});

test('WP8-S01 operation placement on inherited, replaced and redefined-part entries', async () => {
    const source = `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  component def Base { attribute n: int = 0; operation tick() { n = n + 1; } operation tock() { n = n + 2; } schedule { on every 10ms tick(); on every 20ms tock(); } }
  component def Derived specializes Base { schedule { on every 10ms tick() deadline 2ms; } }
  component def Holder { component part: Base; }
  component Demo { component d: Derived; component h: Holder { redefines component part: Derived { schedule { on every 40ms tock(); } } } }
  component def Board specializes Node { ${task('t10', { priority: 2, periodNs: '10ms' })} ${task('t20', { priority: 1, periodNs: '20ms' })} }
  component hw: Board;
  deployment D of Demo on hw { deploy on t10; deploy d.tock on t20; deploy h.part.tock on t20; }
}`;
    const r = await valid(source);
    const plan = deploymentPlan(r.model.packages[0].elements.find(a.isDeployment)!)!;
    assert.deepEqual(plan.entries.map(e => [e.occurrence.path, `${e.entry.kind}:${e.entry.operation}:${e.entry.deadline?.value ?? ''}`, e.task?.path, e.position]), [
        ['Demo.d', 'every:tick:2', 'hw.t10', 0], ['Demo.d', 'every:tock:', 'hw.t20', 0],
        ['Demo.h.part', 'every:tick:2', 'hw.t10', 1], ['Demo.h.part', 'every:tock:', 'hw.t20', 1], ['Demo.h.part', 'every:tock:', 'hw.t20', 2]]);
    // The redefined part's new every 40ms tock entry is released by the same operation and placed with it; 40ms is a multiple of 20ms.
    const moved = source.replace('deploy h.part.tock on t20;', 'deploy h.part.tock on t10;');
    assert.deepEqual(await errors(moved), []);
});

test('WP8-S02 specificity: an operation placement overrides occurrence placements, an indexed path its family, a deeper path an ancestor', async () => {
    const source = `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  component def Leaf { attribute n: int = 0; operation p() { n = n + 1; } operation q() { n = n + 2; } schedule { on every 10ms p(); on every 10ms q(); } }
  component def Mid { component leaves: Leaf[3]; }
  component Demo { component mids: Mid[2]; component lone: Leaf; }
  component def Board specializes Node { ${task('t1', { priority: 1 })} ${task('t2', { priority: 2 })} ${task('t3', { priority: 3 })} ${task('t4', { priority: 4 })} }
  component hw: Board;
  deployment D of Demo on hw {
    deploy on t1;
    deploy mids on t2;
    deploy mids[1].leaves.q on t3;
    deploy mids[1].leaves[2].q on t4;
    deploy mids[1].leaves[2] on t1;
  }
}`;
    const r = await valid(source);
    const plan = deploymentPlan(r.model.packages[0].elements.find(a.isDeployment)!)!;
    const on = (path: string, op: string) => plan.entries.find(e => e.occurrence.path === path && e.entry.operation === op)!.task!.path.slice(3);
    assert.deepEqual(['Demo.lone', 'Demo.mids[0].leaves[1]', 'Demo.mids[1].leaves[0]', 'Demo.mids[1].leaves[2]'].map(p => [on(p, 'p'), on(p, 'q')]), [['t1', 't1'], ['t2', 't2'], ['t2', 't3'], ['t1', 't4']]);
    // WP8-M01: the in-task order of t2 is mids depth-first with indexes ascending, each in schedule order, without claimed entries.
    assert.deepEqual(plan.entries.filter(e => e.task?.path === 'hw.t2').sort((x, y) => x.position! - y.position!).map(e => `${e.occurrence.path.slice(5)}.${e.entry.operation}`),
        ['mids[0].leaves[0].p', 'mids[0].leaves[0].q', 'mids[0].leaves[1].p', 'mids[0].leaves[1].q', 'mids[0].leaves[2].p', 'mids[0].leaves[2].q', 'mids[1].leaves[0].p', 'mids[1].leaves[1].p']);
    assert.deepEqual(plan.entries.filter(e => e.task?.path === 'hw.t3').map(e => [e.occurrence.path.slice(5), e.position]), [['mids[1].leaves[0]', 0], ['mids[1].leaves[1]', 1]]);
    // t1: the root placement (statement 0) contributes lone; leaves[2] (statement 4) follows.
    assert.deepEqual(plan.entries.filter(e => e.task?.path === 'hw.t1').sort((x, y) => x.position! - y.position!).map(e => `${e.occurrence.path.slice(5)}.${e.entry.operation}`), ['lone.p', 'lone.q', 'mids[1].leaves[2].p']);
});

test('WP8-S03 and WP8-S10 Core grouping: nearest Core, the implicit Core of the platform root, Nodes below Tasks, and T7', async () => {
    const board = `component def Cpu specializes Core { component a: Task { redefines const attribute priority: uint = 1; component sub: Node; } ${task('b', { priority: 2 })} component slot: Node; }`;
    const source = (deploys: string) => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  component def C { attribute n: int = 0; operation p() { n = n + 1; } operation q() { n = n + 2; } schedule { on every 10ms p(); on every 10ms q(); } }
  ${board}
  component def Sub specializes Process { component region: Node; }
  component def Board specializes Node { component cpu0: Cpu; component cpu1: Cpu; ${task('loose', { priority: 1 })} component bare: Node; }
  component Demo { component x: C; component y: C; }
  component hw: Board;
  deployment D of Demo on hw { ${deploys} }
}`;
    // A Node below a Task puts its entries on that Task.
    const below = await valid(source('deploy x on cpu0.a.sub; deploy y on loose;'));
    assert.deepEqual(deploymentPlan(below.model.packages[0].elements.find(a.isDeployment)!)!.entries.filter(e => e.occurrence.path === 'Demo.x').map(e => [e.task?.path, e.core]), [['hw.cpu0.a', 'hw.cpu0'], ['hw.cpu0.a', 'hw.cpu0']]);
    assert.deepEqual(await errors(source('deploy x on cpu0.a; deploy x.q on cpu0.b; deploy y on loose;')), []);
    assert.deepEqual(await errors(source('deploy x on cpu0.a; deploy x.q on cpu1.b; deploy y on loose;')), ['Demo.x runs on hw.cpu0 and hw.cpu1; all its operations must run on one core.']);
    assert.deepEqual(await errors(source('deploy x on cpu0.a; deploy x.q on loose; deploy y on loose;')), ['Demo.x runs on hw.cpu0 and the implicit core of hw; all its operations must run on one core.']);
    // A placement on a Node outside any Core does not count for T7; T6 still requires a Task.
    assert.deepEqual(await errors(source('deploy x on cpu0.a; deploy x.q on bare; deploy y on loose;')), ['on every 10ms q of Demo.x is not placed on a task of hw; place q or Demo.x on a task, for example: deploy x.q on cpu0.a;']);
    // A placement on a Core (not a Task) reaches it.
    assert.deepEqual(await errors(source('deploy x on cpu0.a; deploy x.q on cpu1; deploy y on loose;')), ['on every 10ms q of Demo.x is not placed on a task of hw; place q or Demo.x on a task, for example: deploy x.q on cpu0.a;', 'Demo.x runs on hw.cpu0 and hw.cpu1; all its operations must run on one core.']);
});

test('WP8-S04 activation: T1 to T6 with a Task anywhere in the platform, T7 with only a Core, nothing without either', async () => {
    const source = (board: string, deploys: string) => ONE('on every 10ms a(); on every 10ms b();')(board, deploys).replace('component s: Src; ', '').replace('connect (s.out, x.inp);', '').replace('reversed port inp: P;', '');
    // Re-pointing every placement to a Core cannot switch off T6.
    assert.deepEqual(await errors(source(`component cpu: Core { ${task('t')} }`, 'deploy x on cpu;')), [
        'on every 10ms a of Demo.x is not placed on a task of hw; place a or Demo.x on a task, for example: deploy x.a on cpu.t;',
        'on every 10ms b of Demo.x is not placed on a task of hw; place b or Demo.x on a task, for example: deploy x.b on cpu.t;']);
    // With Cores and no Task only T7 applies.
    assert.deepEqual(await errors(source('component c0: Core { } component c1: Core { }', 'deploy x on c0; deploy x.b on c1;')), ['Demo.x runs on hw.c0 and hw.c1; all its operations must run on one core.']);
    assert.deepEqual(await errors(source('component c0: Core { } component n: Process;', 'deploy x on c0; deploy x.b on n;')), []);
    // Neither: 2.2 meaning.
    assert.deepEqual(await errors(source('component n0: Process; component n1: Process;', 'deploy x on n0; deploy x.b on n1;')), []);
});

test('WP8-D02 T1: priorities are unique per Core, not across Cores', async () => {
    const source = (board: string) => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  component def C { attribute n: int = 0; operation p() { n = n + 1; } schedule { on every 10ms p(); } }
  component def Cpu specializes Core { ${task('a', { priority: 7 })} ${task('b', { priority: 7 })} }
  component def Board specializes Node { ${board} }
  component Demo { component x: C; }
  component hw: Board;
  deployment D of Demo on hw { deploy x on cpu0.a; }
}`;
    assert.deepEqual(await errors(source('component cpu0: Cpu;')), ['Tasks hw.cpu0.a and hw.cpu0.b of hw.cpu0 share priority 7.']);
    assert.deepEqual(await errors(source(`component cpu0: Core { ${task('a', { priority: 7 })} } component cpu1: Core { ${task('a', { priority: 7 })} }`).replace('component def Cpu', 'component def Unused')), []);
    assert.deepEqual(await errors(source(`component cpu0: Core { ${task('a', { priority: 1 })} } ${task('x', { priority: 2 })} ${task('y', { priority: 2 })}`).replace('component def Cpu', 'component def Unused')), ['Tasks hw.x and hw.y of the implicit core of hw share priority 2.']);
});

test('WP8-D03 T2: periodic tasks take every entries of a multiple period and after successors on the same task', async () => {
    const board = `${task('t10', { priority: 2, periodNs: '10ms' })} ${task('t5', { priority: 4, periodNs: '5ms' })} ${events}`;
    const source = (schedule: string, deploys: string) => ONE(schedule)(board, `deploy s on t10; ${deploys}`);
    assert.deepEqual(await errors(source('on every 20ms a(); after a b(); on every 10ms c(); on receive inp.e(v) take(v);', 'deploy x on t10; deploy x.take on events;')), []);
    assert.deepEqual(await errors(source('on every 15ms a(); on receive inp.e(v) take(v);', 'deploy x on t10; deploy x.take on events;')), ['on every 15ms a of Demo.x cannot run on periodic task hw.t10: its period 15ms is not a multiple of 10ms.']);
    assert.deepEqual(await errors(source('on every 10ms a(); on receive inp.e(v) take(v); on start c();', 'deploy x on t10;')), ['on receive inp.e take of Demo.x cannot run on periodic task hw.t10: event entries need a task with periodNs = 0.', 'on start c of Demo.x cannot run on periodic task hw.t10: event entries need a task with periodNs = 0.']);
    assert.deepEqual(await errors(source('on every 10ms a(); after a b(); on receive inp.e(v) take(v);', 'deploy x on t10; deploy x.a on t5; deploy x.take on events;')), ['after a b of Demo.x cannot run on periodic task hw.t10: its predecessor runs on hw.t5.']);
    // An every entry on an event task, and an after successor of a receive entry on it, are allowed.
    assert.deepEqual(await errors(source('on every 7ms a(); on receive inp.e(v) take(v); after take b();', 'deploy x on events;')), []);
    // A computed period is evaluated per occurrence.
    assert.deepEqual(await errors(source('on every (period) a(); on receive inp.e(v) take(v);', 'deploy x on t10; deploy x.take on events;').replace('attribute log: int = 0;', 'attribute log: int = 0; const attribute period: uint = 30ms;')), []);
});

test('WP8-D04 T3: an isr task has periodNs = 0, is preemptive and takes receive entries and their after successors', async () => {
    const source = (isr: TaskSpec, schedule: string) => ONE(schedule)(`${task('irq', { kind: 'isr', priority: 9, ...isr })} ${fast}`, 'deploy s on fast; deploy x on irq;');
    assert.deepEqual(await errors(source({}, 'on receive inp.e(v) take(v); after take a(); after a b();')), []);
    assert.deepEqual(await errors(source({ periodNs: '1ms', preemptive: false }, 'on receive inp.e(v) take(v);')), ['ISR task hw.irq must have periodNs = 0.', 'ISR task hw.irq must be preemptive.']);
    assert.deepEqual(await errors(source({}, 'on receive inp.e(v) take(v); on every 10ms a(); on start b();')), ['ISR task hw.irq accepts only receive entries and their after successors; on every 10ms a of Demo.x is not one.', 'ISR task hw.irq accepts only receive entries and their after successors; on start b of Demo.x is not one.']);
});

test('WP8-D05 T4: an activation that may suspend needs an extended task; a machine whose reactions run to completion may use a basic one', async () => {
    const board = `${task('basicT', { priority: 1 })} ${task('ext', { kind: 'extended', priority: 2 })} ${task('irq', { kind: 'isr', priority: 3 })} ${fast}`;
    const source = (members: string, schedule: string, deploys: string) => model(schedule, 'component x: C; connect (s.out, x.inp);', board, `deploy s on fast; ${deploys}`).replace('operation helper() { }', `operation helper() { } ${members}`);
    assert.deepEqual(await errors(source('', 'on start w(); on receive inp.e(v) take(v);', 'deploy x on basicT;')), ['on start w of Demo.x may suspend in wait 1ms and needs an extended task; hw.basicT is basic.']);
    assert.deepEqual(await errors(source('', 'on start w(); on receive inp.e(v) take(v);', 'deploy x on ext;')), []);
    // A request (a dotted call), a receive statement and a suspending callee.
    assert.deepEqual(await errors(source('port req: R; operation r() { log = req.ask(); } operation g() { on receive inp.e(v) { log = v; } } operation viaHelper() { w(); }', 'on start r(); on start g(); on start viaHelper();', 'deploy x on basicT;').replace('component Demo { component s: Src;', 'component def Srv { reversed port api: R; operation ask() returns int { return 1; } schedule { on call api.ask() ask(); } } component Demo { component s: Src; component srv: Srv; connect (x.req, srv.api);').replace('deploy s on fast;', 'deploy s on fast; deploy srv on ext;')), [
        'on start r of Demo.x may suspend in log = req.ask() and needs an extended task; hw.basicT is basic.',
        'on start g of Demo.x may suspend in on receive inp.e(v) and needs an extended task; hw.basicT is basic.',
        'on start viaHelper of Demo.x may suspend in w() and needs an extended task; hw.basicT is basic.']);
    // An isr task is not extended either.
    assert.deepEqual(await errors(source('', 'on receive inp.e(v) w();', 'deploy x on irq;')), ['on receive inp.e w of Demo.x may suspend in wait 1ms and needs an extended task; hw.irq is isr.']);
    // A machine: the idle wait between reactions does not count; a suspending entry action, exit action or effect does.
    const machine = (entry: string, effect: string) => `operation m() { initial idle; state idle { on receive inp.e(v) to busy { ${effect} } } state busy { on entry { ${entry} } after 5ms to idle { } } }`;
    assert.deepEqual(await errors(source(machine('log = 1;', 'log = v;'), 'on start m();', 'deploy x on basicT;')), []);
    assert.deepEqual(await errors(source(machine('wait 1ms;', 'log = v;'), 'on start m();', 'deploy x on basicT;')), ['on start m of Demo.x may suspend in wait 1ms and needs an extended task; hw.basicT is basic.']);
    assert.deepEqual(await errors(source(machine('log = 1;', 'w();'), 'on start m();', 'deploy x on basicT;')), ['on start m of Demo.x may suspend in w() and needs an extended task; hw.basicT is basic.']);
});

test('WP8-D06 T5: an explicit deadline is not shorter than the task response bound; implicit deadlines are not checked', async () => {
    const board = `${task('ev', { priority: 1, responseNs: '2ms' })} ${fast}`;
    const source = (schedule: string) => ONE(schedule)(board, 'deploy s on fast; deploy x on ev;');
    assert.deepEqual(await errors(source('on receive inp.e(v) take(v) deadline 2ms; on every 1ms a();')), []);
    assert.deepEqual(await errors(source('on receive inp.e(v) take(v) deadline 1500us; on every 1ms a() deadline (half);').replace('attribute log: int = 0;', 'attribute log: int = 0; const attribute half: uint = 500us;')), [
        'Deadline 1500us of on receive inp.e take of Demo.x is shorter than the response bound 2ms of hw.ev.',
        'Deadline 500us of on every 1ms a of Demo.x is shorter than the response bound 2ms of hw.ev.']);
});

test('WP8-D07 T6: every entry of the deployed tree is on a task; the example names a task of the occurrence or the first task', async () => {
    const board = `${task('first', { priority: 1 })} ${task('second', { priority: 2, periodNs: '10ms' })}`;
    assert.deepEqual(await errors(ONE('on every 10ms a(); on every 10ms b(); on receive inp.e(v) take(v);')(board, 'deploy s on second; deploy x.a on second; deploy x.take on first;')), [
        'on every 10ms b of Demo.x is not placed on a task of hw; place b or Demo.x on a task, for example: deploy x.b on second;']);
    assert.deepEqual(await errors(ONE('on receive inp.e(v) take(v);')(board, 'deploy s on second;')), [
        'on receive inp.e take of Demo.x is not placed on a task of hw; place take or Demo.x on a task, for example: deploy x.take on first;']);
    // Quoted names keep the 2.2 spelling in the message and the example.
    assert.deepEqual(await errors(ONE('on receive inp.e(v) take(v);')(board, `deploy s on second;`).replaceAll(' x: C;', " 'door x': C;").replace('x.inp', "'door x'.inp")), [
        "on receive inp.e take of Demo.'door x' is not placed on a task of hw; place take or Demo.'door x' on a task, for example: deploy 'door x'.take on first;"]);
});

test('WP8-D11 task attributes must be constants of their type', async () => {
    const source = ONE('on every 10ms a();')(`component t: Task { redefines const attribute priority: uint = Swaml::Math::length("ab"); }`, 'deploy s on t; deploy x on t;').replace('component s: Src;', '').replace('connect (s.out, x.inp);', '').replace('reversed port inp: P;', '').replace('deploy s on t; ', '');
    assert.deepEqual(await errors(source.replace('import Swaml::Os;', 'import Swaml::Os;\n  import Swaml::Math;')), ['priority of task hw.t must be a constant uint value.']);
});

test('WP8-M01 in-task position: deploy order, then the tree depth-first, then effective schedule order with replacements in place', async () => {
    const source = `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  component def B { attribute n: int = 0; operation p() { n = n + 1; } operation q() { n = n + 2; } operation r() { n = n + 3; } schedule { on every 10ms p(); on every 10ms q(); } }
  component def D specializes B { schedule { on every 10ms r(); on every 10ms p() deadline 5ms; } }
  component def Pair { component first: D; component second: B; }
  component Demo { component pair: Pair; component extra: B; }
  component def Board specializes Node { ${task('t', { priority: 1 })} }
  component hw: Board;
  deployment D1 of Demo on hw { deploy extra.q on t; deploy pair on t; deploy on t; deploy pair.first.q on t; }
}`;
    const plan = deploymentPlan((await valid(source)).model.packages[0].elements.find(a.isDeployment)!)!;
    assert.deepEqual(plan.entries.filter(e => e.task).sort((x, y) => x.position! - y.position!).map(e => `${e.occurrence.path}.${e.entry.operation}${e.entry.deadline ? '!' : ''}`), [
        'Demo.extra.q', 'Demo.pair.first.p!', 'Demo.pair.first.r', 'Demo.pair.second.p', 'Demo.pair.second.q', 'Demo.extra.p', 'Demo.pair.first.q']);
});

test('WP8-R01 equal-time releases and dispatches follow priority, then placed before unplaced, then in-task position', async () => {
    // Without Swaml::Os the run keeps schedule order; with tasks the high-priority task runs c first, then deploy order on slow.
    const plain = await runOf(ONE()('component n: Process;', 'deploy on n;'), 10000000);
    assert.equal(plain.stores['Demo.x'].log, 1231);
    const tasked = await runOf(ONE()(`${slow} ${fast} ${events}`, 'deploy s on slow; deploy x.b on slow; deploy x on slow; deploy x.c on fast; deploy x.take on events;'), 10000000);
    // c (priority 5) first; then slow in deploy order (s, b, a) except that take, released by s's event at the same
    // instant with the events task's priority 3, overtakes a, which still waits for the lock.
    assert.equal(tasked.stores['Demo.x'].log, 3211);
    assert.deepEqual(kinds(tasked.trace, 'release').filter(o => o.timeNs === 10000000).map(o => [o.subject, o.task]), [['Demo.x.c', 'hw.fast'], ['Demo.s.tick', 'hw.slow'], ['Demo.x.b', 'hw.slow'], ['Demo.x.a', 'hw.slow'], ['Demo.x.take', 'hw.events']]);
    assert.deepEqual(kinds(tasked.trace, 'dispatch').filter(o => o.timeNs === 10000000).map(o => o.subject), ['Demo.x.c', 'Demo.s.tick', 'Demo.x.b', 'Demo.x.take', 'Demo.x.a']);
    // Placed before unplaced at equal priority: in a package run, the root without a deployment is unplaced, so the
    // deployed root's entry on a priority-0 task is released first although the other root is declared first.
    const pkg = await valid(`package Test {
  import Swaml::Platform;
  import Swaml::Os;
  component def K { attribute n: int = 0; operation p() { n = n + 1; } schedule { on every 10ms p(); } }
  component free: K;
  component placed: K;
  component def Board specializes Node { ${task('z')} }
  component hw: Board;
  deployment D of placed on hw { deploy on z; }
}`);
    const both = simulate([pkg.model], 'Test', { untilNs: 10000000 });
    assert.deepEqual(kinds(both.trace, 'release').map(o => [o.subject, o.task]), [['placed.p', 'hw.z'], ['free.p', undefined]]);
    // A delivery takes the key of the receive entry it releases: with 10 ms latency, the event published at 10 ms is
    // delivered at 20 ms, the instant of b's next release; take (events, priority 3) runs before b (slow, priority 1),
    // although b's release was scheduled first. Without the delivery key b would run first (221).
    const latent = await valid(ONE('on every 10ms b(); on receive inp.e(v) take(v);')(`${slow} ${task('ev', { priority: 3 })}`, 'deploy s on slow; deploy x on slow; deploy x.take on ev;'));
    assert.equal(simulate([latent.model], 'Test::Demo', { untilNs: 20000000, latencyNs: 10000000 }).stores['Demo.x'].log, 212);
});

test('WP8-R01 equal priority on different Cores follows the task declaration rank; ready continuations keep their keys', async () => {
    const source = (order: string) => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  port def Q { provides event e(n: int); }
  component def W { port out: Q; const attribute split: bool = false; attribute k: int = 0; operation go() { if (split) { wait 1ms; wait 2ms; } else { wait 3ms; } k = k + 1; publish out.e(k); } schedule { on every 10ms go(); } }
  component def Sink { reversed port a: Q; reversed port b: Q; attribute log: int = 0; operation fromA(v: int) { log = log * 10 + 1; } operation fromB(v: int) { log = log * 10 + 2; } schedule { on receive a.e(v) fromA(v); on receive b.e(v) fromB(v); } }
  component Demo { component wa: W; component wb: W { redefines const attribute split: bool = true; } component sink: Sink; connect (wa.out, sink.a); connect (wb.out, sink.b); }
  component def Board specializes Node { ${order} component sinkCore: Core { ${task('ev', { priority: 1 })} } }
  component hw: Board;
  deployment D of Demo on hw { deploy wa on c0.t; deploy wb on c1.t; deploy sink on sinkCore.ev; }
}`;
    const ext = (p: number) => task('t', { kind: 'extended', priority: p });
    const forward = await runOf(source(`component c0: Core { ${ext(4)} } component c1: Core { ${ext(4)} }`), 15000000);
    const backward = await runOf(source(`component c1: Core { ${ext(4)} } component c0: Core { ${ext(4)} }`), 15000000);
    assert.equal(forward.stores['Demo.sink'].log, 12);
    assert.equal(backward.stores['Demo.sink'].log, 21);
    // A higher priority on the second core wins regardless of rank, also for the wait expiries (ready) at 13 ms, although
    // wb's last wait started at 11 ms, after wa's.
    const prio = await runOf(source(`component c0: Core { ${ext(4)} } component c1: Core { ${ext(5)} }`), 15000000);
    assert.equal(prio.stores['Demo.sink'].log, 21);
    assert.deepEqual(kinds(prio.trace, 'ready').filter(o => o.timeNs === 13000000).map(o => o.subject), ['Demo.wb.go', 'Demo.wa.go']);
});

test('WP8-R01 a case-script activation is unplaced, and a borrowed subject call keeps the case activation', async () => {
    const source = ONE('on every 10ms a(); on receive inp.e(v) take(v);')(`${slow} ${events}`, 'deploy s on slow; deploy x on slow; deploy x.take on events;', `test T of Demo { wait 10ms; Demo.x.b(); wait 1ms; assert Demo.x.log == 112; }`);
    const r = await valid(source);
    const [result] = runTests([r.model], { untilNs: 100000000 });
    // The script resumes at 10 ms unplaced (priority 0), after a on the slow task and take on the events task.
    assert.equal(result.result, 'pass', result.message);
    const releases = kinds(result.run!.trace as Observation[], 'release');
    assert.ok(releases.every(o => o.subject === 'Demo.x.a' || o.subject === 'Demo.s.tick' ? o.task === 'hw.slow' : o.task === undefined || o.task === 'hw.events'));
});

test('WP8-R02 kind, preemptive and responseNs do not change a run; Timing groups activations in Task lanes (WP8-M04)', async () => {
    const source = (spec: TaskSpec) => ONE('on every 10ms a(); on receive inp.e(v) take(v) deadline 5ms;')(`${slow} ${task('ev', { priority: 3, ...spec })}`, 'deploy s on slow; deploy x.a on slow; deploy x.take on ev;');
    const digest = (r: { trace: unknown[] }) => createHash('sha256').update(JSON.stringify(r.trace).replace(/file:[^"]*/gu, '')).digest('hex');
    const basic = await runOf(source({}), 30000000), other = await runOf(source({ kind: 'extended', preemptive: false, responseNs: '5ms' }), 30000000);
    assert.equal(digest(basic), digest(other));
    const timing = projectOperationTiming(basic);
    assert.deepEqual([...new Set(timing.intervals.map(i => `${i.subject}@${i.task}`))].sort(), ['Demo.s.tick@hw.slow', 'Demo.x.a@hw.slow', 'Demo.x.take@hw.ev']);
    // Without tasks no interval has a lane and no release has a task.
    const plain = await runOf(ONE()('component n: Process;', 'deploy on n;'));
    assert.ok(projectOperationTiming(plain).intervals.every(i => !('task' in i)) && kinds(plain.trace, 'release').every(o => !('task' in o)));
});

test('WP8-M06 operation placements are references: rename of the operation and occurrence updates the deploy path', async () => {
    const source = ONE('on every 10ms a(); on receive inp.e(v) take(v);')(`${slow} ${events}`, 'deploy s on slow; deploy x on slow; deploy x.take on events;');
    const r = await valid(source);
    const refs = semanticIndex([r.model]).filter(x => a.isOperation(x.symbol.node) && (x.symbol.node as { name?: string }).name === 'take' && r.doc.textDocument.getText().slice(r.doc.textDocument.offsetAt(x.range.start) - 2, r.doc.textDocument.offsetAt(x.range.start)) === 'x.');
    assert.equal(refs.length, 1);
    const text = r.doc.textDocument.getText();
    assert.equal(text.slice(r.doc.textDocument.offsetAt(refs[0].range.start), r.doc.textDocument.offsetAt(refs[0].range.end)), 'take');
});

test('WP8 unfinished deploy statements are tolerated by validator, plan, projection, views, index, formatter and runs', async () => {
    const good = ONE('on every 10ms a(); on receive inp.e(v) take(v);')(`${slow} ${events}`, 'deploy s on slow; deploy x on slow; deploy x.take on events;');
    for (const broken of ['deploy x. on slow;', 'deploy x.take on ;', 'deploy on', 'deploy x.take on events', 'deploy .take on events;', 'deploy x.take events;']) {
        const text = good.replace('deploy x.take on events;', broken);
        const services = createSwamlServices(EmptyFileSystem);
        const doc = await parseHelper<Model>(services.Swaml)(text, { validation: true });
        const m = doc.parseResult.value;
        assert.ok(doc.diagnostics!.some(d => d.severity === 1), broken);
        for (const d of m.packages.flatMap(p => p.elements.filter(a.isDeployment)))
            deploymentPlan(d);
        projectModel([m]);
        viewCandidates([m]);
        semanticIndex([m]);
        try {
            formatDocument(doc, services.Swaml.parser.Lexer);
        }
        catch (error) {
            assert.match(String(error), /Formatting|syntax|parse/iu, broken);
        }
        // Beside a valid file in one workspace, the valid file keeps no errors.
        const w = await workspace([text, good.replace('package Test', 'package Other').replace('component hw: Board;', 'component hw2: Board;').replace('on hw {', 'on hw2 {')]);
        assert.deepEqual((w.docs[1].diagnostics ?? []).filter(d => d.severity === 1).map(d => d.message), [], broken);
    }
});

test('WP8 examples 52 and 53 validate, pass their cases and fail under the obvious mutations', async () => {
    const cases = async (text: string) => { const r = await parse(text); assert.deepEqual(r.errors.map(e => e.message), []); return runTests([r.model], { untilNs: 1000000000 }).map(c => c.result); };
    const door = readFileSync(new URL('examples/52-door-deployment.swaml', root), 'utf8'), order = readFileSync(new URL('examples/53-task-order.swaml', root), 'utf8');
    assert.deepEqual(await cases(door), ['pass', 'pass', 'pass']);
    assert.deepEqual(await cases(order), ['pass', 'pass']);
    // In-task position: placing rxMainFunction after the rest of ComMain transmits one slot later.
    assert.deepEqual(await cases(door.replace('    deploy comMain.rxMainFunction on doorModules[0].core1.task20ms;\n    deploy comMain on doorModules[0].core1.task20ms;', '    deploy comMain on doorModules[0].core1.task20ms;\n    deploy comMain.rxMainFunction on doorModules[0].core1.task20ms;')), ['fail', 'fail', 'pass']);
    // Priority: a 10 ms task below the 20 ms task sees the slot's results.
    assert.deepEqual(await cases(door.replace('redefines const attribute periodNs: uint = 10ms;\n      redefines const attribute priority: uint = 40;', 'redefines const attribute periodNs: uint = 10ms;\n      redefines const attribute priority: uint = 25;')), ['pass', 'fail', 'pass']);
    assert.deepEqual(await cases(order.replace('deploy left.smooth on task10ms;\n    deploy left on task10ms;', 'deploy left on task10ms;\n    deploy left.smooth on task10ms;')), ['fail', 'pass']);
    assert.deepEqual(await cases(order.replace('redefines const attribute priority: uint = 30;', 'redefines const attribute priority: uint = 10;')), ['fail', 'pass']);
    // The static rules reject the obvious misplacements of the door deployment.
    const rejects = async (text: string, message: RegExp) => assert.ok((await parse(text)).errors.some(e => message.test(String(e.message))), String(message));
    await rejects(door.replace('deploy comMain.storePdu on doorModules[0].core1.isrCan;', ''), /^on receive pdus\.pdu storePdu of dcu\.comMain cannot run on periodic task vehicle\.doorModules\[0\]\.core1\.task20ms: event entries need a task with periodNs = 0\.$/u);
    await rejects(door.replace('deploy nvm on doorModules[0].core1.taskBackground;', 'deploy nvm on doorModules[0].core1.taskEventLow;'), /^on call api\.writeAll writeAll of dcu\.nvm may suspend in wait 3ms and needs an extended task; vehicle\.doorModules\[0\]\.core1\.taskEventLow is basic\.$/u);
    await rejects(door.replace('deploy comMain.onMode on doorModules[0].core1.taskEventLow;', 'deploy comMain.onMode on doorModules[0].core0.taskEventLow;'), /^dcu\.comMain runs on vehicle\.doorModules\[0\]\.core1 and vehicle\.doorModules\[0\]\.core0; all its operations must run on one core\.$/u);
    await rejects(door.replace('redefines const attribute priority: uint = 18;', 'redefines const attribute priority: uint = 30;'), /^Tasks vehicle\.doorModules\[0\]\.core1\.task20ms and vehicle\.doorModules\[0\]\.core1\.taskEventLow of vehicle\.doorModules\[0\]\.core1 share priority 30\.$/u);
    await rejects(door.replace('on receive pdus.pdu(lockRequest) storePdu(lockRequest) deadline 1ms;', 'on receive pdus.pdu(lockRequest) storePdu(lockRequest) deadline 400us;'), /^Deadline 400us of on receive pdus\.pdu storePdu of dcu\.comMain is shorter than the response bound 500us of vehicle\.doorModules\[0\]\.core1\.isrCan\.$/u);
});

test('WP8 determinism: repeated runs of the door deployment give the same trace', async () => {
    const door = readFileSync(new URL('examples/52-door-deployment.swaml', root), 'utf8');
    const digests = new Set<string>();
    for (let i = 0; i < 3; i++) {
        const r = await parse(door);
        for (const c of runTests([r.model], { untilNs: 1000000000 }))
            digests.add(`${c.result}:${createHash('sha256').update(JSON.stringify(c.run?.trace ?? []).replace(/file:[^"]*/gu, '')).digest('hex')}`);
    }
    assert.equal(digests.size, 3);
});
