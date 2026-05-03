import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import TicketsClient from './TicketsClient';

export default async function TicketsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('name, role').eq('id', user.id).single();
  const isMgmt = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');

  const tQuery = admin
    .from('tickets')
    .select('*, profiles(name)')
    .order('created_at', { ascending: false });

  const { data: tickets } = isMgmt ? await tQuery : await tQuery.eq('user_id', user.id);

  const { data: allUsers } = isMgmt
    ? await admin.from('profiles').select('id, name, role').order('name')
    : { data: [] };

  return (
    <TicketsClient
      initialTickets={tickets || []}
      isMgmt={isMgmt}
      currentUserId={user.id}
      allUsers={allUsers || []}
    />
  );
}
