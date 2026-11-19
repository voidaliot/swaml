import type { SimulationResult, TraceEvent } from './simulator.js';
export interface TimingInterval {
    activation: string;
    subject: string;
    startNs: number;
    endNs?: number;
    phase: string;
    /** The Swaml::Os Task the activation runs on, from its release observation: its Task lane (WP8-M04). Absent when unplaced. */
    task?: string;
    /** A periodic machine's release number (states in the flow, 4.6): its interval spans that release's work. */
    release?: number;
}
/**
 * A state band of an operation with states (states in the flow, 4.6): the time a state is entered. Bands nest for parents
 * (SIF-R11): depth 0 is a state standing in the flow, depth n a state inside n parents, and parent names the enclosing
 * band's state. A parent's band spans every inner state entered while it stays entered.
 */
export interface StateBand {
    activation: string;
    subject: string;
    state: string;
    startNs: number;
    endNs?: number;
    depth: number;
    parent?: string;
}
/**
 * Declared schedules are a separate projection; these intervals require an identified run. A periodic machine (states in the
 * flow, 4.6; its release observations carry a release number) gets one interval per release, from the release to the end of
 * that release's work (it waits for the next release, or its guard skipped it); between releases its track is idle. Its
 * state bands change at the release in which a new state is reached; periodicEnd closes them, and skips are markers.
 */
export function projectOperationTiming(result: SimulationResult): {
    profile: string;
    intervals: TimingInterval[];
    markers: TraceEvent[];
    states?: StateBand[];
} {
    const intervals: TimingInterval[] = [], open = new Map<string, TimingInterval>(), tasks = new Map<string, string>(), periodic = new Set<string>();
    // The open bands of each activation, outermost first, with the identity of their state.
    const states: StateBand[] = [], current = new Map<string, { band: StateBand; source: string }[]>();
    for (const e of result.trace) {
        const id = e.activation as string | undefined;
        if (!id)
            continue;
        // A state band per arrival (SIF-T01): an inner state's identity extends its parent's (its source is a statement of
        // the parent's braces), so an arrival closes every open band that does not enclose it, innermost first, and opens its
        // own one level below the last enclosing band. A stay is no arrival. The end of the activation closes every band.
        if (e.kind === 'state' && !e.stay && typeof e.state === 'string') {
            const open = current.get(id) ?? [], source = typeof e.source === 'string' ? e.source : '';
            while (open.length && !(source && source.startsWith(open.at(-1)!.source + '/')))
                open.pop()!.band.endNs = e.timeNs;
            const parent = open.at(-1)?.band.state;
            const band: StateBand = { activation: id, subject: e.subject, state: e.state, startNs: e.timeNs, depth: open.length, ...(parent !== undefined ? { parent } : {}) };
            states.push(band);
            open.push({ band, source });
            current.set(id, open);
        }
        // Leaving the outermost state into plain flow (leave), completion, failure and periodicEnd close every band.
        if (['leave', 'complete', 'failure', 'periodicEnd'].includes(e.kind) && current.has(id)) {
            for (const { band } of current.get(id)!)
                band.endNs = e.timeNs;
            current.delete(id);
        }
        if (e.kind === 'release' && typeof e.release === 'number')
            periodic.add(id);
        if (periodic.has(id)) {
            if (e.kind === 'release' && typeof e.task === 'string')
                tasks.set(id, e.task);
            const task = tasks.get(id);
            if (['release', 'receiveWait', 'skip', 'failure'].includes(e.kind)) {
                const previous = open.get(id);
                if (previous)
                    previous.endNs = e.timeNs;
                open.delete(id);
            }
            if (e.kind === 'release') {
                const next: TimingInterval = { activation: id, subject: e.subject, startNs: e.timeNs, phase: 'release', release: e.release as number, ...(task ? { task } : {}) };
                intervals.push(next);
                open.set(id, next);
            }
            continue;
        }
        if (['release', 'dispatch', 'ready', 'wait', 'receiveWait', 'requestWait'].includes(e.kind)) {
            const previous = open.get(id);
            if (previous)
                previous.endNs = e.timeNs;
            if (e.kind === 'release' && typeof e.task === 'string')
                tasks.set(id, e.task);
            const task = tasks.get(id);
            const next: TimingInterval = task ? { activation: id, subject: e.subject, startNs: e.timeNs, phase: e.kind, task } : { activation: id, subject: e.subject, startNs: e.timeNs, phase: e.kind };
            intervals.push(next);
            open.set(id, next);
        }
        // A skipped release (WP7-T01) ends its activation like a completion.
        if (['complete', 'failure', 'skip'].includes(e.kind)) {
            const previous = open.get(id);
            if (previous)
                previous.endNs = e.timeNs;
            open.delete(id);
        }
    }
    return { profile: result.profile, intervals, ...(states.length ? { states } : {}), markers: result.trace.filter(e => ['complete', 'failure', 'interrupt', 'timeout', 'skip', 'periodicEnd'].includes(e.kind)) };
}
