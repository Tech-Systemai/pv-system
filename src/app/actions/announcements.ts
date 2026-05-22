'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Not authenticated');
  return user;
}

export async function saveAnnouncement(payload: {
  type: 'meeting' | 'announcement';
  title: string;
  message: string;
  meeting_link?: string;
  created_at: string;
  created_by_name: string;
  target_user_ids: string[] | null;
}) {
  await getAuthUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from('global_settings')
    .upsert({ key: 'active_announcement', value: payload });
  if (error) throw new Error(error.message);
}

export async function clearAnnouncement() {
  await getAuthUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from('global_settings')
    .delete()
    .eq('key', 'active_announcement');
  if (error) throw new Error(error.message);
}

export async function acknowledgeAnnouncement(
  announcementTs: string,
  action: 'acknowledged' | 'joined'
) {
  const user = await getAuthUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from('announcement_acknowledgments')
    .upsert(
      { user_id: user.id, announcement_ts: announcementTs, action },
      { onConflict: 'user_id,announcement_ts' }
    );
  if (error) throw new Error(error.message);
}

export async function getProfiles(): Promise<Array<{ id: string; name: string; role: string }>> {
  await getAuthUser();
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id, name, role')
    .order('name');
  return (data ?? []) as Array<{ id: string; name: string; role: string }>;
}

export async function getAcknowledgments(announcementTs: string) {
  await getAuthUser();
  const admin = createAdminClient();
  const { data } = await admin
    .from('announcement_acknowledgments')
    .select('user_id, action, responded_at, profiles(name)')
    .eq('announcement_ts', announcementTs)
    .order('responded_at');
  return (data ?? []) as unknown as Array<{
    user_id: string;
    action: 'acknowledged' | 'joined';
    responded_at: string;
    profiles: { name: string } | null;
  }>;
}
