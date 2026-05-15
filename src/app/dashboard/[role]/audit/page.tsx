import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import DailyUpdatesClient from './DailyUpdatesClient';
import { redirect } from 'next/navigation';

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

  const { data: updates } = await admin
    .from('daily_updates')
    .select('*, profiles!daily_updates_user_id_fkey(name, role)')
    .gte('date', cutoff)
    .order('date', { ascending: false })
    .order('created_at', { ascending: true });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-1,#e8eaf0)', margin: 0 }}>Daily Updates</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3,rgba(255,255,255,0.4))', margin: '6px 0 0' }}>
          Shift check-ins from all scheduled employees — last 30 days.
        </p>
      </div>
      <DailyUpdatesClient initialUpdates={updates || []} />
    </div>
  );
}
