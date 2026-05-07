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
  const pending = sales.length - verified;
  const today = new Date().toDateString();
  const todayTotal = sales
    .filter(s => new Date(s.created_at).toDateString() === today)
    .reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="page-fade">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">$</div></div>
          <div className="stat-l">TOTAL LOGGED</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="stat-foot">All-time revenue</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">VERIFIED</div>
          <div className="stat-v">{verified}</div>
          <div className="stat-foot">Confirmed sales</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">⏳</div></div>
          <div className="stat-l">PENDING</div>
          <div className="stat-v" style={{ color: 'var(--warn)' }}>{pending}</div>
          <div className="stat-foot">Awaiting verification</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📅</div></div>
          <div className="stat-l">TODAY</div>
          <div className="stat-v">${todayTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="stat-foot">Logged today</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-hdr">
          <div className="card-title">Log New Sale</div>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          {error && (
            <div style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleLog}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
            <button type="submit" className="btn btn-acc" disabled={isSubmitting}>
              {isSubmitting ? 'Logging…' : '+ Log Sale →'}
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Recent Sales</div>
            <div className="card-sub">{sales.length} total entries</div>
          </div>
        </div>
        {sales.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No sales logged yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Date / Time</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'oklch(0.96 0.05 145)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ok)', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>$</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{s.customer_name || s.customer_id}</div>
                          {s.customer_name && s.customer_id && (
                            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.customer_id}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>{s.customer_phone || '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--ok)', fontSize: 14 }}>
                      ${Number(s.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={s.status === 'Verified' ? 'bdg bdg-ok' : 'bdg bdg-warn'}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
