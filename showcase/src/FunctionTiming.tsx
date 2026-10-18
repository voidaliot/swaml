import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { FunctionTimingProjection } from '../../src/simulation/timing';
import type { Entity } from './model';
import demo from '../../spec/function-timing-demo.json';
import source from '../../examples/17-function-timing.swaml?raw';
import './function-timing.css';

type Unit = 'ms' | 'ns';
type DemoRun = { id: string; title: string; description: string; timing: FunctionTimingProjection };
const runs = demo.runs as unknown as DemoRun[];
const rowHeight = 76, left = 230, top = 62, right = 42;
const colors = { ready: '#b8c5cc', running: '#087f8c', requestWait: '#e3b35c' };
const eventLabels: Record<string, string> = { release: 'Release', dispatch: 'Dispatch', request: 'Request', requestComplete: 'Request completed', requestCancelled: 'Request cancelled', interrupt: 'Interrupt', timeout: 'Timeout', complete: 'Completed', failure: 'Failed', discardTimer: 'Cancelled', discardResponse: 'Late / duplicate reply discarded', statement: 'Statement' };
const duration = (value: number, unit: Unit) => `${(unit === 'ms' ? value / 1000000 : value).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${unit}`;

/** Flat SVG renderer: coordinates depend on logical time; zero spans keep zero width. */
export function FunctionTimingDiagram({ projection, unit = 'ms', selected, onSelect, width = 1120 }: {
  projection: FunctionTimingProjection; unit?: Unit; selected?: string; onSelect?: (id: string) => void; width?: number;
}) {
  const titleId = useId(), descriptionId = useId();
  const plot = Math.max(200, width - left - right), end = Math.max(1, projection.endNs);
  const x = (time: number) => left + (time / end) * plot;
  const height = top + projection.activations.length * rowHeight + 48;
  return <svg className="timing-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
    <title id={titleId}>{`Function activation timing for ${projection.root}`}</title>
    <desc id={descriptionId}>Logical time from zero to {duration(projection.endNs, unit)}. Each row retains its function occurrence and activation identity. Gray is released and ready, teal is running, amber is awaiting a routed request. Zero duration execution is a marker. Open intervals end at the observation boundary. Declared CPU bounds are listed separately.</desc>
    <rect width={width} height={height} fill="#fff"/>
    <text x="16" y="24" className="timing-axis-title">FUNCTION / ACTIVATION</text>
    <text x={left} y="24" className="timing-axis-title">OBSERVED LOGICAL TIME · {unit}</text>
    {Array.from({ length: 6 }, (_, i) => {
      const time = projection.endNs * i / 5;
      return <g key={i}><line x1={x(time)} x2={x(time)} y1="48" y2={height - 34} stroke="#dce5e8"/><text x={x(time)} y="43" textAnchor={i === 5 ? 'end' : i === 0 ? 'start' : 'middle'} className="timing-axis-tick">{duration(time, unit)}</text></g>;
    })}
    {projection.activations.map((activation, index) => {
      const y = top + index * rowHeight, center = y + 31;
      const deadline = activation.deadlineAtNs;
      return <g key={activation.id} role="button" tabIndex={0} aria-label={`${activation.functionPath}, activation ${activation.id}, ${activation.outcome}`} aria-pressed={selected === activation.id} onClick={() => onSelect?.(activation.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(activation.id); } }} className="timing-lane">
        <rect x="1" y={y} width={width - 2} height={rowHeight - 3} fill={selected === activation.id ? '#edf5f4' : index % 2 ? '#f7f9fa' : '#fff'} stroke={selected === activation.id ? '#8eb9b8' : 'none'}/>
        <text x="16" y={y + 25} className="timing-function-name">{activation.functionPath}</text>
        <text x="16" y={y + 45} className="timing-activation-id">{activation.id} · {activation.outcome}</text>
        <line x1={left} x2={width - right} y1={center} y2={center} stroke="#d0dcdf"/>
        {activation.intervals.map((interval, i) => <g key={i}><title>{`${interval.state}: ${duration(interval.start.timeNs, unit)} → ${duration(interval.end.timeNs, unit)}${interval.open ? ' · open at observation boundary' : ''}${interval.correlation ? ` · ${interval.correlation}` : ''}`}</title>{interval.start.timeNs === interval.end.timeNs ? <line x1={x(interval.start.timeNs)} x2={x(interval.end.timeNs)} y1={center - 10} y2={center + 10} stroke={colors[interval.state]} strokeWidth="3"/> : <rect x={x(interval.start.timeNs)} y={center - 7} width={x(interval.end.timeNs) - x(interval.start.timeNs)} height="14" fill={colors[interval.state]} stroke={interval.open ? '#4c6571' : 'none'} strokeDasharray={interval.open ? '3 3' : undefined}/>}{interval.open && <text x={x(interval.end.timeNs) - 3} y={center + 28} textAnchor="end" className="timing-open-label">open →</text>}</g>)}
        {deadline !== undefined && deadline <= projection.endNs && <g><title>{`Declared deadline at ${duration(deadline, unit)}, measured from release`}</title><line x1={x(deadline)} x2={x(deadline)} y1={y + 4} y2={y + 62} stroke="#b45f52" strokeDasharray="4 3"/><text x={x(deadline) - 4} y={y + 12} textAnchor="end" className="timing-deadline-label">deadline</text></g>}
        {activation.markers.filter(m => ['release', 'dispatch', 'complete', 'failure', 'discardTimer', 'timeout', 'discardResponse', 'interrupt', 'requestCancelled'].includes(m.kind)).map(marker => {
          const mx = x(marker.point.timeNs);
          return <g key={marker.point.ordinal}><title>{`#${marker.point.ordinal} ${eventLabels[marker.kind]} · ${duration(marker.point.timeNs, unit)}${marker.correlation ? ` · ${marker.correlation}` : ''}`}</title>{marker.kind === 'release' ? <polygon points={`${mx - 5},${center - 21} ${mx + 5},${center - 21} ${mx},${center - 14}`} fill="#496779"/> : marker.kind === 'dispatch' ? <circle cx={mx} cy={center} r="4" fill="#087f8c"/> : marker.kind === 'complete' ? <circle cx={mx} cy={center} r="6" fill="#fff" stroke="#087f8c" strokeWidth="2"/> : ['failure', 'timeout', 'discardTimer'].includes(marker.kind) ? <path d={`M${mx - 5},${center - 5}L${mx + 5},${center + 5}M${mx - 5},${center + 5}L${mx + 5},${center - 5}`} stroke="#b45f52" strokeWidth="2"/> : <polygon points={`${mx},${center + 15} ${mx + 5},${center + 20} ${mx},${center + 25} ${mx - 5},${center + 20}`} fill={marker.kind === 'discardResponse' ? '#fff' : '#aa7740'} stroke="#aa7740"/>}</g>;
        })}
      </g>;
    })}
    <line x1={x(projection.endNs)} x2={x(projection.endNs)} y1="48" y2={height - 34} stroke="#496779" strokeDasharray="5 3"/>
    <text x={width - right} y={height - 12} textAnchor="end" className="timing-axis-tick">Observation boundary · {projection.status}</text>
  </svg>;
}

