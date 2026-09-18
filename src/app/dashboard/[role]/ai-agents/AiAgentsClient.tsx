'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { dbOp } from '@/utils/db';
import { createClient } from '@/utils/supabase/client';
import { DEFAULT_DEPARTMENTS, DEFAULT_NICHES, RETIRED_DEPTS, RETIRED_SLUGS, previewAgents, staffingRows } from '@/lib/aiAgents/org';
import { newSimState, seedSim, simDecide, simOverlay, stepSim, type SimOverlay } from '@/lib/aiAgents/simulate';
import { newPipeState, pipelineOverlay, seedPipeline, simLogCall, stepPipeline } from '@/lib/aiAgents/simPipeline';
import {
  effectiveActivity, normalizeAgent,
  type Activity, type Agent, type AgentEvent, type Department, type EventKind, type Lead, type Niche,
  type Outreach, type OutreachStatus, type Run, type Work,
} from '@/lib/aiAgents/types';
import BuildingView, { type Bubble } from './BuildingView';
import UpdatesView from './UpdatesView';
import LeadsView from './LeadsView';
import ResearchView from './ResearchView';
import OutreachView from './OutreachView';
import NichesView from './NichesView';
import LeadDrawer from './LeadDrawer';
import AgentDetail from './AgentDetail';
import AgentEditor, { type AgentDraft } from './AgentEditor';
import SetupChecklist, { type Integrations } from './SetupChecklist';

type Tab = 'building' | 'updates' | 'leads' | 'research' | 'outreach' | 'niches';

const TABS: { key: Tab; label: string }[] = [
  { key: 'building', label: 'Simulation' },
  { key: 'updates', label: 'Updates' },
  { key: 'leads', label: 'Leads' },
  { key: 'research', label: 'Research' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'niches', label: 'Niches' },
];

