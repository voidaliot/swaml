import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../out/src/language/swaml-module.js';
import { members } from '../out/src/language/semantic.js';
import * as a from '../out/src/language/generated/ast.js';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const manifest = JSON.parse(await read('spec/modeling-overview.json'));
assert.equal(manifest.version, 1);
assert.deepEqual(manifest.stages.map(stage => stage.id), ['intent', 'interactions', 'flow', 'functions', 'structure']);
const source = await read(manifest.model.file);
const { Swaml } = createSwamlServices(EmptyFileSystem);
const document = await parseHelper(Swaml)(source, { validation: true });
assert.deepEqual(document.diagnostics, [], manifest.model.file);
const pkg = document.parseResult.value.packages.find(p => p.name === manifest.model.package);
assert.ok(pkg);
const architecture = resolveSubject(manifest.model.root);
const scenario = resolveSubject(manifest.model.case);
const requirement = resolveSubject(manifest.model.requirement);
assert.ok(architecture && scenario && requirement);
assert.ok(a.isRootComponent(architecture) && a.isScenario(scenario) && a.isRequirement(requirement));
assert.equal(scenario.root.ref, architecture);
assert.ok(pkg.satisfactions.some(link => link.requirement.ref === requirement && link.source === architecture.name));

function resolveSubject(path) {
    const [namespace, local, extra] = path.split('::');
    assert.equal(namespace, pkg.name, path);
    assert.equal(extra, undefined, path);
    let subject = pkg;
    for (const name of local.split('.')) {
        if (a.isInstance(subject)) subject = subject.definition.ref;
        const children = a.isPackage(subject) ? subject.elements
            : a.isRootComponent(subject) || a.isComponent(subject) ? members(subject)
            : a.isScenario(subject) ? subject.steps
            : a.isInterface(subject) ? subject.members
            : [];
        subject = children.find(child => child.name === name);
        assert.ok(subject, `Unknown visual subject: ${path}`);
    }
    return subject;
}
const normalize = value => value.replace(/\s+/g, ' ').trim();
let subjects = 0, excerpts = 0;
for (const graph of [manifest.ontology, ...manifest.stages]) {
    assert.ok(graph.width > 0 && graph.height > 0 && graph.summary && graph.title, graph.id);
    const ids = new Set(graph.nodes.map(node => node.id));
    assert.equal(ids.size, graph.nodes.length, `${graph.id}: unique nodes`);
    assert.equal(new Set(graph.edges.map(edge => edge.id)).size, graph.edges.length, `${graph.id}: unique edges`);
    for (const node of graph.nodes) {
        assert.ok(node.title && node.kind && node.detail, `${graph.id}: ${node.id}`);
        assert.ok(node.x >= 0 && node.y >= 0 && node.width > 0 && node.height > 0);
        assert.ok(node.x + node.width <= graph.width && node.y + node.height <= graph.height, `${graph.id}: ${node.id} bounds`);
        if (node.subject) {
            const subject = resolveSubject(node.subject);
            subjects++;
            if (node.snippet) {
                assert.ok(normalize(subject.$cstNode.text).includes(normalize(node.snippet)), `${graph.id}: ${node.id} source excerpt`);
                excerpts++;
            }
        } else assert.ok(!node.snippet, `${graph.id}: an excerpt needs an owning source subject`);
    }
    for (const edge of graph.edges) {
        assert.ok(ids.has(edge.source) && ids.has(edge.target), `${graph.id}: ${edge.id} endpoints`);
        assert.ok(['owns', 'references', 'flow', 'route'].includes(edge.kind), `${graph.id}: ${edge.id} relation`);
    }
    const svg = await read(`docs/assets/modeling-${graph.id}.svg`);
    const scene = JSON.parse(await read(`docs/assets/modeling-${graph.id}.scene.json`));
    assert.equal(scene.width, graph.width); assert.equal(scene.height, graph.height);
    assert.ok(svg.includes('role="img"') && svg.includes('<title') && svg.includes('<desc'), `${graph.id}: accessible SVG`);
    assert.ok(!/<(?:filter|linearGradient|radialGradient)\b|drop-shadow|perspective/i.test(svg), `${graph.id}: flat graphics`);
    assert.ok(scene.shapes.every(shape => ['rect', 'text', 'line', 'circle', 'polygon'].includes(shape.kind)));
}

const interactions = manifest.stages.find(stage => stage.id === 'interactions');
const stepNodes = new Map(interactions.nodes.filter(node => node.subject && a.isScenarioStep(resolveSubject(node.subject)))
    .map(node => [resolveSubject(node.subject).name, node.id]));
assert.deepEqual([...stepNodes.keys()].sort(), scenario.steps.map(step => step.name).sort(), 'Show every case exchange');
for (const step of scenario.steps.filter(step => step.predecessor)) {
    assert.ok(interactions.edges.some(edge => edge.source === stepNodes.get(step.predecessor) && edge.target === stepNodes.get(step.name)), `Missing declared dependency: ${step.predecessor} -> ${step.name}`);
}
for (const edge of interactions.edges) {
    const from = interactions.nodes.find(node => node.id === edge.source);
    const to = interactions.nodes.find(node => node.id === edge.target);
    if (from.subject && to.subject) {
        const predecessor = resolveSubject(from.subject), step = resolveSubject(to.subject);
        if (a.isScenarioStep(predecessor) && a.isScenarioStep(step)) assert.equal(step.predecessor, predecessor.name, 'A visual arrow must preserve an authored case dependency');
    }
}
const runs = JSON.parse(await read('examples/simulation/runs.json'));
assert.ok(runs.some(run => run.model === manifest.model.file && run.root === `${pkg.name}::${architecture.name}` && run.options === manifest.model.simulation), 'Walkthrough simulation configuration');
assert.ok(subjects >= 20 && excerpts >= 6, 'Walkthrough needs concrete subjects and checked flow excerpts');
console.log(`Verified graphical ontology and 5 walkthrough stages: ${subjects} resolved subjects, ${excerpts} exact excerpts and every authored case dependency.`);
