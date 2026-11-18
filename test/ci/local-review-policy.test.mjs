import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
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
test('publication checks are deliberate and run every published 2.x edition in archive mode', () => {
    assert.match(publication, /workflow_dispatch:/u);
    assert.doesNotMatch(publication, /pull_request:|push:/u);
    for (const edition of ['2\\.0', '2\\.1', '2\\.2'])
        assert.match(publication, new RegExp(`python scripts/check-spec-pdf-${edition}\\.py --archive`, 'u'));
});

// A published edition's checker name must be directly followed, on the same line and
// after an optional closing quote, by --archive. Anything else is a strict run.
const publishedChecker = /check-spec-pdf-2\.[0-2](?:\.0)?\.py(?!["']?[ \t]+--archive(?![\w=-]))/u;
const repository = fileURLToPath(new URL('../../', import.meta.url));
// The checkers, builders and source inventories name these scripts as embedded publication sources.
const inventory = /^scripts\/(?:check-spec-pdf|build-spec-pdf|publication_)/u;

function files(directory, keep) {
    if (!existsSync(join(repository, directory))) return [];
    return readdirSync(join(repository, directory), {recursive: true, withFileTypes: true}).filter(e => e.isFile())
        .map(e => relative(repository, join(e.parentPath, e.name)).replaceAll('\\', '/')).filter(keep);
}

function strictRuns() {
    const found = [];
    const scan = (where, text) => text.split('\n').forEach((line, i) => { if (publishedChecker.test(line)) found.push(`${where}:${i + 1}`); });
    for (const path of [...files('.github', p => /\.ya?ml$/u.test(p) || p.startsWith('.github/actions/')),
                        ...files('scripts', p => /\.(?:sh|ps1|cmd|bat|mjs|cjs|js|py)$/u.test(p) && !inventory.test(p))])
        scan(path, readFileSync(join(repository, path), 'utf8'));
    const scripts = JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8')).scripts ?? {};
    for (const [name, command] of Object.entries(scripts)) scan(`package.json scripts.${name}`, command);
    return found;
}

test('no workflow, action, npm script or script wrapper runs a published edition checker strictly', () => {
    assert.deepEqual(strictRuns(), []);
});

test('the strict-run pattern rejects every invocation not directly followed by --archive', () => {
    // Built at runtime so that no committed line spells a strict run.
    for (const edition of ['2.0', '2.1', '2.2']) {
        const checker = 'scripts/check-spec-pdf-' + edition + '.py';
        const strict = [`python ${checker}`, `python ${checker} --pdf output/x.pdf`, `python ${checker} --pdf x.pdf --archive`,
            `python ${checker} && echo ok`, `python ${checker}; echo ok`, `python ${checker} # --archive later`,
            `python "${checker}"`, `python '${checker}'`, `python ${checker} \\`, `python ${checker} --archived`,
            `python ${checker} --archive=no`, `run: python ${checker}\r`, `python ./${checker} 2>&1 | tee log`];
        for (const line of strict) assert.match(line, publishedChecker, line);
        // A line continuation or a following block line never carries --archive to this command.
        for (const block of [`python ${checker} \\\n  --archive`, `python ${checker}\n  --archive`])
            assert.match(block.split('\n')[0], publishedChecker, block);
        const archive = [`python ${checker} --archive`, `python "${checker}" --archive`, `python '${checker}'\t--archive --pdf x.pdf`,
            `run: python ${checker} --archive\r`, `python ${checker} --archive && echo ok`];
        for (const line of archive) assert.doesNotMatch(line, publishedChecker, line);
    }
});
