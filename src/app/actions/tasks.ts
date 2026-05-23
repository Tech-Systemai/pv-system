'use server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

async function log(userId: string, module: string, action: string, description: string, metadata?: Record<string, unknown>) {
  try {
    const admin = createAdminClient();
    const { data: prof } = await admin.from('profiles').select('name').eq('id', userId).single();
    await admin.from('activity_log').insert({
      user_id: userId,
      user_name: (prof as any)?.name ?? 'Employee',
      module,
      action,
      description,
      metadata: metadata ?? {},
    });
  } catch { /* never block */ }
}

export async function acknowledgeTask(taskId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('tasks').update({ acknowledged: true }).eq('id', taskId);
  revalidatePath(`/dashboard/${role}/tasks`);
  if (user) {
    const admin = createAdminClient();
    const { data: task } = await admin.from('tasks').select('title').eq('id', taskId).single();
    await log(user.id, 'tasks', 'acknowledged', `Acknowledged task: "${(task as any)?.title ?? taskId}"`);
  }
}

export async function completeTask(taskId: string, role: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('tasks').update({ completed: true }).eq('id', taskId);
  revalidatePath(`/dashboard/${role}/tasks`);
  if (user) {
    const admin = createAdminClient();
    const { data: task } = await admin.from('tasks').select('title').eq('id', taskId).single();
    await log(user.id, 'tasks', 'completed', `Completed task: "${(task as any)?.title ?? taskId}"`);
  }
}
