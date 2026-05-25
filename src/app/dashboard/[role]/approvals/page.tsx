import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import ApprovalsClient from './ApprovalsClient';
import { redirect } from 'next/navigation';
import { getPermMatrix } from '@/utils/getPermissions';

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!['owner', 'admin', 'supervisor'].includes(profile?.role ?? '')) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  const isOwner = profile?.role === 'owner';

  const [
    { data: timeoff },
    { data: schedules },
    { data: payrolls },
    { data: docs },
    { data: pendingSignups },
    { data: pendingCollections },
  ] = await Promise.all([
    admin.from('time_off_requests').select('*, profiles!time_off_requests_user_id_fkey(name)').eq('status', 'Pending'),
    admin.from('schedules').select('*, profiles!schedules_user_id_fkey(name, role)').eq('status', 'Pending'),
    admin.from('payrolls').select('*, profiles!payrolls_user_id_fkey(name)').eq('status', 'Pending'),
    admin.from('inbox_documents').select('*, profiles!inbox_documents_user_id_fkey(name)').eq('approval_status', 'pending').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, username, email, name, role, department, created_at').eq('status', 'Pending').order('created_at', { ascending: false }),
    admin.from('sales_logs').select('*, profiles!sales_logs_user_id_fkey(name)').eq('type', 'Collection').eq('status', 'Pending').order('created_at', { ascending: false }),
  ]);

  let accessRequests: any[] = [];
  let matrix: any = {};
  if (isOwner) {
    const [{ data: reqs }, mat] = await Promise.all([
      admin.from('access_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      getPermMatrix(),
    ]);
    accessRequests = reqs ?? [];
    matrix = mat;
  }

  return (
    <ApprovalsClient
      initialTimeoff={timeoff || []}
      initialSchedules={schedules || []}
      initialPayrolls={payrolls || []}
      initialDocs={docs || []}
      initialAccessRequests={accessRequests}
      initialMatrix={matrix}
      initialSignups={pendingSignups || []}
      initialCollections={pendingCollections || []}
      isOwner={isOwner}
    />
  );
}
