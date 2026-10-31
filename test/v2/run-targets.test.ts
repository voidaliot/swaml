import nodeTest from 'node:test';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invalid, parse, valid, workspace } from './helpers.js';
import { simulate } from '../../src/simulation/simulator.js';
import { nodes, resolveStatement, runTargets, statementIdentity } from '../../src/language/semantic.js';
import * as a from '../../src/language/generated/ast.js';
/** A package context whose top-level occurrences talk only through package connections. */
const bank = (members = '') => `package Banking {
  port def Panel { provides event cashRequested(amount: uint); requires event cashOut(paid: uint); }
  port def BankLink { requires operation authorize(amount: uint) returns bool; }
  component def Customer {
    port panel: Panel;
    attribute paid: uint = 0;
    operation arrive() { publish panel.cashRequested(200); }
    operation take(amount: uint) { paid = amount; }
    schedule { on start arrive(); on receive panel.cashOut(amount) take(amount); }
  }
  component def ATM {
    reversed port panel: Panel;
    port link: BankLink;
    attribute approved: bool = false;
    operation serve(amount: uint) {
      var ok: bool = try(link.authorize(amount), false);
      approved = ok;
      if (ok) {
        publish panel.cashOut(amount);
      }
    }
    schedule { on receive panel.cashRequested(amount) serve(amount); }
  }
  component def BankHost {
    reversed port link: BankLink;
    attribute asked: uint = 0;
    operation authorize(amount: uint) returns bool { asked = amount; return amount <= 500; }
    schedule { on call link.authorize(amount) authorize(amount); }
  }
  component customer: Customer;
  component atm: ATM;
  component bank: BankHost;
  connect panel (customer.panel, atm.panel);
  connect (atm.link, bank.link);
  ${members}
}`;
const models = async (source: string) => [(await valid(source)).model];
const kinds = (r: ReturnType<typeof simulate>, kind: string) => r.trace.filter(e => e.kind === kind);

test('a package run connects its top-level occurrences through package connections', async () => {
    const m = await models(bank());
    const r = simulate(m, 'Banking', { untilNs: 10000000 });
    assert.deepEqual(r.target, { kind: 'package', identity: 'Banking' });
    assert.equal('root' in r, false);
    assert.equal(r.outcome, 'no-failure-observed');
    assert.equal(r.stores.customer.paid, 200);
    assert.equal(r.stores.atm.approved, true);
    assert.equal(r.stores.bank.asked, 200);
    // Named and unnamed package connections are distinct routes with package-relative identities.
    assert.deepEqual([...new Set(kinds(r, 'offer').map(e => e.subject))].sort(), ['@package1', 'panel']);
    assert.equal(kinds(r, 'request').length, 1);
    assert.equal(kinds(r, 'reply')[0].state, 'succeeded');
    assert.deepEqual(Object.keys(r.stores), ['customer', 'atm', 'bank']);
});

test('a component run executes one top-level occurrence alone with its ports open', async () => {
    const m = await models(bank());
    const alone = simulate(m, 'Banking::customer', { untilNs: 10000000 });
    assert.deepEqual(alone.target, { kind: 'component', identity: 'Banking::customer' });
    assert.deepEqual(Object.keys(alone.stores), ['customer']);
    assert.equal(kinds(alone, 'publish').length, 1);
    assert.equal(kinds(alone, 'offer').length, 0, 'package connections are absent');
    assert.equal(alone.stores.customer.paid, 0);
    // An open required operation has no route: the request fails as unavailable and try recovers.
    const probe = await models(`package Probe {
  port def Link { requires operation ask(v: uint) returns bool; }
  component def Asker { port link: Link; attribute ok: bool = true; operation go() { ok = try(link.ask(1), false); } schedule { on start go(); } }
  component def Answer { reversed port link: Link; operation ask(v: uint) returns bool { return true; } schedule { on call link.ask(v) ask(v); } }
  component asker: Asker;
  component answer: Answer;
  connect (asker.link, answer.link);
}`);
    const open = simulate(probe, 'Probe::asker', { untilNs: 10000000 });
    assert.equal(open.stores.asker.ok, false);
    assert.equal(kinds(open, 'caught')[0].reason, 'unavailable');
    assert.equal(simulate(probe, 'Probe', { untilNs: 10000000 }).stores.asker.ok, true);
});

