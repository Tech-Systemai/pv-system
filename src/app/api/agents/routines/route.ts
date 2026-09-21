import { NextRequest, NextResponse } from 'next/server';
import { JOBS, runJob, type Job } from '@/lib/aiAgents/server/jobs';
import { admin, requireManager } from '@/lib/aiAgents/server/runtime';

// Your schedules and your process notes: both edited from the office.

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ error: 'Only owners, admins and supervisors can change this' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const db = admin();
  const now = new Date().toISOString();

  try {
    switch (body.action) {
      case 'save_routine': {
        const r = body.routine ?? {};
        if (!JOBS.includes(r.action)) throw new Error('Pick what the routine should do');
        const row = {
          ...(r.id ? { id: r.id } : {}),
          name: String(r.name ?? '').trim().slice(0, 80) || 'Routine',
          action: r.action,
          params: r.params ?? {},
          days: ['daily', 'weekdays'].includes(r.days) ? r.days : 'weekdays',
          at_hour: Math.min(23, Math.max(0, Number(r.at_hour) || 8)),
          at_minute: Math.min(59, Math.max(0, Number(r.at_minute) || 0)),
          active: !!r.active,
          created_by: manager.userId,
          updated_at: now,
        };
        const { data, error } = await db.from('ai_routines').upsert(row).select().single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ routine: data });
      }
      case 'delete_routine': {
        await db.from('ai_routines').delete().eq('id', body.id);
        return NextResponse.json({ ok: true });
      }
      case 'run_routine': {
        const { data: r } = await db.from('ai_routines').select('*').eq('id', body.id).single();
        if (!r) throw new Error('Routine not found');
        const result = await runJob(r.action as Job, r.params ?? {});
        const { data } = await db.from('ai_routines').update({ last_run_at: now, last_result: result, updated_at: now }).eq('id', r.id).select().single();
        return NextResponse.json({ routine: data, result });
      }
      case 'save_skill': {
        const s = body.skill ?? {};
        const row = {
          ...(s.id ? { id: s.id } : {}),
          name: String(s.name ?? '').trim().slice(0, 80) || 'How to do this',
          scope: ['agent', 'department', 'all'].includes(s.scope) ? s.scope : 'agent',
          target: String(s.target ?? ''),
          body: String(s.body ?? '').trim(),
          active: s.active !== false,
          created_by: manager.userId,
          updated_at: now,
        };
        const { data, error } = await db.from('ai_skills').upsert(row).select().single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ skill: data });
      }
      case 'delete_skill': {
        await db.from('ai_skills').delete().eq('id', body.id);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
