import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import TimeOffClient from './TimeOffClient';

export default async function TimeOffPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('name, role').eq('id', user.id).single();
  const isMgmt = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');

  const reqQuery = admin
    .from('time_off_requests')
    .select(`*, profiles:user_id(name)`)
    .order('created_at', { ascending: false });

  const { data: requests } = isMgmt ? await reqQuery : await reqQuery.eq('user_id', user.id);

  return (
    <TimeOffClient
      initialRequests={requests || []}
      isMgmt={isMgmt}
      currentUserId={user.id}
      currentUserName={profile?.name || 'User'}
    />
  );
}
