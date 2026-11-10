import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { valid, invalid, parse, workspace } from './helpers.js';
import { runCase } from '../../src/simulation/simulator.js';
import { testAccessRoots, testCanAccess } from '../../src/language/semantic.js';
import * as a from '../../src/language/generated/ast.js';
import { readFileSync } from 'node:fs';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });

const model = (statements: string, associations = 'associate peer to Check;', kind = 'test') => `package Access {
  component subject { attribute n: int = 0; }
  component def Cell { attribute n: int = 2; operation bump() { n = n + 1; } }
  component peer {
    attribute n: int = 1;
    component child: Cell;
    operation bump() { n = n + 1; }
    operation slow() { wait 1ns; }
  }
  component peerExtra { attribute n: int = 3; operation bump() { n = n + 1; } }
  ${kind} Check of subject { ${statements} }
  ${associations}
}`;

test('an associated component and its single parts retain independent live stores', async () => {
    const { model: parsed } = await valid(model('assert subject.n == 0; assert peer.n == 1; peer.bump(); peer.child.bump(); assert peer.n == 2 and peer.child.n == 3;'));
    const result = runCase([parsed], 'Access::Check', { untilNs: 1000 });
    assert.equal(result.result, 'pass');
    assert.deepEqual(result.run?.stores, { subject: { n: 0 }, peer: { n: 2 }, 'peer.child': { n: 3 }, peerExtra: { n: 3 } });
    const scenario = parsed.packages[0].elements.find(a.isScenario)!;
    assert.deepEqual(testAccessRoots(scenario).map(root => root.name), ['subject', 'peer']);
    assert.equal(testCanAccess(scenario, 'peer.child'), true);
    for (const path of ['peerExtra', 'peer.missing', 'peer.child.missing', 'peer.child[0]', 'peer.']) assert.equal(testCanAccess(scenario, path), false, path);
});

test('unassociated peers cannot be read or called and matching name prefixes grant no access', async () => {
    for (const statement of ['assert peer.n == 1;', 'peer.bump();', 'assert peer.child.n == 2;', 'peer.child.bump();'])
        await invalid(model(statement, ''), 'SW2010');
    for (const statement of ['assert peerExtra.n == 3;', 'peerExtra.bump();'])
        await invalid(model(statement), 'SW2010');
});

test('use cases gain no private reads or helper access when an occurrence is associated', async () => {
    for (const statement of ['assert subject.n == 0;', 'assert peer.n == 1;', 'peer.bump();', 'assert peer.child.n == 2;', 'peer.child.bump();'])
        await invalid(model(statement, 'associate peer to Check;', 'use case'), 'SW2010');
    const parsed = await valid(model('assert true;', 'associate peer to Check;', 'use case'));
    assert.deepEqual(testAccessRoots(parsed.model.packages[0].elements.find(a.isScenario)!), []);
});

test('association changes access without changing fresh package initialization or run scope', async () => {
    const parsed = await valid(model('peer.bump(); assert peer.n == 2;').replace('test Check of subject', 'test First of subject').replace('to Check;', 'to First;').replace(/\n}$/, '\n test Second of subject { assert peer.n == 1; } associate peer to Second;\n}'));
    const first = runCase([parsed.model], 'Access::First', { untilNs: 1000 });
    const second = runCase([parsed.model], 'Access::Second', { untilNs: 1000 });
    assert.equal(first.result, 'pass'); assert.equal(second.result, 'pass');
    assert.equal(first.run?.stores.peer.n, 2); assert.equal(second.run?.stores.peer.n, 1);
    assert.ok(second.run?.trace.some(event => event.kind === 'initialize' && event.subject === 'peerExtra'));
});

