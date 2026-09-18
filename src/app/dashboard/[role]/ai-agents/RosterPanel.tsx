'use client';

import { useMemo, useState } from 'react';
import type { HqLayout } from '@/lib/aiAgents/layout';
import { ACTIVITY_META, type Activity, type Agent, type Department } from '@/lib/aiAgents/types';
import { roleTag } from './HqCanvas';

type Props = {
  agents: Agent[];
  departments: Department[];
  layout: HqLayout;
  activityOf: (id: string) => Activity | 'offline';
  taskOf: (id: string) => string;
  revisionCount: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFocusArm: (index: number) => void;
  onFitAll: () => void;
  canCreate: boolean;
  onCreate: () => void;
};

export default function RosterPanel({
  agents, departments, layout, activityOf, taskOf, revisionCount,
  selectedId, onSelect, onFocusArm, onFitAll, canCreate, onCreate,
}: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => {
    const c = { working: 0, reviewing: 0, revising: 0, blocked: 0, idle: 0, offline: 0 };
    for (const a of agents) c[activityOf(a.id)] += 1;
    return c;
  }, [agents, activityOf]);
  const openRevisions = Object.values(revisionCount).reduce((s, n) => s + n, 0);

  const match = (a: Agent) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [a.name, a.title, taskOf(a.id)].some(x => x.toLowerCase().includes(s));
  };

  const ceo = agents.find(a => a.id === layout.ceoId);
  const execs = layout.execs.map(e => agents.find(a => a.id === e.id)).filter((a): a is Agent => !!a);
  const lobby = layout.lobby.map(l => agents.find(a => a.id === l.id)).filter((a): a is Agent => !!a);

  const row = (a: Agent, lead = false) => {
    if (!match(a)) return null;
    const act = activityOf(a.id);
    const task = taskOf(a.id);
    const revs = revisionCount[a.id] ?? 0;
    return (
      <button
        key={a.id}
        type="button"
        className={`ag-row${selectedId === a.id ? ' sel' : ''}${lead ? ' lead' : ''}`}
        onClick={() => onSelect(a.id)}
      >
        <i className={`ag-dot ag-dot-${act}`} style={{ background: ACTIVITY_META[act].color }} />
        <span className="ag-row-main">
          <span className="ag-row-name">
            {a.name}
            <em>{a.tier === 'ceo' || a.tier === 'exec' ? roleTag(a) : a.title}</em>
          </span>
          <span className="ag-row-task">{task || ACTIVITY_META[act].label}</span>
        </span>
        {revs > 0 && <span className="ag-rev-pill" title={`${revs} in revision`}>↺ {revs}</span>}
      </button>
    );
  };

  return (
    <aside className="ag-roster">
      <div className="ag-roster-head">
        <div className="ag-roster-title">
          <span>Team overview</span>
          <button type="button" className="ag-link" onClick={onFitAll}>Whole building</button>
        </div>
        <div className="ag-kpis">
          <div><b style={{ color: ACTIVITY_META.working.color }}>{counts.working}</b><span>Working</span></div>
          <div><b style={{ color: ACTIVITY_META.reviewing.color }}>{counts.reviewing}</b><span>Reviewing</span></div>
          <div className={openRevisions ? 'hot' : ''}><b style={{ color: ACTIVITY_META.revising.color }}>{openRevisions}</b><span>Revisions</span></div>
          <div><b>{counts.idle + counts.offline}</b><span>Idle</span></div>
        </div>
        {counts.blocked > 0 && <div className="ag-blocked">⚠ {counts.blocked} agent{counts.blocked === 1 ? '' : 's'} blocked</div>}
        <input className="ag-search" placeholder="Find an agent or task…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="ag-roster-body">
        <div className="ag-group-lbl">Leadership</div>
        {ceo && row(ceo, true)}
        {execs.map(a => row(a, true))}

        <div className="ag-group-lbl">Departments</div>
        {layout.arms.map(arm => {
          const members = arm.suckers.filter(s => s.agentId).map(s => agents.find(a => a.id === s.agentId)).filter((a): a is Agent => !!a);
          const busy = members.filter(m => { const x = activityOf(m.id); return x !== 'idle' && x !== 'offline'; }).length;
          const exec = arm.execId ? agents.find(a => a.id === arm.execId) : undefined;
          const isOpen = open[arm.dept.key] ?? (!!q.trim() || members.some(m => m.id === selectedId));
          const shown = members.filter(match);
          if (q.trim() && shown.length === 0) return null;
          return (
            <div key={arm.dept.key} className="ag-dept">
              <button
                type="button"
                className="ag-dept-h"
                onClick={() => { setOpen(o => ({ ...o, [arm.dept.key]: !isOpen })); onFocusArm(arm.index); }}
              >
                <i style={{ background: `hsl(${arm.dept.hue} 80% 62%)` }} />
                <span className="ag-dept-name">{arm.dept.name}</span>
                {exec && <em>{roleTag(exec)}</em>}
                <span className="ag-dept-bar"><span style={{ width: `${members.length ? (busy / members.length) * 100 : 0}%` }} /></span>
                <span className="ag-dept-n">{busy}/{members.length}</span>
                <span className={`ag-caret${isOpen ? ' open' : ''}`}>›</span>
              </button>
              {isOpen && <div className="ag-dept-rows">{shown.map(a => row(a))}</div>}
            </div>
          );
        })}
        {departments.length === 0 && <div className="ag-empty">No departments yet.</div>}

        {lobby.length > 0 && (
          <>
            <div className="ag-group-lbl">Unassigned</div>
            {lobby.map(a => row(a))}
          </>
        )}
      </div>

      {canCreate && (
        <div className="ag-roster-foot">
          <button type="button" className="btn btn-acc btn-sm" style={{ width: '100%' }} onClick={onCreate}>+ Hire an agent</button>
        </div>
      )}
    </aside>
  );
}
