// PROTOTYPE P4 item 5: WP5 examples 44, 46, 47 rewritten by hand in revision 4 (p6/make-wp5.py); their cases against the
// originals. node p6/wp5.mjs
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse, MODELS, show } from './lib.mjs';
const base = pathToFileURL((process.env.P4_OUT ?? 'E:/t/sw-p6/out') + '/').href;
const { eachTest } = await import(base + 'src/simulation/simulator.js');
const { caseOptions } = await import(pathToFileURL('E:/t/sw-p6/scripts/simulation-cases.mjs').href);
const cases = JSON.parse(readFileSync('E:/t/sw-p6/examples/simulation/cases.json', 'utf8'));
const helpers = ['heldTick', 'hasTick', 'heldLevel', 'hasLevel'];
for (const [orig, rew, subjects, writes] of [
  ['44-session-completion.swaml', 'wp5-44-session-completion.rev4.swaml', ['session.'], ['sessionId', 'attempts', 'backoffs', 'coverageLosses']],
  ['46-breaker-internal.swaml', 'wp5-46-breaker-internal.rev4.swaml', ['internal.'], ['consecutiveFailures', 'trips', 'shedArrivals', 'halfOpenAtNs', 'written']],
  ['47-reaction-forms.swaml', 'wp5-47-reaction-forms.rev4.swaml', ['counter.'], ['total', 'polls', 'defer']]]) {
  const key = 'examples/' + orig, options = caseOptions(cases, key);
  const run = async (text, label) => {
    const p = await parse(text, `file:///${label}`);
    if (p.errors.length || p.parserErrors.length) throw new Error(label + ': ' + [...p.parserErrors.map(e => e.message), ...p.errors.map(e => `${e.range.start.line + 1}: ${e.message}`)].join('; '));
    return [...eachTest([p.model], options)];
  };
  const A = await run(readFileSync('E:/t/sw-p6/' + key, 'utf8'), orig), B = await run(readFileSync(`${MODELS}/${rew}`, 'utf8'), rew);
  console.log(`\n# ${orig} (WP5, 2.3 candidate) against ${rew} (revision 4, hand-written)`);
  for (const [i, x] of A.entries()) {
    const y = B[i];
    const st = r => JSON.stringify(Object.fromEntries(Object.entries(r.run?.stores ?? {}).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([n]) => !helpers.includes(n)))])));
    console.log(`## ${x.case}: original ${x.result}${x.message ? ' (' + x.message + ')' : ''}, revision 4 ${y.result}${y.message ? ' (' + y.message + ')' : ''}; final stores ${st(x) === st(y) ? 'identical' : 'DIFFER'}`);
    if (st(x) !== st(y)) { console.log('  A ' + st(x)); console.log('  B ' + st(y)); }
    const k = { kinds: ['state', 'write', 'discardInput', 'defer', 'assert'], subjects: [...subjects, x.case.split('::')[0] + '::', 'network.', 'stream.', 'feed.'], writes, quiet: true };
    console.log('  original:'); for (const l of show(x.run, k)) console.log('    ' + l);
    console.log('  revision 4:'); for (const l of show(y.run, k)) console.log('    ' + l);
  }
}
