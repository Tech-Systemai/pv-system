'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

type FilterTab = 'all' | 'open' | 'high' | 'done';

const PRIORITY_BADGE: Record<string, string> = {
  High: 'bdg bdg-err',
  Medium: 'bdg bdg-warn',
  Low: 'bdg bdg-gy',
};

export default function TasksClient({
  initialTasks,
  users,
  isMgmt,
  currentUserId,
  userRole,
}: {
  initialTasks: any[];
  users: any[];
  isMgmt: boolean;
  currentUserId: string;
  userRole: string;
}) {
  const [tasks, setTasks]           = useState(initialTasks);
  const [filterTab, setFilterTab]   = useState<FilterTab>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [viewTask, setViewTask]     = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteTask = async (taskId: string) => {
    setDeletingId(taskId);
    await dbOp('tasks', 'delete', undefined, { id: taskId });
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (viewTask?.id === taskId) setViewTask(null);
    setConfirmDeleteId(null);
    setDeletingId(null);
  };

  const handleToggleFromDetail = async (task: any) => {
    const completed = !task.completed;
    await dbOp('tasks', 'update', { completed }, { id: task.id });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed } : t));
    setViewTask((prev: any) => ({ ...prev, completed }));
  };

  const toggleTask = async (task: any) => {
    const completed = !task.completed;
    await dbOp('tasks', 'update', { completed }, { id: task.id });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed } : t));
  };

  const handleAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const assignedTo = fd.get('assigned_to') as string;
    const newTask = {
      title:       fd.get('title') as string,
      description: (fd.get('description') as string) || null,
      assigned_to: assignedTo,
      assigned_by: currentUserId,
      due_date:    fd.get('due_date') as string,
      priority:    fd.get('priority') as string,
      completed:   false,
    };
    const { data } = await dbOp('tasks', 'insert', newTask);
    if (data?.[0]) {
      const assignedUser = users.find(u => u.id === assignedTo);
      const byUser = users.find(u => u.id === currentUserId);
      setTasks(prev => [{
        ...data[0],
        assigned_user: { name: assignedUser?.name ?? '—' },
        by_user: { name: byUser?.name ?? '—' },
      }, ...prev]);
    }
    setIsModalOpen(false);
    setSaving(false);
    (e.target as HTMLFormElement).reset();
  };

  const open = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);
  const high = tasks.filter(t => !t.completed && t.priority === 'High');

  const TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: tasks.length },
    { id: 'open', label: 'Open', count: open.length },
    { id: 'high', label: 'High Priority', count: high.length },
    { id: 'done', label: 'Done', count: done.length },
  ];

  const filtered = filterTab === 'all' ? tasks
    : filterTab === 'open' ? open
    : filterTab === 'high' ? high
    : done;

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">☑</div></div>
          <div className="stat-l">TOTAL TASKS</div>
          <div className="stat-v">{tasks.length}</div>
          <div className="stat-foot">All assigned tasks</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">◯</div></div>
          <div className="stat-l">OPEN</div>
          <div className="stat-v">{open.length}</div>
          <div className="stat-foot">Pending completion</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico er">⚠</div></div>
          <div className="stat-l">HIGH PRIORITY</div>
          <div className="stat-v" style={{ color: 'var(--err)' }}>{high.length}</div>
          <div className="stat-foot">Urgent open tasks</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">COMPLETED</div>
          <div className="stat-v">{done.length}</div>
          <div className="stat-foot">Finished tasks</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">{isMgmt ? 'All Tasks' : 'My Tasks'}</div>
            <div className="card-sub">{open.length} open · {done.length} completed</div>
          </div>
          {isMgmt && (
            <button className="btn btn-acc btn-sm" onClick={() => setIsModalOpen(true)}>+ Assign Task</button>
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

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No tasks in this view.
          </div>
        ) : (
          <div style={{ padding: '0 18px 18px' }}>
            {filtered.map(t => {
              const hue = ((t.assigned_user?.name ?? 'U').charCodeAt(0) * 13) % 360;
              const isOverdue = t.due_date && !t.completed && new Date(t.due_date) < new Date();
              return (
                <div
                  key={t.id}
                  onClick={() => setViewTask(t)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                    borderBottom: '1px solid var(--line-2)',
                    opacity: t.completed ? 0.55 : 1,
                    cursor: 'pointer',
                  }}
                >
                  {/* Checkbox */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleTask(t); }}
                    style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: t.completed ? 'none' : '1.5px solid var(--line)',
                      background: t.completed ? 'var(--ok)' : 'var(--surface)',
                      color: '#fff', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .12s',
                    }}
                  >{t.completed ? '✓' : ''}</button>

                  {/* Avatar */}
                  <div className="av-circle" style={{ width: 30, height: 30, fontSize: 10, flexShrink: 0, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                    {(t.assigned_user?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, textDecoration: t.completed ? 'line-through' : 'none', color: t.completed ? 'var(--ink-3)' : 'var(--ink)' }}>{t.title}</div>
                    {t.description && (
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                      → {t.assigned_user?.name ?? '—'} · By {t.by_user?.name ?? '—'}
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
                          <button
                            className="btn btn-err btn-sm"
                            disabled={deletingId === t.id}
                            onClick={e => { e.stopPropagation(); handleDeleteTask(t.id); }}
                            style={{ fontSize: 11 }}
                          >
                            {deletingId === t.id ? '…' : 'Confirm'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                            style={{ fontSize: 11 }}
                          >
                            Cancel
                          </button>
                        </>
                      : <button
                          className="btn btn-ghost btn-sm"
                          onClick={e => { e.stopPropagation(); setConfirmDeleteId(t.id); }}
                          style={{ fontSize: 11, color: 'var(--err)', padding: '2px 6px' }}
                        >
                          🗑
                        </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Task detail modal ── */}
      {viewTask && (() => {
        const isOverdue = viewTask.due_date && !viewTask.completed && new Date(viewTask.due_date) < new Date();
        const hue = ((viewTask.assigned_user?.name ?? 'U').charCodeAt(0) * 13) % 360;
        return (
          <div className="mb" onClick={e => { if (e.target === e.currentTarget) { setViewTask(null); setConfirmDeleteId(null); } }}>
            <div className="md" style={{ width: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4, flex: 1, textDecoration: viewTask.completed ? 'line-through' : 'none' }}>
                    {viewTask.title}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setViewTask(null); setConfirmDeleteId(null); }} style={{ flexShrink: 0 }}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className={PRIORITY_BADGE[viewTask.priority] ?? 'bdg bdg-gy'}>{viewTask.priority ?? 'Normal'}</span>
                  {viewTask.completed
                    ? <span className="bdg bdg-ok">✓ Completed</span>
                    : <span className="bdg bdg-acc">Open</span>}
                  {isOverdue && <span className="bdg bdg-err">Overdue</span>}
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Description */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 13, color: viewTask.description ? 'var(--ink)' : 'var(--ink-4)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {viewTask.description || 'No description provided.'}
                  </div>
                </div>

                {/* Meta grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Assigned to</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="av-circle" style={{ width: 24, height: 24, fontSize: 9, flexShrink: 0, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                        {(viewTask.assigned_user?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{viewTask.assigned_user?.name ?? '—'}</span>
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Assigned by</div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{viewTask.by_user?.name ?? '—'}</span>
                  </div>
                  {viewTask.due_date && (
                    <div style={{ background: isOverdue ? 'var(--err-soft)' : 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Due date</div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: isOverdue ? 'var(--err)' : 'var(--ink)' }}>
                        {new Date(viewTask.due_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        {isOverdue && ' (overdue)'}
                      </span>
                    </div>
                  )}
                  <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Created</div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      {new Date(viewTask.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div style={{ borderTop: '1px solid var(--line)', padding: '12px 20px', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className={viewTask.completed ? 'btn btn-sec btn-sm' : 'btn btn-acc btn-sm'}
                  onClick={() => handleToggleFromDetail(viewTask)}
                >
                  {viewTask.completed ? '↩ Reopen' : '✓ Mark Complete'}
                </button>

                {userRole === 'owner' && (
                  confirmDeleteId === viewTask.id
                    ? <>
                        <button className="btn btn-err btn-sm" disabled={deletingId === viewTask.id} onClick={() => handleDeleteTask(viewTask.id)}>
                          {deletingId === viewTask.id ? 'Deleting…' : 'Confirm Delete'}
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

      {/* Assign Task modal */}
      {isModalOpen && (
        <div className="mb">
          <div className="md" style={{ width: 420 }}>
            <div className="md-t">Assign Task</div>
            <form onSubmit={handleAssign}>
              <div className="pv-fld">
                <label>Assign to</label>
                <select name="assigned_to" required>
                  <option value="">— Choose employee —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div className="pv-fld"><label>Task title</label><input type="text" name="title" required placeholder="e.g. Follow up with client X" /></div>
              <div className="pv-fld"><label>Description <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>(optional)</span></label><textarea name="description" rows={3} placeholder="Additional details or instructions…" /></div>
              <div className="pv-fld"><label>Due Date</label><input type="date" name="due_date" required /></div>
              <div className="pv-fld">
                <label>Priority</label>
                <select name="priority">
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={saving}>{saving ? 'Saving…' : 'Assign Task'}</button>
                <button type="button" className="btn btn-sec" onClick={() => setIsModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
