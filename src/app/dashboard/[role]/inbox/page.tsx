import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import InboxClient from './InboxClient';

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role, name').eq('id', user.id).single();
  const isMgmt = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');

  // Management sees all documents; employees see only their own
  const docsQuery = admin.from('inbox_documents').select('*').order('created_at', { ascending: false });
  const { data: documents } = isMgmt ? await docsQuery : await docsQuery.eq('user_id', user.id);

  const { data: users } = await admin.from('profiles').select('id, name, role');

  return (
    <InboxClient
      initialDocs={documents || []}
      allUsers={users || []}
      currentUserId={user.id}
      isMgmt={isMgmt}
    />
  );
}
