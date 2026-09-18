'use client';

import { useMemo, useState } from 'react';
import { LEAD_STATUS_META, type Lead, type LeadStatus, type Niche } from '@/lib/aiAgents/types';
import { ChannelChip, ScoreBar } from './LeadDrawer';
import { timeAgo } from './LiveFeed';

const STATUS_ORDER: LeadStatus[] = ['new', 'researching', 'qualified', 'contacted', 'replied', 'booked', 'disqualified', 'not_interested'];

function PullPanel({ niches, onPull }: { niches: Niche[]; onPull: (niche: string, city: string, max: number) => Promise<string> }) {
  const active = niches.filter(n => n.active);
  const [niche, setNiche] = useState(active[0]?.key ?? '');
  const [city, setCity] = useState('');
  const [max, setMax] = useState(20);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const n = niches.find(x => x.key === niche);
  const suggestions = (n?.cities ?? '').split(',').map(c => c.trim()).filter(Boolean);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche || !city.trim()) return;
    setBusy(true);
    setMsg(await onPull(niche, city.trim(), max));
    setBusy(false);
  };
  return (
    <form className="ld-pull" onSubmit={go}>
      <b>Pull leads from Google Maps</b>
      <select className="fld-input" value={niche} onChange={e => setNiche(e.target.value)}>
        {active.map(x => <option key={x.key} value={x.key}>{x.name}</option>)}
      </select>
      <input className="ag-search" list="ld-cities" placeholder="City, State (e.g. Tampa, FL)" value={city} onChange={e => setCity(e.target.value)} />
      <datalist id="ld-cities">{suggestions.map(c => <option key={c} value={c} />)}</datalist>
      <select className="fld-input" value={max} onChange={e => setMax(Number(e.target.value))}>
        {[10, 20, 40, 60, 100].map(v => <option key={v} value={v}>Up to {v}</option>)}
      </select>
      <button type="submit" className="btn btn-acc btn-sm" disabled={busy || !city.trim()}>{busy ? <><span className="spin" />Starting…</> : 'Pull'}</button>
      {msg && <span className="ld-pull-msg">{msg}</span>}
    </form>
  );
}

export default function LeadsView({ leads, niches, onOpenLead, canPull, onPull }: {
  leads: Lead[];
  niches: Niche[];
  onOpenLead: (id: string) => void;
  canPull: boolean;
  onPull: (niche: string, city: string, max: number) => Promise<string>;
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
      {canPull && <PullPanel niches={niches} onPull={onPull} />}
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
