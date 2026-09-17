import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import SmartTimeClient from './SmartTimeClient';
import { DEFAULT_PREFS, type Prefs, type Task } from '@/lib/smartTime/types';

// The day plan itself is loaded in the browser, not here: it depends on the
// user's own date and timezone, and on a prayer-time lookup for their city.
export default async function SmartTimePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [{ data: prefs }, { data: tasks }, { data: dumps }, { data: reviews }, { data: periods }] =
    await Promise.all([
      admin.from('smart_time_prefs').select('*').eq('user_id', user.id).maybeSingle(),
      // Open tasks plus recent history — the weekly review needs finished ones.
      admin
        .from('smart_time_tasks')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'dropped')
        .order('created_at', { ascending: false })
        .limit(400),
      admin
        .from('smart_time_dumps')
        .select('id, raw_text, source, task_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      admin
        .from('smart_time_reviews')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(8),
      admin
        .from('smart_time_period_log')
        .select('*')
        .eq('user_id', user.id)
        .order('started_on', { ascending: false })
        .limit(6),
    ]);

  const initialPrefs: Prefs = { user_id: user.id, ...DEFAULT_PREFS, ...(prefs ?? {}) };

  return (
    <SmartTimeClient
      userId={user.id}
      initialPrefs={initialPrefs}
      initialTasks={(tasks ?? []) as Task[]}
      initialDumps={dumps ?? []}
      initialReviews={reviews ?? []}
      initialPeriods={periods ?? []}
      prefsExist={Boolean(prefs)}
    />
  );
}
