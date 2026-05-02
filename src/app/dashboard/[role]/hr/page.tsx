import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import HrClient from './HrClient';
import { redirect } from 'next/navigation';

export default async function HrPipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();

  if (!['owner', 'admin', 'supervisor'].includes(profile?.role ?? '')) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  const { data: applicants } = await admin
    .from('hr_applicants')
    .select('*')
    .order('score', { ascending: false });

  return <HrClient initialApplicants={applicants || []} />;
}
