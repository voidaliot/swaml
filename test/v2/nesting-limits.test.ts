// WP2-D05: the reference parser's bracket nesting limits (SW2013). Every source here is built as the language
// server builds it: the parse runs inside DocumentBuilder.update, then the document is validated.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { EmptyFileSystem, TextDocument, URI, type LangiumDocument } from 'langium';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { BRACKET_NESTING_CLAUSE, BRACKET_NESTING_LIMIT, BRACKET_NESTING_MESSAGE, PARSER_STACK_MESSAGE, SwamlValueConverter, UNCLOSED_NESTING_LIMIT, guardParserStack } from '../../src/language/swaml-syntax.js';
import type { Model } from '../../src/language/generated/ast.js';
import * as a from '../../src/language/generated/ast.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });

const root = new URL('../../../', import.meta.url);
type Shared = { workspace: { TextDocuments: { set(document: TextDocument): void }; LangiumDocumentFactory: { fromString(text: string, uri: URI): LangiumDocument }; LangiumDocuments: { addDocument(d: LangiumDocument): void; deleteDocument(uri: URI): void }; DocumentBuilder: { update(changed: URI[], deleted: URI[]): Promise<void>; build(d: LangiumDocument[], o: object): Promise<void>; updateBuildOptions: object } } };
/**
 * Parses text inside DocumentBuilder.update, as the language server does after a change, and validates unless told
 * not to. Each call replaces the workspace's one document.
 */
async function built(shared: Shared, text: string, validation = true, extension = '.swaml'): Promise<LangiumDocument> {
    const uri = URI.parse(`memory:///nesting${extension}`);
    shared.workspace.LangiumDocuments.deleteDocument(uri);
    shared.workspace.TextDocuments.set(TextDocument.create(uri.toString(), 'swaml', 0, text));
    const doc = shared.workspace.LangiumDocumentFactory.fromString('', uri);
    shared.workspace.LangiumDocuments.addDocument(doc);
    shared.workspace.DocumentBuilder.updateBuildOptions = { validation: false };
    await shared.workspace.DocumentBuilder.update([uri], []);
    if (validation)
        await shared.workspace.DocumentBuilder.build([doc], { validation: true });
    return doc;
}
const current = () => createSwamlServices(EmptyFileSystem).shared as unknown as Shared;
const errors = (doc: LangiumDocument) => (doc.diagnostics ?? []).filter(d => d.severity === 1);
const syntaxErrors = (doc: LangiumDocument) => doc.parseResult.lexerErrors.length + doc.parseResult.parserErrors.length;
const members = (doc: LangiumDocument) => (doc.parseResult.value as Model).packages?.[0]?.elements.filter(a.isComponentDef).find(d => d.name === 'D')?.members.map(m => (m as { name?: string }).name ?? m.$type) ?? [];
const packages = (doc: LangiumDocument) => ((doc.parseResult.value as Model).packages ?? []).map(p => p.name);
const elements = (doc: LangiumDocument) => ((doc.parseResult.value as Model).packages?.[0]?.elements ?? []).map(e => (e as { name?: string }).name);

