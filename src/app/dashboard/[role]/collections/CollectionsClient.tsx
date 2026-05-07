'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

export default function CollectionsClient({
  initialCollections,
  currentUserId,
}: {
  initialCollections: any[];
  currentUserId: string;
}) {
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
  const verified = collections.filter(c => c.status === 'Verified').length;
  const pending = collections.filter(c => c.status === 'Pending').length;
  const today = new Date().toDateString();
  const todayTotal = collections
    .filter(c => new Date(c.created_at).toDateString() === today)
    .reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">$</div></div>
          <div className="stat-l">TOTAL COLLECTED</div>
          <div className="stat-v">${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="stat-foot">All-time collections</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">VERIFIED</div>
          <div className="stat-v">{verified}</div>
          <div className="stat-foot">Confirmed collections</div>
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

      {/* Log form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-hdr">
          <div className="card-title">Log New Collection</div>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          {error && (
            <div style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleLog} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div className="pv-fld" style={{ margin: 0 }}>
              <label>Customer ID / Name</label>
              <input type="text" name="customer_id" required placeholder="e.g. CUST-1042" />
            </div>
            <div className="pv-fld" style={{ margin: 0 }}>
              <label>Amount ($)</label>
              <input type="number" name="amount" step="0.01" min="0.01" required placeholder="0.00" />
            </div>
            <button type="submit" className="btn btn-acc" disabled={isSubmitting} style={{ height: 36, alignSelf: 'end' }}>
              {isSubmitting ? 'Logging…' : '+ Log Collection'}
            </button>
          </form>
        </div>
      </div>

      {/* Collections table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Recent Collections</div>
            <div className="card-sub">{collections.length} total entries</div>
          </div>
        </div>
        {collections.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No collections logged yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Date / Time</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {collections.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'oklch(0.96 0.05 145)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ok)', fontWeight: 700, fontSize: 14 }}>$</div>
                        <div style={{ fontWeight: 600 }}>{c.customer_id}</div>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--ok)', fontSize: 14 }}>
                      ${Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={c.status === 'Verified' ? 'bdg bdg-ok' : 'bdg bdg-warn'}>{c.status}</span>
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
