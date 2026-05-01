import { createClient } from '@/utils/supabase/server';
import AnalyticsClient from './AnalyticsClient';
import { redirect } from 'next/navigation';

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isMgmt = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'supervisor';

  if (!isMgmt) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  // Fetch some aggregate data for charts
  const { data: sales } = await supabase.from('sales_logs').select('amount, created_at').eq('type', 'Sale');
  const { data: attendance } = await supabase.from('attendance_logs').select('status, date');

  return (
    <AnalyticsClient sales={sales || []} attendance={attendance || []} />
  );
}
