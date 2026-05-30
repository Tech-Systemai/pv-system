'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { dbOp } from '@/utils/db';

/* ── Constants ───────────────────────────────────────────────── */
const DEFAULT_PIPELINE_STAGES = [
  'IMP KIT SENT', 'IMP KIT DEL', 'VENEERS SENT', 'VENEERS DEL', 'POST-CARE',
];

const STATUS_OPTIONS = [
  'New CX', 'Took action & CX answered', 'Take action', 'No action taken',
  'Veneers delivered', 'Delivered & interested', 'Charged, expecting a call', 'Failed money',
];

const STATUS_HUE: Record<string, number> = {
  'New CX':                    145,
  'Took action & CX answered': 200,
  'Take action':               25,
  'No action taken':           10,
  'Veneers delivered':         55,
  'Delivered & interested':    145,
  'Charged, expecting a call': 80,
  'Failed money':              10,
};

const PRIORITY_META: Record<string, { bg: string; color: string }> = {
  HIGH:   { bg: 'oklch(0.92 0.06 25)',  color: 'oklch(0.40 0.20 25)'  },
  MEDIUM: { bg: 'oklch(0.94 0.06 75)',  color: 'oklch(0.40 0.18 75)'  },
  LOW:    { bg: 'oklch(0.93 0.05 145)', color: 'oklch(0.36 0.15 145)' },
};

const PAY_META: Record<string, { bg: string; color: string }> = {
  'Paid':      { bg: 'oklch(0.93 0.05 145)', color: 'oklch(0.36 0.15 145)' },
  'Partial':   { bg: 'oklch(0.94 0.06 75)',  color: 'oklch(0.40 0.18 75)'  },
  'Defaulted': { bg: 'oklch(0.92 0.06 25)',  color: 'oklch(0.40 0.20 25)'  },
};

const PIPELINE_STAGES = [
  { key: 'new_order',                    label: 'New order' },
  { key: 'imp_kit_sent',                 label: 'Impressions kit sent' },
  { key: 'imp_kit_delivered',            label: 'Impressions kit delivered' },
  { key: 'imp_appointment_done',         label: 'Impression appointment done' },
  { key: 'collect_payment',              label: 'Collect partial / full payment' },
  { key: 'waiting_sendback_tracking',    label: 'Awaiting send-back tracking #' },
  { key: 'imp_kit_on_way_to_lab',        label: 'IMP kit on the way to lab' },
  { key: 'received_imp_kit_at_lab',      label: 'Received IMP kit at lab' },
  { key: 'in_production',               label: 'In production' },
  { key: 'quality_check',               label: 'Quality check' },
  { key: 'collect_full_payment_veneers', label: 'Collect full payment for veneers' },
  { key: 'veneers_shipped',             label: 'Veneers shipped' },
  { key: 'veneers_delivered',           label: 'Veneers delivered' },
  { key: 'completed_no_issues',         label: 'Completed — no issues' },
  { key: 'referral_upsell',             label: 'Referral / upsell' },
];
const STAGE_GROUPS = [
  { label: 'IMPRESSIONS',      keys: ['new_order', 'imp_kit_sent', 'imp_kit_delivered', 'imp_appointment_done'] },
  { label: 'PAYMENT & RETURN', keys: ['collect_payment', 'waiting_sendback_tracking', 'imp_kit_on_way_to_lab', 'received_imp_kit_at_lab'] },
  { label: 'PRODUCTION',       keys: ['in_production', 'quality_check', 'collect_full_payment_veneers'] },
  { label: 'DELIVERY & AFTER', keys: ['veneers_shipped', 'veneers_delivered', 'completed_no_issues', 'referral_upsell'] },
];
const EXCEPTION_FLAGS = [
  { key: 'needs_new_imp_kit',               label: 'Needs new impression kit',          hue: 45,  chroma: 0.08 },
  { key: 'veneers_on_hold_failed_payment',  label: 'Veneers on hold — failed payment',  hue: 15,  chroma: 0.08 },
  { key: 'remake_issue',                    label: 'Remake / issue',                    hue: 45,  chroma: 0.08 },
  { key: 'disputed',                        label: 'Disputed',                          hue: 15,  chroma: 0.08 },
  { key: 'needs_refund',                    label: 'Needs refund',                      hue: 260, chroma: 0.02 },
  { key: 'veneers_received_failed_payment', label: 'Veneers received — failed payment', hue: 15,  chroma: 0.08 },
  { key: 'unsatisfied_defaulted',           label: 'Unsatisfied / defaulted',           hue: 15,  chroma: 0.08 },
];

