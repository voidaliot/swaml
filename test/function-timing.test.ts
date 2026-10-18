import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';
import { simulate, type SimulationOptions } from '../src/simulation/simulator.js';
import { projectFunctionTiming, type FunctionTimingContract } from '../src/simulation/timing.js';

const source = readFileSync(new URL('../../examples/17-function-timing.swaml', import.meta.url), 'utf8');
const options = JSON.parse(readFileSync(new URL('../../examples/simulation/17-function-timing.json', import.meta.url), 'utf8')) as SimulationOptions;
const contracts: FunctionTimingContract[] = ['first', 'second'].map(name => ({ functionPath: `${name}.poll`, definitionPath: 'FunctionTiming::Client.poll', wcetNs: 1000000, deadlineNs: 30000000, concurrency: 'serial' }));
async function run(overrides: Partial<SimulationOptions> = {}) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const document = await parseHelper<Model>(Swaml)(source, { validation: true });
    assert.deepEqual(document.diagnostics, []);
    const evidence = simulate([document.parseResult.value], 'FunctionTiming::Demo', { ...options, ...overrides });
    return { evidence, timing: projectFunctionTiming(evidence, contracts) };
}

test('timing retains independent occurrences and distinct activations of a reused definition', async () => {
    const { timing } = await run();
    const first = timing.activations.filter(a => a.functionPath === 'first.poll');
    assert.equal(first.length, 2);
    assert.notEqual(first[0].id, first[1].id);
    assert.equal(first[0].contract?.definitionPath, first[1].contract?.definitionPath);
    assert.equal(timing.activations.filter(a => a.functionPath === 'second.poll').length, 1);
    assert.deepEqual(first.map(a => [a.released.timeNs, a.dispatched?.timeNs, a.terminal?.timeNs]), [[2000000, 2000000, 6000000], [3000000, 6000000, 10000000]]);
    assert.equal(first[1].intervals.find(i => i.state === 'ready')?.end.timeNs, 6000000);
});
test('timing separates declared CPU bounds from logical wait and zero-cost execution', async () => {
    const { timing } = await run();
    const activation = timing.activations.find(a => a.functionPath === 'first.poll')!;
    assert.equal(activation.contract?.wcetNs, 1000000);
    assert.equal(activation.deadlineAtNs, 32000000);
    assert.ok(activation.intervals.filter(i => i.state === 'running').every(i => i.start.timeNs === i.end.timeNs));
    assert.deepEqual(activation.intervals.filter(i => i.state === 'requestWait').map(i => [i.start.timeNs, i.end.timeNs]), [[2000000, 6000000]]);
    assert.deepEqual(activation.markers.map(m => m.point.ordinal), [...activation.markers.map(m => m.point.ordinal)].sort((a, b) => a! - b!));
});
test('a timeout and later response retain the original terminal caller and correlation', async () => {
    const { timing } = await run({ latencyNs: 12000000, untilNs: 40000000 });
    const activation = timing.activations.find(a => a.functionPath === 'first.poll')!;
    assert.equal(activation.outcome, 'failure'); assert.equal(activation.terminal?.timeNs, 32000000);
    const timeout = activation.markers.find(m => m.kind === 'timeout')!;
    const late = activation.markers.find(m => m.kind === 'discardResponse')!;
    assert.equal(late.correlation, timeout.correlation); assert.equal(late.point.timeNs, 36000000);
    assert.equal(activation.markers.filter(m => m.kind === 'requestComplete').length, 1);
    assert.equal(activation.markers.filter(m => m.kind === 'failure').length, 1);
    assert.equal(timing.stops.length, 0);
    const queued = timing.activations.filter(a => a.functionPath === 'first.poll')[1];
    assert.equal(timing.endNs, 40000000);
    assert.equal(queued.outcome, 'open'); assert.equal(queued.terminal, undefined);
    assert.equal(queued.deadlineAtNs, 43000000);
    assert.ok(queued.intervals.some(i => i.state === 'requestWait' && i.open && i.end.timeNs === 40000000));
});
test('horizon uses the requested boundary and leaves waiting and queued intervals open', async () => {
    const { evidence, timing } = await run({ untilNs: 5000000 });
    assert.equal(evidence.status, 'horizon'); assert.equal(evidence.timeNs, 4000000); assert.equal(timing.endNs, 5000000);
    const open = timing.activations.flatMap(a => a.intervals.filter(i => i.open));
    assert.ok(open.some(i => i.state === 'requestWait')); assert.ok(open.some(i => i.state === 'ready'));
    assert.ok(open.every(i => i.end.timeNs === 5000000 && i.end.ordinal === undefined));
    assert.ok(timing.activations.filter(a => a.outcome === 'open').every(a => a.terminal === undefined));
});
test('deadline stop is distinct from a fabricated activation failure or completion', async () => {
    const { evidence, timing } = await run({ latencyNs: 18000000, untilNs: 80000000 });
    assert.equal(evidence.status, 'violation'); assert.equal(timing.endNs, 49000000);
    assert.equal(timing.stops[0].code, 'Deadline');
    const last = timing.activations.filter(a => a.functionPath === 'first.poll')[1];
    assert.equal(last.outcome, 'open'); assert.equal(last.terminal, undefined);
    assert.equal(last.intervals.at(-1)?.state, 'requestWait'); assert.equal(last.intervals.at(-1)?.open, true);
});
test('timing projection does not mutate evidence or declare missing timing contracts', async () => {
    const { evidence } = await run();
    const before = JSON.stringify(evidence);
    const projection = projectFunctionTiming(evidence);
    assert.equal(JSON.stringify(evidence), before);
    assert.ok(projection.activations.every(a => a.contract === undefined && a.deadlineAtNs === undefined));
});
test('interrupt cancellation closes request waiting while the activation continues normally', async () => {
    const { evidence } = await run();
    const trace = [
        { timeNs: 0, ordinal: 1, kind: 'release', subject: 'a1', function: 'first.poll' },
        { timeNs: 0, ordinal: 2, kind: 'dispatch', subject: 'a1', function: 'first.poll' },
        { timeNs: 0, ordinal: 3, kind: 'request', subject: 'r1', activation: 'a1' },
        { timeNs: 2, ordinal: 4, kind: 'requestCancelled', subject: 'r1', activation: 'a1', reason: 'Interrupted' },
        { timeNs: 2, ordinal: 5, kind: 'interrupt', subject: 'a1', region: 'work', endpoint: 'control.stop' },
        { timeNs: 2, ordinal: 6, kind: 'complete', subject: 'a1', function: 'first.poll' },
        { timeNs: 4, ordinal: 7, kind: 'discardResponse', subject: 'r1', reason: 'TerminalCorrelation' }
    ];
    const timing = projectFunctionTiming({ ...evidence, trace, status: 'quiescent', timeNs: 4 });
    const activation = timing.activations[0];
    assert.equal(activation.outcome, 'complete');
    assert.equal(activation.intervals.find(i => i.state === 'requestWait')?.end.timeNs, 2);
    assert.equal(activation.markers.find(m => m.kind === 'requestCancelled')?.detail, 'Interrupted');
    assert.ok(activation.markers.some(m => m.kind === 'interrupt'));
    assert.equal(activation.markers.at(-1)?.kind, 'discardResponse');
    assert.equal(timing.stops.length, 0);
});
test('timing rejects reordered evidence and mismatched function occurrence identities', async () => {
    const { evidence } = await run();
    assert.throws(() => projectFunctionTiming({ ...evidence, trace: [...evidence.trace].reverse() }), /monotonic/);
    assert.throws(() => projectFunctionTiming({ ...evidence, trace: [{ ...evidence.trace[0], timeNs: -1 }, ...evidence.trace.slice(1)] }), /monotonic/);
    const changed = evidence.trace.map(e => e.kind === 'dispatch' ? { ...e, function: 'other.poll' } : e);
    assert.throws(() => projectFunctionTiming({ ...evidence, trace: changed }), /changed function occurrence/);
    assert.throws(() => projectFunctionTiming(evidence, [contracts[0], contracts[0]]), /Duplicate timing contract/);
});
test('timing projects actual typed interrupt evidence without restarting the cancelled request', async () => {
    const interruptSource = readFileSync(new URL('../../examples/19-interruptible-function.swaml', import.meta.url), 'utf8');
    const binding = JSON.parse(readFileSync(new URL('../../examples/simulation/19-interruptible-function.json', import.meta.url), 'utf8')) as SimulationOptions;
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const document = await parseHelper<Model>(Swaml)(interruptSource, { validation: true });
    assert.deepEqual(document.diagnostics, []);
    const evidence = simulate([document.parseResult.value], 'Interrupts::App', binding);
    const worker = projectFunctionTiming(evidence).activations.find(a => a.functionPath === 'worker.run')!;
    assert.equal(worker.outcome, 'complete'); assert.equal(worker.terminal?.timeNs, 7000000);
    assert.equal(worker.intervals.find(i => i.state === 'requestWait')?.end.timeNs, 7000000);
    assert.equal(worker.markers.find(m => m.kind === 'requestCancelled')?.detail, 'Interrupted');
    assert.equal(worker.markers.find(m => m.kind === 'discardResponse')?.point.timeNs, 10000000);
    assert.equal(worker.markers.filter(m => m.kind === 'request').length, 1);
});
