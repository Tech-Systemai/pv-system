import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
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

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, name, clocked_in')
    .eq('id', user.id)
    .single();

  // If profile is missing, auto-create it so the user isn't stuck
  if (!profile) {
    await admin.from('profiles').upsert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User',
      username: user.email?.split('@')[0] ?? 'user',
      role: user.user_metadata?.role ?? 'sales',
    });
  }

  const effectiveRole = profile?.role ?? user.user_metadata?.role ?? 'sales';
  const { role: urlRole } = await params;

  const isManagement = effectiveRole === 'owner' || effectiveRole === 'admin';
  if (profile && effectiveRole !== urlRole && !isManagement) {
    redirect(`/dashboard/${effectiveRole}`);
  }

  // Surface DB connection error clearly instead of a blank/broken page
  if (profileError && !profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif', background: '#f5f6f8' }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', maxWidth: '520px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a1f2e', marginBottom: '8px' }}>Database not set up yet</div>
          <div style={{ fontSize: '13px', color: '#6b7689', lineHeight: 1.7, marginBottom: '24px' }}>
            The required database tables do not exist in your Supabase project.<br />
            Run the SQL migration to create them:
          </div>
          <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', padding: '14px 18px', borderRadius: '8px', fontSize: '12px', textAlign: 'left', color: '#4338ca', fontFamily: 'monospace', marginBottom: '20px' }}>
            1. Open your Supabase dashboard<br />
            2. Go to SQL Editor → New Query<br />
            3. Paste the contents of <strong>supabase_migration.sql</strong><br />
            4. Click Run, then refresh this page
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
            Error: {profileError?.message ?? 'Profile table not found'}
          </div>
        </div>
      </div>
    );
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
              <div className="ps">Welcome back, {profile?.name ?? user.email?.split('@')[0] ?? 'User'}</div>
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
