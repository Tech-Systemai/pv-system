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

  // All employees for team overview
  const { data: employees } = await admin
    .from('profiles')
    .select('id, name, role, points, score, salary, department')
    .in('role', ['sales', 'cx', 'supervisor'])
    .order('score', { ascending: false });

  // Coaching sessions for QA trend
  const { data: sessions } = await admin
    .from('coaching_sessions')
    .select('*, agent:profiles!coaching_sessions_agent_id_fkey(name, role)')
    .order('created_at', { ascending: false })
    .limit(50);

  // Sales logs for revenue insights
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: salesLogs } = await admin
    .from('sales_logs')
    .select('user_id, amount, type, created_at, profiles(name)')
    .eq('type', 'Sale')
    .gte('created_at', startOfMonth.toISOString());

  // Aggregate per-agent sales
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
    <div>
      <div className="pn-h" style={{ marginBottom: '20px' }}>
        <div>
          <div className="pn-t">WISE · Workforce Intelligence & Score Engine</div>
          <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>Live performance intelligence across all teams</div>
        </div>
      </div>

      {/* KPI row */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat">
          <div className="stat-h"><div className="s-ico ind">💡</div></div>
          <div className="s-l">Avg Points</div>
          <div className="s-v">{avgPoints}<span style={{ fontSize: '13px', color: '#6b7689' }}>/7</span></div>
          <div className="s-s">Team reliability score</div>
        </div>
        <div className="stat">
          <div className="stat-h"><div className="s-ico rd">⚠</div></div>
          <div className="s-l">At Risk</div>
          <div className="s-v rd">{atRisk}</div>
          <div className="s-s">Employees below 5 pts</div>
        </div>
        <div className="stat">
          <div className="stat-h"><div className="s-ico gn">$</div></div>
          <div className="s-l">Month Revenue</div>
          <div className="s-v gn">${totalRevenue.toLocaleString()}</div>
          <div className="s-s">Sales this month</div>
        </div>
        <div className="stat">
          <div className="stat-h"><div className="s-ico cy">🎯</div></div>
          <div className="s-l">QA Sessions</div>
          <div className="s-v">{totalSessions}</div>
          <div className="s-s">Coaching sessions logged</div>
        </div>
      </div>

      <div className="two">
        {/* Agent score leaderboard */}
        <div className="pn">
          <div className="pn-h"><div className="pn-t">Agent Reliability Board</div></div>
          {(employees ?? []).length === 0 && <div className="empty">No agents found.</div>}
          {(employees ?? []).map((e, i) => {
            const pts = e.points ?? 7;
            const pct = Math.round((pts / 7) * 100);
            const color = pts >= 6 ? '#10b981' : pts >= 4 ? '#f59e0b' : '#ef4444';
            return (
              <div key={e.id} className="r-cd">
                <div style={{ width: '22px', fontSize: '11px', fontWeight: 700, color: '#6b7689' }}>#{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{e.name}</div>
                  <div style={{ fontSize: '11px', color: '#6b7689' }}>{e.role} · {e.department ?? '—'}</div>
                  <div style={{ marginTop: '5px', height: '4px', background: '#e4e7eb', borderRadius: '2px' }}>
                    <div style={{ height: '4px', borderRadius: '2px', background: color, width: `${pct}%` }} />
                  </div>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 700, color, minWidth: '40px', textAlign: 'right' }}>{pts}/7</span>
                <span className={`pv-bdg ${pts >= 6 ? 'pv-bdg-green' : pts >= 4 ? 'pv-bdg-amber' : 'pv-bdg-red'}`}>
                  {pts >= 6 ? 'Good' : pts >= 4 ? 'Warning' : 'At Risk'}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Sales Agents */}
          <div className="pn" style={{ alignSelf: 'start' }}>
            <div className="pn-t" style={{ marginBottom: '13px' }}>Top Sales · This Month</div>
            {topAgents.length === 0 && <div className="empty">No sales logged this month.</div>}
            {topAgents.map(([uid, data], i) => (
              <div key={uid} className="r-cd">
                <div style={{ width: '22px', fontSize: '11px', fontWeight: 700, color: '#6b7689' }}>#{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{data.name}</div>
                  <div style={{ fontSize: '11px', color: '#6b7689' }}>{data.count} sales</div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#047857' }}>${data.revenue.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Recent Coaching Sessions */}
          <div className="pn" style={{ alignSelf: 'start' }}>
            <div className="pn-t" style={{ marginBottom: '13px' }}>Recent Coaching Sessions</div>
            {(sessions ?? []).length === 0 && <div className="empty">No coaching sessions yet.</div>}
            {(sessions ?? []).slice(0, 6).map(s => (
              <div key={s.id} className="r-cd">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.agent?.name ?? '—'}</div>
                  <div style={{ fontSize: '11px', color: '#6b7689' }}>
                    {s.type} · {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={`pv-bdg ${s.type === 'Performance' ? 'pv-bdg-green' : 'pv-bdg-amber'}`}>{s.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
