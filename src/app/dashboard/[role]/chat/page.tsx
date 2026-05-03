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
    { data: messages },
    { data: allUsers },
    { data: memberships },
  ] = await Promise.all([
    admin.from('profiles').select('name, role').eq('id', user.id).single(),
    admin.from('messages').select('*').not('channel', 'is', null).order('created_at', { ascending: true }).limit(200),
    admin.from('profiles').select('id, name, role, clocked_in, status').order('name'),
    admin.from('channel_memberships').select('*'),
  ]);

  return (
    <ChatClient
      initialMessages={messages || []}
      currentUserId={user.id}
      currentUserRole={profile?.role || 'sales'}
      currentUserName={profile?.name || 'User'}
      allUsers={allUsers || []}
      channelMemberships={memberships || []}
    />
  );
}
