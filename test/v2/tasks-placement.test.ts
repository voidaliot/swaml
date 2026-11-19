// WP8 of swa.ml 3.0: operation placement, Swaml::Os tasks, task rules T1 to T7, in-task order and ordering keys
// (ADR 0025, B17, B18): WP8-L01, WP8-S01..S10, WP8-D01..D11, WP8-M01, WP8-M04, WP8-M06, WP8-R01, WP8-R02.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem, URI } from 'langium';
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
    // The implicit Core of hw (its Task loose has no Core ancestor) spans the platform outside cpu0 and cpu1, so a Node
    // there reaches it for T7; T6 requires a Task of the occurrence's Core cpu0. The exact path x.q already has a deploy
    // line, so the example changes it instead of adding a duplicate (WP8-D09, verification V3).
    assert.deepEqual(await errors(source('deploy x on cpu0.a; deploy x.q on bare; deploy y on loose;')), ['on every 10ms q of Demo.x is not placed on a task of hw.cpu0; place q or Demo.x on a task, for example: change deploy x.q on bare; to deploy x.q on cpu0.a;', 'Demo.x runs on hw.cpu0 and the implicit core of hw; all its operations must run on one core.']);
    // A placement on a Core (not a Task) reaches it.
    assert.deepEqual(await errors(source('deploy x on cpu0.a; deploy x.q on cpu1; deploy y on loose;')), ['on every 10ms q of Demo.x is not placed on a task of hw.cpu0; place q or Demo.x on a task, for example: change deploy x.q on cpu1; to deploy x.q on cpu0.a;', 'Demo.x runs on hw.cpu0 and hw.cpu1; all its operations must run on one core.']);
    // Without an implicit Core a Node outside every Core reaches none: T7 ignores it, and an occurrence deployed there is
    // outside T6 (decision 2, review F2), while an entry of an occurrence of cpu0 placed there still needs a Task of cpu0.
    const explicit = (deploys: string) => source(deploys).replace(task('loose', { priority: 1 }), '');
    assert.deepEqual(await errors(explicit('deploy x on cpu0.a; deploy x.q on bare; deploy y on bare;')), ['on every 10ms q of Demo.x is not placed on a task of hw.cpu0; place q or Demo.x on a task, for example: change deploy x.q on bare; to deploy x.q on cpu0.a;']);
    assert.deepEqual(await errors(explicit('deploy x on cpu0.a; deploy y on bare;')), []);
    // Verification V1: an occurrence without any placement is on the platform root, which is in no Core but has Cores
    // with Tasks below it, so its entries need a Task of one of them; with an operation placement on a Task its Core is
    // that Task's Core, and its other entries need a Task there.
    assert.deepEqual(await errors(explicit('deploy x on cpu0.a;')), [
        'on every 10ms p of Demo.y is not placed on a task of hw; place p or Demo.y on a task, for example: deploy y.p on cpu0.a;',
        'on every 10ms q of Demo.y is not placed on a task of hw; place q or Demo.y on a task, for example: deploy y.q on cpu0.a;']);
    assert.deepEqual(await errors(explicit('deploy x.p on cpu1.a; deploy y on bare;')), ['on every 10ms q of Demo.x is not placed on a task of hw.cpu1; place q or Demo.x on a task, for example: deploy x.q on cpu1.a;']);
});

