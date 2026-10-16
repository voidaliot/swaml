import { useCallback, useEffect, useMemo, useState } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow } from '@xyflow/react';
import type { Edge, EdgeChange, Node, NodeChange, NodeProps } from '@xyflow/react';
import catalog from './architectures.json';
import { repository } from './model';

const files = import.meta.glob('../../examples/*.swaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
type Architecture = typeof catalog[number];
type Port = { name: string; role: string; contract: string; source: boolean };
type Part = Node<{ name: string; kind: string; definition: string; deployment: string; ports: Port[] }, 'part'>;

function PartNode({ data, selected }: NodeProps<Part>) {
  return <div className={`architecture-part ${selected ? 'selected' : ''}`}><span className="architecture-part-kind">«{data.kind}»</span><strong>{data.name} : {data.definition}</strong><div className="architecture-part-ports">{data.ports.map(port => <div key={port.name} className={`architecture-port ${port.source ? 'outgoing' : 'incoming'}`}><Handle type={port.source ? 'source' : 'target'} id={port.name} position={port.source ? Position.Right : Position.Left} /><span><b>{port.name}</b> · {port.role}</span><code>{port.contract}</code></div>)}</div><small>allocation · {data.deployment}</small></div>;
}
const nodeTypes = { part: PartNode };

function ArchitectureCanvas({ item, selected, onSelect }: { item: Architecture; selected: string; onSelect: (id: string) => void }) {
  const initial = useMemo(() => item.nodes.map(part => {
    const ports = new Map<string, Port>();
    for (const route of item.routes) {
      for (const source of [true, false]) {
        const [owner, name] = (source ? route.source : route.target).split('.');
        if (owner === part.id) ports.set(name, { name, contract: route.contract, role: source ? route.sourceRole : route.targetRole, source });
      }
    }
    return { id: part.id, type: 'part' as const, position: { x: part.x, y: part.y }, data: { name: part.id, kind: part.kind, definition: part.definition, deployment: part.deployment, ports: [...ports.values()] } };
  }), [item]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Part>(initial);
  const { fitView } = useReactFlow();
  // Parent selection is authoritative for both inspector buttons and graph interaction.
  // Consume user selection changes, not onSelectionChange echoes of controlled props.
  const changeNodes = useCallback((changes: NodeChange<Part>[]) => {
    const selection = changes.find(change => change.type === 'select' && change.selected);
    if (selection?.type === 'select') onSelect(selection.id);
    onNodesChange(changes.filter(change => change.type !== 'select'));
  }, [onNodesChange, onSelect]);
  const changeEdges = useCallback((changes: EdgeChange[]) => {
    const selection = changes.find(change => change.type === 'select' && change.selected);
    if (selection?.type === 'select') onSelect(selection.id);
  }, [onSelect]);
  const selectedNodes = useMemo(() => nodes.map(node => ({ ...node, selected: node.id === selected })), [nodes, selected]);
  const edges: Edge[] = item.routes.map(route => ({ id: route.id, source: route.source.split('.')[0], sourceHandle: route.source.split('.')[1], target: route.target.split('.')[0], targetHandle: route.target.split('.')[1], label: route.id, type: 'default', selected: selected === route.id, markerEnd: { type: MarkerType.ArrowClosed, color: '#34577b' }, style: { stroke: selected === route.id ? '#b85e38' : '#34577b', strokeWidth: selected === route.id ? 2.5 : 1.5 }, labelStyle: { fontSize: 12, fill: '#23364d' }, labelBgPadding: [7, 5], labelBgStyle: { fill: '#f5f7fa' } }));
  return <div className="architecture-canvas" aria-label={`${item.title} architecture diagram`}><ReactFlow<Part> nodes={selectedNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={changeNodes} onEdgesChange={changeEdges} onNodeClick={(_, node) => onSelect(node.id)} onEdgeClick={(_, edge) => onSelect(edge.id)} fitView fitViewOptions={{ padding: 0.12, maxZoom: 0.95 }} minZoom={0.2} maxZoom={1.8} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null}><Background gap={20} color="#d4dce6" /><Controls showInteractive={false} /></ReactFlow><button className="reset-layout" onClick={() => { setNodes(initial); requestAnimationFrame(() => void fitView({ padding: 0.12, maxZoom: 0.95, duration: 200 })); }}>Reset layout</button></div>;
}

export function Architectures() {
  const [active, setActive] = useState(catalog[0].id);
  const [selected, setSelected] = useState(catalog[0].nodes[1].id);
  const [showSource, setShowSource] = useState(false);
  const [download, setDownload] = useState('');
  const item = catalog.find(entry => entry.id === active)!;
  const source = files[`../../examples/${item.file}`] ?? '';
  const part = item.nodes.find(node => node.id === selected);
  const route = item.routes.find(route => route.id === selected);
  const related = part ? item.routes.filter(route => route.source.startsWith(`${part.id}.`) || route.target.startsWith(`${part.id}.`)) : [];
  const contract = route ? source.match(new RegExp(`interface ${route.kind} ${route.contract} version "[^"\\n]+" \\{[^}]*\\}`))?.[0] : '';
  const connector = route ? source.match(new RegExp(`connect ${route.id}:[^{};]*(?:\\{[^}]*\\})?;`))?.[0] : '';
  const policyName = connector?.match(/qos\s+(\w+);/)?.[1];
  const policy = policyName ? source.match(new RegExp(`qos def ${policyName} \\{[^}]*\\}`))?.[0] : '';
  useEffect(() => { const url = URL.createObjectURL(new Blob([source], { type: 'text/plain;charset=utf-8' })); setDownload(url); return () => URL.revokeObjectURL(url); }, [source]);
  return <section id="architectures" className="architecture-section" aria-labelledby="architectures-title">
    <div className="section-intro"><div><span className="eyebrow">DOMAIN ARCHITECTURES / VALIDATED SOURCE MODELS</span><h2 id="architectures-title">Embedded, application and cloud systems</h2></div><p>Four complete models using the same language.<br />Select an instance or connector to inspect its contract.</p></div>
    <div className="architecture-tabs" role="group" aria-label="Architecture examples">{catalog.map(entry => <button key={entry.id} aria-pressed={active === entry.id} onClick={() => { setActive(entry.id); setSelected(entry.nodes[1].id); setShowSource(false); }}><strong>{entry.title}</strong><span>{entry.subtitle}</span></button>)}</div>
    <div className="architecture-summary"><div><span className="eyebrow">{item.package}::{item.root}</span><h3>{item.subtitle}</h3><p>{item.description}</p></div><span className="architecture-focus">{item.focus}</span></div>
    <div className="architecture-workspace"><ReactFlowProvider key={item.id}><ArchitectureCanvas item={item} selected={selected} onSelect={setSelected} /></ReactFlowProvider><aside className="architecture-inspector" aria-label="Domain architecture properties" aria-live="polite"><span className="eyebrow">{route ? 'CONNECTOR' : `${part?.kind} OCCURRENCE`}</span><h3>{selected}</h3><code className="architecture-identity">{item.package}::{item.root}.{selected}</code>{part && <><p>{part.description}</p><dl><div><dt>Definition</dt><dd><code>{item.package}::{part.definition}</code></dd></div><div><dt>Deployment</dt><dd><code>{part.deployment}</code></dd></div></dl><span className="eyebrow">CONNECTED CONTRACTS</span><div className="architecture-related">{related.map(route => <button key={route.id} onClick={() => setSelected(route.id)}><strong>{route.id} ↗</strong><span>{route.contract}</span></button>)}</div></>}{route && <><p><code>{route.source}</code> → <code>{route.target}</code></p><dl><div><dt>Interface kind</dt><dd>{route.kind}</dd></div><div><dt>Roles</dt><dd>{route.sourceRole} → {route.targetRole}</dd></div></dl><pre tabIndex={0} aria-label="Domain interface declaration"><code>{contract}</code></pre><pre tabIndex={0} aria-label="Domain connector declaration"><code>{connector}</code></pre>{policy && <pre tabIndex={0} aria-label="Domain QoS policy"><code>{policy}</code></pre>}<p className="architecture-route-note">{route.kind === 'service' ? `The arrow follows requests to the provider. Correlated replies${contract?.includes('event ') ? ' and service events' : ''} return along this route.` : route.kind === 'clientServer' ? 'The arrow follows requests to the server. Results return with the original request correlation.' : 'Data or events travel in the connector direction. Each connector owns its communication queues.'}</p></>}</aside></div>
    <div className="contract-source architecture-source"><button className="button button-quiet" aria-expanded={showSource} onClick={() => setShowSource(!showSource)}>{showSource ? 'Hide' : 'Show'} architecture source</button><a href={download} download={item.file}>Download model</a><a href={`${repository}/blob/main/examples/${item.file}`} target="_blank" rel="noreferrer">{item.file} ↗</a>{showSource && <pre tabIndex={0} aria-label="Complete architecture source"><code>{source}</code></pre>}</div>
    <p className="architecture-footnote">These diagrams show logical components, ports and routes. Platform bindings for RTE, ara::com, HTTP and broker middleware belong to the implementation architecture. <a href={`${repository}/blob/main/docs/ARCHITECTURE_PATTERNS.md`} target="_blank" rel="noreferrer">Read the domain mapping guide ↗</a></p>
  </section>;
}
