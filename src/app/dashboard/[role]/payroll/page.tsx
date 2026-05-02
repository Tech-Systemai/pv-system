import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import PayrollClient from './PayrollClient';
import { redirect } from 'next/navigation';

export default async function PayrollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!['owner', 'admin', 'accountant'].includes(profile?.role ?? '')) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  const { data: employees } = await admin.from('profiles').select('*').in('role', ['sales', 'cx', 'supervisor']).order('name');
  const { data: payrolls } = await admin.from('payrolls').select('*').order('created_at', { ascending: false });
  const { data: attendance } = await admin.from('attendance_logs').select('user_id, clock_in_time, clock_out_time, productive_time_minutes, date');

  return (
    <PayrollClient employees={employees || []} initialPayrolls={payrolls || []} attendanceLogs={attendance || []} />
  );
}