test('WP8-S04 activation: T1 to T5 on Tasks, T6 per Core that has Tasks, T7 with only a Core, nothing without either', async () => {
    const source = (board: string, deploys: string) => ONE('on every 10ms a(); on every 10ms b();')(board, deploys).replace('component s: Src; ', '').replace('connect (s.out, x.inp);', '').replace('reversed port inp: P;', '');
    // Re-pointing every placement to a Core that has Tasks cannot switch off T6.
    assert.deepEqual(await errors(source(`component cpu: Core { ${task('t')} }`, 'deploy x on cpu;')), [
        'on every 10ms a of Demo.x is not placed on a task of hw.cpu; place a or Demo.x on a task, for example: deploy x.a on cpu.t;',
        'on every 10ms b of Demo.x is not placed on a task of hw.cpu; place b or Demo.x on a task, for example: deploy x.b on cpu.t;']);
    // A Node outside every Core of a platform whose Tasks are all in Cores is outside T6 when no Core with Tasks lies
    // below it (decision 2, review F2).
    assert.deepEqual(await errors(source(`component cpu: Core { ${task('t')} } component lin: Process;`, 'deploy x on lin;')), []);
    // Verification V1: a Node in no Core that contains Cores with Tasks (an ECU), and the platform root in that case,
    // are inside the task rules: software on them needs a Task of one of those Cores (WP8-S04).
    const ecu = `component ecu: Process { component k0: Core { ${task('t', { priority: 1 })} } component k1: Core { ${task('u', { priority: 1 })} } } component lin: Process;`;
    const onEcu = ['on every 10ms a of Demo.x is not placed on a task of hw.ecu; place a or Demo.x on a task, for example: deploy x.a on ecu.k0.t;',
        'on every 10ms b of Demo.x is not placed on a task of hw.ecu; place b or Demo.x on a task, for example: deploy x.b on ecu.k0.t;'];
    assert.deepEqual(await errors(source(ecu, 'deploy x on ecu;')), onEcu);
    assert.deepEqual(await errors(source(ecu, '')), onEcu.map(m => m.replace('task of hw.ecu;', 'task of hw;')));
    assert.deepEqual(await errors(source(ecu, 'deploy x on ecu.k1.u;')), []);
    assert.deepEqual(await errors(source(ecu, 'deploy x on lin;')), []);
    // An operation placed on the ECU while its occurrence runs on a plain Node needs a Task too; an occurrence that
    // already reaches a Core is offered a Task of that Core (T7).
    assert.deepEqual(await errors(source(ecu, 'deploy x on lin; deploy x.b on ecu;')), [
        'on every 10ms b of Demo.x is not placed on a task of hw.ecu; place b or Demo.x on a task, for example: change deploy x.b on ecu; to deploy x.b on ecu.k0.t;']);
    assert.deepEqual(await errors(source(ecu, 'deploy x on ecu; deploy x.a on ecu.k1.u;')), [
        'on every 10ms b of Demo.x is not placed on a task of hw.ecu; place b or Demo.x on a task, for example: deploy x.b on ecu.k1.u;']);
    // The Core the occurrence already reaches decides even when its hosting Task does not accept the entry (T5 here).
    const bounded = ONE('on every 10ms a(); on every 10ms b() deadline 1ms;')(`component ecu: Process { component k0: Core { ${task('t', { priority: 1 })} } component k1: Core { ${task('u', { priority: 1, responseNs: '2ms' })} ${task('v', { priority: 2 })} } }`, 'deploy x on ecu; deploy x.a on ecu.k1.u;').replace('component s: Src; ', '').replace('connect (s.out, x.inp);', '').replace('reversed port inp: P;', '');
    assert.deepEqual(await errors(bounded), [
        'on every 10ms b of Demo.x is not placed on a task of hw.ecu; place b or Demo.x on a task, for example: deploy x.b on ecu.k1.v;']);
    const plan = deploymentPlan((await valid(source(ecu, 'deploy x on ecu.k1.u;'))).model.packages[0].elements.find(a.isDeployment)!)!;
    assert.deepEqual([plan.rootCore, plan.rootRegion, plan.placements[0].region, plan.occurrenceRegion.get(plan.software[1])], [undefined, 'hw', undefined, undefined]);
    // Review verification N8: an entry placed on a plain Node inside a Core with Tasks needs a Task of that Core even
    // when its occurrence is on a Node outside the task rules.
    assert.deepEqual(await errors(source(`${ecu.replace('component k0: Core {', 'component k0: Core { component n: Node;')}`, 'deploy x on lin; deploy x.a on ecu.k0.n;')), [
        'on every 10ms a of Demo.x is not placed on a task of hw.ecu.k0; place a or Demo.x on a task, for example: change deploy x.a on ecu.k0.n; to deploy x.a on ecu.k0.t;']);
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
    assert.deepEqual(await errors(source('on every 10ms a(); after a b(); on receive inp.e(v) take(v);', 'deploy x on t10; deploy x.a on t5; deploy x.take on events;')), ['after a b of Demo.x cannot run on task hw.t10: its predecessor runs on hw.t5, and an after successor runs on the task of its predecessor.']);
    // Review F4: an after successor runs on its predecessor's Task on every Task kind, an event Task included, and a
    // successor whose predecessor is not on a Task is left to T6 (one error for one omission).
    assert.deepEqual(await errors(source('on every 10ms a(); after a b(); on receive inp.e(v) take(v);', 'deploy x on t10; deploy x.b on events; deploy x.take on events;')), ['after a b of Demo.x cannot run on task hw.events: its predecessor runs on hw.t10, and an after successor runs on the task of its predecessor.']);
    assert.deepEqual(await errors(source('on every 10ms a(); after a b(); on receive inp.e(v) take(v);', 'deploy x.b on t10; deploy x.take on events;')), [
        'on every 10ms a of Demo.x is not placed on a task of the implicit core of hw; place a or Demo.x on a task, for example: deploy x.a on t10;']);
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

test('WP8-D05 T4: an activation that may suspend needs an extended task; so does a waiting machine (SIF, proposal 9)', async () => {
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
    // A machine: 2.2 did not count the idle wait between reactions. A waiting machine with states in the flow waits in its
    // states, so it needs an extended task like any activation that may suspend (proposal 9, WP8 T4).
    const machine = (entry: string, effect: string) => `operation m() { state idle { on receive inp.e(v) { ${effect} exit; } } state busy { on entry { ${entry} } after 5ms to idle; } }`;
    assert.deepEqual(await errors(source(machine('log = 1;', 'log = v;'), 'on start m();', 'deploy x on basicT;')), ['on start m of Demo.x may suspend in state idle { on receive inp.e(v) { log = v; exit; } } and needs an extended task; hw.basicT is basic.']);
    assert.deepEqual(await errors(source(machine('log = 1;', 'log = v;'), 'on start m();', 'deploy x on ext;')), []);
    // A suspending entry action or line adds nothing: the message names the first place that may suspend, the waiting state.
    for (const [entry, effect] of [['wait 1ms;', 'log = v;'], ['log = 1;', 'w();']])
        assert.deepEqual(await errors(source(machine(entry, effect), 'on start m();', 'deploy x on basicT;')), [`on start m of Demo.x may suspend in state idle { on receive inp.e(v) { ${effect} exit; } } and needs an extended task; hw.basicT is basic.`]);
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
        'on every 10ms b of Demo.x is not placed on a task of the implicit core of hw; place b or Demo.x on a task, for example: deploy x.b on second;']);
    assert.deepEqual(await errors(ONE('on receive inp.e(v) take(v);')(board, 'deploy s on second;')), [
        'on receive inp.e take of Demo.x is not placed on a task of the implicit core of hw; place take or Demo.x on a task, for example: deploy x.take on first;']);
    // Quoted names keep the 2.2 spelling in the message and the example.
    assert.deepEqual(await errors(ONE('on receive inp.e(v) take(v);')(board, `deploy s on second;`).replaceAll(' x: C;', " 'door x': C;").replace('x.inp', "'door x'.inp")), [
        "on receive inp.e take of Demo.'door x' is not placed on a task of the implicit core of hw; place take or Demo.'door x' on a task, for example: deploy 'door x'.take on first;"]);
});

