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

function barColor(pct: number) {
  return pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--accent)' : 'var(--warn)';
}

// ─── CX Dashboard ────────────────────────────────────────────────────────────

async function CxDashboard({ userId }: { userId: string }) {
  const admin = createAdminClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStr = now.toISOString().split('T')[0];
  const period = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Day-of-week for schedule
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayDay = dayNames[now.getDay()];
  // Start of this week (Monday)
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  const weekStr = weekStart.toISOString().split('T')[0];

  const [
    { data: profile },
    { count: openTasks },
    { data: collections },
    { count: openClaims },
    { data: attendance },
    { data: notifications },
    { data: scheduleEntries },
    { data: targetRow },
    { data: cxBonusRow },
  ] = await Promise.all([
    admin.from('profiles').select('name').eq('id', userId).single(),
    admin.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', userId).eq('completed', false),
    admin.from('sales_logs').select('amount, collection_date, created_at, status').eq('user_id', userId).eq('type', 'Collection').gte('created_at', startOfMonth),
    admin.from('tickets').select('*', { count: 'exact', head: true }).eq('user_id', userId).not('status', 'in', '(Resolved,Closed)'),
    admin.from('attendance_logs').select('clock_in_time, clock_out_time, date').eq('user_id', userId).eq('date', todayStr).order('created_at', { ascending: false }).limit(1),
    admin.from('inbox_documents').select('id, subject, title, type, created_at, is_read').eq('user_id', userId).order('created_at', { ascending: false }).limit(6),
    admin.from('schedules').select('day, shift_start, shift_end').eq('user_id', userId).eq('week', weekStr).order('day'),
    admin.from('targets').select('collection_amount_target').eq('user_id', userId).eq('period', period).maybeSingle(),
    admin.from('global_settings').select('value').eq('key', 'cx_bonus').maybeSingle(),
  ]);

  const firstName = profile?.name?.split(' ')[0] ?? 'there';
  const mtdCollected = (collections ?? []).reduce((s, c) => s + Number(c.amount), 0);
  const verifiedCollections = (collections ?? []).filter(c => c.status === 'Verified').length;
  const cxBonus = (cxBonusRow?.value as any) ?? { amount: 3, threshold: 600 };
  const bonusEarned = Math.floor(mtdCollected / cxBonus.threshold) * cxBonus.amount;
  const collectionTarget = targetRow?.collection_amount_target ?? 0;
  const targetPct = collectionTarget > 0 ? Math.min(Math.round((mtdCollected / collectionTarget) * 100), 100) : 0;

  const todayAttendance = attendance?.[0] ?? null;
  const clockedIn = !!todayAttendance?.clock_in_time && !todayAttendance?.clock_out_time;

  const todaySchedule = scheduleEntries?.find(s => s.day === todayDay);
  const DAYS_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="page-fade">
      {/* Briefing */}
      <div className="briefing">
        <div className="briefing-eyebrow">
          <span className="sparkle" />
          Daily briefing
        </div>
        <div className="briefing-text">
          Good day, <strong>{firstName}</strong>. You have{' '}
          <strong>{openTasks ?? 0} task{(openTasks ?? 0) !== 1 ? 's' : ''}</strong> pending and{' '}
          <strong>${mtdCollected.toLocaleString()} collected</strong> this month.
          {(openClaims ?? 0) > 0 && (
            <> You have <strong>{openClaims} open claim{(openClaims ?? 0) !== 1 ? 's' : ''}</strong> awaiting resolution.</>
          )}
          {bonusEarned > 0 && (
            <> Your current bonus stands at <strong>${bonusEarned}</strong>.</>
          )}
        </div>
        <div className="briefing-actions">
          <Link href="collections"><button className="btn btn-pri btn-sm">Log collection →</button></Link>
          <Link href="tasks"><button className="btn btn-sec btn-sm">My tasks</button></Link>
          <Link href="tickets"><button className="btn btn-ghost btn-sm">Open claims</button></Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <Link href="tasks" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-h"><div className="stat-ico ind">✓</div></div>
            <div className="stat-l">OPEN TASKS</div>
            <div className="stat-v" style={{ color: (openTasks ?? 0) > 0 ? 'var(--warn)' : 'var(--ok)' }}>{openTasks ?? 0}</div>
            <div className="stat-foot">Pending completion</div>
          </div>
        </Link>

        <Link href="collections" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-h"><div className="stat-ico ok">$</div></div>
            <div className="stat-l">MTD COLLECTIONS</div>
            <div className="stat-v">${mtdCollected.toLocaleString()}</div>
            <div className="stat-foot">{verifiedCollections} verified · {(collections?.length ?? 0) - verifiedCollections} pending</div>
          </div>
        </Link>

        <Link href="tickets" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-h"><div className="stat-ico wn">🎫</div></div>
            <div className="stat-l">OPEN CLAIMS</div>
            <div className="stat-v" style={{ color: (openClaims ?? 0) > 0 ? 'var(--warn)' : 'var(--ok)' }}>{openClaims ?? 0}</div>
            <div className="stat-foot">Awaiting resolution</div>
          </div>
        </Link>

        <Link href="targets" style={{ textDecoration: 'none' }}>
          <div className="stat-card">
            <div className="stat-h"><div className="stat-ico ok">🎁</div></div>
            <div className="stat-l">BONUS EARNED</div>
            <div className="stat-v" style={{ color: 'var(--ok)' }}>${bonusEarned}</div>
            <div className="stat-foot">${cxBonus.amount} per ${cxBonus.threshold} collected</div>
          </div>
        </Link>
      </div>

      {/* Three-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, alignItems: 'flex-start' }}>

        {/* Column 1: Attendance + Schedule */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Attendance card */}
          <div className="card">
            <div className="card-hdr">
              <div>
                <div className="card-title">Attendance</div>
                <div className="card-sub">Today · {new Date().toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
              </div>
              <Link href="attendance"><button className="btn btn-ghost btn-sm">View log →</button></Link>
            </div>
            <div className="card-body">
              {todayAttendance ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Clock-in</span>
                    <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>
                      {todayAttendance.clock_in_time
                        ? new Date(todayAttendance.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Clock-out</span>
                    <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'var(--mono)', color: clockedIn ? 'var(--ink-4)' : 'var(--ink)' }}>
                      {todayAttendance.clock_out_time
                        ? new Date(todayAttendance.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : clockedIn ? 'Active shift' : '—'}
                    </span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span className={clockedIn ? 'bdg bdg-ok' : 'bdg bdg-gy'}>
                      {clockedIn ? '● On shift' : '● Shift ended'}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, padding: '12px 0' }}>
                  No attendance logged today.<br />
                  <span style={{ fontSize: 11 }}>Clock in via Apploye to start.</span>
                </div>
              )}
            </div>
          </div>

          {/* Schedule card */}
          <div className="card">
            <div className="card-hdr">
              <div>
                <div className="card-title">This Week's Schedule</div>
                <div className="card-sub">Week of {weekStr}</div>
              </div>
              <Link href="schedule"><button className="btn btn-ghost btn-sm">Full schedule →</button></Link>
            </div>
            <div className="card-body">
              {!scheduleEntries || scheduleEntries.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, padding: '12px 0' }}>
                  No schedule set for this week.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {DAYS_ORDER.filter(d => scheduleEntries.some(s => s.day === d)).map(day => {
                    const s = scheduleEntries.find(e => e.day === day)!;
                    const isToday = day === todayDay;
                    return (
                      <div key={day} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 10px', borderRadius: 7,
                        background: isToday ? 'oklch(0.96 0.04 145)' : 'var(--surface-2)',
                        border: isToday ? '1px solid oklch(0.88 0.07 145)' : '1px solid var(--line)',
                      }}>
                        <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--ok)' : 'var(--ink)' }}>
                          {day}{isToday ? ' ← today' : ''}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>
                          {s.shift_start ?? '—'} – {s.shift_end ?? '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Performance / Collections progress */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-hdr">
              <div>
                <div className="card-title">Performance</div>
                <div className="card-sub">Collections · {period}</div>
              </div>
              <Link href="targets"><button className="btn btn-ghost btn-sm">Full targets →</button></Link>
            </div>
            <div className="card-body">
              {/* Collections vs target */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Collections vs Target</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: barColor(targetPct) }}>{targetPct}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${targetPct}%`, background: barColor(targetPct), borderRadius: 4, transition: 'width .5s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>${mtdCollected.toLocaleString()} collected</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                    {collectionTarget > 0 ? `target $${collectionTarget.toLocaleString()}` : 'No target set'}
                  </span>
                </div>
              </div>

              {/* Bonus breakdown */}
              <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>Bonus Structure</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'oklch(0.96 0.04 145)', border: '1px solid oklch(0.88 0.07 145)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ok)' }}>${bonusEarned}</div>
                    <div style={{ fontSize: 10, color: 'var(--ok)', fontWeight: 600 }}>Earned</div>
                  </div>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                    ${cxBonus.amount} for every ${cxBonus.threshold} collected.<br />
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      Next bonus in ${(cxBonus.threshold - (mtdCollected % cxBonus.threshold)).toLocaleString()}.
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent collections summary */}
              <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>This Month</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{collections?.length ?? 0}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase' }}>Total logs</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ok)' }}>{verifiedCollections}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase' }}>Verified</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Notifications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-hdr">
              <div>
                <div className="card-title">Notifications</div>
                <div className="card-sub">Recent inbox items</div>
              </div>
              <Link href="inbox"><button className="btn btn-ghost btn-sm">Inbox →</button></Link>
            </div>
            <div className="card-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {!notifications || notifications.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, padding: '20px 0' }}>
                  No notifications yet.
                </div>
              ) : (
                notifications.map(n => {
                  const typeHue = n.type === 'Payslip' ? 145 : n.type === 'Contract' ? 268 : n.type === 'Report' ? 220 : 75;
                  const icon = n.type === 'Payslip' ? '💰' : n.type === 'Contract' ? '📋' : n.type === 'Report' ? '📊' : '📄';
                  return (
                    <div key={n.id} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0',
                      borderBottom: '1px solid var(--line-2)',
                      opacity: n.is_read ? 0.6 : 1,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: `oklch(0.93 0.05 ${typeHue})`, color: `oklch(0.38 0.14 ${typeHue})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: n.is_read ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.subject || n.title || 'Document'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                          {new Date(n.created_at).toLocaleDateString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {!n.is_read && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Default (management) Dashboard ─────────────────────────────────────────

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (role === 'cx') {
    return <CxDashboard userId={user.id} />;
  }

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
            <div className="stat-l">Open Claims</div>
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
