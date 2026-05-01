import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  // Simple auth check for the cron job
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const supabase = await createClient();
    const apployeKey = process.env.APPLOYE_API_KEY;

    if (!apployeKey) {
      return NextResponse.json({ error: 'Missing APPLOYE_API_KEY' }, { status: 500 });
    }

    // 1. Fetch Today's Timesheets from Apploye REST API
    const today = new Date().toISOString().split('T')[0];
    
    const response = await fetch(`https://public-api.apploye.com/v1/timesheets?date=${today}`, {
      method: 'GET',
      headers: {
        'X-APPLOYE-API-KEY': apployeKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Apploye API Error:', await response.text());
      return NextResponse.json({ error: 'Failed to fetch from Apploye' }, { status: response.status });
    }

    const { data: apployeTimesheets } = await response.json();

    // 2. Map Apploye Data to Supabase Profiles
    const { data: profiles } = await supabase.from('profiles').select('id, email');
    let updatedCount = 0;

    // Apploye typically returns an array of objects containing user emails and total_tracked_minutes
    for (const timesheet of (apployeTimesheets || [])) {
      const userProfile = profiles?.find(p => p.email === timesheet.user_email);
      
      if (userProfile) {
        // 3. Upsert into attendance_logs
        const productive_time_minutes = timesheet.total_tracked_minutes || 0;
        
        // Check if log exists
        const { data: existingLog } = await supabase
          .from('attendance_logs')
          .select('id')
          .eq('user_id', userProfile.id)
          .eq('date', today)
          .single();

        if (existingLog) {
          await supabase
            .from('attendance_logs')
            .update({ productive_time_minutes })
            .eq('id', existingLog.id);
        } else {
          await supabase
            .from('attendance_logs')
            .insert([{
              user_id: userProfile.id,
              date: today,
              status: productive_time_minutes > 0 ? 'present' : 'absent',
              productive_time_minutes
            }]);
        }
        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, processed: apployeTimesheets?.length || 0, updated: updatedCount });

  } catch (err) {
    console.error('Apploye Pull Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
