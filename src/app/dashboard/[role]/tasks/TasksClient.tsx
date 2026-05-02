'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

export default function TasksClient({ initialTasks, users, isMgmt, currentUserId }: { initialTasks: any[], users: any[], isMgmt: boolean, currentUserId: string }) {
  const [tasks, setTasks] = useState(initialTasks);
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

  return (
    <>
      <div className="pn">
        <div className="pn-h" style={{ marginBottom: '14px' }}>
          <div>
            <div className="pn-t">{isMgmt ? 'All Tasks' : 'My Tasks'}</div>
            <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>{open.length} open · {done.length} completed</div>
          </div>
          {isMgmt && <button className="pv-btn pv-btn-pri" onClick={() => setIsModalOpen(true)}>+ Assign Task</button>}
        </div>

        {tasks.length === 0 && <div className="empty">No tasks found.</div>}

        {open.map(t => (
          <div key={t.id} className="r-cd">
            <div
              onClick={() => toggleTask(t)}
              style={{ width: '20px', height: '20px', borderRadius: '5px', border: '1.5px solid #cbd2e0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>
                → {t.assigned_user?.name ?? '—'} · By {t.by_user?.name ?? '—'} · Due {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
              </div>
            </div>
            <span className={`pv-bdg ${t.priority === 'High' ? 'pv-bdg-red' : t.priority === 'Medium' ? 'pv-bdg-amber' : 'pv-bdg-gray'}`}>
              {t.priority ?? 'Normal'}
            </span>
          </div>
        ))}

        {done.length > 0 && (
          <>
            <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', padding: '12px 0 6px', marginTop: '4px' }}>Completed</div>
            {done.map(t => (
              <div key={t.id} className="r-cd" style={{ opacity: 0.5 }}>
                <div
                  onClick={() => toggleTask(t)}
                  style={{ width: '20px', height: '20px', borderRadius: '5px', border: '1.5px solid #10b981', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}
                >✓</div>
                <div style={{ flex: 1, textDecoration: 'line-through' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: '11px', color: '#6b7689' }}>→ {t.assigned_user?.name ?? '—'}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '420px', maxWidth: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Assign Task</div>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={saving}>{saving ? 'Saving...' : 'Assign'}</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setIsModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
