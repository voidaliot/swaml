import { MarkerType, Position } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import type { ClassifierKind, PortDescription } from './DiagramGlyphs';
import source from '../../examples/08-service-field.swaml?raw';
import lifecycleSource from '../../examples/04-stateful-function.swaml?raw';

export { source, lifecycleSource };
export const repository = 'https://github.com/voidaliot/swaml';
export type ViewId = 'Browser' | 'gv' | 'iv' | 'cv' | 'sv' | 'grv' | 'fv' | 'tv';
export const views: { id: ViewId; name: string; caption: string; subject: string }[] = [
  { id: 'Browser', name: 'Model browser', caption: 'Follow the ownership', subject: 'Settings' },
  { id: 'gv', name: 'General', caption: 'See the big picture', subject: 'Settings::Cabin' },
  { id: 'iv', name: 'Interconnect', caption: 'Inspect the boundaries', subject: 'Settings::Cabin' },
  { id: 'cv', name: 'Case', caption: 'Connect intent to a scenario', subject: 'Settings::Cabin' },
  { id: 'sv', name: 'Sequence', caption: 'Follow the exchanges', subject: 'Settings::Change' },
  { id: 'grv', name: 'Grid', caption: 'Compare exact properties', subject: 'Settings' },
  { id: 'fv', name: 'Flow', caption: 'Look inside a function', subject: 'Settings::Cabin.settings.store.update' },
  { id: 'tv', name: 'Timing', caption: 'Compare function activation timing', subject: 'FunctionTiming::Demo.first.poll' },
];

export type Entity = {
  id: string; kind: string; name: string; path: string; description: string;
  owner: string; definition?: string; properties: [string, string][]; snippet: string;
};
const entity = (id: string, kind: string, name: string, path: string, owner: string,
  description: string, properties: [string, string][], snippet: string, definition?: string): Entity =>
  ({ id, kind, name, path, owner, description, properties, snippet, definition });

