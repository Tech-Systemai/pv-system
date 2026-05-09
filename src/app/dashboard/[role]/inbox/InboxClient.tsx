'use client';

import { useState, useEffect, useRef } from 'react';
import { dbOp } from '@/utils/db';
import { createClient } from '@/utils/supabase/client';

const TAG_COLORS: Record<string, string> = {
  Finance: 'bdg-warn', HR: 'bdg-acc', Audit: 'bdg-gy', Planning: 'bdg-acc',
  CX: 'bdg-ok', Notice: 'bdg-acc', Payslip: 'bdg-ok', Contract: 'bdg-acc',
  Report: 'bdg-gy', Warning: 'bdg-err', 'Action Plan': 'bdg-warn',
  'Violation Notice': 'bdg-err', 'Productivity Alert': 'bdg-warn',
  'Termination Flag': 'bdg-err', payslip: 'bdg-ok', Coaching: 'bdg-acc',
};
const HUES = [268, 75, 155, 25, 290, 200, 50, 320];

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase();
  const hue = HUES[name.charCodeAt(0) % HUES.length];
  return (
    <div className="av-circle" style={{ width: size, height: size, fontSize: size * 0.38, flexShrink: 0, background: `linear-gradient(135deg,oklch(0.55 0.13 ${hue}),oklch(0.42 0.16 ${hue + 20}))` }}>
      {initials}
    </div>
  );
}

type Doc = {
  id: any; user_id: string; sender_id?: string; sender?: string;
  title?: string; subject?: string; content?: string; type?: string;
  is_read?: boolean; is_signed?: boolean; signed_by?: string;
  requires_signature?: boolean; archived?: boolean; reply_to?: any;
  created_at: string;
  attachment_url?: string; attachment_name?: string;
  html_content?: string; doc_ref_type?: string; doc_ref_id?: string;
};