const SIM_KEY = 'ag-hq-sim';
const SIM_TICK_MS = 1600;
const MAX_BUBBLES = 5;

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
  initialAgents, initialRuns, initialDepartments, initialWork, initialEvents,
  initialNiches, initialLeads, initialOutreach,
  schemaReady, pipelineReady, integrations, canManage, currentUserId,
}: {
  initialAgents: Record<string, unknown>[];
  initialRuns: Run[];
  initialDepartments: Department[];
  initialWork: Work[];
  initialEvents: AgentEvent[];
  initialNiches: Niche[];
  initialLeads: Lead[];
  initialOutreach: Outreach[];
  schemaReady: boolean;
  pipelineReady: boolean;
  integrations: Integrations;
  canManage: boolean;
  currentUserId: string;
}) {
  const [tab, setTab] = useState<Tab>('building');
  const [agents, setAgents] = useState<Agent[]>(() => initialAgents.map(normalizeAgent));
  const [departments] = useState<Department[]>(initialDepartments);
  const [work, setWork] = useState<Work[]>(initialWork);
  const [events, setEvents] = useState<AgentEvent[]>(initialEvents);
  const [runs] = useState<Run[]>(initialRuns);
  const [niches, setNiches] = useState<Niche[]>(() => (initialNiches.length ? initialNiches : DEFAULT_NICHES));
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [outreach, setOutreach] = useState<Outreach[]>(initialOutreach);
  const seenEvents = useRef(new Set(initialEvents.map(e => String(e.id))));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [elevator, setElevator] = useState<{ floor: number; kind: EventKind | null }>({ floor: 0, kind: null });
  const [editing, setEditing] = useState<AgentDraft | null>(null);
  const [staffing, setStaffing] = useState(false);
  const [notice, setNotice] = useState('');

  // ── The org on show: the real floor plan once staffed, the default one before ──
  const staffed = DEFAULT_DEPARTMENTS.every(d => departments.some(x => x.key === d.key)) && agents.some(a => a.tier === 'ceo');
  const preview = !staffed;
  const shownAgents = useMemo(() => (preview ? previewAgents() : agents), [preview, agents]);
  const shownDepts = useMemo(
    () => (preview ? DEFAULT_DEPARTMENTS : [...departments].sort((a, b) => a.arm_order - b.arm_order)),
    [preview, departments],
  );
  const byId = useMemo(() => Object.fromEntries(shownAgents.map(a => [a.id, a])), [shownAgents]);
  const floorOf = useCallback((agentId: string | null) => {
    const d = agentId ? byId[agentId]?.department : undefined;
    return Math.max(0, shownDepts.findIndex(x => x.key === d));
  }, [byId, shownDepts]);

  // ── Simulation: on by default until real activity arrives ──
  const [hasRecentReal] = useState(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return initialEvents.some(e => new Date(e.created_at).getTime() > cutoff) || initialLeads.length > 0;
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
  const pipe = useRef(newPipeState());
  const simAgents = useRef(shownAgents);
  const simNiches = useRef(niches);
  useEffect(() => { simAgents.current = shownAgents; }, [shownAgents]);
  useEffect(() => { simNiches.current = niches; }, [niches]);
  const rosterKey = shownAgents.map(a => `${a.id}:${a.status}:${a.reports_to}:${a.department}`).join('|');

  const [overlay, setOverlay] = useState<SimOverlay>({});
  const [simWork, setSimWork] = useState<Work[]>([]);
  const [simEvents, setSimEvents] = useState<AgentEvent[]>([]);
  const [simLeads, setSimLeads] = useState<Lead[]>([]);
  const [simOutreach, setSimOutreach] = useState<Outreach[]>([]);

  // ── Pop a notification at the desk and send the elevator to its floor ──
  const emit = useCallback((evs: AgentEvent[]) => {
    const withAgent = evs.filter(e => e.agent_id);
    if (!withAgent.length) return;
    const nb: Bubble[] = withAgent.map(e => ({ id: String(e.id), agentId: e.agent_id!, kind: e.kind, text: e.message, sim: e.sim }));
    setBubbles(b => {
      const next = [...b, ...nb];
      while (next.length > MAX_BUBBLES) {
        const i = next.findIndex(x => x.kind !== 'revision');
        next.splice(i >= 0 ? i : 0, 1);
      }
      return next;
    });
    for (const b of nb) window.setTimeout(() => setBubbles(x => x.filter(y => y !== b)), b.kind === 'revision' ? 7500 : 4200);
    const last = withAgent[withAgent.length - 1];
    if (last.kind !== 'progress') setElevator({ floor: floorOf(last.agent_id), kind: last.kind });
  }, [floorOf]);

  const syncSim = useCallback(() => {
    const busy = pipelineOverlay(pipe.current);
    const base = simOverlay(sim.current, simAgents.current);
    for (const [id, task] of Object.entries(busy)) base[id] = { activity: 'working', task };
    setOverlay(base);
    setSimWork([...sim.current.work]);
    setSimLeads([...pipe.current.leads]);
    setSimOutreach([...pipe.current.outreach]);
  }, []);

  const pushSimEvents = useCallback((evs: AgentEvent[]) => {
    syncSim();
    if (evs.length) {
      setSimEvents(prev => [...evs.slice().reverse(), ...prev].slice(0, 200));
      emit(evs);
    }
  }, [syncSim, emit]);

  useEffect(() => {
    if (!simOn) return;
    sim.current = newSimState();
    pipe.current = newPipeState();
    const opening = seedSim(sim.current, simAgents.current);
    seedPipeline(pipe.current, simAgents.current, simNiches.current);
    syncSim();
    setSimEvents(opening);
    let odd = false;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      odd = !odd;
      // Alternate agent work and the lead pipeline so both keep moving.
      pushSimEvents(odd
        ? stepPipeline(pipe.current, simAgents.current, simNiches.current)
        : stepSim(sim.current, simAgents.current));
    }, SIM_TICK_MS);
    return () => window.clearInterval(id);
  }, [simOn, rosterKey, pushSimEvents, syncSim]);

  // ── Realtime from the agent runtime ──
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
        if (payload.eventType !== 'DELETE') setWork(prev => upsertById(prev, payload.new as Work));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_agent_events' }, payload => {
        const ev = payload.new as AgentEvent;
        if (seenEvents.current.has(String(ev.id))) return;
        seenEvents.current.add(String(ev.id));
        setEvents(prev => [ev, ...prev].slice(0, 300));
        emit([ev]);
      });
    if (pipelineReady) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'ai_leads' }, payload => {
        if (payload.eventType !== 'DELETE') setLeads(prev => upsertById(prev, payload.new as Lead));
      }).on('postgres_changes', { event: '*', schema: 'public', table: 'ai_outreach' }, payload => {
        if (payload.eventType !== 'DELETE') setOutreach(prev => upsertById(prev, payload.new as Outreach));
      });
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [schemaReady, pipelineReady, emit]);

  // ── Derived views ──
  const allWork = useMemo(() => (simOn ? [...work, ...simWork] : work), [simOn, work, simWork]);
  const allLeads = useMemo(() => (simOn ? [...leads, ...simLeads] : leads), [simOn, leads, simLeads]);
  const allOutreach = useMemo(() => (simOn ? [...outreach, ...simOutreach] : outreach), [simOn, outreach, simOutreach]);
  const feed = useMemo(
    () => (simOn ? [...events, ...simEvents] : events).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 300),
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

  const openAgent = (id: string) => { setSelectedId(id); setTab('building'); };

  // ── Founder actions ──
  const canWrite = canManage && !preview && schemaReady;

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
    const { data, error } = await dbOp('ai_agent_work', 'insert', { agent_id: agentId, title, brief, status: 'queued', requested_by: currentUserId });
    if (error) return error;
    const row = data?.[0] as Work | undefined;
    if (row) setWork(prev => upsertById(prev, row));
    await logEvent({ agent_id: agentId, to_agent_id: null, work_id: row?.id ?? null, kind: 'request', message: `Founder → ${byId[agentId]?.name ?? 'agent'}: ${title}` });
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

  const logCall = async (id: string, status: OutreachStatus, notes: string): Promise<string | null> => {
    const o = allOutreach.find(x => x.id === id);
    if (!o) return 'Call not found';
    if (o.sim) {
      simLogCall(pipe.current, id, status, notes);
      syncSim();
      return null;
    }
    const now = new Date().toISOString();
    const r = await dbOp('ai_outreach', 'update', { status, notes, sent_at: o.sent_at ?? now, updated_at: now }, { id });
    if (r.error) return r.error;
    if (r.data?.[0]) setOutreach(prev => upsertById(prev, r.data![0] as Outreach));
    const leadStatus = status === 'booked' ? 'booked' : status === 'not_interested' ? 'not_interested' : status === 'interested' ? 'replied' : 'contacted';
    const l = await dbOp('ai_leads', 'update', { status: leadStatus, updated_at: now }, { id: o.lead_id });
    if (l.data?.[0]) setLeads(prev => upsertById(prev, l.data![0] as Lead));
    return null;
  };

  const saveNiche = async (n: Niche): Promise<string | null> => {
    if (pipelineReady && canManage) {
      const { error } = await dbOp('ai_niches', 'upsert', { ...n, updated_at: new Date().toISOString() });
      if (error) return error;
    }
    setNiches(prev => prev.map(x => (x.key === n.key ? n : x)));
    return null;
  };

  const staffBuilding = async () => {
    setStaffing(true);
    setNotice('');
    const fail = (e: string) => { setNotice(e); setStaffing(false); };
    const d = await dbOp('ai_departments', 'upsert', DEFAULT_DEPARTMENTS);
    if (d.error) return fail(d.error);
    for (const key of RETIRED_DEPTS) await dbOp('ai_departments', 'delete', undefined, { key });
    const a = await dbOp('ai_agents', 'upsert', staffingRows(agents, currentUserId));
    if (a.error) return fail(a.error);
    for (const old of agents.filter(x => x.slug && RETIRED_SLUGS.includes(x.slug))) {
      await dbOp('ai_agents', 'update', { status: 'archived', updated_at: new Date().toISOString() }, { id: old.id });
    }
    if (pipelineReady) {
      const missing = DEFAULT_NICHES.filter(n => !initialNiches.some(x => x.key === n.key));
      if (missing.length) {
        const nres = await dbOp('ai_niches', 'upsert', missing);
        if (nres.error) return fail(nres.error);
      }
    }
    // Start clean from the database so every desk has its real id.
    window.location.reload();
  };

  const setAgentStatus = async (agent: Agent, s: 'active' | 'paused' | 'archived') => {
    const before = agent.status;
    setAgents(prev => (s === 'archived' ? prev.filter(x => x.id !== agent.id) : prev.map(x => (x.id === agent.id ? { ...x, status: s } : x))));
    if (s === 'archived') setSelectedId(null);
    const { error } = await dbOp('ai_agents', 'update', { status: s, updated_at: new Date().toISOString() }, { id: agent.id });
    // Roll back the optimistic change if the write did not land.
    if (error) setAgents(prev => (s === 'archived' ? [...prev, agent] : prev.map(x => (x.id === agent.id ? { ...x, status: before } : x))));
  };

  const saveAgent = async (draft: AgentDraft): Promise<string | null> => {
    const payload = {
      name: draft.name.trim(), title: draft.title.trim(), tier: draft.tier, department: draft.department,
      reports_to: draft.reports_to || null, purpose: draft.purpose.trim(), channel: draft.channel,
      status: draft.status, model: draft.model.trim(), system_prompt: draft.system_prompt.trim(),
    };
    const r = draft.id
      ? await dbOp('ai_agents', 'update', { ...payload, updated_at: new Date().toISOString() }, { id: draft.id })
      : await dbOp('ai_agents', 'insert', { ...payload, created_by: currentUserId, sort_order: agents.length });
    if (r.error) return r.error;
    if (r.data?.[0]) setAgents(prev => upsertById(prev, normalizeAgent(r.data![0])));
    setEditing(null);
    return null;
  };

  // ── Real agent runs (Phase 2) ──
  const canRun = canManage && !preview && pipelineReady;
  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true as const, json } : { ok: false as const, error: String(json.error ?? `Request failed (${res.status})`) };
  };
  const pullLeads = async (niche: string, city: string, max: number): Promise<string> => {
    const r = await post('/api/agents/leads/pull', { niche, city, max });
    return r.ok ? 'Scout is on it. Leads appear here when Google Maps finishes (usually 1–3 minutes), then Research starts on them.' : r.error;
  };
  const runResearch = async (): Promise<string> => {
    const r = await post('/api/agents/research', { limit: 5 });
    if (!r.ok) return r.error;
    const { researched, qualified, failed } = r.json as { researched: number; qualified: number; failed: number };
    return researched === 0 ? 'No new leads waiting for research.' : `Researched ${researched}: ${qualified} qualified${failed ? `, ${failed} failed (see Alerts)` : ''}.`;
  };

  const selected = selectedId ? byId[selectedId] : null;
  const openLead = leadId ? allLeads.find(l => l.id === leadId) : undefined;

  return (
    <div className="page-fade ag-page">
      {!schemaReady || !pipelineReady ? (
        <div className="ag-banner">
          <span>
            Run {!schemaReady && <><code>supabase/schema_v91_agent_hq.sql</code> then </>}<code>supabase/schema_v92_agent_pipeline.sql</code> in
            the Supabase SQL Editor to save niches, leads and outreach. Until then this is a preview.
          </span>
        </div>
      ) : preview && canManage ? (
        <div className="ag-banner ag-banner-acc">
          <span>
            {agents.length ? 'Your agents are still on the old octopus layout. ' : ''}
            Staff the building to give all {previewAgents().length} agents across {DEFAULT_DEPARTMENTS.length} floors a real desk.
            {agents.length ? ' Agents that carry over keep their settings; retired ones are archived, not deleted.' : ''}
          </span>
          <button className="btn btn-acc btn-sm" onClick={staffBuilding} disabled={staffing}>
            {staffing ? <><span className="spin" />Staffing…</> : agents.length ? 'Move to the floor plan' : 'Staff the building'}
          </button>
        </div>
      ) : null}
      {notice && <div className="ag-banner" onClick={() => setNotice('')}>{notice}</div>}

      <div className="ag-tabbar">
        <div className="tabs">
          {TABS.map(t => (
            <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <button type="button" className={`ag-sim-toggle${simOn ? ' on' : ''}`} onClick={toggleSim}
          title="Sample activity generated in your browser. Nothing is written or sent.">
          <i />{simOn ? 'Simulation on · sample data' : 'Simulation off'}
        </button>
      </div>

      {tab === 'building' && (
        <div className={`ag-bld-layout${selected ? ' with-detail' : ''}`}>
          <BuildingView
            departments={shownDepts}
            agents={shownAgents}
            activityOf={activityOf}
            taskOf={taskOf}
            revisionCount={revisionCount}
            selectedId={selectedId}
            onSelect={id => setSelectedId(id === selectedId ? null : id)}
            bubbles={bubbles}
            elevator={elevator}
            canHire={canWrite}
            onHire={dept => setEditing({
              name: '', title: '', tier: 'specialist', department: dept, reports_to: '',
              purpose: '', channel: 'other', status: 'active', model: '', system_prompt: '',
            })}
          />
          {selected && (
            <div className="ag-side">
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
                onSelect={setSelectedId}
                onClose={() => setSelectedId(null)}
                onRequest={sendRequest}
                onDecide={decide}
                onEdit={() => setEditing({
                  id: selected.id, name: selected.name, title: selected.title, tier: selected.tier,
                  department: selected.department, reports_to: selected.reports_to ?? '', purpose: selected.purpose,
                  channel: selected.channel, status: selected.status, model: selected.model, system_prompt: selected.system_prompt,
                })}
                onSetStatus={s => setAgentStatus(selected, s)}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'updates' && (
        <UpdatesView departments={shownDepts} agents={shownAgents} work={allWork} events={feed}
          activityOf={activityOf} taskOf={taskOf} onDecide={decide} onOpenAgent={openAgent} />
      )}
      {(tab === 'leads' || tab === 'research' || tab === 'outreach') && canManage && pipelineReady && (
        <SetupChecklist integrations={integrations} />
      )}
      {tab === 'leads' && <LeadsView leads={allLeads} niches={niches} onOpenLead={setLeadId}
        canPull={canRun && integrations.apify} onPull={pullLeads} />}
      {tab === 'research' && (
        <ResearchView agents={shownAgents} leads={allLeads} outreach={allOutreach} niches={niches}
          activityOf={activityOf} taskOf={taskOf} onOpenLead={setLeadId} onOpenAgent={openAgent} onOpenNiches={() => setTab('niches')}
          canResearch={canRun && integrations.claude} onResearch={runResearch} />
      )}
      {tab === 'outreach' && (
        <OutreachView leads={allLeads} outreach={allOutreach} niches={niches}
          onOpenLead={setLeadId} onLogCall={logCall} onOpenNiches={() => setTab('niches')} />
      )}
      {tab === 'niches' && (
        <NichesView niches={niches} leads={allLeads} outreach={allOutreach} canEdit={canManage}
          saveHint={pipelineReady ? 'Saved' : 'Saved for this session — run schema_v92 to keep it'} onSave={saveNiche} />
      )}

      {openLead && (
        <LeadDrawer
          lead={openLead}
          niche={niches.find(n => n.key === openLead.niche)}
          outreach={allOutreach.filter(o => o.lead_id === openLead.id)}
          researcher={openLead.researched_by ? byId[openLead.researched_by] : undefined}
          onClose={() => setLeadId(null)}
        />
      )}

      {editing && (
        <AgentEditor
          draft={editing}
          agents={agents}
          departments={shownDepts}
          onCancel={() => setEditing(null)}
          onSave={saveAgent}
        />
      )}
    </div>
  );
}
