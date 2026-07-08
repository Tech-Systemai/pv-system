import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import PlanningClient from './PlanningClient';

export default async function PlanningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('planning_documents')
    .select('*')
    .order('created_at', { ascending: false });

  const boards = (rows || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    desc: row.board_desc || '',
    areaId: row.area_id,
    shared: row.shared,
    startDate: row.start_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    status: row.status ?? 'in_progress',
    statusChangedAt: row.status_changed_at ?? undefined,
    created: row.created_at,
    widgets: row.content?.widgets ?? [],
    strokes: row.content?.strokes ?? [],
  }));

  return <PlanningClient initialBoards={boards} currentUserId={user.id} />;
}
