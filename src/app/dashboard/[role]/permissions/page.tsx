import { createClient } from '@/utils/supabase/server';
import PermissionsClient from './PermissionsClient';
import { getPermMatrix } from '@/utils/getPermissions';

const CATS  = ['tasks', 'schedule', 'reports', 'tickets', 'hr', 'contracts', 'inbox', 'attendance', 'monitoring', 'policy', 'targets', 'coaching', 'planning', 'kb', 'chat', 'payroll', 'finance', 'wise'];
const ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'sales', 'cx'];

export default async function PermissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const matrix = await getPermMatrix();

  return <PermissionsClient initialMatrix={matrix} categories={CATS} roles={ROLES} />;
}
