import nodeTest from 'node:test';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invalid, parse, valid } from './helpers.js';
import { runCase, runTests, simulate, type CaseResult } from '../../src/simulation/simulator.js';
import { caseTarget, nodes, resolveStatement } from '../../src/language/semantic.js';
import { formatDocument } from '../../src/language/formatter.js';
import * as a from '../../src/language/generated/ast.js';
/** A package whose subject atm is exercised by cases acting as the interface-only customer and bank stub. */
const bank = (cases = '', extra = '') => `package Banking {
  import Swaml::Views;
  port def Panel {
    provides attribute amount: uint;
    provides event cashRequested();
    requires event cashOut(paid: uint);
    requires event refused();
    requires operation balance() returns uint;
  }
  port def BankLink { requires operation authorize(amount: uint) returns bool; }
  component def Customer { port panel: Panel; }
  component def BankPeer { reversed port link: BankLink; }
  component def BankHost {
    reversed port link: BankLink;
    operation authorize(amount: uint) returns bool { return amount <= 500; }
    schedule { on call link.authorize(amount) authorize(amount); }
  }
  component def Counter { attribute count: uint = 0; }
  component def ATM {
    reversed port panel: Panel;
    port link: BankLink;
    component counter: Counter;
    attribute amount: uint = 0;
    attribute paid: uint = 7;
    operation fee(value: real, percent: real) returns real { return value * percent / 100.0; }
    operation reset() { paid = 0; }
    operation ping() { wait 1ms; }
    operation remember(value: uint) { amount = value; }
    operation balance() returns uint { return amount; }
    operation withdraw() {
      var requested: uint = amount;
      var ok: bool = try(link.authorize(requested), false);
      if (ok) { publish panel.cashOut(requested); } else { publish panel.refused(); }
    }
    schedule { on receive panel.amount(value) remember(value); on receive panel.cashRequested() withdraw(); on call panel.balance() balance(); }
  }
  component atm: ATM;
  component customer: Customer;
  component bank: BankPeer;
  connect (customer.panel, atm.panel);
  connect (atm.link, bank.link);
  ${cases}
  associate customer to Script;
  associate bank to Script;
  ${extra}
}`;
/** One case named Script with the given kind and statements. */
const script = (statements: string, kind = 'test', extra = '') => bank(`${kind} Script of atm { ${statements} }`, extra);
const withdraw = `send customer.panel.amount(200);
    publish customer.panel.cashRequested();
    on call bank.link.authorize(amount) { return amount <= 500; } or after 1s { fail "no authorization"; }
    on receive customer.panel.cashOut(paid) { assert paid == 200; } or after 1s { fail "no cash"; }`;
const errors = async (source: string, code: string) => (await parse(source)).errors.filter(e => e.code === code).map(e => String(e.message));
const options = { untilNs: 10000000000 };
async function result(source: string, name = 'Banking::Script', o: Parameters<typeof runCase>[2] = options): Promise<CaseResult> { return runCase([(await valid(source)).model], name, o); }

