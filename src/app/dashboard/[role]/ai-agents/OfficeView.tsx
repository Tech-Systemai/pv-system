'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LIVE_AGENTS } from '@/lib/aiAgents/org';
import { ACTIVITY_META, type Activity, type Agent, type Routine } from '@/lib/aiAgents/types';
import TaskBar, { type TaskResult } from './TaskBar';
import RoutinesPanel from './RoutinesPanel';

// An isometric picture of the floor. Nothing here is invented: an agent sits at
// a desk when it is actually working and walks around when it is not. The
// walking, chatting and hellos are only how that real state is drawn.

type Spot = { x: number; y: number };

// Isometric projection: one floor tile is TILE wide and TILE/2 tall on screen.
const TILE = 74;
const ROOM = { w: 12, h: 9 };
const iso = (x: number, y: number, z = 0) => ({ sx: (x - y) * (TILE / 2), sy: (x + y) * (TILE / 4) - z });
const pt = (x: number, y: number, z = 0) => { const p = iso(x, y, z); return `${p.sx},${p.sy}`; };

const DESKS: Spot[] = [
  { x: 2.2, y: 1.6 }, { x: 4.4, y: 1.6 }, { x: 6.6, y: 1.6 },
  { x: 2.2, y: 4.4 }, { x: 4.4, y: 4.4 }, { x: 6.6, y: 4.4 },
  { x: 2.2, y: 7.2 }, { x: 4.4, y: 7.2 }, { x: 6.6, y: 7.2 },
];
/** Where someone sits: just in front of the desk. */
const seatOf = (d: Spot): Spot => ({ x: d.x - 0.15, y: d.y + 1.05 });

const GREETINGS = ['Hey 👋', 'Morning!', 'Need anything?', 'Welcome back', 'Hey boss'];
const CHATTER = ['…', 'coffee?', 'ha', 'nice one'];
const SCREEN_COLORS = ['#38bdf8', '#fb923c', '#a78bfa', '#34d399', '#f472b6', '#facc15'];

const isBusy = (a: Activity | 'offline') => a === 'working' || a === 'reviewing' || a === 'revising';
const loungeSpot = (rnd = Math.random): Spot => ({ x: 8.8 + rnd() * 2.6, y: 1.4 + rnd() * 6.2 });

// ── Scene pieces ───────────────────────────────────────────────────────────────

function Desk({ at, screen }: { at: Spot; screen: string }) {
  const { x, y } = at;
  const H = 30;            // desk height
  const T = 5;             // how thick the top looks
  const leg = (lx: number, ly: number) => (
    <polygon key={`${lx}-${ly}`} points={`${pt(lx - 0.04, ly, H - T)} ${pt(lx + 0.04, ly, H - T)} ${pt(lx + 0.04, ly, 0)} ${pt(lx - 0.04, ly, 0)}`} fill="#c2ccd8" />
  );
  return (
    <g className="of-desk-g">
      {[leg(x - 0.8, y - 0.42), leg(x + 0.8, y - 0.42), leg(x - 0.8, y + 0.42), leg(x + 0.8, y + 0.42)]}
      {/* top */}
      <polygon points={`${pt(x - 0.9, y - 0.5, H)} ${pt(x + 0.9, y - 0.5, H)} ${pt(x + 0.9, y + 0.5, H)} ${pt(x - 0.9, y + 0.5, H)}`} fill="#fbfdff" />
      <polygon points={`${pt(x - 0.9, y + 0.5, H)} ${pt(x + 0.9, y + 0.5, H)} ${pt(x + 0.9, y + 0.5, H - T)} ${pt(x - 0.9, y + 0.5, H - T)}`} fill="#e3e9f1" />
      <polygon points={`${pt(x + 0.9, y - 0.5, H)} ${pt(x + 0.9, y + 0.5, H)} ${pt(x + 0.9, y + 0.5, H - T)} ${pt(x + 0.9, y - 0.5, H - T)}`} fill="#d5dde8" />
      {/* monitor: foot, stem, screen */}
      <polygon points={`${pt(x - 0.18, y - 0.44, H)} ${pt(x + 0.18, y - 0.44, H)} ${pt(x + 0.18, y - 0.3, H)} ${pt(x - 0.18, y - 0.3, H)}`} fill="#cbd5e1" />
      <polygon points={`${pt(x - 0.03, y - 0.38, H + 12)} ${pt(x + 0.03, y - 0.38, H + 12)} ${pt(x + 0.03, y - 0.38, H)} ${pt(x - 0.03, y - 0.38, H)}`} fill="#b9c4d2" />
      <polygon points={`${pt(x - 0.42, y - 0.38, H + 40)} ${pt(x + 0.42, y - 0.38, H + 40)} ${pt(x + 0.42, y - 0.38, H + 12)} ${pt(x - 0.42, y - 0.38, H + 12)}`} fill="#eef2f7" />
      <polygon points={`${pt(x - 0.37, y - 0.385, H + 37)} ${pt(x + 0.37, y - 0.385, H + 37)} ${pt(x + 0.37, y - 0.385, H + 15)} ${pt(x - 0.37, y - 0.385, H + 15)}`} fill={screen} opacity={0.8} />
      {/* keyboard */}
      <polygon points={`${pt(x - 0.4, y + 0.05, H)} ${pt(x + 0.25, y + 0.05, H)} ${pt(x + 0.25, y + 0.28, H)} ${pt(x - 0.4, y + 0.28, H)}`} fill="#e6ecf3" />
    </g>
  );
}

