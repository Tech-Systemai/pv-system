'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { dbOp } from '@/utils/db';

type Clause = { title: string; content: string };
type Policy = {
  id?: string;
  title: string;
  category: string;
  status: string;
  effective_date?: string;
  content?: string;
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
};
type Ack = {
  id: number;
  user_id: string;
  submitted_by_name: string;
  is_signed: boolean;
  signed_by?: string;
  created_at: string;
};

const CATEGORIES = [
  'Code of Conduct', 'Attendance', 'Remote Work', 'Data Privacy',
  'Safety', 'Leave', 'Compensation', 'General',
];

const POLICY_TEMPLATES: Record<string, Clause[]> = {
  'Code of Conduct': [
    { title: '1. Professional Behavior', content: 'All employees are expected to conduct themselves professionally at all times. This includes respectful communication with colleagues and clients, adherence to dress codes, and maintaining a positive work environment.' },
    { title: '2. Confidentiality', content: 'Employees must maintain strict confidentiality regarding all company information, client data, and internal processes. Sharing confidential information with unauthorized parties is grounds for immediate termination.' },
    { title: '3. Conflict of Interest', content: 'Employees must disclose any personal, financial, or professional interests that may conflict with the interests of the company. Employment with competitors or engagement in competing activities is prohibited without prior written consent.' },
    { title: '4. Zero Tolerance Policy', content: 'Pioneers Veneers maintains a zero-tolerance policy for harassment, discrimination, bullying, or any form of workplace misconduct. Violations will be investigated and may result in disciplinary action up to and including termination.' },
    { title: '5. Compliance', content: 'All employees are required to comply with this policy and all applicable laws and regulations. Failure to comply may result in disciplinary action up to and including termination of employment.' },
  ],
  'Attendance': [
    { title: '1. Working Hours', content: 'Standard working hours are as assigned by management. Employees are expected to be available and productive during scheduled hours. Attendance is tracked through the company\'s time-tracking system.' },
    { title: '2. Punctuality', content: 'Employees are expected to be on time for all scheduled shifts. Arriving more than 10 minutes late without prior notification constitutes a tardy. Repeated tardiness may result in disciplinary action.' },
    { title: '3. Absence Reporting', content: 'Employees who are unable to attend work must notify their supervisor at least 1 hour before their scheduled shift start time. Failure to provide timely notification may result in an unexcused absence.' },
    { title: '4. Unexcused Absences', content: 'Three or more unexcused absences within a 30-day period will trigger a formal performance review. Continued unexcused absences may result in disciplinary action up to and including termination.' },
    { title: '5. Leave Requests', content: 'All time-off requests must be submitted through the company\'s leave management system with at least 48 hours advance notice. Emergency leave requests will be handled on a case-by-case basis.' },
  ],
  'Remote Work': [
    { title: '1. Eligibility', content: 'Remote work arrangements are subject to management approval and are not guaranteed. Eligibility is based on role requirements, performance history, and business needs.' },
    { title: '2. Availability', content: 'Remote employees must maintain the same availability and responsiveness as in-office employees during scheduled working hours. Response to communications should occur within 15 minutes during work hours.' },
    { title: '3. Equipment & Security', content: 'Employees are responsible for maintaining a secure and professional work environment. Company data must be accessed through approved, secure channels. Use of public Wi-Fi for company business is prohibited without a VPN.' },
    { title: '4. Performance Standards', content: 'Remote employees are held to the same performance standards as in-office staff. Performance will be evaluated on output, quality, and adherence to deadlines rather than hours logged.' },
    { title: '5. Right to Revoke', content: 'Management reserves the right to revoke remote work privileges at any time based on business needs or performance concerns. Employees will be given reasonable notice before such changes take effect.' },
  ],
  'Data Privacy': [
    { title: '1. Data Handling', content: 'All employee and client data must be handled in accordance with applicable data protection laws and company policies. Data should only be accessed on a need-to-know basis.' },
    { title: '2. Data Storage', content: 'Company data must only be stored on approved company systems and cloud platforms. Use of personal storage devices or unauthorized cloud services for company data is strictly prohibited.' },
    { title: '3. Data Sharing', content: 'Client and employee data must never be shared with third parties without explicit written authorization from management. All third-party data-sharing arrangements must be documented and approved.' },
    { title: '4. Security Incidents', content: 'Any suspected data breach, unauthorized access, or security incident must be reported to management immediately. Failure to report a known or suspected breach may result in disciplinary action.' },
    { title: '5. Personal Data', content: 'Employees consent to the collection and processing of personal data for employment-related purposes. This data will be retained only as long as necessary and handled in compliance with applicable privacy regulations.' },
  ],
  'Safety': [
    { title: '1. Safe Work Environment', content: 'All employees are responsible for maintaining a safe working environment. Any hazardous conditions, equipment malfunctions, or safety risks must be reported to management immediately.' },
    { title: '2. Emergency Procedures', content: 'Employees must familiarize themselves with all emergency evacuation procedures, fire exits, and assembly points. Participation in emergency drills is mandatory.' },
    { title: '3. Workplace Injuries', content: 'Any workplace injury, no matter how minor, must be reported to management and documented within 24 hours of the incident. Failure to report may affect eligibility for workers\' compensation.' },
    { title: '4. Prohibited Substances', content: 'The use, possession, or distribution of alcohol or controlled substances on company premises or while conducting company business is strictly prohibited and grounds for immediate termination.' },
    { title: '5. Compliance', content: 'All employees must comply with applicable occupational health and safety regulations. Willful disregard for safety policies may result in disciplinary action up to and including termination.' },
  ],
  'Leave': [
    { title: '1. Annual Leave Entitlement', content: 'Employees are entitled to annual leave as specified in their employment contract. Leave entitlement accrues on a monthly basis and must be approved by management in advance.' },
    { title: '2. Sick Leave', content: 'Employees are entitled to paid sick leave as per their contract terms. Medical certificates may be required for absences exceeding two consecutive working days.' },
    { title: '3. Public Holidays', content: 'Employees are entitled to all gazetted public holidays. Where business requirements necessitate working on public holidays, compensatory leave or additional pay will be provided as per company policy.' },
    { title: '4. Parental Leave', content: 'Maternity and paternity leave entitlements are provided in accordance with applicable labor laws. Employees must provide advance notice and required documentation to HR.' },
    { title: '5. Unpaid Leave', content: 'Unpaid leave may be granted at the discretion of management for circumstances not covered by other leave types. Unpaid leave requests must be submitted in writing and are subject to operational requirements.' },
  ],
  'Compensation': [
    { title: '1. Salary Payment', content: 'Salaries are paid on the schedule as specified in individual employment contracts. Payment is made via bank transfer to the employee\'s designated account.' },
    { title: '2. Deductions', content: 'Authorized deductions from salary may include statutory contributions, advances, and penalty points as per the company\'s Policy Engine. All deductions will be reflected in the employee\'s payslip.' },
    { title: '3. Performance Bonuses', content: 'Performance bonuses are discretionary and based on individual and company performance metrics. Bonus eligibility and amounts are determined by management and communicated in advance.' },
    { title: '4. Salary Reviews', content: 'Salary reviews are conducted annually. Increases are not guaranteed and are based on performance, tenure, and company financial performance.' },
    { title: '5. Expense Reimbursement', content: 'Pre-approved work-related expenses will be reimbursed upon submission of receipts and an expense claim form. Unauthorized expenses will not be reimbursed.' },
  ],
  'General': [
    { title: '1. Purpose', content: 'This policy is established to ensure consistent, fair, and compliant practices within the organisation. All employees are expected to read, understand, and adhere to this policy.' },
    { title: '2. Scope', content: 'This policy applies to all full-time, part-time, and contract employees of Pioneers Veneers, regardless of position or location.' },
    { title: '3. Responsibilities', content: 'Managers are responsible for ensuring their team members are aware of and comply with this policy. Employees are responsible for seeking clarification if any aspect is unclear.' },
    { title: '4. Review and Updates', content: 'This policy will be reviewed annually or as required by changes in legislation or business practice. Employees will be notified of any significant changes.' },
    { title: '5. Non-Compliance', content: 'Non-compliance with this policy may result in disciplinary action, up to and including termination of employment. Serious violations may also result in legal action.' },
  ],
};

