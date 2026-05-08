import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import ScheduleClient from './ScheduleClient';
import { redirect } from 'next/navigation';
import { getPermMatrix, resolveViewType, isAdminView, hasAccess } from '@/utils/getPermissions';

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, matrix] = await Promise.all([
    admin.from('profiles').select('role, name').eq('id', user.id).single(),
    getPermMatrix(),
  ]);

  const viewType = resolveViewType(matrix, 'schedule', profile?.role ?? '');
  if (!hasAccess(viewType)) redirect(`/dashboard/${profile?.role || 'sales'}`);
  const isMgmt = isAdminView(viewType);

  const { data: users } = await admin.from('profiles').select('id, name, role').in('role', ['sales', 'cx', 'supervisor']);
  const { data: schedules } = await admin.from('schedules').select('*').order('created_at', { ascending: false });

  return (
    <ScheduleClient
      initialSchedules={schedules || []}
      users={users || []}
      isMgmt={isMgmt}
      currentUserId={user.id}
      currentUserName={profile?.name ?? ''}
    />
  );
}
