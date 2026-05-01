'use server';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function acknowledgeTask(taskId: string, role: string) {
  const supabase = await createClient();
  await supabase.from('tasks').update({ acknowledged: true }).eq('id', taskId);
  revalidatePath(`/dashboard/${role}/tasks`);
}

export async function completeTask(taskId: string, role: string) {
  const supabase = await createClient();
  await supabase.from('tasks').update({ completed: true }).eq('id', taskId);
  revalidatePath(`/dashboard/${role}/tasks`);
}
