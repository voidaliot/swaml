// WP8 of swa.ml 2.3: the target binding schema swaml-binding/2.3 and swaml binding check (WP8-M02, WP8-M03,
// WP8-D10, WP8-M05).
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BINDING_SHAPE, bindingFindingText, checkBinding } from '../../src/language/binding.js';
import { parse } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
const root = new URL('../../../', import.meta.url);
const DOOR = fileURLToPath(new URL('examples/52-door-deployment.swaml', root));
const CLI = fileURLToPath(new URL('out/src/cli/main.js', root));
const VALID = {
    schema: 'swaml-binding/2.3',
    deployment: "DoorDeployment::'Front left door'",
    costs: [
        { operation: 'dcu.comMain.rxMainFunction', wcetNs: 80000, bcetNs: 20000, source: 'trace measurement 2026-10' },
        { operation: 'dcu.comMain.txMainFunction', wcetNs: 90000, source: 'analysis report A7' },
        // bcetNs may equal wcetNs.
        { operation: 'dcu.comMain.supervise', wcetNs: 1000, bcetNs: 1000, source: 'constant-time code' },
    ],
    budgets: [{ task: 'vehicle.doorModules[0].core1.task20ms', budgetNs: 500000 }],
    crossCoreLatencyNs: [{ connection: 'dcu.@connect3', maxNs: 1000000 }, { connection: 'bodyCan', maxNs: 5000000 }],
};
const door = async () => (await parse(readFileSync(DOOR, 'utf8'))).model;
const lines = async (value: unknown) => checkBinding(value, [await door()]).findings.map(bindingFindingText);
const errorsOf = async (value: unknown) => (await lines(value)).filter(l => l.startsWith('error'));

test('WP8-M02 spec/binding.schema.json declares exactly the shape the checker enforces', () => {
    const schema = JSON.parse(readFileSync(new URL('spec/binding.schema.json', root), 'utf8'));
    const shape = (s: { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean }) => ({ required: s.required, optional: Object.keys(s.properties).filter(k => !s.required.includes(k)), closed: s.additionalProperties === false });
    assert.deepEqual(shape(schema), { ...BINDING_SHAPE.root, closed: true });
    for (const list of ['costs', 'budgets', 'crossCoreLatencyNs'] as const)
        assert.deepEqual(shape(schema.properties[list].items), { ...BINDING_SHAPE[list], closed: true }, list);
    assert.equal(schema.properties.schema.const, 'swaml-binding/2.3');
});

test('WP8-M03 a binding resolves against the door deployment; placed operations without a cost are findings', async () => {
    const result = checkBinding(VALID, [await door()]);
    assert.equal(result.findings.filter(f => f.severity === 'error').length, 0);
    assert.deepEqual(result.findings.map(bindingFindingText), [
        'finding /costs dcu.canIf.rxIndication: placed operation has no cost.',
        'finding /costs dcu.comMain.storePdu: placed operation has no cost.',
        'finding /costs dcu.comMain.onMode: placed operation has no cost.',
        'finding /costs dcu.nvm.writeAll: placed operation has no cost.',
        'finding /costs dcu.ecuMode.onMode: placed operation has no cost.']);
    assert.deepEqual(result.resolved.connections, ['dcu.@connect1', 'dcu.@connect3', 'dcu.@connect5', 'bodyCan', 'modeLine', 'statusLine']);
    assert.ok(result.resolved.tasks.includes('vehicle.doorModules[1].core0.taskEventLow'));
});

test('WP8-M03 schema errors: version, unknown and missing properties, types and ranges', async () => {
    assert.deepEqual(await errorsOf({ ...VALID, schema: 'swaml-binding/2.4' }), ['error /schema: must be "swaml-binding/2.3", found "swaml-binding/2.4".']);
    assert.deepEqual(await errorsOf({ ...VALID, extra: 1, costs: [{ operation: 'dcu.comMain.rxMainFunction', wcetNs: -1, source: '', note: 'x' }] }), [
        'error /extra: is not a property of the schema.',
        'error /costs/0/wcetNs: must be an integer from 0 to 9007199254740991.',
        'error /costs/0/source: must be a non-empty string.',
        'error /costs/0/note: is not a property of the schema.']);
    assert.deepEqual(await errorsOf({ deployment: VALID.deployment, budgets: {} }), ['error /: is missing the required property schema.', 'error /budgets: must be an array.']);
    assert.deepEqual(await errorsOf([]), ['error /: must be an object, found an array.']);
    assert.deepEqual(await errorsOf({ ...VALID, budgets: [{ task: 'vehicle.doorModules[0].core1.task20ms', budgetNs: 1.5 }, 'x'] }), [
        'error /budgets/0/budgetNs: must be an integer from 0 to 9007199254740991.', 'error /budgets/1: must be an object, found string.']);
});

