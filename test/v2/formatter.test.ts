import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CstUtils, EmptyFileSystem, isReference, type AstNode } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { formatDocument, FormattingSafetyError, verifyFormatting } from '../../src/language/formatter.js';
import type { Model } from '../../src/language/generated/ast.js';
import { bodyDocsModel, largeModel } from './format-fixtures.js';

const services = createSwamlServices(EmptyFileSystem);
const parseOnly = parseHelper<Model>(services.Swaml);
const lexer = services.Swaml.parser.Lexer;
const root = fileURLToPath(new URL('../../../', import.meta.url));
const main = fileURLToPath(new URL('../../src/cli/main.js', import.meta.url));

async function syntax(text: string) {
    const doc = await parseOnly(text);
    assert.deepEqual([...doc.parseResult.lexerErrors, ...doc.parseResult.parserErrors].map(e => e.message), []);
    return doc;
}
/** Comments and documentation in source order; a line comment's trailing blanks are whitespace. */
function comments(text: string): string[] {
    const r = lexer.tokenize(text);
    return [...r.tokens, ...r.hidden].filter(t => ['DOC_COMMENT', 'ML_COMMENT', 'SL_COMMENT'].includes(t.tokenType.name)).sort((a, b) => a.startOffset - b.startOffset).map(t => t.tokenType.name === 'SL_COMMENT' ? t.image.trimEnd() : t.image);
}
/** The AST without positions, containers or resolution state: references by their text. */
function shape(node: unknown): unknown {
    if (Array.isArray(node))
        return node.map(shape);
    if (isReference(node))
        return { ref: node.$refText };
    if (node && typeof node === 'object')
        return Object.fromEntries(Object.entries(node).filter(([k]) => k === '$type' || !k.startsWith('$')).map(([k, v]) => [k, shape(v)]));
    return node;
}
/** Asserts the formatter properties for one source: comments kept, AST unchanged, idempotent. */
async function assertCanonical(text: string, label: string) {
    const doc = await syntax(text);
    const formatted = formatDocument(doc, lexer);
    assert.deepEqual(comments(formatted), comments(text), label + ': comments and documentation');
    const again = await syntax(formatted);
    assert.deepEqual(shape(again.parseResult.value as AstNode), shape(doc.parseResult.value as AstNode), label + ': AST');
    assert.equal(formatDocument(again, lexer), formatted, label + ': idempotent');
    return formatted;
}
function swamlFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (statSync(path).isDirectory())
            return name === 'invalid' ? [] : swamlFiles(path);
        return name.endsWith('.swaml') ? [path] : [];
    });
}

test('documentation first in operation and state bodies survives the first in-process format', async () => {
    // The canonical form of the fixture is the fixture itself.
    for (const count of [1, 120])
        assert.equal(await assertCanonical(bodyDocsModel(count), 'body docs ' + count), bodyDocsModel(count));
    // A fresh process formats once, as an editor or script calling parseHelper and formatDocument does.
    const url = (path: string) => JSON.stringify(new URL(path, import.meta.url).href);
    const script = `import { EmptyFileSystem } from 'langium'; import { parseHelper } from 'langium/test';
const { createSwamlServices } = await import(${url('../../src/language/swaml-module.js')});
const { formatDocument } = await import(${url('../../src/language/formatter.js')});
const { bodyDocsModel } = await import(${url('./format-fixtures.js')});
const text = bodyDocsModel(120), { Swaml } = createSwamlServices(EmptyFileSystem);
const doc = await parseHelper(Swaml)(text, { validation: true });
process.stdout.write(String(doc.diagnostics.filter(d => d.severity === 1).length) + ' ' + (formatDocument(doc) === text));`;
    for (let run = 0; run < 3; run++) {
        const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', cwd: root });
        assert.equal(r.stdout, '0 true', r.stderr);
    }
});

test('formatting every repository example keeps comments, documentation and the AST and is idempotent', async () => {
    const files = swamlFiles(join(root, 'examples'));
    assert.ok(files.length >= 31);
    for (const file of files)
        await assertCanonical(readFileSync(file, 'utf8'), file);
});

test('formatting generated large models keeps every comment and documentation on repeated calls', async () => {
    for (const count of [1, 40, 120]) {
        const text = largeModel(count), doc = await syntax(text);
        const first = await assertCanonical(text, 'generated ' + count);
        assert.equal(comments(first).length, comments(text).length);
        assert.ok(comments(text).length >= count * 6);
        for (let i = 0; i < 3; i++)
            assert.equal(formatDocument(doc, lexer), first, 'repeated call ' + i);
    }
});