test('WP8-D07 T6 (review F2): the example names a Task of the occurrence\'s own Core that accepts the entry under T2 to T4, or says the Core has none', async () => {
    const source = (schedule: string, boards: string, deploys: string, members = '') => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  port def P { provides event e(n: int); }
  component def C { reversed port inp: P; attribute log: int = 0; operation a() { log = 1; } operation w() { wait 1ms; } operation take(v: int) { log = v; } ${members} schedule { ${schedule} } }
  component def Src { port out: P; operation tick() { publish out.e(1); } schedule { on every 10ms tick(); } }
  component def Board specializes Node { ${boards} }
  component Demo { component s: Src; component x: C; connect (s.out, x.inp); }
  component hw: Board;
  deployment D of Demo on hw { deploy s on c0.p10; ${deploys} }
}`;
    const cores = `component c0: Core { ${task('irq', { kind: 'isr', priority: 9 })} ${task('p10', { priority: 5, periodNs: '10ms' })} ${task('ev', { priority: 3 })} ${task('ext', { kind: 'extended', priority: 2 })} } component c1: Core { ${task('far', { priority: 1 })} }`;
    // An every entry is never suggested an ISR (T3), even the ISR that hosts the occurrence's other entry: p10.
    assert.deepEqual(await errors(source('on every 20ms a(); on receive inp.e(v) take(v);', cores, 'deploy x.take on c0.irq;')), [
        'on every 20ms a of Demo.x is not placed on a task of hw.c0; place a or Demo.x on a task, for example: deploy x.a on c0.p10;']);
    // A period that p10 does not divide excludes p10 (T2), a suspending operation needs the extended Task (T4), and the
    // entries of one occurrence are offered the one Task that accepts all of them (verification V3).
    assert.deepEqual(await errors(source('on every 15ms a(); on start w(); on receive inp.e(v) take(v);', cores, 'deploy x.take on c0.irq;')), [
        'on every 15ms a of Demo.x is not placed on a task of hw.c0; place a or Demo.x on a task, for example: deploy x.a on c0.ext;',
        'on start w of Demo.x is not placed on a task of hw.c0; place w or Demo.x on a task, for example: deploy x.w on c0.ext;']);
    assert.deepEqual(await errors(source('on every 15ms a(); on receive inp.e(v) take(v);', cores, 'deploy x.take on c0.irq;')), [
        'on every 15ms a of Demo.x is not placed on a task of hw.c0; place a or Demo.x on a task, for example: deploy x.a on c0.ev;']);
    // Never a Task of another Core, even when that Task is the first of the platform.
    const farFirst = `component c1: Core { ${task('far', { priority: 1 })} } component c0: Core { ${task('ev', { priority: 3 })} }`;
    assert.deepEqual(await errors(source('on every 20ms a(); on receive inp.e(v) take(v);', farFirst, 'deploy x on c0;').replace('deploy s on c0.p10;', 'deploy s on c0.ev;')), [
        'on every 20ms a of Demo.x is not placed on a task of hw.c0; place a or Demo.x on a task, for example: deploy x.a on c0.ev;',
        'on receive inp.e take of Demo.x is not placed on a task of hw.c0; place take or Demo.x on a task, for example: deploy x.take on c0.ev;']);
    // A Core without a Task that accepts the entry says so instead of suggesting one that breaks another rule.
    const isrOnly = `component c0: Core { ${task('irq', { kind: 'isr', priority: 9 })} ${task('p10', { priority: 5, periodNs: '10ms' })} }`;
    assert.deepEqual(await errors(source('on start w(); on receive inp.e(v) take(v);', isrOnly, 'deploy x.take on c0.irq;')), [
        'on start w of Demo.x is not placed on a task of hw.c0; hw.c0 has no task that accepts it (it needs a task with periodNs = 0 that is no ISR, of kind extended), so add one and place w or Demo.x on it.']);
    // An after successor names its predecessor's Task, or asks to place the predecessor first.
    assert.deepEqual(await errors(source('on receive inp.e(v) take(v); after take a();', cores, 'deploy x.take on c0.ev;')), [
        'after take a of Demo.x is not placed on a task of hw.c0; place a or Demo.x on a task, for example: deploy x.a on c0.ev;']);
});

test('WP8-D07 T6 (review F2): a platform mixes OS Cores with a plain LIN Node, as the door showcase does', async () => {
    const r = await valid(readFileSync(new URL('examples/52-door-deployment.swaml', root), 'utf8'));
    const plans = r.model.packages[0].elements.filter(a.isDeployment).map(d => deploymentPlan(d)!);
    const panel = plans.find(p => p.root.name === 'switchPanel')!;
    assert.ok(panel && panel.taskRules && panel.entries.length > 0 && panel.entries.every(e => !e.task && e.core === undefined));
});

test('WP8-S04 (verification V1) the door deployment: a component left on the ECU Node by its root placement needs a Task', async () => {
    const door = readFileSync(new URL('examples/52-door-deployment.swaml', root), 'utf8');
    const line = '    deploy ecuMode on doorModules[0].core0.taskEventLow;\n';
    assert.ok(door.includes(line));
    const messages = (await errors(door.replace(line, ''))).filter(m => m.includes('of dcu.ecuMode'));
    assert.ok(messages.length > 0 && messages.every(m => m.includes(' is not placed on a task of vehicle.doorModules[0]; ')), messages.join('\n'));
    // The switch panel on its plain LIN Node stays outside the task rules.
    assert.deepEqual((await errors(door.replace(line, ''))).filter(m => m.includes('switchPanel')), []);
});

test('WP8-D07 T6 (verification V3) the example respects T5, prefers a Task that is no ISR, one Task per occurrence, and after successors', async () => {
    const source = (schedule: string, boards: string, deploys: string, members = '') => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  port def P { provides event e(n: int); }
  component def C { reversed port inp: P; attribute log: int = 0; operation a() { log = 1; } operation b() { log = 2; } operation w() { wait 1ms; } operation take(v: int) { log = v; } ${members} schedule { ${schedule} } }
  component def Src { port out: P; operation tick() { publish out.e(1); } schedule { on every 10ms tick(); } }
  component def Board specializes Node { ${boards} }
  component Demo { component s: Src; component x: C; connect (s.out, x.inp); }
  component hw: Board;
  deployment D of Demo on hw { deploy s on c0.p10; ${deploys} }
}`;
    // T5: the Task with a response bound above the entry's deadline is never offered; without another one, the
    // message names the bound.
    const bounded = `component c0: Core { ${task('slow', { priority: 1, responseNs: '2ms' })} ${task('p10', { priority: 5, periodNs: '10ms' })} ${task('quick', { priority: 3 })} }`;
    assert.deepEqual(await errors(source('on every 20ms b() deadline 1ms; on receive inp.e(v) take(v);', bounded, 'deploy x.take on c0.slow;')), [
        'on every 20ms b of Demo.x is not placed on a task of hw.c0; place b or Demo.x on a task, for example: deploy x.b on c0.p10;']);
    assert.deepEqual(await errors(source('on every 15ms b() deadline 1ms; on receive inp.e(v) take(v);', bounded.replace(task('quick', { priority: 3 }), ''), 'deploy x.take on c0.slow;')), [
        'on every 15ms b of Demo.x is not placed on a task of hw.c0; hw.c0 has no task that accepts it (it needs a task that is no ISR, with periodNs = 0 or a period that divides 15ms, with responseNs = 0 or at most 1ms), so add one and place b or Demo.x on it.']);
    // An after successor follows its predecessor: the Task offered must accept both (here the predecessor's Task fails
    // T5 for the successor, and the periodic p10 cannot take the receive entry).
    assert.deepEqual(await errors(source('on receive inp.e(v) take(v); after take b() deadline 1ms;', bounded, 'deploy x.take on c0.slow;')), [
        'after take b of Demo.x is not placed on a task of hw.c0; an after successor runs on the task of its predecessor, so move take to a task that also accepts b and place b with it, for example: change deploy x.take on c0.slow; to deploy x.take on c0.quick; deploy x.b on c0.quick;']);
    // A receive entry is offered an event Task before the ISR, and the entries of one occurrence the same Task.
    const isrFirst = `component c0: Core { ${task('irq', { kind: 'isr', priority: 9 })} ${task('p10', { priority: 5, periodNs: '10ms' })} ${task('ev', { priority: 3 })} }`;
    assert.deepEqual(await errors(source('on receive inp.e(v) take(v); on start a();', isrFirst, 'deploy x on c0;')), [
        'on receive inp.e take of Demo.x is not placed on a task of hw.c0; place take or Demo.x on a task, for example: deploy x.take on c0.ev;',
        'on start a of Demo.x is not placed on a task of hw.c0; place a or Demo.x on a task, for example: deploy x.a on c0.ev;']);
    // Alone, a receive entry that the ISR (first in rank) and the event Task both accept is offered the event Task.
    assert.deepEqual(await errors(source('on receive inp.e(v) take(v);', isrFirst, 'deploy x on c0;')), [
        'on receive inp.e take of Demo.x is not placed on a task of hw.c0; place take or Demo.x on a task, for example: deploy x.take on c0.ev;']);
    // Only the ISR accepts it: then the ISR.
    assert.deepEqual(await errors(source('on receive inp.e(v) take(v);', isrFirst.replace(task('ev', { priority: 3 }), ''), 'deploy x on c0;')), [
        'on receive inp.e take of Demo.x is not placed on a task of hw.c0; place take or Demo.x on a task, for example: deploy x.take on c0.irq;']);
    // After successors: a predecessor that is not on a Task is placed first, with its successor, on a Task that accepts
    // both; one on a Task that does not accept the successor moves (review verification N15: a suspending successor
    // never gets its predecessor's basic Task); with no Task for both, the Core has none.
    const cores = `component c0: Core { ${task('p10', { priority: 5, periodNs: '10ms' })} ${task('ext', { kind: 'extended', priority: 2 })} ${task('n', { priority: 1 })} component node: Node; }`;
    assert.deepEqual(await errors(source('on receive inp.e(v) take(v); after take w();', cores, 'deploy x on c0.node;')), [
        'on receive inp.e take of Demo.x is not placed on a task of hw.c0; place take or Demo.x on a task, for example: deploy x.take on c0.ext;',
        'after take w of Demo.x is not placed on a task of hw.c0; an after successor runs on the task of its predecessor, so place take on a task first and place w with it, for example: deploy x.take on c0.ext; deploy x.w on c0.ext;']);
    assert.deepEqual(await errors(source('on receive inp.e(v) take(v); after take w();', cores, 'deploy x on c0.node; deploy x.take on c0.n;')), [
        'after take w of Demo.x is not placed on a task of hw.c0; an after successor runs on the task of its predecessor, so move take to a task that also accepts w and place w with it, for example: change deploy x.take on c0.n; to deploy x.take on c0.ext; deploy x.w on c0.ext;']);
    assert.deepEqual(await errors(source('on every 20ms a(); after a w(); on receive inp.e(v) take(v);', cores.replace(task('ext', { kind: 'extended', priority: 2 }), ''), 'deploy x on c0.node; deploy x.a on c0.p10; deploy x.take on c0.n;')), [
        'after a w of Demo.x is not placed on a task of hw.c0; hw.c0 has no task that accepts it (it needs a task that also accepts its predecessor a, of kind extended), so add one and place w or Demo.x on it.']);
    // Review verification N14: a Task with an attribute problem (WP8-D11) is never offered, even first in rank.
    const broken = `component c0: Core { component bad: Task { redefines const attribute priority: uint = 9007199254740991 + 1; } ${task('p10', { priority: 5, periodNs: '10ms' })} ${task('ok', { priority: 3 })} }`;
    assert.deepEqual(await errors(source('on start a(); on receive inp.e(v) take(v);', broken, 'deploy x on c0;')), [
        'priority of task hw.c0.bad must be a constant uint value up to 9007199254740991.',
        'on start a of Demo.x is not placed on a task of hw.c0; place a or Demo.x on a task, for example: deploy x.a on c0.ok;',
        'on receive inp.e take of Demo.x is not placed on a task of hw.c0; place take or Demo.x on a task, for example: deploy x.take on c0.ok;']);
});

