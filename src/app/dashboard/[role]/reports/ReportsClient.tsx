'use client';

import { useState } from 'react';

type ReportType = 'qa-evaluation' | 'warning' | 'collective-action' | 'performance-summary';

const REPORT_TYPES: { id: ReportType; label: string; desc: string }[] = [
  { id: 'qa-evaluation', label: 'QA Evaluation', desc: 'Quality Attributes score report from a coaching session' },
  { id: 'warning', label: 'Written Warning', desc: 'Formal disciplinary warning sent to employee inbox' },
  { id: 'collective-action', label: 'Collective Action', desc: 'Team-wide notice or policy enforcement memo' },
  { id: 'performance-summary', label: 'Performance Summary', desc: 'Monthly performance overview with attendance & sales data' },
];

export default function ReportsClient({
  reports,
  employees,
  isMgmt,
  currentUserId,
  currentUserName,
}: {
  reports: any[];
  employees: any[];
  isMgmt: boolean;
  currentUserId: string;
  currentUserName: string;
}) {
  const [view, setView] = useState<'list' | 'create' | 'preview'>('list');
  const [reportType, setReportType] = useState<ReportType>('qa-evaluation');
  const [targetType, setTargetType] = useState<'individual' | 'team'>('individual');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [notes, setNotes] = useState('');
  const [printData, setPrintData] = useState<any>(null);

  const handleGenerate = () => {
    const emp = employees.find(e => e.id === selectedEmployee);
    const session = reports.find(r => r.id === selectedSession);
    setPrintData({
      type: reportType,
      targetType,
      employee: emp,
      session,
      notes,
      generatedBy: currentUserName,
      generatedAt: new Date().toLocaleDateString(),
    });
    setView('preview');
  };

  if (view === 'preview' && printData) {
    return (
      <div>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button className="pv-btn pv-btn-sec" onClick={() => setView('create')}>← Back</button>
          <button className="pv-btn pv-btn-pri" onClick={() => window.print()}>🖨️ Print / Download PDF</button>
        </div>

        <div style={{ background: '#fff', padding: '48px', maxWidth: '800px', margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1a1f2e', paddingBottom: '20px', marginBottom: '32px' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#1a1f2e', letterSpacing: '1px' }}>PIONEERS VENEERS</div>
              <div style={{ fontSize: '11px', color: '#6b7689', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>
                {REPORT_TYPES.find(r => r.id === printData.type)?.label} · Official Document
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px', color: '#6b7689' }}>
              <div>Date: {printData.generatedAt}</div>
              <div>Ref: RPT-{Date.now().toString().slice(-6)}</div>
            </div>
          </div>

          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '24px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {REPORT_TYPES.find(r => r.id === printData.type)?.label}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px', background: '#f8fafc', padding: '18px', borderRadius: '8px' }}>
            {printData.targetType === 'individual' ? (
              <>
                <div><div style={{ fontSize: '10px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Employee</div><div style={{ fontWeight: 600 }}>{printData.employee?.name ?? 'All Employees'}</div></div>
                <div><div style={{ fontSize: '10px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Role</div><div style={{ fontWeight: 600 }}>{printData.employee?.role ?? '—'}</div></div>
                <div><div style={{ fontSize: '10px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Department</div><div style={{ fontWeight: 600 }}>{printData.employee?.department ?? '—'}</div></div>
                <div><div style={{ fontSize: '10px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Reliability Points</div><div style={{ fontWeight: 600 }}>{printData.employee?.points ?? '—'}/7</div></div>
              </>
            ) : (
              <>
                <div><div style={{ fontSize: '10px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Scope</div><div style={{ fontWeight: 600 }}>All Team Members</div></div>
                <div><div style={{ fontSize: '10px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 600 }}>Issued By</div><div style={{ fontWeight: 600 }}>{printData.generatedBy}</div></div>
              </>
            )}
          </div>

          {printData.type === 'qa-evaluation' && printData.session && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, borderBottom: '1px solid #e4e7eb', paddingBottom: '8px', marginBottom: '12px' }}>QA Session Details</h3>
              <div style={{ fontSize: '13px', color: '#4a5568', lineHeight: 1.8 }}>
                <div><strong>Session Type:</strong> {printData.session.type}</div>
                <div><strong>Notes:</strong> {printData.session.notes}</div>
                <div><strong>Action Plan:</strong> {printData.session.action_plan}</div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, borderBottom: '1px solid #e4e7eb', paddingBottom: '8px', marginBottom: '12px' }}>
              {printData.type === 'warning' ? 'Warning Details' : printData.type === 'collective-action' ? 'Notice' : 'Notes & Observations'}
            </h3>
            <div style={{ fontSize: '13px', color: '#1a1f2e', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {printData.notes || 'No additional notes provided.'}
            </div>
          </div>

          <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ width: '40%', borderTop: '1px solid #1a1f2e', paddingTop: '10px' }}>
              <strong style={{ fontSize: '12px' }}>Issued By: {printData.generatedBy}</strong><br />
              <span style={{ fontSize: '11px', color: '#6b7689' }}>Authorized Management Signature</span>
            </div>
            {printData.targetType === 'individual' && (
              <div style={{ width: '40%', borderTop: '1px solid #1a1f2e', paddingTop: '10px' }}>
                <strong style={{ fontSize: '12px' }}>Employee Acknowledgement</strong><br />
                <span style={{ fontSize: '11px', color: '#6b7689' }}>{printData.employee?.name} · Signature</span>
              </div>
            )}
          </div>

          <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '10px', color: '#94a3b8', borderTop: '1px solid #f0f2f5', paddingTop: '16px' }}>
            This document was auto-generated by the Pioneers Veneers Enterprise Platform. It is legally binding upon physical signature.
          </div>
        </div>
      </div>
    );
  }

  if (view === 'create' && isMgmt) {
    const selectedTypeInfo = REPORT_TYPES.find(r => r.id === reportType);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button className="pv-btn pv-btn-sec" onClick={() => setView('list')}>← Back</button>
        </div>

        <div className="pn" style={{ maxWidth: '620px' }}>
          <div className="pn-t" style={{ marginBottom: '18px' }}>Generate New Report</div>

          <div className="pv-fld">
            <label>Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)}>
              {REPORT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <div style={{ fontSize: '11px', color: '#6b7689', marginTop: '4px' }}>{selectedTypeInfo?.desc}</div>
          </div>

          <div className="pv-fld">
            <label>Target</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className={`pv-btn ${targetType === 'individual' ? 'pv-btn-pri' : 'pv-btn-sec'}`} onClick={() => setTargetType('individual')}>Individual Employee</button>
              <button type="button" className={`pv-btn ${targetType === 'team' ? 'pv-btn-pri' : 'pv-btn-sec'}`} onClick={() => setTargetType('team')}>Whole Team</button>
            </div>
          </div>

          {targetType === 'individual' && (
            <div className="pv-fld">
              <label>Select Employee</label>
              <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} required>
                <option value="">— Choose employee —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
              </select>
            </div>
          )}

          {reportType === 'qa-evaluation' && (
            <div className="pv-fld">
              <label>Coaching Session</label>
              <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                <option value="">— Link to a session (optional) —</option>
                {reports
                  .filter(r => !selectedEmployee || r.agent_id === selectedEmployee)
                  .map(r => (
                    <option key={r.id} value={r.id}>
                      {r.agent?.name} · {r.type} · {new Date(r.created_at).toLocaleDateString()}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="pv-fld">
            <label>
              {reportType === 'warning' ? 'Warning Details & Reason' :
               reportType === 'collective-action' ? 'Notice Content' :
               reportType === 'performance-summary' ? 'Summary Notes' : 'Additional Notes'}
            </label>
            <textarea
              rows={6}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={
                reportType === 'warning' ? 'Describe the policy violation, incident details, and expected corrective action...' :
                reportType === 'collective-action' ? 'Write the team-wide notice or collective policy memo...' :
                'Add observations, context, or manager commentary...'
              }
            />
          </div>

          <button
            className="pv-btn pv-btn-pri"
            onClick={handleGenerate}
            disabled={targetType === 'individual' && !selectedEmployee}
          >
            Generate PDF Report →
          </button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div>
      <div className="pn-h" style={{ marginBottom: '16px' }}>
        <div className="pn-t">{isMgmt ? 'All Reports' : 'My Reports'}</div>
        {isMgmt && (
          <button className="pv-btn pv-btn-pri" onClick={() => setView('create')}>+ Generate Report</button>
        )}
      </div>

      <div className="pn">
        {reports.length === 0 && <div className="empty">No reports found. {isMgmt && 'Use "Generate Report" to create your first one.'}</div>}
        {reports.map(r => (
          <div key={r.id} className="r-cd">
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontSize: '16px' }}>📊</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{r.agent?.name || 'You'} · {r.type ?? 'QA Evaluation'}</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>
                {isMgmt && r.supervisor?.name && `By ${r.supervisor.name} · `}
                {new Date(r.created_at).toLocaleDateString()}
              </div>
            </div>
            <span className={`pv-bdg ${r.type === 'Performance' ? 'pv-bdg-green' : 'pv-bdg-amber'}`}>{r.type}</span>
            <button
              className="pv-btn pv-btn-sec"
              onClick={() => {
                setPrintData({
                  type: 'qa-evaluation',
                  targetType: 'individual',
                  employee: r.agent,
                  session: r,
                  notes: r.notes,
                  generatedBy: r.supervisor?.name ?? currentUserName,
                  generatedAt: new Date(r.created_at).toLocaleDateString(),
                });
                setView('preview');
              }}
            >View / Print PDF</button>
          </div>
        ))}
      </div>
    </div>
  );
}
