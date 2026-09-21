'use client';

import { useEffect, useRef, useState } from 'react';
import { LIVE_AGENTS, NEXT_UP } from '@/lib/aiAgents/org';
import { ACTIVITY_META, WORK_META, type Activity, type Agent, type AgentMessage, type Department, type Skill, type Work } from '@/lib/aiAgents/types';
import { timeAgo } from './LiveFeed';

/** Talking to one agent: who they are, what they are on, and what you ask of them. */
export default function OfficeAgentPanel({
  agent, department, activity, task, work, messages, skills, canManage, sending, onSend, onSetOffice, onSaveSkill, onDeleteSkill, onClose,
}: {
  agent: Agent;
  department?: Department;
  activity: Activity | 'offline';
  task: string;
  work: Work[];
  messages: AgentMessage[];
  skills: Skill[];
  canManage: boolean;
  sending: boolean;
  onSend: (text: string) => Promise<string | null>;
  onSetOffice: (agent: Agent, inOffice: boolean) => void;
  onSaveSkill: (s: Partial<Skill>) => Promise<string | null>;
  onDeleteSkill: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [skill, setSkill] = useState<Partial<Skill> | null>(null);
  const [savingSkill, setSavingSkill] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const meta = ACTIVITY_META[activity];
  const duty = LIVE_AGENTS[agent.slug ?? ''];
  const open = work.filter(w => w.status === 'queued' || w.status === 'in_progress' || w.status === 'revision');
  const done = work.filter(w => w.status === 'done').slice(0, 3);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length, sending]);

  const send = async () => {
    const said = text.trim();
    if (!said) return;
    setErr('');
    setText('');
    const e = await onSend(said);
    if (e) { setErr(e); setText(said); }
  };

  return (
    <div className="ag-panel of-panel">
      <div className="ag-panel-h ag-detail-h">
        <button type="button" className="ag-link" onClick={onClose}>✕ Close</button>
        <div className="ag-id">
          <div className="ag-avatar" style={{ borderColor: meta.color, boxShadow: `0 0 0 4px ${meta.color}22` }}>{agent.name.slice(0, 1)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="ag-id-name">{agent.name}</div>
            <div className="ag-id-title">{agent.title}</div>
            <div className="ag-id-tags">
              {department && <span className="ag-tag">{department.name}</span>}
              <span className="ag-tag">{duty ? 'Live' : 'Not live yet'}</span>
            </div>
          </div>
        </div>
        <div className="ag-now" style={{ borderColor: meta.color }}>
          <span className="ag-now-lbl"><i style={{ background: meta.color }} />{meta.label}</span>
          <span className="ag-now-task">{task || (duty ? 'Free right now — nothing running' : 'Not switched on yet')}</span>
        </div>
      </div>

      <div className="ag-panel-body">
        <p className="ag-purpose">{duty ?? NEXT_UP[agent.slug ?? ''] ?? agent.purpose}</p>

        {open.length > 0 && (
          <div className="ag-sec">
            <div className="ag-sec-t">On their desk <span className="ag-count">{open.length}</span></div>
            {open.map(w => (
              <div key={w.id} className="of-task-row">
                <span>{w.title}</span>
                <span className={`pv-bdg ${WORK_META[w.status].badge}`}>{WORK_META[w.status].label.toUpperCase()}</span>
              </div>
            ))}
          </div>
        )}
        {done.length > 0 && (
          <div className="ag-sec">
            <div className="ag-sec-t">Finished</div>
            {done.map(w => <div key={w.id} className="of-task-row"><span>✓ {w.title}</span><span className="tb-sub" suppressHydrationWarning>{timeAgo(w.completed_at ?? w.updated_at)}</span></div>)}
          </div>
        )}

        <div className="ag-sec">
          <div className="ag-sec-t">
            How {agent.name} should work {skills.length > 0 && <span className="ag-count">{skills.length}</span>}
          </div>
          <div className="ag-hint">Teach it your way once. Everything here is added to its brief before every job it runs.</div>
          {skills.map(s => (
            <div key={s.id} className="of-task-row">
              <span><b>{s.name}</b> — {s.body.slice(0, 90)}{s.body.length > 90 ? '…' : ''}</span>
              {canManage && (
                <span className="ag-work-actions" style={{ margin: 0 }}>
                  <button type="button" className="btn btn-sm" onClick={() => setSkill(s)}>Edit</button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => onDeleteSkill(s.id)}>Remove</button>
                </span>
              )}
            </div>
          ))}
          {canManage && !skill && (
            <button type="button" className="btn btn-sm" onClick={() => setSkill({ name: '', body: '', scope: 'agent', target: agent.slug ?? '', active: true })}>
              + Teach {agent.name} something
            </button>
          )}
          {skill && (
            <div className="of-skill">
              <input value={skill.name ?? ''} onChange={e => setSkill({ ...skill, name: e.target.value })} placeholder="What is it called? e.g. How I qualify a roofer" />
              <textarea rows={4} value={skill.body ?? ''} onChange={e => setSkill({ ...skill, body: e.target.value })}
                placeholder="In your words: what to look for, what to say, what to avoid…" />
              <div className="ag-work-actions">
                <button type="button" className="btn btn-sm" onClick={() => setSkill(null)}>Cancel</button>
                <button type="button" className="btn btn-sm btn-acc" disabled={savingSkill || !skill.body?.trim()}
                  onClick={async () => { setSavingSkill(true); const e = await onSaveSkill({ ...skill, target: agent.slug ?? '' }); setSavingSkill(false); if (!e) setSkill(null); }}>
                  {savingSkill ? <><span className="spin" />Saving…</> : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ag-sec">
          <div className="ag-sec-t">Conversation</div>
          {messages.length === 0 && <div className="ag-empty">Say hello, or tell {agent.name} what you want done. Anything you ask for is saved to their desk.</div>}
          <div className="of-chat">
            {messages.map(m => (
              <div key={m.id} className={`of-msg of-msg-${m.role}`}>
                <b>{m.role === 'founder' ? 'You' : agent.name}</b>
                {m.text}
              </div>
            ))}
            {sending && <div className="of-msg of-msg-agent of-typing-msg"><b>{agent.name}</b><span className="of-dots"><i /><i /><i /></span></div>}
            <div ref={end} />
          </div>
        </div>
      </div>

      <div className="of-say">
        {canManage ? (
          <>
            <textarea
              rows={2}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder={`Tell ${agent.name} what to work on…`}
              disabled={sending}
            />
            <div className="ag-work-actions">
              {canManage && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onSetOffice(agent, false)}>Send home</button>}
              <button type="button" className="btn btn-sm btn-acc" disabled={sending || !text.trim()} onClick={send}>
                {sending ? <><span className="spin" />Sending…</> : 'Send'}
              </button>
            </div>
            {err && <div className="ag-err">{err}</div>}
          </>
        ) : <span className="tb-sub">Only owners and admins can give the agents work.</span>}
      </div>
    </div>
  );
}
