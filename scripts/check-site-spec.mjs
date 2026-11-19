import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { editionTree, publishedEdition, readManifest } from './site-publication.mjs';

// The browsable specification of the site (showcase/scripts/build-spec.mjs) is checked independently of its generator:
// every source of the published book has a page, every internal link and anchor resolves, no Markdown escape leaks
// into the text, pages load only their own reviewed resources, and spec/ holds nothing else.
const repo = new URL('../', import.meta.url);
const ESCAPE = /\\[!-/:-@[-`{-~]/;

export async function expectedSpecSources(repoRoot = repo) {
    // The reader shows the latest published edition, also while spec/standard.json names an unreleased candidate.
    const edition = publishedEdition(repoRoot), manifest = readManifest(repoRoot, edition);
    const sources = manifest.sources.map(s => s.path);
    // The book shows every source up to and including the license; the rest are attachments.
    return { edition, manifest, sources: sources.slice(0, sources.indexOf('LICENSE') + 1) };
}

const attributes = (html, name) => [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, 'g'))].map(m => m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
const textOf = html => html.replace(/<pre[\s\S]*?<\/pre>/g, ' ').replace(/<code[\s\S]*?<\/code>/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');

export async function checkSiteSpec(site, repoRoot = repo) {
    const { edition, manifest, sources } = await expectedSpecSources(repoRoot);
    // Repository links name files of the edition tag; without the tag in the checkout, the manifest's files.
    const tree = editionTree(repoRoot, edition, manifest);
    // Every file of the site, with its exact case, so that a link resolves the same on Windows and Linux.
    const all = new Set();
    async function walk(path) { for (const e of await readdir(join(site, path), { withFileTypes: true })) { const p = path ? `${path}/${e.name}` : e.name; if (e.isDirectory()) await walk(p); else all.add(p); } }
    await walk('');
    const spec = join(site, 'spec');
    assert.ok(existsSync(spec), 'Missing specification pages: spec/');
    const files = new Set(), dirs = new Set(['spec']), pages = new Map();
    for (const name of await readdir(spec, { withFileTypes: true })) {
        if (name.isDirectory() && name.name !== 'figures') {
            assert.match(name.name, /^[a-z0-9-]+$/, `Unexpected specification directory: spec/${name.name}`);
            const entries = await readdir(join(spec, name.name));
            assert.deepEqual(entries, ['index.html'], `spec/${name.name} must hold only its page`);
            dirs.add(`spec/${name.name}`);
            pages.set(`spec/${name.name}/index.html`, await readFile(join(spec, name.name, 'index.html'), 'utf8'));
        } else if (name.isDirectory()) {
            dirs.add('spec/figures');
            for (const figure of await readdir(join(spec, 'figures'))) {
                assert.match(figure, /^[a-z0-9.-]+\.svg$/, `Unexpected specification figure: ${figure}`);
                files.add(`spec/figures/${figure}`);
            }
        } else {
            assert.ok(['index.html', 'site.css', 'spec.js', 'search.json'].includes(name.name), `Unexpected specification file: spec/${name.name}`);
            files.add(`spec/${name.name}`);
        }
    }
    for (const required of ['spec/index.html', 'spec/site.css', 'spec/spec.js', 'spec/search.json']) assert.ok(files.has(required), `Missing ${required}`);
    pages.set('spec/index.html', await readFile(join(spec, 'index.html'), 'utf8'));
    for (const page of pages.keys()) files.add(page);

    // Every source of the book appears exactly once and nothing else does.
    const shown = [];
    for (const [page, html] of pages) {
        const meta = /<meta name="swaml-sources" content="([^"]*)">/.exec(html);
        assert.ok(meta, `${page} does not declare its sources`);
        shown.push(...meta[1].split(' ').filter(Boolean));
    }
    assert.deepEqual([...shown].sort(), [...sources].sort(), 'The specification pages must show exactly the sources of the published book');
    assert.ok(sources.every(s => tree.paths.has(s)), `A source of the book is missing from ${tree.fromTag ? 'tag v' + edition : 'the manifest'}`);

    const ids = new Map();
    for (const [page, html] of pages) {
        const list = attributes(html, 'id');
        const duplicate = list.find((id, i) => list.indexOf(id) !== i);
        assert.equal(duplicate, undefined, `Duplicate anchor #${duplicate} in ${page}`);
        ids.set(page, new Set(list));
    }
    // The single-page site renders its section anchors from the bundle.
    const bundles = (await readdir(join(site, 'assets'))).filter(f => f.endsWith('.js'));
    const appSource = (await Promise.all(bundles.map(f => readFile(join(site, 'assets', f), 'utf8')))).join('\n');
    const referenced = new Set();
    let links = 0;
    for (const [page, html] of pages) {
        assert.doesNotMatch(html, /\son[a-z]+="/i, `${page} has an inline event handler`);
        const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
        assert.equal(scripts.length, 2, `${page} must load only the theme script and spec.js`);
        assert.match(scripts[0][2], /^try\{var t=localStorage\.getItem\('swaml-theme'\)/, `${page}: unexpected inline script`);
        assert.match(scripts[1][1], /^ src="\.\.?\/spec\.js" defer$/, `${page}: unexpected script`);
        // A GFM table cell writes a literal pipe as \|, also inside a code span; the page must show the pipe alone.
        const pipe = /\\\|/.exec(html.replace(/<pre[\s\S]*?<\/pre>/g, ' '));
        assert.equal(pipe, null, `${page} shows an escaped table pipe \\| outside a code block`);
        const leaked = ESCAPE.exec(textOf(html));
        assert.equal(leaked, null, `${page} shows a Markdown escape ${leaked?.[0]} in its text`);
        for (const tag of html.matchAll(/<(link|img|script|form)\b[^>]*>/g)) for (const url of [...attributes(tag[0], 'href'), ...attributes(tag[0], 'src'), ...attributes(tag[0], 'action')])
            assert.ok(!/^[a-z]+:|^\/\//i.test(url), `${page} loads an external resource ${url}`);
        assert.doesNotMatch(html, /<(?:iframe|frame|object|embed|base|video|audio|source)\b|\ssrcset=|\sstyle="[^"]*url\(/i, `${page} embeds a resource outside the reviewed page shell`);
        for (const url of [...attributes(html, 'href'), ...attributes(html, 'src')]) {
            if (/^https?:\/\//.test(url)) {
                // Repository links open the published edition: its tag, its release asset or the repository itself.
                const repoUrl = 'https://github.com/voidaliot/swaml', tagged = `${repoUrl}/blob/v${edition}/`;
                if (url.startsWith(tagged)) {
                    const path = decodeURIComponent(url.slice(tagged.length).split('#')[0]).replace(/\/$/, '');
                    assert.ok(tree.paths.has(path), `${page} links to ${path}, which is not in ${tree.fromTag ? 'tag v' + edition : 'the ' + edition + ' manifest (fetch tag v' + edition + ' to check other files)'}`);
                } else if (url === repoUrl || url.startsWith(repoUrl + '/') || url.startsWith(repoUrl + '#')) {
                    assert.ok(url === repoUrl || url.startsWith(`${repoUrl}/releases/download/v${edition}/`), `${page} links to the repository outside the published edition: ${url}`);
                }
                continue;
            }
            assert.ok(!/^[a-z]+:/i.test(url), `${page} has an unsupported link ${url}`);
            const [path, fragment] = url.split('#');
            let target = path ? posix.normalize(posix.join(posix.dirname(page), path)) : page;
            if (!path || path.endsWith('/') || path === '.' || path === '..') target = path ? posix.join(target, 'index.html') : page;
            assert.ok(!target.startsWith('..'), `${page} links outside the site: ${url}`);
            assert.ok(all.has(target), `${page} has a broken link ${url}`);
            if (target.startsWith('spec/figures/')) referenced.add(target);
            if (fragment !== undefined) {
                if (pages.has(target)) assert.ok(ids.get(target).has(decodeURIComponent(fragment)), `${page} has a broken anchor ${url}`);
                else if (target === 'index.html') assert.ok(new RegExp(`\\bid:[\`"']${fragment.replace(/[^\w-]/g, '')}[\`"']`).test(appSource), `${page} links to a missing site section ${url}`);
                else assert.fail(`${page} links to an anchor in a file without anchors: ${url}`);
            }
            links++;
        }
    }
    // The front page links into the specification with literal ./spec/ paths (from its source and its site data).
    let frontLinks = 0;
    for (const m of new Set([...appSource.matchAll(/["'`](\.\/spec\/[^"'`\s]*)["'`]/g)].map(m => m[1]))) {
        const [path, fragment] = m.split('#');
        const target = path.endsWith('/') ? posix.normalize(path) + 'index.html' : posix.normalize(path);
        assert.ok(all.has(target), `The front page links to a missing specification page ${m}`);
        if (fragment) assert.ok(ids.get(target)?.has(fragment), `The front page links to a missing specification anchor ${m}`);
        frontLinks++;
    }
    assert.ok(frontLinks > 0, 'The front page does not link to the specification');
    for (const figure of [...files].filter(f => f.startsWith('spec/figures/'))) assert.ok(referenced.has(figure), `Unreferenced specification figure ${figure}`);
    const search = JSON.parse(await readFile(join(spec, 'search.json'), 'utf8'));
    assert.ok(Array.isArray(search) && search.length > 0, 'Empty specification search index');
    for (const entry of search) {
        const [path, fragment] = entry.u.split('#');
        const page = `spec/${path}index.html`;
        assert.ok(pages.has(page) && ids.get(page).has(fragment), `Search entry points to a missing section: ${entry.u}`);
        assert.ok(typeof entry.t === 'string' && typeof entry.x === 'string' && typeof entry.c === 'string', `Malformed search entry ${entry.u}`);
    }
    return { edition, files, dirs, pages: pages.size, links, frontLinks, fromTag: tree.fromTag, search: search.length, sources: sources.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const site = process.argv[2] ?? fileURLToPath(new URL('../showcase/dist', import.meta.url));
    const result = await checkSiteSpec(site);
    console.log(`Checked ${result.pages} specification pages of ${result.edition} (repository links against ${result.fromTag ? 'the tag' : 'the manifest'}): ${result.sources} book sources, ${result.links} internal links and anchors, ${result.frontLinks} front-page links, ${result.search} search entries.`);
}
