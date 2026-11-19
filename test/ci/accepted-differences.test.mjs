// Gate C (review 5 N7): the accepted-difference pins are checked both ways. Needs a build (out/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptedDifferences } from '../../scripts/compatibility-machines.mjs';

const source = fileURLToPath(new URL('../fixtures/compatibility-2-2/accepted/', import.meta.url));
const copy = () => { const dir = mkdtempSync(join(tmpdir(), 'accepted-')); cpSync(source, dir, { recursive: true }); return dir; };
const list = dir => JSON.parse(readFileSync(join(dir, 'accepted.json'), 'utf8'));

test('gate C: the pinned accepted differences hold', async () => {
    assert.deepEqual((await acceptedDifferences()).failures, []);
});

test('gate C: a model removed from the list, an unlisted model, or a wrong kind fails', async () => {
    const removed = copy(), l = list(removed);
    l.models = l.models.filter(m => !m.file.startsWith('c3-if'));
    writeFileSync(join(removed, 'accepted.json'), JSON.stringify(l));
    assert.ok((await acceptedDifferences({ dir: removed })).failures.some(f => f.includes('differ')));
    const extra = copy();
    copyFileSync(join(extra, 'c3-if-test-not-a-step.swaml'), join(extra, 'unlisted.swaml'));
    assert.ok((await acceptedDifferences({ dir: extra })).failures.length > 0);
    const kind = copy(), k = list(kind);
    k.models.find(m => m.file.startsWith('c3-if')).kind = 'stores';
    writeFileSync(join(kind, 'accepted.json'), JSON.stringify(k));
    assert.ok((await acceptedDifferences({ dir: kind })).failures.some(f => f.includes('as its kind stores says')));
});
