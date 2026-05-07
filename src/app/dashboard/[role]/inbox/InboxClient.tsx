'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const TAG_COLORS: Record<string, string> = {
  Finance: 'bdg-warn', HR: 'bdg-acc', Audit: 'bdg-gy', Planning: 'bdg-acc',
  CX: 'bdg-ok', Notice: 'bdg-acc', Payslip: 'bdg-ok', Contract: 'bdg-acc',
  Report: 'bdg-gy', Warning: 'bdg-err', 'Action Plan': 'bdg-warn',
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
  const [sel, setSel] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [signName, setSignName] = useState('');

  const handleOpen = async (idx: number, doc: any) => {
    setSel(idx);
    setSignName('');
    if (!doc.is_read) {
      await dbOp('inbox_documents', 'update', { is_read: true }, { id: doc.id });
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_read: true } : d));
    }
  };

  const handleArchive = async (doc: any) => {
    await dbOp('inbox_documents', 'update', { archived: true }, { id: doc.id });
    setDocs(prev => prev.filter(d => d.id !== doc.id));
    setSel(0);
  };

  const handleSign = async (doc: any) => {
    if (!signName.trim()) return;
    await dbOp('inbox_documents', 'update', { is_signed: true, signed_by: signName }, { id: doc.id });
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_signed: true } : d));
  };

  const handleCompose = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    const fd = new FormData(e.currentTarget);
    const sender = allUsers.find((u: any) => u.id === currentUserId)?.name ?? 'Management';
    const { data } = await dbOp('inbox_documents', 'insert', {
      user_id: fd.get('to') as string,
      title: fd.get('subject') as string,
      content: fd.get('message') as string,
      type: fd.get('type') as string,
      sender,
      requires_signature: fd.get('req_sig') === 'on',
    });
    if (data?.[0]) setDocs(prev => [data[0], ...prev]);
    setComposeOpen(false);
    setSending(false);
    (e.target as HTMLFormElement).reset();
  };

  const unread = docs.filter(d => !d.is_read).length;
  const current = docs[sel];

  return (
    <div className="page-fade">
      <div className="card" style={{ height: 580, padding: 0, display: 'grid', gridTemplateColumns: '320px 1fr', overflow: 'hidden' }}>

        {/* ── Left panel ── */}
        <div style={{ borderRight: '1px solid var(--line)', overflowY: 'auto', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Inbox</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {unread > 0 && <span className="bdg bdg-acc">{unread} unread</span>}
              {isMgmt && <button className="btn btn-acc btn-sm" onClick={() => setComposeOpen(true)}>+ Compose</button>}
            </div>
          </div>

          {docs.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              Your inbox is empty
            </div>
          )}

          {docs.map((doc, i) => (
            <div key={doc.id} onClick={() => handleOpen(i, doc)} style={{
              padding: '13px 16px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer',
              background: i === sel ? 'var(--accent-soft)' : (!doc.is_read ? 'oklch(0.99 0.012 268)' : 'transparent'),
              borderLeft: i === sel ? '3px solid var(--accent)' : '3px solid transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12.5, fontWeight: !doc.is_read ? 600 : 500, color: 'var(--ink)' }}>{doc.sender ?? 'System'}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-4)' }}>
                  {new Date(doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: !doc.is_read ? 600 : 500, color: 'var(--ink)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.title ?? doc.subject ?? 'Document'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.content?.slice(0, 60) ?? '—'}
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <span className={`bdg ${TAG_COLORS[doc.type] ?? 'bdg-gy'}`}>{doc.type ?? 'DOC'}</span>
                {doc.requires_signature && !doc.is_signed && <span className="bdg bdg-warn">Needs signature</span>}
                {doc.is_signed && <span className="bdg bdg-ok">Signed</span>}
              </div>
            </div>
          ))}
        </div>

        {/* ── Right reading pane ── */}
        {current ? (
          <div style={{ padding: '24px 28px', overflowY: 'auto', background: 'white', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexShrink: 0 }}>
              <button className="btn btn-pri btn-sm">Reply</button>
              <button className="btn btn-sec btn-sm">Forward</button>
              <button className="btn btn-sec btn-sm" onClick={() => handleArchive(current)}>Archive</button>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>···</button>
            </div>

            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.018em', marginBottom: 10 }}>
              {current.title ?? current.subject ?? 'Document'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 18, borderBottom: '1px solid var(--line-2)', flexShrink: 0 }}>
              <Avatar name={current.sender ?? 'System'} size={34} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{current.sender ?? 'System'}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                  {new Date(current.created_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · to me
                </div>
              </div>
              <span className={`bdg ${TAG_COLORS[current.type] ?? 'bdg-gy'}`} style={{ marginLeft: 'auto' }}>
                {current.type ?? 'DOC'}
              </span>
            </div>

            <div style={{ padding: '18px 0', fontSize: 14, lineHeight: 1.65, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', flex: 1 }}>
              {current.content ?? 'No content.'}
            </div>

            {current.requires_signature && !current.is_signed && (
              <div style={{ background: 'var(--warn-soft)', padding: 14, borderRadius: 9, border: '1px solid oklch(0.85 0.08 75)', marginTop: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'oklch(0.45 0.12 75)', marginBottom: 10 }}>
                  Signature Required
                </div>
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
              <div style={{ background: 'var(--ok-soft)', padding: '10px 14px', borderRadius: 8, fontSize: 12, color: 'oklch(0.42 0.12 155)', fontWeight: 600, marginTop: 8, border: '1px solid oklch(0.85 0.08 155)' }}>
                ✓ Signed by {current.signed_by}
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
        <div className="mb">
          <div className="md" style={{ width: 520 }}>
            <div className="md-t">Compose Message</div>
            <form onSubmit={handleCompose}>
              <div className="pv-fld">
                <label>To</label>
                <select name="to" required>
                  <option value="">— Select employee —</option>
                  {allUsers.filter((u: any) => u.id !== currentUserId).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="pv-fld">
                <label>Subject</label>
                <input type="text" name="subject" placeholder="e.g. Performance Notice — May 2026" required />
              </div>
              <div className="pv-fld">
                <label>Type</label>
                <select name="type">
                  <option value="Notice">Notice</option>
                  <option value="Payslip">Payslip</option>
                  {isMgmt && <><option value="Contract">Contract</option><option value="Report">Report</option><option value="Warning">Warning</option><option value="Action Plan">Action Plan</option></>}
                </select>
              </div>
              <div className="pv-fld">
                <label>Message</label>
                <textarea name="message" rows={5} placeholder="Document body…" required style={{ resize: 'vertical' }} />
              </div>
              <label className="chk" style={{ marginBottom: 16 }}>
                <input type="checkbox" name="req_sig" /> Require recipient signature
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
                <button type="button" className="btn btn-sec" onClick={() => setComposeOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
