'use client';

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FOUNDER, HEAD, LOBBY, WORLD, suckerFraction, type HqLayout } from '@/lib/aiAgents/layout';
import { ACTIVITY_META, EVENT_META, type Activity, type Agent, type EventKind } from '@/lib/aiAgents/types';

export type CanvasFocus = { kind: 'fit' } | { kind: 'arm'; index: number } | { kind: 'agent'; id: string };
export type PulseSpec = { id: string; agentId: string; kind: EventKind };
export type BubbleSpec = { id: string; agentId: string; kind: EventKind; text: string; sim?: boolean };

type View = { k: number; tx: number; ty: number };
type Segment = { key: string; path: string; from: number; to: number; delay: number; dur: number; arm: number | null; color: string };

const UP: EventKind[] = ['review', 'done'];

const PULSE_COLOR: Partial<Record<EventKind, string>> = {
  request: '#e9d5ff', directive: '#c4b5fd', handoff: '#67e8f9', revision: '#fb7185', review: '#fbbf24', done: '#34d399',
};

/** Short badge for a title: "Chief Marketing Officer" → "CMO". */
export function roleTag(a: Agent) {
  if (/^chief\b/i.test(a.title)) return a.title.split(/\s+/).map(w => w[0]).join('').toUpperCase();
  if (a.tier === 'ceo') return 'CEO';
  return a.title || a.tier;
}

/** Break a pulse into legs: founder → brain → exec → down the arm (or the reverse). */
function pulseSegments(layout: HqLayout, p: PulseSpec): Segment[] {
  const pos = layout.pos[p.agentId];
  if (!pos) return [];
  const color = PULSE_COLOR[p.kind] ?? '#c4b5fd';
  const legs: Omit<Segment, 'delay' | 'key'>[] = [];
  const b = HEAD.brain;
  if (p.kind === 'request') {
    legs.push({ path: `M ${FOUNDER.x} ${FOUNDER.y} Q ${(FOUNDER.x + b.x) / 2} ${FOUNDER.y - 60} ${b.x} ${b.y}`, from: 0, to: 1, dur: 1.1, arm: null, color });
  }
  if (pos.arm !== null) {
    const arm = layout.arms[pos.arm];
    const s = suckerFraction(arm, p.agentId);
    const head = { path: layout.headPath(pos.arm), from: 0, to: 1, dur: 0.9, arm: null, color };
    const down = { path: arm.spine, from: 0, to: s, dur: 0.6 + s * 1.1, arm: pos.arm, color };
    if (UP.includes(p.kind)) {
      // Work travels up to the manager's desk, then (for approvals) back to the brain.
      const mgr = arm.suckers.find(x => x.agentId)?.s ?? 0;
      legs.push({ ...down, from: s, to: Math.min(mgr, s) });
      if (p.kind === 'done') legs.push({ ...head, from: 1, to: 0 });
    } else {
      legs.push(head, down);
    }
  } else if (layout.execs.some(e => e.id === p.agentId)) {
    legs.push({ path: `M ${b.x} ${b.y} L ${pos.x} ${pos.y}`, from: UP.includes(p.kind) ? 1 : 0, to: UP.includes(p.kind) ? 0 : 1, dur: 0.8, arm: null, color });
  }
  let t = 0;
  return legs.map((l, i) => {
    const seg = { ...l, key: `${p.id}-${i}`, delay: t };
    t += l.dur;
    return seg;
  });
}

