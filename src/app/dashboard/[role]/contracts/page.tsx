import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import ContractsClient from './ContractsClient';
import { redirect } from 'next/navigation';
import { getPermMatrix, resolveViewType, isAdminView, hasAccess } from '@/utils/getPermissions';

export default async function ContractsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, matrix] = await Promise.all([
    admin.from('profiles').select('role, name').eq('id', user.id).single(),
    getPermMatrix(),
  ]);

  const viewType = resolveViewType(matrix, 'contracts', profile?.role ?? '');
  if (!hasAccess(viewType)) redirect(`/dashboard/${profile?.role || 'sales'}`);
  const isMgmt = isAdminView(viewType);

  const cQuery = admin.from('contracts').select(`*, profiles!contracts_user_id_fkey(name, role, salary)`).order('created_at', { ascending: false });
  const { data: contracts } = isMgmt ? await cQuery : await cQuery.eq('user_id', user.id);

  const { data: users } = await admin.from('profiles').select('id, name, role, salary, department');

  return (
    <ContractsClient
      initialContracts={contracts || []}
      users={users || []}
      isMgmt={isMgmt}
      currentUserId={user.id}
      currentUserName={profile?.name ?? 'Management'}
    />
  );
}
