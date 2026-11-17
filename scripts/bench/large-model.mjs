// Deterministic large swa.ml models for the performance benchmark and the equivalence tests.
//
// largeModel(scale) has the shape of the editor's large-model budget fixture: at scale 1 about 1,750
// lines with 24 port definitions of 8 events, 6 leaf definitions with 3 long operations each, a state
// machine, 4 levels of nested parts (129 occurrences under one System), 6 use cases and 6 tests of 25
// steps and 12 requirements with satisfy/verify links. Every size grows with scale, including the
// number of top-level System occurrences, so projection work scales with the model.
//
// periodicModel(options) is a running model whose activations never stop: periodic producers publish
// over package connections to consumers, which forward requests to a server with a state machine.
// Its run length is chosen by untilNs, so simulation work scales with the number of steps.
//
// Usage: node scripts/bench/large-model.mjs [scale] > model.swaml
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function largeModel(scale = 1) {
    const ports = 24 * scale, events = 8, leaves = 6, steps = 25, systems = scale;
    const out = [];
    const line = (depth, text) => out.push('  '.repeat(depth) + text);
    line(0, 'package Large {');
    line(1, 'import Swaml::Views;');
    for (let p = 0; p < ports; p++) {
        line(1, `port def Bus${p} {`);
        for (let e = 0; e < events; e++)
            line(2, `provides event e${e}(value: uint);`);
        line(1, '}');
    }
    for (let r = 0; r < 12 * scale; r++) {
        line(1, `requirement 'Requirement ${r}' {`);
        line(2, `/** The system keeps signal ${r} below its limit. */`);
        line(2, `attribute limit: uint = ${100 + r};`);
        line(1, '}');
    }
    for (let d = 0; d < leaves; d++) {
        line(1, `component def Leaf${d} {`);
        line(2, 'reversed port input: Bus0;');
        line(2, 'port output: Bus0;');
        for (let a = 0; a < 6; a++)
            line(2, `attribute a${a}: uint = ${a};`);
        line(2, 'attribute ready: bool = false;');
        for (let o = 0; o < 3; o++) {
            line(2, `operation step${o}(value: uint) {`);
            line(3, 'var total: uint = value;');
            const emitted = [[0], [1, 2, 3, 4], [5, 6, 7]][o];
            for (let s = 0; s < 4 + 2 * o; s++) {
                line(3, `if (total > ${s * 10}) {`);
                line(4, `a${s % 6} = a${s % 6} + total;`);
                line(4, s < emitted.length ? `publish output.e${emitted[s]}(total);` : `ready = total > ${s};`);
                line(3, '} else {');
                line(4, `total = total + ${s + 1};`);
                line(3, '}');
            }
            line(2, '}');
        }
        line(2, 'schedule {');
        for (let e = 0; e < events; e++)
            line(3, `on receive input.e${e}(value) step${e % 3}(value);`);
        line(2, '}');
        line(1, '}');
    }
    line(1, 'component def Modes {');
    line(2, 'attribute lit: bool = false;');
    line(2, 'operation cycle() {');
    line(3, 'initial S0;');
    for (let s = 0; s < 8; s++) {
        line(3, `state S${s} {`);
        line(4, 'on entry {');
        line(5, 'lit = true;');
        line(4, '} on exit {');
        line(5, 'lit = false;');
        line(4, '}');
        line(4, `after ${s + 1}ms to ${s === 7 ? 'Done' : 'S' + (s + 1)} {`);
        line(4, '}');
        line(3, '}');
    }
    line(3, 'final state Done {');
    line(3, '}');
    line(2, '}');
    line(2, 'schedule {');
    line(3, 'on start cycle();');
    line(2, '}');
    line(1, '}');
    const level = (name, child, count) => {
        line(1, `component def ${name} {`);
        line(2, 'reversed port input: Bus0;');
        line(2, 'port output: Bus0;');
        for (let c = 0; c < count; c++)
            line(2, `component c${c}: ${child(c)};`);
        line(2, 'connect (input, c0.input);');
        for (let c = 0; c + 1 < count; c++)
            line(2, `connect (c${c}.output, c${c + 1}.input);`);
        line(2, `connect (c${count - 1}.output, output);`);
        line(2, 'attribute mode: uint = 0;');
        line(2, 'operation tick(value: uint) {');
        for (let s = 0; s < 10; s++)
            line(3, `mode = mode + value + ${s};`);
        line(2, '}');
        line(1, '}');
    };
    level('Level3', c => `Leaf${(c + 2) % leaves}`, 4);
    level('Level2', () => 'Level3', 4);
    level('Level1', () => 'Level2', 3);
    level('System', () => 'Level1', 2);
    line(1, 'component def Operator {');
    line(2, 'port panel: Bus0;');
    line(2, 'reversed port feedback: Bus0;');
    line(1, '}');
    line(1, 'component def Observer {');
    line(2, 'attribute seen: uint = 0;');
    line(1, '}');
    line(1, 'component modes: Modes;');
    for (let u = 0; u < 3; u++)
        line(1, `component observer${u}: Observer;`);
    for (let k = 0; k < systems; k++) {
        line(1, `component system${k}: System;`);
        line(1, `component operator${k}: Operator;`);
        line(1, `connect (operator${k}.panel, system${k}.input);`);
        line(1, `connect (system${k}.output, operator${k}.feedback);`);
    }
    const scenario = (keyword, name, kind, k) => {
        line(1, `${keyword} '${name}' of system${k} {`);
        line(2, `/** ${kind} with ${steps} steps. */`);
        for (let s = 0; s < steps; s++)
            line(2, `publish operator${k}.panel.e${s % 5 === 4 ? 1 : 0}(${s});`);
        line(2, `on receive operator${k}.feedback.e1(value) {`);
        line(3, 'assert value >= 0;');
        line(2, '} or after 2s {');
        line(3, 'fail "no feedback";');
        line(2, '}');
        line(1, '}');
        line(1, `associate operator${k} to '${name}';`);
    };
    for (let u = 0; u < 6 * scale; u++)
        scenario('use case', `Use ${u}`, 'A use case', u % systems);
    for (let t = 0; t < 6 * scale; t++)
        scenario('test', `Check ${t}`, 'A test', t % systems);
    for (let r = 0; r < 12 * scale; r++) {
        line(1, `satisfy 'Requirement ${r}' by system${r % systems};`);
        line(1, `verify 'Requirement ${r}' by 'Check ${r % (6 * scale)}';`);
    }
    line(1, "view story: Sequence of 'Use 0';");
    line(0, '}');
    return out.join('\n') + '\n';
}

