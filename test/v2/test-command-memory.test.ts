import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { valid } from './helpers.js';
import { eachTest, runTests } from '../../src/simulation/simulator.js';

const main = fileURLToPath(new URL('../../src/cli/main.js', import.meta.url));
/** Cases whose runs each record tens of thousands of observations: a 1 ms period for several seconds. */
function longCasesModel(cases: number, seconds: number): string {
    let s = 'package Long {\n  component def Ticker {\n    attribute n: int = 0;\n    operation tick() {\n      n = n + 1;\n    }\n    schedule {\n      on every 1ms tick();\n    }\n  }\n  component ticker: Ticker;\n';
    for (let i = 0; i < cases; i++)
        s += `  test 'Long run ${i}' of ticker {\n    wait ${seconds}s;\n    assert ticker.n > 0;\n  }\n`;
    return s + '}\n';
}

test('eachTest runs a case only when the previous result is consumed and matches runTests', async () => {
    const r = await valid(longCasesModel(3, 1)), options = { untilNs: 2_000_000_000, maxSteps: 1_000_000 };
    const iterator = eachTest([r.model], options), first = iterator.next();
    assert.equal(first.done, false);
    assert.equal(first.value.case, 'Long::Long run 0');
    const rest = [...iterator];
    assert.deepEqual([first.value, ...rest], runTests([r.model], options));
    assert.ok(first.value.run!.trace.length > 3000);
});

test('swaml test keeps one case run at a time: twelve long cases fit a 48 MB heap in text mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'swaml-test-memory-'));
    try {
        const model = join(dir, 'long.swaml'), options = join(dir, 'options.json');
        writeFileSync(model, longCasesModel(12, 5));
        writeFileSync(options, JSON.stringify({ untilNs: 10_000_000_000, maxSteps: 10_000_000 }));
        // Holding every run's trace until the end needed more than 64 MB of heap for this model.
        const text = spawnSync(process.execPath, ['--max-old-space-size=48', main, 'test', '--options', options, model], { encoding: 'utf8' });
        assert.equal(text.status, 0, text.stderr.slice(0, 2000));
        assert.match(text.stdout, /12 case\(s\): 12 pass, 0 fail, 0 inconclusive, 0 no checks\./);
        // JSON keeps each case's serialized text only; its cases array is written piece by piece.
        writeFileSync(model, longCasesModel(3, 1));
        const json = spawnSync(process.execPath, [main, 'test', '--json', '--options', options, model], { encoding: 'utf8', maxBuffer: 1 << 30 });
        assert.equal(json.status, 0, json.stderr.slice(0, 2000));
        // Streaming the cases array keeps the exact layout of one JSON.stringify of the report.
        const report = JSON.parse(json.stdout);
        assert.equal(JSON.stringify(report, null, 2) + '\n', json.stdout);
        assert.deepEqual(report.summary, { pass: 3, fail: 0, inconclusive: 0, noChecks: 0 });
        assert.deepEqual(report.cases.map((c: { case: string }) => c.case), ['Long::Long run 0', 'Long::Long run 1', 'Long::Long run 2']);
        assert.equal(report.cases[0].run.sources, undefined);
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
