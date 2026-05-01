import { createClient } from '@/utils/supabase/server';
import AuditClient from './AuditClient';
import { redirect } from 'next/navigation';

export default async function AuditPage() {
  const supabase = await createClient();
  
  // Security check - only Management can view
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'owner' && profile?.role !== 'admin') {
    redirect(`/dashboard/${profile?.role}`);
  }

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <>
      <AuditClient initialLogs={logs || []} />
    </>
  );
}
