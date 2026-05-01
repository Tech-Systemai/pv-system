import { createClient } from '@/utils/supabase/server';
import PayrollClient from './PayrollClient';
import { redirect } from 'next/navigation';

export default async function PayrollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAccountantOrOwner = profile?.role === 'owner' || profile?.role === 'accountant';

  if (!isAccountantOrOwner) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  // Fetch all employees to process payroll
  const { data: employees } = await supabase.from('profiles').select('*').order('name');
  
  // Fetch existing payroll drafts
  const { data: payrolls } = await supabase.from('payrolls').select('*').order('created_at', { ascending: false });

  return (
    <>
      <PayrollClient employees={employees || []} initialPayrolls={payrolls || []} />
    </>
  );
}
