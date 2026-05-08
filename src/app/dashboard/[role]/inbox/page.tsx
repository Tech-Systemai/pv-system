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

  // Pending documents (approval_status = 'pending') are only visible in the Approvals section
  let documents: any[] = [];
  if (isMgmt) {
    const { data } = await admin
      .from('inbox_documents')
      .select('*')
      .or('approval_status.neq.pending,approval_status.is.null')
      .order('created_at', { ascending: false });
    documents = data ?? [];
  } else {
    const [{ data: inbox }, { data: sent }] = await Promise.all([
      admin
        .from('inbox_documents')
        .select('*')
        .eq('user_id', user.id)
        .or('approval_status.neq.pending,approval_status.is.null')
        .order('created_at', { ascending: false }),
      admin
        .from('inbox_documents')
        .select('*')
        .eq('sender_id', user.id)
        .or('approval_status.neq.pending,approval_status.is.null')
        .order('created_at', { ascending: false }),
    ]);
    const merged = [...(inbox ?? []), ...(sent ?? [])];
    const seen = new Set<any>();
    documents = merged
      .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

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
