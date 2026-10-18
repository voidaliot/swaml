import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { Controls, ReactFlow, ReactFlowProvider, type Node, type NodeProps } from '@xyflow/react';
import { repository } from './model';
import './ontology.css';

type ConceptId = 'package' | 'definition' | 'occurrence' | 'variable' | 'function' | 'calculation' | 'body' | 'flow' | 'states' | 'transition' | 'interruptible' | 'port' | 'interface' | 'member' | 'connector' | 'delegation' | 'qos' | 'types' | 'requirement' | 'cases' | 'useCase' | 'verificationCase' | 'design' | 'view' | 'deployment' | 'external' | 'doc';
type Scope = 'core' | 'structure' | 'behavior' | 'contracts' | 'traceability';
type Concept = { title: string; kind: string; caption: string; detail: string; syntax: string; reference: string };
type Box = { id: ConceptId; x: number; y: number; width: number; height?: number; title?: string; caption?: string; compact?: boolean };
type Relation = { id: string; from: ConceptId; to: ConceptId; kind: 'owns' | 'reference'; label: string; path: string; x: number; y: number; align?: 'start' | 'middle' | 'end' };
type Diagram = { title: string; note: string; width: number; height: number; nodes: Box[]; edges: Relation[] };

const concepts: Record<ConceptId, Concept> = {
  package: { title: 'Package', kind: 'Namespace', caption: 'Owns top-level declarations', detail: 'Packages own component definitions, root usages, contracts, value types, requirements, cases, views and reusable QoS policies. A package is a namespace; it does not create another runtime software boundary.', syntax: 'package Architecture { … }', reference: 'docs/spec/01-structure-and-types.md' },
  definition: { title: 'Component definition', kind: 'Reusable definition', caption: 'Children · data · functions', detail: 'A reusable software boundary owns child usage declarations, ports, private variables, functions, connectors and delegation. It may specialize one base definition; compatible inherited replacements use redefines. Specialization is a reference between definitions, with no shared runtime store.', syntax: 'component def Controller specializes Base { … }', reference: 'docs/spec/01-structure-and-types.md' },
  occurrence: { title: 'Component occurrence', kind: 'Root or child', caption: 'Separate state per path', detail: 'A child usage is typed by one component definition. A root can instantiate a definition or author its members inline. Expanding a root produces an acyclic tree of occurrences, each with separate private state and activation identity. Definitions own declarations; occurrences contain their expanded child occurrences.', syntax: 'component controller: Controller;\ncomponent App { component controller: Controller; }', reference: 'docs/spec/04-systems-and-conformance.md' },
  variable: { title: 'Private variable', kind: 'Owned value', caption: 'One private cell per occurrence', detail: 'A component owns mutable typed private values. Every occurrence has its own cells. Local and parameter values belong to function scopes; another component cannot access them through a direct path.', syntax: 'var count: int = 0;', reference: 'docs/spec/01-structure-and-types.md' },
  function: { title: 'Function', kind: 'Executable behavior', caption: 'Calculations · one body', detail: 'A component owns executable functions. Each function owns local calculations and either statement flow or directly owned states and transitions. Both leaf and composite components can have behavior. Triggers, parameters, an optional result and timing describe activation and its contract.', syntax: 'function update(value: int) on receive input.value { … }', reference: 'docs/spec/03-behavior.md' },
  calculation: { title: 'Calculation', kind: 'Pure computation', caption: 'Typed inputs → result', detail: 'A calculation belongs to its enclosing function, is declared before that function’s executable body, and is visible only there. It evaluates one expression using copied explicit inputs and other local calculations. It cannot capture mutable state, communicate or call executable functions.', syntax: 'calc twice { in x: int; return result: int = x * 2; }', reference: 'docs/spec/03-behavior.md' },
  body: { title: 'Flow or states', kind: 'Function-owned body', caption: 'Choose one body form', detail: 'Statement flow and a state body are alternatives inside one function. Flow contains statements such as decisions, loops, calls and interruptible regions. For a state body, the function directly owns the states and transitions; each state owns its entry and exit blocks.', syntax: 'function run() { …statements… }\nfunction lifecycle() on start { initial Idle; state Idle {} }', reference: 'docs/spec/03-behavior.md' },
  flow: { title: 'Statement flow', kind: 'Function-owned body', caption: 'Decisions · loops · calls', detail: 'Statements run in order within lexical scopes. Flow supports var, assignment, if, bounded while/for/do loops, copied-array forEach, local and routed calls, send/publish, return, assert, fail and interruptible regions. These steps remain inside their owning software behavior.', syntax: 'for (var i: int = 0; i < 3; i = i + 1) bound 3 { … }', reference: 'docs/spec/03-behavior.md' },
  states: { title: 'State', kind: 'Function-owned state', caption: 'Entry and exit blocks', detail: 'A state is directly owned by a stateful function and may own entry and exit blocks. One state is initial; a final state completes the function. Transitions belong to the function, not to an individual state.', syntax: 'initial Idle;\nstate Idle { entry { … } exit { … } }', reference: 'docs/spec/03-behavior.md' },
  transition: { title: 'Transition', kind: 'Function-owned edge', caption: 'Trigger · guard · effect', detail: 'A transition references states in its owning function. It carries a receive/timer/completion trigger, optional pure guard, priority and an effect block. It neither creates a free event nor bypasses a component port.', syntax: 'transition begin: Idle -> Active on receive commands.begin { … }', reference: 'docs/spec/03-behavior.md' },
  interruptible: { title: 'Interruptible region', kind: 'Owned flow statement', caption: 'Protected body + typed handler', detail: 'A triggered serial flow function may protect a named region and receive a routed data/event input. Interruption cooperatively abandons that protected work, including a suspended caller-side request, and runs the handler in the same activation and deadline. Prior and remote effects remain committed.', syntax: 'interruptible work { … } on receive control.stop { … }', reference: 'docs/CONTROL_FLOW_AND_TIMING.md' },
  port: { title: 'Port', kind: 'Owned boundary', caption: 'Interface type + role', detail: 'A component owns each port. Its nominal interface type, direction role and optionality define a boundary endpoint. Every exchange between distinct component occurrences follows an interface member through an explicit connector or delegation route.', syntax: 'port api: Orders requires;', reference: 'docs/spec/02-communication.md' },
  interface: { title: 'Interface', kind: 'Versioned contract', caption: 'Data · events · signatures', detail: 'An interface owns typed data, events or function signatures. Its kind is senderReceiver, publishSubscribe, clientServer or service. An interface function is a signature; executable component functions provide its implementation.', syntax: 'interface service Orders version "1.0.0" { … }', reference: 'docs/spec/02-communication.md' },
  member: { title: 'Interface member', kind: 'Owned contract member', caption: 'Data · event · signature', detail: 'Data and event members describe typed exchanges; function signatures describe requests and correlated results. Incoming members have one receiving function owner. Outgoing data/events have an emitting function. Signatures have no executable body.', syntax: 'event accepted(orderId: string);\nfunction submit(orderId: string): bool;', reference: 'docs/spec/02-communication.md' },
  connector: { title: 'Connector', kind: 'Owned route', caption: 'Port endpoints + QoS', detail: 'A connector references compatible owned or immediate-child ports and selects a complete QoS value, inline or by a reusable policy reference. Queue identity belongs to each connector occurrence, direction and member. Reusing a policy never merges queues.', syntax: 'connect orders: client.api -> backend.api qos LocalLink;', reference: 'docs/spec/02-communication.md' },
  delegation: { title: 'Delegation', kind: 'Owned boundary alias', caption: 'Outer port → child port', detail: 'Delegation references an outer port and one immediate child port with the same interface identity and role. It forwards the boundary. It introduces no queue, conversion or additional local handler.', syntax: 'delegate api -> worker.api;', reference: 'docs/spec/02-communication.md' },
  qos: { title: 'QoS policy', kind: 'Reusable values', caption: 'Delivery · queue · timing', detail: 'A named policy owns complete delivery, ordering, capacity and overflow values, with optional latency/freshness bounds. Connectors may reference it or author the values inline. Each effective use is checked independently.', syntax: 'qos def LocalLink { delivery atMostOnce; ordering fifo; capacity 4; overflow reject; }', reference: 'docs/spec/02-communication.md' },
  types: { title: 'Value types', kind: 'Copied value domains', caption: 'Primitive / structured', detail: 'Private values, parameters, calculation outputs, payloads, results and requirement attributes use nominal value types. Primitive domains are bool, byte, uint, int, real and string; void means no result. Records, enums and fixed arrays add structured copied values.', syntax: 'bool · byte · uint · int · real · string\ndatatype Sample { value: real; }\nenum Mode { Idle, Running }', reference: 'docs/spec/01-structure-and-types.md' },
  requirement: { title: 'Requirement', kind: 'Named obligation', caption: 'Typed attributes · doc', detail: 'A requirement has immutable typed attributes and at most one formal doc. It has no subject or executable behavior. Design elements can claim satisfaction; verification cases can record verification intent. Neither relation supplies proof or a passed result.', syntax: 'requirement Safe { doc /* The result shall be bounded. */ attribute id: string = "REQ-1"; }', reference: 'docs/REQUIREMENTS_AND_DOCUMENTATION.md' },
  cases: { title: 'Case', kind: 'Intent in a root context', caption: 'useCase / verificationCase', detail: 'Both case kinds reference a root with of and can describe routed exchanges with explicit causal dependencies. A useCase describes intended use. Only a verificationCase owns verify links to requirements. Cases describe traces or procedures; they do not execute a second program.', syntax: 'useCase Start of App { … }\nverificationCase Check of App { verify Safe; }', reference: 'docs/spec/04-systems-and-conformance.md' },
  useCase: { title: 'Use case', kind: 'Intended use', caption: 'Root context + routed exchanges', detail: 'A use case references a root component and may describe representative exchanges. It can own one doc. It cannot own verify or serve as a satisfaction source.', syntax: 'useCase Start of App { doc /* A user starts the application. */ }', reference: 'docs/spec/04-systems-and-conformance.md' },
  verificationCase: { title: 'Verification case', kind: 'Verification intent', caption: 'Root context + verify links', detail: 'A verification case references a root and may describe a procedure in its doc, routed exchange steps, or both. Its verify links target requirements. Actual test, simulation, analysis or review evidence remains separate.', syntax: 'verificationCase Check of App { verify Safe; }', reference: 'docs/spec/04-systems-and-conformance.md' },
  design: { title: 'Design element', kind: 'Satisfaction source', caption: 'Declaration or occurrence', detail: 'A package owns each satisfaction claim. Its design source resolves within that package; the requirement follows normal import and qualification rules. The arrow points from design to requirement, although the textual relation names the requirement first. Requirements, cases, views and packages are not satisfaction sources.', syntax: 'satisfy Safe of App.controller;', reference: 'docs/spec/04-systems-and-conformance.md' },
  view: { title: 'View', kind: 'Model projection', caption: 'gv iv cv sv grv fv', detail: 'A view selects existing declarations or occurrence paths; optional include/recursive/where clauses form a stable filtered union. The six source view kinds project the same semantics. Browser is navigation. Function flow, states, timing and interrupt examples are fv presentations, not additional view kinds.', syntax: 'view structure iv of App;\nview behavior fv { include App recursive where kind == "function"; }', reference: 'docs/spec/04-systems-and-conformance.md' },
  deployment: { title: 'Deployment', kind: 'Root-owned binding', caption: 'Occurrence → external', detail: 'A root owns deployment bindings. Each binding references a component occurrence and an external system/part identity. Descendants inherit the nearest ancestor binding unless overridden. The host resolves external identity and execution suitability.', syntax: 'deploy controller on "sysml:Vehicle::ecu";', reference: 'docs/spec/04-systems-and-conformance.md' },
  external: { title: 'External system / part', kind: 'External reference', caption: 'Host-resolved identity', detail: 'An external deployment destination is an identity string, such as system:production or sysml:Vehicle::ecu. SWAML does not define that system, import its model or turn it into a software child. The integration host resolves it.', syntax: '"system:production"\n"sysml:Vehicle::ecu"', reference: 'docs/spec/04-systems-and-conformance.md' },
  doc: { title: 'Documentation', kind: 'Owned formal text', caption: 'At most one formal doc', detail: 'An eligible declaration may own one formal doc block. Ordinary // lines and /* */ blocks remain separate lexical comments and can appear as plain notes. A formal doc can be shown as an owned compartment or table column; comments are not a second formal specification.', syntax: 'doc /* Formal multiline specification. */\n// Ordinary source comment', reference: 'docs/REQUIREMENTS_AND_DOCUMENTATION.md' },
};

