import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname } from 'node:path';

import { isDisallowed } from './public-content-rules.mjs';

const extensions = new Set(['.md', '.json', '.yml', '.yaml', '.ts', '.tsx', '.mjs', '.py', '.html', '.css', '.svg', '.txt', '.swaml']);
const ignored = new Set(['.git', 'node_modules', 'out', 'dist', '.vite', '.venv-pdf', 'tmp', '__pycache__', 'generated']);
const root = new URL('../', import.meta.url);
const failures = [];
let checked = 0;
async function visit(directory) {
    for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
        const path = `${directory}${entry.name}`;
        if (entry.isDirectory()) {
            if (!ignored.has(entry.name)) await visit(`${path}/`);
        } else if (entry.isFile() && extensions.has(extname(path))) {
            const source = await readFile(new URL(path, root), 'utf8');
            checked++;
            source.split(/\r?\n/).forEach((line, index) => {
                if (isDisallowed(line)) failures.push(`${path}:${index + 1}`);
            });
        }
    }
}
await visit('');
assert.deepEqual(failures, [], 'Public content contains an editor-product, private-companion or local-path reference');
console.log(`Verified independent public guidance across ${checked} text files.`);
