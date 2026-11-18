// Tripwire against re-recorded compatibility fixtures: every fixture file of the 2.2 compatibility gates
// names the same recording commit, the 3.1.0 implementation of standard 2.2. Source CI fetches that one
// commit (depth 1) next to the release tags; it is then checked for package version 3.1.0, the 2.2
// edition and the kept grammar. Ancestry needs history, so it is checked only in a full clone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RECORDED = '213f583b14bf9808429b04f7252732a118015576';
const repository = fileURLToPath(new URL('../../', import.meta.url));
const fixture = name => JSON.parse(readFileSync(new URL(`../../test/fixtures/compatibility-2-2/${name}`, import.meta.url), 'utf8'));
const files = ['ast.json', 'resolution.json', 'behaviour.json', 'behaviour-supplement.json'];
const git = (...args) => execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });

test('every compatibility fixture names the 3.1.0 recording commit', () => {
    for (const name of files) {
        const { recordedWith } = fixture(name);
        assert.equal(recordedWith.commit, RECORDED, `${name}: recording commit`);
        assert.equal(recordedWith.implementation, '3.1.0', `${name}: implementation`);
        assert.equal(recordedWith.languageVersion, '2.2', `${name}: language version`);
        assert.equal(recordedWith.profile, 'swaml-reference/2.2', `${name}: profile`);
    }
});

test('the recording commit is the 3.1.0 implementation of 2.2 and an ancestor of HEAD', t => {
    try { git('cat-file', '-e', `${RECORDED}^{commit}`); }
    catch { return t.skip(`Recording commit ${RECORDED} is not available locally; fetch it to compare`); }
    assert.equal(JSON.parse(git('show', `${RECORDED}:package.json`)).version, '3.1.0');
    assert.match(git('show', `${RECORDED}:src/language/edition.ts`), /SWAML_REFERENCE_PROFILE = 'swaml-reference\/2\.2'/u);
    const grammar = git('show', `${RECORDED}:src/language/swaml.langium`).replaceAll('\r\n', '\n');
    assert.equal(createHash('sha256').update(grammar, 'utf8').digest('hex'), fixture('ast.json').grammarSha256, 'kept 2.2 grammar');
    if (git('rev-parse', '--is-shallow-repository').trim() === 'true')
        return t.diagnostic('Shallow clone: the ancestry of the recording commit is not checked');
    assert.doesNotThrow(() => git('merge-base', '--is-ancestor', RECORDED, 'HEAD'), `${RECORDED} is an ancestor of HEAD`);
});
