'use client';

import { useState } from 'react';

export default function ReportsClient({ reports, isMgmt }: { reports: any[], isMgmt: boolean }) {
  const [viewingReport, setViewingReport] = useState<any>(null);

  const handlePrint = () => {
    window.print();
  };

  if (viewingReport) {
    return (
      <div className="pdf-preview" style={{ background: '#fff', padding: '40px', maxWidth: '800px', margin: '0 auto', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button className="pv-btn" onClick={() => setViewingReport(null)}>← Back</button>
          <button className="pv-btn pv-btn-pri" onClick={handlePrint}>🖨️ Print to PDF</button>
        </div>
        
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1f2e', paddingBottom: '20px', marginBottom: '30px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '1px' }}>PIONEERS VENEERS</h1>
          <div style={{ color: '#6b7689', fontSize: '12px', marginTop: '5px' }}>Official Performance Report · Auto-Generated</div>
        </div>

        <h2 style={{ textAlign: 'center', fontSize: '18px', marginBottom: '30px' }}>QUALITY ASSURANCE EVALUATION</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px', background: '#f5f6f8', padding: '20px', borderRadius: '8px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#6b7689', textTransform: 'uppercase' }}>Employee</div>
            <div style={{ fontWeight: 600 }}>{viewingReport.agent?.name}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#6b7689', textTransform: 'uppercase' }}>Date</div>
            <div style={{ fontWeight: 600 }}>{new Date(viewingReport.created_at).toLocaleDateString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#6b7689', textTransform: 'uppercase' }}>Evaluation Score</div>
            <div style={{ fontWeight: 700, fontSize: '18px', color: viewingReport.score >= 80 ? '#047857' : viewingReport.score >= 60 ? '#f59e0b' : '#dc2626' }}>
              {viewingReport.score}%
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: '14px', marginTop: '20px', borderBottom: '1px solid #e4e7eb', paddingBottom: '10px' }}>Manager Feedback</h3>
        <p style={{ lineHeight: '1.6', color: '#1a1f2e', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
          {viewingReport.feedback || 'No written feedback provided.'}
        </p>

        <div style={{ marginTop: '80px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ width: '40%', borderTop: '1px solid #1a1f2e', paddingTop: '10px' }}>
            <strong>Supervisor Signature</strong><br />
            <span style={{ fontSize: '11px', color: '#6b7689' }}>Electronic Signature Confirmed</span>
          </div>
          <div style={{ width: '40%', borderTop: '1px solid #1a1f2e', paddingTop: '10px' }}>
            <strong>Employee Acknowledgement</strong><br />
            <span style={{ fontSize: '11px', color: '#6b7689' }}>{viewingReport.agent?.name}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pn">
      <div className="pn-h">
        <div className="pn-t">{isMgmt ? 'All QA Reports' : 'My QA Reports'}</div>
      </div>
      {reports.length === 0 && <div className="empty">No reports found.</div>}
      {reports.map((r) => (
        <div key={r.id} className="r-cd">
          <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{r.agent?.name || 'You'} · QA Evaluation</div>
            <div style={{ fontSize: '11px', color: '#6b7689' }}>{new Date(r.created_at).toLocaleDateString()}</div>
          </div>
          <div style={{ fontWeight: 700, color: r.score >= 80 ? '#047857' : r.score >= 60 ? '#f59e0b' : '#dc2626', marginRight: '16px' }}>{r.score}%</div>
          <button className="pv-btn pv-btn-sec" onClick={() => setViewingReport(r)}>View / Print PDF</button>
        </div>
      ))}
    </div>
  );
}
