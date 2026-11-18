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

// Amendments are the only reviewed way to change one recorded gate-1 expectation. Each failure mode fails.
type Recorded = { references: string[]; diagnostics: string[]; types: Record<string, string> };
type Amendment = { file?: string; kind?: string; key?: string; recorded?: string; current?: string; rule?: string; reason?: string };
interface Amend { amendmentProblems(a: Amendment[], files: Record<string, Recorded>, known?: unknown): string[]; resolutionDifferences(path: string, recorded: Recorded, actual: Recorded, a: Amendment[]): string[] }
const recorded: Recorded = { references: ['1:1 X.y A -> B'], diagnostics: ['warning SW2011 3:5-3:9 A read before suspension.'], types: { '10:5 BinaryExpression': 'int' } };
const amend = async () => await import(new URL('../../../scripts/compatibility-2-2.mjs', import.meta.url).href) as Amend;
const reword: Amendment = { file: 'm.swaml', kind: 'diagnostic', recorded: recorded.diagnostics[0], current: 'warning SW2011 3:5-3:9 A read made before a suspension.', rule: 'WP4-D06', reason: 'reworded' };

test('gate 1 amendments: a valid amendment replaces exactly one recorded diagnostic or type', async () => {
    const { amendmentProblems, resolutionDifferences } = await amend();
    const typed: Amendment = { file: 'm.swaml', kind: 'type', key: '10:5 BinaryExpression', recorded: 'int', current: 'uint', rule: 'ADR 0022', reason: 'promotion' };
    assert.deepEqual(amendmentProblems([reword, typed], { 'm.swaml': recorded }), []);
    const actual = { ...recorded, diagnostics: [reword.current!], types: { '10:5 BinaryExpression': 'uint' } };
    assert.deepEqual(resolutionDifferences('m.swaml', recorded, actual, [reword, typed]), []);
    assert.ok(resolutionDifferences('m.swaml', recorded, actual, []).length >= 2, 'without the amendments both changes fail');
});

test('gate 1 amendments: stale, unused, duplicate, unjustified and reference amendments fail', async () => {
    const { amendmentProblems, resolutionDifferences } = await amend();
    const files = { 'm.swaml': recorded };
    assert.match(amendmentProblems([{ ...reword, recorded: 'warning SW2011 9:9-9:9 gone' }], files).join(), /stale/u);
    assert.match(amendmentProblems([reword, { ...reword }], files).join(), /duplicate/u);
    assert.match(amendmentProblems([{ ...reword, rule: undefined }], files).join(), /rule identifier/u);
    assert.match(amendmentProblems([{ ...reword, rule: 'because' }], files).join(), /rule identifier/u);
    assert.match(amendmentProblems([{ ...reword, reason: '' }], files).join(), /reason/u);
    assert.match(amendmentProblems([{ ...reword, kind: 'reference', recorded: recorded.references[0] }], files).join(), /never amended/u);
    assert.match(amendmentProblems([{ ...reword, file: 'other.swaml' }], files).join(), /stale/u);
    assert.match(resolutionDifferences('m.swaml', recorded, recorded, [reword]).join(), /unused amendment/u);
});

test('gate 1 amendments: a 2.2 source never gains an error or a new diagnostic and keeps its known types', async () => {
    const { amendmentProblems, resolutionDifferences } = await amend();
    const files = { 'm.swaml': recorded };
    const problem = (a: Amendment) => amendmentProblems([{ ...reword, ...a }], files).join('\n');
    assert.match(problem({ current: 'error SW2011 3:5-3:9 A read before suspension.' }), /only the message/u);
    assert.match(problem({ current: 'hint SW9999 1:1-1:1 Anything.' }), /only the message/u);
    assert.match(problem({ current: 'warning SW2011 4:5-4:9 A read before suspension.' }), /only the message/u);
    assert.match(problem({ rule: 'WP4-D99' }), /neither/u);
    assert.match(problem({ rule: 'ADR 0099' }), /neither/u);
    assert.match(problem({ rule: 'WP1a-M01' }), /cannot justify/u);
    const typed: Amendment = { file: 'm.swaml', kind: 'type', key: '10:5 BinaryExpression', recorded: 'int', rule: 'ADR 0022', reason: 'promotion' };
    assert.match(amendmentProblems([{ ...typed, current: '?' }], files).join(), /known type/u);
    assert.match(amendmentProblems([{ ...typed, current: 'unknown' }], files).join(), /known type/u);
    // A cited rule may retire a warning, never an error.
    const removal: Amendment = { ...reword, current: null as unknown as string };
    assert.deepEqual(amendmentProblems([removal], files), []);
    assert.deepEqual(resolutionDifferences('m.swaml', recorded, { ...recorded, diagnostics: [] }, [removal]), []);
    assert.match(resolutionDifferences('m.swaml', recorded, recorded, [removal]).join(), /still produced/u);
    const withError = { ...recorded, diagnostics: ['error SW2005 2:1-2:4 Needs one owner.'] };
    assert.match(amendmentProblems([{ ...removal, recorded: withError.diagnostics[0] }], { 'm.swaml': withError }).join(), /only a warning/u);
    // A new diagnostic is never amendable: it fails as a difference whatever the amendments say.
    assert.match(resolutionDifferences('m.swaml', recorded, { ...recorded, diagnostics: [...recorded.diagnostics, 'warning SW2016 5:1-5:2 New.'] }, []).join(), /not in 3\.1\.0/u);
});

test('gate 1 amendments: the rule index finds the 2.3 draft rules and the ADRs', async () => {
    const { knownRules } = await import(new URL('../../../scripts/compatibility-2-2.mjs', import.meta.url).href) as { knownRules(): { rules: Set<string>; adrs: Set<string> } };
    const { rules, adrs } = knownRules();
    assert.ok(rules.has('WP4-D06') && rules.has('WP8-S08') && adrs.has('ADR 0022') && adrs.has('ADR 0025'));
    assert.ok(!rules.has('WP4-D99') && !adrs.has('ADR 0099'));
    assert.equal(rules.size, 208, 'every WPn-Kxx row of the drafts (the draft index counts 208)');
});
