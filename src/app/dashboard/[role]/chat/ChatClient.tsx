'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function ChatClient({ initialMessages, users, currentUserId }: { initialMessages: any[], users: any[], currentUserId: string }) {
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState('');
  const [receiver, setReceiver] = useState<string>('global');
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const channel = supabase.channel('realtime_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        // Fetch sender name
        const { data } = await supabase.from('profiles').select('name').eq('id', payload.new.sender_id).single();
        const newMsg = { ...payload.new, sender: { name: data?.name || 'Unknown' } };
        setMessages((prev) => [...prev, newMsg]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const newMsg = {
      sender_id: currentUserId,
      receiver_id: receiver === 'global' ? null : receiver,
      content
    };

    await supabase.from('messages').insert([newMsg]);
    setContent('');
  };

  const filteredMessages = messages.filter(m => 
    (receiver === 'global' && m.receiver_id === null) || 
    (receiver !== 'global' && (m.receiver_id === receiver || m.sender_id === receiver))
  );

  return (
    <div className="two" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="pn" style={{ overflowY: 'auto' }}>
        <div className="pn-h"><div className="pn-t">Channels & Direct</div></div>
        
        <div 
          onClick={() => setReceiver('global')} 
          style={{ padding: '12px', background: receiver === 'global' ? '#eef2ff' : '#fff', cursor: 'pointer', borderRadius: '8px', marginBottom: '8px', border: receiver === 'global' ? '1px solid #4f46e5' : '1px solid transparent' }}
        >
          <strong style={{ color: receiver === 'global' ? '#4f46e5' : '#1a1f2e' }}># Global Chat</strong>
        </div>
        
        <div style={{ fontSize: '11px', color: '#6b7689', textTransform: 'uppercase', fontWeight: 700, margin: '16px 0 8px 4px' }}>Direct Messages</div>
        {users.map(u => (
          <div 
            key={u.id} 
            onClick={() => setReceiver(u.id)}
            style={{ padding: '12px', background: receiver === u.id ? '#eef2ff' : '#fff', cursor: 'pointer', borderRadius: '8px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}
          >
            <span style={{ fontWeight: receiver === u.id ? 600 : 500, color: receiver === u.id ? '#4f46e5' : '#1a1f2e' }}>{u.name}</span>
            <span style={{ fontSize: '10px', color: '#9fa8be', textTransform: 'uppercase' }}>{u.role}</span>
          </div>
        ))}
      </div>

      <div className="pn" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="pn-h" style={{ borderBottom: '1px solid #e4e7eb', paddingBottom: '16px', marginBottom: '16px' }}>
          <div className="pn-t">{receiver === 'global' ? '# Global Chat' : users.find(u => u.id === receiver)?.name}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredMessages.length === 0 && <div className="empty" style={{ margin: 'auto' }}>No messages yet. Say hi!</div>}
          {filteredMessages.map(m => {
            const isMe = m.sender_id === currentUserId;
            return (
              <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                {!isMe && <div style={{ fontSize: '11px', color: '#6b7689', marginBottom: '4px', marginLeft: '4px' }}>{m.sender?.name}</div>}
                <div style={{ 
                  background: isMe ? '#4f46e5' : '#f5f6f8', 
                  color: isMe ? '#fff' : '#1a1f2e', 
                  padding: '10px 14px', 
                  borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                  fontSize: '13.5px',
                  lineHeight: '1.5'
                }}>
                  {m.content}
                </div>
                <div style={{ fontSize: '9px', color: '#9fa8be', marginTop: '4px', textAlign: isMe ? 'right' : 'left', marginRight: isMe ? '4px' : '0', marginLeft: !isMe ? '4px' : '0' }}>
                  {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            placeholder="Type a message..." 
            style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', border: '1px solid #e4e7eb', outline: 'none' }}
          />
          <button type="submit" className="pv-btn pv-btn-pri" disabled={!content.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}
