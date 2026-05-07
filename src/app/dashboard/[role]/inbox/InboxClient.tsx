'use client';

import { useState, useEffect, useRef } from 'react';
import { dbOp } from '@/utils/db';
import { createClient } from '@/utils/supabase/client';

const TAG_COLORS: Record<string, string> = {
  Finance: 'bdg-warn', HR: 'bdg-acc', Audit: 'bdg-gy', Planning: 'bdg-acc',
  CX: 'bdg-ok', Notice: 'bdg-acc', Payslip: 'bdg-ok', Contract: 'bdg-acc',
  Report: 'bdg-gy', Warning: 'bdg-err', 'Action Plan': 'bdg-warn',
  'Violation Notice': 'bdg-err', 'Productivity Alert': 'bdg-warn',
  'Termination Flag': 'bdg-err', payslip: 'bdg-ok',
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

export default function InboxClient({
  initialDocs, allUsers, currentUserId, isMgmt,
}: {
  initialDocs: any[]; allUsers: any[]; currentUserId: string; isMgmt: boolean;
}) {
  const [docs, setDocs] = useState(initialDocs);
  const [selId, setSelId] = useState<string | null>(initialDocs[0]?.id ?? null);
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [signName, setSignName] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const composeRef = useRef<HTMLFormElement>(null);

  const currentUser = allUsers.find((u: any) => u.id === currentUserId);
  const currentUserName = currentUser?.name ?? 'Unknown';

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Supabase realtime: push new messages as they arrive ────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`inbox-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inbox_documents', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          setDocs(prev => {
            if (prev.some(d => d.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
          showToast('New message received');
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  const inboxDocs = docs.filter(d => !d.archived && d.user_id === currentUserId);
  const sentDocs  = docs.filter(d => !d.archived && d.sender_id === currentUserId);
  const visibleDocs = isMgmt
    ? (tab === 'sent' ? sentDocs : docs.filter(d => !d.archived))
    : (tab === 'sent' ? sentDocs : inboxDocs);

  const current = visibleDocs.find(d => d.id === selId) ?? visibleDocs[0] ?? null;
  const unread = (isMgmt ? docs.filter(d => !d.archived) : inboxDocs).filter(d => !d.is_read).length;

  const handleOpen = async (doc: any) => {
    setSelId(doc.id);
    setSignName('');
    if (!doc.is_read && doc.user_id === currentUserId) {
      await dbOp('inbox_documents', 'update', { is_read: true }, { id: doc.id });
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_read: true } : d));
    }
  };

  const handleArchive = async (doc: any) => {
    const { error } = await dbOp('inbox_documents', 'update', { archived: true }, { id: doc.id });
    if (error) { showToast(`Archive failed: ${error}`, false); return; }
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, archived: true } : d));
    setSelId(null);
    showToast('Archived');
  };

  const handleSign = async (doc: any) => {
    if (!signName.trim()) return;
    const { error } = await dbOp('inbox_documents', 'update', { is_signed: true, signed_by: signName }, { id: doc.id });
    if (error) { showToast(`Signature failed: ${error}`, false); return; }
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_signed: true, signed_by: signName } : d));
    showToast('Document signed');
  };

  const handleSend = async (
    toId: string, subject: string, message: string,
    type: string, reqSig: boolean, replyToId?: string
  ) => {
    setSending(true);
    const { data, error } = await dbOp('inbox_documents', 'insert', {
      user_id: toId,
      sender_id: currentUserId,
      title: subject,
      subject: subject,
      content: message,
      type,
      sender: currentUserName,
      requires_signature: reqSig,
      is_read: false,
      archived: false,
      ...(replyToId ? { reply_to: replyToId } : {}),
    });
    setSending(false);
    if (error) {
      showToast(`Send failed: ${error}`, false);
      return false;
    }
    if (data?.[0]) {
      // Add to sent view immediately
      setDocs(prev => [data[0], ...prev]);
    }
    showToast('Message sent');
    return true;
  };

  const handleCompose = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await handleSend(
      fd.get('to') as string,
      fd.get('subject') as string,
      fd.get('message') as string,
      fd.get('type') as string,
      fd.get('req_sig') === 'on',
    );
    if (ok) {
      setComposeOpen(false);
      composeRef.current?.reset();
    }
  };

  const handleReply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!replyTo) return;
    const fd = new FormData(e.currentTarget);
    const recipientId = replyTo.sender_id ?? replyTo.user_id;
    const ok = await handleSend(
      recipientId,
      `Re: ${replyTo.title ?? replyTo.subject ?? 'Message'}`,
      fd.get('message') as string,
      'Notice',
      false,
      replyTo.id,
    );
    if (ok) setReplyTo(null);
  };

  const openReply = (doc: any) => {
    setReplyTo(doc);
  };

  const recipientName = (doc: any) => {
    const u = allUsers.find((u: any) => u.id === doc.user_id);
    return u?.name ?? 'Unknown';
  };

  return (
    <div className="page-fade">
      <div className="card" style={{ height: 620, padding: 0, display: 'grid', gridTemplateColumns: '300px 1fr', overflow: 'hidden' }}>

        {/* ── Left panel ── */}
        <div style={{ borderRight: '1px solid var(--line)', overflowY: 'auto', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Inbox {unread > 0 && <span className="bdg bdg-acc" style={{ marginLeft: 6 }}>{unread}</span>}
              </div>
              <button className="btn btn-acc btn-sm" onClick={() => setComposeOpen(true)}>+ Compose</button>
            </div>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={`tab${tab === 'inbox' ? ' tab-a' : ''}`} onClick={() => setTab('inbox')}>Inbox</button>
              <button className={`tab${tab === 'sent' ? ' tab-a' : ''}`} onClick={() => setTab('sent')}>Sent</button>
            </div>
          </div>

          {visibleDocs.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              {tab === 'sent' ? 'No sent messages' : 'Inbox is empty'}
            </div>
          )}

          {visibleDocs.map((doc) => {
            const isActive = doc.id === (current?.id);
            return (
              <div key={doc.id} onClick={() => handleOpen(doc)} style={{
                padding: '11px 14px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer',
                background: isActive ? 'var(--accent-soft)' : (!doc.is_read && doc.user_id === currentUserId ? 'oklch(0.99 0.012 268)' : 'transparent'),
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              }}>
                {tab === 'inbox' && isMgmt && (
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginBottom: 2 }}>
                    To: {recipientName(doc)}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: !doc.is_read && doc.user_id === currentUserId ? 700 : 500 }}>
                    {tab === 'sent' ? `→ ${recipientName(doc)}` : (doc.sender ?? 'System')}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                    {new Date(doc.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: !doc.is_read && doc.user_id === currentUserId ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                  {doc.reply_to && <span style={{ color: 'var(--ink-3)', marginRight: 4 }}>↩</span>}
                  {doc.title ?? doc.subject ?? 'Document'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                  {doc.content?.slice(0, 55) ?? '—'}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span className={`bdg ${TAG_COLORS[doc.type] ?? 'bdg-gy'}`} style={{ fontSize: 9 }}>{doc.type ?? 'DOC'}</span>
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
            <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--line-2)', display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-acc btn-sm" onClick={() => openReply(current)}>↩ Reply</button>
              <button className="btn btn-sec btn-sm" onClick={() => handleArchive(current)}>Archive</button>
              {isMgmt && (
                <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginLeft: 'auto', alignSelf: 'center' }}>
                  To: {recipientName(current)}
                </span>
              )}
            </div>

            {/* Message content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.018em', marginBottom: 12 }}>
                {current.title ?? current.subject ?? 'Document'}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, borderBottom: '1px solid var(--line-2)', marginBottom: 16 }}>
                <Avatar name={current.sender ?? 'System'} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{current.sender ?? 'System'}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                    {new Date(current.created_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span className={`bdg ${TAG_COLORS[current.type] ?? 'bdg-gy'}`}>{current.type ?? 'DOC'}</span>
              </div>

              {current.reply_to && (
                <div style={{ background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 7, fontSize: 11, color: 'var(--ink-3)', marginBottom: 14, borderLeft: '3px solid var(--line)' }}>
                  ↩ Reply to earlier message
                </div>
              )}

              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
                {current.content ?? 'No content.'}
              </div>

              {current.requires_signature && !current.is_signed && current.user_id === currentUserId && (
                <div style={{ background: 'var(--warn-soft)', padding: 14, borderRadius: 9, border: '1px solid oklch(0.85 0.08 75)', marginTop: 20 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'oklch(0.45 0.12 75)', marginBottom: 10 }}>Signature Required</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="fld-input" style={{ flex: 1 }} placeholder="Type your full name to sign…"
                      value={signName} onChange={e => setSignName(e.target.value)} />
                    <button className="btn btn-acc btn-sm" disabled={!signName.trim()} onClick={() => handleSign(current)}>
                      Sign →
                    </button>
                  </div>
                </div>
              )}

              {current.is_signed && (
                <div style={{ background: 'var(--ok-soft)', padding: '10px 14px', borderRadius: 8, fontSize: 12, color: 'oklch(0.42 0.12 155)', fontWeight: 600, marginTop: 16, border: '1px solid oklch(0.85 0.08 155)' }}>
                  ✓ Signed by {current.signed_by}
                </div>
              )}
            </div>

            {/* Inline reply box */}
            {replyTo?.id === current.id && (
              <div style={{ borderTop: '1px solid var(--line-2)', padding: '14px 20px', flexShrink: 0 }}>
                <form onSubmit={handleReply}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink-3)' }}>
                    Replying to {current.sender ?? 'System'}
                  </div>
                  <textarea name="message" rows={3} required placeholder="Write your reply…"
                    className="fld-input" style={{ resize: 'vertical', marginBottom: 8, display: 'block', width: '100%' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-acc btn-sm" disabled={sending}>
                      {sending ? 'Sending…' : '↩ Send Reply'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplyTo(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}
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
                <select name="to" required className="fld-input">
                  <option value="">— Select recipient —</option>
                  {allUsers
                    .filter((u: any) => u.id !== currentUserId)
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                </select>
              </div>
              <div className="pv-fld">
                <label>Subject</label>
                <input type="text" name="subject" className="fld-input" placeholder="e.g. Performance Notice — May 2026" required />
              </div>
              <div className="pv-fld">
                <label>Type</label>
                <select name="type" className="fld-input">
                  <option value="Notice">Notice</option>
                  <option value="Report">Report</option>
                  <option value="Warning">Warning</option>
                  <option value="Action Plan">Action Plan</option>
                  <option value="Contract">Contract</option>
                  <option value="Payslip">Payslip</option>
                  <option value="HR">HR</option>
                </select>
              </div>
              <div className="pv-fld">
                <label>Message</label>
                <textarea name="message" rows={6} className="fld-input" placeholder="Write your message…" required style={{ resize: 'vertical' }} />
              </div>
              <label className="chk" style={{ marginBottom: 16 }}>
                <input type="checkbox" name="req_sig" /> Require recipient signature
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={sending}>{sending ? 'Sending…' : 'Send Message'}</button>
                <button type="button" className="btn btn-sec" onClick={() => setComposeOpen(false)}>Cancel</button>
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
