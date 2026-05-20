import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import FIMClient from './FIMClient';

export default async function FIMPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [
    { data: profile },
    { data: faultCodes },
    { data: sops },
  ] = await Promise.all([
    admin.from('profiles').select('role, name').eq('id', user.id).single(),
    admin.from('fim_fault_codes').select('*').order('code', { ascending: true }),
    admin.from('fim_sops').select('*').order('name', { ascending: true }),
  ]);

  return (
    <FIMClient
      initialCodes={faultCodes ?? []}
      initialSops={sops ?? []}
      userRole={profile?.role ?? 'cx'}
      currentUserId={user.id}
      currentUserName={profile?.name ?? ''}
    />
  );
}
