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

  // Management sees all documents; employees see inbox + sent
  let documents: any[] = [];
  if (isMgmt) {
    const { data } = await admin.from('inbox_documents').select('*').order('created_at', { ascending: false });
    documents = data ?? [];
  } else {
    const [{ data: inbox }, { data: sent }] = await Promise.all([
      admin.from('inbox_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      admin.from('inbox_documents').select('*').eq('sender_id', user.id).order('created_at', { ascending: false }),
    ]);
    // Merge and deduplicate
    const merged = [...(inbox ?? []), ...(sent ?? [])];
    const seen = new Set<any>();
    documents = merged.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
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
