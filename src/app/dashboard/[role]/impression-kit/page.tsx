import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import ImpressionKitClient from './ImpressionKitClient';

export default async function ImpressionKitPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [
    { data: profile },
    { data: kits },
    { data: photos },
    { data: allProfiles },
  ] = await Promise.all([
    admin.from('profiles').select('role, name').eq('id', user.id).single(),
    admin.from('impression_kits').select('*').order('created_at', { ascending: false }),
    admin.from('impression_kit_photos').select('*').order('created_at', { ascending: true }),
    admin.from('profiles').select('id, name, role').order('name'),
  ]);

  return (
    <ImpressionKitClient
      initialKits={kits ?? []}
      initialPhotos={photos ?? []}
      allProfiles={allProfiles ?? []}
      userRole={profile?.role ?? 'cx'}
      currentUserId={user.id}
      currentUserName={profile?.name ?? ''}
    />
  );
}
