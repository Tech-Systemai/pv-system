'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { dbOp } from '@/utils/db';
import type { ViewType, PermMatrix } from '@/utils/getPermissions';

// Cycle order on click
const CYCLE: ViewType[] = ['none', 'agent', 'admin', 'both'];

const VIEW_CFG: Record<ViewType, { label: string; short: string; hue: number; icon: string; desc: string }> = {
  none:  { label: 'No Access', short: '—',  hue: 0,   icon: '✕', desc: 'Cannot access this module' },
  agent: { label: 'Own View',  short: 'A',  hue: 55,  icon: '👤', desc: 'Sees only their own data' },
  admin: { label: 'Admin View', short: 'M', hue: 220, icon: '🔧', desc: 'Full management view' },
  both:  { label: 'Both Views', short: '✓', hue: 145, icon: '✓', desc: 'Admin + personal view' },
};

const MODULE_META: Record<string, { label: string; icon: string }> = {
  tasks:      { label: 'Task Flow',       icon: '✓'  },
  schedule:   { label: 'Schedules',       icon: '⏱'  },
  reports:    { label: 'Reports',         icon: '📊' },
  tickets:    { label: 'Tickets',         icon: '🎫' },
  hr:         { label: 'HR Pipeline',     icon: '📋' },
  contracts:  { label: 'Contracts',       icon: '📄' },
  inbox:      { label: 'Inbox',           icon: '✉'  },
  attendance: { label: 'Attendance',      icon: '📅' },
  monitoring: { label: 'Live Monitoring', icon: '◉'  },
  policy:     { label: 'Policy Engine',   icon: '⚙'  },
  targets:    { label: 'Targets',         icon: '⊕'  },
  coaching:   { label: 'Coaching + QA',   icon: '🎯' },
  planning:   { label: 'Planning',        icon: '📈' },
  kb:         { label: 'Knowledge Base',  icon: '📚' },
  chat:       { label: 'Messages',        icon: '💬' },
  payroll:    { label: 'Payroll',         icon: '💵' },
  finance:    { label: 'Finance',         icon: '$'  },
  wise:       { label: 'WISE',            icon: '💡' },
};

const ROLE_HUES: Record<string, number> = {
  owner: 268, admin: 200, supervisor: 145, accountant: 155, sales: 75, cx: 25,
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', supervisor: 'Supervisor',
  accountant: 'Accountant', sales: 'Sales', cx: 'CX',
};

export default function PermissionsClient({
  initialMatrix,
  categories,
  roles,
}: {
  initialMatrix: PermMatrix;
  categories: string[];
  roles: string[];
}) {
  const router = useRouter();
  const [matrix, setMatrix] = useState<PermMatrix>(initialMatrix);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  const cycle = (cat: string, role: string) => {
    if (role === 'owner') return;
    const cur = matrix[cat]?.[role] ?? 'none';
    const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
    setMatrix(prev => ({ ...prev, [cat]: { ...(prev[cat] ?? {}), [role]: next } }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    const { error: err } = await dbOp('permissions', 'upsert', { id: 'main', matrix });
    if (err) {
      setError(`Save failed: ${err}`);
    } else {
      setSaved(true);
      router.refresh(); // invalidate Router Cache so portal switches see new permissions
      setTimeout(() => setSaved(false), 4000);
    }
    setSaving(false);
  };

  // Stats
  const counts = { none: 0, agent: 0, admin: 0, both: 0 };
  for (const cat of categories) {
    for (const role of roles) {
      const v = role === 'owner' ? 'admin' : (matrix[cat]?.[role] ?? 'none');
      counts[v]++;
    }
  }

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">🔐</div></div>
          <div className="stat-l">ROLES</div>
          <div className="stat-v">{roles.length}</div>
          <div className="stat-foot">Configured roles</div>
        </div>
        {(['both', 'admin', 'agent', 'none'] as ViewType[]).map(v => {
          const cfg = VIEW_CFG[v];
          return (
            <div key={v} className="stat-card" style={{ cursor: 'default' }}>
              <div className="stat-h">
                <div className="stat-ico" style={{ background: v === 'none' ? 'var(--surface-3)' : `oklch(0.93 0.05 ${cfg.hue})`, color: v === 'none' ? 'var(--ink-4)' : `oklch(0.40 0.14 ${cfg.hue})` }}>
                  {cfg.icon}
                </div>
              </div>
              <div className="stat-l">{cfg.label.toUpperCase()}</div>
              <div className="stat-v" style={{ color: v === 'none' ? 'var(--ink-3)' : `oklch(0.40 0.14 ${cfg.hue})` }}>{counts[v]}</div>
              <div className="stat-foot">{cfg.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>Click any cell to cycle views:</div>
          {CYCLE.map(v => {
            const cfg = VIEW_CFG[v];
            return (
              <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CellButton view={v} locked={false} onClick={() => {}} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{cfg.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{cfg.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Role Permissions Matrix</div>
            <div className="card-sub">Owner always has full admin view — click cells to cycle through view types</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {error && <span style={{ fontSize: 12, color: 'var(--err)' }}>{error}</span>}
            <button
              className={`btn btn-sm ${saved ? 'btn-sec' : 'btn-acc'}`}
              onClick={handleSave}
              disabled={saving}
              style={saved ? { background: 'oklch(0.96 0.05 145)', color: 'var(--ok)', border: '1px solid oklch(0.88 0.07 145)' } : undefined}
            >
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', padding: '0 18px 18px' }}>
          <table className="tbl" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ width: 200 }}>Module</th>
                {roles.map(r => {
                  const hue = ROLE_HUES[r] ?? 268;
                  return (
                    <th key={r} style={{ textAlign: 'center', minWidth: 90 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div className="av-circle" style={{
                          width: 28, height: 28, fontSize: 10,
                          background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))`,
                        }}>
                          {r[0].toUpperCase()}
                        </div>
                        <span style={{ textTransform: 'capitalize', fontSize: 10 }}>{ROLE_LABELS[r] ?? r}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const meta = MODULE_META[cat] ?? { label: cat, icon: '·' };
                return (
                  <tr key={cat}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>{meta.icon}</span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{meta.label}</span>
                      </div>
                    </td>
                    {roles.map(role => {
                      const isOwner = role === 'owner';
                      const view: ViewType = isOwner ? 'admin' : (matrix[cat]?.[role] ?? 'none');
                      return (
                        <td key={role} style={{ textAlign: 'center' }}>
                          <CellButton view={view} locked={isOwner} onClick={() => cycle(cat, role)} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CellButton({ view, locked, onClick }: { view: ViewType; locked: boolean; onClick: () => void }) {
  const cfg = VIEW_CFG[view];
  const isNone = view === 'none';

  const bg    = isNone ? 'var(--surface-2)'                  : `oklch(0.94 0.05 ${cfg.hue})`;
  const color = isNone ? 'var(--ink-4)'                      : `oklch(0.38 0.14 ${cfg.hue})`;
  const border= isNone ? '1.5px solid var(--line)'           : `1.5px solid oklch(0.82 0.09 ${cfg.hue})`;

  return (
    <button
      onClick={onClick}
      disabled={locked}
      title={locked ? 'Owner always has full admin view' : `${cfg.label} — click to change`}
      style={{
        width: 52, height: 28, borderRadius: 7,
        border, background: bg, color,
        cursor: locked ? 'not-allowed' : 'pointer',
        fontSize: 11, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3,
        transition: 'all .1s',
        opacity: locked ? 0.8 : 1,
      }}
    >
      {isNone ? <span style={{ opacity: 0.4 }}>—</span> : <>{cfg.short}</>}
    </button>
  );
}
