import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { invalid, parse, run, valid, workspace } from './helpers.js';

test('F01 package out writes cannot bypass concurrent effects, including imported callees', async () => {
    const library = 'package Library { operation def put(out value:int) { value=9; } }';
    for (const call of ['put(n);', 'wrapper();']) {
        const r = await workspace([`package Test { import Library; component Demo { attribute n:int=0; operation wrapper(){put(n);} operation go(){${call}} schedule{on start go() concurrent;} } }`, library]);
        assert.ok(r.docs[0].diagnostics?.some(d => d.code === 'SW2006'));
    }
    const r = await run(`package Test { operation def put(out value:int){value=9;} component Demo { attribute n:int=0; operation go(){put(n);} schedule{on start go();} } }`);
    assert.equal(r.stores.Demo.n, 9);
    await valid('package Test { operation def put(out value:int){value=9;} component Demo { operation go(){var local:int=0;put(local);} schedule{on start go() concurrent;} } }');
});

test('F08 QoS capacity is a typed count, never a duration', async () => {
    const source = (capacity: string) => `package Test { import Swaml::Qos; qos def Buffer:Policy{delivery=Delivery.atMostOnce;ordering=Ordering.fifo;capacity=${capacity};overflow=Overflow.reject;requestTimeout=1ms;} }`;
    await valid(source('1'));
    for (const value of ['1ms', '0', '1.5', 'true', '"1"'])
        await invalid(source(value), 'SW2013');
});

test('F12 redefines requires a real containing component replacement', async () => {
    for (const text of ['redefines component Demo{}', 'redefines operation def go(){}', 'operation def outer(){redefines operation inner(){}}', 'operation def base(){} component Demo{operation outer(){redefines operation nested:base;}}'])
        await invalid('package Test {' + text + '}', 'SW2003');
    await valid('package Test { component def Base{operation go(){}} component Demo:Base{redefines operation go(){}} }');
});

test('F14 portable diagnostics distinguish syntax, linking and semantic failures', async () => {
    for (const [source, code, underlying] of [
        ['package Test{component Demo:Missing;}', 'SW2001', 'linking-error'],
        ['package Test{component Demo{', 'SW2000', 'parsing-error'],
        ['package Test{@}', 'SW2000', 'lexing-error'],
    ]) {
        const r = await parse(source);
        assert.ok(r.errors.some(d => d.code === code && d.data?.code === underlying && d.range));
    }
    await invalid('package Test{component Demo{attribute n:int=false;}}', 'SW2002');
    const folder = await mkdtemp(join(tmpdir(), 'swaml-diagnostics-'));
    const path = join(folder, 'unresolved.swaml');
    try {
        await writeFile(path, 'package Test{component Demo:Missing;}');
        const cli = spawnSync(process.execPath, [fileURLToPath(new URL('../../src/cli/main.js', import.meta.url)), '--json', path], { encoding: 'utf8' });
        assert.equal(cli.status, 1);
        assert.equal(JSON.parse(cli.stdout).diagnostics[0].code, 'SW2001');
    } finally { await rm(path, { force: true }); await rmdir(folder); }
});