const b = (id: ConceptId, x: number, y: number, width = 210, caption?: string): Box => ({ id, x, y, width, caption });
const r = (id: string, from: ConceptId, to: ConceptId, kind: Relation['kind'], label: string, path: string, x: number, y: number, align: Relation['align'] = 'middle'): Relation => ({ id, from, to, kind, label, path, x, y, align });
const diagrams: Record<Scope, Diagram> = {
  core: {
    title: 'The core language model',
    note: 'Definitions own declarations. A root expands them into component occurrences with separate state.',
    width: 1120, height: 690,
    nodes: [{ ...b('package', 20, 12, 1080), height: 42, compact: true }, b('occurrence', 60, 80), b('definition', 350, 80), b('port', 640, 80, 190), b('interface', 900, 80), b('cases', 60, 250), b('function', 350, 250), b('connector', 640, 250, 190, 'Port endpoints + QoS'), b('types', 900, 250), b('requirement', 60, 420), b('view', 350, 420), b('calculation', 640, 420, 190), b('body', 900, 420), b('deployment', 350, 590), b('external', 640, 590, 270)],
    edges: [
      r('package-definition', 'package', 'definition', 'owns', 'owns', 'M455 54V80', 475, 73, 'start'),
      r('package-root', 'package', 'occurrence', 'owns', 'owns roots', 'M165 54V80', 185, 73, 'start'),
      r('package-interface', 'package', 'interface', 'owns', 'owns', 'M1005 54V80', 1025, 73, 'start'),
      r('root-children', 'occurrence', 'occurrence', 'owns', 'children', 'M270 140H290V200H215V160', 237, 220),
      r('owns-connector', 'definition', 'connector', 'owns', 'owns', 'M560 145H608V210H705V250', 624, 200, 'start'),
      r('owns-deployment', 'occurrence', 'deployment', 'owns', 'root owns', 'M60 140H32V630H350', 170, 618),
      r('use-type', 'occurrence', 'definition', 'reference', 'typed by¹', 'M270 120H350', 310, 108),
      r('owns-function', 'definition', 'function', 'owns', 'owns', 'M455 160V250', 476, 210, 'start'),
      r('owns-port', 'definition', 'port', 'owns', 'owns', 'M560 120H640', 600, 108),
      r('port-type', 'port', 'interface', 'reference', 'typed by', 'M830 120H900', 865, 108),
      r('case-context', 'cases', 'occurrence', 'reference', 'of root', 'M165 250V160', 145, 210, 'end'),
      r('verify', 'cases', 'requirement', 'reference', 'verify²', 'M165 330V420', 186, 378, 'start'),
      r('satisfy', 'definition', 'requirement', 'reference', 'satisfy', 'M350 120H305V460H270', 289, 355, 'end'),
      r('route-ports', 'connector', 'port', 'reference', 'endpoints', 'M735 250V160', 754, 210, 'start'),
      r('owns-calc', 'function', 'calculation', 'owns', 'owns', 'M455 330V375H735V420', 661, 365),
      r('owns-body', 'function', 'body', 'owns', 'owns', 'M560 290H600V350H1005V420', 1025, 385, 'start'),
      r('value-types', 'calculation', 'types', 'reference', 'typed values', 'M830 460H860V290H900', 878, 388, 'start'),
      r('view-subjects', 'view', 'function', 'reference', 'selects', 'M350 460H328V290H350', 320, 405, 'end'),
      r('deployment-target', 'deployment', 'external', 'reference', 'on', 'M560 630H640', 600, 618),
    ],
  },
  structure: {
    title: 'Definitions, occurrences and ownership',
    note: 'The ownership tree is acyclic. Reusing or specializing a definition never merges private state.',
    width: 1120, height: 620,
    nodes: [b('definition', 60, 100, 250), b('occurrence', 430, 100, 250), b('deployment', 820, 100, 250), b('variable', 60, 350, 250), b('function', 430, 350, 250), b('external', 820, 350, 250), b('package', 60, 510, 620)],
    edges: [
      r('package-definitions', 'package', 'definition', 'owns', 'owns definitions', 'M60 550H32V140H60', 140, 475),
      r('root-deployment', 'occurrence', 'deployment', 'owns', 'root owns', 'M680 110H820', 750, 96),
      r('instance-type', 'occurrence', 'definition', 'reference', 'typed by¹', 'M430 125H310', 370, 111),
      r('owns-children', 'definition', 'occurrence', 'owns', 'owns child usages', 'M310 161H430', 370, 190),
      r('nested', 'occurrence', 'occurrence', 'owns', 'nested occurrences', 'M680 140H730V240H555V180', 632, 268),
      r('specializes', 'definition', 'definition', 'reference', 'specializes · 0..1 base', 'M85 100V42H285V100', 185, 28),
      r('private-values', 'definition', 'variable', 'owns', 'owns', 'M185 180V350', 207, 272, 'start'),
      r('executable-members', 'definition', 'function', 'owns', 'owns', 'M310 160H365V390H430', 385, 310, 'start'),
      r('deployment-occurrence', 'deployment', 'occurrence', 'reference', 'target occurrence', 'M820 140H680', 750, 124),
      r('external-binding', 'deployment', 'external', 'reference', 'on', 'M945 180V350', 966, 272, 'start'),
    ],
  },
  behavior: {
    title: 'Behavior stays inside a function',
    note: 'Calculations are always function-local. Statement flow and directly owned states are alternative body forms.',
    width: 1120, height: 620,
    nodes: [b('definition', 45, 70, 230), b('function', 405, 70, 250), b('calculation', 835, 70, 250), b('flow', 405, 290, 250), b('interruptible', 835, 290, 250), b('states', 45, 510, 230), b('transition', 405, 510, 250), b('types', 835, 510, 250)],
    edges: [
      r('component-functions', 'definition', 'function', 'owns', 'owns', 'M275 110H405', 340, 96),
      r('function-calculations', 'function', 'calculation', 'owns', 'owns', 'M655 110H835', 745, 96),
      r('body-flow', 'function', 'flow', 'owns', 'body: flow', 'M530 150V290', 550, 226, 'start'),
      r('body-states', 'function', 'states', 'owns', 'or body: states', 'M405 130H320V450H160V510', 242, 438),
      r('body-transitions', 'function', 'transition', 'owns', 'owns transitions', 'M405 130H320V470H530V510', 420, 458),
      r('protected-region', 'flow', 'interruptible', 'owns', 'may contain', 'M655 330H835', 745, 315),
      r('transition-states', 'transition', 'states', 'reference', 'source / target', 'M405 550H275', 340, 535),
      r('calc-value-types', 'calculation', 'types', 'reference', 'typed inputs / result', 'M1085 110H1105V480H960V510', 979, 468),
    ],
  },
  contracts: {
    title: 'Communication uses typed boundaries',
    note: 'A connector has occurrence-specific queues. Delegation aliases a boundary and introduces no queue.',
    width: 1120, height: 620,
    nodes: [b('definition', 45, 75, 235), b('port', 425, 75, 235), b('interface', 835, 75, 250), b('connector', 45, 310, 235), b('delegation', 425, 310, 235), b('member', 835, 310, 250), b('qos', 45, 525, 235), b('function', 425, 525, 235), b('types', 835, 525, 250)],
    edges: [
      r('component-port', 'definition', 'port', 'owns', 'owns', 'M280 115H425', 352, 100),
      r('port-interface', 'port', 'interface', 'reference', 'typed by', 'M660 115H835', 748, 100),
      r('component-connector', 'definition', 'connector', 'owns', 'owns', 'M162 155V310', 185, 240, 'start'),
      r('component-delegation', 'definition', 'delegation', 'owns', 'owns', 'M280 140H340V350H425', 363, 265, 'start'),
      r('connector-endpoints', 'connector', 'port', 'reference', 'port endpoints', 'M280 330H385V190H542V155', 463, 180),
      r('delegation-ports', 'delegation', 'port', 'reference', 'outer / child ports', 'M542 310V155', 563, 265, 'start'),
      r('interface-members', 'interface', 'member', 'owns', 'owns', 'M960 155V310', 981, 240, 'start'),
      r('connector-policy', 'connector', 'qos', 'reference', 'optional named policy', 'M162 390V525', 184, 460, 'start'),
      r('function-members', 'function', 'member', 'reference', 'handles / emits via port', 'M660 565H745V350H835', 755, 505, 'start'),
      r('member-values', 'member', 'types', 'reference', 'typed payloads / results', 'M960 390V525', 940, 460, 'end'),
    ],
  },
  traceability: {
    title: 'Intent, traceability and presentation',
    note: 'satisfy and verify record claims and intent. Evidence remains an identified test, simulation, analysis or review result.',
    width: 1120, height: 620,
    nodes: [b('design', 45, 65, 230), b('requirement', 440, 65, 245), b('verificationCase', 835, 65, 250), b('occurrence', 45, 310, 230), b('useCase', 440, 310, 245), b('doc', 835, 310, 250), b('view', 440, 525, 245)],
    edges: [
      r('design-satisfy', 'design', 'requirement', 'reference', 'satisfy', 'M275 105H440', 357, 91),
      r('case-verify', 'verificationCase', 'requirement', 'reference', 'verify', 'M835 105H685', 760, 91),
      r('usecase-root', 'useCase', 'occurrence', 'reference', 'of root', 'M440 350H275', 357, 335),
      r('verification-root', 'verificationCase', 'occurrence', 'reference', 'of root', 'M960 145V220H160V310', 720, 209),
      r('requirement-doc', 'requirement', 'doc', 'owns', 'optional · max 1', 'M685 125H760V350H835', 779, 265, 'start'),
      r('view-selection', 'view', 'design', 'reference', 'selects existing subjects', 'M440 565H317V175H160V145', 338, 470, 'start'),
    ],
  },
};

