import assert from 'node:assert/strict';
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { checkSiteArtifact } from '../../scripts/check-site-artifact.mjs';
import { expectedSpecSources } from '../../scripts/check-site-spec.mjs';

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
    for (const directory of ['assets', 'downloads', 'spec']) await mkdir(join(root, directory));
    for (const name of ['index.html', 'swaml.svg', 'swaml-white.svg', 'assets/index-test.js', 'assets/index-test.css',
        ...['controller.swaml', 'mixed-ports.svg', 'controller-options.json', 'controller-run.json', 'interior-light.swaml', 'interior-light-run.json'].map(name => `downloads/${name}`),
        'spec/site.css', 'spec/spec.js']) {
        await writeFile(join(root, name), 'public fixture');
    }
    await writeFile(join(root, 'assets/index-test.js'), 'const links={spec:"./spec/",top:"./spec/#top"};');
    await writeFile(join(root, 'spec/search.json'), JSON.stringify([{ u: '#top', t: 'Top', c: 'Start', x: 'text' }]));
    await writeFile(join(root, 'spec/index.html'), await specPage());
    return root;
}

// A minimal specification start page that declares every source of the published book.
async function specPage(body = '<h1 id="top">Specification</h1><p><a href="#top">top</a></p>') {
    const { sources } = await expectedSpecSources();
    return `<!doctype html><html><head><meta name="swaml-sources" content="${sources.join(' ')}"><script>try{var t=localStorage.getItem('swaml-theme')}catch{}</script><link rel="stylesheet" href="./site.css"></head><body>${body}<script src="./spec.js" defer></script></body></html>`;
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

test('specification pages: every book source, resolved anchors, no Markdown escapes, no extra files', async t => {
    const root = await fixture(t);
    await writeFile(join(root, 'spec/index.html'), await specPage('<h1 id="top">x</h1><a href="#missing">x</a>'));
    await assert.rejects(checkSiteArtifact(root), /broken anchor/);
    await writeFile(join(root, 'spec/index.html'), await specPage('<h1 id="top">x</h1><td><code>a \\| b</code></td>'));
    await assert.rejects(checkSiteArtifact(root), /escaped table pipe/);
    await writeFile(join(root, 'spec/index.html'), (await specPage()).replace(' LICENSE"', '"'));
    await assert.rejects(checkSiteArtifact(root), /exactly the sources of the published book/);
    await writeFile(join(root, 'spec/index.html'), await specPage());
    await writeFile(join(root, 'spec/notes.txt'), 'draft');
    await assert.rejects(checkSiteArtifact(root), /Unexpected specification file/);
});

test('the front page and its downloads name the current edition only', async t => {
    const root = await fixture(t);
    await writeFile(join(root, 'downloads/mixed-ports.svg'), '<svg><title>swa.ml 2.1 original notation</title></svg>');
    await assert.rejects(checkSiteArtifact(root), /mentions another edition/);
});

test('front-page specification links, repository links and link case are checked', async t => {
    const root = await fixture(t);
    await writeFile(join(root, 'assets/index-test.js'), 'const m={migration:"./spec/migration-9-9/"};');
    await assert.rejects(checkSiteArtifact(root), /missing specification page/);
    await writeFile(join(root, 'assets/index-test.js'), 'const m={spec:"./spec/",note:"the swa.ml 2.1 edition"};');
    await assert.rejects(checkSiteArtifact(root), /mentions another edition/);
    await writeFile(join(root, 'assets/index-test.js'), 'const m={spec:"./spec/"};');
    await writeFile(join(root, 'spec/index.html'), await specPage('<h1 id="top">x</h1><a href="https://github.com/voidaliot/swaml/blob/main/README.md">x</a>'));
    await assert.rejects(checkSiteArtifact(root), /outside the published edition/);
    await writeFile(join(root, 'spec/index.html'), await specPage('<h1 id="top">x</h1><a href="./Site.css">x</a>'));
    await assert.rejects(checkSiteArtifact(root), /broken link/);
    await writeFile(join(root, 'spec/index.html'), await specPage('<h1 id="top">x</h1><iframe src="x"></iframe>'));
    await assert.rejects(checkSiteArtifact(root), /embeds a resource/);
});
