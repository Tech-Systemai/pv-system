'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/* ─── Data ─────────────────────────────────────────────────── */

const PLAN_AREAS = [
  {
    id: 'marketing', label: 'Marketing', hue: 268, glyph: '📣',
    objective: 'Drive brand awareness and lead generation across all channels.',
    kpis: [{ label: 'Leads / mo', value: '340', target: '500', pct: 68 }, { label: 'CAC', value: '$42', target: '$35', pct: 55 }, { label: 'Campaign ROI', value: '2.8×', target: '4×', pct: 70 }],
    owner: 'Sara M.', contributors: ['James K.', 'Lin W.'],
    nudges: ['Revisit content calendar for Q3 gaps.', 'A/B test subject lines on next campaign.'],
    spark: [30, 45, 40, 60, 55, 80, 78, 90],
  },
  {
    id: 'business', label: 'Business Dev', hue: 25, glyph: '🤝',
    objective: 'Expand partnerships and close enterprise pipeline.',
    kpis: [{ label: 'Pipeline', value: '$1.2M', target: '$2M', pct: 60 }, { label: 'Partnerships', value: '4', target: '8', pct: 50 }, { label: 'Meetings / wk', value: '6', target: '10', pct: 60 }],
    owner: 'Omar T.', contributors: ['Priya S.'],
    nudges: ['Follow up with Acme Corp proposal.', 'Schedule Q3 partner summit.'],
    spark: [20, 30, 35, 40, 50, 45, 60, 65],
  },
  {
    id: 'financial', label: 'Financial', hue: 145, glyph: '📊',
    objective: 'Maintain healthy margins and forecast accuracy within 5%.',
    kpis: [{ label: 'Gross Margin', value: '58%', target: '65%', pct: 89 }, { label: 'Burn Rate', value: '$80k', target: '$70k', pct: 55 }, { label: 'Forecast Δ', value: '6%', target: '<5%', pct: 40 }],
    owner: 'Dana L.', contributors: ['Omar T.', 'Sara M.'],
    nudges: ['Tighten opex forecast model.', 'Reconcile Q2 vendor invoices.'],
    spark: [50, 52, 55, 53, 60, 62, 58, 64],
  },
  {
    id: 'website', label: 'Website', hue: 200, glyph: '🌐',
    objective: 'Improve conversion rate and reduce time-to-value for visitors.',
    kpis: [{ label: 'Conv. Rate', value: '2.1%', target: '3.5%', pct: 60 }, { label: 'Bounce Rate', value: '54%', target: '40%', pct: 43 }, { label: 'Page Speed', value: '72', target: '90', pct: 80 }],
    owner: 'Lin W.', contributors: ['James K.'],
    nudges: ['Compress hero images for mobile.', 'Add social proof section above fold.'],
    spark: [60, 62, 58, 65, 70, 68, 74, 80],
  },
  {
    id: 'cx', label: 'CX', hue: 75, glyph: '⭐',
    objective: 'Achieve NPS ≥ 50 and < 2% churn by end of quarter.',
    kpis: [{ label: 'NPS', value: '43', target: '50', pct: 86 }, { label: 'Churn', value: '2.4%', target: '<2%', pct: 50 }, { label: 'CSAT', value: '4.2', target: '4.7', pct: 89 }],
    owner: 'Priya S.', contributors: ['Dana L.'],
    nudges: ['Launch post-onboarding survey.', 'Reduce ticket first-response to < 2 hrs.'],
    spark: [40, 45, 50, 48, 55, 58, 62, 70],
  },
  {
    id: 'sales', label: 'Sales', hue: 155, glyph: '💰',
    objective: 'Hit $500k MRR with < 45-day average deal cycle.',
    kpis: [{ label: 'MRR', value: '$380k', target: '$500k', pct: 76 }, { label: 'Deal Cycle', value: '52d', target: '45d', pct: 60 }, { label: 'Win Rate', value: '28%', target: '35%', pct: 80 }],
    owner: 'James K.', contributors: ['Omar T.', 'Lin W.'],
    nudges: ['Implement deal-stage SLAs in CRM.', 'Reinstate Friday pipeline review call.'],
    spark: [55, 60, 65, 62, 70, 75, 78, 85],
  },
];