const scopes: { id: Scope; title: string }[] = [{ id: 'core', title: 'Core overview' }, { id: 'structure', title: 'Structure' }, { id: 'behavior', title: 'Behavior' }, { id: 'contracts', title: 'Contracts' }, { id: 'traceability', title: 'Traceability' }];

export { concepts as ontologyConcepts, diagrams as ontologyDiagrams, scopes as ontologyScopes };

function selectByKeyboard(event: KeyboardEvent<SVGGElement>, id: ConceptId, onSelect: (id: ConceptId) => void) {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id); }
  if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const elements = [...(event.currentTarget.ownerSVGElement?.querySelectorAll<SVGGElement>('[data-ontology-node]') ?? [])];
  const index = elements.indexOf(event.currentTarget);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? elements.length - 1 : (index + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + elements.length) % elements.length;
  elements[next]?.focus();
}

/** Original class-level ontology geometry; no example occurrences are invented here. */
export function OntologyDiagram({ scope = 'core', selected, onSelect = () => {} }: { scope?: Scope; selected?: ConceptId; onSelect?: (id: ConceptId) => void }) {
  const graph = diagrams[scope];
  const unique = useId().replace(/:/g, '');
  const marker = `ontology-arrow-${unique}`;
  return <svg className="ontology-svg" viewBox={`0 0 ${graph.width} ${graph.height}`} role="img" aria-labelledby={`ontology-title-${unique} ontology-desc-${unique}`}>
    <title id={`ontology-title-${unique}`}>{graph.title}</title>
    <desc id={`ontology-desc-${unique}`}>{graph.note} Solid labeled arrows indicate ownership; dashed labeled arrows indicate references. Select a concept for its definition and syntax.</desc>
    <defs><marker id={marker} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="strokeWidth"><path d="M0 0L9 4.5L0 9Z" fill="#557269" /></marker></defs>
    <g className="ontology-relations" fill="none">{graph.edges.map(edge => <g key={edge.id} className={`ontology-relation ontology-relation-${edge.kind}`}>
      <title>{`${concepts[edge.from].title} ${edge.label} ${concepts[edge.to].title}`}</title>
      <path d={edge.path} markerEnd={`url(#${marker})`} />
      <text x={edge.x} y={edge.y} textAnchor={edge.align ?? 'middle'}>{edge.label}</text>
    </g>)}</g>
    {graph.nodes.map(node => {
      const concept = concepts[node.id], height = node.height ?? 80;
      return <g key={node.id} data-ontology-node={node.id} className={`ontology-node ${selected === node.id ? 'is-selected' : ''} ${node.id === 'external' ? 'is-external' : ''} ${node.compact ? 'is-compact' : ''}`} role="button" tabIndex={0} aria-label={`${concept.title}. ${concept.caption}. Inspect concept`} aria-pressed={selected === node.id} onPointerDown={event => event.stopPropagation()} onClick={() => onSelect(node.id)} onKeyDown={event => selectByKeyboard(event, node.id, onSelect)}>
        <rect x={node.x} y={node.y} width={node.width} height={height} rx={5} />
        {node.compact ? <><text className="ontology-node-title" x={node.x + 16} y={node.y + 27}>{concept.title}</text><text className="ontology-node-caption" x={node.x + 118} y={node.y + 27}>{concept.caption}</text></> : <>
          <text className="ontology-node-kind" x={node.x + 15} y={node.y + 18}>{concept.kind}</text>
          <text className="ontology-node-title" x={node.x + 15} y={node.y + 42}>{node.title ?? concept.title}</text>
          <text className="ontology-node-caption" x={node.x + 15} y={node.y + 64}>{node.caption ?? concept.caption}</text>
        </>}
      </g>;
    })}
  </svg>;
}

