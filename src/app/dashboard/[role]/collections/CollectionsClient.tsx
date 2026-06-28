'use client';

import { useState } from 'react';

export default function CollectionsClient({
  initialCollections,
}: {
  initialCollections: any[];
  currentUserId: string;
}) {
  const [collections] = useState(initialCollections);

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

      {/* Collections table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Recent Collections</div>
            <div className="card-sub">{collections.length} total entries · auto-logged from payments you record on the live card</div>
          </div>
        </div>
        {collections.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No collections yet. Record a payment on a customer’s live card and it shows up here automatically.
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
