import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import PerformanceClient from './PerformanceClient';

export default async function PerformancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const admin = createAdminClient();

  const [
    { data: profile },
    { data: violations },
    { data: attendanceLogs },
    { data: target },
    { data: salesLogs },
    { data: coachingSessions },
  ] = await Promise.all([
    admin.from('profiles').select('id, name, role, points, salary, department').eq('id', user.id).single(),
    admin.from('violations').select('*').eq('user_id', user.id).order('triggered_at', { ascending: false }),
    admin.from('attendance_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(60),
    admin.from('targets').select('*').eq('user_id', user.id).eq('period', new Date().toLocaleString('default', { month: 'long', year: 'numeric' })).maybeSingle(),
    admin.from('sales_logs').select('amount, created_at').eq('user_id', user.id),
    admin.from('coaching_sessions').select('*, supervisor:supervisor_id(name)').eq('agent_id', user.id).order('created_at', { ascending: false }).limit(3),
  ]);

  return (
    <PerformanceClient
      profile={profile}
      violations={violations ?? []}
      attendanceLogs={attendanceLogs ?? []}
      target={target ?? null}
      salesLogs={salesLogs ?? []}
      coachingSessions={coachingSessions ?? []}
    />
  );
}