type OntologyFlowNode = Node<{ scope: Scope; selected?: ConceptId; onSelect: (id: ConceptId) => void }, 'ontology'>;
function OntologyCanvasNode({ data }: NodeProps<OntologyFlowNode>) { return <OntologyDiagram scope={data.scope} selected={data.selected} onSelect={data.onSelect} />; }
const nodeTypes = { ontology: OntologyCanvasNode };

function OntologyCanvas({ scope, selected, onSelect }: { scope: Scope; selected?: ConceptId; onSelect: (id: ConceptId) => void }) {
  const graph = diagrams[scope];
  const nodes = useMemo<OntologyFlowNode[]>(() => [{ id: 'ontology', type: 'ontology', position: { x: 0, y: 0 }, data: { scope, selected, onSelect }, style: { width: graph.width, height: graph.height }, draggable: false, selectable: false }], [scope, selected, onSelect, graph]);
  return <div className="ontology-canvas" id="ontology-canvas" role="group" aria-label={graph.title}>
    <ReactFlow<OntologyFlowNode> key={scope} nodes={nodes} edges={[]} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.025, maxZoom: 1 }} minZoom={0.15} maxZoom={2} nodesDraggable={false} nodesConnectable={false} zoomOnScroll={false} preventScrolling={false} panOnScroll={false} deleteKeyCode={null}>
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  </div>;
}

