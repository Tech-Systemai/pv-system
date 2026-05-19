import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import KBClient from './KBClient';

const MGMT = ['owner', 'admin', 'supervisor'];

function canAccess(role: string, level: string | null): boolean {
  switch (level ?? 'Everyone') {
    case 'Everyone':           return true;
    case 'Management Only':
    case 'Mgmt only':          return MGMT.includes(role);
    case 'Sales + Mgmt':       return role === 'sales' || MGMT.includes(role);
    case 'CX + Mgmt':          return role === 'cx'    || MGMT.includes(role);
    case 'HR + Mgmt':          return role === 'hr'    || MGMT.includes(role);
    case 'Sales & CX + Mgmt':  return ['sales','cx'].includes(role) || MGMT.includes(role);
    case 'New hires':           return true;
    default:                   return MGMT.includes(role);
  }
}

export default async function KBPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [{ data: profile }, { data: allArticles }, { data: kbFolderRow }, { data: progress }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).single(),
    admin.from('knowledge_base').select('*').order('order_index', { ascending: true }),
    admin.from('global_settings').select('value').eq('key', 'kb_folders').single(),
    admin.from('kb_progress').select('article_id').eq('user_id', user.id),
  ]);

  const userRole    = profile?.role || 'sales';
  const articles    = (allArticles || []).filter(a => canAccess(userRole, a.access_level));
  const progressIds = (progress ?? []).map((p: any) => p.article_id);
  const savedFolders = kbFolderRow != null ? (kbFolderRow.value ?? null) : null;

  return (
    <KBClient
      initialArticles={articles}
      userRole={userRole}
      currentUserId={user.id}
      savedFolders={savedFolders}
      initialProgress={progressIds}
    />
  );
}
