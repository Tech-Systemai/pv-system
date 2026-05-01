import { createClient } from '@/utils/supabase/server';
import CoachingClient from './CoachingClient';

export default async function CoachingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single();
  const isMgmt = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'supervisor';

  const { data: users } = await supabase.from('profiles').select('id, name');
  
  let query = supabase.from('coaching_sessions').select(`*, agent:profiles!coaching_sessions_agent_id_fkey(name), supervisor:profiles!coaching_sessions_supervisor_id_fkey(name)`).order('created_at', { ascending: false });
  if (!isMgmt) {
    query = query.eq('agent_id', user.id);
  }

  const { data: sessions } = await query;

  return (
    <>
      <CoachingClient 
        initialSessions={sessions || []} 
        users={users || []} 
        isMgmt={isMgmt} 
        currentUserId={user.id} 
      />
    </>
  );
}
