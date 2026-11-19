// swaml migrate (src/cli/migrate.ts): a dry run by default, --write, directories, release guards when -> if, refusals with
// their location, and the validation of the migrated workspace. Needs a build (out/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../out/src/cli/main.js', import.meta.url));
const fixture = name => fileURLToPath(new URL(`../fixtures/migration/${name}`, import.meta.url));
const swaml = (cwd, ...args) => {
    try {
        return { status: 0, out: execFileSync(process.execPath, [cli, 'migrate', ...args], { cwd, encoding: 'utf8' }) };
    }
    catch (e) {
        return { status: e.status, out: String(e.stdout) + String(e.stderr) };
    }
};
const workspace = files => {
    const dir = mkdtempSync(join(tmpdir(), 'swaml-migrate-'));
    for (const [name, from] of Object.entries(files)) {
        mkdirSync(join(dir, name, '..'), { recursive: true });
        if (from.startsWith('package'))
            writeFileSync(join(dir, name), from);
        else
            copyFileSync(fixture(from), join(dir, name));
    }
    return dir;
};
const plain = 'package P {\n  component def C {\n    attribute n: uint = 0;\n    operation run() { n = 1; }\n    schedule { on start run(); }\n  }\n}\n';

test('a dry run prints the machines, their reports and the changed lines, writes nothing and exits 0', () => {
    const dir = workspace({ 'm.swaml': 'quoted-name.swaml22', 'plain.swaml': plain });
    const before = readFileSync(join(dir, 'm.swaml'), 'utf8');
    const r = swaml(dir, 'm.swaml', 'plain.swaml');
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /m\.swaml: 1 state machine\(s\)/);
    assert.match(r.out, /10:7 Sw::M\.run: 2 state\(s\)/);
    assert.match(r.out, /renamed bindings: S0: c -> a/);
    assert.match(r.out, /-\s+initial S0;/);
    assert.match(r.out, /\+\s+} else if \(a > b\) \{/);
    assert.match(r.out, /Dry run: 1 file\(s\) would change, 1 file\(s\) have nothing to migrate; nothing written/);
    assert.equal(readFileSync(join(dir, 'm.swaml'), 'utf8'), before);
});

test('--write writes the migrated text, which checks without errors; a second run has nothing to migrate', () => {
    const dir = workspace({ 'm.swaml': 'quoted-name.swaml22' });
    const r = swaml(dir, '--write', 'm.swaml');
    assert.equal(r.status, 0, r.out);
    const text = readFileSync(join(dir, 'm.swaml'), 'utf8');
    assert.ok(!text.includes('initial S0;') && text.includes('state S0 {'), text);
    assert.doesNotThrow(() => execFileSync(process.execPath, [cli, join(dir, 'm.swaml')], { encoding: 'utf8' }));
    const again = swaml(dir, 'm.swaml');
    assert.equal(again.status, 0, again.out);
    assert.match(again.out, /0 file\(s\) would change, 1 file\(s\) have nothing to migrate/);
});

test('release guards written when (g) become if (g), every one of them, and the result is the current example 51', () => {
    const dir = workspace({ 'g.swaml': 'release-guards.swaml23' });
    const r = swaml(dir, '--write', 'g.swaml');
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /63:45 release guard when \(…\) -> if \(…\)/);
    assert.match(r.out, /64:42 release guard when \(…\) -> if \(…\)/);
    assert.equal(readFileSync(join(dir, 'g.swaml'), 'utf8'), readFileSync(new URL('../../examples/51-com-main-release-guard.swaml', import.meta.url), 'utf8'));
});

test('a directory is walked for .swaml files; a refused machine is reported at its line and column, exit 1, nothing written', () => {
    const dir = workspace({ 'a/ok.swaml': 'quoted-name.swaml22', 'b/port.swaml': 'port-like-binding.swaml22', 'notes.txt': plain });
    const before = readFileSync(join(dir, 'a/ok.swaml'), 'utf8');
    const r = swaml(dir, '--write', '.');
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /b[\\/]port\.swaml:\d+:\d+ refused: Sw::M\.run: the binding \w+ of S0 is written before '\.'/);
    assert.match(r.out, /No file written/);
    assert.equal(readFileSync(join(dir, 'a/ok.swaml'), 'utf8'), before, 'nothing is written when one file is refused');
    // The refusal alone fails the run (the two fixtures above also share a package name).
    const alone = swaml(dir, join('b', 'port.swaml'));
    assert.equal(alone.status, 1, alone.out);
    assert.match(alone.out, /refused: .*No file written/s);
});

test('a source that no grammar reads is refused at its first syntax error; a migrated file that does not validate is reported', () => {
    const dir = workspace({ 'broken.swaml': 'package Z { component def C { operation f() { x = ; } } }\n', 'dead.swaml': 'dead-only-publish.swaml22' });
    const r = swaml(dir, 'broken.swaml', 'dead.swaml');
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /broken\.swaml:1:51 refused: syntax error that is not 2\.2 state-machine syntax: Expecting: one of these possible Token sequences:$/m);
    assert.match(r.out, /dead\.swaml: the migrated text does not validate, nothing written/);
    assert.match(r.out, /needs an emitting operation/);
});

test('usage errors exit 2', () => {
    assert.equal(swaml(tmpdir()).status, 2);
    assert.equal(swaml(tmpdir(), '--force', 'x.swaml').status, 2);
    assert.equal(swaml(tmpdir(), 'does-not-exist.swaml').status, 2);
});
