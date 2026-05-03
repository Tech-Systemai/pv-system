import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import ChatClient from './ChatClient';

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [
    { data: profile },
    { data: channelMsgs },
    { data: dmMsgs },
    { data: allUsers },
    { data: memberships },
  ] = await Promise.all([
    admin.from('profiles').select('name, role').eq('id', user.id).single(),
    // Channel messages (non-DM), capped at 200 per channel history
    admin.from('messages').select('*').not('channel', 'is', null).not('channel', 'like', 'dm-%').order('created_at', { ascending: true }).limit(200),
    // DMs involving this user — no limit, fetches both sides of every conversation
    admin.from('messages').select('*').like('channel', 'dm-%').or(`user_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: true }),
    admin.from('profiles').select('id, name, role, clocked_in, status').order('name'),
    admin.from('channel_memberships').select('*'),
  ]);

  return (
    <ChatClient
      initialMessages={[...(channelMsgs || []), ...(dmMsgs || [])]}
      currentUserId={user.id}
      currentUserRole={profile?.role || 'sales'}
      currentUserName={profile?.name || 'User'}
      allUsers={allUsers || []}
      channelMemberships={memberships || []}
    />
  );
}