test('WP8-D11 task attributes must be constants of their type', async () => {
    const source = ONE('on every 10ms a();')(`component t: Task { redefines const attribute priority: uint = Swaml::Math::length("ab"); }`, 'deploy s on t; deploy x on t;').replace('component s: Src;', '').replace('connect (s.out, x.inp);', '').replace('reversed port inp: P;', '').replace('deploy s on t; ', '');
    assert.deepEqual(await errors(source.replace('import Swaml::Os;', 'import Swaml::Os;\n  import Swaml::Math;')), ['priority of task hw.t must be a constant uint value.']);
    // Review F8 (X6): a uint constant above 2^53 - 1 is a constant of its type but outside the range a run orders by.
    const big = (value: string) => ONE('on every 10ms a();')(`component t: Task { redefines const attribute priority: uint = ${value}; }`, 'deploy x on t;').replace('component s: Src;', '').replace('connect (s.out, x.inp);', '').replace('reversed port inp: P;', '');
    assert.deepEqual(await errors(big('9007199254740991 + 1')), ['priority of task hw.t must be a constant uint value up to 9007199254740991.']);
    assert.deepEqual(await errors(big('9007199254740991')), []);
});

test('WP8-D13 (review F3) a platform root that is a Task is an error at the platform reference, never an empty example', async () => {
    const source = `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  component def C { attribute n: int = 0; operation f() { n = n + 1; } schedule { on every 10ms f(); } }
  component def Ecu specializes Task { }
  component app: C;
  component ecu: Ecu;
  deployment D of app on ecu { }
}`;
    const r = await parse(source);
    assert.deepEqual(r.errors.map(e => e.message), ['The platform root ecu is a Swaml::Os task; a task runs on a core or node, so declare the task inside a Node or Core platform and deploy on it.']);
    assert.equal(r.doc.textDocument.getText(r.errors[0].range), 'ecu');
    // The run has no keys then.
    const plan = deploymentPlan(r.model.packages[0].elements.find(a.isDeployment)!)!;
    assert.ok(plan.rootTask && !plan.taskRules && !plan.coreRule && plan.tasks.length === 0);
});

