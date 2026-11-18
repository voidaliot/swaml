// PROTOTYPE P1: the six reading samples of STATES_IN_FLOW_READING_SAMPLES.md in the owner's stage 1 spelling (stay / exit / to S),
// each run with driver scripts for its five questions. Prints the controller's observable behaviour per scenario.
// node p1/samples.mjs [outDir] [sample number]
import { pathToFileURL } from 'node:url';
const outDir = process.argv[2] ?? 'E:/t/sw-p1/out', only = process.argv[3];
const base = pathToFileURL(outDir + '/').href;
const { EmptyFileSystem } = await import('langium');
const { parseHelper } = await import('langium/test');
const { createSwamlServices } = await import(base + 'src/language/swaml-module.js');
const { simulate } = await import(base + 'src/simulation/simulator.js');

/** ports: { name: [member declarations from the controller's side] }; the driver gets reversed ports and sinks for outputs. */
function model({ pkg, types = '', ports, attributes = '', ops = '', control, entry, emitAll }, script) {
  // Owner decision (no keep/ignore, unhandled input dropped by default): P1_STRIP=1 removes the disposition lines.
  if (process.env.P1_STRIP) control = control.replace(/\n\s*(keep|ignore) [^;]*;/g, '');
  const defs = Object.entries(ports).map(([p, ms]) => `  port def P_${p} { ${ms.map(m => m + ';').join(' ')} }`).join('\n');
  const cports = Object.keys(ports).map(p => `port ${p}: P_${p};`).join(' ');
  const dports = Object.keys(ports).map(p => `reversed port ${p}: P_${p};`).join(' ');
  const sinks = Object.entries(ports).flatMap(([p, ms]) => ms.filter(m => m.startsWith('provides')).map(m => {
    const name = /(?:event|attribute) ('[^']+'|\w+)/.exec(m)[1], params = /\(([^)]*)\)/.exec(m)?.[1] ?? '';
    const n = /attribute/.test(m) ? 1 : params.split(',').filter(x => x.trim()).length;
    return `on receive ${p}.${name}(${Array.from({ length: n }, (_, i) => 'b' + i).join(', ')}) sink();`;
  }));
  const connects = Object.keys(ports).map(p => `  connect (c.${p}, d.${p});`).join('\n');
  return `package ${pkg} {
${types}
${defs}
  component def Controller {
    ${cports}
    ${attributes}
    ${ops}
    operation ${control}
    schedule { on start ${entry}(); }
  }
  component def Driver {
    ${dports}
    operation sink() { }
    operation emitAll() { ${emitAll} }
    operation script() { ${script} }
    schedule { on start script(); ${sinks.join(' ')} }
  }
  component c: Controller;
  component d: Driver;
${connects}
}`;
}
const fmt = ns => ns >= 1e9 && ns % 1e6 === 0 ? `${ns / 1e9}s` : `${ns / 1e6}ms`;
async function run(sample, name, script, untilNs) {
  const text = model(sample, script);
  const { Swaml } = createSwamlServices(EmptyFileSystem);
  const d = await parseHelper(Swaml)(text, { documentUri: `file:///${sample.pkg}-${Math.random().toString(36).slice(2)}.swaml`, validation: true });
  const errors = (d.diagnostics ?? []).filter(x => x.severity === 1);
  if (errors.length) { console.log(`  ${name}: INVALID\n` + errors.map(e => `    ${e.range.start.line + 1}: ${e.message}`).join('\n') + '\n' + text.split('\n').map((l, i) => `${i + 1} ${l}`).join('\n')); return; }
  const r = simulate([d.parseResult.value], sample.pkg, { untilNs, maxSteps: 2000000 });
  const lines = [];
  for (const e of r.trace) {
    const at = fmt(e.timeNs);
    if (e.kind === 'state' && String(e.subject).startsWith('c.')) lines.push(`${at} ${e.stay ? 'stay' : 'state'} ${e.state}`);
    else if ((e.kind === 'publish' || e.kind === 'send') && String(e.subject).startsWith('c.')) lines.push(`${at} ${e.kind} ${String(e.subject).slice(2)}(${(e.args ?? []).map(x => JSON.stringify(x)).join(', ')})`);
    else if ((e.kind === 'publish') && String(e.subject).startsWith('d.')) lines.push(`${at} >> ${String(e.subject).slice(2)}(${(e.args ?? []).map(x => JSON.stringify(x)).join(', ')})`);
    else if (e.kind === 'discardInput') lines.push(`${at} discard ${e.subject} (${e.reason})`);
    else if (e.kind === 'keep') lines.push(`${at} keep ${e.member}`);
    else if (e.kind === 'complete' && String(e.subject) === `c.${sample.entry}`) lines.push(`${at} ${sample.entry} completes`);
    else if (e.kind === 'write' && String(e.subject).startsWith('c.') && sample.watch?.includes(String(e.subject).slice(2))) lines.push(`${at} ${String(e.subject).slice(2)} = ${JSON.stringify(e.value)}`);
    else if (e.kind === 'failure' || e.kind === 'violation') lines.push(`${at} ${e.kind} ${e.subject} ${e.reason ?? e.code}`);
  }
  console.log(`  ${name} [${r.status}, ${fmt(r.timeNs)}]: stores ${JSON.stringify(r.stores['c'])}`);
  for (const l of lines) console.log('      ' + l);
}

