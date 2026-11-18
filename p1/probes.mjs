// PROTOTYPE P1: probes of the rules the design review doubted, each a tiny source with its observed trace.
// node p1/probes.mjs [outDir]
import { pathToFileURL } from 'node:url';
const outDir = process.argv[2] ?? 'E:/t/sw-p1/out';
const base = pathToFileURL(outDir + '/').href;
const { EmptyFileSystem } = await import('langium');
const { parseHelper } = await import('langium/test');
const { createSwamlServices } = await import(base + 'src/language/swaml-module.js');
const { simulate } = await import(base + 'src/simulation/simulator.js');
const fmt = ns => `${ns / 1e6}ms`;
async function probe(title, text, options = { untilNs: 2e8 }, show = () => true) {
  console.log(`## ${title}`);
  const { Swaml } = createSwamlServices(EmptyFileSystem);
  const d = await parseHelper(Swaml)(text, { documentUri: `file:///probe-${Math.random().toString(36).slice(2)}.swaml`, validation: true });
  const diags = (d.diagnostics ?? []).filter(x => x.severity <= 2);
  for (const x of diags) console.log(`  ${x.severity === 1 ? 'error' : 'warning'} line ${x.range.start.line + 1}: ${x.message}`);
  if (diags.some(x => x.severity === 1)) return;
  const r = simulate([d.parseResult.value], 'P', { maxSteps: 20000, ...options });
  for (const e of r.trace) {
    const s = String(e.subject);
    if (['state', 'discardInput', 'keep', 'complete', 'failure', 'violation', 'overflow', 'write', 'publish', 'timer'].includes(e.kind) && show(e))
      console.log(`  ${fmt(e.timeNs)} ${e.kind} ${s}${e.state ? ' ' + e.state : ''}${e.stay ? ' stay' : ''}${e.reason ? ' ' + e.reason : ''}${e.code ? ' ' + e.code : ''}${e.value !== undefined ? ' = ' + JSON.stringify(e.value) : ''}${e.args ? '(' + e.args.join(', ') + ')' : ''}`);
  }
  console.log(`  status ${r.status} at ${fmt(r.timeNs)}, stores ${JSON.stringify(r.stores.c)}`);
}
const pkg = (ports, c, sender, extra = '') => `package P {
  port def In { ${ports} }
  ${extra}
  component def C { port p: In; ${c} schedule { on start run(); } }
  component def S { reversed port p: In; operation emit() { ${sender} } schedule { on start emit(); } }
  component c: C;
  component s: S;
  connect (s.p, c.p);
}`;
const two = 'requires event m(); requires event n();';
const notMine = e => !String(e.subject).startsWith('s.');

await probe('1. Same-instant timer against delivery (phase rule): input written first, timer at 20ms, message delivered at 20ms',
  pkg('requires event m();', `attribute hits: uint = 0; operation run() { state a { on receive p.m() to b { hits = hits + 1; } after 20ms to c; } state b { } return; state c { } }`,
    'wait 20ms; publish p.m();'), undefined, notMine);

await probe('2a. Written order at an arrival selection: entry suspends 30ms, m queued at 10ms, timer 20ms written AFTER the input group',
  pkg('requires event m();', `operation run() { state a { on entry { wait 30ms; } on receive p.m() to viaInput; after 20ms to viaTimer; } state viaInput { } return; state viaTimer { } }`,
    'wait 10ms; publish p.m();'), undefined, notMine);
await probe('2b. Same, timer written BEFORE the input group',
  pkg('requires event m();', `operation run() { state a { on entry { wait 30ms; } after 20ms to viaTimer; on receive p.m() to viaInput; } state viaInput { } return; state viaTimer { } }`,
    'wait 10ms; publish p.m();'), undefined, notMine);

const order = `attribute log: uint = 0; operation run() { state busy { on entry { wait 10ms; } on receive p.m() to a; on receive p.n() to b; } state a { on entry { log = 1; } } return; state b { on entry { log = 2; } } }`;
const qos = `import Swaml::Qos;
  qos def Once: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 8; overflow = Overflow.reject; requestTimeout = 5ms; }`;
await probe('3. Two members, different route latencies: m offered at 0 with a 5ms fault delay (delivered 5ms), n offered at 1ms (delivered 1ms); the state selects at 10ms. 2.2 would serve m (queue created first)',
  pkg(two, order, 'publish p.m(); wait 1ms; publish p.n();', qos).replace('connect (s.p, c.p);', 'connect: Once (s.p, c.p);'), { untilNs: 2e8, faults: [{ offer: 1, kind: 'duplicate', delayNs: 5000000 }] }, notMine);
