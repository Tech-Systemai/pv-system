'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const COLLECTION_TYPES = ['CRM', 'Website', 'Partially'] as const;

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

  const todayISO = new Date().toISOString().slice(0, 10);

  const handleLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const newColl = {
      user_id:         currentUserId,
      type:            'Collection',
      status:          'Pending',
      customer_name:   fd.get('customer_name') as string,
      customer_phone:  fd.get('customer_phone') as string,
      customer_email:  fd.get('customer_email') as string,
      amount:          parseFloat(fd.get('amount') as string),
      collection_type: fd.get('collection_type') as string,
      collection_date: fd.get('collection_date') as string,
      // keep customer_id populated for backward-compat with existing queries
      customer_id:     fd.get('customer_name') as string,
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
          <form onSubmit={handleLog}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Row 1: Customer name + phone */}
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Customer Name</label>
                <input type="text" name="customer_name" required placeholder="Full name" />
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Phone Number</label>
                <input type="tel" name="customer_phone" placeholder="+1 (555) 000-0000" />
              </div>

              {/* Row 2: Email + Amount */}
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Email Address</label>
                <input type="email" name="customer_email" placeholder="customer@email.com" />
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Amount ($)</label>
                <input type="number" name="amount" step="0.01" min="0.01" required placeholder="0.00" />
              </div>

              {/* Row 3: Collection type + Date */}
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Collection Type</label>
                <select name="collection_type" required>
                  <option value="">Select type…</option>
                  {COLLECTION_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Collection Date</label>
                <input type="date" name="collection_date" required defaultValue={todayISO} />
              </div>

              {/* Row 4: Submit */}
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Collection Date</label>
                <input type="date" name="collection_date" required defaultValue={todayISO} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-acc" disabled={isSubmitting} style={{ height: 36 }}>
                  {isSubmitting ? 'Logging…' : '+ Log Collection'}
                </button>
              </div>
            </div>
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
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {collections.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.customer_name || c.customer_id || '—'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.customer_phone || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{c.customer_email || ''}</div>
                    </td>
                    <td>
                      {c.collection_type ? (
                        <span className="bdg bdg-acc">{c.collection_type}</span>
                      ) : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                      {c.collection_date
                        ? new Date(c.collection_date + 'T00:00:00').toLocaleDateString()
                        : new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--ok)', fontSize: 14 }}>
                      ${Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={c.status === 'Verified' ? 'bdg bdg-ok' : c.status === 'Declined' ? 'bdg bdg-err' : 'bdg bdg-warn'}>{c.status}</span>
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
