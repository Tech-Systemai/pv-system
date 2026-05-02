import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import PolicyClient from './PolicyClient';
import { redirect } from 'next/navigation';

export default async function PolicyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!['owner', 'admin'].includes(profile?.role ?? '')) {
    redirect(`/dashboard/${profile?.role || 'sales'}`);
  }

  const { data: policies } = await admin
    .from('policies')
    .select('*')
    .order('created_at', { ascending: true });

  return <PolicyClient initialPolicies={policies || []} />;
}
