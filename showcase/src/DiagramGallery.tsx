import type { ViewId } from './model';

export type DiagramId = 'gv' | 'iv' | 'sv' | 'cv' | 'grv' | 'flow' | 'states' | 'interrupts' | 'timing';
export type FlowMode = 'flow' | 'states' | 'timing' | 'interrupts';
export const diagramChoices: { id: DiagramId; title: string; view: ViewId; mode?: FlowMode; description: string; subject: string; example: string; sourceFile: string }[] = [
  { id: 'gv', sourceFile: '08-service-field.swaml', title: 'Structure', view: 'gv', description: 'Components, ownership and deployment.', subject: 'Settings::Cabin', example: 'Cabin temperature service' },
  { id: 'iv', sourceFile: '08-service-field.swaml', title: 'Connections', view: 'iv', description: 'Ports, interfaces and explicit routes.', subject: 'Settings::Cabin', example: 'Cabin temperature service' },
  { id: 'sv', sourceFile: '08-service-field.swaml', title: 'Sequence', view: 'sv', description: 'Messages, dependencies and replies.', subject: 'Settings::Change', example: 'Change a temperature setting' },
  { id: 'cv', sourceFile: '08-service-field.swaml', title: 'Cases & requirements', view: 'cv', description: 'Intent and design coverage.', subject: 'Settings::Cabin', example: 'A requirement and its coverage' },
  { id: 'grv', sourceFile: '08-service-field.swaml', title: 'Grid', view: 'grv', description: 'Compare model elements in a table.', subject: 'Settings', example: 'Cabin model inventory' },
  { id: 'flow', sourceFile: '08-service-field.swaml', title: 'Function flow', view: 'fv', mode: 'flow', description: 'Decisions, calls and local behavior.', subject: 'Settings::Cabin.settings.store.update', example: 'Update a temperature setting' },
  { id: 'states', sourceFile: '04-stateful-function.swaml', title: 'States', view: 'fv', mode: 'states', description: 'States and transitions inside a function.', subject: 'Lifecycle::Device.lifecycle', example: 'Device lifecycle' },
  { id: 'interrupts', sourceFile: '19-interruptible-function.swaml', title: 'Interrupts', view: 'fv', mode: 'interrupts', description: 'Cancel a region and handle an event.', subject: 'Interrupts::App.worker.run', example: 'Interrupt a running function' },
  { id: 'timing', sourceFile: '17-function-timing.swaml', title: 'Timing', view: 'fv', mode: 'timing', description: 'Function activations on a timeline.', subject: 'FunctionTiming::Demo', example: 'Observe requests and responses' },
];

/** Decorative previews identify diagram families; the live example carries model meaning. */
export function DiagramPreview({ kind }: { kind: DiagramId }) {
  return <svg className="diagram-preview" viewBox="0 0 100 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
    {kind === 'gv' ? <><rect x="7" y="5" width="86" height="54" rx="2"/><path d="M7 17H93"/><rect x="17" y="27" width="27" height="22"/><rect x="56" y="27" width="27" height="22"/><path d="M22 34H39M61 34H78"/></> :
      kind === 'iv' ? <><rect x="5" y="17" width="30" height="31" rx="2"/><rect x="65" y="17" width="30" height="31" rx="2"/><path d="M35 33H65m-6-4 6 4-6 4"/><rect x="31" y="29" width="7" height="7" fill="var(--surface)"/><rect x="62" y="29" width="7" height="7" fill="var(--surface)"/></> :
      kind === 'sv' ? <><rect x="9" y="6" width="24" height="13"/><rect x="67" y="6" width="24" height="13"/><path d="M21 19V59M79 19V59" strokeDasharray="3 3"/><path d="M21 31H79m-5-4 5 4-5 4M79 48H21m5-4-5 4 5 4"/></> :
      kind === 'cv' ? <><rect x="4" y="10" width="29" height="18" rx="6"/><rect x="66" y="23" width="30" height="27"/><rect x="4" y="41" width="29" height="18" rx="6"/><path d="M33 19H48V31H66M33 50H48V43H66M72 31H88M72 38H88" strokeDasharray="3 2"/></> :
      kind === 'grv' ? <><rect x="9" y="7" width="82" height="50" rx="2"/><path d="M9 20H91M9 32H91M9 44H91M35 7V57M65 7V57"/><path d="M15 13H28M41 13H58M71 13H84"/></> :
      kind === 'flow' ? <><path d="m50 6 17 12-17 12-17-12Z"/><path d="M50 30V39M33 18H18V39M50 55V61"/><rect x="7" y="39" width="23" height="16" rx="2"/><rect x="39" y="39" width="36" height="16" rx="2"/><path d="M18 55V60H50"/></> :
      kind === 'states' ? <><circle cx="11" cy="31" r="3" fill="currentColor"/><rect x="26" y="18" width="29" height="26" rx="8"/><rect x="69" y="18" width="27" height="26" rx="8"/><path d="M14 31H26M55 31H69m-5-4 5 4-5 4M83 18V8H40V18"/></> :
      kind === 'interrupts' ? <><rect x="6" y="8" width="47" height="47" strokeDasharray="4 3"/><rect x="16" y="21" width="27" height="20" rx="2"/><path d="M43 31H77m-5-4 5 4-5 4M86 8V23" strokeDasharray="4 3"/><rect x="69" y="23" width="27" height="20" rx="2"/><path d="M29 41V60H82V43"/></> :
      <><path d="M14 10V55M14 55H94M14 24H94M14 40H94" stroke="#b4c4d0"/><path d="M21 24H60M37 40H80" strokeWidth="7"/><path d="M60 17V31M80 33V47"/><path d="M86 10V55" strokeDasharray="3 3"/></>}
  </svg>;
}

export function DiagramGallery({ selected, onSelect }: { selected: string; onSelect: (id: DiagramId) => void }) {
  return <div className="diagram-gallery" role="group" aria-label="Diagram kinds">
    {diagramChoices.map(item => <button key={item.id} type="button" className={`diagram-choice ${selected === item.id ? 'is-active' : ''}`} aria-pressed={selected === item.id} aria-controls="diagram-example" onClick={() => onSelect(item.id)}>
      <DiagramPreview kind={item.id}/><span className="diagram-choice-copy"><span className="diagram-choice-title">{item.title}<code>{item.view}</code></span><span className="diagram-choice-description">{item.description}</span></span>
    </button>)}
  </div>;
}
