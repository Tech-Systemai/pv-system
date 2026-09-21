'use client';

import { useState } from 'react';
import { QUALIFY_AT } from '@/lib/aiAgents/pipeline';
import {
  LEAD_STATUS_META, OUTREACH_STATUS_META,
  type CallNote, type Lead, type Niche, type Outreach, type OutreachSettings,
} from '@/lib/aiAgents/types';
import { ChannelChip, ScoreBar } from './LeadDrawer';
import { timeAgo } from './LiveFeed';
import EmailsPanel, { type EmailAction, type InboxStatus } from './EmailsPanel';

// Everything you do with a lead after research: your call list, the calls you
// have made, the emails, replies, and who qualified or did not, with reasons.

type Sub = 'calls' | 'called' | 'interested' | 'emails' | 'replies' | 'qualified' | 'passed';

// Who lands in which tab once you have logged a call.
const INTERESTED: string[] = ['interested', 'booked'];
const CALLED: string[] = ['no_answer', 'left_voicemail', 'callback', 'not_interested'];

const OUTCOMES: { key: CallNote['outcome']; label: string; accent?: boolean }[] = [
  { key: 'no_answer', label: 'No answer' },
  { key: 'left_voicemail', label: 'Left voicemail' },
  { key: 'callback', label: 'Call back later' },
  { key: 'interested', label: 'Interested' },
  { key: 'booked', label: 'Booked a call', accent: true },
  { key: 'not_interested', label: 'Not interested' },
];

export function WebLink({ url }: { url?: string }) {
  if (!url) return <span className="tb-sub">no website</span>;
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return (
    <a className="oc-link" href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
      {url.replace(/^https?:\/\//i, '')} ↗
    </a>
  );
}

/** One lead on the call list: the details, why they qualified, and the outcome buttons. */
function CallCard({ lead, niche, outreach, history, status, onOpenLead, onLog }: {
  lead: Lead; niche?: Niche; outreach?: Outreach; history: CallNote[]; status?: string;
  onOpenLead: (id: string) => void;
  onLog: (leadId: string, outreachId: string | null, outcome: CallNote['outcome'], note: string) => Promise<string | null>;
}) {
  const [outcome, setOutcome] = useState<CallNote['outcome'] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!outcome) return;
    setBusy(true);
    setErr('');
    const e = await onLog(lead.id, outreach?.id ?? null, outcome, note.trim());
    setBusy(false);
    if (e) return setErr(e);
    setOutcome(null);
    setNote('');
  };

  return (
    <div className={`oc-call${status === 'callback' ? ' oc-callback' : ''}${status && INTERESTED.includes(status) ? ' oc-warm' : ''}`}>
      <div className="oc-call-h">
        <button type="button" className="oc-biz" onClick={() => onOpenLead(lead.id)}>{lead.business_name}</button>
        {status && status !== 'to_call' && (
          <span className={`pv-bdg ${OUTREACH_STATUS_META[status as keyof typeof OUTREACH_STATUS_META].badge}`}>
            {OUTREACH_STATUS_META[status as keyof typeof OUTREACH_STATUS_META].label.toUpperCase()}
          </span>
        )}
        <ScoreBar score={lead.wtp_score} />
      </div>
      <div className="oc-call-meta">
        <a href={`tel:${lead.phone}`} className="oc-phone">📞 {lead.phone || 'no number'}</a>
        <WebLink url={lead.website} />
        <span>{lead.owner_name || 'Owner unknown'}</span>
        <span>{niche?.name} · {lead.city}</span>
      </div>
      {lead.signals.research_notes && <div className="oc-note">{lead.signals.research_notes}</div>}
      {lead.talking_points.length > 0 && <ul className="ld-points">{lead.talking_points.map((t, i) => <li key={i}>{t}</li>)}</ul>}
      {history.length > 0 && (
        <div className="oc-history">
          {history.map(h => (
            <div key={h.id}>
              <b>{h.outcome.replace('_', ' ')}</b> <span suppressHydrationWarning>{timeAgo(h.called_at)}</span>{h.note ? ` — ${h.note}` : ''}
            </div>
          ))}
        </div>
      )}

      {outcome ? (
        <div className="oc-log">
          <b>{OUTCOMES.find(o => o.key === outcome)?.label}</b>
          <textarea rows={2} autoFocus value={note} onChange={e => setNote(e.target.value)}
            placeholder="What was said? Anything to remember for next time…" />
          <div className="ag-work-actions">
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setOutcome(null)}>Cancel</button>
            <button type="button" className="btn btn-sm btn-acc" disabled={busy} onClick={save}>
              {busy ? <><span className="spin" />Saving…</> : 'Save the call'}
            </button>
          </div>
        </div>
      ) : (
        <div className="oc-outcomes">
          {status && status !== 'to_call' && <span className="oc-again">Log another call:</span>}
          {OUTCOMES.map(o => (
            <button key={o.key} type="button" className={`btn btn-sm${o.accent ? ' btn-acc' : ''}`} onClick={() => setOutcome(o.key)}>{o.label}</button>
          ))}
        </div>
      )}
      {err && <div className="ag-err">{err}</div>}
    </div>
  );
}

