import {readFile,writeFile} from 'node:fs/promises';
// The versioned library sources, each loaded as its own built-in document (WP3-M01): swaml-2.0.swaml keeps
// its bytes and document URI, so 2.2 references, traces and sources are unchanged; the 2.3 packages are a
// separate document.
const source=await readFile(new URL('../libraries/swaml-2.0.swaml',import.meta.url),'utf8');
const source23=await readFile(new URL('../libraries/swaml-2.3.swaml',import.meta.url),'utf8');
await writeFile(new URL('../src/language/standard-library.ts',import.meta.url),'// Generated from libraries/swaml-2.0.swaml and libraries/swaml-2.3.swaml. Do not edit.\nexport const STANDARD_LIBRARY = '+JSON.stringify(source)+';\nexport const STANDARD_LIBRARY_2_3 = '+JSON.stringify(source23)+';\n');
