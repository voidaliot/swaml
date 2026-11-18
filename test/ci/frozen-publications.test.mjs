import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { canonicalDigest, checkFrozenPublications, frozenCopies, publishedEditions } from '../../scripts/check-frozen-publications.mjs';

const repository = fileURLToPath(new URL('../..', import.meta.url));

/** A scratch copy of the published files and frozen copies of some editions. */
async function scratch(t, editions) {
    const parent = resolve(tmpdir()), root = await mkdtemp(join(parent, 'swaml-frozen-'));
    t.after(async () => {
        assert.equal(dirname(root), parent);
        assert.ok(basename(root).startsWith('swaml-frozen-'));
        await rm(root, {recursive: true, force: true});
    });
    const copy = path => cp(join(repository, path), join(root, path), {recursive: true});
    for (const edition of editions) {
        for (const suffix of Object.keys(publishedEditions.get(edition))) await copy(`output/pdf/SWAML-${edition}-Specification.${suffix}`);
        const frozen = frozenCopies.get(edition);
        for (const path of [...Object.keys(frozen.files), ...frozen.directories]) await copy(path);
    }
    const file = path => join(root, ...path.split('/'));
    return {root, file, read: path => readFile(file(path)), write: (path, data) => writeFile(file(path), data)};
}

test('published editions and their frozen workspace copies are unchanged', async () => {
    const {pinned, copies} = await checkFrozenPublications(repository);
    assert.equal(pinned, 33);
    assert.equal(copies, 205);
});

test('a regenerated PDF fails even when its manifest and checksum are re-signed', async t => {
    const s = await scratch(t, ['2.2']);
    await checkFrozenPublications(s.root, {editions: ['2.2']});
    const base = 'output/pdf/SWAML-2.2-Specification';
    const pdf = Buffer.from(await s.read(`${base}.pdf`)); pdf[pdf.length >> 1] ^= 1;
    const digest = canonicalDigest('x.pdf', pdf);
    const manifest = JSON.parse(await s.read(`${base}.manifest.json`)); manifest.pdfSha256 = digest;
    await s.write(`${base}.pdf`, pdf);
    await s.write(`${base}.manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
    await s.write(`${base}.sha256`, `${digest}  SWAML-2.2-Specification.pdf\n`);
    await assert.rejects(checkFrozenPublications(s.root, {editions: ['2.2']}), /Published 2\.2 file changed: .*\.pdf/u);
});

test('editing a published manifest or checksum file fails', async t => {
    for (const suffix of ['manifest.json', 'sha256']) {
        const s = await scratch(t, ['2.2']), path = `output/pdf/SWAML-2.2-Specification.${suffix}`;
        await s.write(path, Buffer.concat([await s.read(path), Buffer.from('\n')]));
        await assert.rejects(checkFrozenPublications(s.root, {editions: ['2.2']}), new RegExp(`Published 2\\.2 file changed: .*${suffix.replace('.', '\\.')}`, 'u'));
    }
});

test('frozen 2.2 and 2.1 copies must equal their manifest hashes; only line endings are normalized', async t => {
    const s = await scratch(t, ['2.1', '2.2']), options = {editions: ['2.1', '2.2']};
    await checkFrozenPublications(s.root, options);
    const svg = 'docs/figures/2.2/architecture.svg';
    const original = await s.read(svg);
    await s.write(svg, original.toString('latin1').replaceAll('\n', '\r\n'));
    await checkFrozenPublications(s.root, options);
    for (const path of ['docs/SWAML-2.2-Reference.md', 'docs/RELEASE_2_2.md', svg, 'docs/notation/2.2/states.scene.json',
                        'examples/simulation/2.2/hello-trace.json', 'docs/SWAML-2.1-Reference.md', 'examples/simulation/hello-trace.json',
                        'docs/figures/2.0/architecture.png', 'docs/notation/2.0/states.svg']) {
        const raw = await s.read(path);
        await s.write(path, Buffer.concat([raw, Buffer.from(' ')]));
        await assert.rejects(checkFrozenPublications(s.root, options), new RegExp(`copy differs from its publication: ${path.replaceAll('.', '\\.')}`, 'u'));
        await s.write(path, raw);
    }
    await checkFrozenPublications(s.root, options);
});

test('a frozen copy that is removed or a file added to a frozen directory fails', async t => {
    const s = await scratch(t, ['2.2']);
    await rm(s.file('docs/notation/2.2/states.svg'));
    await assert.rejects(checkFrozenPublications(s.root, {editions: ['2.2']}), /Missing frozen publication file: docs\/notation\/2\.2\/states\.svg/u);
    const t2 = await scratch(t, ['2.2']);
    await t2.write('docs/figures/2.2/extra.svg', '<svg/>');
    await assert.rejects(checkFrozenPublications(t2.root, {editions: ['2.2']}), /File added to a frozen 2\.2 directory: docs\/figures\/2\.2\/extra\.svg/u);
});
