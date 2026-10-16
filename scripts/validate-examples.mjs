import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Expand examples here: npm uses cmd.exe on Windows, which does not expand *.swaml.
const root = new URL('../', import.meta.url);
const files = (await readdir(new URL('examples/', root)))
    .filter(name => name.endsWith('.swaml')).sort()
    .map(name => fileURLToPath(new URL(`examples/${name}`, root)));
const result = spawnSync(process.execPath, [fileURLToPath(new URL('out/src/cli/main.js', root)), ...files], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 2;