function parseClauses(content?: string): Clause[] {
  if (!content) return [];
  try { return JSON.parse(content); } catch { return []; }
}

function buildPolicyHtml(policy: Policy, clauses: Clause[]): string {
  const refId = (policy.id?.slice(0, 8) ?? Date.now().toString().slice(-8)).toUpperCase();
  const date  = policy.effective_date ?? new Date().toISOString().split('T')[0];
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${policy.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" rel="stylesheet">
<style>
  body{font-family:Inter,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 40px;color:#1a1f2e;line-height:1.6}
  h1{text-align:center;font-size:22px;font-weight:800;letter-spacing:1px;margin:0}
  h2{text-align:center;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:24px 0 20px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#f8fafc;padding:16px;border-radius:8px;font-size:12px;margin:20px 0}
  .meta-lbl{font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;display:block;margin-bottom:2px}
  h3{font-size:13px;font-weight:700;border-bottom:1px solid #e4e7eb;padding-bottom:6px;margin:0 0 8px}
  p{font-size:13px;line-height:1.8;color:#4a5568;margin:0 0 20px;white-space:pre-wrap}
  .ack{margin-top:48px;border-top:2px solid #1a1f2e;padding-top:20px}
  .sig-name{font-family:'Dancing Script','Brush Script MT',cursive;font-size:34px;color:#1a1f2e;min-height:46px;margin:12px 0 4px}
  .sig-line{border-top:1px solid #94a3b8;font-size:10px;color:#94a3b8;padding-top:4px}
  .notice{background:#f0f9ff;border:1px solid #bae6fd;padding:12px 16px;border-radius:8px;font-size:12px;color:#0369a1;margin-bottom:20px}
  .footer{margin-top:24px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #f1f5f9;padding-top:12px}
  @media print{body{margin:0}}
</style></head><body>
<div style="text-align:center;border-bottom:2px solid #1a1f2e;padding-bottom:20px;margin-bottom:30px">
  <h1>PIONEERS VENEERS</h1>
  <div style="font-size:11px;color:#6b7689;text-transform:uppercase;letter-spacing:.08em;margin-top:4px">Official Company Policy</div>
</div>
<h2>${policy.title}</h2>
<div class="meta">
  <div><span class="meta-lbl">Category</span><strong>${policy.category}</strong></div>
  <div><span class="meta-lbl">Status</span><strong>${policy.status}</strong></div>
  <div><span class="meta-lbl">Effective Date</span><strong>${date}</strong></div>
  <div><span class="meta-lbl">Issued By</span><strong>${policy.created_by_name ?? 'Management'}</strong></div>
</div>
<div class="notice">This document is an official company policy issued by Pioneers Veneers management. All employees are required to read, understand, and acknowledge receipt of this policy.</div>
${clauses.map(c => `<div style="margin-bottom:20px"><h3>${c.title}</h3><p>${c.content}</p></div>`).join('')}
<div class="ack">
  <strong style="font-size:13px">Employee Acknowledgment</strong><br>
  <p style="font-size:12px;color:#4a5568;margin:8px 0 16px">By signing below, I confirm that I have read, understood, and agree to comply with the <strong>${policy.title}</strong> policy as outlined above.</p>
  <div style="width:50%">
    <div class="sig-name"><!--EMP_SIG_PLACEHOLDER--></div>
    <div class="sig-line"><!--EMP_DATE_PLACEHOLDER-->Employee Signature &amp; Date</div>
  </div>
</div>
<div class="footer">Pioneers Veneers Enterprise Platform · Ref: POL-${refId} · Issued ${new Date().toLocaleDateString()}</div>
</body></html>`;
}

const STATUS_BADGE: Record<string, string> = {
  Draft: 'bdg bdg-gy',
  Active: 'bdg bdg-ok',
  Archived: 'bdg bdg-warn',
};

export default function PoliciesClient({
  initialPolicies, users, isMgmt, currentUserId, currentUserName,
}: {
  initialPolicies: Policy[];
  users: { id: string; name: string; role: string }[];
  isMgmt: boolean;
  currentUserId: string;
  currentUserName: string;
}) {
  const [policies, setPolicies]     = useState<Policy[]>(initialPolicies);
  const [view, setView]             = useState<'list' | 'create' | 'preview'>('list');
  const [viewing, setViewing]       = useState<Policy | null>(null);
  const [editing, setEditing]       = useState<Policy | null>(null);

  // Form state
  const [title, setTitle]           = useState('');
  const [category, setCategory]     = useState(CATEGORIES[0]);
  const [status, setStatus]         = useState('Draft');
  const [effDate, setEffDate]       = useState(new Date().toISOString().split('T')[0]);
  const [clauses, setClauses]       = useState<Clause[]>(POLICY_TEMPLATES[CATEGORIES[0]]);
  const [isSaving, setIsSaving]     = useState(false);

  // Send modal
  const [sendOpen, setSendOpen]     = useState(false);
  const [sendTarget, setSendTarget] = useState('');
  const [sendAll, setSendAll]       = useState(false);
  const [isSending, setIsSending]   = useState(false);
  const [mounted, setMounted]       = useState(false);

  // Ack tracker
  const [acks, setAcks]             = useState<Ack[] | null>(null);

  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const changeCategory = (cat: string) => {
    setCategory(cat);
    setClauses(POLICY_TEMPLATES[cat] ?? POLICY_TEMPLATES['General']);
  };

  const updateClause = (i: number, field: 'title' | 'content', val: string) =>
    setClauses(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));

  const addClause = () =>
    setClauses(prev => [...prev, { title: `${prev.length + 1}. New Clause`, content: '' }]);

  const removeClause = (i: number) =>
    setClauses(prev => prev.filter((_, idx) => idx !== i));

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setCategory(CATEGORIES[0]);
    setStatus('Draft');
    setEffDate(new Date().toISOString().split('T')[0]);
    setClauses(POLICY_TEMPLATES[CATEGORIES[0]]);
    setView('create');
  };

  const openEdit = (p: Policy) => {
    setEditing(p);
    setTitle(p.title);
    setCategory(p.category);
    setStatus(p.status);
    setEffDate(p.effective_date ?? new Date().toISOString().split('T')[0]);
    const parsed = parseClauses(p.content);
    setClauses(parsed.length ? parsed : POLICY_TEMPLATES[p.category] ?? []);
    setView('create');
  };

  const openView = (p: Policy) => {
    setViewing(p);
    setAcks(null);
    setView('preview');
    if (p.id) {
      dbOp('inbox_documents', 'select', undefined, { doc_ref_type: 'policy', doc_ref_id: String(p.id) }, 'id,user_id,submitted_by_name,is_signed,signed_by,created_at')
        .then(({ data }) => setAcks((data ?? []) as Ack[]));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    const payload = {
      title: title.trim(), category, status,
      effective_date: effDate || null,
      content: JSON.stringify(clauses),
      created_by: currentUserId,
      created_by_name: currentUserName,
    };
    const sel = '*';
    if (editing?.id) {
      const { data, error } = await dbOp('policies', 'update', payload, { id: editing.id }, sel);
      if (error) { showToast(`Save failed: ${error}`, false); setIsSaving(false); return; }
      if (data?.[0]) {
        setPolicies(prev => prev.map(p => p.id === editing.id ? data[0] : p));
        setViewing(data[0]);
      }
    } else {
      const { data, error } = await dbOp('policies', 'insert', payload, undefined, sel);
      if (error) { showToast(`Save failed: ${error}`, false); setIsSaving(false); return; }
      if (data?.[0]) { setPolicies(prev => [data[0], ...prev]); setViewing(data[0]); }
    }
    setEditing(null);
    setIsSaving(false);
    setView('preview');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this policy? This cannot be undone.')) return;
    const { error } = await dbOp('policies', 'delete', {}, { id });
    if (error) { showToast(`Delete failed: ${error}`, false); return; }
    setPolicies(prev => prev.filter(p => p.id !== id));
    showToast('Policy deleted');
  };

  const handleSend = async () => {
    if (!viewing) return;
    setIsSending(true);
    const resolvedClauses = parseClauses(viewing.content).length
      ? parseClauses(viewing.content)
      : POLICY_TEMPLATES[viewing.category] ?? [];
    const html    = buildPolicyHtml(viewing, resolvedClauses);
    const subject = viewing.title;

    const targets = sendAll ? users.map(u => u.id) : sendTarget ? [sendTarget] : [];
    if (targets.length === 0) { setIsSending(false); return; }

    let sent = 0;
    for (const uid of targets) {
      const { error } = await dbOp('inbox_documents', 'insert', {
        user_id: uid,
        sender_id: currentUserId,
        title: subject, subject,
        content: `Please read and acknowledge the company policy: ${viewing.title}`,
        type: 'Policy',
        sender: currentUserName,
        submitted_by_name: currentUserName,
        requires_signature: true,
        is_read: false, archived: false,
        html_content: html,
        doc_ref_type: 'policy',
        doc_ref_id: String(viewing.id ?? ''),
      });
      if (!error) sent++;
    }

    setSendOpen(false);
    setSendTarget('');
    setSendAll(false);
    setIsSending(false);
    showToast(`Policy sent to ${sent} employee${sent !== 1 ? 's' : ''}`);

    // Refresh ack list
    if (viewing.id) {
      const { data } = await dbOp('inbox_documents', 'select', undefined, { doc_ref_type: 'policy', doc_ref_id: String(viewing.id) }, 'id,user_id,submitted_by_name,is_signed,signed_by,created_at');
      setAcks((data ?? []) as Ack[]);
    }
  };

  // ─── PREVIEW ────────────────────────────────────────────────────────────────
  if (view === 'preview' && viewing) {
    const resolvedClauses = parseClauses(viewing.content).length
      ? parseClauses(viewing.content)
      : POLICY_TEMPLATES[viewing.category] ?? POLICY_TEMPLATES['General'];

    const acknowledged = (acks ?? []).filter(a => a.is_signed).length;
    const pending      = (acks ?? []).filter(a => !a.is_signed).length;

    return (
      <div>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            .sb,.tb,.foot,.no-print,.pv-grid>aside{display:none!important}
            .pv-grid{display:block!important}
            .main,.cnt{padding:0!important;margin:0!important}
            body{background:white!important}
          }
          .sig-cursive{font-family:'Brush Script MT','Apple Chancery','Dancing Script',cursive}
        ` }} />

        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sec" onClick={() => { setView('list'); }}>← Back</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {isMgmt && <button className="btn btn-sec" onClick={() => openEdit(viewing)}>✏ Edit</button>}
            {isMgmt && (
              <button className="btn btn-acc" onClick={() => setSendOpen(true)}>
                📨 Send to Inbox
              </button>
            )}
            <button className="btn btn-sec" onClick={() => window.print()}>🖨 Print / PDF</button>
          </div>
        </div>

        {/* Policy document */}
        <div style={{ background: '#fff', padding: '48px', maxWidth: 800, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,.08)', borderRadius: 8, fontFamily: 'Inter, sans-serif' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1f2e', paddingBottom: 20, marginBottom: 30 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '1px', color: '#0f172a' }}>PIONEERS VENEERS</div>
            <div style={{ fontSize: 11, color: '#6b7689', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 4 }}>Official Company Policy</div>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 28, color: '#1a1f2e' }}>
            {viewing.title}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 28, fontSize: 12 }}>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Category</span><br /><strong>{viewing.category}</strong></div>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Status</span><br /><strong>{viewing.status}</strong></div>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Effective Date</span><br /><strong>{viewing.effective_date || '—'}</strong></div>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Issued By</span><br /><strong>{viewing.created_by_name || 'Management'}</strong></div>
          </div>

          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '12px 16px', borderRadius: 8, fontSize: 12, color: '#0369a1', marginBottom: 24 }}>
            This document is an official company policy issued by Pioneers Veneers management. All employees are required to read, understand, and acknowledge receipt of this policy.
          </div>

          {resolvedClauses.map((c, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, borderBottom: '1px solid #e4e7eb', paddingBottom: 6, marginBottom: 10, color: '#1a1f2e' }}>{c.title}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.8, color: '#4a5568', whiteSpace: 'pre-wrap' }}>{c.content}</p>
            </div>
          ))}

          <div style={{ marginTop: 48, borderTop: '2px solid #1a1f2e', paddingTop: 20 }}>
            <strong style={{ fontSize: 13 }}>Employee Acknowledgment</strong>
            <p style={{ fontSize: 12, color: '#4a5568', margin: '8px 0 16px', lineHeight: 1.7 }}>
              By signing below, I confirm that I have read, understood, and agree to comply with the <strong>{viewing.title}</strong> policy as outlined above.
            </p>
            <div style={{ width: '50%' }}>
              <div style={{ marginTop: 28, borderTop: '1px solid #94a3b8', fontSize: 11, paddingTop: 4, color: '#94a3b8' }}>
                Employee Signature &amp; Date
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, fontSize: 9, color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
            Pioneers Veneers Enterprise Platform · Ref: POL-{viewing.id?.slice(0, 8).toUpperCase() ?? ''} · Issued {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Acknowledgment tracker */}
        <div className="card no-print" style={{ marginTop: 24, maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', overflow: 'hidden' }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">Acknowledgment Status</div>
              <div className="card-sub">Employees who received this policy via inbox</div>
            </div>
            {acks !== null && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="bdg bdg-ok">{acknowledged} signed</span>
                {pending > 0 && <span className="bdg bdg-warn">{pending} pending</span>}
              </div>
            )}
          </div>
          {acks === null ? (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Loading…</div>
          ) : acks.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📨</div>
              <div>Not yet sent to any employee.</div>
              {isMgmt && <div style={{ fontSize: 12, marginTop: 6 }}>Use "Send to Inbox" to distribute this policy.</div>}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Sent</th>
                    <th>Status</th>
                    <th>Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {acks.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.submitted_by_name || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                        {new Date(a.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        {a.is_signed
                          ? <span className="bdg bdg-ok">Acknowledged</span>
                          : <span className="bdg bdg-warn">Pending</span>}
                      </td>
                      <td style={{ fontFamily: 'cursive', fontSize: 14, color: '#1a1f2e' }}>
                        {a.signed_by || <span style={{ color: 'var(--ink-4)', fontFamily: 'inherit', fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Send modal */}
        {sendOpen && mounted && createPortal(
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setSendOpen(false); }}
          >
            <div style={{ background: '#fff', borderRadius: 16, width: 440, maxWidth: '100%', padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,.22)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1f2e', marginBottom: 6 }}>Send Policy to Inbox</div>
              <div style={{ fontSize: 12, color: '#6b7689', marginBottom: 20 }}>
                Select an employee or send to all — they will receive this policy with a signature request.
              </div>

              <div className="pv-fld" style={{ marginBottom: 16 }}>
                <label>Send to</label>
                <select
                  value={sendAll ? '__all__' : sendTarget}
                  onChange={e => {
                    if (e.target.value === '__all__') { setSendAll(true); setSendTarget(''); }
                    else { setSendAll(false); setSendTarget(e.target.value); }
                  }}
                >
                  <option value="">— Choose employee —</option>
                  <option value="__all__">📢 All Employees</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>

              {sendAll && (
                <div style={{ background: '#fef9c3', border: '1px solid #fde047', padding: '10px 14px', borderRadius: 8, fontSize: 12, color: '#854d0e', marginBottom: 16 }}>
                  ⚠️ This will send to all {users.length} employee{users.length !== 1 ? 's' : ''}.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-sec" onClick={() => setSendOpen(false)}>Cancel</button>
                <button
                  className="btn btn-acc"
                  disabled={isSending || (!sendAll && !sendTarget)}
                  onClick={handleSend}
                >
                  {isSending ? 'Sending…' : '📨 Send'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 500, background: toast.ok ? 'oklch(0.25 0.05 145)' : 'oklch(0.25 0.05 25)', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,.18)' }}>
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  // ─── CREATE / EDIT ───────────────────────────────────────────────────────────
  if (view === 'create' && isMgmt) {
    const isEditing = !!editing;
    return (
      <div className="page-fade">
        <div className="briefing" style={{ marginBottom: 20 }}>
          <div>
            <div className="card-title">{isEditing ? 'Edit Policy' : 'New Policy'}</div>
            <div className="card-sub">{isEditing ? 'Update the policy details and clauses' : 'Define the policy details and add clauses'}</div>
          </div>
          <div className="briefing-actions">
            <button className="btn btn-sec" onClick={() => setView(isEditing ? 'preview' : 'list')}>← Back</button>
            <button className="btn btn-acc" onClick={handleSave} disabled={isSaving || !title.trim()}>
              {isSaving ? 'Saving…' : isEditing ? 'Save Changes →' : 'Create Policy →'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: '20px 18px' }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Policy Details</div>
              <div className="pv-fld">
                <label>Policy Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Remote Work Policy 2025" />
              </div>
              <div className="pv-fld">
                <label>Category / Template</label>
                <select value={category} onChange={e => changeCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
              <div className="pv-fld">
                <label>Effective Date</label>
                <input type="date" value={effDate} onChange={e => setEffDate(e.target.value)} />
              </div>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-hdr">
                <div className="card-title">Clauses</div>
                <button className="btn btn-sec btn-sm" onClick={addClause}>+ Add Clause</button>
              </div>
              <div style={{ padding: '0 18px 18px' }}>
                {clauses.map((c, i) => (
                  <div key={i} style={{ marginBottom: 16, border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input
                        type="text" value={c.title}
                        onChange={e => updateClause(i, 'title', e.target.value)}
                        style={{ flex: 1, fontWeight: 600, fontSize: 13, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)' }}
                      />
                      <button onClick={() => removeClause(i)} style={{ background: 'none', border: 'none', color: 'var(--err)', cursor: 'pointer', fontSize: 14, padding: '2px 6px', flexShrink: 0 }}>✕</button>
                    </div>
                    <textarea
                      rows={4} value={c.content}
                      onChange={e => updateClause(i, 'content', e.target.value)}
                      placeholder="Clause content…"
                      style={{ width: '100%', fontSize: 12.5, lineHeight: 1.7, padding: 8, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
                <button className="btn btn-sec" style={{ width: '100%', fontSize: 12 }} onClick={addClause}>+ Add Clause</button>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="card" style={{ padding: '20px 18px', position: 'sticky', top: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Live Preview</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20, fontFamily: 'Inter, sans-serif', fontSize: 11 }}>
              <div style={{ textAlign: 'center', borderBottom: '1.5px solid #1a1f2e', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>PIONEERS VENEERS</div>
                <div style={{ fontSize: 9, color: '#6b7689', marginTop: 2, textTransform: 'uppercase' }}>Official Company Policy</div>
              </div>
              <div style={{ fontWeight: 700, textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', fontSize: 12 }}>{title || '—'}</div>
              <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 6, marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div><span style={{ color: '#6b7689', fontSize: 9 }}>Category</span><br /><strong>{category}</strong></div>
                <div><span style={{ color: '#6b7689', fontSize: 9 }}>Effective</span><br /><strong>{effDate}</strong></div>
              </div>
              {clauses.slice(0, 3).map((c, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, borderBottom: '1px solid #f0f2f5', paddingBottom: 3, marginBottom: 4 }}>{c.title}</div>
                  <div style={{ color: '#4a5568', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.content || <span style={{ color: '#9ca3af' }}>— empty —</span>}
                  </div>
                </div>
              ))}
              {clauses.length > 3 && <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>+{clauses.length - 3} more clause{clauses.length - 3 !== 1 ? 's' : ''}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIST ────────────────────────────────────────────────────────────────────
  const total    = policies.length;
  const active   = policies.filter(p => p.status === 'Active').length;
  const draft    = policies.filter(p => p.status === 'Draft').length;
  const archived = policies.filter(p => p.status === 'Archived').length;

  return (
    <div className="page-fade">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">🛡</div></div>
          <div className="stat-l">TOTAL POLICIES</div>
          <div className="stat-v">{total}</div>
          <div className="stat-foot">All company policies</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">ACTIVE</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>{active}</div>
          <div className="stat-foot">Currently enforced</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">◐</div></div>
          <div className="stat-l">DRAFT</div>
          <div className="stat-v" style={{ color: 'var(--warn)' }}>{draft}</div>
          <div className="stat-foot">Not yet distributed</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">↓</div></div>
          <div className="stat-l">ARCHIVED</div>
          <div className="stat-v">{archived}</div>
          <div className="stat-foot">Retired policies</div>
        </div>
      </div>

      <div className="briefing" style={{ marginBottom: 20 }}>
        <div>
          <div className="card-title">Company Policies</div>
          <div className="card-sub">{total} polic{total !== 1 ? 'ies' : 'y'} on record</div>
        </div>
        {isMgmt && (
          <div className="briefing-actions">
            <button className="btn btn-acc" onClick={openCreate}>+ New Policy</button>
          </div>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {policies.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🛡</div>
            <div>No policies on record.</div>
            {isMgmt && <div style={{ fontSize: 12, marginTop: 6 }}>Create your first company policy above.</div>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Effective</th>
                  <th>Clauses</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, maxWidth: 240 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                      {p.created_by_name && <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 400, marginTop: 1 }}>by {p.created_by_name}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{p.category}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>{p.effective_date || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                      {parseClauses(p.content).length || 0}
                    </td>
                    <td><span className={STATUS_BADGE[p.status] ?? 'bdg bdg-gy'}>{p.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sec btn-sm" onClick={() => openView(p)}>View</button>
                        {isMgmt && <button className="btn btn-sec btn-sm" onClick={() => openEdit(p)}>Edit</button>}
                        {isMgmt && (
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--err-soft)', color: 'var(--err)', border: '1px solid oklch(0.88 0.06 25)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}
                            onClick={() => handleDelete(p.id!)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 500, background: toast.ok ? 'oklch(0.25 0.05 145)' : 'oklch(0.25 0.05 25)', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,.18)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
