import { createClient } from '@/utils/supabase/server';
import ChatClient from './ChatClient';

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch users for direct messaging
  const { data: profiles } = await supabase.from('profiles').select('id, name, role').neq('id', user.id);
  
  // Fetch recent messages
  const { data: messages } = await supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(name)')
    .order('created_at', { ascending: true })
    .limit(100);

  return (
    <ChatClient initialMessages={messages || []} users={profiles || []} currentUserId={user.id} />
  );
}
