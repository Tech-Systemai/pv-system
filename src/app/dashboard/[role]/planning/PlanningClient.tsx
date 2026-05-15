'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/* ── Types ─────────────────────────────────────────────────── */
type ToolId    = 'select' | 'pan' | 'sticky' | 'note' | 'text' | 'pen' | 'file' | 'checklist';
type TextSize  = 'sm' | 'md' | 'lg' | 'xl';
type PhaseStatus = 'planned' | 'active' | 'done';

interface WBase      { id: string; x: number; y: number; w: number; h: number; }
interface StickyW    extends WBase { type: 'sticky';    text: string; bg: string; }
interface NoteW      extends WBase { type: 'note';      title: string; body: string; }
interface TextW      extends WBase { type: 'text';      content: string; size: TextSize; }
interface FileW      extends WBase { type: 'file';      name: string; ext: string; }
interface ChecklistW extends WBase { type: 'checklist'; title: string; items: { text: string; done: boolean }[]; }
type Widget = StickyW | NoteW | TextW | FileW | ChecklistW;

interface Stroke { id: string; pts: [number, number][]; color: string; w: number; }
interface Phase  { id: string; title: string; startM: number; endM: number; status: PhaseStatus; note: string; }

interface Board {
  id: string; title: string; desc: string; areaId: string;
  shared: boolean; created: string;
  widgets: Widget[]; strokes: Stroke[]; phases: Phase[];
}
interface XF { x: number; y: number; s: number; }

/* ── Constants ─────────────────────────────────────────────── */
const AREAS = [
  { id: 'marketing',  label: 'Marketing',    hue: 268, g: '📣' },
  { id: 'business',   label: 'Business Dev', hue: 25,  g: '🤝' },
  { id: 'financial',  label: 'Financial',    hue: 145, g: '📊' },
  { id: 'website',    label: 'Website',      hue: 200, g: '🌐' },
  { id: 'cx',         label: 'CX',           hue: 75,  g: '⭐' },
  { id: 'sales',      label: 'Sales',        hue: 155, g: '💰' },
  { id: 'operations', label: 'Operations',   hue: 220, g: '⚙️' },
  { id: 'hr',         label: 'HR',           hue: 340, g: '👥' },
];

const TOOLS: { id: ToolId; icon: string; label: string }[] = [
  { id: 'select',    icon: '↖',  label: 'Select  V' },
  { id: 'pan',       icon: '✋', label: 'Pan  H' },
  { id: 'sticky',    icon: '🟡', label: 'Sticky Note  S' },
  { id: 'note',      icon: '📄', label: 'Note Card  N' },
  { id: 'text',      icon: 'T',  label: 'Text  T' },
  { id: 'checklist', icon: '☑',  label: 'Goal & Checklist  C' },
  { id: 'pen',       icon: '✏',  label: 'Pen  P' },
  { id: 'file',      icon: '📁', label: 'File  F' },
];

const STICKY_PAL = [
  { bg: '#fef08a', text: '#78350f' }, { bg: '#fecdd3', text: '#881337' },
  { bg: '#bfdbfe', text: '#1e3a5f' }, { bg: '#bbf7d0', text: '#14532d' },
  { bg: '#e9d5ff', text: '#4c1d95' }, { bg: '#fed7aa', text: '#7c2d12' },
  { bg: '#ffffff', text: '#1a1f2e' },
];

const PEN_COLORS = ['#1a1f2e','#ef4444','#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ec4899'];
const PEN_WIDTHS = [1, 2, 4, 7];

const FILE_ICONS: Record<string, string> = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
  ppt: '📙', pptx: '📙', zip: '📦', txt: '📝', csv: '📊',
  png: '🖼', jpg: '🖼', jpeg: '🖼', mp4: '🎬',
};

