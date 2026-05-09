'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const MODULE_META: Record<string, { label: string; icon: string; desc: string }> = {
  tasks:      { label: 'Task Flow',       icon: '✓',  desc: 'Create and manage tasks' },
  schedule:   { label: 'Schedules',       icon: '⏱',  desc: 'View and manage shift schedules' },
  reports:    { label: 'Reports',         icon: '📊', desc: 'Performance and sales reports' },
  tickets:    { label: 'Tickets',         icon: '🎫', desc: 'Support and issue tickets' },
  hr:         { label: 'HR Pipeline',     icon: '📋', desc: 'Applicant tracking and hiring' },
  contracts:  { label: 'Contracts',       icon: '📄', desc: 'Employee contracts and documents' },
  inbox:      { label: 'Inbox',           icon: '✉',  desc: 'Document inbox and signed files' },
  attendance: { label: 'Attendance',      icon: '📅', desc: 'Clock-in logs and attendance' },
  monitoring: { label: 'Live Monitoring', icon: '◉',  desc: 'Real-time employee monitoring' },
  policy:     { label: 'Policy Engine',   icon: '⚙',  desc: 'Company policies and rules' },
  targets:    { label: 'Targets',         icon: '⊕',  desc: 'Sales and performance targets' },
  coaching:   { label: 'Coaching + QA',   icon: '🎯', desc: 'Coaching sessions and QA scores' },
  planning:   { label: 'Planning',        icon: '📈', desc: 'Business planning documents' },
  kb:         { label: 'Knowledge Base',  icon: '📚', desc: 'Company knowledge and guides' },
  chat:       { label: 'Messages',        icon: '💬', desc: 'Team messaging channels' },
  payroll:    { label: 'Payroll',         icon: '💵', desc: 'Payslips and salary information' },
  finance:    { label: 'Finance',         icon: '$',  desc: 'Financial dashboard and entries' },
  wise:       { label: 'WISE',            icon: '💡', desc: 'WISE system tools' },
};

const VIEW_OPTIONS = [
  { value: 'agent', label: 'Own View',   desc: 'See only my own data' },
  { value: 'admin', label: 'Admin View', desc: 'See all data and manage' },
  { value: 'both',  label: 'Both',       desc: 'Full access — personal + admin' },
];

type ModalState = { module: string; view: 'agent' | 'admin' | 'both'; reason: string } | null;

export default function RequestAccessClient({
  userId,
  userName,
  userRole,
  allowedModules,
  pendingModules,
}: {
  userId: string;
  userName: string;
  userRole: string;
  allowedModules: Record<string, string>;
  pendingModules: string[];
}) {
  const [pending, setPending]   = useState<string[]>(pendingModules);
  const [modal, setModal]       = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState<string[]>([]);
  const [error, setError]       = useState('');

  const handleSubmit = async () => {
    if (!modal) return;
    setSubmitting(true);
    setError('');
    const { error: err } = await dbOp('access_requests', 'insert', {
      user_id:        userId,
      user_name:      userName,
      user_role:      userRole,
      module:         modal.module,
      requested_view: modal.view,
      reason:         modal.reason || null,
      status:         'pending',
    });
    if (err) {
      setError(`Failed to submit: ${err}`);
    } else {
      setPending(prev => [...prev, modal.module]);
      setDone(prev => [...prev, modal.module]);
      setModal(null);
    }
    setSubmitting(false);
  };

  const modules = Object.entries(MODULE_META);
  const noAccess   = modules.filter(([id]) => allowedModules[id] === 'none' || !allowedModules[id]);
  const hasAccess  = modules.filter(([id]) => allowedModules[id] && allowedModules[id] !== 'none');

  const statusBadge = (modId: string) => {
    if (done.includes(modId)) return <span className="bdg bdg-ok">✓ Submitted</span>;
    if (pending.includes(modId)) return <span className="bdg bdg-warn">Pending</span>;
    return null;
  };

  return (
    <div className="page-fade">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Request Access</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
          Submit a request for a module — the owner will review and approve or deny it.
        </div>
      </div>

      {/* Modules you don't have access to */}
      {noAccess.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">Available to Request</div>
              <div className="card-sub">{noAccess.length} modules you currently can't access</div>
            </div>
          </div>
          <div style={{ padding: '0 18px 18px', display: 'grid', gap: 10 }}>
            {noAccess.map(([id, meta]) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--surface-3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: 16, flexShrink: 0 }}>{meta.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{meta.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>{meta.desc}</div>
                </div>
                {statusBadge(id) ?? (
                  <button
                    className="btn btn-acc btn-sm"
                    onClick={() => setModal({ module: id, view: 'agent', reason: '' })}
                  >
                    Request Access
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modules you already have */}
      {hasAccess.length > 0 && (
        <div className="card">
          <div className="card-hdr">
            <div>
              <div className="card-title">Current Access</div>
              <div className="card-sub">Modules you already have permission to use</div>
            </div>
          </div>
          <div style={{ padding: '0 18px 18px', display: 'grid', gap: 8 }}>
            {hasAccess.map(([id, meta]) => {
              const vt = allowedModules[id];
              const label = vt === 'both' ? 'Full Access' : vt === 'admin' ? 'Admin View' : 'Own View';
              const hue   = vt === 'both' ? 145 : vt === 'admin' ? 220 : 75;
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line-2)' }}>
                  <span style={{ fontSize: 15 }}>{meta.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{meta.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: `oklch(0.94 0.05 ${hue})`, color: `oklch(0.38 0.14 ${hue})` }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Request modal */}
      {modal && (
        <div className="mb">
          <div className="md" style={{ width: 460 }}>
            <div className="md-t">Request Access — {MODULE_META[modal.module]?.label}</div>
            {error && <div style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)', padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 14 }}>{error}</div>}

            <div className="pv-fld">
              <label>Access Level</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {VIEW_OPTIONS.map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${modal.view === opt.value ? 'var(--accent)' : 'var(--line)'}`, background: modal.view === opt.value ? 'var(--accent-soft)' : 'white', cursor: 'pointer' }}>
                    <input type="radio" name="view" value={opt.value} checked={modal.view === opt.value} onChange={() => setModal({ ...modal, view: opt.value as any })} style={{ accentColor: 'var(--accent)' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pv-fld">
              <label>Reason (optional)</label>
              <textarea
                rows={3}
                placeholder="Why do you need access to this module?"
                value={modal.reason}
                onChange={e => setModal({ ...modal, reason: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Request'}</button>
              <button className="btn btn-sec" onClick={() => { setModal(null); setError(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
