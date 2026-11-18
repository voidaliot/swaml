// PROTOTYPE P6: what the Timing projection (projectOperationTiming, consumed by the extension's Timing View) sees for a
// periodic machine. node p6/timing.mjs
import { load, runCase, projectOperationTiming, fmt } from './lib.mjs';
const p = await load('p6-window-10ms.swaml');
const r = runCase([p.model], "Window10ms::Q5 guard false while reversing", { untilNs: 1e9 });
const t = projectOperationTiming(r.run);
const machine = t.intervals.filter(i => i.subject === 'controller.step');
console.log(`# Timing intervals of controller.step (one activation id: ${[...new Set(machine.map(i => i.activation))].join(', ')}); ${machine.length} intervals`);
for (const i of machine.slice(0, 16)) console.log(`  ${i.activation} ${i.phase.padEnd(12)} ${fmt(i.startNs).padStart(8)} .. ${i.endNs === undefined ? 'open' : fmt(i.endNs)}`);
console.log('  ...');
for (const i of machine.slice(-8)) console.log(`  ${i.activation} ${i.phase.padEnd(12)} ${fmt(i.startNs).padStart(8)} .. ${i.endNs === undefined ? 'open' : fmt(i.endNs)}`);
// The current state per release, from the trace: the release observation, then the state observations of that release.
console.log('\n# Current state per release (release/skip observations and the state reached in that release)');
let state = '', rows = [];
for (const e of r.run.trace) {
  if (e.subject !== 'controller.step') continue;
  if (e.kind === 'state' && !e.stay) state = e.state;
  if (e.kind === 'release') rows.push({ t: e.timeNs, kind: `release #${e.release}` });
  if (e.kind === 'skip') rows.push({ t: e.timeNs, kind: 'skip' });
  if (e.kind === 'receiveWait' && rows.length) rows.at(-1).state = state;
}
const marks = new Set([10e6, 20e6, 30e6, 140e6, 150e6, 160e6, 490e6, 500e6, 600e6, 610e6, 620e6]);
for (const x of rows.filter(x => marks.has(x.t))) console.log(`  ${fmt(x.t).padStart(6)} ${x.kind.padEnd(12)} ${x.state ?? '(no look)'}`);
console.log(`\n# Markers: ${t.markers.length} (complete/failure/interrupt/timeout); the machine never completes, so its last interval is open: ${machine.at(-1).endNs === undefined}`);
console.log('# A skipped release (WP7 guard false) has no activation, so it creates no interval: skip observations carry no activation id.');
