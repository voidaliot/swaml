import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow } from '@xyflow/react';
import type { Edge, NodeProps } from '@xyflow/react';
import { QuickStart } from './QuickStart';

import { byId, diagram, entities, lifecycleSource, repository, source, viewDescriptions, views } from './model';
import type { CardData, DiagramNode, Entity, ViewId } from './model';


const Traceability = lazy(() => import('./Traceability').then(module => ({ default: module.Traceability })));
const Interfaces = lazy(() => import('./Interfaces').then(module => ({ default: module.Interfaces })));
const Architectures = lazy(() => import('./Architectures').then(module => ({ default: module.Architectures })));
const FunctionTiming = lazy(() => import('./FunctionTiming').then(module => ({ default: module.FunctionTiming })));
const InterruptFlow = lazy(() => import('./InterruptFlow').then(module => ({ default: module.InterruptFlow })));
const ModelingOverview = lazy(() => import('./ModelingOverview').then(module => ({ default: module.ModelingOverview })));
type FlowMode = 'flow' | 'states' | 'timing' | 'interrupts';

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

const viewIcons: Record<ViewId, string> = { Browser: 'tree', gv: 'layers', iv: 'connect', cv: 'case', sv: 'sequence', grv: 'grid', fv: 'flow' };

function FlatNode({ data, selected }: NodeProps<DiagramNode>) {
  const vertical = data.vertical;
  return <div className={`model-node node-${data.variant || 'component'} ${selected ? 'is-selected' : ''}`}>
    <Handle type="target" position={vertical ? Position.Top : Position.Left} className={data.portSide === 'left' ? 'port-handle visible-port' : 'port-handle'} />
    <div className="node-eyebrow"><span className="kind-mark" />{data.eyebrow}</div>
    <div className="node-title">{data.title}</div>
    {data.port && <div className={`port-label port-${data.portSide}`}>{data.port}</div>}
    {data.detail && <div className="node-detail">{data.detail}</div>}
    {data.footer && <div className="node-footer">{data.footer}</div>}
    <Handle type="source" position={vertical ? Position.Bottom : Position.Right} className={data.portSide === 'right' ? 'port-handle visible-port' : 'port-handle'} />
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
  return <div className="diagram-canvas">
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
  </div>;
}

