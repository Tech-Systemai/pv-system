import { createClient } from '@/utils/supabase/server';
import AttendanceClient from './AttendanceClient';

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role, id').eq('id', user.id).single();
  const isMgmt = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'supervisor' || profile?.role === 'accountant';

  const { data: allUsers } = await supabase.from('profiles').select('id, name, clocked_in');
  
  let query = supabase.from('attendance_logs').select('*').order('date', { ascending: true });
  if (!isMgmt) {
    query = query.eq('user_id', user.id);
  }

  const { data: logs } = await query;

  return (
    <>
      <AttendanceClient 
        initialLogs={logs || []} 
        users={allUsers || []} 
        isMgmt={isMgmt} 
        currentUserId={user.id} 
      />
    </>
  );
}
