'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

export default function TicketsClient({
  initialTickets,
  isMgmt,
  currentUserId,
  allUsers,
}: {
  initialTickets: any[];
  isMgmt: boolean;
  currentUserId: string;
  allUsers?: any[];
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const open = tickets.filter(t => t.status !== 'Resolved');
  const resolved = tickets.filter(t => t.status === 'Resolved');

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    const fd = new FormData(e.currentTarget);
    const newTicket = {
      subject: fd.get('subject') as string,
      description: fd.get('description') as string,
      priority: fd.get('priority') as string,
      user_id: currentUserId,
      status: 'Open',
    };
    const { data, error } = await dbOp('tickets', 'insert', newTicket, undefined, '*, profiles(name)');
    if (error) {
      setSubmitError(error);
      setIsSubmitting(false);
      return;
    }
    if (data?.[0]) setTickets([data[0], ...tickets]);
    setIsSubmitting(false);
    setIsModalOpen(false);
    (e.target as HTMLFormElement).reset();
  };

  const handleReplyAndResolve = async () => {
    if (!viewTicket || !replyText.trim()) return;
    setIsReplying(true);

    // Send reply to ticket creator's inbox
    await dbOp('inbox_documents', 'insert', {
      user_id: viewTicket.user_id,
      title: `Re: ${viewTicket.subject}`,
      content: replyText.trim(),
      type: 'Notice',
      sender: 'Support Team',
      requires_signature: false,
    });

    // Mark ticket resolved
    await dbOp('tickets', 'update', { status: 'Resolved' }, { id: viewTicket.id });
    setTickets(prev => prev.map(t => t.id === viewTicket.id ? { ...t, status: 'Resolved' } : t));
    setViewTicket(null);
    setReplyText('');
    setIsReplying(false);
  };

  const handleReopen = async (id: string) => {
    await dbOp('tickets', 'update', { status: 'Open' }, { id });
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'Open' } : t));
  };

  const TicketRow = ({ t }: { t: any }) => (
    <div
      key={t.id}
      className="r-cd"
      onClick={() => { setViewTicket(t); setReplyText(''); }}
      style={{ cursor: 'pointer' }}
    >
      <div style={{
        width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
        background: t.status === 'Resolved' ? '#ecfdf5' : t.priority === 'High' ? '#fee2e2' : '#fef3c7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: t.status === 'Resolved' ? '#10b981' : t.priority === 'High' ? '#dc2626' : '#b45309',
        fontSize: '14px',
      }}>
        {t.status === 'Resolved' ? '✓' : '⚠'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {t.subject}
        </div>
        <div style={{ fontSize: '11px', color: '#6b7689' }}>
          {isMgmt && t.profiles?.name && <span>From {t.profiles.name} · </span>}
          {new Date(t.created_at).toLocaleString()}
        </div>
      </div>
      <span className={`pv-bdg ${t.priority === 'High' ? 'pv-bdg-red' : t.priority === 'Medium' ? 'pv-bdg-amber' : 'pv-bdg-gray'}`}>
        {t.priority}
      </span>
      <span className={`pv-bdg ${t.status === 'Resolved' ? 'pv-bdg-green' : 'pv-bdg-indigo'}`}>
        {t.status}
      </span>
    </div>
  );

  return (
    <>
      {/* Open Tickets */}
      <div className="pn" style={{ marginBottom: '20px' }}>
        <div className="pn-h" style={{ marginBottom: '14px' }}>
          <div>
            <div className="pn-t">Open Tickets</div>
            <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>{open.length} active</div>
          </div>
          <button className="pv-btn pv-btn-pri" onClick={() => setIsModalOpen(true)}>+ New Ticket</button>
        </div>
        {open.length === 0 && <div className="empty">No open tickets.</div>}
        {open.map(t => <TicketRow key={t.id} t={t} />)}
      </div>

      {/* Resolved Tickets */}
      {resolved.length > 0 && (
        <div className="pn">
          <div className="pn-h" style={{ marginBottom: '14px' }}>
            <div className="pn-t" style={{ color: '#6b7689' }}>Resolved Tickets</div>
          </div>
          {resolved.map(t => <TicketRow key={t.id} t={t} />)}
        </div>
      )}

      {/* Create ticket modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '420px', maxWidth: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Create Support Ticket</div>
            <form onSubmit={handleCreate}>
              <div className="pv-fld"><label>Issue Title</label><input type="text" name="subject" required /></div>
              <div className="pv-fld">
                <label>Priority</label>
                <select name="priority">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div className="pv-fld"><label>Description</label><textarea name="description" rows={4} required /></div>
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

      {/* View / Reply modal */}
      {viewTicket && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '520px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>{viewTicket.subject}</div>
                <div style={{ fontSize: '11px', color: '#6b7689', marginTop: '3px' }}>
                  {isMgmt && viewTicket.profiles?.name && `From ${viewTicket.profiles.name} · `}
                  {new Date(viewTicket.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className={`pv-bdg ${viewTicket.priority === 'High' ? 'pv-bdg-red' : viewTicket.priority === 'Medium' ? 'pv-bdg-amber' : 'pv-bdg-gray'}`}>{viewTicket.priority}</span>
                <span className={`pv-bdg ${viewTicket.status === 'Resolved' ? 'pv-bdg-green' : 'pv-bdg-indigo'}`}>{viewTicket.status}</span>
              </div>
            </div>

            {viewTicket.description && (
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', fontSize: '13px', lineHeight: 1.7, color: '#1a1f2e', marginBottom: '16px', whiteSpace: 'pre-wrap' }}>
                {viewTicket.description}
              </div>
            )}

            {isMgmt && viewTicket.status !== 'Resolved' && (
              <div style={{ borderTop: '1px solid #e4e7eb', paddingTop: '16px', marginTop: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Reply & Resolve</div>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={4}
                  placeholder="Type your reply — it will be sent to the employee's inbox and this ticket will be marked Resolved..."
                  style={{ width: '100%', padding: '10px', border: '1px solid #e4e7eb', borderRadius: '8px', fontSize: '13px', lineHeight: 1.6, resize: 'vertical' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              {isMgmt && viewTicket.status !== 'Resolved' && (
                <button
                  className="pv-btn pv-btn-pri"
                  onClick={handleReplyAndResolve}
                  disabled={isReplying || !replyText.trim()}
                >
                  {isReplying ? 'Sending...' : 'Send Reply & Resolve'}
                </button>
              )}
              {isMgmt && viewTicket.status === 'Resolved' && (
                <button className="pv-btn pv-btn-sec" onClick={() => { handleReopen(viewTicket.id); setViewTicket(null); }}>
                  Reopen
                </button>
              )}
              <button className="pv-btn pv-btn-sec" onClick={() => setViewTicket(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
