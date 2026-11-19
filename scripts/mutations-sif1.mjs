// States-in-flow package 1 mutation check (SIF-G01: release guards written if (g), else if): applies one mutation at a
// time, runs the package's unit tests (one-word-conditions, release-guards, formatter, nesting-limits), then the example cases and the
// extended 2.2 sets, records killed or survived, and restores the file byte for byte.
//
// A mutation of src/language/swaml.langium rebuilds (npm run build) before and after it; every other mutation edits the
// BUILD OUTPUT (out/) in place. Never run it beside other work on the same checkout (other tests, probes, a watch build
// or a second copy of this script), which would see the mutated code. Run it after `npm run build`, and rebuild if it is
// interrupted. It is not part of `npm run check`.
//
// Usage: node scripts/mutations-sif1.mjs [S1,S7,...] [--all]   (default: every mutation, stopping at the first suite
// that kills it; --all runs every suite; prints a Markdown table)
// S1 to S4 are the mutations section 11 of docs/proposals/STATES_IN_FLOW_PROPOSAL.md lists for package 1 (guard parsed
// after deadline; a new identity scheme for else if; the formatter splitting else if; else if bound to the outer if);
// S5 onwards are the author's; O2, O6 and O7 are the adversarial review's (F3, F5), S16 to S18 its findings F1 and F2.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const G = 'src/language/swaml.langium', SEM = 'out/src/language/semantic.js', F = 'out/src/language/formatter.js', V = 'out/src/language/swaml-validator.js', SIM = 'out/src/simulation/simulator.js', SYN = 'out/src/language/swaml-syntax.js', P = 'out/src/language/placement.js', SR = 'out/src/language/stale-read.js';
const ONLY = process.argv.slice(2).find(a => !a.startsWith('--'))?.split(',');
const MUTATIONS = [
    ['S1', 'guard parsed after deadline', G, "('if' '(' guard=Expression ')')? ('deadline' (deadline=Duration | '(' deadlineValue=Expression ')'))?", "('deadline' (deadline=Duration | '(' deadlineValue=Expression ')'))? ('if' '(' guard=Expression ')')?"],
    ['S2a', 'else if gets an identity scheme of its own (segment if, the scheme review F4 replaced)', SEM, 'path.unshift(String(x.$containerIndex));', "path.unshift(a.isElseIf(x.$container) ? 'if' : String(x.$containerIndex));"],
    ['S2b', 'else if gets a new identity scheme (segment elseIf)', SEM, 'path.unshift(String(x.$containerIndex));', "path.unshift(a.isElseIf(x.$container) ? 'elseIf' : String(x.$containerIndex));"],
    ['S3a', 'formatter splits else and if', F, "            p.append(text);\n        }\n        // A unary minus", "            p.append(text);\n            if (text === 'else' && next === 'if')\n                p.flush();\n        }\n        // A unary minus"],
    ['S3b', 'formatter puts a comment between else and if on its own line', F, "return tokens[before]?.text === 'else' && tokens[after]?.text === 'if';", 'return false;'],
    ['S4a', 'else if bound to the outer if: its if takes the outer if\'s identity', SEM, 'path.unshift(String(x.$containerIndex));', "{ if (!a.isElseIf(x.$container)) path.unshift(String(x.$containerIndex)); else { x = x.$container; continue; } }"],
    ['S4b', 'else if bound to the outer if: a final else after an else if is not parsed into the last if', G, "ElseIf: statements+=If;", "ElseIf: statements+=IfThen;\nIfThen returns If: 'if' '(' condition=Expression ')' then=Block;"],
    ['S5', 'when kept as an alias of the guard', G, "('if' '(' guard=Expression ')')? ('deadline'", "(('if' | 'when') '(' guard=Expression ')')? ('deadline'"],
    ['S6', 'malformed 2.2 else no longer predicts the block (new message and recovery)', SYN, 'return base.call(this, choices) ?? block;', 'return base.call(this, choices);'],
    ['S7', 'resolveStatement does not step into an else if', SEM, '/^\\d+$/.test(segment) ? x.statements?.[Number(segment)] : x[segment];', '/^\\d+$/.test(segment) ? (a.isElseIf(x) ? undefined : x.statements?.[Number(segment)]) : x[segment];'],
    ['S8', 'validator: an else if never terminates (missing return)', V, '&& !!s.otherwise && this.terminates(s.then) && this.terminates(s.otherwise)', '&& !!s.otherwise && this.terminates(s.then) && a.isBlock(s.otherwise) && this.terminates(s.otherwise)'],
    ['S9', 'simulator: the else if branch is not run', SIM, 'else if (s.otherwise)\n                    yield* this.block(s.otherwise, f, local);', 'else if (a.isBlock(s.otherwise))\n                    yield* this.block(s.otherwise, f, local);'],
    ['S10', 'stale reads skip an else if', SR, 'const otherwise = this.guarded(c, flow, inner => this.block(s.otherwise, inner));', 'const otherwise = this.guarded(c, flow, inner => this.block(a.isBlock(s.otherwise) ? s.otherwise : undefined, inner));'],
    ['S11', 'T4 suspension site is the outer if', P, '&& !a.isElseIf(s.$container) ', '&& true '],
    ['S12', 'SW2020 message keeps the WP7 spelling', V, '`Release guard if (${', '`Release guard when (${'],
    ['S13', 'SW2020 replacing message keeps the WP7 spelling', V, 'drops the inherited release guard if (${', 'drops the inherited release guard when (${'],
    ['S14', 'old spelling gets the reserved-word hint, not the guard spelling', SYN, "(options.actual.image === 'when' || guardAfterModifier(options.actual))", '(guardAfterModifier(options.actual))'],
    ['S15', 'definite assignment ignores an else if', V, 'stmt.otherwise ? flow(stmt.otherwise, assigned) : assigned', 'stmt.otherwise && a.isBlock(stmt.otherwise) ? flow(stmt.otherwise, assigned) : assigned'],
    ['S16', 'the else alternation in a rule of its own (an extra rule call per nested else, review F1)', G, "('else' (otherwise=Block | otherwise=ShortBody | otherwise=ElseIf))?;", "('else' otherwise=ElseBody)?;\nElseBody: Block | ShortBody | ElseIf;"],
    ['S17', 'a guard after deadline gets the reserved-word hint (review F2)', SYN, "if (depth === 0 && ['deadline', 'concurrent'].includes(", "if (depth === 0 && ['concurrent'].includes("],
    ['S18', 'a guard after concurrent gets the reserved-word hint (review F2)', SYN, "if (depth === 0 && ['deadline', 'concurrent'].includes(", "if (depth === 0 && ['deadline'].includes("],
    ['O2', 'formatter keeps any comment after else on the else line, also before { (review F3)', F, "return tokens[before]?.text === 'else' && tokens[after]?.text === 'if';", "return tokens[before]?.text === 'else';"],
    ['O6', 'stale reads treat an else if as an if without else (early-return guard, review F5)', SR, 'if (a.isIf(s) && !s.otherwise && terminates(s.then))', 'if (a.isIf(s) && (!s.otherwise || a.isElseIf(s.otherwise)) && terminates(s.then))'],
    ['O7', 'malformed else predicts the else if alternative', SYN, 'return base.call(this, choices) ?? block;', 'return base.call(this, choices) ?? (1 - block);']
];
const run = (command, args) => { try { execFileSync(command, args, { cwd: root, stdio: 'pipe', encoding: 'utf8', timeout: 1200000, shell: command === 'npm' }); return true; } catch { return false; } };
const node = args => run(process.execPath, args);
const rows = [];
for (const [id, what, file, from, to] of MUTATIONS.filter(m => !ONLY || ONLY.includes(m[0]))) {
    const path = join(root, file), original = readFileSync(path, 'utf8');
    const count = original.split(from).length - 1;
    if (count !== 1) {
        rows.push([id, what, `anchor found ${count} times`, '']);
        console.error(rows.at(-1).join(' | '));
        continue;
    }
    const grammar = file === G;
    writeFileSync(path, original.replace(from, to));
    try {
        // A grammar mutation that does not build is killed by the build (generation or the TypeScript types).
        const built = !grammar || run('npm', ['run', 'build']);
        // Cheapest first; a later suite runs only when the earlier ones pass (pass --all to run every suite).
        const all = process.argv.includes('--all');
        const unit = built && node(['--test', 'out/test/v2/one-word-conditions.test.js', 'out/test/v2/release-guards.test.js', 'out/test/v2/formatter.test.js', 'out/test/v2/nesting-limits.test.js']);
        const cases = built && (unit || all) ? node(['scripts/check-simulations.mjs']) : true;
        const extended = built && (unit && cases || all) ? node(['scripts/compatibility-2-2-extended.mjs']) : true;
        rows.push([id, what, !built || !unit || !cases || !extended ? 'killed' : 'SURVIVED', [!built && 'build', built && !unit && 'unit tests', !cases && 'example cases', !extended && 'extended 2.2 sets'].filter(Boolean).join(', ')]);
    }
    finally {
        writeFileSync(path, original);
        if (grammar && !run('npm', ['run', 'build']))
            throw new Error('The rebuild after a grammar mutation failed; run npm run build.');
    }
    console.error(rows.at(-1).join(' | '));
}
console.log('| Mutation | Change | Result | Killed by |\n| --- | --- | --- | --- |\n' + rows.map(r => `| ${r.join(' | ')} |`).join('\n'));
