import { createClient } from '@/utils/supabase/server';
import TicketsClient from './TicketsClient';

export default async function TicketsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single();
  const isMgmt = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'supervisor';

  let query = supabase.from('tickets').select(`*, profiles(name)`).order('created_at', { ascending: false });
  if (!isMgmt) {
    query = query.eq('user_id', user.id);
  }

  const { data: tickets } = await query;

  return (
    <>
      <TicketsClient 
        initialTickets={tickets || []} 
        isMgmt={isMgmt} 
        currentUserId={user.id} 
      />
    </>
  );
}
