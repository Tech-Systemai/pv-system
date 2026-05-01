import { createClient } from '@/utils/supabase/server';
import InboxClient from './InboxClient';

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch all documents belonging to this user
  const { data: documents } = await supabase
    .from('inbox_documents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch all users to populate the "Compose" dropdown
  const { data: users } = await supabase
    .from('profiles')
    .select('id, name, role');

  return (
    <>
      <InboxClient initialDocs={documents || []} allUsers={users || []} currentUserId={user.id} />
    </>
  );
}