test('package runs are deterministic and their traces carry stable statement sources', async () => {
    const m = await models(bank());
    const first = simulate(m, 'Banking', { untilNs: 10000000 }), second = simulate(m, 'Banking', { untilNs: 10000000 });
    assert.deepEqual(first, second);
    const source = (kind: string, subject?: string) => first.trace.find(e => e.kind === kind && (!subject || e.subject === subject))?.source;
    assert.equal(source('publish', 'customer.panel.cashRequested'), 'Banking::Customer.arrive/0');
    assert.equal(source('request'), 'Banking::ATM.serve/0');
    assert.equal(source('reply'), 'Banking::ATM.serve/0');
    assert.equal(source('write', 'atm.approved'), 'Banking::ATM.serve/1');
    assert.equal(source('write', 'bank.asked'), 'Banking::BankHost.authorize/0');
    assert.equal(source('publish', 'atm.panel.cashOut'), 'Banking::ATM.serve/2/then/0');
    assert.equal(source('dispatch', 'atm.serve'), 'Banking::ATM/schedule/0');
    assert.equal(source('dispatch', 'customer.take'), 'Banking::Customer/schedule/1');
    for (const kind of ['write', 'publish', 'offer', 'deliver', 'request', 'reply', 'release', 'dispatch', 'requestWait'])
        assert.ok(kinds(first, kind).every(e => typeof e.source === 'string'), kind);
    // Offers and deliveries name the statement that emitted or requested the message.
    for (const e of [...kinds(first, 'offer'), ...kinds(first, 'deliver')])
        assert.ok(['Banking::Customer.arrive/0', 'Banking::ATM.serve/0', 'Banking::ATM.serve/2/then/0'].includes(e.source!), e.source);
    // Every source resolves to its node, and the node maps back to the same identity.
    for (const e of first.trace.filter(e => e.source)) {
        const node = resolveStatement(m, e.source!);
        assert.ok(node, e.source);
        assert.equal(statementIdentity(node), e.source);
    }
});

test('statement identities follow the statement structure of operations', async () => {
    const r = await valid(`package Paths {
  port def P { provides event ping(v: int); requires event pong(v: int); }
  component def 'Slash/Owner' {
    port p: P;
    attribute n: int = 0;
    operation 'run/0'() {
      operation inner() { n = 3; }
      for (var i: int = 0; i < 2; i = i + 1) {
        while (n < 1, 3 times) { n = n + 1; }
      }
      on receive p.pong(v) { n = v; } or after 1 ms { n = 2; }
      publish p.ping(n);
    }
    operation machine() {
      initial A;
      state A { on entry { n = 4; } after 2 ms to B { n = 5; } }
      final state B { }
    }
    schedule { on start 'run/0'(); on start machine(); }
  }
  component def Peer { reversed port p: P; operation take(v: int) { publish p.pong(v); } schedule { on receive p.ping(v) take(v); } }
  component o: 'Slash/Owner';
  component peer: Peer;
  connect (o.p, peer.p);
}`);
    const ids = nodes(r.model).filter(n => a.isAssign(n) || a.isSend(n) || a.isScheduleEntry(n)).map(n => statementIdentity(n));
    assert.deepEqual(ids, [
        'Paths::Slash/Owner.run/0.inner/0',
        'Paths::Slash/Owner.run/0/0/update',
        'Paths::Slash/Owner.run/0/0/body/0/body/0',
        'Paths::Slash/Owner.run/0/1/branches/0/body/0',
        'Paths::Slash/Owner.run/0/1/timeoutBody/0',
        'Paths::Slash/Owner.run/0/2',
        'Paths::Slash/Owner.machine/states/0/actions/0/body/0',
        'Paths::Slash/Owner.machine/states/0/transitions/0/effect/0',
        'Paths::Slash/Owner/schedule/0',
        'Paths::Slash/Owner/schedule/1',
        'Paths::Peer.take/0',
        'Paths::Peer/schedule/0'
    ]);
    // Names that contain '/' still resolve: the longest declared owner wins.
    for (const id of ids)
        assert.equal(statementIdentity(resolveStatement([r.model], id!)!), id);
    assert.equal(resolveStatement([r.model], 'Paths::Slash/Owner.run/0/9'), undefined);
    assert.equal(statementIdentity(r.model.packages[0]), undefined);
    const run = simulate([r.model], 'Paths', { untilNs: 10000000 });
    assert.equal(run.outcome, 'no-failure-observed');
    assert.ok(run.trace.some(e => e.kind === 'write' && e.source === 'Paths::Slash/Owner.run/0/0/update'));
});

