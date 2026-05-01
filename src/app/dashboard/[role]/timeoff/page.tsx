import { createClient } from '@/utils/supabase/server';
import TimeOffClient from './TimeOffClient';

export default async function TimeOffPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single();
  const role = profile?.role || 'sales';
  const isMgmt = role === 'owner' || role === 'admin' || role === 'supervisor';

  // Fetch requests based on role
  // Mgmt sees all, normal users see their own
  let query = supabase.from('time_off_requests').select(`
    *,
    profiles:user_id(name)
  `).order('created_at', { ascending: false });

  if (!isMgmt) {
    query = query.eq('user_id', user.id);
  }

  const { data: requests } = await query;

  return (
    <>
      <TimeOffClient 
        initialRequests={requests || []} 
        isMgmt={isMgmt} 
        currentUserId={user.id} 
        currentUserName={profile?.name || 'User'} 
      />
    </>
  );
}
