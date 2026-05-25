import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import TicketsClient from './TicketsClient';

export default async function TicketsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin    = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('name, role').eq('id', user.id).single();
  const userRole = profile?.role ?? '';
  const isMgmt   = ['owner', 'admin', 'supervisor', 'dentist'].includes(userRole);
  const isCX     = userRole === 'cx';

  // Fetch tickets and profiles separately — avoids broken PostgREST FK join
  // (tickets.user_id → auth.users, not profiles, so profiles(name) fails)
  const [ticketResult, { data: allProfiles }] = await Promise.all([
    isMgmt
      ? admin.from('tickets').select('*').order('created_at', { ascending: false })
      : isCX
        ? admin.from('tickets').select('*')
            .or(`ticket_type.eq.customer,user_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
        : admin.from('tickets').select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
    admin.from('profiles').select('id, name, role').order('name'),
  ]);

  // If CX query failed (ticket_type column not yet migrated), fall back to own tickets
  let ticketData = ticketResult.data;
  if (ticketResult.error && isCX) {
    const { data: fallback } = await admin
      .from('tickets').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    ticketData = fallback;
  }

  const nameMap = Object.fromEntries((allProfiles ?? []).map(p => [p.id, p.name]));
  const tickets = (ticketData ?? []).map(t => ({
    ...t,
    profiles: { name: nameMap[t.user_id] ?? 'Unknown' },
  }));

  return (
    <TicketsClient
      initialTickets={tickets}
      isMgmt={isMgmt}
      userRole={userRole}
      currentUserId={user.id}
      allUsers={allProfiles || []}
    />
  );
}
