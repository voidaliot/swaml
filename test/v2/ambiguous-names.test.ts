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
        assert.equal(e.message, 'Ambiguous name Braking: it names requirement Reqs::Braking (imported) and test App::Braking. A short name must name one visible declaration; qualify the reference (Reqs::Braking or App::Braking) or rename one declaration.');
        assert.deepEqual(e.relatedInformation?.map(r => r.message), ['Declaration Reqs::Braking', 'Declaration App::Braking']);
    }
});

test('qualified references resolve the requirement and the local test still resolves for verify', async () => {
    const { docs } = await workspace([requirements, app('satisfy Reqs::Braking by unit; verify Reqs::Braking by Braking; verify Steering by Braking;')]);
    assert.deepEqual(errors(docs).map(e => e.message), []);
});

test('two imports sharing a name and quoted names are explained too', async () => {
    const { docs } = await workspace(['package A { requirement \'Stop safely\' { } }', 'package B { requirement \'Stop safely\' { } }', 'package C { import A; import B; component def U { } component u: U; satisfy \'Stop safely\' by u; }']);
    assert.deepEqual(errors(docs).map(e => e.message), ["Ambiguous name 'Stop safely': it names requirement A::'Stop safely' (imported) and requirement B::'Stop safely' (imported). A short name must name one visible declaration; qualify the reference (A::'Stop safely' or B::'Stop safely') or rename one declaration."]);
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
