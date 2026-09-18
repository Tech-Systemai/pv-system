'use client';

import { useState } from 'react';
import { OUTREACH_STATUS_META, type Lead, type Niche, type Outreach, type OutreachStatus } from '@/lib/aiAgents/types';
import { ScoreBar } from './LeadDrawer';
import { timeAgo } from './LiveFeed';

type Sub = 'calls' | 'emails' | 'replies';

const CALL_OUTCOMES: { status: OutreachStatus; label: string }[] = [
  { status: 'no_answer', label: 'No answer' },
  { status: 'callback', label: 'Call back' },
  { status: 'interested', label: 'Interested' },
  { status: 'booked', label: 'Booked demo' },
  { status: 'not_interested', label: 'Not interested' },
];

const EMAIL_COLS: { status: OutreachStatus; label: string; hint: string }[] = [
  { status: 'compliance', label: 'Compliance check', hint: 'Being checked before it can send' },
  { status: 'blocked', label: 'Blocked', hint: 'Failed a compliance rule' },
  { status: 'scheduled', label: 'Ready to send', hint: 'Cleared; sends once the niche template is approved' },
  { status: 'sent', label: 'Sent', hint: 'Delivered, waiting for a reply' },
];

function CallCard({ o, lead, niche, onOpenLead, onLog }: {
  o: Outreach; lead?: Lead; niche?: Niche;
  onOpenLead: (id: string) => void;
  onLog: (id: string, status: OutreachStatus, notes: string) => Promise<string | null>;
}) {
  const [notes, setNotes] = useState(o.notes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!lead) return null;
  const log = async (status: OutreachStatus) => {
    setBusy(true);
    setErr('');
    const e = await onLog(o.id, status, notes.trim());
    setBusy(false);
    if (e) setErr(e);
  };
  return (
    <div className={`oc-call${o.status === 'callback' ? ' oc-callback' : ''}`}>
      <div className="oc-call-h">
        <button type="button" className="oc-biz" onClick={() => onOpenLead(lead.id)}>{lead.business_name}</button>
        {o.sim && <span className="ag-sample">sample</span>}
        {o.status === 'callback' && <span className="pv-bdg pv-bdg-amber">CALL BACK</span>}
      </div>
      <div className="oc-call-meta">
        <a href={`tel:${lead.phone}`} className="oc-phone">📞 {lead.phone}</a>
        <span>{lead.owner_name || 'Owner unknown'}</span>
        <span>{niche?.name} · {lead.city}</span>
        <ScoreBar score={lead.wtp_score} />
      </div>
      {lead.talking_points.length > 0 && <ul className="ld-points">{lead.talking_points.map((t, i) => <li key={i}>{t}</li>)}</ul>}
      <input className="oc-notes" placeholder="Notes from the call…" value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="oc-outcomes">
        {CALL_OUTCOMES.map(c => (
          <button key={c.status} type="button" className={`btn btn-sm${c.status === 'booked' ? ' btn-acc' : ''}`} disabled={busy} onClick={() => log(c.status)}>{c.label}</button>
        ))}
      </div>
      {err && <div className="ag-err">{err}</div>}
    </div>
  );
}

