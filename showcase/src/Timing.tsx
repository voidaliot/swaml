import model from './generated/model.json';

const contracts: Array<{ subject: string; name: string; trigger: string; target: string; periodNs?: number; deadlineNs?: number }> = model.projection.nodes.filter(n => n.kind === 'component' && /^Control::Demo\.[^.]+$/.test(n.id))
  .flatMap(n => (n.schedule ?? []).map(s => ({ ...s, subject: `Demo.${n.name}.${s.target}`, name: `${n.name}.${s.target}` })));
const horizon = model.run.untilNs;
const domain = Math.ceil(horizon / 5_000_000) * 5_000_000;
const x = (ns: number) => 230 + ns / domain * 700;
const ms = (ns: number) => `${Number((ns / 1_000_000).toFixed(3))} ms`;

export function Timing({ observed }: { observed: boolean }) {
  return <svg className="architecture-svg timing-diagram" viewBox="0 0 960 370" role="img" aria-label={observed ? 'Observed operation timing on a shared logical time ruler, with wait spans, completion events and separate declared deadlines' : 'Declared schedule releases and deadlines; no observed execution is shown'}>
    <text className="node-meta" x={14} y={22}>OPERATION / SCHEDULE</text><text className="node-meta" x={230} y={22}>LOGICAL TIME (ms)</text>
    {Array.from({ length: domain / 5_000_000 + 1 }, (_, i) => i * 5_000_000).map(t => <g key={t}>
      <path className="time-grid" d={`M${x(t)} 52V315`}/><text className="node-meta" x={x(t)} y={43} textAnchor="middle">{t / 1_000_000}</text>
    </g>)}
    <path className="time-lane" d="M230 52H930"/>
    {contracts.map((c, i) => {
      const top = 76 + i * 82, baseline = top + 36;
      const intervals = model.timing.intervals.filter(v => v.subject === c.subject);
      const releases = observed ? intervals.filter(v => v.phase === 'release').map(v => v.startNs)
        : c.periodNs ? Array.from({ length: Math.floor(horizon / c.periodNs) }, (_, j) => (j + 1) * c.periodNs!) : c.trigger === 'start' ? [0] : [];
      return <g key={c.subject}>
        <text className="lane-label" x={14} y={top + 10}>{c.name}</text>
        <text className="node-meta" x={14} y={top + 28}>{c.periodNs ? `every ${ms(c.periodNs)}` : c.trigger}</text>
        <text className="node-meta" x={14} y={top + 45}>{c.deadlineNs ? `deadline ${ms(c.deadlineNs)}` : 'no declared deadline'}</text>
        <path className="time-lane" d={`M230 ${baseline}H${x(horizon)}`}/>
        {releases.map((t, j) => <g key={j}>
          {!observed && <path className="release-marker" d={`M${x(t)} ${top + 4}V${baseline}m-4-26 4-6 4 6`}><title>Declared release at {ms(t)}</title></path>}
          {c.deadlineNs !== undefined && t + c.deadlineNs <= domain && <path className="deadline-marker" d={`M${x(t + c.deadlineNs)} ${top}V${baseline + 7}m-4-${baseline + 7 - top}h8`}><title>Declared deadline at {ms(t + c.deadlineNs)}, measured from release at {ms(t)}</title></path>}
        </g>)}
        {observed && intervals.map((interval, j) => {
          const start = x(interval.startNs), end = x(interval.endNs ?? horizon), waiting = /wait/i.test(interval.phase), level = waiting ? top + 20 : top + 6;
          return <g key={j}><title>{interval.activation}: {interval.phase}, {interval.startNs}–{interval.endNs ?? horizon} ns{interval.endNs === undefined ? ' (open at horizon)' : ''}</title>
            {end > start && <rect className="timing-span" x={start} y={level} width={end - start} height={baseline - level}/>}
            <path className={waiting || interval.endNs === undefined ? 'timing-wave waiting' : 'timing-wave'} d={`M${start} ${baseline}V${level}${end === start ? '' : `H${end}${interval.endNs === undefined ? '' : `V${baseline}`}`}`}/>
            {waiting && end > start && <text className="node-meta" x={(start + end) / 2} y={top - 5} textAnchor="middle">{ms((interval.endNs ?? horizon) - interval.startNs)}</text>}
          </g>;
        })}
        {observed && model.run.trace.filter(e => e.subject === c.subject && ['complete','failure','timeout','interrupt'].includes(e.kind)).map(e => <path key={e.ordinal} className="timing-event" d={`M${x(e.timeNs)} ${baseline - 5}l5 5-5 5-5-5Z`}><title>{e.kind} · event {e.ordinal} · {e.timeNs} ns</title></path>)}
        {observed && <path className="time-horizon" d={`M${x(horizon)} ${top - 5}V${baseline + 7}`}/>}
      </g>;
    })}
    <text className="node-meta" x={230} y={335}>{observed ? `Observed horizon ${ms(horizon)} · dashed spans: waiting / lock released · ◇ completion` : 'Release ticks and deadlines are schedule contracts, not measured execution.'}</text>
    <text className="node-meta" x={230} y={355}>{observed ? 'Dashed ticks: declared deadlines · reference steps have zero physical CPU cost.' : 'Receive-triggered operations have no time coordinate until an identified run.'}</text>
  </svg>;
}
