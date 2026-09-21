import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { sentLast24h, warmupCap } from '@/lib/aiAgents/server/sender';
import type { OutreachSettings } from '@/lib/aiAgents/types';
import AiAgentsClient from './AiAgentsClient';
import type { InboxStatus } from './EmailsPanel';

export default async function AiAgentsPage({ searchParams }: { searchParams: Promise<{ inbox?: string }> }) {
  const { inbox: inboxResult } = await searchParams;
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
    { data: niches, error: nicheError },
    { data: leads },
    { data: outreach },
    { data: settings, error: settingsError },
    { data: box },
    { data: callNotes },
  ] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).single(),
    admin.from('ai_agents').select('*').neq('status', 'archived').order('created_at', { ascending: true }),
    admin.from('ai_agent_runs').select('*').order('created_at', { ascending: false }).limit(200),
    admin.from('ai_departments').select('*').order('arm_order', { ascending: true }),
    admin.from('ai_agent_work').select('*').order('updated_at', { ascending: false }).limit(300),
    admin.from('ai_agent_events').select('*').order('created_at', { ascending: false }).limit(150),
    admin.from('ai_niches').select('*').order('sort_order', { ascending: true }),
    admin.from('ai_leads').select('*').order('created_at', { ascending: false }).limit(1000),
    admin.from('ai_outreach').select('*').order('updated_at', { ascending: false }).limit(1000),
    admin.from('ai_outreach_settings').select('*').eq('id', 'default').maybeSingle(),
    // Only the address and when it was connected; the token never leaves the server.
    admin.from('ai_mailboxes').select('email, connected_at').order('connected_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('ai_call_notes').select('*').order('called_at', { ascending: false }).limit(500),
  ]);

  const canManage = ['owner', 'admin', 'supervisor'].includes(profile?.role ?? '');
  const s = settings as OutreachSettings | null;
  const sent24h = box ? await sentLast24h(admin, box.email) : 0;
  const inbox: InboxStatus = {
    ready: !settingsError,
    google: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    email: box?.email ?? null,
    cap: box ? warmupCap(box.connected_at, s?.daily_limit ?? 30) : 0,
    sent24h,
  };

  return (
    <AiAgentsClient
      initialAgents={agents ?? []}
      initialRuns={runs ?? []}
      initialDepartments={departments ?? []}
      initialWork={work ?? []}
      initialEvents={events ?? []}
      initialNiches={niches ?? []}
      initialLeads={leads ?? []}
      initialOutreach={outreach ?? []}
      initialSettings={s}
      initialCalls={callNotes ?? []}
      inbox={inbox}
      inboxResult={inboxResult ?? ''}
      // v91 adds the departments table; v92 adds niches, leads and outreach.
      schemaReady={!deptError}
      pipelineReady={!nicheError}
      // Which outside services are configured (names only; keys never leave the server).
      integrations={{
        apify: !!process.env.APIFY_TOKEN && !!process.env.APIFY_WEBHOOK_SECRET,
        claude: !!process.env.ANTHROPIC_API_KEY,
      }}
      canManage={canManage}
      currentUserId={user.id}
    />
  );
}
