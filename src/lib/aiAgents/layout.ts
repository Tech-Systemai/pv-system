import type { Agent, Department } from './types';

// World coordinates for the HQ scene. Everything is laid out in a fixed
// 1600×1100 space; the canvas pans and zooms over it.
export const WORLD = { w: 1600, h: 1100 };

export const HEAD = {
  cx: 800,
  brain: { x: 800, y: 205 },
  // Mantle outline: a tall bulb whose lower rim is where the arms attach.
  mantle: 'M 628 468 C 548 402, 560 92, 800 70 C 1040 92, 1052 402, 972 468 C 930 492, 670 492, 628 468 Z',
};

export const FOUNDER = { x: 1360, y: 150 };
export const LOBBY = { x: 90, y: 118, w: 300, h: 190 };

type Pt = { x: number; y: number };

export type Sucker = {
  agentId: string | null;
  x: number;
  y: number;
  r: number;
  /** Arc-length fraction along the arm, 0 at the head. */
  s: number;
};

export type ArmLayout = {
  dept: Department;
  index: number;
  execId: string | null;
  base: Pt;
  tip: Pt;
  /** Filled, tapered outline. */
  outline: string;
  /** Centre line from base to tip, used for pulses. */
  spine: string;
  suckers: Sucker[];
  label: Pt & { anchor: 'start' | 'middle' | 'end' };
  swayDelay: number;
  bbox: { x: number; y: number; w: number; h: number };
};

export type NodePos = { x: number; y: number; r: number; arm: number | null };

export type HqLayout = {
  ceoId: string | null;
  execs: { id: string; x: number; y: number }[];
  arms: ArmLayout[];
  lobby: { id: string; x: number; y: number }[];
  pos: Record<string, NodePos>;
  /** Head-side path a pulse travels from the brain to an arm's base. */
  headPath: (armIndex: number) => string;
};

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function armWidth(s: number) {
  return 8 + 58 * Math.pow(1 - s, 0.85);
}

