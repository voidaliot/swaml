// Runs langium generate for langium-config.json and fails on any generation warning or error
// (compatibility gate 3 of swa.ml 2.3, rule WP1a-M03). The generator reports grammar diagnostics
// with console.warn and console.error; parser definition errors also make it return false.
import { generate } from 'langium-cli';
import { fileURLToPath } from 'node:url';

const problems = [], original = { warn: console.warn, error: console.error };
for (const level of ['warn', 'error'])
    console[level] = (...args) => { problems.push(args.map(String).join(' ')); original[level](...args); };
let success;
try {
    success = await generate({ file: fileURLToPath(new URL('../langium-config.json', import.meta.url)) });
}
finally {
    Object.assign(console, original);
}
if (!success || problems.length) {
    console.error(`Grammar generation ${success ? 'printed' : 'failed with'} ${problems.length} warning or error line(s); the grammar must generate without any warning.`);
    process.exit(1);
}
