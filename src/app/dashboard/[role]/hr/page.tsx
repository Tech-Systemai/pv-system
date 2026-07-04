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

  const [{ data: applicants }, { data: interviewModules }, { data: interviewInvites }] = await Promise.all([
    admin.from('hr_applicants').select('*').order('score', { ascending: false }),
    admin.from('interview_modules').select('*').order('order_index', { ascending: true }),
    admin
      .from('interview_invites')
      .select('*, interview_sessions(id, status, turn_count, started_at, ended_at, recording_path, interview_scorecards(*))')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <HrClient
      initialApplicants={applicants || []}
      initialInterviewModules={interviewModules || []}
      initialInterviewInvites={interviewInvites || []}
      interviewSiteUrl={process.env.NEXT_PUBLIC_INTERVIEW_SITE_URL || 'http://localhost:3002'}
    />
  );
}
