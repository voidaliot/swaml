// WP3 of swa.ml 2.3: the library packages Swaml::Numeric, Swaml::Text and Swaml::Time (WP3-L01, WP3-L02,
// WP3-L03, WP3-L04, WP3-M01), their runtime rules (WP3-R01 sqrt, WP3-R02 intText and realText, WP3-R03 now),
// the effect of now() (WP3-S01, WP3-D01) and the stale-read rule for it (WP3-S02).
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { AstUtils, EmptyFileSystem } from 'langium';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import { STANDARD_LIBRARY, STANDARD_LIBRARY_2_3 } from '../../src/language/standard-library.js';
import { effects, identity, isClockRead, libraryIntrinsic, LIBRARY_INTRINSICS, signature, typeKey } from '../../src/language/semantic.js';
import { intText, realText, squareRoot, REAL_TEXT_LIMIT, REAL_TEXT_MAX_DECIMALS, RuntimeFault } from '../../src/simulation/values.js';
import { runCase, simulate, type SimulationOptions } from '../../src/simulation/simulator.js';
import * as a from '../../src/language/generated/ast.js';
import { invalid, parse, valid, workspace } from './helpers.js';
const test = (name: string, fn: () => unknown) => nodeTest(name, async () => { await fn(); });
const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8').replaceAll('\r\n', '\n');
const IMPORTS = 'import Swaml::Numeric;\n  import Swaml::Text;\n  import Swaml::Time;\n  import Swaml::Math;';
const wrap = (body: string, extra = '') => `package Test {
  ${IMPORTS}
  ${extra}
  component def D {
    ${body}
  }
  component Demo: D;
}`;
const errors = async (source: string) => (await parse(source)).errors.map(e => [e.code, e.message]);
const warnings = async (source: string) => (await parse(source)).warnings.map(e => [e.code, e.message]);
const runStores = async (source: string, options: Partial<SimulationOptions> = {}, target = 'Test::Demo') => {
    const r = await valid(source);
    return simulate([r.model], target, { untilNs: 100000000, ...options });
};
const library = () => {
    const { shared } = createSwamlServices(EmptyFileSystem);
    return [...shared.workspace.LangiumDocuments.all].filter(d => d.uri.scheme === 'builtin');
};
const libraryOperations = () => new Map(library().flatMap(d => (d.parseResult.value as a.Model).packages.flatMap(p => p.elements.filter(a.isOperation).map(o => [identity(o), o] as const))));
const signatureText = (o: a.Operation) => `${o.name}(${o.parameters.map(p => `${p.name}: ${typeKey(p.type)}`).join(', ')}) returns ${typeKey(o.result)}`;

// ---------------------------------------------------------------- library content and loading

