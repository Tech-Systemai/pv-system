'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

export default function RevenueClient({ initialSales, currentUserId }: { initialSales: any[], currentUserId: string }) {
  const [sales, setSales] = useState(initialSales);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const newSale = {
      user_id: currentUserId,
      customer_id: fd.get('customer_id') as string,
      customer_name: fd.get('customer_name') as string || null,
      customer_phone: fd.get('customer_phone') as string || null,
      amount: parseFloat(fd.get('amount') as string),
      type: 'Sale',
      status: 'Pending',
    };
    const { data, error: err } = await dbOp('sales_logs', 'insert', newSale);
    if (err) {
      setError(err);
    } else if (data?.[0]) {
      setSales(prev => [data[0], ...prev]);
      (e.target as HTMLFormElement).reset();
    }
    setIsSubmitting(false);
  };

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const verified = sales.filter(s => s.status === 'Verified').length;

  return (
    <>
      <div className="stat-grid" style={{ marginBottom: '16px' }}>
        <div className="stat">
          <div className="s-l">Total Logged</div>
          <div className="s-v gn">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="stat">
          <div className="s-l">Verified</div>
          <div className="s-v">{verified}</div>
        </div>
        <div className="stat">
          <div className="s-l">Pending Verification</div>
          <div className="s-v am">{sales.length - verified}</div>
        </div>
      </div>

      <div className="pn" style={{ marginBottom: '20px' }}>
        <div className="pn-t" style={{ marginBottom: '13px' }}>Log New Sale</div>
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}
        <form onSubmit={handleLog}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div className="pv-fld" style={{ margin: 0 }}>
              <label>Customer ID</label>
              <input type="text" name="customer_id" required placeholder="e.g. CUST-1042" />
            </div>
            <div className="pv-fld" style={{ margin: 0 }}>
              <label>Customer Name</label>
              <input type="text" name="customer_name" placeholder="Full name" />
            </div>
            <div className="pv-fld" style={{ margin: 0 }}>
              <label>Customer Phone</label>
              <input type="tel" name="customer_phone" placeholder="+1 555 000 0000" />
            </div>
            <div className="pv-fld" style={{ margin: 0 }}>
              <label>Amount ($)</label>
              <input type="number" name="amount" step="0.01" min="0.01" required placeholder="0.00" />
            </div>
          </div>
          <button type="submit" className="pv-btn pv-btn-pri" disabled={isSubmitting}>
            {isSubmitting ? 'Logging...' : '+ Log Sale →'}
          </button>
        </form>
      </div>

      <div className="pn">
        <div className="pn-h" style={{ marginBottom: '14px' }}>
          <div className="pn-t">Recent Sales</div>
        </div>
        {sales.length === 0 && <div className="empty">No sales logged yet.</div>}
        {sales.map(s => (
          <div key={s.id} className="r-cd">
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#047857', fontWeight: 700, fontSize: '13px' }}>$</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                {s.customer_name || s.customer_id}
                {s.customer_name && s.customer_id && <span style={{ color: '#9ca3af', fontWeight: 400 }}> · {s.customer_id}</span>}
              </div>
              {s.customer_phone && (
                <div style={{ fontSize: '11px', color: '#6b7689' }}>{s.customer_phone}</div>
              )}
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date(s.created_at).toLocaleString()}</div>
            </div>
            <div style={{ fontWeight: 700, color: '#047857' }}>${Number(s.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <span className={`pv-bdg ${s.status === 'Verified' ? 'pv-bdg-green' : 'pv-bdg-amber'}`}>{s.status}</span>
          </div>
        ))}
      </div>
    </>
  );
}
