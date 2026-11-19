// Runs langium generate for langium-config.json and fails on any grammar diagnostic, whatever its level
// (compatibility gate 3 of swa.ml 3.0, rule WP1a-M03). The generator reports errors with console.error,
// warnings with console.warn and information and hints (such as an unused rule) with console.log as
// "<file>.langium:line:column - message"; parser definition errors also make it return false.
import { generate } from 'langium-cli';
import { fileURLToPath } from 'node:url';

const problems = [], original = { log: console.log, warn: console.warn, error: console.error };
const diagnostic = /^\S+\.langium:\d+:\d+ - /u;
for (const level of ['log', 'warn', 'error'])
    console[level] = (...args) => {
        const line = args.map(String).join(' ');
        if (level !== 'log' || diagnostic.test(line))
            problems.push(line);
        original[level](...args);
    };
let success;
try {
    success = await generate({ file: fileURLToPath(new URL('../langium-config.json', import.meta.url)) });
}
finally {
    Object.assign(console, original);
}
if (!success || problems.length) {
    console.error(`Grammar generation ${success ? 'printed' : 'failed with'} ${problems.length} diagnostic line(s); the grammar must generate without any error, warning, information or hint.`);
    process.exit(1);
}
