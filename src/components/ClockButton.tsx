'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function ClockButton({ userId, clockedIn }: { userId: string; clockedIn: boolean }) {
  const [active, setActive] = useState(clockedIn);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleClock = async () => {
    setLoading(true);
    const newState = !active;

    const { error } = await supabase
      .from('profiles')
      .update({ clocked_in: newState, current_activity: newState ? 'Active' : null })
      .eq('id', userId);

    if (!error) {
      if (newState) {
        await supabase.from('attendance_logs').insert([{
          user_id: userId,
          status: 'present',
          clock_in_time: new Date().toISOString(),
        }]);
      } else {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('attendance_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('date', today)
          .order('created_at', { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          await supabase
            .from('attendance_logs')
            .update({ clock_out_time: new Date().toISOString() })
            .eq('id', data[0].id);
        }
      }
      setActive(newState);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleClock}
      disabled={loading}
      className={`pv-btn ${active ? 'pv-btn-danger' : 'pv-btn-pri'}`}
      style={{ opacity: loading ? 0.7 : 1 }}
    >
      {loading ? '...' : active ? 'Clock Out' : 'Clock In'}
    </button>
  );
}