/** A component whose operation run holds statement, followed by valid members and a second package. */
const file = (statement: string, extra = '') => `package P {
  datatype R { v: int; }
  datatype S { v: int; }
  ${extra}
  component def D {
    attribute a: int[3] = [1, 2, 3];
    attribute x: int = 0;
    attribute r: R = record R { v = 0; };
    operation f(q: R) returns R { return q; }
    operation g(q: int) returns int { return q; }
    operation g2(q: S) returns int { return q.v; }
    operation k(q: int[1]) returns int { return q[0]; }
    operation run() {
      ${statement}
      x = 1;
    }
    operation later() { x = 2; }
  }
  component Demo: D;
}
package After { component def E { } }
`;
const datatypes = (depth: number) => Array.from({ length: depth + 1 }, (_, i) => i === 0 ? 'datatype T0 { v: int; }' : `datatype T${i} { n: T${i - 1}; }`).join('\n  ');
const recordLiteral = (depth: number) => { let s = 'record T0 { v = 1; }'; for (let i = 1; i <= depth; i++) s = `record T${i} { n = ${s}; }`; return s; };
/** Each nesting form at a depth: the statement and any declarations it needs. */
const forms: Record<string, (depth: number) => [string, string?]> = {
    parentheses: d => [`x = ${'('.repeat(d)}1${')'.repeat(d)};`],
    indexes: d => [`x = ${'a['.repeat(d)}0${']'.repeat(d)};`],
    calls: d => [`x = ${'g('.repeat(d)}1${')'.repeat(d)};`],
    'array literals': d => [`var z: int = ${'['.repeat(d)}1${']'.repeat(d)};`],
    'record literals': d => [`var z: T${d} = ${recordLiteral(d)};`, datatypes(d)],
    'calls around a record literal': d => [`r = ${'f('.repeat(d)}record R { v = 1; }${')'.repeat(d)};`],
    'parentheses around a record literal': d => [`r = ${'('.repeat(d)}record R { v = 1; }${')'.repeat(d)};`],
    'indexes inside calls': d => [`x = ${'g(a['.repeat(d)}0${'])'.repeat(d)};`],
    'array literals inside calls': d => [`x = ${'k(['.repeat(d)}1${'])'.repeat(d)};`],
    'record literals inside calls': d => { let e = '1'; for (let i = 0; i < d; i++) e = `g2(record S { v = ${e}; })`; return [`x = ${e};`]; },
    'calls inside indexes': d => { let e = '0'; for (let i = 0; i < d; i++) e = `a[g(${e})]`; return [`x = ${e};`]; },
};
const source = (form: string, depth: number) => { const [statement, extra] = forms[form](depth); return file(statement, extra); };

// The deepest nesting the 3.1.0 build (213f583) parses through the document builder on Node.js 26.12.0 with the
// default stack, the highest of a fresh process, a process warmed with the same form and a process that built other
// sources first (docs/RELEASE_2_3.md, WP2-D05). Nested array literals are not valid 2.2 sources (no nested array
// types), and the validation of array literals inside calls takes time exponential in the depth in 3.1.0 and here
// alike, so both are checked for parsing only.
const MEASURED_3_1_0: Record<string, number> = {
    parentheses: 160, indexes: 130, calls: 130, 'array literals': 122, 'record literals': 132, 'calls around a record literal': 127,
    'parentheses around a record literal': 147, 'indexes inside calls': 64, 'array literals inside calls': 61, 'record literals inside calls': 62, 'calls inside indexes': 64,
};
const VALID_FORMS = new Set(['parentheses', 'indexes', 'calls', 'record literals', 'calls around a record literal', 'parentheses around a record literal', 'indexes inside calls', 'record literals inside calls', 'calls inside indexes']);

test('WP2-D05 the limits: the bracket limit is above every depth 3.1.0 parses, and both messages start with the SW2013 clause', () => {
    assert.ok(Object.values(MEASURED_3_1_0).every(depth => depth > 0 && depth < BRACKET_NESTING_LIMIT), JSON.stringify(MEASURED_3_1_0));
    assert.ok(BRACKET_NESTING_MESSAGE.startsWith(BRACKET_NESTING_CLAUSE) && PARSER_STACK_MESSAGE.startsWith(BRACKET_NESTING_CLAUSE));
    assert.ok(UNCLOSED_NESTING_LIMIT < BRACKET_NESTING_LIMIT);
});

test('WP2-D05 every nesting form parses at the depth 3.1.0 reaches, without errors when the form is valid (review N2)', async () => {
    const shared = current();
    for (const [form, depth] of Object.entries(MEASURED_3_1_0)) {
        const doc = await built(shared, source(form, depth), VALID_FORMS.has(form));
        assert.equal(syntaxErrors(doc), 0, `${form} at ${depth}: ${JSON.stringify(doc.parseResult.lexerErrors.map(e => e.message))}`);
        if (VALID_FORMS.has(form))
            assert.deepEqual(errors(doc).map(e => e.message), [], `${form} at ${depth}`);
        assert.deepEqual(members(doc), ['a', 'x', 'r', 'f', 'g', 'g2', 'k', 'run', 'later'], form);
    }
});

