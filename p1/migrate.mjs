// PROTOTYPE P1 migrator (throwaway, never product code): rewrites every 2.2 state machine (initial ... state ...
// transitions) and the WP5 forms stage 1 can express into the stage 1 "states in the flow" text of the proposal,
// revision 2, section 7. Reads with the UNMODIFIED main parser (out-base).
// node p1/migrate.mjs <outDir> ; writes <outDir>/examples/**, <outDir>/ext/<fixture>/<i>.swaml, identity-map.json, report.json
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = 'E:/t/sw-p1';
const out = process.argv[2], MODE = process.env.P1_MODE ?? 'ignore';
const base = pathToFileURL(join(root, 'out-base') + '/').href;
const { EmptyFileSystem, GrammarUtils, AstUtils } = await import('langium');
const { parseHelper } = await import('langium/test');
const { createSwamlServices } = await import(base + 'src/language/swaml-module.js');
const sem = await import(base + 'src/language/semantic.js');

const report = { files: [], machines: [], totals: {} }, identityMap = {};
const T = report.totals;
const inc = (k, n = 1) => { T[k] = (T[k] ?? 0) + n; };

function walk(dir) {
  const o = [];
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (e.name === 'invalid') continue;
    if (e.isDirectory()) o.push(...walk(dir + e.name + '/'));
    else if (e.name.endsWith('.swaml')) o.push(dir + e.name);
  }
  return o;
}
const sources = [...walk('examples/'), ...walk('p1/synthetic/')].map(p => ({ id: p, out: p, text: readFileSync(join(root, p), 'utf8') }));
const extDir = 'test/fixtures/compatibility-2-2-extended/';
for (const f of readdirSync(join(root, extDir)).filter(f => f.startsWith('models')).sort())
  JSON.parse(readFileSync(join(root, extDir, f), 'utf8')).models.forEach((m, i) => sources.push({ id: `ext/${f}/${m.name}`, out: `ext/${f}/${i}.swaml`, text: m.text, ext: true }));

const durationNs = d => d.value * { ns: 1, us: 1e3, ms: 1e6, s: 1e9 }[d.unit];
const kind = t => t.endpoint ? 'receive' : (t.delay || t.delayValue) ? 'timer' : 'completion';
const isInternal = t => !t.target && kind(t) !== 'completion';
const cstText = n => n.$cstNode.text;
const emptyBlock = b => !b || /^\{\s*\}$/.test(cstText(b));

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const res = [];
  arr.forEach((x, i) => { for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) res.push([x, ...p]); });
  return res;
}

/** A5: initial first, finals last in source order, others ordered to maximise fall-through. */
function chooseOrder(states, initial) {
  const finals = states.filter(s => s.final), others = states.filter(s => !s.final && s.name !== initial), init = states.find(s => s.name === initial);
  const targets = s => new Set(s.transitions.filter(t => t.target !== undefined).map(t => t.target));
  const score = order => { const full = [...order, ...finals]; let n = 0; for (let i = 0; i < full.length - 1; i++) if (!full[i].final && targets(full[i]).has(full[i + 1].name)) n++; return n; };
  const srcIndex = s => states.indexOf(s);
  const displacement = order => order.reduce((a, s, i) => a + Math.abs(i - srcIndex(s)), 0);
  let best;
  if (others.length + 1 <= 9) {
    for (const p of permutations(others)) {
      const order = [init, ...p], sc = score(order), d = displacement(order);
      if (!best || sc > best.sc || sc === best.sc && d < best.d) best = { order, sc, d };
    }
    return { order: [...best.order, ...finals], exhaustive: true };
  }
  const placed = [init], rest = new Set(others);
  while (rest.size) {
    const last = placed.at(-1), next = last.transitions.filter(t => t.target !== undefined).map(t => others.find(s => s.name === t.target)).find(s => s && rest.has(s));
    const pick = next ?? others.find(s => rest.has(s));
    placed.push(pick); rest.delete(pick);
  }
  return { order: [...placed, ...finals], exhaustive: false };
}

