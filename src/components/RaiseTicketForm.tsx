'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function RaiseTicketForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('tickets').insert({
        title,
        priority,
        submitted_by: user.id,
        status: 'Open',
      });
      setTitle('');
      setOpen(false);
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="pv-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="pv-panel-title" style={{ margin: 0 }}>Support Tickets</h2>
        <button className="pv-btn pv-btn-pri" onClick={() => setOpen(!open)}>
          {open ? 'Cancel' : 'Raise Ticket'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} style={{ marginTop: '16px', borderTop: '1px solid #f0f2f5', paddingTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end' }}>
            <div className="pv-fld" style={{ marginBottom: 0 }}>
              <label>Issue Description</label>
              <input
                type="text"
                placeholder="Describe the issue clearly..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="pv-fld" style={{ marginBottom: 0 }}>
              <label>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={loading} className="pv-btn pv-btn-pri" style={{ marginTop: '12px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>
      )}
    </div>
  );
}
