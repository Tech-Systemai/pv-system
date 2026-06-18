import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import PersonalFilesClient from './PersonalFilesClient';
import { redirect } from 'next/navigation';

export default async function PersonalFilesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('id, name, role').eq('id', user.id).single();

  if (!['owner', 'admin'].includes(profile?.role ?? '')) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  const [{ data: employees }, { data: entries }] = await Promise.all([
    admin.from('profiles').select('id, name, role, department').order('name'),
    admin.from('personal_file_entries').select('*').order('date', { ascending: false }),
  ]);

  return (
    <PersonalFilesClient
      employees={employees ?? []}
      initialEntries={entries ?? []}
      currentUserId={user.id}
      currentUserName={profile?.name ?? ''}
    />
  );
}
