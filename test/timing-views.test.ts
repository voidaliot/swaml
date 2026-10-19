import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices, selectView, SWAML_LANGUAGE_VERSION } from '../src/language/swaml-module.js';
import * as a from '../src/language/generated/ast.js';

async function parse(body: string) {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const document = await parseHelper<a.Model>(Swaml)(`package Timing { ${body} }`, { validation: true });
    assert.ok(!document.diagnostics?.some(d => /error occurred during validation/.test(String(d.message))), JSON.stringify(document.diagnostics));
    return document;
}
const structure = `
    component def Worker {
        var count: int = 0;
        function run() on start { count = count + 1; }
        function helper(): int { return count; }
    }
    component Demo {
        component first: Worker;
        component second: Worker;
    }
`;

test('tv accepts a compact function occurrence and a definition function without timing or a trigger', async () => {
    const document = await parse(`${structure} view observed tv of Demo.first.run; view helperContract tv of Worker.helper doc /* No timing evidence is asserted. */;`);
    assert.deepEqual(document.diagnostics, []);
    const views = document.parseResult.value.packages[0].elements.filter(a.isView);
    assert.deepEqual(views.map(view => [view.kind, selectView(view).map(selection => selection.path)]), [['tv', ['Demo.first.run']], ['tv', ['Worker.helper']]]);
    assert.equal(SWAML_LANGUAGE_VERSION, '1.4', 'The view uses the explicitly selected host edition without adding execution semantics.');
});

test('tv preserves repeated-definition occurrence identities and deduplicates qualified aliases in a stable union', async () => {
    const document = await parse(`${structure}
        view timeline tv {
            include Demo recursive where kind == "function" and name == "run";
            include Timing.Demo.first.run;
            include Worker.run;
            include Demo.second.run;
        }
    `);
    assert.deepEqual(document.diagnostics, []);
    const selections = selectView(document.parseResult.value.packages[0].elements.find(a.isView)!);
    assert.deepEqual(selections.map(selection => selection.path), ['Demo.first.run', 'Demo.second.run', 'Worker.run']);
    assert.equal(selections[0].node, selections[1].node, 'Reused declarations retain distinct occurrence paths.');
    assert.ok(selections.every(selection => a.isFunctionDef(selection.node)));
});

test('tv expands inherited effective functions only when explicitly requested and filtered', async () => {
    const document = await parse(`
        component def Base { function run() on start {} }
        component def Worker specializes Base { redefines function run() on start { assert true; } }
        component Demo: Worker;
        view timeline tv { include Demo recursive where kind == "function"; include Worker recursive where kind == "function"; }
    `);
    assert.deepEqual(document.diagnostics, []);
    const views = document.parseResult.value.packages[0].elements.filter(a.isView);
    const selections = selectView(views[0]);
    assert.deepEqual(selections.map(selection => selection.path), ['Demo.run', 'Worker.run']);
    assert.ok(selections.every(selection => a.isFunctionDef(selection.node) && selection.node.redefines));
});

test('tv accepts stateful functions while fv remains available for their state and flow presentation', async () => {
    const document = await parse(`component Demo {
        function lifecycle() on start { initial Idle; state Idle {} }
        function run() on start { assert true; }
    }
    view states fv of Demo.lifecycle;
    view flow fv of Demo.run;
    view timeline tv { include Demo recursive where kind == "function"; }`);
    assert.deepEqual(document.diagnostics, []);
    const views = document.parseResult.value.packages[0].elements.filter(a.isView);
    assert.deepEqual(views.map(view => view.kind), ['fv', 'fv', 'tv']);
    assert.deepEqual(selectView(views[2]).map(selection => selection.path), ['Demo.lifecycle', 'Demo.run']);
});

test('tv filters remain pure selections and may intentionally produce no lanes', async () => {
    const document = await parse(`${structure}
        view empty tv { include Demo recursive where kind == "function" and name == "absent"; }
        view selected tv { include Timing recursive where kind == "function" and not (path == "Demo.second.run") and name != "helper"; }
        view contextFiltered tv { include Demo where false; }
    `);
    assert.deepEqual(document.diagnostics, []);
    const views = document.parseResult.value.packages[0].elements.filter(a.isView);
    assert.deepEqual(selectView(views[0]), []);
    assert.deepEqual(selectView(views[2]), [], 'A filtered-out component context needs no recursive expansion.');
    assert.deepEqual(selectView(views[1]).map(selection => selection.path), ['Worker.run', 'Demo.first.run']);
});