export const entities: Entity[] = [
  entity('package', 'Package', 'Settings', 'Settings', 'Model', 'One namespace for the contracts, architecture, behavior and scenario in this example.', [['Source', '08-service-field.swaml']], 'package Settings {'),
  entity('policy', 'QoS policy definition', 'LocalLink', 'Settings::LocalLink', 'Settings', 'One reusable set of communication policy values. Each connector still has independent queues and route identity.', [['Delivery', 'atMostOnce'], ['Ordering', 'fifo'], ['Capacity', '8'], ['Overflow', 'reject'], ['Referenced by', 'adjustCommand, frontLink, rearLink']], 'qos def LocalLink {\n    delivery atMostOnce; ordering fifo; capacity 8; overflow reject;\n}'),
  entity('contract', 'Interface', 'TemperatureSetting', 'Settings::TemperatureSetting', 'Settings', 'A versioned service contract. Requests and results share their route; changed events travel from provides to requires.', [['Kind', 'service'], ['Version', '1.0.0'], ['get()', 'int · idempotent'], ['setPoint(desired: int)', 'bool'], ['changed(current: int)', 'event']], 'interface service TemperatureSetting version "1.0.0" {\n    function get(): int idempotent;\n    function setPoint(desired: int): bool;\n    event changed(current: int);\n}'),
  entity('input-contract', 'Interface', 'PanelCommands', 'Settings::PanelCommands', 'Settings', 'A typed adjustment input. The root publishes a desired setting; the front panel receives the copied integer through its delegated control port.', [['Kind', 'publishSubscribe'], ['Version', '1.0.0'], ['adjust(desired: int)', 'event']], 'interface publishSubscribe PanelCommands version "1.0.0" { event adjust(desired: int); }'),
  entity('service-def', 'Component definition', 'Service', 'Settings::Service', 'Settings', 'A reusable composition boundary. Its api port delegates to the owned store component.', [['Port', 'api · provides'], ['Child', 'store : SettingStore'], ['Delegation', 'api → store.api']], 'component def Service {\n    port api: TemperatureSetting provides;\n    component store: SettingStore;\n    delegate api -> store.api;\n}'),
  entity('client-def', 'Component definition', 'Client', 'Settings::Client', 'Settings', 'A reusable client component. The front and rear usages share this definition, while retaining distinct instance identities.', [['Port', 'setting · requires'], ['Control port', 'control · subscriber · optional'], ['Child', 'panel : Panel'], ['Delegation', 'setting → panel.setting; control → panel.control']], 'component def Client {\n    port setting: TemperatureSetting requires;\n    port control: PanelCommands subscriber optional;\n    component panel: Panel;\n    delegate setting -> panel.setting;\n    delegate control -> panel.control;\n}'),
  entity('store-def', 'Component definition', 'SettingStore', 'Settings::SettingStore', 'Settings', 'The behavior and private data boundary for the setting service.', [['Port', 'api · provides'], ['Private data', 'currentValue: int = 20'], ['Functions', 'read, update']], 'component def SettingStore {\n    port api: TemperatureSetting provides;\n    var currentValue: int = 20;', undefined),
  entity('panel-def', 'Component definition', 'Panel', 'Settings::Panel', 'Settings', 'Owns a private displayed value, a typed adjustment handler, a local refresh helper and a service-event handler. Distinct panel instances do not share storage.', [['Port', 'setting · requires'], ['Control port', 'control · subscriber · optional'], ['Private data', 'displayed: int = 20'], ['Functions', 'adjust, refresh, display']], 'component def Panel {\n    port setting: TemperatureSetting requires;\n    port control: PanelCommands subscriber optional;\n    var displayed: int = 20;'),
  entity('root', 'Root component', 'Cabin', 'Settings::Cabin', 'Settings', 'The root owns its startup input driver, one service and two independent clients. The driver publishes a typed adjustment event to the front panel.', [['Profile', 'service (default)'], ['Immediate children', 'settings, front, rear'], ['Port', 'panelInput: PanelCommands publisher'], ['Functions', 'driveInputs() on start'], ['Connectors', 'adjustCommand, frontLink, rearLink'], ['Deployment targets', 'system:controller, system:displays']], 'component Cabin {', undefined),
  entity('input-driver', 'Function instance', 'driveInputs()', 'Settings::Cabin.driveInputs', 'Settings::Cabin', 'An ordinary root-owned startup function publishes the demo input through its typed port.', [['Trigger', 'on start'], ['Emission', 'panelInput.adjust(22)'], ['Route', 'adjustCommand → front.control → panel.control']], 'function driveInputs() on start { publish panelInput.adjust(22); }'),
  entity('adjustCommand', 'Connector', 'adjustCommand', 'Settings::Cabin.adjustCommand', 'Settings::Cabin', 'The explicit typed input route from the root publisher to the front client boundary, delegated to its panel.', [['Source', 'panelInput'], ['Target', 'front.control'], ['Interface', 'PanelCommands · 1.0.0'], ['Policy definition', 'Settings::LocalLink']], 'connect adjustCommand: panelInput -> front.control qos LocalLink;'),
  entity('front', 'Component instance', 'front', 'Settings::Cabin.front', 'Settings::Cabin', 'The front client receives typed adjustment commands from the root and delegates them to its nested panel. That panel has its own displayed value.', [['Port', 'setting: TemperatureSetting'], ['Role', 'requires'], ['Control input', 'control: PanelCommands subscriber → panel.control'], ['Delegation', 'setting → panel.setting'], ['Deployment', 'system:displays · explicit'], ['Owned component', 'panel : Panel']], 'component front: Client;', 'Settings::Client'),
  entity('settings', 'Component instance', 'settings', 'Settings::Cabin.settings', 'Settings::Cabin', 'The service instance. Both clients connect through its visible api boundary; delegation resolves to store.api.', [['Port', 'api: TemperatureSetting'], ['Role', 'provides'], ['Delegation', 'api → store.api'], ['Deployment', 'system:controller · explicit'], ['Owned component', 'store : SettingStore']], 'component settings: Service;', 'Settings::Service'),
  entity('rear', 'Component instance', 'rear', 'Settings::Cabin.rear', 'Settings::Cabin', 'A second use of Client. Reusing the type shares the definition, never its panel storage. Its optional control input is unconnected in this root.', [['Port', 'setting: TemperatureSetting'], ['Role', 'requires'], ['Control input', 'control: PanelCommands subscriber · optional · unconnected'], ['Delegation', 'setting → panel.setting'], ['Deployment', 'system:displays · explicit'], ['Owned component', 'panel : Panel']], 'component rear: Client;', 'Settings::Client'),
  entity('front-panel', 'Component instance', 'front.panel', 'Settings::Cabin.front.panel', 'Settings::Cabin.front', 'A component instance expanded from Client. Owns a separate displayed store.', [['Private data', 'displayed: int = 20'], ['Effective target', 'system:displays · inherited'], ['Functions', 'adjust, refresh, display']], 'component panel: Panel;', 'Settings::Panel'),
  entity('rear-panel', 'Component instance', 'rear.panel', 'Settings::Cabin.rear.panel', 'Settings::Cabin.rear', 'This instance has the same Panel definition as front.panel and a different private store.', [['Private data', 'displayed: int = 20'], ['Effective target', 'system:displays · inherited'], ['Functions', 'adjust, refresh, display']], 'component panel: Panel;', 'Settings::Panel'),
  entity('store', 'Component instance', 'settings.store', 'Settings::Cabin.settings.store', 'Settings::Cabin.settings', 'The service component instance. Only its own functions access currentValue.', [['Private data', 'currentValue: int = 20'], ['Effective target', 'system:controller · inherited'], ['Functions', 'read, update']], 'component store: SettingStore;', 'Settings::SettingStore'),
  ...['frontLink', 'rearLink'].map((id) => entity(id, 'Connector', id, `Settings::Cabin.${id}`, 'Settings::Cabin', 'An explicit service route with its own identity. The arrow follows requires → provides; events and correlated replies use the reverse direction. Effective values come from LocalLink; queues remain distinct.', [['Source', `${id === 'frontLink' ? 'front' : 'rear'}.setting`], ['Target', 'settings.api'], ['Interface', 'TemperatureSetting · 1.0.0'], ['Policy definition', 'Settings::LocalLink'], ['Delivery (effective)', 'atMostOnce'], ['Ordering (effective)', 'fifo'], ['Capacity (effective)', '8'], ['Overflow (effective)', 'reject']], `connect ${id}: ${id === 'frontLink' ? 'front' : 'rear'}.setting -> settings.api qos LocalLink;`)),
  entity('requirement', 'Requirement', 'VisibleSetting', 'Settings::VisibleSetting', 'Settings', 'Both panels can observe accepted temperature setting updates. Cabin claims satisfaction; evidence is recorded separately.', [['Coverage', 'claimed by Cabin'], ['Evidence', 'not supplied']], 'requirement VisibleSetting { doc /* Both panels can observe accepted temperature setting updates. */ }'),
  entity('case', 'Case', 'Change', 'Settings::Change', 'Settings', 'A descriptive partial order of route-valid exchanges, rather than an automatically executed test.', [['Root context', 'Cabin'], ['Design satisfaction', 'Cabin → VisibleSetting'], ['Steps', 'adjust, frontNotice, rearNotice, accepted'], ['Independent branches', 'frontNotice and rearNotice']], 'satisfy VisibleSetting of Cabin; useCase Change of Cabin {'),
  entity('update', 'Function instance', 'update(desired: int): bool', 'Settings::Cabin.settings.store.update', 'Settings::Cabin.settings.store', 'Checks the desired range, changes private state, publishes the service event and returns a bool result. This is a projection of the body, not a simulation.', [['Trigger', 'on call api.setPoint'], ['Owner', 'store : SettingStore'], ['Private write', 'currentValue = desired'], ['Emission', 'api.changed(currentValue)']], 'function update(desired: int): bool on call api.setPoint {\n    if (desired < 10 or desired > 30) { return false; }\n    currentValue = desired;\n    publish api.changed(currentValue);\n    return true;\n}', 'Settings::SettingStore.update'),
  entity('controller', 'External target', 'system:controller', 'system:controller', 'External system', 'An external deployment identity resolved by the host. The allocation applies to settings and its descendants.', [['Explicit deployment', 'settings'], ['Inherited deployment', 'settings.store']], 'deploy settings on "system:controller";'),
  entity('displays', 'External target', 'system:displays', 'system:displays', 'External system', 'An external target shared by two separate client instances. Their private stores remain distinct.', [['Explicit deployment', 'front, rear'], ['Inherited deployment', 'front.panel, rear.panel']], 'deploy front on "system:displays";\ndeploy rear on "system:displays";'),
];
export const byId = Object.fromEntries(entities.map((item) => [item.id, item]));

