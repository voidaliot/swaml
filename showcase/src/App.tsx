import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow } from '@xyflow/react';
import type { Edge, NodeProps } from '@xyflow/react';
import { DiagramGallery, diagramChoices } from './DiagramGallery';
import type { DiagramId } from './DiagramGallery';
import { Ontology } from './Ontology';
import { BoundaryPort, ClassifierGlyph, PortLegend } from './DiagramGlyphs';

import { byId, diagram, entities, lifecycleSource, repository, source, views } from './model';
import type { CardData, DiagramNode, Entity, ViewId } from './model';


const Traceability = lazy(() => import('./Traceability').then(module => ({ default: module.Traceability })));
const Interfaces = lazy(() => import('./Interfaces').then(module => ({ default: module.Interfaces })));
const Architectures = lazy(() => import('./Architectures').then(module => ({ default: module.Architectures })));
const FunctionTiming = lazy(() => import('./FunctionTiming').then(module => ({ default: module.FunctionTiming })));
const InterruptFlow = lazy(() => import('./InterruptFlow').then(module => ({ default: module.InterruptFlow })));
const ModelingOverview = lazy(() => import('./ModelingOverview').then(module => ({ default: module.ModelingOverview })));
const QuickStart = lazy(() => import('./QuickStart').then(module => ({ default: module.QuickStart })));
const StructureView = lazy(() => import('./Structure').then(module => ({ default: module.StructureView })));

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    arrow: 'M4 12h16m-6-6 6 6-6 6', external: 'M14 4h6v6m0-6L10 14M9 4H4v16h16v-5',
    grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    layers: 'M3 4h18v16H3zM3 9h18M8 13h8m-8 3h5',
    connect: 'M3 5h6v6H3zm12 8h6v6h-6zM9 8h9v5M6 11v5h9',
    case: 'M5 4h14v17H5zM8 8h8m-8 4h8m-8 4h5',
    sequence: 'M5 3v18M19 3v18M5 8h14m-4-4 4 4-4 4m4 5H5m4-4-4 4 4 4',
    flow: 'M9 3h6v5H9zM3 16h6v5H3zm12 0h6v5h-6zM12 8v4M6 16v-4h12v4',
    tree: 'M4 4v15h16M4 8h9m-9 6h13M13 5v6M17 11v6',
    code: 'm8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18',
    search: 'M15 15l6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
    reset: 'M4 10a8 8 0 1 1 2 8M4 4v6h6', close: 'm5 5 14 14M19 5 5 19',
    download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    fit: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',
    github: 'M9 19c-4 1-4-2-6-2m12 5v-4c0-1-.3-2-1-2 4-.5 6-2 6-6 0-1-.5-3-1.5-4 .4-1 .3-2-.2-3-2 0-3 1-4 1-2-.5-4-.5-6 0-1 0-2-1-4-1-.5 1-.6 2-.2 3C3 7 3 9 3 10c0 4 2 5.5 6 6-.7.5-1 1-1 2v4',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.grid} /></svg>;
}

export function FlatNode({ data, selected }: NodeProps<DiagramNode>) {
  const vertical = data.vertical;
  return <div className={`model-node node-${data.variant || 'component'} ${selected ? 'is-selected' : ''}`}>
    {!data.boundaryPorts && <Handle type="target" position={vertical ? Position.Top : Position.Left} className={data.portSide === 'left' || data.inputPort ? 'port-handle visible-port' : 'port-handle'} />}
    <div className="node-eyebrow">{!data.variant || ['component', 'definition', 'root'].includes(data.variant) ? <ClassifierGlyph kind={data.classifierKind} decorative className="semantic-classifier-mark"/> : <span className="kind-mark"/>}{data.eyebrow}</div>
    <div className="node-title">{data.title}</div>
    {data.inputPort && <div className="port-label port-left">{data.inputPort}</div>}
    {data.port && <div className={`port-label port-${data.portSide}`}>{data.port}</div>}
    {data.boundaryPorts?.map(port => <div key={port.name} className={`port-label port-${port.side} semantic-port-row`}><BoundaryPort {...port}/><strong>{port.name} : {port.contract}</strong><span>@ {port.version} · {port.role}{port.optional ? ' · optional' : ''}</span></div>)}
    {data.detail && <div className="node-detail">{data.detail}</div>}
    {data.footer && <div className="node-footer">{data.footer}</div>}
    {!data.boundaryPorts && <Handle type="source" position={vertical ? Position.Bottom : Position.Right} className={data.portSide === 'right' ? 'port-handle visible-port' : 'port-handle'} />}
    {data.variant === 'state' && <><Handle id="bottom" type="source" position={Position.Bottom} className="port-handle" /><Handle id="bottom" type="target" position={Position.Bottom} className="port-handle" /></>}
  </div>;
}
const nodeTypes = { card: FlatNode };

