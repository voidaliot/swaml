// PROTOTYPE P1r/P5 probes: tiny sources for the points the review and revision 4's section 5 call disputed or surprising,
// each printed with its observed trace. node p4/probes.mjs [filter]
import { parse, simulate, fmt } from './lib.mjs';
const only = process.argv[2];
async function probe(title, text, options = {}, show = e => !String(e.subject).startsWith('s.')) {
  if (only && !title.includes(only)) return;
  console.log(`## ${title}`);
  const p = await parse(text, true);
  for (const x of p.diags) console.log(`  ${x.severity === 1 ? 'error' : 'warning'} line ${x.range.start.line + 1}: ${x.message}`);
  if (p.parserErrors.length) { console.log('  parse errors: ' + p.parserErrors.map(e => e.message).join('; ')); return; }
  if (p.errors.length) return;
  const r = simulate([p.model], 'P', { maxSteps: 200000, untilNs: 2e9, ...options });
  for (const e of r.trace) {
    const s = String(e.subject);
    if (['state', 'discardInput', 'complete', 'failure', 'violation', 'overflow', 'write', 'publish', 'send', 'timer', 'replaceAttribute'].includes(e.kind) && show(e))
      console.log(`  ${fmt(e.timeNs)} ${e.kind} ${s}${e.state ? ' ' + e.state : ''}${e.stay ? ' stay' : ''}${e.reason ? ' ' + e.reason : ''}${e.code ? ' ' + e.code : ''}${e.value !== undefined ? ' = ' + JSON.stringify(e.value) : ''}${e.args ? '(' + e.args.join(', ') + ')' : ''}${e.kind === 'discardInput' && e.source ? ' from ' + e.source : ''}`);
  }
  console.log(`  status ${r.status} at ${fmt(r.timeNs)}, stores ${JSON.stringify(r.stores.c)}`);
  return r;
}
/** A controller c (operation run, on start) and a sender s (operation emit, on start), connected through port p. Every
 * required member gets an unscheduled emitter in s; o.out an unscheduled emitter in c (the validator wants both). */
const pkg = (ports, c, sender, extra = '', connect = 'connect (s.p, c.p);') => {
  ports = ports.split(';').map(x => x.trim()).filter(x => x && c.includes(`on receive p.${/event (\w+)/.exec(x)[1]}(`)).map(x => x + ';').join(' ');
  const emits = [...ports.matchAll(/requires event (\w+)\(([^)]*)\)/g)].map(([, n, ps]) => `publish p.${n}(${ps.split(',').filter(x => x.trim()).map(() => '0').join(', ')});`).join(' ');
  return `package P {
  import Swaml::Qos;
  port def In { ${ports} }
  port def Out { provides event out(v: int); }
  ${extra}
  component def C { port p: In; port o: Out; operation never() { publish o.out(0); } ${c} schedule { on start run(); } }
  component def S { reversed port p: In; operation emitAll() { ${emits} } operation emit() { ${sender} } schedule { on start emit(); } }
  component def K { reversed port o: Out; operation sink() { } schedule { on receive o.out(v) sink(); } }
  component c: C;
  component s: S;
  component k: K;
  ${connect}
  connect (c.o, k.o);
}`;
};
const one = 'qos def One: Policy { delivery = Delivery.atMostOnce; ordering = Ordering.fifo; capacity = 1; overflow = Overflow.dropOldest; requestTimeout = 1s; }';
const mn = 'requires event m(v: int); requires event n(); requires event q();';

console.log('# P1r: zero-time wait with re-pick');
await probe('R1. capacity-1 dropOldest: m(1) and m(2) arrive while on entry waits 5 ms; the state takes the newest (the queue kept only m(2))',
  pkg(mn, `attribute got: int = 0; operation run() { state a { on entry { wait 5ms; } on receive p.m(v) { got = v; exit; } } state b { on receive p.n() { exit; } } }`,
    'wait 1ms; publish p.m(1); wait 2ms; publish p.m(2);', one, 'connect : One (s.p, c.p);'));
