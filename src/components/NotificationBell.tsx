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

const TYPE_ICON: Record<string, string> = {
  Report: '📊', Contract: '📄', Payslip: '💵', Warning: '⚠️',
  Notice: '📢', Coaching: '🎯', HR: '📋', 'Action Plan': '📝',
};

const TICKET_ICON: Record<string, string> = {
  ticket_new:       '🎫',
  ticket_reply:     '💬',
  ticket_resolved:  '✅',
  task_assigned:    '☑',
  timeoff_request:  '🏖',
};

export default function NotificationBell({ userId, userRole }: { userId: string; userRole: string }) {
  const supabase = createClient();
  const router   = useRouter();
  const ref      = useRef<HTMLDivElement>(null);

  const [chatNotifs,      setChatNotifs]      = useState<any[]>([]);
  const [inboxNotifs,     setInboxNotifs]     = useState<any[]>([]);
  const [ticketNotifs,    setTicketNotifs]    = useState<any[]>([]); // from notifications table
  const [liveTicketItems, setLiveTicketItems] = useState<any[]>([]); // from direct tickets sub
  const [open, setOpen] = useState(false);

  const isMgmt = ['owner', 'admin', 'supervisor'].includes(userRole);

  const accessibleChannelIds = Object.entries(CHANNEL_ROLES)
    .filter(([, roles]) => roles.includes(userRole))
    .map(([id]) => id);

  // ── Fetch all notification counts ────────────────────────────────────────
  const fetchAll = () => {
    const lastSeen = localStorage.getItem(`notif-last-seen-${userId}`) || new Date(0).toISOString();

    supabase
      .from('messages')
      .select('id, content, channel, sender_name, sender_role, file_type, created_at, receiver_id')
      .neq('user_id', userId)
      .or(`channel.in.(${accessibleChannelIds.join(',')}),receiver_id.eq.${userId}`)
      .gt('created_at', lastSeen)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => { if (data) setChatNotifs(data); });

    supabase
      .from('inbox_documents')
      .select('id, subject, title, sender, type, created_at')
      .eq('user_id', userId)
      .eq('is_read', false)
      .gt('created_at', lastSeen)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => { if (data) setInboxNotifs(data); });

    supabase
      .from('notifications')
      .select('id, title, body, type, link_id, is_read, created_at')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setTicketNotifs(data); });
  };

  // ── Initial load + 30-second polling fallback ────────────────────────────
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Realtime ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const chatSub = supabase
      .channel('notif-chat-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as any;
        if (msg.user_id === userId) return;
        const inMyChannel = accessibleChannelIds.includes(msg.channel);
        const isDMToMe    = msg.receiver_id === userId;
        if (inMyChannel || isDMToMe) {
          setChatNotifs(prev => [msg, ...prev].slice(0, 15));
        }
      })
      .subscribe();

    const inboxSub = supabase
      .channel(`notif-inbox-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inbox_documents' },
        payload => {
          const doc = payload.new as any;
          if (doc.user_id !== userId) return;
          setInboxNotifs(prev => [doc, ...prev].slice(0, 15));
        })
      .subscribe();

    // Targeted notifications from DB (reply/resolve alerts)
    const ticketSub = supabase
      .channel(`notif-tickets-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        payload => {
          const notif = payload.new as any;
          if (notif.user_id !== userId) return;
          setTicketNotifs(prev => [notif, ...prev].slice(0, 20));
        })
      .subscribe();

    // Direct ticket inserts — shows new tickets to mgmt without needing notifications table
    const newTicketSub = supabase
      .channel(`notif-new-tickets-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tickets' },
        payload => {
          if (!isMgmt) return;
          const t = payload.new as any;
          if (t.user_id === userId) return; // don't notify yourself
          setLiveTicketItems(prev => [{
            id: `live-${t.id}`,
            title: 'New claim opened',
            body: t.title || t.subject || 'A new support claim was opened',
            type: 'ticket_new',
            link_id: t.id,
            created_at: t.created_at || new Date().toISOString(),
          }, ...prev].slice(0, 10));
        })
      .subscribe();

    return () => {
      supabase.removeChannel(chatSub);
      supabase.removeChannel(inboxSub);
      supabase.removeChannel(ticketSub);
      supabase.removeChannel(newTicketSub);
    };
  }, []);

  // ── Click outside ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = () => {
    localStorage.setItem(`notif-last-seen-${userId}`, new Date().toISOString());
    if (ticketNotifs.length > 0) {
      supabase.from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .like('type', 'ticket%')
        .then(() => {});
    }
    setChatNotifs([]);
    setInboxNotifs([]);
    setTicketNotifs([]);
    setLiveTicketItems([]);
    setOpen(false);
  };

  // De-duplicate: hide live items already covered by the notifications table
  const seenLinkIds = new Set(ticketNotifs.map(n => n.link_id).filter(Boolean));
  const dedupedLive = liveTicketItems.filter(t => !seenLinkIds.has(t.link_id));

  const allNotifs = [
    ...chatNotifs.map(n   => ({ ...n, _kind: 'chat'   })),
    ...inboxNotifs.map(n  => ({ ...n, _kind: 'inbox'  })),
    ...ticketNotifs.map(n => ({ ...n, _kind: 'ticket' })),
    ...dedupedLive.map(n  => ({ ...n, _kind: 'ticket' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
   .slice(0, 25);

  const count = allNotifs.length;

  const navigate = (n: any) => {
    if (n.type === 'task_assigned') {
      router.push(`/dashboard/${userRole}/tasks`);
    } else if (n.type === 'timeoff_request') {
      router.push(`/dashboard/${userRole}/approvals`);
    } else if (n._kind === 'ticket') {
      router.push(`/dashboard/${userRole}/tickets`);
    } else if (n._kind === 'inbox') {
      router.push(`/dashboard/${userRole}/inbox`);
    } else {
      router.push(`/dashboard/${userRole}/chat`);
    }
    markAllRead();
  };

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
            {allNotifs.length === 0 ? (
              <div style={{ padding: '28px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                No new notifications
              </div>
            ) : allNotifs.map((n, i) => (
              <div
                key={`${n._kind}-${n.id}-${i}`}
                onClick={() => navigate(n)}
                style={{ padding: '12px 16px', borderBottom: '1px solid #f5f6f8', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8f9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  {/* Icon */}
                  {n._kind === 'ticket' ? (
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>
                      {TICKET_ICON[n.type] ?? '🎫'}
                    </div>
                  ) : n._kind === 'inbox' ? (
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>
                      {TYPE_ICON[n.type ?? ''] ?? '✉️'}
                    </div>
                  ) : (
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#4f46e5', flexShrink: 0 }}>
                      {(n.sender_name || 'U').split(' ').map((x: string) => x[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {n._kind === 'ticket' ? (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1f2e' }}>{n.title}</div>
                        {n.body && <div style={{ fontSize: '11px', color: '#6b7689', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>}
                      </>
                    ) : n._kind === 'inbox' ? (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1f2e' }}>
                          {n.sender ?? 'System'}<span style={{ fontWeight: 400, color: '#6b7689' }}> → your inbox</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7689', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.title ?? n.subject ?? 'New document'}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1f2e' }}>
                          {n.sender_name}<span style={{ fontWeight: 400, color: '#6b7689' }}>{' '}{n.receiver_id === userId ? '→ you (DM)' : `in #${n.channel}`}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7689', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.content || (n.file_type === 'image' ? '📷 Image' : n.file_type === 'video' ? '🎥 Video' : '📎 File')}
                        </div>
                      </>
                    )}
                    <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {count > 0 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f2f5', display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button onClick={() => { router.push(`/dashboard/${userRole}/tickets`); markAllRead(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#4f46e5', fontWeight: 600 }}>
                Open Tickets →
              </button>
              <button onClick={() => { router.push(`/dashboard/${userRole}/inbox`); markAllRead(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7689', fontWeight: 500 }}>
                Open Inbox →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
