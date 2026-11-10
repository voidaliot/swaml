import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { valid, invalid, parse, workspace } from './helpers.js';
import { runCase } from '../../src/simulation/simulator.js';
import { allowsSuspendingCall, caseCallAccess, caseCallRestriction, caseCallRoots, caseTarget, nodes } from '../../src/language/semantic.js';
import * as a from '../../src/language/generated/ast.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
const kinds = ['use case', 'test'];
async function run(source: string, untilNs = 100) {
    return runCase([(await valid(source)).model], 'P::U', { untilNs, maxSteps: 10000 });
}

test('both case kinds call their exact subject, retain return values and resume actor interactions', async () => {
    for (const kind of kinds) {
        const result = await run(`package P {
  port def Done { provides event done(n: int); }
  component subject {
    port p: Done;
    attribute n: int = 0;
    operation increment() returns int { n = n + 1; publish p.done(n); return n; }
  }
  component actor { reversed port p: Done; }
  connect (subject.p, actor.p);
  ${kind} U of subject {
    var n: int = 9;
    var answer: int = subject.increment();
    assert answer == 1 and n == 9;
    on receive actor.p.done(value) { assert value == answer; } or after 10ns { fail "missing done"; }
  }
  associate actor to U;
}`);
        assert.equal(result.result, 'pass', result.message);
        assert.equal(result.run!.stores.subject.n, 1);
        assert.ok(result.run!.trace.some(event => event.kind === 'publish' && event.subject === 'subject.p.done' && event.source === 'P::subject.increment/1'));
        assert.deepEqual(result.run!.trace.filter(event => event.kind === 'release').map(event => event.subject), ['P::U']);
    }
});

test('subject suspension releases its actual serial lock and resumes with live state', async () => {
    for (const kind of kinds) {
        const result = await run(`package P {
  component subject {
    attribute n: int = 0;
    operation tick() { wait 1ns; n = 2; }
    operation slow() returns int { n = 1; wait 2ns; return n; }
    schedule { on start tick(); }
  }
  ${kind} U of subject { var seen: int = subject.slow(); assert seen == 2; }
}`);
        assert.equal(result.result, 'pass', result.message);
        assert.equal(result.timeNs, 2);
        assert.ok(result.run!.trace.some(event => event.kind === 'write' && event.source === 'P::subject.tick/1' && event.timeNs === 1));
        assert.ok(result.run!.trace.some(event => event.kind === 'wait' && event.subject === 'subject.slow' && event.source === 'P::subject.slow/1'));
        assert.deepEqual(result.run!.trace.filter(event => event.kind === 'release').map(event => event.subject), ['subject.tick', 'P::U']);
    }
});

test('subject calls use their own request route, resume on reply and restore the case port role', async () => {
    for (const kind of kinds) {
        const result = await run(`package P {
  port def Query { requires operation value() returns int; }
  port def Done { provides event done(); }
  component subject {
    port p: Query;
    port done: Done;
    operation ask() returns int { var got: int = p.value(); return got; }
    operation finish() { publish done.done(); }
  }
  component peer {
    reversed port p: Query;
    operation value() returns int { wait 1ns; return 7; }
    schedule { on call p.value() value(); }
  }
  component actor { reversed port p: Done; }
  connect (subject.p, peer.p);
  connect (subject.done, actor.p);
  ${kind} U of subject {
    var got: int = subject.ask(); assert got == 7;
    subject.finish();
    on receive actor.p.done() { assert true; } or after 5ns { fail "missing done"; }
  }
  associate peer to U;
  associate actor to U;
}`);
        assert.equal(result.result, 'pass', result.message);
        assert.equal(result.timeNs, 1);
        assert.ok(result.run!.trace.some(event => event.kind === 'request' && event.subject === 'subject.p.value' && event.source === 'P::subject.ask/0'));
        assert.ok(result.run!.trace.some(event => event.kind === 'reply' && event.timeNs === 1));
    }
});

test('an operation called by a case can consume its own queued input', async () => {
    for (const kind of kinds) {
        const result = await run(`package P {
  port def Input { provides event kick(n: int); }
  component subject {
    reversed port p: Input;
    operation awaitKick() returns int {
      var got: int = 0;
      on receive p.kick(n) { got = n; } or after 10ns { fail "missing kick"; }
      return got;
    }
  }
  component actor { port p: Input; }
  connect (actor.p, subject.p);
  ${kind} U of subject { publish actor.p.kick(9); var got: int = subject.awaitKick(); assert got == 9; }
  associate actor to U;
}`);
        assert.equal(result.result, 'pass', result.message);
        assert.equal(result.run!.trace.filter(event => event.kind === 'deliver').length, 1);
    }
});