export interface StructureOccurrence {
  id: string; title: string; path: string; variables: string[]; functions: string[];
  classifierKind?: ClassifierKind;
  children: StructureOccurrence[];
}
const occurrence = (id: string, title: string, children: StructureOccurrence[] = [], variables: string[] = [], functions: string[] = []): StructureOccurrence => ({
  id, title, path: byId[id].path, children, variables, functions,
});
/** The same occurrence identities drive nested boxes and the ownership tree. */
export const cabinStructure: StructureOccurrence = occurrence('root', 'Cabin', [
  occurrence('settings', 'settings : Service', [occurrence('store', 'store : SettingStore', [], ['currentValue: int = 20'], ['read(): int', 'update(desired: int): bool'])]),
  occurrence('front', 'front : Client', [occurrence('front-panel', 'panel : Panel', [], ['displayed: int = 20'], ['adjust(desired: int)', 'refresh()', 'display(current: int)'])]),
  occurrence('rear', 'rear : Client', [occurrence('rear-panel', 'panel : Panel', [], ['displayed: int = 20'], ['adjust(desired: int)', 'refresh()', 'display(current: int)'])]),
], [], ['driveInputs()']);
export const cabinDeployments = [
  { id: 'controller', target: 'system:controller', sources: ['settings'], note: 'settings.store inherits this target' },
  { id: 'displays', target: 'system:displays', sources: ['front', 'rear'], note: 'front.panel and rear.panel inherit this target' },
];

