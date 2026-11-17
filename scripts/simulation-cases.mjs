// Reads examples/simulation/cases.json: the expected case results of every complete example and the
// options their runs use. "options" applies to every example; "modelOptions" may give one example its own
// options (for example a larger maxSteps or a longer untilNs), each overriding the same global option.
const KNOWN = new Set(['untilNs', 'maxSteps', 'maxPending', 'maxConcurrent', 'latencyNs', 'faults']);

function checkOptions(options, where) {
    if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new Error(`${where} must be an object of simulation options`);
    for (const key of Object.keys(options))
        if (!KNOWN.has(key))
            throw new Error(`${where} has unknown simulation option ${key}`);
}

/** Validates the parsed file against the example models it describes and returns it. */
export function checkCasesFile(cases, models) {
    for (const key of Object.keys(cases))
        if (!['options', 'modelOptions', 'examples'].includes(key))
            throw new Error(`cases.json has unknown key ${key}`);
    checkOptions(cases.options, 'cases.json options');
    if (typeof cases.options.untilNs !== 'number')
        throw new Error('cases.json options needs untilNs');
    for (const [model, options] of Object.entries(cases.modelOptions ?? {})) {
        if (!models.includes(model))
            throw new Error(`cases.json modelOptions names ${model}, which is not a complete example`);
        checkOptions(options, `cases.json modelOptions for ${model}`);
    }
    for (const model of Object.keys(cases.examples ?? {}))
        if (!models.includes(model))
            throw new Error(`cases.json examples names ${model}, which is not a complete example`);
    return cases;
}

/** The options for the runs of one example: its own options over the global ones. */
export function caseOptions(cases, model) {
    return { ...cases.options, ...(cases.modelOptions?.[model] ?? {}) };
}
