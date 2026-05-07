import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

async function runApployeSync() {
  const admin = createAdminClient();
  const apployeKey = process.env.APPLOYE_API_KEY;

  if (!apployeKey) {
    return NextResponse.json({ error: 'Missing APPLOYE_API_KEY environment variable' }, { status: 500 });
  }

  const today = new Date().toISOString().split('T')[0];
  const headers = {
    'X-APPLOYE-API-KEY': apployeKey,
    'Content-Type': 'application/json',
  };

  // ── 1. Fetch today's timesheets ──────────────────────────────────────────
  const tsRes = await fetch(`https://public-api.apploye.com/v1/timesheets?date=${today}`, {
    headers,
    cache: 'no-store',
  });

  if (!tsRes.ok) {
    const errText = await tsRes.text();
    console.error('Apploye timesheets error:', errText);
    return NextResponse.json({ error: `Apploye API ${tsRes.status}: ${errText}` }, { status: tsRes.status });
  }

  const tsJson = await tsRes.json();
  const timesheets: any[] = tsJson.data ?? tsJson.timesheets ?? tsJson.results ?? [];

  // ── 2. Try to get currently running timers ───────────────────────────────
  // Apploye may expose a running-timers endpoint; if not, fall back to
  // the is_running / end_time fields on each timesheet entry.
  const activeEmails = new Set<string>();
  let activeTimersFetched = false;

  for (const endpoint of [
    'https://public-api.apploye.com/v1/running-timers',
    'https://public-api.apploye.com/v1/active-timers',
    'https://public-api.apploye.com/v1/running-timer',
  ]) {
    try {
      const rtRes = await fetch(endpoint, { headers, cache: 'no-store' });
      if (rtRes.ok) {
        const rtJson = await rtRes.json();
        const timers: any[] = rtJson.data ?? rtJson.timers ?? rtJson.results ?? [];
        for (const rt of timers) {
          const email = rt.user_email ?? rt.email ?? rt.user?.email ?? rt.member?.email;
          if (email) activeEmails.add(email.toLowerCase());
        }
        activeTimersFetched = true;
        break;
      }
    } catch { /* try next endpoint */ }
  }

  // Fall back to is_running / end_time=null flags within the timesheet list
  if (!activeTimersFetched) {
    for (const ts of timesheets) {
      const email = (ts.user_email ?? ts.email ?? ts.user?.email ?? ts.member?.email ?? '')
        .toLowerCase();
      const hasRunningFlag = ts.is_running === true || ts.running === true || ts.status === 'running';
      const hasOpenSession = ts.start_time && !ts.end_time && !ts.clock_out_time && !ts.finished_at;
      if (email && (hasRunningFlag || hasOpenSession)) {
        activeEmails.add(email);
        activeTimersFetched = true;
      }
    }
  }

  // ── 3. Load all profiles ─────────────────────────────────────────────────
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, clocked_in');

  if (!profiles) {
    return NextResponse.json({ error: 'Could not fetch profiles' }, { status: 500 });
  }

  let processed = 0;
  let updated = 0;

  // ── 4. Process each Apploye timesheet ────────────────────────────────────
  for (const ts of timesheets) {
    const rawEmail = ts.user_email ?? ts.email ?? ts.user?.email ?? ts.member?.email;
    if (!rawEmail) continue;
    const email = rawEmail.toLowerCase();

    const profile = profiles.find(p => p.email?.toLowerCase() === email);
    if (!profile) continue;

    const productive_time_minutes: number =
      ts.total_tracked_minutes ?? ts.tracked_minutes ?? ts.duration_minutes ?? ts.total_minutes ?? 0;

    const clockInRaw: string | null =
      ts.start_time ?? ts.clock_in_time ?? ts.started_at ?? ts.first_activity_at ?? null;
    const clockOutRaw: string | null =
      ts.end_time ?? ts.clock_out_time ?? ts.finished_at ?? ts.last_activity_at ?? null;

    const isCurrentlyActive = activeEmails.has(email);

    // Upsert today's attendance_log
    const { data: existing } = await admin
      .from('attendance_logs')
      .select('id, clock_in_time, clock_out_time')
      .eq('user_id', profile.id)
      .eq('date', today)
      .maybeSingle();

    const status =
      isCurrentlyActive ? 'present'
      : productive_time_minutes > 0 ? 'present'
      : 'absent';

    if (existing) {
      const patch: any = { productive_time_minutes, status };
      // Only set clock_in_time if we have one and haven't recorded it yet
      if (clockInRaw && !existing.clock_in_time) patch.clock_in_time = clockInRaw;
      // Only set clock_out_time if session ended and we haven't recorded it
      if (clockOutRaw && !isCurrentlyActive && !existing.clock_out_time) patch.clock_out_time = clockOutRaw;
      await admin.from('attendance_logs').update(patch).eq('id', existing.id);
    } else if (clockInRaw || productive_time_minutes > 0) {
      const insert: any = { user_id: profile.id, date: today, productive_time_minutes, status };
      if (clockInRaw) insert.clock_in_time = clockInRaw;
      if (clockOutRaw && !isCurrentlyActive) insert.clock_out_time = clockOutRaw;
      await admin.from('attendance_logs').insert([insert]);
    }

    // Update clocked_in on profile if it changed
    if (activeTimersFetched && profile.clocked_in !== isCurrentlyActive) {
      await admin.from('profiles').update({
        clocked_in: isCurrentlyActive,
        current_activity: isCurrentlyActive ? 'Active' : null,
      }).eq('id', profile.id);
    }

    processed++;
    updated++;
  }

  // ── 5. Clock out anyone still marked "in" but not active in Apploye ──────
  if (activeTimersFetched) {
    const apployeEmails = new Set(
      timesheets
        .map((ts: any) => (ts.user_email ?? ts.email ?? ts.user?.email ?? ts.member?.email ?? '').toLowerCase())
        .filter(Boolean)
    );

    for (const profile of profiles) {
      if (!profile.clocked_in || !profile.email) continue;
      const emailLower = profile.email.toLowerCase();
      if (activeEmails.has(emailLower)) continue; // still active — leave them

      // Was clocked in on our site but not running in Apploye
      await admin.from('profiles').update({
        clocked_in: false,
        current_activity: null,
      }).eq('id', profile.id);

      // Record clock_out_time if we have a log open
      const { data: log } = await admin
        .from('attendance_logs')
        .select('id, clock_out_time')
        .eq('user_id', profile.id)
        .eq('date', today)
        .maybeSingle();

      if (log && !log.clock_out_time) {
        await admin.from('attendance_logs')
          .update({ clock_out_time: new Date().toISOString() })
          .eq('id', log.id);
      }
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    updated,
    activeNow: activeEmails.size,
    activeTimersFetched,
    date: today,
  });
}

// Vercel Cron (every 5 minutes) — requires CRON_SECRET header
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET ?? 'dev-secret'}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  try {
    return await runApployeSync();
  } catch (err) {
    console.error('Apploye Pull Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Manual trigger from the Attendance page (management only)
export async function POST() {
  try {
    return await runApployeSync();
  } catch (err) {
    console.error('Apploye Pull Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
