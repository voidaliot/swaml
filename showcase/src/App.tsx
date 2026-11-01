import { Timing } from './Timing';
import { useEffect, useState } from 'react';
import model from './generated/model.json';
import './v2.css';

const views = ['General', 'Interconnect', 'Case', 'Sequence', 'Grid', 'Flow', 'Timing'] as const;
type View = typeof views[number];
type Theme = 'system' | 'light' | 'dark';
const all = model.projection.nodes;
const components = all.filter(n => n.kind === 'component' && /^Control::Demo\.[^.]+$/.test(n.id));
const operations = all.filter(n => n.kind === 'operation' && n.id.startsWith('Control::Demo.'));
const root = 'Control::Demo';
const github = 'https://github.com/voidaliot/swaml';

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = { arrow: 'M4 12h15m-5-5 5 5-5 5', external: 'M13 4h7v7m0-7L9 15M9 4H4v16h16v-5', sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0', moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z', system: 'M3 4h18v14H3zM8 22h8m-4-4v4', copy: 'M8 3h13v14H8zM4 7H2v15h13v-3', check: 'm4 12 5 5L20 6', plus: 'M12 4v16M4 12h16', source: 'm8 5-6 7 6 7m8-14 6 7-6 7m-2-15-4 16', grid: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={paths[name] ?? paths.arrow}/></svg>;
}
function Code({ text, numbers = false }: { text: string; numbers?: boolean }) {
  const keyword = /^(component|def|redefines|attribute|const|operation|returns|port|provides|requires|reversed|schedule|on|start|every|receive|call|after|deadline|concurrent|wait|try|var|return|send|publish|connect|import|package|if|else|view|of|int|real|bool|string|uint)$/;
  return <pre className={`source-code ${numbers ? 'numbered' : ''}`}><code>{text.trim().split('\n').map((line, i) => <span className="code-line" key={i}>{numbers && <span className="line-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>}<span>{line.split(/("(?:[^"\\]|\\.)*"|\b[A-Za-z]\w*\b)/g).map((t, j) => <span key={j} className={keyword.test(t) ? 'token-keyword' : t.startsWith('"') ? 'token-string' : ''}>{t}</span>)}</span>{'\n'}</span>)}</code></pre>;
}
function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [state, set] = useState<'idle'|'copied'|'failed'>('idle');
  async function copy() { try { await navigator.clipboard.writeText(text); set('copied'); } catch { set('failed'); } }
  useEffect(() => { if (state !== 'idle') { const t = setTimeout(() => set('idle'), 2500); return () => clearTimeout(t); } }, [state]);
  return <button className="copy-button" onClick={copy} aria-label={label}><Icon name={state === 'copied' ? 'check' : 'copy'} size={15}/><span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Select text to copy' : label}</span></button>;
}


function BoundaryPort({ x, y, outgoing }: { x: number; y: number; outgoing: boolean }) {
  return <g aria-hidden="true"><rect className="boundary-port" x={x-9} y={y-9} width={18} height={18}/><path className="connector" d={`M${x-6} ${y}h12m${outgoing ? -4 : -8} -4 ${outgoing ? 4 : -4} 4 ${outgoing ? -4 : 4} 4`}/></g>;
}

