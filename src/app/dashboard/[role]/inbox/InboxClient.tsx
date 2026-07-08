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

type Folder = { id: string; user_id: string; name: string; created_at: string };

type Doc = {
  id: any; user_id: string; sender_id?: string; sender?: string;
  title?: string; subject?: string; content?: string; type?: string;
  is_read?: boolean; is_signed?: boolean; signed_by?: string;
  requires_signature?: boolean; archived?: boolean; reply_to?: any;
  created_at: string; folder_id?: string | null;
  attachment_url?: string; attachment_name?: string;
  html_content?: string; doc_ref_type?: string; doc_ref_id?: string;
};

export default function InboxClient({
  initialDocs, allUsers, currentUserId, initialFolders,
}: {
  initialDocs: any[]; allUsers: any[]; currentUserId: string; initialFolders: any[];
}) {
  const [docs, setDocs]                 = useState<Doc[]>(initialDocs);
  const [selId, setSelId]               = useState<any>(null);
  const [tab, setTab]                   = useState<'inbox' | 'sent'>('inbox');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState('');
  const [folders, setFolders]           = useState<Folder[]>(initialFolders);
  const [newFolderName, setNewFolderName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [composeOpen, setComposeOpen]   = useState(false);
  const [replyTo, setReplyTo]           = useState<Doc | null>(null);
  const [forwardDoc, setForwardDoc]     = useState<Doc | null>(null);
  const [sending, setSending]           = useState(false);
  const [signName, setSignName]         = useState('');
  const [sigSaving, setSigSaving]       = useState(false);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);
  const [attachFile, setAttachFile]     = useState<File | null>(null);
  const [uploading, setUploading]       = useState(false);
  const composeRef = useRef<HTMLFormElement>(null);
  const fwdRef     = useRef<HTMLFormElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const currentUser     = allUsers.find((u: any) => u.id === currentUserId);
  const currentUserName = currentUser?.name ?? 'Unknown';

  // CX/Sales agents may only message management — not each other. Hide agent
  // peers from the recipient pickers (server-side guard in /api/db backs this up).
  const AGENT_ROLES = ['cx', 'sales'];
  const isAgentRole = (r?: string) => AGENT_ROLES.includes((r ?? '').toLowerCase());
  const currentIsAgent = isAgentRole(currentUser?.role);
  const recipientUsers = allUsers.filter(
    (u: any) => u.id !== currentUserId && !(currentIsAgent && isAgentRole(u.role))
  );

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

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

  const inboxDocs = docs.filter(d => !d.archived && d.user_id === currentUserId);
  const sentDocs  = docs.filter(d => !d.archived && d.sender_id === currentUserId && d.user_id !== currentUserId);
  const unread    = inboxDocs.filter(d => !d.is_read).length;

  const baseList = activeFolder
    ? docs.filter(d => !d.archived && d.folder_id === activeFolder)
    : (tab === 'sent' ? sentDocs : inboxDocs);

  const filteredDocs = searchQuery.trim()
    ? baseList.filter(d => {
        const q = searchQuery.toLowerCase();
        return (d.subject ?? d.title ?? '').toLowerCase().includes(q)
          || (d.sender ?? '').toLowerCase().includes(q)
          || (d.content ?? '').toLowerCase().includes(q);
      })
    : baseList;

  const current = filteredDocs.find(d => d.id === selId) ?? null;

  const recipientName = (doc: Doc) => allUsers.find((u: any) => u.id === doc.user_id)?.name ?? 'Unknown';

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

  // ── File upload ────────────────────────────────────────────────────────────
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

  // ── Message actions ────────────────────────────────────────────────────────
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
      await dbOp('contracts', 'update', {
        employee_signature: signName.trim(),
        employee_signed_at: new Date().toISOString(),
        status: 'Signed',
      }, { id: doc.doc_ref_id });
    }
    if (doc.doc_ref_type === 'report' && doc.doc_ref_id) {
      await dbOp('reports', 'update', {
        employee_signature: signName.trim(),
        employee_signed_at: new Date().toISOString(),
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
    if (replyToId)     { payload.reply_to       = replyToId; }
    if (attachmentUrl) { payload.attachment_url  = attachmentUrl; payload.attachment_name = attachmentName; }
    const { data, error } = await dbOp('inbox_documents', 'insert', payload);
    setSending(false);
    if (error) { showToast(`Send failed: ${error}`, false); return false; }
    if (data?.[0]) { setDocs(prev => [data[0], ...prev]); setSelId(data[0].id); }
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
      setActiveFolder(null);
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
      if (recipientId !== currentUserId) { setActiveFolder(null); setTab('sent'); }
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

  // ── Folder actions ─────────────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const { data, error } = await dbOp('inbox_folders', 'insert', { user_id: currentUserId, name });
    if (error) { showToast(`Could not create folder: ${error}`, false); return; }
    if (data?.[0]) setFolders(prev => [...prev, data[0] as Folder]);
    setNewFolderName('');
    setAddingFolder(false);
    showToast(`Folder "${name}" created`);
  };

  const handleDeleteFolder = async (folderId: string) => {
    const { error } = await dbOp('inbox_folders', 'delete', {}, { id: folderId });
    if (error) { showToast(`Could not delete folder: ${error}`, false); return; }
    setFolders(prev => prev.filter(f => f.id !== folderId));
    if (activeFolder === folderId) setActiveFolder(null);
    showToast('Folder deleted');
  };

  const handleMoveToFolder = async (docId: any, folderId: string | null) => {
    const { error } = await dbOp('inbox_documents', 'update', { folder_id: folderId }, { id: docId });
    if (error) { showToast(`Move failed: ${error}`, false); return; }
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, folder_id: folderId } : d));
    showToast(folderId ? 'Moved to folder' : 'Removed from folder');
  };

  // ── Nav helper ─────────────────────────────────────────────────────────────
  function NavItem({
    label, count, active, onClick, onDelete,
  }: { label: string; count?: number; active: boolean; onClick: () => void; onDelete?: () => void }) {
    return (
      <div
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', padding: '7px 12px', borderRadius: 7, cursor: 'pointer', gap: 6,
          background: active ? 'oklch(0.93 0.04 268)' : 'transparent',
          color: active ? 'var(--accent)' : 'var(--ink-2)',
          fontWeight: active ? 600 : 400, fontSize: 13,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {count != null && count > 0 && (
          <span style={{ background: 'var(--accent)', color: 'white', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
            {count}
          </span>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={ev => { ev.stopPropagation(); onDelete(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 13, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
          >
            ×
          </button>
        )}
      </div>
    );
  }

  const isEmbedDoc = (doc: Doc) => !!doc.html_content;

  return (
    <div className="page-fade">
      <div className="card" style={{ height: 740, padding: 0, display: 'flex', flexDirection: 'row', overflow: 'visible' }}>

        {/* ── Col 1: Folder nav ── */}
        <div style={{ width: 200, minWidth: 200, flexShrink: 0, borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', background: 'oklch(0.97 0.008 268)', overflow: 'hidden', borderRadius: '12px 0 0 12px' }}>
          <div style={{ padding: '14px 12px 10px', flexShrink: 0 }}>
            <button
              className="btn btn-acc"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { setComposeOpen(true); setAttachFile(null); }}
            >
              + Compose
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 4px 2px', marginTop: 4 }}>Mailbox</div>
            <NavItem
              label="Inbox"
              count={unread}
              active={!activeFolder && tab === 'inbox'}
              onClick={() => { setActiveFolder(null); setTab('inbox'); setSelId(null); setSearchQuery(''); }}
            />
            <NavItem
              label="Sent"
              active={!activeFolder && tab === 'sent'}
              onClick={() => { setActiveFolder(null); setTab('sent'); setSelId(null); setSearchQuery(''); }}
            />

            <div style={{ borderTop: '1px solid var(--line)', margin: '8px 4px 4px' }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 4px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Folders</span>
              <button
                type="button"
                onClick={() => { setAddingFolder(true); setTimeout(() => folderInputRef.current?.focus(), 50); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, fontSize: 14, lineHeight: 1, padding: 0 }}
                title="New folder"
              >+</button>
            </div>

            {folders.map(f => (
              <NavItem
                key={f.id}
                label={f.name}
                active={activeFolder === f.id}
                onClick={() => { setActiveFolder(f.id); setSelId(null); setSearchQuery(''); }}
                onDelete={() => handleDeleteFolder(f.id)}
              />
            ))}

            {folders.length === 0 && !addingFolder && (
              <div style={{ fontSize: 11, color: 'var(--ink-4)', padding: '6px 4px', lineHeight: 1.5 }}>
                No folders yet.<br />
                <span
                  style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => { setAddingFolder(true); setTimeout(() => folderInputRef.current?.focus(), 50); }}
                >
                  + Create one
                </span>
              </div>
            )}

            {addingFolder && (
              <div style={{ padding: '6px 4px', display: 'flex', gap: 4 }}>
                <input
                  ref={folderInputRef}
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName(''); } }}
                  placeholder="Folder name…"
                  style={{ flex: 1, fontSize: 12, padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 6, outline: 'none', minWidth: 0 }}
                />
                <button type="button" className="btn btn-acc btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={handleCreateFolder}>Add</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Col 2: Message list ── */}
        <div style={{ width: 320, minWidth: 320, flexShrink: 0, borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
          {/* Search bar */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line-2)', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--ink-4)', pointerEvents: 'none' }}>🔍</span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages…"
                style={{
                  width: '100%', padding: '7px 10px 7px 30px', fontSize: 12,
                  border: '1px solid var(--line)', borderRadius: 8, outline: 'none',
                  background: 'var(--surface-2)', boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-line)'}
                onBlur={e => e.target.style.borderColor = 'var(--line)'}
              />
            </div>
          </div>

          {/* Folder label when browsing a custom folder */}
          {activeFolder && (
            <div style={{ padding: '6px 14px', background: 'oklch(0.95 0.04 268)', borderBottom: '1px solid var(--line-2)', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
              📁 {folders.find(f => f.id === activeFolder)?.name ?? 'Folder'}
            </div>
          )}

          {/* Message rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredDocs.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                {searchQuery ? 'No results found' : activeFolder ? 'No messages in this folder' : tab === 'sent' ? 'No sent messages' : 'Inbox is empty'}
              </div>
            )}
            {filteredDocs.map((doc) => {
              const isActive = doc.id === current?.id;
              const isUnread = !doc.is_read && doc.user_id === currentUserId;
              const displaySender = tab === 'sent' && !activeFolder ? `To: ${recipientName(doc)}` : (doc.sender ?? 'System');
              const assignedFolder = folders.find(f => f.id === doc.folder_id);
              return (
                <div
                  key={doc.id}
                  onClick={() => handleOpen(doc)}
                  style={{
                    padding: '10px 14px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer',
                    background: isActive ? 'oklch(0.95 0.04 268)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    {isUnread && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                    {!isUnread && <div style={{ width: 7, flexShrink: 0 }} />}
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: isUnread ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>
                      {displaySender}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {new Date(doc.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: isUnread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)', paddingLeft: 13, marginBottom: 2 }}>
                    {doc.reply_to && <span style={{ color: 'var(--ink-3)', marginRight: 4, fontSize: 11 }}>Re:</span>}
                    {doc.title ?? doc.subject ?? 'Document'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 13, marginBottom: isActive && folders.length > 0 ? 8 : 0 }}>
                    {doc.html_content ? '📄 Embedded document' : (doc.content?.slice(0, 60) ?? '—')}
                    {doc.attachment_name && !doc.html_content && ' 📎'}
                  </div>
                  {/* Folder assignment row — shown on the selected message when folders exist */}
                  {isActive && folders.length > 0 && (
                    <div onClick={e => e.stopPropagation()} style={{ paddingLeft: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>📁</span>
                      <select
                        value={doc.folder_id ?? ''}
                        onChange={e => handleMoveToFolder(doc.id, e.target.value || null)}
                        style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--line)', borderRadius: 5, color: assignedFolder ? 'var(--accent)' : 'var(--ink-4)', background: 'white', cursor: 'pointer', maxWidth: 160 }}
                      >
                        <option value="">Move to folder…</option>
                        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        {doc.folder_id && <option value="">Remove from folder</option>}
                      </select>
                      {assignedFolder && (
                        <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {assignedFolder.name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Col 3: Reading pane ── */}
        {current ? (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white', borderRadius: '0 12px 12px 0' }}>

            {/* Toolbar */}
            <div style={{ padding: '9px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', background: 'var(--surface-2)' }}>
              <button className="btn btn-acc btn-sm" onClick={() => { setReplyTo(current); setForwardDoc(null); }}>↩ Reply</button>
              <button className="btn btn-sec btn-sm" onClick={() => { setForwardDoc(current); setReplyTo(null); }}>→ Forward</button>
              <button className="btn btn-sec btn-sm" onClick={() => handleArchive(current)}>Archive</button>
            </div>

            {/* Content area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {isEmbedDoc(current) ? (
                /* ── Embedded doc (contract / payslip / report) ── */
                <>
                  <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--line-2)', flexShrink: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.015em' }}>
                      {current.title ?? current.subject ?? 'Document'}
                    </div>
                    <table style={{ fontSize: 12, borderCollapse: 'collapse', color: 'var(--ink-2)', lineHeight: 1.8 }}>
                      <tbody>
                        <tr><td style={{ color: 'var(--ink-4)', paddingRight: 16, whiteSpace: 'nowrap' }}>From</td><td style={{ fontWeight: 500 }}>{current.sender ?? 'System'}</td></tr>
                        <tr><td style={{ color: 'var(--ink-4)' }}>To</td><td style={{ fontWeight: 500 }}>{recipientName(current)}</td></tr>
                        <tr><td style={{ color: 'var(--ink-4)' }}>Date</td><td>{new Date(current.created_at).toLocaleString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                        <tr><td style={{ color: 'var(--ink-4)' }}>Type</td><td><span className={`bdg ${TAG_COLORS[current.type ?? ''] ?? 'bdg-gy'}`}>{current.type ?? 'Document'}</span></td></tr>
                      </tbody>
                    </table>
                  </div>

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

                  {current.requires_signature && !current.is_signed && current.user_id === currentUserId && (
                    <div style={{ flexShrink: 0, padding: '18px 24px', borderTop: '2px solid var(--line)', background: 'var(--surface-2)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--ink)' }}>✍ Your signature is required</div>
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
                  /* ── Plain message — email thread ── */
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Subject */}
                    <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--line-2)', flexShrink: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 2, letterSpacing: '-0.015em' }}>
                        {current.title ?? current.subject ?? 'Message'}
                      </div>
                      {thread.length > 1 && (
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{thread.length} messages</div>
                      )}
                    </div>

                    {/* Thread messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {thread.map((msg, idx) => {
                        const isMe = msg.sender_id === currentUserId;
                        const isCurrent = msg.id === current.id;
                        const senderName = isMe ? currentUserName : (msg.sender ?? 'System');
                        const toName = allUsers.find((u: any) => u.id === msg.user_id)?.name ?? 'Unknown';
                        const isLast = idx === thread.length - 1;
                        return (
                          <div key={msg.id} style={{
                            border: `1px solid ${isCurrent ? 'var(--accent-line)' : 'var(--line)'}`,
                            borderRadius: 10,
                            overflow: 'hidden',
                            boxShadow: isLast ? '0 1px 6px rgba(0,0,0,0.05)' : 'none',
                          }}>
                            {/* Message header */}
                            <div style={{ padding: '10px 16px', background: isCurrent ? 'oklch(0.97 0.02 268)' : 'var(--surface-2)', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar name={senderName} size={28} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{isMe ? 'You' : senderName}</span>
                                  <span style={{ fontSize: 10.5, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                    {new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                                  <span style={{ marginRight: 6 }}>To: {toName}</span>
                                  {msg.type && msg.type !== 'Notice' && <span className={`bdg ${TAG_COLORS[msg.type] ?? 'bdg-gy'}`} style={{ fontSize: 9 }}>{msg.type}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Message body */}
                            <div style={{ padding: '14px 16px', fontSize: 13, lineHeight: 1.7, color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {msg.content ?? 'No content.'}
                            </div>

                            {/* Attachment */}
                            {msg.attachment_url && (
                              <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--line-2)', paddingTop: 10, background: 'var(--surface-2)', marginTop: 0 }}>
                                <span style={{ fontSize: 15 }}>📎</span>
                                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>{msg.attachment_name ?? 'Attachment'}</span>
                                <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="btn btn-sec btn-sm">Download</a>
                              </div>
                            )}

                            {/* Signature needed */}
                            {isCurrent && msg.requires_signature && !msg.is_signed && msg.user_id === currentUserId && (
                              <div style={{ padding: '14px 16px', background: 'var(--warn-soft)', borderTop: '1px solid oklch(0.88 0.08 75)' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.45 0.12 75)', marginBottom: 10 }}>✍ Signature required</div>
                                {signName && <div style={{ fontFamily: "'Brush Script MT','Apple Chancery',cursive", fontSize: 28, color: '#1a1f2e', marginBottom: 8 }}>{signName}</div>}
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <input className="fld-input" style={{ flex: 1 }} placeholder="Type your full name to sign…"
                                    value={signName} onChange={e => setSignName(e.target.value)} />
                                  <button className="btn btn-acc btn-sm" disabled={!signName.trim() || sigSaving} onClick={() => handleSign(current)}>
                                    {sigSaving ? 'Signing…' : 'Sign →'}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Signed confirmation */}
                            {isCurrent && msg.is_signed && (
                              <div style={{ padding: '10px 16px', background: 'var(--ok-soft)', borderTop: '1px solid oklch(0.85 0.08 155)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: 'oklch(0.42 0.12 155)' }}>✓</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.42 0.12 155)' }}>Signed</span>
                                <span style={{ fontFamily: "'Brush Script MT','Apple Chancery',cursive", fontSize: 20, color: '#1a1f2e', marginLeft: 4 }}>{msg.signed_by}</span>
                              </div>
                            )}

                            {/* Per-message reply button (only on non-own messages) */}
                            {!isMe && (
                              <div style={{ padding: '6px 12px 8px', borderTop: '1px solid var(--line-2)', background: 'transparent' }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: 11 }}
                                  onClick={() => { setReplyTo(msg); setForwardDoc(null); }}
                                >
                                  ↩ Reply
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Inline reply form */}
                    {replyTo && (
                      <div style={{ borderTop: '2px solid var(--accent-soft)', padding: '14px 24px', flexShrink: 0, background: 'white' }}>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 8, padding: '5px 10px', background: 'var(--surface-2)', borderRadius: 6, borderLeft: '2px solid var(--accent-line)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                );
              })()}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', background: 'var(--surface-2)', gap: 8, borderRadius: '0 12px 12px 0' }}>
            <div style={{ fontSize: 32 }}>✉</div>
            <div style={{ fontSize: 13 }}>Select a message to read</div>
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
                  {recipientUsers.map((u: any) => (
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
                  {recipientUsers.map((u: any) => (
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
