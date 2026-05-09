import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import InboxClient from './InboxClient';
import { getPermMatrix, resolveViewType, isAdminView } from '@/utils/getPermissions';

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, matrix] = await Promise.all([
    admin.from('profiles').select('role, name').eq('id', user.id).single(),
    getPermMatrix(),
  ]);

  const viewType = resolveViewType(matrix, 'inbox', profile?.role ?? '');
  const isMgmt = isAdminView(viewType);

  // Inbox = received by me; Sent = sent by me to others
  // Pending approval_status docs live only in Approvals section
  const [{ data: inbox }, { data: sent }] = await Promise.all([
    admin.from('inbox_documents').select('*')
      .eq('user_id', user.id)
      .or('approval_status.neq.pending,approval_status.is.null')
      .order('created_at', { ascending: false }),
    admin.from('inbox_documents').select('*')
      .eq('sender_id', user.id)
      .neq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);
  const seen = new Set<string>();
  const documents = [...(inbox ?? []), ...(sent ?? [])]
    .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