type WidgetType = 'goal' | 'sticky' | 'checklist' | 'file' | 'text';
type Tool = 'pointer' | 'sticky' | 'pen' | 'goal' | 'checklist' | 'text';
type ViewMode = 'board' | 'outline' | 'timeline';

interface CheckItem { text: string; done: boolean }
interface Widget {
  id: string; type: WidgetType;
  x: number; y: number; w: number; h: number;
  text?: string; color?: string;
  items?: CheckItem[];
  label?: string; progress?: number;
  areaId: string;
}
interface Stroke { points: [number, number][]; color: string; width: number }

function makeSeedWidgets(areaId: string, hue: number): Widget[] {
  return [
    { id: `${areaId}-g1`, type: 'goal', x: 40, y: 40, w: 200, h: 90, label: 'Q3 Objective', progress: 62, areaId },
    { id: `${areaId}-s1`, type: 'sticky', x: 280, y: 40, w: 160, h: 120, text: 'Review KPIs weekly with team', color: `oklch(0.96 0.04 ${hue})`, areaId },
    { id: `${areaId}-c1`, type: 'checklist', x: 40, y: 170, w: 200, h: 140, items: [{ text: 'Define OKRs', done: true }, { text: 'Assign owners', done: true }, { text: 'Set milestones', done: false }, { text: 'Schedule reviews', done: false }], areaId },
    { id: `${areaId}-t1`, type: 'text', x: 280, y: 200, w: 220, h: 80, text: 'Key insight: focus on top 20% of activities that drive 80% of outcomes.', areaId },
  ];
}

const SEED_BOARDS: Record<string, { widgets: Widget[]; strokes: Stroke[] }> = {};
for (const a of PLAN_AREAS) {
  SEED_BOARDS[a.id] = { widgets: makeSeedWidgets(a.id, a.hue), strokes: [] };
}

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'pointer', icon: '↖', label: 'Select' },
  { id: 'sticky', icon: '📝', label: 'Sticky' },
  { id: 'pen', icon: '✏', label: 'Pen' },
  { id: 'goal', icon: '🎯', label: 'Goal' },
  { id: 'checklist', icon: '☑', label: 'Checklist' },
  { id: 'text', icon: 'T', label: 'Text' },
];

