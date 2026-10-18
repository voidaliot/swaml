import type { SimulationResult, TraceEvent } from './simulator.js';

/** Declared limits belong to a function occurrence, independently of observed spans. */
export interface FunctionTimingContract {
    functionPath: string;
    definitionPath: string;
    concurrency: 'serial' | 'reentrant';
    wcetNs?: number;
    deadlineNs?: number;
}
export interface TimingPoint { timeNs: number; ordinal?: number }
export interface TimingInterval {
    state: 'ready' | 'running' | 'requestWait';
    start: TimingPoint;
    end: TimingPoint;
    open: boolean;
    correlation?: string;
}
export interface TimingMarker {
    kind: string;
    point: TimingPoint;
    correlation?: string;
    detail?: string;
    line?: number;
}
export interface FunctionActivationTiming {
    id: string;
    functionPath: string;
    contract?: FunctionTimingContract;
    released: TimingPoint;
    dispatched?: TimingPoint;
    terminal?: TimingPoint;
    outcome: 'complete' | 'failure' | 'cancelled' | 'open';
    deadlineAtNs?: number;
    intervals: TimingInterval[];
    markers: TimingMarker[];
}
export interface FunctionTimingProjection {
    root: string;
    profile: string;
    status: SimulationResult['status'];
    endNs: number;
    activations: FunctionActivationTiming[];
    stops: { point: TimingPoint; kind: string; code?: string; detail?: string }[];
}
export type FunctionTimingEvidence = Pick<SimulationResult, 'root' | 'status' | 'timeNs' | 'options' | 'trace'> & { profile: string };
type Phase = { state: TimingInterval['state']; start: TimingPoint; correlation?: string };
const point = (event: TraceEvent): TimingPoint => ({ timeNs: event.timeNs, ordinal: event.ordinal });
const string = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;

/**
 * Project an existing logical-time trace without executing behavior or inventing CPU cost.
 * Trace order is retained even for several observations at the same nanosecond.
 * Incomplete activations remain open at the observation horizon or stopped-run boundary.
 */
export function projectFunctionTiming(evidence: FunctionTimingEvidence, contracts: readonly FunctionTimingContract[] = []): FunctionTimingProjection {
    const limit = evidence.status === 'horizon' ? evidence.options.untilNs : evidence.timeNs;
    if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid timing observation boundary');
    const contractByPath = new Map<string, FunctionTimingContract>();
    for (const contract of contracts) {
        if (!contract.functionPath || !contract.definitionPath || !['serial', 'reentrant'].includes(contract.concurrency)) throw new Error('Invalid function timing contract');
        if (contractByPath.has(contract.functionPath)) throw new Error(`Duplicate timing contract: ${contract.functionPath}`);
        for (const value of [contract.wcetNs, contract.deadlineNs]) {
            if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) throw new Error('Invalid declared timing bound');
        }
        contractByPath.set(contract.functionPath, contract);
    }
    const activations = new Map<string, FunctionActivationTiming>();
    const phases = new Map<string, Phase>();
    const correlations = new Map<string, FunctionActivationTiming>();
    const stops: FunctionTimingProjection['stops'] = [];
    const close = (activation: FunctionActivationTiming, end: TimingPoint, open = false): void => {
        const phase = phases.get(activation.id);
        if (!phase) return;
        activation.intervals.push({ ...phase, end, open });
        phases.delete(activation.id);
    };
    const mark = (activation: FunctionActivationTiming, event: TraceEvent, correlation?: string): void => {
        activation.markers.push({ kind: event.kind, point: point(event), ...(correlation ? { correlation } : {}),
            ...(string(event.failure) ?? string(event.code) ?? string(event.reason) ? { detail: string(event.failure) ?? string(event.code) ?? string(event.reason) } : {}),
            ...(typeof event.line === 'number' ? { line: event.line } : {}) });
    };
    let previousTime = -1, previousOrdinal = 0;
    for (const event of evidence.trace) {
        if (!Number.isSafeInteger(event.timeNs) || event.timeNs < 0 || event.timeNs < previousTime || event.timeNs > limit ||
            !Number.isSafeInteger(event.ordinal) || event.ordinal <= previousOrdinal) throw new Error('Timing trace must retain monotonic times and unique increasing ordinals');
        previousTime = event.timeNs; previousOrdinal = event.ordinal;
        if (event.kind === 'release') {
            const path = string(event.function);
            if (!path || activations.has(event.subject)) throw new Error('Timing release requires a unique activation and function path');
            const contract = contractByPath.get(path);
            const deadlineAtNs = contract?.deadlineNs === undefined ? undefined : event.timeNs + contract.deadlineNs;
            if (deadlineAtNs !== undefined && !Number.isSafeInteger(deadlineAtNs)) throw new Error('Timing deadline exceeds safe integer range');
            const activation: FunctionActivationTiming = { id: event.subject, functionPath: path, ...(contract ? { contract: { ...contract } } : {}),
                released: point(event), outcome: 'open', ...(deadlineAtNs === undefined ? {} : { deadlineAtNs }), intervals: [], markers: [] };
            activations.set(activation.id, activation);
            phases.set(activation.id, { state: 'ready', start: point(event) });
            mark(activation, event);
            continue;
        }
        const activation = activations.get(event.subject);
        if (event.kind === 'dispatch') {
            if (!activation || activation.dispatched || activation.terminal) throw new Error('Timing dispatch requires one released activation');
            if (string(event.function) !== activation.functionPath) throw new Error('Timing dispatch changed function occurrence');
            close(activation, point(event)); activation.dispatched = point(event);
            phases.set(activation.id, { state: 'running', start: point(event) }); mark(activation, event);
        } else if (event.kind === 'request') {
            const caller = activations.get(string(event.activation) ?? '');
            if (!caller?.dispatched || caller.terminal || phases.get(caller.id)?.state !== 'running' || correlations.has(event.subject)) throw new Error('Timing request requires a running activation and new correlation');
            close(caller, point(event)); correlations.set(event.subject, caller);
            phases.set(caller.id, { state: 'requestWait', start: point(event), correlation: event.subject }); mark(caller, event, event.subject);
        } else if (['requestComplete', 'requestCancelled', 'timeout', 'discardResponse'].includes(event.kind)) {
            const caller = correlations.get(event.subject);
            if (!caller) throw new Error('Timing response requires an observed request correlation');
            mark(caller, event, event.subject);
            if (event.kind === 'requestComplete' || event.kind === 'requestCancelled') {
                if (phases.get(caller.id)?.correlation !== event.subject) throw new Error('Timing request completed more than once or outside its wait');
                close(caller, point(event)); phases.set(caller.id, { state: 'running', start: point(event) });
            }
        } else if (activation && ['complete', 'failure', 'discardTimer'].includes(event.kind)) {
            if (activation.terminal) throw new Error('Timing activation has more than one terminal observation');
            close(activation, point(event)); activation.terminal = point(event);
            activation.outcome = event.kind === 'discardTimer' ? 'cancelled' : event.kind === 'failure' ? 'failure' : 'complete';
            mark(activation, event);
        } else if (activation && ['statement', 'interrupt'].includes(event.kind)) mark(activation, event);
        else if (event.kind === 'violation') stops.push({ point: point(event), kind: event.kind, code: string(event.code), detail: string(event.message) });
    }
    for (const activation of activations.values()) close(activation, { timeNs: limit }, true);
    return { root: evidence.root, profile: evidence.profile, status: evidence.status, endNs: limit, activations: [...activations.values()], stops };
}