await probe('4a. A false input guard consumes the event (discardInput guard)',
  pkg('requires event m(v: int);', `attribute got: int = 0; operation run() { state a { on receive p.m(v) when (v > 0) exit { got = v; } } }`, 'publish p.m(-1); wait 1ms; publish p.m(2);'), undefined, notMine);
await probe('4b. A false guard on an attribute member drops its latest value',
  pkg('requires attribute level: int;', `attribute got: int = 0; operation run() { state a { on receive p.level(v) when (v > 5) exit { got = v; } after 50ms exit; } }`, 'send p.level(1); wait 1ms; send p.level(2);'), undefined, notMine);

await probe('5a. A guarded timer whose guard becomes true later through a stay reaction (local)',
  pkg('requires event set();', `operation run() { var g: bool = false; state a { on receive p.set() stay { g = true; } after 10ms when (g) to early; after 100ms to late; } state early { } return; state late { } }`, 'wait 30ms; publish p.set();'), undefined, notMine);
await probe('5b. A timer guard that reads an attribute written by ANOTHER operation (stage 1 SIF-S05 forbids it; the prototype does not check it): no wake',
  pkg('requires event set();', `attribute g: bool = false; operation flag() { g = true; } operation run() { ignore p.set; state a { after 10ms when (g) to early; after 100ms to late; } state early { } return; state late { on receive p.set() exit; } }`, 'wait 1ms; publish p.set();').replace('schedule { on start run(); }', 'schedule { on start run(); on every 30ms flag(); }'), undefined, notMine);

await probe('6. Kept input with a rejecting queue (capacity 1, reject): the sender fails while the state keeps the member',
  `package P {
  import Swaml::Qos;
  qos def One: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 1; overflow = Overflow.reject; requestTimeout = 5ms; }
  port def In { requires event m(); requires event go(); }
  component def C { port p: In; operation run() { keep p.m; ignore p.go; state a { on receive p.go() exit; } state b { on receive p.m() exit; } } schedule { on start run(); } }
  component def S { reversed port p: In; operation emit() { publish p.m(); publish p.m(); wait 1ms; publish p.go(); } schedule { on start emit(); } }
  component c: C;
  component s: S;
  connect: One (s.p, c.p);
}`, undefined, () => true);

await probe('7. A jump out of a loop and out of nested ifs',
  pkg('requires event m();', `attribute n: uint = 0; operation run() { ignore p.m; while (true) { n = n + 1; if (n > 2) { if (n < 10) { state leaving { after 1ms to done; } } } state tick { on receive p.m() stay { n = n; } after 1ms exit; } } state done { on entry { n = n * 100; } } }`, 'wait 1s; publish p.m();'), undefined, notMine);

await probe('8. A backward jump over a local declaration re-runs it',
  pkg('requires event m();', `attribute total: uint = 0; attribute passes: uint = 0; operation run() { ignore p.m; state top { on receive p.m() stay { total = total; } after 1ms exit; } var x: uint = 0; x = x + 1; total = total + x; passes = passes + 1; if (passes < 3) { to top; } }`, 'wait 1s; publish p.m();'), undefined, notMine);
await probe('8b. A forward jump over a used declaration is rejected (SIF-D04)',
  pkg('requires event m();', `attribute total: uint = 0; operation run() { state top { on receive p.m() to later; after 1ms exit; } var x: uint = 7; state later { on entry { total = x; } } }`, ''), undefined, notMine);

await probe('9. Falling off the end of a cyclic operation (the lock cycle with its back jump deleted): later input is discarded',
  pkg('requires event lock(v: bool);', `attribute pulses: uint = 0; operation run() { keep p.lock; state unlocked { on receive p.lock(v) when (v) exit; } state locking { on entry { pulses = pulses + 1; } after 5ms exit; } state isLocked { on receive p.lock(v) when (not v) exit; } state unlocking { on entry { pulses = pulses + 1; } after 5ms exit; } }`,
    'publish p.lock(true); wait 10ms; publish p.lock(false); wait 10ms; publish p.lock(true);'), undefined, notMine);

await probe('10. A zero-time cycle of jumps through a named step (SIF-D07 is not implemented): the run ends at the step limit',
  pkg('requires event m();', `operation run() { ignore p.m; state w { on receive p.m() exit; } state a { } to a; }`, 'publish p.m();'), { untilNs: 2e8 }, e => e.kind !== 'state');
await probe('8c. Forward jump over a declaration used only before the target is accepted',
  pkg('requires event m();', `attribute total: uint = 0; operation run() { state top { on receive p.m() to later; after 1ms exit; } var x: uint = 7; total = x; state later { } }`, 'publish p.m();'), undefined, notMine);
