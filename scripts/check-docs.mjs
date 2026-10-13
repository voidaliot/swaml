import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../out/src/language/swaml-module.js';

const root = resolve(import.meta.dirname, '..');
async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const paths = await Promise.all(entries.filter(e => !['node_modules', '.git', 'out'].includes(e.name)).map(e => e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)]));
    return paths.flat();
}
let snippets = 0, links = 0;
for (const file of (await walk(root)).filter(f => f.endsWith('.md'))) {
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        let target = match[1].split('#')[0];
        if (!target || /^[a-z]+:\/\//i.test(target) || target.startsWith('mailto:')) continue;
        target = target.replace(/^<|>$/g, '');
        await stat(resolve(dirname(file), decodeURIComponent(target))).catch(() => { throw new Error(`Broken link in ${file}: ${target}`); });
        links++;
    }
    for (const match of text.matchAll(/```swaml\n([\s\S]*?)```/g)) {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        const doc = await parseHelper(Swaml)(match[1], { validation: true });
        if (doc.diagnostics?.some(d => d.severity === 1)) throw new Error(`Invalid SWAML snippet in ${file}: ${JSON.stringify(doc.diagnostics)}`);
        snippets++;
    }
}
const mapping = JSON.parse(await readFile(resolve(root, 'spec/kerml-mapping.json'), 'utf8'));
if (mapping.languageVersion !== '0.1' || !mapping.mapping.length) throw new Error('Invalid mapping inventory');
console.log(`Documentation checked: ${links} local links, ${snippets} SWAML snippet(s), mapping JSON.`);
