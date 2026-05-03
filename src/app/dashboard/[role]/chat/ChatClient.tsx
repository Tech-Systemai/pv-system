'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

const CHANNELS = [
  { id: 'general',       label: '# General',       roles: ['owner', 'admin', 'supervisor', 'sales', 'cx', 'accountant'] },
  { id: 'management',    label: '# Management',    roles: ['owner', 'admin', 'supervisor', 'accountant'] },
  { id: 'sales-team',    label: '# Sales Team',    roles: ['owner', 'admin', 'supervisor', 'sales'] },
  { id: 'cx-team',       label: '# CX Team',       roles: ['owner', 'admin', 'supervisor', 'cx'] },
  { id: 'announcements', label: '# Announcements', roles: ['owner', 'admin', 'supervisor', 'sales', 'cx', 'accountant'] },
];

const BUCKET = 'chat-files';

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
  const supabase = createClient();
  const visibleChannels = CHANNELS.filter(c => c.roles.includes(currentUserRole));
  const [channel, setChannel] = useState(visibleChannels[0]?.id || 'general');
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const channelMessages = messages.filter(m => m.channel === channel);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length]);

  // Realtime subscription — receives messages from all other users
  useEffect(() => {
    const sub = supabase
      .channel('chat-room')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as any;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const uploadFile = async (file: File): Promise<{ url: string; type: string } | null> => {
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${currentUserId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) {
      setSendError(`File upload failed: ${error.message}. Make sure the "chat-files" storage bucket exists.`);
      setUploading(false);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
    setUploading(false);
    return { url: publicUrl, type };
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !pendingFile) return;
    setSending(true);
    setSendError('');

    let fileUrl: string | null = null;
    let fileType: string | null = null;

    if (pendingFile) {
      const result = await uploadFile(pendingFile);
      if (!result) { setSending(false); return; }
      fileUrl = result.url;
      fileType = result.type;
    }

    const payload = {
      user_id: currentUserId,
      sender_name: currentUserName,
      sender_role: currentUserRole,
      channel,
      content: text.trim() || null,
      file_url: fileUrl,
      file_type: fileType,
    };

    // Optimistic — show immediately
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { ...payload, id: tempId, created_at: new Date().toISOString() }]);
    setText('');
    setPendingFile(null);

    const { data: saved, error } = await supabase
      .from('messages')
      .insert(payload)
      .select()
      .single();

    if (error) {
      setSendError(`Send failed: ${error.message}`);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } else if (saved) {
      setMessages(prev => prev.map(m => m.id === tempId ? saved : m));
    }

    setSending(false);
  };

  const isAnnouncements = channel === 'announcements';
  const canPost = !isAnnouncements || ['owner', 'admin'].includes(currentUserRole);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 160px)', background: '#fff', border: '1px solid #e4e7eb', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: '200px', background: '#1a1f2e', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px', fontSize: '11px', fontWeight: 700, color: '#6b7689', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Channels</div>
        {visibleChannels.map(c => (
          <button key={c.id} onClick={() => setChannel(c.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', border: 'none', cursor: 'pointer', background: channel === c.id ? '#2d3748' : 'transparent', color: channel === c.id ? '#fff' : '#94a3b8', fontSize: '13px', fontWeight: channel === c.id ? 600 : 400 }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e4e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>{visibleChannels.find(c => c.id === channel)?.label}</span>
          {isAnnouncements && !['owner', 'admin'].includes(currentUserRole) && (
            <span style={{ fontSize: '11px', color: '#6b7689' }}>Read-only — only management can post</span>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {channelMessages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#6b7689', fontSize: '13px', marginTop: '40px' }}>No messages yet in this channel.</div>
          )}
          {channelMessages.map((m, i) => {
            const isMe = m.user_id === currentUserId;
            const name = m.sender_name || 'User';
            return (
              <div key={m.id || i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: isMe ? '#4f46e5' : '#e4e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: isMe ? '#fff' : '#4a5568', flexShrink: 0 }}>
                  {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ maxWidth: '70%' }}>
                  <div style={{ fontSize: '10px', color: '#6b7689', marginBottom: '3px', textAlign: isMe ? 'right' : 'left' }}>
                    {name} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ background: isMe ? '#4f46e5' : '#f5f6f8', color: isMe ? '#fff' : '#1a1f2e', padding: m.file_url && !m.content ? '6px' : '9px 13px', borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0', fontSize: '13px', lineHeight: 1.5 }}>
                    {m.content && <div>{m.content}</div>}
                    {m.file_url && m.file_type === 'image' && (
                      <a href={m.file_url} target="_blank" rel="noreferrer">
                        <img src={m.file_url} alt="attachment" style={{ maxWidth: '280px', maxHeight: '200px', borderRadius: '8px', display: 'block', marginTop: m.content ? '6px' : 0, cursor: 'pointer' }} />
                      </a>
                    )}
                    {m.file_url && m.file_type === 'video' && (
                      <video controls style={{ maxWidth: '320px', borderRadius: '8px', display: 'block', marginTop: m.content ? '6px' : 0 }}>
                        <source src={m.file_url} />
                      </video>
                    )}
                    {m.file_url && m.file_type === 'file' && (
                      <a href={m.file_url} target="_blank" rel="noreferrer" style={{ color: isMe ? '#c7d2fe' : '#4f46e5', fontSize: '12px', display: 'block', marginTop: m.content ? '4px' : 0 }}>
                        📎 Download attachment
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Error bar */}
        {sendError && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 16px', fontSize: '12px', borderTop: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between' }}>
            {sendError}
            <button onClick={() => setSendError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* File preview */}
        {pendingFile && (
          <div style={{ padding: '8px 16px', background: '#f0f4ff', borderTop: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span>📎 {pendingFile.name}</span>
            <button onClick={() => setPendingFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7689' }}>✕</button>
          </div>
        )}

        {/* Input */}
        {canPost ? (
          <form onSubmit={handleSend} style={{ padding: '12px 16px', borderTop: '1px solid #e4e7eb', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) setPendingFile(e.target.files[0]); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach image or video"
              style={{ background: 'none', border: '1px solid #d8dde5', borderRadius: '8px', padding: '9px 12px', cursor: 'pointer', fontSize: '14px', color: '#6b7689', flexShrink: 0 }}
            >
              📎
            </button>
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`Message ${visibleChannels.find(c => c.id === channel)?.label}...`}
              style={{ flex: 1, padding: '10px 14px', border: '1px solid #d8dde5', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
            />
            <button
              type="submit"
              className="pv-btn pv-btn-pri"
              disabled={sending || uploading || (!text.trim() && !pendingFile)}
              style={{ flexShrink: 0 }}
            >
              {uploading ? 'Uploading…' : sending ? '…' : 'Send'}
            </button>
          </form>
        ) : (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e4e7eb', textAlign: 'center', fontSize: '12px', color: '#6b7689' }}>
            This channel is read-only for your role.
          </div>
        )}
      </div>
    </div>
  );
}