function Chair({ at, taken }: { at: Spot; taken: boolean }) {
  const { x, y } = at;
  const seat = 22;
  return (
    <g opacity={taken ? 1 : 0.9}>
      {/* star base and stem */}
      <polygon points={`${pt(x - 0.22, y, 3)} ${pt(x, y - 0.22, 3)} ${pt(x + 0.22, y, 3)} ${pt(x, y + 0.22, 3)}`} fill="#c7d0dc" />
      <polygon points={`${pt(x - 0.04, y, seat)} ${pt(x + 0.04, y, seat)} ${pt(x + 0.04, y, 3)} ${pt(x - 0.04, y, 3)}`} fill="#b3bdca" />
      {/* seat pad */}
      <polygon points={`${pt(x - 0.28, y - 0.26, seat)} ${pt(x + 0.28, y - 0.26, seat)} ${pt(x + 0.28, y + 0.26, seat)} ${pt(x - 0.28, y + 0.26, seat)}`} fill="#dbe3ec" />
      <polygon points={`${pt(x - 0.28, y + 0.26, seat)} ${pt(x + 0.28, y + 0.26, seat)} ${pt(x + 0.28, y + 0.26, seat - 4)} ${pt(x - 0.28, y + 0.26, seat - 4)}`} fill="#c3cddb" />
      {/* low back, behind the sitter */}
      <polygon points={`${pt(x - 0.26, y + 0.28, seat + 22)} ${pt(x + 0.26, y + 0.28, seat + 22)} ${pt(x + 0.26, y + 0.28, seat)} ${pt(x - 0.26, y + 0.28, seat)}`} fill="#cdd7e3" />
    </g>
  );
}

function Cabinet({ at, w = 1.1, h = 46, fill = '#eef2f7' }: { at: Spot; w?: number; h?: number; fill?: string }) {
  const { x, y } = at;
  return (
    <g>
      <polygon points={`${pt(x - w / 2, y - 0.4, h)} ${pt(x + w / 2, y - 0.4, h)} ${pt(x + w / 2, y + 0.4, h)} ${pt(x - w / 2, y + 0.4, h)}`} fill={fill} />
      <polygon points={`${pt(x - w / 2, y + 0.4, h)} ${pt(x + w / 2, y + 0.4, h)} ${pt(x + w / 2, y + 0.4, 0)} ${pt(x - w / 2, y + 0.4, 0)}`} fill="#dde5ee" />
      <polygon points={`${pt(x + w / 2, y - 0.4, h)} ${pt(x + w / 2, y + 0.4, h)} ${pt(x + w / 2, y + 0.4, 0)} ${pt(x + w / 2, y - 0.4, 0)}`} fill="#cbd5e1" />
    </g>
  );
}

