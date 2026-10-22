import assert from 'node:assert/strict';
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { checkSiteArtifact } from '../../scripts/check-site-artifact.mjs';

async function temporary(t, prefix) {
    const parent = resolve(tmpdir()), root = await mkdtemp(join(parent, prefix));
    t.after(async () => {
        assert.equal(dirname(root), parent);
        assert.ok(basename(root).startsWith(prefix));
        await rm(root, { recursive: true, force: true });
    });
    return root;
}

async function fixture(t) {
    const root = await temporary(t, 'swaml-publication-');
    for (const directory of ['assets', 'downloads']) await mkdir(join(root, directory));
    for (const name of ['index.html', 'swaml.svg', 'swaml-white.svg', 'assets/index-test.js', 'assets/index-test.css',
        ...['controller.swaml', 'usage-guide.md', 'ai-guide.md', 'swaml-author-SKILL.md', 'swaml-validate-SKILL.md', 'mixed-ports.svg', 'simulation.md', 'implementation-status.md', 'controller-options.json', 'controller-run.json'].map(name => `downloads/${name}`)]) {
        await writeFile(join(root, name), 'public fixture');
    }
    return root;
}

test('a complete production build is accepted; missing resources fail', async t => {
    const root = await fixture(t);
    assert.equal(await checkSiteArtifact(root), 15);
    await rm(join(root, 'downloads/controller.swaml'));
    await assert.rejects(checkSiteArtifact(root), /Missing publication file/);
});

test('private files, source maps and draft images cannot enter the public artifact', async t => {
    const root = await fixture(t);
    for (const name of ['.env', 'assets/index-test.js.map', 'downloads/mockup.png']) {
        await writeFile(join(root, name), 'non-public fixture');
        await assert.rejects(checkSiteArtifact(root), /Unexpected publication file/);
        await rm(join(root, name));
    }
});

test('symbolic links and hard links cannot publish files outside the artifact', async t => {
    const root = await fixture(t), outside = await temporary(t, 'swaml-private-');
    await writeFile(join(outside, 'private.txt'), 'private fixture');
    await rm(join(root, 'index.html'));
    await link(join(outside, 'private.txt'), join(root, 'index.html'));
    await assert.rejects(checkSiteArtifact(root), /linked or special file/);
    await rm(join(root, 'index.html'));
    await writeFile(join(root, 'index.html'), 'public fixture');
    const downloads = resolve(root, 'downloads');
    assert.equal(dirname(downloads), root);
    await rm(downloads, { recursive: true });
    await symlink(outside, join(root, 'downloads'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(checkSiteArtifact(root), /symbolic link/);
});