test('local value precedence and the existing occurrence-call namespace remain unchanged', async () => {
    const parsed = await valid(model('var peer: int = 9; peer.bump(); assert peer == 9; var n: int = peerExtra.n;', 'associate peer to Check; associate peerExtra to Check;'));
    assert.equal(runCase([parsed.model], 'Access::Check', { untilNs: 1000 }).result, 'pass');
    const record = await valid(model('var peer: Data = record Data { n = 9; }; assert peer.n == 9;', '').replace('package Access {', 'package Access { datatype Data { n: int; }'));
    assert.equal(runCase([record.model], 'Access::Check', { untilNs: 1000 }).result, 'pass');
});

test('associated calls keep suspension, state-write and port-ownership restrictions', async () => {
    await invalid(model('peer.slow();'), 'SW2006');
    await invalid(model('peer.n = 4;'), 'SW2000');
    const source = `package Ports { port def Link { provides event ping(); }
      component subject { reversed port p: Link; operation take() { } schedule { on receive p.ping() take(); } }
      component peer { port p: Link; operation emit() { publish p.ping(); } }
      connect (peer.p, subject.p); test Check of subject { publish peer.p.ping(); } associate peer to Check; }`;
    await invalid(source, 'SW2010');
    await invalid(source.replace('publish peer.p.ping(); } associate', 'peer.emit(); } associate'), 'SW2006');
});

test('quoted imported inherited parts keep the bound occurrence and nominal declaration', async () => {
    const sources = [
        `package Shared { component def Cell { attribute n: int = 2; operation bump() { n = n + 1; } }
          component def Base { component 'inner part': Cell; }
          component def Derived specializes Base { redefines component 'inner part': Cell { redefines attribute n: int = 4; } } }`,
        `package Home { component subject { } component 'peer one': Shared::Derived; component 'peer two': Shared::Derived;
          test Check of subject { assert 'peer one'.'inner part'.n == 4; 'peer one'.'inner part'.bump(); assert 'peer one'.'inner part'.n == 5; }
          associate 'peer one' to Check; }`,
    ];
    const linked = await workspace(sources);
    assert.deepEqual(linked.docs.flatMap(doc => doc.diagnostics?.filter(item => item.severity === 1).map(item => item.message) ?? []), []);
    const result = runCase(linked.docs.map(doc => doc.parseResult.value).filter(a.isModel), 'Home::Check', { untilNs: 1000 });
    assert.equal(result.result, 'pass');
    assert.equal(result.run?.stores['peer one.inner part'].n, 5);
    assert.equal(result.run?.stores['peer two.inner part'].n, 4);
});

test('nonexecuted platform roots and unindexed multiplicity families are refused statically', async () => {
    const source = `package Limits { import Swaml::Platform; component def Host specializes Node { const attribute tag: int = 7; }
      component subject { } component host: Host;
      component def Cell { attribute n: int = 1; } component cells: Cell[2];
      test Check of subject { assert host.tag == 7; } associate host to Check; associate cells to Check; }`;
    await invalid(source, 'SW2010');
    await invalid(source.replace('host.tag == 7', 'cells.n == 1'), 'SW2010');
    await invalid(source.replace('test Check of subject', 'test Check of host').replace('associate host to Check;', ''), 'SW2010');
    const parsed = await parse(source.replace('assert host.tag == 7;', 'assert true;'));
    assert.deepEqual(testAccessRoots(parsed.model.packages[0].elements.find(a.isScenario)!).map(root => root.name), ['subject']);
});

test('ten existing components integrate through real routes and associated private checks', async () => {
    const parsed = await valid(readFileSync(new URL('../../../examples/30-associated-integration.swaml', import.meta.url), 'utf8'));
    const result = runCase([parsed.model], 'AssociatedIntegration::Delivery', { untilNs: 1000 });
    assert.equal(result.result, 'pass');
    assert.equal(Object.keys(result.run!.stores).length, 10);
    assert.equal(result.run?.stores.source.sent, true);
    for (let index = 2; index <= 10; index++) assert.equal(result.run?.stores['c' + index].last, index - 1);
    assert.equal(result.run?.trace.filter(event => event.kind === 'offer').length, 9);
});
