'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';
import { createEmployeeAccount } from '../users/actions';
import { useRouter } from 'next/navigation';

type Tab = 'pipeline' | 'rejected';

export default function HrClient({ initialApplicants }: { initialApplicants: any[] }) {
  const [applicants, setApplicants] = useState(initialApplicants);
  const [tab, setTab] = useState<Tab>('pipeline');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewApplicant, setViewApplicant] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hireError, setHireError] = useState('');
  const router = useRouter();

  const pipeline = applicants.filter(a => a.status === 'Reviewing');
  const rejected = applicants.filter(a => a.status === 'Rejected');

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const newApp = {
      name: fd.get('name') as string,
      email: fd.get('email') as string,
      position: fd.get('position') as string,
      score: Number(fd.get('score')),
      notes: fd.get('notes_field') as string || null,
      status: 'Reviewing',
    };
    const { data } = await dbOp('hr_applicants', 'insert', newApp);
    if (data?.[0]) setApplicants(prev => [data[0], ...prev]);
    setIsAddModalOpen(false);
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
  };

  const handleHire = async (app: any) => {
    setIsSubmitting(true);
    setHireError('');
    const fd = new FormData();
    fd.append('email', app.email);
    fd.append('username', app.email);
    fd.append('password', 'pioneers2026!');
    fd.append('name', app.name);
    fd.append('role', app.position.toLowerCase().replace(' ', '_'));
    fd.append('salary', '2500');

    const res = await createEmployeeAccount(fd);
    if (res.error) {
      setHireError(`Could not hire ${app.name}: ${res.error}`);
    } else {
      await dbOp('hr_applicants', 'update', { status: 'Hired' }, { id: app.id });
      setApplicants(prev => prev.filter(a => a.id !== app.id));
      setViewApplicant(null);
      router.refresh();
    }
    setIsSubmitting(false);
  };

  const handleReject = async (app: any) => {
    await dbOp('hr_applicants', 'update', { status: 'Rejected' }, { id: app.id });
    setApplicants(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Rejected' } : a));
    setViewApplicant(null);
  };

  const handleRestore = async (id: string) => {
    await dbOp('hr_applicants', 'update', { status: 'Reviewing' }, { id });
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, status: 'Reviewing' } : a));
  };

  const ApplicantCard = ({ a }: { a: any }) => {
    const isHigh = a.score >= 90;
    const isMed = a.score >= 70;
    return (
      <div className="r-cd" onClick={() => setViewApplicant(a)} style={{ cursor: 'pointer' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: isHigh ? '#ecfdf5' : isMed ? '#fef3c7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: isHigh ? '#047857' : isMed ? '#b45309' : '#dc2626', flexShrink: 0 }}>
          {a.score}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{a.name}</div>
          <div style={{ fontSize: '11px', color: '#6b7689' }}>{a.email} · {a.position}</div>
          {a.notes && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', fontStyle: 'italic' }}>{a.notes.slice(0, 60)}{a.notes.length > 60 ? '…' : ''}</div>}
        </div>
        <span className={`pv-bdg ${isHigh ? 'pv-bdg-green' : isMed ? 'pv-bdg-amber' : 'pv-bdg-red'}`}>
          {isHigh ? 'High priority' : isMed ? 'Low chance' : 'Below threshold'}
        </span>
      </div>
    );
  };

  return (
    <>
      <div className="three" style={{ marginBottom: '14px' }}>
        <div className="stat"><div className="s-l">High Priority · 90+</div><div className="s-v gn">{pipeline.filter(a => a.score >= 90).length}</div></div>
        <div className="stat"><div className="s-l">Low Chance · 70–89</div><div className="s-v am">{pipeline.filter(a => a.score >= 70 && a.score < 90).length}</div></div>
        <div className="stat"><div className="s-l">Below Threshold · &lt;70</div><div className="s-v rd">{pipeline.filter(a => a.score < 70).length}</div></div>
      </div>

      {hireError && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>{hireError}</div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        {(['pipeline', 'rejected'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', background: tab === t ? '#4f46e5' : '#f5f6f8', color: tab === t ? '#fff' : '#6b7689' }}>
            {t === 'pipeline' ? `Active Pipeline (${pipeline.length})` : `Rejected (${rejected.length})`}
          </button>
        ))}
      </div>

      {tab === 'pipeline' && (
        <div className="pn">
          <div className="pn-h" style={{ marginBottom: '14px' }}>
            <div className="pn-t">Active Applicants</div>
            <button className="pv-btn pv-btn-pri" onClick={() => setIsAddModalOpen(true)}>+ Add Applicant</button>
          </div>
          {pipeline.length === 0 && <div className="empty">No active applicants to review.</div>}
          {pipeline.map(a => <ApplicantCard key={a.id} a={a} />)}
        </div>
      )}

      {tab === 'rejected' && (
        <div className="pn">
          <div className="pn-h" style={{ marginBottom: '14px' }}>
            <div className="pn-t" style={{ color: '#6b7689' }}>Rejected Applicants</div>
          </div>
          {rejected.length === 0 && <div className="empty">No rejected applicants.</div>}
          {rejected.map(a => (
            <div key={a.id} className="r-cd" style={{ opacity: 0.7 }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f5f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: '#9ca3af', flexShrink: 0 }}>
                {a.score}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>{a.email} · {a.position}</div>
              </div>
              <button className="pv-btn pv-btn-sec" style={{ fontSize: '11px' }} onClick={() => handleRestore(a.id)}>Restore →</button>
            </div>
          ))}
        </div>
      )}

      {/* Add Applicant Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '440px', maxWidth: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Add Applicant</div>
            <form onSubmit={handleAdd}>
              <div className="pv-fld"><label>Full Name</label><input type="text" name="name" required /></div>
              <div className="pv-fld"><label>Email</label><input type="email" name="email" required /></div>
              <div className="pv-fld">
                <label>Applying for</label>
                <select name="position">
                  <option value="Sales">Sales</option>
                  <option value="CX">CX</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Admin">Admin</option>
                  <option value="Accountant">Accountant</option>
                </select>
              </div>
              <div className="pv-fld"><label>Interview Score (0–100)</label><input type="number" name="score" min="0" max="100" defaultValue={80} required /></div>
              <div className="pv-fld"><label>Notes (optional)</label><textarea name="notes_field" rows={3} placeholder="Interviewer notes, observations..." /></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add'}</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Applicant Modal */}
      {viewApplicant && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '460px', maxWidth: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>{viewApplicant.name}</div>
            <div style={{ fontSize: '12px', color: '#6b7689', marginBottom: '16px' }}>{viewApplicant.email} · {viewApplicant.position}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '7px', marginBottom: '16px' }}>
              {[
                ['Score', `${viewApplicant.score}/100`],
                ['Status', viewApplicant.status],
                ['Position', viewApplicant.position],
                ['Applied', new Date(viewApplicant.created_at).toLocaleDateString()],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#f5f6f8', padding: '9px 11px', borderRadius: '7px' }}>
                  <div style={{ fontSize: '10px', color: '#6b7689', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '1px' }}>{v}</div>
                </div>
              ))}
            </div>

            {viewApplicant.notes && (
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px', lineHeight: 1.6, color: '#4a5568', marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7689', textTransform: 'uppercase', marginBottom: '6px' }}>Notes</div>
                {viewApplicant.notes}
              </div>
            )}

            {viewApplicant.status === 'Reviewing' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="pv-btn pv-btn-pri" onClick={() => handleHire(viewApplicant)} disabled={isSubmitting}>
                  {isSubmitting ? 'Hiring...' : 'Hire →'}
                </button>
                <button className="pv-btn pv-btn-sec" style={{ color: '#dc2626' }} onClick={() => handleReject(viewApplicant)}>Reject</button>
                <button className="pv-btn pv-btn-sec" onClick={() => setViewApplicant(null)}>Close</button>
              </div>
            )}
            {viewApplicant.status !== 'Reviewing' && (
              <button className="pv-btn pv-btn-sec" onClick={() => setViewApplicant(null)}>Close</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
