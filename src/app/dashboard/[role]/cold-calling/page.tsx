import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import ColdCallingClient from './ColdCallingClient';
import { DEFAULT_DAILY_TARGET, type CallDay, type CallWeek } from '@/lib/coldCalling/types';

// Every row in this section belongs to the signed-in user, so the reads are
// filtered to their id here and /api/db re-applies the same filter on write.
// "Today" is deliberately not computed on the server: the box this renders on
// may sit in a different timezone to the person calling, so the client decides
// which day it is.
export default async function ColdCallingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [{ data: prefs }, { data: days, error: daysError }, { data: weeks }] = await Promise.all([
    admin.from('cold_call_prefs').select('*').eq('user_id', user.id).maybeSingle(),
    // A year of history: enough for the month calendar to page back through and
    // for the week-by-week list underneath it.
    admin
      .from('cold_call_days')
      .select('*')
      .eq('user_id', user.id)
      .order('call_date', { ascending: false })
      .limit(400),
    admin
      .from('cold_call_weeks')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(60),
  ]);

  return (
    <ColdCallingClient
      userId={user.id}
      initialDailyTarget={prefs?.daily_target ?? DEFAULT_DAILY_TARGET}
      initialDays={(days ?? []) as CallDay[]}
      initialWeeks={(weeks ?? []) as CallWeek[]}
      // v98 adds the three cold_call_* tables; until it is run the section says
      // so instead of failing every save.
      schemaReady={!daysError}
    />
  );
}