/**
 * A model that keeps running: producers publish on a period, consumers record and forward requests
 * to a server whose state machine answers them. producers sets the number of producer/consumer pairs.
 */
export function periodicModel({ producers = 4, periodMs = 1 } = {}) {
    const out = [];
    const line = (depth, text) => out.push('  '.repeat(depth) + text);
    line(0, 'package Load {');
    line(1, 'port def Feed {');
    line(2, 'provides event sample(value: int);');
    line(1, '}');
    line(1, 'port def Ask {');
    line(2, 'provides operation total(value: int) returns int;');
    line(1, '}');
    line(1, 'component def Producer {');
    line(2, 'port feed: Feed;');
    line(2, 'attribute count: int = 0;');
    line(2, 'operation tick() {');
    line(3, 'count = count + 1;');
    line(3, 'publish feed.sample(count);');
    line(2, '}');
    line(2, 'schedule {');
    line(3, `on every ${periodMs}ms tick();`);
    line(2, '}');
    line(1, '}');
    line(1, 'component def Consumer {');
    line(2, 'reversed port inbox: Feed;');
    line(2, 'reversed port ask: Ask;');
    line(2, 'attribute last: int = 0;');
    line(2, 'attribute sum: int = 0;');
    line(2, 'operation take(value: int) {');
    line(3, 'last = value;');
    line(3, 'sum = ask.total(value);');
    line(2, '}');
    line(2, 'schedule {');
    line(3, 'on receive inbox.sample(value) take(value);');
    line(2, '}');
    line(1, '}');
    line(1, 'component def Server {');
    for (let i = 0; i < producers; i++)
        line(2, `port ask${i}: Ask;`);
    line(2, 'attribute total: int = 0;');
    line(2, 'operation add(value: int) returns int {');
    line(3, 'total = total + value;');
    line(3, 'return total;');
    line(2, '}');
    line(2, 'schedule {');
    for (let i = 0; i < producers; i++)
        line(3, `on call ask${i}.total(value) add(value);`);
    line(2, '}');
    line(1, '}');
    line(1, 'component server: Server;');
    for (let i = 0; i < producers; i++) {
        line(1, `component producer${i}: Producer;`);
        line(1, `component consumer${i}: Consumer;`);
        line(1, `connect (producer${i}.feed, consumer${i}.inbox);`);
        line(1, `connect (consumer${i}.ask, server.ask${i});`);
    }
    line(0, '}');
    return out.join('\n') + '\n';
}

/**
 * A consumer that waits for each input with a long timeout while inputs arrive every millisecond, so
 * nearly every receive timeout is cancelled long before it would expire.
 */
export function timerModel({ iterations = 20000, timeout = '1s' } = {}) {
    return `package Timers {
  port def Feed {
    provides event ev(v: int);
  }
  component def Producer {
    port feed: Feed;
    attribute n: int = 0;
    operation tick() {
      n = n + 1;
      publish feed.ev(n);
    }
    schedule {
      on every 1ms tick();
    }
  }
  component def Consumer {
    reversed port feed: Feed;
    attribute seen: int = 0;
    attribute idle: int = 0;
    operation listen() {
      while (true, ${iterations} times) {
        on receive feed.ev(v) {
          seen = v;
        } or after ${timeout} {
          idle = idle + 1;
        }
      }
    }
    schedule {
      on start listen();
    }
  }
  component producer: Producer;
  component consumer: Consumer;
  connect (producer.feed, consumer.feed);
}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    process.stdout.write(largeModel(Number(process.argv[2] ?? 1) || 1));
