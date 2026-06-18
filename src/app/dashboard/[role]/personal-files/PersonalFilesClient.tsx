'use client';

import { useState, useRef } from 'react';
import { dbOp } from '@/utils/db';
import { createClient } from '@/utils/supabase/client';

const BUCKET = 'employee-docs';
const HUES = [268, 75, 155, 25, 290, 200, 50, 320];

const COMMENDATION_WEIGHTS = [
  { weight: 1, label: 'Nice to note', display: '+1' },
  { weight: 2, label: 'Solid win',    display: '+2' },
  { weight: 4, label: 'Standout',     display: '+4' },
];

const INCIDENT_WEIGHTS = [
  { weight: -1, label: 'Minor',    display: '-1' },
  { weight: -3, label: 'Serious',  display: '-3' },
  { weight: -5, label: 'Critical', display: '-5' },
];

function getWeightLabel(weight: number) {
  return (
    COMMENDATION_WEIGHTS.find(w => w.weight === weight)?.label ??
    INCIDENT_WEIGHTS.find(w => w.weight === weight)?.label ??
    '—'
  );
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase();
  const hue = HUES[(name.charCodeAt(0) ?? 0) % HUES.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))`,
      color: 'white', fontWeight: 700, fontSize: Math.round(size * 0.38),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {initials}
    </div>
  );
}

function StandingChip({ score, large }: { score: number; large?: boolean }) {
  const pos = score >= 0;
  return (
    <span style={{
      background: pos ? 'oklch(0.93 0.05 145)' : 'oklch(0.92 0.06 25)',
      color: pos ? 'oklch(0.36 0.15 145)' : 'oklch(0.40 0.20 25)',
      border: `1px solid ${pos ? 'oklch(0.82 0.10 145)' : 'oklch(0.82 0.12 25)'}`,
      fontWeight: 800, borderRadius: 20,
      fontFamily: 'var(--mono)',
      fontSize: large ? 22 : 11,
      padding: large ? '4px 16px' : '1px 8px',
      display: 'inline-block',
    }}>
      {score > 0 ? '+' : ''}{score}
    </span>
  );
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

type Screenshot = { url: string; label: string; is_placeholder: boolean };

export default function PersonalFilesClient({
  employees,
  initialEntries,
  currentUserId,
  currentUserName,
}: {
  employees: any[];
  initialEntries: any[];
  currentUserId: string;
  currentUserName: string;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [entries, setEntries] = useState(initialEntries);
  const [selected, setSelected] = useState<any>(null);
  const [entryTab, setEntryTab] = useState<'all' | 'commendation' | 'incident'>('all');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'commendation' | 'incident'>('commendation');
  const [formDate, setFormDate] = useState(todayStr());
  const [formWeight, setFormWeight] = useState(2);
  const [formHeadline, setFormHeadline] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formScreenshots, setFormScreenshots] = useState<Screenshot[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState('');

  // Derived per-employee data
  const empEntries = (empId: string) => entries.filter(e => e.employee_id === empId);
  const empStanding = (empId: string) => empEntries(empId).reduce((s, e) => s + e.weight, 0);
  const empLastDate = (empId: string) => {
    const sorted = [...empEntries(empId)].sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.date ?? null;
  };

  // Global stats
  const filesOnRecord      = employees.filter(e => empEntries(e.id).length > 0).length;
  const totalCommendations = entries.filter(e => e.type === 'commendation').length;
  const totalIncidents     = entries.filter(e => e.type === 'incident').length;
  const belowLine          = employees.filter(e => empStanding(e.id) < 0).length;

  const filteredEmps = employees.filter(e =>
    !empSearch || e.name.toLowerCase().includes(empSearch.toLowerCase())
  );

  const visibleEntries = selected
    ? empEntries(selected.id)
        .filter(e => entryTab === 'all' || e.type === entryTab)
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    : [];

  function openAdd(type: 'commendation' | 'incident') {
    setFormType(type);
    setFormDate(todayStr());
    setFormWeight(type === 'commendation' ? 2 : -1);
    setFormHeadline('');
    setFormBody('');
    setFormScreenshots([]);
    setShowForm(true);
  }

  function switchFormType(type: 'commendation' | 'incident') {
    setFormType(type);
    setFormWeight(type === 'commendation' ? 2 : -1);
  }

  async function handleSave() {
    if (!selected || !formHeadline.trim()) return;
    setSaving(true);
    const { data } = await dbOp('personal_file_entries', 'insert', {
      employee_id: selected.id,
      type: formType,
      date: formDate,
      weight: formWeight,
      headline: formHeadline.trim(),
      body: formBody.trim(),
      logged_by: currentUserId,
      screenshots: formScreenshots,
    });
    if (data?.[0]) {
      setEntries(prev => [data[0], ...prev]);
      setShowForm(false);
    }
    setSaving(false);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `personal-files/${selected.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setFormScreenshots(prev => [...prev, { url: publicUrl, label: file.name, is_placeholder: false }]);
    }
    setUploading(false);
    e.target.value = '';
  }

  function exportCSV() {
    const nameMap = Object.fromEntries(employees.map((e: any) => [e.id, e.name]));
    const rows = [
      ['Employee', 'Type', 'Date', 'Weight', 'Headline', 'Body', 'Logged By'],
      ...entries.map(e => [
        nameMap[e.employee_id] ?? '—',
        e.type,
        e.date,
        e.weight,
        e.headline,
        e.body,
        nameMap[e.logged_by] ?? currentUserName,
      ]),
    ];
    const csv = rows.map(r => r.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `personal-files-${todayStr()}.csv`;
    a.click();
  }

  const isComm = formType === 'commendation';
  const formAccent = isComm ? 'oklch(0.44 0.14 155)' : 'oklch(0.50 0.20 25)';
  const formBtnBg  = isComm ? 'oklch(0.50 0.15 155)' : 'oklch(0.52 0.20 25)';
  const formSelBg  = isComm ? 'oklch(0.92 0.07 155)' : 'oklch(0.92 0.08 25)';
  const formSelBorder = isComm ? 'oklch(0.75 0.12 155)' : 'oklch(0.75 0.14 25)';

  return (
    <div className="page-fade">
      <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept="image/*" style={{ display: 'none' }} />

      {/* Lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'oklch(0.05 0 0 / 0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightboxUrl} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: 'var(--sh-pop)' }} />
        </div>
      )}

      {/* Briefing strip */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 20px', background: 'linear-gradient(135deg, oklch(0.985 0.01 268), oklch(0.975 0.015 220))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="bdg bdg-acc" style={{ fontSize: 10, letterSpacing: '0.06em' }}>PERSONAL FILES · CONFIDENTIAL</span>
          <span style={{ marginLeft: 'auto' }} />
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 7, background: 'oklch(0.92 0.06 25)', color: 'oklch(0.40 0.20 25)', border: '1px solid oklch(0.82 0.12 25)' }}>
            🔒 ADMINS & OWNERS ONLY
          </span>
          <button onClick={exportCSV} className="btn btn-sec btn-sm" style={{ fontSize: 12 }}>Export file</button>
        </div>
        <div style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.75 }}>
          Per-employee record of{' '}
          <strong style={{ color: 'var(--accent)' }}>commendations</strong> and{' '}
          <strong style={{ color: 'oklch(0.45 0.20 25)' }}>incidents</strong>
          {' '}— each entry dated, attributed, and backed by screenshots.{' '}
          Tracking{' '}
          <strong style={{ color: 'var(--accent)' }}>{filesOnRecord} of {employees.length} employee{employees.length !== 1 ? 's' : ''}</strong>
          {' · '}
          <strong style={{ color: 'oklch(0.42 0.12 155)' }}>{totalCommendations} commendation{totalCommendations !== 1 ? 's' : ''}</strong>
          {' · '}
          <strong style={{ color: 'oklch(0.45 0.20 25)' }}>{totalIncidents} incident{totalIncidents !== 1 ? 's' : ''}</strong>
          {' · '}
          <strong style={{ color: belowLine > 0 ? 'oklch(0.45 0.20 25)' : 'oklch(0.42 0.12 155)' }}>{belowLine} below the line</strong>.
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'FILES ON RECORD', value: filesOnRecord,      sub: `of ${employees.length} employees`,  cls: '' },
          { label: 'COMMENDATIONS',   value: totalCommendations, sub: 'good things logged',                cls: 'gn' },
          { label: 'INCIDENTS',       value: totalIncidents,     sub: 'issues on file',                   cls: 'rd' },
          { label: 'BELOW THE LINE',  value: belowLine,          sub: 'net-negative standing',            cls: belowLine > 0 ? 'rd' : 'gn' },
          { label: 'ENTRIES TOTAL',   value: entries.length,     sub: 'across all files',                 cls: '' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--sh-1)' }}>
            <div className="s-l">{stat.label}</div>
            <div className={`s-v${stat.cls ? ' ' + stat.cls : ''}`} style={{ fontSize: 28 }}>{stat.value}</div>
            <div className="s-s">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>

        {/* Left: employee list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>Employee files</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 10, lineHeight: 1.5 }}>
              Pick a person to read or add to their confidential file · every entry is dated and attributed
            </div>
            <input
              placeholder="Search employees..."
              value={empSearch}
              onChange={e => setEmpSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, background: 'var(--surface-3)', outline: 'none', color: 'var(--ink)' }}
            />
          </div>
          <div style={{ padding: '10px', maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
            {filteredEmps.map(emp => {
              const ents      = empEntries(emp.id);
              const score     = empStanding(emp.id);
              const commCount = ents.filter(e => e.type === 'commendation').length;
              const incCount  = ents.filter(e => e.type === 'incident').length;
              const last      = empLastDate(emp.id);
              const isSel     = selected?.id === emp.id;
              return (
                <div key={emp.id}
                  onClick={() => { setSelected(emp); setShowForm(false); setEntryTab('all'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '11px 10px', borderRadius: 10,
                    cursor: 'pointer', marginBottom: 6,
                    background: isSel ? 'var(--accent-soft)' : 'white',
                    border: `1px solid ${isSel ? 'var(--accent-line)' : 'var(--line)'}`,
                    boxShadow: 'var(--sh-1)', transition: 'all .13s',
                  }}>
                  <Avatar name={emp.name} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 2 }}>{emp.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 7, textTransform: 'capitalize' }}>
                      {emp.role}{emp.department ? ` · ${emp.department}` : ''}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {commCount > 0 && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: 'oklch(0.93 0.05 145)', color: 'oklch(0.36 0.15 145)', border: '1px solid oklch(0.82 0.10 145)' }}>
                          +{commCount}
                        </span>
                      )}
                      {incCount > 0 && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: 'oklch(0.92 0.06 25)', color: 'oklch(0.40 0.20 25)', border: '1px solid oklch(0.82 0.12 25)' }}>
                          !{incCount}
                        </span>
                      )}
                      {!commCount && !incCount && (
                        <span style={{ fontSize: 10, color: 'var(--ink-5)' }}>no entries yet</span>
                      )}
                      {last && <span style={{ fontSize: 10, color: 'var(--ink-5)', marginLeft: 'auto' }}>last · {last}</span>}
                    </div>
                  </div>
                  {ents.length > 0 && <StandingChip score={score} />}
                </div>
              );
            })}
            {filteredEmps.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No employees found</div>
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        {selected ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Employee header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar name={selected.name} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.012em', lineHeight: 1.2 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3, textTransform: 'capitalize' }}>
                  {selected.role}{selected.department ? ` · ${selected.department}` : ''}{' '}
                  · {empEntries(selected.id).length} entr{empEntries(selected.id).length !== 1 ? 'ies' : 'y'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-4)', marginBottom: 5 }}>STANDING</div>
                <StandingChip score={empStanding(selected.id)} large />
              </div>
            </div>

            {/* Tabs + action buttons */}
            <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface-3)', borderRadius: 8, border: '1px solid var(--line)' }}>
                {(['all', 'commendation', 'incident'] as const).map(tab => (
                  <button key={tab} onClick={() => setEntryTab(tab)}
                    style={{
                      padding: '5px 13px', borderRadius: 6, fontSize: 12.5, fontWeight: 500,
                      border: 'none', cursor: 'pointer',
                      background: entryTab === tab ? 'white' : 'transparent',
                      color: entryTab === tab ? 'var(--ink)' : 'var(--ink-3)',
                      boxShadow: entryTab === tab ? 'var(--sh-1)' : 'none',
                      transition: 'all .12s',
                    }}>
                    {tab === 'all' ? 'All' : tab === 'commendation' ? 'Commendations' : 'Incidents'}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--mono)' }}>{visibleEntries.length} shown</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => openAdd('commendation')}
                  style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--accent)', color: 'white', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px oklch(0.5 0.18 268 / .20)', transition: 'all .14s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = '')}>
                  + Add commendation
                </button>
                <button onClick={() => openAdd('incident')}
                  style={{ padding: '7px 14px', borderRadius: 8, background: 'white', color: 'oklch(0.45 0.20 25)', border: '1.5px solid oklch(0.82 0.12 25)', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all .14s' }}
                  onMouseEnter={e => { (e.currentTarget.style.background = 'oklch(0.97 0.03 25)'); }}
                  onMouseLeave={e => { (e.currentTarget.style.background = 'white'); }}>
                  ! Log incident
                </button>
              </div>
            </div>

            {/* Add entry form */}
            {showForm && (
              <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--line)', background: isComm ? 'oklch(0.975 0.012 155)' : 'oklch(0.975 0.012 25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
                    NEW ENTRY · {selected.name.split(' ')[0].toUpperCase()}'S FILE
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-5)' }}>{formDate}</div>
                </div>

                {/* Type toggle */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-4)', marginBottom: 8 }}>TYPE</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['commendation', 'incident'] as const).map(t => {
                      const active = formType === t;
                      const tIsComm = t === 'commendation';
                      return (
                        <button key={t} onClick={() => switchFormType(t)}
                          style={{
                            padding: '8px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                            border: `1.5px solid ${active ? (tIsComm ? 'oklch(0.60 0.14 155)' : 'oklch(0.60 0.20 25)') : 'var(--line)'}`,
                            background: active ? (tIsComm ? 'oklch(0.93 0.07 155)' : 'oklch(0.93 0.08 25)') : 'white',
                            color: active ? (tIsComm ? 'oklch(0.30 0.15 155)' : 'oklch(0.32 0.20 25)') : 'var(--ink-4)',
                            display: 'flex', alignItems: 'center', gap: 7, transition: 'all .12s',
                          }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: active ? (tIsComm ? 'oklch(0.44 0.15 155)' : 'oklch(0.52 0.22 25)') : 'var(--ink-5)' }} />
                          {t === 'commendation' ? 'Commendation' : 'Incident'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date + weight */}
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-4)', marginBottom: 8 }}>DATE</div>
                    <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, background: 'white', outline: 'none', color: 'var(--ink)' }} />
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-4)', marginBottom: 8 }}>
                      {isComm ? 'HOW NOTABLE' : 'HOW SERIOUS'}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(isComm ? COMMENDATION_WEIGHTS : INCIDENT_WEIGHTS).map(w => {
                        const active = formWeight === w.weight;
                        return (
                          <button key={w.weight} onClick={() => setFormWeight(w.weight)}
                            style={{
                              flex: 1, padding: '7px 6px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', textAlign: 'center', lineHeight: 1.3,
                              border: `1.5px solid ${active ? formSelBorder : 'var(--line)'}`,
                              background: active ? formSelBg : 'white',
                              color: active ? formAccent : 'var(--ink-4)',
                              transition: 'all .12s',
                            }}>
                            {w.label}<br />
                            <span style={{ fontSize: 10, fontWeight: 800 }}>{w.display}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Headline */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-4)', marginBottom: 8 }}>HEADLINE</div>
                  <input
                    placeholder={isComm ? 'e.g. Saved a chargeback / Covered a shift' : 'e.g. Late clock-in / Missed handoff'}
                    value={formHeadline}
                    onChange={e => setFormHeadline(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, background: 'white', outline: 'none', color: 'var(--ink)' }}
                  />
                </div>

                {/* What happened */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-4)', marginBottom: 8 }}>WHAT HAPPENED</div>
                  <textarea
                    placeholder="Context, dates, who was involved, what was decided..."
                    value={formBody}
                    onChange={e => setFormBody(e.target.value)}
                    rows={4}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, background: 'white', outline: 'none', color: 'var(--ink)', resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }}
                  />
                </div>

                {/* Screenshots */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--ink-4)', marginBottom: 8 }}>SCREENSHOTS / EVIDENCE</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'white', color: 'var(--ink-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      ↑ Upload image
                    </button>
                    <button onClick={() => setFormScreenshots(prev => [...prev, { url: '', label: `Screenshot ${prev.length + 1}`, is_placeholder: true }])}
                      style={{ padding: '6px 12px', borderRadius: 7, border: '1.5px dashed var(--line)', background: 'transparent', color: 'var(--ink-4)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      + Attach placeholder
                    </button>
                    {uploading && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>Uploading…</span>}
                  </div>
                  {formScreenshots.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {formScreenshots.map((ss, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          {ss.is_placeholder ? (
                            <div style={{ width: 100, height: 68, borderRadius: 8, border: '2px dashed var(--line)', background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                              <span style={{ fontSize: 20, opacity: 0.25 }}>🖼</span>
                              <span style={{ fontSize: 9, color: 'var(--ink-5)', textAlign: 'center', padding: '0 4px' }}>{ss.label}</span>
                            </div>
                          ) : (
                            <img src={ss.url} alt={ss.label}
                              style={{ width: 100, height: 68, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', cursor: 'zoom-in', display: 'block' }}
                              onClick={() => setLightboxUrl(ss.url)}
                            />
                          )}
                          <button onClick={() => setFormScreenshots(prev => prev.filter((_, j) => j !== i))}
                            style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'oklch(0.52 0.20 25)', color: 'white', border: 'none', fontSize: 9, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSave} disabled={saving || !formHeadline.trim()}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                      cursor: saving || !formHeadline.trim() ? 'not-allowed' : 'pointer',
                      background: formBtnBg, color: 'white', border: 'none',
                      opacity: saving || !formHeadline.trim() ? 0.6 : 1,
                      transition: 'opacity .14s',
                    }}>
                    {saving ? 'Saving…' : '+ Add to file'}
                  </button>
                  <button onClick={() => setShowForm(false)}
                    style={{ padding: '9px 18px', borderRadius: 8, background: 'white', border: '1px solid var(--line)', color: 'var(--ink-3)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Entry list */}
            <div style={{ padding: '16px 20px' }}>
              {visibleEntries.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                  {entryTab === 'all'
                    ? 'No entries on file yet. Add the first commendation or incident above.'
                    : `No ${entryTab}s on file.`}
                </div>
              ) : visibleEntries.map((entry: any) => {
                const isC = entry.type === 'commendation';
                const accent = isC ? 'oklch(0.42 0.12 155)' : 'oklch(0.45 0.20 25)';
                const softBg = isC ? 'oklch(0.93 0.05 145)' : 'oklch(0.92 0.06 25)';
                const border  = isC ? 'oklch(0.82 0.10 145)' : 'oklch(0.82 0.12 25)';
                const shots: Screenshot[] = entry.screenshots ?? [];
                return (
                  <div key={entry.id} style={{
                    padding: '14px 16px', borderRadius: 10, marginBottom: 10,
                    border: '1px solid var(--line)', background: 'var(--surface)',
                    borderLeft: `3px solid ${accent}`, boxShadow: 'var(--sh-1)',
                  }}>
                    {/* Entry meta row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', padding: '2px 9px', borderRadius: 20, background: softBg, color: accent, border: `1px solid ${border}` }}>
                        {isC ? 'COMMENDATION' : 'INCIDENT'}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 9px', borderRadius: 20, background: 'var(--surface-3)', color: 'var(--ink-4)', border: '1px solid var(--line)' }}>
                        {getWeightLabel(entry.weight).toUpperCase()} · {entry.weight > 0 ? '+' : ''}{entry.weight}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                        {fmtDate(entry.date)}
                      </span>
                    </div>
                    {/* Headline */}
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35, marginBottom: entry.body ? 6 : 0 }}>
                      {entry.headline}
                    </div>
                    {/* Body */}
                    {entry.body && (
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65 }}>
                        {entry.body}
                      </div>
                    )}
                    {/* Screenshots */}
                    {shots.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        {shots.map((ss, si) => (
                          <div key={si} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                            {ss.is_placeholder ? (
                              <div style={{ width: 128, height: 84, background: 'var(--surface-3)', border: '2px dashed var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <span style={{ fontSize: 24, opacity: 0.2 }}>🖼</span>
                                <span style={{ fontSize: 9, color: 'var(--ink-5)', textAlign: 'center', padding: '0 6px' }}>{ss.label}</span>
                              </div>
                            ) : (
                              <img src={ss.url} alt={ss.label}
                                style={{ width: 128, height: 84, objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
                                onClick={() => setLightboxUrl(ss.url)}
                              />
                            )}
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'oklch(0.08 0 0 / 0.55)', backdropFilter: 'blur(2px)' }}>
                              <div style={{ fontSize: 8.5, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ss.label}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 420, padding: 40, gap: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 44, opacity: 0.22 }}>🗂</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-3)' }}>Select an employee</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', maxWidth: 300, lineHeight: 1.6 }}>
              Click any employee on the left to view or add to their confidential file.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
