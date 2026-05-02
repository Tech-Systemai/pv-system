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
    if (role === 'owner') return; // owner always has access
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

  return (
    <div className="pn" style={{ overflowX: 'auto' }}>
      <div className="pn-h" style={{ marginBottom: '16px' }}>
        <div>
          <div className="pn-t">Role Permissions</div>
          <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>
            Owner always has full access. Changes here are informational — enforce via RLS in Supabase.
          </div>
        </div>
        <button
          className="pv-btn pv-btn-pri"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e4e7eb', color: '#6b7689', fontWeight: 600 }}>
              Module
            </th>
            {roles.map(r => (
              <th key={r} style={{ textAlign: 'center', padding: '10px 8px', borderBottom: '2px solid #e4e7eb', color: '#6b7689', fontWeight: 600, textTransform: 'capitalize', fontSize: '12px' }}>
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat, i) => (
            <tr key={cat} style={{ borderBottom: '1px solid #f0f2f5', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600, textTransform: 'capitalize', color: '#1a1f2e' }}>
                {cat}
              </td>
              {roles.map(role => {
                const checked = role === 'owner' ? true : (matrix[cat]?.[role] ?? false);
                return (
                  <td key={role} style={{ textAlign: 'center', padding: '10px 8px' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={role === 'owner'}
                      onChange={() => toggle(cat, role)}
                      style={{ width: '16px', height: '16px', cursor: role === 'owner' ? 'not-allowed' : 'pointer', accentColor: '#4f46e5' }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