function Canvas({ view, stateMode, onSelect }: { view: ViewId; stateMode: boolean; onSelect: (id: string, nodeData?: CardData) => void }) {
  const initial = useMemo(() => diagram(view, stateMode), [view, stateMode]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const { fitView } = useReactFlow();
  useEffect(() => { setNodes(initial.nodes); }, [initial, setNodes]);
  const selectionChange = useCallback(({ nodes: selectedNodes }: { nodes: DiagramNode[] }) => {
    const node = selectedNodes[0];
    if (node) onSelect(node.data.entityId || node.id, node.data);
  }, [onSelect]);
  const reset = () => { setNodes(initial.nodes); requestAnimationFrame(() => { void fitView({ padding: 0.2, duration: 250 }); }); };
  const selectEdge = (_: React.MouseEvent, edge: Edge) => onSelect(edge.id);
  return <><div className="diagram-canvas">
    <ReactFlow<DiagramNode>
      key={`${view}-${stateMode}`} nodes={nodes} edges={initial.edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.data.entityId || node.id, node.data)} onEdgeClick={selectEdge}
      onSelectionChange={selectionChange}
      fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }} minZoom={0.22} maxZoom={1.7}
      nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} selectionKeyCode={null}
      proOptions={{ hideAttribution: false }} ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': 'Zoom in', 'controls.zoomOut.ariaLabel': 'Zoom out', 'controls.fitView.ariaLabel': 'Fit model to canvas' }}
    >
      <Background variant={BackgroundVariant.Dots} color="#c8d0c6" gap={20} size={1} />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
    <div className="canvas-subject"><span className="subject-dot" />{stateMode ? 'Lifecycle::Device.lifecycle' : views.find((v) => v.id === view)?.subject}<span className="canvas-subject-tag">{stateMode ? 'state body' : view === 'iv' ? 'root instance' : 'projection'}</span></div>
    <button className="reset-layout" onClick={reset}><Icon name="reset" size={14} />Reset layout</button>
    <div className="canvas-hint">Drag nodes to arrange · select to inspect</div>
  </div>{view === 'iv' && <PortLegend/>}</>;
}

const treeEntries: [string, number, string?][] = [
  ['package', 0], ['contract', 1], ['input-contract', 1], ['policy', 1], ['store-def', 1], ['panel-def', 1], ['service-def', 1], ['client-def', 1],
  ['root', 1], ['input-driver', 2], ['settings', 2], ['store', 3], ['update', 4], ['front', 2], ['front-panel', 3], ['rear', 2], ['rear-panel', 3],
  ['adjustCommand', 2], ['frontLink', 2], ['rearLink', 2], ['controller', 2], ['displays', 2], ['requirement', 1], ['case', 1],
];

