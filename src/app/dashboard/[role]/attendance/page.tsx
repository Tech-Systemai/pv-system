import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import AttendanceClient from './AttendanceClient';

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role, id').eq('id', user.id).single();
  const isMgmt = ['owner', 'admin', 'supervisor', 'accountant'].includes(profile?.role ?? '');

  const { data: allUsers } = await admin.from('profiles').select('id, name, clocked_in');

  const logsQuery = admin.from('attendance_logs').select('*').order('date', { ascending: false }).limit(500);
  const { data: logs } = isMgmt ? await logsQuery : await logsQuery.eq('user_id', user.id);

  return (
    <AttendanceClient
      initialLogs={logs || []}
      users={allUsers || []}
      isMgmt={isMgmt}
      currentUserId={user.id}
    />
  );
}