test('WP3-L01 Swaml::Numeric declares minInt, maxInt, clampInt and clamp with source bodies and sqrt as a host intrinsic', () => {
    const ops = libraryOperations();
    const numeric = [...ops].filter(([k]) => k.startsWith('Swaml::Numeric::')).map(([, o]) => o);
    assert.deepEqual(numeric.map(signatureText), [
        'minInt(a: int, b: int) returns int', 'maxInt(a: int, b: int) returns int', 'clampInt(v: int, low: int, high: int) returns int',
        'clamp(v: real, low: real, high: real) returns real', 'sqrt(v: real) returns real']);
    for (const o of numeric)
        assert.equal(o.definition, true, `${o.name} is an operation def`);
    assert.deepEqual(numeric.filter(o => o.body.statements.length).map(o => o.name), ['minInt', 'maxInt', 'clampInt', 'clamp']);
    assert.deepEqual(numeric.map(o => libraryIntrinsic(o)), [undefined, undefined, undefined, undefined, 'sqrt']);
});
test('WP3-L01 the Numeric source bodies: minInt, maxInt, clampInt and clamp', async () => {
    const r = await runStores(wrap(`attribute k: int[6] = [0, 0, 0, 0, 0, 0]; attribute x: real[3] = [0.0, 0.0, 0.0];
      operation go() { k[0] = minInt(3, -4); k[1] = maxInt(3, -4); k[2] = clampInt(12, 0, 10); k[3] = clampInt(-12, 0, 10); k[4] = clampInt(7, 0, 10); k[5] = clampInt(5, 10, 0);
        x[0] = clamp(2.5, 0.0, 1.0); x[1] = clamp(-0.5, 0.0, 1.0); x[2] = clamp(0.25, 0.0, 1.0); }
      schedule { on start go(); }`));
    // clampInt(v, low, high) tests low first: with low above high, a value below low is low and every other value is high.
    assert.deepEqual(r.stores.Demo, { k: [-4, 3, 10, 0, 7, 10], x: [1, 0, 0.25] });
});
test('WP3-L02 Swaml::Text declares intText and realText as host intrinsics and boolText with a source body', async () => {
    const ops = libraryOperations();
    const text = [...ops].filter(([k]) => k.startsWith('Swaml::Text::')).map(([, o]) => o);
    assert.deepEqual(text.map(signatureText), ['intText(v: int) returns string', 'realText(v: real, decimals: uint) returns string', 'boolText(v: bool) returns string']);
    assert.deepEqual(text.map(o => libraryIntrinsic(o)), ['intText', 'realText', undefined]);
    const r = await runStores(wrap(`attribute s: string[2] = ["", ""];
      operation go() { s[0] = boolText(true); s[1] = boolText(1 > 2); }
      schedule { on start go(); }`));
    assert.deepEqual(r.stores.Demo, { s: ['true', 'false'] });
});
test('WP3-L03 Swaml::Time declares now() returns uint as a host intrinsic', () => {
    const ops = libraryOperations();
    const time = [...ops].filter(([k]) => k.startsWith('Swaml::Time::')).map(([, o]) => o);
    assert.deepEqual(time.map(signatureText), ['now() returns uint']);
    assert.equal(libraryIntrinsic(time[0]), 'now');
    assert.equal(isClockRead(time[0]), true);
});
test('WP3-M01 the packages are the versioned source libraries/swaml-2.3.swaml, a separate built-in document; intrinsic bodies are documentation only', () => {
    assert.equal(STANDARD_LIBRARY_2_3, read('libraries/swaml-2.3.swaml'));
    assert.equal(STANDARD_LIBRARY, read('libraries/swaml-2.0.swaml'));
    assert.deepEqual(library().map(d => d.uri.toString()), ['builtin:/swaml-2.0.swaml', 'builtin:/swaml-2.3.swaml']);
    const docs = library();
    assert.deepEqual((docs[1].parseResult.value as a.Model).packages.map(p => p.name), ['Swaml::Numeric', 'Swaml::Text', 'Swaml::Time']);
    for (const [name, intrinsic] of Object.entries(LIBRARY_INTRINSICS)) {
        const op = libraryOperations().get(name)!;
        assert.equal(libraryIntrinsic(op), intrinsic, name);
        assert.equal(op.body.statements.length + op.body.operations.length + op.body.states.length, 0, `${name} has no statements`);
        assert.match(op.body.documentation?.text ?? '', /Host intrinsic/u, `${name} documents its host semantics`);
    }
});
test('WP3-M01 the library documents validate without diagnostics, and a user operation named like an intrinsic is not one', async () => {
    const { shared, Swaml } = createSwamlServices(EmptyFileSystem);
    const { parseHelper } = await import('langium/test');
    const doc = await parseHelper<a.Model>(Swaml)(`package Test {
  package_placeholder
}`.replace('package_placeholder', 'operation def sqrt(v: real) returns real { return v; }'), { validation: true });
    for (const d of shared.workspace.LangiumDocuments.all)
        if (d.uri.scheme === 'builtin')
            assert.deepEqual(d.diagnostics ?? [], [], d.uri.toString());
    const own = (doc.parseResult.value.packages[0].elements[0]) as a.Operation;
    assert.equal(libraryIntrinsic(own), undefined);
    // A package of the same name in user source hides the library package (WP3-L04); its operations are the user's.
    const user = await parse('package Swaml::Time { operation def now() returns uint { return 7; } }');
    assert.deepEqual(user.errors.map(e => [e.code, e.message]), []);
    assert.equal(libraryIntrinsic(user.model.packages[0].elements[0]), undefined);
});
test('WP3-M01 the packages are imported explicitly; qualified names need no import', async () => {
    assert.deepEqual(await errors(`package Test {
  component def D { attribute r: real = 0.0; operation go() { r = sqrt(4.0); } }
  component Demo: D;
}`), [['SW2006', 'Unknown operation sqrt; remote calls require an owned port.']]);
    const r = await runStores(`package Test {
  component def D { attribute r: real = 0.0; attribute s: string = ""; attribute t: uint = 1;
    operation go() { wait 2ms; r = Swaml::Numeric::sqrt(16.0); s = Swaml::Text::intText(-7); t = Swaml::Time::now(); }
    schedule { on start go(); } }
  component Demo: D;
}`);
    assert.deepEqual(r.stores.Demo, { r: 4, s: '-7', t: 2000000 });
    // Importing one package does not import the others.
    assert.deepEqual(await errors(`package Test {
  import Swaml::Numeric;
  component def D { attribute s: string = ""; operation go() { s = intText(1); } }
  component Demo: D;
}`), [['SW2006', 'Unknown operation intText; remote calls require an owned port.']]);
});

test('WP3-M01 a run lists the 2.3 library document among its sources only when the model uses it', async () => {
    const builtins = (r: { sources: { uri: string }[] }) => r.sources.map(x => x.uri).filter(u => u.startsWith('builtin:'));
    const plain = await runStores(`package Test {
  import Swaml::Math;
  component def D { attribute r: real = 0.0; operation go() { r = abs(-1.0); } schedule { on start go(); } }
  component Demo: D;
}`);
    assert.deepEqual(builtins(plain), ['builtin:/swaml-2.0.swaml']);
    const imported = await runStores(wrap('attribute r: real = 0.0; operation go() { r = sqrt(4.0); } schedule { on start go(); }'));
    assert.deepEqual(builtins(imported), ['builtin:/swaml-2.0.swaml', 'builtin:/swaml-2.3.swaml']);
    const qualified = await runStores(`package Test {
  component def D { attribute t: uint = 1; operation go() { t = Swaml::Time::now(); } schedule { on start go(); } }
  component Demo: D;
}`);
    assert.deepEqual(builtins(qualified), ['builtin:/swaml-2.0.swaml', 'builtin:/swaml-2.3.swaml']);
    assert.deepEqual(qualified.stores.Demo, { t: 0 });
});

// ---------------------------------------------------------------- Swaml::Math unchanged, ambiguity

