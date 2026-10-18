import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import * as a from '../src/language/generated/ast.js';

async function parse(source: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const doc = await parseHelper<a.Model>(Swaml)(source, { validation: true });
    assert.ok(!doc.diagnostics?.some(d => /error occurred during validation/.test(String(d.message))), JSON.stringify(doc.diagnostics));
    return doc;
}

for (const kind of ['useCase', 'verificationCase'] as const) {
    test(`${kind} selects its root with of and shares the view subject vocabulary`, async () => {
        const doc = await parse(`package P { component Demo {} ${kind} Story of Demo { doc /* Describe this root. */ } view story sv of Story; }`);
        assert.deepEqual(doc.diagnostics, []);
        const scenario = doc.parseResult.value.packages[0].elements.find(a.isScenario)!;
        assert.equal(scenario.kind, kind);
        assert.equal(scenario.root.ref?.name, 'Demo');
    });

    test(`${kind} rejects the former for root relation`, async () => {
        const doc = await parse(`package P { component Demo {} ${kind} Story for Demo {} }`);
        assert.ok(doc.parseResult.parserErrors.length > 0);
        assert.ok(doc.diagnostics?.some(d => d.severity === 1));
    });

    test(`${kind} of resolves imported and qualified roots without widening scope`, async () => {
        const { Swaml, shared } = createSwamlServices(EmptyFileSystem);
        const read = parseHelper<a.Model>(Swaml);
        const library = await read('package Library { component Demo {} }', { documentUri: `file:///${kind}-library.swaml` });
        const application = await read(`package Application { import Library::*; ${kind} Imported of Demo {} ${kind} Qualified of Library::Demo {} }`, { documentUri: `file:///${kind}-application.swaml` });
        await shared.workspace.DocumentBuilder.build([library, application], { validation: true });
        assert.deepEqual(library.diagnostics, []);
        assert.deepEqual(application.diagnostics, []);
        const scenarios = application.parseResult.value.packages[0].elements.filter(a.isScenario);
        assert.equal(scenarios.length, 2);
        assert.ok(scenarios.every(scenario => scenario.root.ref === library.parseResult.value.packages[0].elements[0]));
        const unrelated = await parse(`package Library { component Demo {} } package Application { ${kind} Hidden of Demo {} }`);
        assert.ok(unrelated.diagnostics?.some(d => d.severity === 1));
    });

    test(`${kind} of rejects missing roots, definition subjects and malformed bodies safely`, async () => {
        for (const declaration of [`${kind} Story of {}`, `${kind} Story of Demo {`, `${kind} Story of Missing {}`]) {
            const doc = await parse(`package P { component Demo {} ${declaration} }`);
            assert.ok(doc.diagnostics?.some(d => d.severity === 1), declaration);
        }
        const doc = await parse(`package P { component def Definition {} ${kind} Story of Definition {} }`);
        assert.ok(doc.diagnostics?.some(d => d.severity === 1));
    });
}

test('satisfy of preserves the design source, requirement target and alias duplicate check', async () => {
    const doc = await parse('package P { requirement R {} component def Worker {} component Demo { component worker: Worker; } satisfy R of Demo.worker; }');
    assert.deepEqual(doc.diagnostics, []);
    const relation = doc.parseResult.value.packages[0].satisfactions[0];
    assert.equal(relation.requirement.ref?.name, 'R');
    assert.equal(relation.source, 'Demo.worker');
    const duplicate = await parse('package P { requirement R {} component Demo {} satisfy R of Demo; satisfy R of P.Demo; }');
    assert.ok(duplicate.diagnostics?.some(d => d.code === 'SW090'));
});

for (const relation of ['by', 'for']) {
    test(`satisfy rejects ${relation} as an alternative to of`, async () => {
        const doc = await parse(`package P { requirement R {} component Demo {} satisfy R ${relation} Demo; }`);
        assert.ok(doc.parseResult.parserErrors.length > 0);
        assert.ok(doc.diagnostics?.some(d => d.severity === 1));
    });
}

test('satisfy of retains imported and qualified requirement resolution', async () => {
    const { Swaml, shared } = createSwamlServices(EmptyFileSystem);
    const read = parseHelper<a.Model>(Swaml);
    const library = await read('package Requirements { requirement R {} }', { documentUri: 'file:///requirement-library.swaml' });
    const application = await read('package Design { import Requirements::*; component First {} component Second {} satisfy R of First; satisfy Requirements::R of Second; }', { documentUri: 'file:///requirement-design.swaml' });
    await shared.workspace.DocumentBuilder.build([library, application], { validation: true });
    assert.deepEqual(library.diagnostics, []);
    assert.deepEqual(application.diagnostics, []);
    assert.ok(application.parseResult.value.packages[0].satisfactions.every(relation => relation.requirement.ref === library.parseResult.value.packages[0].elements[0]));
});
