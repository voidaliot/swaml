import assert from 'node:assert/strict';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSiteSpec } from './check-site-spec.mjs';
import { editionMentions } from './site-edition.mjs';

// Publication is an explicit allowlist. New public resources need a review here.
const required = new Set([
    'index.html', 'swaml.svg', 'swaml-white.svg',
    'downloads/controller.swaml', 'downloads/mixed-ports.svg',
    'downloads/controller-options.json', 'downloads/controller-run.json',
    'downloads/interior-light.swaml', 'downloads/interior-light-run.json',
]);
const bundle = /^assets\/[A-Za-z0-9_-]+\.(?:js|css)$/;

export async function checkSiteArtifact(root) {
    const files = new Set(), specFiles = new Set(), specDirs = new Set();
    async function visit(path = '') {
        const entry = await lstat(join(root, path));
        assert.ok(!entry.isSymbolicLink(), `Publication contains a symbolic link: ${path || '.'}`);
        // The specification reader under spec/ is checked by check-site-spec.mjs, which owns that boundary.
        const inSpec = path === 'spec' || path.startsWith('spec/');
        if (entry.isDirectory()) {
            assert.ok(['', 'assets', 'downloads'].includes(path) || inSpec, `Unexpected publication directory: ${path}`);
            if (inSpec) specDirs.add(path);
            for (const name of await readdir(join(root, path))) await visit(path ? `${path}/${name}` : name);
        } else {
            assert.ok(entry.isFile() && entry.nlink === 1, `Publication contains a linked or special file: ${path}`);
            assert.ok(required.has(path) || bundle.test(path) || inSpec, `Unexpected publication file: ${path}`);
            (inSpec ? specFiles : files).add(path);
        }
    }
    await visit();
    for (const name of required) assert.ok(files.has(name), `Missing publication file: ${name}`);
    for (const extension of ['js', 'css']) {
        assert.ok([...files].some(name => name.startsWith('assets/') && name.endsWith(`.${extension}`)), `Missing ${extension} bundle`);
    }
    const spec = await checkSiteSpec(root);
    for (const name of specFiles) assert.ok(spec.files.has(name), `Unexpected publication file: ${name}`);
    for (const name of specDirs) assert.ok(spec.dirs.has(name), `Unexpected publication directory: ${name}`);
    // The front page, its bundle and its downloads name the current standard only, and the published edition that the
    // specification reader shows (the same edition unless the standard is an unreleased candidate).
    const standard = JSON.parse(await readFile(new URL('../spec/standard.json', import.meta.url), 'utf8')).version;
    for (const name of [...files].filter(f => f === 'index.html' || f.startsWith('downloads/') || /^assets\/.*\.js$/.test(f))) {
        const other = editionMentions(await readFile(join(root, name), 'utf8')).filter(v => v !== spec.edition && v !== standard);
        assert.deepEqual(other, [], `${name} mentions another edition than ${standard}`);
    }
    return files.size + specFiles.size;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = process.argv[2] ?? fileURLToPath(new URL('../showcase/dist', import.meta.url));
    console.log(`Checked ${await checkSiteArtifact(root)} production files; no extra files or links.`);
}
