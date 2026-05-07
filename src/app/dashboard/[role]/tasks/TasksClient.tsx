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
}: {
  initialTasks: any[];
  users: any[];
  isMgmt: boolean;
  currentUserId: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
      title: fd.get('title') as string,
      assigned_to: assignedTo,
      assigned_by: currentUserId,
      due_date: fd.get('due_date') as string,
      priority: fd.get('priority') as string,
      completed: false,
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
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                    borderBottom: '1px solid var(--line-2)',
                    opacity: t.completed ? 0.55 : 1,
                  }}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTask(t)}
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
                </div>
              );
            })}
          </div>
        )}
      </div>

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
