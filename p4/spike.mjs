// PROTOTYPE P1r: Langium spike of the narrow short form (decision O1). Parses complete and half-typed sources with the
// prototype grammar and prints parser errors, validation errors and the statement identities of leaves with and without braces.
// node p4/spike.mjs
import { parse } from './lib.mjs';
import { pathToFileURL } from 'node:url';
const sem = await import(pathToFileURL((process.env.P4_OUT ?? 'E:/t/sw-p4/out') + '/').href + 'src/language/semantic.js');
const { AstUtils } = await import('langium');
const wrap = body => `package P {
  port def In { requires event m(x: bool); requires event n(); }
  component def C {
    port p: In;
    attribute fault: bool = false;
    attribute y: int = 0;
    operation run() {
${body}
    }
    schedule { on start run(); }
  }
}`;
async function show(title, body) {
  const r = await parse(wrap(body));
  console.log(`## ${title}`);
  console.log(body.split('\n').map(l => '    | ' + l).join('\n'));
  if (r.lexerErrors.length || r.parserErrors.length) {
    for (const e of [...r.lexerErrors, ...r.parserErrors]) console.log(`  parse error line ${(e.token?.startLine ?? e.line ?? 0) - 7}: ${e.message}`);
    return;
  }
  console.log(`  parses; validation errors: ${r.errors.length}${r.errors.map(e => `\n    ${e.range.start.line - 6}: ${e.message}`).join('')}`);
  const leaves = AstUtils.streamAllContents(r.model).filter(n => n.$type === 'Exit' || n.$type === 'Jump').toArray();
  for (const n of leaves) console.log(`  ${n.$type === 'Exit' ? 'exit;' : 'to ' + n.target + ';'} identity ${sem.statementIdentity(n)}, in a ${n.$container.$type}${n.$container.$type === 'Block' ? ` (braced ${n.$container.braced})` : ''}`);
  const lines = AstUtils.streamAllContents(r.model).filter(n => n.$type === 'Transition').toArray();
  for (const l of lines) console.log(`  line ${l.endpoint ?? 'after'}: body ${l.effect.$type} with ${l.effect.statements.length} statement(s)`);
}
await show('1a. braces', `      state s {
        after 250ms { exit; }
        on receive p.m(x) { if (x) { to s; } else { exit; } }
      }`);
await show('1b. the same in the short form: same identities', `      state s {
        after 250ms exit;
        on receive p.m(x) { if (x) to s; else exit; }
      }`);
await show('2. else if chains, short bodies on every branch', `      state s {
        on receive p.m(x) { if (x) exit; else if (fault) to s; else { y = 2; exit; } }
      }`);
await show('3. half-typed: on receive m(x) then a statement on the next line (must be a parse error)', `      state s {
        on receive p.m(x)
        if (fault) { to safe; }
      }
      state safe { on receive p.n() { exit; } }`);
await show('4. half-typed: after 2s then an assignment (must be a parse error)', `      state s {
        after 2s
        y = 1;
      }`);
await show('5. half-typed: on receive m(x) then a bare exit; (absorbed: the one documented case)', `      state s {
        on receive p.m(x)
        exit;
      }`);
await show('6. the general C rule is not accepted: if (c) y = 1;', `      state s {
        on receive p.m(x) { if (x) y = 1; else y = 2; exit; }
      }`);
await show('7. dangling else cannot arise: if (a) if (b) exit; else exit;', `      state s {
        on receive p.m(x) { if (x) if (fault) exit; else exit; }
      }`);
await show('8. short form outside a state (validator error, SIF-S04)', `      if (fault) exit;
      state s { on receive p.n() exit; }`);
await show('9. a statement directly in a state with a short leave', `      state s {
        if (fault) exit;
        on receive p.m(x) { fault = x; }
      }`);
await show('10. computed timer as written in reading sample 4: after (backoffMs * 1ms)', `      var backoffMs: uint = 10;
      state s {
        after (backoffMs * 1ms) { exit; }
      }`);
