import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';

export default async function WisePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const canView = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');
  if (!canView) redirect(`/dashboard/${profile?.role || 'sales'}`);

  const { data: employees } = await admin
    .from('profiles')
    .select('id, name, role, points, score, salary, department')
    .in('role', ['sales', 'cx', 'supervisor'])
    .order('score', { ascending: false });

  const { data: sessions } = await admin
    .from('coaching_sessions')
    .select('*, agent:profiles!coaching_sessions_agent_id_fkey(name, role)')
    .order('created_at', { ascending: false })
    .limit(50);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: salesLogs } = await admin
    .from('sales_logs')
    .select('user_id, amount, type, created_at, profiles(name)')
    .eq('type', 'Sale')
    .gte('created_at', startOfMonth.toISOString());

  const salesByAgent: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const s of salesLogs ?? []) {
    if (!salesByAgent[s.user_id]) {
      salesByAgent[s.user_id] = { name: (s.profiles as any)?.name ?? 'Unknown', count: 0, revenue: 0 };
    }
    salesByAgent[s.user_id].count++;
    salesByAgent[s.user_id].revenue += Number(s.amount);
  }
  const topAgents = Object.entries(salesByAgent)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  const totalRevenue = topAgents.reduce((s, [, v]) => s + v.revenue, 0);
  const avgPoints = employees && employees.length > 0
    ? (employees.reduce((s, e) => s + (e.points ?? 7), 0) / employees.length).toFixed(1)
    : '—';
  const atRisk = employees?.filter(e => (e.points ?? 7) < 5).length ?? 0;
  const totalSessions = sessions?.length ?? 0;

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">💡</div></div>
          <div className="stat-l">AVG POINTS</div>
          <div className="stat-v">{avgPoints}<span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 400 }}>/7</span></div>
          <div className="stat-foot">Team reliability score</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico er">⚠</div></div>
          <div className="stat-l">AT RISK</div>
          <div className="stat-v" style={{ color: 'var(--err)' }}>{atRisk}</div>
          <div className="stat-foot">Below 5 points</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">$</div></div>
          <div className="stat-l">MONTH REVENUE</div>
          <div className="stat-v">${totalRevenue.toLocaleString()}</div>
          <div className="stat-foot">Sales this month</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico acc">🎯</div></div>
          <div className="stat-l">QA SESSIONS</div>
          <div className="stat-v">{totalSessions}</div>
          <div className="stat-foot">Coaching sessions logged</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Agent reliability board */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div className="card-title">Agent Reliability Board</div>
          </div>
          <div style={{ padding: '0 18px 18px' }}>
            {(employees ?? []).length === 0 && (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No agents found.</div>
            )}
            {(employees ?? []).map((e, i) => {
              const pts = e.points ?? 7;
              const pct = Math.round((pts / 7) * 100);
              const hue = ((e.name || 'U').charCodeAt(0) * 13) % 360;
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', width: 22 }}>#{i + 1}</div>
                  <div className="av-circle" style={{ width: 32, height: 32, fontSize: 11, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))`, flexShrink: 0 }}>
                    {e.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{e.role} · {e.department ?? '—'}</div>
                    <div style={{ marginTop: 5, height: 4, background: 'var(--surface-3)', borderRadius: 2 }}>
                      <div style={{ height: 4, borderRadius: 2, width: `${pct}%`, background: pts >= 6 ? 'var(--ok)' : pts >= 4 ? 'var(--warn)' : 'var(--err)' }} />
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: pts >= 6 ? 'var(--ok)' : pts >= 4 ? 'var(--warn)' : 'var(--err)', minWidth: 40, textAlign: 'right' }}>{pts}/7</div>
                  <span className={`bdg ${pts >= 6 ? 'bdg-ok' : pts >= 4 ? 'bdg-warn' : 'bdg-err'}`}>
                    {pts >= 6 ? 'Good' : pts >= 4 ? 'Warning' : 'At Risk'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top sales agents */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-hdr">
              <div className="card-title">Top Sales · This Month</div>
            </div>
            <div style={{ padding: '0 18px 18px' }}>
              {topAgents.length === 0 && (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No sales logged this month.</div>
              )}
              {topAgents.map(([uid, data], i) => {
                const hue = (data.name.charCodeAt(0) * 13) % 360;
                return (
                  <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', width: 22 }}>#{i + 1}</div>
                    <div className="av-circle" style={{ width: 30, height: 30, fontSize: 10, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                      {data.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{data.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{data.count} sales</div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--ok)', fontSize: 14 }}>${data.revenue.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent coaching sessions */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-hdr">
              <div className="card-title">Recent Coaching</div>
            </div>
            <div style={{ padding: '0 18px 18px' }}>
              {(sessions ?? []).length === 0 && (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No coaching sessions yet.</div>
              )}
              {(sessions ?? []).slice(0, 6).map(s => {
                const agentHue = ((s.agent?.name ?? 'A').charCodeAt(0) * 13) % 360;
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <div className="av-circle" style={{ width: 28, height: 28, fontSize: 9, background: `linear-gradient(135deg, oklch(0.55 0.13 ${agentHue}), oklch(0.42 0.16 ${agentHue + 20}))` }}>
                      {(s.agent?.name ?? 'A').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.agent?.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{new Date(s.created_at).toLocaleDateString()}</div>
                    </div>
                    <span className={`bdg ${s.type === 'Performance' ? 'bdg-ok' : 'bdg-warn'}`}>{s.type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
