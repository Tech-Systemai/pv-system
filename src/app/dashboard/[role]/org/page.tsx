import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export default async function OrgPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: employees } = await admin
    .from('profiles')
    .select('id, name, role, department, salary, status, clocked_in')
    .order('role')
    .order('name');

  const byRole: Record<string, any[]> = {};
  for (const e of employees ?? []) {
    if (!byRole[e.role]) byRole[e.role] = [];
    byRole[e.role].push(e);
  }

  const ORDER = ['owner', 'admin', 'accountant', 'supervisor', 'sales', 'cx'];
  const LABELS: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    accountant: 'Accountant',
    supervisor: 'Supervisor',
    sales: 'Sales',
    cx: 'CX',
  };
  const COLORS: Record<string, string> = {
    owner: '#4f46e5',
    admin: '#7c3aed',
    accountant: '#0891b2',
    supervisor: '#059669',
    sales: '#d97706',
    cx: '#db2777',
  };

  return (
    <div>
      <div className="pn-h" style={{ marginBottom: '20px' }}>
        <div className="pn-t">Organization Hierarchy</div>
        <div style={{ fontSize: '12px', color: '#6b7689' }}>{(employees ?? []).length} team members</div>
      </div>

      {ORDER.filter(r => byRole[r]?.length).map((role, ri) => (
        <div key={role} style={{ marginBottom: '24px' }}>
          {ri > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <div style={{ width: '2px', height: '24px', background: '#cbd2e0' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {byRole[role].map(e => (
              <div key={e.id} style={{ background: '#fff', border: `1.5px solid ${COLORS[role] ?? '#e4e7eb'}`, padding: '14px 20px', borderRadius: '10px', minWidth: '160px', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: COLORS[role] + '18', color: COLORS[role], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, margin: '0 auto 8px' }}>
                  {e.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? '??'}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1f2e' }}>{e.name}</div>
                <div style={{ fontSize: '10px', color: COLORS[role], fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>{LABELS[role]}</div>
                <div style={{ fontSize: '10px', color: '#6b7689', marginTop: '4px' }}>{e.department ?? '—'}</div>
                {e.clocked_in && (
                  <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#047857', background: '#ecfdf5', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Online
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {(employees ?? []).length === 0 && (
        <div className="empty">No employees found. Add employees from the Employee Directory.</div>
      )}
    </div>
  );
}