// Validation: the environment role of a case script.
test('a use case and a test act through ports of associated interface-only components', async () => {
    await valid(script(withdraw, 'use case'));
    await valid(script(withdraw));
});
test('statements require of', async () => {
    const r = await parse(bank('test Script { wait 1ms; }'));
    const d = r.errors.find(e => e.code === 'SW2010' && String(e.message).includes('require of'))!;
    assert.ok(d);
    assert.equal(r.doc.textDocument.getText(d.range), 'Script');
    await valid(bank('test Script { /** Intent only. */ }'));
});
test('a scripted component is associated and interface-only, and never the subject', async () => {
    const unassociated = bank('test Script of atm { publish customer.panel.cashRequested(); }').replace('associate customer to Script;', '');
    const r = await parse(unassociated), d = r.errors.find(e => String(e.message).includes('only when associated'))!;
    assert.equal(d.code, 'SW2010');
    assert.equal(r.doc.textDocument.getText(d.range), 'customer.panel.cashRequested');
    const behaving = script('on call bank.link.authorize(amount) { return true; }').replace('component bank: BankPeer;', 'component bank: BankHost;');
    assert.ok((await errors(behaving, 'SW2010')).some(m => m.includes('interface-only')));
    assert.ok((await errors(script('publish atm.panel.cashOut(1);'), 'SW2010')).some(m => m.includes('environment of its subject atm')));
});
test('script endpoints follow the actor port directions and kinds', async () => {
    assert.ok((await errors(script('publish customer.panel.cashOut(1);'), 'SW2004')).some(m => m.includes('needs a provides event')));
    assert.ok((await errors(script('send customer.panel.cashRequested();'), 'SW2004')).some(m => m.includes('needs a provides attribute')));
    assert.ok((await errors(script('on receive customer.panel.cashRequested() { }'), 'SW2005')).some(m => m.includes('needs a requires attribute or event')));
    assert.ok((await errors(script('on call customer.panel.cashOut(paid) { }'), 'SW2005')).some(m => m.includes('needs a provides operation')));
    assert.ok((await errors(script('var ok: bool = bank.link.authorize(1);'), 'SW2004')).some(m => m.includes('needs a requires operation')));
    assert.ok((await errors(script('publish panel.cashRequested();'), 'SW2004')).some(m => m.includes('occurrence.port.member')));
    assert.ok((await errors(script('publish customer.nothing.cashRequested();'), 'SW2004')).length);
    // The binding types follow the actor's member.
    assert.ok((await errors(script('on receive customer.panel.cashOut(paid) { var s: string = paid; }'), 'SW2002')).length);
    assert.ok((await errors(script('on receive customer.panel.cashOut(a, b) { }'), 'SW2002')).some(m => m.includes('bindings')));
});
test('operations keep port.member endpoints and serve requests through schedules', async () => {
    const three = bank().replace('operation reset() { paid = 0; }', 'operation reset() { publish atm.panel.cashOut(1); }');
    assert.ok((await errors(three, 'SW2004')).some(m => m.includes('belong to case scripts')));
    const receive = bank().replace('operation reset() { paid = 0; }', 'operation reset() { on receive atm.panel.amount(v) { } }');
    assert.ok((await errors(receive, 'SW2005')).some(m => m.includes('belong to case scripts')));
    const call = bank().replace('operation reset() { paid = 0; }', 'operation reset() { on call panel.amount(v) { } }');
    assert.ok((await errors(call, 'SW2006')).some(m => m.includes('on call branches')));
});
test('a use case is a black box; a test may read and call into its subject', async () => {
    await valid(script('assert atm.fee(20, 10) == 2; assert atm.paid == 7 and atm.counter.count == 0; atm.reset();'));
    assert.ok((await errors(script('assert atm.paid == 7;', 'use case'), 'SW2010')).some(m => m.includes('black box')));
    assert.ok((await errors(script('assert atm.fee(20, 10) == 2;', 'use case'), 'SW2010')).some(m => m.includes('black box')));
    // Only the subject and its parts, never another participant.
    const other = script('assert bank.anything == 1;');
    assert.ok((await errors(other, 'SW2002')).length);
    const host = script('assert atm.paid == 7;').replace('test Script of atm', 'test Script of customer').replace('associate customer to Script;', 'associate atm to Script;');
    assert.ok((await errors(host, 'SW2010')).some(m => m.includes('not its subject')));
    // White-box calls borrow the occurrence's context: no communication or suspension.
    assert.ok((await errors(script('atm.ping();'), 'SW2006')).some(m => m.includes('neither communicate nor suspend')));
    assert.ok((await errors(script('atm.withdraw();'), 'SW2006')).some(m => m.includes('neither communicate nor suspend')));
});
test('a test never assigns its subject', async () => {
    await invalid(script('atm.paid = 1;'));
    assert.ok((await errors(script('paid = 1;'), 'SW2006')).some(m => m.includes('Cannot assign paid') && m.includes('never assigns its subject')));
    assert.ok((await errors(script('var x: uint = 0; x = atm.paid; on receive customer.panel.cashOut(paid) { paid = 1; }'), 'SW2006')).some(m => m.includes('Cannot assign paid')));
});
test('on call answers with the operation result and a top-level return ends the case', async () => {
    assert.ok((await errors(script('on call bank.link.authorize(amount) { assert amount > 0; }'), 'SW2006')).some(m => m.includes('must return a bool reply')));
    assert.ok((await errors(script('on call bank.link.authorize(amount) { return 1; }'), 'SW2002')).some(m => m.includes('Expected bool')));
    assert.ok((await errors(script('return true;'), 'SW2002')).some(m => m.includes('ends the case')));
    await valid(script('if (true) { return; } wait 1ms;'));
});
test('cases own no interrupt regions', async () => {
    assert.ok((await errors(script('interruptible { wait 1ms; } on receive panel.amount(v) { }'), 'SW2006')).some(m => m.includes('no interrupt regions')));
});
test('Flow and Timing include cases; Sequence includes operations', async () => {
    await valid(script('wait 1ms;', 'test', 'view f: Flow of Script; view t: Timing of Script; view s: Sequence of atm.fee; view q: Sequence of Script; view c: Case of Script;'));
    assert.ok((await errors(script('wait 1ms;', 'test', 'view c: Case of atm.fee;'), 'SW2010')).some(m => m.includes('not valid for Case')));
    assert.ok((await errors(script('wait 1ms;', 'test', 'view i: Interconnect of Script;'), 'SW2010')).some(m => m.includes('not valid for Interconnect')));
});
test('a malformed script recovers and keeps later declarations', async () => {
    const r = await parse(script('send customer.panel.(1); on receive customer.panel.cashOut(paid) { assert paid == ; }', 'test', 'requirement Later { }'));
    assert.ok(r.doc.parseResult.parserErrors.length);
    assert.ok(nodes(r.model).some(n => a.isRequirement(n) && n.name === 'Later'));
});
test('the formatter keeps consecutive receives on their own lines and joins their branches', async () => {
    const r = await valid(script(withdraw));
    const text = formatDocument(r.doc);
    assert.ok(text.includes('\n    on call bank.link.authorize(amount) {\n      return amount <= 500;\n    } or after 1s {'), text);
    assert.ok(text.includes('\n    }\n    on receive customer.panel.cashOut(paid) {'), text);
    assert.equal(formatDocument((await valid(text)).doc), text);
});
test('caseTarget resolves actor port members, white-box operations and attribute fields', async () => {
    const r = await valid(script('wait 1ms;')), s = nodes(r.model).find(a.isScenario)!;
    assert.equal(caseTarget(s, 'customer.panel.amount')?.kind, 'port');
    assert.deepEqual((({ kind, path }) => ({ kind, path }))(caseTarget(s, 'atm.counter.count') as { kind: string; path: string }), { kind: 'attribute', path: 'atm.counter' });
    assert.equal(caseTarget(s, 'atm.fee')?.kind, 'operation');
    assert.equal(caseTarget(s, 'atm.panel'), undefined);
    assert.equal(caseTarget(s, 'nobody.panel.amount'), undefined);
});
test('rename updates case script paths', async () => {
    const source = script(withdraw);
    const r = await valid(source), at = source.indexOf('port panel: Panel; }');
    const edit = await r.Swaml.lsp.RenameProvider!.rename(r.doc, { textDocument: { uri: r.doc.uri.toString() }, position: r.doc.textDocument.positionAt(at + 5), newName: 'front' });
    assert.ok(edit, 'rename should produce a validated edit');
    let next = source;
    for (const change of edit.documentChanges ?? [])
        if ('textDocument' in change)
            for (const e of [...change.edits].sort((x, y) => r.doc.textDocument.offsetAt(y.range.start) - r.doc.textDocument.offsetAt(x.range.start)))
                if ('newText' in e)
                    next = next.slice(0, r.doc.textDocument.offsetAt(e.range.start)) + e.newText + next.slice(r.doc.textDocument.offsetAt(e.range.end));
    assert.match(next, /send customer\.front\.amount\(200\)/);
    assert.match(next, /connect \(customer\.front, atm\.panel\)/);
    await valid(next);
});

