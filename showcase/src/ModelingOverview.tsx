import { useCallback, useMemo, useState } from 'react';
import { Background, BaseEdge, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import type { Edge, EdgeChange, EdgeProps, Node, NodeChange, NodeProps } from '@xyflow/react';
import overview from '../../spec/modeling-overview.json';
import source from '../../examples/13-web-application.swaml?raw';
import { repository } from './model';
import './modeling-overview.css';

type Point = { x: number; y: number };
type ConceptHandle = { id: string; type: 'source' | 'target'; side: keyof typeof sides; offset: number; visible: boolean };
type Concept = { id: string; title: string; kind: string; lines: string[]; detail: string; subject?: string; snippet?: string; handles?: ConceptHandle[]; x: number; y: number; width: number; height: number };
type Link = { id: string; source: string; target: string; label: string; kind: string; detail?: string; sourceSide?: string; targetSide?: string; points?: Point[]; labelX?: number; labelY?: number };
type Graph = { id: string; title: string; summary: string; width: number; height: number; view?: string; takeaway?: string; nodes: Concept[]; edges: Link[] };
type OverviewNode = Node<Concept, 'concept' | 'bounds'>;
type OverviewEdge = Edge<{ points?: Point[]; labelX?: number; labelY?: number }, 'overview'>;

const sides = { top: Position.Top, bottom: Position.Bottom, left: Position.Left, right: Position.Right };
const stages = overview.stages as Graph[];
const ontology = overview.ontology as Graph;
const stageNames = ['Use case', 'Interactions', 'Function flow', 'Owned functions', 'Software structure'];

function ConceptNode({ data, selected }: NodeProps<OverviewNode>) {
  return <div className={`overview-concept overview-kind-${data.kind} ${selected ? 'is-selected' : ''}`}>
    {data.kind === 'decision' && <svg className="overview-decision-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="50,1 99,50 50,99 1,50" vectorEffect="non-scaling-stroke" /></svg>}
    {data.handles?.map(handle => <Handle key={handle.id} id={handle.id} type={handle.type} position={sides[handle.side]} style={handle.side === 'left' || handle.side === 'right' ? { top: `${handle.offset}%` } : { left: `${handle.offset}%` }} className={handle.visible ? 'overview-port' : ''} />)}
    <strong>{data.title}</strong>
    <div className="overview-concept-lines">{data.lines.map((line, index) => <span key={index}>{line}</span>)}</div>
  </div>;
}

function OverviewLink({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, label, data, selected }: EdgeProps<OverviewEdge>) {
  const [smooth, midpointX, midpointY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 0 });
  const path = data?.points?.length ? data.points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ') : smooth;
  const authoredLabel = data?.labelX !== undefined && data?.labelY !== undefined;
  return <><BaseEdge path={path} markerEnd={markerEnd} style={style} />{label && <EdgeLabelRenderer><div className={`overview-edge-label ${selected ? 'is-selected' : ''}`} style={{ transform: `${authoredLabel ? 'translate(0, -100%)' : 'translate(-50%, -50%)'} translate(${data?.labelX ?? midpointX}px,${data?.labelY ?? midpointY}px)` }}>{label}</div></EdgeLabelRenderer>}</>;
}

const nodeTypes = { concept: ConceptNode, bounds: () => null };
const edgeTypes = { overview: OverviewLink };

function handlesFor(node: Concept, links: Link[]): ConceptHandle[] {
  return links.flatMap(link => {
    const source = link.source === node.id;
    if (!source && link.target !== node.id) return [];
    const point = source ? link.points?.[0] : link.points?.at(-1);
    const explicitSide = source ? link.sourceSide : link.targetSide;
    const side = (explicitSide || (point ? (Math.abs(point.x - node.x) < 1 ? 'left' : Math.abs(point.x - node.x - node.width) < 1 ? 'right' : Math.abs(point.y - node.y) < 1 ? 'top' : 'bottom') : source ? 'right' : 'left')) as keyof typeof sides;
    const offset = point ? ((side === 'left' || side === 'right') ? (point.y - node.y) / node.height : (point.x - node.x) / node.width) * 100 : 50;
    return [{ id: `${link.id}-${source ? 'source' : 'target'}`, type: source ? 'source' as const : 'target' as const, side, offset, visible: link.kind === 'route' }];
  });
}

function OverviewCanvas({ graph, selected, onSelect }: { graph: Graph; selected: string; onSelect: (id: string) => void }) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const nodes = useMemo<OverviewNode[]>(() => [
    // Authored edge bends and labels can extend beyond the visible cards.
    // A presentation-only extent keeps initial fit and the Fit control complete.
    { id: '__diagram_bounds', type: 'bounds', position: { x: 0, y: 0 }, data: graph.nodes[0], style: { width: graph.width, height: graph.height, opacity: 0, pointerEvents: 'none' }, selectable: false, draggable: false, focusable: false, zIndex: -1, domAttributes: { 'aria-hidden': true } },
    ...graph.nodes.map(node => ({ id: node.id, type: 'concept' as const, position: { x: node.x, y: node.y }, data: { ...node, handles: handlesFor(node, graph.edges) }, style: { width: node.width, height: node.height }, selected: selected === node.id, ariaLabel: `${node.kind}: ${node.title}. ${node.lines.join('. ')}` })),
  ], [graph, selected]);
  const edges = useMemo<OverviewEdge[]>(() => graph.edges.map(edge => ({ id: edge.id, type: 'overview', source: edge.source, target: edge.target, sourceHandle: `${edge.id}-source`, targetHandle: `${edge.id}-target`, label: edge.label, data: { points: edge.points, labelX: edge.labelX, labelY: edge.labelY }, selected: selected === edge.id, markerEnd: { type: MarkerType.ArrowClosed, color: selected === edge.id ? '#b85e38' : '#647d98', width: 17, height: 17 }, style: { stroke: selected === edge.id ? '#b85e38' : '#647d98', strokeWidth: selected === edge.id ? 2 : 1.4, strokeDasharray: edge.kind === 'references' ? '5 4' : undefined }, ariaLabel: `${edge.source} ${edge.label} ${edge.target}` })), [graph, selected]);
  // Only consume user selection changes; selected props remain parent-controlled.
  const changeNodes = useCallback((changes: NodeChange<OverviewNode>[]) => {
    const change = changes.find(item => item.type === 'select' && item.selected);
    if (change?.type === 'select') onSelect(change.id);
  }, [onSelect]);
  const changeEdges = useCallback((changes: EdgeChange<OverviewEdge>[]) => {
    const change = changes.find(item => item.type === 'select' && item.selected);
    if (change?.type === 'select') onSelect(change.id);
  }, [onSelect]);
  return <div className={`overview-canvas overview-canvas-${graph.id}`} aria-label={`${graph.title} interactive diagram`}>
    <div className="overview-canvas-scroll"><ReactFlow<OverviewNode, OverviewEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={changeNodes} onEdgesChange={changeEdges} onNodeClick={(_, node) => onSelect(node.id)} onEdgeClick={(_, edge) => onSelect(edge.id)} fitView fitViewOptions={{ padding: 0.1, maxZoom: 1.12 }} minZoom={0.15} maxZoom={2} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} selectionKeyCode={null} zoomOnScroll={false} preventScrolling={false}>
      <Background gap={22} color="#dce3eb" />
    </ReactFlow></div>
    <div className="overview-controls" role="group" aria-label="Overview diagram controls"><button aria-label="Zoom overview in" title="Zoom in" onClick={() => void zoomIn()}>+</button><button aria-label="Zoom overview out" title="Zoom out" onClick={() => void zoomOut()}>−</button><button aria-label="Fit overview diagram" title="Fit diagram" onClick={() => void fitView({ padding: 0.1, maxZoom: 1.12 })}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" /></svg></button></div>
    <div className="overview-canvas-hint">Select to inspect · pan and zoom</div>
  </div>;
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function declaration(text: string, pattern: RegExp): string {
  const match = pattern.exec(text);
  if (!match) return '';
  const start = match.index;
  const opener = text.indexOf('{', start);
  const semicolon = text.indexOf(';', start);
  if (semicolon >= 0 && (opener < 0 || semicolon < opener)) return text.slice(start, semicolon + 1).trim();
  if (opener < 0) return '';
  let depth = 0;
  let quoted = false;
  for (let index = opener; index < text.length; index++) {
    if (text[index] === '"' && text[index - 1] !== '\\') quoted = !quoted;
    if (quoted) continue;
    if (text[index] === '{') depth++;
    if (text[index] === '}' && --depth === 0) return text.slice(start, index + 1).trim();
  }
  return '';
}

