'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

export default function TicketsClient({ initialTickets, isMgmt, currentUserId }: { initialTickets: any[], isMgmt: boolean, currentUserId: string }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleResolve = async (id: string) => {
    const { error } = await dbOp('tickets', 'update', { status: 'Resolved' }, { id });
    if (!error) setTickets(tickets.map(t => t.id === id ? { ...t, status: 'Resolved' } : t));
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    const formData = new FormData(e.currentTarget);
    const newTicket = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      priority: formData.get('priority') as string,
      user_id: currentUserId,
      status: 'Open',
    };

    const { data, error } = await dbOp('tickets', 'insert', newTicket, undefined, '*, profiles(name)');
    if (error) {
      setSubmitError(error || 'Failed to submit ticket. Please try again.');
      setIsSubmitting(false);
      return;
    }
    if (data && data[0]) setTickets([data[0], ...tickets]);
    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="pn">
        <div className="pn-h">
          <div className="pn-t">{isMgmt ? 'All Tickets' : 'My Tickets'}</div>
          <button className="pv-btn pv-btn-pri" onClick={() => setIsModalOpen(true)}>+ New ticket</button>
        </div>
        
        {tickets.length === 0 && <div className="empty">No tickets found.</div>}
        
        {tickets.map(t => (
          <div key={t.id} className="r-cd">
            <div style={{ 
              width: '34px', height: '34px', borderRadius: '8px', 
              background: t.status === 'Resolved' ? '#ecfdf5' : '#fee2e2', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: t.status === 'Resolved' ? '#10b981' : '#dc2626' 
            }}>
              {t.status === 'Resolved' ? '✓' : '⚠'}
            </div>
            
            <div style={{ flex: 1, opacity: t.status === 'Resolved' ? 0.6 : 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>
                {isMgmt && <span>From {t.profiles?.name || 'Unknown'} · </span>} 
                {new Date(t.created_at).toLocaleString()}
              </div>
            </div>
            
            <span className={`pv-bdg ${t.priority === 'High' ? 'pv-bdg-red' : t.priority === 'Medium' ? 'pv-bdg-amber' : 'pv-bdg-gray'}`}>
              {t.priority}
            </span>
            <span className={`pv-bdg ${t.status === 'Resolved' ? 'pv-bdg-green' : 'pv-bdg-indigo'}`}>
              {t.status}
            </span>

            {isMgmt && t.status === 'Open' && (
              <button className="pv-btn pv-btn-sec" onClick={() => handleResolve(t.id)}>Resolve</button>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="mb" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="md" style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '420px', maxWidth: '100%' }}>
            <div className="md-t" style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Create Support Ticket</div>
            <form onSubmit={handleCreate}>
              <div className="pv-fld"><label>Issue Title</label><input type="text" name="title" required /></div>
              <div className="pv-fld">
                <label>Priority</label>
                <select name="priority">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div className="pv-fld"><label>Description</label><textarea name="description" rows={4} required></textarea></div>
              {submitError && (
                <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '8px' }}>
                  {submitError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => { setIsModalOpen(false); setSubmitError(''); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