test('WP2-D05 braces inside brackets count as nesting, so a record literal deep inside brackets is valid (review N1)', async () => {
    const shared = current();
    for (const depth of [60, 66, 100])
        for (const form of ['calls around a record literal', 'parentheses around a record literal']) {
            const doc = await built(shared, source(form, depth));
            assert.deepEqual(errors(doc).map(e => [e.code, e.message]), [], `${form} at ${depth}`);
            assert.deepEqual(elements(doc), ['R', 'S', 'D', 'Demo'], `${form} at ${depth}`);
        }
    // A deep for initializer: the ; inside the for parentheses does not end the statement unbalanced.
    const loop = await built(shared, file(`for (var i: int = ${'('.repeat(UNCLOSED_NESTING_LIMIT + 6)}0${')'.repeat(UNCLOSED_NESTING_LIMIT + 6)}; i < 3; i = i + 1) { x = i; }`));
    assert.deepEqual(errors(loop).map(e => e.message), []);
});

test('WP2-D05 the limits count depth, not brackets: long lists, and brackets in strings, comments and quoted names', async () => {
    const shared = current();
    for (const statement of [
        `var big: int[500] = [${Array.from({ length: 500 }, () => 'a[x]').join(', ')}];`,
        `x = h(${Array.from({ length: 300 }, (_, i) => `g(a[${i % 3}])`).join(', ')});`,
        // Counted, each of these would leave more than the unclosed limit open at the ; of its statement.
        `var s: string = "${'(['.repeat(UNCLOSED_NESTING_LIMIT)}{";`,
        `x = 1 /* ${'(['.repeat(UNCLOSED_NESTING_LIMIT)}{ */ + 1;`,
        `x = 1; // ${'(['.repeat(UNCLOSED_NESTING_LIMIT)}`,
        `var '${'(['.repeat(UNCLOSED_NESTING_LIMIT)}{': int = 1; x = '${'(['.repeat(UNCLOSED_NESTING_LIMIT)}{' + 1;`,
    ]) {
        const doc = await built(shared, file(statement).replace('operation run()', `operation h(${Array.from({ length: 300 }, (_, i) => `p${i}: int`).join(', ')}) returns int { return p0; }\n    operation run()`), false);
        assert.equal(syntaxErrors(doc), 0, `${statement.slice(0, 40)}: ${JSON.stringify(doc.parseResult.lexerErrors.map(e => e.message))}`);
    }
});

test('WP2-D05 (a) nesting beyond the limit stops only its statement, fast, with SW2013 at the first bracket beyond it', async () => {
    const shared = current();
    // Unclosed: the statement ends at the } of run that does not match the open [; the members after it survive.
    for (const depth of [800, 1200, 5000]) {
        const started = performance.now(), doc = await built(shared, file('a['.repeat(depth)));
        assert.ok(performance.now() - started < 1000, `${depth} unclosed a[ within 1 s`);
        assert.deepEqual(errors(doc).map(e => [e.code, e.message, e.range.start.line, e.range.start.character]), [['SW2013', `${BRACKET_NESTING_MESSAGE}; this statement is not parsed. Split the expression into local variables.`, 13, 6 + 2 * BRACKET_NESTING_LIMIT + 1]]);
        assert.deepEqual(members(doc), ['a', 'x', 'r', 'f', 'g', 'g2', 'k', 'run', 'later']);
        assert.deepEqual(packages(doc), ['P', 'After']);
    }
    // Balanced: the statement ends at its ;, the next statement x = 1; and everything after it survive.
    const balanced = await built(shared, source('parentheses', BRACKET_NESTING_LIMIT + 1));
    assert.deepEqual(errors(balanced).map(e => [e.code, e.range.start.line, e.range.start.character]), [['SW2013', 13, 6 + 4 + BRACKET_NESTING_LIMIT]]);
    const run = (balanced.parseResult.value as Model).packages[0].elements.filter(a.isComponentDef)[0].members.filter(a.isOperation).find(o => o.name === 'run')!;
    assert.deepEqual(run.body.statements.map(s => s.$cstNode?.text), ['x = 1;']);
    assert.deepEqual(packages(balanced), ['P', 'After']);
});

