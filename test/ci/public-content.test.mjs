import assert from 'node:assert/strict';
import test from 'node:test';
import { isDisallowed } from '../../scripts/public-content-rules.mjs';

// Offending samples are assembled at runtime so that this file passes the scan itself.
const colon = ':', back = '\\', drive = letter => letter + colon;

test('local drive-letter paths are rejected', () => {
    for (const line of [
        'see `' + drive('E') + back + 't' + back + 'review.md`',
        'path ' + drive('c') + '/work/notes.txt',
        '(' + drive('D') + back + 'GitHub' + back + 'repo)',
    ]) assert.equal(isDisallowed(line), true, line);
});

test('editor-product repository names are rejected', () => {
    assert.equal(isDisallowed('pinned in name' + '-vs' + 'c-ext'), true);
});

test('ordinary public text passes', () => {
    for (const line of [
        'https://example.org/a/b and http://localhost:8080/x/',
        'Banking::ATM.serve/2/then/0 and Component/schedule/0',
        'a ratio of 3:2 and the time 10:30/11:00',
        'regex /[a-z]:[\\\\/]/ written in source',
        'C: drive letters without a path',
        'swaml-reference/2.3 and voidaliot/swaml#12',
    ]) assert.equal(isDisallowed(line), false, line);
});
