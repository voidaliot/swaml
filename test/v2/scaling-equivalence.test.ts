import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { projectModel } from '../../src/language/projection.js';
import { viewCandidates } from '../../src/language/presentation.js';
import { simulate } from '../../src/simulation/simulator.js';
import type { Model } from '../../src/language/generated/ast.js';
import { parse, valid, workspace } from './helpers.js';

const root = new URL('../../../', import.meta.url);
/** The benchmark model generators, shared with npm run bench and the differential check. */
const generators = (): Promise<{ largeModel(scale: number): string; timerModel(options: { iterations: number; timeout: string }): string }> => import(new URL('scripts/bench/large-model.mjs', root).href);
/** The owner rule as originally written: the longest candidate path before '.', or a package before '::'; the first among equal paths. */
function referenceOwners(models: readonly Model[]): ({ path: string } | undefined)[] {
    const candidates = viewCandidates(models);
    return candidates.map(item => item.node.$type === 'Package' ? undefined : candidates.filter(x => item.path.startsWith(x.path + '.') || x.node.$type === 'Package' && item.path.startsWith(x.path + '::')).sort((a, b) => b.path.length - a.path.length)[0]);
}
/** The result or thrown message of a projection step, so a failure of the original rule is compared too. */
function outcome<T>(work: () => T): { value: T } | { error: string } { try { return { value: work() }; } catch (e) { return { error: (e as Error).message }; } }
function assertOwners(models: readonly Model[], label: string): void {
    const projected = outcome(() => projectModel(models)), reference = outcome(() => referenceOwners(models));
    if ('error' in reference || 'error' in projected) {
        assert.deepEqual('error' in projected ? projected.error : 'projected', 'error' in reference ? reference.error : 'projected', label);
        return;
    }
    const projection = projected.value, expected = reference.value;
    assert.deepEqual(projection.nodes.map(n => n.owner), expected.map(x => x?.path), label);
    assert.deepEqual(projection.edges.filter(e => e.kind === 'ownership').map(e => [e.source, e.target]), projection.nodes.filter((_, i) => expected[i] !== undefined).map((n, i) => [n.owner, n.id]), `${label}: ownership edges`);
}

test('projection owners follow the longest declared prefix for every example', async () => {
    const examples = readdirSync(new URL('examples/', root)).filter(f => f.endsWith('.swaml'));
    assert.ok(examples.length > 20);
    for (const file of examples)
        assertOwners([(await parse(readFileSync(new URL(`examples/${file}`, root), 'utf8'))).model], file);
});

test('projection owners of a large model, duplicate names and a package split across sources', async () => {
    const { largeModel } = await generators();
    assertOwners([(await valid(largeModel(1))).model], 'large model');
    // Invalid duplicates still project: the first of equal paths owns, as before.
    assertOwners([(await parse('package Test { component def A { attribute x: int = 0; } component def A { attribute x: int = 1; operation f() { } } component a: A; component a: A; }')).model], 'duplicate names');
    const split = await workspace(['package Test { component def A { attribute x: int = 0; } }', 'package Test { component def B { attribute y: int = 0; } }']);
    assertOwners(split.docs.map(d => d.parseResult.value as Model), 'split package');

    // A package being typed has no name and no string path; the original search keeps its results and failures.
    assertOwners([(await parse('package { component def A { attribute x: int = 0; } }')).model], 'nameless package');
    for (const sources of [['package P { component def A { attribute x: int = 0; } }', 'package P { component def A { attribute y: int = 0; } component def B { } }', 'package { component def A { } }'], ['package undefined { component def B { attribute x: int = 0; } }', 'package { component def A { attribute y: int = 0; } }'], ['package { component def A { attribute y: int = 0; } }', 'package undefined { component def B { } }']]) {
        const w = await workspace(sources), models = w.docs.map(d => d.parseResult.value as Model);
        assertOwners(models, sources.join(' + '));
    }
    // A name with many dots is invalid but still projects; only candidate path lengths are probed.
    assertOwners([(await parse(`package P { component def '${'a.'.repeat(400)}a' { attribute x: int = 0; } }`)).model], 'dotted name');
});

test('simultaneous events keep phase order, then the order in which they were scheduled', async () => {
    const r = await valid(`package Test {
  port def Feed {
    provides event ev(v: int);
  }
  component def Ticker {
    port feed: Feed;
    attribute n: int = 0;
    operation tick() {
      n = n + 1;
      publish feed.ev(n);
    }
    schedule {
      on every 1ms tick();
    }
  }
  component def Sink {
    reversed port feed: Feed;
    attribute last: int = 0;
    attribute missed: int = 0;
    operation listen() {
      while (true, 3 times) {
        on receive feed.ev(v) {
          last = v;
        } or after 1ms {
          missed = missed + 1;
        }
      }
    }
    schedule {
      on start listen();
    }
  }
  component Demo {
    component c: Ticker;
    component a: Ticker;
    component b: Ticker;
    component sc: Sink;
    component sa: Sink;
    component sb: Sink;
    connect (c.feed, sc.feed);
    connect (a.feed, sa.feed);
    connect (b.feed, sb.feed);
  }
}`);
    const run = simulate([r.model], 'Test::Demo', { untilNs: 3_000_000 });
    // At 1 ms the receive timeouts (phase 1) precede the periodic releases (phase 2), each in declaration
    // order c, a, b; the inputs published at that instant find the sinks waiting again.
    assert.deepEqual(run.trace.filter(t => t.timeNs === 1_000_000 && !['write', 'unlock'].includes(t.kind)).map(t => `${t.kind} ${t.subject}`), [
        'ready Demo.sc.listen', 'ready Demo.sa.listen', 'ready Demo.sb.listen',
        'release Demo.c.tick', 'dispatch Demo.c.tick', 'release Demo.a.tick', 'dispatch Demo.a.tick', 'release Demo.b.tick', 'dispatch Demo.b.tick',
        'publish Demo.c.feed.ev', 'offer Demo.@connect0', 'publish Demo.a.feed.ev', 'offer Demo.@connect1', 'publish Demo.b.feed.ev', 'offer Demo.@connect2',
        'receiveWait Demo.sc.listen', 'deliver Demo.@connect0', 'ready Demo.sc.listen',
        'receiveWait Demo.sa.listen', 'deliver Demo.@connect1', 'ready Demo.sa.listen',
        'receiveWait Demo.sb.listen', 'deliver Demo.@connect2', 'ready Demo.sb.listen',
        'complete Demo.c.tick', 'complete Demo.a.tick', 'complete Demo.b.tick',
        'receiveWait Demo.sc.listen', 'receiveWait Demo.sa.listen', 'receiveWait Demo.sb.listen'
    ]);
    assert.deepEqual(run.trace.map(t => t.ordinal), run.trace.map((_, i) => i + 1));
    assert.deepEqual(run.stores['Demo.sa'], { last: 1, missed: 2 });
    assert.equal(run.status, 'horizon');
    assert.equal(run.steps, 273);
});

test('cancelled long timeouts do not change a long run', async () => {
    // Every receive arms a 10 s timeout that the next input cancels; thousands are pending at once.
    const { timerModel } = await generators(), r = await valid(timerModel({ iterations: 3000, timeout: '10s' }));
    const run = simulate([r.model], 'Timers', { untilNs: 4_000_000_000, maxSteps: 1_000_000 });
    assert.deepEqual(run.stores, { producer: { n: 4000 }, consumer: { seen: 3000, idle: 0 } });
    assert.equal(run.status, 'horizon');
    assert.equal(run.steps, 85074);
    assert.equal(run.trace.filter(t => t.kind === 'receiveWait').length, 3000);
});
