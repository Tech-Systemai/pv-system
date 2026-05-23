import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import AuditPageClient from './AuditPageClient';

export default async function DailyUpdatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!['owner', 'admin', 'supervisor'].includes(profile?.role ?? '')) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0];

  const [{ data: updates }, { data: activityLog }] = await Promise.all([
    admin
      .from('daily_updates')
      .select('*, profiles!daily_updates_user_id_fkey(name, role)')
      .gte('date', cutoff)
      .order('date', { ascending: false })
      .order('created_at', { ascending: true }),
    admin
      .from('activity_log')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  return (
    <AuditPageClient
      updates={updates ?? []}
      activityLog={activityLog ?? []}
    />
  );
}