function migrateMachine(src, doc, op, b) {
  const opId = sem.identity(op), m = { file: src.id, operation: opId, states: b.states.length, finals: b.states.filter(s => s.final).length, transitions: 0, fallThrough: 0, until: 0, jumps: 0, selfJumps: 0, backJumps: 0, longestBackJump: 0, stays: 0, deadTimers: [], stateOverrides: 0, operationLines: 0, notes: [], blocked: [] };
  const forms = new Set();
  for (const s of b.states) { if ((s.deferrals ?? []).length) forms.add('defer'); for (const t of s.transitions) { const k = kind(t); if (k === 'completion') forms.add('completion'); else if (isInternal(t)) forms.add('internal'); if (k === 'timer' && t.guard) forms.add('guardedTimer'); if (t.delayValue) forms.add('computedTimer'); } }
  m.forms = [...forms];
  for (const s of b.states) for (const t of s.transitions)
    if (kind(t) === 'completion') m.blocked.push({ state: s.name, guard: t.guard ? cstText(t.guard) : '', target: t.target, effect: t.effect ? cstText(t.effect) : '', text: cstText(t).replace(/\s+/g, ' ') });
  // A non-final state with no transition waits forever in 2.2; stage 1 would read it as a named step that falls through.
  for (const s of b.states) if (!s.final && !s.transitions.length && !(s.deferrals ?? []).length) m.blocked.push({ state: s.name, deadEnd: true, text: 'non-final state without transitions (waits forever in 2.2)' });
  // Owner decision: no keep/defer feature; a deferring machine needs a hand rewrite (stored-request pattern).
  if (MODE === 'none') for (const s of b.states) if ((s.deferrals ?? []).length) m.blocked.push({ state: s.name, defer: true, text: `defer ${(s.deferrals ?? []).flatMap(d => d.endpoints).join(', ')} (no keep in stage 1: rewrite with a stored request)` });
  if (!b.states.some(s => s.name === b.initial)) m.blocked.push({ state: b.initial, text: 'unknown initial state (invalid source)' });
  else if (b.states.find(s => s.name === b.initial).final) m.blocked.push({ state: b.initial, text: 'initial state is final' });
  if (m.blocked.length) return { m };
  const { order, exhaustive } = chooseOrder(b.states, b.initial);
  m.exhaustive = exhaustive;
  // Statement list: states in order; return; after every final except the last statement.
  const stmts = [];
  order.forEach((s, i) => { stmts.push(s); if (s.final && i < order.length - 1) stmts.push('return'); });
  const indexOf = s => stmts.indexOf(s);
  const nextState = s => { const i = order.indexOf(s); return order[i + 1]; };
  // Dispositions: operation-level ignore for every member some waiting state does not handle; defer -> keep override.
  const waiting = order.filter(s => !s.final);
  const handles = s => new Set(s.transitions.filter(t => t.endpoint).map(t => t.endpoint));
  const members = [...new Set(b.states.flatMap(s => s.transitions.filter(t => t.endpoint).map(t => t.endpoint)))];
  const ignore = members.filter(x => waiting.some(s => !handles(s).has(x)));
  const nameText = n => GrammarUtils.findNodeForProperty(n.$cstNode, 'name').text;
  const lines = [];
  const indent = (() => { const t = doc.textDocument.getText(), off = GrammarUtils.findNodeForKeyword(b.$cstNode, 'initial').offset; const ls = t.lastIndexOf('\n', off - 1); return t.slice(ls + 1, off).replace(/\S.*/, ''); })();
  const spelled = new Map();
  for (const st of b.states) { for (const t of st.transitions) if (t.endpoint) spelled.set(t.endpoint, GrammarUtils.findNodeForProperty(t.$cstNode, 'endpoint').text);
    for (const d of st.deferrals ?? []) d.endpoints.forEach((e, i) => spelled.set(e, GrammarUtils.findNodesForProperty(d.$cstNode, 'endpoints')[i].text)); }
  const spell = e => spelled.get(e) ?? e;
  // P1_MODE: ignore (revision 2 spelling), empty (owner variant: no keep/ignore; empty reactions drop input, operation-level
  // `otherwise on receive m(x) { }` where no state keeps the member, per state otherwise), keep (nothing written at all).
  const keptIn = x => b.states.some(st => (st.deferrals ?? []).some(d => d.endpoints.includes(x)) && !handles(st).has(x));
  const headOf = x => { const t = b.states.flatMap(st => st.transitions).find(t => t.endpoint === x); const bs = GrammarUtils.findNodesForProperty(t.$cstNode, 'bindings').map(n => n.text); return `on receive ${spell(x)}(${bs.join(', ')})`; };
  m.opReactions = 0; m.stateReactions = 0;
  const perState = MODE === 'empty' ? ignore.filter(keptIn) : [];
  if (MODE === 'ignore' && ignore.length) { lines.push(`ignore ${ignore.map(spell).join(', ')};`); m.operationLines++; }
  if (MODE === 'empty') for (const x of ignore.filter(x => !keptIn(x))) { lines.push(`otherwise ${headOf(x)} { }`); m.opReactions++; }
  const map = {};
  const oldState = s => `${opId}/states/${b.states.indexOf(s)}`;
  for (const item of stmts) {
    if (item === 'return') { lines.push('return;'); continue; }
    const s = item, si = indexOf(s), newId = `${opId}/${si}`;
    map[oldState(s)] = newId;
    s.actions.forEach((ac, k) => { map[`${oldState(s)}/actions/${k}`] = `${newId}/actions/${k}`; });
    const body = [];
    if (s.documentation) body.push(s.documentation.$cstNode.text);
    for (const ac of s.actions) body.push(cstText(ac));
    const keeps = (s.deferrals ?? []).flatMap(d => d.endpoints).filter(x => !handles(s).has(x));
    if (keeps.length && MODE === 'ignore') { body.push(`keep ${keeps.map(spell).join(', ')};`); m.stateOverrides++; }
    // Trigger order: timers first, by literal duration (stable), then receive transitions in declaration order.
    let timers = s.transitions.filter(t => kind(t) === 'timer');
    const computed = timers.some(t => t.delayValue);
    if (computed && timers.length > 1) m.notes.push(`state ${s.name}: computed timer among several timers, declaration order kept (2.2 sorts by evaluated value)`);
    if (!computed) timers = timers.slice().sort((x, y) => durationNs(x.delay) - durationNs(y.delay));
    // Dead timers: an unguarded leaving literal timer after an unguarded leaving literal timer of smaller or equal duration.
    const live = [];
    for (const t of timers) {
      const dead = t.delay && !t.guard && !isInternal(t) && live.some(u => u.delay && !u.guard && !isInternal(u) && durationNs(u.delay) <= durationNs(t.delay));
      if (dead) { m.deadTimers.push(`${s.name}: ${cstText(t).replace(/\s+/g, ' ')}`); continue; }
      live.push(t);
    }
    const receives = s.transitions.filter(t => kind(t) === 'receive');
    const triggers = [...live, ...receives];
    for (const t of triggers) if (t.guard && kind(t) === 'timer') m.notes.push(`state ${s.name}: guarded timer ${cstText(t).replace(/\s+/g, ' ')} (a false guard no longer consumes the timer)`);
    const leaving = triggers.filter(t => !isInternal(t));
    const useUntil = false; // owner decision: no until form; every leaving trigger says exit or to S
    const render = t => {
      m.transitions++;
      const full = cstText(t), start = t.$cstNode.offset;
      const tgt = t.target !== undefined ? GrammarUtils.findNodeForProperty(t.$cstNode, 'target') : undefined;
      let headEnd = tgt ? tgt.offset - start : t.effect.$cstNode.offset - start;
      let head = full.slice(0, headEnd);
      if (tgt) head = head.replace(/\bto\s*$/, '');
      head = head.trimEnd();
      const effect = emptyBlock(t.effect) ? undefined : cstText(t.effect);
      if (isInternal(t)) { m.stays++; return `${head} stay ${effect ?? '{ }'}`; }
      const target = order.find(x => x.name === t.target);
      const fall = target === nextState(s);
      let tail;
      if (fall) { tail = effect ? ` exit ${effect}` : ' exit;'; m.fallThrough++; }
      else {
        tail = ` to ${tgt.text}${effect ? ' ' + effect : ';'}`; m.jumps++;
        if (target === s) m.selfJumps++;
        const dist = indexOf(s) - indexOf(target);
        if (dist >= 0) { m.backJumps++; m.longestBackJump = Math.max(m.longestBackJump, dist); }
      }
      return head + tail;
    };
    let until;
    triggers.forEach((t, j) => {
      const oldT = `${oldState(s)}/transitions/${s.transitions.indexOf(t)}`;
      if (useUntil) { map[oldT] = `${newId}/until`; until = render(t); m.until++; if (!until.includes(' to ')) m.fallThrough--; else m.jumps--; return; }
      map[oldT] = `${newId}/transitions/${j}`;
      body.push(render(t));
    });
    if (!s.final) for (const x of perState) if (!handles(s).has(x) && !keeps.includes(x)) { body.push(`${headOf(x)} { }`); m.stateReactions++; }
    const name = nameText(s);
    const pad = indent + '  ';
    const inner = body.map(x => pad + x.split('\n').join('\n')).join('\n');
    lines.push(`state ${name} {${inner ? '\n' + inner + '\n' + indent : ' '}}${until ? ' until ' + until : ''}`);
  }
  // Check: the end of the operation is reachable iff 2.2 had a final state (step 8).
  const last = order.at(-1);
  if (!last.final && last.transitions.some(t => !isInternal(t) && kind(t) !== 'completion' && order.find(x => x.name === t.target) === undefined)) m.notes.push('end check failed');
  if (!b.states.some(s => s.final) && last.final) m.notes.push('end check failed');
  const text = lines.join('\n' + indent);
  return { m, map, text, start: GrammarUtils.findNodeForKeyword(b.$cstNode, 'initial').offset, end: b.states.at(-1).$cstNode.end };
}

