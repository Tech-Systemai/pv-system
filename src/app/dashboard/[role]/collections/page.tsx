import { createClient } from '@/utils/supabase/server';
import CollectionsClient from './CollectionsClient';

export default async function CollectionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch collection logs for the user
  const { data: collections } = await supabase
    .from('sales_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'Collection')
    .order('created_at', { ascending: false });

  return (
    <CollectionsClient initialCollections={collections || []} currentUserId={user.id} />
  );
}