function Plant({ at }: { at: Spot }) {
  const { x, y } = at;
  const top = iso(x, y, 30);
  return (
    <g>
      <polygon points={`${pt(x - 0.22, y - 0.22, 16)} ${pt(x + 0.22, y - 0.22, 16)} ${pt(x + 0.22, y + 0.22, 16)} ${pt(x - 0.22, y + 0.22, 16)}`} fill="#e2e8f0" />
      <polygon points={`${pt(x - 0.22, y + 0.22, 16)} ${pt(x + 0.22, y + 0.22, 16)} ${pt(x + 0.22, y + 0.22, 0)} ${pt(x - 0.22, y + 0.22, 0)}`} fill="#cbd5e1" />
      <ellipse cx={top.sx} cy={top.sy - 4} rx={16} ry={14} fill="#4ea15c" />
      <ellipse cx={top.sx - 8} cy={top.sy + 2} rx={10} ry={9} fill="#5fb86d" />
      <ellipse cx={top.sx + 9} cy={top.sy + 3} rx={9} ry={8} fill="#43904f" />
    </g>
  );
}

function Couch({ at }: { at: Spot }) {
  const { x, y } = at;
  return (
    <g>
      <polygon points={`${pt(x - 0.8, y - 0.9, 20)} ${pt(x + 0.8, y - 0.9, 20)} ${pt(x + 0.8, y + 0.9, 20)} ${pt(x - 0.8, y + 0.9, 20)}`} fill="#cfd9e6" />
      <polygon points={`${pt(x - 0.8, y + 0.9, 20)} ${pt(x + 0.8, y + 0.9, 20)} ${pt(x + 0.8, y + 0.9, 0)} ${pt(x - 0.8, y + 0.9, 0)}`} fill="#bac7d8" />
      <polygon points={`${pt(x + 0.8, y - 0.9, 46)} ${pt(x + 0.8, y + 0.9, 46)} ${pt(x + 0.8, y + 0.9, 20)} ${pt(x + 0.8, y - 0.9, 20)}`} fill="#aebdd0" />
    </g>
  );
}

