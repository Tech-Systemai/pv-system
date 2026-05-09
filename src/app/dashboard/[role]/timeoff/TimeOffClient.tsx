'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_BADGE: Record<string, string> = {
  Approved: 'bdg bdg-ok',
  Rejected: 'bdg bdg-err',
  Pending: 'bdg bdg-warn',
};

const TYPE_COLORS: Record<string, string> = {
  Vacation: '200',
  'Sick leave': '25',
  Personal: '268',
  Family: '145',
};

export default function TimeOffClient({
  initialRequests,
  isMgmt,
  currentUserId,
  currentUserName,
}: {
  initialRequests: any[];
  isMgmt: boolean;
  currentUserId: string;
  currentUserName: string;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleAction = async (id: string, newStatus: string) => {
    const { error } = await dbOp('time_off_requests', 'update', { status: newStatus }, { id });
    if (!error) setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    const formData = new FormData(e.currentTarget);
    const newReq = {
      user_id: currentUserId,
      start_date: formData.get('from') as string,
      end_date: formData.get('to') as string,
      type: formData.get('type') as string,
      reason: formData.get('reason') as string,
      status: 'Pending',
    };
    const { data, error } = await dbOp('time_off_requests', 'insert', newReq);
    if (error) {
      setSubmitError(error);
    } else {
      // Use returned row if available, fall back to submitted data so state always updates
      const saved = data?.[0] ?? { ...newReq, id: `tmp-${Date.now()}`, created_at: new Date().toISOString() };
      setRequests(prev => [{ ...saved, profiles: { name: currentUserName } }, ...prev]);
      (e.target as HTMLFormElement).reset();
      setIsFormOpen(false);
    }
    setSubmitting(false);
  };

  const pending = requests.filter(r => r.status === 'Pending');
  const approved = requests.filter(r => r.status === 'Approved');
  const rejected = requests.filter(r => r.status === 'Rejected');

  const TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Requests', count: requests.length },
    { id: 'pending', label: 'Pending', count: pending.length },
    { id: 'approved', label: 'Approved', count: approved.length },
    { id: 'rejected', label: 'Rejected', count: rejected.length },
  ];

  const filtered = filterTab === 'all' ? requests
    : filterTab === 'pending' ? pending
    : filterTab === 'approved' ? approved
    : rejected;

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">⏳</div></div>
          <div className="stat-l">PENDING</div>
          <div className="stat-v" style={{ color: 'var(--warn)' }}>{pending.length}</div>
          <div className="stat-foot">Awaiting review</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">APPROVED YTD</div>
          <div className="stat-v">{approved.length}</div>
          <div className="stat-foot">This period</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico er">✕</div></div>
          <div className="stat-l">REJECTED</div>
          <div className="stat-v">{rejected.length}</div>
          <div className="stat-foot">Declined requests</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📋</div></div>
          <div className="stat-l">TOTAL REQUESTS</div>
          <div className="stat-v">{requests.length}</div>
          <div className="stat-foot">All time</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Time-Off Requests</div>
            <div className="card-sub">{pending.length} pending review</div>
          </div>
          {!isMgmt && (
            <button className="btn btn-acc btn-sm" onClick={() => setIsFormOpen(true)}>+ New Request</button>
          )}
        </div>

        <div style={{ padding: '0 18px 12px' }}>
          <div className="tabs">
            {TABS.map(t => (
              <button key={t.id} className={`tab${filterTab === t.id ? ' active' : ''}`} onClick={() => setFilterTab(t.id)}>
                {t.label} <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No requests in this view.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Period</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {isMgmt && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const hue = TYPE_COLORS[r.type] ?? '268';
                  const initials = (r.profiles?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2);
                  const nameHue = ((r.profiles?.name ?? 'U').charCodeAt(0) * 13) % 360;
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="av-circle" style={{ width: 32, height: 32, fontSize: 11, background: `linear-gradient(135deg, oklch(0.55 0.13 ${nameHue}), oklch(0.42 0.16 ${nameHue + 20}))` }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.profiles?.name ?? 'Unknown'}</div>
                            <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                              Submitted {new Date(r.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 600, color: `oklch(0.48 0.14 ${hue})`, background: `oklch(0.96 0.04 ${hue})`, padding: '3px 8px', borderRadius: 20 }}>
                          {r.type}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>
                        {r.start_date} → {r.end_date}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason ?? '—'}</div>
                      </td>
                      <td><span className={STATUS_BADGE[r.status] ?? 'bdg bdg-gy'}>{r.status}</span></td>
                      {isMgmt && (
                        <td>
                          {r.status === 'Pending' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-sm" style={{ background: 'oklch(0.96 0.05 145)', color: 'oklch(0.40 0.14 145)', border: '1px solid oklch(0.88 0.07 145)' }} onClick={() => handleAction(r.id, 'Approved')}>✓ Approve</button>
                              <button className="btn btn-sm" style={{ background: 'oklch(0.97 0.03 25)', color: 'oklch(0.45 0.16 25)', border: '1px solid oklch(0.90 0.06 25)' }} onClick={() => handleAction(r.id, 'Rejected')}>✕ Reject</button>
                            </div>
                          ) : (
                            <button className="btn btn-sec btn-sm" onClick={() => handleAction(r.id, 'Pending')}>Reopen</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Employee submit form modal */}
      {isFormOpen && (
        <div className="mb">
          <div className="md" style={{ width: 480 }}>
            <div className="md-t">Submit Time-Off Request</div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 }}>
                <div className="pv-fld"><label>From date</label><input type="date" name="from" required /></div>
                <div className="pv-fld"><label>To date</label><input type="date" name="to" required /></div>
              </div>
              <div className="pv-fld">
                <label>Type</label>
                <select name="type">
                  <option>Vacation</option>
                  <option>Sick leave</option>
                  <option>Personal</option>
                  <option>Family</option>
                </select>
              </div>
              <div className="pv-fld"><label>Reason</label><textarea name="reason" rows={3} required /></div>
              {submitError && (
                <div style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
                  {submitError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Request'}</button>
                <button type="button" className="btn btn-sec" onClick={() => { setIsFormOpen(false); setSubmitError(''); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
