import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import RecordingUploadsClient from './RecordingUploadsClient';
import { redirect } from 'next/navigation';

export default async function RecordingUploadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('id, name, role').eq('id', user.id).single();

  if (!['owner', 'admin'].includes(profile?.role ?? '')) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  const [{ data: cases }, { data: allProfiles }] = await Promise.all([
    admin.from('cx_cases').select('id, customer_name, order_number, recording_uploads').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, name'),
  ]);

  return (
    <RecordingUploadsClient
      cases={cases ?? []}
      allProfiles={allProfiles ?? []}
    />
  );
}
