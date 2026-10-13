import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const cli = (...args: string[]) => spawnSync(process.execPath, ['out/src/cli/simulate.js', ...args], { encoding: 'utf8' });
test('simulation CLI emits standalone JSON with exact source digests', () => {
    const r = cli('Hello::Demo', 'examples/simulation/01-hello.json', 'examples/01-hello.swaml');
    assert.equal(r.status, 0, r.stderr);
    const result = JSON.parse(r.stdout);
    assert.equal(result.stores['conversation.listener'].last, 'Hello, SWAML');
    assert.equal(result.sourceDigests[0].sha256, createHash('sha256').update(readFileSync('examples/01-hello.swaml')).digest('hex'));
});
test('simulation CLI reports configuration errors with status 2', () => {
    const r = cli('Unknown::System', 'examples/simulation/01-hello.json', 'examples/01-hello.swaml');
    assert.equal(r.status, 2); assert.match(r.stderr, /Unknown system/);
});
test('simulation CLI reports failed behavior with status 1 and retains its trace', () => {
    const directory = mkdtempSync(join(tmpdir(), 'swaml-simulation-'));
    try {
        const source = readFileSync('examples/01-hello.swaml', 'utf8').replace('send output.text("Hello, SWAML");', 'send output.text("Hello, SWAML"); assert false;');
        const file = join(directory, 'failure.swaml'); writeFileSync(file, source);
        const r = cli('Hello::Demo', 'examples/simulation/01-hello.json', file);
        assert.equal(r.status, 1, r.stderr); assert.equal(JSON.parse(r.stdout).outcome, 'failed');
        assert.ok(JSON.parse(r.stdout).trace.some((e: { code?: string }) => e.code === 'Assertion'));
    } finally { rmSync(directory, { recursive: true, force: true }); }
});
