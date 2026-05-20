import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const ALLOWED_TABLES = [
  'tickets', 'time_off_requests', 'tasks', 'coaching_sessions',
  'knowledge_base', 'messages', 'inbox_documents', 'schedules',
  'contracts', 'payrolls', 'sales_logs', 'attendance_logs',
  'profiles', 'hr_applicants', 'policies', 'company_policies', 'audit_logs',
  'brand_settings', 'targets', 'finance_entries', 'permissions', 'planning_documents', 'notes', 'channel_memberships', 'channels', 'violations', 'access_requests', 'reports', 'inbox_folders', 'ticket_replies', 'notifications', 'global_settings', 'daily_updates', 'kb_progress', 'cx_cases', 'cx_updates',
  'fim_fault_codes', 'fim_sops',
];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { table, operation, data, filters, select: selectClause } = body;

  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Table not allowed' }, { status: 403 });
  }

  const admin = createAdminClient();

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
