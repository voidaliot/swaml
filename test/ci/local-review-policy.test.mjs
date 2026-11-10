import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
test('publication checks are deliberate and preserve the frozen 2.1 publication', () => {
    assert.match(publication, /workflow_dispatch:/u);
    assert.doesNotMatch(publication, /pull_request:|push:/u);
    assert.match(publication, /python scripts\/check-spec-pdf-2\.1\.py --archive/u);
    assert.doesNotMatch(publication, /run: python scripts\/check-spec-pdf-2\.1\.py\s*$/mu);
});
