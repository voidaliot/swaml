// Compatibility gate 1 of swa.ml 2.3 (rule WP1a-M01): every repository .swaml file parses to the same AST
// under the kept 2.2 grammar and the current grammar, after normalization N1. The corpus, N1 and the
// fixture are defined in scripts/compatibility-2-2.mjs; the recorded digests are in
// test/fixtures/compatibility-2-2/ast.json.
import test from 'node:test';
import assert from 'node:assert/strict';

interface Gate { checkAst(): Promise<{ report: string; failures: string[]; compared: string[]; skipped: string[] }>; corpus(): string[] }
const gate = async () => await import(new URL('../../../scripts/compatibility-2-2.mjs', import.meta.url).href) as Gate;

test('gate 1: every repository .swaml file keeps its 2.2 AST under N1', async t => {
    const { checkAst, corpus } = await gate();
    const { report, failures, compared, skipped } = await checkAst();
    t.diagnostic(report);
    assert.deepEqual(failures, [], report + '\n' + failures.join('\n'));
    // Every corpus file is either compared or listed as a 2.2 parse error; the showcase models are compared.
    assert.deepEqual(corpus().filter(path => !compared.includes(path) && !skipped.includes(path)), []);
    for (const path of corpus().filter(path => path.startsWith('examples/showcase/')))
        assert.ok(compared.includes(path), `${path} is compared`);
});
