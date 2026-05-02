import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role, name').eq('id', user.id).single();
  const isMgmt = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');

  const { data: employees } = isMgmt
    ? await admin.from('profiles').select('id, name, role, points, score, department')
    : { data: null };

  const sessQuery = admin
    .from('coaching_sessions')
    .select(`*, agent:profiles!coaching_sessions_agent_id_fkey(name, role, department), supervisor:profiles!coaching_sessions_supervisor_id_fkey(name)`)
    .order('created_at', { ascending: false });

  const { data: sessions } = isMgmt ? await sessQuery : await sessQuery.eq('agent_id', user.id);

  return (
    <ReportsClient
      reports={sessions || []}
      employees={employees || []}
      isMgmt={isMgmt}
      currentUserId={user.id}
      currentUserName={profile?.name || 'Manager'}
    />
  );
}