test('private reads and extra helper calls stay separate from exact subject-call permission', async () => {
    const model = (kind: string, statements: string) => `package P {
  component def Cell { attribute n: int = 1; operation value() returns int { return n; } operation slow() { wait 1ns; } }
  component subject { attribute hidden: int = 0; component child: Cell; operation value() returns int { return 2; } }
  component peer: Cell;
  ${kind} U of subject { ${statements} }
  associate peer to U;
}`;
    for (const statement of ['assert subject.child.n == 1;', 'subject.child.slow();', 'assert peer.n == 1;', 'var n: int = peer.value();'])
        await invalid(model('use case', statement), 'SW2010');
    await invalid(model('use case', 'assert subject.hidden == 0;'), 'SW2010');
    await invalid(model('test', 'subject.child.slow();'), 'SW2006');
    await invalid(model('test', 'peer.slow();'), 'SW2006');
    await valid(model('test', 'assert peer.n == 1; assert subject.child.value() == 1;'));
    const parsed = await valid(model('use case', 'assert subject.value() == 2;'));
    const scenario = parsed.model.packages[0].elements.find(a.isScenario)!;
    assert.deepEqual(caseCallRoots(scenario).map(root => root.name), ['subject']);
    assert.equal(caseCallAccess(scenario, 'subject'), 'subject');
    assert.equal(caseCallAccess(scenario, 'subject.child'), undefined);
    assert.equal(caseCallAccess(scenario, 'peer'), undefined);
    const target = caseTarget(scenario, 'subject.value');
    assert.ok(target?.kind === 'operation');
    assert.equal(caseCallRestriction(scenario, target.path, target.operation, target.structure), undefined);
});

test('suspending subject calls obey normal whole-value placement and try wrappers', async () => {
    const model = (statement: string) => `package P {
  component subject {
    operation waitValue() returns int { wait 1ns; return 4; }
    operation waitVoid() { wait 1ns; }
    operation add(value: int) returns int { return value; }
  }
  use case U of subject { ${statement} }
}`;
    for (const statement of ['var n: int = subject.waitValue(); n = try(subject.waitValue(), 0); assert n == 4;', 'subject.waitVoid();', 'try(subject.waitVoid());']) {
        const parsed = await valid(model(statement));
        const calls = nodes(parsed.model).filter(a.isCallExpression).filter(call => call.target.includes('.wait'));
        assert.ok(calls.every(allowsSuspendingCall));
        assert.equal(runCase([parsed.model], 'P::U', { untilNs: 10 }).result, 'pass');
    }
    for (const statement of [
        'assert subject.waitValue() == 4;',
        'var n: int = 1 + subject.waitValue();',
        'var n: int = subject.add(subject.waitValue());',
        'if (subject.waitValue() == 4) { assert true; }',
        'for (var n: int = subject.waitValue(); n < 5; n = n + 1) { assert true; }',
        'for (var n: int = 0; n < 1; n = subject.waitValue()) { assert true; }',
    ]) {
        const parsed = await invalid(model(statement), 'SW2006');
        assert.ok(nodes(parsed.model).filter(a.isCallExpression).filter(call => call.target.includes('.wait')).every(call => !allowsSuspendingCall(call)));
    }
});

test('quoted imported inherited subjects keep occurrence identity and effective bodies', async () => {
    const sources = [
        `package Library { component def Base {
          attribute n: int = 0;
          operation value() returns int { wait 1ns; n = n + 1; return n; }
        } component def Derived specializes Base { redefines operation value() returns int { wait 2ns; n = n + 2; return n; } } }`,
        `package P { component 'first subject': Library::Derived; component 'other subject': Library::Derived;
          use case U of 'first subject' { var n: int = 'first subject'.value(); assert n == 2; } }`,
    ];
    const linked = await workspace(sources);
    assert.deepEqual(linked.docs.flatMap(doc => doc.diagnostics?.filter(d => d.severity === 1).map(d => d.message) ?? []), []);
    const result = runCase(linked.docs.map(doc => doc.parseResult.value).filter(a.isModel), 'P::U', { untilNs: 10 });
    assert.equal(result.result, 'pass', result.message);
    assert.equal(result.timeNs, 2);
    assert.deepEqual(result.run!.stores, { 'first subject': { n: 2 }, 'other subject': { n: 0 } });
});

