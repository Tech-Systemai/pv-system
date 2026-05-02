'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

export default function CollectionsClient({ initialCollections, currentUserId }: { initialCollections: any[], currentUserId: string }) {
  const [collections, setCollections] = useState(initialCollections);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const newColl = {
      user_id: currentUserId,
      customer_id: fd.get('customer_id') as string,
      amount: parseFloat(fd.get('amount') as string),
      type: 'Collection',
      status: 'Pending',
    };
    const { data, error: err } = await dbOp('sales_logs', 'insert', newColl);
    if (err) {
      setError(err);
    } else if (data?.[0]) {
      setCollections(prev => [data[0], ...prev]);
      (e.target as HTMLFormElement).reset();
    }
    setIsSubmitting(false);
  };

  const totalCollected = collections.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <>
      <div className="stat-grid" style={{ marginBottom: '16px' }}>
        <div className="stat">
          <div className="s-l">Total Collected</div>
          <div className="s-v gn">${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat">
          <div className="s-l">Verified</div>
          <div className="s-v">{collections.filter(c => c.status === 'Verified').length}</div>
        </div>
        <div className="stat">
          <div className="s-l">Pending</div>
          <div className="s-v am">{collections.filter(c => c.status === 'Pending').length}</div>
        </div>
      </div>

      <div className="pn" style={{ marginBottom: '20px' }}>
        <div className="pn-t" style={{ marginBottom: '13px' }}>Log New Collection</div>
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}
        <form onSubmit={handleLog} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
          <div className="pv-fld" style={{ margin: 0 }}>
            <label>Customer ID / Name</label>
            <input type="text" name="customer_id" required placeholder="e.g. CUST-1042" />
          </div>
          <div className="pv-fld" style={{ margin: 0 }}>
            <label>Amount ($)</label>
            <input type="number" name="amount" step="0.01" min="0.01" required placeholder="0.00" />
          </div>
          <button type="submit" className="pv-btn pv-btn-pri" disabled={isSubmitting}>
            {isSubmitting ? 'Logging...' : '+ Log →'}
          </button>
        </form>
      </div>

      <div className="pn">
        <div className="pn-h" style={{ marginBottom: '14px' }}>
          <div className="pn-t">Recent Collections</div>
        </div>
        {collections.length === 0 && <div className="empty">No collections logged yet.</div>}
        {collections.map(c => (
          <div key={c.id} className="r-cd">
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#047857', fontWeight: 700, fontSize: '13px' }}>$</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Customer: {c.customer_id}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>{new Date(c.created_at).toLocaleString()}</div>
            </div>
            <div style={{ fontWeight: 700, color: '#047857' }}>${Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <span className={`pv-bdg ${c.status === 'Verified' ? 'pv-bdg-green' : 'pv-bdg-amber'}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </>
  );
}
