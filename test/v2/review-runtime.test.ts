import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { run, workspace } from './helpers.js';
import { simulate } from '../../src/simulation/simulator.js';
import type { Model } from '../../src/language/generated/ast.js';
const wrap = (s: string) => `package Test { component Demo { ${s} } }`;

test('F02 imported package bodies keep their lexical helper through calls and usages', async () => {
    const library = 'package Library { operation def helper() returns int { return 1; } operation def compute() returns int { return helper(); } }';
    for (const call of ['compute()', 'reused()']) {
        const r = await workspace([library, `package Test { import Library; component Demo { attribute n:int=0; operation helper() returns int {return 2;} operation reused:compute; operation boot(){n=${call};} schedule{on start boot();} } }`]);
        assert.deepEqual(r.docs.flatMap(d => d.diagnostics?.filter(x => x.severity === 1) ?? []), []);
        assert.equal(simulate(r.docs.map(d => d.parseResult.value as Model), 'Test::Demo', {untilNs:10}).stores.Demo.n, 1);
    }
    const r = await run('package Test { component def Base { attribute n:int=0; operation helper() returns int {return 1;} operation boot(){n=helper();} schedule{on start boot();} } component Demo:Base {redefines operation helper() returns int {return 2;}} }');
    assert.equal(r.stores.Demo.n, 2);
});

test('F04 covariant RPC out values initialize in the provider domain and copy back', async () => {
    const r = await run('package Test { port def A{provides operation get(out n:int);} port def B{requires operation get(out n:real);} component def Server{port p:A;operation get(out n:int){n=7;}schedule{on call p.get(n) get(n);}} component def Client{port p:B;attribute result:real=0.0;operation boot(){p.get(result);}schedule{on start boot();}} component Demo{component a:Server;component b:Client;connect(a.p,b.p);} }');
    assert.equal(r.stores['Demo.b'].result, 7);
    assert.equal(r.outcome, 'no-failure-observed');
});

for (const kind of ['attribute', 'event', 'operation']) {
    test(`F05 ${kind} checks its own byte domain before routing to an int peer`, async () => {
        for (const value of [255, 256]) {
            const declaration = (direction: string, type: string) => `${direction} ${kind} value${kind === 'attribute' ? `:${type}` : `(n:${type})`};`;
            const sender = kind === 'operation' ? `try(p.value(${value} - 1 + 1));` : `${kind === 'attribute' ? 'send' : 'publish'} p.value(${value} - 1 + 1);`;
            const source = `package Test {port def A{${declaration(kind === 'operation' ? 'requires' : 'provides','byte')}} port def B{${declaration(kind === 'operation' ? 'provides' : 'requires','int')}} component def Source{port p:A;operation boot(){${sender}}schedule{on start boot();}} component def Sink{port p:B;attribute n:int=0;operation take(v:int){n=v;}schedule{on ${kind === 'operation' ? 'call' : 'receive'} p.value(x) take(x);}}component Demo{component a:Source;component b:Sink;connect(a.p,b.p);}}`;
            const r = await run(source);
            assert.equal(r.stores['Demo.b'].n, value === 255 ? 255 : 0);
            assert.equal(r.outcome, value === 255 ? 'no-failure-observed' : 'failure-observed');
            if (value === 256) {
                assert.equal(r.trace.filter(e => e.kind === 'offer').length, 0);
                assert.ok(r.trace.some(e => e.reason === 'Bounds'));
            }
        }
    });
}

for (const kind of ['while', 'until']) {
    test(`F06 ${kind} evaluates and checks computed limits once`, async () => {
        const source = (value: number) => wrap(`attribute n:int=0;attribute calls:int=0;operation limit() returns int{calls=calls+1;return ${value};} operation loop(){${kind} (${kind === 'while' ? 'true' : 'false'}, limit() times){n=n+1;}} operation boot(){try(loop());} schedule{on start boot();}`);
        for (const value of [-1, 0, 2]) {
            const r = await run(source(value));
            assert.equal(r.stores.Demo.n, Math.max(0, value));
            assert.equal(r.stores.Demo.calls, 1);
            assert.equal(r.outcome, value < 0 ? 'failure-observed' : 'no-failure-observed');
        }
    });
}

