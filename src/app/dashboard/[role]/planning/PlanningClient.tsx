'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/* ── Types ─────────────────────────────────────────────────── */
type ToolId = 'select' | 'pan' | 'sticky' | 'note' | 'text' | 'pen' | 'file';

interface WBase { id: string; x: number; y: number; w: number; h: number; }
interface StickyW extends WBase { type: 'sticky'; text: string; bg: string; }
interface NoteW extends WBase { type: 'note'; title: string; body: string; }
interface TextW extends WBase { type: 'text'; content: string; }
interface FileW extends WBase { type: 'file'; name: string; ext: string; }
type Widget = StickyW | NoteW | TextW | FileW;

interface Stroke { id: string; pts: [number, number][]; color: string; w: number; }
interface Board {
  id: string; title: string; desc: string; areaId: string;
  shared: boolean; created: string; widgets: Widget[]; strokes: Stroke[];
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
  { id: 'select', icon: '↖',  label: 'Select  V' },
  { id: 'pan',    icon: '✋', label: 'Pan  H' },
  { id: 'sticky', icon: '🟡', label: 'Sticky Note  S' },
  { id: 'note',   icon: '📄', label: 'Note Card  N' },
  { id: 'text',   icon: 'T',  label: 'Text  T' },
  { id: 'pen',    icon: '✏',  label: 'Pen  P' },
  { id: 'file',   icon: '📁', label: 'File  F' },
];

const STICKY_PAL = [
  { bg: '#fef08a', text: '#78350f', label: 'Yellow' },
  { bg: '#fecdd3', text: '#881337', label: 'Pink' },
  { bg: '#bfdbfe', text: '#1e3a5f', label: 'Blue' },
  { bg: '#bbf7d0', text: '#14532d', label: 'Green' },
  { bg: '#e9d5ff', text: '#4c1d95', label: 'Purple' },
  { bg: '#fed7aa', text: '#7c2d12', label: 'Orange' },
  { bg: '#ffffff', text: '#1a1f2e', label: 'White' },
];

const PEN_COLORS = ['#1a1f2e', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
const PEN_WIDTHS = [1, 2, 4, 7];

const FILE_ICONS: Record<string, string> = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
  ppt: '📙', pptx: '📙', zip: '📦', txt: '📝', csv: '📊',
  png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', mp4: '🎬',
};

/* ── Helpers ───────────────────────────────────────────────── */
function uid() { return Math.random().toString(36).slice(2, 10); }

function makePath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

function makeBoard(title: string, areaId: string, desc = ''): Board {
  return { id: uid(), title, desc, areaId, shared: false, created: new Date().toISOString(), widgets: [], strokes: [] };
}

