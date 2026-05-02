import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import TargetsClient from './TargetsClient';

export default async function TargetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single();

  const isMgmt = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');

  const period = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ data: agents }, { data: salesLogs }, { data: targets }] = await Promise.all([
    isMgmt
      ? admin.from('profiles').select('id, name, role, department').in('role', ['sales', 'cx']).order('name')
      : admin.from('profiles').select('id, name, role, department').eq('id', user.id),
    admin
      .from('sales_logs')
      .select('user_id, amount')
      .eq('type', 'Sale')
      .gte('created_at', startOfMonth.toISOString()),
    admin
      .from('targets')
      .select('*')
      .eq('period', period),
  ]);

  return (
    <TargetsClient
      agents={agents ?? []}
      salesLogs={salesLogs ?? []}
      targets={targets ?? []}
      period={period}
      isMgmt={isMgmt}
      currentUserId={user.id}
    />
  );
}
