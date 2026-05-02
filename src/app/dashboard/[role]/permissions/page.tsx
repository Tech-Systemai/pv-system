import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import PermissionsClient from './PermissionsClient';

const CATS = ['tasks', 'schedule', 'reports', 'tickets', 'hr', 'contracts', 'inbox', 'attendance', 'monitoring', 'policy', 'targets', 'coaching', 'planning', 'kb', 'chat', 'payroll', 'finance', 'wise'];
const ROLES = ['owner', 'admin', 'supervisor', 'accountant', 'sales', 'cx'];

const DEFAULTS: Record<string, Record<string, boolean>> = {
  tasks: { owner: true, admin: true, supervisor: true, accountant: false, sales: true, cx: true },
  schedule: { owner: true, admin: true, supervisor: true, accountant: false, sales: false, cx: false },
  reports: { owner: true, admin: true, supervisor: true, accountant: false, sales: false, cx: false },
  tickets: { owner: true, admin: true, supervisor: true, accountant: false, sales: true, cx: true },
  hr: { owner: true, admin: true, supervisor: false, accountant: false, sales: false, cx: false },
  contracts: { owner: true, admin: true, supervisor: false, accountant: true, sales: false, cx: false },
  inbox: { owner: true, admin: true, supervisor: true, accountant: true, sales: true, cx: true },
  attendance: { owner: true, admin: true, supervisor: true, accountant: false, sales: true, cx: true },
  monitoring: { owner: true, admin: true, supervisor: true, accountant: false, sales: false, cx: false },
  policy: { owner: true, admin: true, supervisor: false, accountant: false, sales: false, cx: false },
  targets: { owner: true, admin: true, supervisor: true, accountant: false, sales: true, cx: true },
  coaching: { owner: true, admin: true, supervisor: true, accountant: false, sales: false, cx: false },
  planning: { owner: true, admin: true, supervisor: false, accountant: false, sales: false, cx: false },
  kb: { owner: true, admin: true, supervisor: true, accountant: true, sales: true, cx: true },
  chat: { owner: true, admin: true, supervisor: true, accountant: true, sales: true, cx: true },
  payroll: { owner: true, admin: true, supervisor: false, accountant: true, sales: false, cx: false },
  finance: { owner: true, admin: true, supervisor: false, accountant: true, sales: false, cx: false },
  wise: { owner: true, admin: true, supervisor: true, accountant: false, sales: false, cx: false },
};

export default async function PermissionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: saved } = await admin
    .from('permissions')
    .select('matrix')
    .limit(1)
    .maybeSingle();

  const matrix = saved?.matrix ?? DEFAULTS;

  return <PermissionsClient initialMatrix={matrix} categories={CATS} roles={ROLES} />;
}
