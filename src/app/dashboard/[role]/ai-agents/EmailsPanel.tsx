'use client';

import { useState } from 'react';
import { OUTREACH_STATUS_META, type Lead, type Niche, type Outreach, type OutreachSettings } from '@/lib/aiAgents/types';
import { ScoreBar } from './LeadDrawer';
import { timeAgo } from './LiveFeed';

export type InboxStatus = { ready: boolean; google: boolean; email: string | null; cap: number; sent24h: number };
export type EmailAction = (payload: Record<string, unknown>) => Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }>;

const OUTREACH_EMAIL = 'olivia@octopusengines.com';

function Inbox({ inbox, onAction }: { inbox: InboxStatus; onAction: EmailAction }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!inbox.google) {
    return (
      <div className="em-card">
        <b>Outreach inbox</b>
        <span className="tb-sub">Needs <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in Vercel before {OUTREACH_EMAIL} can be connected.</span>
      </div>
    );
  }
  if (!inbox.email) {
    return (
      <div className="em-card">
        <b>Outreach inbox</b>
        <span className="tb-sub">Sign in as {OUTREACH_EMAIL} and allow sending and reading replies. Nothing sends until you approve it.</span>
        <a className="btn btn-acc btn-sm" href={`/api/agents/gmail/connect?hint=${encodeURIComponent(OUTREACH_EMAIL)}`}>Connect {OUTREACH_EMAIL}</a>
      </div>
    );
  }
  const send = async () => {
    setBusy(true);
    const r = await onAction({ action: 'send' });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    const j = r.json as { sent?: number; reason?: string; replies?: number };
    setMsg(j.sent ? `Sent ${j.sent}.` : `Nothing sent: ${j.reason ?? 'no approved emails waiting'}.${j.replies ? ` ${j.replies} new replies.` : ''}`);
  };
  return (
    <div className="em-card em-inbox">
      <div>
        <b>✉ {inbox.email}</b>
        <span className="tb-sub">Warm-up limit today: <b>{inbox.cap}</b> emails · sent in the last 24h: <b>{inbox.sent24h}</b>. Sends on weekdays 8:30–5:00 ET, a couple at a time.</span>
      </div>
      <button type="button" className="btn btn-sm" disabled={busy} onClick={send}>{busy ? <><span className="spin" />Sending…</> : 'Send approved now'}</button>
      {msg && <span className="tb-sub" style={{ flexBasis: '100%' }}>{msg}</span>}
    </div>
  );
}

