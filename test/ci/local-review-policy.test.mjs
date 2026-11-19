import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { frozenCopies, publishedEditions } from '../../scripts/check-frozen-publications.mjs';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const publication = readFileSync(new URL('../../.github/workflows/release-checks.yml', import.meta.url), 'utf8');
const nodeVersion = readFileSync(new URL('../../.node-version', import.meta.url), 'utf8').trim();
test('source CI confirms reviewed readiness and main only; draft cancels without a runner', () => {
    assert.match(source, /types: \[ready_for_review, converted_to_draft\]/u);
    assert.match(source, /github\.event\.action == 'ready_for_review' && !github\.event\.pull_request\.draft/u);
    assert.match(source, /group: ci-.*github\.event\.pull_request\.number \|\| github\.ref/u);
    assert.match(source, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/u);
    assert.equal(nodeVersion, '26.12.0');
    assert.match(source, /node-version-file: \.node-version/u);
    assert.doesNotMatch(source, /node-version:\s*\d/u);
    assert.doesNotMatch(source, /workflow_dispatch|synchronize|matrix:/u);
});

test('current trace evidence has an edition path while the published 2.1 trace stays frozen', () => {
    const edition = JSON.parse(readFileSync(new URL('../../spec/standard.json', import.meta.url), 'utf8')).version;
    const published = JSON.parse(readFileSync(new URL('../../examples/simulation/hello-trace.json', import.meta.url), 'utf8'));
    const current = JSON.parse(readFileSync(new URL(`../../examples/simulation/${edition}/hello-trace.json`, import.meta.url), 'utf8'));
    assert.equal(published.profile, 'swaml-reference/2.1');
    assert.equal(current.profile, `swaml-reference/${edition}`);
});
// Built at runtime so that this file never spells a checker name itself.
const stem = ['check', 'spec', 'pdf'].join('-') + '-';
test('publication checks are deliberate and run every published 2.x edition in archive mode', () => {
    assert.match(publication, /workflow_dispatch:/u);
    assert.doesNotMatch(publication, /pull_request:|push:/u);
    for (const edition of ['2\\.0', '2\\.1', '2\\.2'])
        assert.match(publication, new RegExp(`python scripts/${stem}${edition}\\.py --archive`, 'u'));
});

// A published edition's checker name must be directly followed, on the same line and
// after an optional closing quote, by --archive. Anything else is a strict run. A checker
// name built from a variable, glob or concatenation cannot be checked and is rejected.
// This is a tripwire against accidental strict runs, not an obfuscation detector: a path
// assembled from parts at run time (as this file does for its own samples) passes any
// line scan, and review is the backstop for deliberate obfuscation.
const strictChecker = new RegExp(stem + String.raw`2\.[0-2](?:\.0)?\.py(?!["']?[ \t]+--archive(?![\w=-]))`, 'u');
const dynamicChecker = new RegExp(stem + String.raw`(?![\w.]*\.py\b)[\w.]*(?:[$%{}*?[\]'"` + '`' + String.raw`+(<]|$)`, 'u');
const violates = line => strictChecker.test(line) || dynamicChecker.test(line);
const repository = fileURLToPath(new URL('../../', import.meta.url));
// Exact files that name the checkers as data, never as a command. Each one is frozen or
// pinned by check-frozen-publications.mjs, so no runnable file is both unscanned and unfrozen.
const dataFiles = new Set([
    // Published source manifests.
    ...['2.0.0', '2.1', '2.2'].map(edition => `output/pdf/SWAML-${edition}-Specification.manifest.json`),
    // Embedded-source inventories of the 2.1 and 2.2 publication builders and checkers.
    'scripts/build-spec-pdf-2.1.py', `scripts/${stem}2.1.py`, `scripts/${stem}2.2.py`, 'scripts/publication_2_2_sources.py',
]);
// Exact lines (SHA-256 of the line without CR) allowed in a scanned file that is not frozen:
// the attachment list of the historical 2.0.0 builder, a named exception of the frozen check.
const dataLines = new Map([
    ['scripts/build-spec-pdf-2.0.py', new Set(['d1bf8e1028f6add81c999d2f638b11c5dbcbd6eac8ba8358f01f25d296c39cd8'])],
]);
const lineDigest = line => createHash('sha256').update(line.replace(/\r$/u, '')).digest('hex');

