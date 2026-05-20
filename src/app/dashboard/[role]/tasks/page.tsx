import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import TasksClient from './TasksClient';

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('name, role, id').eq('id', user.id).single();
  const isMgmt = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');
  const isCx   = profile?.role === 'cx';

  const today = new Date().toISOString().split('T')[0];

  const { data: users } = await admin.from('profiles').select('id, name, role');

  const tasksQuery = admin
    .from('tasks')
    .select(`*, assigned_user:profiles!tasks_assigned_to_fkey(name), by_user:profiles!tasks_assigned_by_fkey(name)`)
    .order('created_at', { ascending: false });

  const [
    { data: tasks },
    { data: todayResponses },
    { data: routineRow },
    { data: incentiveRow },
  ] = await Promise.all([
    isMgmt
      ? tasksQuery
      : tasksQuery.or(`assigned_to.eq.${user.id},second_assigned_to.eq.${user.id}`),
    isMgmt
      ? admin.from('daily_task_responses').select('*').eq('log_date', today)
      : admin.from('daily_task_responses').select('*').eq('log_date', today).eq('agent_id', user.id),
    admin.from('global_settings').select('value').eq('key', 'routine_tasks').single(),
    admin.from('global_settings').select('value').eq('key', 'incentive_tasks').single(),
  ]);

  const routineDefs  = Array.isArray(routineRow?.value)  ? routineRow.value  : [];
  const incentiveDefs = Array.isArray(incentiveRow?.value) ? incentiveRow.value : [];

  return (
    <TasksClient
      initialTasks={tasks ?? []}
      users={users ?? []}
      isMgmt={isMgmt}
      isCx={isCx}
      currentUserId={user.id}
      userRole={profile?.role ?? ''}
      today={today}
      initialResponses={todayResponses ?? []}
      routineDefs={routineDefs}
      incentiveDefs={incentiveDefs}
    />
  );
}
