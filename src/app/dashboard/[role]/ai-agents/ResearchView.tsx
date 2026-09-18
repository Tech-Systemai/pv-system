'use client';

import { useState } from 'react';
import { QUALIFY_AT, nicheChannel } from '@/lib/aiAgents/pipeline';
import { ACTIVITY_META, type Activity, type Agent, type Lead, type Niche, type Outreach } from '@/lib/aiAgents/types';
import { ChannelChip, ScoreBar } from './LeadDrawer';
import { timeAgo } from './LiveFeed';

const BASIS_LABEL = { locked: 'Locked', results: 'From results', research: 'From research', trade: 'Trade default' } as const;

export default function ResearchView({ agents, leads, outreach, niches, activityOf, taskOf, onOpenLead, onOpenAgent, onOpenNiches, canResearch, onResearch }: {
  agents: Agent[];
  leads: Lead[];
  outreach: Outreach[];
  niches: Niche[];
  activityOf: (id: string) => Activity | 'offline';
  taskOf: (id: string) => string;
  onOpenLead: (id: string) => void;
  onOpenAgent: (id: string) => void;
  onOpenNiches: () => void;
  canResearch: boolean;
  onResearch: () => Promise<string>;
}) {
  const [show, setShow] = useState<'qualified' | 'passed'>('qualified');
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState('');
  const run = async () => {
    setRunning(true);
    setRunMsg('');
    setRunMsg(await onResearch());
    setRunning(false);
  };
  const team = agents.filter(a => a.department === 'research').sort((a, b) => (a.tier === 'manager' ? -1 : b.tier === 'manager' ? 1 : a.sort_order - b.sort_order));
  const researched = leads.filter(l => l.researched_at).sort((a, b) => (b.researched_at ?? '').localeCompare(a.researched_at ?? ''));
  const qualified = researched.filter(l => (l.wtp_score ?? 0) >= QUALIFY_AT);
  const passed = researched.filter(l => (l.wtp_score ?? 0) < QUALIFY_AT);
  const waiting = leads.filter(l => l.status === 'new').length;
  const list = show === 'qualified' ? qualified : passed;

  return (
    <div className="tb-wrap">
      <div className="rs-team">
        {team.map(a => {
          const act = activityOf(a.id);
          const done = researched.filter(l => l.researched_by === a.id).length;
          return (
            <button key={a.id} type="button" className="rs-agent" onClick={() => onOpenAgent(a.id)}>
              <span className="rs-av" style={{ borderColor: ACTIVITY_META[act].color }}>{a.name[0]}</span>
              <span className="rs-agent-t">
                <b>{a.name} <em>{a.title}</em></b>
                <span>{taskOf(a.id) || ACTIVITY_META[act].label}</span>
                {done > 0 && <small>{done} leads researched</small>}
              </span>
            </button>
          );
        })}
        <div className="rs-stat">
          <b>{waiting}</b><span>waiting for research</span>
          {canResearch && waiting > 0 && (
            <button type="button" className="btn btn-acc btn-sm" style={{ marginTop: 6 }} disabled={running} onClick={run}>
              {running ? <><span className="spin" />Researching…</> : 'Research next 5'}
            </button>
          )}
        </div>
        <div className="rs-stat"><b>{researched.length ? Math.round((qualified.length / researched.length) * 100) : 0}%</b><span>qualify rate</span></div>
      </div>

      {runMsg && <div className="up-await">{runMsg}</div>}

      <div className="card tb-card">
        <div className="rs-h">
          <div>
            <div className="card-title">Call or email — by niche</div>
            <div className="tb-sub">What Research has identified for each niche, and what it rests on. Results from real outreach outweigh the trade default once there are 10+ attempts per channel.</div>
          </div>
          <button type="button" className="btn btn-sm" onClick={onOpenNiches}>Lock a niche…</button>
        </div>
        <div className="tb-scroll">
          <table className="tbl">
            <thead><tr><th>Niche</th><th>Reach by</th><th>Based on</th><th>Research split</th><th>Results so far</th></tr></thead>
            <tbody>
              {niches.filter(n => n.active).map(n => {
                const v = nicheChannel(n, leads, outreach);
                const total = v.split.call + v.split.email;
                return (
                  <tr key={n.key}>
                    <td><b>{n.name}</b></td>
                    <td><ChannelChip channel={v.channel} /></td>
                    <td><span className={`rs-basis rs-basis-${v.basis}`}>{BASIS_LABEL[v.basis]}</span><div className="tb-sub">{v.detail}</div></td>
                    <td>
                      {total === 0 ? <span className="tb-sub">No leads researched</span> : (
                        <span className="rs-split" title={`${v.split.call} call · ${v.split.email} email`}>
                          <span className="rs-split-call" style={{ width: `${(v.split.call / total) * 100}%` }} />
                          <span className="rs-split-email" style={{ width: `${(v.split.email / total) * 100}%` }} />
                          <small>📞 {v.split.call} · ✉ {v.split.email}</small>
                        </span>
                      )}
                    </td>
                    <td className="tb-sub">
                      📞 {v.stats.call.positive}/{v.stats.call.attempts} · ✉ {v.stats.email.positive}/{v.stats.email.attempts}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tb-card">
        <div className="rs-h">
          <div className="ag-filters">
            <button type="button" className={show === 'qualified' ? 'on' : ''} onClick={() => setShow('qualified')}>Qualified ({qualified.length})</button>
            <button type="button" className={show === 'passed' ? 'on' : ''} onClick={() => setShow('passed')}>Passed on ({passed.length})</button>
          </div>
          <span className="tb-sub">Qualifies at {QUALIFY_AT}+ willingness to pay</span>
        </div>
        {list.length === 0 ? <div className="empty">Nothing researched yet.</div> : (
          <div className="rs-list">
            {list.slice(0, 40).map(l => (
              <button key={l.id} type="button" className="rs-lead" onClick={() => onOpenLead(l.id)}>
                <span className="rs-lead-h">
                  <b>{l.business_name}</b>
                  <span className="tb-sub">{niches.find(n => n.key === l.niche)?.name} · {l.city} · <span suppressHydrationWarning>{l.researched_at ? timeAgo(l.researched_at) : ''}</span></span>
                  {l.sim && <span className="ag-sample">sample</span>}
                </span>
                <span className="rs-lead-row">
                  <ScoreBar score={l.wtp_score} />
                  <span className="rs-why">{l.wtp_reasons.slice(0, 2).map(r => r.text).join(' · ')}</span>
                </span>
                <span className="rs-lead-row">
                  <ChannelChip channel={l.contact_channel} confidence={l.channel_confidence} />
                  <span className="rs-why">{l.channel_reasons[0]?.text}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
