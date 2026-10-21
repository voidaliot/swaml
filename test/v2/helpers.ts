import { EmptyFileSystem, URI } from 'langium';
import { parseHelper } from 'langium/test';
import { createSwamlServices } from '../../src/language/swaml-module.js';
import type { Model } from '../../src/language/generated/ast.js';
import { simulate, type SimulationOptions } from '../../src/simulation/simulator.js';
import assert from 'node:assert/strict';
export async function parse(source: string) { const services = createSwamlServices(EmptyFileSystem); const doc = await parseHelper<Model>(services.Swaml)(source, { validation: true }); return { ...services, doc, model: doc.parseResult.value, errors: doc.diagnostics?.filter(d => d.severity === 1) ?? [], warnings: doc.diagnostics?.filter(d => d.severity === 2) ?? [] }; }
export async function valid(source: string) { const r = await parse(source); assert.deepEqual(r.errors.map(x => [x.code, x.message]), []); return r; }
export async function invalid(source: string, code?: string) { const r = await parse(source); assert.ok(r.errors.length, 'model should be rejected'); if (code)
    assert.ok(r.errors.some(d => d.code === code), JSON.stringify(r.errors)); return r; }
export async function run(source: string, untilNs = 10000000, options: Partial<SimulationOptions> = {}) { const r = await valid(source); return simulate([r.model], 'Test::Demo', { untilNs, ...options }); }
export async function workspace(sources: string[]) { const s = createSwamlServices(EmptyFileSystem); const docs = sources.map((text, i) => s.shared.workspace.LangiumDocumentFactory.fromString(text, URI.parse(`memory:///source${i}.swaml`))); docs.forEach(d => s.shared.workspace.LangiumDocuments.addDocument(d)); await s.shared.workspace.DocumentBuilder.build(docs, { validation: true }); return { ...s, docs }; }
