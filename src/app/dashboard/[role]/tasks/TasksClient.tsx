'use client';

import { useState, useMemo } from 'react';
import { dbOp } from '@/utils/db';
import { createClient } from '@/utils/supabase/client';

/* ── Types ───────────────────────────────────────────────── */
type DailyTaskDef = { key: string; title: string; description: string; days?: string[] };
type DailyResponse = {
  id: number; agent_id: string; task_key: string; task_type: string;
  response: 'yes' | 'no' | 'irrelevant'; log_date: string; note?: string;
};

/* ── Helpers ─────────────────────────────────────────────── */
const PRIORITY_BADGE: Record<string, string> = {
  High: 'bdg bdg-err', Medium: 'bdg bdg-warn', Low: 'bdg bdg-gy',
};

const RESP_META = {
  yes:        { label: 'Yes — done',     bg: 'oklch(0.93 0.06 145)', color: 'oklch(0.36 0.15 145)', dot: 'oklch(0.50 0.18 145)', border: 'oklch(0.80 0.10 145)' },
  no:         { label: 'No — missed',    bg: 'oklch(0.93 0.06 25)',  color: 'oklch(0.40 0.20 25)',  dot: 'oklch(0.50 0.20 25)',  border: 'oklch(0.80 0.12 25)'  },
  irrelevant: { label: "N/A today",      bg: 'oklch(0.94 0.01 260)', color: 'oklch(0.45 0.02 260)', dot: 'oklch(0.60 0.01 260)', border: 'oklch(0.82 0.01 260)' },
};