/** One agent, drawn standing or sitting, with their name and what they are on. */
function Person({
  agent, at, seated, color, task, bubble, selected, onSelect,
}: {
  agent: Agent; at: Spot; seated: boolean; color: string; task: string; bubble?: string; selected: boolean; onSelect: () => void;
}) {
  const p = iso(at.x, at.y, 0);
  const lift = seated ? 10 : 0;
  return (
    <g
      className={`of-person${seated ? ' seated' : ''}${selected ? ' sel' : ''}`}
      style={{ transform: `translate(${p.sx}px, ${p.sy}px)` }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onSelect(); }}
    >
      <ellipse cx={0} cy={0} rx={15} ry={7} fill="#0f172a" opacity={0.12} />
      <g className="of-body" transform={`translate(0, ${-lift})`}>
        {/* legs (hidden behind the desk when seated) */}
        {!seated && <>
          <rect x={-7} y={-16} width={5} height={16} rx={2.5} fill="#e7ebf1" />
          <rect x={2} y={-16} width={5} height={16} rx={2.5} fill="#e7ebf1" />
          <rect x={-8} y={-2} width={7} height={3} rx={1.5} fill="#cbd3dd" />
          <rect x={1} y={-2} width={7} height={3} rx={1.5} fill="#cbd3dd" />
        </>}
        {/* torso: white shell with a dark core and the agent's colour across the chest */}
        <path d="M -8.5 -34 Q -10 -20 -7.5 -14 L 7.5 -14 Q 10 -20 8.5 -34 Z" fill="#f4f6f9" />
        <path d="M -5.5 -30 Q -6.5 -21 -4.5 -16.5 L 4.5 -16.5 Q 6.5 -21 5.5 -30 Z" fill="#23262e" />
        <path d="M -8.5 -34 Q 0 -37 8.5 -34 L 8 -30 Q 0 -33 -8 -30 Z" fill={color} />
        {/* arms */}
        <rect x={-12.5} y={-33} width={4} height={18} rx={2} fill="#e7ebf1" />
        <rect x={8.5} y={-33} width={4} height={18} rx={2} fill="#e7ebf1" />
        <circle cx={-10.5} cy={-14} r={2.4} fill="#23262e" />
        <circle cx={10.5} cy={-14} r={2.4} fill="#23262e" />
        {/* neck + helmet with a visor and two red eyes */}
        <rect x={-2} y={-38} width={4} height={5} fill="#3c4048" />
        <path d="M -8 -46 Q -8 -56 0 -56 Q 8 -56 8 -46 Q 8 -38 0 -38 Q -8 -38 -8 -46 Z" fill="#f7f9fc" />
        <path d="M -6.2 -48 Q -6.2 -53.5 0 -53.5 Q 6.2 -53.5 6.2 -48 Q 6.2 -43.5 0 -43.5 Q -6.2 -43.5 -6.2 -48 Z" fill="#17191f" />
        <path d="M -4.4 -49.2 L -1.2 -48.2 L -4.4 -46.8 Z" fill="#ff3b30" />
        <path d="M 4.4 -49.2 L 1.2 -48.2 L 4.4 -46.8 Z" fill="#ff3b30" />
        {selected && <circle cx={0} cy={-30} r={30} fill="none" stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 4" className="of-ring" />}
      </g>
      <text className="of-name" y={seated ? -lift - 74 : 18} textAnchor="middle">{agent.name}</text>
      {seated && task && <text className="of-task" y={-lift - 62} textAnchor="middle">{task.length > 26 ? `${task.slice(0, 26)}…` : task}</text>}
      {bubble && (
        <g className="of-bubble" transform={`translate(0, ${-lift - (seated ? 96 : 76)})`}>
          <rect x={-Math.max(26, bubble.length * 4.2)} y={-15} width={Math.max(52, bubble.length * 8.4)} height={24} rx={12} fill="#fff" stroke="#e2e8f0" />
          <text y={2} textAnchor="middle">{bubble}</text>
        </g>
      )}
    </g>
  );
}

// ── The floor ──────────────────────────────────────────────────────────────────

