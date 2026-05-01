import { createClient } from '@/utils/supabase/server';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isMgmt = profile?.role === 'owner' || profile?.role === 'admin';

  const { data: employees } = await supabase.from('profiles').select('*').order('name');

  return (
    <>
      <UsersClient initialUsers={employees || []} isMgmt={isMgmt} />
    </>
  );
}
