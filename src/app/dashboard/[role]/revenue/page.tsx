import { createClient } from '@/utils/supabase/server';
import RevenueClient from './RevenueClient';

export default async function RevenuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch sales logs for the user
  const { data: sales } = await supabase
    .from('sales_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'Sale')
    .order('created_at', { ascending: false });

  return (
    <RevenueClient initialSales={sales || []} currentUserId={user.id} />
  );
}
