'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

const CHANNEL_ROLES: Record<string, string[]> = {
  general:       ['owner', 'admin', 'supervisor', 'sales', 'cx', 'accountant'],
  management:    ['owner', 'admin', 'supervisor', 'accountant'],
  'sales-team':  ['owner', 'admin', 'supervisor', 'sales'],
  'cx-team':     ['owner', 'admin', 'supervisor', 'cx'],
  announcements: ['owner', 'admin', 'supervisor', 'sales', 'cx', 'accountant'],
};

export default function NotificationBell({ userId, userRole }: { userId: string; userRole: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const accessibleChannelIds = Object.entries(CHANNEL_ROLES)
    .filter(([, roles]) => roles.includes(userRole))
    .map(([id]) => id);

  useEffect(() => {
    const lastSeen = localStorage.getItem(`notif-last-seen-${userId}`) || new Date(0).toISOString();
    supabase
      .from('messages')
      .select('id, content, channel, sender_name, sender_role, file_type, created_at, receiver_id')
      .neq('user_id', userId)
      .or(`channel.in.(${accessibleChannelIds.join(',')}),receiver_id.eq.${userId}`)
      .gt('created_at', lastSeen)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setNotifications(data); });
  }, []);

  useEffect(() => {
    const sub = supabase
      .channel('notif-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as any;
        if (msg.user_id === userId) return;
        const inMyChannel = accessibleChannelIds.includes(msg.channel);
        const isDMToMe = msg.receiver_id === userId;
        if (inMyChannel || isDMToMe) {
          setNotifications(prev => [msg, ...prev].slice(0, 20));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = () => {
    localStorage.setItem(`notif-last-seen-${userId}`, new Date().toISOString());
    setNotifications([]);
    setOpen(false);
  };

  const goToChat = () => {
    router.push(`/dashboard/${userRole}/chat`);
    markAllRead();
  };

  const count = notifications.length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        className="bell"
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >
        🔔
        {count > 0 && (
          <span style={{
            position: 'absolute', top: '-5px', right: '-6px',
            background: '#ef4444', color: '#fff', borderRadius: '10px',
            fontSize: '9px', fontWeight: 700, padding: '1px 4px',
            minWidth: '14px', textAlign: 'center', lineHeight: '14px',
            pointerEvents: 'none',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '44px', width: '320px',
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid #e4e7eb',
          zIndex: 2000, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #e4e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#1a1f2e' }}>Notifications</span>
            {count > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#4f46e5', fontWeight: 600 }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '28px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                No new notifications
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={goToChat}
                style={{ padding: '12px 16px', borderBottom: '1px solid #f5f6f8', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8f9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#4f46e5', flexShrink: 0 }}>
                    {(n.sender_name || 'U').split(' ').map((x: string) => x[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1f2e' }}>
                      {n.sender_name}
                      <span style={{ fontWeight: 400, color: '#6b7689' }}>
                        {' '}{n.receiver_id === userId ? '→ you (DM)' : `in #${n.channel}`}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7689', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.content || (n.file_type === 'image' ? '📷 Image' : n.file_type === 'video' ? '🎥 Video' : '📎 File')}
                    </div>
                    <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {count > 0 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f2f5', textAlign: 'center' }}>
              <button onClick={goToChat} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#4f46e5', fontWeight: 600 }}>
                View all in Chat →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
