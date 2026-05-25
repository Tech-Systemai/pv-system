import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import ConditionApprovalClient from './ConditionApprovalClient';

export default async function ConditionApprovalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, { data: candidates }] = await Promise.all([
    admin.from('profiles').select('id, name, role').eq('id', user.id).single(),
    admin.from('condition_approvals').select('*').order('created_at', { ascending: false }),
  ]);

  const isOwner = ['owner', 'dentist'].includes(profile?.role ?? '');

  return (
    <ConditionApprovalClient
      initialCandidates={candidates ?? []}
      isOwner={isOwner}
      currentUserId={user.id}
      currentUserName={profile?.name ?? ''}
    />
  );
}