/* ─── Helpers ───────────────────────────────────────────────── */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function Sparkline({ values, hue }: { values: number[]; hue: number }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 56; const h = 22;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={`oklch(0.60 0.14 ${hue})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiBar({ label, value, target, pct, hue }: { label: string; value: string; target: string; pct: number; hue: number }) {
  const color = pct >= 80 ? 'var(--ok)' : pct >= 55 ? 'var(--warn)' : 'var(--err)';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{value} <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>/ {target}</span></span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: color, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

/* ─── Widget renderer ───────────────────────────────────────── */

function WidgetCard({
  widget, selected, onSelect, onMove, hue,
  onUpdate,
}: {
  widget: Widget; selected: boolean; hue: number;
  onSelect: (id: string) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onUpdate: (id: string, patch: Partial<Widget>) => void;
}) {
  const dragRef = useRef<{ sx: number; sy: number; wx: number; wy: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    e.stopPropagation();
    onSelect(widget.id);
    dragRef.current = { sx: e.clientX, sy: e.clientY, wx: widget.x, wy: widget.y };
    const onMove_ = (me: MouseEvent) => {
      if (!dragRef.current) return;
      onMove(widget.id, me.clientX - dragRef.current.sx, me.clientY - dragRef.current.sy);
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove_); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove_);
    window.addEventListener('mouseup', onUp);
  };

  const base: React.CSSProperties = {
    position: 'absolute', left: widget.x, top: widget.y, width: widget.w, minHeight: widget.h,
    borderRadius: 10, cursor: 'grab', userSelect: 'none',
    boxShadow: selected ? `0 0 0 2px oklch(0.56 0.16 ${hue}), var(--sh-2)` : 'var(--sh-1)',
    transition: 'box-shadow 0.15s',
  };

  if (widget.type === 'sticky') {
    return (
      <div onMouseDown={onMouseDown} style={{ ...base, background: widget.color ?? `oklch(0.96 0.04 ${hue})`, padding: 12 }}>
        <div data-no-drag style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.55, minHeight: 40 }}
          contentEditable suppressContentEditableWarning
          onBlur={e => onUpdate(widget.id, { text: e.currentTarget.textContent ?? '' })}>
          {widget.text}
        </div>
      </div>
    );
  }

  if (widget.type === 'goal') {
    const pct = widget.progress ?? 0;
    const color = pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--err)';
    return (
      <div onMouseDown={onMouseDown} style={{ ...base, background: 'white', border: `1.5px solid oklch(0.88 0.06 ${hue})`, padding: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: `oklch(0.55 0.12 ${hue})`, marginBottom: 6 }}>🎯 Goal</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>{widget.label}</div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{pct}% complete</div>
      </div>
    );
  }

  if (widget.type === 'checklist') {
    const items = widget.items ?? [];
    const done = items.filter(i => i.done).length;
    return (
      <div onMouseDown={onMouseDown} style={{ ...base, background: 'white', border: '1.5px solid var(--line)', padding: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 8 }}>
          ☑ Checklist <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>({done}/{items.length})</span>
        </div>
        <div data-no-drag style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((item, i) => (
            <label key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={item.done} onChange={() => {
                const next = items.map((it, j) => j === i ? { ...it, done: !it.done } : it);
                onUpdate(widget.id, { items: next });
              }} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ color: item.done ? 'var(--ink-4)' : 'var(--ink)', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.4 }}>{item.text}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (widget.type === 'text') {
    return (
      <div onMouseDown={onMouseDown} style={{ ...base, background: 'transparent', padding: 8 }}>
        <div data-no-drag style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.65, minHeight: 30 }}
          contentEditable suppressContentEditableWarning
          onBlur={e => onUpdate(widget.id, { text: e.currentTarget.textContent ?? '' })}>
          {widget.text}
        </div>
      </div>
    );
  }

  return null;
}

/* ─── Canvas ────────────────────────────────────────────────── */

function Canvas({
  widgets, strokes, selectedId, tool, hue,
  onSelect, onMoveWidget, onUpdateWidget,
  onAddWidget, onAddStroke,
}: {
  widgets: Widget[]; strokes: Stroke[]; selectedId: string | null;
  tool: Tool; hue: number;
  onSelect: (id: string | null) => void;
  onMoveWidget: (id: string, dx: number, dy: number) => void;
  onUpdateWidget: (id: string, patch: Partial<Widget>) => void;
  onAddWidget: (w: Widget) => void;
  onAddStroke: (s: Stroke) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const penRef = useRef<[number, number][]>([]);
  const [drawing, setDrawing] = useState(false);
  const [livePoints, setLivePoints] = useState<[number, number][]>([]);

  const getPos = (e: React.MouseEvent): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (tool === 'pointer') { onSelect(null); return; }
    if (tool === 'pen') {
      const pt = getPos(e);
      penRef.current = [pt];
      setLivePoints([pt]);
      setDrawing(true);
      return;
    }
    const [x, y] = getPos(e);
    const typeMap: Record<string, WidgetType> = { sticky: 'sticky', goal: 'goal', checklist: 'checklist', text: 'text' };
    const type = typeMap[tool];
    if (!type) return;
    const id = uid();
    const base = { id, x, y, w: 180, h: 110, areaId: '' };
    if (type === 'sticky') onAddWidget({ ...base, type, text: 'New note…', color: `oklch(0.96 0.04 ${hue})` });
    else if (type === 'goal') onAddWidget({ ...base, type, label: 'New Goal', progress: 0 });
    else if (type === 'checklist') onAddWidget({ ...base, type, items: [{ text: 'Task 1', done: false }] });
    else if (type === 'text') onAddWidget({ ...base, type, text: 'Add text…' });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    const pt = getPos(e);
    penRef.current = [...penRef.current, pt];
    setLivePoints([...penRef.current]);
  };

  const handleMouseUp = () => {
    if (drawing && penRef.current.length > 1) {
      onAddStroke({ points: penRef.current, color: `oklch(0.40 0.14 ${hue})`, width: 2 });
    }
    setDrawing(false);
    penRef.current = [];
    setLivePoints([]);
  };

  const toPath = (pts: [number, number][]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');

  const widgetOrigins = useRef<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (const w of widgets) map[w.id] = { x: w.x, y: w.y };
    widgetOrigins.current = map;
  }, []);

  const handleMoveWidget = useCallback((id: string, dx: number, dy: number) => {
    const origin = widgetOrigins.current[id];
    if (!origin) return;
    onMoveWidget(id, origin.x + dx, origin.y + dy);
  }, [onMoveWidget]);

  const handleSelectWidget = useCallback((id: string) => {
    widgetOrigins.current[id] = { x: widgets.find(w => w.id === id)?.x ?? 0, y: widgets.find(w => w.id === id)?.y ?? 0 };
    onSelect(id);
  }, [widgets, onSelect]);

  return (
    <div
      style={{ position: 'relative', width: '100%', minHeight: 560, overflow: 'hidden', borderRadius: 10, background: 'var(--surface-2)', backgroundImage: 'radial-gradient(circle, var(--line) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
    >
      <svg
        ref={svgRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, cursor: tool === 'pen' ? 'crosshair' : 'default', pointerEvents: tool === 'pen' ? 'all' : 'none' }}
        onMouseDown={tool === 'pen' ? handleCanvasMouseDown : undefined}
        onMouseMove={tool === 'pen' ? handleMouseMove : undefined}
        onMouseUp={tool === 'pen' ? handleMouseUp : undefined}
        onMouseLeave={handleMouseUp}
      >
        {strokes.map((s, i) => (
          <path key={i} d={toPath(s.points)} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {drawing && livePoints.length > 1 && (
          <path d={toPath(livePoints)} fill="none" stroke={`oklch(0.40 0.14 ${hue})`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>

      <div
        style={{ position: 'absolute', inset: 0, zIndex: 2, cursor: tool !== 'pen' ? (tool === 'pointer' ? 'default' : 'crosshair') : 'none' }}
        onMouseDown={tool !== 'pen' ? handleCanvasMouseDown : undefined}
      >
        {widgets.map(w => (
          <WidgetCard
            key={w.id} widget={w} hue={hue}
            selected={selectedId === w.id}
            onSelect={handleSelectWidget}
            onMove={handleMoveWidget}
            onUpdate={onUpdateWidget}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Outline view ──────────────────────────────────────────── */

function OutlineView({ widgets, hue }: { widgets: Widget[]; hue: number }) {
  const groups: Record<WidgetType, Widget[]> = { goal: [], sticky: [], checklist: [], file: [], text: [] };
  for (const w of widgets) groups[w.type].push(w);
  const order: WidgetType[] = ['goal', 'checklist', 'sticky', 'text', 'file'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {order.filter(t => groups[t].length > 0).map(type => (
        <div key={type}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-4)', marginBottom: 8 }}>
            {type === 'goal' ? '🎯 Goals' : type === 'checklist' ? '☑ Checklists' : type === 'sticky' ? '📝 Stickies' : type === 'text' ? 'T Text Notes' : '📁 Files'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groups[type].map(w => (
              <div key={w.id} style={{ padding: '10px 14px', background: 'white', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13 }}>
                {type === 'goal' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{w.label}</div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${w.progress ?? 0}%`, background: 'var(--ok)', borderRadius: 2 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{w.progress ?? 0}%</span>
                  </div>
                )}
                {type === 'checklist' && (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12, color: 'var(--ink-3)' }}>
                      {(w.items ?? []).filter(i => i.done).length}/{(w.items ?? []).length} done
                    </div>
                    {(w.items ?? []).map((it, i) => (
                      <div key={i} style={{ fontSize: 12, color: it.done ? 'var(--ink-4)' : 'var(--ink)', textDecoration: it.done ? 'line-through' : 'none', marginBottom: 3 }}>
                        {it.done ? '✓' : '○'} {it.text}
                      </div>
                    ))}
                  </div>
                )}
                {(type === 'sticky' || type === 'text') && (
                  <div style={{ color: 'var(--ink-2)', lineHeight: 1.5 }}>{w.text}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {widgets.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '40px 20px', fontSize: 13 }}>
          No items yet. Switch to Board view and add widgets.
        </div>
      )}
    </div>
  );
}

