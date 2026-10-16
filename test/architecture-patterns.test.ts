import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';
import { simulate, type SimulationOptions } from '../src/simulation/simulator.js';

async function model(name: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const text = readFileSync(new URL(`../../examples/${name}.swaml`, import.meta.url), 'utf8');
    const document = await parseHelper<Model>(Swaml)(text, { validation: true });
    assert.deepEqual(document.diagnostics, []);
    return document.parseResult.value;
}

test('Classic climate controller commands a safe fallback when calibration times out', async () => {
    const source = await model('11-autosar-classic');
    const options = { untilNs: 19000000, latencyNs: 100000 };
    const baseline = simulate([source], 'ClassicClimate::Vehicle', options);
    const request = baseline.trace.find(t => t.kind === 'emission' && t.route === 'calibrated');
    assert.ok(request);
    const result = simulate([source], 'ClassicClimate::Vehicle', {
        ...options, faults: [{ offer: request.offer as number, kind: 'drop' }]
    });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.ok(result.trace.some(t => t.kind === 'requestComplete' && t.failure === 'Timeout'));
    assert.equal(result.stores['controller.control'].lastTemperature, 28);
    assert.equal(result.stores['controller.control'].commandedDuty, 0);
    assert.equal(result.stores.actuator.appliedDuty, 0);
    assert.ok(result.trace.some(t => t.kind === 'delivery' && t.route === 'commanded'));
    assert.equal(result.deployments['controller.control'], 'system:bodyEcu');
});

test('web checkout rejects a failed inventory route without changing stock or publishing acceptance', async () => {
    const source = await model('13-web-application');
    const options = { untilNs: 2000000000, latencyNs: 1000000 };
    const baseline = simulate([source], 'WebShop::Production', options);
    const request = baseline.trace.find(t => t.kind === 'emission' && t.route === 'inventoryLink');
    assert.ok(request);
    const result = simulate([source], 'WebShop::Production', {
        ...options, faults: [{ offer: request.offer as number, kind: 'transport' }]
    });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.ok(result.trace.some(t => t.kind === 'requestComplete' && t.failure === 'Transport'));
    assert.equal(result.stores.browser.accepted, false);
    assert.equal(result.stores.browser.lastOrder, '');
    assert.equal(result.stores['inventory.stock'].available, 10);
    assert.equal(result.stores['application.checkout'].acceptedOrders, 0);
    assert.equal(result.stores.mailer.sent, 0);
    assert.ok(!result.trace.some(t => t.kind === 'emission' && t.route === 'receiptLink'));
});

for (const route of ['brokerLink', 'analyticsLink', 'archiveLink']) {
    test(`cloud telemetry tolerates duplicate delivery on ${route} within its ordered stream`, async () => {
        const source = await model('14-cloud-service');
        const options: SimulationOptions = JSON.parse(readFileSync(
            new URL('../../examples/simulation/14-cloud-service.json', import.meta.url), 'utf8'
        ));
        const baseline = simulate([source], 'CloudTelemetry::Production', options);
        const emission = baseline.trace.find(t => t.kind === 'emission' && t.route === route);
        assert.ok(emission);
        const result = simulate([source], 'CloudTelemetry::Production', {
            ...options, faults: [{ offer: emission.offer as number, kind: 'duplicate' }]
        });
        assert.equal(result.outcome, 'no-failure-observed');
        assert.ok(result.trace.some(t => t.kind === 'delivery' && t.route === route && t.attempt === 2));
        assert.equal(result.stores['ingestion.gateway'].acceptedCount, 2);
        assert.equal(result.stores.broker.forwarded, 2);
        assert.equal(result.stores.analytics.processed, 2);
        assert.equal(result.stores.archive.records, 2);
        assert.equal(result.stores.device.retryAccepted, true);
        assert.equal(result.stores.device.invalidRejected, true);
        assert.equal(result.stores.analytics.latestTemperature, 28.5);
    });
}

test('cloud ingestion acceptance does not hide a partial broker fanout failure', async () => {
    const source = await model('14-cloud-service');
    const options: SimulationOptions = JSON.parse(readFileSync(
        new URL('../../examples/simulation/14-cloud-service.json', import.meta.url), 'utf8'
    ));
    const baseline = simulate([source], 'CloudTelemetry::Production', options);
    const emission = baseline.trace.find(t => t.kind === 'emission' && t.route === 'analyticsLink');
    assert.ok(emission);
    const result = simulate([source], 'CloudTelemetry::Production', {
        ...options, faults: [{ offer: emission.offer as number, kind: 'transport' }]
    });
    assert.equal(result.outcome, 'failed');
    assert.ok(result.trace.some(t => t.kind === 'failure' && t.function === 'broker.route' && t.code === 'Transport'));
    assert.equal(result.stores.device.uploaded, 2);
    assert.equal(result.stores.device.retryAccepted, true);
    assert.equal(result.stores['ingestion.gateway'].acceptedCount, 2);
    assert.equal(result.stores.broker.forwarded, 1);
    assert.equal(result.stores.analytics.processed, 1);
    assert.equal(result.stores.archive.records, 2);
    assert.equal(result.stores.analytics.lastSequence, 2);
    assert.equal(result.stores.archive.lastSequence, 2);
});
