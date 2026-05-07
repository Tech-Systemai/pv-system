'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

export default function PermissionsClient({
  initialMatrix,
  categories,
  roles,
}: {
  initialMatrix: Record<string, Record<string, boolean>>;
  categories: string[];
  roles: string[];
}) {
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>(initialMatrix);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (cat: string, role: string) => {
    if (role === 'owner') return;
    setMatrix(prev => ({
      ...prev,
      [cat]: { ...(prev[cat] ?? {}), [role]: !(prev[cat]?.[role] ?? false) },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await dbOp('permissions', 'upsert', { id: 'main', matrix });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  };

  const totalEnabled = Object.values(matrix).reduce((s, row) =>
    s + Object.values(row).filter(Boolean).length, 0
  );
  const totalCells = categories.length * roles.length;

  const ROLE_HUES: Record<string, number> = {
    owner: 268, admin: 200, supervisor: 145, sales: 75, cx: 25, accountant: 155,
  };

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">🔐</div></div>
          <div className="stat-l">ROLES</div>
          <div className="stat-v">{roles.length}</div>
          <div className="stat-foot">Defined roles</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">☰</div></div>
          <div className="stat-l">MODULES</div>
          <div className="stat-v">{categories.length}</div>
          <div className="stat-foot">Permission categories</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">ENABLED</div>
          <div className="stat-v">{totalEnabled}<span style={{ fontSize: 14, color: 'var(--ink-3)' }}>/{totalCells}</span></div>
          <div className="stat-foot">Active permissions</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico er">🚫</div></div>
          <div className="stat-l">RESTRICTED</div>
          <div className="stat-v">{totalCells - totalEnabled}</div>
          <div className="stat-foot">Blocked permissions</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Role Permissions Matrix</div>
            <div className="card-sub">Owner always has full access · Enforce via Supabase RLS</div>
          </div>
          <button className="btn btn-acc btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>

        <div style={{ overflowX: 'auto', padding: '0 18px 18px' }}>
          <table className="tbl" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ width: 180 }}>Module</th>
                {roles.map(r => {
                  const hue = ROLE_HUES[r] ?? 268;
                  return (
                    <th key={r} style={{ textAlign: 'center', minWidth: 80 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div className="av-circle" style={{
                          width: 28, height: 28, fontSize: 10,
                          background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))`,
                        }}>
                          {r[0].toUpperCase()}
                        </div>
                        <span style={{ textTransform: 'capitalize', fontSize: 10 }}>{r}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{cat}</td>
                  {roles.map(role => {
                    const checked = role === 'owner' ? true : (matrix[cat]?.[role] ?? false);
                    const hue = ROLE_HUES[role] ?? 268;
                    return (
                      <td key={role} style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => toggle(cat, role)}
                          disabled={role === 'owner'}
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            border: `1.5px solid ${checked ? `oklch(0.80 0.10 ${hue})` : 'var(--line)'}`,
                            background: checked ? `oklch(0.95 0.05 ${hue})` : 'var(--surface-2)',
                            color: checked ? `oklch(0.40 0.15 ${hue})` : 'var(--ink-4)',
                            cursor: role === 'owner' ? 'not-allowed' : 'pointer',
                            fontSize: 14, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all .12s',
                            margin: '0 auto',
                          }}
                          title={role === 'owner' ? 'Owner always has access' : checked ? 'Click to revoke' : 'Click to grant'}
                        >
                          {checked ? '✓' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