await probe('R3. queued named and unnamed input when the state begins to wait: unnamed dropped in delivery order, named taken one per look',
  pkg(mn, `attribute got: int = 0; operation run() { state a { on entry { wait 5ms; } on receive p.m(v) { got = got * 10 + v; if (v == 3) { exit; } } } state b { on receive p.q() { } on receive p.n() { exit; } } }`,
    'wait 1ms; publish p.n(); publish p.m(1); publish p.q(); publish p.m(2); publish p.m(3); publish p.n();'));

console.log('\n# Section 5 surprises (flat)');
await probe('S1. a statement written before the line that changes what it reads sees the change at the next look',
  pkg(mn, `attribute n: int = 0; operation run() { state a { if (n >= 2) { exit; } on receive p.m(v) { n = n + 1; } } state b { on entry { publish o.out(n); } on receive p.q() { exit; } } }`,
    'publish p.m(1); wait 1ms; publish p.m(2); wait 1ms; publish p.m(3);'));
await probe('S1b. the same with the statement after the line: leaves at the second message',
  pkg(mn, `attribute n: int = 0; operation run() { state a { on receive p.m(v) { n = n + 1; } if (n >= 2) { exit; } } state b { on entry { publish o.out(n); } on receive p.q() { exit; } } }`,
    'publish p.m(1); wait 1ms; publish p.m(2); wait 1ms; publish p.m(3);'));
await probe('S2. a timer block with an inner if is checked once: ready becomes true at 20 ms, after the 10 ms timer; the state never leaves',
  pkg(mn, `attribute ready: bool = false; operation run() { state a { after 10ms { if (ready) { exit; } } on receive p.m(v) { ready = true; } } state b { on entry { publish o.out(1); } on receive p.q() { exit; } } }`,
    'wait 20ms; publish p.m(1);'));
await probe('S2b. "from 10 ms on, as soon as ready": a parent timer and an inner state (the traffic-light pattern)',
  pkg(mn, `attribute ready: bool = false; operation run() { state a { on receive p.m(v) { ready = true; } state minimum { after 10ms { exit; } } state extended { if (ready) { exit; } } } state b { on entry { publish o.out(1); } on receive p.q() { exit; } } }`,
    'wait 20ms; publish p.m(1);'));
await probe('S3. a plain statement in a state of an on start machine runs at every look (arrival, each message, each timer)',
  pkg(mn, `attribute looks: int = 0; operation run() { state a { looks = looks + 1; on receive p.m(v) { } on receive p.n() { exit; } after 5ms { } after 7ms { } } }`,
    'publish p.m(1); publish p.m(2); wait 10ms; publish p.n();'));
await probe('S4. text-order leaving: the line\'s statements before on exit, then the next entry',
  pkg(mn, `operation run() { state a { on exit { publish o.out(1); } after 1ms { publish o.out(2); exit; } } state b { on entry { publish o.out(3); } } }`, ''));
await probe('S4b. the migrator\'s copy keeps 2.2\'s exit-effect-entry order',
  pkg(mn, `operation run() { state a { after 1ms { publish o.out(1); publish o.out(2); exit; } } state b { on entry { publish o.out(3); } } }`, ''));

console.log('\n# P5: parents');
await probe('P1. direct entry into a substate: parents entered outermost first, then the target; exit innermost first',
  pkg(mn, `operation run() {
    state idle { on receive p.m(v) { if (v == 1) { to deep; } else { exit; } } }
    state outer { on entry { publish o.out(10); } on exit { publish o.out(-10); } on receive p.n() { to idle; }
      state middle { on entry { publish o.out(20); } on exit { publish o.out(-20); }
        state first { on entry { publish o.out(30); } on exit { publish o.out(-30); } on receive p.q() { exit; } }
        state deep { on entry { publish o.out(40); } on exit { publish o.out(-40); } on receive p.q() { exit; } } } } }`,
    'publish p.m(1); wait 1ms; publish p.n(); wait 1ms; publish p.m(0); wait 1ms; publish p.q(); wait 1ms; publish p.q();'));
await probe('P2. exit; of the last substate leaves the parent; the flow goes on after it',
  pkg(mn, `operation run() { state par { on exit { publish o.out(-1); } state a { on receive p.m(v) { exit; } } state b { on exit { publish o.out(-2); } on receive p.m(v) { publish o.out(v); exit; } } } state after1 { on entry { publish o.out(99); } } }`,
    'publish p.m(1); wait 1ms; publish p.m(2);'));
