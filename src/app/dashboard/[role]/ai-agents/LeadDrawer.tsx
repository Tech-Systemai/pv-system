'use client';

import { LEAD_STATUS_META, OUTREACH_STATUS_META, type Agent, type Lead, type Niche, type Outreach, type Reason } from '@/lib/aiAgents/types';
import { timeAgo } from './LiveFeed';

export function ChannelChip({ channel, confidence }: { channel: Lead['contact_channel']; confidence?: number | null }) {
  if (!channel) return <span className="ld-ch ld-ch-none">—</span>;
  return (
    <span className={`ld-ch ld-ch-${channel}`}>
      {channel === 'call' ? '📞 Call' : '✉ Email'}
      {confidence != null && <small>{confidence}%</small>}
    </span>
  );
}

export function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="ld-score-none">not scored</span>;
  const tone = score >= 75 ? 'hi' : score >= 60 ? 'ok' : 'lo';
  return (
    <span className={`ld-score ld-score-${tone}`}>
      <span className="ld-score-bar"><span style={{ width: `${score}%` }} /></span>
      <b>{score}</b>
    </span>
  );
}

function Reasons({ items, channel }: { items: Reason[]; channel?: boolean }) {
  if (!items.length) return <div className="ag-empty">Not researched yet.</div>;
  return (
    <ul className="ld-reasons">
      {items.map((r, i) => (
        <li key={i} className={channel ? `ld-r-${r.toward}` : r.weight >= 0 ? 'ld-r-pos' : 'ld-r-neg'}>
          <span>{channel ? (r.toward === 'call' ? '📞' : '✉') : r.weight >= 0 ? '+' : '−'}</span>
          {r.text}
          {r.weight !== 0 && <em>{channel ? `+${r.weight}` : `${r.weight > 0 ? '+' : ''}${r.weight}`}</em>}
        </li>
      ))}
    </ul>
  );
}

export default function LeadDrawer({ lead, niche, outreach, researcher, onClose }: {
  lead: Lead;
  niche?: Niche;
  outreach: Outreach[];
  researcher?: Agent;
  onClose: () => void;
}) {
  const s = lead.signals;
  const facts: [string, string][] = [
    ['Email found', s.email_type === 'owner' ? 'Owner\'s direct email' : s.email_type === 'generic' ? 'Generic inbox only' : 'None'],
    ['Website', s.has_website ? 'Yes' : 'No'],
    ['Running ads', s.runs_ads ? (s.ads_evidence || 'Yes') : 'No'],
    ['24/7 service', s.hours_24_7 ? 'Advertised' : 'No'],
    ['Team size', s.staff_estimate ? `~${s.staff_estimate}` : 'Unknown'],
    ['Office staff', s.office_staff ? 'Yes' : 'No'],
    ['Missed-call reviews', s.missed_call_reviews ? 'Yes' : 'No'],
    ['Years in business', s.years_in_business ? String(s.years_in_business) : 'Unknown'],
  ];

  return (
    <div className="ld-drawer-bg" onClick={onClose}>
      <aside className="ld-drawer" onClick={e => e.stopPropagation()}>
        <div className="ld-dh">
          <div>
            <div className="ld-dname">{lead.business_name}</div>
            <div className="ld-dsub">{niche?.name ?? lead.niche} · {lead.city}{lead.state ? `, ${lead.state}` : ''} · found {timeAgo(lead.created_at)} via {lead.source.replace('_', ' ')}</div>
          </div>
          <button type="button" className="ag-link" onClick={onClose}>✕</button>
        </div>

        <div className="ld-dbody">
          <div className="ld-kv">
            <div><span>Status</span><span className={`pv-bdg ${LEAD_STATUS_META[lead.status].badge}`}>{LEAD_STATUS_META[lead.status].label.toUpperCase()}</span></div>
            <div><span>Owner</span><b>{lead.owner_name || '—'}</b></div>
            <div><span>Phone</span>{lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : '—'}</div>
            <div><span>Email</span>{lead.email || '—'}</div>
            <div><span>Website</span>{lead.website || '—'}</div>
            <div><span>Google</span>{lead.rating ?? '—'}★ · {lead.review_count} reviews</div>
          </div>

          <div className="ag-sec">
            <div className="ag-sec-t">Willingness to pay</div>
            <ScoreBar score={lead.wtp_score} />
            <Reasons items={lead.wtp_reasons} />
          </div>

          <div className="ag-sec">
            <div className="ag-sec-t">Best way to reach them</div>
            <ChannelChip channel={lead.contact_channel} confidence={lead.channel_confidence} />
            <Reasons items={lead.channel_reasons} channel />
          </div>

          {lead.talking_points.length > 0 && (
            <div className="ag-sec">
              <div className="ag-sec-t">Talking points for your call</div>
              <ul className="ld-points">{lead.talking_points.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}

          {lead.researched_at && <div className="ag-sec">
            <div className="ag-sec-t">What research found</div>
            {s.research_notes && <p className="ag-purpose">{s.research_notes}</p>}
            <div className="ld-facts">{facts.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
            {researcher && <div className="ag-hint" style={{ marginTop: 8 }}>Researched by {researcher.name} · {timeAgo(lead.researched_at)}</div>}
          </div>}

          <div className="ag-sec">
            <div className="ag-sec-t">Outreach</div>
            {outreach.length === 0 ? <div className="ag-empty">Nothing sent yet.</div> : outreach.map(o => (
              <div key={o.id} className="ld-out">
                <div className="ld-out-h">
                  <span>{o.channel === 'call' ? '📞 Call' : '✉ Email'}</span>
                  <span className={`pv-bdg ${OUTREACH_STATUS_META[o.status].badge}`}>{OUTREACH_STATUS_META[o.status].label.toUpperCase()}</span>
                </div>
                {o.subject && <div className="ld-out-sub">{o.subject}</div>}
                {o.compliance_issues.length > 0 && <div className="ag-work-notes"><b>Compliance</b>{o.compliance_issues.join(' · ')}</div>}
                {o.notes && <div className="ld-out-note">{o.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