export type CardData = {
  title: string; eyebrow: string; detail?: string; footer?: string;
  entityId?: string; port?: string; portSide?: 'left' | 'right'; inputPort?: string;
  boundaryPorts?: PortDescription[]; classifierKind?: ClassifierKind;
  variant?: 'component' | 'definition' | 'root' | 'function' | 'decision' | 'terminal' | 'requirement' | 'state' | 'entry';
  vertical?: boolean;
} & Record<string, unknown>;
export type DiagramNode = Node<CardData, 'card'>;
const card = (id: string, x: number, y: number, data: CardData): DiagramNode => ({ id, type: 'card', position: { x, y }, data, sourcePosition: data.vertical ? Position.Bottom : Position.Right, targetPosition: data.vertical ? Position.Top : Position.Left });
const edge = (id: string, from: string, to: string, label?: string, dashed = false): Edge => ({ id, source: from, target: to, label, type: 'smoothstep', markerEnd: { type: dashed ? MarkerType.Arrow : MarkerType.ArrowClosed, width: 16, height: 16, color: '#5d7066' }, style: { stroke: '#718278', strokeWidth: 1.5, ...(dashed ? { strokeDasharray: '5 5' } : {}) }, labelStyle: { fill: '#3e5147', fontSize: 11, fontWeight: 500 }, labelBgStyle: { fill: '#f7f8f3', fillOpacity: 1 }, labelBgPadding: [7, 5] });

