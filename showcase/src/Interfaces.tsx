import { useMemo, useState } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import catalog from './contracts.json';
import { repository } from './model';

const files = import.meta.glob('../../examples/*.swaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
type Endpoint = Node<{ name: string; role: string; contract: string; side: 'left' | 'right' }, 'endpoint'>;
function EndpointNode({ data }: NodeProps<Endpoint>) {
  return <div className="contract-endpoint"><span>«port» · {data.role}</span><strong>{data.name}</strong><code>{data.contract}</code><Handle type={data.side === 'right' ? 'source' : 'target'} position={data.side === 'right' ? Position.Right : Position.Left} /><Handle id="reverse" type={data.side === 'right' ? 'target' : 'source'} position={Position.Bottom} /></div>;
}
const nodeTypes = { endpoint: EndpointNode };

export function Interfaces() {
  const [active, setActive] = useState(catalog[0].id);
  const [showComplete, setShowComplete] = useState(false);
  const item = catalog.find(entry => entry.id === active)!;
  const source = files[`../../examples/${item.file}`];
  // Interface bodies contain signatures, with no nested blocks in SWAML 1.2.
  const declaration = source.match(new RegExp(`interface ${item.kind} ${item.contract} version "[^"\\n]+" \\{[^}]*\\}`))?.[0] ?? '';
  const policy = source.match(new RegExp(`connect ${item.connector}:[^{};]*(?:\\{[^}]*\\})?;`))?.[0] ?? '';
  const [inspected, setInspected] = useState<'source' | 'target'>('source');
  const hasReply = item.kind === 'service' || item.kind === 'clientServer';
  const nodes: Endpoint[] = useMemo(() => [
    { id: 'source', type: 'endpoint', position: { x: 0, y: 40 }, data: { name: item.source, role: item.sourceRole, contract: item.contract, side: 'right' } },
    { id: 'target', type: 'endpoint', position: { x: 480, y: 40 }, data: { name: item.target, role: item.targetRole, contract: item.contract, side: 'left' } },
  ], [item]);
  const edges = [
    { id: 'route', source: 'source', target: 'target', label: `${item.connector} / ${hasReply ? 'request' : item.kind === 'publishSubscribe' ? 'publish' : 'send'}`, type: 'straight', markerEnd: { type: MarkerType.ArrowClosed, color: '#34577b' }, style: { stroke: '#34577b' } },
    ...(hasReply ? [{ id: 'response', source: 'target', target: 'source', sourceHandle: 'reverse', targetHandle: 'reverse', type: 'smoothstep', label: 'correlated reply', markerEnd: { type: MarkerType.Arrow, color: '#34577b' }, style: { stroke: '#34577b', strokeDasharray: '5 4' }, pathOptions: { offset: 55 } }] : []),
    ...(item.kind === 'service' ? [{ id: 'notification', source: 'target', target: 'source', sourceHandle: 'reverse', targetHandle: 'reverse', type: 'smoothstep', label: 'publish changed(current)', markerEnd: { type: MarkerType.ArrowClosed, color: '#34577b' }, style: { stroke: '#34577b' }, pathOptions: { offset: 115 } }] : []),
  ];
  return <section id="interfaces" className="interface-section" aria-labelledby="interfaces-title">
    <div className="section-intro"><div><span className="eyebrow">CONTRACT REFERENCE / FOUR INTERFACE KINDS</span><h2 id="interfaces-title">Interfaces and communication</h2></div><p>Select a communication pattern to inspect its contract, roles and route.</p></div>
    <div className="contract-tabs" role="group" aria-label="Interface patterns">{catalog.map(entry => <button key={entry.id} aria-pressed={active === entry.id} onClick={() => { setActive(entry.id); setInspected('source'); setShowComplete(false); }}>{entry.title}<code>{entry.kind}</code></button>)}</div>
    <div className="contract-reference">
      <div className="contract-definition"><span className="eyebrow">«interface» {item.kind}</span><h3>{item.package}::{item.contract}</h3><p>{item.use}</p><pre aria-label="Interface declaration"><code>{declaration}</code></pre><dl><div><dt>Connection cardinality</dt><dd>{item.cardinality} Optional ports may be unbound.</dd></div><div><dt>Contract obligations</dt><dd>{item.constraint}</dd></div></dl></div>
      <div className="contract-interaction"><div className="contract-graph" aria-label={`${item.title} route`}>
        <ReactFlow key={item.id} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.2} maxZoom={1.5} fitViewOptions={{ padding: 0.22, maxZoom: 1 }} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} onNodeClick={(_, node) => setInspected(node.id as 'source' | 'target')} onSelectionChange={({ nodes: selected }) => { if (selected[0]) setInspected(selected[0].id as 'source' | 'target'); }}><Background gap={20} color="#d9e0e8" /><Controls showInteractive={false} /></ReactFlow>
      </div><div className="contract-route-details" aria-live="polite"><span className="eyebrow">SELECTED ENDPOINT / {item[inspected === 'source' ? 'sourceRole' : 'targetRole']}</span><code>{item.package}::{item.owner}.{item[inspected]}</code><p>Endpoint projection of the named connector. Squares identify ports; arrows show direction. {hasReply ? 'The dashed return is a correlated reply, not a second connector.' : 'This contract carries data or events in the connector direction.'}</p><pre><code>{policy}</code></pre>{item.id === 'service' && <p><code>LocalLink</code> selects complete policy values; frontLink and rearLink retain separate queues.</p>}</div></div>
    </div>
    <div className="contract-source"><button className="button button-quiet" aria-expanded={showComplete} onClick={() => setShowComplete(!showComplete)}>{showComplete ? 'Hide' : 'Show'} complete example</button><span>{item.file}</span><a href={`${repository}/blob/main/examples/${item.file}`} target="_blank" rel="noreferrer">Repository source ↗</a>{showComplete && <pre tabIndex={0} aria-label="Complete interface example"><code>{source}</code></pre>}</div>
  </section>;
}
