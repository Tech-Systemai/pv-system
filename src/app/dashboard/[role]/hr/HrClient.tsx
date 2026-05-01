'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { createEmployeeAccount } from '../users/actions';
import { useRouter } from 'next/navigation';

export default function HrClient({ initialApplicants }: { initialApplicants: any[] }) {
  const [applicants, setApplicants] = useState(initialApplicants);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const newApp = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      position: formData.get('position') as string,
      score: Number(formData.get('score')),
      status: 'Reviewing'
    };

    const { data } = await supabase.from('hr_applicants').insert([newApp]).select();
    if (data && data[0]) {
      setApplicants([data[0], ...applicants]);
    }
    setIsAddModalOpen(false);
    setIsSubmitting(false);
  };

  const handleHire = async (app: any) => {
    setIsSubmitting(true);
    // 1. Create the user account securely
    const formData = new FormData();
    formData.append('email', app.email);
    formData.append('username', app.email);
    formData.append('password', 'pioneers2026!');
    formData.append('name', app.name);
    formData.append('role', app.position.toLowerCase());
    formData.append('salary', '2500'); // Default base salary

    const res = await createEmployeeAccount(formData);
    if (res.error) {
      alert(`Error hiring: ${res.error}`);
    } else {
      // 2. Update applicant status
      await supabase.from('hr_applicants').update({ status: 'Hired' }).eq('id', app.id);
      setApplicants(applicants.filter(a => a.id !== app.id));
      alert(`${app.name} has been hired and their account was provisioned.`);
    }
    setIsSubmitting(false);
  };

  const handleReject = async (id: string) => {
    await supabase.from('hr_applicants').update({ status: 'Rejected' }).eq('id', id);
    setApplicants(applicants.filter(a => a.id !== id));
  };

  return (
    <>
      <div className="three" style={{ marginBottom: '14px' }}>
        <div className="stat">
          <div className="s-l">High Priority · 90+</div>
          <div className="s-v gn">{applicants.filter(a => a.score >= 90).length}</div>
        </div>
        <div className="stat">
          <div className="s-l">Low Chance · 70-89</div>
          <div className="s-v" style={{ color: '#b45309' }}>{applicants.filter(a => a.score >= 70 && a.score < 90).length}</div>
        </div>
        <div className="stat">
          <div className="s-l">Auto-Trashed · &lt;50</div>
          <div className="s-v rd">0</div>
        </div>
      </div>
      
      <div className="pn">
        <div className="pn-h">
          <div className="pn-t">Active applicants</div>
          <button className="pv-btn pv-btn-pri" onClick={() => setIsAddModalOpen(true)}>+ Add applicant</button>
        </div>
        
        {applicants.length === 0 && <div className="empty">No active applicants to review.</div>}
        
        {applicants.map(a => {
          const isHigh = a.score >= 90;
          const isMed = a.score >= 70 && a.score < 90;
          const slColor = isHigh ? 'gn' : isMed ? 'am' : 'rd';
          const slLabel = isHigh ? 'High priority' : isMed ? 'Low chance' : 'Rejected';
          
          return (
            <div key={a.id} className="r-cd">
              <div style={{ 
                width: '40px', height: '40px', borderRadius: '8px', 
                background: isHigh ? '#ecfdf5' : isMed ? '#fef3c7' : '#fee2e2', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontWeight: 700, color: isHigh ? '#047857' : isMed ? '#b45309' : '#dc2626' 
              }}>
                {a.score}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>{a.email}</div>
              </div>
              <span className="pv-bdg pv-bdg-indigo">{a.position}</span>
              <span className={`pv-bdg pv-bdg-${slColor === 'gn' ? 'green' : slColor === 'am' ? 'amber' : 'red'}`}>{slLabel}</span>
              
              <button className="pv-btn" style={{ background: 'transparent', color: '#10b981' }} onClick={() => handleHire(a)} disabled={isSubmitting}>
                Hire
              </button>
              <button className="pv-btn" style={{ background: 'transparent', color: '#dc2626', fontSize: '16px' }} onClick={() => handleReject(a.id)}>
                ×
              </button>
            </div>
          );
        })}
      </div>

      {isAddModalOpen && (
        <div className="mb" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="md" style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '420px', maxWidth: '100%' }}>
            <div className="md-t" style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Add applicant</div>
            <form onSubmit={handleAdd}>
              <div className="pv-fld"><label>Name</label><input type="text" name="name" required /></div>
              <div className="pv-fld"><label>Email</label><input type="email" name="email" required /></div>
              <div className="pv-fld">
                <label>Position</label>
                <select name="position">
                  <option value="Sales">Sales</option>
                  <option value="CX">CX</option>
                </select>
              </div>
              <div className="pv-fld"><label>Score</label><input type="number" name="score" min="0" max="100" defaultValue="80" required /></div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={isSubmitting}>Save</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