test('WP2-D05 (a) unclosed brackets through record literals fail fast (review N3); the statement extends to its first mismatched bracket', async () => {
    const started = performance.now(), doc = await built(current(), file(`r = ${'f(record R { v = '.repeat(1200)}`));
    assert.ok(performance.now() - started < 1000, 'within 1 s');
    const found = errors(doc);
    assert.equal(found[0].code, 'SW2013');
    assert.equal(found[0].message, `${BRACKET_NESTING_MESSAGE}; this statement is not parsed. Split the expression into local variables.`);
    // The 201st open bracket is the ( of the 101st f(.
    assert.deepEqual([found[0].range.start.line, found[0].range.start.character], [13, 6 + 4 + 100 * 'f(record R { v = '.length + 1]);
    // The open ( and { pair up with the brackets of the members that follow, so the statement only ends at the ; of
    // component Demo: D;, where a ( is innermost. The members before run survive; later and the closing } of D are
    // part of the dropped statement, so Demo becomes a member of D. The package After survives.
    assert.deepEqual(members(doc), ['a', 'x', 'r', 'f', 'g', 'g2', 'k', 'run', 'Demo']);
    assert.deepEqual(packages(doc), ['P', 'After']);
});

test('WP2-D05 (b) a statement left unclosed beyond the unclosed limit is stopped at its first token; within it, recovery is unchanged', async () => {
    const shared = current();
    const deep = await built(shared, file('a['.repeat(UNCLOSED_NESTING_LIMIT + 1)));
    assert.deepEqual(errors(deep).map(e => [e.code, e.message, e.range.start.line, e.range.start.character]), [['SW2013', `${BRACKET_NESTING_CLAUSE} of ${UNCLOSED_NESTING_LIMIT} levels for a statement that leaves brackets unclosed; this statement is not parsed. Close the brackets.`, 13, 6]]);
    assert.deepEqual(members(deep), ['a', 'x', 'r', 'f', 'g', 'g2', 'k', 'run', 'later']);
    const shallow = await built(shared, file('a['.repeat(UNCLOSED_NESTING_LIMIT)));
    assert.ok(errors(shallow).length > 0 && !errors(shallow).some(e => e.code === 'SW2013'), JSON.stringify(errors(shallow).map(e => e.message)));
    assert.deepEqual(members(shallow), ['a', 'x', 'r', 'f', 'g', 'g2', 'k', 'run', 'later']);
});

test('WP2-D05 (c) a parse that overflows the stack is SW2013 for its file only; the parser and the workspace keep working', async () => {
    const services = createSwamlServices(EmptyFileSystem), shared = services.shared as unknown as Shared;
    // Unclosed blocks are not brackets: 1,200 of them overflow the parser's stack.
    const text = file('if (x > 0) { '.repeat(1200)), started = performance.now();
    const doc = await built(shared, text);
    assert.ok(performance.now() - started < 2000, 'within 2 s');
    const found = errors(doc);
    assert.deepEqual(found.map(e => [e.code, e.message]), [['SW2013', PARSER_STACK_MESSAGE]]);
    assert.equal(found[0].range.start.line, 13, 'at the most deeply nested token');
    assert.deepEqual(packages(doc), []);
    // The same parser parses the next file exactly as a fresh parser does, and a valid file in the workspace is valid.
    const next = await built(shared, source('parentheses', 20));
    assert.deepEqual(errors(next), []);
    const fresh = createSwamlServices(EmptyFileSystem).Swaml.parser.LangiumParser.parse(source('parentheses', 20));
    const shape = (node: unknown) => JSON.stringify(node, (key, value) => key.startsWith('$') && key !== '$type' ? undefined : value && typeof value === 'object' && '$refText' in value ? value.$refText : value);
    assert.equal(shape(next.parseResult.value), shape(fresh.value));
    // The direct parser call reports the same instead of throwing.
    const direct = services.Swaml.parser.LangiumParser.parse(text);
    assert.deepEqual(direct.lexerErrors.map(e => e.message), [PARSER_STACK_MESSAGE]);
    // The three shapes an overflow takes out of the parser: the RangeError itself, or, after the parser's catch saw
    // it, a TypeError or an "Invalid array length" RangeError from a finally block on the way out. A RangeError that
    // is not an overflow, or a TypeError the parser never saw an overflow for, propagates.
    const fake = (inner: Error | undefined, outer: Error) => {
        const wrapper = { invokeRuleCatch(error: unknown) { throw error; } };
        return { wrapper, parse(text: string) {
            if (!text)
                return { value: { $type: 'Model' }, lexerErrors: [], parserErrors: [] };
            try {
                if (inner)
                    wrapper.invokeRuleCatch(inner);
            } finally {
                throw outer;
            }
        } };
    };
    const overflow = () => new RangeError('Maximum call stack size exceeded');
    for (const [inner, outer] of [[undefined, overflow()], [overflow(), new TypeError('Cannot read properties of undefined')], [overflow(), new RangeError('Invalid array length')]] as const) {
        const parser = fake(inner, outer);
        guardParserStack(parser);
        assert.deepEqual((parser.parse('x') as unknown as { lexerErrors: { message: string }[] }).lexerErrors.map(e => e.message), [PARSER_STACK_MESSAGE], outer.message);
    }
    for (const [inner, outer] of [[undefined, new TypeError('a bug')], [undefined, new RangeError('Invalid array length')], [new TypeError('a bug'), new TypeError('a bug')]] as const) {
        const parser = fake(inner, outer);
        guardParserStack(parser);
        assert.throws(() => parser.parse('x'), outer);
    }
});