await probe('P3. a parent\'s timer counts from the parent\'s arrival and keeps running while its substates change',
  pkg(mn, `operation run() { state par { after 10ms { publish o.out(0); exit; } state a { on receive p.m(v) { exit; } } state b { on receive p.m(v) { to a; } } } state done { on entry { publish o.out(99); } } }`,
    'wait 3ms; publish p.m(1); wait 3ms; publish p.m(2); wait 3ms; publish p.m(3);'));
await probe('P4. unmentioned input across levels: n is named only on the parent, q nowhere in b; m only in a',
  pkg(mn, `attribute ns: int = 0; operation run() { state par { on receive p.n() { ns = ns + 1; } state a { on receive p.m(v) { exit; } } state b { on receive p.q() { exit; } } } }`,
    'publish p.n(); wait 1ms; publish p.m(1); wait 1ms; publish p.m(2); publish p.n(); wait 1ms; publish p.q();'));
await probe('P5 (B6). a substate with nothing to look at waits when its parent has a line',
  pkg(mn, `operation run() { state powered { on receive p.n() exit; state standby { on entry { publish o.out(1); } } } state off { on entry { publish o.out(0); } } }`,
    'wait 5ms; publish p.n();'));
await probe('P6. a parent and substates with nothing to look at at any level: named steps, the parent passes through',
  pkg(mn, `operation run() { state par { on entry { publish o.out(1); } on exit { publish o.out(-1); } state a { on entry { publish o.out(2); } } state b { on entry { publish o.out(3); } } } state w { on receive p.n() exit; } }`,
    'wait 5ms; publish p.n();'));
await probe('P7. to P where P is a parent enters its first inner state; to an ancestor from inside re-enters it',
  pkg(mn, `operation run() { state par { on entry { publish o.out(1); } on receive p.n() { to par; } state a { on receive p.m(v) { exit; } } state b { on entry { publish o.out(2); } on receive p.q() { exit; } } } }`,
    'publish p.m(1); wait 1ms; publish p.n(); wait 1ms; publish p.m(1); wait 1ms; publish p.q();'));
await probe('P8. parent line first on the same member; a leaving parent line stops the substate line',
  pkg(mn, `attribute log: int = 0; operation run() { state par { on receive p.m(v) { log = log * 10 + 1; if (v == 2) { exit; } } state a { on receive p.m(v) { log = log * 10 + 2; } } } state done { on entry { publish o.out(log); } } }`,
    'publish p.m(1); wait 1ms; publish p.m(2);'));

console.log('\n# Review r3 counterexamples');
await probe('B2-1 (waiting adaptation). a parent query line ready at every look does not stop the substate\'s lines: pinch events and per-look statements still run',
  pkg('requires event query(); requires event pinch(); requires event go();', `attribute travel: int = 0; attribute answers: int = 0; attribute reversals: int = 0; operation run() {
    state moving { on receive p.query() { answers = answers + 1; }
      state closing { on receive p.pinch() { reversals = reversals + 1; to reversing; } travel = travel + 1; }
      state reversing { after 5ms { to closing; } } } }`,
    'publish p.query(); publish p.query(); publish p.pinch(); publish p.query(); wait 1ms; publish p.query(); publish p.query(); wait 10ms; publish p.query(); publish p.pinch();'));
