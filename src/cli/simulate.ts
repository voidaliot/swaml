#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import type { SimulationOptions } from '../simulation/simulator.js';
import { languageArguments } from './options.js';
import { runFiles } from './run.js';
try {
    const [target, optionsFile, ...files] = languageArguments(process.argv.slice(2));
    if (!target || !optionsFile || !files.length)
        throw new Error('Usage: swaml-simulate [--language-version 2.1] Package|Package::component options.json file.swaml [more files...]');
    process.exitCode = await runFiles(files, target, JSON.parse(await readFile(optionsFile, 'utf8')) as SimulationOptions);
}
catch (error) {
    console.error(String(error));
    process.exitCode = 2;
}