/* ─── Timeline view ─────────────────────────────────────────── */

function TimelineView({ areas, boards }: { areas: typeof PLAN_AREAS; boards: typeof SEED_BOARDS }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const currentMonth = now.getMonth();

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr>
            <th style={{ width: 130, padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>Area</th>
            {months.map((m, i) => (
              <th key={m} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: i === currentMonth ? 'var(--accent-ink)' : 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)', background: i === currentMonth ? 'var(--accent-soft)' : 'transparent' }}>
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {areas.map((area, ai) => {
            const widgets = boards[area.id]?.widgets ?? [];
            const goals = widgets.filter(w => w.type === 'goal');
            const barStart = (ai * 2) % 8;
            const barLen = 3 + (ai % 3);
            return (
              <tr key={area.id} style={{ borderBottom: '1px solid var(--line-2)' }}>
                <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{area.glyph}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{area.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{goals.length} goal{goals.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </td>
                {months.map((_, mi) => {
                  const inBar = mi >= barStart && mi < barStart + barLen;
                  const isStart = mi === barStart;
                  const isEnd = mi === barStart + barLen - 1;
                  return (
                    <td key={mi} style={{ padding: '8px 4px', background: mi === currentMonth ? 'var(--accent-soft)' : 'transparent' }}>
                      {inBar && (
                        <div style={{
                          height: 20, background: `oklch(0.78 0.10 ${area.hue})`,
                          borderRadius: isStart && isEnd ? 4 : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : 0,
                          margin: '0 2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isStart && <span style={{ fontSize: 9, fontWeight: 700, color: `oklch(0.30 0.12 ${area.hue})`, paddingLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden' }}>{area.label}</span>}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────── */

export default function PlanningClient() {
  const [activeAreaId, setActiveAreaId] = useState(PLAN_AREAS[0].id);
  const [view, setView] = useState<ViewMode>('board');
  const [tool, setTool] = useState<Tool>('pointer');
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [boards, setBoards] = useState(SEED_BOARDS);

  const area = PLAN_AREAS.find(a => a.id === activeAreaId)!;
  const board = boards[activeAreaId] ?? { widgets: [], strokes: [] };

  const handleMoveWidget = useCallback((id: string, x: number, y: number) => {
    setBoards(prev => ({
      ...prev,
      [activeAreaId]: {
        ...prev[activeAreaId],
        widgets: prev[activeAreaId].widgets.map(w => w.id === id ? { ...w, x, y } : w),
      },
    }));
  }, [activeAreaId]);

  const handleUpdateWidget = useCallback((id: string, patch: Partial<Widget>) => {
    setBoards(prev => ({
      ...prev,
      [activeAreaId]: {
        ...prev[activeAreaId],
        widgets: prev[activeAreaId].widgets.map(w => w.id === id ? { ...w, ...patch } : w),
      },
    }));
  }, [activeAreaId]);

  const handleAddWidget = useCallback((w: Widget) => {
    setBoards(prev => ({
      ...prev,
      [activeAreaId]: { ...prev[activeAreaId], widgets: [...prev[activeAreaId].widgets, { ...w, areaId: activeAreaId }] },
    }));
    setTool('pointer');
  }, [activeAreaId]);

  const handleAddStroke = useCallback((s: Stroke) => {
    setBoards(prev => ({
      ...prev,
      [activeAreaId]: { ...prev[activeAreaId], strokes: [...prev[activeAreaId].strokes, s] },
    }));
  }, [activeAreaId]);

  const handleDeleteSelected = () => {
    if (!selectedWidgetId) return;
    setBoards(prev => ({
      ...prev,
      [activeAreaId]: { ...prev[activeAreaId], widgets: prev[activeAreaId].widgets.filter(w => w.id !== selectedWidgetId) },
    }));
    setSelectedWidgetId(null);
  };

  return (
    <div className="page-fade" style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* ── Briefing bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', marginBottom: 14, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          {PLAN_AREAS.map(a => (
            <button
              key={a.id}
              onClick={() => { setActiveAreaId(a.id); setSelectedWidgetId(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: activeAreaId === a.id ? 700 : 500,
                background: activeAreaId === a.id ? `oklch(0.94 0.05 ${a.hue})` : 'white',
                border: `1.5px solid ${activeAreaId === a.id ? `oklch(0.82 0.10 ${a.hue})` : 'var(--line)'}`,
                color: activeAreaId === a.id ? `oklch(0.35 0.14 ${a.hue})` : 'var(--ink-2)',
                boxShadow: activeAreaId === a.id ? 'var(--sh-1)' : 'none',
                transition: 'all 0.13s',
                cursor: 'pointer',
              }}
            >
              <span>{a.glyph}</span>
              <span>{a.label}</span>
              <Sparkline values={a.spark} hue={a.hue} />
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {(['board', 'outline', 'timeline'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={view === v ? 'btn btn-sm btn-acc' : 'btn btn-sm btn-sec'}
              style={{ textTransform: 'capitalize' }}>
              {v === 'board' ? '⊞ Board' : v === 'outline' ? '≡ Outline' : '⊟ Timeline'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* Left: workspace */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Toolbar (board only) */}
          {view === 'board' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {TOOLS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  title={t.label}
                  style={{
                    width: 34, height: 34, borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: tool === t.id ? `oklch(0.94 0.05 ${area.hue})` : 'white',
                    border: `1.5px solid ${tool === t.id ? `oklch(0.82 0.10 ${area.hue})` : 'var(--line)'}`,
                    color: tool === t.id ? `oklch(0.35 0.14 ${area.hue})` : 'var(--ink-3)',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}>
                  {t.icon}
                </button>
              ))}
              {selectedWidgetId && (
                <button onClick={handleDeleteSelected}
                  className="btn btn-sm"
                  style={{ marginLeft: 8, background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)', border: '1px solid oklch(0.85 0.10 25)' }}>
                  🗑 Delete
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-4)' }}>
                {board.widgets.length} widget{board.widgets.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* View */}
          <div className="card" style={{ flex: 1, overflow: view === 'board' ? 'hidden' : 'auto', padding: view === 'board' ? 0 : 18 }}>
            {view === 'board' && (
              <Canvas
                widgets={board.widgets} strokes={board.strokes}
                selectedId={selectedWidgetId} tool={tool} hue={area.hue}
                onSelect={setSelectedWidgetId}
                onMoveWidget={handleMoveWidget}
                onUpdateWidget={handleUpdateWidget}
                onAddWidget={handleAddWidget}
                onAddStroke={handleAddStroke}
              />
            )}
            {view === 'outline' && <OutlineView widgets={board.widgets} hue={area.hue} />}
            {view === 'timeline' && <TimelineView areas={PLAN_AREAS} boards={boards} />}
          </div>
        </div>

        {/* Right rail */}
        <div style={{ width: 256, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Plan brief */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>{area.glyph}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{area.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Owner: {area.owner}</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{area.objective}</p>
            {area.contributors.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {area.contributors.map(c => (
                  <span key={c} className="bdg bdg-gy" style={{ fontSize: 10 }}>{c}</span>
                ))}
              </div>
            )}
          </div>

          {/* KPIs */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-4)', marginBottom: 12 }}>KPIs</div>
            {area.kpis.map(k => (
              <KpiBar key={k.label} {...k} hue={area.hue} />
            ))}
          </div>

          {/* WISE nudges */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-4)', marginBottom: 10 }}>💡 WISE Nudges</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {area.nudges.map((n, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>→</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>{n}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Board summary */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-4)', marginBottom: 10 }}>Board</div>
            {(['goal', 'checklist', 'sticky', 'text'] as WidgetType[]).map(type => {
              const count = board.widgets.filter(w => w.type === type).length;
              const label = type === 'goal' ? 'Goals' : type === 'checklist' ? 'Checklists' : type === 'sticky' ? 'Stickies' : 'Notes';
              const icon = type === 'goal' ? '🎯' : type === 'checklist' ? '☑' : type === 'sticky' ? '📝' : 'T';
              return (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--ink-3)' }}>{icon} {label}</span>
                  <span style={{ fontWeight: 700, color: count > 0 ? 'var(--ink)' : 'var(--ink-5)' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
