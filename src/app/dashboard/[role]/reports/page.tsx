import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import ReportsClient from './ReportsClient';
import { redirect } from 'next/navigation';
import { getPermMatrix, resolveViewType, isAdminView, hasAccess } from '@/utils/getPermissions';

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, matrix] = await Promise.all([
    admin.from('profiles').select('role, name').eq('id', user.id).single(),
    getPermMatrix(),
  ]);

  const viewType = resolveViewType(matrix, 'reports', profile?.role ?? '');
  if (!hasAccess(viewType)) redirect(`/dashboard/${profile?.role || 'sales'}`);
  const isMgmt = isAdminView(viewType);

  const [{ data: savedReports }, { data: employees }, { data: sessions }] = await Promise.all([
    // All management roles see all reports
    admin.from('reports').select('*').order('created_at', { ascending: false }),

    // Employee list for the generate form (mgmt only)
    isMgmt
      ? admin.from('profiles').select('id, name, role, department')
      : Promise.resolve({ data: [] }),

    // Coaching sessions for QA evaluation linking (mgmt only)
    isMgmt
      ? admin.from('coaching_sessions')
          .select('id, type, notes, action_plan, agent_id, agent:profiles!coaching_sessions_agent_id_fkey(id, name, role)')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <ReportsClient
      reports={savedReports || []}
      sessions={sessions || []}
      employees={employees || []}
      isMgmt={isMgmt}
      currentUserId={user.id}
      currentUserName={profile?.name || 'Manager'}
    />
  );
}