function Interconnect({ selected, select }: { selected: string; select: (id: string) => void }) {
  return <svg className="architecture-svg" viewBox="0 0 960 310" role="img" aria-label="Temperature flows from sensor to controller, which sends an explicit command event to the heater">
    <path className="connector" d="M285 158H350M610 158H675"/>
    <text className="edge-label" x="318" y="124" textAnchor="middle">temperature</text><text className="edge-label" x="642" y="124" textAnchor="middle">set</text>
    {components.map((n, i) => { const x = 25 + i * 325; return <g key={n.id} role="button" tabIndex={0} aria-label={`Inspect ${n.name}`} onClick={() => select(n.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id); } }} className={`diagram-component ${selected === n.id ? 'selected' : ''}`}>
      <rect x={x} y={62} width={260} height={190}/><text className="node-meta" x={x + 18} y={86}>component · {n.definition.split('::').at(-1)}</text><text className="node-name" x={x + 18} y={115}>{n.name}</text><path className="compartment-rule" d={`M${x} 133h260`}/>
      {(n.ports ?? []).flatMap(p => p.members.map(m => ({ p, m }))).map(({ p, m }, j) => <g key={p.name + m.name}><text className="member-dir" x={x + 18} y={155 + j * 42}>{m.direction} {m.kind}</text><text className="member-name" x={x + 18} y={172 + j * 42}>{p.name}.{m.name}{m.kind === 'attribute' ? ': '+m.type : '('+m.parameters.map(p=>p.type).join(', ')+')'}</text></g>)}
      {i > 0 && <BoundaryPort x={x} y={158} outgoing/>} {i < 2 && <BoundaryPort x={x + 260} y={158} outgoing/>}
    </g>; })}
    <text className="diagram-caption" x="25" y="294">Typed members and explicit routes. Attributes retain the latest value; events use the connection policy.</text>
  </svg>;
}
function General({ selected, select, tree }: { selected: string; select: (id: string) => void; tree: boolean }) {
  return <div className={`general-diagram ${tree ? 'tree-layout' : ''}`}><div className="root-label"><Icon name="grid" size={16}/> Demo <span>execution root</span></div><div className="component-group">{components.map(n => <button data-model-id={n.id} key={n.id} onClick={() => select(n.id)} className={`general-node ${selected === n.id ? 'selected' : ''}`}><span className="node-kicker">component {n.name}</span><strong>{n.definition.split('::').at(-1)}</strong><span className="member-summary">{n.ports?.length ?? 0} ports · {n.schedule?.length ?? 0} schedule entries</span><span className="node-operations">{operations.filter(o => o.owner === n.id).map(o => <span key={o.id}>{o.name}()</span>)}</span></button>)}</div><p className="diagram-footnote">One occurrence tree. Separate private stores. The same identities in either layout.</p></div>;
}
function Sequence() {
  const names = components.map(n => n.name), steps = model.sequence;
  return <svg className="architecture-svg" viewBox="0 0 960 310" role="img" aria-label="Observed sequence of the reference run: a temperature sample followed by the applied command">
    {names.map((name, i) => <g key={name}><rect className="sequence-head" x={80 + i * 320} y={30} width={160} height={38}/><text className="member-name" x={160 + i * 320} y={54} textAnchor="middle">{name}</text><path className="lifeline" d={`M${160 + i * 320} 68V280`}/></g>)}
    {steps.map((s, i) => { const from = names.indexOf(s.source.split('.')[0]), to = names.indexOf(s.target.split('.')[0]), y = 130 + i * 94; return <g key={s.via}><path className="connector" d={`M${160 + from * 320} ${y}H${160 + to * 320}`}/><path className="connector" d={`m${150 + to * 320} ${y - 5} 10 5-10 5`}/><text className="edge-label" x={(from + to) * 160 + 160} y={y - 15} textAnchor="middle">{s.member} · via {s.via}</text></g>; })}
  </svg>;
}
function CaseView() { return <div className="case-diagram"><div className="case-requirement"><span className="node-kicker">requirement</span><strong>{model.requirements[0].name}</strong><span>{model.requirements[0].attributes[0].name}: {model.requirements[0].attributes[0].type} = {model.requirements[0].attributes[0].value}</span></div><span className="intent-link">verify<br/><span>intent</span></span><div className="case-oval"><span className="node-kicker">test</span><strong>{model.cases[0].name}</strong><span>of {model.cases[0].subject} · reference run: {model.cases[0].result}</span></div><p className="diagram-footnote">This test runs as a script in a fresh package run; a pass is bounded evidence of that run. Its verify link does not establish requirement fulfillment.</p></div>; }
function Flow() { return <div className="flow-diagram"><span className="flow-dot"/>{model.flow.map((step,i)=><div className="flow-group" key={i}>{i>0&&<span className="flow-stem"/>}<div className="flow-step"><span className="node-kicker">{step.kind==='LocalVariable'?'typed local value':'provided event · explicit output route'}</span><Code text={step.code}/></div></div>)}<span className="flow-stem"/><span className="flow-end"/><p className="diagram-footnote">{components.find(n=>n.name==='controller')?.schedule?.[0].code}</p></div>; }

