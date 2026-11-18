// WP5 of swa.ml 2.3 (state reactions, ADR 0023) is replaced in place by states in the flow and never ships
// (docs/proposals/STATES_IN_FLOW_PROPOSAL.md 4.7, 4.8, 7.3). What WP5 tested and what became of it:
// - completion transitions, guarded timers and internal transitions (a transition without a target): an if in a
//   state's braces or in an event line's block, and an event line that does not leave; their flow-state counterparts
//   (a line that does not leave keeps the timers, equal timers in written order, a suspended look, input queued while
//   the flow passes states) are in test/v2/states-in-flow.test.ts;
// - deferral and retention (WP5-R08 to WP5-R10, WP5-T03, SW2018 of WP5-D09): deleted; unhandled input is dropped while a
//   state waits (SIF-R05, SIF-R06) and what must be remembered is a variable written by a line (example 45);
// - CompletionLoop (WP5-R07, WP5-R12, WP5-T04, WP5-D03): deleted; StateLoop (SIF-R18) and SIF-D05 come with package 4;
// - SW2017 (WP5-D08) and the completion-guard rules (WP5-S02 to WP5-S07): deleted; SIF-D04 comes later (4.4);
// - the contextual word of deferral (WP5-S01, WP5-G03): it stays an ordinary name (test/v2/conditional-words-lists.test.ts);
// - the WP5 projection fields, formatter and recovery of the WP5 forms: the flow-state projection, formatter and
//   half-typed texts are in test/v2/states-in-flow.test.ts and test/v2/durations.test.ts.
// What stays here: the attribute access that read sets are built from, and the rewritten WP5 examples.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attributeAccess } from '../../src/language/semantic.js';
import { runCase } from '../../src/simulation/simulator.js';
import * as a from '../../src/language/generated/ast.js';
import { parse, valid } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });

const root = new URL('../../../', import.meta.url);

test('attributeAccess sees reads, writes, out arguments and the clock through callees (the read sets of SIF-R07)', async () => {
    const r = await valid(`package Test {
  component def M {
    attribute log: int = 0;
    attribute n: int = 0;
    attribute ok: bool = false;
    operation set() { ok = true; get(n); }
    operation get(out v: int) { v = 1; }
    operation flag() returns bool { return ok and log > 0; }
    operation run() { state A { on entry { set(); } if (flag()) exit; } state B { } }
    schedule { on start run(); }
  }
  component m: M;
}`);
    const def = r.model.packages[0].elements.find(a.isComponentDef)!;
    const run = def.members.find(m => a.isOperation(m) && m.name === 'run') as a.Operation;
    const state = run.body.statements[0] as a.StateStep;
    const entry = (state.statements[0] as a.StateAction).body, condition = (state.statements[1] as a.If).condition;
    const written = attributeAccess([entry], def), read = attributeAccess([condition], def);
    assert.deepEqual([[...written.writes].sort(), [...read.reads].sort(), written.clock], [['n', 'ok'], ['log', 'ok'], false]);
});

test('the WP5 examples rewritten as states in the flow pass their cases, deterministically', async () => {
    const expected: Record<string, string[]> = {
        'examples/44-session-completion.swaml': ['SessionCompletion::Opens after two refusals', 'SessionCompletion::Coverage loss during the request'],
        'examples/45-lock-deferral.swaml': ['LockDeferral::Requests during the pulse', 'LockDeferral::Request order across the pulse'],
        'examples/46-breaker-internal.swaml': ['BreakerInternal::Store outage trips the breaker and recovers'],
        'examples/47-reaction-forms.swaml': ['ReactionForms::Every form'],
    };
    for (const [file, cases] of Object.entries(expected)) {
        const r = await parse(readFileSync(new URL(file, root), 'utf8'));
        assert.deepEqual(r.doc.diagnostics?.filter(d => d.severity === 1).map(d => [d.code, d.message]), [], file);
        for (const name of cases) {
            const first = runCase([r.model], name, { untilNs: 10000000000 }), second = runCase([r.model], name, { untilNs: 10000000000 });
            assert.equal(first.result, 'pass', `${name}: ${first.message}`);
            assert.equal(JSON.stringify(first.run?.trace), JSON.stringify(second.run?.trace), `${name} is deterministic`);
        }
    }
});