export default function InboxClient({
  initialDocs, allUsers, currentUserId,
}: {
  initialDocs: any[]; allUsers: any[]; currentUserId: string;
}) {
  const [docs, setDocs]               = useState<Doc[]>(initialDocs);
  const [selId, setSelId]             = useState<any>(initialDocs[0]?.id ?? null);
  const [tab, setTab]                 = useState<'inbox' | 'sent'>('inbox');
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo]         = useState<Doc | null>(null);
  const [forwardDoc, setForwardDoc]   = useState<Doc | null>(null);
  const [sending, setSending]         = useState(false);
  const [signName, setSignName]       = useState('');
  const [sigSaving, setSigSaving]     = useState(false);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [attachFile, setAttachFile]   = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);
  const composeRef = useRef<HTMLFormElement>(null);
  const fwdRef     = useRef<HTMLFormElement>(null);

  const currentUser     = allUsers.find((u: any) => u.id === currentUserId);
  const currentUserName = currentUser?.name ?? 'Unknown';

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`inbox-${currentUserId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inbox_documents', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          setDocs(prev => {
            if (prev.some(d => d.id === payload.new.id)) return prev;
            return [payload.new as Doc, ...prev];
          });
          showToast('New message received');
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  const inboxDocs   = docs.filter(d => !d.archived && d.user_id === currentUserId);
  const sentDocs    = docs.filter(d => !d.archived && d.sender_id === currentUserId && d.user_id !== currentUserId);
  const visibleDocs = tab === 'sent' ? sentDocs : inboxDocs;

  const current = visibleDocs.find(d => d.id === selId) ?? visibleDocs[0] ?? null;
  const unread  = inboxDocs.filter(d => !d.is_read).length;

  // ── File upload ──────────────────────────────────────────────────────────────
  const uploadAttachment = async (file: File): Promise<{ url: string; name: string } | null> => {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext  = file.name.split('.').pop();
      const path = `inbox/${currentUserId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('employee-docs').upload(path, file, { upsert: true });
      if (error) { showToast(`Upload failed: ${error.message}`, false); return null; }
      const { data: urlData } = supabase.storage.from('employee-docs').getPublicUrl(path);
      return { url: urlData.publicUrl, name: file.name };
    } finally { setUploading(false); }
  };

  const handleOpen = async (doc: Doc) => {
    setSelId(doc.id);
    setSignName('');
    setReplyTo(null);
    if (!doc.is_read && doc.user_id === currentUserId) {
      await dbOp('inbox_documents', 'update', { is_read: true }, { id: doc.id });
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_read: true } : d));
    }
  };

  const handleArchive = async (doc: Doc) => {
    const { error } = await dbOp('inbox_documents', 'update', { archived: true }, { id: doc.id });
    if (error) { showToast(`Archive failed: ${error}`, false); return; }
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, archived: true } : d));
    setSelId(null);
    showToast('Archived');
  };

  const handleSign = async (doc: Doc) => {
    if (!signName.trim()) return;
    setSigSaving(true);

    const cursiveStyle = `font-family:'Dancing Script','Brush Script MT',cursive;font-size:28px;color:#1a1f2e`;
    const signedDate = `Signed ${new Date().toLocaleDateString()} · `;
    const updatedHtml = doc.html_content
      ?.replace('<!--EMP_SIG_PLACEHOLDER-->', `<span style="${cursiveStyle}">${signName.trim()}</span>`)
      ?.replace('<!--EMP_DATE_PLACEHOLDER-->', signedDate);

    const updates: Record<string, unknown> = { is_signed: true, signed_by: signName.trim() };
    if (updatedHtml) updates.html_content = updatedHtml;

    const { error } = await dbOp('inbox_documents', 'update', updates, { id: doc.id });
    if (error) { showToast(`Signature failed: ${error}`, false); setSigSaving(false); return; }

    if (doc.doc_ref_type === 'contract' && doc.doc_ref_id) {
      const now = new Date().toISOString();
      await dbOp('contracts', 'update', {
        employee_signature: signName.trim(),
        employee_signed_at: now,
      }, { id: doc.doc_ref_id });
    }
    if (doc.doc_ref_type === 'report' && doc.doc_ref_id) {
      const now = new Date().toISOString();
      await dbOp('reports', 'update', {
        employee_signature: signName.trim(),
        employee_signed_at: now,
      }, { id: doc.doc_ref_id });
    }

    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_signed: true, signed_by: signName.trim(), html_content: updatedHtml ?? d.html_content } : d));
    setSignName('');
    setSigSaving(false);
    showToast('Document signed');
  };

  const handleSend = async (opts: {
    toId: string; subject: string; message: string;
    type: string; reqSig: boolean; replyToId?: any;
    attachmentUrl?: string; attachmentName?: string;
  }) => {
    setSending(true);
    const { toId, subject, message, type, reqSig, replyToId, attachmentUrl, attachmentName } = opts;
    const payload: any = {
      user_id: toId, sender_id: currentUserId,
      title: subject, subject, content: message, type,
      sender: currentUserName, requires_signature: reqSig,
      is_read: false, archived: false,
    };
    if (replyToId)    { payload.reply_to       = replyToId; }
    if (attachmentUrl){ payload.attachment_url  = attachmentUrl; payload.attachment_name = attachmentName; }

    const { data, error } = await dbOp('inbox_documents', 'insert', payload);
    setSending(false);
    if (error) { showToast(`Send failed: ${error}`, false); return false; }
    if (data?.[0]) {
      setDocs(prev => [data[0], ...prev]);
      setSelId(data[0].id);
    }
    showToast('Message sent');
    return true;
  };

  const handleCompose = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    if (attachFile) {
      const result = await uploadAttachment(attachFile);
      if (!result) return;
      attachmentUrl = result.url; attachmentName = result.name;
    }
    const ok = await handleSend({
      toId: fd.get('to') as string,
      subject: fd.get('subject') as string,
      message: fd.get('message') as string,
      type: fd.get('type') as string,
      reqSig: fd.get('req_sig') === 'on',
      attachmentUrl, attachmentName,
    });
    if (ok) {
      setComposeOpen(false);
      setAttachFile(null);
      composeRef.current?.reset();
      setTab('sent');
    }
  };

  const handleReply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!replyTo) return;
    const fd = new FormData(e.currentTarget);
    const recipientId = replyTo.sender_id && replyTo.sender_id !== currentUserId
      ? replyTo.sender_id : replyTo.user_id;
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    const file = (e.currentTarget.elements.namedItem('attachment') as HTMLInputElement)?.files?.[0];
    if (file) {
      const result = await uploadAttachment(file);
      if (!result) return;
      attachmentUrl = result.url; attachmentName = result.name;
    }
    const ok = await handleSend({
      toId: recipientId,
      subject: `Re: ${replyTo.title ?? replyTo.subject ?? 'Message'}`,
      message: fd.get('message') as string,
      type: 'Notice', reqSig: false,
      replyToId: replyTo.id, attachmentUrl, attachmentName,
    });
    if (ok) {
      setReplyTo(null);
      if (recipientId !== currentUserId) setTab('sent');
    }
  };

  const handleForward = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!forwardDoc) return;
    const fd = new FormData(e.currentTarget);
    let attachmentUrl = forwardDoc.attachment_url;
    let attachmentName = forwardDoc.attachment_name;
    const file = (e.currentTarget.elements.namedItem('attachment') as HTMLInputElement)?.files?.[0];
    if (file) {
      const result = await uploadAttachment(file);
      if (!result) return;
      attachmentUrl = result.url; attachmentName = result.name;
    }
    const note = (fd.get('message') as string)?.trim() ?? '';
    const fwdBody = note
      ? `${note}\n\n-------- Forwarded Message --------\nFrom: ${forwardDoc.sender ?? 'Unknown'}\nDate: ${new Date(forwardDoc.created_at).toLocaleString()}\n\n${forwardDoc.content ?? ''}`
      : `-------- Forwarded Message --------\nFrom: ${forwardDoc.sender ?? 'Unknown'}\nDate: ${new Date(forwardDoc.created_at).toLocaleString()}\n\n${forwardDoc.content ?? ''}`;
    const ok = await handleSend({
      toId: fd.get('to') as string,
      subject: `Fwd: ${forwardDoc.title ?? forwardDoc.subject ?? 'Message'}`,
      message: fwdBody,
      type: forwardDoc.type ?? 'Notice', reqSig: false,
      attachmentUrl, attachmentName,
    });
    if (ok) { setForwardDoc(null); fwdRef.current?.reset(); }
  };

  const recipientName = (doc: Doc) => allUsers.find((u: any) => u.id === doc.user_id)?.name ?? 'Unknown';

  const isEmbedDoc = (doc: Doc) => !!doc.html_content;

  const buildThread = (anchor: Doc): Doc[] => {
    const findRoot = (d: Doc): Doc => {
      if (!d.reply_to) return d;
      const parent = docs.find(x => x.id === d.reply_to);
      return parent ? findRoot(parent) : d;
    };
    const root = findRoot(anchor);
    const inThread = new Set<any>([root.id]);
    let changed = true;
    while (changed) {
      changed = false;
      docs.forEach(d => {
        if (d.reply_to && inThread.has(d.reply_to) && !inThread.has(d.id)) {
          inThread.add(d.id); changed = true;
        }
      });
    }
    return docs
      .filter(d => !d.archived && inThread.has(d.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  return (
    <div className="page-fade">
      <div className="card" style={{ height: 700, padding: 0, display: 'grid', gridTemplateColumns: '300px 1fr', overflow: 'hidden' }}>

        {/* ── Left panel ── */}
        <div style={{ borderRight: '1px solid var(--line)', overflowY: 'auto', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Inbox {unread > 0 && <span className="bdg bdg-acc" style={{ marginLeft: 6 }}>{unread}</span>}
              </div>
              <button className="btn btn-acc btn-sm" onClick={() => { setComposeOpen(true); setAttachFile(null); }}>+ Compose</button>
            </div>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={`tab${tab === 'inbox' ? ' active' : ''}`} onClick={() => setTab('inbox')}>Inbox</button>
              <button className={`tab${tab === 'sent' ? ' active' : ''}`} onClick={() => setTab('sent')}>Sent</button>
            </div>
          </div>

          {visibleDocs.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              {tab === 'sent' ? 'No sent messages' : 'Inbox is empty'}
            </div>
          )}

          {visibleDocs.map((doc) => {
            const isActive = doc.id === current?.id;
            const isUnread = !doc.is_read && doc.user_id === currentUserId;
            return (
              <div key={doc.id} onClick={() => handleOpen(doc)} style={{
                padding: '11px 14px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer',
                background: isActive ? 'var(--accent-soft)' : (isUnread ? 'oklch(0.99 0.012 268)' : 'transparent'),
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              }}>
                {tab === 'sent' && (
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginBottom: 2 }}>
                    To: {recipientName(doc)}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: isUnread ? 700 : 500 }}>
                    {tab === 'sent' ? `→ ${recipientName(doc)}` : (doc.sender ?? 'System')}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                    {new Date(doc.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: isUnread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                  {doc.reply_to && <span style={{ color: 'var(--ink-3)', marginRight: 4 }}>↩</span>}
                  {doc.title ?? doc.subject ?? 'Document'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                  {doc.content?.slice(0, 55) ?? '—'}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span className={`bdg ${TAG_COLORS[doc.type ?? ''] ?? 'bdg-gy'}`} style={{ fontSize: 9 }}>{doc.type ?? 'DOC'}</span>
                  {doc.html_content && <span className="bdg bdg-acc" style={{ fontSize: 9 }}>📄 Embedded</span>}
                  {doc.attachment_name && !doc.html_content && <span className="bdg bdg-gy" style={{ fontSize: 9 }}>📎</span>}
                  {doc.requires_signature && !doc.is_signed && <span className="bdg bdg-warn" style={{ fontSize: 9 }}>Sign needed</span>}
                  {doc.is_signed && <span className="bdg bdg-ok" style={{ fontSize: 9 }}>Signed</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Right reading pane ── */}
        {current ? (
          <div style={{ display: 'flex', flexDirection: 'column', background: 'white', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--line-2)', display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
              <button className="btn btn-acc btn-sm" onClick={() => { setReplyTo(current); setForwardDoc(null); }}>↩ Reply</button>
              <button className="btn btn-sec btn-sm" onClick={() => { setForwardDoc(current); setReplyTo(null); }}>→ Forward</button>
              <button className="btn btn-sec btn-sm" onClick={() => handleArchive(current)}>Archive</button>
              {tab === 'sent' && (
                <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginLeft: 'auto' }}>
                  To: {recipientName(current)}
                </span>
              )}
            </div>

            {/* Content area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

              {isEmbedDoc(current) ? (
                /* ── Embedded document (contract / payslip / report) ── */
                <>
                  {/* Compact meta */}
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <Avatar name={current.sender ?? 'System'} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{current.sender ?? 'System'}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                        {new Date(current.created_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={`bdg ${TAG_COLORS[current.type ?? ''] ?? 'bdg-gy'}`}>{current.type ?? 'DOC'}</span>
                  </div>

                  {/* Iframe — renders the full document */}
                  <div style={{ flex: 1, overflow: 'auto', padding: '0 4px' }}>
                    <iframe
                      srcDoc={current.html_content}
                      style={{ width: '100%', minHeight: 500, border: 'none', display: 'block' }}
                      title={current.title ?? 'Document'}
                      onLoad={(e) => {
                        try {
                          const h = e.currentTarget.contentDocument?.body?.scrollHeight;
                          if (h) e.currentTarget.style.height = `${Math.min(h + 40, 1400)}px`;
                        } catch {}
                      }}
                    />
                  </div>

                  {/* Signature block below the document */}
                  {current.requires_signature && !current.is_signed && current.user_id === currentUserId && (
                    <div style={{ flexShrink: 0, padding: '18px 24px', borderTop: '2px solid var(--line)', background: 'var(--surface-2)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--ink)' }}>
                        ✍ Your signature is required
                      </div>
                      {signName && (
                        <div style={{ fontFamily: "'Brush Script MT','Apple Chancery',cursive", fontSize: 34, color: '#1a1f2e', marginBottom: 10, lineHeight: 1.2 }}>
                          {signName}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          value={signName} onChange={e => setSignName(e.target.value)}
                          placeholder="Type your full name to sign…"
                          style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, outline: 'none' }}
                          onFocus={e => e.target.style.borderColor = 'var(--accent-line)'}
                          onBlur={e => e.target.style.borderColor = 'var(--line)'}
                        />
                        <button className="btn btn-acc" disabled={!signName.trim() || sigSaving} onClick={() => handleSign(current)}>
                          {sigSaving ? 'Signing…' : 'Confirm Signature →'}
                        </button>
                      </div>
                    </div>
                  )}

                  {current.is_signed && (
                    <div style={{ flexShrink: 0, padding: '12px 24px', borderTop: '1px solid var(--line)', background: 'var(--ok-soft)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>✓</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.42 0.12 155)' }}>Signed by {current.signed_by}</div>
                        <div style={{ fontFamily: "'Brush Script MT','Apple Chancery',cursive", fontSize: 26, color: '#1a1f2e', lineHeight: 1.2 }}>{current.signed_by}</div>
                      </div>
                    </div>
                  )}
                </>
              ) : (() => {
                const thread = buildThread(current);
                return (
                  /* ── Plain text message — conversation thread ── */
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Subject + thread count */}
                    <div style={{ padding: '14px 22px 10px', borderBottom: '1px solid var(--line-2)', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.018em' }}>
                        {current.title ?? current.subject ?? 'Document'}
                      </div>
                      {thread.length > 1 && (
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>
                          {thread.length} messages in this conversation
                        </div>
                      )}
                    </div>

                    {/* Message bubbles */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {thread.map((msg) => {
                        const isMe = msg.sender_id === currentUserId;
                        const isCurrent = msg.id === current.id;
                        const parentMsg = msg.reply_to ? thread.find(t => t.id === msg.reply_to) : null;
                        return (
                          <div key={msg.id} style={{ display: 'flex', gap: 9, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                            {!isMe && <Avatar name={msg.sender ?? 'System'} size={26} />}
                            <div style={{ maxWidth: '72%', minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>{isMe ? 'You' : (msg.sender ?? 'System')}</span>
                                <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
                                  {new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {msg.type && msg.type !== 'Notice' && <span className={`bdg ${TAG_COLORS[msg.type] ?? 'bdg-gy'}`} style={{ fontSize: 9 }}>{msg.type}</span>}
                              </div>

                              {/* Quote of parent message */}
                              {parentMsg && (
                                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4, padding: '4px 8px', borderLeft: '2px solid var(--line)', background: 'var(--surface-2)', borderRadius: '0 5px 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                                  {parentMsg.sender ?? 'System'}: {parentMsg.content?.slice(0, 70) ?? '…'}{(parentMsg.content?.length ?? 0) > 70 ? '…' : ''}
                                </div>
                              )}

                              <div
                                onClick={() => !isCurrent ? handleOpen(msg) : undefined}
                                style={{
                                  padding: '10px 14px',
                                  borderRadius: isMe ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                                  background: isMe ? 'var(--accent)' : 'var(--surface-2)',
                                  color: isMe ? 'white' : 'var(--ink)',
                                  fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap',
                                  outline: isCurrent ? '2px solid var(--accent-line)' : 'none',
                                  outlineOffset: 2,
                                  cursor: isCurrent ? 'default' : 'pointer',
                                }}>
                                {msg.content ?? 'No content.'}
                              </div>

                              {msg.attachment_url && (
                                <div style={{ marginTop: 5, padding: '7px 11px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 15 }}>📎</span>
                                  <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.attachment_name ?? 'Attachment'}</span>
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="btn btn-sec btn-sm">↓</a>
                                </div>
                              )}

                              {isCurrent && msg.requires_signature && !msg.is_signed && msg.user_id === currentUserId && (
                                <div style={{ background: 'var(--warn-soft)', padding: 12, borderRadius: 9, border: '1px solid oklch(0.85 0.08 75)', marginTop: 8 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.45 0.12 75)', marginBottom: 8 }}>Signature Required</div>
                                  {signName && <div style={{ fontFamily: "'Brush Script MT','Apple Chancery',cursive", fontSize: 26, color: '#1a1f2e', marginBottom: 6 }}>{signName}</div>}
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <input className="fld-input" style={{ flex: 1 }} placeholder="Type your full name to sign…"
                                      value={signName} onChange={e => setSignName(e.target.value)} />
                                    <button className="btn btn-acc btn-sm" disabled={!signName.trim() || sigSaving} onClick={() => handleSign(current)}>
                                      {sigSaving ? 'Signing…' : 'Sign →'}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {isCurrent && msg.is_signed && (
                                <div style={{ background: 'var(--ok-soft)', padding: '8px 12px', borderRadius: 7, fontSize: 12, color: 'oklch(0.42 0.12 155)', fontWeight: 600, marginTop: 6, border: '1px solid oklch(0.85 0.08 155)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span>✓</span>
                                  <span style={{ fontFamily: "'Brush Script MT','Apple Chancery',cursive", fontSize: 22, fontWeight: 400 }}>{msg.signed_by}</span>
                                </div>
                              )}

                              {!isMe && (
                                <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-start' }}>
                                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 6px' }}
                                    onClick={() => { setReplyTo(msg); setForwardDoc(null); }}>
                                    ↩ Reply
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Inline reply form */}
              {replyTo && (
                <div style={{ borderTop: '2px solid var(--accent-soft)', padding: '12px 20px', flexShrink: 0, background: 'white' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 8, padding: '4px 8px', background: 'var(--surface-2)', borderRadius: 5, borderLeft: '2px solid var(--line)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Replying to {replyTo.sender ?? 'System'}: "{replyTo.content?.slice(0, 80)}{(replyTo.content?.length ?? 0) > 80 ? '…' : ''}"
                  </div>
                  <form onSubmit={handleReply}>
                    <textarea name="message" rows={3} required placeholder="Write your reply…"
                      className="fld-input" style={{ resize: 'vertical', marginBottom: 8, display: 'block', width: '100%' }} />
                    <div style={{ marginBottom: 8 }}>
                      <input type="file" name="attachment" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" style={{ fontSize: 12 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" className="btn btn-acc btn-sm" disabled={sending || uploading}>
                        {sending || uploading ? 'Sending…' : '↩ Send Reply'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplyTo(null)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 13, background: 'var(--surface-2)' }}>
            Select a message to read
          </div>
        )}
      </div>

      {/* Compose modal */}
      {composeOpen && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) setComposeOpen(false); }}>
          <div className="md" style={{ width: 540 }}>
            <div className="md-t">New Message</div>
            <form ref={composeRef} onSubmit={handleCompose}>
              <div className="pv-fld">
                <label>To</label>
                <select name="to" required>
                  <option value="">— Select recipient —</option>
                  {allUsers.filter((u: any) => u.id !== currentUserId).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="pv-fld"><label>Subject</label><input type="text" name="subject" placeholder="e.g. Performance Notice — May 2026" required /></div>
              <div className="pv-fld">
                <label>Type</label>
                <select name="type">
                  <option value="Notice">Notice</option><option value="Report">Report</option>
                  <option value="Warning">Warning</option><option value="Action Plan">Action Plan</option>
                  <option value="Contract">Contract</option><option value="Payslip">Payslip</option>
                  <option value="HR">HR</option><option value="Coaching">Coaching</option>
                </select>
              </div>
              <div className="pv-fld">
                <label>Message</label>
                <textarea name="message" rows={5} placeholder="Write your message…" required style={{ resize: 'vertical' }} />
              </div>
              <div className="pv-fld">
                <label>Attach file (PDF, image, doc…)</label>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  onChange={e => setAttachFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
                {attachFile && (
                  <div style={{ fontSize: 12, color: 'var(--ok)', marginTop: 4 }}>
                    📎 {attachFile.name} ({(attachFile.size / 1024).toFixed(0)} KB)
                    <button type="button" style={{ marginLeft: 8, color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                      onClick={() => setAttachFile(null)}>Remove</button>
                  </div>
                )}
              </div>
              <label className="chk" style={{ marginBottom: 16 }}>
                <input type="checkbox" name="req_sig" /> Require recipient signature
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={sending || uploading}>
                  {uploading ? 'Uploading…' : sending ? 'Sending…' : 'Send Message'}
                </button>
                <button type="button" className="btn btn-sec" onClick={() => { setComposeOpen(false); setAttachFile(null); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forward modal */}
      {forwardDoc && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) setForwardDoc(null); }}>
          <div className="md" style={{ width: 540 }}>
            <div className="md-t">Forward Message</div>
            <form ref={fwdRef} onSubmit={handleForward}>
              <div className="pv-fld">
                <label>To</label>
                <select name="to" required>
                  <option value="">— Select recipient —</option>
                  {allUsers.filter((u: any) => u.id !== currentUserId).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="pv-fld">
                <label>Subject (read-only)</label>
                <input type="text" value={`Fwd: ${forwardDoc.title ?? forwardDoc.subject ?? 'Message'}`} readOnly
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }} />
              </div>
              <div className="pv-fld">
                <label>Add a note (optional)</label>
                <textarea name="message" rows={3} placeholder="Add a note before the forwarded content…" style={{ resize: 'vertical' }} />
              </div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--ink-3)', marginBottom: 14, borderLeft: '3px solid var(--line)', lineHeight: 1.6, maxHeight: 100, overflow: 'hidden' }}>
                <strong>Original:</strong> {forwardDoc.content?.slice(0, 180)}{(forwardDoc.content?.length ?? 0) > 180 ? '…' : ''}
              </div>
              {forwardDoc.attachment_url && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
                  📎 Original attachment will be forwarded: <em>{forwardDoc.attachment_name}</em>
                </div>
              )}
              <div className="pv-fld">
                <label>Add new attachment (optional)</label>
                <input type="file" name="attachment" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" style={{ fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={sending || uploading}>
                  {uploading ? 'Uploading…' : sending ? 'Forwarding…' : '→ Forward'}
                </button>
                <button type="button" className="btn btn-sec" onClick={() => setForwardDoc(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 500,
          background: toast.ok ? 'oklch(0.25 0.05 145)' : 'oklch(0.25 0.05 25)',
          color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
