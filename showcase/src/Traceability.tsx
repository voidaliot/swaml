import { useMemo, useState } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import demo from '../../spec/traceability-demo.json';
import source from '../../examples/16-requirements-and-views.swaml?raw';
import './traceability.css';

type Element = typeof demo.views[number]['elements'][number];
type TraceNode = Node<{ element: Element; showDoc: boolean; showNotes: boolean }, 'trace'>;
function TraceCard({data}:NodeProps<TraceNode>) {
  const e=data.element;
  return <div className="trace-card">
    <Handle type="target" position={Position.Left}/><Handle type="source" position={Position.Right}/>
    <span className="eyebrow">{e.kind}</span><strong>{e.name}</strong><code>{e.path}</code>
    {!!e.attributes.length && <dl>{e.attributes.map(a=><div key={a.name}><dt>{a.name}: {a.type}</dt><dd>{a.value}</dd></div>)}</dl>}
    {data.showDoc && e.doc && <div className="trace-doc"><span>doc</span><p>{e.doc}</p></div>}
    {data.showNotes && e.comments.map((c,i)=><div className="trace-note" key={i}>{c.replace(/^\/\/\s?/, '')}</div>)}
  </div>;
}
const nodeTypes={trace:TraceCard};
export function Traceability(){
  const [selected,setSelected]=useState('assurance'),[table,setTable]=useState(false),[showDoc,setShowDoc]=useState(true),[showNotes,setShowNotes]=useState(false),[showSource,setShowSource]=useState(false);
  const view=demo.views.find(v=>v.name===selected)!;
  const nodes=useMemo<TraceNode[]>(()=>view.elements.map((element,i)=>({id:element.path,type:'trace',position:view.name==='assurance'?({BoundedResult:{x:940,y:20},Demo:{x:0,y:270},'Demo.first':{x:470,y:0},'Demo.second':{x:470,y:460},StartWorkers:{x:0,y:0},CheckResults:{x:940,y:460}}[element.path]??{x:0,y:0}):{x:(i%2)*470,y:Math.floor(i/2)*300},data:{element,showDoc,showNotes}})),[view,showDoc,showNotes]);
  const ids=new Set(nodes.map(n=>n.id));
  const edges=demo.relations.filter(r=>ids.has(r.source)&&ids.has(r.target)).map((r,i)=>({id:String(i),source:r.source,target:r.target,label:r.kind,markerEnd:{type:MarkerType.Arrow,width:18,height:18},style:{stroke:'#718687',strokeDasharray:'6 5'},labelStyle:{fontSize:16,fill:'#254e50'},type:'smoothstep'}));
  return <section id="traceability" className="trace-section" aria-labelledby="trace-title">
    <div className="section-intro"><div><span className="eyebrow">INTENT → DESIGN → VERIFICATION</span><h2 id="trace-title">A specification you can trace.</h2></div><p>Give each obligation a home.<br/>Keep the design claim and its verification explicit.</p></div>
    <div className="trace-toolbar"><label>Authored view <select aria-label="Traceability view" value={selected} onChange={e=>setSelected(e.target.value)}>{demo.views.map(v=><option key={v.name} value={v.name}>{v.name} · {v.kind}</option>)}</select></label><button aria-pressed={table} onClick={()=>setTable(!table)}>{table?'Show diagram':'Show table'}</button><label><input type="checkbox" checked={showDoc} onChange={e=>setShowDoc(e.target.checked)}/>Formal docs</label><label><input type="checkbox" checked={showNotes} onChange={e=>setShowNotes(e.target.checked)}/>Ordinary notes</label></div>
    {table?<div className="trace-table-wrap"><table className="trace-table"><thead><tr><th>Element / kind</th><th>Attributes</th>{showDoc&&<th>doc</th>}{showNotes&&<th>Comments</th>}<th>Relations</th></tr></thead><tbody>{view.elements.map(e=><tr key={e.path}><th>{e.path}<small>{e.kind}</small></th><td>{e.attributes.map(a=><div key={a.name}>{a.name}: {a.type} = {a.value}</div>)}</td>{showDoc&&<td>{e.doc||'—'}</td>}{showNotes&&<td>{e.comments.join('\n')||'—'}</td>}<td>{demo.relations.filter(r=>r.source===e.path||r.target===e.path).map((r,i)=><div key={i}>{r.source} → {r.kind} → {r.target}</div>)}</td></tr>)}</tbody></table></div>:<div className="trace-canvas"><ReactFlow<TraceNode> key={`${selected}-${showDoc}-${showNotes}`} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{padding:0.15}} nodesConnectable={false} nodesDraggable={false} minZoom={0.2} maxZoom={1.4}><Background/><Controls showInteractive={false}/></ReactFlow></div>}
    <div className="trace-foot"><p><strong>satisfy</strong> records a design claim. <strong>verify</strong> identifies verification intent. Results come from a separate test, simulation or review.</p><button onClick={()=>setShowSource(!showSource)}>{showSource?'View declaration':'Complete example'}</button></div>
    <pre className="trace-source" tabIndex={0} aria-label="Traceability source"><code>{showSource?source:view.source}</code></pre>
  </section>;
}
