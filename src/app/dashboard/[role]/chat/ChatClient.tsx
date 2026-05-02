'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { dbOp } from '@/utils/db';

const CHANNELS = [
  { id: 'general', label: '# General', roles: ['owner', 'admin', 'supervisor', 'sales', 'cx', 'accountant'] },
  { id: 'management', label: '# Management', roles: ['owner', 'admin', 'supervisor', 'accountant'] },
  { id: 'sales-team', label: '# Sales Team', roles: ['owner', 'admin', 'supervisor', 'sales'] },
  { id: 'cx-team', label: '# CX Team', roles: ['owner', 'admin', 'supervisor', 'cx'] },
  { id: 'announcements', label: '# Announcements', roles: ['owner', 'admin', 'supervisor', 'sales', 'cx', 'accountant'] },
];

export default function ChatClient({
  initialMessages,
  currentUserId,
  currentUserRole,
  currentUserName,
}: {
  initialMessages: any[];
  currentUserId: string;
  currentUserRole: string;
  currentUserName: string;
}) {
  const visibleChannels = CHANNELS.filter(c => c.roles.includes(currentUserRole));
  const [channel, setChannel] = useState(visibleChannels[0]?.id || 'general');
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const channelMessages = messages.filter(m => m.channel === channel);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length]);

  useEffect(() => {
    const sub = supabase
      .channel('messages-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as any;
        if (CHANNELS.some(c => c.id === msg.channel)) {
          setMessages(prev => [...prev, { ...msg, sender: { name: msg.sender_name || 'User', role: '' } }]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    await dbOp('messages', 'insert', {
      sender_id: currentUserId,
      sender_name: currentUserName,
      channel,
      content: text.trim(),
    });
    setText('');
    setSending(false);
  };

  const isAnnouncements = channel === 'announcements';
  const canPost = !isAnnouncements || ['owner', 'admin'].includes(currentUserRole);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 160px)', gap: '0', background: '#fff', border: '1px solid #e4e7eb', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ width: '200px', background: '#1a1f2e', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', fontSize: '11px', fontWeight: 700, color: '#6b7689', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Channels</div>
        {visibleChannels.map(c => (
          <button key={c.id} onClick={() => setChannel(c.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', border: 'none', cursor: 'pointer', background: channel === c.id ? '#2d3748' : 'transparent', color: channel === c.id ? '#fff' : '#94a3b8', fontSize: '13px', fontWeight: channel === c.id ? 600 : 400 }}>
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e4e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>{visibleChannels.find(c => c.id === channel)?.label}</span>
          {isAnnouncements && !['owner', 'admin'].includes(currentUserRole) && (
            <span style={{ fontSize: '11px', color: '#6b7689' }}>Read-only — only management can post</span>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {channelMessages.length === 0 && <div style={{ textAlign: 'center', color: '#6b7689', fontSize: '13px', marginTop: '40px' }}>No messages yet in this channel.</div>}
          {channelMessages.map((m, i) => {
            const isMe = m.sender_id === currentUserId;
            const name = m.sender?.name || m.sender_name || 'User';
            return (
              <div key={m.id || i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: isMe ? '#4f46e5' : '#e4e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: isMe ? '#fff' : '#4a5568', flexShrink: 0 }}>
                  {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ maxWidth: '70%' }}>
                  <div style={{ fontSize: '10px', color: '#6b7689', marginBottom: '3px', textAlign: isMe ? 'right' : 'left' }}>
                    {name} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ background: isMe ? '#4f46e5' : '#f5f6f8', color: isMe ? '#fff' : '#1a1f2e', padding: '9px 13px', borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0', fontSize: '13px', lineHeight: 1.5 }}>
                    {m.content}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {canPost ? (
          <form onSubmit={handleSend} style={{ padding: '12px 16px', borderTop: '1px solid #e4e7eb', display: 'flex', gap: '8px' }}>
            <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${visibleChannels.find(c => c.id === channel)?.label}...`} style={{ flex: 1, padding: '10px 14px', border: '1px solid #d8dde5', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
            <button type="submit" className="pv-btn pv-btn-pri" disabled={sending || !text.trim()}>{sending ? '...' : 'Send'}</button>
          </form>
        ) : (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e4e7eb', textAlign: 'center', fontSize: '12px', color: '#6b7689' }}>This channel is read-only for your role.</div>
        )}
      </div>
    </div>
  );
}
