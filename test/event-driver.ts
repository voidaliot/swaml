import assert from 'node:assert/strict';

/** Authored model stimuli: every action still travels through a typed model route. */
export interface ScheduledEmission {
    atNs: number;
    statement: string;
}

export function eventDriver(schedule: readonly ScheduledEmission[], name = 'driveInputs'): string {
    const groups: { atNs: number; statements: string[] }[] = [];
    for (const emission of schedule) {
        assert.ok(Number.isSafeInteger(emission.atNs) && emission.atNs >= 0, 'Driver times are nonnegative integer nanoseconds.');
        assert.ok(/^\s*(publish|send)\s/.test(emission.statement), 'A driver emits through an owned typed port.');
        const previous = groups.at(-1);
        assert.ok(!previous || emission.atNs >= previous.atNs, 'Driver emissions are ordered.');
        if (previous?.atNs === emission.atNs) previous.statements.push(emission.statement);
        else groups.push({ atNs: emission.atNs, statements: [emission.statement] });
    }
    if (!groups.length) return `function ${name}() on start { return; }`;
    const immediate = groups[0].atNs === 0 ? groups.shift()!.statements.join('\n') : '';
    if (!groups.length) return `function ${name}() on start { ${immediate} }`;
    const states = [`state Driver0 { ${immediate ? `entry { ${immediate} }` : ''} }`];
    const transitions: string[] = [];
    let previousTime = 0;
    for (const [index, group] of groups.entries()) {
        states.push(`state Driver${index + 1} ${index === groups.length - 1 ? 'final' : ''} {}`);
        transitions.push(`transition emit${index}: Driver${index} -> Driver${index + 1} on after ${group.atNs - previousTime} ns { ${group.statements.join('\n')} }`);
        previousTime = group.atNs;
    }
    return `function ${name}() on start { initial Driver0; ${states.join('\n')} ${transitions.join('\n')} }`;
}

/** Replace only a test fixture's ordinary source driver, never simulation input options. */
export function withEventSchedule(source: string, schedule: readonly ScheduledEmission[], name = 'driveInputs'): string {
    const declaration = new RegExp(`\\bfunction\\s+${name}\\(\\)\\s+on\\s+start\\s*\\{`).exec(source);
    assert.ok(declaration, `Missing authored driver ${name}.`);
    const opening = declaration.index + declaration[0].length - 1;
    let depth = 1, cursor = opening + 1;
    while (cursor < source.length && depth) {
        if (source.startsWith('//', cursor)) {
            const newline = source.indexOf('\n', cursor + 2);
            cursor = newline < 0 ? source.length : newline + 1;
        } else if (source.startsWith('/*', cursor)) {
            const end = source.indexOf('*/', cursor + 2);
            assert.ok(end >= 0, 'Unterminated fixture comment.');
            cursor = end + 2;
        } else if (source[cursor] === '"') {
            cursor++;
            while (cursor < source.length && source[cursor] !== '"') cursor += source[cursor] === '\\' ? 2 : 1;
            cursor++;
        } else {
            if (source[cursor] === '{') depth++;
            if (source[cursor] === '}') depth--;
            cursor++;
        }
    }
    assert.equal(depth, 0, 'Unterminated fixture driver.');
    return source.slice(0, declaration.index) + eventDriver(schedule, name) + source.slice(cursor);
}
