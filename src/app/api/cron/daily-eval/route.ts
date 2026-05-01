import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  // Simple auth check for the cron job to ensure it's not publicly triggerable
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = await createClient();

  // 1. Fetch all active employees
  const { data: users, error: uErr } = await supabase.from('profiles').select('id, points, score').neq('role', 'owner');
  
  if (uErr || !users) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  // 2. Fetch today's attendance logs
  const today = new Date().toISOString().split('T')[0];
  const { data: logs } = await supabase.from('attendance_logs').select('*').eq('date', today);

  const results = [];

  // 3. Evaluate each user against the hardcoded policies for now
  for (const user of users) {
    const userLog = logs?.find(l => l.user_id === user.id);
    let newPoints = user.points || 7;
    let newScore = user.score || 100;
    let notes = [];

    if (!userLog || userLog.status === 'absent') {
      // Policy: No-Show Penalty (-3 points)
      newPoints = Math.max(0, newPoints - 3);
      notes.push('No-show penalty applied (-3 pts)');
    } else {
      if (userLog.status === 'late') {
        // Policy: Late Penalty (-0.5 points)
        newPoints = Math.max(0, newPoints - 0.5);
        notes.push('Late clock-in penalty applied (-0.5 pts)');
      }
      
      // Policy: Low Productive Time Penalty (< 6 hours / 360 mins)
      const productiveMins = userLog.productive_time_minutes || 0;
      if (productiveMins < 360) {
        newPoints = Math.max(0, newPoints - 1);
        notes.push(`Low productivity penalty: Only ${productiveMins}m tracked (-1 pt)`);
      }
    }

    // If there's a change, update the profile
    if (newPoints !== user.points) {
      await supabase.from('profiles').update({ points: newPoints }).eq('id', user.id);
      
      // Add to audit_logs
      await supabase.from('audit_logs').insert([{
        action: 'POLICY_EVALUATION',
        entity_type: 'profile',
        entity_id: user.id,
        details: { notes, previous_points: user.points, new_points: newPoints }
      }]);
      
      results.push({ userId: user.id, status: 'deducted', notes });
    } else {
      results.push({ userId: user.id, status: 'ok' });
    }
  }

  return NextResponse.json({ success: true, evaluated: users.length, updates: results.filter(r => r.status === 'deducted').length });
}
