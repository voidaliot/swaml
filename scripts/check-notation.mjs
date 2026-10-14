import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { AstUtils, EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices, SWAML_LANGUAGE_VERSION } from '../out/src/language/swaml-module.js';

// Check the semantic inventory independently of the renderer. A sample is a
// token-exact fragment of a named element in a complete validated model, never
// a claim that a deliberately abbreviated graphical label is standalone code.
const root = resolve(import.meta.dirname, '..');
const sourceOnly = process.argv.includes('--source-only');
assert(process.argv.slice(2).every(a => a === '--source-only'), 'Only --source-only is supported.');
const read = path => readFile(resolve(root, path), 'utf8');
const inventory = JSON.parse(await read('spec/notation.json'));
const grammar = await read('src/language/swaml.langium');
const keywordIndex = JSON.parse(await read('spec/keywords.json'));
const packageInfo = JSON.parse(await read('package.json'));
const keywords = new Set([...grammar.matchAll(/'([A-Za-z_]\w*)'/g)].map(m => m[1]));
const productions = new Set([...grammar.matchAll(/^(?:(?:entry|hidden|terminal|type)\s+)*([A-Za-z]\w*)(?:\s+returns\s+\w+)?\s*[:=]/gm)].map(m => m[1]));
const kinds = new Set(['node', 'edge', 'compartment', 'label', 'projection']);
const views = new Set(['Browser', 'GV', 'IV', 'CV', 'SV', 'GRV', 'FV']);
const templates = new Set(['package', 'classifier', 'component', 'unit', 'usage', 'interface', 'member', 'port', 'connection', 'delegation', 'edge', 'operation', 'flow', 'decision', 'loop', 'request', 'return', 'state', 'initial', 'final', 'transition', 'trigger', 'constraint', 'node', 'deployment', 'case', 'lifeline', 'message', 'browser', 'gv', 'iv', 'cv', 'sv', 'grv', 'fv']);
const roles = new Set(['sender', 'receiver', 'client', 'server', 'publisher', 'subscriber', 'provides', 'requires']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const exactSet = (actual, expected, label) => assert.deepEqual([...actual].sort(), [...expected].sort(), label);
const unique = (items, label) => assert.equal(new Set(items).size, items.length, `Duplicate ${label}`);

function checkInventory(doc) {
    assert.equal(doc.schemaVersion, '1.0');
    assert.equal(doc.languageVersion, SWAML_LANGUAGE_VERSION);
    assert.equal(doc.edition, packageInfo.version);
    assert.equal(doc.style.semanticColor, false, 'Canonical meaning must not rely on color.');
    assert(Array.isArray(doc.concepts) && doc.concepts.length > 0);
    unique(doc.concepts.map(c => c.id), 'concept ID');
    const byId = new Map(doc.concepts.map(c => [c.id, c]));
    for (const c of doc.concepts) {
        assert(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(c.id), `Invalid concept ID: ${c.id}`);
        for (const key of ['title', 'concern', 'description', 'syntax', 'context']) assert(nonempty(c[key]), `${c.id}: missing ${key}`);
        assert(kinds.has(c.kind), `${c.id}: unknown graphical kind`);
        assert(Array.isArray(c.rules) && c.rules.length && c.rules.every(nonempty), `${c.id}: missing normative geometry rules`);
        assert(Array.isArray(c.views) && c.views.length && c.views.every(v => views.has(v)), `${c.id}: unknown/missing view`);
        unique(c.views, `${c.id} view`);
        for (const [key, universe] of [['keywords', keywords], ['productions', productions]]) {
            assert(Array.isArray(c[key]), `${c.id}: missing ${key}`);
            unique(c[key], `${c.id} ${key}`);
            assert(c[key].every(x => universe.has(x)), `${c.id}: unknown ${key}`);
        }
        assert(nonempty(c.source?.model) && nonempty(c.source?.path), `${c.id}: missing semantic context`);
        const modelPath = relative(root, resolve(root, c.source.model)).split(sep).join('/');
        assert(modelPath.startsWith('examples/') && modelPath.endsWith('.swaml'), `${c.id}: context must be a repository example`);
        assert(templates.has(c.drawing?.template), `${c.id}: unsupported drawing template`);
        assert(Array.isArray(c.drawing.header) && c.drawing.header.length && c.drawing.header.every(nonempty), `${c.id}: missing drawing header`);
        assert(Array.isArray(c.drawing.lines) && c.drawing.lines.every(nonempty), `${c.id}: invalid drawing lines`);
        if (c.drawing.role) assert(roles.has(c.drawing.role), `${c.id}: invalid port role`);
        if (c.drawing.direction) assert(['forward', 'reverse'].includes(c.drawing.direction));
    }
    exactSet(new Set(doc.concepts.flatMap(c => c.views)), views, 'All seven view families must have notation.');
    exactSet(new Set(doc.concepts.filter(c => c.drawing.template === 'port').map(c => c.drawing.role)), roles, 'All eight port roles require explicit notation.');
    for (const [key, universe] of [['keywords', keywords], ['productions', productions]]) {
        const entries = doc.coverage[key];
        assert(Array.isArray(entries), `Missing ${key} coverage`);
        unique(entries.map(e => e.term), `${key} coverage`);
        exactSet(new Set(entries.map(e => e.term)), universe, `${key} coverage must exactly equal the grammar.`);
        for (const e of entries) {
            assert(['glyph', 'label', 'text-only'].includes(e.mode), `${e.term}: unknown representation mode`);
            assert(nonempty(e.rationale), `${e.term}: missing representation rationale`);
            assert(Array.isArray(e.concepts), `${e.term}: missing concept links`);
            unique(e.concepts, `${e.term} concept link`);
            assert(e.concepts.every(id => byId.has(id)), `${e.term}: nonexistent concept link`);
            if (e.mode !== 'text-only') {
                assert(e.concepts.length > 0, `${e.term}: graphical term has no concept`);
                assert(e.concepts.every(id => byId.get(id)[key].includes(e.term)), `${e.term}: concept does not declare this term`);
                for (const c of doc.concepts.filter(c => c[key].includes(e.term))) assert(e.concepts.includes(c.id), `${e.term}: missing reverse link to ${c.id}`);
                const hasGlyph = e.concepts.some(id => ['node', 'edge', 'projection'].includes(byId.get(id).kind));
                assert.equal(e.mode, hasGlyph ? 'glyph' : 'label', `${e.term}: representation does not match its concept kind`);
            }
        }
    }
}
checkInventory(inventory);
exactSet(new Set(keywordIndex.entries.map(e => e.keyword)), keywords, 'Keyword reference and notation must cover the same vocabulary.');

const documents = new Map();
async function contextDocument(path) {
    if (!documents.has(path)) {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        const doc = await parseHelper(Swaml)(await read(path), { validation: true });
        assert.equal(doc.parseResult.lexerErrors.length, 0, `${path}: lexical error`);
        assert.equal(doc.parseResult.parserErrors.length, 0, `${path}: parser error`);
        assert.deepEqual(doc.diagnostics?.filter(d => d.severity === 1) ?? [], [], `${path}: invalid semantic fixture`);
        documents.set(path, { doc, lexer: Swaml.parser.Lexer });
    }
    return documents.get(path);
}
function namedChildren(node) {
    const found = [];
    for (const child of AstUtils.streamContents(node)) {
        if (typeof child.name === 'string') found.push(child);
        else found.push(...namedChildren(child));
    }
    return found;
}
function anchor(model, path) {
    const [namespace, ...tail] = path.split('::');
    assert(tail.length <= 1, `${path}: unsupported context path`);
    let node = model.packages.find(p => p.name === namespace);
    assert(node, `${path}: package does not exist`);
    for (const segment of (tail[0] ?? '').split('.').filter(Boolean)) {
        const matches = namedChildren(node).filter(n => n.name === segment);
        assert.equal(matches.length, 1, `${path}: context segment ${segment} is absent or ambiguous`);
        node = matches[0];
    }
    return node;
}
async function checkContext(c) {
    const { doc, lexer } = await contextDocument(c.source.model);
    const node = anchor(doc.parseResult.value, c.source.path);
    const tokenize = text => {
        const lexed = lexer.tokenize(text);
        assert.equal(lexed.errors.length, 0, `${c.id}: invalid fragment token`);
        return lexed.tokens.map(t => t.image);
    };
    const sample = tokenize(c.syntax), actual = tokenize(node.$cstNode.text);
    assert(sample.length > 0);
    assert(actual.some((_, i) => sample.every((token, j) => token === actual[i + j])), `${c.id}: textual sample is not a token-exact fragment of ${c.source.path} (${c.source.model})`);
}
for (const c of inventory.concepts) await checkContext(c);

// Small fault-injection regressions prove that removing coverage or breaking a
// semantic anchor cannot accidentally turn a catalogue omission into success.
const mutations = [
    d => d.concepts.push(structuredClone(d.concepts[0])),
    d => d.coverage.keywords.pop(),
    d => d.coverage.productions.pop(),
    d => { d.coverage.keywords[0].concepts = ['missing-concept']; },
    d => { d.coverage.productions.find(e => e.mode === 'text-only').rationale = ''; },
    d => { d.concepts[0].views = ['GEV']; }
];
for (const mutate of mutations) {
    const broken = structuredClone(inventory); mutate(broken);
    assert.throws(() => checkInventory(broken));
}
await assert.rejects(() => checkContext({ ...inventory.concepts[0], source: { ...inventory.concepts[0].source, path: 'Missing' } }));
await assert.rejects(() => checkContext({ ...inventory.concepts[0], syntax: 'package NonexistentNotationContext' }));

if (!sourceOnly) {
    const expectedAssets = inventory.concepts.flatMap(c => ['svg', 'png', 'scene.json'].map(ext => `${c.id}.${ext}`));
    exactSet(new Set(await readdir(resolve(root, 'docs/notation'))), new Set(expectedAssets), 'Canonical asset directory must contain exactly one SVG/PNG/scene triple per concept.');
    const catalog = await read('docs/GRAPHICAL_CATALOG.md');
    const finite = n => typeof n === 'number' && Number.isFinite(n);
    const monochrome = color => color === 'none' || color === 'white' || color === 'black' || /^#([0-9a-f]{2})\1\1$/i.test(color ?? '');
    for (const c of inventory.concepts) {
        const base = `docs/notation/${c.id}`;
        const [svg, sceneText, png] = await Promise.all([read(`${base}.svg`), read(`${base}.scene.json`), readFile(resolve(root, `${base}.png`))]);
        const scene = JSON.parse(sceneText);
        assert.equal(scene.title, c.title, `${c.id}: stale scene title`);
        assert.equal(scene.description, c.description, `${c.id}: stale scene description`);
        assert(finite(scene.width) && finite(scene.height) && scene.width > 0 && scene.height > 0);
        const point = (x, y) => assert(finite(x) && finite(y) && x >= 0 && y >= 0 && x <= scene.width && y <= scene.height, `${c.id}: shape lies outside scene (${x}, ${y})`);
        assert(Array.isArray(scene.shapes) && scene.shapes.length > 1);
        for (const s of scene.shapes) {
            assert(['rect', 'circle', 'polygon', 'line', 'text'].includes(s.kind), `${c.id}: unsupported shape`);
            for (const key of ['fill', 'stroke', 'color']) if (key in s) assert(monochrome(s[key]), `${c.id}: non-monochrome ${key}`);
            if (s.kind === 'rect') { point(s.x, s.y); assert(s.width > 0 && s.height > 0); point(s.x + s.width, s.y + s.height); }
            if (s.kind === 'circle') { assert(s.r > 0); point(s.x - s.r, s.y - s.r); point(s.x + s.r, s.y + s.r); }
            if (s.kind === 'polygon' || s.kind === 'line') { assert(s.points.length >= 2); for (const p of s.points) point(...p); }
            if (s.kind === 'text') { point(s.x, s.y); assert(nonempty(s.text) && finite(s.size) && s.size >= 18, `${c.id}: unreadable/missing text`); }
        }
        assert(svg.includes('role="img"') && svg.includes('aria-labelledby="title desc"') && svg.includes('<title id="title">') && svg.includes('<desc id="desc">'), `${c.id}: missing accessible SVG title/description`);
        assert(svg.includes(`viewBox="0 0 ${scene.width} ${scene.height}"`), `${c.id}: SVG/scene dimensions diverge`);
        assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${c.id}: invalid PNG`);
        assert.equal(png.toString('ascii', 12, 16), 'IHDR');
        assert.equal(png.readUInt32BE(16), scene.width * 2, `${c.id}: PNG width`);
        assert.equal(png.readUInt32BE(20), scene.height * 2, `${c.id}: PNG height`);
        assert.equal(catalog.split(`\n## Notation: ${c.id}\n`).length - 1, 1, `${c.id}: missing/duplicate stable catalogue anchor`);
        for (const ext of ['svg', 'png', 'scene.json']) assert(catalog.includes(`(notation/${c.id}.${ext})`), `${c.id}: missing catalogue asset link`);
    }
}
console.log(`Notation checked: ${inventory.concepts.length} concepts, ${keywords.size} keywords, ${productions.size} productions, ${documents.size} valid context models, 8 negative regressions${sourceOnly ? ' (source only)' : ', SVG/PNG/scene triples and stable catalogue links'}.`);