const TEXT_SIZES: Record<TextSize, { px: number; label: string }> = {
  sm: { px: 12, label: 'S' }, md: { px: 16, label: 'M' },
  lg: { px: 24, label: 'L' }, xl: { px: 36, label: 'XL' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_CFG: Record<PhaseStatus, { label: string; cls: string; bar: string }> = {
  planned: { label: 'Planned', cls: 'bdg-gy',   bar: 'oklch(0.76 0.06 220)' },
  active:  { label: 'Active',  cls: 'bdg-warn',  bar: 'var(--warn)' },
  done:    { label: 'Done',    cls: 'bdg-ok',    bar: 'var(--ok)' },
};

/* ── Helpers ───────────────────────────────────────────────── */
function uid() { return Math.random().toString(36).slice(2, 10); }
function makePath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}
function makeBoard(title: string, areaId: string, desc = ''): Board {
  return { id: uid(), title, desc, areaId, shared: false, created: new Date().toISOString(), widgets: [], strokes: [], phases: [] };
}

/* ── Seed ──────────────────────────────────────────────────── */
const SEED: Board[] = [
  {
    id: 'b1', title: 'Q3 Marketing Plan', desc: 'Campaigns, content, and growth for Q3',
    areaId: 'marketing', shared: true, created: new Date().toISOString(), strokes: [],
    phases: [
      { id: 'p1', title: 'Research & Planning', startM: 0, endM: 1, status: 'done',    note: 'Audience research and strategy finalised' },
      { id: 'p2', title: 'Campaign Launch',     startM: 2, endM: 4, status: 'active',  note: 'Email + paid ads running' },
      { id: 'p3', title: 'Optimisation',        startM: 5, endM: 7, status: 'planned', note: 'Iterate on results' },
      { id: 'p4', title: 'Q3 Review',           startM: 8, endM: 9, status: 'planned', note: 'Full performance review' },
    ],
    widgets: [
      { id: 'w1', type: 'sticky',    x: 60,  y: 60,  w: 180, h: 180, text: '🚀 Launch email campaign\nTarget dormant leads 60+ days', bg: '#fef08a' },
      { id: 'w2', type: 'sticky',    x: 270, y: 60,  w: 180, h: 180, text: '📊 A/B test ad creatives\nFB + Google, 2 variants', bg: '#bfdbfe' },
      { id: 'w3', type: 'sticky',    x: 480, y: 60,  w: 180, h: 180, text: '✍️ Blog: Industry trends\n1500 words, SEO', bg: '#bbf7d0' },
      { id: 'w4', type: 'note',      x: 60,  y: 280, w: 240, h: 170, title: 'Q3 Goals', body: '• Pipeline to $500k\n• CAC below $40\n• 3 new partnerships\n• 12 content pieces' },
      { id: 'w5', type: 'text',      x: 340, y: 295, w: 300, h: 55,  content: '🎯 Top 20% of channels drive 80% of leads', size: 'md' },
      { id: 'w6', type: 'checklist', x: 680, y: 60,  w: 210, h: 260, title: 'Launch Checklist', items: [
        { text: 'Write email copy', done: true },
        { text: 'Design ad creatives', done: true },
        { text: 'Set up automations', done: false },
        { text: 'Launch paid campaigns', done: false },
        { text: 'Monitor day-1 metrics', done: false },
      ]},
      { id: 'w7', type: 'file',      x: 680, y: 360, w: 200, h: 80,  name: 'Q2_Report.pdf', ext: 'pdf' },
    ],
  },
  {
    id: 'b2', title: 'Sales Pipeline Q3', desc: 'Deals, outreach, and targets',
    areaId: 'sales', shared: false, created: new Date().toISOString(), strokes: [],
    phases: [
      { id: 'p5', title: 'Pipeline Build',  startM: 0, endM: 2, status: 'done',    note: 'ICP definition and prospecting list' },
      { id: 'p6', title: 'Active Outreach', startM: 3, endM: 5, status: 'active',  note: 'Cold outreach and demos running' },
      { id: 'p7', title: 'Close & Expand',  startM: 6, endM: 9, status: 'planned', note: 'Target 4 enterprise closes' },
    ],
    widgets: [
      { id: 'w8',  type: 'sticky',    x: 60,  y: 60,  w: 180, h: 180, text: '🤝 Acme Corp proposal\nDeadline: July 12', bg: '#fed7aa' },
      { id: 'w9',  type: 'sticky',    x: 270, y: 60,  w: 180, h: 180, text: '📞 20 new prospects\nThis week — URGENT', bg: '#fecdd3' },
      { id: 'w10', type: 'note',      x: 60,  y: 280, w: 240, h: 160, title: 'Targets', body: '• MRR: $500k by EOQ\n• Deal cycle: ≤ 45 days\n• Win rate: 35%' },
      { id: 'w11', type: 'checklist', x: 340, y: 60,  w: 210, h: 240, title: 'Acme Corp Deal', items: [
        { text: 'Discovery call done', done: true },
        { text: 'Proposal sent',       done: true },
        { text: 'Technical review',    done: false },
        { text: 'Pricing negotiation', done: false },
        { text: 'Contract signed',     done: false },
      ]},
    ],
  },
];

/* ── Shared delete button ──────────────────────────────────── */
function DelBtn({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      onPointerDown={e => { e.stopPropagation(); onDelete(); }}
      style={{ position: 'absolute', top: -9, right: -9, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', border: '2px solid white', color: 'white', fontSize: 10, cursor: 'pointer', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
    >×</button>
  );
}

/* ── Sticky Note ───────────────────────────────────────────── */
function StickyNote({ w, sel, onPD, onDel, onChange }: {
  w: StickyW; sel: boolean;
  onPD: (e: React.PointerEvent) => void; onDel: () => void; onChange: (t: string) => void;
}) {
  const pal = STICKY_PAL.find(c => c.bg === w.bg) ?? STICKY_PAL[0];
  return (
    <div onPointerDown={onPD} style={{
      position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h,
      background: w.bg, borderRadius: 3, padding: '12px 14px',
      boxShadow: sel ? '0 0 0 2px #4f46e5, 0 6px 20px rgba(0,0,0,0.18)' : '0 3px 10px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.07)',
      cursor: 'grab', display: 'flex', flexDirection: 'column', userSelect: 'none',
    }}>
      {sel && <DelBtn onDelete={onDel} />}
      <textarea key={w.id} defaultValue={w.text}
        onBlur={e => onChange(e.target.value)}
        onPointerDown={e => e.stopPropagation()}
        placeholder="Type here…"
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 13, color: pal.text, lineHeight: 1.6, cursor: 'text', fontFamily: 'inherit', padding: 0, fontWeight: 500 }}
      />
      <div style={{ fontSize: 9, color: pal.text, opacity: 0.35, textAlign: 'right', userSelect: 'none' }}>sticky</div>
    </div>
  );
}

/* ── Note Card ─────────────────────────────────────────────── */
function NoteCard({ w, sel, onPD, onDel, onChange }: {
  w: NoteW; sel: boolean;
  onPD: (e: React.PointerEvent) => void; onDel: () => void; onChange: (p: Partial<NoteW>) => void;
}) {
  return (
    <div onPointerDown={onPD} style={{
      position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h,
      background: 'white', borderRadius: 10,
      border: `${sel ? 2 : 1.5}px solid ${sel ? '#4f46e5' : 'rgba(0,0,0,0.09)'}`,
      boxShadow: '0 4px 14px rgba(0,0,0,0.10)', cursor: 'grab', display: 'flex', flexDirection: 'column', userSelect: 'none', overflow: 'hidden',
    }}>
      {sel && <DelBtn onDelete={onDel} />}
      <div style={{ height: 3, background: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <input key={w.id + 't'} defaultValue={w.title} onBlur={e => onChange({ title: e.target.value })} onPointerDown={e => e.stopPropagation()}
          placeholder="Title…" style={{ fontSize: 13, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', padding: 0, cursor: 'text', width: '100%' }} />
        <textarea key={w.id + 'b'} defaultValue={w.body} onBlur={e => onChange({ body: e.target.value })} onPointerDown={e => e.stopPropagation()}
          placeholder="Notes…" style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink-2)', lineHeight: 1.65, cursor: 'text', fontFamily: 'inherit', padding: 0 }} />
      </div>
    </div>
  );
}

/* ── Text Block ────────────────────────────────────────────── */
function TextBlock({ w, sel, onPD, onDel, onChange }: {
  w: TextW; sel: boolean;
  onPD: (e: React.PointerEvent) => void; onDel: () => void; onChange: (c: string) => void;
}) {
  const fs = TEXT_SIZES[w.size ?? 'md'].px;
  return (
    <div onPointerDown={onPD} style={{
      position: 'absolute', left: w.x, top: w.y, width: w.w, minHeight: w.h,
      outline: sel ? '2px solid #4f46e5' : 'none', borderRadius: 4, padding: 4, cursor: 'grab', userSelect: 'none',
    }}>
      {sel && <DelBtn onDelete={onDel} />}
      <textarea key={w.id} defaultValue={w.content} onBlur={e => onChange(e.target.value)} onPointerDown={e => e.stopPropagation()}
        placeholder="Text…"
        style={{ width: '100%', minHeight: w.h - 8, fontSize: fs, fontWeight: fs >= 22 ? 700 : 600, border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)', lineHeight: 1.35, cursor: 'text', fontFamily: 'inherit', padding: 0 }} />
    </div>
  );
}

/* ── File Card ─────────────────────────────────────────────── */
function FileCard({ w, sel, onPD, onDel }: {
  w: FileW; sel: boolean;
  onPD: (e: React.PointerEvent) => void; onDel: () => void;
}) {
  const icon = FILE_ICONS[w.ext.toLowerCase()] ?? '📄';
  return (
    <div onPointerDown={onPD} style={{
      position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h,
      background: 'white', borderRadius: 10,
      border: `${sel ? 2 : 1.5}px solid ${sel ? '#4f46e5' : 'rgba(0,0,0,0.09)'}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '10px 14px', cursor: 'grab', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {sel && <DelBtn onDelete={onDel} />}
      <span style={{ fontSize: 26, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
        <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{w.ext} file</div>
      </div>
    </div>
  );
}

/* ── Goal & Checklist Widget ───────────────────────────────── */
function ChecklistWidget({ w, sel, onPD, onDel, onChange }: {
  w: ChecklistW; sel: boolean;
  onPD: (e: React.PointerEvent) => void; onDel: () => void; onChange: (p: Partial<ChecklistW>) => void;
}) {
  const [newItem, setNewItem] = useState('');
  const done = w.items.filter(i => i.done).length;
  const total = w.items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const barColor = pct === 100 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'oklch(0.72 0.10 220)';

  return (
    <div onPointerDown={onPD} style={{
      position: 'absolute', left: w.x, top: w.y, width: w.w, minHeight: w.h,
      background: 'white', borderRadius: 10,
      border: `${sel ? 2 : 1.5}px solid ${sel ? '#4f46e5' : 'rgba(0,0,0,0.09)'}`,
      boxShadow: '0 4px 14px rgba(0,0,0,0.10)', cursor: 'grab', userSelect: 'none', overflow: 'hidden',
    }}>
      {sel && <DelBtn onDelete={onDel} />}
      {/* Top accent: progress-filled bar */}
      <div style={{ height: 4, background: 'var(--line)', position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`, background: barColor, transition: 'width 0.3s, background 0.3s' }} />
      </div>

      <div style={{ padding: '10px 14px 12px' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 13 }}>🎯</span>
          <input key={w.id + 't'} defaultValue={w.title} onBlur={e => onChange({ title: e.target.value })} onPointerDown={e => e.stopPropagation()}
            placeholder="Goal title…"
            style={{ flex: 1, fontSize: 13, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', padding: 0, cursor: 'text' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: pct === 100 ? 'var(--ok)' : 'var(--ink-4)', flexShrink: 0 }}>{pct}%</span>
        </div>

        {/* Checklist items */}
        <div data-no-drag style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {w.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '4px 0' }}>
              <input type="checkbox" checked={item.done}
                onChange={() => onChange({ items: w.items.map((it, j) => j === i ? { ...it, done: !it.done } : it) })}
                onPointerDown={e => e.stopPropagation()}
                style={{ flexShrink: 0, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ flex: 1, fontSize: 12, color: item.done ? 'var(--ink-4)' : 'var(--ink)', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.4 }}>{item.text}</span>
              <button onClick={() => onChange({ items: w.items.filter((_, j) => j !== i) })} onPointerDown={e => e.stopPropagation()}
                style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 13, padding: '0 2px', opacity: 0.5, lineHeight: 1 }}>×</button>
            </div>
          ))}

          {/* Add item input */}
          <div style={{ display: 'flex', gap: 5, marginTop: 4 }} onPointerDown={e => e.stopPropagation()}>
            <input value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newItem.trim()) {
                  onChange({ items: [...w.items, { text: newItem.trim(), done: false }] });
                  setNewItem('');
                }
              }}
              placeholder="Add item… Enter"
              style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 5, outline: 'none', background: 'var(--surface-2)', color: 'var(--ink)' }}
            />
          </div>

          {total > 0 && (
            <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 5, textAlign: 'right' }}>{done} / {total} done</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Timeline View ─────────────────────────────────────────── */
