import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../src/language/swaml-module.js';

const source = readFileSync(new URL('../../examples/01-hello.swaml', import.meta.url), 'utf8');
test('interface authoring errors retain codes and explain legal repairs', async () => {
    for (const [text, code, repair] of [
        [source.replace('Greeting sender;', 'Greeting provides;'), 'SW011', 'sender or receiver'],
        [source.replace('speaker.output -> listener.input', 'listener.input -> speaker.output'), 'SW032', 'sender -> receiver'],
        [source.replace(/qos\s*\{[^}]*\}/, ''), 'SW041', 'qos PolicyName'],
    ]) {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        const doc = await parseHelper(Swaml)(text, { validation: true });
        assert.ok(doc.diagnostics?.some(d => d.code === code && String(d.message).includes(repair)), JSON.stringify(doc.diagnostics));
    }
});