type TimingNode = Node<{ projection: FunctionTimingProjection; unit: Unit; selected: string; onSelect: (id: string) => void }, 'timing'>;
function TimingCanvasNode({ data }: NodeProps<TimingNode>) { return <FunctionTimingDiagram {...data}/>; }
const nodeTypes = { timing: TimingCanvasNode };

export function FunctionTiming({ onSelect, onInspect }: { onSelect?: (entity: Entity) => void; onInspect?: () => void }) {
  const [runId, setRunId] = useState(runs[0].id), [unit, setUnit] = useState<Unit>('ms'), [selected, setSelected] = useState(runs[0].timing.activations[0].id);
  const [filter, setFilter] = useState('all');
  const inspectActivation = useCallback((id: string) => { setSelected(id); onInspect?.(); }, [onInspect]);
  const run = runs.find(r => r.id === runId)!;
  const projection = useMemo(() => ({ ...run.timing, activations: run.timing.activations.filter(a => filter === 'all' || a.functionPath === filter) }), [run, filter]);
  const activation = projection.activations.find(a => a.id === selected) ?? projection.activations[0];
  const declaration = demo.declarations.find(d => d.functionPath === activation?.functionPath);
  useEffect(() => {
    if (!activation || !onSelect) return;
    onSelect({ id: activation.id, kind: 'Function activation', name: `${activation.functionPath} · ${activation.id}`, path: `${demo.root}.${activation.functionPath}`, owner: demo.root,
      description: 'One observed activation in a reproducible logical-time reference simulation. Declared timing bounds and observed intervals are shown separately.',
      definition: declaration?.definitionPath, properties: [['Activation', activation.id], ['Outcome', activation.outcome], ['Release', duration(activation.released.timeNs, unit)], ['Dispatch', activation.dispatched ? duration(activation.dispatched.timeNs, unit) : 'pending'], ['End', activation.terminal ? duration(activation.terminal.timeNs, unit) : 'open'], ['Profile', run.timing.profile]], snippet: declaration?.source ?? '' });
  }, [activation, declaration, onSelect, run.timing.profile, unit]);
  const nodes = useMemo<TimingNode[]>(() => [{ id: 'function-timing', type: 'timing', position: { x: 0, y: 0 }, data: { projection, unit, selected: activation?.id ?? '', onSelect: inspectActivation }, style: { width: 1120, height: top + projection.activations.length * rowHeight + 48 }, draggable: false, selectable: false }], [projection, unit, activation?.id, inspectActivation]);
  return <div className="function-timing">
    <div className="timing-toolbar"><label>Simulation <select aria-label="Timing simulation" value={runId} onChange={e => { setRunId(e.target.value); setSelected(''); }}>{runs.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label><details className="timing-options"><summary>Display options</summary><div className="timing-advanced"><label>Function <select aria-label="Timing function occurrence" value={filter} onChange={e => { setFilter(e.target.value); setSelected(''); }}><option value="all">All occurrences</option>{demo.contracts.map(c => <option key={c.functionPath} value={c.functionPath}>{c.functionPath}</option>)}</select></label><label>Scale <select aria-label="Timing duration unit" value={unit} onChange={e => setUnit(e.target.value as Unit)}><option value="ms">Milliseconds</option><option value="ns">Nanoseconds</option></select></label></div><p className="timing-symbol-help">▽ release · ● dispatch · ○ complete · × failure or timeout · ◇ discarded reply · ┊ declared deadline</p></details></div>
    <p className="timing-description">{run.description}</p>
    <div className="timing-legend"><span><i style={{ background: colors.ready }}/>Ready</span><span><i style={{ background: colors.running }}/>Running / zero-time marker</span><span><i style={{ background: colors.requestWait }}/>Request wait</span><span>▽ release · ○ complete · × failure</span></div>
    <div className="timing-canvas" aria-label="Interactive function timing diagram"><ReactFlow<TimingNode> key={`${runId}-${filter}`} nodes={nodes} edges={[]} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.05, maxZoom: 1 }} minZoom={0.2} maxZoom={2} nodesConnectable={false} nodesDraggable={false} zoomOnScroll={false} preventScrolling={false}><Background gap={24} color="#e0e8e8"/><Controls showInteractive={false}/></ReactFlow></div>
    <p className="timing-boundary-note">Logical simulation time. Observed releases and waits are separate from declared WCET and deadline contracts.</p>
    {!!run.timing.stops.length && <div className="timing-stop">{run.timing.stops.map((stop, i) => <p key={i}><strong>{stop.code}</strong> at {duration(stop.point.timeNs, unit)} · {stop.detail}. Open lanes have no observed terminal event.</p>)}</div>}
    <details className="timing-contracts"><summary>Declared function contracts</summary><div className="timing-table-scroll"><table><thead><tr><th>Occurrence</th><th>Definition</th><th>WCET</th><th>Deadline from release</th><th>Concurrency</th></tr></thead><tbody>{demo.contracts.map(c => <tr key={c.functionPath}><th>{c.functionPath}</th><td>{c.definitionPath}</td><td>{duration(c.wcetNs, unit)}</td><td>{duration(c.deadlineNs, unit)}</td><td>{c.concurrency}</td></tr>)}</tbody></table></div></details>
    {activation && <details className="timing-selection"><summary>Activation trace and function source</summary><label>Inspect activation <select aria-label="Inspect timing activation" value={activation.id} onChange={e => setSelected(e.target.value)}>{projection.activations.map(a => <option key={a.id} value={a.id}>{a.functionPath} · {a.id}</option>)}</select></label><div className="timing-table-scroll"><table><thead><tr><th>Trace order</th><th>Logical time</th><th>Observation</th><th>Correlation / detail</th></tr></thead><tbody>{activation.markers.map(m => <tr key={m.point.ordinal}><td>#{m.point.ordinal}</td><td>{duration(m.point.timeNs, unit)}</td><td>{eventLabels[m.kind] ?? m.kind}</td><td>{[m.correlation, m.detail, m.line ? `source line ${m.line}` : undefined].filter(Boolean).join(' · ') || '—'}</td></tr>)}</tbody></table></div><details><summary>Inspect function source</summary><pre tabIndex={0}><code>{declaration?.source}</code></pre></details></details>}
    <details className="timing-source"><summary>Complete timing example</summary><pre tabIndex={0}><code>{source}</code></pre></details>
  </div>;
}
