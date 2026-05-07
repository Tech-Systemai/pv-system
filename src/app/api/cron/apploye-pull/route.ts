import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

function getMondayKey(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// How many seconds the duration must grow per sync interval to be "active".
// Sync runs every 5 minutes = 300 s. Require at least 60 s of new tracked time per interval.
const ACTIVE_THRESHOLD_SECS = 60;

// Force clock-out if last active timestamp is older than this (ms)
const STALE_MS = 12 * 60 * 1000; // 12 minutes

async function runApployeSync() {
  const admin = createAdminClient();
  const apployeKey = process.env.APPLOYE_API_KEY;

  if (!apployeKey) {
    return NextResponse.json({ error: 'Missing APPLOYE_API_KEY environment variable' }, { status: 500 });
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const startDate = `${today}T00:00:00Z`;
  const endDate   = `${today}T23:59:59Z`;
  const todayDay  = DAY_NAMES[now.getUTCDay()];
  const weekKey   = getMondayKey(now);
  const nowIso    = now.toISOString();

  const headers = { 'X-APPLOYE-API-KEY': apployeKey };

  // ── 1. Fetch members → email map ────────────────────────────────────────────
  const membersRes = await fetch('https://public-api.apploye.com/members/', {
    headers, cache: 'no-store',
  });
  if (!membersRes.ok) {
    const err = await membersRes.text();
    return NextResponse.json({ error: `Apploye members API ${membersRes.status}: ${err}` }, { status: membersRes.status });
  }
  const membersJson = await membersRes.json();
  const apployeMembers: any[] = membersJson.response ?? [];
  const emailById: Record<string, string> = {};
  for (const m of apployeMembers) {
    if (m.id && m.email) emailById[m.id] = m.email.toLowerCase();
  }

  // ── 2. Fetch today's timesheets ──────────────────────────────────────────────
  const tsRes = await fetch(
    `https://public-api.apploye.com/timesheets/?start_date=${startDate}&end_date=${endDate}`,
    { headers, cache: 'no-store' }
  );
  if (!tsRes.ok) {
    const err = await tsRes.text();
    return NextResponse.json({ error: `Apploye timesheets API ${tsRes.status}: ${err}` }, { status: tsRes.status });
  }
  const tsJson = await tsRes.json();
  const timesheets: any[] = tsJson.response ?? [];

  // ── 3. Load profiles + schedules ────────────────────────────────────────────
  const [{ data: profiles }, { data: schedules }] = await Promise.all([
    admin.from('profiles').select('id, email, clocked_in, current_activity'),
    admin.from('schedules').select('user_id, shift_start, shift_end').eq('week', weekKey).eq('day', todayDay),
  ]);

  if (!profiles) {
    return NextResponse.json({ error: 'Could not fetch profiles' }, { status: 500 });
  }

  let processed = 0;
  let clockedOut = 0;
  const activeProfileIds = new Set<string>();
  const apployeEmails = new Set(
    timesheets.map((ts: any) => emailById[ts.user_id]).filter(Boolean)
  );

  // ── 4. Process each timesheet entry ─────────────────────────────────────────
  for (const ts of timesheets) {
    const email = emailById[ts.user_id];
    if (!email) continue;

    const profile = profiles.find(p => p.email?.toLowerCase() === email);
    if (!profile) continue;

    const durationSecs: number = ts.duration ?? 0;
    const newMins = Math.round(durationSecs / 60);

    const { data: existing } = await admin
      .from('attendance_logs')
      .select('id, clock_in_time, clock_out_time, productive_time_minutes')
      .eq('user_id', profile.id)
      .eq('date', today)
      .maybeSingle();

    const prevSecs = (existing?.productive_time_minutes ?? 0) * 60;

    // Active = duration grew by at least ACTIVE_THRESHOLD_SECS since last sync
    const isActive = durationSecs > prevSecs + ACTIVE_THRESHOLD_SECS;
    if (isActive) activeProfileIds.add(profile.id);

    // Determine clock-in time: preserve existing or record now on first detection
    const clockInTime = existing?.clock_in_time ?? (durationSecs > 0 ? nowIso : null);

    // Late detection against scheduled shift start
    let status = 'present';
    if (clockInTime) {
      const schedule = schedules?.find((s: any) => s.user_id === profile.id);
      if (schedule?.shift_start) {
        const [shiftH, shiftM] = schedule.shift_start.split(':').map(Number);
        const scheduledStart = new Date(`${today}T${String(shiftH).padStart(2,'0')}:${String(shiftM).padStart(2,'0')}:00`);
        const lateMinutes = (new Date(clockInTime).getTime() - scheduledStart.getTime()) / 60000;
        if (lateMinutes > 5) status = 'late';
      }
    }

    // Upsert attendance log
    if (existing) {
      const patch: any = { productive_time_minutes: newMins, status };
      if (!existing.clock_in_time && durationSecs > 0) patch.clock_in_time = nowIso;
      // Set clock_out_time when they go inactive
      if (!isActive && profile.clocked_in && !existing.clock_out_time) patch.clock_out_time = nowIso;
      await admin.from('attendance_logs').update(patch).eq('id', existing.id);
    } else if (durationSecs > 0) {
      await admin.from('attendance_logs').insert([{
        user_id: profile.id, date: today,
        productive_time_minutes: newMins, status,
        clock_in_time: nowIso,
      }]);
    }

    // Update profile clocked_in + store last-active timestamp in current_activity
    if (isActive) {
      await admin.from('profiles').update({
        clocked_in: true,
        current_activity: nowIso, // ISO timestamp of last confirmed activity
      }).eq('id', profile.id);
    } else if (profile.clocked_in) {
      await admin.from('profiles').update({
        clocked_in: false,
        current_activity: profile.current_activity, // keep last-seen timestamp
      }).eq('id', profile.id);
      clockedOut++;
    }

    processed++;
  }

  // ── 5. Clock out anyone not in today's Apploye timesheets ───────────────────
  for (const profile of profiles) {
    if (!profile.clocked_in) continue;
    // Still in Apploye timesheets → handled in step 4
    if (profile.email && apployeEmails.has(profile.email.toLowerCase())) continue;
    await admin.from('profiles').update({
      clocked_in: false,
      current_activity: profile.current_activity,
    }).eq('id', profile.id);
    clockedOut++;
  }

  // ── 6. Stale safety net: force-clock-out anyone whose last activity is old ──
  // current_activity stores the ISO timestamp of last confirmed Apploye activity.
  // If it's more than STALE_MS old and the profile is still clocked_in, something
  // went wrong — force clock out now.
  const staleProfiles = profiles.filter(p => {
    if (!p.clocked_in) return false;
    if (!p.current_activity) return true; // no record = assume stale
    const lastActiveMs = new Date(p.current_activity).getTime();
    return isNaN(lastActiveMs) || (now.getTime() - lastActiveMs > STALE_MS);
  });
  for (const p of staleProfiles) {
    await admin.from('profiles').update({ clocked_in: false }).eq('id', p.id);
    clockedOut++;
  }

  return NextResponse.json({
    success: true,
    date: today,
    apployeMembers: apployeMembers.length,
    timesheets: timesheets.length,
    processed,
    activeNow: activeProfileIds.size,
    clockedOut,
    staleForced: staleProfiles.length,
    weekKey,
    todayDay,
  });
}

// Vercel Cron — daily (GitHub Actions handles the 5-min schedule)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET ?? 'dev-secret'}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  try { return await runApployeSync(); }
  catch (err) {
    console.error('Apploye Pull Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Manual trigger from Attendance page + GitHub Actions cron
export async function POST(request: Request) {
  // Allow CRON_SECRET bearer OR unauthenticated (GitHub Actions + UI button)
  try { return await runApployeSync(); }
  catch (err) {
    console.error('Apploye Pull Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
