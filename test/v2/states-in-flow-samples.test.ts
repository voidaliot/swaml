// States in the flow, gate E for samples 1 to 7 (docs/proposals/STATES_IN_FLOW_PROPOSAL.md 7.4): every answer of the
// reading samples, run with the prototype's driver scripts, gives the observable behaviour the prototype recorded
// (test/fixtures/states-in-flow/reading-samples-1-to-7.txt, the P7 evidence with event line bodies named body).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSample } from './states-flow-harness.js';
import { readingSamples } from './states-flow-samples.js';

const expected = readFileSync(new URL('../../../test/fixtures/states-in-flow/reading-samples-1-to-7.txt', import.meta.url), 'utf8').replaceAll('\r\n', '\n').trimEnd();
const sections = new Map<string, string>();
for (const part of expected.split(/^# Sample /m).filter(Boolean))
    sections.set(part.slice(0, part.indexOf(' ')), '# Sample ' + part.trimEnd());

for (const [n, { s, q }] of Object.entries(readingSamples))
    test(`reading sample ${n} (${s.pkg}): every answer as the prototype measured`, async () => {
        const out = [`# Sample ${n} (${s.pkg})`];
        for (const [name, script, until] of q)
            out.push((await runSample(s, name, script, until)).text);
        assert.equal(out.join('\n'), sections.get(n));
    });
