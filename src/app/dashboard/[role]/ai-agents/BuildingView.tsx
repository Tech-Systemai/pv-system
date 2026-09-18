'use client';

import { useLayoutEffect, useRef } from 'react';
import { ACTIVITY_META, EVENT_META, roleTag, type Activity, type Agent, type Department, type EventKind } from '@/lib/aiAgents/types';

export type Bubble = { id: string; agentId: string; kind: EventKind; text: string };

type Props = {
  departments: Department[];
  agents: Agent[];
  /** Agents that run on real APIs; the rest show as planned. */
  liveIds: Set<string>;
  activityOf: (id: string) => Activity | 'offline';
  taskOf: (id: string) => string;
  revisionCount: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  bubbles: Bubble[];
  /** Floor index the elevator is heading to, and what it carries. */
  elevator: { floor: number; kind: EventKind | null };
  canHire: boolean;
  onHire: (deptKey: string) => void;
};

const TIER_RANK = { ceo: 0, exec: 1, manager: 2, specialist: 3 } as const;

export default function BuildingView({
  departments, agents, liveIds, activityOf, taskOf, revisionCount, selectedId, onSelect, bubbles, elevator, canHire, onHire,
}: Props) {
  const floors = [...departments].sort((a, b) => a.arm_order - b.arm_order);
  const n = floors.length;
  const unassigned = agents.filter(a => !floors.some(f => f.key === a.department));
  const floorsEl = useRef<HTMLDivElement>(null);
  const car = useRef<HTMLSpanElement>(null);

  // Floors grow when desks wrap, so the car is placed from the real floor box.
  useLayoutEffect(() => {
    const floor = floorsEl.current?.children[elevator.floor] as HTMLElement | undefined;
    if (!floor || !car.current) return;
    car.current.style.top = `${floor.offsetTop + 6}px`;
    car.current.style.height = `${Math.max(24, floor.offsetHeight - 12)}px`;
  });

  const desk = (a: Agent) => {
    const act = activityOf(a.id);
    const meta = ACTIVITY_META[act];
    const task = taskOf(a.id);
    const revs = revisionCount[a.id] ?? 0;
    const lead = a.tier !== 'specialist';
    const live = liveIds.has(a.id);
    const bubble = bubbles.filter(b => b.agentId === a.id).at(-1);
    return (
      <button
        key={a.id}
        type="button"
        className={`bd-desk bd-${live ? act : 'planned'}${lead ? ' bd-lead' : ''}${selectedId === a.id ? ' sel' : ''}`}
        onClick={() => onSelect(a.id)}
        title={`${a.name} — ${a.title}`}
      >
        {bubble && (
          <span key={bubble.id} className={`bd-bubble bd-bubble-${bubble.kind}`}>
            <b>{EVENT_META[bubble.kind].icon} {EVENT_META[bubble.kind].label}</b>
            {bubble.text}
          </span>
        )}
        <span className="bd-screen" style={{ ['--st' as string]: meta.color }}>
          <span className="bd-screen-lines" />
        </span>
        <span className="bd-desk-txt">
          <span className="bd-name">
            <i style={{ background: meta.color }} />
            {a.name}
            {lead && <em>{a.tier === 'manager' ? 'MGR' : roleTag(a)}</em>}
            {live && <em className="bd-live">LIVE</em>}
          </span>
          <span className="bd-title">{a.title}</span>
          <span className="bd-task">{live ? (task || meta.label) : 'Planned — not live yet'}</span>
        </span>
        {revs > 0 && <span className="bd-rev" title={`${revs} in revision`}>↺{revs}</span>}
      </button>
    );
  };

  return (
    <div className="bd-wrap">
      <div className="bd-building">
        <div className="bd-roof">
          <span className="bd-antenna" />
          <div className="bd-sign">OCTOPUS ENGINES <small>HQ</small></div>
        </div>

        <div className="bd-body">
          <div className="bd-floors" ref={floorsEl}>
            {floors.map((f, i) => {
              const staff = agents
                .filter(a => a.department === f.key)
                .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.sort_order - b.sort_order);
              const busy = staff.filter(a => { const x = activityOf(a.id); return x !== 'idle' && x !== 'offline'; }).length;
              const liveCount = staff.filter(a => liveIds.has(a.id)).length;
              return (
                <section key={f.key} className="bd-floor" style={{ ['--hue' as string]: f.hue }}>
                  <div className="bd-plate">
                    <span className="bd-num">{n - i}</span>
                    <span className="bd-plate-txt">
                      <b>{f.name}</b>
                      <small>{f.blurb}</small>
                      <span className="bd-meter"><span style={{ width: `${staff.length ? (busy / staff.length) * 100 : 0}%` }} /></span>
                      <small>{liveCount ? `${liveCount} live · ${busy} working now` : 'Planned floor'}</small>
                    </span>
                    {canHire && <button type="button" className="bd-hire" title={`Hire into ${f.name}`} onClick={() => onHire(f.key)}>+</button>}
                  </div>
                  <div className="bd-desks">
                    {staff.length ? staff.map(desk) : <span className="bd-empty">Empty floor</span>}
                  </div>
                </section>
              );
            })}
            {unassigned.length > 0 && (
              <section className="bd-floor bd-lobby">
                <div className="bd-plate">
                  <span className="bd-num">L</span>
                  <span className="bd-plate-txt"><b>Lobby</b><small>Agents without a department</small></span>
                </div>
                <div className="bd-desks">{unassigned.map(desk)}</div>
              </section>
            )}
          </div>

          {/* Elevator: rides to the floor where the latest handoff landed. */}
          <div className="bd-shaft" aria-hidden>
            <span ref={car} className={`bd-car${elevator.kind ? ` bd-car-${elevator.kind}` : ''}`}>
              <span />
            </span>
          </div>
        </div>
        <div className="bd-ground" />
      </div>
    </div>
  );
}
