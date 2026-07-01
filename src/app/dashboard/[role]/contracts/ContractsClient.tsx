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
  employer_signature?: string;
  employer_signed_at?: string;
  employee_signature?: string;
  employee_signed_at?: string;
  profiles?: { name: string; role: string; salary?: number };
};

const CONTRACT_TEMPLATES: Record<string, Section[]> = {
  'Remote Sales Representative': [
    { title: '1. Parties & Effective Date', content: `This Remote Sales Representative Agreement ("Agreement") is entered into as of the date last signed below ("Effective Date") by and between Pioneers Veneers ("Company"). The parties agree to the following terms governing the Representative's engagement with the Company.` },
    { title: '2. Nature of Relationship', content: `The Representative is engaged as an independent contractor. Nothing in this Agreement shall be construed to create an employer-employee relationship, partnership, joint venture, or agency. The Representative is not entitled to employee benefits, social security contributions, PhilHealth, Pag-IBIG, or any statutory Philippine employment benefits unless separately agreed in writing. The Representative acknowledges full responsibility for their own tax obligations under Philippine law and shall indemnify the Company against any tax liabilities arising from this engagement.` },
    { title: '3. Probationary Period', content: `The Representative will serve a ninety (90) day Probationary Period commencing on the Effective Date. During this period: (a) all compensation terms, qualification thresholds, and performance standards in this Agreement apply in full; (b) the Company may terminate this Agreement at any time without notice if the Representative fails to meet the minimum performance standards defined in Clause 6; and (c) upon successful completion of the Probationary Period, the Representative transitions to a standard engagement subject to the 30-day notice requirement in Clause 10. Successful completion of the Probationary Period is not guaranteed and is contingent solely on demonstrated sales performance.` },
    { title: '4. Duties & Responsibilities', content: `The Representative agrees to: (a) conduct outbound and inbound sales calls, SMS, and messaging to prospective Pioneers Veneers customers; (b) follow the Company's approved sales scripts, objection handling frameworks, and CRM workflows at all times; (c) log all interactions, dispositions, and outcomes accurately and promptly in the Company's CRM system; (d) attend all required team meetings, training sessions, and one-on-ones as scheduled by the Company; (e) collect payment from customers and ensure full order amounts ($600.00 USD, or cumulative down payments totaling $600.00 USD) are processed through Company-approved payment methods only; (f) maintain professional standards in all customer communications; (g) protect the confidentiality of all customer data, Company processes, pricing, scripts, and proprietary information; and (h) meet or exceed the minimum performance thresholds defined in Clause 6 on an ongoing basis.` },
    { title: '5. Compensation', content: `5.1 — Base Salary: The Representative shall receive a monthly base salary of ₱15,000.00 Philippine Pesos ("Base"), subject exclusively to the performance qualification conditions defined in Clause 6. The Base is not guaranteed. It is a performance-contingent payment and shall not be earned, accrued, or paid in any period where the Representative fails to meet the minimum threshold.

5.2 — Commission: The Representative shall earn commission on each fully collected order. An order is "fully collected" when the full $600.00 USD order value has been received by the Company — either as a single payment or as cumulative down payments totaling $600.00 USD for that specific order. Commission tiers reset at the start of each calendar month and are structured as follows: Sales 1 through 10 (first 10 fully collected orders in the month) earn $10.00 USD per order. Sales 11 through 20 (next 10 fully collected orders) earn $15.00 USD per order. Sales 21 and beyond (all orders exceeding 20) earn $20.00 USD per order. Commission is earned in the billing cycle in which the final payment for an order is collected, regardless of when the order was originally placed. No commission is paid on partial collections, cancelled orders, or orders subject to a chargeback or dispute.

5.3 — Payment Schedule: Compensation is paid bi-monthly. Period 1 (covering weeks 1–2) is paid on or before the 5th of the following month. Period 2 (covering weeks 3–4) is paid on or before the 20th of the same month. Payment is made via GCash, bank transfer, or another method mutually agreed upon in writing. The Company reserves the right to withhold any payout pending resolution of a disputed order, chargeback, or customer complaint directly attributable to the Representative.` },
    { title: '6. Performance Requirements & Base Qualification', content: `6.1 — Minimum Threshold: The Base salary is conditional. It is only earned if the Representative closes a minimum of ten (10) fully collected orders in every consecutive two (2) week period ("Bi-Weekly Evaluation Period"). Bi-Weekly Evaluation Periods run Monday through Sunday of weeks 1–2, then weeks 3–4 of each calendar month.

6.2 — Forfeiture: If the Representative closes fewer than ten (10) fully collected orders in any single Bi-Weekly Evaluation Period, the Base for that period is forfeited in full. It is not pro-rated, deferred, or carried forward to any future period. Commission earned on collected orders in that period is still payable regardless of whether the Base is forfeited.

6.3 — Zero Sales: A Representative who closes zero (0) sales in any Bi-Weekly Evaluation Period earns zero compensation for that period — no Base, no commission, and no partial payment of any kind.

6.4 — Termination Trigger: Failure to meet the ten (10) order threshold for two (2) or more consecutive Bi-Weekly Evaluation Periods constitutes grounds for immediate termination without notice, at the Company's sole discretion.` },
    { title: '7. Termination for Cause', content: `The following each independently constitute grounds for immediate termination without notice and without compensation for any unearned period: (a) failure to meet the bi-weekly performance threshold for two or more consecutive evaluation periods; (b) misrepresentation of sales data, order status, or payment collection in the CRM or to management; (c) accepting, diverting, or misappropriating customer payments through unauthorized channels; (d) sharing, selling, or disclosing any Company data, scripts, customer information, or proprietary processes to any third party; (e) gross insubordination, harassment of customers or colleagues, or conduct materially damaging to the Company's reputation; or (f) any breach of the confidentiality, non-solicitation, or data protection provisions of this Agreement. Termination for cause results in immediate cessation of all Base payments. Commission already earned on fully collected orders prior to the termination date remains payable at the next scheduled payout, less any amounts owed to the Company.` },
    { title: '8. Monitoring & Technology', content: `The Representative consents to: (a) call recording on all sales calls conducted through Company-provided telephony systems, used for quality assurance, training, and dispute resolution; (b) screen capture via the Company's productivity monitoring system (Hubstaff or equivalent), active during all logged working hours, accessible by the Company's management team; and (c) CRM activity logging, including call logs, SMS records, and disposition notes, which may be reviewed by supervisors at any time. The Representative is prohibited from conducting sales activity on personal or non-Company-approved platforms, phone numbers, or payment processors. Any such activity constitutes a material breach of this Agreement.` },
    { title: '9. Confidentiality & Non-Solicitation', content: `9.1 — Confidentiality: The Representative agrees to keep strictly confidential, both during and after the term of this Agreement, all non-public information belonging to the Company, including but not limited to: customer lists and contact data, sales scripts and processes, pricing and commission structures, software systems and CRM configurations, and any other proprietary business information. Breach of confidentiality entitles the Company to seek injunctive relief and damages without the need to prove specific harm.

9.2 — Non-Solicitation: For twelve (12) months following termination of this Agreement for any reason, the Representative agrees not to: (a) directly or indirectly solicit, contact, or attempt to sell to any customer of the Company with whom the Representative had contact during their engagement; or (b) recruit, solicit, or induce any Company employee or contractor to leave the Company or join a competing business.

9.3 — Data Privacy: The Representative shall comply at all times with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173). Customer personal data accessed through the Company's systems shall be used solely for fulfilling sales duties under this Agreement and shall not be retained, copied, or transferred upon termination.` },
    { title: '10. Termination', content: `10.1 — By Either Party: After the Probationary Period, either party may terminate this Agreement by providing thirty (30) days written notice delivered via the Representative's Company email or official communication channel on record.

10.2 — For Cause: The Company may terminate immediately and without notice for any cause listed in Clause 7. In such cases, no Base is payable for any period not yet paid.

10.3 — Obligations Upon Termination: Upon termination for any reason, the Representative must immediately: (a) cease all sales activity on behalf of the Company; (b) return, delete, or destroy all Company materials, data, scripts, and access credentials; (c) cooperate with any knowledge transfer process as directed by the Company; and (d) provide accurate final reporting of all outstanding orders, partial collections, and customer commitments. Failure to comply may result in withholding of any outstanding commission until obligations are fulfilled.` },
    { title: '11. Limitation of Liability & Indemnification', content: `The Company's maximum liability to the Representative under this Agreement, for any reason, shall not exceed the total compensation paid to the Representative in the ninety (90) days immediately preceding the event giving rise to the claim. The Representative shall indemnify, defend, and hold harmless the Company, its officers, employees, and agents from any claim, loss, or liability arising from: (a) the Representative's breach of this Agreement; (b) misrepresentation to customers; (c) unauthorized collection or handling of customer funds; or (d) violation of applicable Philippine law.` },
    { title: '12. General Provisions', content: `This Agreement constitutes the entire agreement between the parties and supersedes all prior understandings, whether written or oral. It may only be modified by a written document signed by both parties. If any provision is found unenforceable, the remaining provisions remain in full force. Failure to enforce any provision shall not constitute a waiver of that or any other provision. This Agreement may be signed electronically and in counterparts, each of which shall be deemed an original. The Representative confirms they have read and understood this Agreement in its entirety, including the performance-contingent nature of the Base salary, the bi-weekly evaluation thresholds, and the consequences of non-performance, and agrees that no Base is guaranteed.` },
  ],
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

// Independent-contractor style agreements (sales rep, contractor) read
// "Company / Representative" and "Services Agreement"; employment templates keep
// "Employer / Employee". Keeps the header, intro, and signature labels accurate.
const SERVICES_TYPES   = new Set(['Remote Sales Representative', 'Independent Contractor']);
const isServicesType   = (type: string) => SERVICES_TYPES.has(type);
const companyPartyWord = (type: string) => (isServicesType(type) ? 'Company' : 'Employer');
const partyRoleWord    = (type: string) =>
  type === 'Remote Sales Representative' ? 'Representative'
  : type === 'Independent Contractor'    ? 'Contractor'
  : 'Employee';
const docSubtitle      = (type: string) =>
  isServicesType(type) ? 'Services Agreement · Official Document' : 'Employment Agreement · Official Document';

function buildContractHtml(contract: Contract, sections: Section[]): string {
  const empSig   = contract.employer_signature ?? '';
  const empeeSig = contract.employee_signature ?? '';
  const empDate  = contract.employer_signed_at  ? new Date(contract.employer_signed_at).toLocaleDateString()  : '';
  const empeeDate= contract.employee_signed_at  ? new Date(contract.employee_signed_at).toLocaleDateString()  : '';
  const refId    = (contract.id?.slice(0, 8) ?? Date.now().toString().slice(-8)).toUpperCase();
  const services = isServicesType(contract.type);
  const role     = partyRoleWord(contract.type);
  const introHtml = services
    ? `<p>This ${contract.type} Agreement is entered into on <strong>${contract.effective_date}</strong> between <strong>Pioneers Veneers</strong> ("Company") and <strong>${contract.profiles?.name ?? `the ${role}`}</strong> (the "${role}"), and shall govern the terms of engagement as outlined below.</p>`
    : `<p>This Employment Agreement is entered into on <strong>${contract.effective_date}</strong> between <strong>Pioneers Veneers</strong> ("Employer") and <strong>${contract.profiles?.name ?? 'the Employee'}</strong> ("Employee"), and shall govern the terms of employment as outlined below.</p>`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${contract.type} Agreement</title>
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
  .sigs{margin-top:60px;display:flex;justify-content:space-between;border-top:2px solid #1a1f2e;padding-top:20px}
  .sig-name{font-family:'Dancing Script','Brush Script MT',cursive;font-size:34px;color:#1a1f2e;min-height:46px;margin:12px 0 4px}
  .sig-line{border-top:1px solid #94a3b8;font-size:10px;color:#94a3b8;padding-top:4px}
  .footer{margin-top:24px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #f1f5f9;padding-top:12px}
  @media print{body{margin:0}}
</style></head><body>
<div style="text-align:center;border-bottom:2px solid #1a1f2e;padding-bottom:20px;margin-bottom:30px">
  <h1>PIONEERS VENEERS</h1>
  <div style="font-size:11px;color:#6b7689;text-transform:uppercase;letter-spacing:.08em;margin-top:4px">${docSubtitle(contract.type)}</div>
</div>
<h2>${contract.type} Agreement</h2>
<div class="meta">
  <div><span class="meta-lbl">Employee</span><strong>${contract.profiles?.name ?? '—'}</strong></div>
  <div><span class="meta-lbl">Role</span><strong>${contract.profiles?.role ?? contract.type}</strong></div>
  <div><span class="meta-lbl">Effective Date</span><strong>${contract.effective_date}</strong></div>
  ${contract.end_date ? `<div><span class="meta-lbl">End Date</span><strong>${contract.end_date}</strong></div>` : ''}
</div>
${introHtml}
${sections.map(s => `<div style="margin-bottom:20px"><h3>${s.title}</h3><p>${s.content}</p></div>`).join('')}
<div class="sigs">
  <div style="width:44%">
    <strong style="font-size:12px">${services ? 'Company' : 'Employer'} Signature</strong><br>
    <span style="font-size:11px;color:#6b7689">Pioneers Veneers — Authorized Management</span>
    <div class="sig-name">${empSig}</div>
    <div class="sig-line">Signature${empDate ? ` · ${empDate}` : ''}</div>
  </div>
  <div style="width:44%;text-align:right">
    <strong style="font-size:12px">${role} Signature</strong><br>
    <span style="font-size:11px;color:#6b7689">${contract.profiles?.name ?? ''}</span>
    <div class="sig-name" style="text-align:right">${empeeSig || '<!--EMP_SIG_PLACEHOLDER-->'}</div>
    <div class="sig-line">${empeeDate ? `Signature · ${empeeDate}` : '<!--EMP_DATE_PLACEHOLDER-->Signature'}</div>
  </div>
</div>
<div class="footer">Generated by Pioneers Veneers Enterprise Platform · Ref: CTR-${refId} · ${new Date().toLocaleDateString()}</div>
</body></html>`;
}

export default function ContractsClient({
  initialContracts, users, isMgmt, currentUserId, currentUserName,
}: {
  initialContracts: Contract[];
  users: any[];
  isMgmt: boolean;
  currentUserId: string;
  currentUserName: string;
}) {
  const [contracts, setContracts]       = useState<Contract[]>(initialContracts);
  const [view, setView]                 = useState<'list' | 'create' | 'preview'>('list');
  const [viewingContract, setViewing]   = useState<Contract | null>(null);
  const [editingContract, setEditing]   = useState<Contract | null>(null);

  // Create/edit form state
  const [selectedUser, setSelectedUser] = useState('');
  const [contractType, setContractType] = useState('Remote Sales Representative');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate]           = useState('');
  const [sections, setSections]         = useState<Section[]>(CONTRACT_TEMPLATES['Remote Sales Representative']);
  const [isSaving, setIsSaving]         = useState(false);

  // Signature state
  const [sigInput, setSigInput]   = useState<'employer' | 'employee' | null>(null);
  const [sigText, setSigText]     = useState('');
  const [isSigning, setIsSigning] = useState(false);

  // Send to inbox
  const [isSending, setIsSending] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const changeType = (type: string) => {
    setContractType(type);
    setSections(CONTRACT_TEMPLATES[type] ?? CONTRACT_TEMPLATES['Sales Associate']);
  };

  const updateSection = (i: number, field: 'title' | 'content', val: string) =>
    setSections(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  const addSection = () =>
    setSections(prev => [...prev, { title: `${prev.length + 1}. Custom Clause`, content: '' }]);

  const removeSection = (i: number) =>
    setSections(prev => prev.filter((_, idx) => idx !== i));

  const openCreate = () => {
    setEditing(null);
    setSelectedUser('');
    setContractType('Remote Sales Representative');
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setSections(CONTRACT_TEMPLATES['Remote Sales Representative']);
    setView('create');
  };

  const openEdit = (c: Contract) => {
    setEditing(c);
    setSelectedUser(c.user_id);
    setContractType(c.type);
    setEffectiveDate(c.effective_date);
    setEndDate(c.end_date ?? '');
    const parsed = parseSections(c.content);
    setSections(parsed.length ? parsed : CONTRACT_TEMPLATES[c.type] ?? []);
    setView('create');
  };

  const openView = (c: Contract) => {
    setViewing(c);
    setSigInput(null);
    setSigText('');
    setView('preview');
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    const payload = {
      user_id: selectedUser, type: contractType,
      effective_date: effectiveDate, end_date: endDate || null,
      status: editingContract?.status ?? 'Pending',
      content: JSON.stringify(sections),
    };
    const sel = '*, profiles!contracts_user_id_fkey(name, role, salary)';
    if (editingContract?.id) {
      const { data, error } = await dbOp('contracts', 'update', payload, { id: editingContract.id }, sel);
      if (error) { showToast(`Save failed: ${error}`, false); setIsSaving(false); return; }
      if (data?.[0]) {
        setContracts(prev => prev.map(c => c.id === editingContract.id ? data[0] : c));
        setViewing(data[0]);
      }
    } else {
      const { data, error } = await dbOp('contracts', 'insert', payload, undefined, sel);
      if (error) { showToast(`Save failed: ${error}`, false); setIsSaving(false); return; }
      if (data?.[0]) { setContracts(prev => [data[0], ...prev]); setViewing(data[0]); }
    }
    setEditing(null);
    setIsSaving(false);
    setView('preview');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this contract? This cannot be undone.')) return;
    const { error } = await dbOp('contracts', 'delete', {}, { id });
    if (error) { showToast(`Delete failed: ${error}`, false); return; }
    setContracts(prev => prev.filter(c => c.id !== id));
    showToast('Contract deleted');
  };

  const handleSign = async (role: 'employer' | 'employee') => {
    if (!viewingContract?.id || !sigText.trim()) return;
    setIsSigning(true);
    const now = new Date().toISOString();
    const updates: any = role === 'employer'
      ? { employer_signature: sigText.trim(), employer_signed_at: now }
      : { employee_signature: sigText.trim(), employee_signed_at: now };
    const merged = { ...viewingContract, ...updates };
    if (merged.employer_signature && merged.employee_signature) updates.status = 'Signed';

    const { error } = await dbOp('contracts', 'update', updates, { id: viewingContract.id });
    if (error) { showToast(`Signature failed: ${error}`, false); setIsSigning(false); return; }
    const newC = { ...viewingContract, ...updates };
    setViewing(newC);
    setContracts(prev => prev.map(c => c.id === viewingContract.id ? newC : c));
    setSigInput(null); setSigText(''); setIsSigning(false);
    showToast(role === 'employer' ? 'Employer signature saved' : 'Employee signature saved');
  };

  const handlePushToProfile = async () => {
    if (!viewingContract?.id) return;
    setIsPushing(true);
    const { error } = await dbOp('profiles', 'update', { contract_url: `contract:${viewingContract.id}` }, { id: viewingContract.user_id });
    if (error) showToast(`Push failed: ${error}`, false);
    else showToast(`Contract pushed to ${viewingContract.profiles?.name ?? 'employee'}'s profile ✓`);
    setIsPushing(false);
  };

  const handleSendToInbox = async () => {
    if (!viewingContract) return;
    setIsSending(true);
    try {
      const resolvedSections = parseSections(viewingContract.content).length
        ? parseSections(viewingContract.content)
        : CONTRACT_TEMPLATES[viewingContract.type] ?? [];
      const html    = buildContractHtml(viewingContract, resolvedSections);
      const subject = `${viewingContract.type} Agreement`;
      const { error } = await dbOp('inbox_documents', 'insert', {
        user_id: viewingContract.user_id, sender_id: currentUserId,
        title: subject, subject,
        content: `Your ${viewingContract.type} employment agreement is ready. Please review and sign below.`,
        type: 'Contract', sender: currentUserName,
        submitted_by_name: currentUserName,
        requires_signature: true, is_read: false, archived: false,
        html_content: html,
        doc_ref_type: 'contract',
        doc_ref_id: String(viewingContract.id ?? ''),
      });
      if (error) showToast(`Send failed: ${error}`, false);
      else showToast('Contract sent to employee inbox');
    } finally {
      setIsSending(false);
    }
  };

  // ─── PREVIEW ────────────────────────────────────────────────────────────────
  if (view === 'preview' && viewingContract) {
    const resolvedSections = parseSections(viewingContract.content).length
      ? parseSections(viewingContract.content)
      : CONTRACT_TEMPLATES[viewingContract.type] ?? CONTRACT_TEMPLATES['Sales Associate'];
    const canSignEmployer = isMgmt && !viewingContract.employer_signature;
    const canSignEmployee = viewingContract.user_id === currentUserId && !viewingContract.employee_signature;

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
          <button className="btn btn-sec" onClick={() => { setView('list'); setSigInput(null); setSigText(''); }}>← Back</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {isMgmt && <button className="btn btn-sec" onClick={() => openEdit(viewingContract)}>✏ Edit</button>}
            {isMgmt && (
              <button className="btn btn-acc" onClick={handleSendToInbox} disabled={isSending}>
                {isSending ? 'Sending…' : '📨 Send to Inbox'}
              </button>
            )}
            {isMgmt && viewingContract.status === 'Signed' && (
              <button className="btn btn-acc" onClick={handlePushToProfile} disabled={isPushing} style={{ background: 'oklch(0.52 0.18 145)', borderColor: 'oklch(0.52 0.18 145)' }}>
                {isPushing ? 'Pushing…' : '⬆ Push to Profile'}
              </button>
            )}
            <button className="btn btn-sec" onClick={() => window.print()}>🖨 Print / PDF</button>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '48px', maxWidth: 800, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,.08)', borderRadius: 8, fontFamily: 'Inter, sans-serif' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1f2e', paddingBottom: 20, marginBottom: 30 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '1px', color: '#0f172a' }}>PIONEERS VENEERS</div>
            <div style={{ fontSize: 11, color: '#6b7689', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 4 }}>{docSubtitle(viewingContract.type)}</div>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 28, color: '#1a1f2e' }}>
            {viewingContract.type} Agreement
          </h2>

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 28, fontSize: 12 }}>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Employee</span><br /><strong>{viewingContract.profiles?.name ?? '—'}</strong></div>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Role</span><br /><strong>{viewingContract.profiles?.role ?? viewingContract.type}</strong></div>
            <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>Effective Date</span><br /><strong>{viewingContract.effective_date}</strong></div>
            {viewingContract.end_date && <div><span style={{ color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>End Date</span><br /><strong>{viewingContract.end_date}</strong></div>}
          </div>

          {/* Intro */}
          <p style={{ lineHeight: 1.8, color: '#1a1f2e', fontSize: 13, marginBottom: 24 }}>
            {isServicesType(viewingContract.type) ? (
              <>This {viewingContract.type} Agreement is entered into on <strong>{viewingContract.effective_date}</strong> between <strong>Pioneers Veneers</strong> ("Company") and <strong>{viewingContract.profiles?.name ?? `the ${partyRoleWord(viewingContract.type)}`}</strong> (the "{partyRoleWord(viewingContract.type)}"), and shall govern the terms of engagement as outlined below.</>
            ) : (
              <>This Employment Agreement is entered into on <strong>{viewingContract.effective_date}</strong> between <strong>Pioneers Veneers</strong> ("Employer") and <strong>{viewingContract.profiles?.name ?? 'the Employee'}</strong> ("Employee"), and shall govern the terms of employment as outlined below.</>
            )}
          </p>

          {/* Sections */}
          {resolvedSections.map((sec, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, borderBottom: '1px solid #e4e7eb', paddingBottom: 6, marginBottom: 10, color: '#1a1f2e' }}>{sec.title}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.8, color: '#4a5568', whiteSpace: 'pre-wrap' }}>{sec.content}</p>
            </div>
          ))}

          {/* Signature blocks */}
          <div style={{ marginTop: 60, display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #1a1f2e', paddingTop: 20 }}>

            {/* Employer */}
            <div style={{ width: '44%' }}>
              <strong style={{ fontSize: 12 }}>{companyPartyWord(viewingContract.type)} Signature</strong><br />
              <span style={{ fontSize: 11, color: '#6b7689' }}>Pioneers Veneers — Authorized Management</span>
              {viewingContract.employer_signature ? (
                <>
                  <div className="sig-cursive" style={{ fontSize: 34, color: '#1a1f2e', marginTop: 10, marginBottom: 4 }}>
                    {viewingContract.employer_signature}
                  </div>
                  <div style={{ borderTop: '1px solid #94a3b8', fontSize: 10, color: '#64748b', paddingTop: 4 }}>
                    ✓ Signed {viewingContract.employer_signed_at ? new Date(viewingContract.employer_signed_at).toLocaleDateString() : ''}
                  </div>
                </>
              ) : sigInput === 'employer' ? (
                <div style={{ marginTop: 10 }}>
                  {sigText && (
                    <div className="sig-cursive" style={{ fontSize: 30, color: '#1a1f2e', marginBottom: 8, minHeight: 40 }}>{sigText}</div>
                  )}
                  <input
                    value={sigText} onChange={e => setSigText(e.target.value)}
                    placeholder="Type your full name…" autoFocus
                    style={{ width: '100%', padding: '6px 10px', border: '1px solid #94a3b8', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-acc btn-sm" disabled={!sigText.trim() || isSigning} onClick={() => handleSign('employer')}>
                      {isSigning ? 'Signing…' : 'Confirm Signature'}
                    </button>
                    <button className="btn btn-sec btn-sm" onClick={() => { setSigInput(null); setSigText(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={canSignEmployer ? () => { setSigInput('employer'); setSigText(''); } : undefined}
                  style={{ marginTop: 28, borderTop: '1px solid #94a3b8', fontSize: 11, paddingTop: 4, cursor: canSignEmployer ? 'pointer' : 'default', color: canSignEmployer ? 'var(--accent)' : '#94a3b8' }}
                >
                  {canSignEmployer ? '✍ Click here to sign' : `Awaiting ${companyPartyWord(viewingContract.type).toLowerCase()} signature`}
                </div>
              )}
            </div>

            {/* Employee */}
            <div style={{ width: '44%', textAlign: 'right' }}>
              <strong style={{ fontSize: 12 }}>{partyRoleWord(viewingContract.type)} Signature</strong><br />
              <span style={{ fontSize: 11, color: '#6b7689' }}>{viewingContract.profiles?.name}</span>
              {viewingContract.employee_signature ? (
                <>
                  <div className="sig-cursive" style={{ fontSize: 34, color: '#1a1f2e', marginTop: 10, marginBottom: 4, textAlign: 'right' }}>
                    {viewingContract.employee_signature}
                  </div>
                  <div style={{ borderTop: '1px solid #94a3b8', fontSize: 10, color: '#64748b', paddingTop: 4 }}>
                    ✓ Signed {viewingContract.employee_signed_at ? new Date(viewingContract.employee_signed_at).toLocaleDateString() : ''}
                  </div>
                </>
              ) : sigInput === 'employee' ? (
                <div style={{ marginTop: 10 }}>
                  {sigText && (
                    <div className="sig-cursive" style={{ fontSize: 30, color: '#1a1f2e', marginBottom: 8, minHeight: 40, textAlign: 'right' }}>{sigText}</div>
                  )}
                  <input
                    value={sigText} onChange={e => setSigText(e.target.value)}
                    placeholder="Type your full name…" autoFocus
                    style={{ width: '100%', padding: '6px 10px', border: '1px solid #94a3b8', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn btn-acc btn-sm" disabled={!sigText.trim() || isSigning} onClick={() => handleSign('employee')}>
                      {isSigning ? 'Signing…' : 'Confirm Signature'}
                    </button>
                    <button className="btn btn-sec btn-sm" onClick={() => { setSigInput(null); setSigText(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={canSignEmployee ? () => { setSigInput('employee'); setSigText(''); } : undefined}
                  style={{ marginTop: 28, borderTop: '1px solid #94a3b8', fontSize: 11, paddingTop: 4, cursor: canSignEmployee ? 'pointer' : 'default', color: canSignEmployee ? 'var(--accent)' : '#94a3b8', textAlign: 'right' }}
                >
                  {canSignEmployee ? '✍ Click here to sign' : `Awaiting ${partyRoleWord(viewingContract.type).toLowerCase()} signature`}
                </div>
              )}
            </div>
          </div>

          {viewingContract.status === 'Signed' && (
            <div style={{ marginTop: 16, textAlign: 'center', padding: '8px 16px', background: '#dcfce7', borderRadius: 8, fontSize: 12, color: '#166534', fontWeight: 600, border: '1px solid #bbf7d0' }}>
              ✓ Fully executed — both parties have signed
            </div>
          )}

          <div style={{ marginTop: 24, fontSize: 9, color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
            Generated by Pioneers Veneers Enterprise Platform · Ref: CTR-{viewingContract.id?.slice(0, 8).toUpperCase() ?? Date.now().toString().slice(-8)} · {new Date().toLocaleDateString()}
          </div>
        </div>

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
    const isEditing = !!editingContract;
    return (
      <div className="page-fade">
        <div className="briefing" style={{ marginBottom: 20 }}>
          <div>
            <div className="card-title">{isEditing ? 'Edit Contract' : 'New Contract'}</div>
            <div className="card-sub">{isEditing ? 'Update the contract details and clauses' : 'Fill in details and generate the contract document'}</div>
          </div>
          <div className="briefing-actions">
            <button className="btn btn-sec" onClick={() => setView(isEditing ? 'preview' : 'list')}>← Back</button>
            <button className="btn btn-acc" onClick={handleSave} disabled={isSaving || !selectedUser}>
              {isSaving ? 'Saving…' : isEditing ? 'Save Changes →' : 'Generate Contract →'}
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
                      <input type="text" value={sec.title} onChange={e => updateSection(i, 'title', e.target.value)}
                        style={{ flex: 1, fontWeight: 600, fontSize: 13, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)' }} />
                      <button onClick={() => removeSection(i)} style={{ background: 'none', border: 'none', color: 'var(--err)', cursor: 'pointer', fontSize: 14, padding: '2px 6px', flexShrink: 0 }}>✕</button>
                    </div>
                    <textarea rows={4} value={sec.content} onChange={e => updateSection(i, 'content', e.target.value)}
                      placeholder="Clause content…"
                      style={{ width: '100%', fontSize: 12.5, lineHeight: 1.7, padding: 8, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <button className="btn btn-sec" style={{ width: '100%', fontSize: 12 }} onClick={addSection}>+ Add Custom Clause</button>
              </div>
            </div>
          </div>

          {/* Mini preview */}
          <div className="card" style={{ padding: '20px 18px', position: 'sticky', top: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Live Preview</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20, fontFamily: 'Inter, sans-serif', fontSize: 11 }}>
              <div style={{ textAlign: 'center', borderBottom: '1.5px solid #1a1f2e', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>PIONEERS VENEERS</div>
                <div style={{ fontSize: 9, color: '#6b7689', marginTop: 2, textTransform: 'uppercase' }}>Employment Agreement</div>
              </div>
              <div style={{ fontWeight: 700, textAlign: 'center', marginBottom: 12, textTransform: 'uppercase' }}>{contractType}</div>
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
              {sections.length > 3 && <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>+{sections.length - 3} more clause{sections.length - 3 !== 1 ? 's' : ''}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIST ────────────────────────────────────────────────────────────────────
  const pending    = contracts.filter(c => c.status === 'Pending').length;
  const signed     = contracts.filter(c => c.status === 'Signed').length;
  const soM        = new Date(); soM.setDate(1); soM.setHours(0, 0, 0, 0);
  const thisMonth  = contracts.filter(c => c.effective_date >= soM.toISOString().split('T')[0]).length;

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
            <button className="btn btn-acc" onClick={openCreate}>+ New Contract</button>
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
                  <th>Effective</th>
                  <th>Status</th>
                  {isMgmt && <th>Signatures</th>}
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
                          <div className="av-circle" style={{ width: 30, height: 30, fontSize: 10, background: `linear-gradient(135deg,oklch(0.55 0.13 ${hue}),oklch(0.42 0.16 ${hue + 20}))` }}>
                            {(c.profiles?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <span style={{ fontWeight: 600 }}>{c.profiles?.name ?? 'You'}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.type}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>{c.effective_date}</td>
                      <td><span className={c.status === 'Signed' ? 'bdg bdg-ok' : 'bdg bdg-warn'}>{c.status}</span></td>
                      {isMgmt && (
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                          <span style={{ color: c.employer_signature ? 'var(--ok)' : 'var(--ink-4)' }}>{c.employer_signature ? '✓' : '○'} Mgmt</span>
                          {' · '}
                          <span style={{ color: c.employee_signature ? 'var(--ok)' : 'var(--ink-4)' }}>{c.employee_signature ? '✓' : '○'} Employee</span>
                        </td>
                      )}
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sec btn-sm" onClick={() => openView(c)}>View</button>
                          {isMgmt && <button className="btn btn-sec btn-sm" onClick={() => openEdit(c)}>Edit</button>}
                          {isMgmt && (
                            <button
                              className="btn btn-sm"
                              style={{ background: 'var(--err-soft)', color: 'var(--err)', border: '1px solid oklch(0.88 0.06 25)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}
                              onClick={() => handleDelete(c.id!)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
