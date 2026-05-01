import { createClient } from '@/utils/supabase/server';
import FinanceClient from './FinanceClient';

export default async function FinancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Real data fetching logic will go here
  const { data: sales } = await supabase.from('sales_logs').select('amount, type');
  const { data: payrolls } = await supabase.from('payrolls').select('net_pay');

  return <FinanceClient revenue={sales || []} expenses={payrolls || []} />;
}
