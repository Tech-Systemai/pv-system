'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { dbOp } from '@/utils/db';
import { createClient } from '@/utils/supabase/client';
import { buildLayout } from '@/lib/aiAgents/layout';
import { DEFAULT_DEPARTMENTS, previewAgents, staffingRows } from '@/lib/aiAgents/org';
import { newSimState, seedSim, simDecide, simOverlay, stepSim, type SimOverlay } from '@/lib/aiAgents/simulate';
import {
  effectiveActivity, normalizeAgent,
  type Activity, type Agent, type AgentEvent, type Department, type Run, type Work,
} from '@/lib/aiAgents/types';
import HqCanvas, { type BubbleSpec, type CanvasFocus, type PulseSpec } from './HqCanvas';
import RosterPanel from './RosterPanel';
import LiveFeed from './LiveFeed';
import AgentDetail from './AgentDetail';
import AgentEditor, { type AgentDraft } from './AgentEditor';

const SIM_KEY = 'ag-hq-sim';
const SIM_TICK_MS = 2300;
const MAX_BUBBLES = 4;

function readSavedSim(): boolean | null {
  try {
    const v = window.localStorage.getItem(SIM_KEY);
    return v === 'on' ? true : v === 'off' ? false : null;
  } catch {
    return null; // storage blocked: fall back to the default
  }
}
const noSubscribe = () => () => {};

function upsertById<T extends { id: string | number }>(list: T[], row: T): T[] {
  const i = list.findIndex(x => x.id === row.id);
  if (i < 0) return [row, ...list];
  const next = [...list];
  next[i] = row;
  return next;
}