test('WP8-M03 identity errors: deployment, operation, task, connection, duplicates and bcetNs above wcetNs', async () => {
    assert.deepEqual(await lines({ ...VALID, deployment: 'DoorDeployment::Front left door' }), ['error /deployment DoorDeployment::Front left door: no deployment of the sources has this qualified identity.']);
    const errorLines = async (patch: object) => (await lines({ ...VALID, ...patch })).filter(l => l.startsWith('error'));
    assert.deepEqual(await errorLines({ costs: [{ operation: 'dcu.comMain.missing', wcetNs: 1, source: 's' }, { operation: 'dcu.canIf.rxIndication', wcetNs: 1, source: 's' }, { operation: 'dcu.canIf.rxIndication', wcetNs: 2, source: 's' }, { operation: 'dcu.nvm.writeAll', wcetNs: 5, bcetNs: 6, source: 's' }] }), [
        'error /costs/3/bcetNs dcu.nvm.writeAll: bcetNs 6 exceeds wcetNs 5.',
        "error /costs/0/operation dcu.comMain.missing: no operation of the deployed tree of DoorDeployment::'Front left door' has this identity.",
        'error /costs/2/operation dcu.canIf.rxIndication: duplicates /costs/1/operation.']);
    assert.deepEqual(await errorLines({ budgets: [{ task: 'vehicle.doorModules[0].core1', budgetNs: 1 }, { task: 'vehicle.doorModules[0].core1.task7ms', budgetNs: 1 }] }), [
        "error /budgets/0/task vehicle.doorModules[0].core1: vehicle.doorModules[0].core1 is a platform occurrence of DoorDeployment::'Front left door' but not a Swaml::Os task.",
        "error /budgets/1/task vehicle.doorModules[0].core1.task7ms: no Swaml::Os task of the platform of DoorDeployment::'Front left door' has this identity."]);
    assert.deepEqual(await errorLines({ crossCoreLatencyNs: [{ connection: 'dcu.@connect0', maxNs: 1 }, { connection: 'dcu.@connect9', maxNs: 1 }, { connection: 'dcu.@package0', maxNs: 1 }] }), [
        'error /crossCoreLatencyNs/0/connection dcu.@connect0: dcu.@connect0 is a forwarding connect, which has no route.',
        "error /crossCoreLatencyNs/1/connection dcu.@connect9: no connection route of DoorDeployment::'Front left door' has this identity.",
        "error /crossCoreLatencyNs/2/connection dcu.@package0: no connection route of DoorDeployment::'Front left door' has this identity."]);
});

const cli = (...args: string[]) => {
    try {
        return { code: 0, out: execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    }
    catch (error) {
        const e = error as { status: number; stdout: string; stderr: string };
        return { code: e.status, out: e.stdout + e.stderr };
    }
};
test('WP8-M03 swaml binding check: exit codes and output lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'swaml-binding-'));
    const file = (name: string, content: string) => { const path = join(dir, name); writeFileSync(path, content); return path; };
    const good = file('good.json', JSON.stringify(VALID));
    const ok = cli('binding', 'check', good, DOOR);
    assert.equal(ok.code, 0, ok.out);
    assert.match(ok.out, /^finding \/costs dcu\.canIf\.rxIndication: placed operation has no cost\.$/mu);
    assert.match(ok.out, /^Checked binding .*good\.json for DoorDeployment::'Front left door' \(swaml-binding\/2\.3\): 0 error\(s\), 5 finding\(s\)\.$/mu);
    const json = JSON.parse(cli('binding', 'check', '--json', good, DOOR).out);
    assert.deepEqual([json.schema, json.deployment, json.errorCount, json.findingCount], ['swaml-binding/2.3', "DoorDeployment::'Front left door'", 0, 5]);
    const mismatch = cli('binding', 'check', file('v24.json', JSON.stringify({ ...VALID, schema: 'swaml-binding/2.4' })), DOOR);
    assert.equal(mismatch.code, 1);
    assert.match(mismatch.out, /^error \/schema: must be "swaml-binding\/2\.3", found "swaml-binding\/2\.4"\.$/mu);
    const unresolved = cli('binding', 'check', file('bad.json', JSON.stringify({ ...VALID, budgets: [{ task: 'vehicle.nothing', budgetNs: 1 }] })), DOOR);
    assert.equal(unresolved.code, 1);
    assert.match(unresolved.out, /^error \/budgets\/0\/task vehicle\.nothing: /mu);
    const bcet = cli('binding', 'check', file('bcet.json', JSON.stringify({ ...VALID, costs: [{ operation: 'dcu.nvm.writeAll', wcetNs: 1, bcetNs: 2, source: 's' }] })), DOOR);
    assert.equal(bcet.code, 1);
    const notJson = cli('binding', 'check', file('broken.json', '{ "schema": '), DOOR);
    assert.equal(notJson.code, 1);
    assert.match(notJson.out, /^error \/: the file is not JSON/mu);
    const missing = cli('binding', 'check', join(dir, 'missing.json'), DOOR);
    assert.equal(missing.code, 2);
    assert.match(missing.out, /^Cannot read .*missing\.json: ENOENT\.$/mu);
    const invalidModel = cli('binding', 'check', good, file('broken.swaml', 'package Broken { component x: Nothing; }'));
    assert.equal(invalidModel.code, 1);
    assert.match(invalidModel.out, /The sources have errors; the binding is checked only against a validated model\./u);
    assert.equal(cli('binding', 'check', good).code, 2);
    assert.equal(cli('binding', 'verify', good, DOOR).code, 2);
});
