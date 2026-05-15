import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import Sidebar from '@/components/Sidebar';
import PortalSwitcher from '@/components/PortalSwitcher';
import NotificationBell from '@/components/NotificationBell';
import ProfileButton from '@/components/ProfileButton';
import TopBarTitle from '@/components/TopBarTitle';
import TopBarClock from '@/components/TopBarClock';
import { getPermMatrix, resolveViewType, PERM_DEFAULTS } from '@/utils/getPermissions';
import DailyUpdatePrompt from '@/components/DailyUpdatePrompt';

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
  const [{ data: profile, error: profileError }, matrix] = await Promise.all([
    admin.from('profiles').select('role, name, username, email, contract_url, id_document_url').eq('id', user.id).single(),
    getPermMatrix(),
  ]);

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

  const allowedModules: Record<string, string> = {};
  for (const mod of Object.keys(PERM_DEFAULTS)) {
    allowedModules[mod] = resolveViewType(matrix, mod, urlRole);
  }

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
      <DailyUpdatePrompt userId={user.id} />
      <div className="pv-grid">
        <Sidebar role={urlRole} allowedModules={allowedModules} />

        <main className="main">
          <header className="tb">
            <TopBarTitle role={urlRole} />

            <div className="sys-pill">
              <span className="pulse"></span> System Live
            </div>

            <div className="tb-cmd">
              <button className="tb-cmd-btn" type="button">
                <span className="tb-cmd-icon">⌕</span>
                <span>Search resources, employees, reports…</span>
                <span className="tb-cmd-kbd">⌘K</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <TopBarClock />
              {isManagement && <PortalSwitcher currentRole={urlRole} />}
<NotificationBell userId={user.id} userRole={effectiveRole} />
              <ProfileButton
                userId={user.id}
                initialProfile={{
                  name: profile?.name ?? user.email?.split('@')[0] ?? 'User',
                  username: profile?.username ?? null,
                  role: effectiveRole,
                  email: profile?.email ?? user.email ?? null,
                  contract_url: (profile as any)?.contract_url ?? null,
                  id_document_url: (profile as any)?.id_document_url ?? null,
                }}
              />
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