test('asserts and failures name their statements', async () => {
    const m = await models(`package Checks {
  component def Checker {
    attribute n: int = 1;
    operation check() { assert n == 1; fail "boom"; }
    operation later() { assert n == 2; }
    schedule { on start check(); on start later(); }
  }
  component demo: Checker;
}`);
    const r = simulate(m, 'Checks', { untilNs: 1000 });
    assert.deepEqual(kinds(r, 'assert').map(e => [e.source, e.passed]), [['Checks::Checker.check/0', true], ['Checks::Checker.later/0', false]]);
    assert.deepEqual(kinds(r, 'failure').map(e => [e.source, e.reason]), [['Checks::Checker.check/1', 'Failure'], ['Checks::Checker.later/0', 'Assertion']]);
});

test('a package run applies each top-level occurrence its own deployment', async () => {
    const source = `package Placed {
  import Swaml::Platform;
  component def Worker { attribute n: int = 0; operation boot() { n = 1; } schedule { on start boot(); } }
  component left: Worker;
  component right: Worker;
  component idle: Worker;
  component Board: Platform { component a: Node; component b: Node; }
  deployment L of left on Board { deploy on a; }
  deployment R of right on Board { deploy on b; }
}`;
    const m = await models(source);
    const r = simulate(m, 'Placed', { untilNs: 1000 });
    assert.deepEqual(r.deployments, { left: 'Placed::Board.a', right: 'Placed::Board.b', idle: null });
    assert.equal('Board' in r.stores, false, 'platform roots describe deployment targets and do not run');
    assert.deepEqual(simulate(m, 'Placed::right', { untilNs: 1000 }).deployments, { right: 'Placed::Board.b' });
    assert.throws(() => simulate(m, 'Placed::Board', { untilNs: 1000 }), /Unknown run target/);
    assert.throws(() => simulate(m, 'Placed', { untilNs: 1000, deployment: 'Placed::L' } as never), /Unknown simulation option deployment/);
    assert.deepEqual(runTargets(m).map(t => `${t.kind} ${t.identity}`), ['package Placed', 'component Placed::left', 'component Placed::right', 'component Placed::idle']);
});

test('at most one deployment per top-level occurrence', async () => {
    const source = `package Placed {
  import Swaml::Platform;
  component def Worker { }
  component left: Worker;
  component Board: Platform { component a: Node; }
  deployment First of left on Board { deploy on a; }
  deployment Second of left on Board { deploy on a; }
}`;
    const r = await invalid(source, 'SW2009');
    const found = r.errors.filter(e => e.code === 'SW2009');
    assert.equal(found.length, 1);
    assert.equal(found[0].message, 'At most one deployment per top-level occurrence: left is already deployed by Placed::First.');
    assert.equal(r.doc.textDocument.getText(found[0].range), 'left');
    assert.ok(r.doc.textDocument.offsetAt(found[0].range.start) > source.indexOf('Second'));
    // Deployments in another file count too.
    const w = await workspace([source.replace(/\s*deployment Second[^}]*\}/, ''), 'package Other { import Placed; import Swaml::Platform; deployment Again of Placed::left on Placed::Board { deploy on a; } }']);
    assert.ok(w.docs[1].diagnostics?.some(d => d.code === 'SW2009' && String(d.message).includes('already deployed by Placed::First')), JSON.stringify(w.docs[1].diagnostics));
});

test('run targets name a package or one of its top-level software components', async () => {
    const m = await models(bank());
    assert.throws(() => simulate(m, 'Banking::Customer', { untilNs: 1 }), /Unknown run target Banking::Customer/);
    assert.throws(() => simulate(m, 'Nowhere', { untilNs: 1 }), /Unknown run target/);
    const nested = await models('package A { component def C { } component B: C; } package A::B { component def D { attribute n: int = 0; } component d: D; }');
    assert.throws(() => simulate(nested, 'A::B', { untilNs: 1 }), /Ambiguous run target A::B/);
    assert.deepEqual(simulate(nested, 'A::B::d', { untilNs: 1 }).target, { kind: 'component', identity: 'A::B::d' });
});

