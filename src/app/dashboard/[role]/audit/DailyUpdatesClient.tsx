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

const ROLE_HUES: Record<string, number> = {
  sales: 75, cx: 200, supervisor: 268, admin: 290, accountant: 155, owner: 320,
};

type EmpRow = {
  userId: string;
  name: string;
  role: string;
  start?: string;
  midday?: string;
  end?: string;
};

type DayGroup = { date: string; employees: EmpRow[] };

function buildGroups(updates: Update[]): DayGroup[] {
  const byDate: Record<string, Record<string, EmpRow>> = {};
  for (const u of updates) {
    if (!byDate[u.date]) byDate[u.date] = {};
    if (!byDate[u.date][u.user_id]) {
      byDate[u.date][u.user_id] = {
        userId: u.user_id,
        name: u.profiles?.name ?? 'Unknown',
        role: u.profiles?.role ?? '',
      };
    }
    byDate[u.date][u.user_id][u.prompt] = u.answer;
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, emps]) => ({ date, employees: Object.values(emps) }));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function completionCount(emp: EmpRow) {
  return [emp.start, emp.midday, emp.end].filter(Boolean).length;
}

export default function DailyUpdatesClient({ initialUpdates }: { initialUpdates: Update[] }) {
  const groups = buildGroups(initialUpdates);

  const today = new Date().toISOString().split('T')[0];
  const todayGroup = groups.find(g => g.date === today);
  const todayTotal = todayGroup?.employees.length ?? 0;
  const todayFull  = todayGroup?.employees.filter(e => completionCount(e) === 3).length ?? 0;
  const todayPartial = todayGroup?.employees.filter(e => { const c = completionCount(e); return c > 0 && c < 3; }).length ?? 0;
  const totalUpdates = initialUpdates.length;

  const allDates = groups.map(g => g.date);
  const [activeDate, setActiveDate] = useState<string>(allDates[0] ?? '');
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const currentGroup = groups.find(g => g.date === activeDate);
  const filtered = (currentGroup?.employees ?? []).filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-fade">

      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📋</div></div>
          <div className="stat-l">TOTAL UPDATES</div>
          <div className="stat-v">{totalUpdates}</div>
          <div className="stat-foot">Last 30 days</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">↑</div></div>
          <div className="stat-l">TODAY'S RESPONSES</div>
          <div className="stat-v">{todayTotal}</div>
          <div className="stat-foot">Employees who submitted</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">FULLY COMPLETE</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>{todayFull}</div>
          <div className="stat-foot">All 3 prompts answered today</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico warn">◑</div></div>
          <div className="stat-l">IN PROGRESS</div>
          <div className="stat-v" style={{ color: 'var(--warn)' }}>{todayPartial}</div>
          <div className="stat-foot">Partial responses today</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Daily Updates</div>
            <div className="card-sub">Shift check-ins from all scheduled employees</div>
          </div>
          <input
            type="text"
            placeholder="Search employee…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="fld-input"
            style={{ width: 200 }}
          />
        </div>

        {/* Date tabs */}
        {allDates.length > 0 ? (
          <>
            <div style={{ padding: '0 18px 12px' }}>
              <div className="tabs" style={{ overflowX: 'auto' }}>
                {allDates.slice(0, 14).map(date => {
                  const g = groups.find(g => g.date === date)!;
                  const full = g.employees.filter(e => completionCount(e) === 3).length;
                  const label = date === today ? 'Today'
                    : date === new Date(Date.now() - 86400000).toISOString().split('T')[0] ? 'Yesterday'
                    : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return (
                    <button
                      key={date}
                      className={`tab${activeDate === date ? ' active' : ''}`}
                      onClick={() => { setActiveDate(date); setExpandedCell(null); }}
                    >
                      {label}
                      <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 5 }}>
                        {full}/{g.employees.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                {search ? 'No employees match your search.' : 'No updates for this date.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderTop: '1px solid var(--line-2)' }}>
                      <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', minWidth: 180 }}>
                        Employee
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 220 }}>
                        Start of Shift
                        <div style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)', marginTop: 1, opacity: 0.7 }}>Planned work for the day</div>
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 220 }}>
                        Mid-Shift
                        <div style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)', marginTop: 1, opacity: 0.7 }}>Progress &amp; next steps</div>
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 220 }}>
                        End of Shift
                        <div style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)', marginTop: 1, opacity: 0.7 }}>Accomplished today</div>
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(emp => {
                      const hue = ROLE_HUES[emp.role] ?? 220;
                      const count = completionCount(emp);
                      return (
                        <tr key={emp.userId} style={{ borderTop: '1px solid var(--line-2)' }}>
                          {/* Employee */}
                          <td style={{ padding: '14px 20px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="av-circle" style={{
                                width: 32, height: 32, fontSize: 11, flexShrink: 0,
                                background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))`,
                              }}>
                                {initials(emp.name)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'capitalize', marginTop: 1 }}>{emp.role}</div>
                              </div>
                            </div>
                          </td>

                          {/* 3 prompt columns */}
                          {(['start', 'midday', 'end'] as const).map(p => {
                            const cellKey = `${emp.userId}-${activeDate}-${p}`;
                            const text = emp[p];
                            const isOpen = expandedCell === cellKey;
                            return (
                              <td key={p} style={{ padding: '14px 16px', verticalAlign: 'top', maxWidth: 260 }}>
                                {text ? (
                                  <div>
                                    <p style={{
                                      margin: 0,
                                      color: 'var(--ink)',
                                      lineHeight: 1.55,
                                      fontSize: 13,
                                      whiteSpace: 'pre-wrap',
                                      display: isOpen ? 'block' : '-webkit-box',
                                      WebkitLineClamp: isOpen ? undefined : 3,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: isOpen ? 'visible' : 'hidden',
                                    }}>
                                      {text}
                                    </p>
                                    {text.length > 120 && (
                                      <button
                                        onClick={() => setExpandedCell(isOpen ? null : cellKey)}
                                        style={{
                                          marginTop: 4, background: 'none', border: 'none',
                                          cursor: 'pointer', fontSize: 11,
                                          color: 'var(--accent-ink)', padding: 0,
                                        }}
                                      >
                                        {isOpen ? 'Show less ▲' : 'Show more ▼'}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="bdg bdg-gy" style={{ fontSize: 10 }}>Pending</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Status */}
                          <td style={{ padding: '14px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                            {count === 3
                              ? <span className="bdg bdg-ok">Complete</span>
                              : count > 0
                              ? <span className="bdg bdg-warn">{count}/3 Done</span>
                              : <span className="bdg bdg-err">No Updates</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div>No daily updates submitted yet.</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Updates appear here once employees with active schedules submit their shift check-ins.</div>
          </div>
        )}
      </div>
    </div>
  );
}