export default function AiAgentsClient({
  initialAgents,
  initialRuns,
  initialDepartments,
  initialWork,
  initialEvents,
  schemaReady,
  canManage,
  currentUserId,
}: {
  initialAgents: Record<string, unknown>[];
  initialRuns: Run[];
  initialDepartments: Department[];
  initialWork: Work[];
  initialEvents: AgentEvent[];
  schemaReady: boolean;
  canManage: boolean;
  currentUserId: string;
}) {
  const [agents, setAgents] = useState<Agent[]>(() => initialAgents.map(normalizeAgent));
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [work, setWork] = useState<Work[]>(initialWork);
  const [events, setEvents] = useState<AgentEvent[]>(initialEvents);
  const [runs] = useState<Run[]>(initialRuns);
  // Events already on screen, so a realtime echo of our own write does not pop twice.
  const seenEvents = useRef(new Set(initialEvents.map(e => String(e.id))));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ target: CanvasFocus; nonce: number } | null>(null);
  const [pulses, setPulses] = useState<PulseSpec[]>([]);
  const [bubbles, setBubbles] = useState<BubbleSpec[]>([]);
  const [editing, setEditing] = useState<AgentDraft | null>(null);
  const [staffing, setStaffing] = useState(false);
  const [notice, setNotice] = useState('');

  // ── What the building shows: the real org, or the default org as a preview ──
  const preview = departments.length === 0 && !agents.some(a => a.tier === 'ceo');
  const shownAgents = useMemo(
    () => (preview ? [...previewAgents(), ...agents] : agents),
    [preview, agents],
  );
  const shownDepts = preview ? DEFAULT_DEPARTMENTS : departments;
  const byId = useMemo(() => Object.fromEntries(shownAgents.map(a => [a.id, a])), [shownAgents]);
  const layout = useMemo(() => buildLayout(shownAgents, shownDepts), [shownAgents, shownDepts]);

  // ── Simulation: on by default until real events start arriving ──
  const [hasRecentReal] = useState(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return initialEvents.some(e => new Date(e.created_at).getTime() > cutoff);
  });
  const savedSim = useSyncExternalStore(noSubscribe, readSavedSim, () => null);
  const [simChoice, setSimChoice] = useState<boolean | null>(null);
  const simOn = simChoice ?? savedSim ?? !hasRecentReal;
  const toggleSim = () => {
    const next = !simOn;
    setSimChoice(next);
    try { window.localStorage.setItem(SIM_KEY, next ? 'on' : 'off'); } catch { /* ignore */ }
  };

  const sim = useRef(newSimState());
  // The simulation reads the roster through a ref and only restarts when who is
  // on the floor changes, not on every realtime tick of an agent's state.
  const simAgents = useRef(shownAgents);
  useEffect(() => { simAgents.current = shownAgents; }, [shownAgents]);
  const rosterKey = shownAgents.map(a => `${a.id}:${a.status}:${a.reports_to}:${a.department}`).join('|');
  const [overlay, setOverlay] = useState<SimOverlay>({});
  const [simWork, setSimWork] = useState<Work[]>([]);
  const [simEvents, setSimEvents] = useState<AgentEvent[]>([]);

  // ── Pop a notification: a pulse through the octopus and a bubble at the desk ──
  const emit = useCallback((evs: AgentEvent[]) => {
    if (evs.length === 0) return;
    const newPulses: PulseSpec[] = [];
    const newBubbles: BubbleSpec[] = [];
    for (const e of evs) {
      if (!e.agent_id) continue;
      const id = `${e.id}`;
      if (e.kind !== 'progress' && e.kind !== 'alert') newPulses.push({ id, agentId: e.agent_id, kind: e.kind });
      newBubbles.push({ id, agentId: e.agent_id, kind: e.kind, text: e.message, sim: e.sim });
    }
    if (newPulses.length) {
      setPulses(p => [...p, ...newPulses]);
      window.setTimeout(() => setPulses(p => p.filter(x => !newPulses.includes(x))), 4200);
    }
    if (newBubbles.length) {
      setBubbles(b => {
        const next = [...b, ...newBubbles];
        // Revisions stay put; routine bubbles make room first.
        while (next.length > MAX_BUBBLES) {
          const i = next.findIndex(x => x.kind !== 'revision');
          next.splice(i >= 0 ? i : 0, 1);
        }
        return next;
      });
      for (const nb of newBubbles) {
        window.setTimeout(() => setBubbles(b => b.filter(x => x !== nb)), nb.kind === 'revision' ? 7500 : 4600);
      }
    }
  }, []);

  const pushSimEvents = useCallback((evs: AgentEvent[]) => {
    setOverlay(simOverlay(sim.current, simAgents.current));
    setSimWork([...sim.current.work]);
    if (evs.length) {
      setSimEvents(prev => [...evs.slice().reverse(), ...prev].slice(0, 120));
      emit(evs);
    }
  }, [emit]);

  useEffect(() => {
    if (!simOn) return;
    // A fresh run each time it is switched on, sized to whoever is on the floor.
    sim.current = newSimState();
    const opening = seedSim(sim.current, simAgents.current);
    setOverlay(simOverlay(sim.current, simAgents.current));
    setSimWork([...sim.current.work]);
    setSimEvents(opening);
    const id = window.setInterval(() => {
      if (document.hidden) return;
      pushSimEvents(stepSim(sim.current, simAgents.current));
    }, SIM_TICK_MS);
    return () => window.clearInterval(id);
  }, [simOn, rosterKey, pushSimEvents]);

  // ── Realtime: agent state, work and events from the runtime ──
  useEffect(() => {
    if (!schemaReady) return;
    const supabase = createClient();
    const ch = supabase
      .channel('agent-hq')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_agents' }, payload => {
        if (payload.eventType === 'DELETE') return;
        const row = normalizeAgent(payload.new as Record<string, unknown>);
        setAgents(prev => (row.status === 'archived' ? prev.filter(a => a.id !== row.id) : upsertById(prev, row)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_agent_work' }, payload => {
        if (payload.eventType === 'DELETE') return;
        setWork(prev => upsertById(prev, payload.new as Work));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_agent_events' }, payload => {
        const ev = payload.new as AgentEvent;
        if (seenEvents.current.has(String(ev.id))) return;
        seenEvents.current.add(String(ev.id));
        setEvents(prev => [ev, ...prev].slice(0, 200));
        emit([ev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [schemaReady, emit]);

  // ── Derived views ──
  const allWork = useMemo(() => (simOn ? [...work, ...simWork] : work), [simOn, work, simWork]);
  const feed = useMemo(
    () => (simOn ? [...events, ...simEvents] : events)
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 150),
    [simOn, events, simEvents],
  );

  const activityOf = useCallback((id: string): Activity | 'offline' => {
    const a = byId[id];
    if (!a) return 'idle';
    if (a.status !== 'active') return 'offline';
    if (simOn && overlay[id]) return overlay[id].activity;
    return effectiveActivity(a);
  }, [byId, simOn, overlay]);

  const taskOf = useCallback((id: string) => {
    if (simOn && overlay[id]?.task) return overlay[id].task;
    const a = byId[id];
    if (a?.current_task) return a.current_task;
    return work.find(w => w.agent_id === id && w.status === 'in_progress')?.title ?? '';
  }, [byId, simOn, overlay, work]);

  const revisionCount = useMemo(() => {
    const out: Record<string, number> = {};
    for (const w of allWork) if (w.status === 'revision') out[w.agent_id] = (out[w.agent_id] ?? 0) + 1;
    return out;
  }, [allWork]);

  const queuedCount = useMemo(() => {
    const out: Record<string, number> = {};
    for (const w of work) if (w.status === 'queued') out[w.agent_id] = (out[w.agent_id] ?? 0) + 1;
    return out;
  }, [work]);

  const hueOf = useCallback((id: string) => {
    const a = byId[id];
    if (!a) return 268;
    if (a.tier === 'ceo') return 300;
    if (a.tier === 'exec') return layout.arms.find(arm => arm.execId === id)?.dept.hue ?? 268;
    return shownDepts.find(d => d.key === a.department)?.hue ?? 250;
  }, [byId, layout, shownDepts]);

  // ── Navigation ──
  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setFocus({ target: { kind: 'agent', id }, nonce: Date.now() });
  }, []);
  const focusArm = (index: number) => setFocus({ target: { kind: 'arm', index }, nonce: Date.now() });
  const fitAll = () => setFocus({ target: { kind: 'fit' }, nonce: Date.now() });

  // ── Founder actions ──
  const logEvent = async (ev: Omit<AgentEvent, 'id' | 'created_at'>) => {
    const { data } = await dbOp('ai_agent_events', 'insert', ev);
    const row = data?.[0] as AgentEvent | undefined;
    if (row && !seenEvents.current.has(String(row.id))) {
      seenEvents.current.add(String(row.id));
      setEvents(prev => [row, ...prev]);
      emit([row]);
    }
  };

  const sendRequest = async (agentId: string, title: string, brief: string): Promise<string | null> => {
    const a = byId[agentId];
    const { data, error } = await dbOp('ai_agent_work', 'insert', {
      agent_id: agentId, title, brief, status: 'queued', requested_by: currentUserId,
    });
    if (error) return error;
    const row = data?.[0] as Work | undefined;
    if (row) setWork(prev => upsertById(prev, row));
    await logEvent({ agent_id: agentId, to_agent_id: null, work_id: row?.id ?? null, kind: 'request', message: `Founder → ${a?.name ?? 'agent'}: ${title}` });
    return null;
  };

  const decide = async (w: Work, decision: 'approve' | 'revise', notes = ''): Promise<string | null> => {
    if (w.sim) {
      pushSimEvents(simDecide(sim.current, simAgents.current, w.id, decision, notes));
      return null;
    }
    const a = byId[w.agent_id];
    const now = new Date().toISOString();
    const patch = decision === 'approve'
      ? { status: 'done', completed_at: now, updated_at: now }
      : { status: 'revision', revision_count: w.revision_count + 1, revision_notes: notes, updated_at: now };
    const { data, error } = await dbOp('ai_agent_work', 'update', patch, { id: w.id });
    if (error) return error;
    if (data?.[0]) setWork(prev => upsertById(prev, data[0] as Work));
    await logEvent(decision === 'approve'
      ? { agent_id: w.agent_id, to_agent_id: null, work_id: w.id, kind: 'done', message: `Founder approved ${a?.name ?? 'agent'}'s "${w.title}"` }
      : { agent_id: w.agent_id, to_agent_id: null, work_id: w.id, kind: 'revision', message: `Founder sent back "${w.title}" — revision #${w.revision_count + 1}${notes ? `: ${notes}` : ''}` });
    return null;
  };

  const staffBuilding = async () => {
    setStaffing(true);
    setNotice('');
    const d = await dbOp('ai_departments', 'upsert', DEFAULT_DEPARTMENTS);
    if (d.error) { setNotice(d.error); setStaffing(false); return; }
    const a = await dbOp('ai_agents', 'insert', staffingRows(currentUserId));
    if (a.error) { setNotice(a.error); setStaffing(false); return; }
    setDepartments((d.data as Department[]) ?? DEFAULT_DEPARTMENTS);
    setAgents(prev => [...prev, ...((a.data ?? []) as Record<string, unknown>[]).map(normalizeAgent)]);
    setSelectedId(null);
    setStaffing(false);
    setNotice('The building is staffed. Every agent now has a real desk you can send requests to.');
  };

  const saveAgent = async (draft: AgentDraft): Promise<string | null> => {
    const payload = {
      name: draft.name.trim(), title: draft.title.trim(), tier: draft.tier, department: draft.department,
      reports_to: draft.reports_to || null, purpose: draft.purpose.trim(), channel: draft.channel,
      status: draft.status, model: draft.model.trim(), system_prompt: draft.system_prompt.trim(),
    };
    if (!draft.id) {
      const { data, error } = await dbOp('ai_agents', 'insert', { ...payload, created_by: currentUserId, sort_order: agents.length });
      if (error) return error;
      if (data?.[0]) setAgents(prev => upsertById(prev, normalizeAgent(data[0])));
    } else {
      const { data, error } = await dbOp('ai_agents', 'update', { ...payload, updated_at: new Date().toISOString() }, { id: draft.id });
      if (error) return error;
      if (data?.[0]) setAgents(prev => upsertById(prev, normalizeAgent(data[0])));
    }
    setEditing(null);
    return null;
  };

  const setStatus = async (a: Agent, status: 'active' | 'paused' | 'archived') => {
    const before = a.status;
    setAgents(prev => (status === 'archived' ? prev.filter(x => x.id !== a.id) : prev.map(x => (x.id === a.id ? { ...x, status } : x))));
    if (status === 'archived') setSelectedId(null);
    const { error } = await dbOp('ai_agents', 'update', { status, updated_at: new Date().toISOString() }, { id: a.id });
    // Roll back the optimistic change if the write did not land.
    if (error) setAgents(prev => (status === 'archived' ? [...prev, a] : prev.map(x => (x.id === a.id ? { ...x, status: before } : x))));
  };

  const selected = selectedId ? byId[selectedId] : null;
  const canWrite = canManage && !preview && schemaReady;

  return (
    <div className="page-fade ag-page">
      {!schemaReady && (
        <div className="ag-banner">
          <span>
            Run <code>supabase/schema_v91_agent_hq.sql</code> in the Supabase SQL Editor to switch on the org chart,
            requests and live feed. Until then this is a preview of the default org.
          </span>
        </div>
      )}
      {schemaReady && preview && canManage && (
        <div className="ag-banner ag-banner-acc">
          <span>This is the default Octopus Engines org, previewed. Staff the building to give every agent a real desk.</span>
          <button className="btn btn-acc btn-sm" onClick={staffBuilding} disabled={staffing}>
            {staffing ? <><span className="spin" />Staffing…</> : 'Staff the building'}
          </button>
        </div>
      )}
      {notice && <div className="ag-banner" onClick={() => setNotice('')}>{notice}</div>}

      <div className="ag-hq">
        <RosterPanel
          agents={shownAgents}
          departments={shownDepts}
          layout={layout}
          activityOf={activityOf}
          taskOf={taskOf}
          revisionCount={revisionCount}
          selectedId={selectedId}
          onSelect={select}
          onFocusArm={focusArm}
          onFitAll={fitAll}
          canCreate={canWrite}
          onCreate={() => setEditing({
            name: '', title: '', tier: 'specialist', department: shownDepts[0]?.key ?? '', reports_to: '',
            purpose: '', channel: 'other', status: 'active', model: '', system_prompt: '',
          })}
        />

        <HqCanvas
          layout={layout}
          agents={byId}
          hueOf={hueOf}
          activityOf={activityOf}
          taskOf={taskOf}
          revisionCount={revisionCount}
          queuedCount={queuedCount}
          selectedId={selectedId}
          onSelect={select}
          focus={focus}
          pulses={pulses}
          bubbles={bubbles}
          simOn={simOn}
          simAvailable
          onToggleSim={toggleSim}
          preview={preview}
        />

        <div className="ag-side">
          {selected ? (
            <AgentDetail
              key={selected.id}
              agent={selected}
              byId={byId}
              departments={shownDepts}
              activity={activityOf(selected.id)}
              task={taskOf(selected.id)}
              work={allWork.filter(w => w.agent_id === selected.id)}
              events={feed.filter(e => e.agent_id === selected.id || e.to_agent_id === selected.id).slice(0, 25)}
              runs={runs.filter(r => r.agent_id === selected.id)}
              reports={shownAgents.filter(a => a.reports_to === selected.id)}
              canRequest={canWrite}
              canManage={canWrite}
              onSelect={select}
              onClose={() => { setSelectedId(null); fitAll(); }}
              onRequest={sendRequest}
              onDecide={decide}
              onEdit={() => setEditing({
                id: selected.id, name: selected.name, title: selected.title, tier: selected.tier,
                department: selected.department, reports_to: selected.reports_to ?? '', purpose: selected.purpose,
                channel: selected.channel, status: selected.status, model: selected.model, system_prompt: selected.system_prompt,
              })}
              onSetStatus={s => setStatus(selected, s)}
            />
          ) : (
            <LiveFeed events={feed} byId={byId} onSelect={select} />
          )}
        </div>
      </div>

      {editing && (
        <AgentEditor
          draft={editing}
          agents={agents}
          departments={departments}
          onCancel={() => setEditing(null)}
          onSave={saveAgent}
        />
      )}
    </div>
  );
}
