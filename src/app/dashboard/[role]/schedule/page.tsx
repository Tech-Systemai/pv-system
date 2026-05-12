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

  const [{ data: users }, { data: schedules }] = await Promise.all([
    admin.from('profiles').select('id, name, role').in('role', ['sales', 'cx', 'supervisor']),
    isMgmt
      ? admin.from('schedules').select('*').order('created_at', { ascending: false })
      : admin.from('schedules').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);

  // Ensure the current user is always in the users list (guards against role edge-cases)
  const usersBase = users ?? [];
  const finalUsers = usersBase.some((u: any) => u.id === user.id)
    ? usersBase
    : [...usersBase, { id: user.id, name: profile?.name ?? '', role: profile?.role ?? '' }];

  return (
    <ScheduleClient
      initialSchedules={schedules || []}
      users={finalUsers}
      isMgmt={isMgmt}
      currentUserId={user.id}
      currentUserName={profile?.name ?? ''}
    />
  );
}
