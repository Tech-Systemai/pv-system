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

  const { data: users } = await admin.from('profiles').select('id, name, role');

  const tasksQuery = admin
    .from('tasks')
    .select(`*, assigned_user:profiles!tasks_assigned_to_fkey(name), by_user:profiles!tasks_assigned_by_fkey(name)`)
    .order('created_at', { ascending: false });

  const { data: tasks } = isMgmt ? await tasksQuery : await tasksQuery.eq('assigned_to', user.id);

  return (
    <TasksClient
      initialTasks={tasks || []}
      users={users || []}
      isMgmt={isMgmt}
      currentUserId={user.id}
    />
  );
}