export function Ontology() {
  const [scope, setScope] = useState<Scope>('core');
  const [selected, setSelected] = useState<ConceptId>();
  const graph = diagrams[scope], concept = selected ? concepts[selected] : undefined;
  const changeScope = (next: Scope) => { setScope(next); setSelected(undefined); };
  return <div className="ontology-workbench">
    <div className="ontology-toolbar"><div className="ontology-tabs" role="group" aria-label="Explore the language ontology">{scopes.map(item => <button key={item.id} type="button" aria-pressed={scope === item.id} aria-controls="ontology-canvas" className={scope === item.id ? 'is-active' : ''} onClick={() => changeScope(item.id)}>{item.title}</button>)}</div><span className="ontology-caption">Concepts, not an example model</span></div>
    <div className="ontology-heading"><h3>{graph.title}</h3><p>{graph.note}</p></div>
    <ReactFlowProvider><OntologyCanvas scope={scope} selected={selected} onSelect={setSelected} /></ReactFlowProvider>
    <div className="ontology-footer"><div className="ontology-legend"><span><i className="ontology-ownership-key" />Ownership</span><span><i className="ontology-reference-key" />Reference</span></div>{scope === 'core' ? <span>¹ Inline roots may omit a definition. ² Only verificationCase owns verify.</span> : scope === 'structure' ? <span>¹ Inline roots may omit a definition.</span> : <span>Select a concept to see its definition and syntax.</span>}</div>
    <div className="ontology-access"><label>Inspect a concept <select aria-label="Inspect ontology concept" value={selected ?? ''} onChange={event => setSelected(event.target.value as ConceptId || undefined)}><option value="">Choose…</option>{graph.nodes.map(node => <option key={node.id} value={node.id}>{concepts[node.id].title}</option>)}{!graph.nodes.some(node => node.id === 'doc') && <option value="doc">Documentation</option>}</select></label><span>Pan and zoom · Tab to a concept, then Enter to inspect</span></div>
    {concept && <div className="ontology-detail" role="region" aria-label={`${concept.title} details`} aria-live="polite"><div><span>{concept.kind}</span><h4>{concept.title}</h4><p>{concept.detail}</p><a href={`${repository}/blob/main/${concept.reference}`} target="_blank" rel="noreferrer">Language reference ↗</a></div><pre tabIndex={0} aria-label={`${concept.title} syntax shape`}><code>{concept.syntax}</code></pre><button type="button" className="ontology-close" aria-label="Close concept details" onClick={() => setSelected(undefined)}>×</button></div>}
  </div>;
}
