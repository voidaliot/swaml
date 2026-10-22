import { useId, useMemo, useState } from 'react';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { cabinDeployments, cabinStructure } from './model';
import type { StructureOccurrence } from './model';
import { ClassifierGlyph } from './DiagramGlyphs';
import './structure.css';

export type StructureLayout = 'boxes' | 'tree';
type Box = { occurrence: StructureOccurrence; x: number; y: number; width: number; height: number; depth: number };
type Link = { from: Box; to: Box };
const gap = 28, padding = 22, leafWidth = 284;
const ownRows = (node: StructureOccurrence) => [...node.variables.map(value => `var ${value}`), ...node.functions.map(value => `function ${value}`)];
const headerHeight = (node: StructureOccurrence) => 66 + ownRows(node).length * 21;

/** Recursive containment and tree layouts retain identical source occurrence IDs. */
export function layoutStructure(root: StructureOccurrence, mode: StructureLayout) {
  const boxes: Box[] = [], links: Link[] = [];
  if (mode === 'boxes') {
    const measure = (node: StructureOccurrence): { width: number; height: number } => {
      const children = node.children.map(measure);
      return { width: children.length ? Math.max(leafWidth, children.reduce((sum, c) => sum + c.width, 0) + gap * (children.length - 1) + padding * 2) : leafWidth,
        height: headerHeight(node) + (children.length ? Math.max(...children.map(c => c.height)) + padding * 2 : 16) };
    };
    const place = (node: StructureOccurrence, x: number, y: number, depth: number): Box => {
      const size = measure(node), box = { occurrence: node, x, y, ...size, depth };
      boxes.push(box);
      let childX = x + padding;
      for (const child of node.children) {
        const placed = place(child, childX, y + headerHeight(node) + padding, depth + 1);
        links.push({ from: box, to: placed }); childX += placed.width + gap;
      }
      return box;
    };
    const frame = place(root, 24, 48, 0);
    return { boxes, links, width: frame.width + 48, contentHeight: frame.height + 72 };
  }
  const subtreeWidth = (node: StructureOccurrence): number => Math.max(leafWidth, node.children.reduce((sum, child) => sum + subtreeWidth(child), 0) + Math.max(0, node.children.length - 1) * gap);
  const place = (node: StructureOccurrence, x: number, y: number, depth: number): Box => {
    const width = subtreeWidth(node), box = { occurrence: node, x: x + (width - leafWidth) / 2, y, width: leafWidth, height: headerHeight(node) + 16, depth };
    boxes.push(box);
    let childX = x;
    for (const child of node.children) {
      const placed = place(child, childX, y + Math.max(176, box.height + 70), depth + 1);
      links.push({ from: box, to: placed }); childX += subtreeWidth(child) + gap;
    }
    return box;
  };
  place(root, 24, 48, 0);
  return { boxes, links, width: subtreeWidth(root) + 48, contentHeight: Math.max(...boxes.map(b => b.y + b.height)) + 24 };
}

