import { Check, Clock3, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useRef } from 'react';
import { useStatusMotion } from './motion';
export type OperationState = 'planned' | 'running' | 'completed' | 'failed' | 'waiting';
export default function OperationStatus({ state, title, detail, action, onAction }: {
  state: OperationState; title: string; detail: string; action?: string; onAction?: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useStatusMotion(ref, state);
  const Icon = state === 'running' ? LoaderCircle : state === 'completed' ? Check : state === 'failed' ? TriangleAlert : Clock3;
  return <section ref={ref} className={'operation-status operation-' + state} aria-label="System activity" role="status" aria-live="polite" data-state={state}>
    <span className="operation-symbol"><Icon size={18} className={state === 'running' ? 'spin' : ''} /></span>
    <div className="operation-copy"><div className="operation-title"><span>{state[0].toUpperCase() + state.slice(1)}</span><strong>{title}</strong></div><p>{detail}</p></div>
    {action && <button className="button button-secondary" onClick={onAction}>{action}</button>}
  </section>;
}