function Settings({ settings, onSaved, onAction }: { settings: OutreachSettings; onSaved: (s: OutreachSettings) => void; onAction: EmailAction }) {
  const [d, setD] = useState(settings);
  const [open, setOpen] = useState(!settings.sender_name || !settings.postal_address);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = <K extends keyof OutreachSettings>(k: K, v: OutreachSettings[K]) => setD(p => ({ ...p, [k]: v }));
  const save = async () => {
    setBusy(true);
    const r = await onAction({ action: 'settings', settings: d });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    onSaved(r.json.settings as OutreachSettings);
    setMsg('Saved');
  };
  const ready = !!settings.sender_name && !!settings.postal_address;
  return (
    <div className="em-card">
      <button type="button" className="nc-tpl-h" onClick={() => setOpen(!open)}>
        <span>What Quill writes with</span>
        {ready ? <span className="pv-bdg pv-bdg-green">READY</span> : <span className="pv-bdg pv-bdg-amber">NEEDS YOUR DETAILS</span>}
        <span className={`ag-caret${open ? ' open' : ''}`}>›</span>
      </button>
      {open && (
        <div className="em-form">
          <label>Your name (signs every email)<input value={d.sender_name} onChange={e => set('sender_name', e.target.value)} placeholder="Olivia …" /></label>
          <label>Title<input value={d.sender_title} onChange={e => set('sender_title', e.target.value)} placeholder="Founder" /></label>
          <label className="wide">Postal address (the law requires one in every cold email)<input value={d.postal_address} onChange={e => set('postal_address', e.target.value)} placeholder="123 Main St, Suite 100, Tampa, FL 33602" /></label>
          <label className="wide">The offer, in your words<textarea rows={2} value={d.offer} onChange={e => set('offer', e.target.value)} placeholder="24/7 AI answering + missed-call text-back. Setup in a day, $X/month, no contract…" /></label>
          <label className="wide">Proof you can mention (leave empty if none yet; Quill never invents any)<textarea rows={2} value={d.proof} onChange={e => set('proof', e.target.value)} placeholder="e.g. a Tampa plumber booked 11 extra jobs in the first month" /></label>
          <label className="wide">The reply you want<input value={d.call_to_action} onChange={e => set('call_to_action', e.target.value)} placeholder='e.g. "yes" to a 60-second recording of how it would answer their calls' /></label>
          <label>Daily ceiling (max 50)<input type="number" min={1} max={50} value={d.daily_limit} onChange={e => set('daily_limit', Number(e.target.value))} /></label>
          <label className="em-check"><input type="checkbox" checked={d.auto_send} onChange={e => set('auto_send', e.target.checked)} /> Send without my approval (leave off until you trust the drafts)</label>
          <div className="ag-work-actions wide">
            {msg && <span className={msg === 'Saved' ? 'ag-ok' : 'ag-err'}>{msg}</span>}
            <button type="button" className="btn btn-sm btn-acc" disabled={busy} onClick={save}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DraftCard({ o, lead, niche, onAction, onOpenLead }: {
  o: Outreach; lead?: Lead; niche?: Niche; onAction: EmailAction; onOpenLead: (id: string) => void;
}) {
  const [subject, setSubject] = useState(o.subject);
  const [body, setBody] = useState(o.body);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'view' | 'rewrite'>('view');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setErr('');
    const r = await onAction({ id: o.id, ...payload });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    const next = r.json.outreach as Outreach | undefined;
    if (next) { setSubject(next.subject); setBody(next.body); }
    setMode('view');
    setNotes('');
  };
  return (
    <div className={`em-draft${o.status === 'blocked' ? ' blocked' : ''}`}>
      <div className="em-draft-h">
        <button type="button" className="oc-biz" onClick={() => lead && onOpenLead(lead.id)}>{lead?.business_name}</button>
        <span className="tb-sub">to {lead?.email} · {niche?.name} · {lead?.city}</span>
        <ScoreBar score={lead?.wtp_score ?? null} />
      </div>
      {o.personal_hook && <div className="em-hook"><b>Built on</b>{o.personal_hook}</div>}
      <input className="em-subj" value={subject} onChange={e => setSubject(e.target.value)} />
      <textarea className="em-body" rows={Math.min(18, body.split('\n').length + 1)} value={body} onChange={e => setBody(e.target.value)} />
      {o.notes && <div className="tb-sub">{o.notes}</div>}
      {o.compliance_issues.length > 0 && <div className="ag-work-notes"><b>Shield blocked it</b>{o.compliance_issues.join(' · ')}</div>}
      {mode === 'rewrite' ? (
        <div className="ag-work-rev">
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What should Quill change? e.g. shorter, lead with the 24/7 angle, less salesy" autoFocus />
          <div className="ag-work-actions">
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setMode('view')}>Cancel</button>
            <button type="button" className="btn btn-sm btn-acc" disabled={busy || !notes.trim()} onClick={() => run({ action: 'rewrite', notes })}>
              {busy ? <><span className="spin" />Rewriting…</> : 'Rewrite'}
            </button>
          </div>
        </div>
      ) : (
        <div className="ag-work-actions">
          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => run({ action: 'skip' })}>Skip</button>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setMode('rewrite')}>Ask Quill to rewrite</button>
          <button type="button" className="btn btn-sm btn-acc" disabled={busy} onClick={() => run({ action: 'approve', subject, body })}>Approve &amp; queue</button>
        </div>
      )}
      {err && <div className="ag-err">{err}</div>}
    </div>
  );
}