test('an exact duplicate package connection is reported once', async () => {
    const r = await parse(bank('connect (atm.link, bank.link);'));
    const duplicates = r.errors.filter(e => e.code === 'SW2004' && /Duplicate/.test(String(e.message)));
    assert.deepEqual(duplicates.map(e => e.message), ['Duplicate or self connector.']);
});

test('top-level port closure is reported on each top-level occurrence', async () => {
    const source = `package Pair {
  port def P { provides event ping(); }
  component def Sender { port p: P; operation emit() { publish p.ping(); } schedule { on start emit(); } }
  component first: Sender;
  component second: Sender;
}`;
    const r = await parse(source);
    const open = r.errors.filter(e => e.code === 'SW2004');
    assert.deepEqual(open.map(e => [e.message, r.doc.textDocument.getText(e.range)]), [
        ['Unconnected required port first.p in package Pair.', 'first'],
        ['Unconnected required port second.p in package Pair.', 'second']
    ]);
    assert.ok(open.every(e => e.data.declaration === 'Pair::Sender.p'));
});

test('unresolved and cross-package connection ends carry the range of the offending end', async () => {
    const source = bank('connect (atm.panel, nobody.panel);');
    const r = await parse(source);
    const end = r.errors.find(e => e.code === 'SW2004' && String(e.message).includes('nobody.panel'))!;
    assert.equal(r.doc.textDocument.getText(end.range), 'nobody.panel');
    const w = await workspace([bank(), 'package Branch { import Banking; component def Kiosk { reversed port panel: Panel; } component kiosk: Kiosk; connect (customer.panel, kiosk.panel); }']);
    const cross = w.docs[1].diagnostics!.find(d => d.code === 'SW2004' && String(d.message).includes('across packages'))!;
    assert.equal(w.docs[1].textDocument.getText(cross.range), 'customer.panel');
});

test('swaml simulate runs the package of a one-package file or a selected target', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'swaml-targets-'));
    const source = join(folder, 'bank.swaml'), options = join(folder, 'options.json'), other = join(folder, 'other.swaml');
    const main = fileURLToPath(new URL('../../src/cli/main.js', import.meta.url));
    const cli = (...args: string[]) => spawnSync(process.execPath, [main, 'simulate', ...args], { encoding: 'utf8' });
    try {
        await writeFile(source, bank());
        await writeFile(options, JSON.stringify({ untilNs: 10000000 }));
        await writeFile(other, 'package Other { component def C { attribute n: int = 0; } component c: C; }');
        const whole = cli('--until-ns', '10000000', source);
        assert.equal(whole.status, 0, whole.stderr);
        const result = JSON.parse(whole.stdout);
        assert.deepEqual(result.target, { kind: 'package', identity: 'Banking' });
        assert.equal(result.stores.customer.paid, 200);
        assert.ok(result.implementation.artifacts.some((x: { path: string }) => x.path === 'src/cli/run.js'));
        const one = cli('--language-version', '2.0', '--target', 'Banking::atm', '--options', options, source);
        assert.equal(one.status, 0, one.stderr);
        assert.deepEqual(JSON.parse(one.stdout).target, { kind: 'component', identity: 'Banking::atm' });
        const ambiguous = cli('--until-ns', '1', source, other);
        assert.equal(ambiguous.status, 2);
        assert.match(ambiguous.stderr, /Select a run target with --target/);
        assert.equal(cli('--target=Other', '--until-ns=1', source, other).status, 0);
        assert.equal(cli(source).status, 2, 'options or a horizon are required');
        assert.equal(cli('--until-ns', '1', '--options', options, source).status, 2);
        assert.match(cli('--bogus', source).stderr, /Unknown option --bogus/);
        // The positional host keeps working with the same targets.
        const legacy = spawnSync(process.execPath, [fileURLToPath(new URL('../../src/cli/simulate.js', import.meta.url)), 'Banking', options, source], { encoding: 'utf8' });
        assert.equal(legacy.status, 0, legacy.stderr);
        assert.equal(JSON.parse(legacy.stdout).target.kind, 'package');
    }
    finally {
        await rm(folder, { recursive: true, force: true });
    }
});
