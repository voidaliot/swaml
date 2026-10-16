import { readFile, readdir, writeFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');
const check = process.argv.includes('--check');
const concerns = {
    'Structure and names': 'docs/spec/01-structure-and-types.md',
    'Values and calculation': 'docs/spec/01-structure-and-types.md',
    'Communication': 'docs/spec/02-communication.md',
    'Behavior and states': 'docs/spec/03-behavior.md',
    'Timing and deployment': 'docs/spec/04-systems-and-conformance.md',
    'Cases and evidence': 'docs/spec/04-systems-and-conformance.md',
    'Graphical views': 'docs/GRAPHICAL_NOTATION.md'
};
async function output(path, text) {
    if (check) { if (await read(path) !== text) throw new Error(`Stale generated reference: ${path}. Run node scripts/build-reference.mjs`); }
    else await writeFile(new URL(path, root), text);
}
const inventory = JSON.parse(await read('spec/keywords.json'));
const notation = JSON.parse(await read('spec/notation.json'));
const graphicalConcepts = new Map(notation.concepts.map(c => [c.id, c]));
const graphicalKeywords = new Map(notation.coverage.keywords.map(e => [e.term, e]));
const grammar = await read('src/language/swaml.langium');
const keys = new Set([...grammar.matchAll(/'([a-zA-Z][a-zA-Z0-9]*)'/g)].map(m => m[1]));
keys.add('doc');
if (inventory.languageVersion !== '1.2' || inventory.entries.length !== keys.size) throw new Error('Keyword inventory/version mismatch');
const productions = [...grammar.matchAll(/^(?:(?:entry|hidden|terminal|type)\s+)*([A-Za-z]\w*)(?:\s+(?:returns|infers)\s+\w+)?\s*[:=]([\s\S]*?)(?=^(?:(?:entry|hidden|terminal|type)\s+)*[A-Za-z]\w*(?:\s+(?:returns|infers)\s+\w+)?\s*[:=]|$(?![\s\S]))/gm)];
let keywordText = '# Alphabetical keyword reference\n\nThis user-facing reference covers every reserved word in the SWAML 1.2 grammar. Entries are sorted alphabetically, ignoring case for sorting only; source keywords remain case-sensitive. Example fragments illustrate a use and are not standalone models. Read the linked normative concern for full constraints. Punctuation and operator precedence follow the final section.\n\n';
keywordText += inventory.entries.map(e => `[\`${e.keyword}\`](#keyword-${e.keyword.toLowerCase()})`).join(' · ') + '\n\n';
const ordered = inventory.entries.map(e => e.keyword.toLowerCase());
if (ordered.join() !== [...ordered].sort().join()) throw new Error('Keyword inventory must be alphabetical');
const seen = new Set();
for (const e of inventory.entries) {
    if (!keys.has(e.keyword) || seen.has(e.keyword) || !concerns[e.concern] || !e.meaning || !e.example) throw new Error(`Invalid keyword entry ${e.keyword}`);
    seen.add(e.keyword);
    const rules = productions.filter(m => m[2].includes(`'${e.keyword}'`)).map(m => m[1]);
    if (e.keyword === 'doc') rules.push('Documentation', 'DOC_COMMENT');
    if (!rules.length) throw new Error(`No grammar rule for ${e.keyword}`);
    keywordText += `## Keyword: ${e.keyword}\n\n**Concern:** [${e.concern}](${posix.relative('docs', concerns[e.concern])}). **Grammar:** ${rules.map(r => `\`${r}\``).join(', ')}.\n\n${e.meaning}\n\n**Example fragment:** \`${e.example}\`\n\n`;
    const graphical = graphicalKeywords.get(e.keyword);
    if (!graphical) throw new Error(`Missing graphical coverage for ${e.keyword}`);
    keywordText += `**Graphical notation:** ${graphical.concepts.map(id => `[${graphicalConcepts.get(id).title}](GRAPHICAL_CATALOG.md#notation-${id})`).join(', ') || 'Text only'}. ${graphical.rationale}\n\n`;
}
keywordText += `## Punctuation and operator reference\n\n| Token | Meaning |\n| --- | --- |\n| \`;\` | Declaration/statement terminator where the production requires it. |\n| \`{ }\` | Owned declarations, block scope, record assignments, QoS or timing block according to context. |\n| \`( )\` | Arguments, parameters, conditions or precedence grouping. |\n| \`[ ]\` | Fixed type extent, array literal or one final index read. |\n| \`:\` | Name/type separator, function result or connector/transition header separator. |\n| \`,\` | List separator; no implicit trailing comma. |\n| \`::\` | Package qualification; imports append \`::*\`. |\n| \`.\` | Structural/member path, local record field, enum literal separator or real-literal decimal point. |\n| \`->\` | Connector, delegation, state transition or case exchange direction. |\n| \`=\` | Initialization, assignment, calculation result expression or record field assignment; never equality. |\n| \`== !=\` | Typed recursive equality/inequality; numeric scalar promotion permitted. |\n| \`< <= > >=\` | Numeric ordering; no string ordering. |\n| \`+ - * / %\` | Checked numeric arithmetic; slash always real, remainder integral only; minus also unary. |\n| \`//\` / \`/* */\` | Line / non-nested block comments outside strings. |\n\nPrecedence, lowest first: or; and; equality; ordered comparison; addition/subtraction; multiplication/division/remainder; unary not/minus; primary. Binary operators associate left. Only and/or short-circuit. Identifiers, strings, numerics and durations have the exact lexical rules in [chapter 1](spec/01-structure-and-types.md); the [complete grammar](../src/language/swaml.langium) is authoritative for concrete syntax.\n`;
await output('docs/KEYWORD_REFERENCE.md', keywordText);
const chapters = [
    ['Document scope', 'docs/LANGUAGE_SPECIFICATION.md'],
    ['Graphical modeling overview', 'docs/MODELING_OVERVIEW.md'],
    ['Quick start', 'docs/QUICK_START.md'],
    ['Getting started', 'docs/USER_GUIDE.md'],
    ['Architecture patterns', 'docs/ARCHITECTURE_PATTERNS.md'],
    ['Alphabetical concern map', 'docs/CONCERN_GUIDE.md'],
    ['Architecture comparison', 'docs/ARCHITECTURE_COMPARISON.md'],
    ['Behavior and states', 'docs/spec/03-behavior.md'],
    ['Communication', 'docs/spec/02-communication.md'],
    ['Conformance and evidence', 'docs/spec/08-conformance-obligations.md'],
    ['Formal semantics', 'docs/spec/09-formal-semantics.md'],
    ['Graphical notation', 'docs/GRAPHICAL_NOTATION.md'],
    ['Canonical graphical catalog', 'docs/GRAPHICAL_CATALOG.md'],
    ['Graphical specification organization', 'docs/SYSML_STYLE_REVIEW.md'],
    ['Kernel mapping', 'docs/spec/05-kerml-mapping.md'],
    ['Kernel normalization', 'docs/spec/07-normalized-model.md'],
    ['Runtime contract', 'docs/spec/06-execution-contract.md'],
    ['Simulation', 'docs/SIMULATION.md'],
    ['Structure, names and values', 'docs/spec/01-structure-and-types.md'],
    ['Root components, timing, deployment and cases', 'docs/spec/04-systems-and-conformance.md'],
    ['Version migration', 'docs/MIGRATION_1_2.md'],
    ['Component and behavior design', 'docs/decisions/0007-component-functions-and-calculations.md'],
    ['Function-local calculations and calls', 'docs/decisions/0008-function-local-calculations-and-calls.md'],
    ['Requirements and documentation', 'docs/REQUIREMENTS_AND_DOCUMENTATION.md'],
    ['Requirements design decision', 'docs/decisions/0009-requirements-documentation-and-views.md'],
    ['Ontology and flat views', 'docs/ONTOLOGY_AND_VIEWS.md'],
    ['Guide for UML architects', 'docs/UML_GUIDE.md'],
    ['Alphabetical keyword reference', 'docs/KEYWORD_REFERENCE.md'],
    ['Implementation evidence', 'docs/IMPLEMENTATION_STATUS.md'],
    ['Tool integration', 'docs/TOOLING.md']
];
try { await read('docs/GRAPHICAL_EXAMPLES.md'); chapters.splice(chapters.findIndex(x => x[0] === 'Graphical notation') + 1, 0, ['Graphical examples', 'docs/GRAPHICAL_EXAMPLES.md']); } catch {}
const anchor = p => 'source-' + createHash('sha256').update(p).digest('hex').slice(0, 12);
const included = new Set(chapters.map(x => x[1]));
let book = '# SWAML 1.2.0 — Complete language reference\n\n**Software Architecture Modeling Language** · Headerless language 1.2; explicit definitions and component usages · Independently authored, KerML-based semantic design.\n\nThis is the complete user-facing Markdown edition, generated from the maintained source chapters. Navigate by the alphabetical concern map or the exhaustive alphabetical keyword reference. Normative chapters define meaning; tutorials, comparisons and examples illustrate it. The portable reference parser and logical simulator provide executable evidence with the limitations stated below.\n\n## Contents\n\n';
book += chapters.map(([title, p]) => `- [${title}](#${anchor(p)})`).join('\n') + '\n- [Complete concrete grammar](#complete-concrete-grammar)\n- [Model examples](#model-examples)\n\n';
for (const [title, path] of chapters) {
    let text = path === 'docs/KEYWORD_REFERENCE.md' ? keywordText : await read(path);
    // Namespace source heading anchors so links retain their exact target in the combined book.
    const headingCounts = new Map();
    let inFence = false;
    text = text.split('\n').map(line => {
        if (/^```/.test(line)) inFence = !inFence;
        if (inFence || !/^#{1,6} /.test(line)) return line;
        const base = line.replace(/^#+ /, '').toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/ /g, '-');
        const count = headingCounts.get(base) || 0;
        headingCounts.set(base, count + 1);
        return `<a id="${anchor(path)}-${base}${count ? '-' + count : ''}"></a>\n\n${line}`;
    }).join('\n');
    text = text.replace(/(!?)\[([^\]]*)\]\(([^)]+)\)/g, (whole, image, label, target) => {
        if (/^[a-z]+:/i.test(target)) return whole;
        if (target.startsWith('#')) return `${image}[${label}](#${anchor(path)}-${target.slice(1)})`;
        const [file, fragment] = target.split('#');
        const destination = posix.normalize(posix.join(posix.dirname(path), file));
        const link = !image && included.has(destination) ? `#${anchor(destination)}${fragment ? '-' + fragment : ''}` : posix.relative('docs', destination) + (fragment ? '#' + fragment : '');
        return `${image}[${label}](${link})`;
    });
    book += `<a id="${anchor(path)}"></a>\n\n${text.trim()}\n\n---\n\n`;
}
book += '# Complete concrete grammar\n\nThe exact normative Langium grammar follows. Generated AST and syntax files are build outputs, not independent definitions.\n\n```langium\n' + grammar.trim() + '\n```\n\n# Model examples\n\n';
const runs = JSON.parse(await read('examples/simulation/runs.json'));
const examples = (await readdir(new URL('examples/', root))).filter(name => name.endsWith('.swaml')).sort().map(name => `examples/${name}`);
for (const model of new Set([...runs.map(run => run.model), ...examples, ...notation.concepts.map(c => c.source.model)])) {
    const configurations = runs.filter(run => run.model === model);
    book += `## ${posix.basename(model, '.swaml')}\n\n`;
    book += configurations.length ? configurations.map(run => `- Root component: \`${run.root}\`. [Simulation options](${posix.relative('docs', run.options)}).`).join('\n') + '\n\n' : 'This validated fixture supplies a complete authoring example; it is not an additional configured reference simulation scenario.\n\n';
    book += `\`\`\`swaml\n${(await read(model)).trim()}\n\`\`\`\n\n`;
}
const localAnchors = new Set([...book.matchAll(/<a id="([^"]+)"/g)].map(match => match[1]));
localAnchors.add('complete-concrete-grammar');
localAnchors.add('model-examples');
for (const match of book.matchAll(/\[[^\]]*\]\(#([^)]+)\)/g)) {
    if (!localAnchors.has(match[1])) throw new Error(`Broken combined-reference anchor: ${match[1]}`);
}
await output('docs/SWAML-1.2.0-Reference.md', book.trimEnd() + '\n');
console.log(`${check ? 'Verified' : 'Built'} complete reference and ${seen.size} alphabetical keyword entries.`);