export function buildLayout(agents: Agent[], departments: Department[]): HqLayout {
  const pos: Record<string, NodePos> = {};
  const byOrder = (a: Agent, b: Agent) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

  const ceo = agents.filter(a => a.tier === 'ceo').sort(byOrder)[0] ?? null;
  if (ceo) pos[ceo.id] = { x: HEAD.brain.x, y: HEAD.brain.y, r: 46, arm: null };

  // ── Executives sit across the lower head ──
  const execAgents = agents.filter(a => a.tier === 'exec' || (a.tier === 'ceo' && a.id !== ceo?.id)).sort(byOrder);
  const n = execAgents.length;
  const spacing = n > 1 ? Math.min(100, 300 / (n - 1)) : 0;
  const execs = execAgents.map((a, i) => {
    const off = (i - (n - 1) / 2) * spacing;
    const p = { id: a.id, x: HEAD.cx + off, y: 395 - Math.abs(off) * 0.28 };
    pos[a.id] = { x: p.x, y: p.y, r: 30, arm: null };
    return p;
  });

  // ── Arms ──
  const depts = [...departments].sort((a, b) => a.arm_order - b.arm_order);
  const N = depts.length;
  const deptKeys = new Set(depts.map(d => d.key));
  const byId = Object.fromEntries(agents.map(a => [a.id, a]));

  const arms: ArmLayout[] = depts.map((dept, i) => {
    const members = agents
      .filter(a => a.department === dept.key && (a.tier === 'manager' || a.tier === 'specialist'))
      .sort((a, b) => (a.tier === b.tier ? byOrder(a, b) : a.tier === 'manager' ? -1 : 1));
    const manager = members.find(m => m.tier === 'manager');
    const execId = manager?.reports_to && byId[manager.reports_to]?.tier !== 'specialist' ? manager.reports_to : null;

    const f = N > 1 ? i / (N - 1) : 0.5;
    const offset = (f - 0.5) * 2; // -1 … 1
    const base = { x: HEAD.cx + offset * 150, y: 462 - offset * offset * 16 };
    const ang = ((158 - 136 * f) * Math.PI) / 180;
    const d = { x: Math.cos(ang), y: Math.sin(ang) };
    const len = 560 + 110 * Math.abs(d.x);
    const tip = {
      x: Math.min(WORLD.w - 70, Math.max(70, base.x + d.x * len)),
      y: Math.min(WORLD.h - 70, base.y + d.y * len),
    };
    const nrm = { x: -d.y, y: d.x };
    const wig = (i % 2 ? 1 : -1) * 70;
    const p1 = { x: base.x + d.x * 60, y: base.y + 170 };
    const p2 = { x: base.x + d.x * len * 0.62 + nrm.x * wig, y: base.y + d.y * len * 0.62 + nrm.y * wig };

    // Sample the spine and measure it so positions are by arc length.
    const S = 64;
    const pts: Pt[] = [];
    for (let k = 0; k <= S; k++) pts.push(cubic(base, p1, p2, tip, k / S));
    const cum = [0];
    for (let k = 1; k <= S; k++) cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
    const total = cum[S];
    const at = (s: number): Pt & { nx: number; ny: number } => {
      const target = s * total;
      let k = 1;
      while (k < S && cum[k] < target) k++;
      const seg = cum[k] - cum[k - 1] || 1;
      const u = (target - cum[k - 1]) / seg;
      const x = pts[k - 1].x + (pts[k].x - pts[k - 1].x) * u;
      const y = pts[k - 1].y + (pts[k].y - pts[k - 1].y) * u;
      const tx = pts[k].x - pts[k - 1].x, ty = pts[k].y - pts[k - 1].y;
      const tl = Math.hypot(tx, ty) || 1;
      return { x, y, nx: -ty / tl, ny: tx / tl };
    };

    // Tapered outline: left edge out, rounded tip, right edge back.
    const left: string[] = [], right: string[] = [];
    for (let k = 0; k <= S; k++) {
      const s = cum[k] / total;
      const p = at(s);
      const w = armWidth(s) / 2;
      left.push(`${r1(p.x + p.nx * w)} ${r1(p.y + p.ny * w)}`);
      right.push(`${r1(p.x - p.nx * w)} ${r1(p.y - p.ny * w)}`);
    }
    const outline = `M ${left.join(' L ')} Q ${r1(tip.x + d.x * 10)} ${r1(tip.y + d.y * 10)} ${right.reverse().join(' L ')} Z`;
    const spine = `M ${pts.map(p => `${r1(p.x)} ${r1(p.y)}`).join(' L ')}`;

    // Agent desks, manager first nearest the head.
    const m = members.length;
    const slots = members.map((_, k) => (m === 1 ? 0.22 : 0.16 + (0.62 * k) / (m - 1)));
    const suckers: Sucker[] = members.map((a, k) => {
      const s = slots[k];
      const p = at(s);
      const r = a.tier === 'manager' ? 19 : Math.max(11, Math.min(15, armWidth(s) * 0.55));
      pos[a.id] = { x: p.x, y: p.y, r, arm: i };
      return { agentId: a.id, x: r1(p.x), y: r1(p.y), r, s };
    });
    // Decorative suckers fill the gaps so the arm reads as a tentacle.
    let side = 1;
    for (let s = 0.08; s < 0.97; s += 0.036) {
      if (slots.some(x => Math.abs(x - s) < 0.055)) continue;
      const p = at(s);
      const w = armWidth(s);
      side = -side;
      suckers.push({ agentId: null, x: r1(p.x + p.nx * w * 0.2 * side), y: r1(p.y + p.ny * w * 0.2 * side), r: r1(Math.max(2.2, w * 0.17)), s });
    }

    const anchor: 'start' | 'middle' | 'end' = tip.x < 420 ? 'start' : tip.x > 1180 ? 'end' : 'middle';
    const label = { x: anchor === 'start' ? tip.x - 30 : anchor === 'end' ? tip.x + 30 : tip.x, y: tip.y + 44, anchor };

    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const pad = 70;
    const bbox = {
      x: Math.min(...xs) - pad, y: Math.min(...ys) - pad,
      w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 + 40,
    };

    return { dept, index: i, execId, base, tip, outline, spine, suckers, label, swayDelay: -(i * 0.83), bbox };
  });

  // ── Lobby: agents with no department (or one that no longer exists) ──
  const lobbyAgents = agents
    .filter(a => (a.tier === 'manager' || a.tier === 'specialist') && !deptKeys.has(a.department))
    .sort(byOrder);
  const lobby = lobbyAgents.slice(0, 12).map((a, i) => {
    const p = { id: a.id, x: LOBBY.x + 40 + (i % 6) * 44, y: LOBBY.y + 92 + Math.floor(i / 6) * 50 };
    pos[a.id] = { x: p.x, y: p.y, r: 14, arm: null };
    return p;
  });

  const headPath = (armIndex: number) => {
    const arm = arms[armIndex];
    if (!arm) return '';
    const ex = execs.find(e => e.id === arm.execId);
    const b = HEAD.brain;
    if (!ex) return `M ${b.x} ${b.y} L ${arm.base.x} ${arm.base.y}`;
    return `M ${b.x} ${b.y} L ${ex.x} ${ex.y} Q ${ex.x} ${arm.base.y - 20} ${arm.base.x} ${arm.base.y}`;
  };

  return { ceoId: ceo?.id ?? null, execs, arms, lobby, pos, headPath };
}

/** Arc fraction of a desk on its arm, for stopping a pulse there. */
export function suckerFraction(arm: ArmLayout, agentId: string) {
  return arm.suckers.find(s => s.agentId === agentId)?.s ?? 1;
}
