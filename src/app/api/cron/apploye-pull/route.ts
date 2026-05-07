import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

function getMondayKey(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  const todayDay  = DAY_NAMES[now.getUTCDay()]; // e.g. 'Mon'
  const weekKey   = getMondayKey(now);

  const headers = { 'X-APPLOYE-API-KEY': apployeKey };

  // ── 1. Fetch members → build UUID → email map ────────────────
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

  // ── 2. Fetch today's timesheets ──────────────────────────────
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

  // ── 3. Load profiles + today's schedules ────────────────────
  const [{ data: profiles }, { data: schedules }] = await Promise.all([
    admin.from('profiles').select('id, email, clocked_in'),
    admin.from('schedules').select('user_id, shift_start, shift_end').eq('week', weekKey).eq('day', todayDay),
  ]);

  if (!profiles) {
    return NextResponse.json({ error: 'Could not fetch profiles' }, { status: 500 });
  }

  const nowIso = now.toISOString();
  let processed = 0;
  const activeProfileIds = new Set<string>();

  // ── 4. Process each timesheet entry ─────────────────────────
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
    const isActive = durationSecs > prevSecs + 30;
    if (isActive) activeProfileIds.add(profile.id);

    // Determine clock-in time: use existing or set to now on first detection
    const clockInTime = existing?.clock_in_time ?? (durationSecs > 0 ? nowIso : null);

    // ── Late detection: compare clock-in against today's schedule ──
    let status = 'present';
    if (clockInTime) {
      const schedule = schedules?.find((s: any) => s.user_id === profile.id);
      if (schedule?.shift_start) {
        const [shiftH, shiftM] = schedule.shift_start.split(':').map(Number);
        const scheduledStart = new Date(`${today}T${String(shiftH).padStart(2,'0')}:${String(shiftM).padStart(2,'0')}:00`);
        const clockInDate = new Date(clockInTime);
        const lateMinutes = (clockInDate.getTime() - scheduledStart.getTime()) / 60000;
        if (lateMinutes > 5) status = 'late';
      }
    }

    // Upsert attendance log
    if (existing) {
      const patch: any = { productive_time_minutes: newMins, status };
      if (!existing.clock_in_time && durationSecs > 0) patch.clock_in_time = nowIso;
      if (profile.clocked_in && !isActive && !existing.clock_out_time) patch.clock_out_time = nowIso;
      await admin.from('attendance_logs').update(patch).eq('id', existing.id);
    } else if (durationSecs > 0) {
      await admin.from('attendance_logs').insert([{
        user_id: profile.id,
        date: today,
        productive_time_minutes: newMins,
        status,
        clock_in_time: nowIso,
      }]);
    }

    // Update profile clocked_in
    if (isActive && !profile.clocked_in) {
      await admin.from('profiles').update({ clocked_in: true, current_activity: 'Active' }).eq('id', profile.id);
    } else if (!isActive && profile.clocked_in) {
      await admin.from('profiles').update({ clocked_in: false, current_activity: null }).eq('id', profile.id);
    }

    processed++;
  }

  // ── 5. Clock out anyone not in today's Apploye timesheets ────
  const apployeEmails = new Set(
    timesheets.map((ts: any) => emailById[ts.user_id]).filter(Boolean)
  );
  for (const profile of profiles) {
    if (!profile.clocked_in) continue;
    // If no email or email not in Apploye → clock out
    if (profile.email && apployeEmails.has(profile.email.toLowerCase())) continue;
    await admin.from('profiles')
      .update({ clocked_in: false, current_activity: null })
      .eq('id', profile.id);
  }

  return NextResponse.json({
    success: true,
    apployeMembers: apployeMembers.length,
    timesheets: timesheets.length,
    processed,
    activeNow: activeProfileIds.size,
    date: today,
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
export async function POST() {
  try { return await runApployeSync(); }
  catch (err) {
    console.error('Apploye Pull Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
