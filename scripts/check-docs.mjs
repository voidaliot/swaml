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
if (mapping.languageVersion !== '1.0' || mapping.schemaVersion !== '2.0') throw new Error('Invalid mapping inventory');
const grammar = await readFile(resolve(root, 'src/language/swaml.langium'), 'utf8');
const productions = new Set([...grammar.matchAll(/^(?:(?:entry|hidden|terminal|type)\s+)*([A-Za-z]\w*)(?:\s+returns\s+\w+)?\s*[:=]/gm)].map(m => m[1]));
const sources = new Set();
const kinds = new Set(['element', 'grouping', 'reference', 'value', 'lowering', 'lexical']);
const bases = new Set(['Package', 'NamespaceImport', 'DataType', 'Feature', 'FeatureTyping', 'Classifier', 'Behavior', 'Structure', 'FeatureValue', 'MetadataFeature', 'Connector', 'Step', 'Function', 'Succession', 'LiteralInteger', 'Expression']);
for (const entry of mapping.mapping) {
    if (!productions.has(entry.source) || sources.has(entry.source)) throw new Error(`Extra/duplicate mapping: ${entry.source}`);
    if (!kinds.has(entry.kind) || !Array.isArray(entry.kernel) || entry.kernel.some(k => !bases.has(k)) || !entry.semantic?.trim()) throw new Error(`Incomplete mapping: ${entry.source}`);
    if (!entry.normative?.startsWith('docs/spec/')) throw new Error(`Missing normative home: ${entry.source}`);
    await stat(resolve(root, entry.normative));
    sources.add(entry.source);
}
for (const rule of productions) if (!sources.has(rule)) throw new Error(`Unmapped grammar rule: ${rule}`);
console.log(`Documentation checked: ${links} local links, ${snippets} SWAML snippet(s), ${sources.size} grammar mappings.`);