function sColor(status: string) {
  const h = STATUS_HUE[status] ?? 200;
  return `oklch(0.50 0.20 ${h})`;
}
function sBg(status: string, alpha = 0.12) {
  const h = STATUS_HUE[status] ?? 200;
  return `oklch(0.50 0.20 ${h} / ${alpha})`;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function daysOpen(iso: string) { return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function initials(name: string) { return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'; }

const EMPTY_FORM = {
  customer_name: '', phone: '', pipeline_stage: 'IMP KIT SENT', status: 'New CX',
  priority: 'HIGH', issue: '', action_taken: '', customer_words: '', lab_notes: '',
  payment_left: '', pay_status: 'Paid', assigned_to: '', on_hold: false, hold_reason: '',
};

/* ── Component ───────────────────────────────────────────────── */
export default function CXClient({
  initialCases, initialUpdates, allProfiles,
  userRole, currentUserId, currentUserName, savedPipelineStages,
}: {
  initialCases: any[]; initialUpdates: any[]; allProfiles: any[];
  userRole: string; currentUserId: string; currentUserName: string;
  savedPipelineStages: string[] | null;
}) {
  const [cases,   setCases]   = useState(initialCases);
  const [updates, setUpdates] = useState(initialUpdates);
  const [stages,  setStages]  = useState<string[]>(savedPipelineStages ?? DEFAULT_PIPELINE_STAGES);

  const [viewMode,    setViewMode]    = useState<'overview'|'board'|'table'>('overview');
  const [section,     setSection]     = useState<'agents'|'admin'|'no_update'|'unreachable'>('agents');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCase,  setSelectedCase]  = useState<any>(null);
  const [showForm,      setShowForm]      = useState(false);
  const [editingCase,   setEditingCase]   = useState<any>(null);
  const [showEscalate,  setShowEscalate]  = useState(false);
  const [showAddCol,    setShowAddCol]    = useState(false);
  const [showHoldInput, setShowHoldInput] = useState(false);
  const [holdInputText, setHoldInputText] = useState('');
  const [reassigningCaseId, setReassigningCaseId] = useState<number | null>(null);
  const [reassignValue, setReassignValue] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});

  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [updateText, setUpdateText] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [savingCase,   setSavingCase]   = useState(false);
  const updateRef = useRef<HTMLTextAreaElement>(null);

  const isMgmt         = ['owner', 'admin', 'supervisor'].includes(userRole);
  const isOwner        = userRole === 'owner';
  const isAdminOrOwner = isOwner || userRole === 'admin';
  const today   = todayStr();

  const nameMap = Object.fromEntries(allProfiles.map((p: any) => [p.id, p.name]));
  const todayUpdatedIds = new Set(updates.filter((u: any) => u.update_date === today).map((u: any) => u.case_id));

  const escalatedCount   = cases.filter(c => c.escalated).length;
  const noUpdateCount    = cases.filter(c => c.no_update_needed && !c.escalated).length;
  const unreachableCount = cases.filter(c => c.unreachable && !c.escalated).length;

  const needsUpdate = (c: any) => !c.on_hold && !c.no_update_needed && !c.unreachable && !todayUpdatedIds.has(c.id);

  const filtered = cases.filter(c => {
    if (section === 'admin'       && !c.escalated)                                    return false;
    if (section === 'agents'      && (c.escalated || c.no_update_needed || c.unreachable)) return false;
    if (section === 'no_update'   && (!c.no_update_needed || c.escalated))            return false;
    if (section === 'unreachable' && (!c.unreachable || c.escalated))                 return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.customer_name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.issue?.toLowerCase().includes(q);
  });

  const totalOutstanding = cases.reduce((s, c) => s + (Number(c.payment_left) || 0), 0);
  const needActionCount  = cases.filter(c => needsUpdate(c)).length;

  const caseUpdates = (id: number) =>
    updates.filter((u: any) => u.case_id === id)
           .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  /* ── Handlers ──────────────────────────────────────────────── */
  const openAdd = (prefillStage?: string) => {
    setEditingCase(null);
    setForm({ ...EMPTY_FORM, pipeline_stage: prefillStage ?? 'IMP KIT SENT' });
    setShowForm(true);
  };

  const openEdit = (c: any) => {
    setEditingCase(c);
    setForm({
      customer_name: c.customer_name ?? '', phone: c.phone ?? '',
      pipeline_stage: c.pipeline_stage ?? 'IMP KIT SENT', status: c.status ?? 'New CX',
      priority: c.priority ?? 'HIGH', issue: c.issue ?? '',
      action_taken: c.action_taken ?? '', customer_words: c.customer_words ?? '',
      lab_notes: c.lab_notes ?? '', payment_left: c.payment_left ?? '',
      pay_status: c.pay_status ?? 'Paid', assigned_to: c.assigned_to ?? '',
      on_hold: c.on_hold ?? false, hold_reason: c.hold_reason ?? '',
    });
    setShowForm(true);
  };

  const handleSaveCase = async () => {
    if (!form.customer_name.trim()) return;
    setSavingCase(true);
    const payload: any = {
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim(),
      pipeline_stage: form.pipeline_stage,
      status: form.status,
      priority: form.priority,
      issue: form.issue.trim(),
      action_taken: form.action_taken.trim(),
      customer_words: form.customer_words.trim(),
      lab_notes: form.lab_notes.trim(),
      payment_left: form.payment_left !== '' ? Number(form.payment_left) : null,
      pay_status: form.pay_status || null,
      assigned_to: form.assigned_to || null,
      on_hold: form.on_hold,
      hold_reason: form.on_hold ? form.hold_reason.trim() : null,
      updated_at: new Date().toISOString(),
    };
    if (editingCase) {
      await dbOp('cx_cases', 'update', payload, { id: editingCase.id });
      setCases(prev => prev.map(c => c.id === editingCase.id ? { ...c, ...payload } : c));
      if (selectedCase?.id === editingCase.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
    } else {
      const { data } = await dbOp('cx_cases', 'insert', { ...payload, created_by: currentUserId });
      if (data?.[0]) setCases(prev => [data[0], ...prev]);
    }
    setSavingCase(false);
    setShowForm(false);
  };

  const handleDeleteCase = async (id: number) => {
    if (!confirm('Delete this customer case? All updates will be lost.')) return;
    await dbOp('cx_cases', 'delete', undefined, { id });
    setCases(prev => prev.filter(c => c.id !== id));
    setSelectedCase(null);
  };

  const handleLogUpdate = useCallback(async () => {
    if (!updateText.trim() || !selectedCase) return;
    setSavingUpdate(true);
    const { data } = await dbOp('cx_updates', 'insert', {
      case_id: selectedCase.id, note: updateText.trim(),
      update_date: today, logged_by: currentUserId,
    });
    if (data?.[0]) {
      setUpdates(prev => [data[0], ...prev]);
      setSelectedCase((p: any) => ({ ...p }));
    }
    setUpdateText('');
    setSavingUpdate(false);
  }, [updateText, selectedCase, today, currentUserId]);

  const handleClaimCase = async (c: any) => {
    const payload = { assigned_to: currentUserId, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: c.id });
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...payload } : x));
    if (selectedCase?.id === c.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  const handleReassignCase = async (c: any, newUserId: string) => {
    const payload = { assigned_to: newUserId || null, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: c.id });
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...payload } : x));
    if (selectedCase?.id === c.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
    setReassigningCaseId(null);
    setReassignValue('');
  };

  const handleToggleNoUpdate = async (c: any) => {
    const newVal = !c.no_update_needed;
    const payload = { no_update_needed: newVal, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: c.id });
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...payload } : x));
    if (selectedCase?.id === c.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  const handleToggleUnreachable = async (c: any) => {
    const newVal = !c.unreachable;
    const payload = { unreachable: newVal, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: c.id });
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...payload } : x));
    if (selectedCase?.id === c.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  const handleToggleHold = async (c: any, reason?: string) => {
    const newHold = !c.on_hold;
    const payload = { on_hold: newHold, hold_reason: newHold ? (reason ?? '') : null, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: c.id });
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...payload } : x));
    if (selectedCase?.id === c.id) setSelectedCase((p: any) => ({ ...p, ...payload }));
    setShowHoldInput(false);
    setHoldInputText('');
  };

  const handleEscalate = async (note: string, severity: string) => {
    if (!selectedCase) return;
    const payload = { escalated: true, escalation_note: note, escalation_severity: severity, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: selectedCase.id });
    setCases(prev => prev.map(c => c.id === selectedCase.id ? { ...c, ...payload } : c));
    setSelectedCase((p: any) => ({ ...p, ...payload }));
    setShowEscalate(false);
  };

  const handleAddStage = async (name: string) => {
    const upper = name.trim().toUpperCase();
    if (!upper || stages.includes(upper)) return;
    const newStages = [...stages, upper];
    setStages(newStages);
    await dbOp('global_settings', 'upsert', { key: 'cx_pipeline_stages', value: newStages });
    setShowAddCol(false);
  };

  const handleToggleStage = async (stageKey: string) => {
    if (!selectedCase) return;
    const done: string[] = selectedCase.stages_done ?? [];
    const idx = PIPELINE_STAGES.findIndex(s => s.key === stageKey);
    const isDone = done.includes(stageKey);
    let newDone: string[];
    if (isDone) {
      const keep = new Set(PIPELINE_STAGES.slice(0, idx).map(s => s.key));
      newDone = done.filter(k => keep.has(k));
    } else {
      newDone = PIPELINE_STAGES.slice(0, idx + 1).map(s => s.key);
    }
    const payload = { stages_done: newDone, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: selectedCase.id });
    setCases(prev => prev.map(c => c.id === selectedCase.id ? { ...c, ...payload } : c));
    setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  const handleToggleException = async (flagKey: string) => {
    if (!selectedCase) return;
    const flags: string[] = selectedCase.exception_flags ?? [];
    const newFlags = flags.includes(flagKey) ? flags.filter(k => k !== flagKey) : [...flags, flagKey];
    const payload = { exception_flags: newFlags, updated_at: new Date().toISOString() };
    await dbOp('cx_cases', 'update', payload, { id: selectedCase.id });
    setCases(prev => prev.map(c => c.id === selectedCase.id ? { ...c, ...payload } : c));
    setSelectedCase((p: any) => ({ ...p, ...payload }));
  };

  const markCaseRead = (caseId: number) => {
    localStorage.setItem(`cx-last-read-${currentUserId}-${caseId}`, new Date().toISOString());
    setUnreadCounts(prev => { const next = { ...prev }; delete next[caseId]; return next; });
  };

  const exportCSV = () => {
    const rows = [
      ['Name','Phone','Stage','Status','Priority','Issue','Payment Left','Pay Status'],
      ...filtered.map(c => [c.customer_name,c.phone,c.pipeline_stage,c.status,c.priority,c.issue,c.payment_left??'',c.pay_status??'']),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = 'cx-cases.csv'; a.click();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && updateRef.current === document.activeElement) {
        e.preventDefault(); handleLogUpdate();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [handleLogUpdate]);

  useEffect(() => {
    const counts: Record<number, number> = {};
    cases.forEach(c => {
      const lastRead = localStorage.getItem(`cx-last-read-${currentUserId}-${c.id}`) ?? new Date(0).toISOString();
      const count = updates.filter(u => u.case_id === c.id && u.created_at > lastRead).length;
      if (count > 0) counts[c.id] = count;
    });
    setUnreadCounts(counts);
  }, []);

  /* ── Status stat strip ─────────────────────────────────────── */
  const statStrip = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 16 }}>
      {STATUS_OPTIONS.map(s => {
        const cnt = cases.filter(c => c.status === s).length;
        const h = STATUS_HUE[s] ?? 200;
        return (
          <div key={s} style={{ background: 'white', border: `1px solid var(--line)`, borderLeft: `4px solid oklch(0.50 0.20 ${h})`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', transition: 'box-shadow .12s' }}
            onClick={() => setSearchQuery(s)}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-2)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = ''}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: `oklch(0.50 0.20 ${h})`, marginBottom: 4 }}>{s}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>{cnt}</div>
          </div>
        );
      })}
    </div>
  );

  /* ── Owner quick-look banner ────────────────────────────────── */
  const banner = (
    <div className="card" style={{ marginBottom: 16, padding: '16px 22px', background: section === 'admin' && escalatedCount > 0 ? 'linear-gradient(135deg, oklch(0.98 0.03 25), oklch(0.97 0.04 15))' : section === 'no_update' ? 'linear-gradient(135deg, oklch(0.98 0.02 145), oklch(0.97 0.03 120))' : section === 'unreachable' ? 'linear-gradient(135deg, oklch(0.98 0.02 290), oklch(0.97 0.03 270))' : 'linear-gradient(135deg, oklch(0.98 0.01 260), oklch(0.97 0.02 200))' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: section === 'admin' && escalatedCount > 0 ? 'oklch(0.45 0.20 25)' : section === 'no_update' ? 'oklch(0.36 0.15 145)' : section === 'unreachable' ? 'oklch(0.40 0.18 290)' : 'var(--ink-4)', marginBottom: 6 }}>
        CUSTOMER SERVICE · {section === 'admin' ? 'ADMIN — ESCALATED CASES' : section === 'no_update' ? 'NO UPDATE NEEDED' : section === 'unreachable' ? 'UNREACHABLE CUSTOMERS' : 'AGENTS — ALL CUSTOMERS'}
      </div>
      {section === 'agents' ? (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          Tracking{' '}
          <strong style={{ color: 'var(--accent)' }}>{cases.length} active customer{cases.length !== 1 ? 's' : ''}</strong>{' '}
          across{' '}
          <strong style={{ color: 'var(--accent)' }}>{stages.length} pipeline stage{stages.length !== 1 ? 's' : ''}</strong>.{' '}
          {needActionCount > 0 && (
            <><strong style={{ color: 'oklch(0.45 0.20 25)' }}>{needActionCount}</strong> need{needActionCount === 1 ? 's' : ''} an update today.{' '}</>
          )}
          {totalOutstanding > 0 && <>Total outstanding: <strong style={{ color: 'oklch(0.38 0.18 145)' }}>${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.</>}
        </div>
      ) : section === 'no_update' ? (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          {noUpdateCount === 0
            ? 'No cases marked as no update needed.'
            : <><strong style={{ color: 'oklch(0.36 0.15 145)' }}>{noUpdateCount} case{noUpdateCount !== 1 ? 's' : ''}</strong> marked as no update needed. These customers do not require daily update logs and are excluded from the update-due counter.</>}
        </div>
      ) : section === 'unreachable' ? (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          {unreachableCount === 0
            ? 'No customers marked as unreachable.'
            : <><strong style={{ color: 'oklch(0.40 0.18 290)' }}>{unreachableCount} customer{unreachableCount !== 1 ? 's' : ''}</strong> marked as unreachable. These cases are excluded from the update-due counter until contact is re-established.</>}
        </div>
      ) : (
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7 }}>
          {escalatedCount === 0
            ? 'No escalated cases. All customers are being handled by agents.'
            : <><strong style={{ color: 'oklch(0.40 0.20 25)' }}>{escalatedCount} case{escalatedCount !== 1 ? 's' : ''}</strong> escalated and waiting for admin review. These have been flagged by agents and require management action.</>}
        </div>
      )}
    </div>
  );

  /* ── Toolbar ────────────────────────────────────────────────── */
  const toolbar = (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Section tabs */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, gap: 2 }}>
          <button onClick={() => setSection('agents')}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'agents' ? 'white' : 'transparent', color: section === 'agents' ? 'var(--ink)' : 'var(--ink-4)', boxShadow: section === 'agents' ? 'var(--sh-1)' : 'none' }}>
            Agents · {cases.filter(c => !c.escalated).length}
          </button>
          <button onClick={() => setSection('admin')}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'admin' ? (escalatedCount > 0 ? 'oklch(0.92 0.06 25)' : 'white') : 'transparent', color: section === 'admin' ? (escalatedCount > 0 ? 'oklch(0.38 0.20 25)' : 'var(--ink)') : (escalatedCount > 0 ? 'oklch(0.45 0.18 25)' : 'var(--ink-4)'), boxShadow: section === 'admin' ? 'var(--sh-1)' : 'none' }}>
            {escalatedCount > 0 ? '⚠ ' : ''}Admin · {escalatedCount}
          </button>
          <button onClick={() => setSection('no_update')}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'no_update' ? 'oklch(0.93 0.05 145)' : 'transparent', color: section === 'no_update' ? 'oklch(0.36 0.15 145)' : 'var(--ink-4)', boxShadow: section === 'no_update' ? 'var(--sh-1)' : 'none' }}>
            ✓ No Update Needed · {noUpdateCount}
          </button>
          <button onClick={() => setSection('unreachable')}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: section === 'unreachable' ? 'oklch(0.92 0.06 290)' : 'transparent', color: section === 'unreachable' ? 'oklch(0.38 0.18 290)' : (unreachableCount > 0 ? 'oklch(0.45 0.15 290)' : 'var(--ink-4)'), boxShadow: section === 'unreachable' ? 'var(--sh-1)' : 'none' }}>
            📵 Unreachable · {unreachableCount}
          </button>
        </div>
        <div style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 2px' }} />
        {section === 'agents' && <button className="btn btn-acc btn-sm" onClick={() => openAdd()}>+ Add customer</button>}
        {isOwner && section === 'agents' && <button className="btn btn-sec btn-sm" onClick={() => setShowAddCol(true)}>+ Add column</button>}
        <button className="btn btn-sec btn-sm" onClick={exportCSV}>Export CSV</button>
        <div style={{ flex: 1 }} />
        <input type="text" placeholder="Search name, phone, issue…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          className="fld-input" style={{ height: 34, width: 220, fontSize: 13 }} />
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
          {(['overview','board','table'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: viewMode === m ? 'white' : 'transparent', color: viewMode === m ? 'var(--ink)' : 'var(--ink-4)', boxShadow: viewMode === m ? 'var(--sh-1)' : 'none', textTransform: 'capitalize' }}>
              {m === 'overview' ? 'Overview' : m === 'board' ? 'Board' : 'Table'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Overview cards ─────────────────────────────────────────── */
  const overviewView = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
      {filtered.length === 0 && (
        <div className="card" style={{ gridColumn: '1/-1', padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          {section === 'admin' ? 'No escalated cases. All customers are being handled by agents.' : section === 'no_update' ? 'No cases marked as no update needed.' : section === 'unreachable' ? 'No customers marked as unreachable.' : 'No customer cases found.'}
        </div>
      )}
      {filtered.map(c => {
        const upds = caseUpdates(c.id);
        const latest = upds[0];
        const pm = PRIORITY_META[c.priority] ?? PRIORITY_META.MEDIUM;
        const paym = PAY_META[c.pay_status] ?? {};
        const border = c.on_hold ? 'oklch(0.60 0 0)' : sColor(c.status);
        const updateDue = needsUpdate(c);
        return (
          <div key={c.id} onClick={() => { setSelectedCase(c); markCaseRead(c.id); }}
            style={{ background: 'white', border: '1px solid var(--line)', borderLeft: `4px solid ${border}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow .12s, transform .12s', outline: updateDue ? '1.5px solid oklch(0.80 0.12 80)' : 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-2)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; (e.currentTarget as HTMLDivElement).style.transform = ''; }}>
            <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: `oklch(0.50 0.20 ${STATUS_HUE[c.status] ?? 200})`, color: 'white', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {initials(c.customer_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{c.customer_name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: pm.bg, color: pm.color }}>{c.priority}</span>
                  {c.escalated && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0.06 25)', color: 'oklch(0.40 0.20 25)' }}>⚠ ESCALATED</span>}
                  {c.on_hold && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0 0)', color: 'oklch(0.45 0 0)' }}>🔒 ON HOLD</span>}
                  {c.no_update_needed && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0.05 145)', color: 'oklch(0.36 0.15 145)' }}>✓ NO UPDATE</span>}
                  {c.unreachable && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0.06 290)', color: 'oklch(0.38 0.18 290)' }}>📵 UNREACHABLE</span>}
                  {updateDue && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.94 0.06 80)', color: 'oklch(0.40 0.18 80)' }}>⚠ UPDATE DUE</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{c.phone}</div>
                {reassigningCaseId === c.id ? (
                  <div onClick={e => e.stopPropagation()} style={{ marginTop: 6, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={reassignValue} onChange={e => setReassignValue(e.target.value)}
                      style={{ fontSize: 11, height: 26, borderRadius: 6, border: '1px solid var(--line)', padding: '0 6px', color: 'var(--ink)' }}>
                      <option value="">Unassigned</option>
                      {allProfiles.filter((p: any) => ['cx','owner','admin','supervisor'].includes(p.role)).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button onClick={() => handleReassignCase(c, reassignValue)}
                      style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}>
                      Assign
                    </button>
                    <button onClick={() => { setReassigningCaseId(null); setReassignValue(''); }}
                      style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'none', border: '1px solid var(--line)', cursor: 'pointer', color: 'var(--ink-4)' }}>
                      ✕
                    </button>
                  </div>
                ) : c.assigned_to ? (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-5)' }}>AGENT</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'oklch(0.94 0.05 260)', color: 'oklch(0.38 0.15 260)', border: '1px solid oklch(0.88 0.06 260)' }}>
                      {nameMap[c.assigned_to] ?? 'Unknown'}
                    </span>
                    {daysOpen(c.created_at) < 2 && (
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0.08 145)', color: 'oklch(0.32 0.16 145)', letterSpacing: '0.04em' }}>NEW</span>
                    )}
                    {isAdminOrOwner && (
                      <button onClick={e => { e.stopPropagation(); setReassigningCaseId(c.id); setReassignValue(c.assigned_to ?? ''); }}
                        style={{ fontSize: 10, background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', color: 'var(--ink-4)' }}>
                        Reassign
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); handleClaimCase(c); }}
                      style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'oklch(0.96 0.04 260)', color: 'oklch(0.38 0.16 260)', border: '1.5px dashed oklch(0.75 0.10 260)', cursor: 'pointer' }}>
                      + Claim Customer Case
                    </button>
                    {daysOpen(c.created_at) < 2 && (
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: 'oklch(0.92 0.08 145)', color: 'oklch(0.32 0.16 145)', letterSpacing: '0.04em' }}>NEW</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: sBg(c.status, 0.12), color: sColor(c.status), border: `1px solid ${sBg(c.status, 0.3)}` }}>{c.status.toUpperCase()}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--ink-4)', border: '1px solid var(--line)' }}>{c.pipeline_stage}</span>
            </div>
            {c.issue && (
              <div style={{ padding: '0 16px 10px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {c.issue}
              </div>
            )}
            {section === 'admin' && c.escalation_note && (
              <div style={{ margin: '0 16px 10px', padding: '8px 12px', background: 'oklch(0.96 0.04 25)', borderRadius: 8, borderLeft: '3px solid oklch(0.55 0.20 25)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.45 0.20 25)', letterSpacing: '0.06em', marginBottom: 3 }}>⚠ ESCALATION REASON</div>
                <div style={{ fontSize: 12, color: 'oklch(0.30 0.05 25)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.escalation_note}</div>
              </div>
            )}
            {latest && (
              <div style={{ margin: '0 16px 10px', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, borderLeft: '3px solid var(--line)' }}>
                <div style={{ fontSize: 10, color: 'var(--ink-5)', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <span>LATEST · {latest.update_date}</span>
                  <span>by {nameMap[latest.logged_by]?.split(' ')[0] ?? '?'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{latest.note}</div>
              </div>
            )}
            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {c.pay_status && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (PAY_META[c.pay_status] ?? {}).bg ?? 'var(--surface-2)', color: (PAY_META[c.pay_status] ?? {}).color ?? 'var(--ink-4)' }}>{c.pay_status.toUpperCase()}</span>
              )}
              {c.payment_left != null && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>${Number(c.payment_left).toLocaleString('en-US',{minimumFractionDigits:2})} left</span>}
              {unreadCounts[c.id] > 0 ? (
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '3px 11px', borderRadius: 999, background: 'oklch(0.91 0.09 145)', color: 'oklch(0.28 0.16 145)', border: '1.5px solid oklch(0.78 0.13 145)' }}>
                  {unreadCounts[c.id] === 1 ? '1 new update' : `${unreadCounts[c.id]} new updates`}
                </span>
              ) : (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-5)' }}>{caseUpdates(c.id).length} update{caseUpdates(c.id).length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── Board view ─────────────────────────────────────────────── */
  const boardView = (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
      {stages.map(stage => {
        const cols = filtered.filter(c => c.pipeline_stage === stage);
        return (
          <div key={stage} style={{ minWidth: 240, maxWidth: 260, flex: '0 0 250px' }}>
            <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: '10px 10px 0 0', border: '1px solid var(--line)', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--ink-3)' }}>{stage}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{cols.length}</div>
              </div>
              <button onClick={() => openAdd(stage)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px dashed var(--line)', background: 'transparent', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: '0 0 10px 10px', overflow: 'hidden', background: 'var(--surface)' }}>
              {cols.length === 0 && <div style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--ink-5)', fontSize: 12 }}>—</div>}
              {cols.map((c, i) => (
                <div key={c.id} onClick={() => { setSelectedCase(c); markCaseRead(c.id); }}
                  style={{ padding: '12px 14px', borderBottom: i < cols.length - 1 ? '1px solid var(--line-2)' : 'none', cursor: 'pointer', borderLeft: `3px solid ${c.on_hold ? 'oklch(0.60 0 0)' : sColor(c.status)}`, background: 'white', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'white'}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{c.customer_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-5)', marginBottom: 6 }}>{c.phone}</div>
                  {c.issue && <div style={{ fontSize: 12, color: 'var(--ink-4)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45 }}>{c.issue}</div>}
                  <div style={{ marginTop: 8, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: (PRIORITY_META[c.priority]??PRIORITY_META.MEDIUM).bg, color: (PRIORITY_META[c.priority]??PRIORITY_META.MEDIUM).color }}>{c.priority}</span>
                    {c.on_hold && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'oklch(0.92 0 0)', color: 'oklch(0.45 0 0)' }}>ON HOLD</span>}
                    {needsUpdate(c) && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'oklch(0.94 0.06 80)', color: 'oklch(0.40 0.18 80)' }}>⚠</span>}
                    {unreadCounts[c.id] > 0 && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: 'oklch(0.91 0.09 145)', color: 'oklch(0.28 0.16 145)', border: '1px solid oklch(0.78 0.13 145)' }}>
                        {unreadCounts[c.id] === 1 ? '1 new update' : `${unreadCounts[c.id]} new updates`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── Table view ─────────────────────────────────────────────── */
  const tableView = (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
              {['Customer','Phone','Stage','Status','Priority','Issue','Payment Left','Pay Status','Latest Update'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--ink-4)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const latest = caseUpdates(c.id)[0];
              const pm = PRIORITY_META[c.priority] ?? PRIORITY_META.MEDIUM;
              const paym = PAY_META[c.pay_status] ?? {};
              return (
                <tr key={c.id} onClick={() => { setSelectedCase(c); markCaseRead(c.id); }}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--line-2)' : 'none', cursor: 'pointer', borderLeft: `3px solid ${c.on_hold ? 'oklch(0.60 0 0)' : sColor(c.status)}` }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    {c.customer_name}
                    {needsUpdate(c) && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: 'oklch(0.94 0.06 80)', color: 'oklch(0.40 0.18 80)' }}>⚠</span>}
                    {unreadCounts[c.id] > 0 && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: 'oklch(0.91 0.09 145)', color: 'oklch(0.28 0.16 145)', border: '1px solid oklch(0.78 0.13 145)' }}>
                        {unreadCounts[c.id] === 1 ? '1 new update' : `${unreadCounts[c.id]} new updates`}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{c.phone}</td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-4)' }}>{c.pipeline_stage}</span>
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: sBg(c.status, 0.12), color: sColor(c.status) }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: pm.bg, color: pm.color }}>{c.priority}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--ink-3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.issue}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{c.payment_left != null ? `$${Number(c.payment_left).toLocaleString('en-US',{minimumFractionDigits:2})}` : '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {c.pay_status ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (paym as any).bg ?? 'var(--surface-2)', color: (paym as any).color ?? 'var(--ink-4)' }}>{c.pay_status}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--ink-4)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {latest ? <><span style={{ color: 'var(--ink-5)', marginRight: 4 }}>{latest.update_date}</span>{latest.note}</> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No customer cases found.</div>}
      </div>
    </div>
  );

  /* ── Case detail modal ──────────────────────────────────────── */
  const stagesDone: string[]     = selectedCase?.stages_done     ?? [];
  const exceptionFlags: string[] = selectedCase?.exception_flags ?? [];

  const detailModal = selectedCase && (
    <div className="mb" onClick={e => { if (e.target === e.currentTarget) { setSelectedCase(null); setShowHoldInput(false); setReassigningCaseId(null); setReassignValue(''); } }}>
      <div className="md" style={{ width: 820, maxHeight: '95vh', overflowY: 'auto', padding: 0 }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: sColor(selectedCase.status), color: 'white', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {initials(selectedCase.customer_name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{selectedCase.customer_name}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>📞 {selectedCase.phone}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>{selectedCase.pipeline_stage}</span>
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {reassigningCaseId === selectedCase.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select value={reassignValue} onChange={e => setReassignValue(e.target.value)}
                    style={{ fontSize: 12, height: 28, borderRadius: 6, border: '1px solid var(--line)', padding: '0 8px', color: 'var(--ink)' }}>
                    <option value="">Unassigned</option>
                    {allProfiles.filter((p: any) => ['cx','owner','admin','supervisor'].includes(p.role)).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button className="btn btn-acc btn-sm" onClick={() => handleReassignCase(selectedCase, reassignValue)}>Assign</button>
                  <button className="btn btn-sec btn-sm" onClick={() => { setReassigningCaseId(null); setReassignValue(''); }}>Cancel</button>
                </div>
              ) : selectedCase.assigned_to ? (
                <>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-5)' }}>Agent:</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'oklch(0.94 0.05 260)', color: 'oklch(0.38 0.15 260)', border: '1px solid oklch(0.88 0.06 260)' }}>
                    {nameMap[selectedCase.assigned_to] ?? 'Unknown'}
                  </span>
                  {isAdminOrOwner && (
                    <button className="btn btn-sec btn-sm" onClick={() => { setReassigningCaseId(selectedCase.id); setReassignValue(selectedCase.assigned_to ?? ''); }}>
                      Reassign
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>Unassigned</span>
                  <button className="btn btn-sm" style={{ background: 'oklch(0.94 0.05 260)', color: 'oklch(0.38 0.15 260)', border: '1px solid oklch(0.88 0.06 260)' }}
                    onClick={() => handleClaimCase(selectedCase)}>
                    Claim Customer Case
                  </button>
                  {isAdminOrOwner && (
                    <button className="btn btn-sec btn-sm" onClick={() => { setReassigningCaseId(selectedCase.id); setReassignValue(''); }}>
                      Assign to agent
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ padding: '4px 12px', borderRadius: 8, border: `1.5px solid ${sColor(selectedCase.status)}`, background: sBg(selectedCase.status, 0.08), fontSize: 11, fontWeight: 700, color: sColor(selectedCase.status) }}>
              CURRENT STATUS<br />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{selectedCase.status}</span>
            </div>
            <button onClick={() => { setSelectedCase(null); setShowHoldInput(false); setReassigningCaseId(null); setReassignValue(''); }} style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: '1px solid var(--line)' }}>
          {[
            { label: 'PRIORITY', value: selectedCase.priority, sub: ['Take action','No action taken'].includes(selectedCase.status) ? 'Needs action today' : selectedCase.on_hold ? 'On hold' : 'Monitoring', valueColor: (PRIORITY_META[selectedCase.priority]??PRIORITY_META.MEDIUM).color },
            { label: 'PAYMENT', value: selectedCase.pay_status ?? '—', sub: selectedCase.payment_left != null ? `$${Number(selectedCase.payment_left).toFixed(2)} left` : 'No balance', valueColor: (PAY_META[selectedCase.pay_status]??{}).color ?? 'var(--ink)' },
            { label: 'DAYS OPEN', value: String(daysOpen(selectedCase.created_at)), sub: 'Since first update', valueColor: 'var(--ink)' },
            { label: 'UPDATES', value: String(caseUpdates(selectedCase.id).length), sub: 'Logged on file', valueColor: 'var(--ink)' },
          ].map((st, i) => (
            <div key={st.label} style={{ padding: '14px 18px', borderRight: i < 3 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: 4 }}>{st.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: st.valueColor, display: 'flex', alignItems: 'center', gap: 6 }}>
                {st.label === 'PRIORITY' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: (PRIORITY_META[selectedCase.priority]??PRIORITY_META.MEDIUM).color, display: 'inline-block' }} />}
                {st.value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 2 }}>{st.sub}</div>
            </div>
          ))}
        </div>

        {/* On hold banner */}
        {selectedCase.on_hold && (
          <div style={{ padding: '10px 24px', background: 'oklch(0.96 0.01 0)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13 }}>🔒</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>On hold: {selectedCase.hold_reason || 'No reason specified'}</span>
            <button onClick={() => handleToggleHold(selectedCase)} style={{ marginLeft: 'auto', fontSize: 12, background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', color: 'var(--ink-4)' }}>Remove hold</button>
          </div>
        )}

        {/* Pipeline tracker */}
        <div style={{ padding: '18px 24px 16px', borderBottom: '1px solid var(--line)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>
              WHERE THEY STAND · {stagesDone.length} OF {PIPELINE_STAGES.length} STAGES DONE
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: 'oklch(0.38 0.18 260)', lineHeight: 1 }}>
                {Math.round(stagesDone.length / PIPELINE_STAGES.length * 100)}%
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>THROUGH PIPELINE</span>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 5, borderRadius: 999, background: 'oklch(0.93 0.01 260)', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: 'oklch(0.50 0.18 260)', width: `${stagesDone.length / PIPELINE_STAGES.length * 100}%`, transition: 'width 0.25s ease' }} />
          </div>
          {/* Stage groups */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 14 }}>
            {STAGE_GROUPS.map(group => {
              const groupDone = group.keys.filter(k => stagesDone.includes(k)).length;
              return (
                <div key={group.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--ink-4)' }}>{group.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: groupDone === group.keys.length ? 'oklch(0.36 0.15 145)' : 'var(--ink-5)' }}>{groupDone}/{group.keys.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {group.keys.map(key => {
                      const stage = PIPELINE_STAGES.find(s => s.key === key)!;
                      const isDone = stagesDone.includes(key);
                      const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === key);
                      const isCurrent = !isDone && stageIdx === stagesDone.length;
                      return (
                        <div key={key} onClick={() => handleToggleStage(key)}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 7, cursor: 'pointer', padding: '3px 5px', borderRadius: 6,
                            background: isCurrent ? 'oklch(0.95 0.03 260)' : 'transparent',
                            border: `1px solid ${isCurrent ? 'oklch(0.88 0.06 260)' : 'transparent'}` }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                            background: isDone ? 'oklch(0.50 0.18 260)' : 'transparent',
                            border: isDone ? 'none' : `2px solid ${isCurrent ? 'oklch(0.50 0.18 260)' : 'oklch(0.78 0.02 260)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isDone && <span style={{ color: 'white', fontSize: 8, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                            {isCurrent && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'oklch(0.50 0.18 260)' }} />}
                          </div>
                          <span style={{ fontSize: 11.5, lineHeight: 1.35,
                            color: isDone ? 'var(--ink)' : isCurrent ? 'oklch(0.35 0.18 260)' : 'var(--ink-4)',
                            fontWeight: isCurrent ? 700 : isDone ? 500 : 400 }}>
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Exceptions */}
          <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 11 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--ink-4)', marginBottom: 8 }}>EXCEPTIONS — TAP TO FLAG THIS CASE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {EXCEPTION_FLAGS.map(flag => {
                const isActive = exceptionFlags.includes(flag.key);
                return (
                  <button key={flag.key} onClick={() => handleToggleException(flag.key)}
                    style={{ padding: '4px 13px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                      background: isActive ? `oklch(0.93 ${flag.chroma} ${flag.hue})` : 'white',
                      color: isActive ? `oklch(0.35 ${flag.chroma * 2.2} ${flag.hue})` : 'var(--ink-4)',
                      border: `1.5px solid ${isActive ? `oklch(0.80 ${flag.chroma * 1.5} ${flag.hue})` : 'var(--line)'}`,
                      transition: 'all 0.12s' }}>
                    {isActive && <span style={{ marginRight: 4, fontSize: 8 }}>●</span>}
                    {flag.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Body: two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {/* Left: case details */}
          <div style={{ padding: '20px 22px', borderRight: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)', marginBottom: 14 }}>THE CASE</div>
            {[
              { label: 'ISSUE', value: selectedCase.issue, icon: null },
              { label: 'ACTION TAKEN', value: selectedCase.action_taken, icon: '→' },
              { label: "CUSTOMER'S WORDS", value: selectedCase.customer_words, icon: '"' },
              { label: 'LAB NOTES', value: selectedCase.lab_notes, icon: '⚙' },
            ].map(f => f.value && (
              <div key={f.label} style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10, borderLeft: '3px solid var(--line)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-5)', marginBottom: 6 }}>
                  {f.icon && <span style={{ marginRight: 5 }}>{f.icon}</span>}{f.label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{f.value}</div>
              </div>
            ))}
          </div>

          {/* Right: update log */}
          <div style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>UPDATE LOG</div>
              <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{caseUpdates(selectedCase.id).length} entr{caseUpdates(selectedCase.id).length !== 1 ? 'ies' : 'y'}</div>
            </div>

            {/* Log today */}
            <div style={{ padding: '12px 14px', border: '1.5px solid var(--line)', borderRadius: 10, marginBottom: 14, background: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>+ LOG UPDATE FOR TODAY</div>
                <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{today}</div>
              </div>
              <textarea ref={updateRef} value={updateText} onChange={e => setUpdateText(e.target.value)}
                placeholder="e.g. 'No answer. Left voicemail again.' or 'Customer agreed to remake.'"
                rows={3} style={{ width: '100%', resize: 'none', border: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)', lineHeight: 1.6, outline: 'none', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>
                  <kbd style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>⌘</kbd>
                  {' + '}
                  <kbd style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>↵</kbd>
                  {' to log'}
                </div>
                <button className="btn btn-acc btn-sm" onClick={handleLogUpdate} disabled={savingUpdate || !updateText.trim()}>
                  {savingUpdate ? 'Saving…' : 'Log update'}
                </button>
              </div>
            </div>

            {/* History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {caseUpdates(selectedCase.id).map((u: any, i: number) => (
                <div key={u.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `oklch(0.50 0.15 ${(u.logged_by?.charCodeAt(0) ?? 200) % 360})`, color: 'white', fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    {initials(nameMap[u.logged_by] ?? '?')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{u.update_date}</span>
                      {i === 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'oklch(0.94 0.06 200)', color: 'oklch(0.38 0.16 200)' }}>LATEST</span>}
                      <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>{nameMap[u.logged_by]?.split(' ').map((n: string, i: number) => i === 0 ? n : n[0] + '.').join(' ') ?? 'Unknown'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>{u.note}</div>
                  </div>
                </div>
              ))}
              {caseUpdates(selectedCase.id).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--ink-5)', textAlign: 'center', padding: '20px 0' }}>No updates logged yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-sm" style={{ background: 'oklch(0.92 0.06 25)', color: 'oklch(0.38 0.20 25)', border: '1px solid oklch(0.85 0.08 25)' }}
            onClick={() => { setShowEscalate(true); }}>⚠ Escalate to admin</button>
          {!selectedCase.on_hold && !showHoldInput && (
            <button className="btn btn-sec btn-sm" onClick={() => setShowHoldInput(true)}>🔒 Put on hold</button>
          )}
          <button className="btn btn-sec btn-sm"
            style={selectedCase.no_update_needed ? { background: 'oklch(0.92 0.05 145)', color: 'oklch(0.36 0.15 145)', border: '1px solid oklch(0.82 0.08 145)' } : {}}
            onClick={() => handleToggleNoUpdate(selectedCase)}>
            {selectedCase.no_update_needed ? '↩ Reactivate updates' : '✓ No update needed'}
          </button>
          <button className="btn btn-sec btn-sm"
            style={selectedCase.unreachable ? { background: 'oklch(0.92 0.06 290)', color: 'oklch(0.38 0.18 290)', border: '1px solid oklch(0.82 0.10 290)' } : {}}
            onClick={() => handleToggleUnreachable(selectedCase)}>
            {selectedCase.unreachable ? '↩ Mark reachable' : '📵 Unreachable'}
          </button>
          {showHoldInput && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="text" placeholder="Hold reason (e.g. waiting for lab)…" value={holdInputText} onChange={e => setHoldInputText(e.target.value)}
                className="fld-input" style={{ height: 32, fontSize: 12, width: 240 }} autoFocus />
              <button className="btn btn-sm btn-acc" onClick={() => handleToggleHold(selectedCase, holdInputText)}>Confirm</button>
              <button className="btn btn-sm btn-sec" onClick={() => { setShowHoldInput(false); setHoldInputText(''); }}>Cancel</button>
            </div>
          )}
          {isMgmt && <button className="btn btn-sec btn-sm" onClick={() => { openEdit(selectedCase); setSelectedCase(null); }}>Edit case</button>}
          {isMgmt && <button className="btn btn-sm" style={{ color: 'var(--err)', background: 'var(--surface-2)', border: '1px solid var(--line)' }} onClick={() => handleDeleteCase(selectedCase.id)}>Delete</button>}
          <button className="btn btn-acc btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setSelectedCase(null); setShowHoldInput(false); setReassigningCaseId(null); setReassignValue(''); }}>Done</button>
        </div>
      </div>

      {/* Escalate modal on top */}
      {showEscalate && <EscalateModal customerName={selectedCase.customer_name} onConfirm={handleEscalate} onClose={() => setShowEscalate(false)} />}
    </div>
  );

  /* ── Case form modal ────────────────────────────────────────── */
  const formModal = showForm && (
    <div className="mb" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
      <div className="md" style={{ width: 600, maxHeight: '94vh', overflowY: 'auto' }}>
        <div className="md-t">{editingCase ? 'Edit Customer Case' : 'New Customer Case'}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="pv-fld"><label>Customer Name *</label><input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="Full name" autoFocus /></div>
          <div className="pv-fld"><label>Phone</label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="000-000-0000" /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="pv-fld">
            <label>Pipeline Stage</label>
            <select value={form.pipeline_stage} onChange={e => setForm(p => ({ ...p, pipeline_stage: e.target.value }))}>
              {stages.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="pv-fld">
            <label>Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="pv-fld">
            <label>Priority</label>
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
              <option>HIGH</option><option>MEDIUM</option><option>LOW</option>
            </select>
          </div>
        </div>
        <div className="pv-fld"><label>Issue</label><textarea rows={2} value={form.issue} onChange={e => setForm(p => ({ ...p, issue: e.target.value }))} placeholder="Brief description of the customer's issue…" /></div>
        <div className="pv-fld"><label>Action Taken</label><textarea rows={2} value={form.action_taken} onChange={e => setForm(p => ({ ...p, action_taken: e.target.value }))} placeholder="What has been done so far…" /></div>
        <div className="pv-fld"><label>Customer's Words</label><textarea rows={2} value={form.customer_words} onChange={e => setForm(p => ({ ...p, customer_words: e.target.value }))} placeholder="Direct quotes from the customer…" /></div>
        <div className="pv-fld"><label>Lab Notes</label><input value={form.lab_notes} onChange={e => setForm(p => ({ ...p, lab_notes: e.target.value }))} placeholder="Internal lab / production notes…" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="pv-fld">
            <label>Payment Left ($)</label>
            <input type="number" min="0" step="0.01" value={form.payment_left} onChange={e => setForm(p => ({ ...p, payment_left: e.target.value }))} placeholder="0.00" />
          </div>
          <div className="pv-fld">
            <label>Pay Status</label>
            <select value={form.pay_status} onChange={e => setForm(p => ({ ...p, pay_status: e.target.value }))}>
              <option>Paid</option><option>Partial</option><option>Defaulted</option>
            </select>
          </div>
          <div className="pv-fld">
            <label>Assigned To</label>
            <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
              <option value="">Unassigned</option>
              {allProfiles.filter((p: any) => ['cx','owner','admin','supervisor'].includes(p.role)).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="pv-fld">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.on_hold} onChange={e => setForm(p => ({ ...p, on_hold: e.target.checked }))} />
            Put on hold
          </label>
          {form.on_hold && (
            <input style={{ marginTop: 8 }} value={form.hold_reason} onChange={e => setForm(p => ({ ...p, hold_reason: e.target.value }))} placeholder="Hold reason (e.g. waiting for production, escalation pending…)" />
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-acc" onClick={handleSaveCase} disabled={savingCase || !form.customer_name.trim()}>
            {savingCase ? 'Saving…' : editingCase ? 'Update Case' : 'Add Case'}
          </button>
          <button className="btn btn-sec" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );

  /* ── Add column modal ───────────────────────────────────────── */
  const addColModal = showAddCol && (
    <div className="mb" onClick={e => { if (e.target === e.currentTarget) setShowAddCol(false); }}>
      <div className="md" style={{ width: 380 }}>
        <div className="md-t">Add Pipeline Stage</div>
        <AddColumnModal onConfirm={handleAddStage} onClose={() => setShowAddCol(false)} />
      </div>
    </div>
  );

  /* ── Main render ────────────────────────────────────────────── */
  return (
    <div className="page-fade">
      {statStrip}
      {banner}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
          {section === 'agents' ? 'Agents — All customers' : section === 'admin' ? 'Admin — Escalated cases' : 'No Update Needed'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
          {section === 'agents'
            ? 'Every customer is visible here — color-coded by status · click any to log updates'
            : section === 'admin'
            ? 'Cases flagged by agents that require management review or action'
            : 'Customers that do not need a daily update — click to manage or reactivate'}
        </div>
      </div>
      {toolbar}
      {viewMode === 'overview' && overviewView}
      {viewMode === 'board'    && boardView}
      {viewMode === 'table'    && tableView}
      {detailModal}
      {formModal}
      {addColModal}
    </div>
  );
}

/* ── Escalate modal ──────────────────────────────────────────── */
function EscalateModal({ customerName, onConfirm, onClose }: { customerName: string; onConfirm: (note: string, severity: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [severity, setSeverity] = useState('HIGH');
  const [routeTo, setRouteTo] = useState('Admin team');
  return (
    <div className="mb" style={{ zIndex: 9999 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md" style={{ width: 520 }}>
        <div className="md-t">Escalate — {customerName}</div>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '0 0 16px' }}>
          This case will be routed to an admin for review. The customer card will be flagged and the admin queue will alert at the top of the page.
        </p>
        <div className="pv-fld">
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>WHY DOES THIS NEED AN ADMIN?</label>
          <textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. CX is demanding a refund + threatening chargeback. Needs an executive call." style={{ resize: 'none' }} autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="pv-fld">
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>SEVERITY</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {['LOW','MEDIUM','HIGH'].map(s => (
                <button key={s} onClick={() => setSeverity(s)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1.5px solid ${severity === s ? (s === 'HIGH' ? 'oklch(0.50 0.20 25)' : s === 'MEDIUM' ? 'oklch(0.50 0.18 75)' : 'var(--line)') : 'var(--line)'}`, background: severity === s ? (s === 'HIGH' ? 'oklch(0.92 0.06 25)' : s === 'MEDIUM' ? 'oklch(0.94 0.06 75)' : 'var(--surface-2)') : 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: severity === s ? (s === 'HIGH' ? 'oklch(0.40 0.20 25)' : s === 'MEDIUM' ? 'oklch(0.40 0.18 75)' : 'var(--ink-4)') : 'var(--ink-4)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="pv-fld">
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)' }}>ROUTE TO</label>
            <select value={routeTo} onChange={e => setRouteTo(e.target.value)} style={{ marginTop: 6 }}>
              <option>Admin team</option><option>Owner</option><option>Supervisor</option>
            </select>
          </div>
        </div>
        <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>PREVIEW →</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: severity === 'HIGH' ? 'oklch(0.92 0.06 25)' : severity === 'MEDIUM' ? 'oklch(0.94 0.06 75)' : 'var(--surface-2)', color: severity === 'HIGH' ? 'oklch(0.40 0.20 25)' : severity === 'MEDIUM' ? 'oklch(0.40 0.18 75)' : 'var(--ink-4)' }}>{severity}</span>
          <span style={{ fontWeight: 600 }}>{customerName} → {routeTo}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sec" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm" style={{ background: 'oklch(0.92 0.06 25)', color: 'oklch(0.38 0.20 25)', border: '1px solid oklch(0.85 0.08 25)', fontWeight: 700, padding: '8px 20px', borderRadius: 8, cursor: 'pointer', flex: 1 }}
            onClick={() => onConfirm(note, severity)}>
            ⚠ Escalate to admin
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Column modal ────────────────────────────────────────── */
function AddColumnModal({ onConfirm, onClose }: { onConfirm: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); onConfirm(name); }}>
      <div className="pv-fld"><label>Stage Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FOLLOW-UP" autoFocus required /></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-acc">Add Stage</button>
        <button type="button" className="btn btn-sec" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}