const treeEntries: [string, number, string?][] = [
  ['package', 0], ['contract', 1], ['policy', 1], ['store-def', 1], ['panel-def', 1], ['service-def', 1], ['client-def', 1],
  ['root', 1], ['settings', 2], ['store', 3], ['update', 4], ['front', 2], ['front-panel', 3], ['rear', 2], ['rear-panel', 3],
  ['frontLink', 2], ['rearLink', 2], ['controller', 2], ['displays', 2], ['requirement', 1], ['case', 1],
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

function Inspector({ item, onSource }: { item: Entity; onSource: () => void }) {
  return <aside className="inspector" aria-label="Selected element properties" aria-live="polite">
    <div className="inspector-caption">PROPERTIES <span>↗</span></div>
    <div className="inspector-symbol"><Icon name={item.kind.includes('Connector') ? 'connect' : item.kind.includes('Function') || item.kind === 'State' ? 'flow' : 'layers'} size={23} /></div>
    <span className="eyebrow">{item.kind}</span><h3>{item.name}</h3><p className="inspector-description">{item.description}</p>
    <div className="identity"><span>IDENTITY</span><code>{item.path}</code></div>
    {item.definition && <div className="identity"><span>DEFINITION</span><code>{item.definition}</code></div>}
    <dl className="properties"><div><dt>Owner</dt><dd>{item.owner}</dd></div>{item.properties.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    <button className="source-link" onClick={onSource}><Icon name="code" size={15} />Inspect source<Icon name="arrow" size={15} /></button>
    <div className="inspector-note"><span className="small-square" />Layout changes stay in this browser session. The model source is unchanged.</div>
  </aside>;
}

function SourceDialog({ mode, close }: { mode: FlowMode; close: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [timingSource, setTimingSource] = useState(''), [interruptSource, setInterruptSource] = useState('');
  useEffect(() => {
    if (mode === 'timing') void import('../../examples/17-function-timing.swaml?raw').then(module => setTimingSource(module.default));
    if (mode === 'interrupts') void import('../../examples/19-interruptible-function.swaml?raw').then(module => setInterruptSource(module.default));
  }, [mode]);
  const text = mode === 'interrupts' ? interruptSource : mode === 'timing' ? timingSource : mode === 'states' ? lifecycleSource : source;
  const filename = mode === 'interrupts' ? '19-interruptible-function.swaml' : mode === 'timing' ? '17-function-timing.swaml' : mode === 'states' ? '04-stateful-function.swaml' : '08-service-field.swaml';
  const [download, setDownload] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    setDownload(url);
    dialogRef.current?.showModal();
    return () => URL.revokeObjectURL(url);
  }, [text]);
  return <dialog ref={dialogRef} className="source-dialog" onCancel={close} onClick={(e) => { if (e.target === e.currentTarget) close(); }} aria-labelledby="source-title">
    <div className="source-dialog-head"><div><span className="eyebrow">CHECKED-IN MODEL / PARSER 1.3</span><h3 id="source-title">{filename}</h3></div><button className="icon-button" onClick={close} aria-label="Close source"><Icon name="close" /></button></div>
    <p className="source-dialog-description">The exact repository fixture, bundled at build time. This showcase projects selected elements; it does not parse or execute edits.</p>
    <pre tabIndex={0} aria-label="Model source">{text.split('\n').map((line, i) => <span className="source-line" key={i}><span className="line-number" aria-hidden="true">{i + 1}</span><code>{line || ' '}</code></span>)}</pre>
    <div className="source-dialog-actions"><a className="button button-ink" href={download} download={filename}><Icon name="download" size={16} />Download model</a><button className="button button-quiet" onClick={() => { void navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Copied' : 'Copy source'}</button><a href={`${repository}/blob/main/examples/${filename}`} target="_blank" rel="noreferrer">Open on GitHub ↗</a></div>
  </dialog>;
}

function App() {
  const [view, setView] = useState<ViewId>('iv');
  const [flowMode, setFlowMode] = useState<FlowMode>('flow');
  const stateMode = flowMode === 'states', timingMode = view === 'fv' && flowMode === 'timing', interruptMode = view === 'fv' && flowMode === 'interrupts';
  const [selected, setSelected] = useState<Entity>(byId.settings);
  const [showSource, setShowSource] = useState(false);
  const activeView = views.find((v) => v.id === view)!;
  const select = useCallback((id: string, data?: CardData) => {
    if (byId[id] && !stateMode) { setSelected(byId[id]); return; }
    if (stateMode && view === 'fv') setSelected({ id, kind: data?.variant === 'state' ? 'State' : 'Function-owned element', name: data?.title || id, path: `Lifecycle::Device.lifecycle.${id}`, owner: 'Lifecycle::Device.lifecycle', description: 'Part of the separate Lifecycle example. States and transitions belong directly to the lifecycle function.', properties: [['Model source', '04-stateful-function.swaml'], ['Function', 'Device.lifecycle'], ['Projection', 'state body · no simulation']], snippet: data?.detail || id });
    else if (id === 'coverage') setSelected(byId.requirement);
    else if (data?.entityId) setSelected(byId[data.entityId]);
  }, [stateMode, view]);
  const changeView = (id: ViewId) => { setView(id); setFlowMode('flow'); setSelected(byId[id === 'cv' || id === 'sv' ? 'case' : id === 'fv' ? 'update' : id === 'Browser' || id === 'grv' ? 'package' : id === 'iv' ? 'settings' : 'root']); };
  const changeFlowMode = (states: boolean) => { setFlowMode(states ? 'states' : 'flow'); setSelected(states ? { id: 'lifecycle', kind: 'Function', name: 'lifecycle()', path: 'Lifecycle::Device.lifecycle', owner: 'Lifecycle::Device', description: 'A separate checked-in example of directly owned states. The initial reference selects Idle, and Stopped is a final state.', properties: [['Model source', '04-stateful-function.swaml'], ['Trigger', 'on start'], ['States', 'Idle, Running, Stopped (final)'], ['Transitions', 'beginRun, stopRun, expire']], snippet: 'function lifecycle() on start {' } : byId.update); };
  return <>
    <a className="skip-link" href="#modeling-overview">Skip to graphical overview</a>
    <header className="site-header"><a href="#" className="brand" aria-label="SWAML home"><span className="brand-symbol"><Icon name="connect" size={25} /></span>swaml<span className="brand-dot">.</span></a><nav aria-label="Main navigation"><a href="#modeling-overview">Overview</a><a href="#traceability">Traceability</a><a href="#quick-start">Quick start</a><a href="#architectures">Examples</a><a href="#explorer">Views</a><a href="#interfaces">Interfaces</a><a className="github-nav" href={repository} target="_blank" rel="noreferrer"><Icon name="github" size={18} />GitHub<Icon name="external" size={14} /></a></nav></header>
    <main>
      <section className="hero" aria-labelledby="hero-title"><div className="hero-main"><div className="release-label"><span />SWAML 1.3.0<span className="release-divider">/</span>ARCHITECTURE REFERENCE WORKBENCH</div><h1 id="hero-title">Software architecture<br /><span>with explicit contracts.</span></h1><p>Specify components, typed interfaces and owned behavior.<br className="desktop-break" /> Model AUTOSAR software, service applications and cloud systems.</p><div className="hero-actions"><a href="#modeling-overview" className="button button-ink">See what you can model<Icon name="arrow" size={17} /></a><a href="#quick-start" className="button button-quiet">Start modeling</a></div></div><div className="hero-aside"><span className="eyebrow">LANGUAGE EDITION 1.3</span><p>Structure. Contracts.<br /><strong>Behavior.</strong></p><div className="hero-model-line"><span>component</span><Icon name="arrow" size={15} /><span>function</span><Icon name="arrow" size={15} /><span>calc</span></div><div className="hero-aside-note">Definitions and instances remain distinct.<br />Every inter-component exchange follows a typed route.</div></div></section>
      <Suspense fallback={<p role="status">Loading graphical overview…</p>}><ModelingOverview /></Suspense><Suspense fallback={<p role="status">Loading traceability example…</p>}><Traceability /></Suspense>
      <QuickStart />
      <Suspense fallback={<p className="surface-footnote" role="status">Loading architecture examples…</p>}><Architectures /></Suspense>
      <section id="explorer" className="explorer-section" aria-labelledby="explorer-title"><div className="section-intro"><div><span className="eyebrow">ARCHITECTURE EXAMPLE / SETTINGS</span><h2 id="explorer-title">Cabin temperature service</h2></div><p>A provider and two client instances.<br />Select a view and inspect its model elements.</p></div>
        <div className="workbench"><aside className="view-sidebar"><div className="sidebar-title"><span className="tiny-model-mark" />DEMO WORKSPACE</div><div className="model-title">Cabin setting service<span>examples / 08-service-field</span></div><div className="view-label">PERSPECTIVES <span>07</span></div><nav aria-label="Model perspectives">{views.map((v) => <button key={v.id} className={`view-button ${view === v.id ? 'active' : ''}`} onClick={() => changeView(v.id)} aria-pressed={view === v.id}><Icon name={viewIcons[v.id]} size={18} /><span>{v.name}</span><code>{v.id === 'Browser' ? '⌘' : v.id}</code></button>)}</nav><div className="sidebar-footer"><span className="model-status-dot" />Source-backed demo<span>Layout interaction · React Flow</span></div></aside>
          <div className="workbench-main"><div className="workbench-toolbar"><div className="toolbar-breadcrumb">Settings <span>/</span> {interruptMode ? 'Interrupt example' : timingMode ? 'Timing example' : stateMode ? 'Lifecycle example' : view === 'Browser' || view === 'grv' ? 'Model' : 'Cabin'} <span>/</span> <strong>{activeView.name}</strong></div><button className="icon-button" onClick={() => setShowSource(true)} aria-label="Open complete model source"><Icon name="code" size={18} /><span>Source</span></button></div><div className="view-intro"><div><h3>{activeView.name} <span>{view === 'Browser' ? 'NAVIGATION' : `${view} VIEW`}</span></h3><p>{interruptMode ? 'Follow a typed event into its protected region, handler and local continuation.' : timingMode ? 'Observe distinct function activations and their logical waits against declared timing contracts.' : viewDescriptions[view]}</p></div>{view === 'fv' && <div className="flow-toggle" aria-label="Flow example"><button aria-pressed={flowMode === 'flow'} className={flowMode === 'flow' ? 'active' : ''} onClick={() => changeFlowMode(false)}>Statement flow</button><button aria-pressed={stateMode} className={stateMode ? 'active' : ''} onClick={() => changeFlowMode(true)}>States · Lifecycle example</button><button aria-pressed={timingMode} className={timingMode ? 'active' : ''} onClick={() => setFlowMode('timing')}>Timing</button><button aria-pressed={interruptMode} className={interruptMode ? 'active' : ''} onClick={() => setFlowMode('interrupts')}>Interrupts</button></div>}</div>
            {interruptMode ? <Suspense fallback={<p role="status">Loading interrupt flow…</p>}><InterruptFlow onSelect={setSelected} /></Suspense> : timingMode ? <Suspense fallback={<p role="status">Loading function timing…</p>}><FunctionTiming onSelect={setSelected} /></Suspense> : view === 'Browser' ? <BrowserPanel selected={selected.id} onSelect={select} /> : view === 'grv' ? <GridPanel selected={selected.id} onSelect={select} /> : view === 'sv' ? <SequencePanel onSelect={select} /> : <ReactFlowProvider><Canvas view={view} stateMode={stateMode} onSelect={select} /></ReactFlowProvider>}
            <div className="workbench-status"><span><span className="small-square" />{interruptMode ? 'Interruptible function flow' : timingMode ? 'Timing reference trace' : stateMode ? 'Lifecycle model' : 'Settings model'} · 2D projection</span><span>{view === 'iv' ? '2 routes / 1 contract' : view === 'fv' && stateMode ? '3 states / 1 function' : 'Definition ≠ instance'}<span className="status-separator">|</span>parser 1.3</span></div>
          </div><Inspector item={selected} onSource={() => setShowSource(true)} /></div>
        <div className="demo-caption"><span>MODEL PROJECTION / INTERACTIVE LAYOUT</span><p>Browse a curated projection of a repository example. Dragging changes layout; source editing and execution remain in the language tools.</p></div>
      </section>
      <Suspense fallback={<p className="surface-footnote" role="status">Loading interface reference…</p>}><Interfaces /></Suspense>
      <section id="language" className="language-section" aria-labelledby="language-title"><div className="language-title"><span className="eyebrow">FOR ARCHITECTS FAMILIAR WITH UML</span><h2 id="language-title">Familiar concepts.<br />Defined boundaries.</h2><a href={`${repository}/blob/main/docs/UML_GUIDE.md`} target="_blank" rel="noreferrer">Read the UML transition guide<Icon name="arrow" size={17} /></a></div><div className="principles"><article><span className="principle-number">01 / OWNERSHIP</span><h3>Components and owned behavior</h3><p>A component definition describes private data, functions and optional child components. Named instances keep separate stores. Functions own local calculations and their flow or states.</p></article><article><span className="principle-number">02 / CONNECTIONS</span><h3>Provided and required contracts</h3><p>Ports expose one nominal interface each. A service uses provides / requires roles; the other kinds name their direction explicitly. Assembly connectors and delegation remain distinct.</p></article><article><span className="principle-number">03 / PERSPECTIVES</span><h3>Structure, interactions and behavior</h3><p>gv and iv cover structure and wiring; sv covers case exchanges; fv covers flow or owned states. cv connects use cases, verification cases and requirements through explicit design and verification links.</p></article></div></section>
      <section className="repo-section"><div><span className="eyebrow">OPEN SOURCE / MIT LICENSE</span><h2>Specify, validate<br />and review in source.</h2><p>A textual language, a reference validator and simulator,<br />and a reproducible flat notation catalog.</p><div className="repo-actions"><a className="button button-ink" href={repository} target="_blank" rel="noreferrer"><Icon name="github" size={18} />Explore on GitHub<Icon name="external" size={15} /></a><a href={`${repository}/blob/main/docs/USER_GUIDE.md`} target="_blank" rel="noreferrer">Read the guide ↗</a></div></div><div className="code-preview"><div className="code-preview-bar"><span>cabin.swaml</span><span>SWAML / 1.3</span></div><pre><code><span className="code-key">component</span>{' Cabin {\n  '}<span className="code-key">component</span>{' settings: Service;\n  '}<span className="code-key">component</span>{' front: Client;\n  '}<span className="code-key">component</span>{' rear: Client;\n\n  '}<span className="code-key">connect</span>{' frontLink:\n    front.setting -> settings.api\n    '}<span className="code-key">qos</span>{' LocalLink;\n}'}</code></pre><span className="code-preview-caption">Architecture excerpt · complete fixture in the explorer</span></div></section>
    </main><footer className="site-footer"><a href="#" className="brand">swaml<span className="brand-dot">.</span></a><span>Software Architecture Modeling Language</span><div><a href={`${repository}/blob/main/docs/IMPLEMENTATION_STATUS.md`} target="_blank" rel="noreferrer">Implementation status</a><a href={`${repository}/blob/main/LICENSE`} target="_blank" rel="noreferrer">MIT license</a></div></footer>
    {showSource && <SourceDialog mode={view === 'fv' ? flowMode : 'flow'} close={() => setShowSource(false)} />}
  </>;
}
export default App;
