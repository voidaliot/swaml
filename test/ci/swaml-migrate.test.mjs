// swaml migrate (src/cli/migrate.ts): a dry run by default, --write, directories, release guards when -> if, refusals with
// their location, and the validation of the migrated workspace. Needs a build (out/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    // A file without 2.2 machine syntax: the current grammar's first error, with its whole message (review m7).
    assert.match(r.out, /broken\.swaml:1:51 refused: syntax error: Expecting: one of these possible Token sequences: 1\. .* but found: ';'/);
    assert.match(r.out, /dead\.swaml: the migrated text does not validate, nothing written/);
    assert.match(r.out, /needs an emitting operation/);
});

test('usage errors exit 2', () => {
    assert.equal(swaml(tmpdir()).status, 2);
    assert.equal(swaml(tmpdir(), '--force', 'x.swaml').status, 2);
    assert.equal(swaml(tmpdir(), 'does-not-exist.swaml').status, 2);
});

// ---------------------------------------------------------------- final-package review m7 to m10
test('m9: a CRLF file keeps its CRLF line ends', () => {
    const dir = workspace({ 'm.swaml': 'quoted-name.swaml22' });
    const file = join(dir, 'm.swaml');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n'));
    const r = swaml(dir, '--write', 'm.swaml');
    assert.equal(r.status, 0, r.out);
    const text = readFileSync(file, 'utf8');
    assert.ok(text.includes('state S0 {'), text);
    assert.equal(text.split('\n').length - 1, text.split('\r\n').length - 1, 'every line end is CRLF');
    assert.ok(!/\r/.test(swaml(dir, 'm.swaml').out.replace(/\r\n/g, '\n')), 'the dry run prints no stray carriage return');
});

test('m8: --write writes all files or none when a file cannot be written', () => {
    const dir = workspace({ 'a.swaml': 'quoted-name.swaml22', 'b.swaml': 'quoted-name.swaml22' });
    writeFileSync(join(dir, 'b.swaml'), readFileSync(join(dir, 'b.swaml'), 'utf8').replace('package Sw', 'package Sw2'));
    const before = readFileSync(join(dir, 'a.swaml'), 'utf8');
    chmodSync(join(dir, 'b.swaml'), 0o444);
    try {
        const r = swaml(dir, '--write', 'a.swaml', 'b.swaml');
        if (r.status === 0 && process.platform !== 'win32' && process.getuid?.() === 0)
            return; // root ignores the read-only mode
        assert.equal(r.status, 2, r.out);
        assert.match(r.out, /No file written: E(PERM|ACCES)/);
        assert.equal(readFileSync(join(dir, 'a.swaml'), 'utf8'), before, 'a.swaml is not written when b.swaml cannot be');
    }
    finally {
        chmodSync(join(dir, 'b.swaml'), 0o644);
    }
});

test('m10: one file named in two spellings is migrated once', { skip: process.platform !== 'win32' && 'case-insensitive paths only on Windows' }, () => {
    const dir = workspace({ 'a.swaml': 'quoted-name.swaml22' });
    const r = swaml(dir, 'a.swaml', 'A.SWAML');
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /1 file\(s\) would change, 0 file\(s\) have nothing to migrate/);
});

test('m7: a file with 2.2 machine syntax that the 2.2 grammar cannot read is refused at the 2.2 error, with its whole message', () => {
    const dir = workspace({ 'm.swaml': 'quoted-name.swaml22' });
    const file = join(dir, 'm.swaml');
    // An attribute named out is reserved in 2.2: the 2.2 grammar fails there, not at the machine.
    const text = readFileSync(file, 'utf8').replace('attribute r: int = 0;', 'attribute r: int = 0;\n    attribute out: int = 0;');
    writeFileSync(file, text);
    const r = swaml(dir, 'm.swaml');
    assert.equal(r.status, 1, r.out);
    const line = text.split('\n').findIndex(l => l.includes('attribute out')) + 1;
    assert.match(r.out, new RegExp(String.raw`m\.swaml:${line}:\d+ refused: syntax error that the 2\.2 grammar reports in a file with 2\.2 state-machine syntax: .*but found: 'out'`));
});

test('m11: the migration is a package export, and --language-version 2.3 names 3.0', async () => {
    const api = await import('@swaml/language/migrate');
    for (const name of ['migrateSource', 'migrateFile', 'migrateReleaseGuards', 'migrationTools', 'validateMigrated'])
        assert.equal(typeof api[name], 'function', name);
    const r = await api.migrateFile(readFileSync(fixture('quoted-name.swaml22'), 'utf8'));
    assert.deepEqual(r.refused, []);
    assert.ok(r.text.includes('state S0 {'));
    let out = '';
    try {
        execFileSync(process.execPath, [cli, '--language-version', '2.3', 'x.swaml'], { encoding: 'utf8', stdio: 'pipe' });
    }
    catch (e) {
        out = String(e.stderr);
    }
    assert.match(out, /The edition drafted as 2\.3 is swa\.ml 3\.0: pass --language-version 3\.0\./);
});