test('WP3-L04 Swaml::Math and Swaml::Platform are unchanged: the 2.2 library keeps its recorded bytes', () => {
    const recorded = JSON.parse(read('test/fixtures/compatibility-2-2/ast.json')).files['libraries/swaml-2.0.swaml'].sourceSha256;
    assert.equal(createHash('sha256').update(read('libraries/swaml-2.0.swaml'), 'utf8').digest('hex'), recorded);
    const ops = [...libraryOperations().keys()];
    assert.deepEqual(ops.filter(k => k.startsWith('Swaml::Math::')), ['abs', 'min', 'max', 'floor', 'round', 'trunc', 'length', 'concat'].map(n => 'Swaml::Math::' + n));
    assert.deepEqual(ops.filter(k => k.startsWith('Swaml::Platform::')), []);
});
test('WP3-L04 the door pattern: Swaml::Math with an own clampInt stays unambiguous; importing Swaml::Numeric next to it follows the ambiguity rule', async () => {
    const door = (imports: string) => `package Types { operation def clampInt(v: int, low: int, high: int) returns int { if (v < low) { return low; } if (v > high) { return high; } return v; } }
package Test {
  ${imports}
  component def D { attribute k: int = 0; operation go() { k = clampInt(12, 0, 10); } schedule { on start go(); } }
  component Demo: D;
}`;
    assert.deepEqual((await runStores(door('import Swaml::Math; import Types;'))).stores.Demo, { k: 10 });
    // A short call name that two visible packages declare does not resolve, exactly as for two user packages.
    // With a 2.3 library operation among them, the SW2001 ambiguity message names both (never in a 2.2 source).
    const ambiguous = await parse(door('import Swaml::Math; import Types; import Swaml::Numeric;'));
    assert.deepEqual(ambiguous.errors.map(e => [e.code, e.message]), [['SW2001', 'Ambiguous name clampInt: it names operation Swaml::Numeric::clampInt (imported) and operation Types::clampInt (imported). A short name must name one visible declaration; qualify the reference (Swaml::Numeric::clampInt or Types::clampInt) or rename one declaration.']]);
    assert.deepEqual(ambiguous.errors[0].relatedInformation?.map(r => [r.location.uri, r.message]), [['builtin:/swaml-2.3.swaml', 'Declaration Swaml::Numeric::clampInt'], ['file:///0.swaml'.replace('0', String(ambiguous.doc.uri.path.slice(1, -6))), 'Declaration Types::clampInt']]);
    // Two user packages keep the 2.2 message.
    // Own package against the library.
    assert.deepEqual(await errors(`package Test {
  import Swaml::Time;
  operation def now() returns uint { return 1; }
  component def D { attribute t: uint = 0; operation go() { t = now(); } }
  component Demo: D;
}`), [['SW2001', 'Ambiguous name now: it names operation Swaml::Time::now (imported) and operation Test::now. A short name must name one visible declaration; qualify the reference (Swaml::Time::now or Test::now) or rename one declaration.']]);
    // A component's own operation is found first, as in 2.2: no ambiguity.
    await valid(`package Test {
  import Swaml::Time;
  component def D { attribute t: uint = 0; operation now() returns uint { return 1; } operation go() { t = now(); } }
  component Demo: D;
}`);
    assert.deepEqual(await errors(door('import Types; import Other;').replace('package Test', 'package Other { operation def clampInt(v: int, low: int, high: int) returns int { return v; } }\npackage Test')), [['SW2006', 'Unknown operation clampInt; remote calls require an owned port.']]);
    // A qualified call resolves either one.
    assert.deepEqual((await runStores(door('import Swaml::Numeric; import Types;').replace('k = clampInt(12, 0, 10);', 'k = Swaml::Numeric::clampInt(12, 0, 10) + Types::clampInt(-3, 0, 10);'))).stores.Demo, { k: 10 });
    // A reference follows the SW2001 ambiguity rule: categories do not disambiguate a short name.
    const r = await parse(`package Test {
  import Swaml::Time;
  component def now { }
  component c: now;
}`);
    assert.deepEqual(r.errors.map(e => [e.code, e.message]), [['SW2001', 'Ambiguous name now: it names component def Test::now and operation Swaml::Time::now (imported). A short name must name one visible declaration; qualify the reference (Test::now) or rename one declaration.']]);
});
test('WP3-L04 a workspace that declares a package named like a 2.3 library package uses its own; the library package is hidden there', async () => {
    const r = await runStores(`package Swaml::Numeric {
  operation def sqrt(v: real) returns real { return v / 2.0; }
}
package Test {
  import Swaml::Numeric;
  import Swaml::Text;
  component def D { attribute r: real = 0.0; attribute q: real = 0.0; attribute s: string = "";
    operation go() { r = sqrt(8.0); q = Swaml::Numeric::sqrt(2.0); s = intText(-3); }
    schedule { on start go(); } }
  component Demo: D;
}`);
    // The own sqrt halves; Swaml::Text is still the library's.
    assert.deepEqual(r.stores.Demo, { r: 4, q: 1, s: '-3' });
    assert.deepEqual(r.sources.map(x => x.uri).filter(u => u.startsWith('builtin:')), ['builtin:/swaml-2.0.swaml', 'builtin:/swaml-2.3.swaml']);
    // Library names of a hidden package are not available: minInt is not in the own Swaml::Numeric.
    assert.deepEqual(await errors(`package Swaml::Numeric { }
package Test { import Swaml::Numeric; component def D { attribute k: int = 0; operation go() { k = minInt(1, 2); } } component Demo: D; }`), [['SW2006', 'Unknown operation minInt; remote calls require an owned port.']]);
    // An own operation named like an intrinsic is the user's: an empty body is a return-path error as in 2.2.
    assert.deepEqual(await errors('package Swaml::Text { operation def intText(v: int) returns string { } }'), [['SW2006', 'A non-void operation must return or fail on every path.']]);
    // The hiding follows the workspace: another file declaring the package hides it for every file, and
    // removing that file brings the library back.
    const two = await workspace(['package Swaml::Time { operation def now() returns uint { return 7; } }', `package App {
  import Swaml::Time;
  component def D { attribute t: uint = 0; operation go() { t = now(); } schedule { on start go(); } }
  component Demo: D;
}`]);
    assert.deepEqual(two.docs.map(d => (d.diagnostics ?? []).map(x => x.message)), [[], []]);
    assert.deepEqual(simulate(two.docs.map(d => d.parseResult.value as a.Model), 'App::Demo', { untilNs: 1000 }).stores.Demo, { t: 7 });
    two.shared.workspace.LangiumDocuments.deleteDocument(two.docs[0].uri);
    await two.shared.workspace.DocumentBuilder.update([], [two.docs[0].uri]);
    assert.deepEqual((two.docs[1].diagnostics ?? []).map(x => x.message), []);
    assert.deepEqual(simulate([two.docs[1].parseResult.value as a.Model], 'App::Demo', { untilNs: 1000 }).stores.Demo, { t: 0 });
});
test('WP3-M01 a byte-equal copy of a library document is a duplicate, hides nothing and needs no return paths for its intrinsics', async () => {
    const copy = await parse(read('libraries/swaml-2.3.swaml'));
    assert.deepEqual(copy.errors.map(e => [e.code, e.message]), [['SW2001', 'Duplicate package Swaml::Numeric.'], ['SW2001', 'Duplicate package Swaml::Text.'], ['SW2001', 'Duplicate package Swaml::Time.']]);
    const copy20 = await parse(read('libraries/swaml-2.0.swaml'));
    assert.ok(copy20.errors.every(e => e.code === 'SW2001' && String(e.message).startsWith('Duplicate package')), JSON.stringify(copy20.errors.map(e => e.message)));
    const changed = await parse(read('libraries/swaml-2.3.swaml') + '\n');
    assert.deepEqual(changed.errors.map(e => e.code), ['SW2006', 'SW2006', 'SW2006', 'SW2006'], 'a changed copy is user source that hides the library');
});

