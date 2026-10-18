import { useId, type SVGProps } from 'react';
import { Handle, Position } from '@xyflow/react';
import './diagram-glyphs.css';

export type ClassifierKind = 'class' | 'component';
export type PortSide = 'left' | 'right';
export type PortDescription = { name: string; role: string; contract: string; version: string; side: PortSide; optional?: boolean };
export const rpcPort = (role: string) => ['client', 'server', 'requires', 'provides'].includes(role);
export const portSymbol = (role: string) => ['server', 'provides'].includes(role) ? 'ball' : ['client', 'requires'].includes(role) ? 'socket' : 'square';
const outgoing = (role: string) => ['client', 'requires', 'sender', 'publisher'].includes(role);

/** Original flat classifier markers; spelling never creates another model identity. */
export function ClassifierGlyph({ kind = 'component', decorative = false, ...props }: SVGProps<SVGSVGElement> & { kind?: ClassifierKind; decorative?: boolean }) {
  const title = useId();
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" stroke="currentColor" strokeWidth="1.4" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-labelledby={decorative ? undefined : title} {...props}>
    {!decorative && <title id={title}>{kind === 'component' ? 'Component: specialized class' : 'Class'}</title>}
    <rect x={kind === 'component' ? 5 : 3} y="3" width={kind === 'component' ? 16 : 18} height="18" rx="0.5"/>
    {kind === 'component' ? <><rect x="2" y="7" width="7" height="4"/><rect x="2" y="14" width="7" height="4"/></> : <path d="M3 9H21M3 15H21" fill="none"/>}
  </svg>;
}

/** The square stays on the owner boundary; RPC adornments describe the same port. */
export function PortGlyph({ role, side = 'right', label, ...props }: SVGProps<SVGSVGElement> & { role: string; side?: PortSide; label?: string }) {
  const title = useId(), symbol = portSymbol(role);
  return <svg width="48" height="24" viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5" role="img" aria-labelledby={title} {...props}>
    <title id={title}>{label ?? `${role} port: boundary square${symbol === 'square' ? ' and direction arrow' : ` with ${symbol}`}`}</title>
    <g transform={side === 'left' ? 'translate(48 0) scale(-1 1)' : undefined}>
      <rect x="1" y="7" width="10" height="10" fill="#fff"/>
      <path d={`M11 12H${symbol === 'ball' ? 27 : symbol === 'socket' ? 31 : 39}`}/>
      {symbol === 'ball' ? <circle cx="33" cy="12" r="6" fill="#fff"/> : symbol === 'socket' ? <path d="M38 5A7 7 0 0 0 38 19"/> : <path d={outgoing(role) ? 'M32 7L39 12L32 17' : 'M18 7L11 12L18 17'}/>}
    </g>
  </svg>;
}

/** Handles meet the outer glyph; reverse traffic retains this exact port identity. */
export function BoundaryPort({ name, role, contract, version, side, optional }: PortDescription) {
  const position = side === 'right' ? Position.Right : Position.Left;
  const type = outgoing(role) ? 'source' : 'target';
  const style = { [side]: -33, top: '50%', width: 2, height: 2, opacity: 0, border: 0 };
  const label = `${name}: ${contract} @ ${version}, ${role}${optional ? ', optional' : ''}`;
  return <>
    <span className={`semantic-port-marker is-${side}`}><PortGlyph role={role} side={side} label={label}/></span>
    <Handle id={name} type={type} position={position} style={style} isConnectable={false}/>
    {rpcPort(role) && <Handle id={`${name}:reverse`} type={type === 'source' ? 'target' : 'source'} position={position} style={style} isConnectable={false}/>}
  </>;
}

export function PortLegend() {
  return <p className="semantic-port-legend"><span><PortGlyph role="provides" aria-hidden="true"/>Ball: server / provides</span><span><PortGlyph role="requires" aria-hidden="true"/>Socket: client / requires</span><span>Square: owned port · arrows follow requests, data or publication. Replies and service events return on the same route.</span></p>;
}