function excerpt(subject?: string): string {
  if (!subject) return '';
  let name = subject.replace(/^WebShop::/, '');
  const instances: Record<string, string> = { 'Production.application.checkout': 'CheckoutService', 'Production.inventory.stock': 'StockStore', 'Production.browser': 'BrowserClient', 'Production.mailer': 'ReceiptWorker', 'Production.application': 'WebApplication', 'Production.inventory': 'InventoryService' };
  for (const [instance, definition] of Object.entries(instances)) {
    if (name === instance || name.startsWith(`${instance}.`)) { name = definition + name.slice(instance.length); break; }
  }
  const [owner, member] = name.split('.');
  const ownerSource = declaration(source, new RegExp(`\\b(?:component def|component|useCase|verificationCase|requirement|qos def|interface (?:service|clientServer|senderReceiver|publishSubscribe)) ${escaped(owner)}\\b`));
  if (!member) return ownerSource;
  return declaration(ownerSource, new RegExp(`\\b(?:function|calc|var|port|connect|delegate|component) ${escaped(member)}\\b`));
}

export function ModelingOverview({ journeyOnly = false }: { journeyOnly?: boolean }) {
  const [mode, setMode] = useState<'ontology' | 'journey'>(journeyOnly ? 'journey' : 'ontology');
  const [stage, setStage] = useState(0);
  const [selected, setSelected] = useState(ontology.nodes[0].id);
  const [showSource, setShowSource] = useState(false);
  const graph = mode === 'ontology' ? ontology : stages[stage];
  const node = graph.nodes.find(item => item.id === selected);
  const edge = graph.edges.find(item => item.id === selected);
  const selectedSource = node?.snippet || excerpt(node?.subject);
  const owner = node?.subject?.includes('.') ? node.subject.slice(0, node.subject.lastIndexOf('.')) : node?.subject?.split('::')[0];
  const select = useCallback((id: string) => { setSelected(id); setShowSource(false); }, []);
  const changeGraph = (nextMode: 'ontology' | 'journey', nextStage = stage) => { setMode(nextMode); setStage(nextStage); select((nextMode === 'ontology' ? ontology : stages[nextStage]).nodes[0].id); };
  return <section id={journeyOnly ? 'modeling-walkthrough' : 'modeling-overview'} className="modeling-overview-section" aria-labelledby="modeling-overview-title">
    <div className="section-intro"><div><span className="eyebrow">THE LANGUAGE AT A GLANCE</span><h2 id="modeling-overview-title">From a use case to software structure</h2></div><p>Explore what SWAML can describe.<br />Then follow one order through the same model.</p></div>
    {!journeyOnly && <div className="overview-modes" role="group" aria-label="Modeling overview mode"><button aria-pressed={mode === 'ontology'} onClick={() => changeGraph('ontology')}><span>01</span><strong>What can I model?</strong><small>Graphical ontology</small></button><button aria-pressed={mode === 'journey'} onClick={() => changeGraph('journey')}><span>02</span><strong>Use case to structure</strong><small>One end-to-end example</small></button></div>}
    {mode === 'journey' && <div className="overview-steps" role="group" aria-label="End-to-end modeling stages">{stages.map((item, index) => <button key={item.id} aria-pressed={stage === index} onClick={() => changeGraph('journey', index)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{stageNames[index]}</strong></button>)}</div>}
    <div className="overview-workspace">
      <div className="overview-heading"><div><span className="eyebrow">{mode === 'ontology' ? 'CONCEPTS AND RELATIONSHIPS' : `WEBSHOP · ${String(stage + 1).padStart(2, '0')} / 05`}</span><h3>{graph.title}</h3><p>{graph.summary}</p></div><span className="overview-view-label">{graph.view || 'Concept map'}</span></div>
      <ReactFlowProvider key={graph.id}><OverviewCanvas graph={graph} selected={selected} onSelect={select} /></ReactFlowProvider>
      <p className="overview-mobile-hint">Pan the diagram or scroll sideways to see every element.</p>
      {graph.takeaway && <div className="overview-takeaway"><span>READ THE DIAGRAM</span><p>{graph.takeaway}</p></div>}
      <div className="overview-inspection">
        <label className="overview-element-picker"><span className="eyebrow">INSPECT AN ELEMENT</span><select value={selected} onChange={event => select(event.target.value)} aria-label="Inspect overview element"><optgroup label="Elements">{graph.nodes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</optgroup><optgroup label="Relationships">{graph.edges.map(item => <option key={item.id} value={item.id}>{graph.nodes.find(node => node.id === item.source)?.title} → {item.label} → {graph.nodes.find(node => node.id === item.target)?.title}</option>)}</optgroup></select></label>
        <aside className="overview-inspector" aria-label="Modeling overview selection" aria-live="polite">
          <span className="eyebrow">{node?.kind || `${edge?.kind} RELATIONSHIP`}</span><h4>{node?.title || edge?.label}</h4><p>{node?.detail || edge?.detail || `${graph.nodes.find(item => item.id === edge?.source)?.title} → ${graph.nodes.find(item => item.id === edge?.target)?.title}. ${edge?.kind === 'owns' ? 'Ownership identifies the containing model element.' : edge?.kind === 'references' ? 'A reference connects existing elements without changing their owner.' : 'Follow the named direction and the dependency shown in the diagram.'}`}</p>
          {node?.subject && <dl><div><dt>Model identity</dt><dd><code>{node.subject}</code></dd></div>{owner && <div><dt>Owner / context</dt><dd><code>{owner}</code></dd></div>}</dl>}
          {selectedSource && <><button className="overview-source-toggle" onClick={() => setShowSource(!showSource)} aria-expanded={showSource}>{showSource ? 'Hide' : 'Inspect'} relevant source <span aria-hidden="true">{showSource ? '−' : '+'}</span></button>{showSource && <pre tabIndex={0} aria-label="Relevant WebShop source"><code>{selectedSource}</code></pre>}</>}
        </aside>
      </div>
      {mode === 'journey' && <div className="overview-navigation"><button disabled={stage === 0} onClick={() => changeGraph('journey', stage - 1)}>← Previous stage</button><span>{stage + 1} of {stages.length}</span>{stage < stages.length - 1 ? <button onClick={() => changeGraph('journey', stage + 1)}>Next: {stageNames[stage + 1]} →</button> : <a href="#architectures">Explore other architectures →</a>}</div>}
    </div>
    <div className="overview-links"><span>One checked-in model connects every stage.</span><a href={`${repository}/blob/main/examples/13-web-application.swaml`} target="_blank" rel="noreferrer">WebShop model ↗</a><a href={`${repository}/blob/main/docs/MODELING_OVERVIEW.md`} target="_blank" rel="noreferrer">Read the visual guide ↗</a></div>
  </section>;
}
