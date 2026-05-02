import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';

export default async function MonitoringPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!['owner', 'admin'].includes(profile?.role ?? '')) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  // Live workforce snapshot
  const { data: employees } = await admin
    .from('profiles')
    .select('id, name, role, clocked_in, current_activity, department, points')
    .in('role', ['sales', 'cx', 'supervisor'])
    .order('clocked_in', { ascending: false });

  // Recent audit activity
  const { data: activity } = await admin
    .from('audit_logs')
    .select('action, entity_type, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  // Today's attendance summary
  const today = new Date().toISOString().split('T')[0];
  const { data: todayLogs } = await admin
    .from('attendance_logs')
    .select('user_id, status, clock_in_time, productive_time_minutes')
    .eq('date', today);

  const clockedInCount = employees?.filter(e => e.clocked_in).length ?? 0;
  const totalCount = employees?.length ?? 0;
  const lateCount = todayLogs?.filter(l => l.status === 'late').length ?? 0;
  const avgProductivity = todayLogs && todayLogs.length > 0
    ? Math.round(todayLogs.reduce((s, l) => s + (l.productive_time_minutes || 0), 0) / todayLogs.length)
    : 0;

  return (
    <div>
      <div className="pn-h" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', animation: 'pulse 2s infinite' }}></div>
          <div className="pn-t">Live System Monitoring</div>
        </div>
        <div style={{ fontSize: '12px', color: '#6b7689' }}>Updated every page load · {new Date().toLocaleTimeString()}</div>
      </div>

      {/* KPI row */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat">
          <div className="stat-h"><div className="s-ico gn">👥</div></div>
          <div className="s-l">Clocked In</div>
          <div className="s-v gn">{clockedInCount}</div>
          <div className="s-s">of {totalCount} agents</div>
        </div>
        <div className="stat">
          <div className="stat-h"><div className="s-ico rd">⚠</div></div>
          <div className="s-l">Late Today</div>
          <div className="s-v rd">{lateCount}</div>
          <div className="s-s">Policy deductions pending</div>
        </div>
        <div className="stat">
          <div className="stat-h"><div className="s-ico ind">⏱</div></div>
          <div className="s-l">Avg Productivity</div>
          <div className="s-v">{Math.floor(avgProductivity / 60)}h {avgProductivity % 60}m</div>
          <div className="s-s">From Apploye today</div>
        </div>
        <div className="stat">
          <div className="stat-h"><div className="s-ico am">📊</div></div>
          <div className="s-l">Offline</div>
          <div className="s-v am">{totalCount - clockedInCount}</div>
          <div className="s-s">Not clocked in</div>
        </div>
      </div>

      <div className="two">
        {/* Live agent status */}
        <div className="pn">
          <div className="pn-t" style={{ marginBottom: '14px' }}>Agent Status Board</div>
          {(employees ?? []).length === 0 && <div className="empty">No agents found.</div>}
          {(employees ?? []).map(e => {
            const todayLog = todayLogs?.find(l => l.user_id === e.id);
            const prodMins = todayLog?.productive_time_minutes ?? 0;
            return (
              <div key={e.id} className="r-cd">
                <div style={{ position: 'relative' }}>
                  <div className="av" style={{ background: e.clocked_in ? '#ecfdf5' : '#f5f6f8', color: e.clocked_in ? '#047857' : '#6b7689' }}>
                    {e.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '8px', height: '8px', borderRadius: '50%', background: e.clocked_in ? '#10b981' : '#e4e7eb', border: '2px solid #fff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{e.name}</div>
                  <div style={{ fontSize: '11px', color: '#6b7689' }}>
                    {e.role} · {e.current_activity || (e.clocked_in ? 'Active' : 'Offline')}
                  </div>
                </div>
                {prodMins > 0 && (
                  <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600 }}>
                    {Math.floor(prodMins / 60)}h {prodMins % 60}m
                  </div>
                )}
                <span className={`pv-bdg ${e.clocked_in ? 'pv-bdg-green' : 'pv-bdg-gray'}`}>
                  {e.clocked_in ? 'Online' : 'Offline'}
                </span>
                <span className={`pv-bdg ${e.points >= 6 ? 'pv-bdg-green' : e.points >= 4 ? 'pv-bdg-amber' : 'pv-bdg-red'}`}>
                  {e.points}/7 pts
                </span>
              </div>
            );
          })}
        </div>

        {/* Activity stream */}
        <div className="pn">
          <div className="pn-t" style={{ marginBottom: '14px' }}>Activity Stream</div>
          {(activity ?? []).length === 0 && <div className="empty">No recent activity.</div>}
          {(activity ?? []).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f0f2f5', alignItems: 'center' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b7689', minWidth: '55px' }}>
                {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4f46e5', flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: '#4a5568' }}>
                <strong style={{ color: '#1a1f2e' }}>{a.entity_type}</strong> · {a.action}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
