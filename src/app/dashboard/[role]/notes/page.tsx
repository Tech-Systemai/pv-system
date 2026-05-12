import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import NotesClient from './NotesClient';

export default async function NotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [{ data: myNotes }, { data: sharedRaw }, { data: allProfiles }] = await Promise.all([
    admin.from('notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    admin.from('notes').select('*').contains('shared_with', [user.id]).order('updated_at', { ascending: false }),
    admin.from('profiles').select('id, name, role'),
  ]);

  const profileMap = Object.fromEntries((allProfiles ?? []).map(p => [p.id, p]));

  const sharedNotes = (sharedRaw ?? []).map(n => ({
    ...n,
    owner_name: profileMap[n.user_id]?.name ?? 'Unknown',
  }));

  return (
    <NotesClient
      initialNotes={myNotes || []}
      sharedNotes={sharedNotes}
      users={(allProfiles ?? []).filter(p => p.id !== user.id)}
      currentUserId={user.id}
    />
  );
}