export default function EmailsPanel({ leads, outreach, niches, nicheFilter, settings, inbox, onSettings, onAction, onOpenLead }: {
  leads: Lead[];
  outreach: Outreach[];
  niches: Niche[];
  nicheFilter: string;
  settings: OutreachSettings | null;
  inbox: InboxStatus;
  onSettings: (s: OutreachSettings) => void;
  onAction: EmailAction;
  onOpenLead: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const leadOf = Object.fromEntries(leads.map(l => [l.id, l]));
  const nicheOf = (l?: Lead) => niches.find(n => n.key === l?.niche);
  const inNiche = (o: Outreach) => nicheFilter === 'all' || leadOf[o.lead_id]?.niche === nicheFilter;
  const emails = outreach.filter(o => o.channel === 'email' && inNiche(o));
  const review = emails.filter(o => o.status === 'draft' || o.status === 'blocked').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const queued = emails.filter(o => o.status === 'scheduled');
  const sent = emails.filter(o => ['sent', 'replied', 'bounced', 'failed'].includes(o.status)).sort((a, b) => (b.sent_at ?? b.updated_at).localeCompare(a.sent_at ?? a.updated_at));
  const touched = new Set(outreach.map(o => o.lead_id));
  const waiting = leads.filter(l => l.status === 'qualified' && l.contact_channel === 'email' && l.email && !touched.has(l.id));

  if (!inbox.ready || !settings) {
    return <div className="up-await">Run <code>supabase/schema_v93_outreach_email.sql</code> in the Supabase SQL Editor to switch on email outreach.</div>;
  }
  const write = async () => {
    setBusy(true);
    setMsg('');
    const r = await onAction({ action: 'write', limit: 5 });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    const j = r.json as { written: number; skipped: number; failed: number };
    setMsg(`Quill wrote ${j.written}${j.skipped ? `, skipped ${j.skipped} (too little to personalise)` : ''}${j.failed ? `, ${j.failed} failed` : ''}. They're below for your review.`);
  };

  return (
    <div className="tb-wrap">
      <Inbox inbox={inbox} onAction={onAction} />
      <Settings key={settings.sender_name + settings.postal_address} settings={settings} onSaved={onSettings} onAction={onAction} />

      <div className="em-bar">
        <span><b>{waiting.length}</b> researched email-first leads waiting for Quill · <b>{review.length}</b> for your review · <b>{queued.length}</b> approved and queued · <b>{sent.length}</b> sent</span>
        <button type="button" className="btn btn-sm btn-acc" disabled={busy || !waiting.length || !settings.sender_name || !settings.postal_address} onClick={write}>
          {busy ? <><span className="spin" />Quill is writing…</> : 'Write the next 5'}
        </button>
        {msg && <span className="tb-sub" style={{ flexBasis: '100%' }}>{msg}</span>}
      </div>

      {review.length > 0 && (
        <>
          <div className="em-sec">Your review ({review.length})</div>
          <div className="em-drafts">
            {review.map(o => <DraftCard key={o.id} o={o} lead={leadOf[o.lead_id]} niche={nicheOf(leadOf[o.lead_id])} onAction={onAction} onOpenLead={onOpenLead} />)}
          </div>
        </>
      )}

      {queued.length > 0 && (
        <div className="card tb-card">
          <div className="em-sec" style={{ padding: '12px 14px 4px' }}>Approved · Post sends these in the next sending windows</div>
          {queued.map(o => (
            <div key={o.id} className="ag-queued" style={{ padding: '8px 14px' }}>
              <span>{leadOf[o.lead_id]?.business_name} — {o.subject}</span>
              <span className="pv-bdg pv-bdg-indigo">QUEUED</span>
            </div>
          ))}
        </div>
      )}

      {sent.length > 0 && (
        <div className="card tb-card">
          <div className="em-sec" style={{ padding: '12px 14px 4px' }}>Sent</div>
          {sent.slice(0, 50).map(o => (
            <div key={o.id} className="oc-reply" onClick={() => onOpenLead(o.lead_id)}>
              <span>✉</span>
              <span className="oc-reply-t">
                <b>{leadOf[o.lead_id]?.business_name}</b> <span className="tb-sub">{o.subject}</span>
                {o.status === 'replied' && <span>↩ {o.notes}</span>}
                {o.error && <span className="ag-err">{o.error}</span>}
              </span>
              <span className={`pv-bdg ${OUTREACH_STATUS_META[o.status].badge}`}>{OUTREACH_STATUS_META[o.status].label.toUpperCase()}</span>
              <span className="tb-sub" suppressHydrationWarning>{o.sent_at ? timeAgo(o.sent_at) : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
