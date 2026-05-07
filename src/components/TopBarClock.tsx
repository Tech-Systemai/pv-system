'use client';

import { useEffect, useState } from 'react';

export default function TopBarClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return null;

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="tb-clock">
      <div className="tb-clock-time">{time}</div>
      <div className="tb-clock-date">{date.toUpperCase()}</div>
    </div>
  );
}
