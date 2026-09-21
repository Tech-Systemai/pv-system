'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { LIVE_AGENTS } from '@/lib/aiAgents/org';
import type { Activity, Agent, Routine } from '@/lib/aiAgents/types';
import type { Bubble } from './BuildingView';
import TaskBar, { type TaskResult } from './TaskBar';
import RoutinesPanel from './RoutinesPanel';

// The floor itself is WebGL, so it is only loaded in the browser.
const Office3D = dynamic(() => import('./Office3D'), {
  ssr: false,
  loading: () => <div className="o3-stage o3-loading">Opening the office…</div>,
});

const isBusy = (a: Activity | 'offline') => a === 'working' || a === 'reviewing' || a === 'revising';

const RUNS = [
  { key: 'topup' as const, label: 'Find more leads' },
  { key: 'research' as const, label: 'Research them' },
  { key: 'write' as const, label: 'Write emails' },
  { key: 'send' as const, label: 'Send approved' },
];

export default function OfficeView({
  agents, activityOf, taskOf, selectedId, onSelect, canManage, onSetOffice, onRun, onTask, bubbles,
  routines, onSaveRoutine, onRunRoutine, onDeleteRoutine,
}: {
  agents: Agent[];
  activityOf: (id: string) => Activity | 'offline';
  taskOf: (id: string) => string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  canManage: boolean;
  onSetOffice: (agent: Agent, inOffice: boolean) => void;
  onRun: (what: 'topup' | 'research' | 'write' | 'send') => Promise<string>;
  onTask: (text: string) => Promise<TaskResult>;
  bubbles: Bubble[];
  routines: Routine[];
  onSaveRoutine: (r: Partial<Routine>) => Promise<string | null>;
  onRunRoutine: (id: string) => Promise<string>;
  onDeleteRoutine: (id: string) => Promise<void>;
}) {
  const [showRoutines, setShowRoutines] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [running, setRunning] = useState('');
  const [runMsg, setRunMsg] = useState('');

  const staff = useMemo(
    () => agents.filter(a => a.in_office && a.status !== 'archived').sort((a, b) => a.sort_order - b.sort_order),
    [agents],
  );
  const outside = useMemo(() => agents.filter(a => !a.in_office && a.status === 'active'), [agents]);
  const working = staff.filter(a => isBusy(activityOf(a.id))).length;

  return (
    <div className="of-wrap">
      {canManage && <TaskBar onTask={onTask} />}

      <div className="of-top">
        <span><b>{working}</b> at their desks · <b>{staff.length - working}</b> free · <b>{staff.length}</b> in the office</span>
        {canManage && (
          <div className="of-actions">
            {RUNS.map(b => (
              <button key={b.key} type="button" className="btn btn-sm" disabled={!!running}
                onClick={async () => { setRunning(b.key); setRunMsg(''); setRunMsg(await onRun(b.key)); setRunning(''); }}>
                {running === b.key ? <><span className="spin" />Working…</> : b.label}
              </button>
            ))}
            <button type="button" className="btn btn-sm" onClick={() => setShowRoutines(!showRoutines)}>{showRoutines ? 'Close routines' : 'Routines'}</button>
            <button type="button" className="btn btn-sm" onClick={() => setHiring(!hiring)}>{hiring ? 'Close' : 'Bring someone in…'}</button>
          </div>
        )}
      </div>
      {runMsg && <div className="up-await">{runMsg}</div>}

      {showRoutines && (
        <RoutinesPanel routines={routines} canEdit={canManage} onSave={onSaveRoutine} onRun={onRunRoutine} onDelete={onDeleteRoutine} />
      )}

      {hiring && (
        <div className="of-hire">
          <span className="tb-sub">Pick who joins the office floor. Live agents are already in; the rest sit idle until we build them.</span>
          <div className="of-hire-list">
            {outside.map(a => (
              <button key={a.id} type="button" className="ag-chip-btn" onClick={() => onSetOffice(a, true)}>
                + {a.name} <em>{a.title}</em>{LIVE_AGENTS[a.slug ?? ''] ? ' · live' : ''}
              </button>
            ))}
            {outside.length === 0 && <span className="tb-sub">Everyone is already in the office.</span>}
          </div>
        </div>
      )}

      <div className="of-room">
        <Office3D
          agents={agents}
          activityOf={activityOf}
          taskOf={taskOf}
          selectedId={selectedId}
          onSelect={onSelect}
          bubbles={bubbles}
        />
        <span className="o3-hint">Drag to look around · scroll to zoom · click an agent to talk to them</span>
        {staff.length === 0 && <div className="of-empty">Nobody is in the office yet. Use “Bring someone in”.</div>}
      </div>
    </div>
  );
}
