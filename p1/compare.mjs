// PROTOTYPE P1 comparison (throwaway). node p1/compare.mjs <base.json> <variant.json> [identity-map.json] [--detail id-substring]
// Compares verdicts, final stores, status, machines, per-kind counts and order-sensitive per-component digests of
// normalised traces. Normalisation (documented differences only): kinds defer->keep and noEnabledTransition->guard;
// internal:true -> stay:true; statement identities through the migrator's identity map; text ranges and uris dropped.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const args = process.argv.slice(2);
const detailAt = args.indexOf('--detail'), detail = detailAt >= 0 ? args[detailAt + 1] : undefined;
const [aFile, bFile, mapFile] = args.filter((x, i) => !x.startsWith('--') && (detailAt < 0 || i !== detailAt + 1));
const A = JSON.parse(readFileSync(aFile, 'utf8')), B = JSON.parse(readFileSync(bFile, 'utf8'));
const map = mapFile ? JSON.parse(readFileSync(mapFile, 'utf8')) : {};
const keys = Object.keys(map).sort((x, y) => y.length - x.length);
const mapId = s => { if (typeof s !== 'string') return s; for (const k of keys) if (s === k || s.startsWith(k + '/')) return map[k] + s.slice(k.length); return s; };
const sha = t => createHash('sha256').update(t).digest('hex').slice(0, 12);
function norm(e, side) {
  const x = { ...e };
  delete x.range; delete x.uri;
  for (const k of ['emitter', 'caller']) if (x[k]) { x[k] = { ...x[k] }; delete x[k].range; delete x[k].uri; }
  if (x.kind === 'defer') x.kind = 'keep';
  if (x.kind === 'discardInput' && x.reason === 'noEnabledTransition') x.reason = 'guard';
  // SIF-T03: 2.2 reported input discarded by a waiting state that does not handle it as inactiveOwner; stage 1 says ignored.
  if (x.kind === 'discardInput' && (x.reason === 'inactiveOwner' || x.reason === 'ignored')) x.reason = 'unhandled';
  if (x.internal) { delete x.internal; x.stay = true; }
  if (side === 'a') x.source = mapId(x.source);
  return JSON.stringify(Object.keys(x).sort().reduce((o, k) => (o[k] = x[k], o), {}));
}
const component = e => String(e.subject ?? '').split('.')[0];
function digests(r, side) {
  const per = {}, kinds = {};
  for (const e of r.trace ?? []) {
    const n = norm(e, side), k = JSON.parse(n).kind;
    kinds[k] = (kinds[k] ?? 0) + 1;
    (per[component(e)] ??= []).push(n);
  }
  return { kinds, per: Object.fromEntries(Object.entries(per).map(([c, l]) => [c, sha(l.join('\n'))])), lists: per };
}
const rows = { missing: [], verdict: [], stores: [], status: [], machines: [], kinds: [], order: [], same: 0 };
for (const id of Object.keys(A)) {
  const x = A[id], y = B[id];
  if (!y) { rows.missing.push(id); continue; }
  if (x.result !== y.result || !!x.threw !== !!y.threw || !!x.invalid !== !!y.invalid) { rows.verdict.push(`${id}: ${x.result ?? x.threw ?? (x.invalid && 'invalid')} -> ${y.result ?? y.threw ?? (y.invalid && 'invalid')} ${y.message ?? ''}`); continue; }
  if (JSON.stringify(x.stores) !== JSON.stringify(y.stores)) {
    const diff = [];
    for (const occ of Object.keys(x.stores ?? {})) for (const k of Object.keys(x.stores[occ])) if (JSON.stringify(x.stores[occ][k]) !== JSON.stringify(y.stores?.[occ]?.[k])) diff.push(`${occ}.${k} ${JSON.stringify(x.stores[occ][k])}->${JSON.stringify(y.stores?.[occ]?.[k])}`);
    rows.stores.push(`${id}: ${diff.slice(0, 6).join(', ')}`);
    continue;
  }
  if (x.status !== y.status) { rows.status.push(`${id}: ${x.status} -> ${y.status}`); continue; }
  const ms = o => JSON.stringify(Object.fromEntries(Object.entries(o.machines ?? {}).map(([k, v]) => [k, v.state])));
  if (ms(x) !== ms(y)) rows.machines.push(`${id}: ${ms(x)} -> ${ms(y)}`);
  const dx = digests(x, 'a'), dy = digests(y, 'b');
  const kd = [...new Set([...Object.keys(dx.kinds), ...Object.keys(dy.kinds)])].filter(k => dx.kinds[k] !== dy.kinds[k]).map(k => `${k} ${dx.kinds[k] ?? 0}->${dy.kinds[k] ?? 0}`);
  const cd = [...new Set([...Object.keys(dx.per), ...Object.keys(dy.per)])].filter(c => dx.per[c] !== dy.per[c]);
  if (kd.length) rows.kinds.push(`${id}: ${kd.join(', ')} [components ${cd.join(', ')}]`);
  else if (cd.length) rows.order.push(`${id}: components ${cd.join(', ')}`);
  else rows.same++;
  if (detail && id.includes(detail)) for (const c of cd) {
    const la = dx.lists[c] ?? [], lb = dy.lists[c] ?? [];
    let i = 0; while (i < la.length && la[i] === lb[i]) i++;
    console.log(`--- ${id} component ${c}: first difference at event ${i}`);
    for (let j = Math.max(0, i - 3); j < Math.min(Math.max(la.length, lb.length), i + 12); j++) { console.log('  A ' + (la[j] ?? '')); console.log('  B ' + (lb[j] ?? '')); }
  }
}
for (const [k, v] of Object.entries(rows)) { if (k === 'same') { console.log(`## identical after normalisation: ${v}`); continue; } console.log(`## ${k}: ${v.length}`); for (const r of v) console.log('  ' + r); }
