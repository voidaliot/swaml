import type { SimulationResult, TraceEvent } from './simulator.js';
export interface TimingInterval {
    activation: string;
    subject: string;
    startNs: number;
    endNs?: number;
    phase: string;
}
/** Declared schedules are a separate projection; these intervals require an identified run. */
export function projectOperationTiming(result: SimulationResult): {
    profile: string;
    intervals: TimingInterval[];
    markers: TraceEvent[];
} {
    const intervals: TimingInterval[] = [], open = new Map<string, TimingInterval>();
    for (const e of result.trace) {
        const id = e.activation as string | undefined;
        if (!id)
            continue;
        if (['release', 'dispatch', 'ready', 'wait', 'receiveWait', 'requestWait'].includes(e.kind)) {
            const previous = open.get(id);
            if (previous)
                previous.endNs = e.timeNs;
            const next = { activation: id, subject: e.subject, startNs: e.timeNs, phase: e.kind };
            intervals.push(next);
            open.set(id, next);
        }
        if (['complete', 'failure'].includes(e.kind)) {
            const previous = open.get(id);
            if (previous)
                previous.endNs = e.timeNs;
            open.delete(id);
        }
    }
    return { profile: result.profile, intervals, markers: result.trace.filter(e => ['complete', 'failure', 'interrupt', 'timeout'].includes(e.kind)) };
}
