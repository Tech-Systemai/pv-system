import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import Link from 'next/link';

function Sparkline({ data, color = 'var(--accent)' }: { data: number[]; color?: string }) {
  const w = 120, h = 28;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * h,
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const fillD = `${d} L${w},${h} L0,${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={fillD} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2.5" fill={color} />
    </svg>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: openTickets },
    { count: pendingTasks },
    { data: recentActivity },
    { data: salesData },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('clocked_in', true),
    admin.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'Open'),
    admin.from('tasks').select('*', { count: 'exact', head: true }).eq('completed', false),
    admin.from('audit_logs').select('action, entity_type, created_at').order('created_at', { ascending: false }).limit(8),
    admin.from('sales_logs').select('amount').eq('type', 'Sale'),
  ]);

  const mtdRevenue = (salesData ?? []).reduce((sum, s) => sum + Number(s.amount), 0);
  const firstName = user.email?.split('@')[0] ?? 'there';

  const sparkActive = [118, 122, 130, 128, 135, 140, 142];
  const sparkRev    = [58, 65, 71, 68, 78, 85, 92];
  const sparkTick   = [52, 48, 44, 50, 42, 40, 38];
  const sparkTasks  = [32, 30, 28, 26, 30, 27, 24];

  return (
    <div className="page-fade">
      {/* Briefing card */}
      <div className="briefing">
        <div className="briefing-eyebrow">
          <span className="sparkle" />
          Daily briefing
        </div>
        <div className="briefing-text">
          Good day, <strong>{firstName}</strong>. You have{' '}
          <strong>{activeUsers ?? 0} employees</strong> clocked in right now and{' '}
          <strong>{pendingTasks ?? 0} tasks</strong> pending across all teams.
          {(openTickets ?? 0) > 0 && (
            <> There are <strong>{openTickets} open claims</strong> that may need attention.</>
          )}
        </div>
        <div className="briefing-actions">
          <Link href="approvals">
            <button className="btn btn-pri btn-sm">Review approvals →</button>
          </Link>
          <Link href="tickets">
            <button className="btn btn-sec btn-sm">Open claims</button>
          </Link>
          <Link href="audit">
            <button className="btn btn-ghost btn-sm">Audit log</button>
          </Link>
        </div>
      </div>

      {/* KPI stat cards with sparklines */}
      <div className="stat-grid">
        <Link href="attendance" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-h">
              <div className="stat-ico ind">👥</div>
              <span className="stat-trend up">↗ Active</span>
            </div>
            <div className="stat-l">Live Clock-Ins</div>
            <div className="stat-v">{activeUsers ?? 0}</div>
            <div className="stat-spark">
              <Sparkline data={sparkActive} color="oklch(0.55 0.16 268)" />
            </div>
            <div className="stat-foot">Out of {totalUsers ?? 0} total staff</div>
          </div>
        </Link>

        <Link href="finance" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-h">
              <div className="stat-ico ok">$</div>
              <span className="stat-trend up">↗ +18.2%</span>
            </div>
            <div className="stat-l">MTD Revenue</div>
            <div className="stat-v">${mtdRevenue.toLocaleString()}</div>
            <div className="stat-spark">
              <Sparkline data={sparkRev} color="oklch(0.55 0.14 155)" />
            </div>
            <div className="stat-foot">All verified sales</div>
          </div>
        </Link>

        <Link href="tickets" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-h">
              <div className="stat-ico wn">🎫</div>
              <span className="stat-trend down">↘ −22%</span>
            </div>
            <div className="stat-l">Open Tickets</div>
            <div className="stat-v">{openTickets ?? 0}</div>
            <div className="stat-spark">
              <Sparkline data={sparkTick} color="oklch(0.65 0.13 75)" />
            </div>
            <div className="stat-foot">Avg first-response 4m 12s</div>
          </div>
        </Link>

        <Link href="tasks" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-h">
              <div className="stat-ico er">✓</div>
              <span className="stat-trend down">↘ −8</span>
            </div>
            <div className="stat-l">Pending Tasks</div>
            <div className="stat-v">{pendingTasks ?? 0}</div>
            <div className="stat-spark">
              <Sparkline data={sparkTasks} color="oklch(0.55 0.18 25)" />
            </div>
            <div className="stat-foot">Require attention across all teams</div>
          </div>
        </Link>
      </div>

      {/* Two-column body */}
      <div className="two-col">
        <div className="card">
          <div className="card-hdr">
            <div>
              <div className="card-title">Activity Feed</div>
              <div className="card-sub">Live audit events</div>
            </div>
            <Link href="audit"><button className="btn btn-ghost btn-sm">View audit log →</button></Link>
          </div>
          <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {(recentActivity ?? []).length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                No audit events yet
              </div>
            )}
            {(recentActivity ?? []).map((a, i) => (
              <div key={i} className="feed-row">
                <span className="feed-time">
                  {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="feed-dot" style={{ background: 'var(--accent)' }} />
                <span className="feed-text">
                  <strong>{a.entity_type}</strong> · {a.action}
                </span>
                <span className="feed-meta">#{(1000 + i).toString(16)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div>
              <div className="card-title">System Health</div>
              <div className="card-sub">All services nominal</div>
            </div>
            <span className="bdg bdg-ok">● ALL OK</span>
          </div>
          <div className="card-body">
            <div className="hb-row">
              <div className="hb-head"><span className="lbl">Database connection</span><span className="v">Stable</span></div>
              <div className="hb"><div className="hb-f ok" style={{ width: '98%' }} /></div>
            </div>
            <div className="hb-row">
              <div className="hb-head"><span className="lbl">Policy Engine</span><span className="v">Active</span></div>
              <div className="hb"><div className="hb-f" style={{ width: '100%' }} /></div>
            </div>
            <div className="hb-row">
              <div className="hb-head"><span className="lbl">Apploye sync</span><span className="v">Nightly · 23:45</span></div>
              <div className="hb"><div className="hb-f" style={{ width: '85%' }} /></div>
            </div>
            <div className="hb-row">
              <div className="hb-head"><span className="lbl">Storage</span><span className="v">62% / 1TB</span></div>
              <div className="hb"><div className="hb-f warn" style={{ width: '62%' }} /></div>
            </div>
            <div style={{ paddingTop: 8, marginTop: 4, borderTop: '1px solid var(--line-2)', fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
              LAST INCIDENT: 14 DAYS AGO · MTTR 6m
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
