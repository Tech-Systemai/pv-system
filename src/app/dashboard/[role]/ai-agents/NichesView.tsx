'use client';

import { useState } from 'react';
import { checkEmail, nicheChannel, personalize } from '@/lib/aiAgents/pipeline';
import type { ChannelMode, Lead, Niche, Outreach } from '@/lib/aiAgents/types';
import { ChannelChip } from './LeadDrawer';

const SAMPLE_LEAD = { business_name: 'Rivera Plumbing', owner_name: 'Mike Rivera', city: 'Tampa' };
const SAMPLE_SENDER = { name: 'Hamed', address: '100 Main St, Suite 200, Tampa, FL 33602' };

/** Compliance problems in the template itself (sender details are filled at send time). */
function templateIssues(n: Niche) {
  const fill = (t: string) => personalize(t, SAMPLE_LEAD, { name: n.name, ghl_url: n.ghl_url || 'https://example.com' }, SAMPLE_SENDER);
  return checkEmail(fill(n.template_subject), fill(n.template_body));
}

function NicheCard({ niche, leads, outreach, canEdit, saveHint, onSave }: {
  niche: Niche; leads: Lead[]; outreach: Outreach[]; canEdit: boolean; saveHint: string;
  onSave: (n: Niche) => Promise<string | null>;
}) {
  const [d, setD] = useState<Niche>(niche);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const view = nicheChannel(niche, leads, outreach);
  const mine = leads.filter(l => l.niche === niche.key);
  const dirty = JSON.stringify(d) !== JSON.stringify(niche);
  const templateChanged = d.template_subject !== niche.template_subject || d.template_body !== niche.template_body;
  const issues = templateIssues(d);

  const save = async (patch: Partial<Niche> = {}) => {
    setBusy(true);
    setMsg('');
    // Editing an approved template takes the approval away until it is re-approved.
    const next = { ...d, ...patch, ...(templateChanged && !('template_approved' in patch) ? { template_approved: false, approved_at: null } : {}) };
    const e = await onSave(next);
    setBusy(false);
    if (e) { setMsg(e); return; }
    setD(next);
    setMsg(saveHint || 'Saved');
  };

  return (
    <div className={`nc-card${niche.active ? '' : ' off'}`}>
      <div className="nc-h">
        <div>
          <b>{niche.name}</b>
          <div className="tb-sub">{mine.length} leads · {mine.filter(l => ['qualified', 'contacted', 'replied', 'booked'].includes(l.status)).length} qualified</div>
        </div>
        <label className="nc-toggle">
          <input type="checkbox" checked={d.active} disabled={!canEdit || busy} onChange={e => { setD({ ...d, active: e.target.checked }); void save({ active: e.target.checked }); }} />
          Active
        </label>
      </div>

      <div className="nc-row">
        <span className="nc-lbl">Reach by</span>
        <div className="nc-seg">
          {(['auto', 'call', 'email'] as ChannelMode[]).map(m => (
            <button key={m} type="button" className={d.channel_mode === m ? 'on' : ''} disabled={!canEdit || busy}
              onClick={() => { setD({ ...d, channel_mode: m }); void save({ channel_mode: m }); }}>
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
        <input value={d.cities} disabled={!canEdit} onChange={e => setD({ ...d, cities: e.target.value })} placeholder="Tampa, Orlando, … (blank = default list)" />
      </div>

      <div className="nc-tpl">
        <button type="button" className="nc-tpl-h" onClick={() => setOpen(!open)}>
          <span>Email template</span>
          {niche.template_approved
            ? <span className="pv-bdg pv-bdg-green">APPROVED</span>
            : <span className="pv-bdg pv-bdg-amber">NOT APPROVED — EMAILS WON&apos;T SEND</span>}
          <span className={`ag-caret${open ? ' open' : ''}`}>›</span>
        </button>
        {open && (
          <>
            <input value={d.template_subject} disabled={!canEdit} onChange={e => setD({ ...d, template_subject: e.target.value })} />
            <textarea rows={12} value={d.template_body} disabled={!canEdit} onChange={e => setD({ ...d, template_body: e.target.value })} />
            <div className="tb-sub">
              Placeholders: {'{first_name} {business} {city} {niche} {niche_lower} {landing_page} {sender_name} {sender_address}'}.
              Agents personalise the first line per lead; the offer stays as you approved it.
            </div>
            {issues.length > 0
              ? <div className="ag-work-notes"><b>Compliance</b>{issues.join(' · ')}</div>
              : <div className="ag-ok">✓ Passes the compliance check</div>}
          </>
        )}
      </div>

      {canEdit && (
        <div className="ag-work-actions">
          {msg && <span className={msg.startsWith('Saved') || msg === saveHint ? 'ag-ok' : 'ag-err'}>{msg}</span>}
          {dirty && <button type="button" className="btn btn-sm" disabled={busy} onClick={() => save()}>Save</button>}
          {!niche.template_approved || templateChanged ? (
            <button type="button" className="btn btn-sm btn-acc" disabled={busy || issues.length > 0}
              title={issues.length ? 'Fix the compliance issues first' : 'Agents may send this template, personalised, within daily limits'}
              onClick={() => save({ template_approved: true, approved_at: new Date().toISOString() })}>
              Approve template
            </button>
          ) : (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => save({ template_approved: false, approved_at: null })}>Pause sending</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function NichesView({ niches, leads, outreach, canEdit, saveHint, onSave }: {
  niches: Niche[];
  leads: Lead[];
  outreach: Outreach[];
  canEdit: boolean;
  saveHint: string;
  onSave: (n: Niche) => Promise<string | null>;
}) {
  return (
    <div className="tb-wrap">
      <div className="tb-sub" style={{ marginBottom: 12 }}>
        Each niche gets its own leads, contact method, GoHighLevel page and email template. Leave &quot;Reach by&quot; on
        Auto-identify and Research decides per lead, learning from what gets replies; lock it if you already know.
      </div>
      <div className="nc-grid">
        {niches.map(n => <NicheCard key={n.key} niche={n} leads={leads} outreach={outreach} canEdit={canEdit} saveHint={saveHint} onSave={onSave} />)}
      </div>
    </div>
  );
}
