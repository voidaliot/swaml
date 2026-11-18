// PROTOTYPE P1: validate one or more swa.ml files with the prototype build and print errors (and warnings with -w).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const base = pathToFileURL('E:/t/sw-p1/out/').href;
const { EmptyFileSystem } = await import('langium');
const { parseHelper } = await import('langium/test');
const { createSwamlServices } = await import(base + 'src/language/swaml-module.js');
const warn = process.argv.includes('-w');
for (const file of process.argv.slice(2).filter(x => x !== '-w')) {
  const { Swaml } = createSwamlServices(EmptyFileSystem);
  const d = await parseHelper(Swaml)(readFileSync(file, 'utf8'), { documentUri: 'file:///check.swaml', validation: true });
  const ds = (d.diagnostics ?? []).filter(x => x.severity === 1 || warn && x.severity === 2);
  console.log(`${file}: ${ds.filter(x => x.severity === 1).length} errors`);
  for (const x of ds) console.log(`  ${x.severity === 1 ? 'E' : 'W'} ${x.range.start.line + 1}: ${x.message}`);
}
