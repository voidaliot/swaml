import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = new URL('../', import.meta.url);
const readJson = async (root, path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

export async function readStandardVersion(root = repository) {
    const { version } = await readJson(root, 'spec/standard.json');
    assert.equal(typeof version, 'string', 'Standard version must be a string');
    assert.match(version, /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/, 'Standard version must use MAJOR.MINOR only');
    return version;
}

export async function checkStandardVersion(root = repository) {
    const version = await readStandardVersion(root);
    for (const path of ['spec/keywords.json', 'spec/notation.json', 'spec/kerml-mapping.json',
        'spec/graphical-examples.json', 'spec/modeling-overview.json', 'showcase/src/generated/model.json']) {
        const data = await readJson(root, path);
        assert.equal(data.languageVersion, version, path + ': language version differs from the standard');
        if (['spec/keywords.json', 'spec/notation.json', 'showcase/src/generated/model.json'].includes(path)) {
            assert.equal(data.edition, version, path + ': edition must use the standard MAJOR.MINOR');
        }
    }
    const pkg = await readJson(root, 'package.json'), lock = await readJson(root, 'package-lock.json');
    assert.equal(lock.version, pkg.version, 'Package and lockfile versions differ');
    assert.equal(lock.packages[''].version, pkg.version, 'Root lockfile entry differs from the package');
    return version;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    console.log('Standard ' + await checkStandardVersion() + ': MAJOR.MINOR metadata and independent package lockfile checked.');
}