test('WP3-L04 no corpus model becomes ambiguous or names a 2.3 library package', async () => {
    const files = [...readdirSync(new URL('examples/', root)).filter(f => f.endsWith('.swaml')).map(f => 'examples/' + f), ...readdirSync(new URL('examples/showcase/', root)).filter(f => f.endsWith('.swaml')).map(f => 'examples/showcase/' + f)];
    assert.ok(files.length >= 40);
    for (const file of files) {
        const text = read(file);
        const r = await parse(text);
        for (const d of r.doc.diagnostics ?? [])
            assert.doesNotMatch(String(d.message), /Swaml::(Numeric|Text|Time)|Ambiguous name/u, `${file}: ${String(d.message)}`);
        if (!/examples\/3[89]-|examples\/40-/u.test(file))
            assert.doesNotMatch(text, /import Swaml::(Numeric|Text|Time);/u, file);
    }
});

// ---------------------------------------------------------------- sqrt

/** The exact value of a finite non-negative double as [mantissa, exponent] with value = mantissa * 2^exponent. */
const exact = (x: number): [bigint, number] => {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, x);
    const bits = view.getBigUint64(0), e = Number((bits >> 52n) & 0x7ffn), f = bits & ((1n << 52n) - 1n);
    return e === 0 ? [f, -1074] : [f | (1n << 52n), e - 1075];
};
const nextUp = (x: number) => { const v = new DataView(new ArrayBuffer(8)); v.setFloat64(0, x); v.setBigUint64(0, v.getBigUint64(0) + 1n); return v.getFloat64(0); };
const nextDown = (x: number) => { const v = new DataView(new ArrayBuffer(8)); v.setFloat64(0, x); v.setBigUint64(0, v.getBigUint64(0) - 1n); return v.getFloat64(0); };
/** Compares the exact rationals m1*2^e1 and m2*2^e2. */
const compareExact = ([m1, e1]: [bigint, number], [m2, e2]: [bigint, number]) => { const e = Math.min(e1, e2), x = m1 << BigInt(e1 - e), y = m2 << BigInt(e2 - e); return x < y ? -1 : x > y ? 1 : 0; };
/** r is the correctly rounded square root of v: (r - ulp/2)^2 <= v <= (r + ulp/2)^2, with ties to even, in exact arithmetic. */
const correctlyRounded = (v: number, r: number) => {
    if (v === 0)
        return r === 0;
    const square = ([m, e]: [bigint, number]): [bigint, number] => [m * m, 2 * e];
    const mid = (x: number, y: number): [bigint, number] => { const [mx, ex] = exact(x), [my, ey] = exact(y), e = Math.min(ex, ey); return [(mx << BigInt(ex - e)) + (my << BigInt(ey - e)), e - 1]; };
    const low = square(mid(nextDown(r), r)), high = square(mid(r, nextUp(r))), value = exact(v);
    const lo = compareExact(low, value), hi = compareExact(value, high);
    if (lo < 0 && hi < 0)
        return true;
    // A tie: only the neighbour with an even mantissa is correctly rounded.
    return (lo === 0 || hi === 0) && (exact(r)[0] & 1n) === 0n;
};
/** A deterministic generator, so the tested values are the same on every host. */
const random = (seed: number) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
test('WP3-R01 sqrt is IEEE-754 correctly rounded: subnormals, huge values, perfect squares and generated values, checked in exact arithmetic', () => {
    const values = [0, 5e-324, 1e-323, 2.225073858507201e-308, 2.2250738585072014e-308, 1e-300, 0.5, 1, 2, 3, 4, 144, 1e16, 2 ** 1000, 2 ** 1023 * 1.5, 1.7976931348623157e308, 9007199254740991, 9007199254740993, 0.1, 1 / 3];
    const next = random(20261118);
    for (let i = 0; i < 2000; i++)
        values.push(next() * 10 ** Math.floor(next() * 600 - 300), Math.floor(next() * 2 ** 53));
    for (const v of values) {
        const r = squareRoot(v);
        assert.ok(correctlyRounded(v, r), `sqrt(${v}) = ${r}`);
    }
    for (const n of [0, 1, 2, 3, 12, 1000, 94906265, 2 ** 26, 2 ** 500])
        assert.equal(squareRoot(n * n), n, `perfect square ${n}^2`);
    assert.equal(squareRoot(2), 1.4142135623730951);
    assert.equal(squareRoot(5e-324), 2.2227587494850775e-162);
    assert.equal(squareRoot(1.7976931348623157e308), 1.3407807929942596e154);
    assert.ok(Object.is(squareRoot(-0), -0), 'IEEE sqrt(-0) is -0; the run stores it as 0');
});
test('WP3-R01 sqrt below zero is the runtime failure Arithmetic, catchable by try; -0.0 is not below zero', async () => {
    assert.throws(() => squareRoot(-5e-324), (e: unknown) => e instanceof RuntimeFault && e.code === 'Arithmetic');
    const r = await runStores(wrap(`attribute r: real[4] = [0.0, 0.0, 0.0, 0.0];
      operation go() { r[0] = sqrt(-0.0); r[1] = try(sqrt(-1.0), -2.0); r[2] = sqrt(2.0); r[3] = sqrt(1.0 / 1048576.0 / 1048576.0); }
      schedule { on start go(); }`));
    assert.deepEqual(r.stores.Demo, { r: [0, -2, 1.4142135623730951, 9.5367431640625e-7] });
    assert.ok(!Object.is(r.stores.Demo.r[0], -0), 'the stored value of sqrt(-0.0) has no sign');
    const caught = r.trace.find(t => t.kind === 'caught');
    assert.equal(caught?.reason, 'Arithmetic');
    const failed = await runStores(wrap(`attribute r: real = 1.0; operation go() { r = sqrt(r - 2.0); } schedule { on start go(); }`));
    const failure = failed.trace.find(t => t.kind === 'failure');
    assert.deepEqual([failure?.reason, failure?.message, failed.stores.Demo.r], ['Arithmetic', 'Square root of a negative number', 1]);
});
test('WP3-R01 a real value is always finite, so sqrt never sees or returns NaN or an infinity', async () => {
    // Overflow to an infinity is a Bounds failure before sqrt is reached.
    const r = await runStores(wrap(`attribute r: real = 1.0; operation go() { var big: real = 1.0; for (var i: int = 0; i < 1100; i = i + 1) { big = big * 2.0; } r = sqrt(big); } schedule { on start go(); }`));
    assert.equal(r.trace.find(t => t.kind === 'failure')?.reason, 'Bounds');
    assert.equal(r.stores.Demo.r, 1);
});

