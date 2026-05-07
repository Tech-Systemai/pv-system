import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

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

  const headers = { 'X-APPLOYE-API-KEY': apployeKey };

  // ── 1. Fetch Apploye members → build apployeUserId → email map ───────────
  const membersRes = await fetch('https://public-api.apploye.com/members/', {
    headers,
    cache: 'no-store',
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

  // ── 2. Fetch today's timesheets ──────────────────────────────────────────
  // duration field is in seconds; no clock_in/out times in the API
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

  // ── 3. Load all profiles ─────────────────────────────────────────────────
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, clocked_in');

  if (!profiles) {
    return NextResponse.json({ error: 'Could not fetch profiles' }, { status: 500 });
  }

  const nowIso = now.toISOString();
  let processed = 0;
  const activeProfileIds = new Set<string>();

  // ── 4. Process each timesheet entry ─────────────────────────────────────
  for (const ts of timesheets) {
    const email = emailById[ts.user_id];
    if (!email) continue;

    const profile = profiles.find(p => p.email?.toLowerCase() === email);
    if (!profile) continue;

    // Apploye returns duration in seconds; convert to minutes for our DB
    const durationSecs: number = ts.duration ?? 0;
    const newMins = Math.round(durationSecs / 60);

    // Read existing attendance log to compare duration
    const { data: existing } = await admin
      .from('attendance_logs')
      .select('id, clock_in_time, clock_out_time, productive_time_minutes')
      .eq('user_id', profile.id)
      .eq('date', today)
      .maybeSingle();

    const prevSecs = (existing?.productive_time_minutes ?? 0) * 60;

    // Active = duration grew by >30 s since last sync (30 s buffer for rounding)
    const isActive = durationSecs > prevSecs + 30;
    if (isActive) activeProfileIds.add(profile.id);

    // Upsert attendance log
    if (existing) {
      const patch: any = { productive_time_minutes: newMins, status: 'present' };
      if (!existing.clock_in_time && durationSecs > 0) patch.clock_in_time = nowIso;
      if (profile.clocked_in && !isActive && !existing.clock_out_time) {
        patch.clock_out_time = nowIso;
      }
      await admin.from('attendance_logs').update(patch).eq('id', existing.id);
    } else if (durationSecs > 0) {
      await admin.from('attendance_logs').insert([{
        user_id: profile.id,
        date: today,
        productive_time_minutes: newMins,
        status: 'present',
        ...(isActive ? { clock_in_time: nowIso } : {}),
      }]);
    }

    // Update profile clocked_in only when it actually changes
    if (isActive && !profile.clocked_in) {
      await admin.from('profiles').update({ clocked_in: true, current_activity: 'Active' }).eq('id', profile.id);
    } else if (!isActive && profile.clocked_in) {
      await admin.from('profiles').update({ clocked_in: false, current_activity: null }).eq('id', profile.id);
    }

    processed++;
  }

  // ── 5. Clock out anyone not in today's Apploye timesheets at all ─────────
  const apployeEmails = new Set(
    timesheets.map((ts: any) => emailById[ts.user_id]).filter(Boolean)
  );
  for (const profile of profiles) {
    if (!profile.clocked_in || !profile.email) continue;
    if (apployeEmails.has(profile.email.toLowerCase())) continue;
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
  });
}

// Vercel Cron — every 5 minutes
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

// Manual trigger from Attendance page
export async function POST() {
  try { return await runApployeSync(); }
  catch (err) {
    console.error('Apploye Pull Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