function Explorer() {
  const [view, setView] = useState<View>('Interconnect'), [selected, select] = useState('Control::Demo.controller'), [tree, setTree] = useState(false), [observed, setObserved] = useState(true), [showSource, setShowSource] = useState(false);
  const current = all.find(n => n.id === selected) ?? components[1];
  const detailSource = current.kind === 'component' && current.definition !== current.id ? all.find(n=>n.id===current.definition)?.code ?? current.code : current.code;
  return <section id="explore" className="explorer section-anchor" aria-labelledby="explore-title">
    <div className="section-heading"><div><span className="eyebrow">02 / MODEL INSPECTION</span><h2 id="explore-title">Inspect a software control loop.</h2></div><p>Three software components exchange a temperature value and a command. Inspect their boundaries, operations and execution trace.</p></div>
    <div className="workbench"><div className="workbench-title"><span><span className="status-square"/> controller.swaml</span><span>swa.ml {model.edition} <span className="muted">/ validated source</span></span><button className={showSource ? 'source-toggle active' : 'source-toggle'} onClick={() => setShowSource(!showSource)} aria-pressed={showSource}><Icon name="source" size={15}/>{showSource ? 'Show model' : 'View source'}</button></div>
      <div className="view-tabs" role="tablist" aria-label="Source view">{views.map((v, i) => <button key={v} id={`tab-${v}`} role="tab" aria-selected={view === v} aria-controls="model-view" tabIndex={view === v ? 0 : -1} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const next = views[(i + (e.key === 'ArrowRight' ? 1 : views.length - 1)) % views.length]; setView(next); setShowSource(false); document.getElementById(`tab-${next}`)?.focus(); e.preventDefault(); } }} onClick={() => { setView(v); setShowSource(false); }}>{v}</button>)}</div>
      {showSource ? <div className="full-source" id="model-view" role="tabpanel" aria-labelledby={`tab-${view}`}><div className="source-actions"><span>Complete validated model</span><CopyButton text={model.source}/><a href="./downloads/controller.swaml" download>Download .swaml <Icon name="arrow" size={14}/></a></div><Code text={model.source} numbers/></div> : <div className="workbench-body">
        <aside className="model-browser" aria-label="Model Browser"><span className="pane-heading">BROWSER</span><span className="browser-root">▾ Demo</span>{components.map(n => <div key={n.id}><button aria-pressed={selected === n.id} onClick={() => select(n.id)}><span>⌞</span> {n.name}</button>{operations.filter(o => o.owner === n.id).map(o => <button key={o.id} className="browser-operation" aria-pressed={selected === o.id} onClick={() => select(o.id)}>{o.name}()</button>)}</div>)}<span className="browser-footer">3 occurrences<br/>Separate private state</span></aside>
        <div className="view-pane"><div className="view-toolbar"><span className="view-caption">{view} <span className="muted">/ Demo</span></span>{view === 'General' && <div className="segmented"><button aria-pressed={!tree} onClick={() => setTree(false)}>Box in box</button><button aria-pressed={tree} onClick={() => setTree(true)}>Tree</button></div>}{view === 'Timing' && <div className="segmented"><button aria-pressed={!observed} onClick={() => setObserved(false)}>Declared</button><button aria-pressed={observed} onClick={() => setObserved(true)}>Observed</button></div>}</div>
          <div id="model-view" role="tabpanel" aria-labelledby={`tab-${view}`} className="model-canvas">{view === 'Interconnect' ? <Interconnect selected={selected} select={select}/> : view === 'General' ? <General selected={selected} select={select} tree={tree}/> : view === 'Sequence' ? <Sequence/> : view === 'Case' ? <CaseView/> : view === 'Flow' ? <Flow/> : view === 'Timing' ? <Timing observed={observed}/> : <div className="inventory-table"><table><caption>Model occurrence inventory</caption><thead><tr><th>Name</th><th>Kind</th><th>Owned by</th></tr></thead><tbody>{all.filter(n => n.id.startsWith(root + '.') && ['component','operation','port','attribute'].includes(n.kind)).map(n => <tr key={n.id}><td><button onClick={() => select(n.id)}>{n.name}{n.kind === 'operation' ? '()' : ''}</button></td><td>{n.kind}</td><td>{n.owner?.replace(root + '.', '') ?? 'Demo'}</td></tr>)}</tbody></table></div>}</div>
          <div className="canvas-status"><span>● {view === 'Timing' && observed ? `${model.run.profile} · horizon 29ms` : 'Source-backed projection'}</span><span>{view === 'Timing' ? 'Logical time · no physical cost claim' : 'Select a component to inspect its source'}</span></div>
        </div>
      </div>}
      {!showSource && <div className="inspector"><div><span className="pane-heading">SELECTED SOURCE</span><strong>{current.id.replace('Control::', '')}</strong><span className="muted">{current.definition !== current.id ? `definition: ${current.definition}` : current.kind}</span></div><Code text={detailSource}/><CopyButton text={detailSource} label="Copy source"/></div>}
    </div>
    <p className="evidence-note">The views use the validated example and a precomputed reference trace. This page does not run or edit the model. Source fingerprint <code>{model.sha256.slice(0,12)}</code>. <a href="./downloads/controller.swaml" download>Get the model <Icon name="arrow" size={14}/></a></p>
  </section>;
}

