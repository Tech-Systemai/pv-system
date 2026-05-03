'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

type Section = { title: string; content: string };
type Contract = {
  id?: string;
  user_id: string;
  type: string;
  effective_date: string;
  end_date?: string;
  status: string;
  content?: string;
  profiles?: { name: string; role: string; salary?: number };
};

const CONTRACT_TEMPLATES: Record<string, Section[]> = {
  'Sales Associate': [
    { title: '1. Position and Duties', content: 'The Employee is hired as a Sales Associate. Responsibilities include prospecting new clients, closing sales, maintaining client relationships, meeting monthly sales targets, and complying with all company policies.' },
    { title: '2. Compensation', content: 'Base salary as configured in the HR system. Commission is earned per the official tiered commission ladder. Point-based deductions apply for attendance violations as governed by the Policy Engine.' },
    { title: '3. Working Hours', content: 'Standard working hours are Monday–Saturday. Attendance is tracked via the company clock-in system. Late arrivals and absences are subject to automatic policy penalties.' },
    { title: '4. Confidentiality', content: 'The Employee shall not disclose any proprietary information, client data, sales strategies, or internal processes to any third party during or after employment.' },
    { title: '5. Termination', content: 'Either party may terminate this agreement with 30 days written notice. Immediate termination may occur for gross misconduct, policy violations, or performance failure.' },
  ],
  'CX Specialist': [
    { title: '1. Position and Duties', content: 'The Employee is hired as a Customer Experience Specialist. Responsibilities include handling client inquiries, resolving complaints, maintaining satisfaction scores, and following all CX procedures.' },
    { title: '2. Compensation', content: 'Base salary as configured in the HR system. Performance bonuses are awarded based on QA evaluation scores and customer satisfaction metrics.' },
    { title: '3. Working Hours', content: 'Standard working hours apply with shift schedule as assigned. Remote or hybrid arrangements are subject to management approval.' },
    { title: '4. Confidentiality', content: 'All client information, internal scripts, and company procedures are strictly confidential and must not be shared externally.' },
    { title: '5. Termination', content: 'Either party may terminate this agreement with 30 days written notice. Immediate termination may occur for gross misconduct or repeated policy violations.' },
  ],
  'Supervisor': [
    { title: '1. Position and Duties', content: 'The Employee is hired as Supervisor with responsibility over assigned team members. Duties include performance management, coaching, schedule approval, QA evaluations, and policy enforcement.' },
    { title: '2. Compensation', content: 'Enhanced base salary plus performance incentives tied to team targets. Compensation reviewed quarterly.' },
    { title: '3. Management Responsibilities', content: 'Supervisor is expected to conduct monthly QA sessions, approve time-off requests, monitor attendance, and escalate compliance issues to management.' },
    { title: '4. Confidentiality & Non-Compete', content: 'This role has access to salary data, personnel files, and strategic plans. All such information is strictly confidential. A 6-month non-compete applies post-employment within the same industry.' },
    { title: '5. Termination', content: 'Either party may terminate this agreement with 60 days written notice. Immediate termination may occur for gross misconduct or breach of fiduciary duty.' },
  ],
  'Independent Contractor': [
    { title: '1. Nature of Engagement', content: 'This is a contract for services, not an employment agreement. The Contractor is engaged as an independent contractor and is not an employee of Pioneers Veneers.' },
    { title: '2. Scope of Work', content: 'The Contractor shall provide services as described in the attached Statement of Work. The Contractor retains control over how work is performed.' },
    { title: '3. Payment Terms', content: 'Payment is made per invoice submission at rates agreed upon prior to engagement. No benefits, deductions, or point systems apply.' },
    { title: '4. Intellectual Property', content: 'All deliverables produced under this contract are the property of Pioneers Veneers upon full payment.' },
    { title: '5. Termination', content: 'Either party may terminate this engagement with 14 days written notice without penalty, unless mid-project as specified in the Statement of Work.' },
  ],
};

function parseSections(content?: string): Section[] {
  if (!content) return [];
  try { return JSON.parse(content); } catch { return []; }
}

