import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const ALLOWED_TABLES = [
  'tickets', 'time_off_requests', 'tasks', 'coaching_sessions',
  'knowledge_base', 'messages', 'inbox_documents', 'schedules',
  'contracts', 'payrolls', 'sales_logs', 'attendance_logs',
  'profiles', 'hr_applicants', 'policies', 'company_policies', 'audit_logs',
  'brand_settings', 'targets', 'finance_entries', 'permissions', 'planning_documents', 'notes', 'channel_memberships', 'channels', 'violations', 'access_requests', 'reports', 'inbox_folders', 'ticket_replies', 'notifications', 'global_settings', 'daily_updates', 'kb_progress',
  'fim_fault_codes', 'fim_sops', 'daily_task_responses',
  'personal_file_entries',
  'interview_modules', 'interview_invites', 'interview_sessions', 'interview_messages', 'interview_scorecards',
  'ai_agents', 'ai_agent_runs', 'ai_departments', 'ai_agent_work', 'ai_agent_events',
  'smart_time_prefs', 'smart_time_tasks', 'smart_time_dumps', 'smart_time_plans',
  'smart_time_reviews', 'smart_time_period_log',
];

// Smart Time rows belong to exactly one person — their brain dumps, their day
// plan, their period log. Writes are stamped with the caller's id and every
// read, update and delete is filtered to it, so no request can reach another
// user's rows even though /api/db runs as the service role.
const PERSONAL_TABLES = new Set([
  'smart_time_prefs', 'smart_time_tasks', 'smart_time_dumps', 'smart_time_plans',
  'smart_time_reviews', 'smart_time_period_log',
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { table, operation, data, filters: rawFilters, select: selectClause } = body;

  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Table not allowed' }, { status: 403 });
  }

  const isPersonal = PERSONAL_TABLES.has(table);
  if (isPersonal) {
    for (const row of Array.isArray(data) ? data : data ? [data] : []) {
      if (row && typeof row === 'object') row.user_id = user.id;
    }
  }
  const filters = isPersonal ? { ...(rawFilters ?? {}), user_id: user.id } : rawFilters;

  const admin = createAdminClient();

  // ── Peer-communication guard ────────────────────────────────────────────────
  // CX/Sales agents may only message or share notes with management — never with
  // another CX/Sales agent. This backs up the UI recipient filtering so a crafted
  // request can't bypass it.
  const AGENT_ROLES = new Set(['cx', 'sales']);
  const guardsTable =
    (operation === 'insert' && table === 'inbox_documents') ||
    (['insert', 'update', 'upsert'].includes(operation) && table === 'notes');
  if (guardsTable) {
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const rawIds: unknown[] = table === 'inbox_documents'
      ? rows.map((r: any) => r?.user_id)
      : rows.flatMap((r: any) => (Array.isArray(r?.shared_with) ? r.shared_with : []));
    const targetIds = [...new Set(
      rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0 && id !== user.id)
    )];
    if (targetIds.length > 0) {
      const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single();
      if (AGENT_ROLES.has((me?.role ?? '').toLowerCase())) {
        const { data: targets } = await admin.from('profiles').select('role').in('id', targetIds);
        const hitsAgent = (targets ?? []).some((p: any) => AGENT_ROLES.has((p?.role ?? '').toLowerCase()));
        if (hitsAgent) {
          return NextResponse.json(
            { error: 'CX and Sales agents can only send messages and share notes with management, not with each other.' },
            { status: 403 },
          );
        }
      }
    }
  }

  try {
    let result: any;

    // Safety net: inbox_documents must always have subject
    const insertData = operation === 'insert' && table === 'inbox_documents'
      ? (Array.isArray(data) ? data : [data]).map((row: any) => ({
          ...row,
          subject: row.subject || row.title || '',
          title:   row.title   || row.subject || '',
        }))
      : (Array.isArray(data) ? data : [data]);

    if (operation === 'insert') {
      const q = admin.from(table).insert(insertData);
      result = selectClause ? await q.select(selectClause) : await q.select();

      // If inbox_documents insert fails due to missing columns (migration not yet applied),
      // retry with only the original v3 columns so the message is always delivered.
      if (result.error && table === 'inbox_documents') {
        const msg = (result.error.message ?? '').toLowerCase();
        if (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('column') || msg.includes('pgrst')) {
          const safe = insertData.map((row: any) => ({
            user_id:            row.user_id,
            sender:             row.sender  || 'System',
            subject:            row.subject || row.title || '',
            type:               row.type    || 'Notice',
            requires_signature: row.requires_signature ?? false,
            is_read:            row.is_read ?? false,
          }));
          const q2 = admin.from(table).insert(safe);
          result = selectClause ? await q2.select(selectClause) : await q2.select();
        }
      }
    } else if (operation === 'update') {
      let q = admin.from(table).update(data);
      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          q = (q as any).eq(col, val);
        }
      }
      result = selectClause ? await q.select(selectClause) : await q.select();
    } else if (operation === 'upsert') {
      const q = admin.from(table).upsert(Array.isArray(data) ? data : [data]);
      result = selectClause ? await q.select(selectClause) : await q.select();
    } else if (operation === 'select') {
      let q = admin.from(table).select(selectClause ?? '*');
      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          q = (q as any).eq(col, val);
        }
      }
      result = await q.order('created_at', { ascending: true });
    } else if (operation === 'delete') {
      let q = admin.from(table).delete();
      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          q = (q as any).eq(col, val);
        }
      }
      result = await q;
    } else {
      return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: result.data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
