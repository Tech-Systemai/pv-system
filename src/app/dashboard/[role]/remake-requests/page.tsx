import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import RemakeRequestsClient from './RemakeRequestsClient';

export default async function RemakeRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [{ data: profile }, { data: requests }, { data: photos }] = await Promise.all([
    admin.from('profiles').select('id, name, role').eq('id', user.id).single(),
    admin.from('remake_requests').select('*').order('created_at', { ascending: false }),
    admin.from('remake_photos').select('*').order('created_at', { ascending: true }),
  ]);

  const isOwner = ['owner', 'dentist'].includes(profile?.role ?? '');

  return (
    <RemakeRequestsClient
      initialRequests={requests ?? []}
      initialPhotos={photos ?? []}
      isOwner={isOwner}
      currentUserId={user.id}
      currentUserName={profile?.name ?? ''}
    />
  );
}
