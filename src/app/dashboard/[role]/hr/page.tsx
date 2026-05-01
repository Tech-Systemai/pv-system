import { createClient } from '@/utils/supabase/server';
import HrClient from './HrClient';
import { redirect } from 'next/navigation';

export default async function HrPipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  
  if (profile?.role !== 'owner' && profile?.role !== 'admin') {
    redirect(`/dashboard/${profile?.role}`);
  }

  const { data: applicants } = await supabase
    .from('hr_applicants')
    .select('*')
    .eq('status', 'Reviewing')
    .order('score', { ascending: false });

  return (
    <>
      <HrClient initialApplicants={applicants || []} />
    </>
  );
}
