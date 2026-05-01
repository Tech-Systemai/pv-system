import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: openTickets },
    { count: pendingTasks },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('clocked_in', true),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'Open'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('completed', false),
  ]);

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
              <span className="trend t-up">↗ +12.3%</span>
            </div>
            <div className="s-l">MTD Revenue</div>
            <div className="s-v">$482,900</div>
            <div className="s-s">Internal Gross</div>
          </div>
        </Link>

        <Link href="hr" style={{ textDecoration: 'none' }}>
          <div className="stat">
            <div className="stat-h">
              <div className="s-ico am">📈</div>
            </div>
            <div className="s-l">Hiring Pipeline</div>
            <div className="s-v">3</div>
            <div className="s-s">Active Recruitment</div>
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
              <div className="pn-t">Live Activity Stream</div>
              <div className="pn-s">Real-time events across all portals</div>
            </div>
            <Link href="monitoring">
              <button className="b-ic">View all →</button>
            </Link>
          </div>
          <div className="scrollable" style={{ maxHeight: '240px' }}>
            <div className="feed"><span className="f-t">Just now</span><span className="f-d" style={{ background: '#10b981' }}></span><div className="f-x"><strong>System</strong> · Updated UI to v3</div></div>
            <div className="feed"><span className="f-t">2m ago</span><span className="f-d" style={{ background: '#4f46e5' }}></span><div className="f-x"><strong>Admin</strong> · Pushed CSS globals</div></div>
          </div>
        </div>

        <div className="pn">
          <div className="pn-h">
            <div>
              <div className="pn-t">System Status</div>
              <div className="pn-s">Platform health metrics</div>
            </div>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
              <span style={{ color: '#1a1f2e', fontWeight: 600 }}>Database connection</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Stable</span>
            </div>
            <div className="bw"><div className="bf" style={{ width: '100%', background: '#10b981' }}></div></div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
              <span style={{ color: '#1a1f2e', fontWeight: 600 }}>Policy Engine</span>
              <span style={{ color: '#4f46e5', fontWeight: 600 }}>Active</span>
            </div>
            <div className="bw"><div className="bf" style={{ width: '100%', background: '#4f46e5' }}></div></div>
          </div>
        </div>
      </div>
    </>
  );
}
