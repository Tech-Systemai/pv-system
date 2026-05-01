import { createClient } from '@/utils/supabase/server';
import KBClient from './KBClient';

export default async function KBPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  const { data: articles } = await supabase
    .from('knowledge_base')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <>
      <KBClient initialArticles={articles || []} userRole={profile?.role || 'sales'} />
    </>
  );
}
