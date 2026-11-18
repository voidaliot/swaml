import type { SimulationResult, TraceEvent } from './simulator.js';
export interface TimingInterval {
    activation: string;
    subject: string;
    startNs: number;
    endNs?: number;
    phase: string;
    /** The Swaml::Os Task the activation runs on, from its release observation: its Task lane (WP8-M04). Absent when unplaced. */
    task?: string;
}
/** A state band of an operation with states (states in the flow, 4.6): the time a state is the current one. */
export interface StateBand {
    activation: string;
    subject: string;
    state: string;
    startNs: number;
    endNs?: number;
}
/** Declared schedules are a separate projection; these intervals require an identified run. */
export function projectOperationTiming(result: SimulationResult): {
    profile: string;
    intervals: TimingInterval[];
    markers: TraceEvent[];
    states?: StateBand[];
} {
    const intervals: TimingInterval[] = [], open = new Map<string, TimingInterval>(), tasks = new Map<string, string>();
    const states: StateBand[] = [], current = new Map<string, StateBand>();
    for (const e of result.trace) {
        const id = e.activation as string | undefined;
        if (!id)
            continue;
        // A state band per arrival (SIF-T01): it ends at the next arrival of that activation or at its end. A stay is no arrival.
        if (e.kind === 'state' && !e.stay && typeof e.state === 'string') {
            const previous = current.get(id);
            if (previous)
                previous.endNs = e.timeNs;
            const band: StateBand = { activation: id, subject: e.subject, state: e.state, startNs: e.timeNs };
            states.push(band);
            current.set(id, band);
        }
        if (['complete', 'failure'].includes(e.kind) && current.has(id)) {
            current.get(id)!.endNs = e.timeNs;
            current.delete(id);
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
    return { profile: result.profile, intervals, ...(states.length ? { states } : {}), markers: result.trace.filter(e => ['complete', 'failure', 'interrupt', 'timeout', 'skip'].includes(e.kind)) };
}