test('WP8-D12 (review F9, F10) an operation placement on a platform without a Task is valid and gets a warning with a fixed leading text', async () => {
    const source = (board: string) => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  component def App { attribute n: int = 0; operation a() { n = 1; } operation b() { n = 2; } schedule { on every 10ms a(); on every 10ms b(); } }
  component def Ecu specializes Platform { ${board} }
  component app: App;
  component ecu: Ecu;
  deployment D of app on ecu { deploy on n1; deploy b on n2; }
}`;
    const plain = await parse(source('component n1: Node; component n2: Node;'));
    assert.deepEqual([plain.errors.length, plain.warnings.map(w => [w.code, w.message])], [0, [['SW2021', 'Operation placement app.b on ecu.n2 does not change the run on a platform without a Swaml::Os task: the run records and orders occurrence placements only, and only the one-core rule T7 uses it.']]]);
    // With Cores only, T7 still uses it; with a Task the placement has its effect and no warning.
    const cores = await parse(source('component n1: Core { } component n2: Core { }'));
    assert.deepEqual(cores.warnings.map(w => w.code), ['SW2021']);
    assert.deepEqual(cores.errors.map(e => e.message), ['app runs on ecu.n1 and ecu.n2; all its operations must run on one core.']);
    const tasked = await parse(source(`${task('n1', { priority: 1 })} ${task('n2', { priority: 2 })}`));
    assert.deepEqual([tasked.errors.length, tasked.warnings.length], [0, 0]);
});

test('WP8-D02 (review F12) a Task family on one Core fails T1 with a message that says to declare the Tasks separately', async () => {
    const source = ONE('on every 10ms a();')('component ts: Task[2];', 'deploy x on ts[0];').replace('component s: Src;', '').replace('connect (s.out, x.inp);', '').replace('reversed port inp: P;', '');
    assert.deepEqual(await errors(source), ["Tasks hw.ts[0] and hw.ts[1] of the implicit core of hw share priority 0; the members of a task family share their definition's priority, so declare the tasks of one core separately."]);
});

test('WP8-S02 (review F8 X1, F14) a family path is the last occurrence segment; it never claims a child of an element', async () => {
    const source = (deploys: string) => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  component def Leaf { attribute n: int = 0; operation a() { n = n + 1; } schedule { on every 10ms a(); } component child: Kid; }
  component def Kid { attribute n: int = 0; operation a() { n = n + 2; } schedule { on every 10ms a(); } }
  component def Mid { component leaf: Leaf; }
  component Demo { component leaves: Leaf[2]; component mids: Mid[2]; }
  component def Board specializes Node { ${task('t', { priority: 1 })} ${task('u', { priority: 2 })} }
  component hw: Board;
  deployment D of Demo on hw { ${deploys} }
}`;
    // An indexed occurrence path overrides its family path, whatever the deploy order (review mutation M4).
    for (const deploys of ['deploy on t; deploy leaves[1] on u; deploy leaves on t;', 'deploy on t; deploy leaves on t; deploy leaves[1] on u;']) {
        const indexed = deploymentPlan((await valid(source(deploys))).model.packages[0].elements.find(a.isDeployment)!)!;
        assert.deepEqual([...new Set(indexed.entries.filter(e => e.task?.path === 'hw.u').map(e => e.occurrence.path))], ['Demo.leaves[1]', 'Demo.leaves[1].child'], deploys);
    }
    const r = await valid(source('deploy on t; deploy leaves.a on u;'));
    const plan = deploymentPlan(r.model.packages[0].elements.find(a.isDeployment)!)!;
    assert.deepEqual(plan.entries.filter(e => e.task?.path === 'hw.u').map(e => e.occurrence.path), ['Demo.leaves[0]', 'Demo.leaves[1]']);
    assert.ok(plan.entries.filter(e => e.occurrence.path.includes('.child')).every(e => e.task?.path === 'hw.t'));
    // A path that continues below a family without an index names no occurrence (2.2), so each index is written.
    assert.deepEqual(await errors(source('deploy on t; deploy mids.leaf.a on u;')), ['Unknown software occurrence Demo.mids.leaf.a.']);
    assert.deepEqual(await errors(source('deploy on t; deploy mids.leaf on u;')), ['Unknown software occurrence Demo.mids.leaf.']);
    assert.deepEqual(await errors(source('deploy on t; deploy mids[0].leaf.a on u; deploy mids[1].leaf on u;')), []);
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
    // c (priority 5) first; then slow in deploy order (s, b, a). take, released by s's event while s runs on the same
    // (implicit) Core, waits until s ends (no preemption, WP8-R02); then its priority 3 puts it before b and a.
    assert.equal(tasked.stores['Demo.x'].log, 3121);
    assert.deepEqual(kinds(tasked.trace, 'release').filter(o => o.timeNs === 10000000).map(o => [o.subject, o.task]), [['Demo.x.c', 'hw.fast'], ['Demo.s.tick', 'hw.slow'], ['Demo.x.b', 'hw.slow'], ['Demo.x.a', 'hw.slow'], ['Demo.x.take', 'hw.events']]);
    assert.deepEqual(kinds(tasked.trace, 'dispatch').filter(o => o.timeNs === 10000000).map(o => o.subject), ['Demo.x.c', 'Demo.s.tick', 'Demo.x.take', 'Demo.x.b', 'Demo.x.a']);
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
    // With the source on another Core nothing else takes x's Core first, so only the delivery key puts take before b
    // (review mutation M9: with the Core lock the same-Core variant above no longer depends on it).
    const remote = await valid(ONE('on every 10ms b(); on receive inp.e(v) take(v);')(`component k0: Core { ${slow} ${task('ev', { priority: 3 })} } component k1: Core { ${task('src', { priority: 1, periodNs: '10ms' })} }`, 'deploy s on k1.src; deploy x on k0.slow; deploy x.take on k0.ev;'));
    assert.equal(simulate([remote.model], 'Test::Demo', { untilNs: 20000000, latencyNs: 10000000 }).stores['Demo.x'].log, 212);
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

test('WP8-R02 (review F1) no preemption: a dispatched activation runs until it waits or ends before anything else of its Core', async () => {
    // The reviewer's model: L (priority 1, non-preemptive) publishes to H (priority 9) and then to C; H publishes to C.
    const preempt = (tasks: string, deploys: string) => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  port def P { provides event e(n: int); }
  component def L { port toH: P; port toC: P; operation l() { publish toH.e(1); publish toC.e(3); } schedule { on every 10ms l(); } }
  component def H { reversed port inp: P; port toC: P; operation h(v: int) { publish toC.e(2); } schedule { on receive inp.e(v) h(v); } }
  component def C { reversed port a: P; reversed port b: P; attribute log: int = 0;
    operation fromL(v: int) { log = log * 10 + v; } operation fromH(v: int) { log = log * 10 + v; }
    schedule { on receive a.e(v) fromL(v); on receive b.e(v) fromH(v); } }
  component def App { component lo: L; component hi: H; component c: C; connect (lo.toH, hi.inp); connect (lo.toC, c.a); connect (hi.toC, c.b); }
  component def Ecu specializes Node { ${tasks} }
  component app: App;
  component ecu: Ecu;
  deployment D of app on ecu { ${deploys} }
}`;
    const run = async (source: string) => { const r = await valid(source); return simulate([r.model], 'Test::app', { untilNs: 10000000 }); };
    const publishes = (r: { trace: Observation[] }) => kinds(r.trace, 'publish').map(o => o.subject);
    const oneCore = (low: TaskSpec, high: TaskSpec) => preempt(`${task('low', { priority: 1, periodNs: '10ms', ...low })} ${task('high', { priority: 9, ...high })} ${task('sink', { priority: 50 })}`, 'deploy lo on low; deploy hi on high; deploy c on sink;');
    // On plain Nodes (2.2 order) L runs to completion first: log 32.
    const nodes = await run(preempt('component n1: Process; component n2: Process; component n3: Process;', 'deploy lo on n1; deploy hi on n2; deploy c on n3;'));
    assert.equal(nodes.stores['app.c'].log, 32);
    // On Tasks of one Core the same holds whatever the priorities and preemptive say: H (priority 9), released by L's
    // first publish, is dispatched only after L ends; then C's first activation (priority 50) before H.
    const tasked = await run(oneCore({ preemptive: false }, { kind: 'basic', preemptive: true }));
    assert.equal(tasked.stores['app.c'].log, 32);
    assert.deepEqual(publishes(tasked), ['app.lo.toH.e', 'app.lo.toC.e', 'app.hi.toC.e']);
    assert.deepEqual(kinds(tasked.trace, 'dispatch').map(o => o.subject), ['app.lo.l', 'app.c.fromL', 'app.hi.h', 'app.c.fromH']);
    // Swapped priorities: the low-priority H is still not dispatched inside L.
    const swapped = await run(preempt(`${task('low', { priority: 9, periodNs: '10ms' })} ${task('high', { priority: 1 })} ${task('sink', { priority: 50 })}`, 'deploy lo on low; deploy hi on high; deploy c on sink;'));
    assert.equal(swapped.stores['app.c'].log, 32);
    assert.deepEqual(kinds(swapped.trace, 'dispatch').map(o => o.subject), ['app.lo.l', 'app.c.fromL', 'app.hi.h', 'app.c.fromH']);
    // kind, preemptive and responseNs change nothing (WP8-R02).
    const digest = (r: { trace: unknown[] }) => createHash('sha256').update(JSON.stringify(r.trace).replace(/file:[^"]*/gu, '')).digest('hex');
    const other = await run(oneCore({ preemptive: true, kind: 'extended', responseNs: '1ms' }, { kind: 'extended', preemptive: false }));
    assert.equal(digest(other), digest(tasked));
    // Different Cores are independent: H and C on another Core are dispatched as soon as they are released and, with
    // higher keys, their statements run before L's next one at that instant, so C sees H first: log 23.
    const twoCores = await run(preempt(`component k0: Core { ${task('low', { priority: 1, periodNs: '10ms' })} } component k1: Core { ${task('high', { priority: 9 })} ${task('sink', { priority: 50 })} }`, 'deploy lo on k0.low; deploy hi on k1.high; deploy c on k1.sink;'));
    assert.equal(twoCores.stores['app.c'].log, 23);
    assert.deepEqual(kinds(twoCores.trace, 'dispatch').map(o => o.subject), ['app.lo.l', 'app.hi.h', 'app.c.fromH', 'app.c.fromL']);
});

test('WP8-R02 a waiting activation frees its Core; a resumed one waits for the Core like a dispatch', async () => {
    const source = (board: string, deploys: string) => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  port def P { provides event e(n: int); }
  component def H { reversed port inp: P; port toC: P; operation h() { on receive inp.e(v) { publish toC.e(2); } } schedule { on start h(); } }
  component def L { port toH: P; port toC: P; operation l() { publish toH.e(1); publish toC.e(3); } schedule { on every 10ms l(); } }
  component def C { reversed port a: P; reversed port b: P; attribute log: int = 0;
    operation fromL(v: int) { log = log * 10 + v; } operation fromH(v: int) { log = log * 10 + v; }
    schedule { on receive a.e(v) fromL(v); on receive b.e(v) fromH(v); } }
  component Demo { component hi: H; component lo: L; component c: C; connect (lo.toH, hi.inp); connect (lo.toC, c.a); connect (hi.toC, c.b); }
  component def Board specializes Node { ${board} }
  component hw: Board;
  deployment D of Demo on hw { ${deploys} }
}`;
    // H (extended, priority 9) waits in a receive statement from 0; L's first publish at 10 ms resumes it while L runs on
    // the same Core, so H continues only after L ends: C logs 3 before 2.
    const one = await runOf(source(`${task('ext', { kind: 'extended', priority: 9 })} ${task('low', { priority: 1, periodNs: '10ms' })} ${task('sink', { priority: 50 })}`, 'deploy hi on ext; deploy lo on low; deploy c on sink;'));
    assert.equal(one.stores['Demo.c'].log, 32);
    // With H and C on another Core, H's continuation and C run at once, before L's second publish: 23.
    const two = await runOf(source(`component k0: Core { ${task('low', { priority: 1, periodNs: '10ms' })} } component k1: Core { ${task('ext', { kind: 'extended', priority: 9 })} ${task('sink', { priority: 50 })} }`, 'deploy hi on k1.ext; deploy lo on k0.low; deploy c on k1.sink;'));
    assert.equal(two.stores['Demo.c'].log, 23);
});

