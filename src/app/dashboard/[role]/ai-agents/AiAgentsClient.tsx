'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dbOp } from '@/utils/db';
import { createClient } from '@/utils/supabase/client';
import { DEFAULT_AGENTS, DEFAULT_DEPARTMENTS, DEFAULT_NICHES, LIVE_AGENTS, RETIRED_DEPTS, RETIRED_SLUGS, staffingRows } from '@/lib/aiAgents/org';
import {
  effectiveActivity, normalizeAgent,
  type Activity, type Agent, type AgentEvent, type AgentMessage, type CallNote, type Department, type EventKind, type Lead, type Niche,
  type Outreach, type OutreachSettings, type Routine, type Run, type Skill, type Work,
} from '@/lib/aiAgents/types';
import type { EmailAction, InboxStatus } from './EmailsPanel';
import BuildingView, { type Bubble } from './BuildingView';
import OfficeView from './OfficeView';
import OfficeAgentPanel from './OfficeAgentPanel';
import LiveStrip from './LiveStrip';
import UpdatesView from './UpdatesView';
import LeadsView from './LeadsView';
import ResearchView from './ResearchView';
import OutreachView from './OutreachView';
import NichesView from './NichesView';
import LeadDrawer from './LeadDrawer';
import AgentDetail from './AgentDetail';
import AgentEditor, { type AgentDraft } from './AgentEditor';
import SetupChecklist, { type Integrations } from './SetupChecklist';

// Everything on this page is real: agents, their desks, leads and outreach all
// come from the database and update over realtime as the agents work.

type Tab = 'building' | 'office' | 'updates' | 'leads' | 'research' | 'outreach' | 'niches';

const TABS: { key: Tab; label: string }[] = [
  { key: 'building', label: 'Building' },
  { key: 'office', label: 'Office' },
  { key: 'updates', label: 'Updates' },
  { key: 'leads', label: 'Leads' },
  { key: 'research', label: 'Research' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'niches', label: 'Niches' },
];

const MAX_BUBBLES = 5;

function upsertById<T extends { id: string | number }>(list: T[], row: T): T[] {
  const i = list.findIndex(x => x.id === row.id);
  if (i < 0) return [row, ...list];
  const next = [...list];
  next[i] = row;
  return next;
}

