import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const isMgmt = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');
  const canAdd = ['owner', 'admin'].includes(profile?.role ?? '');

  const { data: employees } = await admin.from('profiles').select('*').order('name');

  return <UsersClient initialUsers={employees || []} isMgmt={isMgmt} canAdd={canAdd} />;
}
