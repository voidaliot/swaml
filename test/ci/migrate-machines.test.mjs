// States in the flow, package 2b: the migration of 2.2 machines (scripts/migrate-machines.mjs, proposal 7.1), one case
// per step of the recipe, read with the kept 2.2 grammar. Needs a build (out/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSource, migrationTools } from '../../scripts/migrate-machines.mjs';

const tools = await migrationTools();
const wrap = (machine, ports = 'provides event go(n: uint); provides event stop(); provides event tick();') => `package M {
  port def P { ${ports} }
  component def C {
    reversed port p: P;
    attribute x: uint = 0;
    operation run() {
      ${machine}
    }
    schedule { on start run(); }
  }
}
`;
const migrate = machine => migrateSource(wrap(machine), tools.parse, tools.identity);
const body = r => r.text.slice(r.text.indexOf('operation run() {') + 'operation run() {'.length, r.text.indexOf('schedule {')).replace(/\s+/gu, ' ').trim();

test('7.1 steps 3 and 5: one line per member, transitions as an if / else if chain in declaration order, the unguarded one last; leaves to the next state are exit;', () => {
    const r = migrate(`initial a;
      state a {
        on receive p.go(n) when (n > 2) to c { x = n; }
        on receive p.go(n) when (n > 1) to b { }
        on receive p.go(n) to a { x = 0; }
      }
      state b { on receive p.stop() to c { } }
      final state c { }`);
    assert.deepEqual(r.refused, []);
    assert.equal(body(r), 'state a { on receive p.go(n) { if (n > 2) { x = n; to c; } else if (n > 1) { exit; } else { x = 0; to a; } } } state b { on receive p.stop() exit; } state c { } }');
    // Identity map: the line, each if and each leave name their 2.2 transition; effects their 2.2 effect statements.
    assert.equal(r.map['M::C.run/0'], 'M::C.run/states/0');
    assert.equal(r.map['M::C.run/0/0'], 'M::C.run/states/0/transitions/0');
    assert.equal(r.map['M::C.run/0/0/body/0/then/0'], 'M::C.run/states/0/transitions/0/effect/0');
    assert.equal(r.map['M::C.run/0/0/body/0/then/1'], 'M::C.run/states/0/transitions/0');
    assert.equal(r.map['M::C.run/0/0/body/0/otherwise/0'], 'M::C.run/states/0/transitions/1');
    assert.equal(r.map['M::C.run/0/0/body/0/otherwise/0/otherwise/1'], 'M::C.run/states/0/transitions/2');
});

test('7.1 step 3: transitions after an unguarded one on the same member are removed and reported; bindings renamed, capture refused', () => {
    const r = migrate(`initial a;
      state a {
        on receive p.go(n) to b { x = n; }
        on receive p.go(k) when (k > 1) to a { }
      }
      final state b { }`);
    assert.deepEqual(r.machines[0].removedTransitions.length, 1);
    const renamed = migrate(`initial a;
      state a {
        on receive p.go(n) when (n > 1) to b { x = n; }
        on receive p.go(k) to a { x = k; }
      }
      final state b { }`);
    assert.match(body(renamed), /\} else \{ x = n; to a; \}/u);
    assert.deepEqual(renamed.machines[0].renamedBindings, ['a: k -> n']);
    const captured = migrate(`initial a;
      state a {
        on receive p.go(n) when (n > 1) to b { }
        on receive p.go(k) to a { x = n; }
      }
      final state b { }`);
    assert.ok(captured.refused.some(x => x.includes('the binding n would be captured in a')), captured.refused.join('\n'));
    assert.equal(captured.text, undefined);
});

test('7.1 step 4: exit actions are copied into every leaving block when a leaving transition has an effect; otherwise kept', () => {
    const r = migrate(`initial a;
      state a {
        on exit { x = x + 1; }
        on receive p.go(n) to b { x = n; }
        on receive p.stop() to b { }
      }
      final state b { }`);
    assert.equal(body(r), 'state a { on receive p.go(n) { x = x + 1; x = n; exit; } on receive p.stop() { x = x + 1; exit; } } state b { } }');
    const kept = migrate(`initial a;
      state a {
        on exit { x = x + 1; }
        on receive p.stop() to b { }
      }
      final state b { }`);
    assert.equal(body(kept), 'state a { on exit { x = x + 1; } on receive p.stop() exit; } state b { } }');
});

test('7.1 steps 3 and 6: timer lines first, sorted by duration; an unguarded timer not shorter than an earlier one is removed', () => {
    const r = migrate(`initial a;
      state a {
        on receive p.stop() to b { }
        after 20ms to b { x = 2; }
        after 10ms to a { x = 1; }
        after 10ms to b { }
      }
      final state b { }`);
    assert.equal(body(r), 'state a { after 10ms { x = 1; to a; } on receive p.stop() exit; } state b { } }');
    assert.equal(r.machines[0].removedTimers.length, 2);
});

test('7.1 steps 2 and 8: finals last, return; after each final step but the last statement; initial first', () => {
    const r = migrate(`initial a;
      final state done { }
      state a {
        on receive p.go(n) to done { }
        on receive p.stop() to failed { }
      }
      final state failed { }`);
    assert.equal(body(r), 'state a { on receive p.go(n) exit; on receive p.stop() to failed; } state done { } return; state failed { } }');
});

