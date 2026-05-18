import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import KBClient from './KBClient';

export default async function KBPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const [{ data: articles }, { data: kbFolderRow }, { data: progress }] = await Promise.all([
    admin.from('knowledge_base').select('*').order('order_index', { ascending: true }),
    admin.from('global_settings').select('value').eq('key', 'kb_folders').single(),
    admin.from('kb_progress').select('article_id').eq('user_id', user.id),
  ]);

  const progressIds = (progress ?? []).map((p: any) => p.article_id);

  return <KBClient initialArticles={articles || []} userRole={profile?.role || 'sales'} currentUserId={user.id} savedCustomFolders={kbFolderRow?.value ?? []} initialProgress={progressIds} />;
}