function TimelineView({ board, onUpdate }: { board: Board; onUpdate: (fn: (b: Board) => Board) => void }) {
  const curM = new Date().getMonth();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', startM: 0, endM: 2, status: 'planned' as PhaseStatus, note: '' });
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const phases = board.phases ?? [];
  const area = AREAS.find(a => a.id === board.areaId) ?? AREAS[0];

  const openAdd = () => { setEditId(null); setForm({ title: '', startM: curM, endM: Math.min(11, curM + 2), status: 'planned', note: '' }); setShowAdd(true); };
  const openEdit = (p: Phase) => { setEditId(p.id); setForm({ title: p.title, startM: p.startM, endM: p.endM, status: p.status, note: p.note }); setShowAdd(true); };

  const submit = () => {
    if (!form.title.trim()) return;
    if (editId) {
      onUpdate(b => ({ ...b, phases: b.phases.map(p => p.id === editId ? { ...p, ...form } : p) }));
    } else {
      onUpdate(b => ({ ...b, phases: [...(b.phases ?? []), { id: uid(), ...form }] }));
    }
    setShowAdd(false);
    setEditId(null);
  };

  const deletePhase = (id: string) => onUpdate(b => ({ ...b, phases: b.phases.filter(p => p.id !== id) }));
  const updateStatus = (id: string, status: PhaseStatus) => onUpdate(b => ({ ...b, phases: b.phases.map(p => p.id === id ? { ...p, status } : p) }));

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 3 }}>
            📅 Timeline — {board.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
            Map the phases and milestones behind this board's vision.
          </div>
        </div>
        <button className="btn btn-acc btn-sm" onClick={openAdd}>+ Add Phase</button>
      </div>

      {/* Summary row */}
      {phases.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {(['planned', 'active', 'done'] as PhaseStatus[]).map(s => {
            const count = phases.filter(p => p.status === s).length;
            return count > 0 ? <span key={s} className={`bdg ${STATUS_CFG[s].cls}`}>{STATUS_CFG[s].label}: {count}</span> : null;
          })}
        </div>
      )}

      {phases.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '70px 20px', color: 'var(--ink-4)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-2)', marginBottom: 6 }}>No timeline phases yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Define the phases that make up your plan.</div>
          <button className="btn btn-acc" onClick={openAdd}>+ Add First Phase</button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Gantt table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ width: 200, padding: '11px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>Phase</th>
                  {MONTHS.map((m, i) => (
                    <th key={m} style={{ padding: '11px 3px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: i === curM ? 'var(--accent-ink)' : 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--line)', background: i === curM ? 'var(--accent-soft)' : 'transparent', minWidth: 46 }}>
                      {m}
                    </th>
                  ))}
                  <th style={{ width: 110, borderBottom: '1px solid var(--line)' }} />
                </tr>
              </thead>
              <tbody>
                {phases.map((phase, pi) => (
                  <tr key={phase.id} style={{ borderBottom: '1px solid var(--line-2)' }}>
                    <td style={{ padding: '12px 18px', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{phase.title}</div>
                      {phase.note && <div style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.4 }}>{phase.note}</div>}
                    </td>
                    {MONTHS.map((_, mi) => {
                      const inBar = mi >= phase.startM && mi <= phase.endM;
                      const isStart = mi === phase.startM;
                      const isEnd = mi === phase.endM;
                      return (
                        <td key={mi} style={{ padding: '10px 3px', background: mi === curM ? 'var(--accent-soft)' : 'transparent' }}>
                          {inBar && (
                            <div style={{
                              height: 24, background: STATUS_CFG[phase.status].bar,
                              borderRadius: isStart && isEnd ? 6 : isStart ? '6px 0 0 6px' : isEnd ? '0 6px 6px 0' : 0,
                              margin: '0 1px', opacity: 0.85,
                            }} />
                          )}
                        </td>
                      );
                    })}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <select value={phase.status} onChange={e => updateStatus(phase.id, e.target.value as PhaseStatus)}
                          style={{ fontSize: 10, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none', cursor: 'pointer' }}>
                          <option value="planned">Planned</option>
                          <option value="active">Active</option>
                          <option value="done">Done</option>
                        </select>
                        <button onClick={() => openEdit(phase)} style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }} title="Edit">✎</button>
                        <button onClick={() => deletePhase(phase.id)} style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }} title="Delete">×</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit phase modal */}
      {showAdd && mounted && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div style={{ background: 'white', borderRadius: 16, width: 460, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', padding: '26px' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 18, letterSpacing: '-0.01em', paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
              {editId ? 'Edit Phase' : 'Add Phase'}
            </div>
            <div className="pv-fld">
              <label>Phase title</label>
              <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') submit(); }} placeholder="e.g. Campaign Launch" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="pv-fld">
                <label>Start month</label>
                <select value={form.startM} onChange={e => setForm(f => ({ ...f, startM: +e.target.value }))}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>End month</label>
                <select value={form.endM} onChange={e => setForm(f => ({ ...f, endM: +e.target.value }))}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as PhaseStatus }))}>
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
            <div className="pv-fld">
              <label>Note <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
              <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="What happens in this phase?" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submit} className="btn btn-acc" disabled={!form.title.trim()}>{editId ? 'Save Changes' : 'Add Phase'}</button>
              <button onClick={() => setShowAdd(false)} className="btn btn-sec">Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Whiteboard View ───────────────────────────────────────── */
