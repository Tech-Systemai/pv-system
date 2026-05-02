import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import PlanningClient from './PlanningClient';

export default async function PlanningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: documents } = await admin
    .from('planning_documents')
    .select('*')
    .order('created_at', { ascending: false });

  return <PlanningClient initialDocuments={documents ?? []} />;
}
