// Tripwire against re-recorded or hand-edited compatibility fixtures. Every recorded fixture file of the 2.2
// compatibility gates is pinned by its SHA-256 (LF line endings) and names the same recording commit, the
// 3.1.0 implementation of standard 2.2; amendments.json is the only fixture file that may change, in a
// reviewed PR (see docs/RELEASE_2_3.md). Source CI fetches the recording commit (depth 1) next to the
// release tags; it is then checked for package version 3.1.0, the 2.2 edition and the kept grammar. Under CI
// a missing commit fails. Ancestry needs history that the shallow CI clone does not have, so it is checked
// only in a full clone: the commit contents and the pinned fixture digests are the guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RECORDED = '213f583b14bf9808429b04f7252732a118015576';
const PINNED = {
    'swaml-2.2.langium': '8197bdb5c4f233b002cc9d404d64fb604583ba1c36e1b13aeebc98d88ea867d7',
    'ast.json': 'f64e004cbc23db5d62a71e53841b5965ad3c5f0ad62bf44703fc7848de0bf50a',
    'resolution.json': '5e9d07ea3b6e4a4487c1c5a0f956d652d228b1a1b1435c6174d7eddab24f3525',
    'projection.json': '20924dacad192529be9250af4dd46543399e99404c04f7072f8cff025e6909f9',
    'behaviour.json': '813ff3b69d350724907ba52614ac29d3807d041140ef2fa378eb8022b501254c',
    'behaviour-supplement.json': '1e08e460a49559a46cf859ccadb76994a776d9c42c6f3b7bf0f7f6de12689025',
};
const repository = fileURLToPath(new URL('../../', import.meta.url));
const text = name => readFileSync(new URL(`../../test/fixtures/compatibility-2-2/${name}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const fixture = name => JSON.parse(text(name));
const git = (...args) => execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });

test('every recorded compatibility fixture keeps its pinned bytes', () => {
    for (const [name, digest] of Object.entries(PINNED))
        assert.equal(createHash('sha256').update(text(name), 'utf8').digest('hex'), digest, `${name} changed; recorded fixtures are never edited (amend through amendments.json)`);
    assert.ok(Array.isArray(fixture('amendments.json').amendments), 'amendments.json holds an amendments array');
});

test('every compatibility fixture names the 3.1.0 recording commit', () => {
    for (const name of Object.keys(PINNED).filter(n => n.endsWith('.json'))) {
        const { recordedWith } = fixture(name);
        assert.equal(recordedWith.commit, RECORDED, `${name}: recording commit`);
        assert.equal(recordedWith.implementation, '3.1.0', `${name}: implementation`);
        assert.equal(recordedWith.languageVersion, '2.2', `${name}: language version`);
        assert.equal(recordedWith.profile, 'swaml-reference/2.2', `${name}: profile`);
    }
});

test('the recording commit is the 3.1.0 implementation of 2.2', t => {
    try { git('cat-file', '-e', `${RECORDED}^{commit}`); }
    catch {
        if (process.env.CI)
            assert.fail(`Recording commit ${RECORDED} is missing; source CI fetches it next to the release tags`);
        return t.skip(`Recording commit ${RECORDED} is not available locally; fetch it to compare`);
    }
    assert.equal(JSON.parse(git('show', `${RECORDED}:package.json`)).version, '3.1.0');
    assert.match(git('show', `${RECORDED}:src/language/edition.ts`), /SWAML_REFERENCE_PROFILE = 'swaml-reference\/2\.2'/u);
    const grammar = git('show', `${RECORDED}:src/language/swaml.langium`).replaceAll('\r\n', '\n');
    assert.equal(createHash('sha256').update(grammar, 'utf8').digest('hex'), fixture('ast.json').grammarSha256, 'kept 2.2 grammar');
    if (git('rev-parse', '--is-shallow-repository').trim() === 'true')
        return t.diagnostic('Shallow clone: the ancestry of the recording commit is not checked');
    assert.doesNotThrow(() => git('merge-base', '--is-ancestor', RECORDED, 'HEAD'), `${RECORDED} is an ancestor of HEAD`);
});

// The extended 2.2 fixture (WP1 review F3): further 2.2 sources outside the corpus and their results,
// recorded once from the same 3.1.0 commit by scripts/compatibility-2-2-extended.mjs record. Pinned separately.
const EXTENDED = {
    'models.json': '172d127679a46949bf291bcee1ec3d2ccd630ed603cdb111eb3a2b3e6a837c22',
    'recorded.json': 'a213675d17998ffed2f8240320994a9e21c3e9f218a31df526cfac721b7d717a',
    // The WP2 set: 2.2 sources with view, state, in and out in their keyword roles next to names.
    'models-wp2.json': '6bc9bde970d7818bc235bd24f003e54ffd8d0a83c9ff96c11c2c0ea58d7d9a17',
    'recorded-wp2.json': 'ade2b5c1e8423bbb8be26c59e459ffa6a8cfb6d0add2f6e3cb48b1e6418d84be',
    // The WP2 review set: 2.2 sources whose diagnostics spell a quoted contextual word.
    'models-wp2b.json': '80173cb5e9945077c896e9f18eaebd2282a041782dc59c82628433829d2bf665',
    'recorded-wp2b.json': '3a6881e47c39199378e44ab140a699e105faf8b6fb476f53cb2c1b1ce1b752a8',
    // The WP3 set: 2.2 sources that declare, import or use the names of the 2.3 library packages (WP3-L04).
    'models-wp3.json': '192203cced460e3d49a36f187930128a263eea58f9d5c5aa9aeda342071d1201',
    'recorded-wp3.json': 'c03bed8354e225fc0d463e7e8e6d69202a39be3ba329ebb3dfdb669739d180ab',
};
test('the extended 2.2 fixture keeps its pinned bytes and names the 3.1.0 recording commit', () => {
    const extended = name => readFileSync(new URL(`../../test/fixtures/compatibility-2-2-extended/${name}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    for (const [name, digest] of Object.entries(EXTENDED))
        assert.equal(createHash('sha256').update(extended(name), 'utf8').digest('hex'), digest, `${name} changed; the extended fixture is recorded once and never edited`);
    for (const name of ['recorded.json', 'recorded-wp2.json', 'recorded-wp2b.json', 'recorded-wp3.json']) {
        const { recordedWith } = JSON.parse(extended(name));
        assert.deepEqual([recordedWith.commit, recordedWith.implementation, recordedWith.languageVersion, recordedWith.profile], [RECORDED, '3.1.0', '2.2', 'swaml-reference/2.2'], name);
    }
});