test('layout: array literals, unary minus, closing braces, guards and leaf documentation', async () => {
    const formatted = await assertCanonical(largeModel(1), 'layout');
    for (const line of ['attribute last: int = -0 /** Leaf documentation 0. */;', 'attribute values: int[3] = [1, -2, 3];', 'right = -(2 + 0);', 'return [last, -last, 0];', 'left: int /** Left value. */;', 'provides event message(value: int) /** Trailing member documentation. */;', '} on receive input.message(value) {', 'on receive control.message(v) when (v > 0) to On {', 'on exit {', '// A line comment before an attribute 0.', 'last = values[0] + (pair.left);'])
        assert.ok(formatted.split('\n').some(l => l.trim() === line), line + '\n' + formatted);
    assert.ok(!/^\s*;\s*$/m.test(formatted), 'no lone semicolon');
    assert.ok(!/} on (exit|receive control)/.test(formatted), 'state actions and transitions start their own lines');
    assert.ok(formatted.includes('    /**\n     * Component number 0: documentation spanning\n     *   several indented lines.\n     */\n'));
    // Binary minus stays spaced; indexing and type sizes attach.
    const binary = await assertCanonical('package P { component C { attribute a: int = 1; attribute b: int[2] = [a - 1, a-(2)]; operation f() returns int { var x: int[2] = b; return x[0] - -x[1]; } } }', 'binary');
    assert.ok(binary.includes('attribute b: int[2] = [a - 1, a - (2)];'), binary);
    assert.ok(binary.includes('return x[0] - -x[1];'), binary);
    assert.ok(binary.includes('var x: int[2] = b;'), binary);
});

test('the formatting safety net refuses lost, reordered, changed and merged tokens', async () => {
    const text = 'package P {\n  /** Doc. */\n  component C {\n    // note\n    attribute a: int = 1;\n    attribute b: int = 2;\n  }\n}\n';
    const doc = await syntax(text), tokens = CstUtils.flattenCst(doc.parseResult.value.$cstNode!).filter(n => n.tokenType.name !== 'WS').toArray();
    verifyFormatting(text, tokens, formatDocument(doc, lexer), lexer);
    verifyFormatting(text, tokens, text.replace('// note', '// note   '), lexer);
    const refused = (formatted: string, withLexer = true) => assert.throws(() => verifyFormatting(text, tokens, formatted, withLexer ? lexer : undefined), FormattingSafetyError);
    refused(text.replace('// note\n', ''));
    refused(text.replace('/** Doc. */', ''));
    refused(text.replace('/** Doc. */', '/**  Doc. */'));
    refused(text.replace('attribute a: int = 1;\n    attribute b: int = 2;', 'attribute b: int = 2;\n    attribute a: int = 1;'));
    refused(text + '// added\n');
    refused(text.replace('component C', 'componentC'));
    // Without the lexer the character walk alone cannot see two tokens merge; the lexer can.
    verifyFormatting(text, tokens, text.replace('component C', 'componentC'));
    // Whitespace between tokens may change freely.
    verifyFormatting(text, tokens, text.replace('= 1;', '=1;').replace('a: int', 'a:int'), lexer);
    // A comment the parser did not attach anywhere is still protected by the whole-text comparison.
    refused(text.replace('}\n}\n', '}\n'));
});

test('formatting refuses malformed sources', async () => {
    const doc = await parseOnly('package P { component C { attribute a: int = ; } }');
    assert.ok(doc.parseResult.parserErrors.length);
    assert.throws(() => formatDocument(doc, lexer), /Fix syntax errors/);
    assert.deepEqual(services.Swaml.lsp.Formatter!.formatDocument(doc, { textDocument: { uri: doc.uri.toString() }, options: { tabSize: 2, insertSpaces: true } }), []);
});

test('CLI --format and --check-format agree on twenty repeated runs of a large model', () => {
    const dir = mkdtempSync(join(tmpdir(), 'swaml-format-'));
    try {
        const text = largeModel(100), source = join(dir, 'large.swaml'), target = join(dir, 'formatted.swaml');
        assert.ok(text.length > 100_000);
        const cli = (...args: string[]) => spawnSync(process.execPath, [main, ...args], { encoding: 'utf8' });
        let canonical: string | undefined;
        for (let run = 0; run < 20; run++) {
            writeFileSync(target, text);
            const formatted = cli('--format', target);
            assert.equal(formatted.status, 0, formatted.stdout + formatted.stderr);
            const written = readFileSync(target, 'utf8');
            canonical ??= written;
            assert.equal(written, canonical, 'run ' + run + ' wrote different text');
            assert.deepEqual(comments(written), comments(text));
        }
        writeFileSync(source, text);
        for (let run = 0; run < 20; run++) {
            const unformatted = cli('--json', '--check-format', source), canonicalCheck = cli('--json', '--check-format', target);
            assert.equal(unformatted.status, 1, 'run ' + run);
            assert.deepEqual(JSON.parse(unformatted.stdout).diagnostics.filter((d: { severity: number }) => d.severity === 1).map((d: { code: string }) => d.code), ['SW2014']);
            assert.equal(canonicalCheck.status, 0, 'run ' + run + ': ' + canonicalCheck.stdout);
        }
        assert.equal(readFileSync(source, 'utf8'), text, '--check-format never writes');
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('CLI --format leaves a model with errors untouched', () => {
    const dir = mkdtempSync(join(tmpdir(), 'swaml-format-'));
    try {
        const file = join(dir, 'broken.swaml'), text = 'package P {\n  // keep\n  component C { attribute a: int = ; }\n}\n';
        writeFileSync(file, text);
        const r = spawnSync(process.execPath, [main, '--format', file], { encoding: 'utf8' });
        assert.equal(r.status, 1);
        assert.equal(readFileSync(file, 'utf8'), text);
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
