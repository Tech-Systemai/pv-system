import { createClient } from '@/utils/supabase/server';
import ApprovalsClient from './ApprovalsClient';
import { redirect } from 'next/navigation';

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isMgmt = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'supervisor';

  if (!isMgmt) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  // Fetch all pending items
  const [
    { data: timeoff },
    { data: schedules },
    { data: payrolls }
  ] = await Promise.all([
    supabase.from('time_off_requests').select(`*, profiles(name)`).eq('status', 'Pending'),
    supabase.from('schedules').select('*').eq('status', 'Pending'),
    supabase.from('payrolls').select(`*, profiles!payrolls_user_id_fkey(name)`).eq('status', 'Pending')
  ]);

  return (
    <ApprovalsClient 
      initialTimeoff={timeoff || []} 
      initialSchedules={schedules || []} 
      initialPayrolls={payrolls || []} 
    />
  );
}
