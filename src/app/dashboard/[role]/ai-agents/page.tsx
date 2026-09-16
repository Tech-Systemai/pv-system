import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import AiAgentsClient from './AiAgentsClient';

export default async function AiAgentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  const [{ data: profile }, { data: agents }, { data: runs }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).single(),
    admin.from('ai_agents').select('*').neq('status', 'archived').order('created_at', { ascending: false }),
    admin.from('ai_agent_runs').select('*').order('created_at', { ascending: false }).limit(200),
  ]);

  const canManage = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');

  return (
    <AiAgentsClient
      initialAgents={agents ?? []}
      initialRuns={runs ?? []}
      canManage={canManage}
      currentUserId={user.id}
    />
  );
}