/* ── Seed Boards ───────────────────────────────────────────── */
const SEED: Board[] = [
  {
    id: 'b1', title: 'Q3 Marketing Plan', desc: 'Campaigns, content, and growth for Q3',
    areaId: 'marketing', shared: true, created: new Date().toISOString(), strokes: [],
    widgets: [
      { id: 'w1', type: 'sticky', x: 60, y: 60, w: 180, h: 180, text: '🚀 Launch email campaign\nTarget dormant leads 60+ days', bg: '#fef08a' },
      { id: 'w2', type: 'sticky', x: 270, y: 60, w: 180, h: 180, text: '📊 A/B test ad creatives\nFacebook + Google, 2 variants', bg: '#bfdbfe' },
      { id: 'w3', type: 'sticky', x: 480, y: 60, w: 180, h: 180, text: '✍️ Blog: Industry trends\n1500 words, SEO optimised', bg: '#bbf7d0' },
      { id: 'w4', type: 'sticky', x: 690, y: 60, w: 180, h: 180, text: '🎯 Retargeting setup\nFacebook & LinkedIn audiences', bg: '#e9d5ff' },
      { id: 'w5', type: 'note',   x: 60, y: 280, w: 260, h: 170, title: 'Q3 Goals', body: '• Pipeline to $500k\n• CAC below $40\n• 3 new partnerships\n• 12 content pieces published' },
      { id: 'w6', type: 'text',   x: 360, y: 295, w: 300, h: 55, content: '🎯 Focus on top 20% of channels driving 80% of leads' },
      { id: 'w7', type: 'file',   x: 710, y: 280, w: 180, h: 80, name: 'Q2_Marketing_Report.pdf', ext: 'pdf' },
    ],
  },
  {
    id: 'b2', title: 'Sales Pipeline Q3', desc: 'Track deals, strategy, and targets',
    areaId: 'sales', shared: false, created: new Date().toISOString(), strokes: [],
    widgets: [
      { id: 'w8',  type: 'sticky', x: 60, y: 60, w: 180, h: 180, text: '🤝 Acme Corp proposal\nDeadline: July 12', bg: '#fed7aa' },
      { id: 'w9',  type: 'sticky', x: 270, y: 60, w: 180, h: 180, text: '📞 20 new prospects\nThis week — URGENT', bg: '#fecdd3' },
      { id: 'w10', type: 'note',   x: 60, y: 280, w: 260, h: 160, title: 'Pipeline Targets', body: '• MRR: $500k by EOQ\n• Deal cycle: ≤ 45 days\n• Win rate: 35%\n• 4 enterprise accounts' },
      { id: 'w11', type: 'text',   x: 360, y: 295, w: 280, h: 50, content: '💡 Re-introduce Friday pipeline review calls' },
    ],
  },
];

/* ── Delete button used by all widgets ─────────────────────── */
function DelBtn({ onDelete, scale }: { onDelete: () => void; scale: number }) {
  const sz = Math.max(18, 18 / scale);
  return (
    <button
      onPointerDown={e => { e.stopPropagation(); onDelete(); }}
      style={{ position: 'absolute', top: -sz / 2, right: -sz / 2, width: sz, height: sz, borderRadius: '50%', background: '#ef4444', border: `${2 / scale}px solid white`, color: 'white', fontSize: Math.max(10, 10 / scale), cursor: 'pointer', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
    >×</button>
  );
}

/* ── Sticky Note ───────────────────────────────────────────── */
function StickyNote({ w, sel, scale, onPD, onDel, onChange }: {
  w: StickyW; sel: boolean; scale: number;
  onPD: (e: React.PointerEvent) => void;
  onDel: () => void;
  onChange: (t: string) => void;
}) {
  const pal = STICKY_PAL.find(c => c.bg === w.bg) ?? STICKY_PAL[0];
  return (
    <div onPointerDown={onPD} style={{
      position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h,
      background: w.bg, borderRadius: 3, padding: '12px 14px',
      boxShadow: sel ? `0 0 0 ${2 / scale}px #4f46e5, 0 6px 20px rgba(0,0,0,0.18)` : '0 3px 10px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.07)',
      cursor: 'grab', display: 'flex', flexDirection: 'column', userSelect: 'none',
    }}>
      {sel && <DelBtn onDelete={onDel} scale={scale} />}
      <textarea
        key={w.id}
        defaultValue={w.text}
        onBlur={e => onChange(e.target.value)}
        onPointerDown={e => e.stopPropagation()}
        placeholder="Type here…"
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 13, color: pal.text, lineHeight: 1.6, cursor: 'text', fontFamily: 'inherit', padding: 0, fontWeight: 500 }}
      />
      <div style={{ fontSize: 10, color: pal.text, opacity: 0.4, marginTop: 4, textAlign: 'right', userSelect: 'none' }}>✎ sticky</div>
    </div>
  );
}