test('WP2-D05 (c) near the stack limit every parse either succeeds or reports SW2013, whatever shape the overflow takes (review R2)', () => {
    const parser = createSwamlServices(EmptyFileSystem).Swaml.parser.LangiumParser;
    const text = (statement: string) => `package P { component def D { attribute x: int = 0; operation run() { ${statement} } } }`;
    let parsed = 0, stopped = 0;
    // Balanced and unclosed blocks, one level apart, across the depth where this process runs out of stack.
    for (const [open, close, from, to] of [['if (x > 0) { ', ' }', 250, 480], ['if (x > 0) { ', '', 120, 280]] as const)
        for (let depth = from; depth <= to; depth++) {
            const result = parser.parse(text(`${open.repeat(depth)}x = 1;${close.repeat(depth)}`));
            if (result.lexerErrors.some(e => e.message === PARSER_STACK_MESSAGE))
                stopped++;
            else
                parsed++;
        }
    assert.ok(parsed > 0 && stopped > 0, `${parsed} parsed, ${stopped} stopped`);
    assert.equal(parser.parse(text('x = 1;')).lexerErrors.length + parser.parse(text('x = 1;')).parserErrors.length, 0);
});

test('WP2-D05 (c) an exception that is not an overflow propagates at any depth (review R2)', () => {
    // A value converter that fails on "BOOM": its TypeError is a bug to report, not a resource limit.
    class Failing extends SwamlValueConverter {
        protected override runConverter(rule: Parameters<SwamlValueConverter['runConverter']>[0], input: string, cstNode: Parameters<SwamlValueConverter['runConverter']>[2]) {
            if (input === '"BOOM"')
                throw new TypeError('converter bug');
            return super.runConverter(rule, input, cstNode);
        }
    }
    const parser = createSwamlServices(EmptyFileSystem, { parser: { ValueConverter: () => new Failing() } }).Swaml.parser.LangiumParser;
    for (const depth of [0, 80, 150])
        assert.throws(() => parser.parse(`package P { component def D { operation run() { var s: string = ${'('.repeat(depth)}"BOOM"${')'.repeat(depth)}; } } }`), /converter bug/u, `depth ${depth}`);
});

test('WP2-D05 valid nesting parses at least as deep as under the kept 2.2 grammar, on the document-builder path, for every form (review L1, N2)', async () => {
    const { parsers } = await import(new URL('scripts/compatibility-2-2.mjs', root).href) as { parsers(): Promise<{ kept: { shared: Shared; parser: { LangiumParser: unknown }; LanguageMetaData: { fileExtensions: readonly string[] } } }> };
    const kept = (await parsers()).kept;
    // The kept parser has no guard; an overflow becomes a lexing error here too, so that the bisection can go on.
    guardParserStack(kept.parser.LangiumParser);
    const shared = current();
    for (const form of Object.keys(forms)) {
        const parses = async (s: Shared, depth: number) => { const doc = await built(s, source(form, depth), false, s === shared ? '.swaml' : kept.LanguageMetaData.fileExtensions[0]); return syntaxErrors(doc) === 0; };
        let low = 10, high = 400;
        while (high - low > 1) {
            const mid = (low + high) >> 1;
            if (await parses(kept.shared, mid)) low = mid; else high = mid;
        }
        assert.ok(low > 10 && high < 400, `${form}: the bisection found the 2.2 limit (${low})`);
        assert.ok(await parses(shared, low), `${form}: 2.2 parses depth ${low}, so must the current parser`);
    }
});
