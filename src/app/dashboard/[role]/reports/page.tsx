import { createClient } from '@/utils/supabase/server';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isMgmt = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'supervisor';

  let query = supabase.from('coaching_sessions').select(`*, agent:profiles!coaching_sessions_agent_id_fkey(name)`).order('created_at', { ascending: false });
  
  if (!isMgmt) {
    query = query.eq('agent_id', user.id);
  }

  const { data: reports } = await query;

  return (
    <ReportsClient reports={reports || []} isMgmt={isMgmt} />
  );
}