test('out copy-back succeeds only after return and records the restored caller context', async () => {
    for (const kind of kinds) {
        const result = await run(`package P {
  component subject {
    attribute changed: int = 0;
    operation good(out result: int) { wait 1ns; result = 5; }
    operation bad(out result: int) { result = 99; changed = 2; fail "bad"; }
    operation read() returns int { return changed; }
  }
  ${kind} U of subject {
    var result: int = 7;
    subject.good(result); assert result == 5;
    try(subject.bad(result)); assert result == 5;
    assert subject.read() == 2;
  }
}`);
        assert.equal(result.result, 'pass', result.message);
        const writes = result.run!.trace.filter(event => event.kind === 'write' && event.scope === 'local' && event.subject.endsWith('.result'));
        assert.ok(writes.some(event => event.subject === 'P::U.result' && event.source === 'P::U/1' && event.value === 5));
        assert.ok(!writes.some(event => event.subject === 'P::U.result' && event.value === 99));
        assert.equal(result.run!.stores.subject.changed, 2);
    }
});

test('failed calls retain their actual callee source while caught failures restore actor behavior', async () => {
    const failed = await run(`package P { component subject { operation bad() { assert false; } } use case U of subject { subject.bad(); } }`);
    assert.deepEqual([failed.result, failed.reason, failed.source], ['fail', 'Assertion', 'P::subject.bad/0']);
    const caught = await run(`package P {
  port def Done { provides event done(); }
  component subject { port p: Done; operation bad() { fail "bad"; } operation emit() { publish p.done(); } }
  component actor { reversed port p: Done; }
  connect (subject.p, actor.p);
  use case U of subject { try(subject.bad()); subject.emit(); on receive actor.p.done() { assert true; } or after 1ns { fail "missing done"; } }
  associate actor to U;
}`);
    assert.equal(caught.result, 'pass', caught.message);
    assert.ok(caught.run!.trace.some(event => event.kind === 'caught' && event.subject === 'P::U' && event.source === 'P::U/0'));
});

test('interrupts unwind subject continuation and inactive input cannot resume the caller', async () => {
    for (const kind of kinds) {
        const result = await run(`package P {
  port def Stop { provides event cancel(); }
  component subject {
    reversed port p: Stop;
    attribute n: int = 0;
    operation work() { interruptible { wait 5ns; n = 1; } on receive p.cancel() { n = 2; } }
    operation read() returns int { return n; }
  }
  component driver { port p: Stop; operation pulse() { wait 1ns; publish p.cancel(); wait 1ns; publish p.cancel(); } schedule { on start pulse(); } }
  connect (driver.p, subject.p);
  ${kind} U of subject { subject.work(); wait 6ns; assert subject.read() == 2; }
}`);
        assert.equal(result.result, 'pass', result.message);
        assert.equal(result.run!.trace.filter(event => event.kind === 'interrupt').length, 1);
        assert.ok(result.run!.trace.some(event => event.kind === 'discardInput' && event.reason === 'inactiveOwner' && event.timeNs === 2));
        assert.equal(result.run!.stores.subject.n, 2);
    }
});

test('a suspended subject call stays bounded at the horizon with its actual waiting source', async () => {
    for (const kind of kinds) {
        const result = await run(`package P {
  component subject { attribute n: int = 0; operation work() { wait 10ns; n = 1; } }
  ${kind} U of subject { subject.work(); assert false; }
}`, 2);
        assert.deepEqual([result.result, result.reason, result.source], ['inconclusive', 'horizon', 'P::subject.work/0']);
        assert.equal(result.run!.stores.subject.n, 0);
        assert.ok(!result.run!.trace.some(event => event.kind === 'assert'));
    }
});

test('a direct subject call remains local-call behavior and never releases an after chain', async () => {
    for (const kind of kinds) {
        const result = await run(`package P {
  port def Trigger { provides event go(); }
  component subject {
    reversed port p: Trigger;
    attribute n: int = 0;
    operation work() { wait 1ns; }
    operation afterward() { n = n + 1; }
    operation read() returns int { return n; }
    schedule { on receive p.go() work(); after work afterward(); }
  }
  component actor { port p: Trigger; }
  connect (actor.p, subject.p);
  ${kind} U of subject { subject.work(); assert subject.read() == 0; }
}`);
        assert.equal(result.result, 'pass', result.message);
        assert.deepEqual(result.run!.trace.filter(event => event.kind === 'release').map(event => event.subject), ['P::U']);
    }
});

test('stateful operations still start only through their on-start entry', async () => {
    for (const kind of kinds) await invalid(`package P {
  component subject { operation machine() { initial Done; final state Done { } } schedule { on start machine(); } }
  ${kind} U of subject { subject.machine(); }
}`, 'SW2006');
});