function BrowserPanel({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const filtered = treeEntries.filter(([id]) => `${byId[id].path} ${byId[id].kind}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="browser-panel">
    <div className="surface-heading"><span className="eyebrow">MODEL OWNERSHIP</span><h3>Declarations and instances</h3><p>Definitions describe reusable types. Instances retain their own paths and private stores.</p></div>
    <label className="search-field"><Icon name="search" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a name, kind or path…" aria-label="Filter model browser" /></label>
    <div className="browser-list" aria-label="Curated model inventory">
      {filtered.map(([id, level]) => <button key={id} className={`browser-row ${selected === id ? 'selected' : ''}`} onClick={() => onSelect(id)} style={{ paddingLeft: 20 + (query ? 0 : level * 21) }}><span className="tree-joint">{['package', 'root', 'settings', 'front', 'rear'].includes(id) ? '⌄' : '·'}</span><Icon name={byId[id].kind.includes('Connector') ? 'connect' : byId[id].kind.includes('Function') ? 'flow' : byId[id].kind.includes('Requirement') ? 'case' : 'layers'} size={16} /><span>{byId[id].name}</span><small>{byId[id].kind}</small></button>)}
      {filtered.length === 0 && <p className="empty-state">No matching elements. Try “panel”, “connector” or “Settings”.</p>}
    </div>
    <p className="surface-footnote">Curated navigation for this fixture. The source file contains the complete model.</p>
  </div>;
}

function GridPanel({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [ascending, setAscending] = useState(true);
  const rows = entities.filter((e) => `${e.name} ${e.kind} ${e.path}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (ascending ? 1 : -1) * a.path.localeCompare(b.path));
  return <div className="grid-panel">
    <div className="grid-toolbar"><span>{rows.length} elements <small>· curated inventory</small></span><label className="search-field"><Icon name="search" size={16} /><input placeholder="Filter inventory…" aria-label="Filter grid" value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>
    <div className="table-scroll"><table><thead><tr><th>Element</th><th>Kind</th><th><button onClick={() => setAscending(!ascending)}>Identity {ascending ? '↑' : '↓'}</button></th><th>Owner / context</th></tr></thead><tbody>{rows.map((e) => <tr key={e.id} className={selected === e.id ? 'selected-row' : ''}><td><button onClick={() => onSelect(e.id)}>{e.name}</button></td><td><span className="table-kind">{e.kind}</span></td><td><code>{e.path}</code></td><td><code>{e.owner}</code></td></tr>)}</tbody></table>{rows.length === 0 && <p className="empty-state">No matching elements.</p>}</div>
    <p className="surface-footnote">Select a row for contracts, effective allocation, QoS and source. Sorting changes presentation only.</p>
  </div>;
}

function SequencePanel({ onSelect }: { onSelect: (id: string) => void }) {
  return <div className="sequence-panel">
    <div className="sequence-callout"><span className="tag">CASE / Change</span><span>Dependency order, with independent notification branches.</span></div>
    <div className="sequence-scroll"><svg className="sequence-svg" viewBox="0 0 760 455" role="img" aria-label="Change case sequence: adjust request, two independent notifications after adjust, and accepted reply after frontNotice. The reply correlates to adjust.">
      <defs><marker id="seq-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z" fill="#52695a" /></marker><marker id="reply-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="m1 1 7 3.5-7 3.5" fill="none" stroke="#52695a" /></marker></defs>
      {[['front : Client', 120, 'front'], ['settings : Service', 380, 'settings'], ['rear : Client', 640, 'rear']].map(([label, x, id]) => <g key={id} role="button" tabIndex={0} aria-label={`Inspect ${label}`} onClick={() => onSelect(String(id))} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(String(id)); } }}><rect x={Number(x) - 96} y="16" width="192" height="64" rx="3" fill="#fff" stroke="#a1b0a2" /><text x={x} y="42" textAnchor="middle" className="seq-kind">component instance</text><text x={x} y="64" textAnchor="middle" className="seq-title">{label}</text><path d={`M${x} 80V425`} stroke="#b8c1b6" strokeDasharray="5 5" /></g>)}
      <rect x="45" y="195" width="670" height="139" rx="3" fill="#ecf1e8" stroke="#c5d1c0" strokeDasharray="4 4" />
      <text x="60" y="216" className="seq-note">INDEPENDENT BRANCHES · both after adjust</text>
      <path d="M120 143H380" stroke="#52695a" strokeWidth="1.6" markerEnd="url(#seq-arrow)" /><text x="250" y="117" textAnchor="middle" className="seq-message">adjust / request setPoint</text><text x="250" y="133" textAnchor="middle" className="seq-route">front.setting → settings.api · frontLink</text>
      <path d="M380 263H120" stroke="#52695a" strokeWidth="1.6" markerEnd="url(#seq-arrow)" /><text x="250" y="239" textAnchor="middle" className="seq-message">frontNotice / publish changed</text><text x="250" y="254" textAnchor="middle" className="seq-route">settings.api → front.setting · frontLink</text>
      <path d="M380 312H640" stroke="#52695a" strokeWidth="1.6" markerEnd="url(#seq-arrow)" /><text x="510" y="288" textAnchor="middle" className="seq-message">rearNotice / publish changed</text><text x="510" y="303" textAnchor="middle" className="seq-route">settings.api → rear.setting · rearLink</text>
      <path d="M380 395H120" stroke="#52695a" strokeWidth="1.6" strokeDasharray="5 4" markerEnd="url(#reply-arrow)" /><text x="250" y="367" textAnchor="middle" className="seq-message">accepted / reply setPoint</text><text x="250" y="384" textAnchor="middle" className="seq-route">after frontNotice · correlation: adjust</text>
    </svg></div>
    <div className="sequence-dependencies"><span>adjust → frontNotice → accepted</span><span>adjust → rearNotice</span></div>
    <p className="surface-footnote">Vertical spacing is layout. There is no declared order between rearNotice and frontNotice or accepted. Payloads and an execution witness are not specified by this case.</p>
  </div>;
}