/** Why research said yes, or what held them back. */
function Reasons({ lead }: { lead: Lead }) {
  const good = lead.wtp_reasons.filter(r => r.weight > 0).slice(0, 3);
  const bad = lead.wtp_reasons.filter(r => r.weight < 0).slice(0, 3);
  const shown = bad.length && (lead.wtp_score ?? 0) < QUALIFY_AT ? bad : good;
  return (
    <ul className="oc-reasons">
      {shown.map((r, i) => <li key={i} className={r.weight > 0 ? 'good' : 'bad'}>{r.weight > 0 ? '+' : '−'} {r.text}</li>)}
      {shown.length === 0 && <li className="tb-sub">No reasons recorded.</li>}
    </ul>
  );
}

function LeadCards({ leads, niches, onOpenLead }: { leads: Lead[]; niches: Niche[]; onOpenLead: (id: string) => void }) {
  if (!leads.length) return <div className="card"><div className="empty">Nothing here yet.</div></div>;
  return (
    <div className="oc-cards">
      {leads.slice(0, 120).map(l => (
        <div key={l.id} className="oc-lead" onClick={() => onOpenLead(l.id)}>
          <div className="oc-call-h">
            <b>{l.business_name}</b>
            <ScoreBar score={l.wtp_score} />
          </div>
          <div className="oc-call-meta">
            <span>{niches.find(n => n.key === l.niche)?.name} · {l.city}</span>
            <ChannelChip channel={l.contact_channel} confidence={l.channel_confidence} />
            <WebLink url={l.website} />
            {l.email && <span className="tb-sub">{l.email}</span>}
            <span className={`pv-bdg ${LEAD_STATUS_META[l.status].badge}`}>{LEAD_STATUS_META[l.status].label.toUpperCase()}</span>
          </div>
          <Reasons lead={l} />
        </div>
      ))}
    </div>
  );
}

