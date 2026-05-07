'use client';

import { useState } from 'react';

type FilterTab = 'all' | 'approve' | 'deny' | 'update' | 'send' | 'hire';

const ACTION_BADGE: Record<string, string> = {
  approve: 'bdg bdg-ok',
  hire: 'bdg bdg-ok',
  send: 'bdg bdg-acc',
  update: 'bdg bdg-warn',
  deny: 'bdg bdg-err',
  delete: 'bdg bdg-err',
};

function hashStr(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0');
}

export default function AuditClient({ initialLogs }: { initialLogs: any[] }) {
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');

  const TAB_ACTIONS: Record<FilterTab, string[]> = {
    all: [],
    approve: ['approve', 'approved'],
    deny: ['deny', 'denied', 'reject', 'rejected'],
    update: ['update', 'updated', 'edit', 'edited'],
    send: ['send', 'sent'],
    hire: ['hire', 'hired'],
  };

  const tabFiltered = tab === 'all'
    ? initialLogs
    : initialLogs.filter(log => TAB_ACTIONS[tab].some(a => log.action.toLowerCase().includes(a)));

  const filteredLogs = tabFiltered.filter(log =>
    log.user_name?.toLowerCase().includes(filter.toLowerCase()) ||
    log.action.toLowerCase().includes(filter.toLowerCase()) ||
    log.target.toLowerCase().includes(filter.toLowerCase())
  );

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'approve', label: 'Approve' },
    { id: 'deny', label: 'Deny' },
    { id: 'update', label: 'Update' },
    { id: 'send', label: 'Send' },
    { id: 'hire', label: 'Hire' },
  ];

  const getBadge = (action: string) => {
    const lower = action.toLowerCase();
    for (const [key, cls] of Object.entries(ACTION_BADGE)) {
      if (lower.includes(key)) return cls;
    }
    return 'bdg bdg-gy';
  };

  const getActionType = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes('hire')) return 'HIRE';
    if (lower.includes('approve')) return 'APPROVE';
    if (lower.includes('deny') || lower.includes('reject')) return 'DENY';
    if (lower.includes('send')) return 'SEND';
    if (lower.includes('update') || lower.includes('edit')) return 'UPDATE';
    if (lower.includes('delete')) return 'DELETE';
    if (lower.includes('create') || lower.includes('insert')) return 'CREATE';
    return 'LOG';
  };

  const today = new Date().toDateString();
  const todayLogs = initialLogs.filter(l => new Date(l.created_at).toDateString() === today);
  const approveLogs = initialLogs.filter(l => l.action.toLowerCase().includes('approv'));
  const denyLogs = initialLogs.filter(l => l.action.toLowerCase().match(/deny|reject/));

  const exportCSV = () => {
    const rows = ['Time,User,Action,Target,Type'];
    filteredLogs.forEach(l => {
      rows.push(`"${new Date(l.created_at).toLocaleString()}","${l.user_name}","${l.action}","${l.target}","${l.type}"`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📋</div></div>
          <div className="stat-l">TOTAL EVENTS</div>
          <div className="stat-v">{initialLogs.length}</div>
          <div className="stat-foot">All audit entries</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">TODAY'S ACTIVITY</div>
          <div className="stat-v">{todayLogs.length}</div>
          <div className="stat-foot">Events logged today</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">↑</div></div>
          <div className="stat-l">APPROVALS</div>
          <div className="stat-v">{approveLogs.length}</div>
          <div className="stat-foot">Approve actions</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico er">↓</div></div>
          <div className="stat-l">DENIALS</div>
          <div className="stat-v" style={{ color: 'var(--err)' }}>{denyLogs.length}</div>
          <div className="stat-foot">Deny / reject actions</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Audit Log</div>
            <div className="card-sub">{filteredLogs.length} entries · Immutable record</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search user, action, target…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="fld-input"
              style={{ width: 220 }}
            />
            <button className="btn btn-sec btn-sm" onClick={exportCSV}>↓ Export CSV</button>
          </div>
        </div>

        <div style={{ padding: '0 18px 12px' }}>
          <div className="tabs">
            {TABS.map(t => {
              const count = t.id === 'all' ? initialLogs.length
                : initialLogs.filter(l => TAB_ACTIONS[t.id].some(a => l.action.toLowerCase().includes(a))).length;
              return (
                <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                  {t.label} <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No matching audit entries.
          </div>
        ) : (
          <div style={{ padding: '0 18px 18px' }}>
            {filteredLogs.map(a => {
              const hash = hashStr(a.id ?? (a.created_at + a.action));
              return (
                <div key={a.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 130px 1fr 80px',
                  gap: 12,
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--line-2)',
                  alignItems: 'center',
                  fontSize: 12,
                }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                    <div>{new Date(a.created_at).toLocaleDateString()}</div>
                    <div>{new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{a.user_name}</div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink)' }}>{a.action}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--accent-ink)', fontWeight: 600 }}>{a.target}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: 1 }}>#{hash.slice(0, 8)}</span>
                    </div>
                  </div>
                  <div>
                    <span className={getBadge(a.action)} style={{ fontSize: 9.5 }}>{getActionType(a.action)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