// Runs: pass, fail, inconclusive and no checks.
test('a passing script acts at actor ports, answers requests and leaves case statement sources', async () => {
    const source = script(withdraw, 'use case'), r = await result(source);
    assert.equal(r.result, 'pass', JSON.stringify(r));
    assert.equal(r.kind, 'useCase');
    assert.equal(r.subject, 'Banking::atm');
    const run = r.run!;
    assert.equal(run.status, 'stopped');
    assert.deepEqual(run.target, { kind: 'package', identity: 'Banking' });
    const send = run.trace.find(e => e.kind === 'send')!;
    assert.deepEqual([send.subject, send.source], ['customer.panel.amount', 'Banking::Script/0']);
    assert.equal(run.trace.find(e => e.kind === 'release' && e.subject === 'Banking::Script')?.cause, 'case');
    assert.ok(run.trace.some(e => e.kind === 'assert' && e.source === 'Banking::Script/3/branches/0/body/0' && e.passed === true));
    // The script's reply returns through the request route to the requesting call.
    assert.equal(run.trace.find(e => e.kind === 'reply')?.state, 'succeeded');
    const m = [(await valid(source)).model];
    for (const e of run.trace.filter(e => e.activation === run.trace.find(x => x.kind === 'release' && x.cause === 'case')!.activation && e.source))
        assert.ok(resolveStatement(m, String(e.source)), String(e.source));
    assert.deepEqual(runCase(m, 'Banking::Script', options), runCase(m, 'Banking::Script', options), 'deterministic');
});
test('a failed assert or fail statement fails the case with its statement identity and message', async () => {
    const assertion = await result(script(withdraw.replace('paid == 200', 'paid == 201')));
    assert.deepEqual([assertion.result, assertion.reason, assertion.source, assertion.message], ['fail', 'Assertion', 'Banking::Script/3/branches/0/body/0', 'Assertion failed: assert paid == 201;']);
    assert.ok(assertion.run!.trace.some(e => e.kind === 'failure' && e.subject === 'Banking::Script'));
    const failed = await result(script('fail "not yet";'));
    assert.deepEqual([failed.result, failed.reason, failed.message, failed.source], ['fail', 'Failure', 'not yet', 'Banking::Script/0']);
    const timeout = await result(script('publish customer.panel.cashRequested(); on receive customer.panel.cashOut(paid) { } or after 2ms { fail "no cash"; }'));
    assert.deepEqual([timeout.result, timeout.message, timeout.timeNs], ['fail', 'no cash', 2000000]);
});
test('a failure observed in the run fails a completed script', async () => {
    const source = script('send customer.panel.amount(0); wait 1ms;').replace('operation remember(value: uint) { amount = value; }', 'operation remember(value: uint) { amount = 10 / value; }');
    const r = await result(source.replace('amount = 10 / value;', 'var x: int = 10 % value; amount = value;'));
    assert.equal(r.result, 'fail');
    assert.equal(r.reason, 'run-failure');
    assert.equal(r.observed, 'atm.remember');
    assert.equal(r.source, 'Banking::ATM.remember/0');
});
test('the first failure decides: an earlier run failure wins over a later script failure', async () => {
    const source = script('send customer.panel.amount(5); publish customer.panel.cashRequested(); wait 3s; fail "late";').replace('try(link.authorize(requested), false)', 'link.authorize(requested)');
    const r = await result(source);
    assert.deepEqual([r.result, r.reason, r.observed, r.source, r.timeNs], ['fail', 'run-failure', 'atm.withdraw', 'Banking::ATM.withdraw/1', 1000000000]);
});
test('the horizon, the step limit or a stalled script make a case inconclusive', async () => {
    const horizon = await result(script('wait 5ms;'), 'Banking::Script', { untilNs: 1000000 });
    assert.deepEqual([horizon.result, horizon.reason, horizon.source], ['inconclusive', 'horizon', 'Banking::Script/0']);
    const limit = await result(script('var n: uint = 0; while (true) { n = n + 1; }'), 'Banking::Script', { untilNs: 1000000, maxSteps: 200 });
    assert.deepEqual([limit.result, limit.reason], ['inconclusive', 'limit']);
    const stalled = await result(script('on receive customer.panel.cashOut(paid) { }'));
    assert.deepEqual([stalled.result, stalled.reason, stalled.source], ['inconclusive', 'stalled', 'Banking::Script/0']);
    assert.equal(stalled.run!.status, 'quiescent');
    // The same stalled script stays inconclusive when unrelated periodic work keeps the run busy.
    const busy = await result(script('on receive customer.panel.cashOut(paid) { }').replace('operation ping() { wait 1ms; }', 'operation ping() { wait 1ms; } operation tick() { }').replace('on call panel.balance() balance(); }', 'on call panel.balance() balance(); on every 100ms tick(); }'), 'Banking::Script', { untilNs: 1000000000 });
    assert.deepEqual([busy.result, busy.reason, busy.run!.status], ['inconclusive', 'horizon', 'horizon']);
});
test('an intent-only case has no checks and no run', async () => {
    const m = [(await valid(bank('use case Script of atm { /** Intent. */ } test Other { }')))
        .model];
    const results = runTests(m, options);
    assert.deepEqual(results.map(r => [r.case, r.result, 'run' in r]), [['Banking::Script', 'no checks', false], ['Banking::Other', 'no checks', false]]);
});
test('input that reaches an actor port before the script waits is retained; attributes keep their latest value', async () => {
    const early = bank(`test Script of atm { send customer.panel.amount(1); publish customer.panel.cashRequested(); on call bank.link.authorize(a) { return true; } wait 5ms; on receive customer.panel.cashOut(paid) { assert paid == 1; } }`);
    const r = await result(early);
    assert.equal(r.result, 'pass', JSON.stringify(r.message));
    const latest = `package Latest {
  port def Feed { provides attribute level: int; }
  component def Probe { reversed port feed: Feed; }
  component def Source {
    port feed: Feed;
    operation boot() { send feed.level(1); send feed.level(2); send feed.level(3); }
    schedule { on start boot(); }
  }
  component source: Source;
  component probe: Probe;
  connect (source.feed, probe.feed);
  test Latest of source { wait 1ms; on receive probe.feed.level(v) { assert v == 3; } or after 1ms { fail "no level"; } }
  associate probe to Latest;
}`;
    const l = await result(latest, 'Latest::Latest');
    assert.equal(l.result, 'pass', JSON.stringify(l.message));
    assert.ok(l.run!.trace.some(e => e.kind === 'replaceAttribute'));
});
test('on call replies carry results and out values; an unanswered request times out at the caller', async () => {
    const out = `package Outs {
  port def Api { requires operation split(x: int, out a: int, out b: int); }
  component def Client {
    port api: Api;
    attribute a: int = 0;
    attribute b: int = 0;
    operation go() { api.split(4, a, b); }
    schedule { on start go(); }
  }
  component def Stub { reversed port api: Api; }
  component client: Client;
  component stub: Stub;
  connect (client.api, stub.api);
  test Split of client { on call stub.api.split(x, a, b) { a = x; b = x + 1; } or after 1ms { fail "no request"; } wait 1ms; assert client.a == 4 and client.b == 5; }
  associate stub to Split;
}`;
    const r = await result(out, 'Outs::Split');
    assert.equal(r.result, 'pass', JSON.stringify(r.message));
    // Without an answer the subject's own try fallback refuses the customer.
    const unanswered = await result(script('send customer.panel.amount(200); publish customer.panel.cashRequested(); on receive customer.panel.refused() { } or after 2s { fail "not refused"; }'));
    assert.equal(unanswered.result, 'pass', JSON.stringify(unanswered.message));
    assert.ok(unanswered.run!.trace.some(e => e.kind === 'timeout'));
    // A failure caught by try is evidence, not a failure of the case.
    assert.equal(unanswered.run!.outcome, 'failure-observed');
    assert.ok(unanswered.run!.trace.some(e => e.kind === 'caught'));
    // A failure inside on call answers with a remote failure and fails the case.
    const failing = await result(script('send customer.panel.amount(200); publish customer.panel.cashRequested(); on call bank.link.authorize(amount) { assert amount == 1; return true; }'));
    assert.deepEqual([failing.result, failing.reason], ['fail', 'Assertion']);
});
test('a script calls a required operation through an actor port', async () => {
    const r = await result(script('send customer.panel.amount(5); wait 1ms; var b: uint = customer.panel.balance(); assert b == 5;', 'use case'));
    assert.equal(r.result, 'pass', JSON.stringify(r.message));
    const request = r.run!.trace.find(e => e.kind === 'request')!;
    assert.deepEqual([request.subject, request.source], ['customer.panel.balance', 'Banking::Script/2']);
    assert.ok((await errors(script('var b: uint = customer.panel.balance(1);'), 'SW2002')).length);
});
test('white-box calls and reads use the live store under the serial lock', async () => {
    const r = await result(script('assert atm.fee(20, 10) == 2; assert atm.paid == 7; atm.reset(); assert atm.paid == 0; assert atm.counter.count == 0;'));
    assert.equal(r.result, 'pass', JSON.stringify(r.message));
    assert.equal(r.run!.stores.atm.paid, 0);
    const write = r.run!.trace.find(e => e.kind === 'write' && e.subject === 'atm.paid')!;
    assert.equal(write.source, 'Banking::ATM.reset/0');
    const after = await result(script(`send customer.panel.amount(42); wait 1ms; assert atm.amount == 42;`));
    assert.equal(after.result, 'pass', JSON.stringify(after.message));
});
test('the script starts after the on start entries of the run', async () => {
    const source = `package Order {
  port def P { provides event ping(); }
  component def Pinger { port p: P; attribute n: int = 0; operation boot() { n = 1; publish p.ping(); } schedule { on start boot(); } }
  component def Ear { reversed port p: P; }
  component pinger: Pinger;
  component ear: Ear;
  connect (pinger.p, ear.p);
  test Heard of pinger { assert pinger.n == 1; on receive ear.p.ping() { } }
  associate ear to Heard;
}`;
    const r = await result(source, 'Order::Heard');
    assert.equal(r.result, 'pass', JSON.stringify(r.message));
    const releases = r.run!.trace.filter(e => e.kind === 'release').map(e => e.subject);
    assert.deepEqual(releases, ['pinger.boot', 'Order::Heard']);
});
test('runTests selects by package or case and runCase names cases by identity', async () => {
    const m = [(await valid(script('wait 1ms;', 'test', 'use case Other of atm { }'))).model];
    assert.deepEqual(runTests(m, options).map(r => r.case), ['Banking::Script', 'Banking::Other']);
    assert.deepEqual(runTests(m, options, { case: 'Other' }).map(r => r.result), ['no checks']);
    assert.deepEqual(runTests(m, options, { package: 'Elsewhere' }), []);
    assert.throws(() => runCase(m, 'Banking::Missing', options), /Unknown case/);
    // A package run is unaffected by its cases: interface-only actors do nothing on their own.
    assert.equal(simulate(m, 'Banking', { untilNs: 1000000 }).status, 'quiescent');
});
test('swaml test prints a summary, emits JSON and fails on a failed case', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'swaml-test-'));
    const main = fileURLToPath(new URL('../../src/cli/main.js', import.meta.url));
    const cli = (...args: string[]) => spawnSync(process.execPath, [main, 'test', ...args], { encoding: 'utf8' });
    try {
        const passing = join(folder, 'pass.swaml'), failing = join(folder, 'fail.swaml'), opts = join(folder, 'options.json');
        await writeFile(passing, script(withdraw, 'test', 'use case Intent of atm { }'));
        await writeFile(failing, script(withdraw.replace('paid == 200', 'paid == 1')).replace('package Banking', 'package Broken'));
        await writeFile(opts, JSON.stringify({ untilNs: 5000000000 }));
        const ok = cli(passing);
        assert.equal(ok.status, 0, ok.stderr);
        assert.match(ok.stdout, /^pass +Banking::Script$/m);
        assert.match(ok.stdout, /^no checks +Banking::Intent$/m);
        assert.match(ok.stdout, /2 case\(s\): 1 pass, 0 fail, 0 inconclusive, 1 no checks\./);
        const bad = cli('--language-version', '2.0', '--json', '--options', opts, failing);
        assert.equal(bad.status, 1, bad.stderr);
        const report = JSON.parse(bad.stdout);
        assert.deepEqual(report.summary, { pass: 0, fail: 1, inconclusive: 0, noChecks: 0 });
        assert.equal(report.cases[0].source, 'Broken::Script/3/branches/0/body/0');
        assert.equal(report.cases[0].run.sources, undefined);
        assert.ok(report.sourceDigests.some((d: { uri: string }) => d.uri.endsWith('fail.swaml')));
        assert.deepEqual(report.options, { untilNs: 5000000000 });
        const one = cli('--case', 'Banking::Intent', '--until-ns', '1000', passing, failing);
        assert.equal(one.status, 0, one.stderr);
        assert.match(one.stdout, /1 case\(s\)/);
        assert.equal(cli('--package', 'Broken', passing, failing).status, 1);
        const intent = JSON.parse(cli('--json', '--case', 'Banking::Intent', passing).stdout);
        assert.ok(intent.sourceDigests.some((d: { uri: string }) => d.uri.endsWith('pass.swaml')), 'digests also when no case ran');
        assert.equal(intent.profile, 'swaml-reference/2.0');
        assert.equal(cli('--package', 'Nowhere', passing).status, 2);
        assert.equal(cli('--until-ns', '1', '--options', opts, passing).status, 2);
        assert.equal(cli().status, 2);
        assert.match(cli('--bogus', passing).stderr, /Unknown option --bogus/);
    }
    finally {
        await rm(folder, { recursive: true, force: true });
    }
});