function Execution() {
  const observations = model.run.trace.filter(e => ['send', 'publish', 'write'].includes(e.kind));
  return <section id="execution" className="execution-section section-anchor" aria-labelledby="execution-title">
    <div className="section-heading">
      <div><span className="eyebrow">03 / EXECUTION SEMANTICS</span><h2 id="execution-title">Execute the behavior.<br/>Inspect the resulting state.</h2></div>
      <p>Operations compute values, update private state and communicate through ports. Schedules determine when those operations activate.</p>
    </div>
    <div className="execution-grid">
      <div className="execution-description">
        <h3>What “executable” means in swa.ml</h3>
        <p>The reference interpreter executes a validated model for a selected run target and a finite time horizon. It records operation activations, routed messages, waits and state changes.</p>
        <p>In this example, the sensor operation emits a fixed reading of <code>18.5</code>. The controller computes <code>(21.0 − 18.5) × 0.1</code> and sends a command. The heater component stores <code>{model.run.stores['Demo.heater'].power}</code>.</p>
        <p className="execution-limit">These are software interactions in logical time. The example has no thermal plant model, and the interpreter assigns zero physical CPU cost. Target timing and production deployment require separate implementation and evidence.</p>
        <a className="text-link" href="./downloads/simulation.md" download>Reference execution guide <Icon name="arrow" size={16}/></a>
      </div>
      <div className="trace-panel">
        <div className="panel-heading"><span>REFERENCE RUN / SELECTED OBSERVATIONS</span><span>{model.run.untilNs / 1000000} ms horizon</span></div>
        <div className="trace-scroll"><table className="trace-table">
          <caption>Routed outputs and state writes from the example reference run</caption>
          <thead><tr><th>Time</th><th>Observation</th><th>Value</th></tr></thead>
          <tbody>{observations.map(e => <tr key={e.ordinal}>
            <td>{e.timeNs / 1000000} ms</td>
            <td><span className="trace-kind">{e.kind}</span><code>{e.subject.replace('Demo.', '')}</code></td>
            <td><code>{JSON.stringify(e.kind === 'write' ? e.value : e.args?.[0])}</code></td>
          </tr>)}</tbody>
        </table></div>
        <div className="trace-footer"><code>{model.run.profile}</code><a href="./downloads/controller-run.json" download>Download run JSON <Icon name="arrow" size={14}/></a></div>
      </div>
    </div>
  </section>;
}