const samples = {
  1: { s: { pkg: 'LockSample', types: '  enum LockDrive { idle, lockPulse, unlockPulse }', watch: ['locked'],
    ports: { requests: ['requires event request(lock: bool)'], status: ['requires event query()', 'provides event report(locked: bool, pulses: uint)'], power: ['requires event off()'], motor: ['provides attribute lockMotor: LockDrive'] },
    attributes: 'attribute locked: bool = false; attribute pulses: uint = 0; attribute shutdowns: uint = 0;',
    ops: 'operation reportShutdown() { shutdowns = shutdowns + 1; }', entry: 'control', emitAll: 'publish requests.request(false); publish status.query(); publish power.off();',
    control: `control() {
      keep requests.request, status.query, power.off;
      state unlocked {
        on receive status.query() stay { publish status.report(locked, pulses); }
        on receive requests.request(lock) when (lock) exit;
        on receive power.off() to report;
      }
      state locking {
        on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.lockPulse); }
        on exit { send motor.lockMotor(LockDrive.idle); }
        after 250ms exit;
      }
      locked = true;
      state isLocked {
        on receive status.query() stay { publish status.report(locked, pulses); }
        on receive requests.request(lock) when (not lock) exit;
        on receive power.off() to report;
      }
      state unlocking {
        on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.unlockPulse); }
        on exit { send motor.lockMotor(LockDrive.idle); }
        after 250ms exit;
      }
      locked = false;
      to unlocked;
      state report {
        on entry { reportShutdown(); }
      }
    }` },
    q: [['Q1 lock 0, lock 100', 'publish requests.request(true); wait 100ms; publish requests.request(true);', 1e9],
      ['Q2 lock 0, unlock 100', 'publish requests.request(true); wait 100ms; publish requests.request(false);', 1e9],
      ['Q3 lock 0, query 100', 'publish requests.request(true); wait 100ms; publish status.query();', 1e9],
      ['Q4 lock 0, unlock 100, off 300', 'publish requests.request(true); wait 100ms; publish requests.request(false); wait 200ms; publish power.off();', 1e9],
      ['Q5 off, then lock', 'publish power.off(); wait 10ms; publish requests.request(true); publish status.query();', 1e9]] },
  2: { s: { pkg: 'TrafficSample', types: '  enum Light { red, yellow, green }', entry: 'cycle', emitAll: 'publish ped.button();',
    ports: { ped: ['requires event button()'], lamps: ['provides attribute set: Light'], walkSign: ['provides attribute set: bool'] },
    control: `cycle() {
      ignore ped.button;
      var requested: bool = false;
      while (true) {
        state green {
          on entry { send lamps.set(Light.green); }
          on receive ped.button() stay { requested = true; }
          after 10s when (requested) exit;
          after 60s exit;
        }
        state yellow {
          on entry { send lamps.set(Light.yellow); }
          after 3s exit;
        }
        state red {
          on entry { send lamps.set(Light.red); }
          after 2s exit;
        }
        if (requested) {
          state walk {
            on entry { send walkSign.set(true); }
            on exit { send walkSign.set(false); }
            after 15s exit;
          }
          requested = false;
        }
      }
    }` },
    q: [['Q1 press at 3s', 'wait 3s; publish ped.button();', 40e9],
      ['Q2 press at 20s', 'wait 20s; publish ped.button();', 50e9],
      ['Q3 no press', '', 140e9],
      ['Q4 press at 3s, press during walk (20s)', 'wait 3s; publish ped.button(); wait 17s; publish ped.button();', 110e9],
      ['Q5 press during yellow (61s)', 'wait 61s; publish ped.button();', 140e9]] },
  3: { s: { pkg: 'ModeSample', types: '  enum Mode { off, standby, running, diagnostic }', entry: 'modes', emitAll: "publish pwr.'on'(); publish pwr.off(); publish diag.enter(); publish diag.'exit'(); publish cmd.'start'(); publish cmd.stop();",
    ports: { pwr: ["requires event 'on'()", 'requires event off()'], diag: ['requires event enter()', "requires event 'exit'()"], cmd: ["requires event 'start'()", 'requires event stop()'], status: ['provides attribute mode: Mode'], drive: ['provides attribute enable: bool'] },
    control: `modes() {
      ignore pwr.'on', pwr.off, diag.enter, diag.'exit', cmd.'start', cmd.stop;
      state off {
        on entry { send status.mode(Mode.off); }
        on receive pwr.'on'() exit;
      }
      state standby {
        on entry { send status.mode(Mode.standby); }
        on receive pwr.off() to off;
        on receive cmd.'start'() exit;
        on receive diag.enter() to diagnostic;
      }
      state running {
        on entry { send status.mode(Mode.running); send drive.enable(true); }
        on exit { send drive.enable(false); }
        on receive pwr.off() to off;
        on receive cmd.stop() to standby;
        on receive diag.enter() exit;
      }
      state diagnostic {
        on entry { send status.mode(Mode.diagnostic); }
        on receive pwr.off() to off;
        on receive diag.'exit'() to standby;
      }
    }` },
    q: [['Q1 start while off, then on', "publish cmd.'start'(); wait 1ms; publish pwr.'on'();", 1e8],
      ['Q2 running, stop and off at one instant', "publish pwr.'on'(); wait 1ms; publish cmd.'start'(); wait 1ms; publish cmd.stop(); publish pwr.off();", 1e8],
      ['Q3 running, diag.enter, diag.exit', "publish pwr.'on'(); wait 1ms; publish cmd.'start'(); wait 1ms; publish diag.enter(); wait 1ms; publish diag.'exit'();", 1e8],
      ['Q4 standby, diag.exit', "publish pwr.'on'(); wait 1ms; publish diag.'exit'();", 1e8]] },
  4: { s: { pkg: 'LinkSample', entry: 'manage', emitAll: 'publish link.ack(0); publish link.down();',
    ports: { link: ['requires event ack(id: uint)', 'requires event down()', 'provides event hello(attempt: uint)'], status: ['provides event connected(up: bool)'] },
    control: `manage() {
      ignore link.ack, link.down;
      while (true) {
        var attempt: uint = 0;
        var backoffMs: uint = 10;
        var up: bool = false;
        while (attempt < 5 and not up) {
          attempt = attempt + 1;
          publish link.hello(attempt);
          state awaiting {
            on receive link.ack(id) when (id == attempt) exit { up = true; }
            after (backoffMs * 1ms) exit {
              if (backoffMs < 1000) { backoffMs = backoffMs * 2; }
            }
          }
        }
        if (up) {
          state connected {
            on entry { publish status.connected(true); }
            on exit { publish status.connected(false); }
            on receive link.down() exit;
          }
        } else {
          state cooldown {
            after 30s exit;
          }
        }
      }
    }` },
    q: [['Q1 no answer', '', 30.4e9],
      ['Q2 late ack(1) at 12ms', 'wait 12ms; publish link.ack(1);', 1e8],
      ['Q3 ack(2) at exactly 30ms', 'wait 30ms; publish link.ack(2);', 1e8],
      ['Q4 ack(1) at 5ms, down at 20ms', 'wait 5ms; publish link.ack(1); wait 15ms; publish link.down();', 4e7],
      ['Q5 ack during cooldown (1s)', 'wait 1s; publish link.ack(1);', 30.4e9]] },
  5: { s: { pkg: 'DebounceSample', entry: 'debounce', emitAll: 'publish sw.level(false);',
    ports: { sw: ['requires event level(v: bool)'], out: ['provides event pressed()', 'provides event released()'] },
    control: `debounce() {
      while (true) {
        state low {
          on receive sw.level(v) when (v) exit;
        }
        state risingCheck {
          on receive sw.level(v) when (not v) to low;
          after 20ms exit { publish out.pressed(); }
        }
        state high {
          on receive sw.level(v) when (not v) exit;
        }
        state fallingCheck {
          on receive sw.level(v) when (v) to high;
          after 20ms exit { publish out.released(); }
        }
      }
    }` },
    q: [['Q1 true 0, false 5, true 8', 'publish sw.level(true); wait 5ms; publish sw.level(false); wait 3ms; publish sw.level(true);', 1e8],
      ['Q2 true 0, true 10', 'publish sw.level(true); wait 10ms; publish sw.level(true);', 1e8],
      ['Q3 true 0, false at exactly 20', 'publish sw.level(true); wait 20ms; publish sw.level(false);', 1e8],
      ['Q4 false while low', 'publish sw.level(false);', 1e8],
      ['Q5 pressed, then false 100, true 105, false 110', 'publish sw.level(true); wait 100ms; publish sw.level(false); wait 5ms; publish sw.level(true); wait 5ms; publish sw.level(false);', 3e8]] },
  6: { s: { pkg: 'PictureSample', types: '  enum Lamp { waiting, go, retry }', entry: 'run', emitAll: 'publish cmd.go(false); publish cmd.retry();',
    ports: { cmd: ['requires event go(v: bool)', 'requires event retry()'], lamp: ['provides attribute set: Lamp'] },
    attributes: 'attribute processed: uint = 0; attribute reports: uint = 0;',
    ops: 'operation process() { processed = processed + 1; } operation report() { reports = reports + 1; }', watch: ['processed', 'reports'],
    control: `run() {
      ignore cmd.go, cmd.retry;
      var ok: bool = false;
      state state0 {
        on entry { send lamp.set(Lamp.waiting); }
        on receive cmd.go(v) exit { ok = v; }
      }
      if (ok) {
        state state2 {
          on entry { send lamp.set(Lamp.go); }
          after 10ms exit;
        }
      } else {
        state state1 {
          on entry { send lamp.set(Lamp.retry); }
          on receive cmd.retry() exit;
        }
      }
      process();
      state state4 {
        on entry { report(); }
      }
    }` },
    q: [['Q1 go(false)', 'publish cmd.go(false);', 1e8],
      ['Q2 retry 5, go(false) 10', 'wait 5ms; publish cmd.retry(); wait 5ms; publish cmd.go(false);', 1e8],
      ['Q3 go(true) 0, go 5', 'publish cmd.go(true); wait 5ms; publish cmd.go(true);', 1e8],
      ['Q4 go(true) 0', 'publish cmd.go(true);', 1e8],
      ['Q5 go(true), later go and retry', 'publish cmd.go(true); wait 50ms; publish cmd.go(true); publish cmd.retry();', 1e8]] },
};
for (const [n, { s, q }] of Object.entries(samples)) {
  if (only && only !== n) continue;
  console.log(`## Sample ${n}: ${s.pkg}`);
  for (const [name, script, until] of q) await run(s, name, script, until);
}
