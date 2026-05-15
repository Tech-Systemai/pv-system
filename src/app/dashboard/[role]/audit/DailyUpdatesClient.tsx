'use client';

import { useState } from 'react';

type Update = {
  id: string;
  user_id: string;
  date: string;
  prompt: 'start' | 'midday' | 'end';
  answer: string;
  created_at: string;
  profiles?: { name: string; role: string };
};

const PROMPT_LABELS = {
  start:  'Start of Shift',
  midday: 'Mid-Shift',
  end:    'End of Shift',
};

const PROMPT_QUESTIONS = {
  start:  'Planned work for the day',
  midday: 'Progress & next steps',
  end:    'Accomplished today',
};

type DayGroup = {
  date: string;
  employees: {
    userId: string;
    name: string;
    role: string;
    start?: string;
    midday?: string;
    end?: string;
  }[];
};

function buildGroups(updates: Update[]): DayGroup[] {
  const byDate: Record<string, Record<string, { name: string; role: string; start?: string; midday?: string; end?: string }>> = {};

  for (const u of updates) {
    if (!byDate[u.date]) byDate[u.date] = {};
    if (!byDate[u.date][u.user_id]) {
      byDate[u.date][u.user_id] = {
        name: u.profiles?.name ?? 'Unknown',
        role: u.profiles?.role ?? '',
      };
    }
    byDate[u.date][u.user_id][u.prompt] = u.answer;
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, emps]) => ({
      date,
      employees: Object.entries(emps).map(([userId, data]) => ({ userId, ...data })),
    }));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DailyUpdatesClient({ initialUpdates }: { initialUpdates: Update[] }) {
  const groups = buildGroups(initialUpdates);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(groups.slice(0, 3).map(g => g.date)));
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  const toggle = (date: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });

  if (groups.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--ink-4,rgba(255,255,255,0.3))' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 14 }}>No daily updates submitted yet.</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>Updates will appear here once employees with active schedules submit their shift check-ins.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(group => (
        <div key={group.date} style={{
          background: 'var(--surface-1,rgba(255,255,255,0.03))',
          border: '1px solid var(--border,rgba(255,255,255,0.07))',
          borderRadius: 12, overflow: 'hidden',
        }}>
          {/* Date header */}
          <button
            onClick={() => toggle(group.date)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-1,#e8eaf0)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{formatDate(group.date)}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px',
                background: 'rgba(99,102,241,0.15)', color: 'oklch(0.7 0.18 265)',
                borderRadius: 20,
              }}>
                {group.employees.length} {group.employees.length === 1 ? 'employee' : 'employees'}
              </span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--ink-3,rgba(255,255,255,0.4))' }}>
              {expanded.has(group.date) ? '▲' : '▼'}
            </span>
          </button>

          {expanded.has(group.date) && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderTop: '1px solid var(--border,rgba(255,255,255,0.07))' }}>
                    <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--ink-3,rgba(255,255,255,0.4))', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 180 }}>Employee</th>
                    {(['start', 'midday', 'end'] as const).map(p => (
                      <th key={p} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--ink-3,rgba(255,255,255,0.4))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <div>{PROMPT_LABELS[p]}</div>
                        <div style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4,rgba(255,255,255,0.25))', marginTop: 2 }}>{PROMPT_QUESTIONS[p]}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.employees.map((emp, i) => (
                    <tr key={emp.userId} style={{
                      borderTop: '1px solid var(--border,rgba(255,255,255,0.05))',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}>
                      <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--ink-1,#e8eaf0)' }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4,rgba(255,255,255,0.3))', marginTop: 2, textTransform: 'capitalize' }}>{emp.role}</div>
                      </td>
                      {(['start', 'midday', 'end'] as const).map(p => {
                        const cellKey = `${emp.userId}-${group.date}-${p}`;
                        const text = emp[p];
                        const isOpen = expandedCell === cellKey;
                        return (
                          <td key={p} style={{ padding: '12px 16px', verticalAlign: 'top', maxWidth: 260 }}>
                            {text ? (
                              <div>
                                <p style={{
                                  margin: 0, color: 'var(--ink-2,rgba(255,255,255,0.75))',
                                  lineHeight: 1.5, fontSize: 13,
                                  display: '-webkit-box', WebkitLineClamp: isOpen ? undefined : 3,
                                  WebkitBoxOrient: 'vertical', overflow: isOpen ? 'visible' : 'hidden',
                                  whiteSpace: 'pre-wrap',
                                }}>
                                  {text}
                                </p>
                                {text.length > 120 && (
                                  <button onClick={() => setExpandedCell(isOpen ? null : cellKey)} style={{
                                    marginTop: 4, background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: 11, color: 'oklch(0.65 0.2 250)', padding: 0,
                                  }}>
                                    {isOpen ? 'Show less' : 'Show more'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span style={{
                                display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                                background: 'rgba(255,255,255,0.04)', fontSize: 11,
                                color: 'var(--ink-4,rgba(255,255,255,0.3))',
                              }}>
                                Pending
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
