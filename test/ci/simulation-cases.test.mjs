import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { caseOptions, checkCasesFile, checkModelOptionsUsed } from '../../scripts/simulation-cases.mjs';

const models = ['examples/02-realtime-controller.swaml', 'examples/28-use-cases.swaml'];

test('the repository cases file is valid and every example uses the global options', async () => {
    const cases = JSON.parse(await readFile(new URL('../../examples/simulation/cases.json', import.meta.url), 'utf8'));
    checkCasesFile(cases, Object.keys(cases.examples));
    for (const model of Object.keys(cases.examples))
        assert.deepEqual(caseOptions(cases, model), { ...cases.options, ...(cases.modelOptions?.[model] ?? {}) });
});

test('an example may set its own step limit and horizon over the global options', () => {
    const cases = checkCasesFile({ options: { untilNs: 1000, maxSteps: 50 }, modelOptions: { [models[1]]: { maxSteps: 500000, untilNs: 60000000000 } }, examples: {} }, models);
    assert.deepEqual(caseOptions(cases, models[0]), { untilNs: 1000, maxSteps: 50 });
    assert.deepEqual(caseOptions(cases, models[1]), { untilNs: 60000000000, maxSteps: 500000 });
    // Options an example does not set keep their global value.
    assert.deepEqual(caseOptions(checkCasesFile({ options: { untilNs: 1000, latencyNs: 5 }, modelOptions: { [models[0]]: { maxSteps: 7 } }, examples: {} }, models), models[0]), { untilNs: 1000, latencyNs: 5, maxSteps: 7 });
});

test('malformed cases files are rejected', () => {
    assert.throws(() => checkCasesFile({ options: { untilNs: 1 }, modelOptions: { 'examples/missing.swaml': { maxSteps: 1 } }, examples: {} }, models), /not a complete example/);
    assert.throws(() => checkCasesFile({ options: { untilNs: 1 }, modelOptions: { [models[0]]: { steps: 1 } }, examples: {} }, models), /Unknown simulation option steps/);
    assert.throws(() => checkCasesFile({ options: { untilNs: 1 }, modelOptions: { [models[0]]: [] }, examples: {} }, models), /must be an object/);
    assert.throws(() => checkCasesFile({ options: { maxSteps: 1 }, examples: {} }, models), /Invalid untilNs/);
    assert.throws(() => checkCasesFile({ options: { untilNs: 1 }, perModel: {}, examples: {} }, models), /unknown key perModel/);
    assert.throws(() => checkCasesFile({ options: { untilNs: 1 }, examples: { 'examples/other.swaml': {} } }, models), /not a complete example/);
});

test('option values are type-checked and options for an example without cases are rejected', () => {
    // The simulator's own validator decides, so the file and the runs cannot disagree.
    for (const bad of [{ maxSteps: '10' }, { maxSteps: 0 }, { untilNs: 1.5 }, { latencyNs: -1 }, { faults: [{ offer: 1, kind: 'lose' }] }, { faults: {} }, { faults: [{ offer: 0, kind: 'drop' }] }, { faults: [{ offer: 1, kind: 'drop' }, { offer: 1, kind: 'duplicate' }] }, { faults: [{ offer: 1, kind: 'drop', after: 2 }] }])
        assert.throws(() => checkCasesFile({ options: { untilNs: 1 }, modelOptions: { [models[0]]: bad }, examples: {} }, models), /Invalid/, JSON.stringify(bad));
    assert.throws(() => checkCasesFile({ options: { untilNs: '1' }, examples: {} }, models), /Invalid untilNs/);
    checkCasesFile({ options: { untilNs: 0 }, examples: {} }, models);
    checkCasesFile({ options: { untilNs: 1 }, modelOptions: { [models[0]]: { faults: [{ offer: 2, kind: 'drop', delayNs: 5 }], latencyNs: 0 } }, examples: {} }, models);
    const cases = { options: { untilNs: 1 }, modelOptions: { [models[0]]: { maxSteps: 5 } }, examples: {} };
    assert.throws(() => checkModelOptionsUsed(cases, models[0], 0), /has no use case or test/);
    checkModelOptionsUsed(cases, models[0], 2);
    checkModelOptionsUsed(cases, models[1], 0);
});