export default function OutreachView({
  leads, outreach, niches, calls, onOpenLead, onLogCall, settings, inbox, onSettings, onEmailAction,
}: {
  leads: Lead[];
  outreach: Outreach[];
  niches: Niche[];
  calls: CallNote[];
  onOpenLead: (id: string) => void;
  onLogCall: (leadId: string, outreachId: string | null, outcome: CallNote['outcome'], note: string) => Promise<string | null>;
  settings: OutreachSettings | null;
  inbox: InboxStatus;
  onSettings: (s: OutreachSettings) => void;
  onEmailAction: EmailAction;
}) {
  const [sub, setSub] = useState<Sub>('calls');
  const [nicheF, setNicheF] = useState('all');

  const leadById = Object.fromEntries(leads.map(l => [l.id, l]));
  const inNiche = (l?: Lead) => !!l && (nicheF === 'all' || l.niche === nicheF);
  const nicheOf = (l: Lead) => niches.find(n => n.key === l.niche);
  const callsByLead: Record<string, CallNote[]> = {};
  for (const c of calls) (callsByLead[c.lead_id] ??= []).push(c);

  const callRows = outreach.filter(o => o.channel === 'call' && inNiche(leadById[o.lead_id]));
  const toCall = callRows.filter(o => o.status === 'to_call')
    .sort((a, b) => (leadById[b.lead_id]?.wtp_score ?? 0) - (leadById[a.lead_id]?.wtp_score ?? 0));
  // Called: you reached out and left a note. Call-backs sit at the top, since they are owed one.
  const called = callRows.filter(o => CALLED.includes(o.status))
    .sort((a, b) => (b.status === 'callback' ? 1 : 0) - (a.status === 'callback' ? 1 : 0)
      || (b.sent_at ?? b.updated_at).localeCompare(a.sent_at ?? a.updated_at));
  const interested = callRows.filter(o => INTERESTED.includes(o.status))
    .sort((a, b) => (b.sent_at ?? b.updated_at).localeCompare(a.sent_at ?? a.updated_at));
  const replies = outreach.filter(o => o.channel === 'email' && inNiche(leadById[o.lead_id]) && o.status === 'replied')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const emailsToHandle = outreach.filter(o => o.channel === 'email' && ['draft', 'blocked'].includes(o.status)).length;
  const qualified = leads.filter(l => inNiche(l) && ['qualified', 'contacted', 'replied', 'booked'].includes(l.status))
    .sort((a, b) => (b.wtp_score ?? 0) - (a.wtp_score ?? 0));
  const passed = leads.filter(l => inNiche(l) && ['disqualified', 'not_interested'].includes(l.status))
    .sort((a, b) => (b.wtp_score ?? 0) - (a.wtp_score ?? 0));

  const TABS: { key: Sub; label: string; n: number }[] = [
    { key: 'calls', label: 'Call list', n: toCall.length },
    { key: 'called', label: 'Called', n: called.length },
    { key: 'interested', label: 'Interested', n: interested.length },
    { key: 'emails', label: 'Emails', n: emailsToHandle },
    { key: 'replies', label: 'Replies', n: replies.length },
    { key: 'qualified', label: 'Qualified', n: qualified.length },
    { key: 'passed', label: 'Passed on', n: passed.length },
  ];

  return (
    <div className="tb-wrap">
      <div className="oc-top">
        <div className="ag-filters">
          {TABS.map(t => (
            <button key={t.key} type="button" className={sub === t.key ? 'on' : ''} onClick={() => setSub(t.key)}>
              {t.label} <b className="oc-count">{t.n}</b>
            </button>
          ))}
        </div>
        <select className="fld-input" value={nicheF} onChange={e => setNicheF(e.target.value)}>
          <option value="all">All niches</option>
          {niches.map(n => <option key={n.key} value={n.key}>{n.name}</option>)}
        </select>
        <span className="oc-gmail">✉ {inbox.email ?? 'Outreach inbox not connected'}</span>
      </div>

      {sub === 'calls' && (
        <>
          <div className="tb-sub">Leads research picked for a call, best first. Log every call: the note is kept and the lead moves to “Called”.</div>
          {toCall.length === 0 ? <div className="card"><div className="empty">No calls waiting. Ask Scout for more leads in the Office.</div></div> : (
            <div className="oc-calls">
              {toCall.slice(0, 40).map(o => {
                const lead = leadById[o.lead_id];
                return lead ? (
                  <CallCard key={o.id} lead={lead} niche={nicheOf(lead)} outreach={o} status={o.status}
                    history={callsByLead[lead.id] ?? []} onOpenLead={onOpenLead} onLog={onLogCall} />
                ) : null;
              })}
            </div>
          )}
        </>
      )}

      {sub === 'called' && (
        <>
          <div className="tb-sub">Everyone you have phoned, with your notes. Call-backs are first — log the next call right here when you get to them.</div>
          {called.length === 0 ? <div className="card"><div className="empty">No calls logged yet.</div></div> : (
            <div className="oc-calls">
              {called.slice(0, 60).map(o => {
                const lead = leadById[o.lead_id];
                return lead ? (
                  <CallCard key={o.id} lead={lead} niche={nicheOf(lead)} outreach={o} status={o.status}
                    history={callsByLead[lead.id] ?? []} onOpenLead={onOpenLead} onLog={onLogCall} />
                ) : null;
              })}
            </div>
          )}
        </>
      )}

      {sub === 'interested' && (
        <>
          <div className="tb-sub">The ones who said yes on the phone: interested, or already booked in.</div>
          {interested.length === 0 ? <div className="card"><div className="empty">Nobody has said yes yet.</div></div> : (
            <div className="oc-calls">
              {interested.map(o => {
                const lead = leadById[o.lead_id];
                return lead ? (
                  <CallCard key={o.id} lead={lead} niche={nicheOf(lead)} outreach={o} status={o.status}
                    history={callsByLead[lead.id] ?? []} onOpenLead={onOpenLead} onLog={onLogCall} />
                ) : null;
              })}
            </div>
          )}
        </>
      )}

      {sub === 'emails' && (
        <EmailsPanel leads={leads} outreach={outreach} niches={niches} nicheFilter={nicheF}
          settings={settings} inbox={inbox} onSettings={onSettings} onAction={onEmailAction} onOpenLead={onOpenLead} />
      )}

      {sub === 'replies' && (
        replies.length === 0 ? <div className="card"><div className="empty">No replies yet.</div></div> : (
          <div className="card tb-card">
            {replies.map(o => {
              const lead = leadById[o.lead_id];
              return (
                <div key={o.id} className="oc-reply" onClick={() => lead && onOpenLead(lead.id)}>
                  <span>{o.channel === 'call' ? '📞' : '✉'}</span>
                  <span className="oc-reply-t">
                    <b>{lead?.business_name}</b> <span className="tb-sub">{lead && nicheOf(lead)?.name} · {lead?.city}</span>
                    <span>{o.notes || OUTREACH_STATUS_META[o.status].label}</span>
                  </span>
                  <span className={`pv-bdg ${OUTREACH_STATUS_META[o.status].badge}`}>{OUTREACH_STATUS_META[o.status].label.toUpperCase()}</span>
                  <span className="tb-sub" suppressHydrationWarning>{timeAgo(o.replied_at ?? o.updated_at)}</span>
                </div>
              );
            })}
          </div>
        )
      )}

      {sub === 'qualified' && (
        <>
          <div className="tb-sub">Scored {QUALIFY_AT} or higher, so they are worth your time. The reasons are what research actually found.</div>
          <LeadCards leads={qualified} niches={niches} onOpenLead={onOpenLead} />
        </>
      )}

      {sub === 'passed' && (
        <>
          <div className="tb-sub">Scored under {QUALIFY_AT}, so nobody contacts them. Each one shows what held it back.</div>
          <LeadCards leads={passed} niches={niches} onOpenLead={onOpenLead} />
        </>
      )}
    </div>
  );
}
