import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import CXClient from './CXClient';

export default async function CXPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [
    { data: profile },
    { data: cases },
    { data: updates },
    { data: allProfiles },
    { data: stagesRow },
  ] = await Promise.all([
    admin.from('profiles').select('role, name').eq('id', user.id).single(),
    admin.from('cx_cases').select('*').order('created_at', { ascending: false }),
    admin.from('cx_updates').select('*').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, name, role').order('name'),
    admin.from('global_settings').select('value').eq('key', 'cx_pipeline_stages').single(),
  ]);

  const userRole = profile?.role ?? 'cx';

  return (
    <CXClient
      initialCases={cases ?? []}
      initialUpdates={updates ?? []}
      allProfiles={allProfiles ?? []}
      userRole={userRole}
      currentUserId={user.id}
      currentUserName={profile?.name ?? ''}
      savedPipelineStages={stagesRow?.value ?? null}
    />
  );
}