test('F07 initializer failures retain source evidence and stop before startup', async () => {
    const r = await run(wrap('attribute n:real=1.0/0.0;operation boot(){}schedule{on start boot();}'));
    assert.equal(r.outcome, 'failure-observed');
    const failure = r.trace.find(e => e.kind === 'failure')!;
    assert.equal(failure.subject, 'Demo.n');
    assert.equal(failure.phase, 'initialization');
    assert.ok(failure.uri && failure.range);
    assert.ok(!r.trace.some(e => e.kind === 'release'));
    assert.ok(r.sources.some(s => s.text.includes('1.0/0.0')));
    const recovered = await run(wrap('attribute n:real=try(1.0/0.0,3.0);operation boot(){n=n+1;}schedule{on start boot();}'));
    assert.equal(recovered.stores.Demo.n, 4);
    assert.equal(recovered.outcome, 'failure-observed');
});

test('F07 CLI emits initialization failure JSON with failure exit status', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'swaml-initialization-'));
    const source = join(folder,'input.swaml'), options = join(folder,'options.json');
    try {
        await writeFile(source,wrap('attribute n:real=1.0/0.0;'));
        await writeFile(options,JSON.stringify({untilNs:10}));
        const cli=spawnSync(process.execPath,[fileURLToPath(new URL('../../src/cli/simulate.js',import.meta.url)),'Test::Demo',options,source],{encoding:'utf8'});
        assert.equal(cli.status,1,cli.stderr);
        assert.equal(JSON.parse(cli.stdout).outcome,'failure-observed');
    } finally {await rm(source,{force:true});await rm(options,{force:true});await rmdir(folder);}
});

test('F13 each duplicate delivery obeys capacity and overflow policy', async () => {
    for (const overflow of ['reject','dropNewest','dropOldest']) {
        const r=await run(`package Test{import Swaml::Qos;qos def One:Policy{delivery=Delivery.atLeastOnce;ordering=Ordering.fifo;capacity=1;overflow=Overflow.${overflow};requestTimeout=1s;}port def P{provides event pulse();}component def Source{port p:P;operation boot(){publish p.pulse();}schedule{on start boot();}}component def Sink{reversed port p:P;attribute n:int=0;operation take(){n=n+1;}schedule{on receive p.pulse() take();}}component Demo{component a:Source;component b:Sink;connect:One(a.p,b.p);}}`,10000000,{faults:[{offer:1,kind:'duplicate'}]});
        assert.equal(r.stores['Demo.b'].n,1);
        assert.equal(r.trace.filter(e=>e.kind==='overflow').length,1);
        assert.equal(r.outcome,overflow==='reject'?'failure-observed':'no-failure-observed');
    }
});

test('state timers start before suspended entry, with source-order ties and final completion', async () => {
    for (const wait of [1, 3]) {
        const r=await run(wrap(`attribute n:int=0;operation machine(){initial A;state A{on entry{wait ${wait}ms;}after 2ms to B{n=1;}after 2ms to C{n=2;}}final state B{on entry{n=n+10;}}final state C{}}operation done(){n=n+100;}schedule{on start machine();after machine done();}`));
        assert.equal(r.stores.Demo.n,111);
        assert.equal(r.trace.find(e=>e.kind==='state'&&e.state==='B')!.timeNs,Math.max(wait,2)*1000000);
        assert.equal(r.trace.filter(e=>e.kind==='complete'&&e.subject==='Demo.machine').length,1);
    }
});

test('elapsed state timer precedes input queued during entry; deadline wins equal time', async () => {
    const source = `package Test{port def P{provides event pulse();}component def Source{port p:P;operation boot(){wait 1ms;publish p.pulse();}schedule{on start boot();}}component def Sink{reversed port p:P;attribute n:int=0;operation machine(){initial A;state A{on entry{wait 3ms;}on receive p.pulse() to C{n=2;}after 2ms to B{n=1;}}final state B{}final state C{}}schedule{on start machine();}}component Demo{component a:Source;component b:Sink;connect(a.p,b.p);}}`;
    assert.equal((await run(source)).stores['Demo.b'].n,1);
    const deadline=await run(source.replace('on start machine();','on start machine() deadline 3ms;'));
    assert.equal(deadline.status,'violation');
    assert.equal(deadline.stores['Demo.b'].n,0);
    assert.ok(deadline.trace.some(e=>e.code==='Deadline'));
});
