import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import KBClient from './KBClient';

export default async function KBPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const { data: articles } = await admin.from('knowledge_base').select('*').order('created_at', { ascending: false });

  return <KBClient initialArticles={articles || []} userRole={profile?.role || 'sales'} currentUserId={user.id} />;
}