function Command({ text, label }: { text: string; label: string }) {
  return <div className="command-block"><pre><code>{text}</code></pre><CopyButton text={text} label={label}/></div>;
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => { try { const saved = localStorage.getItem('swaml-theme'); return saved === 'light' || saved === 'dark' ? saved : 'system'; } catch { return 'system'; } });
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const apply = () => {
    const resolvedTheme = theme === 'system' ? media.matches ? 'dark' : 'light' : theme;
    document.documentElement.dataset.theme = resolvedTheme;
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) favicon.href = resolvedTheme === 'dark' ? './swaml-white.svg' : './swaml.svg';
  }; apply(); media.addEventListener('change', apply); try { localStorage.setItem('swaml-theme', theme); } catch { /* storage is optional */ } return () => media.removeEventListener('change', apply); }, [theme]);
  const controller = all.find(n => n.id === 'Control::Controller')!;
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <a href="#" className="wordmark" aria-label="swa.ml home"><img src="./swaml.svg" alt="" width="36" height="36"/>swa.ml<span className="version-label">{model.edition}</span></a>
      <nav aria-label="Main navigation"><a href="#language">Language</a><a href="#explore">Example</a><a href="#execution">Execution</a><a href="#start">Documentation</a></nav>
      <button className="theme-toggle" onClick={() => setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system')} aria-label={`Theme: ${theme}. Switch to ${theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'}`} title={`Theme: ${theme}`}><Icon name={theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'system'}/><span>{theme}</span></button>
    </header>
    <main id="main">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-intro">
          <span className="eyebrow">SOFTWARE ARCHITECTURE MODELING LANGUAGE</span>
          <h1 id="hero-title">Model software architecture<br/>with executable behavior.</h1>
          <p className="hero-description">swa.ml is a textual modeling language for software architects. Define component boundaries, typed communication and the operations that implement software behavior in one reviewable model.</p>
          <p className="hero-detail">Validate the architecture, execute it in the reference interpreter, and inspect its state changes and message trace before implementing it on a target platform.</p>
          <div className="hero-actions"><a className="button primary" href="#explore">Inspect the example <Icon name="arrow"/></a><a className="text-link" href="#execution">Execution semantics <Icon name="arrow" size={16}/></a></div>
          <div className="hero-footnote"><span>{model.edition} standard</span><span>Open source · MIT</span></div>
        </div>
        <figure className="source-preview">
          <figcaption className="panel-heading"><span>controller.swaml</span><span>Definition excerpt</span></figcaption>
          <Code text={controller.code} numbers/>
          <div className="source-annotation"><span>Input</span><code>reading.temperature</code><span>Operation</span><code>regulate(measured)</code><span>Output</span><code>command.set(power)</code></div>
          <p>Receipt of a temperature value activates an operation with a declared 5 ms deadline.</p>
        </figure>
      </section>

      <section id="language" className="language-section section-anchor" aria-labelledby="language-title">
        <div className="section-heading"><div><span className="eyebrow">01 / ARCHITECTURAL CONCERNS</span><h2 id="language-title">Structure, communication and execution.</h2></div><p>Use the model to review responsibility, data flow and activation rules together.</p></div>
        <div className="concern-grid">
          <article><span className="concern-index">01</span><h3>Component boundaries</h3><p>Assign state and operations to the component that owns them. Reuse definitions while keeping each occurrence’s private state separate.</p><div className="concern-question">Which component owns this state?</div><Code text={all.find(n => n.id === 'Control::Demo')!.code}/></article>
          <article><span className="concern-index">02</span><h3>Typed communication</h3><p>Declare the direction and payload of each port member. Connect components through explicit routes that the validator checks.</p><div className="concern-question">What crosses this boundary?</div><p>Port boundaries may mix attributes, events and operations; direction belongs to each member.</p><img className="notation-figure" src="./downloads/mixed-ports.svg" alt="Mixed port with directed attributes, events and operations" style={{width:"100%",height:"auto"}}/><Code text={all.find(n => n.id === 'Control::Temperature')!.code + '\n\n' + all.find(n => n.id === 'Control::Commands')!.code}/></article>
          <article><span className="concern-index">03</span><h3>Executable operations</h3><p>Specify calculations, state updates, requests and events. Bind operations to startup, periodic or input triggers in a schedule.</p><div className="concern-question">What runs, and what activates it?</div><Code text={all.find(n => n.id === 'Control::Sensor')!.code}/></article>
        </div>
        <p className="section-note">Excerpts from the example below. The <code>.swaml</code> source defines meaning; diagrams project that source and layout stays separate.</p>
      </section>

      <Explorer/>
      <Execution/>

      <section id="start" className="start-section section-anchor" aria-labelledby="start-title">
        <div className="section-heading"><div><span className="eyebrow">04 / REFERENCE WORKFLOW</span><h2 id="start-title">Validate and run the example.</h2></div><p>From a swa.ml {model.edition} source checkout.<br/>Node.js 22+ and npm 10.2.3+.</p></div>
        <div className="start-grid">
          <article><span className="concern-index">01 / BUILD</span><h3>Build the reference tools</h3><p>Install the pinned dependencies, compile the tools and prepare the example’s run options.</p><Command text={'npm ci\nnpm run build\nnode scripts/build-showcase-data.mjs'} label="Copy build command"/></article>
          <article><span className="concern-index">02 / VALIDATE</span><h3>Check the source model</h3><p>Check ownership, types, routes and schedules. JSON diagnostics include source locations.</p><Command text={'node out/src/cli/main.js --json examples/02-realtime-controller.swaml'} label="Copy validation command"/></article>
          <article><span className="concern-index">03 / EXECUTE</span><h3>Inspect a bounded run</h3><p>Run the same run target to a 29 ms horizon using the supplied options. Review the trace and final stores.</p><Command text={'node out/src/cli/simulate.js Control::Demo showcase/public/downloads/controller-options.json examples/02-realtime-controller.swaml'} label="Copy execution command"/></article>
        </div>
        <div className="resource-grid">
          <article><h3>Language and reference tools</h3><p>The {model.edition} guides describe the syntax, modeling workflow and current implementation limits.</p><div className="resource-links"><a href="./downloads/usage-guide.md" download>Usage guide <Icon name="arrow" size={15}/></a><a href="./downloads/implementation-status.md" download>Implementation status <Icon name="arrow" size={15}/></a><a href="./downloads/controller.swaml" download>Example source <Icon name="arrow" size={15}/></a><a href={`${github}/blob/v${model.edition}/output/pdf/SWAML-${model.edition}-Specification.pdf`} target="_blank" rel="noreferrer">Specification PDF <Icon name="external" size={14}/></a><a href={github} target="_blank" rel="noreferrer">Source repository <Icon name="external" size={14}/></a></div></article>
          <article><h3>Agent-assisted authoring</h3><p>Use the authoring guide and portable skills to generate source, inspect diagnostics and revalidate the complete model after each change.</p><div className="resource-links"><a href="./downloads/ai-guide.md" download>AI authoring guide <Icon name="arrow" size={15}/></a><a href="./downloads/swaml-author-SKILL.md" download>Authoring skill <Icon name="arrow" size={15}/></a><a href="./downloads/swaml-validate-SKILL.md" download>Validation skill <Icon name="arrow" size={15}/></a></div></article>
        </div>
        <p className="scope-note"><strong>Implementation scope.</strong> swa.ml {model.edition} is the current standard. The reference interpreter executes software models under recorded assumptions; it does not generate a deployable application or establish target schedulability. Requirement links record intent. A bounded run supplies evidence for that run, not a general verification proof.</p>
      </section>
    </main>
    <footer className="site-footer"><a className="wordmark" href="#"><img src="./swaml.svg" alt="" width="28" height="28"/>swa.ml</a><p>Software Architecture Modeling Language</p><div><a href={`${github}/blob/main/LICENSE`} target="_blank" rel="noreferrer">MIT license</a><a href={github} target="_blank" rel="noreferrer">GitHub <Icon name="external" size={12}/></a></div></footer>
  </>;
}
