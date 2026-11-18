// PROTOTYPE P1r/P5: the reading samples of STATES_IN_FLOW_READING_SAMPLES.md (revision 4), texts as written there, each
// run with driver scripts for its five questions. node p4/samples.mjs [sample number]
import { run } from './lib.mjs';
const only = process.argv[2];
const modes = { types: '  enum Mode { off, standby, running, diagnostic }',
  ports: { key: ['requires event ignitionOn()', 'requires event ignitionOff()'], cmd: ['requires event go()', 'requires event halt()'], diag: ['requires event enter()', 'requires event leave()'], ecu: ['requires event shutdown()'], status: ['provides attribute mode: Mode'], drive: ['provides attribute enable: bool'] } };
const samples = {
  1: { s: { pkg: 'LockSample', types: '  enum LockDrive { idle, lockPulse, unlockPulse }', watch: ['locked'],
    ports: { requests: ['requires event request(lock: bool)'], status: ['requires event query()', 'provides event report(locked: bool, pulses: uint)'], power: ['requires event off()'], motor: ['provides attribute lockMotor: LockDrive'] },
    attributes: 'attribute locked: bool = false; attribute pulses: uint = 0; attribute shutdowns: uint = 0;',
    ops: 'operation reportShutdown() { shutdowns = shutdowns + 1; }', entry: 'control',
    control: `control() {
  var wanted: bool = false;
  state powered {
    on receive status.query() { publish status.report(locked, pulses); }
    on receive requests.request(lock) { wanted = lock; }
    on receive power.off() { exit; }
    state unlocked {
      on entry { locked = false; }
      if (wanted) { exit; }
    }
    state locking {
      on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.lockPulse); }
      on exit { send motor.lockMotor(LockDrive.idle); }
      after 250ms { exit; }
    }
    state isLocked {
      on entry { locked = true; }
      if (not wanted) { exit; }
    }
    state unlocking {
      on entry { pulses = pulses + 1; send motor.lockMotor(LockDrive.unlockPulse); }
      on exit { send motor.lockMotor(LockDrive.idle); }
      after 250ms { to unlocked; }
    }
  }
  reportShutdown();
}` },
    q: [['Q1 lock 0, lock 100', 'publish requests.request(true); wait 100ms; publish requests.request(true);', 1e9],
      ['Q2 lock 0, unlock 100', 'publish requests.request(true); wait 100ms; publish requests.request(false);', 1e9],
      ['Q3 lock 0, query 100', 'publish requests.request(true); wait 100ms; publish status.query();', 1e9],
      ['Q4 lock 0, unlock 100, off 300', 'publish requests.request(true); wait 100ms; publish requests.request(false); wait 200ms; publish power.off();', 1e9],
      ['Q5 off, then lock', 'publish power.off(); wait 10ms; publish requests.request(true); publish status.query();', 1e9]] },
  2: { s: { pkg: 'TrafficSample', types: '  enum Light { red, yellow, green }', entry: 'cycle',
    ports: { ped: ['requires event button()'], lamps: ['provides attribute set: Light'], walkSign: ['provides attribute set: bool'] },
    control: `cycle() {
  var requested: bool = false;
  while (true) {
    state green {
      on entry { send lamps.set(Light.green); }
      on receive ped.button() { requested = true; }
      after 60s { exit; }
      state minimum {
        after 10s { exit; }
      }
      state extended {
        if (requested) { exit; }
      }
    }
    state yellow {
      on entry { send lamps.set(Light.yellow); }
      after 3s { exit; }
    }
    state red {
      on entry { send lamps.set(Light.red); }
      after 2s { exit; }
    }
    if (requested) {
      state walk {
        on entry { send walkSign.set(true); }
        on exit { send walkSign.set(false); }
        after 15s { exit; }
      }
      requested = false;
    }
  }
}` },
    q: [['Q1 press at 3s', 'wait 3s; publish ped.button();', 40e9],
      ['Q2 press at 20s', 'wait 20s; publish ped.button();', 50e9],
      ['Q3 no press', '', 140e9],
      ['Q4 press at 3s and during walk (25s)', 'wait 3s; publish ped.button(); wait 22s; publish ped.button();', 100e9],
      ['Q5 no press in green, press during yellow (61s)', 'wait 61s; publish ped.button();', 140e9]] },
  3: { s: { pkg: 'ModesFlat', ...modes, ports: Object.fromEntries(Object.entries(modes.ports).filter(([k]) => k !== 'ecu')), entry: 'modes',
    control: `modes() {
  while (true) {
    state off {
      on entry { send status.mode(Mode.off); }
      on receive key.ignitionOn() { exit; }
    }
    state standby {
      on entry { send status.mode(Mode.standby); }
      on receive key.ignitionOff() { to off; }
      on receive cmd.go() { exit; }
      on receive diag.enter() { to diagnostic; }
    }
    state running {
      on entry { send status.mode(Mode.running); send drive.enable(true); }
      on exit { send drive.enable(false); }
      on receive key.ignitionOff() { to off; }
      on receive cmd.halt() { to standby; }
      on receive diag.enter() { exit; }
    }
    state diagnostic {
      on entry { send status.mode(Mode.diagnostic); }
      on receive key.ignitionOff() { to off; }
      on receive diag.leave() { to standby; }
    }
  }
}` },
    q: [['Q1 go while off, then ignitionOn', 'publish cmd.go(); wait 10ms; publish key.ignitionOn();', 1e9],
      ['Q2 running; halt and ignitionOff at one instant', 'publish key.ignitionOn(); wait 10ms; publish cmd.go(); wait 10ms; publish cmd.halt(); publish key.ignitionOff();', 1e9],
      ['Q3 running; diag.enter, then diag.leave', 'publish key.ignitionOn(); wait 10ms; publish cmd.go(); wait 10ms; publish diag.enter(); wait 10ms; publish diag.leave();', 1e9],
      ['Q4 standby; diag.leave', 'publish key.ignitionOn(); wait 10ms; publish diag.leave();', 1e9],
      ['Q5 ends? (long run with every input)', 'publish key.ignitionOn(); wait 10ms; publish cmd.go(); wait 10ms; publish key.ignitionOff(); wait 10ms; publish key.ignitionOn(); wait 10ms; publish diag.enter(); wait 10ms; publish key.ignitionOff();', 2e9]] },
  4: { s: { pkg: 'ConnSample', entry: 'manage',
    ports: { link: ['provides event hello(n: uint)', 'requires event ack(id: uint)', 'requires event down()'], status: ['provides event connected(up: bool)'] },
    control: `manage() {
  while (true) {
    var attempt: uint = 0;
    var backoffMs: uint = 10;
    var up: bool = false;
    while (attempt < 5 and not up) {
      attempt = attempt + 1;
      publish link.hello(attempt);
      state awaiting {
        on receive link.ack(id) { if (id == attempt) { up = true; exit; } }
        after (backoffMs * 1ms) {
          if (backoffMs < 1000) { backoffMs = backoffMs * 2; }
          exit;
        }
      }
    }
    if (up) {
      state connected {
        on entry { publish status.connected(true); }
        on exit { publish status.connected(false); }
        on receive link.down() { exit; }
      }
    } else {
      state cooldown {
        after 30s { exit; }
      }
    }
  }
}` },
    q: [['Q1 no answer', '', 31e9],
      ['Q2 late ack(1) at 12ms', 'wait 12ms; publish link.ack(1);', 100e6],
      ['Q3 ack(2) at 30ms', 'wait 30ms; publish link.ack(2);', 100e6],
      ['Q4 ack(1) at 5ms, down at 50ms', 'wait 5ms; publish link.ack(1); wait 45ms; publish link.down();', 70e6],
      ['Q5 ack during cooldown (1s)', 'wait 1s; publish link.ack(1);', 2e9]] },
  5: { s: { pkg: 'DebounceSample', entry: 'debounce',
    ports: { sw: ['requires event level(v: bool)'], out: ['provides event pressed()', 'provides event released()'] },
    control: `debounce() {
  while (true) {
    state low {
      on receive sw.level(v) { if (v) exit; }
    }
    state risingCheck {
      on receive sw.level(v) { if (not v) to low; }
      after 20ms { publish out.pressed(); exit; }
    }
    state high {
      on receive sw.level(v) { if (not v) exit; }
    }
    state fallingCheck {
      on receive sw.level(v) { if (v) to high; }
      after 20ms { publish out.released(); exit; }
    }
  }
}` },
    q: [['Q1 true 0, false 5, true 8', 'publish sw.level(true); wait 5ms; publish sw.level(false); wait 3ms; publish sw.level(true);', 100e6],
      ['Q2 true 0, true 10', 'publish sw.level(true); wait 10ms; publish sw.level(true);', 100e6],
      ['Q3 true 0, false 20', 'publish sw.level(true); wait 20ms; publish sw.level(false);', 100e6],
      ['Q4 false in low', 'publish sw.level(false);', 100e6],
      ['Q5 pressed; false 100, true 105, false 110', 'publish sw.level(true); wait 100ms; publish sw.level(false); wait 5ms; publish sw.level(true); wait 5ms; publish sw.level(false);', 300e6]] },
  6: { s: { pkg: 'OwnerSample', types: '  enum Lamp { waiting, go, retry }', entry: 'run', attributes: 'attribute processed: uint = 0; attribute reported: uint = 0;',
    ops: 'operation process() { processed = processed + 1; } operation report() { reported = reported + 1; }',
    ports: { cmd: ['requires event go(v: bool)', 'requires event retry()'], lamp: ['provides attribute set: Lamp'] },
    control: `run() {
  var ok: bool = false;
  state state0 {
    on entry { send lamp.set(Lamp.waiting); }
    on receive cmd.go(v) { ok = v; exit; }
  }
  if (ok) {
    state state2 {
      on entry { send lamp.set(Lamp.go); }
      after 10ms { exit; }
    }
  } else {
    state state1 {
      on entry { send lamp.set(Lamp.retry); }
      on receive cmd.retry() { exit; }
    }
  }
  process();
  state state4 {
    on entry { report(); }
  }
}` },
    q: [['Q1 go(false)', 'publish cmd.go(false);', 100e6],
      ['Q2 retry 5ms, go(false) 10ms', 'wait 5ms; publish cmd.retry(); wait 5ms; publish cmd.go(false);', 100e6],
      ['Q3 go(true) 0, go 5ms', 'publish cmd.go(true); wait 5ms; publish cmd.go(true);', 100e6],
      ['Q4 go(true) 0: when process()', 'publish cmd.go(true);', 100e6],
      ['Q5 after state4: go again', 'publish cmd.go(true); wait 50ms; publish cmd.go(true); publish cmd.retry();', 100e6]] },
  7: { s: { pkg: 'ModesParent', ...modes, entry: 'modes',
    control: `modes() {
  state system {
    on receive ecu.shutdown() { exit; }
    state off {
      on entry { send status.mode(Mode.off); }
      on receive key.ignitionOn() { exit; }
    }
    state powered {
      on receive key.ignitionOff() { to off; }
      state standby {
        on entry { send status.mode(Mode.standby); }
        on receive cmd.go() { exit; }
        on receive diag.enter() { to diagnostic; }
      }
      state running {
        on entry { send status.mode(Mode.running); send drive.enable(true); }
        on exit { send drive.enable(false); }
        on receive cmd.halt() { to standby; }
        on receive diag.enter() { exit; }
      }
      state diagnostic {
        on entry { send status.mode(Mode.diagnostic); }
        on receive diag.leave() { to standby; }
      }
    }
  }
  send status.mode(Mode.off);
}` },
    q: [['Q1 running; ecu.shutdown', 'publish key.ignitionOn(); wait 10ms; publish cmd.go(); wait 10ms; publish ecu.shutdown(); wait 10ms; publish key.ignitionOn();', 1e9],
      ['Q2 diagnostic; ignitionOff', 'publish key.ignitionOn(); wait 10ms; publish diag.enter(); wait 10ms; publish key.ignitionOff();', 1e9],
      ['Q3 standby; cmd.halt', 'publish key.ignitionOn(); wait 10ms; publish cmd.halt();', 1e9],
      ['Q4 running; halt, go, ignitionOff at one instant', 'publish key.ignitionOn(); wait 10ms; publish cmd.go(); wait 10ms; publish cmd.halt(); publish cmd.go(); publish key.ignitionOff();', 1e9],
      ['Q4b running; same three queued while the machine is busy (delivered at one instant before it waits)', 'publish key.ignitionOn(); publish cmd.go(); wait 10ms; publish cmd.halt(); publish cmd.go(); publish key.ignitionOff(); publish ecu.shutdown();', 1e9],
      ['Q5 shutdown from off', 'publish ecu.shutdown();', 1e9]] },
};
for (const [n, { s, q }] of Object.entries(samples)) {
  if (only && only !== n) continue;
  console.log(`# Sample ${n} (${s.pkg})`);
  for (const [name, script, until] of q) await run(s, name, script, until);
}