/* ── Note Card ─────────────────────────────────────────────── */
function NoteCard({ w, sel, scale, onPD, onDel, onChange }: {
  w: NoteW; sel: boolean; scale: number;
  onPD: (e: React.PointerEvent) => void;
  onDel: () => void;
  onChange: (p: Partial<NoteW>) => void;
}) {
  return (
    <div onPointerDown={onPD} style={{
      position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h,
      background: 'white', borderRadius: 10,
      border: `${sel ? 2 : 1.5}px solid ${sel ? '#4f46e5' : 'rgba(0,0,0,0.09)'}`,
      boxShadow: '0 4px 14px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)',
      cursor: 'grab', display: 'flex', flexDirection: 'column', userSelect: 'none', overflow: 'hidden',
    }}>
      {sel && <DelBtn onDelete={onDel} scale={scale} />}
      <div style={{ height: 3, background: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <input
          key={w.id + 't'}
          defaultValue={w.title}
          onBlur={e => onChange({ title: e.target.value })}
          onPointerDown={e => e.stopPropagation()}
          placeholder="Title…"
          style={{ fontSize: 13, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', padding: 0, cursor: 'text', width: '100%' }}
        />
        <textarea
          key={w.id + 'b'}
          defaultValue={w.body}
          onBlur={e => onChange({ body: e.target.value })}
          onPointerDown={e => e.stopPropagation()}
          placeholder="Notes…"
          style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink-2)', lineHeight: 1.65, cursor: 'text', fontFamily: 'inherit', padding: 0 }}
        />
      </div>
    </div>
  );
}

/* ── Text Block ────────────────────────────────────────────── */
function TextBlock({ w, sel, scale, onPD, onDel, onChange }: {
  w: TextW; sel: boolean; scale: number;
  onPD: (e: React.PointerEvent) => void;
  onDel: () => void;
  onChange: (c: string) => void;
}) {
  return (
    <div onPointerDown={onPD} style={{
      position: 'absolute', left: w.x, top: w.y, width: w.w, minHeight: w.h,
      outline: sel ? `${2 / scale}px solid #4f46e5` : 'none',
      borderRadius: 4, padding: 4, cursor: 'grab', userSelect: 'none',
    }}>
      {sel && <DelBtn onDelete={onDel} scale={scale} />}
      <textarea
        key={w.id}
        defaultValue={w.content}
        onBlur={e => onChange(e.target.value)}
        onPointerDown={e => e.stopPropagation()}
        placeholder="Text…"
        style={{ width: '100%', minHeight: w.h - 8, fontSize: 15, fontWeight: 600, border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)', lineHeight: 1.45, cursor: 'text', fontFamily: 'inherit', padding: 0 }}
      />
    </div>
  );
}

/* ── File Card ─────────────────────────────────────────────── */
function FileCard({ w, sel, scale, onPD, onDel }: {
  w: FileW; sel: boolean; scale: number;
  onPD: (e: React.PointerEvent) => void;
  onDel: () => void;
}) {
  const icon = FILE_ICONS[w.ext.toLowerCase()] ?? '📄';
  return (
    <div onPointerDown={onPD} style={{
      position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h,
      background: 'white', borderRadius: 10,
      border: `${sel ? 2 : 1.5}px solid ${sel ? '#4f46e5' : 'rgba(0,0,0,0.09)'}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      padding: '10px 14px', cursor: 'grab', userSelect: 'none',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {sel && <DelBtn onDelete={onDel} scale={scale} />}
      <span style={{ fontSize: 26, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
        <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{w.ext} file</div>
      </div>
    </div>
  );
}

/* ── Whiteboard View ───────────────────────────────────────── */
function WhiteboardView({ board, onUpdate, onBack }: {
  board: Board;
  onUpdate: (fn: (b: Board) => Board) => void;
  onBack: () => void;
}) {
  const [tool, setTool] = useState<ToolId>('select');
  const [stickyBg, setStickyBg] = useState('#fef08a');
  const [penColor, setPenColor] = useState('#1a1f2e');
  const [penWidth, setPenWidth] = useState(2);
  const [xf, setXf] = useState<XF>({ x: 60, y: 60, s: 1 });
  const [selId, setSelId] = useState<string | null>(null);
  const [liveStroke, setLiveStroke] = useState<[number, number][]>([]);
  const [mounted, setMounted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const xfRef = useRef(xf);
  useEffect(() => { xfRef.current = xf; }, [xf]);
  useEffect(() => { setMounted(true); }, []);

  const area = AREAS.find(a => a.id === board.areaId) ?? AREAS[0];

  const toCanvas = (sx: number, sy: number): [number, number] => {
    const rect = containerRef.current!.getBoundingClientRect();
    const t = xfRef.current;
    return [(sx - rect.left - t.x) / t.s, (sy - rect.top - t.y) / t.s];
  };

  /* keyboard */
  useEffect(() => {
    const MAP: Record<string, ToolId> = { v: 'select', h: 'pan', s: 'sticky', n: 'note', t: 'text', p: 'pen', f: 'file' };
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,[contenteditable]')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selId) {
        onUpdate(b => ({ ...b, widgets: b.widgets.filter(w => w.id !== selId) }));
        setSelId(null);
        return;
      }
      if (e.key === 'Escape') { setSelId(null); setTool('select'); return; }
      const t = MAP[e.key.toLowerCase()];
      if (t) setTool(t);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selId, onUpdate]);

  /* zoom */
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
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

    /* pan (middle button or pan tool) */
    if (e.button === 1 || tool === 'pan') {
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      const tx0 = xfRef.current.x, ty0 = xfRef.current.y;
      const mm = (me: PointerEvent) => setXf(t => ({ ...t, x: tx0 + me.clientX - sx, y: ty0 + me.clientY - sy }));
      const mu = () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu); };
      window.addEventListener('pointermove', mm);
      window.addEventListener('pointerup', mu);
      return;
    }

    if (tool === 'select') { setSelId(null); return; }

    /* pen draw */
    if (tool === 'pen') {
      const pt0 = toCanvas(e.clientX, e.clientY);
      const pts: [number, number][] = [pt0];
      setLiveStroke([pt0]);
      const mm = (me: PointerEvent) => {
        const pt = toCanvas(me.clientX, me.clientY);
        pts.push(pt);
        setLiveStroke(prev => [...prev, pt]);
      };
      const mu = () => {
        if (pts.length > 1) onUpdate(b => ({ ...b, strokes: [...b.strokes, { id: uid(), pts, color: penColor, w: penWidth }] }));
        setLiveStroke([]);
        window.removeEventListener('pointermove', mm);
        window.removeEventListener('pointerup', mu);
      };
      window.addEventListener('pointermove', mm);
      window.addEventListener('pointerup', mu);
      return;
    }

    /* place widget */
    const [cx, cy] = toCanvas(e.clientX, e.clientY);
    const id = uid();
    let nw: Widget;
    if (tool === 'sticky') nw = { id, type: 'sticky', x: cx - 90, y: cy - 90, w: 180, h: 180, text: '', bg: stickyBg };
    else if (tool === 'note') nw = { id, type: 'note', x: cx - 130, y: cy - 85, w: 260, h: 170, title: 'Note', body: '' };
    else if (tool === 'text') nw = { id, type: 'text', x: cx - 100, y: cy - 20, w: 240, h: 55, content: 'Type something…' };
    else nw = { id, type: 'file', x: cx - 90, y: cy - 40, w: 200, h: 80, name: 'Document.pdf', ext: 'pdf' };

    onUpdate(b => ({ ...b, widgets: [...b.widgets, nw] }));
    setSelId(id);
    setTool('select');
  };

  /* widget drag factory */
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
    window.addEventListener('pointermove', mm);
    window.addEventListener('pointerup', mu);
  };

  const delWidget = (id: string) => { onUpdate(b => ({ ...b, widgets: b.widgets.filter(w => w.id !== id) })); setSelId(null); };
  const patchWidget = (id: string, patch: Partial<Widget>) => onUpdate(b => ({ ...b, widgets: b.widgets.map(w => w.id === id ? { ...w, ...patch } as Widget : w) }));

  const cursor = tool === 'pan' ? 'grab' : tool === 'pen' ? 'crosshair' : (tool !== 'select') ? 'crosshair' : 'default';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid var(--line)', background: 'white', flexShrink: 0, zIndex: 10 }}>
        <button onClick={onBack} className="btn btn-sm btn-sec">← Boards</button>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `oklch(0.93 0.05 ${area.hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{area.g}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.008em' }}>{board.title}</div>
          {board.desc && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{board.desc}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {board.strokes.length > 0 && (
            <button className="btn btn-sm btn-sec" onClick={() => onUpdate(b => ({ ...b, strokes: [] }))}>🧹 Clear ink</button>
          )}
          <button
            className={`bdg ${board.shared ? 'bdg-ok' : 'bdg-gy'}`}
            style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', borderRadius: 20, fontSize: 11 }}
            onClick={() => onUpdate(b => ({ ...b, shared: !b.shared }))}
          >{board.shared ? '🔗 Shared' : '🔒 Private'}</button>
          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>{Math.round(xf.s * 100)}%</span>
          <button className="btn btn-sm btn-sec" onClick={() => setXf({ x: 60, y: 60, s: 1 })}>Reset zoom</button>
        </div>
      </div>

      {/* Toolbar + Canvas */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left toolbar */}
        <div style={{ width: 50, background: 'white', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 3, flexShrink: 0, overflowY: 'auto', zIndex: 10 }}>
          {TOOLS.map((t, i) => (
            <div key={t.id}>
              {i === 2 && <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 11px' }} />}
              <button
                onClick={() => setTool(t.id)}
                title={t.label}
                style={{
                  width: 36, height: 36, borderRadius: 8,
                  fontSize: t.id === 'text' ? 13 : 16, fontWeight: t.id === 'text' ? 800 : 400,
                  background: tool === t.id ? 'var(--accent-soft)' : 'transparent',
                  border: `1.5px solid ${tool === t.id ? 'var(--accent-line)' : 'transparent'}`,
                  color: tool === t.id ? 'var(--accent-ink)' : 'var(--ink-3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.1s',
                }}
              >{t.icon}</button>
            </div>
          ))}

          {/* Sticky color swatches */}
          {tool === 'sticky' && (
            <>
              <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 0' }} />
              {STICKY_PAL.map(c => (
                <button key={c.bg} onClick={() => setStickyBg(c.bg)} title={c.label}
                  style={{ width: 22, height: 22, borderRadius: 4, background: c.bg, border: `2.5px solid ${stickyBg === c.bg ? '#4f46e5' : c.bg === '#ffffff' ? '#d1d5db' : 'transparent'}`, cursor: 'pointer', padding: 0, flexShrink: 0 }}
                />
              ))}
            </>
          )}

          {/* Pen options */}
          {tool === 'pen' && (
            <>
              <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 0' }} />
              {PEN_COLORS.map(c => (
                <button key={c} onClick={() => setPenColor(c)}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: `2.5px solid ${penColor === c ? '#4f46e5' : 'transparent'}`, cursor: 'pointer', padding: 0, flexShrink: 0 }}
                />
              ))}
              <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 0' }} />
              {PEN_WIDTHS.map(pw => (
                <button key={pw} onClick={() => setPenWidth(pw)}
                  style={{ width: 36, height: 28, background: penWidth === pw ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${penWidth === pw ? 'var(--accent-line)' : 'transparent'}`, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <div style={{ width: 16, height: pw, background: penColor, borderRadius: pw }} />
                </button>
              ))}
            </>
          )}
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          onPointerDown={handleCanvasPD}
          onWheel={handleWheel}
          style={{
            flex: 1, overflow: 'hidden', position: 'relative', cursor,
            background: 'var(--surface-2)',
            backgroundImage: 'radial-gradient(circle, oklch(0.86 0.01 265) 1px, transparent 1px)',
            backgroundSize: '28px 28px', touchAction: 'none',
          }}
        >
          {/* Canvas inner (transformed) */}
          <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${xf.x}px,${xf.y}px) scale(${xf.s})`, width: 3200, height: 2400 }}>

            {/* Drawing SVG */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
              {board.strokes.map(s => (
                <path key={s.id} d={makePath(s.pts)} fill="none" stroke={s.color} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {liveStroke.length > 1 && (
                <path d={makePath(liveStroke)} fill="none" stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>

            {/* Widgets */}
            {board.widgets.map(w => {
              const props = { sel: selId === w.id, scale: xf.s, onPD: makeDrag(w.id, w.x, w.y), onDel: () => delWidget(w.id) };
              if (w.type === 'sticky') return <StickyNote key={w.id} w={w} {...props} onChange={t => patchWidget(w.id, { text: t })} />;
              if (w.type === 'note')   return <NoteCard   key={w.id} w={w} {...props} onChange={p => patchWidget(w.id, p as Partial<Widget>)} />;
              if (w.type === 'text')   return <TextBlock  key={w.id} w={w} {...props} onChange={c => patchWidget(w.id, { content: c })} />;
              if (w.type === 'file')   return <FileCard   key={w.id} w={w} {...props} />;
              return null;
            })}
          </div>

          {/* Hint when board is empty */}
          {board.widgets.length === 0 && board.strokes.length === 0 && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', color: 'var(--ink-4)', pointerEvents: 'none' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🖊</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>Your board is empty</div>
              <div style={{ fontSize: 12 }}>Pick a tool on the left, then click to place it.</div>
              <div style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}>Shortcuts: S sticky · N note · T text · P pen · F file · H pan</div>
            </div>
          )}
        </div>
      </div>
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

  const updateBoard = (fn: (b: Board) => Board) =>
    setBoards(prev => prev.map(b => b.id === activeBoardId ? fn(b) : b));

  const addBoard = () => {
    if (!form.title.trim()) return;
    const b = makeBoard(form.title.trim(), form.areaId, form.desc);
    setBoards(prev => [b, ...prev]);
    setActiveBoardId(b.id);
    setShowNew(false);
    setForm({ title: '', areaId: 'marketing', desc: '' });
  };

  const deleteBoard = (id: string) => {
    if (!confirm('Delete this board and everything on it?')) return;
    setBoards(prev => prev.filter(b => b.id !== id));
  };

  if (activeBoard) {
    return <WhiteboardView board={activeBoard} onUpdate={updateBoard} onBack={() => setActiveBoardId(null)} />;
  }

  const usedAreaIds = [...new Set(boards.map(b => b.areaId))];
  const filtered = areaFilter === 'all' ? boards : boards.filter(b => b.areaId === areaFilter);

  const totalItems = boards.reduce((s, b) => s + b.widgets.length + b.strokes.length, 0);
  const sharedCount = boards.filter(b => b.shared).length;

  return (
    <div className="page-fade">

      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Boards', value: boards.length, foot: 'Planning spaces', ico: 'ind', g: '◈' },
          { label: 'Total Items', value: totalItems, foot: 'Widgets + drawings', ico: 'ind', g: '🖊' },
          { label: 'Shared', value: sharedCount, foot: 'Visible to team', ico: 'ok', g: '🔗' },
          { label: 'Areas', value: usedAreaIds.length, foot: 'Business areas covered', ico: 'ind', g: '◉' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h">
              <div className={`stat-ico ${s.ico}`}>{s.g}</div>
            </div>
            <div className="stat-l">{s.label}</div>
            <div className="stat-v">{s.value}</div>
            <div className="stat-foot">{s.foot}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="tabs" style={{ flex: 1 }}>
          <button className={`tab${areaFilter === 'all' ? ' active' : ''}`} onClick={() => setAreaFilter('all')}>
            All ({boards.length})
          </button>
          {AREAS.filter(a => usedAreaIds.includes(a.id)).map(a => (
            <button key={a.id} className={`tab${areaFilter === a.id ? ' active' : ''}`} onClick={() => setAreaFilter(a.id)}>
              {a.g} {a.label}
            </button>
          ))}
        </div>
        <button className="btn btn-acc" onClick={() => setShowNew(true)}>+ New Board</button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🖊</div>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)', fontSize: 14 }}>No boards yet</div>
          <div style={{ marginBottom: 20, fontSize: 13 }}>Create a board and start placing ideas on it.</div>
          <button className="btn btn-acc" onClick={() => setShowNew(true)}>+ New Board</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
          {filtered.map(board => {
            const area = AREAS.find(a => a.id === board.areaId) ?? AREAS[0];
            const widgetCount = board.widgets.length;
            const drawingCount = board.strokes.length;
            const sticky = board.widgets.filter(w => w.type === 'sticky').length;
            const notes = board.widgets.filter(w => w.type === 'note').length;
            return (
              <div key={board.id}
                onClick={() => setActiveBoardId(board.id)}
                style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 14, padding: '18px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: 'var(--sh-1)', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--sh-2)'; e.currentTarget.style.borderColor = `oklch(0.84 0.08 ${area.hue})`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--sh-1)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
              >
                {/* Accent strip */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `oklch(0.65 0.12 ${area.hue})`, borderRadius: '14px 14px 0 0' }} />

                {/* Delete */}
                <button onClick={e => { e.stopPropagation(); deleteBoard(board.id); }}
                  style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 5px', opacity: 0.5 }}>×</button>

                {/* Top */}
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

                {/* Board preview — mini sticky dots */}
                {widgetCount > 0 && (
                  <div style={{ height: 48, background: 'var(--surface-2)', borderRadius: 8, marginBottom: 12, position: 'relative', overflow: 'hidden', border: '1px solid var(--line-2)' }}>
                    {board.widgets.slice(0, 8).map((w, i) => {
                      const x = (i % 4) * 22 + 8;
                      const y = Math.floor(i / 4) * 18 + 6;
                      const bg = w.type === 'sticky' ? w.bg : w.type === 'note' ? 'white' : w.type === 'text' ? 'transparent' : '#f3f4f6';
                      return (
                        <div key={w.id} style={{ position: 'absolute', left: x, top: y, width: 14, height: 14, borderRadius: 2, background: bg, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }} />
                      );
                    })}
                    <div style={{ position: 'absolute', right: 6, bottom: 5, fontSize: 9, color: 'var(--ink-4)', fontWeight: 600 }}>{widgetCount} items</div>
                  </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {board.shared && <span className="bdg bdg-ok" style={{ fontSize: 10 }}>🔗 Shared</span>}
                  {sticky > 0 && <span className="bdg bdg-gy" style={{ fontSize: 10 }}>📝 {sticky}</span>}
                  {notes > 0 && <span className="bdg bdg-gy" style={{ fontSize: 10 }}>📄 {notes}</span>}
                  {drawingCount > 0 && <span className="bdg bdg-gy" style={{ fontSize: 10 }}>✏ {drawingCount}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-5)' }}>
                    {new Date(board.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New board modal */}
      {showNew && mounted && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}
        >
          <div style={{ background: 'white', borderRadius: 16, width: 460, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', padding: '28px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.01em' }}>New Board</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 22 }}>A blank canvas to organise your thinking.</div>

            <div className="pv-fld">
              <label>Board title</label>
              <input autoFocus value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addBoard(); }}
                placeholder="e.g. Q3 Marketing Plan" />
            </div>
            <div className="pv-fld">
              <label>Area</label>
              <select value={form.areaId} onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))}>
                {AREAS.map(a => <option key={a.id} value={a.id}>{a.g} {a.label}</option>)}
              </select>
            </div>
            <div className="pv-fld">
              <label>Description <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
              <textarea rows={2} value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="What is this board for?" />
            </div>

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
