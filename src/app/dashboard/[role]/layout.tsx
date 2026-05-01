import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import Sidebar from '@/components/Sidebar';
import ClockButton from '@/components/ClockButton';
import PortalSwitcher from '@/components/PortalSwitcher';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ role: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name, clocked_in')
    .eq('id', user.id)
    .single();

  console.log('DEBUG: Current User ID:', user.id);
  console.log('DEBUG: DB Profile Role:', profile?.role);
  console.log('DEBUG: Requested URL Role:', (await params).role);

  const { role: urlRole } = await params;

  // Security: redirect users who type a different role in the URL
  // BYPASS: Allow Owners and Admins to switch views
  const isManagement = profile?.role === 'owner' || profile?.role === 'admin';
  if (profile && profile.role !== urlRole && !isManagement) {
    redirect(`/dashboard/${profile.role}`);
  }

  return (
    <div className="pv">
      <div className="pv-grid">
        <Sidebar role={urlRole} />

        <main className="main">
          <header className="tb">
            <div className="pt-block">
              <div className="pt" style={{ textTransform: 'capitalize' }}>
                {urlRole} Portal
              </div>
              <div className="ps">Welcome back, {profile?.name || 'User'}</div>
            </div>

            <div className="sys-pill">
              <span className="pulse"></span> System Live
            </div>

            <div className="sw">
              <span className="sw-i">⌕</span>
              <input type="text" placeholder="Search resources, employees, reports..." />
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {isManagement && <PortalSwitcher currentRole={urlRole} />}
              <ClockButton userId={user.id} clockedIn={profile?.clocked_in ?? false} />
              
              <div style={{ position: 'relative' }}>
                <div className="bell">🔔<div className="bell-d"></div></div>
              </div>
            </div>
          </header>
          
          <div className="cnt">
            {children}
          </div>

          <div className="foot">
            <div className="foot-i"><span className="pulse"></span>Last system audit: Recently</div>
            <div className="foot-i">🔒 End-to-end encryption</div>
            <div className="foot-i">System Log</div>
            <div className="foot-i">Policy Matrix</div>
            <div className="foot-v">v4.12.0 · Enterprise</div>
          </div>
        </main>
      </div>
    </div>
  );
}
