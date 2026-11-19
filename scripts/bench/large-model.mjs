// Deterministic large swa.ml models for the performance benchmark and the equivalence tests.
//
// largeModel(scale) is a process plant written for this benchmark: signal port definitions, device
// definitions with looping operations, a controller state machine, sites of lines of cells of devices,
// use cases and tests that drive a site through its panel, and requirements with satisfy/verify links.
// Every count grows with scale, including the number of top-level sites, so projection work scales
// with the model.
//
// periodicModel(options) is a running model whose activations never stop: periodic producers publish
// over package connections to consumers, which call a server. Its run length is chosen by untilNs, so
// simulation work scales with the number of steps. timerModel(options) cancels long receive timeouts.
//
// Usage: node scripts/bench/large-model.mjs [scale] > model.swaml
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function largeModel(scale = 1) {
    const out = [], devices = 8, sites = 2 * scale;
    const line = (depth, text) => out.push('  '.repeat(depth) + text);
    line(0, 'package Plant {');
    line(1, 'import Swaml::Views;');
    for (let k = 0; k < 20 * scale; k++) {
        line(1, `port def Signal${k} {`);
        for (let j = 0; j < 6; j++)
            line(2, `provides event level${j}(amount: int);`);
        line(2, 'provides event alarm(code: int);');
        line(1, '}');
    }
    for (let r = 0; r < 16 * scale; r++) {
        line(1, `requirement 'Limit ${r}' {`);
        line(2, `/** Reading ${r} stays within its bound after every cycle. */`);
        line(2, `attribute bound: int = ${50 + 3 * r};`);
        line(2, `attribute margin: int = ${r % 7};`);
        line(1, '}');
    }
    for (let d = 0; d < devices; d++) {
        line(1, `component def Device${d} {`);
        line(2, 'reversed port inlet: Signal0;');
        line(2, 'port outlet: Signal0;');
        for (let v = 0; v < 5; v++)
            line(2, `attribute reading${v}: int = ${d + v};`);
        line(2, 'attribute faults: int = 0;');
        for (let o = 0; o < 3; o++) {
            line(2, `operation handle${o}(amount: int) {`);
            line(3, 'var rest: int = amount;');
            line(3, `for (var i: int = 0; i < ${2 + o}; i = i + 1) {`);
            line(4, `reading${o} = reading${o} + i;`);
            line(3, '}');
            for (let s = 0; s < 5 + 2 * o; s++) {
                line(3, `while (rest > ${40 + 5 * s}, 2 times) {`);
                line(4, `rest = rest - ${s + 2};`);
                line(4, `reading${(s + o) % 5} = reading${(s + o) % 5} + 1;`);
                line(3, '}');
            }
            for (const j of [[0, 1], [2, 3, 4], [5]][o])
                line(3, `publish outlet.level${j}(rest);`);
            if (o === 2)
                line(3, 'publish outlet.alarm(faults);');
            line(2, '}');
        }
        line(2, 'schedule {');
        for (let j = 0; j < 6; j++)
            line(3, `on receive inlet.level${j}(amount) handle${j % 3}(amount);`);
        line(3, 'on receive inlet.alarm(code) handle0(code);');
        line(2, '}');
        line(1, '}');
    }
    line(1, 'component def Controller {');
    line(2, 'attribute phase: int = 0;');
    line(2, 'operation sequence() {');
    // States in the flow: each state leaves to the next one after its timer; Stopped is the named last step.
    const states = ['Warmup', 'Fill', 'Heat', 'Hold', 'Drain', 'Rinse'];
    states.forEach((name, i) => {
        line(3, `state ${name} {`);
        line(4, 'on entry {');
        line(5, `phase = ${i + 1};`);
        line(4, '}');
        line(4, `after ${2 * i + 1}ms exit;`);
        line(3, '}');
    });
    line(3, 'state Stopped {');
    line(3, '}');
    line(2, '}');
    line(2, 'schedule {');
    line(3, 'on start sequence();');
    line(2, '}');
    line(1, '}');
    const assembly = (name, parts) => {
        line(1, `component def ${name} {`);
        line(2, 'reversed port inlet: Signal0;');
        line(2, 'port outlet: Signal0;');
        parts.forEach((type, i) => line(2, `component p${i}: ${type};`));
        line(2, 'connect (inlet, p0.inlet);');
        for (let i = 1; i < parts.length; i++)
            line(2, `connect (p${i - 1}.outlet, p${i}.inlet);`);
        line(2, `connect (p${parts.length - 1}.outlet, outlet);`);
        line(2, 'attribute cycles: int = 0;');
        line(2, 'operation count(amount: int) {');
        for (let s = 0; s < 6; s++)
            line(3, `cycles = cycles + amount - ${s};`);
        line(2, '}');
        line(1, '}');
    };
    for (let c = 0; c < 4; c++)
        assembly(`Cell${c}`, Array.from({ length: 5 }, (_, i) => `Device${(c + i) % devices}`));
    assembly('Line', ['Cell0', 'Cell1', 'Cell2', 'Cell3']);
    assembly('Site', ['Line', 'Line', 'Line', 'Line']);
    line(1, 'component def Panel {');
    line(2, 'port command: Signal0;');
    line(2, 'reversed port display: Signal0;');
    line(1, '}');
    line(1, 'component controller: Controller;');
    for (let k = 0; k < sites; k++) {
        line(1, `component site${k}: Site;`);
        line(1, `component panel${k}: Panel;`);
        line(1, `connect (panel${k}.command, site${k}.inlet);`);
        line(1, `connect (site${k}.outlet, panel${k}.display);`);
    }
    const scenario = (keyword, name, k) => {
        line(1, `${keyword} '${name}' of site${k} {`);
        line(2, `/** The operator drives site ${k} through 20 commands and waits for its alarm report. */`);
        for (let s = 0; s < 20; s++)
            line(2, `publish panel${k}.command.level${s % 3}(${10 * s});`);
        line(2, `on receive panel${k}.display.alarm(code) {`);
        line(3, 'assert code == 0;');
        line(2, '} or after 1s {');
        line(3, 'fail "no alarm report";');
        line(2, '}');
        line(1, '}');
        line(1, `associate panel${k} to '${name}';`);
    };
    for (let u = 0; u < 5 * scale; u++)
        scenario('use case', `Operate ${u}`, u % sites);
    for (let t = 0; t < 5 * scale; t++)
        scenario('test', `Inspect ${t}`, t % sites);
    for (let r = 0; r < 16 * scale; r++) {
        line(1, `satisfy 'Limit ${r}' by site${r % sites};`);
        line(1, `verify 'Limit ${r}' by 'Inspect ${r % (5 * scale)}';`);
    }
    line(1, "view walkthrough: Sequence of 'Operate 0';");
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