/** Every tracked text file; Markdown contributes only its fenced code lines. */
function violations(root) {
    const found = [];
    const tracked = execFileSync('git', ['-C', root, 'ls-files', '-z'], {maxBuffer: 1 << 26}).toString('utf8').split('\0').filter(Boolean);
    for (const path of tracked) {
        if (dataFiles.has(path) || !existsSync(join(root, path))) continue;
        const allowed = dataLines.get(path) ?? new Set();
        const raw = readFileSync(join(root, path));
        if (raw.includes(0)) continue;
        let fence = null;
        raw.toString('utf8').split('\n').forEach((line, i) => {
            if (path.endsWith('.md')) {
                const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
                if (marker && (!fence || marker[0] === fence[0])) { fence = fence ? null : marker; return; }
                if (!fence) return;
            }
            if (violates(line) && !allowed.has(lineDigest(line))) found.push(`${path}:${i + 1}`);
        });
    }
    return found;
}

test('no tracked file runs a published edition checker strictly or by a computed name', () => {
    const frozen = new Set([...frozenCopies.values()].flatMap(entry => Object.keys(entry.files)));
    const pinned = new Set([...publishedEditions.keys()].map(edition => `output/pdf/SWAML-${edition}-Specification.manifest.json`));
    for (const path of dataFiles) assert.ok(existsSync(join(repository, path)) && (frozen.has(path) || pinned.has(path)), `${path} is excluded but not frozen`);
    assert.deepEqual(violations(repository), []);
});

test('strict runs in any tracked file are found, including wrappers named like the publication scripts', t => {
    const root = mkdtempSync(join(tmpdir(), 'swaml-policy-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const checker = `scripts/${stem}2.2.py`;
    const files = {
        'Makefile': `pdf:\n\tpython ${checker}\n`,
        'tools/run.sh': `python ${checker} --pdf x.pdf\n`,
        '.husky/pre-push': `python "${checker}" && echo ok\n`,
        'showcase/package.json': JSON.stringify({scripts: {pdf: `python ${checker}`}}),
        [`scripts/${stem}all.sh`]: `for e in 2.0 2.1 2.2; do python scripts/${stem}$e.py --archive; done\n`,
        'scripts/publication_run.py': `subprocess.run(['python', f'scripts/${stem}{edition}.py', '--archive'])\n`,
        'docs/GUIDE.md': `Prose may name ${checker} freely.\n\n\`\`\`sh\npython ${checker}\n\`\`\`\n`,
        'ok.sh': `python ${checker} --archive\n`,
    };
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), {recursive: true});
        writeFileSync(join(root, path), text);
    }
    execFileSync('git', ['-C', root, 'init', '-q']);
    execFileSync('git', ['-C', root, 'add', '-A']);
    assert.deepEqual(violations(root).sort(), ['.husky/pre-push:1', 'Makefile:2', 'docs/GUIDE.md:4', `scripts/${stem}all.sh:1`,
        'scripts/publication_run.py:1', 'showcase/package.json:1', 'tools/run.sh:1']);
});

test('the patterns reject every invocation not directly followed by --archive and every computed name', () => {
    for (const edition of ['2.0', '2.1', '2.2']) {
        const checker = `scripts/${stem}${edition}.py`;
        const strict = [`python ${checker}`, `python ${checker} --pdf output/x.pdf`, `python ${checker} --pdf x.pdf --archive`,
            `python ${checker} && echo ok`, `python ${checker}; echo ok`, `python ${checker} # --archive later`,
            `python "${checker}"`, `python '${checker}'`, `python ${checker} \\`, `python ${checker} --archived`,
            `python ${checker} --archive=no`, `run: python ${checker}\r`, `python ./${checker} 2>&1 | tee log`];
        for (const line of strict) assert.ok(violates(line), line);
        // A line continuation or a following block line never carries --archive to this command.
        for (const block of [`python ${checker} \\\n  --archive`, `python ${checker}\n  --archive`])
            assert.ok(violates(block.split('\n')[0]), block);
        const archive = [`python ${checker} --archive`, `python "${checker}" --archive`, `python '${checker}'\t--archive --pdf x.pdf`,
            `run: python ${checker} --archive\r`, `python ${checker} --archive && echo ok`];
        for (const line of archive) assert.ok(!violates(line), line);
    }
    const computed = [`python scripts/${stem}$e.py --archive`, `python scripts/${stem}\${EDITION}.py --archive`, `python scripts/${stem}*.py --archive`,
        `python scripts/${stem}2.?.py --archive`, `python scripts/${stem}%E%.py --archive`, `python scripts/${stem}2.$minor.py --archive`,
        `run(['python', 'scripts/${stem}' + edition + '.py', '--archive'])`, `f'scripts/${stem}{edition}.py'`, `python scripts/${stem}[012].py`,
        `name = "scripts/${stem}"`, `python scripts/${stem}`];
    for (const line of computed) assert.ok(violates(line), line);
    // Later editions and the 1.x archive checker are not published 2.x checkers.
    for (const line of [`python scripts/${stem}3.0.py`, 'python scripts/check-spec-pdf.py']) assert.ok(!violates(line), line);
});
