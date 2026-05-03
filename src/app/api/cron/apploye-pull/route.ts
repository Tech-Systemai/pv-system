import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

async function runApployeSync() {
  const admin = createAdminClient();
  const apployeKey = process.env.APPLOYE_API_KEY;

  if (!apployeKey) {
    return NextResponse.json({ error: 'Missing APPLOYE_API_KEY environment variable' }, { status: 500 });
  }

  const today = new Date().toISOString().split('T')[0];

  const response = await fetch(`https://public-api.apploye.com/v1/timesheets?date=${today}`, {
    method: 'GET',
    headers: {
      'X-APPLOYE-API-KEY': apployeKey,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Apploye API Error:', errText);
    return NextResponse.json({ error: `Apploye API error ${response.status}: ${errText}` }, { status: response.status });
  }

  const json = await response.json();
  const timesheets: any[] = json.data ?? json.timesheets ?? json.results ?? [];

  const { data: profiles } = await admin.from('profiles').select('id, email');
  let updatedCount = 0;

  for (const ts of timesheets) {
    const email = ts.user_email ?? ts.email;
    const profile = profiles?.find(p => p.email === email);
    if (!profile) continue;

    const productive_time_minutes: number = ts.total_tracked_minutes ?? ts.tracked_minutes ?? 0;

    const { data: existing } = await admin
      .from('attendance_logs')
      .select('id')
      .eq('user_id', profile.id)
      .eq('date', today)
      .maybeSingle();

    if (existing) {
      await admin
        .from('attendance_logs')
        .update({ productive_time_minutes })
        .eq('id', existing.id);
    } else {
      await admin.from('attendance_logs').insert([{
        user_id: profile.id,
        date: today,
        status: productive_time_minutes > 0 ? 'present' : 'absent',
        productive_time_minutes,
      }]);
    }
    updatedCount++;
  }

  return NextResponse.json({ success: true, processed: timesheets.length, updated: updatedCount });
}

// Called by Vercel Cron (needs CRON_SECRET)
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

// Called manually from the Attendance page (management only, no extra auth needed)
export async function POST() {
  try {
    return await runApployeSync();
  } catch (err) {
    console.error('Apploye Pull Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
