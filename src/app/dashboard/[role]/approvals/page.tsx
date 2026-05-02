import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import ApprovalsClient from './ApprovalsClient';
import { redirect } from 'next/navigation';

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!['owner', 'admin', 'supervisor'].includes(profile?.role ?? '')) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  const [
    { data: timeoff },
    { data: schedules },
    { data: payrolls }
  ] = await Promise.all([
    admin.from('time_off_requests').select(`*, profiles(name)`).eq('status', 'Pending'),
    admin.from('schedules').select('*').eq('status', 'Pending'),
    admin.from('payrolls').select(`*, profiles!payrolls_user_id_fkey(name)`).eq('status', 'Pending'),
  ]);

  return (
    <ApprovalsClient
      initialTimeoff={timeoff || []}
      initialSchedules={schedules || []}
      initialPayrolls={payrolls || []}
    />
  );
}