function todayDOW(today: string) {
  return new Date(today).toLocaleDateString('en-US', { weekday: 'long' });
}
function fmtDate(today: string) {
  return new Date(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function initials(name: string) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

/* ── Component ───────────────────────────────────────────── */
export default function TasksClient({
  initialTasks, users, isMgmt, isCx, currentUserId, userRole, today,
  initialResponses, routineDefs: initialRoutineDefs, incentiveDefs: initialIncentiveDefs,
}: {
  initialTasks: any[]; users: any[]; isMgmt: boolean; isCx: boolean;
  currentUserId: string; userRole: string; today: string;
  initialResponses: DailyResponse[]; routineDefs: DailyTaskDef[]; incentiveDefs: DailyTaskDef[];
}) {
  /* ── Section state ── */
  const [section, setSection] = useState<'assigned' | 'group' | 'routine' | 'incentive'>('assigned');

  /* ── Assigned tasks state ── */
  const [tasks, setTasks]               = useState(initialTasks);
  const [filterTab, setFilterTab]       = useState<'all'|'open'|'high'|'done'>('all');
  const [showAssignModal, setShowAssign] = useState(false);
  const [assignType, setAssignType]     = useState<'normal'|'group'>('normal');
  const [saving, setSaving]             = useState(false);
  const [viewTask, setViewTask]         = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [completingTask, setCompletingTask]   = useState<any>(null);
  const [completionNote, setCompletionNote]   = useState('');
  const [completionFile, setCompletionFile]   = useState<File | null>(null);
  const [completionUploading, setCompletionUploading] = useState(false);

  /* ── Daily task state ── */
  const [responses, setResponses]       = useState<DailyResponse[]>(initialResponses);
  const [routineDefs, setRoutineDefs]   = useState<DailyTaskDef[]>(initialRoutineDefs);
  const [incentiveDefs, setIncentiveDefs] = useState<DailyTaskDef[]>(initialIncentiveDefs);
  const [agentViewMode, setAgentViewMode] = useState<'agents'|'tasks'>('agents');
  const [showManage, setShowManage]     = useState(false);
  const [managingType, setManagingType] = useState<'routine'|'incentive'>('routine');
  const [defForm, setDefForm]           = useState({ key: '', title: '', description: '', days: '' });
  const [editingDef, setEditingDef]     = useState<DailyTaskDef | null>(null);
  const [savingDef, setSavingDef]       = useState(false);
  const [respondingKey, setRespondingKey] = useState<string | null>(null);

  /* ── Derived: my response map ── */
  const myResponseMap = useMemo(() => {
    const m: Record<string, DailyResponse> = {};
    for (const r of responses) {
      if (r.agent_id === currentUserId) m[r.task_key] = r;
    }
    return m;
  }, [responses, currentUserId]);

  /* ── Derived: agent response map (mgmt view) ── */
  const agentResponseMap = useMemo(() => {
    // { agent_id: { task_key: response } }
    const m: Record<string, Record<string, DailyResponse>> = {};
    for (const r of responses) {
      if (!m[r.agent_id]) m[r.agent_id] = {};
      m[r.agent_id][r.task_key] = r;
    }
    return m;
  }, [responses]);

  /* ── Derived: task lists ── */
  const assignedTasks = useMemo(() => tasks.filter(t => !t.task_type || t.task_type === 'normal'), [tasks]);
  const groupTasks    = useMemo(() => tasks.filter(t => t.task_type === 'group'), [tasks]);
  const nameMap       = useMemo(() => Object.fromEntries(users.map((u: any) => [u.id, u.name])), [users]);
  const cxUsers       = useMemo(() => users.filter((u: any) => u.role === 'cx'), [users]);

  const open = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);
  const high = tasks.filter(t => !t.completed && t.priority === 'High');

  const TABS: { id: typeof filterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: tasks.length },
    { id: 'open', label: 'Open', count: open.length },
    { id: 'high', label: 'High Priority', count: high.length },
    { id: 'done', label: 'Done', count: done.length },
  ];

  const filteredAssigned = filterTab === 'all' ? assignedTasks
    : filterTab === 'open' ? assignedTasks.filter(t => !t.completed)
    : filterTab === 'high' ? assignedTasks.filter(t => !t.completed && t.priority === 'High')
    : assignedTasks.filter(t => t.completed);

  /* ── Progress helpers ── */
  function myProgress(defs: DailyTaskDef[], type: 'routine' | 'incentive') {
    const active = defs.filter(d => !d.days || d.days.includes(todayDOW(today)));
    const answered = active.filter(d => myResponseMap[d.key]);
    const yes = active.filter(d => myResponseMap[d.key]?.response === 'yes').length;
    return { total: active.length, answered: answered.length, yes };
  }

  const routineProgress  = myProgress(routineDefs,  'routine');
  const incentiveProgress = myProgress(incentiveDefs, 'incentive');

  /* ── Respond to daily task ── */
  async function handleRespond(task_key: string, task_type: 'routine' | 'incentive', response: 'yes' | 'no' | 'irrelevant') {
    setRespondingKey(task_key);
    const existing = myResponseMap[task_key];
    if (existing) {
      if (existing.response === response) { setRespondingKey(null); return; }
      const { error } = await dbOp('daily_task_responses', 'update', { response }, { id: existing.id });
      if (!error) setResponses(prev => prev.map(r => r.id === existing.id ? { ...r, response } : r));
    } else {
      const { data, error } = await dbOp('daily_task_responses', 'insert', {
        agent_id: currentUserId, task_key, task_type, response, log_date: today,
      });
      if (!error && data?.[0]) setResponses(prev => [...prev, data[0]]);
    }
    setRespondingKey(null);
  }

  /* ── Save task definition ── */
  async function saveDef() {
    if (!defForm.title.trim()) return;
    setSavingDef(true);
    const defs  = managingType === 'routine' ? routineDefs  : incentiveDefs;
    const setDefs = managingType === 'routine' ? setRoutineDefs : setIncentiveDefs;
    const key   = managingType === 'global_settings' as any;
    const settKey = managingType === 'routine' ? 'routine_tasks' : 'incentive_tasks';
    const newDef: DailyTaskDef = {
      key: editingDef ? editingDef.key : `${managingType === 'routine' ? 'rt' : 'inc'}_${Date.now()}`,
      title: defForm.title.trim(),
      description: defForm.description.trim(),
      ...(defForm.days.trim() ? { days: defForm.days.split(',').map(s => s.trim()) } : {}),
    };
    let updated: DailyTaskDef[];
    if (editingDef) {
      updated = defs.map(d => d.key === editingDef.key ? newDef : d);
    } else {
      updated = [...defs, newDef];
    }
    await dbOp('global_settings', 'upsert', { key: settKey, value: JSON.stringify(updated) });
    setDefs(updated);
    setEditingDef(null);
    setDefForm({ key: '', title: '', description: '', days: '' });
    setSavingDef(false);
  }

  async function deleteDef(defKey: string) {
    const defs    = managingType === 'routine' ? routineDefs  : incentiveDefs;
    const setDefs = managingType === 'routine' ? setRoutineDefs : setIncentiveDefs;
    const settKey = managingType === 'routine' ? 'routine_tasks' : 'incentive_tasks';
    const updated = defs.filter(d => d.key !== defKey);
    await dbOp('global_settings', 'upsert', { key: settKey, value: JSON.stringify(updated) });
    setDefs(updated);
  }

  /* ── Assigned task handlers ── */
  const handleDeleteTask = async (taskId: string) => {
    setDeletingId(taskId);
    await dbOp('tasks', 'delete', undefined, { id: taskId });
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (viewTask?.id === taskId) setViewTask(null);
    setConfirmDeleteId(null);
    setDeletingId(null);
  };

  const openCompletionModal = (task: any) => {
    setCompletingTask(task);
    setCompletionNote('');
    setCompletionFile(null);
  };

  const submitCompletion = async (note: string | null, file: File | null) => {
    if (!completingTask) return;
    setCompletionUploading(true);
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    if (file) {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'bin';
      const path = `tasks/${completingTask.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('employee-docs').upload(path, file, { upsert: true });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('employee-docs').getPublicUrl(path);
        fileUrl = publicUrl;
        fileName = file.name;
      }
    }
    const isGroup = completingTask.task_type === 'group';
    const isPrimary = completingTask.assigned_to === currentUserId;
    const patch: any = isGroup
      ? isPrimary
        ? { completed: true, completion_note: note || null, completion_file_url: fileUrl, completion_file_name: fileName }
        : { group_confirmed: true, group_confirmed_at: new Date().toISOString() }
      : { completed: true, completion_note: note || null, completion_file_url: fileUrl, completion_file_name: fileName };
    await dbOp('tasks', 'update', patch, { id: completingTask.id });
    setTasks(prev => prev.map(t => t.id === completingTask.id ? { ...t, ...patch } : t));
    if (viewTask?.id === completingTask.id) setViewTask((p: any) => ({ ...p, ...patch }));
    setCompletingTask(null);
    setCompletionNote('');
    setCompletionFile(null);
    setCompletionUploading(false);
  };

  const handleReopen = async (task: any) => {
    const patch = { completed: false, group_confirmed: false, completion_note: null, completion_file_url: null, completion_file_name: null };
    await dbOp('tasks', 'update', patch, { id: task.id });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...patch } : t));
    if (viewTask?.id === task.id) setViewTask((p: any) => ({ ...p, ...patch }));
  };

  const handleAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const newTask: any = {
      title:              fd.get('title') as string,
      description:        (fd.get('description') as string) || null,
      assigned_to:        fd.get('assigned_to') as string,
      second_assigned_to: assignType === 'group' ? (fd.get('second_assigned_to') as string) || null : null,
      task_type:          assignType,
      assigned_by:        currentUserId,
      due_date:           fd.get('due_date') as string,
      priority:           fd.get('priority') as string,
      completed:          false,
      group_confirmed:    false,
    };
    const { data } = await dbOp('tasks', 'insert', newTask);
    if (data?.[0]) {
      const au = users.find((u: any) => u.id === newTask.assigned_to);
      const bu = users.find((u: any) => u.id === currentUserId);
      setTasks(prev => [{ ...data[0], assigned_user: { name: au?.name ?? '—' }, by_user: { name: bu?.name ?? '—' } }, ...prev]);
    }
    setShowAssign(false);
    setSaving(false);
    (e.target as HTMLFormElement).reset();
  };

  /* ════════════════════════════════════════════════════════════
     Render helpers
  ═══════════════════════════════════════════════════════════ */

  /* ── Task row (shared between assigned and group views) ── */
  function TaskRow({ t, showGroupInfo }: { t: any; showGroupInfo?: boolean }) {
    const hue = ((t.assigned_user?.name ?? 'U').charCodeAt(0) * 13) % 360;
    const isOverdue = t.due_date && !t.completed && new Date(t.due_date) < new Date();
    const isGroup = t.task_type === 'group';
    const fullyDone = isGroup ? (t.completed && t.group_confirmed) : t.completed;
    const halfDone  = isGroup && (t.completed || t.group_confirmed) && !fullyDone;

    const canComplete = t.assigned_to === currentUserId && !t.completed;
    const canConfirm  = isGroup && t.second_assigned_to === currentUserId && t.completed && !t.group_confirmed;

    return (
      <div
        onClick={() => setViewTask(t)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
          borderBottom: '1px solid var(--line-2)',
          opacity: fullyDone ? 0.55 : 1,
          cursor: 'pointer',
        }}
      >
        <button
          onClick={e => {
            e.stopPropagation();
            if (canConfirm) openCompletionModal(t);
            else if (canComplete) openCompletionModal(t);
            else if (fullyDone) handleReopen(t);
          }}
          style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: fullyDone ? 'none' : halfDone ? '1.5px solid oklch(0.65 0.14 55)' : '1.5px solid var(--line)',
            background: fullyDone ? 'var(--ok)' : halfDone ? 'oklch(0.93 0.06 55)' : 'var(--surface)',
            color: fullyDone ? '#fff' : halfDone ? 'oklch(0.45 0.14 55)' : 'transparent',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{fullyDone ? '✓' : halfDone ? '½' : ''}</button>

        <div className="av-circle" style={{ width: 30, height: 30, fontSize: 10, flexShrink: 0, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
          {(t.assigned_user?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 13, textDecoration: fullyDone ? 'line-through' : 'none', color: fullyDone ? 'var(--ink-3)' : 'var(--ink)' }}>{t.title}</span>
            {isGroup && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'oklch(0.93 0.04 260)', color: 'oklch(0.40 0.12 260)' }}>GROUP</span>}
            {halfDone && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'oklch(0.93 0.06 55)', color: 'oklch(0.45 0.14 55)' }}>½ PARTIAL</span>}
          </div>
          {t.description && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
            → {t.assigned_user?.name ?? '—'}
            {isGroup && t.second_assigned_to && ` + ${nameMap[t.second_assigned_to] ?? '?'}`}
            {' · '}By {t.by_user?.name ?? '—'}
            {t.due_date && (
              <span style={{ marginLeft: 8, color: isOverdue ? 'var(--err)' : 'var(--ink-4)', fontWeight: isOverdue ? 700 : 400 }}>
                Due {new Date(t.due_date).toLocaleDateString()}{isOverdue ? ' (overdue)' : ''}
              </span>
            )}
          </div>
        </div>

        <span className={PRIORITY_BADGE[t.priority] ?? 'bdg bdg-gy'}>{t.priority ?? 'Normal'}</span>

        {userRole === 'owner' && (
          confirmDeleteId === t.id
            ? <>
                <button className="btn btn-err btn-sm" disabled={deletingId === t.id}
                  onClick={e => { e.stopPropagation(); handleDeleteTask(t.id); }} style={{ fontSize: 11 }}>
                  {deletingId === t.id ? '…' : 'Confirm'}
                </button>
                <button className="btn btn-ghost btn-sm"
                  onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }} style={{ fontSize: 11 }}>
                  Cancel
                </button>
              </>
            : <button className="btn btn-ghost btn-sm"
                onClick={e => { e.stopPropagation(); setConfirmDeleteId(t.id); }}
                style={{ fontSize: 11, color: 'var(--err)', padding: '2px 6px' }}>
                🗑
              </button>
        )}
      </div>
    );
  }

  /* ── Daily task card ── */
  function DailyTaskCard({ def, type }: { def: DailyTaskDef; type: 'routine' | 'incentive' }) {
    const resp = myResponseMap[def.key];
    const isActive = !def.days || def.days.includes(todayDOW(today));
    const loading  = respondingKey === def.key;
    const meta     = resp ? RESP_META[resp.response] : null;

    return (
      <div style={{
        background: 'white', borderRadius: 12, padding: '18px 20px',
        border: `2px solid ${meta ? meta.border : 'oklch(0.90 0.01 260)'}`,
        opacity: isActive ? 1 : 0.45,
        transition: 'border-color 0.15s',
        position: 'relative',
      }}>
        {def.days && (
          <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.50 0.12 55)', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>
            {def.days.join(' / ')} only
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.3 }}>{def.title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.55, marginBottom: 16 }}>{def.description}</div>

        {/* Response area */}
        {isCx ? (
          isActive ? (
            resp ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: meta!.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta!.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: meta!.color }}>{meta!.label}</span>
                </div>
                <button disabled={loading} onClick={() => { setResponses(p => p.filter(r => !(r.agent_id === currentUserId && r.task_key === def.key))); }} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', padding: '4px 6px' }}>
                  undo
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                {(['yes', 'no', 'irrelevant'] as const).map(r => (
                  <button key={r} disabled={loading}
                    onClick={() => handleRespond(def.key, type, r)}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8, border: `1.5px solid ${RESP_META[r].border}`,
                      background: 'white', color: RESP_META[r].color, fontSize: 11, fontWeight: 700,
                      cursor: loading ? 'wait' : 'pointer', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = RESP_META[r].bg; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; }}>
                    {r === 'yes' ? '✓ Yes' : r === 'no' ? '✗ No' : '— N/A'}
                  </button>
                ))}
              </div>
            )
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ink-5)', fontStyle: 'italic' }}>Not required today</div>
          )
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>View only — agents mark their own responses</div>
        )}

        {/* Owner edit/delete */}
        {isMgmt && (
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
            <button onClick={() => { setEditingDef(def); setDefForm({ key: def.key, title: def.title, description: def.description, days: def.days?.join(', ') ?? '' }); setManagingType(type); setShowManage(true); }}
              style={{ fontSize: 11, padding: '2px 6px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 5, cursor: 'pointer', color: 'var(--ink-4)' }}>
              Edit
            </button>
            <button onClick={() => { if (confirm('Delete this task definition?')) { setManagingType(type); deleteDef(def.key); } }}
              style={{ fontSize: 11, padding: '2px 6px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 5, cursor: 'pointer', color: 'var(--err)' }}>
              ✕
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── Mgmt team report view ── */
  function TeamReport({ defs, type }: { defs: DailyTaskDef[]; type: 'routine' | 'incentive' }) {
    const activeDefs = defs.filter(d => !d.days || d.days.includes(todayDOW(today)));

    if (agentViewMode === 'agents') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cxUsers.length === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No CX agents found.</div>
          )}
          {cxUsers.map((u: any) => {
            const uresp = agentResponseMap[u.id] ?? {};
            const answered = activeDefs.filter(d => uresp[d.key]).length;
            const yes      = activeDefs.filter(d => uresp[d.key]?.response === 'yes').length;
            const no       = activeDefs.filter(d => uresp[d.key]?.response === 'no').length;
            const na       = activeDefs.filter(d => uresp[d.key]?.response === 'irrelevant').length;
            const pct      = activeDefs.length > 0 ? Math.round((answered / activeDefs.length) * 100) : 0;
            const hue      = (u.name.charCodeAt(0) * 13) % 360;
            return (
              <div key={u.id} style={{ background: 'white', borderRadius: 10, padding: '14px 18px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div className="av-circle" style={{ width: 36, height: 36, fontSize: 12, flexShrink: 0, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                    {initials(u.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{answered}/{activeDefs.length} answered · {pct}% complete</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {yes > 0  && <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'oklch(0.93 0.06 145)', color: 'oklch(0.36 0.15 145)' }}>✓ {yes}</span>}
                    {no > 0   && <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'oklch(0.93 0.06 25)',  color: 'oklch(0.40 0.20 25)'  }}>✗ {no}</span>}
                    {na > 0   && <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'oklch(0.94 0.01 260)', color: 'oklch(0.45 0.02 260)' }}>— {na}</span>}
                    {answered === 0 && <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--ink-4)' }}>Pending</span>}
                  </div>
                </div>
                {/* Task dot row */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {activeDefs.map(d => {
                    const r = uresp[d.key];
                    const bg = r ? RESP_META[r.response].dot : 'oklch(0.88 0.01 260)';
                    return (
                      <div key={d.key} title={`${d.title}: ${r?.response ?? 'not answered'}`}
                        style={{ width: 10, height: 10, borderRadius: '50%', background: bg, flexShrink: 0 }} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Task-by-task view
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeDefs.map(def => {
          const yes  = cxUsers.filter((u: any) => agentResponseMap[u.id]?.[def.key]?.response === 'yes').length;
          const no   = cxUsers.filter((u: any) => agentResponseMap[u.id]?.[def.key]?.response === 'no').length;
          const na   = cxUsers.filter((u: any) => agentResponseMap[u.id]?.[def.key]?.response === 'irrelevant').length;
          const none = cxUsers.length - yes - no - na;
          return (
            <div key={def.key} style={{ background: 'white', borderRadius: 10, padding: '14px 18px', border: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>{def.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 12 }}>{def.description}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {yes > 0  && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: 'oklch(0.93 0.06 145)', color: 'oklch(0.36 0.15 145)' }}>✓ Yes · {yes}</span>}
                {no > 0   && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: 'oklch(0.93 0.06 25)',  color: 'oklch(0.40 0.20 25)'  }}>✗ No · {no}</span>}
                {na > 0   && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: 'oklch(0.94 0.01 260)', color: 'oklch(0.45 0.02 260)' }}>— N/A · {na}</span>}
                {none > 0 && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--ink-4)' }}>Pending · {none}</span>}
                {/* Agent dots */}
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  {cxUsers.map((u: any) => {
                    const r = agentResponseMap[u.id]?.[def.key];
                    const bg = r ? RESP_META[r.response].dot : 'oklch(0.88 0.01 260)';
                    const hue = (u.name.charCodeAt(0) * 13) % 360;
                    return (
                      <div key={u.id} title={`${u.name}: ${r?.response ?? 'pending'}`}
                        style={{ width: 22, height: 22, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {initials(u.name)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ── Daily section (routine or incentive) ── */
  function DailySection({ defs, type, color }: { defs: DailyTaskDef[]; type: 'routine' | 'incentive'; color: string }) {
    const prog   = myProgress(defs, type);
    const active = defs.filter(d => !d.days || d.days.includes(todayDOW(today)));

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color, textTransform: 'uppercase', marginBottom: 4 }}>
              {type === 'routine' ? 'Daily Routine · Basic Salary Tasks' : 'Daily Incentives · Bonus Tasks'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.5 }}>
              {fmtDate(today)}
            </div>
            {isCx && (
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 4 }}>
                {prog.answered}/{prog.total} answered · {prog.yes} Yes
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isMgmt && (
              <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
                {(['agents', 'tasks'] as const).map(m => (
                  <button key={m} onClick={() => setAgentViewMode(m)}
                    style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: agentViewMode === m ? 'white' : 'transparent', color: agentViewMode === m ? 'var(--ink)' : 'var(--ink-4)', boxShadow: agentViewMode === m ? 'var(--sh-1)' : 'none', textTransform: 'capitalize' }}>
                    {m === 'agents' ? 'By Agent' : 'By Task'}
                  </button>
                ))}
              </div>
            )}
            {isMgmt && (
              <button className="btn btn-sec btn-sm" onClick={() => { setManagingType(type); setEditingDef(null); setDefForm({ key: '', title: '', description: '', days: '' }); setShowManage(true); }}>
                + Add task
              </button>
            )}
          </div>
        </div>

        {/* Progress bar (CX only) */}
        {isCx && prog.total > 0 && (
          <div style={{ marginBottom: 20, height: 6, background: 'oklch(0.92 0.01 260)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(prog.yes / prog.total) * 100}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        )}

        {/* Content */}
        {isCx ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {active.length === 0
              ? <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--ink-4)', fontSize: 13 }}>No tasks active today.</div>
              : active.map(def => <DailyTaskCard key={def.key} def={def} type={type} />)
            }
          </div>
        ) : (
          <TeamReport defs={defs} type={type} />
        )}
      </div>
    );
  }

  /* ── Section nav badge ── */
  function navBadge(count: number, color: string) {
    if (!count) return null;
    return <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: color, color: 'white', marginLeft: 4 }}>{count}</span>;
  }

  const routineUnanswered  = routineProgress.total  - routineProgress.answered;
  const incentiveUnanswered = incentiveProgress.total - incentiveProgress.answered;

  /* ════════════════════════════════════════════════════════════
     Main render
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="page-fade">

      {/* ── Section tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface-2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {([
          { id: 'assigned',  label: 'Assigned Tasks' },
          { id: 'group',     label: 'Group Tasks' },
          { id: 'routine',   label: 'Daily Routine',  badge: isCx ? routineUnanswered : 0,  bcolor: 'oklch(0.50 0.18 145)' },
          { id: 'incentive', label: 'Incentives',      badge: isCx ? incentiveUnanswered : 0, bcolor: 'oklch(0.50 0.20 25)'  },
        ] as const).map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{
              padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: section === s.id ? 'white' : 'transparent',
              color: section === s.id ? 'var(--ink)' : 'var(--ink-4)',
              boxShadow: section === s.id ? 'var(--sh-1)' : 'none',
              display: 'flex', alignItems: 'center',
            }}>
            {s.label}
            {'badge' in s && s.badge > 0 && navBadge(s.badge, (s as any).bcolor)}
          </button>
        ))}
      </div>

      {/* ════════════ ASSIGNED TASKS ════════════ */}
      {section === 'assigned' && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            {[
              { ico: '☑', cls: 'ind', label: 'TOTAL',       val: assignedTasks.length, foot: 'Normal tasks' },
              { ico: '◯', cls: 'wn',  label: 'OPEN',        val: assignedTasks.filter(t => !t.completed).length, foot: 'Pending' },
              { ico: '⚠', cls: 'er',  label: 'HIGH',        val: assignedTasks.filter(t => !t.completed && t.priority === 'High').length, foot: 'Urgent' },
              { ico: '✓', cls: 'ok',  label: 'COMPLETED',   val: assignedTasks.filter(t => t.completed).length, foot: 'Finished' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ cursor: 'default' }}>
                <div className="stat-h"><div className={`stat-ico ${s.cls}`}>{s.ico}</div></div>
                <div className="stat-l">{s.label}</div>
                <div className="stat-v" style={s.cls === 'er' ? { color: 'var(--err)' } : {}}>{s.val}</div>
                <div className="stat-foot">{s.foot}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-hdr">
              <div>
                <div className="card-title">{isMgmt ? 'All Assigned Tasks' : 'My Assigned Tasks'}</div>
                <div className="card-sub">{assignedTasks.filter(t=>!t.completed).length} open · {assignedTasks.filter(t=>t.completed).length} done</div>
              </div>
              {isMgmt && (
                <button className="btn btn-acc btn-sm" onClick={() => { setAssignType('normal'); setShowAssign(true); }}>+ Assign Task</button>
              )}
            </div>
            <div style={{ padding: '0 18px 12px' }}>
              <div className="tabs">
                {TABS.map(t => (
                  <button key={t.id} className={`tab${filterTab === t.id ? ' active' : ''}`} onClick={() => setFilterTab(t.id)}>
                    {t.label} <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>{t.count}</span>
                  </button>
                ))}
              </div>
            </div>
            {filteredAssigned.length === 0
              ? <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No tasks in this view.</div>
              : <div style={{ padding: '0 18px 18px' }}>{filteredAssigned.map(t => <TaskRow key={t.id} t={t} />)}</div>
            }
          </div>
        </>
      )}

      {/* ════════════ GROUP TASKS ════════════ */}
      {section === 'group' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">Group Tasks</div>
              <div className="card-sub">Shared tasks requiring both people to mark done · {groupTasks.filter(t=>!(t.completed&&t.group_confirmed)).length} open</div>
            </div>
            {isMgmt && (
              <button className="btn btn-acc btn-sm" onClick={() => { setAssignType('group'); setShowAssign(true); }}>+ Group Task</button>
            )}
          </div>
          {groupTasks.length === 0
            ? <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No group tasks yet.</div>
            : <div style={{ padding: '0 18px 18px' }}>{groupTasks.map(t => <TaskRow key={t.id} t={t} showGroupInfo />)}</div>
          }
        </div>
      )}

      {/* ════════════ DAILY ROUTINE ════════════ */}
      {section === 'routine' && (
        <DailySection defs={routineDefs} type="routine" color="oklch(0.50 0.18 145)" />
      )}

      {/* ════════════ INCENTIVES ════════════ */}
      {section === 'incentive' && (
        <DailySection defs={incentiveDefs} type="incentive" color="oklch(0.50 0.20 25)" />
      )}

      {/* ════════════ TASK DETAIL MODAL ════════════ */}
      {viewTask && (() => {
        const isOverdue = viewTask.due_date && !viewTask.completed && new Date(viewTask.due_date) < new Date();
        const hue = ((viewTask.assigned_user?.name ?? 'U').charCodeAt(0) * 13) % 360;
        const isGroup = viewTask.task_type === 'group';
        const fullyDone = isGroup ? (viewTask.completed && viewTask.group_confirmed) : viewTask.completed;
        const halfDone  = isGroup && (viewTask.completed || viewTask.group_confirmed) && !fullyDone;
        const canComplete = viewTask.assigned_to === currentUserId && !viewTask.completed;
        const canConfirm  = isGroup && viewTask.second_assigned_to === currentUserId && viewTask.completed && !viewTask.group_confirmed;
        return (
          <div className="mb" onClick={e => { if (e.target === e.currentTarget) { setViewTask(null); setConfirmDeleteId(null); } }}>
            <div className="md" style={{ width: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4, textDecoration: fullyDone ? 'line-through' : 'none' }}>{viewTask.title}</div>
                      {isGroup && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: 'oklch(0.93 0.04 260)', color: 'oklch(0.40 0.12 260)' }}>GROUP</span>}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setViewTask(null); setConfirmDeleteId(null); }}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <span className={PRIORITY_BADGE[viewTask.priority] ?? 'bdg bdg-gy'}>{viewTask.priority ?? 'Normal'}</span>
                  {fullyDone ? <span className="bdg bdg-ok">✓ Complete</span>
                    : halfDone ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'oklch(0.93 0.06 55)', color: 'oklch(0.45 0.14 55)' }}>½ Partially done</span>
                    : <span className="bdg bdg-acc">Open</span>}
                  {isOverdue && <span className="bdg bdg-err">Overdue</span>}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 13, color: viewTask.description ? 'var(--ink)' : 'var(--ink-4)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {viewTask.description || 'No description provided.'}
                  </div>
                </div>

                {/* Group progress */}
                {isGroup && (
                  <div style={{ background: 'oklch(0.96 0.02 260)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Group progress</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: viewTask.completed ? 'oklch(0.93 0.06 145)' : 'white', border: `1px solid ${viewTask.completed ? 'oklch(0.80 0.10 145)' : 'var(--line)'}` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: viewTask.completed ? 'oklch(0.36 0.15 145)' : 'var(--ink-4)', marginBottom: 2 }}>PRIMARY</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{viewTask.assigned_user?.name ?? nameMap[viewTask.assigned_to] ?? '?'}</div>
                        <div style={{ fontSize: 11, color: viewTask.completed ? 'oklch(0.36 0.15 145)' : 'var(--ink-4)', marginTop: 2 }}>{viewTask.completed ? '✓ Done' : 'Pending'}</div>
                      </div>
                      <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: viewTask.group_confirmed ? 'oklch(0.93 0.06 145)' : 'white', border: `1px solid ${viewTask.group_confirmed ? 'oklch(0.80 0.10 145)' : 'var(--line)'}` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: viewTask.group_confirmed ? 'oklch(0.36 0.15 145)' : 'var(--ink-4)', marginBottom: 2 }}>SECOND</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{nameMap[viewTask.second_assigned_to] ?? '?'}</div>
                        <div style={{ fontSize: 11, color: viewTask.group_confirmed ? 'oklch(0.36 0.15 145)' : 'var(--ink-4)', marginTop: 2 }}>{viewTask.group_confirmed ? '✓ Confirmed' : 'Waiting'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {viewTask.completed && (viewTask.completion_note || viewTask.completion_file_url) && (
                  <div style={{ background: 'oklch(0.96 0.04 145)', border: '1px solid oklch(0.88 0.07 145)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.42 0.12 155)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Completion note</div>
                    {viewTask.completion_note && <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{viewTask.completion_note}</div>}
                    {viewTask.completion_file_url && (
                      <a href={viewTask.completion_file_url} target="_blank" rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'oklch(0.42 0.14 268)', fontWeight: 500, textDecoration: 'none', marginTop: 6 }}>
                        📎 {viewTask.completion_file_name ?? 'Attachment'}
                      </a>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Assigned to</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{viewTask.assigned_user?.name ?? '—'}</div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Assigned by</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{viewTask.by_user?.name ?? '—'}</div>
                  </div>
                  {viewTask.due_date && (
                    <div style={{ background: isOverdue ? 'var(--err-soft)' : 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Due date</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: isOverdue ? 'var(--err)' : 'var(--ink)' }}>
                        {new Date(viewTask.due_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', padding: '12px 20px', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                {canComplete && (
                  <button className="btn btn-acc btn-sm" onClick={() => openCompletionModal(viewTask)}>✓ Mark Complete</button>
                )}
                {canConfirm && (
                  <button className="btn btn-sm" style={{ background: 'oklch(0.93 0.06 145)', color: 'oklch(0.36 0.15 145)', border: '1px solid oklch(0.80 0.10 145)' }}
                    onClick={() => openCompletionModal(viewTask)}>✓ Confirm My Part</button>
                )}
                {fullyDone && isMgmt && (
                  <button className="btn btn-sec btn-sm" onClick={() => handleReopen(viewTask)}>↩ Reopen</button>
                )}
                {userRole === 'owner' && (
                  confirmDeleteId === viewTask.id
                    ? <>
                        <button className="btn btn-err btn-sm" disabled={!!deletingId} onClick={() => handleDeleteTask(viewTask.id)}>
                          {deletingId ? 'Deleting…' : 'Confirm Delete'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                      </>
                    : <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(viewTask.id)} style={{ color: 'var(--err)' }}>
                        🗑 Delete
                      </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => { setViewTask(null); setConfirmDeleteId(null); }} style={{ marginLeft: 'auto' }}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════════════ COMPLETION MODAL ════════════ */}
      {completingTask && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) { setCompletingTask(null); setCompletionFile(null); setCompletionNote(''); } }}>
          <div className="md" style={{ width: 460 }}>
            <div className="md-t">
              {completingTask.task_type === 'group' && completingTask.second_assigned_to === currentUserId
                ? 'Confirm Your Part'
                : 'Complete Task'}
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
              {completingTask.title}
            </div>
            <div className="pv-fld">
              <label>Note <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>(optional)</span></label>
              <textarea rows={3} placeholder="Describe what was done…" value={completionNote} onChange={e => setCompletionNote(e.target.value)} />
            </div>
            <div className="pv-fld">
              <label>Attachment <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>(optional)</span></label>
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={e => setCompletionFile(e.target.files?.[0] ?? null)} />
              {completionFile && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 5 }}>📎 {completionFile.name}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-acc" disabled={completionUploading} onClick={() => submitCompletion(completionNote, completionFile)}>
                {completionUploading ? 'Uploading…' : '✓ Submit'}
              </button>
              <button className="btn btn-sec" disabled={completionUploading} onClick={() => submitCompletion(null, null)}>Skip &amp; Complete</button>
              <button className="btn btn-ghost" disabled={completionUploading} onClick={() => { setCompletingTask(null); setCompletionFile(null); setCompletionNote(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ ASSIGN TASK MODAL ════════════ */}
      {showAssignModal && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) setShowAssign(false); }}>
          <div className="md" style={{ width: 460 }}>
            <div className="md-t">{assignType === 'group' ? 'Assign Group Task' : 'Assign Task'}</div>
            {/* Type toggle */}
            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, gap: 2, marginBottom: 16 }}>
              {(['normal', 'group'] as const).map(t => (
                <button key={t} onClick={() => setAssignType(t)}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: assignType === t ? 'white' : 'transparent', color: assignType === t ? 'var(--ink)' : 'var(--ink-4)', boxShadow: assignType === t ? 'var(--sh-1)' : 'none', textTransform: 'capitalize' }}>
                  {t === 'normal' ? 'Normal Task' : 'Group Task'}
                </button>
              ))}
            </div>
            <form onSubmit={handleAssign}>
              <input type="hidden" name="task_type" value={assignType} />
              <div className="pv-fld">
                <label>Assign to {assignType === 'group' ? '(Primary)' : ''}</label>
                <select name="assigned_to" required>
                  <option value="">— Choose employee —</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              {assignType === 'group' && (
                <div className="pv-fld">
                  <label>Assign to (Second person)</label>
                  <select name="second_assigned_to">
                    <option value="">— Choose second person —</option>
                    {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
              )}
              <div className="pv-fld"><label>Task title</label><input type="text" name="title" required placeholder="e.g. Follow up with client X" /></div>
              <div className="pv-fld"><label>Description <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>(optional)</span></label><textarea name="description" rows={3} /></div>
              <div className="pv-fld"><label>Due Date</label><input type="date" name="due_date" required /></div>
              <div className="pv-fld">
                <label>Priority</label>
                <select name="priority"><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={saving}>{saving ? 'Saving…' : assignType === 'group' ? 'Create Group Task' : 'Assign Task'}</button>
                <button type="button" className="btn btn-sec" onClick={() => setShowAssign(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════ MANAGE TASK DEFINITION MODAL ════════════ */}
      {showManage && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) { setShowManage(false); setEditingDef(null); } }}>
          <div className="md" style={{ width: 480 }}>
            <div className="md-t">{editingDef ? 'Edit Task Definition' : `Add ${managingType === 'routine' ? 'Routine' : 'Incentive'} Task`}</div>
            <div className="pv-fld">
              <label>Title</label>
              <input value={defForm.title} onChange={e => setDefForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. The Welcome Process" required />
            </div>
            <div className="pv-fld">
              <label>Description</label>
              <textarea rows={4} value={defForm.description} onChange={e => setDefForm(p => ({ ...p, description: e.target.value }))} placeholder="Full task description agents will see…" />
            </div>
            <div className="pv-fld">
              <label>Specific days only <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>(leave blank = every day)</span></label>
              <input value={defForm.days} onChange={e => setDefForm(p => ({ ...p, days: e.target.value }))} placeholder="e.g. Friday  or  Monday, Wednesday" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" disabled={savingDef || !defForm.title.trim()} onClick={saveDef}>
                {savingDef ? 'Saving…' : editingDef ? 'Save Changes' : 'Add Task'}
              </button>
              <button className="btn btn-sec" onClick={() => { setShowManage(false); setEditingDef(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