export function diagram(view: ViewId, stateMode = false): { nodes: DiagramNode[]; edges: Edge[] } {
  if (view === 'gv' || view === 'tv') return { nodes: [], edges: [] }; // Dedicated structure/timing renderers retain their own geometry and evidence.
  if (view === 'iv') return {
    nodes: [
      card('input-driver', 0, 25, { title: 'Cabin', eyebrow: 'root component', detail: 'driveInputs() on start', footer: 'publish panelInput.adjust(22)', boundaryPorts: [{ name: 'panelInput', role: 'publisher', contract: 'PanelCommands', version: '1.0.0', side: 'right' }], entityId: 'root', variant: 'root' }),
      card('front', 420, 25, { title: 'front : Client', eyebrow: 'component instance', detail: 'control → panel.control', footer: 'system:displays', boundaryPorts: [{ name: 'control', role: 'subscriber', contract: 'PanelCommands', version: '1.0.0', side: 'left', optional: true }, { name: 'setting', role: 'requires', contract: 'TemperatureSetting', version: '1.0.0', side: 'right' }], entityId: 'front', variant: 'component' }),
      card('settings', 850, 170, { title: 'settings : Service', eyebrow: 'component instance', detail: 'store : SettingStore', footer: 'system:controller', boundaryPorts: [{ name: 'api', role: 'provides', contract: 'TemperatureSetting', version: '1.0.0', side: 'left' }], entityId: 'settings', variant: 'component' }),
      card('rear', 420, 325, { title: 'rear : Client', eyebrow: 'component instance', detail: 'panel : Panel', footer: 'system:displays', boundaryPorts: [{ name: 'setting', role: 'requires', contract: 'TemperatureSetting', version: '1.0.0', side: 'right' }], entityId: 'rear', variant: 'component' }),
    ], edges: [{ ...edge('adjustCommand', 'input-driver', 'front', 'adjustCommand · adjust(desired)'), sourceHandle: 'panelInput', targetHandle: 'control', type: 'default' }, { ...edge('frontLink', 'front', 'settings', 'frontLink · QoS'), sourceHandle: 'setting', targetHandle: 'api', type: 'default' }, { ...edge('rearLink', 'rear', 'settings', 'rearLink · QoS'), sourceHandle: 'setting', targetHandle: 'api', type: 'default' }],
  };
  if (view === 'cv') return { nodes: [
    card('root', 45, 330, { title: 'Cabin', eyebrow: 'component', detail: 'Design claims satisfaction', entityId: 'root' }),
    card('case', 45, 130, { title: 'Change', eyebrow: 'useCase · of Cabin', detail: '4 exchanges / 2 service routes', footer: 'descriptive scenario', entityId: 'case', variant: 'function' }),
    card('requirement', 460, 130, { title: 'VisibleSetting', eyebrow: 'requirement', detail: 'Both panels can observe accepted temperature setting updates.', footer: 'Evidence not supplied', entityId: 'requirement', variant: 'requirement' }),
  ], edges: [edge('coverage', 'root', 'requirement', 'satisfy', true), edge('case-context', 'case', 'root', 'of', true)] };
  if (view === 'fv' && stateMode) return { nodes: [
    card('initial', 0, 120, { title: '●', eyebrow: 'initial', variant: 'entry' }),
    card('Idle', 170, 100, { title: 'Idle', eyebrow: 'state', detail: 'entry / publish status.changed("idle")', variant: 'state' }),
    card('Running', 520, 100, { title: 'Running', eyebrow: 'state', detail: 'entry / cycles = cycles + 1; publish status.changed("running")', variant: 'state' }),
    card('Stopped', 870, 100, { title: 'Stopped  ◉', eyebrow: 'state · final', detail: 'entry / publish status.changed("stopped")', variant: 'state' }),
  ], edges: [edge('init', 'initial', 'Idle', 'initial reference'), edge('beginRun', 'Idle', 'Running', 'receive commands.begin'), edge('stopRun', 'Running', 'Stopped', 'receive commands.stop'), { ...edge('expire', 'Running', 'Stopped', 'after 30 s / publish "timeout"'), sourceHandle: 'bottom', targetHandle: 'bottom', type: 'smoothstep', pathOptions: { offset: 75 } } as Edge] };
  return { nodes: [
    card('start', 320, 0, { title: '●', eyebrow: 'activation', detail: 'on call api.setPoint', variant: 'entry', vertical: true, entityId: 'update' }),
    card('range', 285, 155, { title: 'Outside 10…30?', eyebrow: 'if · bool condition', detail: 'desired < 10 or desired > 30', variant: 'decision', vertical: true, entityId: 'update' }),
    card('false', 0, 340, { title: 'return false', eyebrow: 'completion · bool', variant: 'terminal', vertical: true, entityId: 'update' }),
    card('write', 400, 340, { title: 'currentValue = desired', eyebrow: 'private assignment', detail: 'inside settings.store', variant: 'function', vertical: true, entityId: 'update' }),
    card('publish', 400, 515, { title: 'publish api.changed', eyebrow: 'outgoing service event', detail: '(currentValue)', footer: 'uses the existing interface route', variant: 'function', vertical: true, entityId: 'update' }),
    card('true', 400, 730, { title: 'return true', eyebrow: 'completion · bool', variant: 'terminal', vertical: true, entityId: 'update' }),
  ], edges: [edge('start-range', 'start', 'range'), edge('invalid', 'range', 'false', 'true'), edge('valid', 'range', 'write', 'false'), edge('write-publish', 'write', 'publish'), edge('publish-return', 'publish', 'true')] };
}

export const viewDescriptions: Record<ViewId, string> = {
  Browser: 'Navigate declarations and distinct instances. Selection reveals identity, owner and source.',
  gv: 'real ownership, from the root to its private component stores. Shared types keep distinct instance paths.',
  iv: 'A typed adjustment input and two service routes. Requests follow service arrows; events and replies return on those routes.',
  cv: 'Use cases describe intent. Components claim requirement satisfaction; verification needs separate evidence.',
  sv: 'Case exchanges preserve the authored dependencies. Two notifications are independent after adjust.',
  grv: 'An identity-aware inventory of this example. Filter and sort without changing the model.',
  fv: 'The local control flow of one function. Statements never become free architecture elements.',
  tv: 'Declared function timing contracts and observed activation timing, with independent occurrence identities.',
};