export default function AiAgentsClient({
  initialAgents, initialRuns, initialDepartments, initialWork, initialEvents,
  initialNiches, initialLeads, initialOutreach, initialSettings, initialCalls, initialRoutines, initialSkills, inbox, inboxResult,
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
  initialSettings: OutreachSettings | null;
  initialCalls: CallNote[];
  initialRoutines: Routine[];
  initialSkills: Skill[];
  inbox: InboxStatus;
  inboxResult: string;
  schemaReady: boolean;
  pipelineReady: boolean;
  integrations: Integrations;
  canManage: boolean;
  currentUserId: string;
}) {
  // Coming back from Google's sign-in lands on the Outreach tab with the result.
  const [tab, setTab] = useState<Tab>(inboxResult ? 'outreach' : 'building');
  const [settings, setSettings] = useState<OutreachSettings | null>(initialSettings);
  const [agents, setAgents] = useState<Agent[]>(() => initialAgents.map(normalizeAgent));
  const [departments] = useState<Department[]>(initialDepartments);
  const [work, setWork] = useState<Work[]>(initialWork);
  const [events, setEvents] = useState<AgentEvent[]>(initialEvents);
  const [runs] = useState<Run[]>(initialRuns);
  const [niches, setNiches] = useState<Niche[]>(initialNiches);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [outreach, setOutreach] = useState<Outreach[]>(initialOutreach);
  const [calls, setCalls] = useState<CallNote[]>(initialCalls);
  const [routines, setRoutines] = useState<Routine[]>(initialRoutines);
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const seenEvents = useRef(new Set(initialEvents.map(e => String(e.id))));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, AgentMessage[]>>({});
  const [talking, setTalking] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [elevator, setElevator] = useState<{ floor: number; kind: EventKind | null }>({ floor: 0, kind: null });
  const [editing, setEditing] = useState<AgentDraft | null>(null);
  const [staffing, setStaffing] = useState(false);
  const [notice, setNotice] = useState(() => !inboxResult ? ''
    : inboxResult.startsWith('connected:') ? `Connected ${inboxResult.slice(10)}. Post will send your approved emails from it, starting slowly to warm it up.`
    : `Could not connect the inbox: ${inboxResult}`);

  const ready = schemaReady && pipelineReady;
  const staffed = DEFAULT_DEPARTMENTS.every(d => departments.some(x => x.key === d.key)) && agents.some(a => a.tier === 'ceo');
  const floors = useMemo(() => [...departments].sort((a, b) => a.arm_order - b.arm_order), [departments]);
  const byId = useMemo(() => Object.fromEntries(agents.map(a => [a.id, a])), [agents]);
  const liveIds = useMemo(() => new Set(agents.filter(a => a.slug && LIVE_AGENTS[a.slug]).map(a => a.id)), [agents]);
  const floorOf = useCallback((agentId: string | null) => {
    const d = agentId ? byId[agentId]?.department : undefined;
    return Math.max(0, floors.findIndex(x => x.key === d));
  }, [byId, floors]);

  // ── Pop a notification at the desk and send the elevator to its floor ──
  const emit = useCallback((evs: AgentEvent[]) => {
    const withAgent = evs.filter(e => e.agent_id);
    if (!withAgent.length) return;
    const nb: Bubble[] = withAgent.map(e => ({ id: String(e.id), agentId: e.agent_id!, kind: e.kind, text: e.message }));
    setBubbles(b => {
      const next = [...b, ...nb];
      while (next.length > MAX_BUBBLES) {
        const i = next.findIndex(x => x.kind !== 'revision');
        next.splice(i >= 0 ? i : 0, 1);
      }
      return next;
    });
    for (const b of nb) window.setTimeout(() => setBubbles(x => x.filter(y => y !== b)), b.kind === 'revision' ? 7500 : 5000);
    const last = withAgent[withAgent.length - 1];
    if (last.kind !== 'progress') setElevator({ floor: floorOf(last.agent_id), kind: last.kind });
  }, [floorOf]);

  // ── Realtime from the agents ──
  useEffect(() => {
    if (!ready) return;
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
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_leads' }, payload => {
        if (payload.eventType !== 'DELETE') setLeads(prev => upsertById(prev, payload.new as Lead));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_outreach' }, payload => {
        if (payload.eventType !== 'DELETE') setOutreach(prev => upsertById(prev, payload.new as Outreach));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_call_notes' }, payload => {
        setCalls(prev => upsertById(prev, payload.new as CallNote));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ready, emit]);

  const feed = useMemo(() => [...events].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 300), [events]);

  const activityOf = useCallback((id: string): Activity | 'offline' => {
    const a = byId[id];
    return a ? effectiveActivity(a) : 'idle';
  }, [byId]);

  const taskOf = useCallback((id: string) => {
    const a = byId[id];
    if (a?.current_task) return a.current_task;
    return work.find(w => w.agent_id === id && w.status === 'in_progress')?.title ?? '';
  }, [byId, work]);

  const revisionCount = useMemo(() => {
    const out: Record<string, number> = {};
    for (const w of work) if (w.status === 'revision') out[w.agent_id] = (out[w.agent_id] ?? 0) + 1;
    return out;
  }, [work]);


  const openAgent = (id: string) => { setSelectedId(id); setTab('building'); };

  // ── The office: conversations, assignments and who is on the floor ──
  const loadMessages = useCallback(async (agentId: string) => {
    const { data } = await dbOp('ai_agent_messages', 'select', undefined, { agent_id: agentId });
    setMessages(prev => ({ ...prev, [agentId]: (data ?? []) as AgentMessage[] }));
  }, []);

  const talk = async (agentId: string, text: string): Promise<string | null> => {
    setTalking(true);
    const r = await post('/api/agents/talk', { agentId, text });
    setTalking(false);
    if (!r.ok) return r.error;
    const said = (r.json.messages ?? []) as AgentMessage[];
    setMessages(prev => ({ ...prev, [agentId]: [...(prev[agentId] ?? []), ...said] }));
    const w = r.json.work as Work | undefined;
    if (w) setWork(prev => upsertById(prev, w));
    return null;
  };

  const setOffice = async (agent: Agent, inOffice: boolean) => {
    setAgents(prev => prev.map(a => (a.id === agent.id ? { ...a, in_office: inOffice } : a)));
    if (!inOffice && selectedId === agent.id) setSelectedId(null);
    const { error } = await dbOp('ai_agents', 'update', { in_office: inOffice, updated_at: new Date().toISOString() }, { id: agent.id });
    if (error) setAgents(prev => prev.map(a => (a.id === agent.id ? { ...a, in_office: !inOffice } : a)));
  };
  const canWrite = canManage && ready && staffed;

  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true as const, json } : { ok: false as const, error: String(json.error ?? `Request failed (${res.status})`) };
  };

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

  const decide = async (w: Work, decision: 'approve' | 'revise', notes = ''): Promise<string | null> => {
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

  /** Log a call you made: the note is kept and the lead moves out of the call list. */
  const logCall = async (leadId: string, outreachId: string | null, outcome: CallNote['outcome'], note: string): Promise<string | null> => {
    const r = await post('/api/agents/calls', { leadId, outreachId, outcome, note });
    if (!r.ok) return r.error;
    const j = r.json as { call?: CallNote; outreach?: Outreach; lead?: Lead };
    if (j.call) setCalls(prev => upsertById(prev, j.call!));
    if (j.outreach) setOutreach(prev => upsertById(prev, j.outreach!));
    if (j.lead) setLeads(prev => upsertById(prev, j.lead!));
    return null;
  };

  const saveNiche = async (n: Niche): Promise<string | null> => {
    const { error } = await dbOp('ai_niches', 'upsert', { ...n, updated_at: new Date().toISOString() });
    if (error) return error;
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
    const missing = DEFAULT_NICHES.filter(n => !initialNiches.some(x => x.key === n.key));
    if (missing.length) {
      const nres = await dbOp('ai_niches', 'upsert', missing);
      if (nres.error) return fail(nres.error);
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

  // ── Running the live agents ──
  const pullLeads = async (niche: string, city: string, max: number): Promise<string> => {
    const r = await post('/api/agents/leads/pull', { niche, city, max });
    return r.ok ? 'Scout is on it. Leads appear here when Google Maps finishes (usually 1–3 minutes), then Research starts on them.' : r.error;
  };
  const emailAction: EmailAction = async payload => {
    const r = await post('/api/agents/emails', payload);
    const row = r.ok ? (r.json.outreach as Outreach | undefined) : undefined;
    if (row) setOutreach(prev => upsertById(prev, row));
    return r.ok ? { ok: true, json: r.json as Record<string, unknown> } : r;
  };
  // The task bar: one box, routed to whoever owns the job.
  const sendTask = async (text: string) => {
    const r = await post('/api/agents/task', { text });
    if (!r.ok) return { error: r.error };
    const j = r.json as { agent?: { name: string; title: string }; reply?: string; result?: string; work?: Work };
    if (j.work) setWork(prev => upsertById(prev, j.work!));
    return j;
  };

  const saveRoutine = async (r: Partial<Routine>): Promise<string | null> => {
    const res = await post('/api/agents/routines', { action: 'save_routine', routine: r });
    if (!res.ok) return res.error;
    const row = res.json.routine as Routine;
    setRoutines(prev => (prev.some(x => x.id === row.id) ? prev.map(x => (x.id === row.id ? row : x)) : [...prev, row]));
    return null;
  };
  const runRoutine = async (id: string): Promise<string> => {
    const res = await post('/api/agents/routines', { action: 'run_routine', id });
    if (!res.ok) return res.error;
    const row = res.json.routine as Routine;
    setRoutines(prev => prev.map(x => (x.id === row.id ? row : x)));
    return String(res.json.result ?? 'Done');
  };
  const deleteRoutine = async (id: string) => {
    await post('/api/agents/routines', { action: 'delete_routine', id });
    setRoutines(prev => prev.filter(x => x.id !== id));
  };
  const saveSkill = async (s: Partial<Skill>): Promise<string | null> => {
    const res = await post('/api/agents/routines', { action: 'save_skill', skill: s });
    if (!res.ok) return res.error;
    const row = res.json.skill as Skill;
    setSkills(prev => (prev.some(x => x.id === row.id) ? prev.map(x => (x.id === row.id ? row : x)) : [...prev, row]));
    return null;
  };
  const deleteSkill = async (id: string) => {
    await post('/api/agents/routines', { action: 'delete_skill', id });
    setSkills(prev => prev.filter(x => x.id !== id));
  };

  const runAgents = async (what: 'topup' | 'research' | 'write' | 'send'): Promise<string> => {
    const r = await post('/api/agents/run', { what });
    if (!r.ok) return r.error;
    const j = r.json as Record<string, { error?: string; skipped?: string } & Record<string, unknown>>;
    const bits: string[] = [];
    if (j.leads) bits.push(j.leads.error ? `Leads: ${j.leads.error}` : j.leads.skipped ? `Leads: ${j.leads.skipped}` : `Scout is pulling ${j.leads.niche} in ${j.leads.city} — they land in a couple of minutes`);
    if (j.research) bits.push(`Researched ${j.research.researched ?? 0}, ${j.research.qualified ?? 0} qualified`);
    if (j.write) bits.push(`Quill wrote ${j.write.written ?? 0}${j.write.skipped ? `, skipped ${j.write.skipped}` : ''}`);
    if (j.send) bits.push(j.send.sent ? `Sent ${j.send.sent}` : `Nothing sent: ${j.send.reason ?? 'nothing approved'}`);
    if (typeof r.json.ready === 'number') bits.push(`${r.json.ready} leads ready to work`);
    return bits.join(' · ') || 'Nothing to do right now.';
  };

  const runResearch = async (): Promise<string> => {
    const r = await post('/api/agents/research', { limit: 5 });
    if (!r.ok) return r.error;
    const { researched, qualified, failed } = r.json as { researched: number; qualified: number; failed: number };
    return researched === 0 ? 'No new leads waiting for research.' : `Researched ${researched}: ${qualified} qualified${failed ? `, ${failed} failed (see Updates → Alerts)` : ''}.`;
  };

  // ── Before the building exists: set-up steps, nothing made up ──
  if (!ready || !staffed) {
    const steps = [
      { done: schemaReady, text: <>Run <code>supabase/schema_v91_agent_hq.sql</code> in the Supabase SQL Editor</> },
      { done: pipelineReady, text: <>Run <code>supabase/schema_v92_agent_pipeline.sql</code> in the Supabase SQL Editor</> },
      { done: staffed, text: <>Staff the building: {DEFAULT_AGENTS.length} agents across {DEFAULT_DEPARTMENTS.length} floors, and the {DEFAULT_NICHES.length} niches</> },
    ];
    return (
      <div className="page-fade ag-page">
        <div className="ag-gate">
          <b>Set up the Octopus Engines HQ</b>
          <ol>
            {steps.map((s, i) => <li key={i} className={s.done ? 'done' : ''}><span>{s.done ? '✓' : i + 1}</span>{s.text}</li>)}
          </ol>
          {ready && !staffed && (canManage ? (
            <button className="btn btn-acc" onClick={staffBuilding} disabled={staffing}>
              {staffing ? <><span className="spin" />Staffing…</> : agents.length ? 'Move my agents to the floor plan' : 'Staff the building'}
            </button>
          ) : <span className="tb-sub">An owner or admin needs to staff the building.</span>)}
          {!ready && <span className="tb-sub">Refresh this page after running the SQL.</span>}
          {notice && <div className="ag-err">{notice}</div>}
        </div>
      </div>
    );
  }

  const selected = selectedId ? byId[selectedId] : null;
  const openLead = leadId ? leads.find(l => l.id === leadId) : undefined;

  return (
    <div className="page-fade ag-page">
      {notice && <div className="ag-banner" onClick={() => setNotice('')}>{notice}</div>}

      <div className="ag-tabbar">
        <div className="tabs">
          {TABS.map(t => (
            <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {canManage && tab !== 'building' && tab !== 'updates' && <SetupChecklist integrations={integrations} />}

      {tab === 'building' && (
        <>
          <LiveStrip agents={agents} activityOf={activityOf} taskOf={taskOf} onOpen={setSelectedId} />
          <div className={`ag-bld-layout${selected ? ' with-detail' : ''}`}>
            <BuildingView
              departments={floors}
              agents={agents}
              liveIds={liveIds}
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
                  departments={floors}
                  activity={activityOf(selected.id)}
                  task={taskOf(selected.id)}
                  work={work.filter(w => w.agent_id === selected.id)}
                  events={feed.filter(e => e.agent_id === selected.id || e.to_agent_id === selected.id).slice(0, 25)}
                  runs={runs.filter(r => r.agent_id === selected.id)}
                  reports={agents.filter(a => a.reports_to === selected.id)}
                  canManage={canWrite}
                  onSelect={setSelectedId}
                  onClose={() => setSelectedId(null)}
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
        </>
      )}

      {tab === 'office' && (
        <div className={`ag-bld-layout${selected ? ' with-detail' : ''}`}>
          <OfficeView
            agents={agents}
            activityOf={activityOf}
            taskOf={taskOf}
            selectedId={selectedId}
            onSelect={id => { setSelectedId(id); if (id && !messages[id]) void loadMessages(id); }}
            canManage={canWrite}
            onSetOffice={setOffice}
            onRun={runAgents}
            onTask={sendTask}
            bubbles={bubbles}
            routines={routines}
            onSaveRoutine={saveRoutine}
            onRunRoutine={runRoutine}
            onDeleteRoutine={deleteRoutine}
          />
          {selected && (
            <div className="ag-side">
              <OfficeAgentPanel
                key={selected.id}
                agent={selected}
                department={floors.find(f => f.key === selected.department)}
                activity={activityOf(selected.id)}
                task={taskOf(selected.id)}
                work={work.filter(w => w.agent_id === selected.id)}
                messages={messages[selected.id] ?? []}
                skills={skills.filter(s => (s.scope === 'agent' && s.target === selected.slug) || (s.scope === 'department' && s.target === selected.department))}
                canManage={canWrite}
                sending={talking}
                onSend={t => talk(selected.id, t)}
                onSetOffice={setOffice}
                onSaveSkill={saveSkill}
                onDeleteSkill={deleteSkill}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'updates' && (
        <UpdatesView departments={floors} agents={agents} work={work} events={feed}
          activityOf={activityOf} taskOf={taskOf} onDecide={decide} onOpenAgent={openAgent} />
      )}
      {tab === 'leads' && (
        <LeadsView leads={leads} niches={niches} onOpenLead={setLeadId}
          canPull={canWrite && integrations.apify} onPull={pullLeads} />
      )}
      {tab === 'research' && (
        <ResearchView agents={agents} leads={leads} outreach={outreach} niches={niches}
          activityOf={activityOf} taskOf={taskOf} onOpenLead={setLeadId} onOpenAgent={openAgent} onOpenNiches={() => setTab('niches')}
          canResearch={canWrite && integrations.claude} onResearch={runResearch} />
      )}
      {tab === 'outreach' && (
        <OutreachView leads={leads} outreach={outreach} niches={niches} calls={calls} onOpenLead={setLeadId} onLogCall={logCall}
          settings={settings} inbox={inbox} onSettings={setSettings} onEmailAction={emailAction} />
      )}
      {tab === 'niches' && (
        <NichesView niches={niches} leads={leads} outreach={outreach} canEdit={canManage} onSave={saveNiche} />
      )}

      {openLead && (
        <LeadDrawer
          lead={openLead}
          niche={niches.find(n => n.key === openLead.niche)}
          outreach={outreach.filter(o => o.lead_id === openLead.id)}
          researcher={openLead.researched_by ? byId[openLead.researched_by] : undefined}
          onClose={() => setLeadId(null)}
        />
      )}

      {editing && (
        <AgentEditor draft={editing} agents={agents} departments={floors} onCancel={() => setEditing(null)} onSave={saveAgent} />
      )}
    </div>
  );
}
