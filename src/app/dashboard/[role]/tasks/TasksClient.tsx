'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function TasksClient({ initialTasks, users, isMgmt, currentUserId }: { initialTasks: any[], users: any[], isMgmt: boolean, currentUserId: string }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const supabase = createClient();

  const toggleTask = async (task: any) => {
    const newStatus = !task.completed;
    await supabase.from('tasks').update({ completed: newStatus }).eq('id', task.id);
    setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: newStatus } : t));
  };

  const handleAssign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newTask = {
      title: formData.get('title') as string,
      assigned_to: formData.get('assigned_to') as string,
      assigned_by: currentUserId,
      due_date: formData.get('due_date') as string,
      priority: formData.get('priority') as string,
    };

    const { data } = await supabase.from('tasks').insert([newTask]).select(`*, assigned_user:profiles!tasks_assigned_to_fkey(name), by_user:profiles!tasks_assigned_by_fkey(name)`);
    if (data && data[0]) {
      setTasks([data[0], ...tasks]);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="pn">
        <div className="pn-h">
          <div className="pn-t">{isMgmt ? 'All Tasks' : 'My Tasks'}</div>
          {isMgmt && <button className="pv-btn pv-btn-pri" onClick={() => setIsModalOpen(true)}>+ Assign task</button>}
        </div>
        
        {tasks.length === 0 && <div className="empty">No tasks found.</div>}
        
        {tasks.map(t => (
          <div key={t.id} className="r-cd">
            <div onClick={() => toggleTask(t)} style={{ 
              width: '20px', height: '20px', borderRadius: '5px', 
              border: `1.5px solid ${t.completed ? '#10b981' : '#cbd2e0'}`, 
              background: t.completed ? '#10b981' : '#fff', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: '#fff', fontSize: '11px', cursor: 'pointer' 
            }}>
              {t.completed ? '✓' : ''}
            </div>
            
            <div style={{ flex: 1, opacity: t.completed ? 0.5 : 1, textDecoration: t.completed ? 'line-through' : 'none' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>
                → {t.assigned_user?.name || 'Unknown'} · By {t.by_user?.name || 'Unknown'} · Due {new Date(t.due_date).toLocaleDateString()}
              </div>
            </div>
            
            <span className={`pv-bdg ${t.priority === 'High' ? 'pv-bdg-red' : t.priority === 'Medium' ? 'pv-bdg-amber' : 'pv-bdg-gray'}`}>
              {t.priority}
            </span>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="mb" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="md" style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '420px', maxWidth: '100%' }}>
            <div className="md-t" style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Assign task</div>
            <form onSubmit={handleAssign}>
              <div className="pv-fld">
                <label>Assign to</label>
                <select name="assigned_to" required>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="pv-fld"><label>Title</label><input type="text" name="title" required /></div>
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
                <button type="submit" className="pv-btn pv-btn-pri">Assign</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setIsModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
