import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import FinanceClient from './FinanceClient';
import { redirect } from 'next/navigation';

export default async function FinancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!['owner', 'admin', 'accountant'].includes(profile?.role ?? '')) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  const [{ data: sales }, { data: payrolls }, { data: manualEntries }] = await Promise.all([
    admin.from('sales_logs').select('amount, type, created_at, profiles(name)').order('created_at', { ascending: false }),
    admin.from('payrolls').select('net_pay, base_salary, deductions, period, created_at, profiles(name)').order('created_at', { ascending: false }),
    admin.from('finance_entries').select('*').order('created_at', { ascending: false }),
  ]);

  return (
    <FinanceClient
      revenue={sales || []}
      payrollExpenses={payrolls || []}
      manualEntries={manualEntries || []}
    />
  );
}