test('WP8-R02 (verification N23, N6) a resumed activation takes its Core again; equal keys keep their release order', async () => {
    const source = (board: string, deploys: string, l: string, schedule: string) => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  port def P { provides event e(n: int); }
  component def H { reversed port inp: P; port toC: P; operation h(v: int) { publish toC.e(2); } schedule { on receive inp.e(v) h(v); } }
  component def L { port toH: P; port toC: P; operation l() { ${l} } schedule { ${schedule} } }
  component def C { reversed port a: P; reversed port b: P; attribute log: int = 0;
    operation fromL(v: int) { log = log * 10 + v; } operation fromH(v: int) { log = log * 10 + v; }
    schedule { on receive a.e(v) fromL(v); on receive b.e(v) fromH(v); } }
  component Demo { component hi: H; component lo: L; component c: C; connect (lo.toH, hi.inp); connect (lo.toC, c.a); connect (hi.toC, c.b); }
  component def Board specializes Node { ${board} }
  component hw: Board;
  deployment D of Demo on hw { ${deploys} }
}`;
    const board = `${task('ext', { kind: 'extended', priority: 1 })} ${task('high', { priority: 9 })} ${task('sink', { priority: 50 })}`;
    // L waits 10 ms and then publishes to H (priority 9) and to C. After its resumption L holds the Core again, so H,
    // released by L's first publish, runs only after L ends: C logs 3 before 2.
    const resumed = await runOf(source(board, 'deploy lo on ext; deploy hi on high; deploy c on sink;', 'wait 10ms; publish toH.e(1); publish toC.e(3);', 'on start l();'), 20000000);
    assert.equal(resumed.stores['Demo.c'].log, 32);
    assert.deepEqual(kinds(resumed.trace, 'publish').map(o => o.subject), ['Demo.lo.toH.e', 'Demo.lo.toC.e', 'Demo.hi.toC.e']);
    // N6: L publishes 1 and 3 to C and then to H while it holds the Core; the two activations of C have equal keys and
    // run in release order, before H (priority 9), whose publish of 2 comes last.
    const equal = await runOf(source(board, 'deploy lo on high; deploy hi on high; deploy c on sink;', 'publish toC.e(1); publish toC.e(3); publish toH.e(5);', 'on every 10ms l();'));
    assert.equal(equal.stores['Demo.c'].log, 132);
});

test('WP8-R02 (verification N3, N20) Cores and in-task positions are per platform, also when two platforms share the root name', async () => {
    const hw = (name: string, tasks: string) => `package ${name} {
  import Swaml::Platform;
  import Swaml::Os;
  component def Ecu specializes Node { component k: Core { ${tasks} } }
  component ecu: Ecu;
}`;
    const app = (deploys: string) => `package Test {
  import Swaml::Platform;
  port def P { provides event e(n: int); }
  component def L { port toH: P; port toC: P; operation l() { publish toH.e(1); publish toC.e(3); } schedule { on every 10ms l(); } }
  component def H { reversed port inp: P; port toC: P; operation h(v: int) { publish toC.e(2); } schedule { on receive inp.e(v) h(v); } }
  component def C { reversed port a: P; reversed port b: P; attribute log: int = 0;
    operation fromL(v: int) { log = log * 10 + v; } operation fromH(v: int) { log = log * 10 + v; }
    schedule { on receive a.e(v) fromL(v); on receive b.e(v) fromH(v); } }
  component def K { attribute n: int = 0; operation p() { n = n + 1; } schedule { on every 5ms p(); } }
  component def Z { attribute n: int = 0; operation z() { n = n + 1; } schedule { on every 10ms z(); } }
  ${deploys}
}`;
    const run = async (texts: string[], target: string) => { const w = await workspace(texts); assert.deepEqual(w.docs.flatMap(d => (d.diagnostics ?? []).filter(x => x.severity === 1).map(x => x.message)), []); return simulate(w.docs.map(d => d.parseResult.value as Model), target, { untilNs: 10000000 }); };
    // N3: L on ecu.k of HwA; H and C on ecu.k of HwB. Two Cores: H and C run while L runs, so C logs 2 before 3.
    const twoPlatforms = await run([hw('HwA', task('t', { priority: 1 })), hw('HwB', `${task('t', { priority: 9 })} ${task('u', { priority: 50 })}`), app(`component lo: L; component hi: H; component c: C;
  connect (lo.toH, hi.inp); connect (lo.toC, c.a); connect (hi.toC, c.b);
  deployment D1 of lo on HwA::ecu { deploy on k.t; }
  deployment D2 of hi on HwB::ecu { deploy on k.t; }
  deployment D3 of c on HwB::ecu { deploy on k.u; }`)], 'Test');
    assert.equal(twoPlatforms.stores.c.log, 23);
    // N20: p and z are on Tasks of equal priority and rank on two platforms, each at position 0 of its own Task. At 10 ms
    // z's release was scheduled first (p's at 5 ms), so with equal keys z goes first; numbering both Tasks as one would
    // put z at position 1, after p.
    const positions = await run([hw('HwA', task('t', { priority: 1 })), hw('HwB', task('t', { priority: 1 })), app(`component first: K; component second: Z;
  deployment D1 of first on HwA::ecu { deploy on k.t; }
  deployment D2 of second on HwB::ecu { deploy on k.t; }`)], 'Test');
    assert.deepEqual(kinds(positions.trace, 'dispatch').filter(o => o.timeNs === 10000000).map(o => o.subject), ['second.z', 'first.p']);
});

test('WP8-R02 (verification V2) only a predecessor on a Task releases its after successors in its completion step', async () => {
    // Root a has no deployment (2.2 shape); root b is on a Task or on a plain Node. Root a's trace and the step count
    // are the same either way.
    const source = (tasked: boolean, schedule: string) => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  port def P { provides event e(n: int); }
  component def X { port out: P; attribute log: int = 0; operation a() { log = log * 10 + 1; } operation b() { log = log * 10 + 2; publish out.e(5); } operation c() { log = log * 10 + 3; } schedule { ${schedule} } }
  component def Z { reversed port inp: P; attribute log: int = 0; operation z() { log = log * 10 + 4; } operation take(v: int) { log = log * 10 + v; } schedule { on every 10ms z(); on receive inp.e(v) take(v); } }
  component def A { component x: X; component z: Z; connect (x.out, z.inp); }
  component def B { attribute m: int = 0; operation q() { m = m + 1; } schedule { on every 10ms q(); } }
  component a: A;
  component b: B;
  component def Ecu specializes Platform { ${tasked ? task('t', { priority: 1 }) : 'component t: Node;'} }
  component ecu: Ecu;
  deployment D of b on ecu { deploy on t; }
}`;
    const ofA = (r: { trace: Observation[] }) => r.trace.filter(o => String(o.subject).startsWith('a.')).map(o => `${o.timeNs} ${o.kind} ${o.subject}`);
    for (const schedule of ['on every 10ms a(); after a b(); on every 10ms c();', 'on every 10ms a(); after a b(); after b c();']) {
        const plain = simulate([(await valid(source(false, schedule))).model], 'Test', { untilNs: 20000000 });
        const tasked = simulate([(await valid(source(true, schedule))).model], 'Test', { untilNs: 20000000 });
        assert.deepEqual(ofA(tasked), ofA(plain), schedule);
        assert.equal(tasked.steps, plain.steps, schedule);
        assert.ok(kinds(tasked.trace, 'release').some(o => o.task === 'ecu.t'));
    }
});

