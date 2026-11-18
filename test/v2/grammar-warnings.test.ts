// Compatibility gate 3 of swa.ml 2.3 (rule WP1a-M03): the grammar is free of warnings. Parser construction
// in createSwamlServices must print nothing, and neither may parsing the corpus: the ALL(*) lookahead of the
// generated parser reports an ambiguity only when a parse reaches it, on console.log. Generation warnings are
// rejected by scripts/langium-generate.mjs, which npm run build uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EmptyFileSystem } from 'langium';
import { createSwamlServices } from '../../src/language/swaml-module.js';

const root = new URL('../../../', import.meta.url);
type Gate = { corpus(): string[] };

test('gate 3: parser construction and corpus parsing print no warning', async () => {
    const { corpus } = await import(new URL('scripts/compatibility-2-2.mjs', root).href) as Gate;
    const printed: string[] = [], original = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
    for (const level of Object.keys(original) as (keyof typeof original)[])
        console[level] = (...args: unknown[]) => { printed.push(`console.${level}: ${args.map(String).join(' ')}`); };
    let parsed = 0;
    try {
        const { Swaml } = createSwamlServices(EmptyFileSystem);
        for (const path of corpus()) {
            Swaml.parser.LangiumParser.parse(readFileSync(new URL(path, root), 'utf8'));
            parsed++;
        }
    }
    finally {
        Object.assign(console, original);
    }
    assert.ok(parsed > 30, 'the corpus was parsed');
    assert.deepEqual(printed, [], printed.join('\n'));
});
