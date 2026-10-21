import { useState } from 'react';
import guide from '../../docs/QUICK_START.md?raw';
import reuseModel from '../../examples/15-component-specialization.swaml?raw';
import { repository } from './model';

const completeModel = guide.match(/```swaml\r?\n([\s\S]*?)\r?\n```/)?.[1] ?? '';
const steps = [
  { title: 'Declare a contract', description: 'Choose data, request/response, events or a combined service. Version the interface and name its members.', code: 'interface senderReceiver Greeting version "1.0.0" {\n    data text: string queued;\n}' },
  { title: 'Own the behavior', description: 'Components own private data and functions. Each exchange uses a port; receive and call triggers bind incoming members.', code: 'port input: Greeting receiver;\nvar last: string = "";\nfunction hear(message: string) on receive input.text {\n    last = message;\n}' },
  { title: 'Compose and connect', description: 'Instantiate definitions inside a root, then connect their ports. Select explicit QoS values for each route.', code: 'component Demo {\n    component speaker: Speaker;\n    component listener: Listener;\n    connect greeting: speaker.output -> listener.input qos LocalQueue;\n}' },
  { title: 'Validate and review', description: 'Build the language tools once, validate your model, then review its structure, interfaces and function behavior.', code: 'npm ci\nnpm run build\nnode out/src/cli/main.js --language-version 1.3 hello.swaml' },
];

export function QuickStart() {
  const [active, setActive] = useState(0);
  const [complete, setComplete] = useState(false);
  const [reuse, setReuse] = useState(false);
  const [copied, setCopied] = useState(false);
  return <section id="quick-start" className="quick-start-section" aria-labelledby="quick-start-title">
    <div className="section-intro"><div><span className="eyebrow">QUICK USER GUIDE</span><h2 id="quick-start-title">From contract to architecture</h2></div><p>A complete first model in a few minutes.<br />Use the same workflow across embedded, web and cloud software.</p></div>
    <div className="quick-start-grid"><div className="quick-start-steps" role="group" aria-label="Quick start steps">{steps.map((step, index) => <button key={step.title} aria-pressed={active === index && !complete} onClick={() => { setActive(index); setComplete(false); setReuse(false); setCopied(false); }}><span>0{index + 1}</span><div><strong>{step.title}</strong><p>{step.description}</p></div></button>)}</div><div className="quick-start-code"><div className="quick-start-code-title"><span>{complete ? reuse ? 'component-specialization.swaml · complete model' : 'hello.swaml · complete model' : active === 3 ? 'Terminal · from the repository root' : `SWAML · ${steps[active].title.toLowerCase()} excerpt`}</span><button className="button button-quiet" onClick={() => { setComplete(!complete); setReuse(false); setCopied(false); }}>{complete ? 'Back to step' : 'Complete model'}</button></div><pre tabIndex={0} aria-label={complete ? 'Quick start complete model' : 'Quick start code'}><code>{complete ? reuse ? reuseModel : completeModel : steps[active].code}</code></pre><div className="quick-start-actions"><a href={`${repository}/blob/main/docs/QUICK_START.md`} target="_blank" rel="noreferrer">Read the quick guide ↗</a><button onClick={() => { setComplete(true); setReuse(!reuse); setCopied(false); }}>{reuse ? 'Hello example' : 'Calculations and reuse'}</button><button onClick={() => { void navigator.clipboard.writeText(reuse ? reuseModel : completeModel).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Copied complete model' : 'Copy complete model'}</button></div></div></div>
  </section>;
}
