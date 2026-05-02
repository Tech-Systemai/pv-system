import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import AnalyticsClient from './AnalyticsClient';
import { redirect } from 'next/navigation';

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const isMgmt = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');

  if (!isMgmt) redirect(`/dashboard/${profile?.role || 'sales'}`);

  const { data: sales } = await admin.from('sales_logs').select('amount, created_at').eq('type', 'Sale');
  const { data: attendance } = await admin.from('attendance_logs').select('status, date');

  return <AnalyticsClient sales={sales || []} attendance={attendance || []} />;
}