test('WP8-R02 (verification V6) an ActivationOverflow of a run with Tasks names maxPending and the Core that queues the releases', async () => {
    const source = (tasked: boolean) => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  component def Leaf { attribute n: int = 0; operation a() { n = n + 1; } operation b() { n = n + 2; } schedule { on every 10ms a(); on every 10ms b(); } }
  component def App { component leaves: Leaf[3]; }
  component def Ecu specializes Node { ${tasked ? `component k: Core { ${task('t', { priority: 1 })} }` : 'component t: Process;'} }
  component app: App;
  component ecu: Ecu;
  deployment D of app on ecu { deploy on ${tasked ? 'k.t' : 't'}; }
}`;
    const violation = async (tasked: boolean, maxPending: number) => { const r = simulate([(await valid(source(tasked))).model], 'Test::app', { untilNs: 10000000, maxPending }); assert.equal(r.status, 'violation'); return kinds(r.trace, 'violation')[0]; };
    const tasked = await violation(true, 4);
    assert.equal(tasked.code, 'ActivationOverflow');
    assert.equal(tasked.message, 'ActivationOverflow: 4 activations are pending at 10000000ns, the limit set by the run option maxPending = 4; 4 of them wait for core ecu.k of Test::ecu.');
    // Without Tasks the observation keeps its 2.2 fields.
    const plain = await violation(false, 1);
    assert.equal(plain.code, 'ActivationOverflow');
    assert.ok(!('message' in plain));
});

test('WP8-R01 (review F12) entries of two deployments on one Task follow the roots in declaration order, then in-task position', async () => {
    const pkg = await valid(`package Test {
  import Swaml::Platform;
  import Swaml::Os;
  component def K { attribute n: int = 0; operation p() { n = n + 1; } operation q() { n = n + 2; } schedule { on every 10ms p(); on every 10ms q(); } }
  component def Z { attribute n: int = 0; operation z() { n = n + 1; } schedule { on every 10ms z(); } }
  component first: K;
  component second: Z;
  component def Board specializes Node { ${task('t', { priority: 1 })} }
  component hw: Board;
  deployment D2 of second on hw { deploy on t; }
  deployment D1 of first on hw { deploy on t; }
}`);
    const run = simulate([pkg.model], 'Test', { untilNs: 10000000 });
    // Positions per deployment would be p 0, q 1, z 0 and give p, z, q.
    assert.deepEqual(kinds(run.trace, 'dispatch').map(o => o.subject), ['first.p', 'first.q', 'second.z']);
});

test('WP8-R01 (review F8 X7 to X10) start releases, after releases, request expiries and receive timeouts carry their keys', async () => {
    const pkg = (types: string, demo: string, board: string, deploys: string) => `package Test {
  import Swaml::Platform;
  import Swaml::Os;
  import Swaml::Qos;
  port def P { provides event e(n: int); }
  port def R { requires operation ask() returns int; }
  ${types}
  component Demo { ${demo} }
  component def Board specializes Node { ${board} }
  component hw: Board;
  deployment D of Demo on hw { ${deploys} }
}`;
    // X7: two on start entries; the priority-9 one is released and runs first although declared second.
    const starts = await runOf(pkg(`component def A { port o: P; operation s() { publish o.e(1); } schedule { on start s(); } }
  component def B { port o: P; operation s() { publish o.e(2); } schedule { on start s(); } }
  component def C { reversed port a: P; reversed port b: P; attribute log: int = 0; operation fa(v: int) { log = log * 10 + v; } operation fb(v: int) { log = log * 10 + v; } schedule { on receive a.e(v) fa(v); on receive b.e(v) fb(v); } }`,
    'component x: A; component y: B; component c: C; connect (x.o, c.a); connect (y.o, c.b);', `${task('lo', { priority: 1 })} ${task('hi', { priority: 9 })} ${task('sink', { priority: 50 })}`, 'deploy x on lo; deploy y on hi; deploy c on sink;'), 1000000);
    assert.deepEqual(kinds(starts.trace, 'release').slice(0, 2).map(o => o.subject), ['Demo.y.s', 'Demo.x.s']);
    assert.equal(starts.stores['Demo.c'].log, 21);
    // X8: at 20 ms the after successor b (priority 9) and the delivery of a's 10 ms publish (latency 10 ms, take on a
    // priority-5 task) are both released when a ends; b's key puts it first although the delivery was scheduled earlier.
    const chain = await valid(pkg(`component def X { port out: P; attribute n: int = 0; operation a() { publish out.e(1); } operation b() { n = n + 1; } schedule { on every 10ms a(); after a b(); } }
  component def Y { reversed port inp: P; attribute n: int = 0; operation take(v: int) { n = n + v; } schedule { on receive inp.e(v) take(v); } }`,
    'component x: X; component y: Y; connect (x.out, y.inp);', `${task('hi', { priority: 9 })} ${task('mid', { priority: 5 })}`, 'deploy x on hi; deploy y on mid;'));
    const chained = simulate([chain.model], 'Test::Demo', { untilNs: 20000000, latencyNs: 10000000 });
    assert.deepEqual(kinds(chained.trace, 'dispatch').filter(o => o.timeNs === 20000000).map(o => o.subject), ['Demo.x.a', 'Demo.x.b', 'Demo.y.take']);
    // X9: two requests expire at 10 ms; the low requester asked first (at 0, timeout 10 ms), the high one at 5 ms
    // (timeout 5 ms). The expiry of the priority-9 request comes first.
    const requests = await runOf(pkg(`qos def Long: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 2; overflow = Overflow.reject; requestTimeout = 10ms; }
  qos def Short: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 2; overflow = Overflow.reject; requestTimeout = 5ms; }
  component def Server { reversed port api: R; operation ask() returns int { wait 20ms; return 1; } schedule { on call api.ask() ask(); } }
  component def Low { port req: R; attribute v: int = 0; operation go() { v = req.ask(); } schedule { on start go(); } }
  component def High { port req: R; attribute v: int = 0; operation go() { wait 5ms; v = req.ask(); } schedule { on start go(); } }`,
    'component low: Low; component high: High; component s1: Server; component s2: Server; connect l1: Long (low.req, s1.api); connect l2: Short (high.req, s2.api);',
    `${task('lo', { kind: 'extended', priority: 1 })} ${task('hi', { kind: 'extended', priority: 9 })} ${task('srv', { kind: 'extended', priority: 3 })}`, 'deploy low on lo; deploy high on hi; deploy s1 on srv; deploy s2 on srv;'), 10000000);
    assert.equal(kinds(requests.trace, 'timeout').filter(o => o.timeNs === 10000000).length, 2);
    assert.deepEqual(kinds(requests.trace, 'ready').filter(o => o.timeNs === 10000000).map(o => o.subject), ['Demo.high.go', 'Demo.low.go']);
    // X10: two receive statements time out at 10 ms, the low one waiting since 0, the high one since 5 ms.
    const timeouts = await runOf(pkg(`component def Low { reversed port inp: P; attribute log: int = 0; operation go() { on receive inp.e(v) { log = v; } or after 10ms { log = 1; } } schedule { on start go(); } }
  component def High { reversed port inp: P; attribute log: int = 0; operation go() { wait 5ms; on receive inp.e(v) { log = v; } or after 5ms { log = 2; } } schedule { on start go(); } }
  component def Src { port a: P; port b: P; }`,
    'component low: Low; component high: High; component src: Src; connect (src.a, low.inp); connect (src.b, high.inp);', `${task('lo', { kind: 'extended', priority: 1 })} ${task('hi', { kind: 'extended', priority: 9 })}`, 'deploy low on lo; deploy high on hi; deploy src on lo;'), 10000000);
    assert.deepEqual(kinds(timeouts.trace, 'ready').filter(o => o.timeNs === 10000000).map(o => o.subject), ['Demo.high.go', 'Demo.low.go']);
    assert.deepEqual(kinds(timeouts.trace, 'write').filter(o => o.timeNs === 10000000).map(o => o.subject), ['Demo.high.log', 'Demo.low.log']);
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

test('WP8 (review F5) the plan is linear in entries and placements; a 2.2-shaped deployment validates without entry work', async () => {
    const synth = (k: number, tasks: boolean) => `package Synth {
  import Swaml::Platform;
  import Swaml::Os;
  component def Leaf { attribute n: int = 0; operation a() { n = n + 1; } operation b() { n = n + 2; } operation c() { n = n + 3; }
    schedule { on every 10ms a(); on every 20ms b(); on every 40ms c(); } }
  component def App { component leaves: Leaf[${k}]; }
  component def Ecu specializes Node { ${tasks ? `${task('t10', { priority: 3, periodNs: '10ms' })} ${task('t20', { priority: 2, periodNs: '20ms' })} ${task('t40', { priority: 1, periodNs: '40ms' })}` : 'component t10: Process;'} }
  component app: App;
  component ecu: Ecu;
  deployment D of app on ecu {
${Array.from({ length: k }, (_, i) => tasks ? `deploy leaves[${i}].a on t10; deploy leaves[${i}].b on t20; deploy leaves[${i}].c on t40;` : `deploy leaves[${i}] on t10;`).join('\n')}
  }
}`;
    // 12000 entries and 12000 operation placements: the first WP8 plan filtered every placement for every entry
    // (about 3 * 10^8 path comparisons, seconds); indexed by path it takes milliseconds. The budget is generous.
    const s = createSwamlServices(EmptyFileSystem);
    const doc = s.shared.workspace.LangiumDocumentFactory.fromString(synth(4000, true), URI.parse('memory:///synth.swaml'));
    s.shared.workspace.LangiumDocuments.addDocument(doc);
    await s.shared.workspace.DocumentBuilder.build([doc], { validation: false });
    const d = (doc.parseResult.value as Model).packages[0].elements.find(a.isDeployment)!;
    const started = performance.now(), plan = deploymentPlan(d)!;
    assert.equal(plan.entries.filter(e => e.task).length, 12000);
    assert.ok(performance.now() - started < 1500, `plan of 12000 entries took ${Math.round(performance.now() - started)} ms`);
    // A 2.2-shaped deployment of 4000 deploy lines on a plain Node: the first WP8 validator took seconds (quadratic).
    const t0 = performance.now(), plain = await parse(synth(4000, false).replace('import Swaml::Os;', ''));
    assert.equal(plain.errors.length, 0);
    assert.ok(performance.now() - t0 < 4000, `validation of 4000 deploy lines took ${Math.round(performance.now() - t0)} ms`);
});
