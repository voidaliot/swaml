import { simulationOptionsProblem } from '../out/src/simulation/simulator.js';
// Reads examples/simulation/cases.json: the expected case results of every complete example and the
// options their runs use. "options" applies to every example; "modelOptions" may give one example its own
// options (for example a larger maxSteps or a longer untilNs), each overriding the same global option.
// The one validator of simulation options is the simulator's own, so this file cannot drift from it.
function checkOptions(options, where, partial) {
    const problem = simulationOptionsProblem(options, partial);
    if (problem)
        throw new Error(`${where}: ${problem}`);
}

/** Validates the parsed file against the example models it describes and returns it. */
export function checkCasesFile(cases, models) {
    for (const key of Object.keys(cases))
        if (!['options', 'modelOptions', 'examples'].includes(key))
            throw new Error(`cases.json has unknown key ${key}`);
    checkOptions(cases.options, 'cases.json options', false);
    for (const [model, options] of Object.entries(cases.modelOptions ?? {})) {
        if (!models.includes(model))
            throw new Error(`cases.json modelOptions names ${model}, which is not a complete example`);
        checkOptions(options, `cases.json modelOptions for ${model}`, true);
    }
    for (const model of Object.keys(cases.examples ?? {}))
        if (!models.includes(model))
            throw new Error(`cases.json examples names ${model}, which is not a complete example`);
    return cases;
}

/** Rejects modelOptions for an example that has no use case or test to run them. */
export function checkModelOptionsUsed(cases, model, caseCount) {
    if (cases.modelOptions?.[model] && !caseCount)
        throw new Error(`cases.json modelOptions names ${model}, which has no use case or test`);
}

/** The options for the runs of one example: its own options over the global ones. */
export function caseOptions(cases, model) {
    return { ...cases.options, ...(cases.modelOptions?.[model] ?? {}) };
}
