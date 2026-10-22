import assert from 'node:assert/strict';
import { lstat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Publication is an explicit allowlist. New public resources need a review here.
const required = new Set([
    'index.html', 'swaml.svg', 'swaml-white.svg',
    'downloads/controller.swaml', 'downloads/usage-guide.md',
    'downloads/ai-guide.md', 'downloads/swaml-author-SKILL.md',
    'downloads/swaml-validate-SKILL.md', 'downloads/mixed-ports.svg',
    'downloads/simulation.md', 'downloads/implementation-status.md',
    'downloads/controller-options.json', 'downloads/controller-run.json',
]);
const bundle = /^assets\/[A-Za-z0-9_-]+\.(?:js|css)$/;

export async function checkSiteArtifact(root) {
    const files = new Set();
    async function visit(path = '') {
        const entry = await lstat(join(root, path));
        assert.ok(!entry.isSymbolicLink(), `Publication contains a symbolic link: ${path || '.'}`);
        if (entry.isDirectory()) {
            assert.ok(['', 'assets', 'downloads'].includes(path), `Unexpected publication directory: ${path}`);
            for (const name of await readdir(join(root, path))) await visit(path ? `${path}/${name}` : name);
        } else {
            assert.ok(entry.isFile() && entry.nlink === 1, `Publication contains a linked or special file: ${path}`);
            assert.ok(required.has(path) || bundle.test(path), `Unexpected publication file: ${path}`);
            files.add(path);
        }
    }
    await visit();
    for (const name of required) assert.ok(files.has(name), `Missing publication file: ${name}`);
    for (const extension of ['js', 'css']) {
        assert.ok([...files].some(name => name.startsWith('assets/') && name.endsWith(`.${extension}`)), `Missing ${extension} bundle`);
    }
    return files.size;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = process.argv[2] ?? fileURLToPath(new URL('../showcase/dist', import.meta.url));
    console.log(`Checked ${await checkSiteArtifact(root)} production files; no extra files or links.`);
}
