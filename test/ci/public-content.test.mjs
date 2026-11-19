import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isDisallowed, pathFixtureFiles, textDigest, waivesLocalPaths } from '../../scripts/public-content-rules.mjs';

// Offending samples are assembled at runtime so that this file passes the scan itself.
const C = ':', B = String.fromCharCode(92), S = '/', editor = 'v' + 's' + 'c';

test('local paths are rejected', () => {
    for (const [line, kind] of [
        ['see `E' + C + B + 't' + B + 'review.md`', 'drive path'],
        ['E' + C + B + 'review.md', 'drive-root file'],
        ['"E' + C + B + B + 't' + B + B + 'review.md"', 'JSON-escaped drive path'],
        ['"E' + C + B + B + B + B + 't"', 'doubly escaped drive path'],
        ['E' + '%3A' + '%5C' + 't%5Cx', 'URL-encoded drive path'],
        [S + 'e' + S + 't' + S + 'review-wp0.md', 'Git Bash path'],
        [S + 'E' + S + 't' + S + 'review.md', 'Git Bash path with an uppercase drive'],
        [S + 'mnt' + S + 'e' + S + 't' + S + 'x', 'WSL mount'],
        [S + 'cygdrive' + S + 'e' + S + 't', 'Cygwin mount'],
        ['C' + C + B + 'Program Files' + B + 'x', 'directory with a space'],
        ['C' + C + B + 'Users', 'no trailing separator'],
        ['C' + C + S + 'Users' + S + 'someone' + S + 'x', 'forward slashes'],
        [B + B + 'server' + B + 'share' + B + 'x', 'UNC path'],
    ]) assert.equal(isDisallowed(line), true, kind);
});

test('editor-product names are rejected', () => {
    for (const [line, kind] of [
        ['pinned in name-' + editor + '-ext', 'hyphenated repository name'],
        ['swaml-' + editor, 'repository name at the end of a line'],
        ['swaml_' + editor + '_ext', 'underscored repository name'],
        [editor + '-ext repository', 'repository name at the start of a line'],
        ['swaml.' + editor, 'dot-joined repository name'],
        ['swaml ' + editor + ' ext', 'space-joined repository name'],
        ['the vs' + 'code editor', 'product name as one word'],
        ['~/projects/swaml-' + editor + '-ext', 'home path with the repository name'],
        ['https://marketplace.visual' + 'studio.com/items?itemName=x.y', 'marketplace host'],
        ['code.visual' + 'studio.com', 'editor product site'],
    ]) assert.equal(isDisallowed(line), true, kind);
});

test('ordinary public text passes', () => {
    for (const line of [
        'https://example.org/a/b and http://localhost:8080/x/',
        'file names such as docs/spec/a/b.md and /usr/local/bin',
        'Banking::ATM.serve/2/then/0 and Component/schedule/0',
        'a ratio of 3:2 and the time 10:30/11:00',
        'C: drive letters without a path, and Note: text',
        'swaml-reference/3.0 and voidaliot/swaml#12',
        'import type {Diagnostic} from \'vs' + 'code-languageserver\';',
        '"vs' + 'code-jsonrpc": "8.2.1", "vs' + 'code-uri": "3.1.0"',
        'x.replace(' + S + 'a' + S + 'g, "")',
        's.split(' + S + 'x' + S + 'i)',
        'text.replace(' + S + 'a' + S + 'gi, b).split(' + S + 'c' + S + ')',
        'see `' + S + 'v' + S + '2` route',
        'ratio 1' + C + S + '2',
    ]) assert.equal(isDisallowed(line), false, line);
});

test('path fixtures waive only the local-path rules, and only with their pinned bytes', async () => {
    const drive = 'C' + C + S + 'drive';
    assert.equal(isDisallowed(drive, { allowLocalPaths: true }), false);
    assert.equal(isDisallowed('swaml-' + editor, { allowLocalPaths: true }), true);
    for (const [path, digest] of pathFixtureFiles) {
        const source = await readFile(new URL('../../' + path, import.meta.url), 'utf8');
        assert.equal(textDigest(source), digest, path + ' changed since v2.2 and loses its waiver');
        assert.equal(waivesLocalPaths(path, source), true, path);
        assert.equal(waivesLocalPaths(path, source + '\n# edited'), false, path + ' edited');
        assert.equal(waivesLocalPaths(path, source.replace(/\r?\n/g, '\r\n')), true, path + ' with CRLF');
    }
    assert.equal(waivesLocalPaths('docs/other.md', 'x'), false);
});
