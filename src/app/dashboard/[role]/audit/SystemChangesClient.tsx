'use client';

import { useState, useEffect } from 'react';

type ActivityEntry = {
  id: string;
  user_id: string | null;
  user_name: string;
  module: string;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

const MODULE_CFG: Record<string, { emoji: string; label: string; hue: number }> = {
  'announcements':  { emoji: '📢', label: 'Announcement',  hue: 25  },
  'daily-updates':  { emoji: '📋', label: 'Daily Update',  hue: 260 },
  'tasks':          { emoji: '✅', label: 'Task',          hue: 155 },
  'schedule':       { emoji: '📅', label: 'Schedule',      hue: 200 },
  'payroll':        { emoji: '💰', label: 'Payroll',       hue: 90  },
  'cx':             { emoji: '🤝', label: 'CX',            hue: 290 },
  'notes':          { emoji: '📝', label: 'Notes',         hue: 40  },
  'finance':        { emoji: '📊', label: 'Finance',       hue: 120 },
  'inbox':          { emoji: '📨', label: 'Inbox',         hue: 180 },
  'timeoff':        { emoji: '🏖️', label: 'Time Off',      hue: 50  },
  'hr':             { emoji: '👤', label: 'HR',            hue: 310 },
  'collections':    { emoji: '💳', label: 'Collections',   hue: 70  },
  'attendance':     { emoji: '🕐', label: 'Attendance',    hue: 220 },
  'system':         { emoji: '⚙️', label: 'System',        hue: 230 },
};

function getModuleCfg(module: string) {
  return MODULE_CFG[module] ?? { emoji: '•', label: module, hue: 220 };
}

function dateKey(iso: string) { return iso.split('T')[0]; }

function formatDateLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function groupByDate(entries: ActivityEntry[]) {
  const map: Record<string, ActivityEntry[]> = {};
  for (const e of entries) {
    const k = dateKey(e.created_at);
    if (!map[k]) map[k] = [];
    map[k].push(e);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([k, items]) => ({ key: k, label: formatDateLabel(k), items }));
}

function MetadataView({ meta }: { meta: Record<string, unknown> }) {
  const entries = Object.entries(meta).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return null;
  return (
    <div style={{
      marginTop: 8, padding: '10px 12px', borderRadius: 8,
      background: 'var(--surface-2)', fontSize: 12,
    }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
          <span style={{ fontWeight: 600, color: 'var(--ink-4)', textTransform: 'capitalize', minWidth: 70, flexShrink: 0 }}>{k}:</span>
          <span style={{ color: 'var(--ink-3)', lineHeight: 1.5 }}>
            {typeof v === 'string' ? v : JSON.stringify(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SystemChangesClient({ initialLog }: { initialLog: ActivityEntry[] }) {
  const [log, setLog] = useState<ActivityEntry[]>(initialLog);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(
    new Set([new Date().toISOString().split('T')[0]])
  );
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Refresh every 30s
  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch('/api/activity?days=30', { cache: 'no-store' });
        const json = await res.json();
        if (Array.isArray(json.data)) setLog(json.data);
      } catch { /* ignore */ }
    };
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  const filtered = log.filter(e => {
    if (moduleFilter !== 'all' && e.module !== moduleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.user_name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.module.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const groups = groupByDate(filtered);
  const modulesPresent = [...new Set(log.map(e => e.module))].sort();

  const todayCount = log.filter(e => dateKey(e.created_at) === new Date().toISOString().split('T')[0]).length;
  const userCount  = new Set(log.map(e => e.user_name)).size;

  const toggleDate = (k: string) =>
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const exportCSV = () => {
    const rows = ['"Time","User","Module","Action","Description","Details"'];
    filtered.forEach(e => {
      const meta = Object.entries(e.metadata || {})
        .map(([k, v]) => `${k}: ${v}`).join(' | ');
      rows.push([
        `"${new Date(e.created_at).toLocaleString()}"`,
        `"${e.user_name}"`,
        `"${e.module}"`,
        `"${e.action}"`,
        `"${e.description.replace(/"/g, '""')}"`,
        `"${meta.replace(/"/g, '""')}"`,
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-changes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-fade">

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📊</div></div>
          <div className="stat-l">TOTAL EVENTS</div>
          <div className="stat-v">{log.length}</div>
          <div className="stat-foot">Last 30 days</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">⚡</div></div>
          <div className="stat-l">TODAY</div>
          <div className="stat-v">{todayCount}</div>
          <div className="stat-foot">Events logged today</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">👥</div></div>
          <div className="stat-l">ACTIVE USERS</div>
          <div className="stat-v">{userCount}</div>
          <div className="stat-foot">Users with activity</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico warn">📡</div></div>
          <div className="stat-l">MODULES</div>
          <div className="stat-v">{modulesPresent.length}</div>
          <div className="stat-foot">Areas with logged activity</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">System Activity Log</div>
            <div className="card-sub">
              {filtered.length} events · Organized by date · Auto-refreshes every 30s
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search user, action, module…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="fld-input"
              style={{ width: 220 }}
            />
            <button className="btn btn-sec btn-sm" onClick={exportCSV}>↓ CSV</button>
          </div>
        </div>

        {/* Module filter */}
        <div style={{ padding: '0 18px 14px' }}>
          <div className="tabs" style={{ flexWrap: 'wrap', gap: 4 }}>
            <button
              className={`tab${moduleFilter === 'all' ? ' active' : ''}`}
              onClick={() => setModuleFilter('all')}
            >
              All <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 4 }}>{log.length}</span>
            </button>
            {modulesPresent.map(m => {
              const cfg = getModuleCfg(m);
              const count = log.filter(e => e.module === m).length;
              return (
                <button
                  key={m}
                  className={`tab${moduleFilter === m ? ' active' : ''}`}
                  onClick={() => setModuleFilter(m)}
                >
                  {cfg.emoji} {cfg.label}
                  <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 4 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date groups */}
        <div style={{ padding: '0 18px 18px' }}>
          {groups.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No activity yet</div>
              <div style={{ fontSize: 12, maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
                Actions like sending announcements, completing tasks, and submitting daily updates will appear here automatically.
              </div>
            </div>
          ) : (
            groups.map(({ key, label, items }) => {
              const isOpen = expandedDates.has(key);
              return (
                <div key={key} style={{ marginBottom: 10 }}>
                  {/* Date header */}
                  <button
                    onClick={() => toggleDate(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '10px 14px', borderRadius: 8,
                      border: '1px solid var(--line)', background: 'var(--surface-2)',
                      cursor: 'pointer', textAlign: 'left', marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--ink-4)', width: 14 }}>
                      {isOpen ? '▼' : '▶'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', flex: 1 }}>
                      {label}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: 'oklch(0.94 0.06 260)', color: 'oklch(0.38 0.18 260)',
                    }}>
                      {items.length} event{items.length !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {/* Event list */}
                  {isOpen && (
                    <div style={{
                      borderRadius: 8, border: '1px solid var(--line)',
                      overflow: 'hidden', background: 'white',
                    }}>
                      {items.map((entry, i) => {
                        const cfg = getModuleCfg(entry.module);
                        const time = new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const hasMeta = Object.keys(entry.metadata || {}).filter(k => entry.metadata[k] !== null && entry.metadata[k] !== '').length > 0;
                        const isExpanded = expandedEntry === entry.id;

                        return (
                          <div
                            key={entry.id}
                            style={{
                              padding: '11px 16px',
                              borderBottom: i < items.length - 1 ? '1px solid var(--line-2)' : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              {/* Time */}
                              <span style={{
                                fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-5)',
                                whiteSpace: 'nowrap', marginTop: 3, minWidth: 52, flexShrink: 0,
                              }}>
                                {time}
                              </span>

                              {/* Module badge */}
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                                background: `oklch(0.94 0.05 ${cfg.hue})`,
                                color: `oklch(0.36 0.18 ${cfg.hue})`,
                                whiteSpace: 'nowrap', flexShrink: 0,
                                border: `1px solid oklch(0.86 0.08 ${cfg.hue})`,
                              }}>
                                {cfg.emoji} {cfg.label}
                              </span>

                              {/* Content */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{entry.user_name}</span>
                                  <span style={{ color: 'var(--ink-3)', marginLeft: 6 }}>{entry.description}</span>
                                </div>

                                {hasMeta && (
                                  <div style={{ marginTop: 4 }}>
                                    <button
                                      onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                                      style={{
                                        fontSize: 11, color: 'var(--accent-ink)',
                                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                      }}
                                    >
                                      {isExpanded ? '▲ Hide details' : '▼ Show details'}
                                    </button>
                                    {isExpanded && <MetadataView meta={entry.metadata} />}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
