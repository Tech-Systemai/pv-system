'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LIVE_AGENTS } from '@/lib/aiAgents/org';
import { ACTIVITY_META, type Activity, type Agent } from '@/lib/aiAgents/types';

// A live picture of the floor. Nothing here is invented: an agent sits at a
// desk when it is actually working, and roams when it is idle. The walking,
// chatting and hellos are just how that state is drawn.

type Spot = { x: number; y: number };

const DESK_COLS = 3;
const GREETINGS = ['Hey 👋', 'Morning!', 'Hi — need anything?', 'Welcome back', 'Hey boss'];
const CHATTER = ['…', 'ha', 'coffee?', 'nice one'];

/** Desks sit on the left; the lounge is on the right. Percentages of the room. */
function deskSpot(i: number): Spot {
  const col = i % DESK_COLS;
  const row = Math.floor(i / DESK_COLS);
  return { x: 9 + col * 17, y: 20 + row * 26 };
}

function loungeSpot(rnd = Math.random): Spot {
  return { x: 62 + rnd() * 32, y: 14 + rnd() * 70 };
}

const isBusy = (a: Activity | 'offline') => a === 'working' || a === 'reviewing' || a === 'revising';

export default function OfficeView({
  agents, activityOf, taskOf, selectedId, onSelect, canManage, onSetOffice,
}: {
  agents: Agent[];
  activityOf: (id: string) => Activity | 'offline';
  taskOf: (id: string) => string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  canManage: boolean;
  onSetOffice: (agent: Agent, inOffice: boolean) => void;
}) {
  const staff = useMemo(
    () => agents.filter(a => a.in_office && a.status !== 'archived').sort((a, b) => a.sort_order - b.sort_order),
    [agents],
  );
  const outside = useMemo(() => agents.filter(a => !a.in_office && a.status === 'active'), [agents]);

  const [spots, setSpots] = useState<Record<string, Spot>>({});
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const [hiring, setHiring] = useState(false);

  // Seats are stable: the nth busy agent takes the nth desk.
  const seats = useMemo(() => {
    const out: Record<string, Spot> = {};
    staff.filter(a => isBusy(activityOf(a.id))).forEach((a, i) => { out[a.id] = deskSpot(i); });
    return out;
  }, [staff, activityOf]);

  const say = useCallback((id: string, text: string, ms = 3200) => {
    setBubbles(b => ({ ...b, [id]: text }));
    window.setTimeout(() => setBubbles(b => {
      if (b[id] !== text) return b;
      const rest = { ...b };
      delete rest[id];
      return rest;
    }), ms);
  }, []);

  // Roamers wander, and now and then two of them stop for a word.
  useEffect(() => {
    const move = () => {
      const roamers = staff.filter(a => !isBusy(activityOf(a.id)));
      if (!roamers.length) return;
      setSpots(prev => {
        const next = { ...prev };
        for (const a of roamers) if (Math.random() < 0.5 || !next[a.id]) next[a.id] = loungeSpot();
        // Two of them drift together for a chat.
        if (roamers.length > 1 && Math.random() < 0.45) {
          const [x, y] = [roamers[Math.floor(Math.random() * roamers.length)], roamers[Math.floor(Math.random() * roamers.length)]];
          if (x.id !== y.id) {
            const at = loungeSpot();
            next[x.id] = at;
            next[y.id] = { x: Math.min(96, at.x + 7), y: at.y };
            window.setTimeout(() => say(x.id, CHATTER[Math.floor(Math.random() * CHATTER.length)], 2600), 2500);
          }
        }
        return next;
      });
    };
    move();
    const id = window.setInterval(move, 6000);
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
      say(who.id, GREETINGS[Math.floor(Math.random() * GREETINGS.length)], 4000);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [staff, activityOf, say]);

  const working = staff.filter(a => isBusy(activityOf(a.id)));
  const idle = staff.filter(a => !isBusy(activityOf(a.id)));

  return (
    <div className="of-wrap">
      <div className="of-top">
        <span><b>{working.length}</b> at their desks · <b>{idle.length}</b> free · <b>{staff.length}</b> in the office</span>
        {canManage && (
          <button type="button" className="btn btn-sm" onClick={() => setHiring(!hiring)}>
            {hiring ? 'Close' : 'Bring someone in…'}
          </button>
        )}
      </div>

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
        <div className="of-floor" />
        <div className="of-label of-label-desks">Desks · working</div>
        <div className="of-label of-label-lounge">Lounge · free</div>
        <div className="of-plant of-plant-1" />
        <div className="of-plant of-plant-2" />
        <div className="of-couch" />
        <div className="of-coffee" />

        {Array.from({ length: Math.max(6, working.length) }, (_, i) => {
          const s = deskSpot(i);
          return <div key={`desk-${i}`} className="of-desk" style={{ left: `${s.x}%`, top: `${s.y}%` }} />;
        })}

        {staff.map(a => {
          const act = activityOf(a.id);
          const busy = isBusy(act);
          const at = busy ? seats[a.id] ?? deskSpot(0) : spots[a.id] ?? loungeSpot(() => 0.5);
          const task = taskOf(a.id);
          return (
            <button
              key={a.id}
              type="button"
              className={`of-person${busy ? ' seated' : ' roaming'}${selectedId === a.id ? ' sel' : ''}`}
              style={{ left: `${at.x}%`, top: `${at.y}%` }}
              onClick={() => onSelect(selectedId === a.id ? null : a.id)}
              title={`${a.name} — ${a.title}`}
            >
              {bubbles[a.id] && <span className="of-bubble">{bubbles[a.id]}</span>}
              <span className="of-avatar" style={{ borderColor: ACTIVITY_META[act].color }}>
                {a.name.slice(0, 1)}
                {busy && <i className="of-typing" />}
              </span>
              <span className="of-name">{a.name}</span>
              {busy && task && <span className="of-task">{task.slice(0, 34)}{task.length > 34 ? '…' : ''}</span>}
            </button>
          );
        })}

        {staff.length === 0 && <div className="of-empty">Nobody is in the office yet. Use “Bring someone in”.</div>}
      </div>
    </div>
  );
}
