import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { checkStandardVersion, readStandardVersion } from '../../scripts/standard-version.mjs';

async function fixture(t) {
    const parent = resolve(tmpdir()), path = await mkdtemp(join(parent, 'swaml-version-'));
    t.after(async () => {
        assert.equal(dirname(path), parent);
        assert.ok(basename(path).startsWith('swaml-version-'));
        await rm(path, {recursive: true, force: true});
    });
    const root = pathToFileURL(path + '/');
    const put = async (file, data) => {
        const target = new URL(file, root);
        await mkdir(new URL('./', target), {recursive: true});
        await writeFile(target, JSON.stringify(data));
    };
    await put('spec/standard.json', {version: '2.0'});
    for (const file of ['spec/keywords.json', 'spec/notation.json', 'spec/kerml-mapping.json',
        'spec/graphical-examples.json', 'spec/modeling-overview.json', 'showcase/src/generated/model.json']) {
        await put(file, {languageVersion: '2.0', edition: '2.0'});
    }
    await put('package.json', {version: '2.0.7'});
    await put('package-lock.json', {version: '2.0.7', packages: {'': {version: '2.0.7'}}});
    return {root, put};
}

test('a standard keeps MAJOR.MINOR while its implementation has a patch revision', async t => {
    const {root} = await fixture(t);
    assert.equal(await checkStandardVersion(root), '2.0');
});

test('patch, draft suffix and malformed standard versions are rejected', async t => {
    const {root, put} = await fixture(t);
    for (const version of ['2.0.1', '2.1-draft', '2', 'v2.0', '02.0', '2.00', 2]) {
        await put('spec/standard.json', {version});
        await assert.rejects(readStandardVersion(root), /Standard version/);
    }
});

test('generated editions and language identifiers cannot drift from the standard', async t => {
    const {root, put} = await fixture(t);
    await put('spec/notation.json', {languageVersion: '2.0', edition: '2.0.0'});
    await assert.rejects(checkStandardVersion(root), /edition must use/);
    await put('spec/notation.json', {languageVersion: '2.0', edition: '2.0'});
    await put('showcase/src/generated/model.json', {languageVersion: '2.1', edition: '2.1'});
    await assert.rejects(checkStandardVersion(root), /language version differs/);
});

test('independent implementation revisions still require a synchronized lockfile', async t => {
    const {root, put} = await fixture(t);
    await put('package-lock.json', {version: '2.0.0', packages: {'': {version: '2.0.7'}}});
    await assert.rejects(checkStandardVersion(root), /Package and lockfile versions differ/);
    await put('package-lock.json', {version: '2.0.7', packages: {'': {version: '2.0.0'}}});
    await assert.rejects(checkStandardVersion(root), /Root lockfile entry differs/);
});