test('the canonical timing view selects the exact four concrete functions and keeps reused lanes distinct', async () => {
    const { Swaml } = createSwamlServices(EmptyFileSystem);
    const source = await readFile(new URL('../../examples/17-function-timing.swaml', import.meta.url), 'utf8');
    const document = await parseHelper<a.Model>(Swaml)(source, { validation: true });
    assert.deepEqual(document.diagnostics, []);
    const view = document.parseResult.value.packages[0].elements.find(a.isView)!;
    assert.equal(view.kind, 'tv');
    const selections = selectView(view);
    assert.deepEqual(selections.map(selection => selection.path), ['Demo.first.poll', 'Demo.second.poll', 'Demo.firstServer.checkHealth', 'Demo.secondServer.checkHealth']);
    assert.equal(selections[0].node, selections[1].node);
    assert.equal(selections[2].node, selections[3].node);
});

for (const [title, source, code] of [
    ['compact root context', `${structure} view invalid tv of Demo;`, 'SW080'],
    ['compact definition context', `${structure} view invalid tv of Worker;`, 'SW080'],
    ['unfiltered recursive context', `${structure} view invalid tv { include Demo recursive; }`, 'SW080'],
    ['component in a selected union', `${structure} view invalid tv { include Demo.first.run; include Demo.second; }`, 'SW080'],
    ['private variable', `${structure} view invalid tv of Demo.first.count;`, 'SW080'],
    ['calculation', 'component Demo { function run() { calc twice { in value: int; return result: int = value * 2; } } } view invalid tv of Demo.run.twice;', 'SW080'],
    ['state', 'component Demo { function lifecycle() on start { initial Idle; state Idle {} } } view invalid tv of Demo.lifecycle.Idle;', 'SW080'],
    ['interface signature', 'interface clientServer Service version "1.0.0" { function check(); } view invalid tv of Service.check;', 'SW080'],
    ['requirement', 'requirement Needed {} view invalid tv of Needed;', 'SW080'],
    ['case', 'component Demo {} useCase Story of Demo {} view invalid tv of Story;', 'SW080'],
    ['view of view', `${structure} view first tv of Demo.first.run; view second tv of first;`, 'SW080'],
    ['unresolved subject even with a false filter', 'view invalid tv { include Missing where false; }', 'SW080'],
    ['unknown filter field', `${structure} view invalid tv { include Demo recursive where owner == "Worker"; }`, 'SW080'],
    ['non-Boolean filter', `${structure} view invalid tv { include Demo recursive where name; }`, 'SW023'],
    ['wrong filter operand types', `${structure} view invalid tv { include Demo recursive where name and true; }`, 'SW023'],
    ['arithmetic filter', `${structure} view invalid tv { include Demo recursive where 1 + 1 == 2; }`, 'SW080'],
    ['executable filter', `${structure} view invalid tv { include Demo recursive where helper() == 1; }`, 'SW080'],
    ['reserved declaration name', 'component tv {}', undefined],
    ['reserved variable name', 'component Demo { var tv: int = 0; }', undefined],
    ['reserved enum literal', 'enum Flags { tv }', undefined],
    ['uppercase view kind', `${structure} view invalid TV of Demo.first.run;`, undefined],
    ['missing subject', 'view invalid tv of ;', undefined],
    ['missing subject assignment', 'view invalid tv;', undefined],
    ['empty view block', 'view invalid tv {}', undefined],
    ['missing include subject', 'view invalid tv { include ; }', undefined],
    ['malformed predicate', `${structure} view invalid tv { include Demo recursive where kind == ; }`, undefined],
    ['unterminated view block', `${structure} view invalid tv { include Demo.first.run;`, undefined],
] as const) test(`tv rejects ${title}`, async () => {
    const document = await parse(source);
    assert.ok(document.diagnostics?.some(d => d.severity === 1 && (!code || d.code === code)), JSON.stringify(document.diagnostics));
});

test('a malformed tv declaration recovers to a later valid view without crashing validation', async () => {
    const document = await parse(`${structure} view broken tv of ; view recovered tv of Demo.first.run;`);
    assert.ok(document.parseResult.parserErrors.length > 0);
    const recovered = document.parseResult.value.packages[0].elements.filter(a.isView).find(view => view.name === 'recovered');
    assert.ok(recovered);
    assert.equal(recovered.kind, 'tv');
    assert.equal(recovered.subject, 'Demo.first.run');
});
