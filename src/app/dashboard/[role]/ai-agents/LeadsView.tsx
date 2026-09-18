'use client';

import { useMemo, useState } from 'react';
import { LEAD_STATUS_META, type Lead, type LeadStatus, type Niche } from '@/lib/aiAgents/types';
import { ChannelChip, ScoreBar } from './LeadDrawer';
import { timeAgo } from './LiveFeed';

const STATUS_ORDER: LeadStatus[] = ['new', 'researching', 'qualified', 'contacted', 'replied', 'booked', 'disqualified', 'not_interested'];

export default function LeadsView({ leads, niches, onOpenLead }: {
  leads: Lead[];
  niches: Niche[];
  onOpenLead: (id: string) => void;
}) {
  const [niche, setNiche] = useState('all');
  const [status, setStatus] = useState<LeadStatus | 'all'>('all');
  const [channel, setChannel] = useState<'all' | 'call' | 'email'>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(60);

  const perNiche = useMemo(() => {
    const out: Record<string, { total: number; qualified: number }> = {};
    for (const l of leads) {
      out[l.niche] ??= { total: 0, qualified: 0 };
      out[l.niche].total += 1;
      if (['qualified', 'contacted', 'replied', 'booked'].includes(l.status)) out[l.niche].qualified += 1;
    }
    return out;
  }, [leads]);

  const inNiche = niche === 'all' ? leads : leads.filter(l => l.niche === niche);
  const shown = inNiche
    .filter(l => status === 'all' || l.status === status)
    .filter(l => channel === 'all' || l.contact_channel === channel)
    .filter(l => !q.trim() || `${l.business_name} ${l.city} ${l.owner_name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const funnel = STATUS_ORDER.slice(0, 6).map(s => ({ s, n: inNiche.filter(l => l.status === s).length }));
  const nicheName = (k: string) => niches.find(n => n.key === k)?.name ?? k;

  return (
    <div className="tb-wrap">
      <div className="ld-niches">
        <button type="button" className={niche === 'all' ? 'on' : ''} onClick={() => setNiche('all')}>
          All niches <b>{leads.length}</b>
        </button>
        {niches.map(n => (
          <button key={n.key} type="button" className={`${niche === n.key ? 'on' : ''}${n.active ? '' : ' off'}`} onClick={() => setNiche(n.key)}>
            {n.name} <b>{perNiche[n.key]?.total ?? 0}</b>
            {(perNiche[n.key]?.qualified ?? 0) > 0 && <small>{perNiche[n.key].qualified} qualified</small>}
          </button>
        ))}
      </div>

      <div className="ld-funnel">
        {funnel.map(f => (
          <button key={f.s} type="button" className={status === f.s ? 'on' : ''} onClick={() => setStatus(status === f.s ? 'all' : f.s)}>
            <b>{f.n}</b><span>{LEAD_STATUS_META[f.s].label}</span>
          </button>
        ))}
      </div>

      <div className="tb-filters">
        <input className="ag-search" placeholder="Search business, owner or city…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="fld-input" value={status} onChange={e => setStatus(e.target.value as LeadStatus | 'all')}>
          <option value="all">Any status</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{LEAD_STATUS_META[s].label}</option>)}
        </select>
        <select className="fld-input" value={channel} onChange={e => setChannel(e.target.value as 'all' | 'call' | 'email')}>
          <option value="all">Any channel</option>
          <option value="call">Call</option>
          <option value="email">Email</option>
        </select>
      </div>

      <div className="card tb-card">
        {shown.length === 0 ? (
          <div className="empty">No leads here yet. Lead Generation pulls them from Google Maps into each niche.</div>
        ) : (
          <div className="tb-scroll">
            <table className="tbl">
              <thead>
                <tr><th>Business</th><th>Niche</th><th>Google</th><th>Willingness to pay</th><th>Reach by</th><th>Status</th><th>Found</th></tr>
              </thead>
              <tbody>
                {shown.slice(0, limit).map(l => (
                  <tr key={l.id} className="tb-row" onClick={() => onOpenLead(l.id)}>
                    <td>
                      <b>{l.business_name}</b>{l.sim && <span className="ag-sample">sample</span>}
                      <div className="tb-sub">{l.city}{l.owner_name ? ` · ${l.owner_name}` : ''}</div>
                    </td>
                    <td>{nicheName(l.niche)}</td>
                    <td className="tb-mono">{l.rating ?? '—'}★ · {l.review_count}</td>
                    <td><ScoreBar score={l.wtp_score} /></td>
                    <td><ChannelChip channel={l.contact_channel} confidence={l.channel_confidence} /></td>
                    <td><span className={`pv-bdg ${LEAD_STATUS_META[l.status].badge}`}>{LEAD_STATUS_META[l.status].label.toUpperCase()}</span></td>
                    <td className="tb-sub" suppressHydrationWarning>{timeAgo(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > limit && (
              <button type="button" className="btn btn-sm" style={{ margin: 12 }} onClick={() => setLimit(x => x + 100)}>
                Show more ({shown.length - limit} left)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
