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

  // Avoid PostgREST FK join (time_off_requests.user_id → auth.users, not profiles).
  // Fetch requests and profiles separately then merge names in JS.
  const [{ data: reqData }, { data: allProfiles }] = await Promise.all([
    isMgmt
      ? admin.from('time_off_requests').select('*').order('created_at', { ascending: false })
      : admin.from('time_off_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    admin.from('profiles').select('id, name'),
  ]);

  const nameMap = Object.fromEntries((allProfiles ?? []).map(p => [p.id, p.name]));
  const requests = (reqData ?? []).map(r => ({
    ...r,
    profiles: { name: nameMap[r.user_id] ?? 'Unknown' },
  }));

  return (
    <TimeOffClient
      initialRequests={requests}
      isMgmt={isMgmt}
      currentUserId={user.id}
      currentUserName={profile?.name || 'User'}
    />
  );
}
