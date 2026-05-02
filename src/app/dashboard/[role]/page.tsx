import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import Link from 'next/link';

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

  return (
    <>
      <div className="stat-grid">
        <Link href="attendance" style={{ textDecoration: 'none' }}>
          <div className="stat">
            <div className="stat-h">
              <div className="s-ico ind">👥</div>
              <span className="trend t-up">↗ Active</span>
            </div>
            <div className="s-l">Live Clock-Ins</div>
            <div className="s-v">{activeUsers ?? 0}</div>
            <div className="s-s">Out of {totalUsers ?? 0} total staff</div>
          </div>
        </Link>

        <Link href="finance" style={{ textDecoration: 'none' }}>
          <div className="stat">
            <div className="stat-h">
              <div className="s-ico gn">$</div>
            </div>
            <div className="s-l">MTD Revenue</div>
            <div className="s-v gn">${mtdRevenue.toLocaleString()}</div>
            <div className="s-s">All verified sales</div>
          </div>
        </Link>

        <Link href="tickets" style={{ textDecoration: 'none' }}>
          <div className="stat">
            <div className="stat-h">
              <div className="s-ico am">🎫</div>
            </div>
            <div className="s-l">Open Tickets</div>
            <div className="s-v am">{openTickets ?? 0}</div>
            <div className="s-s">Awaiting response</div>
          </div>
        </Link>

        <Link href="tasks" style={{ textDecoration: 'none' }}>
          <div className="stat">
            <div className="stat-h">
              <div className="s-ico rd">✓</div>
            </div>
            <div className="s-l">Pending Tasks</div>
            <div className="s-v rd">{pendingTasks ?? 0}</div>
            <div className="s-s">Require attention</div>
          </div>
        </Link>
      </div>

      <div className="two">
        <div className="pn">
          <div className="pn-h">
            <div>
              <div className="pn-t">Recent Activity</div>
              <div className="pn-s">Latest audit events</div>
            </div>
            <Link href="audit"><button className="b-ic">View all →</button></Link>
          </div>
          <div className="scrollable" style={{ maxHeight: '240px' }}>
            {(recentActivity ?? []).length === 0 && (
              <div className="feed"><span className="f-t">—</span><div className="f-x">No audit events yet</div></div>
            )}
            {(recentActivity ?? []).map((a, i) => (
              <div key={i} className="feed">
                <span className="f-t">{new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="f-d" style={{ background: '#4f46e5' }}></span>
                <div className="f-x"><strong>{a.entity_type}</strong> · {a.action}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pn">
          <div className="pn-h">
            <div>
              <div className="pn-t">System Status</div>
              <div className="pn-s">Platform health</div>
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
              <span style={{ fontWeight: 600 }}>Database connection</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Stable</span>
            </div>
            <div className="bw"><div className="bf" style={{ width: '100%', background: '#10b981' }}></div></div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
              <span style={{ fontWeight: 600 }}>Policy Engine</span>
              <span style={{ color: '#4f46e5', fontWeight: 600 }}>Active</span>
            </div>
            <div className="bw"><div className="bf" style={{ width: '100%', background: '#4f46e5' }}></div></div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
              <span style={{ fontWeight: 600 }}>Apploye Sync</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Nightly at 23:45</span>
            </div>
            <div className="bw"><div className="bf" style={{ width: '85%', background: '#6366f1' }}></div></div>
          </div>
        </div>
      </div>
    </>
  );
}
