import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import CoachingClient from './CoachingClient';

export default async function CoachingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('name, role').eq('id', user.id).single();
  const isMgmt = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');

  const { data: users } = await admin.from('profiles').select('id, name, role').in('role', ['sales', 'cx']);

  const sessQuery = admin
    .from('coaching_sessions')
    .select(`*, agent:profiles!coaching_sessions_agent_id_fkey(name), supervisor:profiles!coaching_sessions_supervisor_id_fkey(name)`)
    .order('created_at', { ascending: false });

  const { data: sessions } = isMgmt ? await sessQuery : await sessQuery.eq('agent_id', user.id);

  return (
    <CoachingClient
      initialSessions={sessions || []}
      users={users || []}
      isMgmt={isMgmt}
      currentUserId={user.id}
      currentUserName={profile?.name ?? undefined}
    />
  );
}