// ---------------------------------------------------------------- intText and realText

/**
 * An independent reference for realText: the full decimal expansion of the double (every binary64 value is a
 * finite decimal, m * 5^k / 10^k), rounded on its digit string, half away from zero. It shares nothing with the
 * implementation but the bit decomposition and never uses toFixed.
 */
const referenceRealText = (v: number, decimals: number): string => {
    const [m, e] = exact(Math.abs(v));
    let digits: string, point: number;
    if (e >= 0) {
        digits = (m << BigInt(e)).toString();
        point = digits.length;
    }
    else {
        digits = (m * 5n ** BigInt(-e)).toString().padStart(-e + 1, '0');
        point = digits.length + e;
    }
    let whole = digits.slice(0, point), fraction = digits.slice(point).padEnd(decimals + 1, '0');
    const roundUp = fraction[decimals] >= '5';
    let kept = whole + fraction.slice(0, decimals);
    if (roundUp) {
        const chars = kept.split('');
        let i = chars.length - 1;
        while (i >= 0 && chars[i] === '9')
            chars[i--] = '0';
        if (i < 0)
            chars.unshift('1');
        else
            chars[i] = String(Number(chars[i]) + 1);
        kept = chars.join('');
    }
    whole = kept.slice(0, kept.length - decimals).replace(/^0+(?=\d)/u, '') || '0';
    fraction = kept.slice(kept.length - decimals);
    const text = decimals ? `${whole}.${fraction}` : whole;
    return v < 0 && /[1-9]/u.test(text) ? '-' + text : text;
};
test('WP3-R02 intText writes decimal digits, - for negatives, no leading zeros, through the safe-integer edges', () => {
    const table: [number, string][] = [[0, '0'], [-0, '0'], [7, '7'], [-42, '-42'], [10, '10'], [-1000000, '-1000000'], [9007199254740991, '9007199254740991'], [-9007199254740991, '-9007199254740991'], [123456789012345, '123456789012345']];
    for (const [v, text] of table)
        assert.equal(intText(v), text, String(v));
});
test('WP3-R02 realText: hand-checked ties, signs, zeros, large magnitudes, the 1e21 bound and maximum decimals', () => {
    const table: [number, number, string][] = [
        [2.5, 0, '3'], [-2.5, 0, '-3'], [0.5, 0, '1'], [-0.5, 0, '-1'], [1.5, 0, '2'], [-1.5, 0, '-2'], [-0.4, 0, '0'],
        [-0.0001, 2, '0.00'], [0, 2, '0.00'], [-0, 3, '0.000'], [0, 0, '0'], [-0, 0, '0'], [5e-324, 15, '0.000000000000000'], [-5e-324, 0, '0'],
        // 0.125 and 0.375 are exact binary ties; 1.005 is 1.00499999999999989… in binary64, below the tie.
        [0.125, 2, '0.13'], [-0.125, 2, '-0.13'], [0.375, 2, '0.38'], [1.005, 2, '1.00'], [2.675, 2, '2.67'], [-2.675, 2, '-2.67'],
        [0.1, 15, '0.100000000000000'], [0.1, 1, '0.1'], [1 / 3, 15, '0.333333333333333'], [2 / 3, 15, '0.666666666666667'],
        [123.456, 1, '123.5'], [-123.456, 2, '-123.46'], [99.995, 2, '100.00'], [-9.96, 1, '-10.0'], [0.05, 1, '0.1'], [-0.05, 1, '-0.1'],
        [1e20, 0, '100000000000000000000'], [-1e20, 3, '-100000000000000000000.000'],
        [999999999999999868928, 0, '999999999999999868928'], [999999999999999868928, 2, '999999999999999868928.00'], [-999999999999999868928, 1, '-999999999999999868928.0'],
        [9007199254740993, 0, '9007199254740992'], [9007199254740991, 15, '9007199254740991.000000000000000'], [1e15 + 0.5, 0, '1000000000000001'],
        [4503599627370495.5, 0, '4503599627370496'], [-4503599627370495.5, 0, '-4503599627370496'], [1234.5678, 15, '1234.567800000000034'],
    ];
    for (const [v, decimals, text] of table) {
        assert.equal(realText(v, decimals), text, `realText(${v}, ${decimals})`);
        assert.equal(referenceRealText(v, decimals), text, `reference(${v}, ${decimals})`);
    }
    // Where toFixed alone differs: a signed zero, and exponent notation from 1e21.
    assert.equal((-0.0001).toFixed(2), '-0.00');
    assert.equal(realText(-0.0001, 2), '0.00');
    for (const [v, decimals] of [[1e21, 0], [-1e21, 2], [1.7976931348623157e308, 0], [0.5, 16], [0.5, 100], [Infinity, 0], [NaN, 0]] as [number, number][])
        assert.throws(() => realText(v, decimals), (e: unknown) => e instanceof RuntimeFault && e.code === 'Bounds', `realText(${v}, ${decimals})`);
    assert.equal(REAL_TEXT_MAX_DECIMALS, 15);
    assert.equal(REAL_TEXT_LIMIT, 1e21);
});
test('WP3-R02 realText agrees with an independent big-decimal reference on generated values of every magnitude and every decimals', () => {
    const next = random(42);
    for (let i = 0; i < 4000; i++) {
        const magnitude = Math.floor(next() * 45) - 24, sign = next() < 0.5 ? -1 : 1;
        let v = sign * next() * 10 ** magnitude;
        // Every fourth value is a tie at some decimal position.
        if (i % 4 === 0) {
            const d = Math.floor(next() * 6);
            v = sign * (Math.floor(next() * 10 ** (d + 3)) + 0.5) / 10 ** d;
        }
        if (Math.abs(v) >= 1e21)
            continue;
        const decimals = Math.floor(next() * 16);
        assert.equal(realText(v, decimals), referenceRealText(v, decimals), `realText(${v}, ${decimals})`);
    }
});
test('WP3-R02 intText and realText in a run: uint and byte arguments, failures Bounds with their messages', async () => {
    const r = await runStores(wrap(`attribute s: string[8] = ["", "", "", "", "", "", "", ""]; attribute b: byte = 255; attribute u: uint = 9007199254740991;
      operation go() { s[0] = intText(b); s[1] = intText(u); s[2] = intText(0 - u); s[3] = realText(-2.5, 0); s[4] = realText(-0.0001, 2); s[5] = realText(2.0, b - 250);
        s[6] = try(realText(1.0, 16), "decimals"); s[7] = intText(round(-2.5)) + "/" + realText(-2.5, 0); }
      schedule { on start go(); }`));
    // Swaml::Math::round ties toward positive infinity; realText ties away from zero.
    assert.deepEqual(r.stores.Demo.s, ['255', '9007199254740991', '-9007199254740991', '-3', '0.00', '2.00000', 'decimals', '-2/-3']);
    const big = await runStores(wrap(`attribute s: string = "x"; operation go() { var v: real = 1000000000000.0; s = realText(v * v * 1000.0, 0); } schedule { on start go(); }`));
    const failure = big.trace.find(t => t.kind === 'failure');
    assert.deepEqual([failure?.reason, failure?.message, big.stores.Demo.s], ['Bounds', 'realText needs an absolute value below 1e21', 'x']);
    const decimals = await runStores(wrap(`attribute s: string = "x"; attribute d: uint = 16; operation go() { s = realText(1.0, d); } schedule { on start go(); }`));
    assert.deepEqual(decimals.trace.filter(t => t.kind === 'failure').map(t => [t.reason, t.message]), [['Bounds', 'realText writes at most 15 decimals']]);
});

