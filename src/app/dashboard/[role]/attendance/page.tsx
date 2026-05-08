import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import AttendanceClient from './AttendanceClient';
import { getPermMatrix, resolveViewType, isAdminView, hasAccess } from '@/utils/getPermissions';
import { redirect } from 'next/navigation';

export default async function AttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, matrix] = await Promise.all([
    admin.from('profiles').select('role, id').eq('id', user.id).single(),
    getPermMatrix(),
  ]);

  const viewType = resolveViewType(matrix, 'attendance', profile?.role ?? '');
  if (!hasAccess(viewType)) redirect(`/dashboard/${profile?.role || 'sales'}`);
  const isMgmt = isAdminView(viewType);

  const { data: allUsers } = await admin.from('profiles').select('id, name, clocked_in');

  const logsQuery = admin.from('attendance_logs').select('*').order('date', { ascending: false }).limit(500);
  const { data: logs } = isMgmt ? await logsQuery : await logsQuery.eq('user_id', user.id);

  const { data: schedules } = await admin
    .from('schedules')
    .select('user_id, shift_start, shift_end, week, day');

  return (
    <AttendanceClient
      initialLogs={logs || []}
      users={allUsers || []}
      schedules={schedules || []}
      isMgmt={isMgmt}
      currentUserId={user.id}
    />
  );
}