const extOut = {};
for (const src of sources) {
  const { Swaml } = createSwamlServices(EmptyFileSystem);
  const doc = await parseHelper(Swaml)(src.text, { documentUri: `file:///${src.ext ? 'ext' : ''}${Math.random().toString(36).slice(2)}.swaml` });
  if (doc.parseResult.parserErrors.length || doc.parseResult.lexerErrors.length) continue;
  inc('parsedFiles');
  const edits = [], fileRow = { file: src.id, machines: 0, migrated: 0, blocked: [] };
  for (const n of AstUtils.streamAllContents(doc.parseResult.value)) {
    if (n.$type !== 'OperationBody' || !n.states?.length) continue;
    const op = n.$container;
    fileRow.machines++;
    const r = migrateMachine(src, doc, op, n);
    report.machines.push(r.m);
    if (r.m.blocked.length) { fileRow.blocked.push(...r.m.blocked.map(x => `${r.m.operation} ${x.state}: ${x.text}`)); continue; }
    fileRow.migrated++;
    edits.push(r);
  }
  if (!fileRow.machines) continue;
  // A file with a machine that cannot be migrated is left unmigrated as a whole (its comparison is then trivially equal).
  fileRow.status = !fileRow.blocked.length ? 'migrated' : fileRow.migrated ? 'partially migrated' : 'not migrated';
  report.files.push(fileRow);
  if (!fileRow.migrated) continue;
  for (const e of edits) Object.assign(identityMap, e.map);
  let text = src.text;
  for (const e of edits.sort((x, y) => y.start - x.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  const path = join(out, src.out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
for (const m of report.machines) {
  inc('machines'); inc('states', m.states); inc('finals', m.finals);
  if (m.blocked.length) { inc('machinesNotMigrated'); continue; }
  inc('machinesMigrated');
  for (const k of ['transitions', 'fallThrough', 'until', 'jumps', 'selfJumps', 'backJumps', 'stays', 'stateOverrides', 'operationLines']) inc(k, m[k]);
  inc('deadTimers', m.deadTimers.length);
  T.longestBackJump = Math.max(T.longestBackJump ?? 0, m.longestBackJump);
  if (!m.exhaustive) inc('greedyOrder');
}
writeFileSync(join(out, 'identity-map.json'), JSON.stringify(identityMap, null, 1));
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(T);
for (const f of report.files) console.log(`${f.status.padEnd(13)} ${f.file}: ${f.migrated}/${f.machines}${f.blocked.length ? ' blocked: ' + f.blocked.join('; ') : ''}`);
