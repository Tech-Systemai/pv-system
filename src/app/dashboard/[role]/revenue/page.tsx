import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import RevenueClient from './RevenueClient';

export default async function RevenuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const isMgmt = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');
  const canManageLogs = ['owner', 'admin'].includes(profile?.role ?? '');

  if (isMgmt) {
    const period = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      { data: salesAgents },
      { data: cxAgents },
      { data: targets },
      { data: salesLogs },
      { data: collectionLogs },
      { data: settingsRow },
      { data: allSalesLogs },
    ] = await Promise.all([
      admin.from('profiles').select('id, name, role').eq('role', 'sales').order('name'),
      admin.from('profiles').select('id, name, role').eq('role', 'cx').order('name'),
      admin.from('targets').select('*').eq('period', period),
      // Commission aggregates count approved (Verified) logs only.
      admin.from('sales_logs').select('user_id, amount').eq('type', 'Sale').eq('status', 'Verified').gte('created_at', startOfMonth.toISOString()),
      admin.from('sales_logs').select('user_id, amount').eq('type', 'Collection').eq('status', 'Verified').gte('created_at', startOfMonth.toISOString()),
      admin.from('global_settings').select('value').eq('key', 'cx_bonus').maybeSingle(),
      // Owner/Admin: every sale log this period (all statuses) for review/approval/deletion.
      canManageLogs
        ? admin.from('sales_logs').select('*, profiles!sales_logs_user_id_fkey(name)').eq('type', 'Sale').gte('created_at', startOfMonth.toISOString()).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const cxBonus = (settingsRow?.value as any) ?? { amount: 3, threshold: 600 };

    return (
      <RevenueClient
        isMgmt={true}
        canManageLogs={canManageLogs}
        initialSales={[]}
        currentUserId={user.id}
        salesAgents={salesAgents ?? []}
        cxAgents={cxAgents ?? []}
        targets={targets ?? []}
        salesLogs={salesLogs ?? []}
        collectionLogs={collectionLogs ?? []}
        allSalesLogs={allSalesLogs ?? []}
        period={period}
        cxBonus={cxBonus}
      />
    );
  }

  const { data: sales } = await supabase
    .from('sales_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'Sale')
    .order('created_at', { ascending: false });

  return (
    <RevenueClient
      isMgmt={false}
      initialSales={sales || []}
      currentUserId={user.id}
    />
  );
}
