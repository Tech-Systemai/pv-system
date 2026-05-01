'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function ContractsClient({ initialContracts, users, isMgmt, currentUserId }: { initialContracts: any[], users: any[], isMgmt: boolean, currentUserId: string }) {
  const [contracts, setContracts] = useState(initialContracts);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewingContract, setViewingContract] = useState<any>(null);
  const supabase = createClient();

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGenerating(true);
    const formData = new FormData(e.currentTarget);
    const userId = formData.get('user_id') as string;
    const type = formData.get('type') as string;

    const newContract = {
      user_id: userId,
      type,
      effective_date: new Date().toISOString().split('T')[0],
      status: 'Pending'
    };

    const { data } = await supabase.from('contracts').insert([newContract]).select('*, profiles!contracts_user_id_fkey(name)');
    if (data && data[0]) {
      setContracts([data[0], ...contracts]);
      setViewingContract(data[0]); // Open immediately
    }
    setIsGenerating(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (viewingContract) {
    return (
      <div className="pdf-preview" style={{ background: '#fff', padding: '40px', maxWidth: '800px', margin: '0 auto', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button className="pv-btn" onClick={() => setViewingContract(null)}>← Back</button>
          <button className="pv-btn pv-btn-pri" onClick={handlePrint}>🖨️ Print to PDF</button>
        </div>
        
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1f2e', paddingBottom: '20px', marginBottom: '30px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '1px' }}>PIONEERS VENEERS</h1>
          <div style={{ color: '#6b7689', fontSize: '12px', marginTop: '5px' }}>Official Employment Contract · Auto-Generated</div>
        </div>

        <h2 style={{ textAlign: 'center', fontSize: '18px', marginBottom: '30px' }}>EMPLOYMENT AGREEMENT ({viewingContract.type.toUpperCase()})</h2>
        
        <p style={{ lineHeight: '1.8', color: '#1a1f2e' }}>
          This Employment Agreement is executed on <strong>{viewingContract.effective_date}</strong> between Pioneers Veneers ("Employer") and <strong>{viewingContract.profiles?.name}</strong> ("Employee").
        </p>

        <h3 style={{ fontSize: '14px', marginTop: '20px' }}>1. Position and Duties</h3>
        <p style={{ lineHeight: '1.6', color: '#4a5568', fontSize: '13px' }}>
          The Employee will be employed as a {viewingContract.type} professional. The Employee agrees to perform all duties and responsibilities assigned by the Employer faithfully and to the best of their abilities.
        </p>

        <h3 style={{ fontSize: '14px', marginTop: '20px' }}>2. Compensation & Attendance</h3>
        <p style={{ lineHeight: '1.6', color: '#4a5568', fontSize: '13px' }}>
          Compensation will be determined based on the official target metrics and base salary structure configured in the system. The Employee is subject to the automated Policy Engine, which governs points and deductions for attendance (late arrivals, absences).
        </p>

        <h3 style={{ fontSize: '14px', marginTop: '20px' }}>3. Confidentiality</h3>
        <p style={{ lineHeight: '1.6', color: '#4a5568', fontSize: '13px' }}>
          The Employee agrees to keep all proprietary information, client data, and internal processes strictly confidential during and after employment.
        </p>

        <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ width: '40%', borderTop: '1px solid #1a1f2e', paddingTop: '10px' }}>
            <strong>Employer Signature</strong><br />
            <span style={{ fontSize: '11px', color: '#6b7689' }}>Authorized by Mgmt</span>
          </div>
          <div style={{ width: '40%', borderTop: '1px solid #1a1f2e', paddingTop: '10px' }}>
            <strong>Employee Signature</strong><br />
            <span style={{ fontSize: '11px', color: '#6b7689' }}>{viewingContract.profiles?.name}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="two">
      <div className="pn">
        <div className="pn-h">
          <div className="pn-t">Active Contracts</div>
        </div>
        {contracts.length === 0 && <div className="empty">No contracts found.</div>}
        {contracts.map((c) => (
          <div key={c.id} className="r-cd">
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>📄</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{c.profiles?.name || 'You'}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>{c.type} · Effective: {c.effective_date}</div>
            </div>
            <span className={`pv-bdg ${c.status === 'Signed' ? 'pv-bdg-green' : 'pv-bdg-amber'}`}>{c.status}</span>
            <button className="pv-btn pv-btn-sec" onClick={() => setViewingContract(c)}>View / Print</button>
          </div>
        ))}
      </div>
      
      {isMgmt && (
        <div className="pn" style={{ alignSelf: 'start' }}>
          <div className="pn-t" style={{ marginBottom: '13px' }}>Generate New Contract</div>
          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="pv-fld">
              <label>Employee</label>
              <select name="user_id" required>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
            <div className="pv-fld">
              <label>Template Type</label>
              <select name="type" required>
                <option value="Sales Associate">Sales Associate</option>
                <option value="CX Specialist">CX Specialist</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Independent Contractor">Independent Contractor</option>
              </select>
            </div>
            <button type="submit" className="pv-btn pv-btn-pri" disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate PDF Contract'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
