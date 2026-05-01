import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.APPLOYE_SECRET || 'dev-apploye-secret'}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const payload = await request.json();
    // Expected Payload: { userId: 'uuid', date: 'YYYY-MM-DD', productive_time_minutes: number }
    const { userId, date, productive_time_minutes } = payload;

    if (!userId || !date || typeof productive_time_minutes !== 'number') {
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Find the attendance log for this user & date
    const { data: log } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (log) {
      // 2. Update it with new productive minutes
      await supabase
        .from('attendance_logs')
        .update({ productive_time_minutes })
        .eq('id', log.id);
        
      return NextResponse.json({ success: true, message: 'Updated existing log' });
    } else {
      // Create new log (in case they didn't clock in via the system but Apploye caught it)
      await supabase
        .from('attendance_logs')
        .insert([{ 
          user_id: userId, 
          date, 
          status: 'present', 
          productive_time_minutes 
        }]);
        
      return NextResponse.json({ success: true, message: 'Created new log' });
    }

  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
