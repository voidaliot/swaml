import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import ts from 'typescript';
import { createSwamlServices } from '../out/src/language/swaml-module.js';
import { resolvePath, effectiveQos, members } from '../out/src/language/semantic.js';
import * as a from '../out/src/language/generated/ast.js';

const catalog = JSON.parse(await readFile(new URL('../showcase/src/contracts.json', import.meta.url), 'utf8'));
const kinds = new Set();
for (const item of catalog) {
    const source = await readFile(new URL(`../examples/${item.file}`, import.meta.url), 'utf8');
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const doc = await parseHelper(Swaml)(source, { validation: true });
    assert.deepEqual(doc.diagnostics, [], item.file);
    const pkg = doc.parseResult.value.packages.find(p => p.name === item.package);
    assert.ok(pkg, item.package);
    const contract = pkg.elements.find(e => a.isInterface(e) && e.name === item.contract);
    assert.equal(contract?.kind, item.kind);
    const owner = pkg.elements.find(e => e.name === item.owner);
    assert.ok(a.isComponent(owner) || a.isRootComponent(owner));
    const route = members(owner).find(e => a.isConnect(e) && e.name === item.connector);
    assert.ok(route, item.connector);
    assert.equal(route.source, item.source); assert.equal(route.target, item.target);
    for (const side of ['source', 'target']) {
        const port = resolvePath(owner, item[side]);
        assert.ok(a.isPort(port));
        assert.equal(port.interface.ref, contract);
        assert.equal(port.role, item[`${side}Role`]);
    }
    assert.ok(effectiveQos(route.qos));
    // These are the exact source extracts shown by Interfaces.tsx, not invented signatures.
    assert.ok(source.match(new RegExp(`interface ${item.kind} ${item.contract} version "[^"\\n]+" \\{[^}]*\\}`)), item.id);
    assert.ok(source.match(new RegExp(`connect ${item.connector}:[^{};]*(?:\\{[^}]*\\})?;`)), item.id);
    if (item.id === 'sampled') {
        assert.ok(contract.members.some(m => a.isDataMember(m) && m.mode === 'sampled'));
        assert.equal(effectiveQos(route.qos).capacity, 1);
        assert.equal(effectiveQos(route.qos).overflow, 'dropOldest');
    }
    if (item.id === 'queued') assert.ok(contract.members.some(m => a.isDataMember(m) && m.mode === 'queued'));
    kinds.add(item.kind);
}
assert.equal(new Set(catalog.map(c => c.id)).size, 5);
assert.deepEqual([...kinds].sort(), ['clientServer', 'publishSubscribe', 'senderReceiver', 'service']);
console.log('Verified 5 showcase patterns against parsed contracts, roles, routes and effective policies; all 4 interface kinds covered.');

const architectures = JSON.parse(await readFile(new URL('../showcase/src/architectures.json', import.meta.url), 'utf8'));
const runs = JSON.parse(await readFile(new URL('../examples/simulation/runs.json', import.meta.url), 'utf8'));
assert.deepEqual(architectures.map(item => item.id).sort(), ['adaptive', 'classic', 'cloud', 'web']);
for (const item of architectures) {
    const source = await readFile(new URL(`../examples/${item.file}`, import.meta.url), 'utf8');
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const doc = await parseHelper(Swaml)(source, { validation: true });
    assert.deepEqual(doc.diagnostics, [], item.file);
    const pkg = doc.parseResult.value.packages.find(p => p.name === item.package);
    const root = pkg?.elements.find(e => a.isRootComponent(e) && e.name === item.root);
    assert.ok(a.isRootComponent(root), `${item.id}: root`);
    const children = members(root);
    const instances = children.filter(a.isInstance);
    const routes = children.filter(a.isConnect);
    assert.deepEqual(item.nodes.map(n => n.id).sort(), instances.map(n => n.name).sort(), `${item.id}: displayed instances`);
    assert.deepEqual(item.routes.map(r => r.id).sort(), routes.map(r => r.name).sort(), `${item.id}: displayed routes`);
    for (const part of item.nodes) {
        const instance = resolvePath(root, part.id);
        assert.ok(a.isInstance(instance));
        assert.equal(instance.kind, part.kind);
        assert.equal(instance.definition.ref?.name, part.definition);
        const deployment = root.members.filter(a.isDeployment)
            .filter(d => part.id === d.target || part.id.startsWith(`${d.target}.`))
            .sort((left, right) => right.target.length - left.target.length)[0]
            ?? root.members.find(d => a.isDeployment(d) && d.target === root.name);
        assert.equal(deployment?.system, part.deployment, `${item.id}: ${part.id} allocation`);
        const shownPorts = new Set(item.routes.flatMap(r => [r.source, r.target])
            .filter(path => path.startsWith(`${part.id}.`)).map(path => path.slice(part.id.length + 1)));
        assert.deepEqual([...shownPorts].sort(), members(instance.definition.ref).filter(a.isPort).map(p => p.name).sort());
    }
    for (const displayed of item.routes) {
        const route = routes.find(r => r.name === displayed.id);
        assert.equal(route.source, displayed.source);
        assert.equal(route.target, displayed.target);
        const contract = pkg.elements.find(e => a.isInterface(e) && e.name === displayed.contract);
        assert.equal(contract?.kind, displayed.kind);
        for (const side of ['source', 'target']) {
            const port = resolvePath(root, displayed[side]);
            assert.ok(a.isPort(port));
            assert.equal(port.interface.ref, contract);
            assert.equal(port.role, displayed[`${side}Role`]);
        }
        assert.ok(effectiveQos(route.qos));
        assert.ok(source.match(new RegExp(`interface ${displayed.kind} ${displayed.contract} version "[^"\\n]+" \\{[^}]*\\}`)));
        assert.ok(source.match(new RegExp(`connect ${displayed.id}:[^{};]*(?:\\{[^}]*\\})?;`)));
        if (route.qos.policy) assert.ok(source.includes(`qos def ${route.qos.policy.ref.name} {`));
    }
    assert.ok(runs.some(run => run.model === `examples/${item.file}` && run.root === `${item.package}::${item.root}`), `${item.id}: simulation evidence`);
}
console.log('Verified all 4 domain architectures against parsed instances, definitions, ports, routes, deployments and simulation configurations.');

// The main explorer's static source cards must remain excerpts of its actual model.
const explorerSource = await readFile(new URL('../examples/08-service-field.swaml', import.meta.url), 'utf8');
const explorerModule = await readFile(new URL('../showcase/src/model.ts', import.meta.url), 'utf8');
const explorerAst = ts.createSourceFile('model.ts', explorerModule, ts.ScriptTarget.Latest, true);
const normalize = value => value.replace(/\s+/g, ' ').trim();
let checkedExcerpts = 0;
function checkSourceCard(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'entity') {
        const excerpt = node.arguments[7];
        if (excerpt && ts.isStringLiteralLike(excerpt)) {
            const id = ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : 'dynamic entity';
            assert.ok(normalize(explorerSource).includes(normalize(excerpt.text)), `Explorer source excerpt is stale: ${id}`);
            checkedExcerpts++;
        }
    }
    ts.forEachChild(node, checkSourceCard);
}
checkSourceCard(explorerAst);
assert.ok(checkedExcerpts >= 15, 'The model explorer needs source-backed entity cards');
console.log(`Verified ${checkedExcerpts} model explorer source excerpts against the Settings model.`);