export default function ContractsClient({
  initialContracts,
  users,
  isMgmt,
  currentUserId,
}: {
  initialContracts: Contract[];
  users: any[];
  isMgmt: boolean;
  currentUserId: string;
}) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts);
  const [view, setView] = useState<'list' | 'create' | 'preview'>('list');
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  // Create form state
  const [selectedUser, setSelectedUser] = useState('');
  const [contractType, setContractType] = useState('Sales Associate');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [sections, setSections] = useState<Section[]>(CONTRACT_TEMPLATES['Sales Associate']);
  const [isGenerating, setIsGenerating] = useState(false);

  const changeType = (type: string) => {
    setContractType(type);
    setSections(CONTRACT_TEMPLATES[type] ?? CONTRACT_TEMPLATES['Sales Associate']);
  };

  const updateSection = (i: number, field: 'title' | 'content', val: string) => {
    setSections(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  const addSection = () => {
    setSections(prev => [...prev, { title: `${prev.length + 1}. Custom Clause`, content: '' }]);
  };

  const removeSection = (i: number) => {
    setSections(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleGenerate = async () => {
    if (!selectedUser) return;
    setIsGenerating(true);
    const payload = {
      user_id: selectedUser,
      type: contractType,
      effective_date: effectiveDate,
      end_date: endDate || null,
      status: 'Pending',
      content: JSON.stringify(sections),
    };
    const { data } = await dbOp('contracts', 'insert', payload, undefined, '*, profiles!contracts_user_id_fkey(name, role, salary)');
    if (data?.[0]) {
      setContracts([data[0], ...contracts]);
      setViewingContract(data[0]);
      setView('preview');
    }
    setIsGenerating(false);
  };

  const openView = (c: Contract) => {
    setViewingContract(c);
    setView('preview');
  };

  // ---- PREVIEW ----
  if (view === 'preview' && viewingContract) {
    const resolvedSections: Section[] = parseSections(viewingContract.content).length
      ? parseSections(viewingContract.content)
      : CONTRACT_TEMPLATES[viewingContract.type] ?? CONTRACT_TEMPLATES['Sales Associate'];

    return (
      <div>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            .sb, .tb, .foot, .no-print, .pv-grid > aside { display: none !important; }
            .pv-grid { display: block !important; }
            .main, .cnt { padding: 0 !important; margin: 0 !important; }
            body { background: white !important; }
          }
        ` }} />
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button className="pv-btn pv-btn-sec" onClick={() => setView('list')}>← Back</button>
          <button className="pv-btn pv-btn-pri" onClick={() => window.print()}>🖨️ Print / Download PDF</button>
        </div>

        <div style={{ background: '#fff', padding: '48px', maxWidth: '800px', margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: '8px', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1f2e', paddingBottom: '20px', marginBottom: '30px' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '1px', color: '#0f172a' }}>PIONEERS VENEERS</div>
            <div style={{ fontSize: '11px', color: '#6b7689', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>Employment Agreement · Official Document</div>
          </div>

          <h2 style={{ fontSize: '15px', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '28px', color: '#1a1f2e' }}>
            {viewingContract.type} Agreement
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '28px', fontSize: '12px' }}>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>Employee</span><br /><strong>{viewingContract.profiles?.name ?? '—'}</strong></div>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>Role</span><br /><strong>{viewingContract.profiles?.role ?? viewingContract.type}</strong></div>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>Effective Date</span><br /><strong>{viewingContract.effective_date}</strong></div>
            {viewingContract.end_date && (
              <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>End Date</span><br /><strong>{viewingContract.end_date}</strong></div>
            )}
          </div>

          <p style={{ lineHeight: 1.8, color: '#1a1f2e', fontSize: '13px', marginBottom: '24px' }}>
            This Employment Agreement is entered into on <strong>{viewingContract.effective_date}</strong> between <strong>Pioneers Veneers</strong> ("Employer") and <strong>{viewingContract.profiles?.name ?? 'the Employee'}</strong> ("Employee"), and shall govern the terms of employment as outlined below.
          </p>

          {resolvedSections.map((sec, i) => (
            <div key={i} style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, borderBottom: '1px solid #e4e7eb', paddingBottom: '6px', marginBottom: '10px', color: '#1a1f2e' }}>{sec.title}</h3>
              <p style={{ fontSize: '13px', lineHeight: 1.8, color: '#4a5568', whiteSpace: 'pre-wrap' }}>{sec.content}</p>
            </div>
          ))}

          <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1a1f2e', paddingTop: '16px' }}>
            <div style={{ width: '42%' }}>
              <strong style={{ fontSize: '12px' }}>Employer Signature</strong><br />
              <span style={{ fontSize: '11px', color: '#6b7689' }}>Pioneers Veneers — Authorized Management</span><br />
              <div style={{ marginTop: '28px', borderTop: '1px solid #94a3b8', fontSize: '10px', color: '#94a3b8', paddingTop: '4px' }}>Signature &amp; Date</div>
            </div>
            <div style={{ width: '42%', textAlign: 'right' }}>
              <strong style={{ fontSize: '12px' }}>Employee Signature</strong><br />
              <span style={{ fontSize: '11px', color: '#6b7689' }}>{viewingContract.profiles?.name}</span><br />
              <div style={{ marginTop: '28px', borderTop: '1px solid #94a3b8', fontSize: '10px', color: '#94a3b8', paddingTop: '4px' }}>Signature &amp; Date</div>
            </div>
          </div>

          <div style={{ marginTop: '24px', fontSize: '9px', color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            Generated by Pioneers Veneers Enterprise Platform · Ref: CTR-{viewingContract.id?.slice(0, 8).toUpperCase() ?? Date.now().toString().slice(-8)} · {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    );
  }

  // ---- CREATE ----
  if (view === 'create' && isMgmt) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <button className="pv-btn pv-btn-sec" onClick={() => setView('list')}>← Back</button>
          <button
            className="pv-btn pv-btn-pri"
            onClick={handleGenerate}
            disabled={isGenerating || !selectedUser}
          >
            {isGenerating ? 'Generating...' : 'Generate Contract →'}
          </button>
        </div>

        <div className="two" style={{ gap: '20px', alignItems: 'flex-start' }}>
          {/* Left: settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="pn">
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Contract Details</div>
              <div className="pv-fld">
                <label>Employee</label>
                <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} required>
                  <option value="">— Choose employee —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Contract Type / Template</label>
                <select value={contractType} onChange={e => changeType(e.target.value)}>
                  {Object.keys(CONTRACT_TEMPLATES).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Effective Date</label>
                <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
              </div>
              <div className="pv-fld">
                <label>End Date <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="pn">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>Contract Sections</div>
                <button className="pv-btn pv-btn-sec" style={{ fontSize: '11px' }} onClick={addSection}>+ Add Clause</button>
              </div>
              {sections.map((sec, i) => (
                <div key={i} style={{ marginBottom: '16px', border: '1px solid #e4e7eb', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={sec.title}
                      onChange={e => updateSection(i, 'title', e.target.value)}
                      style={{ flex: 1, fontWeight: 600, fontSize: '13px' }}
                    />
                    <button
                      onClick={() => removeSection(i)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', flexShrink: 0 }}
                      title="Remove clause"
                    >✕</button>
                  </div>
                  <textarea
                    rows={4}
                    value={sec.content}
                    onChange={e => updateSection(i, 'content', e.target.value)}
                    placeholder="Clause content..."
                    style={{ width: '100%', fontSize: '12.5px', lineHeight: 1.7 }}
                  />
                </div>
              ))}
              <button className="pv-btn pv-btn-sec" style={{ width: '100%', fontSize: '12px' }} onClick={addSection}>
                + Add Custom Clause
              </button>
            </div>
          </div>

          {/* Right: mini preview */}
          <div className="pn" style={{ position: 'sticky', top: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Live Preview</div>
            <div style={{ background: '#fff', border: '1px solid #e4e7eb', borderRadius: '8px', padding: '20px', fontFamily: 'Inter, sans-serif', fontSize: '11px' }}>
              <div style={{ textAlign: 'center', borderBottom: '1.5px solid #1a1f2e', paddingBottom: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.5px' }}>PIONEERS VENEERS</div>
                <div style={{ fontSize: '9px', color: '#6b7689', marginTop: '2px', textTransform: 'uppercase' }}>Employment Agreement</div>
              </div>
              <div style={{ fontWeight: 700, textAlign: 'center', marginBottom: '12px', fontSize: '11px', textTransform: 'uppercase' }}>
                {contractType} Agreement
              </div>
              <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div><span style={{ color: '#6b7689', fontSize: '9px' }}>Employee</span><br /><strong>{users.find(u => u.id === selectedUser)?.name ?? '—'}</strong></div>
                <div><span style={{ color: '#6b7689', fontSize: '9px' }}>Effective</span><br /><strong>{effectiveDate}</strong></div>
              </div>
              {sections.slice(0, 3).map((s, i) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ fontWeight: 700, borderBottom: '1px solid #f0f2f5', paddingBottom: '3px', marginBottom: '4px' }}>{s.title}</div>
                  <div style={{ color: '#4a5568', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.content || <span style={{ color: '#9ca3af' }}>— empty —</span>}
                  </div>
                </div>
              ))}
              {sections.length > 3 && (
                <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: '6px' }}>
                  +{sections.length - 3} more clause{sections.length - 3 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- LIST ----
  return (
    <div>
      <div className="pn-h" style={{ marginBottom: '16px' }}>
        <div className="pn-t">Contracts</div>
        {isMgmt && (
          <button className="pv-btn pv-btn-pri" onClick={() => setView('create')}>+ New Contract</button>
        )}
      </div>
      <div className="pn">
        {contracts.length === 0 && <div className="empty">No contracts found. {isMgmt && 'Generate your first contract above.'}</div>}
        {contracts.map(c => (
          <div key={c.id} className="r-cd">
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontSize: '16px' }}>📄</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{c.profiles?.name ?? 'You'}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>{c.type} · Effective: {c.effective_date}</div>
            </div>
            <span className={`pv-bdg ${c.status === 'Signed' ? 'pv-bdg-green' : 'pv-bdg-amber'}`}>{c.status}</span>
            <button className="pv-btn pv-btn-sec" onClick={() => openView(c)}>View / Print</button>
          </div>
        ))}
      </div>
    </div>
  );
}
