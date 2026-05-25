'use client';

import { useState, useMemo } from 'react';
import { dbOp } from '@/utils/db';

/* ── Types ───────────────────────────────────────────────────────────── */

type SOP = {
  id: number;
  name: string;
  category: string;
  when_to_use: string | null;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type FaultCode = {
  id: number;
  code: number;
  category: string;
  condition_text: string;
  agent_action: string;
  agent_steps: string[];
  escalation_type: 'none' | 'conditional' | 'immediate';
  escalation_condition: string | null;
  linked_sop_id: number | null;
  created_by: string | null;
  created_at: string;
};

/* ── Types ───────────────────────────────────────────────────────────── */

type Category = { series: number; label: string; hue: number };

/* ── Constants ───────────────────────────────────────────────────────── */

const DEFAULT_CATEGORIES: Category[] = [
  { series: 100, label: 'Impression / Technical',         hue: 240 },
  { series: 200, label: 'Customer Sentiment / Financials', hue: 15  },
  { series: 300, label: 'Operational / Internal',          hue: 55  },
];

// Hue cycle for auto-assigning new categories
const HUE_CYCLE = [145, 290, 180, 320, 210, 90, 0, 270];

const SOP_CATEGORIES = ['Impression', 'Sentiment', 'Financial', 'Operations'];

const ESCALATION_OPTIONS = [
  { value: 'none',        label: 'None — no manager involvement' },
  { value: 'conditional', label: 'Conditional — escalate only if...' },
  { value: 'immediate',   label: 'Immediate — escalate now' },
];

function getSeries(code: number) {
  return Math.floor(code / 100) * 100;
}

function escalationColor(type: string) {
  if (type === 'none')        return 'oklch(0.62 0.17 145)';
  if (type === 'conditional') return 'oklch(0.70 0.16 60)';
  return 'oklch(0.58 0.22 15)';
}

function escalationBg(type: string) {
  if (type === 'none')        return 'oklch(0.97 0.04 145)';
  if (type === 'conditional') return 'oklch(0.97 0.04 60)';
  return 'oklch(0.97 0.04 15)';
}

function escalationLabel(type: string) {
  if (type === 'none')        return 'NO ESCALATION';
  if (type === 'conditional') return 'CONDITIONAL';
  return 'IMMEDIATE';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function sopCategoryColor(cat: string) {
  const map: Record<string, string> = {
    Impression: 'oklch(0.55 0.18 240)',
    Sentiment:  'oklch(0.55 0.18 15)',
    Financial:  'oklch(0.55 0.18 145)',
    Operations: 'oklch(0.55 0.08 260)',
  };
  return map[cat] ?? 'oklch(0.55 0.08 260)';
}

/* ── Empty form helpers ──────────────────────────────────────────────── */

const EMPTY_CODE_FORM = {
  code: '',
  category: 'Impression / Technical',
  condition_text: '',
  agent_action: '',
  agent_steps_raw: '',
  escalation_type: 'none' as 'none' | 'conditional' | 'immediate',
  escalation_condition: '',
  linked_sop_id: '',
};

const EMPTY_SOP_FORM = {
  name: '',
  category: 'Impression',
  when_to_use: '',
  body: 'WHEN: …\n\nSTEPS:\n1. …\n2. …\n3. …\n\nWHY: …',
};

/* ════════════════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════════════ */

export default function FIMClient({
  initialCodes,
  initialSops,
  userRole,
  currentUserId,
  currentUserName,
  savedCategories,
  section = 'cx',
}: {
  initialCodes: FaultCode[];
  initialSops: SOP[];
  userRole: string;
  currentUserId: string;
  currentUserName: string;
  savedCategories: Category[] | null;
  section?: string;
}) {
  const isOwner = ['owner', 'admin', 'supervisor', 'dentist'].includes(userRole);
  const categoriesKey = section === 'lab' ? 'fim_categories_lab' : section === 'sales' ? 'fim_categories_sales' : 'fim_categories';

  /* ── State ── */
  const [codes, setCodes]   = useState<FaultCode[]>(initialCodes);
  const [sops, setSops]     = useState<SOP[]>(initialSops);
  const [tab, setTab]       = useState<'codes' | 'sops'>('codes');
  const [filter, setFilter] = useState<'all' | 'none' | 'conditional' | 'immediate'>('all');
  const [search, setSearch] = useState('');

  const [selectedCode, setSelectedCode] = useState<FaultCode | null>(null);
  const [selectedSop,  setSelectedSop]  = useState<SOP | null>(null);

  const [showAddCode, setShowAddCode]         = useState(false);
  const [showAddSop,  setShowAddSop]          = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCode, setEditingCode]         = useState<FaultCode | null>(null);
  const [editingSop,  setEditingSop]          = useState<SOP | null>(null);

  const [codeForm, setCodeForm] = useState({ ...EMPTY_CODE_FORM });
  const [sopForm,  setSopForm]  = useState({ ...EMPTY_SOP_FORM });
  const [catForm,  setCatForm]  = useState({ series: '', label: '' });
  const [saving,    setSaving]    = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [err, setErr]             = useState('');
  const [catErr, setCatErr]       = useState('');

  const [categories, setCategories] = useState<Category[]>(savedCategories ?? DEFAULT_CATEGORIES);

  /* ── Derived ── */
  const filteredCodes = useMemo(() => {
    let list = codes;
    if (filter !== 'all') list = list.filter(c => c.escalation_type === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        String(c.code).includes(q) ||
        c.condition_text.toLowerCase().includes(q) ||
        c.agent_action.toLowerCase().includes(q)
      );
    }
    return list;
  }, [codes, filter, search]);

  const filteredSops = useMemo(() => {
    if (!search) return sops;
    const q = search.toLowerCase();
    return sops.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.when_to_use ?? '').toLowerCase().includes(q)
    );
  }, [sops, search]);

  const groupedCodes = useMemo(() => {
    const groups: Record<number, FaultCode[]> = {};
    for (const c of filteredCodes) {
      const s = getSeries(c.code);
      if (!groups[s]) groups[s] = [];
      groups[s].push(c);
    }
    return groups;
  }, [filteredCodes]);

  const sopById = useMemo(() => {
    const m: Record<number, SOP> = {};
    for (const s of sops) m[s.id] = s;
    return m;
  }, [sops]);

  const escalationCounts = useMemo(() => ({
    none:        codes.filter(c => c.escalation_type === 'none').length,
    conditional: codes.filter(c => c.escalation_type === 'conditional').length,
    immediate:   codes.filter(c => c.escalation_type === 'immediate').length,
  }), [codes]);

  const categoryMap = useMemo(() => {
    const m: Record<number, Category> = {};
    for (const c of categories) m[c.series] = c;
    return m;
  }, [categories]);

  /* ── Helpers ── */
  function openEditCode(fc: FaultCode) {
    const seriesNum = getSeries(fc.code);
    const seriesLabel = categoryMap[seriesNum]?.label ?? fc.category;
    setCodeForm({
      code: String(fc.code),
      category: seriesLabel,
      condition_text: fc.condition_text,
      agent_action: fc.agent_action,
      agent_steps_raw: (fc.agent_steps ?? []).join('\n'),
      escalation_type: fc.escalation_type,
      escalation_condition: fc.escalation_condition ?? '',
      linked_sop_id: fc.linked_sop_id ? String(fc.linked_sop_id) : '',
    });
    setEditingCode(fc);
    setSelectedCode(null);
  }

  function openEditSop(s: SOP) {
    setSopForm({ name: s.name, category: s.category, when_to_use: s.when_to_use ?? '', body: s.body });
    setEditingSop(s);
    setSelectedSop(null);
  }

  function resetCodeForm() {
    setCodeForm({ ...EMPTY_CODE_FORM });
    setEditingCode(null);
    setShowAddCode(false);
    setErr('');
  }

  function resetSopForm() {
    setSopForm({ ...EMPTY_SOP_FORM });
    setEditingSop(null);
    setShowAddSop(false);
    setErr('');
  }

  /* ── Save fault code ── */
  async function saveCode() {
    if (!codeForm.code || !codeForm.condition_text.trim() || !codeForm.agent_action.trim()) {
      setErr('Code, condition, and agent action are required.'); return;
    }
    setSaving(true); setErr('');
    const steps = codeForm.agent_steps_raw.split('\n').map(s => s.trim()).filter(Boolean);
    const payload: any = {
      code: Number(codeForm.code),
      category: codeForm.category.replace(/^\d+\s·\s/, ''),
      condition_text: codeForm.condition_text.trim(),
      agent_action: codeForm.agent_action.trim(),
      agent_steps: steps,
      escalation_type: codeForm.escalation_type,
      escalation_condition: codeForm.escalation_condition.trim() || null,
      linked_sop_id: codeForm.linked_sop_id ? Number(codeForm.linked_sop_id) : null,
    };
    if (editingCode) {
      const { error } = await dbOp('fim_fault_codes', 'update', payload, { id: editingCode.id });
      if (error) { setErr(error); setSaving(false); return; }
      setCodes(prev => prev.map(c => c.id === editingCode.id ? { ...c, ...payload, id: editingCode.id } : c));
    } else {
      payload.created_by = currentUserId;
      payload.section = section;
      const { data, error } = await dbOp('fim_fault_codes', 'insert', payload);
      if (error) { setErr(error); setSaving(false); return; }
      if (data?.[0]) setCodes(prev => [...prev, data[0]].sort((a, b) => a.code - b.code));
    }
    setSaving(false); resetCodeForm();
  }

  /* ── Save SOP ── */
  async function saveSop() {
    if (!sopForm.name.trim() || !sopForm.body.trim()) {
      setErr('Name and body are required.'); return;
    }
    setSaving(true); setErr('');
    const payload: any = {
      name: sopForm.name.trim(),
      category: sopForm.category,
      when_to_use: sopForm.when_to_use.trim() || null,
      body: sopForm.body.trim(),
      updated_at: new Date().toISOString(),
    };
    if (editingSop) {
      const { error } = await dbOp('fim_sops', 'update', payload, { id: editingSop.id });
      if (error) { setErr(error); setSaving(false); return; }
      setSops(prev => prev.map(s => s.id === editingSop.id ? { ...s, ...payload } : s));
    } else {
      payload.created_by = currentUserId;
      payload.section = section;
      const { data, error } = await dbOp('fim_sops', 'insert', payload);
      if (error) { setErr(error); setSaving(false); return; }
      if (data?.[0]) setSops(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setSaving(false); resetSopForm();
  }

  /* ── Delete ── */
  async function deleteCode(id: number) {
    await dbOp('fim_fault_codes', 'delete', undefined, { id });
    setCodes(prev => prev.filter(c => c.id !== id));
    setSelectedCode(null);
  }

  async function deleteSop(id: number) {
    await dbOp('fim_sops', 'delete', undefined, { id });
    setSops(prev => prev.filter(s => s.id !== id));
    setSelectedSop(null);
  }

  /* ── Save category ── */
  async function saveCategory() {
    const seriesNum = Number(catForm.series);
    if (!catForm.label.trim() || !seriesNum || seriesNum < 100) {
      setCatErr('Series number (≥ 100) and label are required.'); return;
    }
    if (categories.some(c => c.series === seriesNum)) {
      setCatErr(`Series ${seriesNum} already exists.`); return;
    }
    setSavingCat(true); setCatErr('');
    const hue = HUE_CYCLE[(categories.length - DEFAULT_CATEGORIES.length) % HUE_CYCLE.length];
    const newCat: Category = { series: seriesNum, label: catForm.label.trim(), hue };
    const updated = [...categories, newCat].sort((a, b) => a.series - b.series);
    const { error } = await dbOp('global_settings', 'upsert', { key: categoriesKey, value: JSON.stringify(updated) });
    if (error) { setCatErr(error); setSavingCat(false); return; }
    setCategories(updated);
    setShowAddCategory(false);
    setCatForm({ series: '', label: '' });
    setSavingCat(false);
  }

  /* ════════════════════════════════════════════════════════════════════
     Render
  ═══════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto', fontFamily: 'inherit' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.55 0.18 240)', display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'oklch(0.55 0.18 240)', textTransform: 'uppercase' }}>
            FIM · Fault Identification Manual
          </span>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 15, color: 'oklch(0.45 0.02 260)', lineHeight: 1.5 }}>
          <strong style={{ color: 'oklch(0.55 0.18 240)' }}>{codes.length} fault codes</strong> across{' '}
          <strong style={{ color: 'oklch(0.55 0.18 240)' }}>{categories.length} categories</strong> ·{' '}
          <strong style={{ color: 'oklch(0.55 0.18 240)' }}>{sops.length} SOPs</strong> indexed.{' '}
          When a fault occurs, look up the code, follow the agent action, and escalate only if the manual says so.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {isOwner && tab === 'codes' && (
            <button onClick={() => { setCodeForm({ ...EMPTY_CODE_FORM }); setShowAddCode(true); }}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'oklch(0.55 0.18 240)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              + Add fault code
            </button>
          )}
          {isOwner && tab === 'codes' && (
            <button onClick={() => {
              const nextSeries = Math.max(...categories.map(c => c.series)) + 100;
              setCatForm({ series: String(nextSeries), label: '' });
              setCatErr('');
              setShowAddCategory(true);
            }}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', color: 'oklch(0.45 0.18 240)', border: '1px solid oklch(0.80 0.08 240)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              + Add category
            </button>
          )}
          {isOwner && tab === 'sops' && (
            <button onClick={() => { setSopForm({ ...EMPTY_SOP_FORM }); setShowAddSop(true); }}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'oklch(0.55 0.18 240)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              + Add SOP
            </button>
          )}
          <button onClick={() => setTab(tab === 'codes' ? 'sops' : 'codes')}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', color: 'oklch(0.45 0.02 260)', border: '1px solid oklch(0.88 0.01 260)', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>
            {tab === 'codes' ? `Browse SOPs (${sops.length}) →` : `Browse fault codes (${codes.length}) →`}
          </button>
        </div>
      </div>

      {/* ── Tab bar + search ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        {tab === 'codes' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([
              { key: 'all',         label: `All · ${codes.length}` },
              { key: 'none',        label: `No escalation · ${escalationCounts.none}` },
              { key: 'conditional', label: `Conditional · ${escalationCounts.conditional}` },
              { key: 'immediate',   label: `Immediate · ${escalationCounts.immediate}` },
            ] as { key: typeof filter; label: string }[]).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
                  background: filter === f.key ? 'oklch(0.92 0.04 240)' : 'oklch(0.96 0.01 260)',
                  color: filter === f.key ? 'oklch(0.35 0.12 240)' : 'oklch(0.45 0.02 260)',
                }}>
                {f.key !== 'all' && (
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: escalationColor(f.key), marginRight: 5 }} />
                )}
                {f.label}
              </button>
            ))}
          </div>
        )}
        {tab === 'sops' && <div />}
        <input
          placeholder={tab === 'codes' ? 'Search code, condition, action…' : 'Search SOPs…'}
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid oklch(0.88 0.01 260)', fontSize: 13, width: 260, outline: 'none', background: 'oklch(0.98 0.005 260)', color: 'oklch(0.25 0.02 260)' }}
        />
      </div>

      {/* ════════════════════ FAULT CODES VIEW ═══════════════════════ */}
      {tab === 'codes' && (
        <div>
          {Object.entries(groupedCodes).map(([seriesStr, items]) => {
            const series = Number(seriesStr);
            const { label, hue } = categoryMap[series] ?? { label: `${series} Series`, hue: 240 };
            return (
              <div key={series} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, padding: '3px 10px', borderRadius: 4, background: `oklch(0.94 0.06 ${hue})`, color: `oklch(0.42 0.18 ${hue})`, textTransform: 'uppercase' }}>
                      {series} Series
                    </span>
                    <span style={{ fontSize: 13, color: 'oklch(0.45 0.02 260)', fontWeight: 500 }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'oklch(0.6 0.01 260)' }}>{items.length} code{items.length !== 1 ? 's' : ''}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                  {items.map(fc => {
                    const linkedSop = fc.linked_sop_id ? sopById[fc.linked_sop_id] : null;
                    return (
                      <button key={fc.id} onClick={() => setSelectedCode(fc)}
                        style={{ textAlign: 'left', padding: 16, borderRadius: 10, border: `2px solid oklch(0.90 0.04 ${hue})`, background: '#fff', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px oklch(0.8 0.05 240 / 0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: `oklch(0.55 0.18 ${hue})`, borderRadius: '10px 0 0 10px' }} />
                        <div style={{ paddingLeft: 8 }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color: `oklch(0.50 0.18 ${hue})`, lineHeight: 1, marginBottom: 4 }}>{fc.code}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'oklch(0.25 0.02 260)', marginBottom: 6, lineHeight: 1.35 }}>{fc.condition_text}</div>
                          <div style={{ fontSize: 11, color: 'oklch(0.55 0.02 260)', marginBottom: 10, lineHeight: 1.4 }}>
                            <span style={{ fontWeight: 600, color: 'oklch(0.45 0.02 260)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Repair → </span>
                            {fc.agent_action}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: escalationBg(fc.escalation_type), color: escalationColor(fc.escalation_type) }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: escalationColor(fc.escalation_type) }} />
                              {fc.escalation_type === 'none' ? 'NONE' : fc.escalation_type === 'conditional' ? 'MGR IF…' : 'IMMEDIATE'}
                            </span>
                            {linkedSop && (
                              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'oklch(0.93 0.04 240)', color: 'oklch(0.42 0.15 240)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                # SOP · {linkedSop.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filteredCodes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'oklch(0.6 0.01 260)', fontSize: 14 }}>No fault codes match your filter.</div>
          )}
        </div>
      )}

      {/* ════════════════════ SOPs VIEW ══════════════════════════════ */}
      {tab === 'sops' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filteredSops.map(sop => (
            <button key={sop.id} onClick={() => setSelectedSop(sop)}
              style={{ textAlign: 'left', padding: 18, borderRadius: 10, border: '1px solid oklch(0.91 0.01 260)', background: '#fff', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px oklch(0.8 0.05 240 / 0.15)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 6, background: 'oklch(0.94 0.04 240)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'oklch(0.45 0.15 240)', flexShrink: 0 }}>≡</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.25 0.02 260)' }}>{sop.name}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: sopCategoryColor(sop.category), textTransform: 'uppercase', letterSpacing: 0.5 }}>{sop.category}</div>
                </div>
              </div>
              {sop.when_to_use && (
                <div style={{ fontSize: 12, color: 'oklch(0.45 0.02 260)', lineHeight: 1.45, marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>When: </span>
                  {sop.when_to_use}
                </div>
              )}
              <div style={{ borderTop: '1px solid oklch(0.93 0.01 260)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'oklch(0.6 0.01 260)' }}>
                <span>{currentUserName}</span>
                <span>Updated {formatDate(sop.updated_at)}</span>
              </div>
            </button>
          ))}
          {filteredSops.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: 'oklch(0.6 0.01 260)', fontSize: 14 }}>No SOPs found.</div>
          )}
        </div>
      )}

      {/* ════════════════════ FAULT CODE DETAIL MODAL ════════════════ */}
      {selectedCode && (
        <Modal onClose={() => setSelectedCode(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 640, maxWidth: 840 }}>
            {/* header */}
            <div style={{ background: 'oklch(0.96 0.04 240)', padding: '18px 22px', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: `oklch(0.50 0.18 ${categoryMap[getSeries(selectedCode.code)]?.hue ?? 240})`, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>
                  {selectedCode.category}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontSize: 40, fontWeight: 900, color: `oklch(0.40 0.18 ${categoryMap[getSeries(selectedCode.code)]?.hue ?? 240})`, lineHeight: 1 }}>{selectedCode.code}</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'oklch(0.25 0.02 260)' }}>{selectedCode.condition_text}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: escalationBg(selectedCode.escalation_type), color: escalationColor(selectedCode.escalation_type) }}>
                  ● {escalationLabel(selectedCode.escalation_type).split(' ')[0]}
                </span>
                <button onClick={() => setSelectedCode(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: 'oklch(0.5 0.02 260)', lineHeight: 1 }}>✕</button>
              </div>
            </div>

            {/* body — two columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, padding: '20px 22px', background: '#fff', borderRadius: '0 0 12px 12px' }}>
              {/* Left: agent action */}
              <div style={{ paddingRight: 18, borderRight: '1px solid oklch(0.92 0.01 260)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.35 0.02 260)', marginBottom: 12 }}>1 · Agent action (repair)</div>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'oklch(0.97 0.01 260)', fontSize: 13, color: 'oklch(0.35 0.02 260)', marginBottom: 14, lineHeight: 1.45 }}>
                  {selectedCode.agent_action}
                </div>
                {selectedCode.agent_steps?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedCode.agent_steps.map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid oklch(0.92 0.01 260)', background: '#fafafa', fontSize: 13 }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'oklch(0.55 0.18 240)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ color: 'oklch(0.35 0.02 260)', lineHeight: 1.4 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedCode.linked_sop_id && sopById[selectedCode.linked_sop_id] && (
                  <button onClick={() => { setSelectedSop(sopById[selectedCode.linked_sop_id!]); setSelectedCode(null); }}
                    style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', borderRadius: 8, background: 'oklch(0.93 0.04 240)', border: '1px solid oklch(0.85 0.06 240)', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 28, height: 28, borderRadius: 6, background: 'oklch(0.55 0.18 240)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, flexShrink: 0 }}>≡</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.35 0.12 240)' }}>Open SOP · {sopById[selectedCode.linked_sop_id].name}</div>
                      <div style={{ fontSize: 11, color: 'oklch(0.5 0.08 240)' }}>Tap to read the playbook</div>
                    </div>
                    <span style={{ marginLeft: 'auto', color: 'oklch(0.5 0.08 240)' }}>→</span>
                  </button>
                )}
              </div>

              {/* Right: escalation */}
              <div style={{ paddingLeft: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.35 0.02 260)', marginBottom: 12 }}>2 · Escalation (talk to manager)</div>

                {/* escalation status box */}
                <div style={{ padding: '12px 14px', borderRadius: 8, background: escalationBg(selectedCode.escalation_type), border: `1px solid oklch(0.85 0.05 ${selectedCode.escalation_type === 'none' ? 145 : selectedCode.escalation_type === 'conditional' ? 60 : 15})`, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: escalationColor(selectedCode.escalation_type), textTransform: 'uppercase', marginBottom: 4 }}>
                    {escalationLabel(selectedCode.escalation_type)}
                  </div>
                  {selectedCode.escalation_type === 'none' && (
                    <div style={{ fontSize: 13, color: 'oklch(0.40 0.12 145)' }}>No manager involvement required. Log the fault and move on.</div>
                  )}
                  {selectedCode.escalation_type === 'conditional' && selectedCode.escalation_condition && (
                    <div style={{ fontSize: 13, color: 'oklch(0.40 0.12 60)' }}>
                      <strong>Only escalate if:</strong> {selectedCode.escalation_condition}
                    </div>
                  )}
                  {selectedCode.escalation_type === 'immediate' && (
                    <div style={{ fontSize: 13, color: 'oklch(0.40 0.12 15)' }}>Escalate to manager immediately. Do not delay.</div>
                  )}
                </div>

                {selectedCode.escalation_type !== 'none' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.5 0.02 260)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>When you escalate:</div>
                    {[
                      { label: 'Flag on customer profile', sub: 'Tap escalation button in the CX portal', icon: '⚑' },
                      { label: 'Open a claim to admin', sub: 'Sends the case + your notes to admin', icon: '≡' },
                      ...(selectedCode.linked_sop_id && sopById[selectedCode.linked_sop_id] ? [{ label: `Check SOP · ${sopById[selectedCode.linked_sop_id].name}`, sub: 'Read before the handoff call', icon: '≡' }] : []),
                    ].map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', borderRadius: 8, border: '1px solid oklch(0.92 0.01 260)', background: '#fafafa' }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'oklch(0.55 0.18 240)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.30 0.02 260)' }}>{step.label}</div>
                          <div style={{ fontSize: 11, color: 'oklch(0.55 0.02 260)' }}>{step.sub}</div>
                        </div>
                        <span style={{ marginLeft: 'auto', color: 'oklch(0.7 0.02 260)', fontSize: 13 }}>→</span>
                      </div>
                    ))}
                    {selectedCode.escalation_type === 'conditional' && selectedCode.escalation_condition && (
                      <div style={{ fontSize: 11, color: 'oklch(0.55 0.02 260)', fontStyle: 'italic', paddingLeft: 4 }}>· {selectedCode.escalation_condition}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: 20, color: 'oklch(0.65 0.01 260)' }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>✓</div>
                    <div style={{ fontSize: 12 }}>No escalation actions needed.<br />Just log the fix on the CX timeline.</div>
                  </div>
                )}
              </div>
            </div>

            {/* footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px 18px', background: '#fff', borderTop: '1px solid oklch(0.92 0.01 260)', borderRadius: '0 0 12px 12px' }}>
              {isOwner && (
                <button onClick={() => openEditCode(selectedCode)}
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#fff', border: '1px solid oklch(0.85 0.01 260)', color: 'oklch(0.35 0.02 260)', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>
                  Edit code
                </button>
              )}
              {isOwner && (
                <button onClick={() => { if (confirm('Delete this fault code?')) deleteCode(selectedCode.id); }}
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#fff', border: '1px solid oklch(0.85 0.05 15)', color: 'oklch(0.45 0.18 15)', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>
                  Delete
                </button>
              )}
              <button onClick={() => setSelectedCode(null)}
                style={{ padding: '8px 22px', borderRadius: 8, background: 'oklch(0.55 0.18 240)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Got it
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ════════════════════ SOP VIEWER MODAL ═══════════════════════ */}
      {selectedSop && (
        <Modal onClose={() => setSelectedSop(null)}>
          <div style={{ minWidth: 480, maxWidth: 640 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 36, height: 36, borderRadius: 8, background: 'oklch(0.94 0.04 240)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'oklch(0.45 0.15 240)' }}>≡</span>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'oklch(0.20 0.02 260)' }}>{selectedSop.name}</div>
                  <div style={{ fontSize: 11, color: 'oklch(0.55 0.02 260)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {selectedSop.category} · Owned by {currentUserName} · Updated {formatDate(selectedSop.updated_at)}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedSop(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'oklch(0.5 0.02 260)', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: '16px 20px', borderRadius: 8, background: 'oklch(0.97 0.01 260)', border: '1px solid oklch(0.91 0.01 260)', fontSize: 13, color: 'oklch(0.30 0.02 260)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 360, overflowY: 'auto' }}>
              {selectedSop.body}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              {isOwner && (
                <>
                  <button onClick={() => openEditSop(selectedSop)}
                    style={{ padding: '8px 18px', borderRadius: 8, background: '#fff', border: '1px solid oklch(0.85 0.01 260)', color: 'oklch(0.35 0.02 260)', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>
                    Edit SOP
                  </button>
                  <button onClick={() => { if (confirm('Delete this SOP?')) deleteSop(selectedSop.id); }}
                    style={{ padding: '8px 18px', borderRadius: 8, background: '#fff', border: '1px solid oklch(0.85 0.05 15)', color: 'oklch(0.45 0.18 15)', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>
                    Delete
                  </button>
                </>
              )}
              <button onClick={() => setSelectedSop(null)}
                style={{ padding: '8px 22px', borderRadius: 8, background: 'oklch(0.55 0.18 240)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ════════════════════ ADD / EDIT FAULT CODE MODAL ════════════ */}
      {(showAddCode || editingCode) && (
        <Modal onClose={resetCodeForm}>
          <div style={{ minWidth: 460, maxWidth: 560 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'oklch(0.20 0.02 260)', marginBottom: 3 }}>
                {editingCode ? 'Edit fault code' : 'Add fault code'}
              </div>
              <div style={{ fontSize: 12, color: 'oklch(0.55 0.02 260)' }}>
                {editingCode ? 'Update the fault code details.' : 'New fault codes appear in the manual immediately — agents will see them on next refresh.'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Code (3 digits)</label>
                <input value={codeForm.code} onChange={e => setCodeForm(p => ({ ...p, code: e.target.value }))}
                  placeholder="e.g. 105" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={codeForm.category} onChange={e => setCodeForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                  {categories.map(c => <option key={c.series} value={c.label}>{c.series} · {c.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Condition (the fault)</label>
              <textarea value={codeForm.condition_text} onChange={e => setCodeForm(p => ({ ...p, condition_text: e.target.value }))}
                placeholder="e.g. Putty cures unevenly in cold rooms." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Agent action (repair summary)</label>
              <textarea value={codeForm.agent_action} onChange={e => setCodeForm(p => ({ ...p, agent_action: e.target.value }))}
                placeholder="What should the agent do right now?" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Agent steps (one per line)</label>
              <textarea value={codeForm.agent_steps_raw} onChange={e => setCodeForm(p => ({ ...p, agent_steps_raw: e.target.value }))}
                placeholder="Step 1&#10;Step 2&#10;Step 3" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Linked SOP (optional)</label>
                <select value={codeForm.linked_sop_id} onChange={e => setCodeForm(p => ({ ...p, linked_sop_id: e.target.value }))} style={inputStyle}>
                  <option value="">— None —</option>
                  {sops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Escalation</label>
                <select value={codeForm.escalation_type} onChange={e => setCodeForm(p => ({ ...p, escalation_type: e.target.value as any }))} style={inputStyle}>
                  {ESCALATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {codeForm.escalation_type === 'conditional' && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Escalation condition</label>
                <input value={codeForm.escalation_condition} onChange={e => setCodeForm(p => ({ ...p, escalation_condition: e.target.value }))}
                  placeholder="e.g. If agent is 50/50 on safety." style={inputStyle} />
              </div>
            )}

            {err && <div style={{ marginBottom: 12, fontSize: 12, color: 'oklch(0.50 0.22 15)', padding: '8px 12px', background: 'oklch(0.97 0.04 15)', borderRadius: 6 }}>{err}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
              <button onClick={resetCodeForm} style={{ padding: '8px 18px', borderRadius: 8, background: '#fff', border: '1px solid oklch(0.85 0.01 260)', color: 'oklch(0.35 0.02 260)', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>Cancel</button>
              <button onClick={saveCode} disabled={saving}
                style={{ padding: '8px 20px', borderRadius: 8, background: 'oklch(0.55 0.18 240)', color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editingCode ? 'Save changes' : 'Add code'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ════════════════════ ADD CATEGORY MODAL ════════════════════ */}
      {showAddCategory && (
        <Modal onClose={() => setShowAddCategory(false)}>
          <div style={{ minWidth: 380, maxWidth: 460 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'oklch(0.20 0.02 260)', marginBottom: 3 }}>Add category</div>
              <div style={{ fontSize: 12, color: 'oklch(0.55 0.02 260)' }}>
                A new series will appear in the fault codes list. Codes in that range (e.g. 400–499) will group automatically.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px 16px', marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Series number</label>
                <input
                  type="number" step={100} min={100}
                  value={catForm.series}
                  onChange={e => setCatForm(p => ({ ...p, series: e.target.value }))}
                  placeholder="400" style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Category label</label>
                <input
                  value={catForm.label}
                  onChange={e => setCatForm(p => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. Quality / Lab" style={inputStyle}
                />
              </div>
            </div>

            {catErr && <div style={{ marginBottom: 12, fontSize: 12, color: 'oklch(0.50 0.22 15)', padding: '8px 12px', background: 'oklch(0.97 0.04 15)', borderRadius: 6 }}>{catErr}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
              <button onClick={() => setShowAddCategory(false)}
                style={{ padding: '8px 18px', borderRadius: 8, background: '#fff', border: '1px solid oklch(0.85 0.01 260)', color: 'oklch(0.35 0.02 260)', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={saveCategory} disabled={savingCat}
                style={{ padding: '8px 20px', borderRadius: 8, background: 'oklch(0.55 0.18 240)', color: '#fff', border: 'none', cursor: savingCat ? 'wait' : 'pointer', fontWeight: 600, fontSize: 13, opacity: savingCat ? 0.7 : 1 }}>
                {savingCat ? 'Saving…' : 'Add category'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ════════════════════ ADD / EDIT SOP MODAL ═══════════════════ */}
      {(showAddSop || editingSop) && (
        <Modal onClose={resetSopForm}>
          <div style={{ minWidth: 460, maxWidth: 560 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'oklch(0.20 0.02 260)', marginBottom: 3 }}>
                {editingSop ? 'Edit SOP' : 'Add SOP'}
              </div>
              <div style={{ fontSize: 12, color: 'oklch(0.55 0.02 260)' }}>Standard Operating Procedures are visible to all agents.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>SOP name</label>
                <input value={sopForm.name} onChange={e => setSopForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Fridge Trick" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={sopForm.category} onChange={e => setSopForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                  {SOP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Body</label>
              <textarea value={sopForm.body} onChange={e => setSopForm(p => ({ ...p, body: e.target.value }))}
                rows={10} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }} />
            </div>

            {err && <div style={{ marginBottom: 12, fontSize: 12, color: 'oklch(0.50 0.22 15)', padding: '8px 12px', background: 'oklch(0.97 0.04 15)', borderRadius: 6 }}>{err}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={resetSopForm} style={{ padding: '8px 18px', borderRadius: 8, background: '#fff', border: '1px solid oklch(0.85 0.01 260)', color: 'oklch(0.35 0.02 260)', cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>Cancel</button>
              <button onClick={saveSop} disabled={saving}
                style={{ padding: '8px 20px', borderRadius: 8, background: 'oklch(0.55 0.18 240)', color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editingSop ? 'Save changes' : 'Add SOP'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Shared styles ─────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: 0.8, color: 'oklch(0.50 0.02 260)', marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid oklch(0.87 0.01 260)',
  fontSize: 13, color: 'oklch(0.25 0.02 260)', outline: 'none', background: '#fff',
  boxSizing: 'border-box',
};

/* ── Modal wrapper ─────────────────────────────────────────────────── */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px oklch(0 0 0 / 0.25)', padding: '24px 26px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}