export default function OutreachView({ leads, outreach, niches, onOpenLead, onLogCall, onOpenNiches }: {
  leads: Lead[];
  outreach: Outreach[];
  niches: Niche[];
  onOpenLead: (id: string) => void;
  onLogCall: (id: string, status: OutreachStatus, notes: string) => Promise<string | null>;
  onOpenNiches: () => void;
}) {
  const [sub, setSub] = useState<Sub>('calls');
  const [nicheF, setNicheF] = useState('all');
  const [open, setOpen] = useState<string | null>(null);

  const leadOf = Object.fromEntries(leads.map(l => [l.id, l]));
  const nicheOf = (o: Outreach) => niches.find(n => n.key === leadOf[o.lead_id]?.niche);
  const inNiche = (o: Outreach) => nicheF === 'all' || leadOf[o.lead_id]?.niche === nicheF;

  const calls = outreach.filter(o => o.channel === 'call' && inNiche(o));
  const toCall = calls.filter(o => o.status === 'to_call' || o.status === 'callback')
    .sort((a, b) => (leadOf[b.lead_id]?.wtp_score ?? 0) - (leadOf[a.lead_id]?.wtp_score ?? 0));
  const called = calls.filter(o => !['to_call', 'callback'].includes(o.status)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const emails = outreach.filter(o => o.channel === 'email' && inNiche(o));
  const replies = outreach.filter(o => inNiche(o) && ['replied', 'interested', 'booked'].includes(o.status)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const waitingNiches = [...new Set(emails.filter(o => o.status === 'scheduled').map(nicheOf).filter(n => n && !n.template_approved).map(n => n!.name))];

  return (
    <div className="tb-wrap">
      <div className="oc-top">
        <div className="ag-filters">
          <button type="button" className={sub === 'calls' ? 'on' : ''} onClick={() => setSub('calls')}>Your call list ({toCall.length})</button>
          <button type="button" className={sub === 'emails' ? 'on' : ''} onClick={() => setSub('emails')}>Emails ({emails.length})</button>
          <button type="button" className={sub === 'replies' ? 'on' : ''} onClick={() => setSub('replies')}>Replies &amp; interest ({replies.length})</button>
        </div>
        <select className="fld-input" value={nicheF} onChange={e => setNicheF(e.target.value)}>
          <option value="all">All niches</option>
          {niches.map(n => <option key={n.key} value={n.key}>{n.name}</option>)}
        </select>
        <span className="oc-gmail" title="Sending through Gmail is wired up in Phase 3">✉ Gmail: not connected yet</span>
      </div>

      {sub === 'calls' && (
        <>
          <div className="tb-sub" style={{ margin: '2px 0 10px' }}>
            Leads Research decided to call, highest willingness to pay first. Log each call and the pipeline moves on.
          </div>
          {toCall.length === 0 ? <div className="card"><div className="empty">No calls waiting.</div></div> : (
            <div className="oc-calls">
              {toCall.slice(0, 30).map(o => <CallCard key={o.id} o={o} lead={leadOf[o.lead_id]} niche={nicheOf(o)} onOpenLead={onOpenLead} onLog={onLogCall} />)}
            </div>
          )}
          {called.length > 0 && (
            <div className="card tb-card" style={{ marginTop: 14 }}>
              <div className="card-title" style={{ marginBottom: 8 }}>Calls made</div>
              {called.slice(0, 25).map(o => (
                <div key={o.id} className="ag-queued">
                  <span>{leadOf[o.lead_id]?.business_name}{o.notes ? ` — ${o.notes}` : ''}</span>
                  <span className={`pv-bdg ${OUTREACH_STATUS_META[o.status].badge}`}>{OUTREACH_STATUS_META[o.status].label.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {sub === 'emails' && (
        <>
          {waitingNiches.length > 0 && (
            <div className="up-await">
              Emails are ready for {waitingNiches.join(', ')} but won&apos;t send until you approve {waitingNiches.length === 1 ? 'that niche\'s' : 'those niches\''} template.{' '}
              <button type="button" className="ag-link" onClick={onOpenNiches}>Review templates →</button>
            </div>
          )}
          <div className="oc-board">
            {EMAIL_COLS.map(c => {
              const items = emails.filter(o => o.status === c.status || (c.status === 'sent' && o.status === 'bounced'));
              return (
                <div key={c.status} className={`oc-col oc-col-${c.status}`}>
                  <div className="up-lane-h" title={c.hint}>{c.label} <span>{items.length}</span></div>
                  {items.slice(0, 20).map(o => {
                    const lead = leadOf[o.lead_id];
                    const isOpen = open === o.id;
                    return (
                      <div key={o.id} className="oc-mail" onClick={() => setOpen(isOpen ? null : o.id)}>
                        <b>{lead?.business_name}</b>
                        <span className="tb-sub">{nicheOf(o)?.name} · {lead?.email || 'no email'}</span>
                        <span className="oc-subj">{o.subject}</span>
                        {o.compliance_issues.length > 0 && <span className="oc-issue">⚠ {o.compliance_issues[0]}</span>}
                        {isOpen && <pre className="oc-body">{o.body}</pre>}
                      </div>
                    );
                  })}
                  {items.length > 20 && <div className="up-more">+{items.length - 20} more</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {sub === 'replies' && (
        <div className="card tb-card">
          {replies.length === 0 ? <div className="empty">No replies yet.</div> : replies.map(o => {
            const lead = leadOf[o.lead_id];
            return (
              <div key={o.id} className="oc-reply" onClick={() => lead && onOpenLead(lead.id)}>
                <span>{o.channel === 'call' ? '📞' : '✉'}</span>
                <span className="oc-reply-t">
                  <b>{lead?.business_name}</b> <span className="tb-sub">{nicheOf(o)?.name} · {lead?.city}</span>
                  <span>{o.notes || OUTREACH_STATUS_META[o.status].label}</span>
                </span>
                <span className={`pv-bdg ${OUTREACH_STATUS_META[o.status].badge}`}>{OUTREACH_STATUS_META[o.status].label.toUpperCase()}</span>
                <span className="tb-sub" suppressHydrationWarning>{timeAgo(o.replied_at ?? o.updated_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
