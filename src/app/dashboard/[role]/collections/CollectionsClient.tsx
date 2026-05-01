'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function CollectionsClient({ initialCollections, currentUserId }: { initialCollections: any[], currentUserId: string }) {
  const [collections, setCollections] = useState(initialCollections);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const handleLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const newColl = {
      user_id: currentUserId,
      customer_id: formData.get('customer_id') as string,
      amount: parseFloat(formData.get('amount') as string),
      type: 'Collection',
      status: 'Pending'
    };

    const { data } = await supabase.from('sales_logs').insert([newColl]).select();
    if (data && data[0]) {
      setCollections([data[0], ...collections]);
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
          <div className="s-v gn">${totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
        </div>
        <div className="stat">
          <div className="s-l">Verified</div>
          <div className="s-v">{collections.filter(c => c.status === 'Verified').length}</div>
        </div>
      </div>

      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '13px' }}>Log New Collection</div>
        <form onSubmit={handleLog} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '9px', marginBottom: '14px', alignItems: 'end' }}>
          <div className="pv-fld"><label>Customer ID</label><input type="text" name="customer_id" required /></div>
          <div className="pv-fld"><label>Amount $</label><input type="number" name="amount" step="0.01" required /></div>
          <button type="submit" className="pv-btn pv-btn-pri" disabled={isSubmitting}>
            {isSubmitting ? 'Logging...' : '+ Log Collection →'}
          </button>
        </form>
      </div>

      <div className="pn">
        <div className="pn-h"><div className="pn-t">Recent Collections</div></div>
        {collections.length === 0 && <div className="empty">No collections logged yet.</div>}
        {collections.map(c => (
          <div key={c.id} className="r-cd">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Customer: {c.customer_id}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>{new Date(c.created_at).toLocaleString()}</div>
            </div>
            <div style={{ fontWeight: 700, color: '#047857' }}>${Number(c.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            <span className={`pv-bdg ${c.status === 'Verified' ? 'pv-bdg-green' : 'pv-bdg-amber'}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </>
  );
}
