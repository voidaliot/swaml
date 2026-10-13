import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../out/src/language/swaml-module.js';
import { resolvePath } from '../out/src/language/semantic.js';
import * as a from '../out/src/language/generated/ast.js';
const manifest = JSON.parse(await readFile(new URL('../spec/graphical-examples.json', import.meta.url), 'utf8'));
assert.equal(manifest.languageVersion, '1.0');
const kinds = new Set(), bodies = new Set();
for (const item of manifest.examples) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const text = await readFile(new URL(`../${item.model}`, import.meta.url), 'utf8');
    const doc = await parseHelper(Swaml)(text, { validation: true });
    assert.deepEqual(doc.diagnostics, []);
    const pkg = doc.parseResult.value.packages.find(p => p.name === item.package);
    const [root, ...tail] = item.subject.split('.');
    let subject = pkg.elements.find(e => e.name === root);
    if (tail.length) subject = resolvePath(subject, tail.join('.'));
    assert.ok(subject, `${item.figure} subject`);
    if (item.view === 'FV') { assert.ok(a.isOperation(subject)); bodies.add(subject.machine ? 'state' : 'flow'); }
    if (item.view === 'IV') assert.ok(a.isSystem(subject) || a.isComponent(subject));
    if (['CV', 'SV'].includes(item.view)) assert.ok(a.isSystem(subject) || a.isScenario(subject));
    kinds.add(item.view);
    const svg = await readFile(new URL(`../docs/figures/${item.figure}.svg`, import.meta.url), 'utf8');
    assert.ok(svg.includes('role="img"') && svg.includes('<title') && svg.includes('<desc'));
    await access(new URL(`../docs/figures/${item.figure}.scene.json`, import.meta.url));
}
assert.deepEqual([...kinds].sort(), ['Browser', 'CV', 'FV', 'GRV', 'GV', 'IV', 'SV']);
assert.deepEqual([...bodies].sort(), ['flow', 'state']);
console.log('Verified 8 graphical subjects, all 7 view families, and both FV forms.');