export default function OfficeView({
  agents, activityOf, taskOf, selectedId, onSelect, canManage, onSetOffice, onRun, onTask,
  routines, onSaveRoutine, onRunRoutine, onDeleteRoutine,
}: {
  agents: Agent[];
  activityOf: (id: string) => Activity | 'offline';
  taskOf: (id: string) => string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  canManage: boolean;
  onSetOffice: (agent: Agent, inOffice: boolean) => void;
  onRun: (what: 'topup' | 'research' | 'write' | 'send') => Promise<string>;
  onTask: (text: string) => Promise<TaskResult>;
  routines: Routine[];
  onSaveRoutine: (r: Partial<Routine>) => Promise<string | null>;
  onRunRoutine: (id: string) => Promise<string>;
  onDeleteRoutine: (id: string) => Promise<void>;
}) {
  const [showRoutines, setShowRoutines] = useState(false);
  const [running, setRunning] = useState('');
  const [runMsg, setRunMsg] = useState('');
  const staff = useMemo(
    () => agents.filter(a => a.in_office && a.status !== 'archived').sort((a, b) => a.sort_order - b.sort_order),
    [agents],
  );
  const outside = useMemo(() => agents.filter(a => !a.in_office && a.status === 'active'), [agents]);

  const [spots, setSpots] = useState<Record<string, Spot>>({});
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const [hiring, setHiring] = useState(false);

  // Seats are stable: the nth working agent takes the nth desk.
  const { busyIds, seats } = useMemo(() => {
    const ids = staff.filter(a => isBusy(activityOf(a.id))).map(a => a.id);
    const out: Record<string, Spot> = {};
    ids.forEach((id, i) => { out[id] = seatOf(DESKS[i % DESKS.length]); });
    return { busyIds: ids, seats: out };
  }, [staff, activityOf]);

  const say = useCallback((id: string, text: string, ms = 3400) => {
    setBubbles(b => ({ ...b, [id]: text }));
    window.setTimeout(() => setBubbles(b => {
      if (b[id] !== text) return b;
      const rest = { ...b };
      delete rest[id];
      return rest;
    }), ms);
  }, []);

  // People who are free wander, and sometimes stop for a word.
  useEffect(() => {
    const move = () => {
      const roamers = staff.filter(a => !isBusy(activityOf(a.id)));
      if (!roamers.length) return;
      setSpots(prev => {
        const next = { ...prev };
        for (const a of roamers) if (!next[a.id] || Math.random() < 0.55) next[a.id] = loungeSpot();
        if (roamers.length > 1 && Math.random() < 0.4) {
          const a = roamers[Math.floor(Math.random() * roamers.length)];
          const b = roamers[Math.floor(Math.random() * roamers.length)];
          if (a.id !== b.id) {
            const at = loungeSpot();
            next[a.id] = at;
            next[b.id] = { x: at.x + 0.9, y: at.y + 0.2 };
            window.setTimeout(() => say(a.id, CHATTER[Math.floor(Math.random() * CHATTER.length)], 2600), 2600);
          }
        }
        return next;
      });
    };
    move();
    const id = window.setInterval(move, 6500);
    return () => window.clearInterval(id);
  }, [staff, activityOf, say]);

  // They notice when you come back to the screen.
  const lastSeen = useRef(0);
  const lastHello = useRef(0);
  useEffect(() => {
    lastSeen.current = Date.now();
    const onMove = () => {
      const now = Date.now();
      const away = now - lastSeen.current;
      lastSeen.current = now;
      if (away < 60_000 || now - lastHello.current < 90_000) return;
      const roamers = staff.filter(a => !isBusy(activityOf(a.id)));
      const who = roamers[Math.floor(Math.random() * roamers.length)] ?? staff[0];
      if (!who) return;
      lastHello.current = now;
      say(who.id, GREETINGS[Math.floor(Math.random() * GREETINGS.length)], 4200);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [staff, activityOf, say]);

  const working = staff.filter(a => isBusy(activityOf(a.id)));
  const idle = staff.filter(a => !isBusy(activityOf(a.id)));

  // Draw far things first so near things overlap them.
  const drawn = staff
    .map(a => {
      const busy = isBusy(activityOf(a.id));
      const at = busy ? seats[a.id] ?? seatOf(DESKS[0]) : spots[a.id] ?? loungeSpot(() => 0.5);
      return { a, busy, at };
    })
    .sort((p, q) => p.at.x + p.at.y - (q.at.x + q.at.y));

  const W = (ROOM.w + ROOM.h) * (TILE / 2);
  const H = (ROOM.w + ROOM.h) * (TILE / 4) + 210;

  return (
    <div className="of-wrap">
      {canManage && <TaskBar onTask={onTask} />}
      <div className="of-top">
        <span><b>{working.length}</b> at their desks · <b>{idle.length}</b> free · <b>{staff.length}</b> in the office</span>
        {canManage && (
          <div className="of-actions">
            {([
              { key: 'topup' as const, label: 'Find more leads' },
              { key: 'research' as const, label: 'Research them' },
              { key: 'write' as const, label: 'Write emails' },
              { key: 'send' as const, label: 'Send approved' },
            ]).map(b => (
              <button key={b.key} type="button" className="btn btn-sm" disabled={!!running}
                onClick={async () => { setRunning(b.key); setRunMsg(''); setRunMsg(await onRun(b.key)); setRunning(''); }}>
                {running === b.key ? <><span className="spin" />Working…</> : b.label}
              </button>
            ))}
            <button type="button" className="btn btn-sm" onClick={() => setShowRoutines(!showRoutines)}>{showRoutines ? 'Close routines' : 'Routines'}</button>
            <button type="button" className="btn btn-sm" onClick={() => setHiring(!hiring)}>{hiring ? 'Close' : 'Bring someone in…'}</button>
          </div>
        )}
      </div>
      {runMsg && <div className="up-await">{runMsg}</div>}
      {showRoutines && (
        <RoutinesPanel routines={routines} canEdit={canManage} onSave={onSaveRoutine} onRun={onRunRoutine} onDelete={onDeleteRoutine} />
      )}

      {hiring && (
        <div className="of-hire">
          <span className="tb-sub">Pick who joins the office floor. Live agents are already in; the rest sit idle until we build them.</span>
          <div className="of-hire-list">
            {outside.map(a => (
              <button key={a.id} type="button" className="ag-chip-btn" onClick={() => onSetOffice(a, true)}>
                + {a.name} <em>{a.title}</em>{LIVE_AGENTS[a.slug ?? ''] ? ' · live' : ''}
              </button>
            ))}
            {outside.length === 0 && <span className="tb-sub">Everyone is already in the office.</span>}
          </div>
        </div>
      )}

      <div className="of-room">
        <svg viewBox={`${-W / 2 - 60} ${-150} ${W + 120} ${H}`} className="of-svg" role="img" aria-label="The office floor: agents at desks are working, agents walking are free">
          <defs>
            <linearGradient id="ofGlass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.45" />
            </linearGradient>
          </defs>

          {/* floor slab */}
          <polygon points={`${pt(0, 0)} ${pt(ROOM.w, 0)} ${pt(ROOM.w, ROOM.h)} ${pt(0, ROOM.h)}`} fill="#fdfdfe" />
          <polygon points={`${pt(0, ROOM.h)} ${pt(ROOM.w, ROOM.h)} ${pt(ROOM.w, ROOM.h, -16)} ${pt(0, ROOM.h, -16)}`} fill="#e7ecf3" />
          <polygon points={`${pt(ROOM.w, 0)} ${pt(ROOM.w, ROOM.h)} ${pt(ROOM.w, ROOM.h, -16)} ${pt(ROOM.w, 0, -16)}`} fill="#dbe2ec" />

          {/* glass walls along the two far edges */}
          {Array.from({ length: ROOM.w }, (_, i) => (
            <g key={`wx-${i}`}>
              <polygon points={`${pt(i + 0.05, 0, 0)} ${pt(i + 0.95, 0, 0)} ${pt(i + 0.95, 0, 150)} ${pt(i + 0.05, 0, 150)}`} fill="url(#ofGlass)" stroke="#e8eef6" />
            </g>
          ))}
          {Array.from({ length: ROOM.h }, (_, i) => (
            <g key={`wy-${i}`}>
              <polygon points={`${pt(0, i + 0.05, 0)} ${pt(0, i + 0.95, 0)} ${pt(0, i + 0.95, 150)} ${pt(0, i + 0.05, 150)}`} fill="url(#ofGlass)" stroke="#e8eef6" />
            </g>
          ))}

          {/* furniture along the walls */}
          <Cabinet at={{ x: 9.6, y: 0.6 }} w={1.6} h={52} />
          <Cabinet at={{ x: 11.2, y: 0.6 }} w={1.2} h={78} fill="#f5f7fb" />
          <Cabinet at={{ x: 0.7, y: 8.3 }} w={1.4} h={40} />
          <Plant at={{ x: 11.3, y: 8.2 }} />
          <Plant at={{ x: 0.7, y: 0.7 }} />
          <Couch at={{ x: 10.6, y: 6.6 }} />

          {/* desks, then the chairs that belong to them */}
          {DESKS.map((d, i) => (
            <g key={`desk-${i}`}>
              <Desk at={d} screen={SCREEN_COLORS[i % SCREEN_COLORS.length]} />
              <Chair at={seatOf(d)} taken={i < busyIds.length} />
            </g>
          ))}

          {drawn.map(({ a, busy, at }) => (
            <Person
              key={a.id}
              agent={a}
              at={at}
              seated={busy}
              color={ACTIVITY_META[activityOf(a.id)].color}
              task={taskOf(a.id)}
              bubble={bubbles[a.id]}
              selected={selectedId === a.id}
              onSelect={() => onSelect(selectedId === a.id ? null : a.id)}
            />
          ))}
        </svg>
        {staff.length === 0 && <div className="of-empty">Nobody is in the office yet. Use “Bring someone in”.</div>}
      </div>
    </div>
  );
}
