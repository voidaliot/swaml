import {readFile,writeFile} from 'node:fs/promises';
// The versioned library sources, each loaded as its own built-in document (WP3-M01): swaml-2.0.swaml keeps
// its bytes and document URI, so 2.2 references, traces and sources are unchanged; the 3.0 packages are a
// separate document.
const source=await readFile(new URL('../libraries/swaml-2.0.swaml',import.meta.url),'utf8');
const source23=await readFile(new URL('../libraries/swaml-3.0.swaml',import.meta.url),'utf8');
await writeFile(new URL('../src/language/standard-library.ts',import.meta.url),'// Generated from libraries/swaml-2.0.swaml and libraries/swaml-3.0.swaml. Do not edit.\nexport const STANDARD_LIBRARY = '+JSON.stringify(source)+';\nexport const STANDARD_LIBRARY_3_0 = '+JSON.stringify(source23)+';\n');
// The kept 2.2 grammar that swaml migrate reads 2.2 state machines with (src/migrate/tools.ts); its one source is the
// pinned compatibility fixture, so the command and the gates read 2.2 the same way.
const grammar22=await readFile(new URL('../test/fixtures/compatibility-2-2/swaml-2.2.langium',import.meta.url),'utf8');
await writeFile(new URL('../src/migrate/grammar-2-2.ts',import.meta.url),'// Generated from test/fixtures/compatibility-2-2/swaml-2.2.langium. Do not edit.\nexport const GRAMMAR_2_2 = '+JSON.stringify(grammar22)+';\n');