const Pulse = memo(function Pulse({ seg }: { seg: Segment }) {
  const circle = useRef<SVGCircleElement>(null);
  const anim = useRef<SVGAnimateMotionElement>(null);
  const motionId = `agp${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (circle.current) circle.current.style.visibility = 'visible';
      anim.current?.beginElement();
    }, seg.delay * 1000);
    return () => window.clearTimeout(id);
  }, [seg.delay]);
  return (
    <g>
      <circle ref={circle} r={6} fill={seg.color} className="ag-pulse" style={{ visibility: 'hidden' }}>
        <animateMotion
          ref={anim}
          id={motionId}
          path={seg.path}
          dur={`${seg.dur}s`}
          begin="indefinite"
          fill="freeze"
          calcMode="linear"
          keyPoints={`${seg.from};${seg.to}`}
          keyTimes="0;1"
        />
        <animate attributeName="opacity" from="1" to="0" begin={`${motionId}.end`} dur="0.35s" fill="freeze" />
      </circle>
    </g>
  );
});

// Background windows: a fixed pseudo-random pattern so it does not jump between renders.
const WINDOWS = (() => {
  const out: { x: number; y: number; lit: boolean; d: number }[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (const col of [34, 58, 1518, 1542]) {
    for (let y = 360; y < 1050; y += 26) out.push({ x: col, y, lit: rnd() > 0.55, d: rnd() * 6 });
  }
  return out;
})();

export default function HqCanvas({
  layout, agents, hueOf, activityOf, taskOf, revisionCount, queuedCount,
  selectedId, onSelect, focus, pulses, bubbles, simOn, simAvailable, onToggleSim, preview,
}: {
  layout: HqLayout;
  agents: Record<string, Agent>;
  hueOf: (id: string) => number;
  activityOf: (id: string) => Activity | 'offline';
  taskOf: (id: string) => string;
  revisionCount: Record<string, number>;
  queuedCount: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  focus: { target: CanvasFocus; nonce: number } | null;
  pulses: PulseSpec[];
  bubbles: BubbleSpec[];
  simOn: boolean;
  simAvailable: boolean;
  onToggleSim: () => void;
  preview: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ k: 0.5, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  useLayoutEffect(() => { viewRef.current = view; }, [view]);
  const anim = useRef<number | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const [hover, setHover] = useState<string | null>(null);
  const fitted = useRef(false);

  // ── Sizing ──
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clampK = useCallback((k: number) => {
    const fit = Math.min(size.w / WORLD.w, size.h / WORLD.h) || 0.5;
    return Math.min(3.2, Math.max(fit * 0.7, k));
  }, [size]);

  const targetView = useCallback((t: CanvasFocus): View => {
    const { w, h } = size;
    if (t.kind === 'arm' && layout.arms[t.index]) {
      const b = layout.arms[t.index].bbox;
      const k = clampK(Math.min(1.7, Math.min(w / b.w, h / b.h) * 0.95));
      return { k, tx: w / 2 - (b.x + b.w / 2) * k, ty: h / 2 - (b.y + b.h / 2) * k };
    }
    if (t.kind === 'agent' && layout.pos[t.id]) {
      const p = layout.pos[t.id];
      const k = clampK(1.3);
      return { k, tx: w / 2 - p.x * k, ty: h / 2 - p.y * k };
    }
    const k = Math.min(w / WORLD.w, h / WORLD.h) * 0.97;
    return { k, tx: (w - WORLD.w * k) / 2, ty: (h - WORLD.h * k) / 2 };
  }, [size, layout, clampK]);

  const animateTo = useCallback((to: View) => {
    if (anim.current) cancelAnimationFrame(anim.current);
    const from = viewRef.current;
    const t0 = performance.now();
    const D = 520;
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / D);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      setView({ k: from.k + (to.k - from.k) * e, tx: from.tx + (to.tx - from.tx) * e, ty: from.ty + (to.ty - from.ty) * e });
      anim.current = u < 1 ? requestAnimationFrame(tick) : null;
    };
    anim.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!size.w || !size.h) return;
    if (!fitted.current) {
      fitted.current = true;
      setView(targetView({ kind: 'fit' }));
    }
  }, [size, targetView]);

  useEffect(() => {
    if (focus && size.w) animateTo(targetView(focus.target));
  }, [focus, animateTo, targetView, size.w]);

  // ── Wheel zoom around the cursor (non-passive so the page does not scroll) ──
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (anim.current) { cancelAnimationFrame(anim.current); anim.current = null; }
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const v = viewRef.current;
      const k = clampK(v.k * Math.exp(-e.deltaY * 0.0015));
      setView({ k, tx: cx - ((cx - v.tx) * k) / v.k, ty: cy - ((cy - v.ty) * k) / v.k });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampK]);

  const zoomBy = (f: number) => {
    const v = viewRef.current;
    const k = clampK(v.k * f);
    const cx = size.w / 2, cy = size.h / 2;
    animateTo({ k, tx: cx - ((cx - v.tx) * k) / v.k, ty: cy - ((cy - v.ty) * k) / v.k });
  };

  // ── Drag to pan. Capture only once it is really a drag, so clicks still land on desks. ──
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true;
      if (anim.current) { cancelAnimationFrame(anim.current); anim.current = null; }
      (e.currentTarget as Element).setPointerCapture(d.id);
    }
    if (d.moved) setView(v => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }));
  };
  const onPointerUp = () => {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
  };
  // A drag that ends over a desk should not also select it.
  const guard = (fn: () => void) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    fn();
  };

  const { k, tx, ty } = view;
  const lod = k < 0.78 ? 'far' : k < 1.25 ? 'mid' : 'near';
  const fs = (world: number, minPx: number) => Math.max(world, minPx / k);
  // Desk labels hold a steady on-screen size, so zooming in adds room rather than bigger text.
  const px = (n: number) => n / k;
  const toScreen = (x: number, y: number) => ({ left: x * k + tx, top: y * k + ty });

  const segments = useMemo(() => pulses.flatMap(p => pulseSegments(layout, p)), [pulses, layout]);
  const flashing = useMemo(() => {
    const s = new Set<number>();
    for (const p of pulses) { const a = layout.pos[p.agentId]?.arm; if (a !== null && a !== undefined) s.add(a); }
    return s;
  }, [pulses, layout]);

  const renderDesk = (id: string, x: number, y: number, r: number, labelBelow = true) => {
    const a = agents[id];
    if (!a) return null;
    const act = activityOf(id);
    const color = ACTIVITY_META[act].color;
    const hue = hueOf(id);
    const revs = revisionCount[id] ?? 0;
    const queued = queuedCount[id] ?? 0;
    const sel = selectedId === id;
    const showName = a.tier === 'exec' || a.tier === 'manager' ? lod !== 'far' || a.tier === 'exec' : lod !== 'far';
    const task = taskOf(id);
    return (
      <g
        key={id}
        className={`ag-desk ag-act-${act}${sel ? ' ag-sel' : ''}`}
        transform={`translate(${x} ${y})`}
        onClick={() => guard(() => onSelect(id))}
        onPointerEnter={() => setHover(id)}
        onPointerLeave={() => setHover(h => (h === id ? null : h))}
      >
        <circle className="ag-halo" r={r + 7} fill={color} />
        <circle r={r} fill="#140f26" stroke={color} strokeWidth={Math.max(2.5, r * 0.16)} />
        <circle r={r * 0.56} fill={`hsl(${hue} 70% ${act === 'offline' ? 30 : 62}%)`} opacity={act === 'idle' ? 0.45 : 0.95} />
        {act === 'working' && <circle className="ag-spin" r={r + 3} fill="none" stroke={color} strokeWidth={2} strokeDasharray={`${r * 0.9} ${r * 5}`} />}
        {sel && <circle className="ag-spin-slow" r={r + 11} fill="none" stroke="#fff" strokeWidth={1.6} strokeDasharray="5 5" />}
        {revs > 0 && (
          <g transform={`translate(${r * 0.78} ${-r * 0.78})`} className="ag-rev-badge">
            <circle r={8} fill="#fb7185" stroke="#140f26" strokeWidth={2} />
            <text textAnchor="middle" dy="3.4" fontSize={9.5} fontWeight={800} fill="#1a0b12">{revs}</text>
          </g>
        )}
        {queued > 0 && (
          <g transform={`translate(${-r * 0.78} ${-r * 0.78})`}>
            <circle r={7.5} fill="#e9d5ff" stroke="#140f26" strokeWidth={2} />
            <text textAnchor="middle" dy="3.2" fontSize={9} fontWeight={800} fill="#2e1065">{queued}</text>
          </g>
        )}
        {showName && labelBelow && (
          <text className="ag-lbl" y={r + px(15)} textAnchor="middle" fontSize={px(a.tier === 'specialist' ? 11.5 : 12.5)} fontWeight={700}>
            {a.tier === 'exec' ? `${roleTag(a)} · ${a.name}` : a.name}
          </text>
        )}
        {labelBelow && (sel || hover === id || (lod === 'near' && k >= 1.9)) && (
          <text className="ag-lbl ag-lbl-dim" y={r + px(28)} textAnchor="middle" fontSize={px(10.5)}>
            {(task || a.title).slice(0, 38)}{(task || a.title).length > 38 ? '…' : ''}
          </text>
        )}
      </g>
    );
  };

  const ceo = layout.ceoId ? agents[layout.ceoId] : null;
  const hovered = hover ? agents[hover] : null;
  const hoverPos = hover ? layout.pos[hover] : null;

  return (
    <div
      ref={wrap}
      className={`ag-canvas ag-lod-${lod}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* The scene is sized from the measured container, so it only renders in the browser. */}
      {size.w > 0 && <svg width="100%" height="100%" role="img" aria-label="Octopus Engines HQ: the agent team as an octopus inside the company building">
        <defs>
          <radialGradient id="agBg" cx="50%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#1d1846" />
            <stop offset="55%" stopColor="#0d0b24" />
            <stop offset="100%" stopColor="#07060f" />
          </radialGradient>
          <linearGradient id="agMantle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="60%" stopColor="#6d28d9" />
            <stop offset="100%" stopColor="#4c1d95" />
          </linearGradient>
          <linearGradient id="agArm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6d28d9" />
            <stop offset="100%" stopColor="#3b0f7a" />
          </linearGradient>
          <radialGradient id="agBrain" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#fdf4ff" />
            <stop offset="45%" stopColor="#f0abfc" />
            <stop offset="100%" stopColor="#a855f7" />
          </radialGradient>
          <radialGradient id="agGlow">
            <stop offset="0%" stopColor="#e879f9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="agRay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g transform={`translate(${tx} ${ty}) scale(${k})`}>
          {/* ── The building ── */}
          <rect x={0} y={0} width={WORLD.w} height={WORLD.h} rx={28} fill="url(#agBg)" />
          <rect x={14} y={14} width={WORLD.w - 28} height={WORLD.h - 28} rx={22} fill="none" stroke="#2a2458" strokeWidth={3} />
          {[340, 580, 820].map(y => (
            <line key={y} x1={80} x2={WORLD.w - 80} y1={y} y2={y} stroke="#221d4a" strokeWidth={2} strokeDasharray="2 10" />
          ))}
          {WINDOWS.map((w, i) => (
            <rect key={i} x={w.x - 8} y={w.y} width={16} height={14} rx={2}
              className={w.lit ? 'ag-win-lit' : undefined}
              style={w.lit ? { animationDelay: `${w.d}s` } : undefined}
              fill={w.lit ? '#fde68a' : '#1a1640'} />
          ))}
          <g className="ag-rays">
            <polygon points="760,20 840,20 1060,1080 540,1080" fill="url(#agRay)" />
            <polygon points="700,20 730,20 420,1080 250,1080" fill="url(#agRay)" opacity="0.6" />
            <polygon points="870,20 900,20 1350,1080 1180,1080" fill="url(#agRay)" opacity="0.6" />
          </g>

          <text x={60} y={78} fontSize={34} fontWeight={800} fill="#ede9fe" letterSpacing="6">OCTOPUS ENGINES</text>
          <text x={62} y={102} fontSize={12} fill="#8b80c9" letterSpacing="4">HEADQUARTERS · OPEN 24/7</text>

          {/* ── Lobby (agents without a department) ── */}
          {layout.lobby.length > 0 && (
            <g>
              <rect x={LOBBY.x} y={LOBBY.y} width={LOBBY.w} height={LOBBY.h} rx={16} fill="#120f2c" stroke="#2f2866" strokeDasharray="6 6" />
              <text x={LOBBY.x + 18} y={LOBBY.y + 30} fontSize={fs(13, 10)} fill="#a5a0d6" fontWeight={700}>Unassigned desks</text>
              <text x={LOBBY.x + 18} y={LOBBY.y + 48} fontSize={fs(10, 8)} fill="#6b64a3">Give these agents a department</text>
              {layout.lobby.map(l => renderDesk(l.id, l.x, l.y, 14))}
            </g>
          )}

          {/* ── Founder's office ── */}
          <g>
            <rect x={FOUNDER.x - 120} y={FOUNDER.y - 56} width={240} height={112} rx={18} fill="#1a1440" stroke="#7c3aed" strokeWidth={2} />
            <circle cx={FOUNDER.x - 76} cy={FOUNDER.y} r={24} fill="#2e1065" stroke="#e9d5ff" strokeWidth={2.5} />
            <text x={FOUNDER.x - 76} y={FOUNDER.y + 7} textAnchor="middle" fontSize={20} fill="#f5d0fe">★</text>
            <text x={FOUNDER.x - 40} y={FOUNDER.y - 6} fontSize={fs(17, 10)} fontWeight={800} fill="#f5f3ff">Founder&apos;s office</text>
            <text x={FOUNDER.x - 40} y={FOUNDER.y + 16} fontSize={fs(11, 8)} fill="#a78bfa">Requests start here</text>
          </g>

          {/* ── Arms ── */}
          {layout.arms.map(arm => (
            <g
              key={arm.dept.key}
              className={`ag-arm${flashing.has(arm.index) ? ' ag-arm-flash' : ''}`}
              style={{ transformOrigin: `${arm.base.x}px ${arm.base.y}px`, animationDelay: `${arm.swayDelay}s` }}
            >
              <path d={arm.outline} fill="url(#agArm)" stroke={`hsl(${arm.dept.hue} 80% 70% / 0.35)`} strokeWidth={2}
                className="ag-arm-body" onClick={() => guard(() => animateTo(targetView({ kind: 'arm', index: arm.index })))} />
              {arm.suckers.filter(s => !s.agentId).map((s, i) => (
                <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#c4b5fd" opacity={0.28} />
              ))}
              {arm.suckers.filter(s => s.agentId).map(s => renderDesk(s.agentId!, s.x, s.y, s.r))}
              {segments.filter(sg => sg.arm === arm.index).map(sg => <Pulse key={sg.key} seg={sg} />)}
            </g>
          ))}

          {/* ── Neural links inside the head ── */}
          <path d={HEAD.mantle} fill="url(#agMantle)" stroke="#c4b5fd" strokeOpacity={0.4} strokeWidth={2.5} />
          {[[700, 150, 14], [905, 170, 10], [660, 300, 12], [945, 290, 15], [760, 110, 7], [860, 440, 9]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#a78bfa" opacity={0.22} />
          ))}
          {layout.execs.map(e => (
            <path key={e.id} d={`M ${HEAD.brain.x} ${HEAD.brain.y} L ${e.x} ${e.y}`} stroke="#f0abfc" strokeOpacity={0.55} strokeWidth={2.5} className="ag-neural" fill="none" />
          ))}
          {layout.arms.map(arm => (
            <path key={arm.dept.key} d={layout.headPath(arm.index)} stroke={`hsl(${arm.dept.hue} 85% 72%)`} strokeOpacity={0.35} strokeWidth={1.6} className="ag-neural" fill="none" />
          ))}
          {segments.filter(sg => sg.arm === null).map(sg => <Pulse key={sg.key} seg={sg} />)}

          {/* ── The brain (CEO) ── */}
          <circle cx={HEAD.brain.x} cy={HEAD.brain.y} r={120} fill="url(#agGlow)" className="ag-brain-glow" />
          {ceo ? (
            <g className={`ag-brain${selectedId === ceo.id ? ' ag-sel' : ''}`} onClick={() => guard(() => onSelect(ceo.id))}
              onPointerEnter={() => setHover(ceo.id)} onPointerLeave={() => setHover(h => (h === ceo.id ? null : h))}>
              <path d="M 800 150 C 760 138, 728 160, 732 190 C 712 204, 716 240, 744 250 C 752 268, 784 272, 800 258 Z" fill="url(#agBrain)" />
              <path d="M 800 150 C 840 138, 872 160, 868 190 C 888 204, 884 240, 856 250 C 848 268, 816 272, 800 258 Z" fill="url(#agBrain)" />
              <path d="M 800 152 L 800 258 M 752 184 C 768 176, 780 196, 790 186 M 746 222 C 762 212, 778 234, 792 222 M 848 184 C 832 176, 820 196, 810 186 M 854 222 C 838 212, 822 234, 808 222 M 770 246 C 780 238, 790 250, 796 242 M 830 246 C 820 238, 810 250, 804 242"
                stroke="#86198f" strokeOpacity={0.55} strokeWidth={3} fill="none" strokeLinecap="round" />
              <text x={HEAD.brain.x} y={HEAD.brain.y + 92} textAnchor="middle" fontSize={Math.min(fs(15, 11), px(15))} fontWeight={800} className="ag-lbl">CEO · {ceo.name}</text>
            </g>
          ) : (
            <text x={HEAD.brain.x} y={HEAD.brain.y + 8} textAnchor="middle" fontSize={14} fill="#f5d0fe">No CEO yet</text>
          )}

          {/* ── Executives ── */}
          {layout.execs.map(e => renderDesk(e.id, e.x, e.y, 30))}

          {/* ── Department labels at the tips ── */}
          {layout.arms.map(arm => (
            <g key={arm.dept.key} className="ag-dept-lbl" onClick={() => guard(() => animateTo(targetView({ kind: 'arm', index: arm.index })))}>
              <text x={arm.label.x} y={arm.label.y} textAnchor={arm.label.anchor} fontSize={Math.min(fs(19, 11), px(17))} fontWeight={800}
                fill={`hsl(${arm.dept.hue} 90% 78%)`} className="ag-lbl">{arm.dept.name}</text>
              <text x={arm.label.x} y={arm.label.y + Math.min(fs(19, 11), px(17)) + 2} textAnchor={arm.label.anchor} fontSize={Math.min(fs(11, 9), px(11))} className="ag-lbl ag-lbl-dim">
                {(() => {
                  const ids = arm.suckers.filter(s => s.agentId).map(s => s.agentId!);
                  const busy = ids.filter(id => { const a = activityOf(id); return a !== 'idle' && a !== 'offline'; }).length;
                  return `${busy}/${ids.length} active`;
                })()}
              </text>
            </g>
          ))}
        </g>
      </svg>}

      {/* ── Pop-up notifications anchored to the desk they are about ── */}
      {bubbles.map(b => {
        const p = layout.pos[b.agentId];
        if (!p) return null;
        const s = toScreen(p.x, p.y - p.r - 6);
        if (s.left < -40 || s.top < 0 || s.left > size.w + 40 || s.top > size.h + 60) return null;
        return (
          <div key={b.id} className={`ag-bubble ag-bubble-${b.kind}`} style={{ left: s.left, top: s.top }}>
            <span className="ag-bubble-tag">{EVENT_META[b.kind].icon} {EVENT_META[b.kind].label}{b.sim ? ' · sample' : ''}</span>
            {b.text}
          </div>
        );
      })}

      {/* ── Hover card ── */}
      {hovered && hoverPos && (() => {
        const s = toScreen(hoverPos.x, hoverPos.y + hoverPos.r + 8);
        const act = activityOf(hovered.id);
        const task = taskOf(hovered.id);
        return (
          <div className="ag-hovercard" style={{ left: s.left, top: s.top }}>
            <div className="ag-hc-name">{hovered.name} <span>{hovered.title}</span></div>
            <div className="ag-hc-act"><i style={{ background: ACTIVITY_META[act].color }} />{ACTIVITY_META[act].label}</div>
            {task && <div className="ag-hc-task">{task}</div>}
          </div>
        );
      })()}

      {/* ── Overlays ── */}
      <div className="ag-ctl">
        <button type="button" onClick={() => zoomBy(1.35)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomBy(1 / 1.35)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => animateTo(targetView({ kind: 'fit' }))} aria-label="Fit whole building">⤢</button>
      </div>

      <div className="ag-legend">
        {(['working', 'reviewing', 'revising', 'blocked', 'idle'] as const).map(a => (
          <span key={a}><i style={{ background: ACTIVITY_META[a].color }} />{ACTIVITY_META[a].label}</span>
        ))}
      </div>

      <div className="ag-topleft">
        {preview && <span className="ag-chip ag-chip-warn">Preview org · not staffed yet</span>}
        {simAvailable && (
          <button type="button" className={`ag-chip ag-sim-btn${simOn ? ' on' : ''}`} onClick={onToggleSim}
            title="Sample activity generated in your browser. Nothing is written.">
            <i />{simOn ? 'Simulation on · sample activity' : 'Simulation off'}
          </button>
        )}
      </div>
    </div>
  );
}
