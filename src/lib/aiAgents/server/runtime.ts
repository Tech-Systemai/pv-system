import { createAdminClient } from '@/utils/supabase/admin';
import type { Activity, EventKind } from '../types';

// How real agents show up in the HQ: every step updates the agent's desk
// (activity + current task), writes to the live feed, and tracks larger jobs as
// work items. The portal picks all of it up over realtime.

type Admin = ReturnType<typeof createAdminClient>;

export function admin(): Admin {
  return createAdminClient();
}

export async function agentId(db: Admin, slug: string): Promise<string | null> {
  const { data } = await db.from('ai_agents').select('id').eq('slug', slug).eq('status', 'active').maybeSingle();
  return data?.id ?? null;
}

export async function setDesk(db: Admin, slug: string, activity: Activity, task = '') {
  await db.from('ai_agents')
    .update({ activity, current_task: task, last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('slug', slug);
}

/** {agent} in the message becomes the agent's current name, so renames carry through. */
export async function logEvent(db: Admin, slug: string, kind: EventKind, message: string, workId: string | null = null) {
  const { data } = await db.from('ai_agents').select('id, name').eq('slug', slug).maybeSingle();
  await db.from('ai_agent_events').insert({
    agent_id: data?.id ?? null, work_id: workId, kind, message: message.replace(/{agent}/g, data?.name ?? 'Agent'),
  });
}

export async function startWork(db: Admin, slug: string, title: string, brief = ''): Promise<string | null> {
  const id = await agentId(db, slug);
  if (!id) return null;
  const { data } = await db.from('ai_agent_work')
    .insert({ agent_id: id, title, brief, status: 'in_progress' })
    .select('id').single();
  return data?.id ?? null;
}

export async function finishWork(db: Admin, workId: string | null, output: string, ok = true) {
  if (!workId) return;
  const now = new Date().toISOString();
  // Routine agent jobs close themselves; failures stay open for the founder to see.
  await db.from('ai_agent_work')
    .update(ok ? { status: 'done', output, completed_at: now, updated_at: now } : { status: 'in_progress', output, updated_at: now })
    .eq('id', workId);
}

/** Portal staff who may run agents (spends Apify / Claude credit). */
export async function requireManager(): Promise<{ userId: string } | null> {
  const { createClient } = await import('@/utils/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await admin().from('profiles').select('role').eq('id', user.id).single();
  return ['owner', 'admin', 'supervisor'].includes(data?.role ?? '') ? { userId: user.id } : null;
}
