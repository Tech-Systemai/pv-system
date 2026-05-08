import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import PayrollClient from './PayrollClient';
import { redirect } from 'next/navigation';
import { getPermMatrix, resolveViewType, hasAccess } from '@/utils/getPermissions';

export default async function PayrollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, matrix] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).single(),
    getPermMatrix(),
  ]);

  const viewType = resolveViewType(matrix, 'payroll', profile?.role ?? '');
  if (!hasAccess(viewType)) redirect(`/dashboard/${profile?.role || 'sales'}`);

  const { data: employees } = await admin.from('profiles').select('*').in('role', ['sales', 'cx', 'supervisor']).order('name');
  const { data: payrolls } = await admin.from('payrolls').select('*').order('created_at', { ascending: false });
  const { data: attendance } = await admin.from('attendance_logs').select('user_id, clock_in_time, clock_out_time, productive_time_minutes, date');

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00Z`;
  const { data: violations } = await admin
    .from('violations')
    .select('user_id, salary_deducted, points_deducted, triggered_at')
    .gte('triggered_at', monthStart);

  return (
    <PayrollClient
      employees={employees || []}
      initialPayrolls={payrolls || []}
      attendanceLogs={attendance || []}
      violations={violations || []}
    />
  );
}
