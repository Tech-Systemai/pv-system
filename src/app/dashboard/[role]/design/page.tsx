import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import DesignClient from './DesignClient';

export default async function DesignPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from('brand_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  return <DesignClient initialSettings={settings} />;
}
