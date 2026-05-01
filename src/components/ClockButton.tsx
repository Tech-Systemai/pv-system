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
      .update({
        clocked_in: newState,
        current_activity: newState ? 'Active' : null,
      })
      .eq('id', userId);

    if (!error) {
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