// ---------------------------------------------------------------- now()

test('WP3-R03 now() is the logical time of the evaluating step: at start, after waits and in periodic activations', async () => {
    const r = await runStores(wrap(`attribute t: uint[4] = [9, 9, 9, 9]; attribute ticks: uint[3] = [0, 0, 0]; attribute n: uint = 0;
      operation go() { t[0] = now(); wait 1500us; t[1] = now(); wait 2ms; t[2] = now(); t[3] = now() - t[0]; }
      operation tick() { if (n < 3) { ticks[n] = now(); n = n + 1; } }
      schedule { on start go(); on every 4ms tick(); }`), { untilNs: 20000000 });
    assert.deepEqual(r.stores.Demo, { t: [0, 1500000, 3500000, 3500000], ticks: [4000000, 8000000, 12000000], n: 3 });
});
test('WP3-R03 now() inside handlers after latency and fault delays reads the delivery step', async () => {
    const source = `package Test {
  import Swaml::Time;
  import Swaml::Qos;
  port def P { provides event e(sent: uint); }
  component def Tx { port p: P; operation go() { wait 1ms; publish p.e(now()); } schedule { on start go(); } }
  component def Rx { reversed port p: P; attribute sent: uint = 0; attribute got: uint = 0;
    operation h(v: uint) { sent = v; got = now(); } schedule { on receive p.e(v) h(v); } }
  component tx: Tx;
  component rx: Rx;
  connect : Reliable (tx.p, rx.p);
}`;
    const plain = await runStores(source, {}, 'Test');
    assert.deepEqual(plain.stores.rx, { sent: 1000000, got: 1000000 });
    const late = await runStores(source, { latencyNs: 250000 }, 'Test');
    assert.deepEqual(late.stores.rx, { sent: 1000000, got: 1250000 });
    const retried = await runStores(source, { latencyNs: 250000, faults: [{ offer: 1, kind: 'drop', delayNs: 600000 }] }, 'Test');
    assert.deepEqual(retried.stores.rx, { sent: 1000000, got: 1850000 });
});
test('WP3-R03 a concurrent activation reads live time, not its dispatch snapshot', async () => {
    const source = `package Test {
  import Swaml::Time;
  port def P { provides event e(dispatched: uint, before: uint, later: uint, seen: uint); }
  component def Sampler { port p: P; attribute level: uint = 0;
    operation bump() { level = level + 1; }
    operation sample() { var before: uint = now(); var seen: uint = level; wait 3ms; publish p.e(before, before, now(), level); }
    schedule { on every 4ms sample() concurrent; on every 1ms bump(); } }
  component def Log { reversed port p: P; attribute befores: uint[2] = [0, 0]; attribute afters: uint[2] = [0, 0]; attribute levels: uint[2] = [0, 0]; attribute n: uint = 0;
    operation h(d: uint, b: uint, x: uint, s: uint) { if (n < 2) { befores[n] = b; afters[n] = x; levels[n] = s; n = n + 1; } }
    schedule { on receive p.e(d, b, x, s) h(d, b, x, s); } }
  component sampler: Sampler;
  component log: Log;
  connect (sampler.p, log.p);
}`;
    const r = await runStores(source, { untilNs: 13000000 }, 'Test');
    // Activations released at 4 ms and 8 ms wait 3 ms each. Each reads now() live after its wait, while its
    // attribute reads keep the dispatch snapshot: level is 3 and 7 (dispatch), not 7 and 11 (live).
    assert.deepEqual(r.stores.log.befores, [4000000, 8000000]);
    assert.deepEqual(r.stores.log.afters, [7000000, 11000000]);
    assert.deepEqual(r.stores.log.levels, [3, 7]);
});
test('WP3-R03 now() in case scripts and tests: the script reads the run clock', async () => {
    const r = await valid(`package Test {
  import Swaml::Time;
  component def D { attribute stamp: uint = 0; operation mark() { stamp = now(); } operation stamped() returns uint { return stamp; } }
  component demo: D;
  test 'Clock in a test' of demo {
    var t0: uint = now();
    wait 3ms;
    demo.mark();
    assert t0 == 0 and now() == 3000000 and demo.stamp == 3000000;
  }
  use case 'Clock in a use case' of demo {
    wait 1ms;
    demo.mark();
    var s: uint = demo.stamped();
    assert now() - s == 0 and now() == 1000000;
  }
}`);
    for (const name of ['Test::Clock in a test', 'Test::Clock in a use case'])
        assert.equal(runCase([r.model], name, { untilNs: 100000000 }).result, 'pass', name);
});