function WhiteboardView({ board, onUpdate, onBack }: {
  board: Board; onUpdate: (fn: (b: Board) => Board) => void; onBack: () => void;
}) {
  const [view, setView] = useState<'board' | 'timeline'>('board');
  const [tool, setTool] = useState<ToolId>('select');
  const [stickyBg, setStickyBg] = useState('#fef08a');
  const [textSize, setTextSize] = useState<TextSize>('md');
  const [penColor, setPenColor] = useState('#1a1f2e');
  const [penWidth, setPenWidth] = useState(2);
  const [xf, setXf] = useState<XF>({ x: 60, y: 60, s: 1 });
  const [selId, setSelId] = useState<string | null>(null);
  const [liveStroke, setLiveStroke] = useState<[number, number][]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const xfRef = useRef(xf);
  useEffect(() => { xfRef.current = xf; }, [xf]);

  const area = AREAS.find(a => a.id === board.areaId) ?? AREAS[0];

  const toCanvas = (sx: number, sy: number): [number, number] => {
    const rect = containerRef.current!.getBoundingClientRect();
    const t = xfRef.current;
    return [(sx - rect.left - t.x) / t.s, (sy - rect.top - t.y) / t.s];
  };

  /* keyboard shortcuts */
  useEffect(() => {
    const MAP: Record<string, ToolId> = { v: 'select', h: 'pan', s: 'sticky', n: 'note', t: 'text', c: 'checklist', p: 'pen', f: 'file' };
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,[contenteditable]')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selId) {
        onUpdate(b => ({ ...b, widgets: b.widgets.filter(w => w.id !== selId) }));
        setSelId(null);
        return;
      }
      if (e.key === 'Escape') { setSelId(null); setTool('select'); return; }
      const t = MAP[e.key.toLowerCase()];
      if (t) { setTool(t); setView('board'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selId, onUpdate]);

  /* wheel zoom */
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setXf(t => {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const ns = Math.min(4, Math.max(0.15, t.s * factor));
      const r = ns / t.s;
      return { x: mx + (t.x - mx) * r, y: my + (t.y - my) * r, s: ns };
    });
  };

  /* canvas pointer down */
  const handleCanvasPD = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 1 || tool === 'pan') {
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      const tx0 = xfRef.current.x, ty0 = xfRef.current.y;
      const mm = (me: PointerEvent) => setXf(t => ({ ...t, x: tx0 + me.clientX - sx, y: ty0 + me.clientY - sy }));
      const mu = () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu); };
      window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu);
      return;
    }
    if (tool === 'select') { setSelId(null); return; }
    if (tool === 'pen') {
      const pt0 = toCanvas(e.clientX, e.clientY);
      const pts: [number, number][] = [pt0];
      setLiveStroke([pt0]);
      const mm = (me: PointerEvent) => { const pt = toCanvas(me.clientX, me.clientY); pts.push(pt); setLiveStroke(prev => [...prev, pt]); };
      const mu = () => {
        if (pts.length > 1) onUpdate(b => ({ ...b, strokes: [...b.strokes, { id: uid(), pts, color: penColor, w: penWidth }] }));
        setLiveStroke([]);
        window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu);
      };
      window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu);
      return;
    }
    const [cx, cy] = toCanvas(e.clientX, e.clientY);
    const id = uid();
    let nw: Widget;
    if (tool === 'sticky')    nw = { id, type: 'sticky',    x: cx - 90,  y: cy - 90,  w: 180, h: 180, text: '', bg: stickyBg };
    else if (tool === 'note') nw = { id, type: 'note',      x: cx - 130, y: cy - 85,  w: 240, h: 170, title: 'Note', body: '' };
    else if (tool === 'text') nw = { id, type: 'text',      x: cx - 110, y: cy - 20,  w: 220, h: 55,  content: 'Text', size: textSize };
    else if (tool === 'checklist') nw = { id, type: 'checklist', x: cx - 105, y: cy - 100, w: 210, h: 200, title: 'Goal', items: [] };
    else nw = { id, type: 'file', x: cx - 100, y: cy - 40, w: 200, h: 80, name: 'Document.pdf', ext: 'pdf' };
    onUpdate(b => ({ ...b, widgets: [...b.widgets, nw] }));
    setSelId(id);
    setTool('select');
  };

  /* drag factory */
  const makeDrag = (wid: string, wx0: number, wy0: number) => (e: React.PointerEvent) => {
    if (tool !== 'select') return;
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    e.stopPropagation();
    setSelId(wid);
    const sx0 = e.clientX, sy0 = e.clientY;
    const mm = (me: PointerEvent) => {
      const s = xfRef.current.s;
      onUpdate(b => ({ ...b, widgets: b.widgets.map(w => w.id === wid ? { ...w, x: wx0 + (me.clientX - sx0) / s, y: wy0 + (me.clientY - sy0) / s } : w) }));
    };
    const mu = () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu); };
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu);
  };

  const delWidget = (id: string) => { onUpdate(b => ({ ...b, widgets: b.widgets.filter(w => w.id !== id) })); setSelId(null); };
  const patchWidget = (id: string, patch: Partial<Widget>) => onUpdate(b => ({ ...b, widgets: b.widgets.map(w => w.id === id ? { ...w, ...patch } as Widget : w) }));
  const cursor = tool === 'pan' ? 'grab' : tool !== 'select' ? 'crosshair' : 'default';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid var(--line)', background: 'white', flexShrink: 0, zIndex: 10, flexWrap: 'wrap' }}>
        <button onClick={onBack} className="btn btn-sm btn-sec">← Boards</button>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `oklch(0.93 0.05 ${area.hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{area.g}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.008em' }}>{board.title}</div>
          {board.desc && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{board.desc}</div>}
        </div>

        {/* View tabs */}
        <div className="tabs" style={{ margin: 0 }}>
          <button className={`tab${view === 'board' ? ' active' : ''}`} onClick={() => setView('board')}>🖊 Board</button>
          <button className={`tab${view === 'timeline' ? ' active' : ''}`} onClick={() => setView('timeline')}>
            📅 Timeline
            {(board.phases ?? []).length > 0 && <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 4 }}>({board.phases.length})</span>}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {view === 'board' && board.strokes.length > 0 && (
            <button className="btn btn-sm btn-sec" onClick={() => onUpdate(b => ({ ...b, strokes: [] }))}>🧹 Clear ink</button>
          )}
          <button className={`bdg ${board.shared ? 'bdg-ok' : 'bdg-gy'}`}
            style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', borderRadius: 20, fontSize: 11 }}
            onClick={() => onUpdate(b => ({ ...b, shared: !b.shared }))}>
            {board.shared ? '🔗 Shared' : '🔒 Private'}
          </button>
          {view === 'board' && (
            <>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>{Math.round(xf.s * 100)}%</span>
              <button className="btn btn-sm btn-sec" onClick={() => setXf({ x: 60, y: 60, s: 1 })}>Reset</button>
            </>
          )}
        </div>
      </div>

      {/* Timeline view */}
      {view === 'timeline' && (
        <TimelineView board={board} onUpdate={onUpdate} />
      )}

      {/* Board view: toolbar + canvas */}
      {view === 'board' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left toolbar */}
          <div style={{ width: 50, background: 'white', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 3, flexShrink: 0, overflowY: 'auto', zIndex: 10 }}>
            {TOOLS.map((t, i) => (
              <div key={t.id}>
                {i === 2 && <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 11px' }} />}
                <button onClick={() => setTool(t.id)} title={t.label} style={{
                  width: 36, height: 36, borderRadius: 8,
                  fontSize: t.id === 'text' ? 13 : t.id === 'checklist' ? 15 : 16,
                  fontWeight: t.id === 'text' ? 800 : 400,
                  background: tool === t.id ? 'var(--accent-soft)' : 'transparent',
                  border: `1.5px solid ${tool === t.id ? 'var(--accent-line)' : 'transparent'}`,
                  color: tool === t.id ? 'var(--accent-ink)' : 'var(--ink-3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s',
                }}>{t.icon}</button>
              </div>
            ))}

            {/* Sticky color swatches */}
            {tool === 'sticky' && (
              <>
                <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 0' }} />
                {STICKY_PAL.map(c => (
                  <button key={c.bg} onClick={() => setStickyBg(c.bg)} style={{ width: 22, height: 22, borderRadius: 4, background: c.bg, border: `2.5px solid ${stickyBg === c.bg ? '#4f46e5' : c.bg === '#ffffff' ? '#d1d5db' : 'transparent'}`, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                ))}
              </>
            )}

            {/* Text size options */}
            {tool === 'text' && (
              <>
                <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 0' }} />
                {(Object.keys(TEXT_SIZES) as TextSize[]).map(sz => (
                  <button key={sz} onClick={() => setTextSize(sz)} title={`${TEXT_SIZES[sz].px}px`}
                    style={{ width: 36, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 700, background: textSize === sz ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${textSize === sz ? 'var(--accent-line)' : 'transparent'}`, color: textSize === sz ? 'var(--accent-ink)' : 'var(--ink-4)', cursor: 'pointer' }}>
                    {TEXT_SIZES[sz].label}
                  </button>
                ))}
              </>
            )}

            {/* Pen options */}
            {tool === 'pen' && (
              <>
                <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 0' }} />
                {PEN_COLORS.map(c => (
                  <button key={c} onClick={() => setPenColor(c)} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: `2.5px solid ${penColor === c ? '#4f46e5' : 'transparent'}`, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                ))}
                <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 0' }} />
                {PEN_WIDTHS.map(pw => (
                  <button key={pw} onClick={() => setPenWidth(pw)} style={{ width: 36, height: 26, background: penWidth === pw ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${penWidth === pw ? 'var(--accent-line)' : 'transparent'}`, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 16, height: pw, background: penColor, borderRadius: pw }} />
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Canvas */}
          <div ref={containerRef} onPointerDown={handleCanvasPD} onWheel={handleWheel}
            style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor, background: 'var(--surface-2)', backgroundImage: 'radial-gradient(circle, oklch(0.86 0.01 265) 1px, transparent 1px)', backgroundSize: '28px 28px', touchAction: 'none' }}>
            <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${xf.x}px,${xf.y}px) scale(${xf.s})`, width: 3200, height: 2400 }}>

              {/* Drawing SVG */}
              <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
                {board.strokes.map(s => <path key={s.id} d={makePath(s.pts)} fill="none" stroke={s.color} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />)}
                {liveStroke.length > 1 && <path d={makePath(liveStroke)} fill="none" stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round" />}
              </svg>

              {/* Widgets */}
              {board.widgets.map(w => {
                const common = { sel: selId === w.id, onPD: makeDrag(w.id, w.x, w.y), onDel: () => delWidget(w.id) };
                if (w.type === 'sticky')    return <StickyNote    key={w.id} w={w} {...common} onChange={t => patchWidget(w.id, { text: t })} />;
                if (w.type === 'note')      return <NoteCard      key={w.id} w={w} {...common} onChange={p => patchWidget(w.id, p as Partial<Widget>)} />;
                if (w.type === 'text')      return <TextBlock     key={w.id} w={w} {...common} onChange={c => patchWidget(w.id, { content: c })} />;
                if (w.type === 'file')      return <FileCard      key={w.id} w={w} {...common} />;
                if (w.type === 'checklist') return <ChecklistWidget key={w.id} w={w} {...common} onChange={p => patchWidget(w.id, p as Partial<Widget>)} />;
                return null;
              })}
            </div>

            {/* Empty state hint */}
            {board.widgets.length === 0 && board.strokes.length === 0 && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', color: 'var(--ink-4)', pointerEvents: 'none' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🖊</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>Board is empty</div>
                <div style={{ fontSize: 12 }}>Pick a tool on the left, then click to place it.</div>
                <div style={{ fontSize: 11, marginTop: 8, opacity: 0.65 }}>S sticky · N note · T text · C checklist · P pen · F file · H pan</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Boards Overview ───────────────────────────────────────── */
export default function PlanningClient() {
  const [boards, setBoards] = useState<Board[]>(SEED);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', areaId: 'marketing', desc: '' });
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const activeBoard = boards.find(b => b.id === activeBoardId);
  const updateBoard = (fn: (b: Board) => Board) => setBoards(prev => prev.map(b => b.id === activeBoardId ? fn(b) : b));

  const addBoard = () => {
    if (!form.title.trim()) return;
    const b = makeBoard(form.title.trim(), form.areaId, form.desc);
    setBoards(prev => [b, ...prev]);
    setActiveBoardId(b.id);
    setShowNew(false);
    setForm({ title: '', areaId: 'marketing', desc: '' });
  };

  const deleteBoard = (id: string) => {
    if (!confirm('Delete this board?')) return;
    setBoards(prev => prev.filter(b => b.id !== id));
  };

  if (activeBoard) return <WhiteboardView board={activeBoard} onUpdate={updateBoard} onBack={() => setActiveBoardId(null)} />;

  const usedAreaIds = [...new Set(boards.map(b => b.areaId))];
  const filtered = areaFilter === 'all' ? boards : boards.filter(b => b.areaId === areaFilter);
  const totalItems = boards.reduce((s, b) => s + b.widgets.length + b.strokes.length, 0);
  const sharedCount = boards.filter(b => b.shared).length;

  return (
    <div className="page-fade">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Boards', value: boards.length,  foot: 'Planning spaces',       ico: 'ind', g: '◈' },
          { label: 'Total Items',  value: totalItems,      foot: 'Widgets + drawings',    ico: 'ind', g: '🖊' },
          { label: 'Shared',       value: sharedCount,     foot: 'Visible to team',        ico: 'ok',  g: '🔗' },
          { label: 'Areas',        value: usedAreaIds.length, foot: 'Business areas',     ico: 'ind', g: '◉' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className={`stat-ico ${s.ico}`}>{s.g}</div></div>
            <div className="stat-l">{s.label}</div>
            <div className="stat-v">{s.value}</div>
            <div className="stat-foot">{s.foot}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="tabs" style={{ flex: 1 }}>
          <button className={`tab${areaFilter === 'all' ? ' active' : ''}`} onClick={() => setAreaFilter('all')}>All ({boards.length})</button>
          {AREAS.filter(a => usedAreaIds.includes(a.id)).map(a => (
            <button key={a.id} className={`tab${areaFilter === a.id ? ' active' : ''}`} onClick={() => setAreaFilter(a.id)}>
              {a.g} {a.label}
            </button>
          ))}
        </div>
        <button className="btn btn-acc" onClick={() => setShowNew(true)}>+ New Board</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🖊</div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-2)', marginBottom: 6 }}>No boards yet</div>
          <div style={{ marginBottom: 20, fontSize: 13 }}>Create a board and start placing ideas.</div>
          <button className="btn btn-acc" onClick={() => setShowNew(true)}>+ New Board</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
          {filtered.map(board => {
            const area = AREAS.find(a => a.id === board.areaId) ?? AREAS[0];
            const widgetCount = board.widgets.length;
            const sticky = board.widgets.filter(w => w.type === 'sticky').length;
            const checklists = board.widgets.filter(w => w.type === 'checklist').length;
            const phases = board.phases?.length ?? 0;
            return (
              <div key={board.id} onClick={() => setActiveBoardId(board.id)}
                style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 14, padding: '18px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: 'var(--sh-1)', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--sh-2)'; e.currentTarget.style.borderColor = `oklch(0.84 0.08 ${area.hue})`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--sh-1)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `oklch(0.65 0.12 ${area.hue})`, borderRadius: '14px 14px 0 0' }} />
                <button onClick={e => { e.stopPropagation(); deleteBoard(board.id); }} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 5px', opacity: 0.5 }}>×</button>

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, marginTop: 6 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `oklch(0.93 0.05 ${area.hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{area.g}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.008em', paddingRight: 20, lineHeight: 1.25 }}>{board.title}</div>
                    <div style={{ fontSize: 11, color: `oklch(0.52 0.09 ${area.hue})`, marginTop: 2, fontWeight: 500 }}>{area.label}</div>
                  </div>
                </div>

                {board.desc && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{board.desc}</div>
                )}

                {/* Mini preview dots */}
                {widgetCount > 0 && (
                  <div style={{ height: 44, background: 'var(--surface-2)', borderRadius: 8, marginBottom: 12, position: 'relative', overflow: 'hidden', border: '1px solid var(--line-2)' }}>
                    {board.widgets.slice(0, 10).map((w, i) => {
                      const x = (i % 5) * 18 + 8, y = Math.floor(i / 5) * 16 + 6;
                      const bg = w.type === 'sticky' ? w.bg : w.type === 'checklist' ? '#bbf7d0' : 'white';
                      return <div key={w.id} style={{ position: 'absolute', left: x, top: y, width: 12, height: 12, borderRadius: 2, background: bg, border: '1px solid rgba(0,0,0,0.06)' }} />;
                    })}
                    <div style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 9, color: 'var(--ink-4)', fontWeight: 600 }}>{widgetCount} items</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {board.shared && <span className="bdg bdg-ok" style={{ fontSize: 10 }}>🔗 Shared</span>}
                  {sticky > 0 && <span className="bdg bdg-gy" style={{ fontSize: 10 }}>📝 {sticky}</span>}
                  {checklists > 0 && <span className="bdg bdg-gy" style={{ fontSize: 10 }}>☑ {checklists}</span>}
                  {phases > 0 && <span className="bdg bdg-acc" style={{ fontSize: 10 }}>📅 {phases} phases</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-5)' }}>
                    {new Date(board.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && mounted && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div style={{ background: 'white', borderRadius: 16, width: 460, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', padding: '28px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.01em' }}>New Board</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 22 }}>A blank canvas to organise your thinking.</div>
            <div className="pv-fld"><label>Board title</label>
              <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addBoard(); }} placeholder="e.g. Q3 Marketing Plan" /></div>
            <div className="pv-fld"><label>Area</label>
              <select value={form.areaId} onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))}>
                {AREAS.map(a => <option key={a.id} value={a.id}>{a.g} {a.label}</option>)}</select></div>
            <div className="pv-fld"><label>Description <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
              <textarea rows={2} value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="What is this board for?" /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addBoard} className="btn btn-acc" disabled={!form.title.trim()}>Create Board</button>
              <button onClick={() => { setShowNew(false); setForm({ title: '', areaId: 'marketing', desc: '' }); }} className="btn btn-sec">Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
