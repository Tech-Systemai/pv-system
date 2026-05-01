import { createClient } from '@/utils/supabase/server';
import ScheduleClient from './ScheduleClient';

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role, id').eq('id', user.id).single();
  const isMgmt = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'supervisor';

  const { data: users } = await supabase.from('profiles').select('id, name, role');
  
  // Fetch schedules
  const { data: schedules } = await supabase.from('schedules').select('*').order('created_at', { ascending: false });

  return (
    <>
      <ScheduleClient 
        initialSchedules={schedules || []} 
        users={users || []} 
        isMgmt={isMgmt} 
        currentUserId={user.id} 
      />
    </>
  );
}
