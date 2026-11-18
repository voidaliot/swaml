// PROTOTYPE P1r migrator (throwaway, never product code): rewrites every 2.2 state machine (initial ... state ... transitions)
// into revision 4 text (proposal section 7): one line per timer, one on receive line per member with an if / else if chain in
// declaration order, exit; / to S; as statements, 2.2 exit actions copied into every leaving block where a leaving transition
// has an effect, finals as named steps, refusal of dead ends, and an identity map per source (new -> old statement identities;
// operation identities repeat across the extended fixtures, so the map is keyed by source).
// Reads with the UNMODIFIED main parser (E:/t/sw-p1/out-base, read-only).
// node p4/migrate.mjs <outDir> ; writes <outDir>/examples/**, <outDir>/ext/<fixture>/<i>.swaml, identity-map.json, report.json
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = 'E:/t/sw-p4';
const out = process.argv[2];
const base = pathToFileURL('E:/t/sw-p1/out-base/').href;
const { EmptyFileSystem, GrammarUtils, AstUtils } = await import('langium');
const { parseHelper } = await import('langium/test');
const { createSwamlServices } = await import(base + 'src/language/swaml-module.js');
const sem = await import(base + 'src/language/semantic.js');

const report = { files: [], machines: [], totals: {} }, reverse = {}, forward = {};
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
const isInternal = t => t.target === undefined && kind(t) !== 'completion';
const cstText = n => n.$cstNode.text;
const word = (name) => new RegExp(`(?<![\\w'.])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w'])`, 'g');

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const res = [];
  arr.forEach((x, i) => { for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) res.push([x, ...p]); });
  return res;
}
/** Step 2: initial first, finals last in source order, others ordered to maximise fall-through (exhaustive up to 9). */
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
  const opId = sem.identity(op);
  const m = { file: src.id, operation: opId, states: b.states.length, finals: b.states.filter(s => s.final).length, transitions: 0, leaves: 0, exits: 0, tos: 0, selfJumps: 0, backJumps: 0, forwardJumps: 0, stays: 0, timerLines: 0, receiveLines: 0, chains: 0, chainBranches: 0, guardedSingles: 0, guardedTimers: 0, elseBranches: 0, removedAfterUnguarded: [], renamedBindings: [], copiedExits: 0, copiedExitStatements: 0, keptExits: 0, deadTimers: [], notes: [], blocked: [] };
  const forms = new Set();
  for (const s of b.states) { if ((s.deferrals ?? []).length) forms.add('defer'); for (const t of s.transitions) { const k = kind(t); if (k === 'completion') forms.add('completion'); else if (isInternal(t)) forms.add('internal'); if (k === 'timer' && t.guard) forms.add('guardedTimer'); if (t.delayValue) forms.add('computedTimer'); } }
  m.forms = [...forms];
  for (const s of b.states) for (const t of s.transitions)
    if (kind(t) === 'completion') m.blocked.push({ state: s.name, text: 'completion transition (WP5): hand rewrite' });
  for (const s of b.states) if (!s.final && !s.transitions.length && !(s.deferrals ?? []).length) m.blocked.push({ state: s.name, deadEnd: true, text: 'non-final state without transitions (waits forever in 2.2; refused, step 9)' });
  for (const s of b.states) if ((s.deferrals ?? []).length) m.blocked.push({ state: s.name, defer: true, text: 'defer (WP5, never ships): hand rewrite with a variable' });
  if (!b.states.some(s => s.name === b.initial)) m.blocked.push({ state: b.initial, text: 'unknown initial state (invalid source)' });
  else if (b.states.find(s => s.name === b.initial).final) m.blocked.push({ state: b.initial, text: 'initial state is final' });
  if (m.blocked.length) return { m };
  const { order, exhaustive } = chooseOrder(b.states, b.initial);
  m.exhaustive = exhaustive;
  const stmts = [];
  order.forEach((s, i) => { stmts.push(s); if (s.final && i < order.length - 1) stmts.push('return'); });
  const nextState = s => order[order.indexOf(s) + 1];
  const nameText = n => GrammarUtils.findNodeForProperty(n.$cstNode, 'name').text;
  const indent = (() => { const t = doc.textDocument.getText(), off = GrammarUtils.findNodeForKeyword(b.$cstNode, 'initial').offset; const ls = t.lastIndexOf('\n', off - 1); return t.slice(ls + 1, off).replace(/\S.*/, ''); })();
  const oldState = s => `${opId}/states/${b.states.indexOf(s)}`;
  const oldT = (s, t) => `${oldState(s)}/transitions/${s.transitions.indexOf(t)}`;
  const map = {};
  const lines = [];
  const emit = (depth, text) => lines.push(indent + '  '.repeat(depth) + text);
  let refused;
  stmts.forEach((item, si) => {
    if (item === 'return') { emit(0, 'return;'); return; }
    const s = item, newId = `${opId}/${si}`;
    map[newId] = oldState(s);
    emit(0, `state ${nameText(s)} {`);
    if (s.documentation) emit(1, s.documentation.$cstNode.text);
    let k = 0;
    const exitAction = s.actions.find(x => x.kind === 'exit');
    const exitStatements = exitAction ? exitAction.body.statements : [];
    const leaving = s.transitions.filter(t => !isInternal(t));
    const copyExit = exitStatements.length > 0 && leaving.some(t => t.effect.statements.length > 0);
    if (copyExit) { m.copiedExits++; } else if (exitStatements.length) m.keptExits++;
    for (const ac of s.actions) {
      if (copyExit && ac === exitAction) continue;
      map[`${newId}/${k}`] = `${oldState(s)}/actions/${s.actions.indexOf(ac)}`;
      emit(1, cstText(ac));
      k++;
    }
    // Lines: timers first, sorted by literal duration (stable), then one on receive line per member in first-declaration order.
    let timers = s.transitions.filter(t => kind(t) === 'timer');
    const computed = timers.some(t => t.delayValue);
    if (computed && timers.length > 1) m.notes.push(`state ${s.name}: computed timer among several timers, declaration order kept (2.2 sorts by evaluated value)`);
    if (!computed) timers = timers.slice().sort((x, y) => durationNs(x.delay) - durationNs(y.delay));
    const live = [];
    for (const t of timers) {
      const dead = t.delay && !t.guard && !isInternal(t) && live.some(u => u.delay && !u.guard && !isInternal(u) && durationNs(u.delay) <= durationNs(t.delay));
      if (dead) { m.deadTimers.push(`${s.name}: ${cstText(t).replace(/\s+/g, ' ')}`); continue; }
      live.push(t);
    }
    const members = [...new Set(s.transitions.filter(t => kind(t) === 'receive').map(t => t.endpoint))];
    /** Writes the statements of one branch: copied exit actions, the effect, the leave; records the identity map. */
    const branch = (depth, t, path, rename = x => x) => {
      let n = 0;
      if (!isInternal(t) && copyExit) for (const [i, st] of exitStatements.entries()) {
        map[`${path}/${n++}`] = `${oldState(s)}/actions/${s.actions.indexOf(exitAction)}/body/${i}`;
        emit(depth, cstText(st)); m.copiedExitStatements++;
      }
      for (const [i, st] of t.effect.statements.entries()) {
        map[`${path}/${n++}`] = `${oldT(s, t)}/effect/${i}`;
        emit(depth, rename(cstText(st)));
      }
      m.transitions++;
      if (isInternal(t)) { m.stays++; return; }
      m.leaves++;
      map[`${path}/${n}`] = oldT(s, t);
      const target = order.find(x => x.name === t.target);
      if (target === nextState(s)) { emit(depth, 'exit;'); m.exits++; }
      else {
        emit(depth, `to ${GrammarUtils.findNodeForProperty(t.$cstNode, 'target').text};`); m.tos++;
        if (target === s) m.selfJumps++;
        else if (order.indexOf(target) < order.indexOf(s)) m.backJumps++;
        else m.forwardJumps++;
      }
    };
    /** A line whose transitions form one chain in declaration order. */
    const line = (head, ts, bindingNames) => {
      const L = `${opId}/${si}/${k++}`;
      map[L] = oldT(s, ts[0]);
      emit(1, `${head} {`);
      const unguarded = ts.findIndex(t => !t.guard);
      if (unguarded >= 0 && unguarded < ts.length - 1) {
        for (const t of ts.slice(unguarded + 1)) m.removedAfterUnguarded.push(`${s.name}: ${cstText(t).replace(/\s+/g, ' ')}`);
        ts = ts.slice(0, unguarded + 1);
      }
      const renames = ts.map(t => {
        const names = t.endpoint ? GrammarUtils.findNodesForProperty(t.$cstNode, 'bindings').map(x => x.text) : [];
        const pairs = names.map((x, i) => [x, bindingNames[i]]).filter(([x, y]) => y !== undefined && x !== y);
        if (!pairs.length) return x => x;
        const text = [t.guard ? cstText(t.guard) : '', ...t.effect.statements.map(cstText)].join('\n');
        for (const [, y] of pairs) if (word(y).test(text) && !names.includes(y)) refused = `binding ${y} would be captured in ${s.name}`;
        m.renamedBindings.push(`${s.name}: ${pairs.map(([x, y]) => `${x}->${y}`).join(', ')}`);
        return str => pairs.reduce((acc, [x, y]) => acc.replace(word(x), y), str);
      });
      // Copied exit actions must not be captured by the line's bindings.
      if (copyExit && bindingNames.some(x => exitStatements.some(st => word(x).test(cstText(st))))) refused = `binding of ${head} would capture a name in the copied exit actions of ${s.name}`;
      if (ts.length === 1 && !ts[0].guard) {
        branch(2, ts[0], `${L}/effect`, renames[0]);
      } else {
        if (ts.length === 1) { if (ts[0].endpoint) m.guardedSingles++; else m.guardedTimers++; }
        else { m.chains++; m.chainBranches += ts.length; }
        let ifPath = `${L}/effect/0`;
        ts.forEach((t, i) => {
          const depth = 2;
          if (t.guard) {
            map[ifPath] = oldT(s, t);
            emit(depth, `${i === 0 ? '' : '} else '}if (${renames[i](cstText(t.guard))}) {`);
            branch(depth + 1, t, `${ifPath}/then`, renames[i]);
            ifPath = `${ifPath}/otherwise/0`;
          } else {
            m.elseBranches++;
            emit(depth, '} else {');
            branch(depth + 1, t, ifPath.replace(/\/0$/, ''), renames[i]);
          }
        });
        emit(2, '}');
      }
      emit(1, '}');
    };
    for (const t of live) { m.timerLines++; line(`after ${t.delay ? cstText(t.delay) : `(${cstText(t.delayValue)})`}`, [t], []); }
    for (const x of members) {
      const ts = s.transitions.filter(t => t.endpoint === x);
      const first = GrammarUtils.findNodesForProperty(ts[0].$cstNode, 'bindings').map(n => n.text);
      m.receiveLines++;
      line(`on receive ${GrammarUtils.findNodeForProperty(ts[0].$cstNode, 'endpoint').text}(${first.join(', ')})`, ts, first);
    }
    emit(0, '}');
  });
  if (refused) { m.blocked.push({ text: `refused: ${refused}` }); return { m }; }
  const last = order.at(-1);
  if (!last.final && last.transitions.some(t => !isInternal(t) && kind(t) !== 'completion' && order.find(x => x.name === t.target) === undefined)) m.notes.push('end check failed');
  if (!b.states.some(s => s.final) && last.final) m.notes.push('end check failed');
  return { m, map, text: lines.join('\n').slice(indent.length), start: GrammarUtils.findNodeForKeyword(b.$cstNode, 'initial').offset, end: b.states.at(-1).$cstNode.end };
}

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
    if (r.m.blocked.length) { fileRow.blocked.push(...r.m.blocked.map(x => `${r.m.operation} ${x.state ?? ''}: ${x.text}`)); continue; }
    fileRow.migrated++;
    edits.push(r);
  }
  if (!fileRow.machines) continue;
  fileRow.status = !fileRow.blocked.length ? 'migrated' : fileRow.migrated ? 'partially migrated' : 'not migrated';
  report.files.push(fileRow);
  // A file with a machine that cannot be migrated is left unmigrated as a whole (its comparison is then trivially equal).
  if (fileRow.blocked.length) continue;
  for (const e of edits) for (const [nw, old] of Object.entries(e.map)) { (reverse[src.id] ??= {})[nw] = old; ((forward[src.id] ??= {})[old] ??= []).push(nw); }
  let text = src.text;
  for (const e of edits.sort((x, y) => y.start - x.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  const path = join(out, src.out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
for (const m of report.machines) {
  inc('machines'); inc('states', m.states); inc('finals', m.finals);
  if (m.blocked.length) { inc('machinesNotMigrated'); continue; }
  inc('machinesMigrated'); inc('statesMigrated', m.states);
  for (const k of ['transitions', 'leaves', 'exits', 'tos', 'selfJumps', 'backJumps', 'forwardJumps', 'stays', 'timerLines', 'receiveLines', 'chains', 'chainBranches', 'guardedSingles', 'guardedTimers', 'elseBranches', 'copiedExits', 'copiedExitStatements', 'keptExits']) inc(k, m[k]);
  inc('deadTimers', m.deadTimers.length); inc('removedAfterUnguarded', m.removedAfterUnguarded.length); inc('renamedBindings', m.renamedBindings.length);
  if (!m.exhaustive) inc('greedyOrder');
}
writeFileSync(join(out, 'identity-map.json'), JSON.stringify({ reverse, forward }, null, 1));
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(T);
for (const f of report.files) console.log(`${f.status.padEnd(18)} ${f.file}: ${f.migrated}/${f.machines}${f.blocked.length ? ' blocked: ' + f.blocked.join('; ') : ''}`);
