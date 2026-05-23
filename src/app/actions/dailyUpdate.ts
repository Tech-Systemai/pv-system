'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export async function checkDailyUpdateStatus(
  localDate: string,
  weekStart: string,
  dayName: string,
  nowMinutes: number
): Promise<{ due: string[]; answered: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { due: [], answered: [] };

  const admin = createAdminClient();

  const { data: schedule } = await admin
    .from('schedules')
    .select('shift_start, shift_end')
    .eq('user_id', user.id)
    .eq('week', weekStart)
    .eq('day', dayName)
    .maybeSingle();

  if (!schedule) return { due: [], answered: [] };

  const startMin = toMinutes(schedule.shift_start);
  const endMin   = toMinutes(schedule.shift_end);
  const midMin   = Math.floor((startMin + endMin) / 2);

  const due = ['start', 'midday', 'end'].filter(p => {
    if (p === 'start')  return nowMinutes >= startMin;
    if (p === 'midday') return nowMinutes >= midMin;
    if (p === 'end')    return nowMinutes >= endMin - 30;
    return false;
  });

  if (due.length === 0) return { due: [], answered: [] };

  const { data: answeredData } = await admin
    .from('daily_updates')
    .select('prompt')
    .eq('user_id', user.id)
    .eq('date', localDate);

  return {
    due,
    answered: (answeredData ?? []).map((r: any) => r.prompt),
  };
}

export async function submitDailyUpdate(
  userId: string,
  localDate: string,
  prompt: string,
  answer: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return { error: 'Unauthorized' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('daily_updates')
    .insert({ user_id: userId, date: localDate, prompt, answer });

  if (error && !error.message.toLowerCase().includes('duplicate') && !error.message.toLowerCase().includes('unique')) {
    return { error: error.message };
  }

  try {
    const { data: prof } = await admin.from('profiles').select('name').eq('id', userId).single();
    const labels: Record<string, string> = { start: 'Start of Shift', midday: 'Mid-Shift Check-in', end: 'End of Shift' };
    await admin.from('activity_log').insert({
      user_id: userId,
      user_name: (prof as any)?.name ?? 'Employee',
      module: 'daily-updates',
      action: 'submitted',
      description: `Submitted ${labels[prompt] ?? prompt} daily update`,
      metadata: { prompt, date: localDate, preview: answer.slice(0, 300) },
    });
  } catch { /* never block main operation */ }

  return { success: true };
}
