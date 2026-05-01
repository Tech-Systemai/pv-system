'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function RevenueClient({ initialSales, currentUserId }: { initialSales: any[], currentUserId: string }) {
  const [sales, setSales] = useState(initialSales);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const handleLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const newSale = {
      user_id: currentUserId,
      customer_id: formData.get('customer_id') as string,
      amount: parseFloat(formData.get('amount') as string),
      type: 'Sale',
      status: 'Pending'
    };

    const { data } = await supabase.from('sales_logs').insert([newSale]).select();
    if (data && data[0]) {
      setSales([data[0], ...sales]);
      (e.target as HTMLFormElement).reset();
    }
    setIsSubmitting(false);
  };

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <>
      <div className="stat-grid" style={{ marginBottom: '16px' }}>
        <div className="stat">
          <div className="s-l">Total Logged</div>
          <div className="s-v gn">${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
        </div>
        <div className="stat">
          <div className="s-l">Verified</div>
          <div className="s-v">{sales.filter(s => s.status === 'Verified').length}</div>
        </div>
      </div>

      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '13px' }}>Log New Sale</div>
        <form onSubmit={handleLog} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '9px', marginBottom: '14px', alignItems: 'end' }}>
          <div className="pv-fld"><label>Customer ID</label><input type="text" name="customer_id" required /></div>
          <div className="pv-fld"><label>Amount $</label><input type="number" name="amount" step="0.01" required /></div>
          <button type="submit" className="pv-btn pv-btn-pri" disabled={isSubmitting}>
            {isSubmitting ? 'Logging...' : '+ Log Sale →'}
          </button>
        </form>
      </div>

      <div className="pn">
        <div className="pn-h"><div className="pn-t">Recent Sales Logs</div></div>
        {sales.length === 0 && <div className="empty">No sales logged yet.</div>}
        {sales.map(s => (
          <div key={s.id} className="r-cd">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Customer: {s.customer_id}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>{new Date(s.created_at).toLocaleString()}</div>
            </div>
            <div style={{ fontWeight: 700, color: '#047857' }}>${Number(s.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            <span className={`pv-bdg ${s.status === 'Verified' ? 'pv-bdg-green' : 'pv-bdg-amber'}`}>{s.status}</span>
          </div>
        ))}
      </div>
    </>
  );
}
