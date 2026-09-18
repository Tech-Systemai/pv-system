'use client';

import { useState } from 'react';
import { nicheChannel } from '@/lib/aiAgents/pipeline';
import type { ChannelMode, Lead, Niche, Outreach } from '@/lib/aiAgents/types';
import { ChannelChip } from './LeadDrawer';

function NicheCard({ niche, leads, outreach, canEdit, onSave }: {
  niche: Niche; leads: Lead[]; outreach: Outreach[]; canEdit: boolean;
  onSave: (n: Niche) => Promise<string | null>;
}) {
  const [d, setD] = useState<Niche>(niche);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const view = nicheChannel(niche, leads, outreach);
  const mine = leads.filter(l => l.niche === niche.key);
  const dirty = d.ghl_url !== niche.ghl_url || d.cities !== niche.cities;

  const save = async (patch: Partial<Niche> = {}) => {
    const next = { ...d, ...patch };
    setD(next);
    setBusy(true);
    setMsg('');
    const e = await onSave(next);
    setBusy(false);
    setMsg(e ?? 'Saved');
  };

  return (
    <div className={`nc-card${niche.active ? '' : ' off'}`}>
      <div className="nc-h">
        <div>
          <b>{niche.name}</b>
          <div className="tb-sub">{mine.length} leads · {mine.filter(l => ['qualified', 'contacted', 'replied', 'booked'].includes(l.status)).length} qualified</div>
        </div>
        <label className="nc-toggle">
          <input type="checkbox" checked={d.active} disabled={!canEdit || busy} onChange={e => save({ active: e.target.checked })} />
          Active
        </label>
      </div>

      <div className="nc-row">
        <span className="nc-lbl">Reach by</span>
        <div className="nc-seg">
          {(['auto', 'call', 'email'] as ChannelMode[]).map(m => (
            <button key={m} type="button" className={d.channel_mode === m ? 'on' : ''} disabled={!canEdit || busy} onClick={() => save({ channel_mode: m })}>
              {m === 'auto' ? 'Auto-identify' : m === 'call' ? '📞 Always call' : '✉ Always email'}
            </button>
          ))}
        </div>
      </div>
      <div className="nc-now">
        <ChannelChip channel={view.channel} />
        <span className="tb-sub">{view.detail}</span>
      </div>

      <div className="nc-row">
        <span className="nc-lbl">GHL page</span>
        <input value={d.ghl_url} disabled={!canEdit} onChange={e => setD({ ...d, ghl_url: e.target.value })} placeholder="https://… your GoHighLevel landing page" />
      </div>
      <div className="nc-row">
        <span className="nc-lbl">Cities</span>
        <input value={d.cities} disabled={!canEdit} onChange={e => setD({ ...d, cities: e.target.value })} placeholder="Tampa, FL; Orlando, FL — suggested when you pull leads" />
      </div>

      {canEdit && (dirty || msg) && (
        <div className="ag-work-actions">
          {msg && <span className={msg === 'Saved' ? 'ag-ok' : 'ag-err'}>{msg}</span>}
          {dirty && <button type="button" className="btn btn-sm btn-acc" disabled={busy} onClick={() => save()}>Save</button>}
        </div>
      )}
    </div>
  );
}

export default function NichesView({ niches, leads, outreach, canEdit, onSave }: {
  niches: Niche[];
  leads: Lead[];
  outreach: Outreach[];
  canEdit: boolean;
  onSave: (n: Niche) => Promise<string | null>;
}) {
  return (
    <div className="tb-wrap">
      <div className="tb-sub" style={{ marginBottom: 12 }}>
        Each niche has its own leads, contact method and GoHighLevel page. Leave &quot;Reach by&quot; on Auto-identify and
        Research decides call or email per lead, learning from what gets replies; lock it if you already know.
      </div>
      <div className="nc-grid">
        {niches.map(n => <NicheCard key={n.key} niche={n} leads={leads} outreach={outreach} canEdit={canEdit} onSave={onSave} />)}
      </div>
    </div>
  );
}
