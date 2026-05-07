import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

// POST /api/cron/policies
// Reads all active policies, evaluates today's attendance, creates violation records,
// deducts points, and sends inbox notices to affected employees.
// Called nightly by Vercel Cron or manually via the "Run Policies Now" button.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET || 'dev-secret';
  if (authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split('T')[0];

  // 1. Load active policies
  const { data: policies, error: pErr } = await admin
    .from('policies')
    .select('*')
    .eq('active', true);
  if (pErr || !policies) {
    return NextResponse.json({ error: 'Failed to load policies' }, { status: 500 });
  }

  // 2. Load all non-owner employees with their current points
  const { data: employees, error: eErr } = await admin
    .from('profiles')
    .select('id, name, email, points, salary')
    .not('role', 'eq', 'owner');
  if (eErr || !employees) {
    return NextResponse.json({ error: 'Failed to load employees' }, { status: 500 });
  }

  // 3. Load today's attendance logs
  const { data: logs } = await admin
    .from('attendance_logs')
    .select('*')
    .eq('date', today);

  const violations: any[] = [];
  const pointUpdates: Record<string, number> = {};
  const inboxNotices: any[] = [];

  const todayDisplay = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  for (const emp of employees) {
    const log = logs?.find((l: any) => l.user_id === emp.id);
    const currentPoints = typeof emp.points === 'number' ? emp.points : 7;
    let pointDelta = 0;

    for (const policy of policies) {
      const trigger: string = policy.trigger ?? '';
      const action: string = policy.action ?? '';

      // ── LATE CLOCK-IN ────────────────────────────────────────
      if (trigger.toLowerCase().includes('late clock-in') && log?.status === 'late') {
        let lateMins = 0;
        if (log.clock_in_time) {
          // Compare against 09:00 as the default shift start (TODO: pull from schedules)
          const clockIn = new Date(log.clock_in_time);
          const shiftStart = new Date(log.clock_in_time);
          shiftStart.setHours(9, 0, 0, 0);
          lateMins = Math.max(0, Math.floor((clockIn.getTime() - shiftStart.getTime()) / 60000));
        } else {
          lateMins = 5; // default: at least one interval
        }
        const intervals = Math.max(1, Math.floor(lateMins / 5));
        let pts = 0;

        if (action === 'Deduct points') {
          const perInterval = parseFloat(policy.action_detail?.replace(/[^0-9.]/g, '') || '0.5');
          pts = parseFloat((perInterval * intervals).toFixed(2));
          pointDelta -= pts;
        }

        const clockStr = log.clock_in_time
          ? new Date(log.clock_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : 'unknown time';

        violations.push({
          user_id: emp.id,
          policy_id: policy.id,
          rule_name: policy.name,
          explanation: `You clocked in at ${clockStr} on ${todayDisplay} — approximately ${lateMins} minute${lateMins !== 1 ? 's' : ''} late. ${policy.name} deducts ${pts > 0 ? pts + ' reliability point' + (pts !== 1 ? 's' : '') : 'points'} per 5 minutes late.`,
          points_deducted: pts,
          salary_deducted: 0,
        });

        inboxNotices.push({
          user_id: emp.id,
          title: `Violation — ${policy.name}`,
          subject: policy.name,
          content: `Date: ${todayDisplay}\nRule: ${policy.name}\n\nYou clocked in at ${clockStr}, approximately ${lateMins} minute${lateMins !== 1 ? 's' : ''} late.\n\nDeduction: ${pts} reliability point${pts !== 1 ? 's' : ''} (${intervals} × ${pts / intervals} pts per 5-min interval).\n\nYour updated reliability score affects your monthly salary deduction: (7 − points) × $20.\n\nPlease ensure punctual attendance to avoid further deductions.`,
          type: 'Violation Notice',
          sender: 'System (Policy Engine)',
          requires_signature: false,
          is_read: false,
        });
      }

      // ── NO-SHOW / FULL ABSENCE ───────────────────────────────
      if (
        trigger.toLowerCase().includes('absence') &&
        (!log || log.status === 'absent')
      ) {
        let pts = 0;
        if (action === 'Deduct points') {
          pts = parseFloat(policy.action_detail?.replace(/[^0-9.]/g, '') || '2');
          pointDelta -= pts;
        }

        violations.push({
          user_id: emp.id,
          policy_id: policy.id,
          rule_name: policy.name,
          explanation: `No attendance record found for ${todayDisplay}. You were marked absent for the full shift. ${policy.name} deducts ${pts > 0 ? pts + ' reliability point' + (pts !== 1 ? 's' : '') : 'points'} for each full-day no-show.`,
          points_deducted: pts,
          salary_deducted: 0,
        });

        inboxNotices.push({
          user_id: emp.id,
          title: `Violation — ${policy.name}`,
          subject: policy.name,
          content: `Date: ${todayDisplay}\nRule: ${policy.name}\n\nNo attendance was recorded for you today. You have been marked as absent.\n\nDeduction: ${pts} reliability point${pts !== 1 ? 's' : ''}.\n\nIf this is an error, please contact your supervisor immediately.`,
          type: 'Violation Notice',
          sender: 'System (Policy Engine)',
          requires_signature: false,
          is_read: false,
        });
      }

      // ── LOW PRODUCTIVITY ────────────────────────────────────
      if (trigger.toLowerCase().includes('productivity') && log) {
        const productiveMins = log.productive_time_minutes ?? 0;
        if (productiveMins < 360 && log.status !== 'absent') {
          const hours = (productiveMins / 60).toFixed(1);

          if (action === 'Deduct points') {
            const pts = parseFloat(policy.action_detail?.replace(/[^0-9.]/g, '') || '1');
            pointDelta -= pts;
            violations.push({
              user_id: emp.id,
              policy_id: policy.id,
              rule_name: policy.name,
              explanation: `Only ${hours} hours of productive time tracked on ${todayDisplay} (minimum required: 6h). ${policy.name} deducts ${pts} reliability point${pts !== 1 ? 's' : ''}.`,
              points_deducted: pts,
              salary_deducted: 0,
            });
            inboxNotices.push({
              user_id: emp.id,
              title: `Violation — ${policy.name}`,
              subject: policy.name,
              content: `Date: ${todayDisplay}\nRule: ${policy.name}\n\nYou logged only ${hours} hours of tracked productive time today. The minimum required is 6 hours.\n\nDeduction: ${pts} reliability point${pts !== 1 ? 's' : ''}.\n\nEnsure your activity tracker is running throughout your shift.`,
              type: 'Violation Notice',
              sender: 'System (Policy Engine)',
              requires_signature: false,
              is_read: false,
            });
          } else if (action === 'Auto-notify supervisor') {
            // Notify via inbox — no point deduction
            inboxNotices.push({
              user_id: emp.id,
              title: `Productivity Alert — ${policy.name}`,
              subject: policy.name,
              content: `Date: ${todayDisplay}\n\nYour productive time today was ${hours} hours, below the 6-hour minimum. Your supervisor has been notified. No points have been deducted for this alert, but repeated occurrences may trigger further action.`,
              type: 'Productivity Alert',
              sender: 'System (Policy Engine)',
              requires_signature: false,
              is_read: false,
            });
          }
        }
      }
    }

    if (pointDelta < 0) {
      pointUpdates[emp.id] = Math.max(0, parseFloat((currentPoints + pointDelta).toFixed(2)));
    }
  }

  // 4. Write violations
  if (violations.length > 0) {
    await admin.from('violations').insert(violations);
  }

  // 5. Update points on profiles
  for (const [userId, newPoints] of Object.entries(pointUpdates)) {
    await admin.from('profiles').update({ points: newPoints }).eq('id', userId);
  }

  // 6. Send inbox notifications
  if (inboxNotices.length > 0) {
    await admin.from('inbox_documents').insert(inboxNotices);
  }

  // 7. Increment executed count on each policy that fired
  const firedPolicyIds = [...new Set(violations.map((v: any) => v.policy_id).filter(Boolean))];
  for (const pid of firedPolicyIds) {
    const policy = policies.find((p: any) => p.id === pid);
    if (policy) {
      await admin.from('policies').update({ executed: (policy.executed ?? 0) + 1 }).eq('id', pid);
    }
  }

  return NextResponse.json({
    success: true,
    date: today,
    violations_created: violations.length,
    employees_affected: Object.keys(pointUpdates).length,
    inbox_notices_sent: inboxNotices.length,
  });
}
