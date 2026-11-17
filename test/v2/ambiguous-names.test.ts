import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, workspace } from './helpers.js';

const requirements = 'package Reqs { requirement Braking { /** Brake on request. */ } requirement Steering { } }';
const app = (links: string) => `package App { import Reqs; component def Unit { } component unit: Unit; test Braking of unit { } ${links} }`;
const errors = (docs: { diagnostics?: { severity?: number }[] }[]) => docs.flatMap(d => (d.diagnostics ?? []).filter(x => x.severity === 1)) as { code: string, message: string, relatedInformation?: { message: string }[] }[];

test('a case named like an imported requirement is reported as an ambiguous name naming both declarations', async () => {
    const { docs } = await workspace([requirements, app('satisfy Braking by unit; verify Braking by Braking;')]);
    const found = errors(docs);
    assert.equal(found.length, 2);
    for (const e of found) {
        assert.equal(e.code, 'SW2001');
        assert.equal(e.message, 'Ambiguous name Braking: it names test App::Braking and requirement Reqs::Braking (imported). A short name must name one visible declaration; qualify the reference (Reqs::Braking) or rename one declaration.');
        assert.deepEqual(e.relatedInformation?.map(r => r.message), ['Declaration App::Braking', 'Declaration Reqs::Braking']);
    }
});

test('qualified references resolve the requirement and the local test still resolves for verify', async () => {
    const { docs } = await workspace([requirements, app('satisfy Reqs::Braking by unit; verify Reqs::Braking by Braking; verify Steering by Braking;')]);
    assert.deepEqual(errors(docs).map(e => e.message), []);
});

test('two imports sharing a name and quoted names are explained too', async () => {
    const { docs } = await workspace(['package A { requirement \'Stop safely\' { } }', 'package B { requirement \'Stop safely\' { } }', 'package C { import A; import B; component def U { } component u: U; satisfy \'Stop safely\' by u; }']);
    assert.deepEqual(errors(docs).map(e => e.message), ["Ambiguous name 'Stop safely': it names requirement A::'Stop safely' (imported) and requirement B::'Stop safely' (imported). A short name must name one visible declaration; qualify the reference (A::'Stop safely' or B::'Stop safely') or rename one declaration."]);
    assert.deepEqual(errors(docs).flatMap(e => e.relatedInformation?.map(r => r.message) ?? []), ["Declaration A::'Stop safely'", "Declaration B::'Stop safely'"]);
});

test('an unknown or wrongly typed name keeps the unresolved-reference message', async () => {
    const { docs } = await workspace([requirements, app('satisfy Missing by unit; satisfy unit by unit;')]);
    assert.deepEqual(errors(docs).map(e => [e.code, e.message]), [['SW2001', "Could not resolve reference to Requirement named 'Missing'."], ['SW2001', "Could not resolve reference to Requirement named 'unit'."]]);
});

test('ambiguity diagnostics survive malformed sources', async () => {
    const r = await parse('package Reqs { requirement Braking { } } package App { import Reqs; component def Unit { } component unit: Unit; test Braking of unit { } satisfy Braking by unit; verify Braking by ; }');
    assert.ok(r.errors.some(e => e.code === 'SW2000'));
    assert.ok(r.errors.some(e => e.code === 'SW2001' && String(e.message).startsWith('Ambiguous name Braking')));
});

test('ambiguity advice only suggests qualified names that resolve', async () => {
    // A duplicate inside one package stays ambiguous when qualified, so only the other package is suggested.
    const { docs } = await workspace(['package A { requirement R { } requirement R { } }', 'package B { requirement R { } }', 'package C { import A; import B; component def U { } component u: U; satisfy R by u; }']);
    const message = String(errors(docs).find(e => e.message.startsWith('Ambiguous name R'))?.message);
    assert.ok(message.endsWith('qualify the reference (B::R) or rename one declaration.'), message);
    // When no qualified name of the expected kind resolves, only renaming is advised.
    const r = await workspace(['package A { component def R { } }', 'package C { import A; component def U { } component u: U; test R of u { } satisfy R by u; }']);
    assert.ok(errors(r.docs).some(e => String(e.message).endsWith('A short name must name one visible declaration; rename one declaration.')), JSON.stringify(errors(r.docs).map(e => e.message)));
});
