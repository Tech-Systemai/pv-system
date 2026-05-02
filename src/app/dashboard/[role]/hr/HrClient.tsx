'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';
import { createEmployeeAccount } from '../users/actions';
import { useRouter } from 'next/navigation';

export default function HrClient({ initialApplicants }: { initialApplicants: any[] }) {
  const [applicants, setApplicants] = useState(initialApplicants);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hireError, setHireError] = useState('');
  const router = useRouter();

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const newApp = {
      name: fd.get('name') as string,
      email: fd.get('email') as string,
      position: fd.get('position') as string,
      score: Number(fd.get('score')),
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
    fd.append('role', app.position.toLowerCase());
    fd.append('salary', '2500');

    const res = await createEmployeeAccount(fd);
    if (res.error) {
      setHireError(`Could not hire ${app.name}: ${res.error}`);
    } else {
      await dbOp('hr_applicants', 'update', { status: 'Hired' }, { id: app.id });
      setApplicants(prev => prev.filter(a => a.id !== app.id));
      router.refresh();
    }
    setIsSubmitting(false);
  };

  const handleReject = async (id: string) => {
    await dbOp('hr_applicants', 'update', { status: 'Rejected' }, { id });
    setApplicants(prev => prev.filter(a => a.id !== id));
  };

  return (
    <>
      <div className="three" style={{ marginBottom: '14px' }}>
        <div className="stat">
          <div className="s-l">High Priority · 90+</div>
          <div className="s-v gn">{applicants.filter(a => a.score >= 90).length}</div>
        </div>
        <div className="stat">
          <div className="s-l">Low Chance · 70–89</div>
          <div className="s-v am">{applicants.filter(a => a.score >= 70 && a.score < 90).length}</div>
        </div>
        <div className="stat">
          <div className="s-l">Below threshold · &lt;70</div>
          <div className="s-v rd">{applicants.filter(a => a.score < 70).length}</div>
        </div>
      </div>

      {hireError && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
          {hireError}
        </div>
      )}

      <div className="pn">
        <div className="pn-h" style={{ marginBottom: '14px' }}>
          <div className="pn-t">Active Applicants</div>
          <button className="pv-btn pv-btn-pri" onClick={() => setIsAddModalOpen(true)}>+ Add Applicant</button>
        </div>

        {applicants.length === 0 && <div className="empty">No active applicants to review.</div>}

        {applicants.map(a => {
          const isHigh = a.score >= 90;
          const isMed = a.score >= 70;
          return (
            <div key={a.id} className="r-cd">
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: isHigh ? '#ecfdf5' : isMed ? '#fef3c7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: isHigh ? '#047857' : isMed ? '#b45309' : '#dc2626', flexShrink: 0 }}>
                {a.score}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>{a.email} · {a.position}</div>
              </div>
              <span className={`pv-bdg ${isHigh ? 'pv-bdg-green' : isMed ? 'pv-bdg-amber' : 'pv-bdg-red'}`}>
                {isHigh ? 'High priority' : isMed ? 'Low chance' : 'Below threshold'}
              </span>
              <button className="pv-btn pv-btn-pri" style={{ fontSize: '11px' }} onClick={() => handleHire(a)} disabled={isSubmitting}>
                Hire →
              </button>
              <button
                onClick={() => handleReject(a.id)}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' }}
                title="Reject"
              >×</button>
            </div>
          );
        })}
      </div>

      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '420px', maxWidth: '100%' }}>
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
                </select>
              </div>
              <div className="pv-fld"><label>Interview Score (0–100)</label><input type="number" name="score" min="0" max="100" defaultValue={80} required /></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add'}</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
