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
    assert.equal(result.profile, 'swaml-reference/1.3'); assert.equal(result.root, 'Hello::Demo');
    assert.equal(result.stores['conversation.listener'].last, 'Hello, SWAML');
    assert.equal(result.sourceDigests[0].sha256, createHash('sha256').update(readFileSync('examples/01-hello.swaml')).digest('hex'));
});

test('simulation CLI explicitly pins language 1.3 and rejects older, future or inferred versions', () => {
    const args = ['Hello::Demo', 'examples/simulation/01-hello.json', 'examples/01-hello.swaml'];
    const selected = cli('--language-version', '1.3', ...args);
    assert.equal(selected.status, 0, selected.stderr);
    for (const version of ['1.0', '1.1', '1.2', '1.4', 'latest', '']) {
        const r = cli(`--language-version=${version}`, ...args);
        assert.equal(r.status, 2); assert.match(r.stderr, /Unsupported language version/);
    }
    assert.equal(cli('--language-version').status, 2);
    assert.equal(cli('--language-version', '1.3', '--language-version', '1.3', ...args).status, 2);
});

test('validation CLI uses the same fixed language selection', () => {
    const invoke = (...args: string[]) => spawnSync(process.execPath, ['out/src/cli/main.js', ...args], { encoding: 'utf8' });
    const accepted = invoke('--language-version=1.3', 'examples/01-hello.swaml');
    assert.equal(accepted.status, 0, accepted.stderr); assert.match(accepted.stdout, /implemented 1.3 checks/);
    const rejected = invoke('--language-version', '1.0', 'examples/01-hello.swaml');
    assert.equal(rejected.status, 2); assert.match(rejected.stderr, /Unsupported language version/);
});
test('simulation CLI reports configuration errors with status 2', () => {
    const r = cli('Unknown::Root', 'examples/simulation/01-hello.json', 'examples/01-hello.swaml');
    assert.equal(r.status, 2); assert.match(r.stderr, /Unknown root/);
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