await probe('B2-2. a suspending parent reaction (a 30 ms request per query, queries every 10 ms) does not hold the 250 ms pulse timer: the pulse ends at the first look after 250 ms',
  `package P {
  enum LockDrive { idle, lockPulse }
  port def Status { requires event query(); provides event report(locked: bool, pulses: uint); }
  port def Nvm { provides operation readStatus() returns bool; }
  port def Motor { provides attribute lockMotor: LockDrive; }
  component def C {
    port status: Status; reversed port nvm: Nvm; port motor: Motor;
    attribute pulses: uint = 0; attribute answered: uint = 0;
    operation run() {
      state powered {
        on receive status.query() { var s: bool = nvm.readStatus(); answered = answered + 1; publish status.report(s, pulses); }
        state locking {
          on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.lockPulse); }
          on exit { send motor.lockMotor(LockDrive.idle); }
          after 250ms { exit; }
        }
        state isLocked { on entry { pulses = pulses + 100; } on receive status.query() { } }
      }
    }
    schedule { on start run(); }
  }
  component def Store { port nvm: Nvm; operation readStatus() returns bool { wait 30ms; return true; } schedule { on call nvm.readStatus() readStatus(); } }
  component def S { reversed port status: Status; reversed port motor: Motor; operation sink() { } operation emit() { for (var i: uint = 0; i < 40; i = i + 1) { publish status.query(); wait 10ms; } } schedule { on start emit(); on receive status.report(a, b) sink(); on receive motor.lockMotor(m) sink(); } }
  component c: C;
  component store: Store;
  component s: S;
  connect (s.status, c.status);
  connect (c.nvm, store.nvm);
  connect (c.motor, s.motor);
}`, { untilNs: 5e8 }, e => String(e.subject).startsWith('c.') && (e.kind !== 'write' || /pulses/.test(String(e.subject))));
await probe('B2-3. shielding: the parent guards its own line with a variable the substate maintains; the substate remembers the request',
  pkg('requires event ignitionOff(); requires event done();', `attribute offPending: bool = false; operation run() {
    var flashing: bool = false;
    state powered { on receive p.ignitionOff() { if (not flashing) { exit; } }
      state normal { on receive p.done() { exit; } }
      state flash { on entry { flashing = true; } on exit { flashing = false; } on receive p.ignitionOff() { offPending = true; } on receive p.done() { exit; } }
      state rest { if (offPending) { exit; } } }
    state off { on entry { publish o.out(0); } } }`,
    'publish p.done(); wait 1ms; publish p.ignitionOff(); wait 1ms; publish p.done(); wait 1ms; publish p.ignitionOff();'));
await probe('B4. one leave order: exit; from the last substate and to N; (N after the parent) give the same order',
  pkg(mn, `operation run() { state par { on exit { publish o.out(-1); } state a { on exit { publish o.out(-2); } after 1ms { publish o.out(5); exit; } } } state n1 { on entry { publish o.out(7); } on receive p.q() { exit; } }
    state par2 { on exit { publish o.out(-1); } state a2 { on exit { publish o.out(-2); } after 1ms { publish o.out(5); to n2; } } } state n2 { on entry { publish o.out(7); } } }`,
    'wait 5ms; publish p.q();'));
await probe('B5. parent lines are not looked at while a substate\'s on entry is suspended: a fault during calibrate() is taken after the entry drove the motor',
  `package P {
  port def In { requires event sensorFault(); }
  port def Cal { provides operation calibrate() returns bool; }
  port def Out { provides event out(v: int); }
  component def C {
    port p: In; reversed port cal: Cal; port o: Out;
    operation run() {
      state idle0 { after 1ms { exit; } }
      state moving {
        on receive p.sensorFault() { to idle; }
        state settling { on entry { var ok: bool = cal.calibrate(); publish o.out(1); } after 1s { exit; } }
      }
      state idle { on entry { publish o.out(0); } }
    }
    schedule { on start run(); }
  }
  component def Cl { port cal: Cal; operation calibrate() returns bool { wait 20ms; return true; } schedule { on call cal.calibrate() calibrate(); } }
  component def S { reversed port p: In; operation emit() { wait 5ms; publish p.sensorFault(); } schedule { on start emit(); } }
  component def K { reversed port o: Out; operation sink() { } schedule { on receive o.out(v) sink(); } }
  component c: C; component cl: Cl; component s: S; component k: K;
  connect (s.p, c.p); connect (c.cal, cl.cal); connect (c.o, k.o);
}`);
await probe('B6. a named-step substate inside a parent with a line waits (review draft of the mode manager)',
  pkg('requires event ignitionOn(); requires event ignitionOff();', `operation run() { while (true) {
    state off { on entry { publish o.out(0); } on receive p.ignitionOn() exit; }
    state powered { on receive p.ignitionOff() exit; state standby { on entry { publish o.out(1); } } } } }`,
    'publish p.ignitionOn(); wait 5ms; publish p.ignitionOff(); wait 5ms; publish p.ignitionOn();'), { untilNs: 2e7 });
