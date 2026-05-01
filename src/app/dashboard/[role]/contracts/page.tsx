import { createClient } from '@/utils/supabase/server';
import ContractsClient from './ContractsClient';

export default async function ContractsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isMgmt = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'hr';

  let query = supabase.from('contracts').select(`*, profiles!contracts_user_id_fkey(name)`).order('created_at', { ascending: false });
  
  if (!isMgmt) {
    query = query.eq('user_id', user.id);
  }

  const { data: contracts } = await query;
  
  // Need users to generate new contracts
  const { data: users } = await supabase.from('profiles').select('id, name, role');

  return (
    <ContractsClient initialContracts={contracts || []} users={users || []} isMgmt={isMgmt} currentUserId={user.id} />
  );
}