function Inspector({ item, onSource, onClose }: { item: Entity; onSource: () => void; onClose: () => void }) {
  return <aside id="diagram-properties" className="inspector" aria-label="Selected element properties" aria-live="polite">
    <div className="inspector-caption">ELEMENT DETAILS <button type="button" className="icon-button" onClick={onClose} aria-label="Close element details"><Icon name="close" size={16}/></button></div>
    <div className="inspector-symbol"><Icon name={item.kind.includes('Connector') ? 'connect' : item.kind.includes('Function') || item.kind === 'State' ? 'flow' : 'layers'} size={23} /></div>
    <span className="eyebrow">{item.kind}</span><h3>{item.name}</h3><p className="inspector-description">{item.description}</p>
    <div className="identity"><span>IDENTITY</span><code>{item.path}</code></div>
    {item.definition && <div className="identity"><span>DEFINITION</span><code>{item.definition}</code></div>}
    <dl className="properties"><div><dt>Owner</dt><dd>{item.owner}</dd></div>{item.properties.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    <button className="source-link" onClick={onSource}><Icon name="code" size={15} />Inspect source<Icon name="arrow" size={15} /></button>
  </aside>;
}

const modelSources: Record<string, () => Promise<string>> = {
  '../../examples/08-service-field.swaml': () => Promise.resolve(source),
  '../../examples/04-stateful-function.swaml': () => Promise.resolve(lifecycleSource),
  '../../examples/16-requirements-and-views.swaml': () => import('../../examples/16-requirements-and-views.swaml?raw').then(module => module.default),
  '../../examples/17-function-timing.swaml': () => import('../../examples/17-function-timing.swaml?raw').then(module => module.default),
  '../../examples/19-interruptible-function.swaml': () => import('../../examples/19-interruptible-function.swaml?raw').then(module => module.default),
};

function SourceDialog({ filename, close }: { filename: string; close: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const [download, setDownload] = useState('');
  useEffect(() => {
    dialogRef.current?.showModal();
    let active = true;
    const load = modelSources[`../../examples/${filename}`];
    if (load) void load().then(value => { if (active) setText(value); }).catch(() => { if (active) setError(true); });
    else setError(true);
    return () => { active = false; };
  }, [filename]);
  useEffect(() => {
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    setDownload(url);
    return () => URL.revokeObjectURL(url);
  }, [text]);
  return <dialog ref={dialogRef} className="source-dialog" onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }} aria-labelledby="source-title">
    <div className="source-dialog-head"><div><span className="eyebrow">EXAMPLE MODEL</span><h3 id="source-title">{filename}</h3></div><button className="icon-button" onClick={close} aria-label="Close source"><Icon name="close"/></button></div>
    {text ? <pre tabIndex={0} aria-label="Model source">{text.split('\n').map((line, i) => <span className="source-line" key={i}><span className="line-number" aria-hidden="true">{i + 1}</span><code>{line || ' '}</code></span>)}</pre> : <p className="source-dialog-description" role="status">{error ? 'Source could not be loaded. You can open it on GitHub below.' : 'Loading model source…'}</p>}
    <div className="source-dialog-actions">{download && <a className="button button-ink" href={download} download={filename}><Icon name="download" size={16}/>Download model</a>}<button className="button button-quiet" disabled={!text} onClick={() => { void navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Copied' : 'Copy source'}</button><a href={`${repository}/blob/main/examples/${filename}`} target="_blank" rel="noreferrer">Open on GitHub ↗</a></div>
  </dialog>;
}

type ExplorerId = DiagramId | 'Browser';
type ResourceId = 'start' | 'walkthrough' | 'examples' | 'interfaces' | 'coverage';

function initialSelection(id: ExplorerId): Entity {
  if (id === 'states') return { id: 'lifecycle', kind: 'Function', name: 'lifecycle()', path: 'Lifecycle::Device.lifecycle', owner: 'Lifecycle::Device', description: 'The function owns its Idle, Running and final Stopped states and their transitions.', properties: [['Model source', '04-stateful-function.swaml'], ['Trigger', 'on start']], snippet: 'function lifecycle() on start {' };
  if (id === 'timing') return { id: 'timing-root', kind: 'Execution root', name: 'Demo', path: 'FunctionTiming::Demo', owner: 'FunctionTiming', description: 'Two independent clients and servers provide the function activations shown in this timing example.', properties: [['Model source', '17-function-timing.swaml']], snippet: 'component Demo {' };
  if (id === 'interrupts') return { id: 'interrupt-function', kind: 'Function', name: 'run()', path: 'Interrupts::App.worker.run', owner: 'Interrupts::App.worker', description: 'A typed stop event interrupts protected work inside this function.', properties: [['Model source', '19-interruptible-function.swaml']], snippet: 'function run() on start {' };
  return byId[id === 'cv' || id === 'sv' ? 'case' : id === 'flow' ? 'update' : id === 'Browser' || id === 'grv' ? 'package' : id === 'iv' ? 'settings' : 'root'];
}

function diagramFromHash(): ExplorerId | undefined {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash;
  const id = hash.replace(/^#diagrams\//, '');
  if (id === 'Browser' || diagramChoices.some(item => item.id === id)) return id as ExplorerId;
}

function Resource({ id, title, description, open, onToggle, children }: {
  id: string; title: string; description: string; open: boolean;
  onToggle: (open: boolean) => void; children: React.ReactNode;
}) {
  return <details id={id} className="learn-resource" open={open} onToggle={event => onToggle(event.currentTarget.open)}>
    <summary><span><strong>{title}</strong><span>{description}</span></span><span className="resource-expand" aria-hidden="true">+</span></summary>
    {open && <Suspense fallback={<p className="resource-loading" role="status">Loading example…</p>}><div className="resource-content">{children}</div></Suspense>}
  </details>;
}

function App() {
  const [active, setActive] = useState<ExplorerId>(() => diagramFromHash() ?? 'iv');
  const choice = diagramChoices.find(item => item.id === active);
  const view: ViewId = choice?.view ?? 'Browser';
  const flowMode = choice?.mode ?? 'flow';
  const stateMode = view === 'fv' && flowMode === 'states';
  const [selected, setSelected] = useState<Entity>(() => initialSelection(diagramFromHash() ?? 'iv'));
  const [showDetails, setShowDetails] = useState(false);
  const openDetails = useCallback(() => setShowDetails(true), []);
  const [showSource, setShowSource] = useState(false);
  const detailsButton = useRef<HTMLButtonElement>(null);
  const [resources, setResources] = useState<Partial<Record<ResourceId, boolean>>>({});
  const setResource = useCallback((id: ResourceId, open: boolean) => {
    setResources(previous => previous[id] === open ? previous : { ...previous, [id]: open });
  }, []);

  const changeDiagram = useCallback((id: ExplorerId) => {
    setActive(id);
    setShowDetails(false);
    setShowSource(false);
    setSelected(initialSelection(id));
  }, []);
  const chooseDiagram = (id: ExplorerId) => {
    changeDiagram(id);
    window.history.replaceState(null, '', `#diagrams/${id}`);
  };
  useEffect(() => {
    const followHash = () => {
      const id = diagramFromHash();
      if (id) changeDiagram(id);
      const hash = window.location.hash;
      const resource: ResourceId | undefined = hash === '#traceability' ? 'coverage' : hash === '#quick-start' || hash === '#resource-start' ? 'start' : hash === '#architectures' || hash === '#resource-examples' ? 'examples' : hash === '#interfaces' || hash === '#resource-interfaces' ? 'interfaces' : hash === '#modeling-walkthrough' || hash === '#resource-walkthrough' ? 'walkthrough' : hash === '#resource-coverage' ? 'coverage' : undefined;
      if (resource) setResource(resource, true);
      const target = resource ? `resource-${resource}` : id || hash === '#explorer' ? 'diagrams' : hash === '#modeling-overview' ? 'ontology' : undefined;
      if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }));
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, [changeDiagram, setResource]);

  const select = useCallback((id: string, data?: CardData) => {
    if (stateMode) {
      setSelected({ id, kind: data?.variant === 'state' ? 'State' : 'Function-owned element', name: data?.title || id,
        path: `Lifecycle::Device.lifecycle.${id}`, owner: 'Lifecycle::Device.lifecycle',
        description: 'States and transitions belong directly to the lifecycle function.',
        properties: [['Model source', '04-stateful-function.swaml'], ['Function', 'Device.lifecycle']], snippet: data?.detail || id });
    } else if (byId[id]) setSelected(byId[id]);
    else if (id === 'coverage') setSelected(byId.requirement);
    else if (data?.entityId && byId[data.entityId]) setSelected(byId[data.entityId]);
    else return;
    setShowDetails(true);
  }, [stateMode]);

  return <div className="showcase-page">
    <a className="skip-link" href="#diagrams">Skip to diagrams</a>
    <header className="site-header">
      <a href="#" className="brand" aria-label="SWAML home">swaml<span className="brand-dot">.</span></a>
      <nav aria-label="Main navigation"><a href="#ontology">Ontology</a><a href="#diagrams">Diagrams</a><a href="#guide">Learn</a><a className="github-nav" href={repository} target="_blank" rel="noreferrer"><Icon name="github" size={18}/>GitHub<Icon name="external" size={13}/></a></nav>
    </header>
    <main>
      <section className="showcase-hero" aria-labelledby="hero-title">
        <div className="hero-edition">SOFTWARE ARCHITECTURE MODELING LANGUAGE <span>1.3.1</span></div>
        <h1 id="hero-title">See the architecture.<br/><span>Follow the behavior.</span></h1>
        <p>A small language for software structure, contracts and behavior.<br className="desktop-break"/> Explore the concepts, then see them in working model examples.</p>
        <div className="hero-actions"><a href="#diagrams" className="button button-ink">Explore the diagrams<Icon name="arrow" size={16}/></a><a href={`${repository}/blob/main/docs/QUICK_START.md`} className="hero-guide-link" target="_blank" rel="noreferrer">Read the quick guide ↗</a></div>
      </section>

      <section id="ontology" className="ontology-section" aria-labelledby="ontology-title"><div id="modeling-overview" className="showcase-section-heading"><div><span className="eyebrow">THE ONTOLOGY</span><h2 id="ontology-title">How the language fits together.</h2></div><p>See what each concept owns, uses and connects to. Select one to learn more.</p></div><Ontology/></section>

      <section id="diagrams" className="diagram-section" aria-labelledby="diagrams-title">
        <div className="showcase-section-heading"><div><span className="eyebrow">THE DIAGRAMS</span><h2 id="diagrams-title">Different views. One language.</h2></div><p>Choose a view to explore. Select an element for its details.</p></div>
        <DiagramGallery selected={active} onSelect={chooseDiagram}/>
        <div id="diagram-example" className="gallery-workbench" aria-label={`${choice?.title ?? 'Model browser'} example`}>
          <div className="gallery-example-heading">
            <div><span className="eyebrow">{choice?.example ?? 'Explore model ownership'}</span><h3>{choice?.title ?? 'Model browser'} <code>{view}</code></h3><code className="example-subject">{choice?.subjectLabel ? `${choice.subjectLabel}: ` : ''}{choice?.subject ?? 'Settings'}{choice?.subjectNote ? ` · ${choice.subjectNote}` : ''}</code></div>
            <div className="gallery-actions"><button type="button" className="icon-button" onClick={() => chooseDiagram('Browser')} aria-pressed={active === 'Browser'}><Icon name="tree" size={16}/><span>Browse model</span></button><button ref={detailsButton} type="button" className="icon-button" aria-expanded={showDetails} aria-controls="diagram-properties" onClick={() => setShowDetails(!showDetails)}><Icon name="layers" size={16}/><span>Details</span></button><button type="button" className="icon-button" onClick={() => setShowSource(true)}><Icon name="code" size={16}/><span>Source</span></button></div>
          </div>
          <div className={`gallery-example-body ${showDetails ? 'has-details' : ''}`}>
            <div className="gallery-example-canvas">
              <Suspense fallback={<p className="resource-loading" role="status">Loading diagram…</p>}>
                {active === 'interrupts' ? <InterruptFlow onSelect={setSelected}/> : view === 'tv' ? <FunctionTiming onSelect={setSelected} onInspect={openDetails}/> : view === 'gv' ? <StructureView selected={selected.id} onSelect={select}/> : view === 'Browser' ? <BrowserPanel selected={selected.id} onSelect={select}/> : view === 'grv' ? <GridPanel selected={selected.id} onSelect={select}/> : view === 'sv' ? <SequencePanel onSelect={select}/> : <ReactFlowProvider key={active}><Canvas view={view} stateMode={stateMode} onSelect={select}/></ReactFlowProvider>}
              </Suspense>
            </div>
            {showDetails && <Inspector item={selected} onSource={() => setShowSource(true)} onClose={() => { setShowDetails(false); detailsButton.current?.focus(); }}/>}
          </div>
          <div className="gallery-example-footer"><span>Interactive example · pan, zoom and inspect</span><a href={`${repository}/blob/main/docs/GRAPHICAL_CATALOG.md`} target="_blank" rel="noreferrer">Full notation reference ↗</a></div>
        </div>
        <p className="gallery-reading-note">Structure and interactions use gv, iv, cv, sv and grv. Function flow, states and interrupts use fv; timing uses tv. Box in box and Tree are two layouts of the same gv ownership. The model browser shows ownership.</p>
      </section>

      <section id="guide" className="learn-section" aria-labelledby="learn-title">
        <div className="showcase-section-heading"><div><span className="eyebrow">GO A LITTLE FURTHER</span><h2 id="learn-title">Start small. Explore when you need to.</h2></div><a href={`${repository}/blob/main/docs/USER_GUIDE.md`} target="_blank" rel="noreferrer">Full user guide ↗</a></div>
        <Resource id="resource-start" title="Write your first model" description="A short guide from contract to components." open={!!resources.start} onToggle={open => setResource('start', open)}><QuickStart/></Resource>
        <Resource id="resource-walkthrough" title="Follow one end-to-end example" description="Use case → interactions → function → software structure." open={!!resources.walkthrough} onToggle={open => setResource('walkthrough', open)}><ModelingOverview journeyOnly/></Resource>
        <Resource id="resource-examples" title="Explore an architecture" description="AUTOSAR Classic, Adaptive, a web application and a cloud service." open={!!resources.examples} onToggle={open => setResource('examples', open)}><Architectures/></Resource>
        <Resource id="resource-coverage" title="Link requirements and verification" description="Explore satisfaction, verification intent and formal documentation." open={!!resources.coverage} onToggle={open => setResource('coverage', open)}><Traceability embedded/></Resource>
        <Resource id="resource-interfaces" title="Choose a communication pattern" description="Data, requests, events and service interfaces." open={!!resources.interfaces} onToggle={open => setResource('interfaces', open)}><Interfaces/></Resource>
      </section>
    </main>
    <footer className="site-footer"><a href="#" className="brand">swaml<span className="brand-dot">.</span></a><span>A language for software architecture · MIT license</span><div><a href={`${repository}/releases/tag/v1.3.1`} target="_blank" rel="noreferrer">Released 1.3.1 ↗</a><a href={`${repository}/blob/main/docs/LANGUAGE_SPECIFICATION.md`} target="_blank" rel="noreferrer">Specification ↗</a></div></footer>
    {showSource && <SourceDialog filename={choice?.sourceFile ?? '08-service-field.swaml'} close={() => setShowSource(false)}/>}
  </div>;
}
export default App;
