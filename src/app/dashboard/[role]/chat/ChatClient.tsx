'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { dbOp } from '@/utils/db';

const CHANNELS = [
  { id: 'general',       label: '# General',       roles: ['owner', 'admin', 'supervisor', 'sales', 'cx', 'accountant'] },
  { id: 'management',    label: '# Management',    roles: ['owner', 'admin', 'supervisor', 'accountant'] },
  { id: 'sales-team',    label: '# Sales Team',    roles: ['owner', 'admin', 'supervisor', 'sales'] },
  { id: 'cx-team',       label: '# CX Team',       roles: ['owner', 'admin', 'supervisor', 'cx'] },
  { id: 'announcements', label: '# Announcements', roles: ['owner', 'admin', 'supervisor', 'sales', 'cx', 'accountant'] },
];

// Roles that everyone is allowed to DM
const DM_ROLES = ['owner', 'admin', 'supervisor', 'accountant'];
const BUCKET = 'chat-files';

const dmId = (uid1: string, uid2: string) => `dm-${[uid1, uid2].sort().join('|')}`;

export default function ChatClient({
  initialMessages,
  currentUserId,
  currentUserRole,
  currentUserName,
  allUsers,
  channelMemberships: initialMemberships,
}: {
  initialMessages: any[];
  currentUserId: string;
  currentUserRole: string;
  currentUserName: string;
  allUsers: any[];
  channelMemberships: any[];
}) {
  const supabase = createClient();
  const isOwner = currentUserRole === 'owner';

  const [memberships, setMemberships] = useState(initialMemberships);
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showDMPicker, setShowDMPicker] = useState(false);
  const [dmUnreads, setDmUnreads] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const visibleChannels = CHANNELS.filter(c => {
    const byRole = c.roles.includes(currentUserRole);
    const byGrant = memberships.some(m => m.user_id === currentUserId && m.channel_id === c.id);
    return byRole || byGrant;
  });

  // Users that everyone is allowed to DM (excluding self)
  const dmableUsers = allUsers.filter(
    u => DM_ROLES.includes(u.role) && u.id !== currentUserId,
  );

  // All users with an existing DM conversation — includes anyone who messaged the current user
  const activeDMUsers = allUsers.filter(u =>
    u.id !== currentUserId &&
    messages.some(m => m.channel === dmId(currentUserId, u.id)),
  );

  const [channel, setChannel] = useState(visibleChannels[0]?.id || 'general');

  const isDM = channel.startsWith('dm-');
  const dmRecipient = isDM
    ? allUsers.find(u => dmId(currentUserId, u.id) === channel) ?? null
    : null;

  const channelMessages = messages.filter(m => m.channel === channel);

  const channelConfig = CHANNELS.find(c => c.id === channel);
  const channelMembers = isDM
    ? []
    : allUsers.filter(u => {
        const byRole = channelConfig?.roles.includes(u.role);
        const byGrant = memberships.some(m => m.user_id === u.id && m.channel_id === channel);
        return byRole || byGrant;
      });

  // Seed DM unreads from localStorage on mount
  useEffect(() => {
    const initial: Record<string, number> = {};
    dmableUsers.forEach(u => {
      const dmCh = dmId(currentUserId, u.id);
      const lastRead = localStorage.getItem(`dm-last-read-${dmCh}`) || new Date(0).toISOString();
      const count = messages.filter(
        m => m.channel === dmCh && m.user_id !== currentUserId && m.created_at > lastRead,
      ).length;
      if (count > 0) initial[dmCh] = count;
    });
    setDmUnreads(initial);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length]);

  // Realtime subscription
  useEffect(() => {
    const sub = supabase
      .channel('chat-room')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as any;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        // Track DM unreads for messages received while not viewing that DM
        if (msg.user_id !== currentUserId && msg.channel?.startsWith('dm-') && msg.channel !== channel) {
          setDmUnreads(prev => ({ ...prev, [msg.channel]: (prev[msg.channel] || 0) + 1 }));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [channel]);

  const openDM = (dmCh: string) => {
    setChannel(dmCh);
    localStorage.setItem(`dm-last-read-${dmCh}`, new Date().toISOString());
    setDmUnreads(prev => { const next = { ...prev }; delete next[dmCh]; return next; });
  };

  const uploadFile = async (file: File): Promise<{ url: string; type: string } | null> => {
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${currentUserId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) {
      setSendError(`File upload failed: ${error.message}`);
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

    const payload: any = {
      user_id: currentUserId,
      sender_id: currentUserId,
      sender_name: currentUserName,
      sender_role: currentUserRole,
      channel,
      content: text.trim() || null,
      file_url: fileUrl,
      file_type: fileType,
    };

    if (isDM && dmRecipient) {
      payload.receiver_id = dmRecipient.id;
    }

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { ...payload, id: tempId, created_at: new Date().toISOString() }]);
    setText('');
    setPendingFile(null);

    const { data: saved, error } = await supabase.from('messages').insert(payload).select().single();
    if (error) {
      setSendError(`Send failed: ${error.message}`);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } else if (saved) {
      setMessages(prev => prev.map(m => m.id === tempId ? saved : m));
    }
    setSending(false);
  };

  const handleDelete = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    await supabase.from('messages').delete().eq('id', msgId);
  };

  const toggleAccess = async (userId: string, channelId: string, currently: boolean) => {
    if (currently) {
      await dbOp('channel_memberships', 'delete', undefined, { user_id: userId, channel_id: channelId });
      setMemberships(prev => prev.filter(m => !(m.user_id === userId && m.channel_id === channelId)));
    } else {
      const { data } = await dbOp('channel_memberships', 'insert', { user_id: userId, channel_id: channelId });
      if (data?.[0]) setMemberships(prev => [...prev, data[0]]);
    }
  };

  const isAnnouncements = channel === 'announcements';
  const canPost = isDM || !isAnnouncements || ['owner', 'admin'].includes(currentUserRole);

  const activeLabel = isDM
    ? `@ ${dmRecipient?.name || 'Direct Message'}`
    : visibleChannels.find(c => c.id === channel)?.label || channel;

  const ROLE_COLOR: Record<string, string> = {
    owner: '#7c3aed', admin: '#2563eb', supervisor: '#0891b2',
    sales: '#16a34a', cx: '#d97706', accountant: '#6b7280',
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 160px)', background: '#fff', border: '1px solid #e4e7eb', borderRadius: '12px', overflow: 'hidden' }}>

      {/* Left: channels + DMs */}
      <div style={{ width: '190px', background: '#1a1f2e', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 8px', fontSize: '11px', fontWeight: 700, color: '#6b7689', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Channels</div>
        {visibleChannels.map(c => (
          <button key={c.id} onClick={() => setChannel(c.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', border: 'none', cursor: 'pointer', background: channel === c.id ? '#2d3748' : 'transparent', color: channel === c.id ? '#fff' : '#94a3b8', fontSize: '13px', fontWeight: channel === c.id ? 600 : 400 }}>
            {c.label}
          </button>
        ))}

        <div style={{ padding: '12px 16px 6px', fontSize: '11px', fontWeight: 700, color: '#6b7689', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '8px', borderTop: '1px solid #2d3748', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Direct Messages</span>
          <button onClick={() => setShowDMPicker(true)} title="Start a new conversation" style={{ background: '#2d3748', border: '1px solid #4a5568', borderRadius: '4px', color: '#94a3b8', fontSize: '14px', lineHeight: 1, width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
        </div>
        {activeDMUsers.length === 0 ? (
          <div style={{ padding: '6px 16px 10px', fontSize: '11px', color: '#4a5568', fontStyle: 'italic' }}>Hit + to start a conversation</div>
        ) : activeDMUsers.map(u => {
          const dmCh = dmId(currentUserId, u.id);
          const unread = dmUnreads[dmCh] || 0;
          return (
            <button key={u.id} onClick={() => openDM(dmCh)} style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', textAlign: 'left', padding: '7px 14px', border: 'none', cursor: 'pointer', background: channel === dmCh ? '#2d3748' : 'transparent', color: channel === dmCh ? '#fff' : '#94a3b8', fontSize: '12px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.clocked_in ? '#10b981' : '#4a5568', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
              {unread > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: '8px', fontSize: '9px', fontWeight: 700, padding: '1px 5px', flexShrink: 0 }}>{unread}</span>
              )}
            </button>
          );
        })}

        {isOwner && (
          <div style={{ marginTop: 'auto', padding: '12px' }}>
            <button onClick={() => setShowAccessModal(true)} style={{ width: '100%', padding: '8px', background: '#2d3748', border: '1px solid #4a5568', borderRadius: '6px', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>
              ⚙ Manage Access
            </button>
          </div>
        )}
      </div>

      {/* Centre: messages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #e4e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px' }}>{activeLabel}</span>
            {isDM && dmRecipient && (
              <span style={{ fontSize: '11px', color: ROLE_COLOR[dmRecipient.role] || '#6b7689', fontWeight: 600, textTransform: 'capitalize', background: '#f5f6f8', padding: '2px 7px', borderRadius: '4px' }}>{dmRecipient.role}</span>
            )}
          </div>
          <span style={{ fontSize: '11px', color: '#6b7689' }}>
            {isDM
              ? (dmRecipient?.clocked_in ? '🟢 Clocked in' : '⚫ Clocked out')
              : `${channelMembers.length} members`}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {channelMessages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#6b7689', fontSize: '13px', marginTop: '40px' }}>
              {isDM ? `Start a private conversation with ${dmRecipient?.name || 'this person'}.` : 'No messages yet in this channel.'}
            </div>
          )}
          {channelMessages.map((m, i) => {
            const isMe = m.user_id === currentUserId;
            const name = m.sender_name || 'User';
            return (
              <div key={m.id || i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: isMe ? '#4f46e5' : '#e4e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: isMe ? '#fff' : '#4a5568', flexShrink: 0 }}>
                  {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ maxWidth: '70%', position: 'relative' }}>
                  <div style={{ fontSize: '10px', color: '#6b7689', marginBottom: '3px', textAlign: isMe ? 'right' : 'left' }}>
                    {name} · {m.sender_role || ''} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ background: isMe ? '#4f46e5' : '#f5f6f8', color: isMe ? '#fff' : '#1a1f2e', padding: m.file_url && !m.content ? '6px' : '9px 13px', borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0', fontSize: '13px', lineHeight: 1.5 }}>
                    {m.content && <div>{m.content}</div>}
                    {m.file_url && m.file_type === 'image' && (
                      <a href={m.file_url} target="_blank" rel="noreferrer">
                        <img src={m.file_url} alt="attachment" style={{ maxWidth: '280px', maxHeight: '200px', borderRadius: '8px', display: 'block', marginTop: m.content ? '6px' : 0 }} />
                      </a>
                    )}
                    {m.file_url && m.file_type === 'video' && (
                      <video controls style={{ maxWidth: '320px', borderRadius: '8px', display: 'block', marginTop: m.content ? '6px' : 0 }}>
                        <source src={m.file_url} />
                      </video>
                    )}
                    {m.file_url && m.file_type === 'file' && (
                      <a href={m.file_url} target="_blank" rel="noreferrer" style={{ color: isMe ? '#c7d2fe' : '#4f46e5', fontSize: '12px' }}>📎 Download attachment</a>
                    )}
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      title="Delete message"
                      style={{ position: 'absolute', top: 18, ...(isMe ? { left: -24 } : { right: -24 }), background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '12px', padding: '2px', opacity: 0.6 }}
                    >✕</button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {sendError && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 16px', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
            {sendError}
            <button onClick={() => setSendError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</button>
          </div>
        )}
        {pendingFile && (
          <div style={{ padding: '8px 16px', background: '#f0f4ff', borderTop: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span>📎 {pendingFile.name}</span>
            <button onClick={() => setPendingFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7689' }}>✕</button>
          </div>
        )}

        {canPost ? (
          <form onSubmit={handleSend} style={{ padding: '12px 16px', borderTop: '1px solid #e4e7eb', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) setPendingFile(e.target.files[0]); e.target.value = ''; }} />
            <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach image or video" style={{ background: 'none', border: '1px solid #d8dde5', borderRadius: '8px', padding: '9px 12px', cursor: 'pointer', fontSize: '14px', color: '#6b7689', flexShrink: 0 }}>📎</button>
            <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder={isDM ? `Message ${dmRecipient?.name || ''}…` : `Message ${activeLabel}…`} style={{ flex: 1, padding: '10px 14px', border: '1px solid #d8dde5', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
            <button type="submit" className="pv-btn pv-btn-pri" disabled={sending || uploading || (!text.trim() && !pendingFile)} style={{ flexShrink: 0 }}>
              {uploading ? 'Uploading…' : sending ? '…' : 'Send'}
            </button>
          </form>
        ) : (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e4e7eb', textAlign: 'center', fontSize: '12px', color: '#6b7689' }}>
            Read-only — only management can post in announcements.
          </div>
        )}
      </div>

      {/* Right: members panel / DM recipient info */}
      {!isDM ? (
        <div style={{ width: '210px', borderLeft: '1px solid #e4e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0, background: '#fafafa' }}>
          <div style={{ padding: '12px 14px 8px', fontSize: '11px', fontWeight: 700, color: '#6b7689', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Members · {channelMembers.length}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {channelMembers.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: u.clocked_in ? '#10b981' : '#d1d5db', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1f2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                  <div style={{ fontSize: '10px', color: ROLE_COLOR[u.role] || '#6b7689', fontWeight: 600, textTransform: 'capitalize' }}>{u.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ width: '210px', borderLeft: '1px solid #e4e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, background: '#fafafa', paddingTop: '32px', gap: '8px' }}>
          {dmRecipient && (
            <>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: '#4f46e5' }}>
                {dmRecipient.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1f2e', textAlign: 'center', padding: '0 12px' }}>{dmRecipient.name}</div>
              <div style={{ fontSize: '11px', color: ROLE_COLOR[dmRecipient.role] || '#6b7689', fontWeight: 600, textTransform: 'capitalize' }}>{dmRecipient.role}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: dmRecipient.clocked_in ? '#10b981' : '#9ca3af', marginTop: '4px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: dmRecipient.clocked_in ? '#10b981' : '#d1d5db' }} />
                {dmRecipient.clocked_in ? 'Clocked In' : 'Clocked Out'}
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '8px', padding: '0 16px', textAlign: 'center' }}>Private conversation</div>
            </>
          )}
        </div>
      )}

      {/* DM picker modal */}
      {showDMPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '420px', maxWidth: '100%', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #e4e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1f2e' }}>New Direct Message</div>
                <div style={{ fontSize: '11px', color: '#6b7689', marginTop: '2px' }}>Select a person to start a private conversation</div>
              </div>
              <button onClick={() => setShowDMPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
              {dmableUsers.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No users available</div>
              ) : dmableUsers.map(u => {
                const dmCh = dmId(currentUserId, u.id);
                const hasHistory = messages.some(m => m.channel === dmCh);
                return (
                  <button
                    key={u.id}
                    onClick={() => { openDM(dmCh); setShowDMPicker(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8f9ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#4f46e5', flexShrink: 0 }}>
                      {u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1f2e' }}>{u.name}</div>
                      <div style={{ fontSize: '11px', color: ROLE_COLOR[u.role] || '#6b7689', fontWeight: 600, textTransform: 'capitalize' }}>{u.role}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: u.clocked_in ? '#10b981' : '#9ca3af', flexShrink: 0 }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: u.clocked_in ? '#10b981' : '#d1d5db' }} />
                      {u.clocked_in ? 'In' : 'Out'}
                    </div>
                    {hasHistory && (
                      <div style={{ fontSize: '10px', color: '#6b7689', flexShrink: 0 }}>existing</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Access management modal */}
      {showAccessModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '680px', maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e4e7eb' }}>
              <div style={{ fontSize: '17px', fontWeight: 700 }}>Channel Access Management</div>
              <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>Toggle extra channel access per employee. Role-based defaults always apply.</div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f5f6f8', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#6b7689', textTransform: 'uppercase', fontSize: '10px' }}>Employee</th>
                    {CHANNELS.map(c => (
                      <th key={c.id} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#6b7689', textTransform: 'uppercase', fontSize: '10px', minWidth: '80px' }}>
                        {c.label.replace('# ', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1a1f2e' }}>{u.name}</div>
                        <div style={{ fontSize: '10px', color: ROLE_COLOR[u.role] || '#6b7689', textTransform: 'capitalize', fontWeight: 600 }}>{u.role}</div>
                      </td>
                      {CHANNELS.map(c => {
                        const byRole = c.roles.includes(u.role);
                        const byGrant = memberships.some(m => m.user_id === u.id && m.channel_id === c.id);
                        const hasAccess = byRole || byGrant;
                        return (
                          <td key={c.id} style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <button
                              onClick={() => !byRole && toggleAccess(u.id, c.id, byGrant)}
                              title={byRole ? 'Default access via role' : hasAccess ? 'Click to revoke' : 'Click to grant'}
                              style={{ width: '22px', height: '22px', borderRadius: '6px', border: 'none', cursor: byRole ? 'default' : 'pointer', background: byRole ? '#dbeafe' : byGrant ? '#dcfce7' : '#f5f6f8', color: byRole ? '#2563eb' : byGrant ? '#16a34a' : '#d1d5db', fontWeight: 700, fontSize: '13px' }}
                            >
                              {hasAccess ? '✓' : '·'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e4e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#6b7689' }}>
              <span>🔵 Blue = role default · 🟢 Green = manual grant · Click grey to grant, green to revoke</span>
              <button className="pv-btn pv-btn-sec" onClick={() => setShowAccessModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
