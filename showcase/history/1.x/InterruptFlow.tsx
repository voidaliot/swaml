import { useEffect, useId } from 'react';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import type { Entity } from './model';
import source from '../../examples/19-interruptible-function.swaml?raw';
import './interrupt-flow.css';

function InterruptDiagram() {
  const title = useId(), description = useId(), arrow = useId();
  return <svg className="interrupt-svg" width="1080" height="740" viewBox="0 0 1080 740" role="img" aria-labelledby={`${title} ${description}`}>
    <title id={title}>Worker.run interruptible region and typed cancellation route</title>
    <desc id={description}>A startup function enters interruptible work, sets status to one, calls job.perform and normally stores its result. An incoming control.stop event cancels the protected continuation, executes the handler with its reason payload, then continues to the assertion. Incoming control comes through stopRoute. The request uses workRoute. Cancellation does not undo the server's committed effects.</desc>
    <defs><marker id={arrow} markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#547474"/></marker></defs>
    <rect width="1080" height="740" fill="#fff"/>
    <text x="40" y="33" className="interrupt-heading">Interrupts::App.worker.run</text>
    <text x="40" y="55" className="interrupt-muted">Executable function · on start · fv projection</text>
    <circle cx="350" cy="86" r="7" fill="#245c61"/>
    <rect x="50" y="118" width="600" height="368" fill="#eef6f4" stroke="#658d88" strokeDasharray="7 4"/>
    <text x="70" y="147" className="interrupt-heading">interruptible work</text>
    <line x1="50" x2="650" y1="162" y2="162" stroke="#afcac3"/>
    <path d="M350 93V180" className="interrupt-edge" markerEnd={`url(#${arrow})`}/>
    <rect x="205" y="185" width="290" height="50" rx="5" fill="#fff" stroke="#74938e"/>
    <text x="350" y="215" textAnchor="middle">status = 1</text>
    <path d="M350 235V266" className="interrupt-edge" markerEnd={`url(#${arrow})`}/>
    <rect x="130" y="270" width="440" height="84" rx="5" fill="#fff" stroke="#74938e"/>
    <text x="350" y="297" textAnchor="middle">call job.perform() as value</text>
    <text x="350" y="320" textAnchor="middle" className="interrupt-muted">within 50 ms · otherwise fail</text>
    <text x="350" y="340" textAnchor="middle" className="interrupt-route">workRoute → backend.api.perform</text>
    <path d="M350 354V385" className="interrupt-edge" markerEnd={`url(#${arrow})`}/>
    <rect x="205" y="390" width="290" height="50" rx="5" fill="#fff" stroke="#74938e"/>
    <text x="350" y="420" textAnchor="middle">status = value</text>
    <path d="M350 440V560" className="interrupt-edge" markerEnd={`url(#${arrow})`}/>
    <text x="362" y="523" className="interrupt-muted">normal continuation</text>
    <rect x="720" y="118" width="320" height="88" fill="#f3f0e7" stroke="#b2a27b"/>
    <rect x="714" y="153" width="12" height="12" fill="#fff" stroke="#8e7b4a"/>
    <text x="738" y="144" className="interrupt-heading">control: Control subscriber</text>
    <text x="738" y="169" className="interrupt-route">Control.stop(reason: string)</text>
    <text x="738" y="190" className="interrupt-muted">controller.control → stopRoute</text>
    <path d="M880 206V265" className="interrupt-edge" markerEnd={`url(#${arrow})`}/>
    <path d="M650 310H716" className="interrupt-edge interrupt-cancel" markerEnd={`url(#${arrow})`}/>
    <text x="685" y="256" textAnchor="middle" className="interrupt-cancel-label">interrupt</text>
    <rect x="720" y="270" width="320" height="148" rx="5" fill="#fcf2e3" stroke="#b39869"/>
    <text x="880" y="301" textAnchor="middle" className="interrupt-heading">on receive control.stop</text>
    <line x1="720" x2="1040" y1="316" y2="316" stroke="#d9c69e"/>
    <text x="880" y="348" textAnchor="middle">status = 2</text>
    <text x="880" y="375" textAnchor="middle">why = reason</text>
    <text x="880" y="399" textAnchor="middle" className="interrupt-muted">copied event payload</text>
    <path d="M880 418V529H610V559" className="interrupt-edge" markerEnd={`url(#${arrow})`}/>
    <rect x="195" y="565" width="560" height="84" rx="5" fill="#fff" stroke="#74938e"/>
    <text x="475" y="596" textAnchor="middle" className="interrupt-heading">Continue the enclosing function</text>
    <text x="475" y="626" textAnchor="middle">assert status == 2</text>
    <path d="M475 649V680" className="interrupt-edge" markerEnd={`url(#${arrow})`}/>
    <circle cx="475" cy="692" r="10" fill="#fff" stroke="#245c61" strokeWidth="2"/><circle cx="475" cy="692" r="5" fill="#245c61"/>
    <text x="40" y="726" className="interrupt-muted">Flow is owned by Worker.run. Both exchanges retain their typed ports and authored connectors.</text>
  </svg>;
}
const nodeTypes = { interrupt: InterruptDiagram };
const nodes: Node[] = [{ id: 'interruptible-work', type: 'interrupt', position: { x: 0, y: 0 }, data: {}, style: { width: 1080, height: 740 }, selectable: false, draggable: false }];
export function InterruptFlow({ onSelect }: { onSelect?: (entity: Entity) => void }) {
  useEffect(() => { onSelect?.({ id: 'interruptible-work', kind: 'Interruptible region', name: 'work', path: 'Interrupts::App.worker.run.work', owner: 'Interrupts::App.worker.run',
    definition: 'Interrupts::Worker.run', description: 'A typed control.stop event cancels the protected continuation, runs its local handler and then continues the enclosing function. An outstanding routed request becomes terminal; server effects remain committed.',
    properties: [['Incoming member', 'control.stop(reason: string)'], ['Incoming route', 'stopRoute'], ['Request route', 'workRoute'], ['Owner', 'worker : Worker'], ['Behavior', 'cancel region, handle event, continue']], snippet: source }); }, [onSelect]);
  return <div className="interrupt-flow"><p className="interrupt-intro">A protected region has one incoming typed event handler. An interrupt cancels that region’s pending continuation and request wait; the handler receives the event payload and then continues after the region.</p><div className="interrupt-canvas"><ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.06, maxZoom: 1 }} nodesConnectable={false} nodesDraggable={false} minZoom={0.2} maxZoom={2} zoomOnScroll={false} preventScrolling={false}><Background gap={24}/><Controls showInteractive={false}/></ReactFlow></div><p className="interrupt-boundary">The example asserts the cancellation outcome. Cancellation leaves the backend’s committed effects intact. A late response cannot resume the cancelled request.</p><details><summary>Inspect complete interrupt example</summary><pre tabIndex={0}><code>{source}</code></pre></details></div>;
}
