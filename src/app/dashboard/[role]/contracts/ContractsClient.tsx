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
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <button className="btn btn-sec" onClick={() => setView('list')}>← Back</button>
          <button className="btn btn-acc" onClick={() => window.print()}>🖨️ Print / Download PDF</button>
        </div>

        <div style={{ background: '#fff', padding: '48px', maxWidth: 800, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: 8, fontFamily: 'Inter, sans-serif' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1f2e', paddingBottom: 20, marginBottom: 30 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '1px', color: '#0f172a' }}>PIONEERS VENEERS</div>
            <div style={{ fontSize: 11, color: '#6b7689', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>Employment Agreement · Official Document</div>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 28, color: '#1a1f2e' }}>
            {viewingContract.type} Agreement
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 28, fontSize: 12 }}>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Employee</span><br /><strong>{viewingContract.profiles?.name ?? '—'}</strong></div>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Role</span><br /><strong>{viewingContract.profiles?.role ?? viewingContract.type}</strong></div>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Effective Date</span><br /><strong>{viewingContract.effective_date}</strong></div>
            {viewingContract.end_date && (
              <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>End Date</span><br /><strong>{viewingContract.end_date}</strong></div>
            )}
          </div>

          <p style={{ lineHeight: 1.8, color: '#1a1f2e', fontSize: 13, marginBottom: 24 }}>
            This Employment Agreement is entered into on <strong>{viewingContract.effective_date}</strong> between <strong>Pioneers Veneers</strong> ("Employer") and <strong>{viewingContract.profiles?.name ?? 'the Employee'}</strong> ("Employee"), and shall govern the terms of employment as outlined below.
          </p>

          {resolvedSections.map((sec, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, borderBottom: '1px solid #e4e7eb', paddingBottom: 6, marginBottom: 10, color: '#1a1f2e' }}>{sec.title}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.8, color: '#4a5568', whiteSpace: 'pre-wrap' }}>{sec.content}</p>
            </div>
          ))}

          <div style={{ marginTop: 60, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1a1f2e', paddingTop: 16 }}>
            <div style={{ width: '42%' }}>
              <strong style={{ fontSize: 12 }}>Employer Signature</strong><br />
              <span style={{ fontSize: 11, color: '#6b7689' }}>Pioneers Veneers — Authorized Management</span><br />
              <div style={{ marginTop: 28, borderTop: '1px solid #94a3b8', fontSize: 10, color: '#94a3b8', paddingTop: 4 }}>Signature &amp; Date</div>
            </div>
            <div style={{ width: '42%', textAlign: 'right' }}>
              <strong style={{ fontSize: 12 }}>Employee Signature</strong><br />
              <span style={{ fontSize: 11, color: '#6b7689' }}>{viewingContract.profiles?.name}</span><br />
              <div style={{ marginTop: 28, borderTop: '1px solid #94a3b8', fontSize: 10, color: '#94a3b8', paddingTop: 4 }}>Signature &amp; Date</div>
            </div>
          </div>

          <div style={{ marginTop: 24, fontSize: 9, color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
            Generated by Pioneers Veneers Enterprise Platform · Ref: CTR-{viewingContract.id?.slice(0, 8).toUpperCase() ?? Date.now().toString().slice(-8)} · {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    );
  }

  // ---- CREATE ----
  if (view === 'create' && isMgmt) {
    return (
      <div className="page-fade">
        <div className="briefing" style={{ marginBottom: 20 }}>
          <div>
            <div className="card-title">New Contract</div>
            <div className="card-sub">Fill in details and generate the contract document</div>
          </div>
          <div className="briefing-actions">
            <button className="btn btn-sec" onClick={() => setView('list')}>← Back</button>
            <button className="btn btn-acc" onClick={handleGenerate} disabled={isGenerating || !selectedUser}>
              {isGenerating ? 'Generating…' : 'Generate Contract →'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: '20px 18px' }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Contract Details</div>
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
                <label>End Date <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-hdr">
                <div className="card-title">Contract Sections</div>
                <button className="btn btn-sec btn-sm" onClick={addSection}>+ Add Clause</button>
              </div>
              <div style={{ padding: '0 18px 18px' }}>
                {sections.map((sec, i) => (
                  <div key={i} style={{ marginBottom: 16, border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input type="text" value={sec.title} onChange={e => updateSection(i, 'title', e.target.value)} style={{ flex: 1, fontWeight: 600, fontSize: 13, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)' }} />
                      <button onClick={() => removeSection(i)} style={{ background: 'none', border: 'none', color: 'var(--err)', cursor: 'pointer', fontSize: 14, padding: '2px 6px', flexShrink: 0 }} title="Remove clause">✕</button>
                    </div>
                    <textarea rows={4} value={sec.content} onChange={e => updateSection(i, 'content', e.target.value)} placeholder="Clause content…" style={{ width: '100%', fontSize: 12.5, lineHeight: 1.7, padding: '8px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <button className="btn btn-sec" style={{ width: '100%', fontSize: 12 }} onClick={addSection}>
                  + Add Custom Clause
                </button>
              </div>
            </div>
          </div>

          {/* Mini preview */}
          <div className="card" style={{ padding: '20px 18px', position: 'sticky', top: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Live Preview</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20, fontFamily: 'Inter, sans-serif', fontSize: 11 }}>
              <div style={{ textAlign: 'center', borderBottom: '1.5px solid #1a1f2e', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.5px' }}>PIONEERS VENEERS</div>
                <div style={{ fontSize: 9, color: '#6b7689', marginTop: 2, textTransform: 'uppercase' }}>Employment Agreement</div>
              </div>
              <div style={{ fontWeight: 700, textAlign: 'center', marginBottom: 12, fontSize: 11, textTransform: 'uppercase' }}>{contractType} Agreement</div>
              <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 6, marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div><span style={{ color: '#6b7689', fontSize: 9 }}>Employee</span><br /><strong>{users.find(u => u.id === selectedUser)?.name ?? '—'}</strong></div>
                <div><span style={{ color: '#6b7689', fontSize: 9 }}>Effective</span><br /><strong>{effectiveDate}</strong></div>
              </div>
              {sections.slice(0, 3).map((s, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, borderBottom: '1px solid #f0f2f5', paddingBottom: 3, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ color: '#4a5568', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.content || <span style={{ color: '#9ca3af' }}>— empty —</span>}
                  </div>
                </div>
              ))}
              {sections.length > 3 && (
                <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>+{sections.length - 3} more clause{sections.length - 3 !== 1 ? 's' : ''}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- LIST ----
  const pending = contracts.filter(c => c.status === 'Pending').length;
  const signed = contracts.filter(c => c.status === 'Signed').length;
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
  const thisMonth = contracts.filter(c => c.effective_date >= startOfMonth.toISOString().split('T')[0]).length;

  return (
    <div className="page-fade">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📄</div></div>
          <div className="stat-l">TOTAL CONTRACTS</div>
          <div className="stat-v">{contracts.length}</div>
          <div className="stat-foot">All contracts</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">⏳</div></div>
          <div className="stat-l">PENDING SIGNATURE</div>
          <div className="stat-v" style={{ color: pending > 0 ? 'var(--warn)' : 'var(--ok)' }}>{pending}</div>
          <div className="stat-foot">Awaiting signing</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">SIGNED</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>{signed}</div>
          <div className="stat-foot">Active contracts</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico acc">↑</div></div>
          <div className="stat-l">THIS MONTH</div>
          <div className="stat-v">{thisMonth}</div>
          <div className="stat-foot">Effective this month</div>
        </div>
      </div>

      <div className="briefing" style={{ marginBottom: 20 }}>
        <div>
          <div className="card-title">Contracts</div>
          <div className="card-sub">{contracts.length} contract{contracts.length !== 1 ? 's' : ''} on file</div>
        </div>
        {isMgmt && (
          <div className="briefing-actions">
            <button className="btn btn-acc" onClick={() => setView('create')}>+ New Contract</button>
          </div>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {contracts.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No contracts found.{isMgmt && ' Generate your first contract above.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Effective Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(c => {
                  const hue = ((c.profiles?.name ?? 'U').charCodeAt(0) * 13) % 360;
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="av-circle" style={{ width: 30, height: 30, fontSize: 10, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                            {(c.profiles?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <span style={{ fontWeight: 600 }}>{c.profiles?.name ?? 'You'}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.type}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>{c.effective_date}</td>
                      <td>
                        <span className={c.status === 'Signed' ? 'bdg bdg-ok' : 'bdg bdg-warn'}>{c.status}</span>
                      </td>
                      <td>
                        <button className="btn btn-sec btn-sm" onClick={() => openView(c)}>View / Print</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
