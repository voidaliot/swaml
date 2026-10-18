import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import ts from 'typescript';
import { createSwamlServices } from '../out/src/language/swaml-module.js';
import { resolvePath, effectiveQos, members, nanos } from '../out/src/language/semantic.js';
import { selectView, resolvePresentationPath } from '../out/src/language/presentation.js';
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
    if (item.inputDriver) {
        const driver = children.find(fn => a.isFunctionDef(fn) && fn.name === item.inputDriver.function);
        assert.ok(driver && driver.trigger?.kind === 'start', `${item.id}: root-owned input driver`);
        const emissions = [];
        const record = (block, timeNs) => {
            for (const statement of block?.statements ?? []) if (a.isSend(statement)) emissions.push({ endpoint: statement.endpoint, timeNs });
        };
        if (driver.body) record(driver.body, 0);
        else {
            let state = driver.stateBody.initial.ref, timeNs = 0;
            const visited = new Set();
            while (state) {
                assert.ok(!visited.has(state), `${item.id}: example input schedule must be finite`);
                visited.add(state); record(state.entry, timeNs);
                if (state.final) break;
                const transitions = driver.stateBody.transitions.filter(t => t.from.ref === state);
                assert.equal(transitions.length, 1, `${item.id}: deterministic authored input schedule`);
                const transition = transitions[0];
                assert.equal(transition.kind, 'after'); assert.ok(!transition.guard);
                timeNs += nanos(transition.delay); record(transition.effect, timeNs); state = transition.to.ref;
            }
        }
        assert.ok(emissions.length, `${item.id}: input driver must publish actual events`);
        for (const emission of emissions) {
            const [portName, eventName] = emission.endpoint.split('.');
            const port = children.find(p => a.isPort(p) && p.name === portName);
            assert.ok(port?.role === 'publisher' && port.interface.ref.members.some(member => a.isEventMember(member) && member.name === eventName));
            assert.ok(routes.some(route => route.source === portName), `${item.id}: root emission needs a displayed route`);
            assert.ok(item.inputDriver.schedule.includes(`${eventName}() at ${emission.timeNs / 1e6} ms`), `${item.id}: schedule caption differs from source`);
        }
    }
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
const explorerEntities = new Map();
function checkSourceCard(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'entity') {
        const excerpt = node.arguments[7];
        if (ts.isStringLiteralLike(node.arguments[0]) && ts.isStringLiteralLike(node.arguments[3])) explorerEntities.set(node.arguments[0].text, node.arguments[3].text);
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

// The FV interruption diagram is a projection of the protected body and its real routes.
const interruptSource = await readFile(new URL('../examples/19-interruptible-function.swaml', import.meta.url), 'utf8');
const { Swaml: interruptServices } = createSwamlServices(EmptyFileSystem);
const interruptDocument = await parseHelper(interruptServices)(interruptSource, { validation: true });
assert.deepEqual(interruptDocument.diagnostics, [], 'Interrupt flow example');
const interruptPackage = interruptDocument.parseResult.value.packages.find(p => p.name === 'Interrupts');
const interruptRoot = interruptPackage.elements.find(e => a.isRootComponent(e) && e.name === 'App');
const worker = interruptPackage.elements.find(e => a.isComponent(e) && e.name === 'Worker');
const interruptedFunction = members(worker).find(e => a.isFunctionDef(e) && e.name === 'run');
const region = interruptedFunction.body.statements.find(a.isInterruptible);
assert.equal(region?.name, 'work');
assert.equal(region?.endpoint, 'control.stop');
assert.deepEqual(region.body.statements.filter(a.isAssign).map(e => e.target), ['status', 'status']);
assert.equal(region.body.statements.find(a.isRemoteCall)?.endpoint, 'job.perform');
assert.deepEqual(region.handler.statements.filter(a.isAssign).map(e => e.target), ['status', 'why']);
const interruptionRoutes = members(interruptRoot).filter(a.isConnect);
assert.ok(interruptionRoutes.some(r => r.name === 'workRoute' && r.source === 'worker.job' && r.target === 'backend.api'));
assert.ok(interruptionRoutes.some(r => r.name === 'stopRoute' && r.source === 'controller.control' && r.target === 'worker.control'));
const controlPort = members(worker).find(e => a.isPort(e) && e.name === 'control');
assert.equal(controlPort.role, 'subscriber');
assert.equal(controlPort.interface.ref.name, 'Control');
const stop = controlPort.interface.ref.members.find(e => a.isEventMember(e) && e.name === 'stop');
assert.deepEqual(stop.parameters.map(p => [p.name, p.type.primitive]), [['reason', 'string']]);
assert.ok(interruptSource.includes('assert status == 2;'));
console.log('Verified FV interruptible region, typed payload, owned continuation and both authored connector routes.');

// Gallery labels and source downloads must identify the model actually being shown.
const galleryText = await readFile(new URL('../showcase/src/DiagramGallery.tsx', import.meta.url), 'utf8');
const galleryAst = ts.createSourceFile('DiagramGallery.tsx', galleryText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let galleryDeclaration;
function findGallery(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'diagramChoices') galleryDeclaration = node;
    ts.forEachChild(node, findGallery);
}
findGallery(galleryAst);
assert.ok(galleryDeclaration?.initializer && ts.isArrayLiteralExpression(galleryDeclaration.initializer));
const gallery = galleryDeclaration.initializer.elements.map(node => {
    assert.ok(ts.isObjectLiteralExpression(node));
    return Object.fromEntries(node.properties.map(property => {
        assert.ok(ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && ts.isStringLiteralLike(property.initializer));
        return [property.name.text, property.initializer.text];
    }));
});
assert.deepEqual(gallery.map(item => item.id), ['gv', 'iv', 'sv', 'cv', 'grv', 'flow', 'states', 'interrupts', 'timing']);
assert.deepEqual([...new Set(gallery.map(item => item.view))].sort(), ['cv', 'fv', 'grv', 'gv', 'iv', 'sv', 'tv']);
const galleryModels = new Map();
for (const item of gallery) {
    if (!galleryModels.has(item.sourceFile)) {
        const text = await readFile(new URL(`../examples/${item.sourceFile}`, import.meta.url), 'utf8');
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        const document = await parseHelper(Swaml)(text, { validation: true });
        assert.deepEqual(document.diagnostics, [], item.sourceFile);
        galleryModels.set(item.sourceFile, document.parseResult.value);
    }
    const [packageName, path] = item.subject.split('::');
    const pkg = galleryModels.get(item.sourceFile).packages.find(pkg => pkg.name === packageName);
    assert.ok(pkg, `${item.id}: package context`);
    const parts = path?.split('.') ?? [];
    const root = parts.length ? pkg.elements.find(element => element.name === parts[0]) : pkg;
    const subject = parts.length > 1 ? resolvePath(root, parts.slice(1).join('.')) : root;
    assert.ok(subject, `${item.id}: unresolved displayed subject ${item.subject}`);
    assert.ok(pkg.elements.some(element => a.isView(element) && element.kind === item.view), `${item.id}: no authored ${item.view} example`);
    if (['flow', 'states', 'interrupts'].includes(item.id)) assert.ok(a.isFunctionDef(subject), `${item.id}: expected function subject`);
    if (item.id === 'states') assert.ok(subject.stateBody, 'States example must contain owned states');
    if (item.id === 'interrupts') assert.ok(subject.body.statements.some(a.isInterruptible), 'Interrupt example must contain a protected region');
    if (item.id === 'timing') {
        assert.ok(a.isRootComponent(subject), 'Timing gallery must identify its execution root context');
        assert.equal(item.subjectLabel, 'Execution root');
        assert.equal(item.subjectNote, 'selected function occurrences');
        const timingView = pkg.elements.find(element => a.isView(element) && element.kind === 'tv');
        const selected = selectView(timingView);
        assert.ok(selected.every(element => a.isFunctionDef(element.node)), 'TV subjects are functions, not the execution root');
        const timing = JSON.parse(await readFile(new URL('../spec/function-timing-demo.json', import.meta.url), 'utf8'));
        assert.equal(timing.root, item.subject);
        assert.deepEqual(selected.map(element => element.path), timing.contracts.map(contract => `${subject.name}.${contract.functionPath}`));
    }
}
console.log('Verified all 7 view kinds and 3 FV presentations against their displayed example identities and downloadable sources.');

// Both GV layouts consume one source-backed recursive ownership tree.
const settingsPackage = galleryModels.get('08-service-field.swaml').packages.find(pkg => pkg.name === 'Settings');
let structureDeclaration;
function findStructure(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'cabinStructure') structureDeclaration = node;
    ts.forEachChild(node, findStructure);
}
findStructure(explorerAst);
assert.ok(structureDeclaration?.initializer);
const shownPaths = [], shownOwnership = [];
function checkStructure(node, parent) {
    assert.ok(ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'occurrence');
    assert.ok(ts.isStringLiteralLike(node.arguments[0]));
    const id = node.arguments[0].text, path = explorerEntities.get(id)?.replace('Settings::', '');
    const selected = resolvePresentationPath(settingsPackage, path);
    assert.ok(selected && (a.isRootComponent(selected.node) || a.isInstance(selected.node)), `Structure occurrence ${id}`);
    shownPaths.push(path);
    if (parent) { assert.equal(path.slice(0, path.lastIndexOf('.')), parent); shownOwnership.push([parent, path]); }
    const children = node.arguments[2];
    if (children) { assert.ok(ts.isArrayLiteralExpression(children)); for (const child of children.elements) checkStructure(child, path); }
}
checkStructure(structureDeclaration.initializer);
const expectedPaths = [], expectedOwnership = [];
function expectedStructure(node, path) {
    expectedPaths.push(path);
    for (const child of members(a.isInstance(node) ? node.definition.ref : node).filter(a.isInstance)) {
        expectedOwnership.push([path, `${path}.${child.name}`]); expectedStructure(child, `${path}.${child.name}`);
    }
}
expectedStructure(settingsPackage.elements.find(element => a.isRootComponent(element) && element.name === 'Cabin'), 'Cabin');
assert.deepEqual(shownPaths, expectedPaths, 'GV must include every actual component occurrence exactly once');
assert.deepEqual(shownOwnership, expectedOwnership, 'GV ownership must match source expansion');
console.log('Verified 7 GV component occurrences and all 6 source ownership relationships used by both structure layouts.');
