import { createClient } from '@/utils/supabase/server';
import TasksClient from './TasksClient';

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('name, role, id').eq('id', user.id).single();
  const isMgmt = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'supervisor';

  const { data: users } = await supabase.from('profiles').select('id, name');
  
  // Fetch tasks
  let query = supabase.from('tasks').select(`*, assigned_user:profiles!tasks_assigned_to_fkey(name), by_user:profiles!tasks_assigned_by_fkey(name)`).order('created_at', { ascending: false });
  
  if (!isMgmt) {
    query = query.eq('assigned_to', user.id);
  }

  const { data: tasks } = await query;

  return (
    <>
      <TasksClient 
        initialTasks={tasks || []} 
        users={users || []} 
        isMgmt={isMgmt} 
        currentUserId={user.id} 
      />
    </>
  );
}
