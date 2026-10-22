import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile(new URL('../libraries/swaml-2.0.swaml',import.meta.url),'utf8');
await writeFile(new URL('../src/language/standard-library.ts',import.meta.url),'// Generated from libraries/swaml-2.0.swaml. Do not edit.\nexport const STANDARD_LIBRARY = '+JSON.stringify(source)+';\n');
