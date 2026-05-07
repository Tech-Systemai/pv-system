import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET || 'dev-secret';

  // Accept either: Bearer token (cron) or an authenticated owner/admin session (UI)
  if (authHeader !== `Bearer ${secret}`) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (!['owner', 'admin'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
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

  // 2. Load all non-owner employees — skip Terminated and Inactive
  const { data: employees, error: eErr } = await admin
    .from('profiles')
    .select('id, name, email, points, salary, status')
    .not('role', 'eq', 'owner');
  if (eErr || !employees) {
    return NextResponse.json({ error: 'Failed to load employees' }, { status: 500 });
  }

  // Only evaluate employees who are currently employed and active
  const activeEmployees = employees.filter(
    (e: any) => !['Terminated', 'Inactive', 'On Leave'].includes(e.status ?? '')
  );

  // 3. Load today's attendance logs
  const { data: logs } = await admin
    .from('attendance_logs')
    .select('*')
    .eq('date', today);

  // 3b. Load violations already created today to avoid duplicates
  const { data: todayViolations } = await admin
    .from('violations')
    .select('user_id, policy_id')
    .gte('triggered_at', `${today}T00:00:00Z`)
    .lte('triggered_at', `${today}T23:59:59Z`);

  const alreadyFired = new Set<string>(
    (todayViolations ?? [])
      .filter((v: any) => v.policy_id)
      .map((v: any) => `${v.user_id}:${v.policy_id}`)
  );

  const violations: any[] = [];
  const pointUpdates: Record<string, number> = {};
  const inboxNotices: any[] = [];

  const todayDisplay = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  for (const emp of activeEmployees) {
    const log = logs?.find((l: any) => l.user_id === emp.id);
    const currentPoints = typeof emp.points === 'number' ? emp.points : 7;
    // Salary defaults to 2500 if not set; always a positive number
    const monthlySalary = typeof emp.salary === 'number' && emp.salary > 0 ? emp.salary : 2500;
    let pointDelta = 0;

    for (const policy of policies) {
      const trigger: string = policy.trigger ?? '';
      const action: string = policy.action ?? '';

      const fireKey = `${emp.id}:${policy.id}`;
      if (alreadyFired.has(fireKey)) continue; // already ran today for this employee+policy

      // ── LATE CLOCK-IN ────────────────────────────────────────────────────────
      if (trigger.toLowerCase().includes('late clock-in') && log?.status === 'late') {
        let lateMins = 0;
        if (log.clock_in_time) {
          const clockIn = new Date(log.clock_in_time);
          // Compare against scheduled shift start (default 09:00 if not in schedule)
          const shiftStart = new Date(log.clock_in_time);
          shiftStart.setHours(9, 0, 0, 0);
          lateMins = Math.max(0, Math.floor((clockIn.getTime() - shiftStart.getTime()) / 60000));
        } else {
          lateMins = 5; // default: at least one interval
        }
        const intervals = Math.max(1, Math.floor(lateMins / 5));

        // Points: configurable per interval (default 0.5 per 5 min)
        const ptsPerInterval = parseFloat(policy.action_detail?.replace(/[^0-9.]/g, '') || '0.5');
        const pts = parseFloat((ptsPerInterval * intervals).toFixed(2));
        pointDelta -= pts;

        // Salary: 5% of monthly salary per 5-minute interval
        const salaryPerInterval = parseFloat((monthlySalary * 0.05).toFixed(2));
        const salaryDeducted = parseFloat((salaryPerInterval * intervals).toFixed(2));

        const clockStr = log.clock_in_time
          ? new Date(log.clock_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : 'unknown time';

        violations.push({
          user_id: emp.id,
          policy_id: policy.id,
          rule_name: policy.name,
          explanation: `Clocked in at ${clockStr} on ${todayDisplay} — ${lateMins} minute${lateMins !== 1 ? 's' : ''} late (${intervals} × 5-min interval${intervals !== 1 ? 's' : ''}). Deduction: ${pts} reliability point${pts !== 1 ? 's' : ''} and $${salaryDeducted} (${intervals} × 5% of $${monthlySalary}).`,
          points_deducted: pts,
          salary_deducted: salaryDeducted,
        });
        alreadyFired.add(fireKey);

        inboxNotices.push({
          user_id: emp.id,
          title: `Violation — ${policy.name}`,
          content: `Date: ${todayDisplay}\nRule: ${policy.name}\n\nYou clocked in at ${clockStr}, ${lateMins} minute${lateMins !== 1 ? 's' : ''} late (${intervals} × 5-minute interval${intervals !== 1 ? 's' : ''}).\n\nPoints deducted: ${pts} pts (${intervals} × ${ptsPerInterval} pts per interval)\nSalary deducted: $${salaryDeducted} (${intervals} × 5% of your $${monthlySalary} monthly salary)\n\nPlease ensure punctual attendance to avoid further deductions.`,
          type: 'Violation Notice',
          sender: 'System (Policy Engine)',
          requires_signature: false,
          is_read: false,
        });
      }

      // ── NO-SHOW / FULL ABSENCE ────────────────────────────────────────────────
      if (trigger.toLowerCase().includes('absence') && (!log || log.status === 'absent')) {
        const pts = parseFloat(policy.action_detail?.replace(/[^0-9.]/g, '') || '2');
        pointDelta -= pts;

        // Salary: 10% of monthly salary for a full no-show
        const salaryDeducted = parseFloat((monthlySalary * 0.10).toFixed(2));

        violations.push({
          user_id: emp.id,
          policy_id: policy.id,
          rule_name: policy.name,
          explanation: `No attendance record found for ${todayDisplay}. Marked absent for the full shift. Deduction: ${pts} reliability point${pts !== 1 ? 's' : ''} and $${salaryDeducted} (10% of $${monthlySalary} monthly salary).`,
          points_deducted: pts,
          salary_deducted: salaryDeducted,
        });
        alreadyFired.add(fireKey);

        inboxNotices.push({
          user_id: emp.id,
          title: `Violation — ${policy.name}`,
          content: `Date: ${todayDisplay}\nRule: ${policy.name}\n\nNo attendance was recorded for you today. You have been marked as absent.\n\nPoints deducted: ${pts} pts\nSalary deducted: $${salaryDeducted} (10% of your $${monthlySalary} monthly salary)\n\nIf this is an error, please contact your supervisor immediately.`,
          type: 'Violation Notice',
          sender: 'System (Policy Engine)',
          requires_signature: false,
          is_read: false,
        });
      }

      // ── LOW PRODUCTIVITY ──────────────────────────────────────────────────────
      if (trigger.toLowerCase().includes('productivity') && log) {
        const productiveMins = log.productive_time_minutes ?? 0;
        if (productiveMins < 360 && log.status !== 'absent') {
          const hours = (productiveMins / 60).toFixed(1);

          if (action === 'Auto-notify supervisor') {
            inboxNotices.push({
              user_id: emp.id,
              title: `Productivity Alert — ${policy.name}`,
              content: `Date: ${todayDisplay}\n\nYour productive time today was ${hours} hours, below the 6-hour minimum. Your supervisor has been notified. No deductions applied for this alert, but repeated occurrences may trigger action.`,
              type: 'Productivity Alert',
              sender: 'System (Policy Engine)',
              requires_signature: false,
              is_read: false,
            });
          } else {
            const pts = parseFloat(policy.action_detail?.replace(/[^0-9.]/g, '') || '1');
            pointDelta -= pts;

            // Salary: 5% of monthly salary for low productivity
            const salaryDeducted = parseFloat((monthlySalary * 0.05).toFixed(2));

            violations.push({
              user_id: emp.id,
              policy_id: policy.id,
              rule_name: policy.name,
              explanation: `Only ${hours} hours of productive time tracked on ${todayDisplay} (minimum: 6h). Deduction: ${pts} reliability point${pts !== 1 ? 's' : ''} and $${salaryDeducted} (5% of $${monthlySalary} monthly salary).`,
              points_deducted: pts,
              salary_deducted: salaryDeducted,
            });
            alreadyFired.add(fireKey);

            inboxNotices.push({
              user_id: emp.id,
              title: `Violation — ${policy.name}`,
              content: `Date: ${todayDisplay}\nRule: ${policy.name}\n\nYou logged only ${hours} hours of tracked productive time today. Minimum required is 6 hours.\n\nPoints deducted: ${pts} pts\nSalary deducted: $${salaryDeducted} (5% of your $${monthlySalary} monthly salary)\n\nEnsure your activity tracker is running throughout your shift.`,
              type: 'Violation Notice',
              sender: 'System (Policy Engine)',
              requires_signature: false,
              is_read: false,
            });
          }
        }
      }

      // ── POINTS THRESHOLD — FLAG FOR TERMINATION REVIEW ───────────────────────
      if (
        (trigger.toLowerCase().includes('points threshold') || action === 'Flag for termination review') &&
        currentPoints + pointDelta <= 3
      ) {
        const threshold = 3;
        // Don't add a violation, send a supervisor-level notice only
        inboxNotices.push({
          user_id: emp.id,
          title: `⚠ Termination Review Flag — ${emp.name}`,
          content: `Date: ${todayDisplay}\n\nEmployee ${emp.name} has reached a reliability score of ${(currentPoints + pointDelta).toFixed(2)}/7, at or below the threshold of ${threshold}.\n\nThis employee has been flagged for termination review. Please schedule a review session immediately.`,
          type: 'Termination Flag',
          sender: 'System (Policy Engine)',
          requires_signature: false,
          is_read: false,
        });
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
    employees_evaluated: activeEmployees.length,
    employees_skipped: employees.length - activeEmployees.length,
    violations_created: violations.length,
    employees_affected: Object.keys(pointUpdates).length,
    inbox_notices_sent: inboxNotices.length,
  });
}
