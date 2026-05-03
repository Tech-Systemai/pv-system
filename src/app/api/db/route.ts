import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const ALLOWED_TABLES = [
  'tickets', 'time_off_requests', 'tasks', 'coaching_sessions',
  'knowledge_base', 'messages', 'inbox_documents', 'schedules',
  'contracts', 'payrolls', 'sales_logs', 'attendance_logs',
  'profiles', 'hr_applicants', 'policies', 'audit_logs',
  'brand_settings', 'targets', 'finance_entries', 'permissions', 'planning_documents', 'notes',
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

    if (operation === 'insert') {
      const q = admin.from(table).insert(Array.isArray(data) ? data : [data]);
      result = selectClause ? await q.select(selectClause) : await q.select();
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
