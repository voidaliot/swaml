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
/** Declared schedules are a separate projection; these intervals require an identified run. */
export function projectOperationTiming(result: SimulationResult): {
    profile: string;
    intervals: TimingInterval[];
    markers: TraceEvent[];
} {
    const intervals: TimingInterval[] = [], open = new Map<string, TimingInterval>(), tasks = new Map<string, string>();
    for (const e of result.trace) {
        const id = e.activation as string | undefined;
        if (!id)
            continue;
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
    return { profile: result.profile, intervals, markers: result.trace.filter(e => ['complete', 'failure', 'interrupt', 'timeout', 'skip'].includes(e.kind)) };
}