export function StructureDiagram({ root = cabinStructure, mode = 'boxes', selected, onSelect = () => {} }: {
  root?: StructureOccurrence; mode?: StructureLayout; selected?: string; onSelect?: (id: string) => void;
}) {
  const marker = `structure-arrow-${useId().replace(/:/g, '')}`, title = useId(), description = useId();
  const graph = layoutStructure(root, mode), height = graph.contentHeight + 172;
  return <svg className="structure-svg" width={graph.width} height={height} viewBox={`0 0 ${graph.width} ${height}`} role="group" aria-labelledby={`${title} ${description}`}>
    <title id={title}>{`Cabin component structure · ${mode === 'boxes' ? 'nested containment' : 'ownership tree'}`}</title>
    <desc id={description}>Cabin owns settings, front and rear. Settings owns store; front and rear each own a distinct panel instance. Nested boxes and tree arrows represent the same ownership and identities. External deployment references appear separately below the software structure.</desc>
    <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#708e91"/></marker></defs>
    <rect width={graph.width} height={height} fill="#fff"/>
    <text x="25" y="24" className="structure-label">{mode === 'boxes' ? 'SOFTWARE CONTAINMENT' : 'COMPONENT OWNERSHIP'}</text>
    {mode === 'tree' && graph.links.map(({from,to}) => {
      const sx = from.x + from.width / 2, sy = from.y + from.height, tx = to.x + to.width / 2, ty = to.y;
      const middle = sy + (ty - sy) / 2;
      return <g key={`${from.occurrence.id}-${to.occurrence.id}`}><path d={`M${sx} ${sy}V${middle}H${tx}V${ty - 4}`} fill="none" stroke="#708e91" strokeWidth="1.4" markerEnd={`url(#${marker})`}/><text x={tx + 9} y={ty - 15} className="structure-edge-label">owns</text></g>;
    })}
    {graph.boxes.map(box => {
      const node = box.occurrence, rows = ownRows(node);
      return <g key={node.id} role="button" tabIndex={0} data-structure-id={node.id} aria-label={`Inspect ${node.path}`} aria-pressed={selected === node.id} className={`structure-occurrence${selected === node.id ? ' is-selected' : ''}`} onPointerDown={event => event.stopPropagation()} onClick={() => onSelect(node.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node.id); } }}>
        <rect x={box.x} y={box.y} width={box.width} height={box.height} rx="3" fill={box.depth === 0 && mode === 'boxes' ? '#f1f6f8' : '#fff'} stroke={selected === node.id ? '#2b6b84' : '#91abb4'} strokeWidth={selected === node.id ? 2 : 1.2}/>
        <ClassifierGlyph kind={node.classifierKind} decorative x={box.x + 14} y={box.y + 11} width={18} height={18}/>
        <text x={box.x + 40} y={box.y + 25} className="structure-title">{node.title}</text>
        <text x={box.x + 15} y={box.y + 46} className="structure-path">{node.path.replace('Settings::Cabin.', '')}</text>
        {rows.map((row, i) => <text key={row} x={box.x + 15} y={box.y + 72 + i * 21} className="structure-member">{row}</text>)}
        {!!node.children.length && <line x1={box.x} x2={box.x + box.width} y1={box.y + headerHeight(node) - 5} y2={box.y + headerHeight(node) - 5} stroke="#c9d9df"/>}
      </g>;
    })}
    <line x1="24" x2={graph.width - 24} y1={graph.contentHeight + 8} y2={graph.contentHeight + 8} stroke="#c7d6dd" strokeDasharray="5 4"/>
    <text x="25" y={graph.contentHeight + 34} className="structure-label">EXTERNAL DEPLOYMENT REFERENCES</text>
    {cabinDeployments.map((deployment, index) => {
      const width = (graph.width - 72) / 2, x = 24 + index * (width + 24), y = graph.contentHeight + 49;
      return <g key={deployment.id} role="button" tabIndex={0} aria-label={`Inspect external deployment target ${deployment.target}`} aria-pressed={selected === deployment.id} onClick={() => onSelect(deployment.id)} onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(deployment.id); } }} className="structure-deployment">
        <rect x={x} y={y} width={width} height="100" fill="#f8fafb" stroke={selected === deployment.id ? '#2b6b84' : '#bac9d0'} strokeDasharray="5 4"/>
        <text x={x + 15} y={y + 25} className="structure-deployment-title">{deployment.sources.join(', ')} → {deployment.target}</text>
        <text x={x + 15} y={y + 50} className="structure-reference-note">{deployment.note}</text>
        <text x={x + 15} y={y + 76} className="structure-reference-note">Host-resolved identity · outside the software ownership tree</text>
      </g>;
    })}
  </svg>;
}

type StructureFlowNode = Node<{ mode: StructureLayout; selected?: string; onSelect: (id: string) => void }, 'structure'>;
function StructureCanvasNode({data}: NodeProps<StructureFlowNode>) { return <StructureDiagram {...data}/>; }
const nodeTypes = { structure: StructureCanvasNode };
export function StructureView({ selected, onSelect }: { selected?: string; onSelect: (id: string) => void }) {
  const [mode, setMode] = useState<StructureLayout>('boxes');
  const graph = useMemo(() => layoutStructure(cabinStructure, mode), [mode]);
  const nodes = useMemo<StructureFlowNode[]>(() => [{ id: 'component-structure', type: 'structure', position: {x:0,y:0}, data:{mode,selected,onSelect}, style:{width:graph.width,height:graph.contentHeight+172}, selectable:false,draggable:false }], [mode,selected,onSelect,graph]);
  return <div className="structure-view"><div className="structure-toolbar" role="group" aria-label="Structure layout"><button type="button" aria-pressed={mode==='boxes'} onClick={()=>setMode('boxes')}>Box in box</button><button type="button" aria-pressed={mode==='tree'} onClick={()=>setMode('tree')}>Tree</button><span>Same components and ownership · choose a layout</span></div><div className={`structure-canvas${mode==='tree'?' is-tree':''}`} aria-label="Interactive recursive component structure"><ReactFlow<StructureFlowNode> key={mode} nodes={nodes} edges={[]} nodeTypes={nodeTypes} fitView fitViewOptions={{padding:0.05,maxZoom:1}} minZoom={0.2} maxZoom={2} nodesDraggable={false} nodesConnectable={false} zoomOnScroll={false} preventScrolling={false}><Background gap={24}/><Controls showInteractive={false}/></ReactFlow></div></div>;
}
