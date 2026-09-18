import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import AiAgentsClient from './AiAgentsClient';

export default async function AiAgentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [
    { data: profile },
    { data: agents },
    { data: runs },
    { data: departments, error: deptError },
    { data: work },
    { data: events },
  ] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).single(),
    admin.from('ai_agents').select('*').neq('status', 'archived').order('created_at', { ascending: true }),
    admin.from('ai_agent_runs').select('*').order('created_at', { ascending: false }).limit(200),
    admin.from('ai_departments').select('*').order('arm_order', { ascending: true }),
    admin.from('ai_agent_work').select('*').order('updated_at', { ascending: false }).limit(300),
    admin.from('ai_agent_events').select('*').order('created_at', { ascending: false }).limit(150),
  ]);

  const canManage = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');

  return (
    <AiAgentsClient
      initialAgents={agents ?? []}
      initialRuns={runs ?? []}
      initialDepartments={departments ?? []}
      initialWork={work ?? []}
      initialEvents={events ?? []}
      // v91 adds the departments table; until it is run the HQ can only preview.
      schemaReady={!deptError}
      canManage={canManage}
      currentUserId={user.id}
    />
  );
}