// ---------------------------------------------------------------- now(): effect, placement, stale reads

test('WP3-S01 now() reads state: an operation calling it has the reads effect and nothing more', async () => {
    const r = await valid(wrap(`attribute t: uint = 0; operation stamp() returns uint { return now(); } operation pure() returns uint { return 1; }`));
    const ops = AstUtils.streamAllContents(r.model).filter(a.isOperation).toArray();
    const d = r.model.packages[0].elements.find(a.isComponentDef)!;
    assert.deepEqual(effects(ops.find(o => o.name === 'stamp')!, d), { reads: true, writes: false, communicates: false, suspends: false });
    assert.deepEqual(effects(ops.find(o => o.name === 'pure')!, d), { reads: false, writes: false, communicates: false, suspends: false });
    const clock = libraryOperations().get('Swaml::Time::now')!;
    assert.deepEqual(effects(clock), { reads: true, writes: false, communicates: false, suspends: false });
    assert.equal(signature(clock), clock);
});
test('WP3-S01 WP3-D01 now() is rejected in attribute and member initializers with the purity message naming now() (SW2006)', async () => {
    assert.deepEqual(await errors(wrap('attribute t: uint = now();')), [['SW2006', 'Initializer of t must be pure; now() reads state.']]);
    assert.deepEqual(await errors(wrap('const attribute t0: uint = 5 + now() * 2;')), [['SW2006', 'Initializer of t0 must be pure; now() reads state.']]);
    assert.deepEqual(await errors(wrap(`attribute 'start time': uint = Swaml::Time::now();`)), [['SW2006', `Initializer of 'start time' must be pure; now() reads state.`]]);
    // A 2.2 spelling: a contextual word is quoted in messages (MESSAGE_SPELLING).
    assert.deepEqual(await errors(wrap(`attribute 'state': uint = now();`)), [['SW2006', `Initializer of 'state' must be pure; now() reads state.`]]);
    assert.deepEqual(await errors(wrap('', 'requirement R { attribute limit: uint = now(); }')), [['SW2006', 'Initializer of limit must be pure; now() reads state.']]);
    assert.deepEqual(await errors(`package Test {
  import Swaml::Time;
  component def D { attribute t: uint = 0; }
  component Demo: D { redefines attribute t: uint = now(); }
}`), [['SW2006', 'Initializer of t must be pure; now() reads state.']]);
    // Through a helper, the existing message (the helper reads state).
    assert.deepEqual(await errors(wrap('attribute t: uint = stamp(); operation stamp() returns uint { return now(); }')), [['SW2006', 'Attribute initializers must be pure.']]);
    // Other library operations are pure and allowed in initializers.
    await valid(wrap('attribute r: real = sqrt(2.0); attribute s: string = realText(2.5, 0); attribute k: int = clampInt(9, 0, 5); attribute b: string = boolText(true);'));
});
test('WP3-S01 now() makes a package operation def read state, which package definitions may not (SW2006)', async () => {
    assert.deepEqual(await errors(`package Test {
  import Swaml::Time;
  operation def age(since: uint) returns int { return now() - since; }
}`), [['SW2006', 'Package definitions may use only parameters and nested operations.']]);
});
test('WP3-S01 now() is allowed in every other expression: statements, receive and state guards, schedule arguments, concurrent entries, scripts', async () => {
    await valid(`package Test {
  import Swaml::Time;
  port def P { provides event e(v: uint); }
  component def D {
    reversed port p: P;
    reversed port q: P;
    attribute last: uint = 0;
    operation h(v: uint) { last = now() + v; }
    operation watch() { var t: uint = now(); }
    operation arg(v: uint) { }
    operation machine() {
      initial Idle;
      state Idle { on receive q.e(v) when (now() >= v) to Done { last = now(); } }
      final state Done { }
    }
    schedule { on receive p.e(v) h(v); on every 1ms watch() concurrent; on every 2ms arg(now()); on start machine(); }
  }
  component def Env { port p: P; port q: P; operation go() { publish p.e(now()); publish q.e(now()); } schedule { on start go(); } }
  component env: Env;
  component demo: D;
  connect (env.p, demo.p);
  connect (env.q, demo.q);
  test 'T' of demo { assert now() >= 0; }
}`);
});
nodeTest.todo('WP3-S01 hook for WP5-S03: now() in a completion guard is rejected (SW2008); completion guards arrive with WP5, which checks isClockRead');
nodeTest.todo('WP3-S01 hook for WP4-S05: now() is not in the constant sublanguage (SW2007); computed periods and deadlines arrive with WP4, which checks isClockRead');
test('WP3-S02 SW2011 never reports a value obtained from now(), directly, through a helper or in a condition', async () => {
    const component = (op: string) => wrap(`attribute clock: uint = 0; attribute last: uint = 0; attribute flag: bool = false;
      operation stamp() returns uint { return now(); }
      operation tick() { clock = clock + 1; }
      operation go() { ${op} }
      schedule { on start go(); on every 500us tick(); }`);
    assert.deepEqual(await warnings(component('var t: uint = now(); wait 1ms; last = t;')), []);
    assert.deepEqual(await warnings(component('var t: uint = stamp(); wait 1ms; last = t + 1;')), []);
    assert.deepEqual(await warnings(component('var t: uint = now(); if (t > 5) { wait 1ms; flag = true; }')), []);
    assert.deepEqual(await warnings(component('var t: uint = now() + 3; wait 1ms; last = now() - t;')), []);
    // An attribute read before the suspension is still stale, next to now().
    assert.deepEqual(await warnings(component('var t: uint = now() + clock; wait 1ms; last = t;')), [['SW2011', 'A read before suspension may influence this write. Recheck live attributes after resuming.']]);
    assert.deepEqual(await warnings(component('var t: uint = clock; wait 1ms; last = t;')), [['SW2011', 'A read before suspension may influence this write. Recheck live attributes after resuming.']]);
});
test('WP3-S02 a 2.2 operation named now that reads state keeps its stale-read warning and initializer message', async () => {
    assert.deepEqual(await warnings(`package Test {
  component def D { attribute clock: uint = 0; attribute last: uint = 0;
    operation now() returns uint { return clock; }
    operation go() { var t: uint = now(); wait 1ms; last = t; }
    schedule { on start go(); } }
  component Demo: D;
}`), [['SW2011', 'A read before suspension may influence this write. Recheck live attributes after resuming.']]);
    assert.deepEqual(await errors(`package Test {
  component def D { attribute base: uint = 3; attribute t: uint = now(); operation now() returns uint { return base; } }
  component Demo: D;
}`), [['SW2006', 'Attribute initializers must be pure.']]);
});
test('WP3-L01 WP3-L02 WP3-L03 operation usages of the library definitions inherit the intrinsic unless they replace the body', async () => {
    const r = await runStores(wrap(`attribute r: real[2] = [0.0, 0.0]; attribute t: uint = 1;
      operation root: sqrt;
      operation fixed: sqrt { return 1.0; }
      operation clock: now;
      operation go() { wait 1ms; r[0] = root(9.0); r[1] = fixed(9.0); t = clock(); }
      schedule { on start go(); }`));
    assert.deepEqual(r.stores.Demo, { r: [3, 1], t: 1000000 });
    await invalid(wrap('attribute t: uint = clock(); operation clock: now;'), 'SW2006');
});
test('WP3 invalid arguments are type errors (SW2002)', async () => {
    for (const call of ['sqrt("x")', 'intText(1.5)', 'realText(1.0, true)', 'boolText(1)', 'now(1)'])
        await invalid(wrap(`attribute x: string = ""; operation go() { var v: string = "" + "x"; ${call}; }`), undefined);
    assert.deepEqual(await errors(wrap('attribute s: string = ""; operation go() { s = intText(2.5); }')), [['SW2002', 'Expected int, received real.']]);
});
