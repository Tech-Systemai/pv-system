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
    owner: 'Owner', admin: 'Admin', accountant: 'Accountant',
    supervisor: 'Supervisor', sales: 'Sales', cx: 'CX',
  };
  const HUES: Record<string, number> = {
    owner: 268, admin: 220, accountant: 155,
    supervisor: 145, sales: 75, cx: 25,
  };

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">🏢</div></div>
          <div className="stat-l">TOTAL EMPLOYEES</div>
          <div className="stat-v">{(employees ?? []).length}</div>
          <div className="stat-foot">Across all roles</div>
        </div>
        {['sales', 'cx', 'supervisor'].map(role => (
          <div key={role} className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h">
              <div className="stat-ico" style={{ background: `oklch(0.93 0.05 ${HUES[role] ?? 268})`, color: `oklch(0.40 0.14 ${HUES[role] ?? 268})` }}>◈</div>
            </div>
            <div className="stat-l">{LABELS[role].toUpperCase()}</div>
            <div className="stat-v">{byRole[role]?.length ?? 0}</div>
            <div className="stat-foot">Team members</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '20px 18px' }}>
        <div style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>Organization Hierarchy</div>
          <div className="card-sub">{(employees ?? []).length} team members across {ORDER.filter(r => byRole[r]?.length).length} roles</div>
        </div>

        {ORDER.filter(r => byRole[r]?.length).map((role, ri) => {
          const hue = HUES[role] ?? 268;
          return (
            <div key={role} style={{ marginBottom: 28 }}>
              {ri > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <div style={{ width: 2, height: 24, background: 'var(--line)' }} />
                </div>
              )}
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: `oklch(0.40 0.14 ${hue})`, background: `oklch(0.93 0.05 ${hue})`, padding: '3px 10px', borderRadius: 20 }}>
                  {LABELS[role]}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                {byRole[role].map(e => {
                  const nameHue = ((e.name || 'U').charCodeAt(0) * 13) % 360;
                  return (
                    <div key={e.id} style={{
                      background: 'var(--surface)',
                      border: `1.5px solid oklch(0.88 0.07 ${hue})`,
                      padding: '16px 20px', borderRadius: 12,
                      minWidth: 150, textAlign: 'center',
                      boxShadow: 'var(--sh-1)',
                    }}>
                      <div className="av-circle" style={{
                        width: 40, height: 40, fontSize: 13, margin: '0 auto 10px',
                        background: `linear-gradient(135deg, oklch(0.55 0.13 ${nameHue}), oklch(0.42 0.16 ${nameHue + 20}))`,
                      }}>
                        {e.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? '??'}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{e.name}</div>
                      <div style={{ fontSize: 10, color: `oklch(0.40 0.14 ${hue})`, fontWeight: 600, textTransform: 'uppercase', marginTop: 3 }}>{LABELS[role]}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>{e.department ?? '—'}</div>
                      {e.clocked_in && (
                        <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--ok)', background: 'oklch(0.96 0.05 145)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                          Online
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {(employees ?? []).length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No employees found. Add employees from the Employee Directory.
          </div>
        )}
      </div>
    </div>
  );
}
