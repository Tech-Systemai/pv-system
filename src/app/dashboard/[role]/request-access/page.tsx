import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getPermMatrix, resolveViewType, PERM_DEFAULTS } from '@/utils/getPermissions';
import RequestAccessClient from './RequestAccessClient';

export default async function RequestAccessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, matrix] = await Promise.all([
    admin.from('profiles').select('role, name').eq('id', user.id).single(),
    getPermMatrix(),
  ]);

  const role = profile?.role ?? 'sales';

  const allowedModules: Record<string, string> = {};
  for (const mod of Object.keys(PERM_DEFAULTS)) {
    allowedModules[mod] = resolveViewType(matrix, mod, role);
  }

  const { data: pending } = await admin
    .from('access_requests')
    .select('module, status')
    .eq('user_id', user.id)
    .eq('status', 'pending');

  return (
    <RequestAccessClient
      userId={user.id}
      userName={profile?.name ?? 'User'}
      userRole={role}
      allowedModules={allowedModules}
      pendingModules={(pending ?? []).map((r: any) => r.module)}
    />
  );
}
