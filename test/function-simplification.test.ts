import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';
import type { Model } from '../src/language/generated/ast.js';
import { simulate } from '../src/simulation/simulator.js';

async function parse(source: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const doc = await parseHelper<Model>(Swaml)(`package P { ${source} }`, { validation: true });
    assert.ok(!doc.diagnostics?.some(d => /error occurred during validation/.test(String(d.message))));
    return doc;
}
for (const [name, source, code] of [
    ['component calculation', 'component Demo { calc value { return result: int = 1; } }', undefined],
    ['calculation in nested block', 'component Demo { function run() { if (true) { calc value { return result: int = 1; } } } }', undefined],
    ['calculation after a statement', 'component Demo { function run() { assert true; calc value { return result: int = 1; } } }', undefined],
    ['sibling calculation scope', 'component Demo { function first() { calc value { return result: int = 1; } } function second() { assert value() == 1; } }', undefined],
    ['initializer calculation scope', 'component Demo { var x: int = value(); function run() { calc value { return result: int = 1; } } }', undefined],
    ['capture of function parameter', 'component Demo { function run(input: int) { calc value { return result: int = input; } } }', 'SW022'],
    ['unused calculation cycle', 'component Demo { function run() { calc first { return result: int = second(); } calc second { return result: int = first(); } } }', 'SW056'],
    ['missing local result binding', 'component Demo { function value(): int { return 1; } function run() { call value(); } }', 'SW058'],
    ['void local result binding', 'component Demo { function value() {} function run() { call value() as x; } }', 'SW058'],
    ['call binding shadows data', 'component Demo { var x: int = 0; function value(): int { return 1; } function run() { call value() as x; } }', 'SW002'],
    ['triggered local call', 'component Demo { function value(): int on manual { return 1; } function run() { call value() as x; } }', 'SW058'],
    ['non-returning empty body', 'component Demo { function value(): int {} }', 'SW053'],
    ['wrong result use', 'component Demo { function value(): int { return 1; } function run() { call value() as x; var y: string = x; } }', 'SW023'],
    ['non-terminating result path', 'component Demo { function value(x: bool): int { if (x) { return 1; } } }', 'SW053'],
    ['malformed local call', 'component Demo { function run() { call value( as ; } }', undefined],
    ['malformed routed call', 'component Demo { function run() { call api.value() as x otherwise {}; } }', undefined],
    ['retired local verb', 'component Demo { function helper() {} function run() { invoke helper(); } }', undefined],
    ['retired local declaration', 'component Demo { function run() { let x: int = 0; } }', undefined],
    ['retired routed verb', 'component Demo { function run() { request api.value() as x within 1 s otherwise { return; }; } }', undefined],
] as const) test(`simplification rejects ${name}`, async () => {
    const doc = await parse(source);
    assert.ok(doc.diagnostics?.some(d => d.severity === 1 && (!code || d.code === code)), JSON.stringify(doc.diagnostics));
});

test('local values return through specialized helpers with isolated lexical calculations', async () => {
    const doc = await parse(`
        datatype Result { items: int[2]; }
        component def Base {
            var count: int = 0;
            function value(input: int): Result {
                calc next { in x: int; return result: int = x + 1; }
                count = count + 1;
                return record Result { items = [input, next(input)]; };
            }
            function boot() on start {
                calc next { in x: int; return result: int = x + 100; }
                call value(2) as result;
                assert result.items[1] == 4;
                assert next(2) == 102;
                result = record Result { items = [0, 0]; };
                assert count == 1;
            }
        }
        component def Derived specializes Base {
            redefines function value(input: int): Result {
                calc next { in x: int; return result: int = x + 2; }
                count = count + 1;
                return record Result { items = [input, next(input)]; };
            }
        }
        component Demo { component left: Derived; component right: Derived; }
    `);
    assert.deepEqual(doc.diagnostics, []);
    const result = simulate([doc.parseResult.value], 'P::Demo', { untilNs: 10 });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.deepEqual(result.stores, { left: { count: 1 }, right: { count: 1 }, '': {} });
});

test('function calculations are visible in guards, entries, exits and effects', async () => {
    const doc = await parse(`component Demo {
        var count: int = 0;
        function machine() on start {
            calc next { in x: int; return result: int = x + 1; }
            initial First;
            state First { entry { count = next(count); } exit { count = next(count); } }
            state Done final { entry { count = next(count); } }
            transition finish: First -> Done on completion when (next(count) == 2) { count = next(count); }
        }
    }`);
    assert.deepEqual(doc.diagnostics, []);
    const result = simulate([doc.parseResult.value], 'P::Demo', { untilNs: 10 });
    assert.equal(result.outcome, 'no-failure-observed');
    assert.equal(result.stores[''].count, 4);
});

test('local result failure preserves preceding effects and prevents binding or continuation', async () => {
    const doc = await parse(`component Demo {
        var count: int = 0;
        function value(): byte { count = 1; var oversized: int = 256; return oversized; }
        function boot() on start { call value() as result; count = 2; }
    }`);
    assert.deepEqual(doc.diagnostics, []);
    const result = simulate([doc.parseResult.value], 'P::Demo', { untilNs: 10 });
    assert.equal(result.outcome, 'failed');
    assert.equal(result.stores[''].count, 1);
    assert.ok(result.trace.some(e => e.kind === 'failure' && e.code === 'Bounds'));
});
