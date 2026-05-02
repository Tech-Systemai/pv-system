import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import ScheduleClient from './ScheduleClient';

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role, id').eq('id', user.id).single();
  const isMgmt = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');

  const { data: users } = await admin.from('profiles').select('id, name, role').in('role', ['sales', 'cx', 'supervisor']);
  const { data: schedules } = await admin.from('schedules').select('*').order('created_at', { ascending: false });

  return (
    <ScheduleClient
      initialSchedules={schedules || []}
      users={users || []}
      isMgmt={isMgmt}
      currentUserId={user.id}
    />
  );
}
