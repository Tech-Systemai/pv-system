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

  const { data: employees } = await admin
    .from('profiles')
    .select('id, name, role, clocked_in, current_activity, department, points')
    .in('role', ['sales', 'cx', 'supervisor'])
    .order('clocked_in', { ascending: false });

  const { data: activity } = await admin
    .from('audit_logs')
    .select('action, entity_type, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

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
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h">
            <div className="stat-ico ok" style={{ position: 'relative' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)', marginRight: 0 }} />
            </div>
          </div>
          <div className="stat-l">CLOCKED IN</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>{clockedInCount}</div>
          <div className="stat-foot">of {totalCount} agents online</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico er">⚠</div></div>
          <div className="stat-l">LATE TODAY</div>
          <div className="stat-v" style={{ color: 'var(--err)' }}>{lateCount}</div>
          <div className="stat-foot">Policy deductions pending</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">⏱</div></div>
          <div className="stat-l">AVG PRODUCTIVITY</div>
          <div className="stat-v">{Math.floor(avgProductivity / 60)}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink-3)' }}>h</span> {avgProductivity % 60}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink-3)' }}>m</span></div>
          <div className="stat-foot">From Apploye today</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico gy">●</div></div>
          <div className="stat-l">OFFLINE</div>
          <div className="stat-v" style={{ color: 'var(--ink-3)' }}>{totalCount - clockedInCount}</div>
          <div className="stat-foot">Not clocked in</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Live agent status board */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div>
              <div className="card-title">Agent Status Board</div>
              <div className="card-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--err)' }} />
                Live · {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
          <div style={{ padding: '0 18px 18px' }}>
            {(employees ?? []).length === 0 && (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No agents found.</div>
            )}
            {(employees ?? []).map(e => {
              const todayLog = todayLogs?.find(l => l.user_id === e.id);
              const prodMins = todayLog?.productive_time_minutes ?? 0;
              const hue = ((e.name || 'U').charCodeAt(0) * 13) % 360;
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div className="av-circle" style={{ width: 32, height: 32, fontSize: 11, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                      {e.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: e.clocked_in ? 'var(--ok)' : 'var(--line)', border: '2px solid var(--surface)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{e.role} · {e.current_activity || (e.clocked_in ? 'Active' : 'Offline')}</div>
                  </div>
                  {prodMins > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--accent-ink)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                      {Math.floor(prodMins / 60)}h {prodMins % 60}m
                    </div>
                  )}
                  <span className={`bdg ${e.clocked_in ? 'bdg-ok' : 'bdg-gy'}`}>{e.clocked_in ? 'Online' : 'Offline'}</span>
                  <span className={`bdg ${(e.points ?? 7) >= 6 ? 'bdg-ok' : (e.points ?? 7) >= 4 ? 'bdg-warn' : 'bdg-err'}`}>{e.points ?? 7}/7</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity stream */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-hdr">
            <div className="card-title">Activity Stream</div>
          </div>
          <div style={{ padding: '0 18px 18px' }}>
            {(activity ?? []).length === 0 && (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No recent activity.</div>
            )}
            {(activity ?? []).map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line-2)', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', minWidth: 50, flexShrink: 0 }}>
                  {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  <strong style={{ color: 'var(--ink)' }}>{a.entity_type}</strong> · {a.action}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
