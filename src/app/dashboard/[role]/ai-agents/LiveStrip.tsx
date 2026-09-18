'use client';

import { DEFAULT_AGENTS, LIVE_AGENTS, NEXT_UP } from '@/lib/aiAgents/org';
import { ACTIVITY_META, type Activity, type Agent } from '@/lib/aiAgents/types';

/** Which agents run on real APIs today, what each one does, and what is next. */
export default function LiveStrip({ agents, activityOf, taskOf, onOpen }: {
  agents: Agent[];
  activityOf: (id: string) => Activity | 'offline';
  taskOf: (id: string) => string;
  onOpen: (id: string) => void;
}) {
  const bySlug = Object.fromEntries(agents.filter(a => a.slug).map(a => [a.slug!, a]));
  const live = Object.keys(LIVE_AGENTS).map(s => bySlug[s]).filter((a): a is Agent => !!a);
  const next = Object.keys(NEXT_UP).map(s => ({ slug: s, a: bySlug[s], title: DEFAULT_AGENTS.find(d => d.slug === s)?.title ?? s }));

  return (
    <div className="lv-wrap">
      <div className="lv-col">
        <div className="lv-h"><span className="lv-dot" />Live now <small>{live.length} of {agents.length} agents run on real APIs</small></div>
        <div className="lv-list">
          {live.map(a => {
            const act = activityOf(a.id);
            const task = taskOf(a.id);
            return (
              <button key={a.id} type="button" className="lv-agent" onClick={() => onOpen(a.id)}>
                <span className="lv-name"><i style={{ background: ACTIVITY_META[act].color }} />{a.name} <em>{a.title}</em></span>
                <span className="lv-duty">{LIVE_AGENTS[a.slug!]}</span>
                <span className="lv-now">{task ? `Now: ${task}` : ACTIVITY_META[act].label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="lv-col lv-next">
        <div className="lv-h">Coming next</div>
        {next.map(n => (
          <div key={n.slug} className="lv-agent lv-agent-next">
            <span className="lv-name">{n.a?.name ?? n.slug} <em>{n.title}</em></span>
            <span className="lv-duty">{NEXT_UP[n.slug].replace(/^Next: /, '')}</span>
          </div>
        ))}
        <div className="tb-sub">Everyone else on the floor plan is planned and idle until we build them.</div>
      </div>
    </div>
  );
}
