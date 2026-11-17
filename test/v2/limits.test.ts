import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, valid, run } from './helpers.js';

const model = (terms: number) => `package Test { component Demo { attribute n: int = 1; operation f() { n = ${Array.from({ length: terms }, () => 'n').join(' + ')}; } schedule { on start f(); } } }`;

test('a very deeply nested expression is reported instead of exhausting the stack', async () => {
    const r = await parse(model(3000));
    assert.deepEqual(r.errors.map(e => e.code), ['SW2000']);
    assert.match(String(r.errors[0].message), /nested more than 1000 levels deep/);
    // Just inside the limit the expression is checked and runs.
    await valid(model(1000));
    const result = await run(model(1000));
    assert.equal(Object.values(result.stores)[0].n, 1000, JSON.stringify(Object.keys(result.stores)));
});
