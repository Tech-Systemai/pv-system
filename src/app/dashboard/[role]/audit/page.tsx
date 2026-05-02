import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import AuditClient from './AuditClient';
import { redirect } from 'next/navigation';

export default async function AuditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!['owner', 'admin'].includes(profile?.role ?? '')) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  const { data: logs } = await admin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  return <AuditClient initialLogs={logs || []} />;
}
