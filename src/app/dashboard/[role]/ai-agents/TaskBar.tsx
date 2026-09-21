'use client';

import { useState } from 'react';

// One box for the whole office: type the job, it goes to the right desk and runs.

const EXAMPLES = [
  'find 40 roofers in Sarasota',
  'research the leads waiting',
  'write the next 5 emails',
  'send the ones I approved',
];

export type TaskResult = { agent?: { name: string; title: string }; reply?: string; result?: string; error?: string };

export default function TaskBar({ onTask }: { onTask: (text: string) => Promise<TaskResult> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<TaskResult | null>(null);

  const send = async () => {
    const said = text.trim();
    if (!said) return;
    setBusy(true);
    setOut(null);
    const r = await onTask(said);
    setBusy(false);
    setOut(r);
    if (!r.error) setText('');
  };

  return (
    <div className="tk-wrap">
      <div className="tk-bar">
        <span className="tk-icon">➤</span>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void send(); }}
          placeholder="Tell the office what to do — “find 40 plumbers in Clearwater and research them”"
          disabled={busy}
        />
        <button type="button" className="btn btn-acc btn-sm" disabled={busy || !text.trim()} onClick={send}>
          {busy ? <><span className="spin" />Working…</> : 'Send to the floor'}
        </button>
      </div>
      {!out && !busy && (
        <div className="tk-examples">
          {EXAMPLES.map(e => (
            <button key={e} type="button" onClick={() => setText(e)}>{e}</button>
          ))}
        </div>
      )}
      {out && (
        <div className={`tk-out${out.error ? ' err' : ''}`}>
          {out.error ? out.error : (
            <>
              <b>{out.agent?.name}{out.agent?.title ? ` · ${out.agent.title}` : ''}</b>
              <span>{out.reply}</span>
              {out.result && <span className="tk-result">{out.result}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