test('7.1 step 9: a dead end refuses the machine; WP5 forms are refused for a hand rewrite; a source that is not 2.2 is refused', () => {
    assert.ok(migrate(`initial a; state a { on receive p.go(n) to b { } } state b { }`).refused.some(x => x.includes('b: a non-final state without transitions waits for ever')));
    const wp5 = migrateSource(wrap('initial a; state a { when (x > 1) to b { } } final state b { }'), tools.parse, tools.identity);
    assert.ok(wp5.refused.length > 0);
    assert.deepEqual(migrateSource('package M { component def C { operation run() { x = if (true) 1 else 2; } } }', tools.parse, tools.identity).refused, ['the source does not parse as 2.2']);
});

test('7.1 a source without machines is left alone; a migrated source keeps every byte outside its machines', () => {
    const plain = wrap('x = 1;');
    const r = migrateSource(plain, tools.parse, tools.identity);
    assert.equal(r.machines.length, 0);
    assert.equal(r.text, undefined);
    const machine = migrate('initial a; state a { on receive p.stop() to b { } } final state b { }');
    assert.ok(machine.text.startsWith(wrap('').slice(0, wrap('').indexOf('operation run() {') + 'operation run() {'.length)));
    assert.ok(machine.text.endsWith(wrap('').slice(wrap('').indexOf('\n    }\n    schedule'))));
});

// ---------------------------------------------------------------- review 1: M-1, M-2, M-3
const pair = (first, second, extra = '') => migrateSource(`package Sw {
  port def In { requires event p(a: int, b: int, c: int); }
  component def M {
    port i: In;
    attribute r: int = 0;
    operation run() {
      initial S0;
      state S0 {
        on receive i.p(${first.join(', ')}) when (${first[0]} > 100) to S0 { r = 1; }
        on receive i.p(${second.join(', ')}) when (${second[0]} > ${second[1]}) to S1 { ${extra}r = ${second[0]} - ${second[1]} + ${second[2]}; fail "${second[0]} was larger"; }
      }
      final state S1 { }
    }
    schedule { on start run(); }
  }
}
`, tools.parse, tools.identity);

test('M-1 (review 1): bindings renamed to the first transition\'s names all at once: swapped, rotated and partially equal names (generated)', () => {
    const names = ['a', 'b', 'c', 'x'];
    const lists = names.flatMap(p => names.flatMap(q => names.flatMap(s => p !== q && q !== s && p !== s ? [[p, q, s]] : [])));
    let checked = 0;
    for (const first of lists)
        for (const second of lists) {
            const r = pair(first, second);
            assert.deepEqual(r.refused, [], `${first} / ${second}`);
            // Position k of the second transition reads the first transition's name k.
            const expected = `} else if (${first[0]} > ${first[1]}) { r = ${first[0]} - ${first[1]} + ${first[2]}; fail "${second[0]} was larger";`;
            assert.ok(r.text.replace(/\s+/g, ' ').includes(expected), `${first} / ${second}:\n${r.text}`);
            checked++;
        }
    assert.equal(checked, 576);
});

test('M-1 (review 1): a local of the second transition named like a first binding would be captured: refused', () => {
    const r = pair(['a', 'b', 'c'], ['b', 'c', 'x'], 'var a: int = 1; ');
    assert.ok(r.refused.some(x => x.includes('would be captured')), JSON.stringify(r.refused));
});

test('M-3 (review 1): comments of the machine are kept; text inside string literals is not renamed', () => {
    const r = migrateSource(`package Sw {
  port def In { requires event p(a: int, b: int); }
  component def M {
    port i: In;
    attribute r: int = 0;
    operation run() {
      initial S0;
      // before S0
      state S0 {
        // inside S0
        on receive i.p(a, b) when (a > 100) to S0 { r = 1; }
        /* between transitions */
        on receive i.p(c, d) when (c > d) to S1 { r = c; fail "c is too large"; }
      }
      // before S1
      final state S1 { }
    }
    schedule { on start run(); }
  }
}
`, tools.parse, tools.identity);
    assert.deepEqual(r.refused, []);
    for (const c of ['// before S0', '// inside S0', '/* between transitions */', '// before S1'])
        assert.ok(r.text.includes(c), `${c}:\n${r.text}`);
    assert.ok(r.text.includes('fail "c is too large";') && r.text.includes('r = a;'), r.text);
});

test('M-2 (review 1): the CLI validates the migrated text and writes nothing, exiting 1, when it does not validate', async () => {
    const { mkdtempSync, copyFileSync, readFileSync } = await import('node:fs');
    const { execFileSync } = await import('node:child_process');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'migrate-')), file = join(dir, 'dead.swaml');
    copyFileSync(new URL('../fixtures/migration/dead-only-publish.swaml22', import.meta.url), file);
    const before = readFileSync(file, 'utf8');
    let status = 0, out = '';
    try {
        out = execFileSync(process.execPath, [new URL('../../scripts/migrate-machines.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), file, '--write'], { encoding: 'utf8' });
    }
    catch (e) {
        status = e.status;
        out = String(e.stdout);
    }
    assert.equal(status, 1, out);
    assert.match(out, /does not validate, nothing written/);
    assert.match(out, /needs an emitting operation/);
    assert.equal(readFileSync(file, 'utf8'), before);
});
