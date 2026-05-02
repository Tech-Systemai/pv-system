'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

export default function InboxClient({
  initialDocs,
  allUsers,
  currentUserId,
  isMgmt,
}: {
  initialDocs: any[];
  allUsers: any[];
  currentUserId: string;
  isMgmt: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'signature'>('all');
  const [docs, setDocs] = useState(initialDocs);
  const [composeOpen, setComposeOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [signName, setSignName] = useState('');

  const filteredDocs = docs.filter(d => {
    if (filter === 'unread') return !d.is_read;
    if (filter === 'signature') return d.requires_signature && !d.is_signed;
    return true;
  });

  const handleOpenDoc = async (doc: any) => {
    setViewDoc(doc);
    setSignName('');
    if (!doc.is_read) {
      await dbOp('inbox_documents', 'update', { is_read: true }, { id: doc.id });
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_read: true } : d));
    }
  };

  const handleSign = async () => {
    if (!signName.trim() || !viewDoc) return;
    await dbOp('inbox_documents', 'update', { is_signed: true, signed_by: signName }, { id: viewDoc.id });
    setDocs(prev => prev.map(d => d.id === viewDoc.id ? { ...d, is_signed: true } : d));
    setViewDoc(null);
  };

  const handleCompose = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    const fd = new FormData(e.currentTarget);
    const sender = allUsers.find(u => u.id === currentUserId)?.name ?? 'Management';
    const payload = {
      user_id: fd.get('to') as string,
      title: fd.get('subject') as string,
      content: fd.get('message') as string,
      type: fd.get('type') as string,
      sender,
      requires_signature: fd.get('req_sig') === 'on',
    };
    const { data } = await dbOp('inbox_documents', 'insert', payload);
    if (data?.[0]) setDocs(prev => [data[0], ...prev]);
    setComposeOpen(false);
    setSending(false);
    (e.target as HTMLFormElement).reset();
  };

  const docTitle = (doc: any) => doc.title ?? doc.subject ?? 'Document';
  const docType = (doc: any) => doc.type ?? 'DOC';

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '14px' }}>
        <div className="pn-t">Inbox</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isMgmt && (
            <button className="pv-btn pv-btn-pri" onClick={() => setComposeOpen(true)}>+ Compose</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        {(['all', 'unread', 'signature'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: filter === f ? '#4f46e5' : '#f5f6f8',
              color: filter === f ? '#fff' : '#6b7689',
            }}
          >
            {f === 'all' ? `All (${docs.length})` : f === 'unread' ? `Unread (${docs.filter(d => !d.is_read).length})` : `Needs Signature (${docs.filter(d => d.requires_signature && !d.is_signed).length})`}
          </button>
        ))}
      </div>

      <div className="pn" style={{ padding: 0 }}>
        {filteredDocs.length === 0 && <div className="empty" style={{ padding: '40px' }}>Inbox is empty.</div>}
        {filteredDocs.map(doc => (
          <div
            key={doc.id}
            onClick={() => handleOpenDoc(doc)}
            style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: !doc.is_read ? '#fafbff' : '#fff', borderBottom: '1px solid #f0f2f5' }}
          >
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#4f46e5', textAlign: 'center', lineHeight: 1.2 }}>
              {docType(doc).slice(0, 4)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: !doc.is_read ? 700 : 500, color: '#1a1f2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {docTitle(doc)}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>
                {doc.sender ? `From ${doc.sender}` : 'System'} · {new Date(doc.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {doc.requires_signature && !doc.is_signed && <span className="pv-bdg pv-bdg-amber">Sign required</span>}
              {doc.is_signed && <span className="pv-bdg pv-bdg-green">Signed</span>}
              {!doc.is_read && <span className="pv-bdg pv-bdg-indigo">New</span>}
            </div>
          </div>
        ))}
      </div>

      {/* View document modal */}
      {viewDoc && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '560px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>{docTitle(viewDoc)}</div>
            <div style={{ background: '#f5f6f8', padding: '10px 13px', borderRadius: '7px', marginBottom: '14px', fontSize: '11.5px', color: '#4a5568' }}>
              <div><strong>From:</strong> {viewDoc.sender ?? 'System'}</div>
              <div><strong>Type:</strong> {docType(viewDoc)}</div>
              <div><strong>Received:</strong> {new Date(viewDoc.created_at).toLocaleString()}</div>
            </div>

            {viewDoc.content && (
              <div style={{ background: '#fafbff', padding: '16px', borderRadius: '8px', border: '1px solid #e4e7eb', fontSize: '13px', lineHeight: 1.8, color: '#1a1f2e', marginBottom: '14px', whiteSpace: 'pre-wrap' }}>
                {viewDoc.content}
              </div>
            )}

            {viewDoc.requires_signature && !viewDoc.is_signed && (
              <div style={{ background: '#fef3c7', padding: '14px', borderRadius: '8px', marginBottom: '14px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#b45309', marginBottom: '10px' }}>Signature Required</div>
                <div className="pv-fld" style={{ margin: 0 }}>
                  <label>Type your full name to sign</label>
                  <input type="text" value={signName} onChange={e => setSignName(e.target.value)} placeholder="Full name..." />
                </div>
              </div>
            )}

            {viewDoc.is_signed && (
              <div style={{ background: '#ecfdf5', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: '#047857', fontWeight: 600, marginBottom: '14px' }}>
                ✓ Signed by {viewDoc.signed_by}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              {viewDoc.requires_signature && !viewDoc.is_signed && (
                <button className="pv-btn pv-btn-pri" onClick={handleSign} disabled={!signName.trim()}>
                  Sign & Acknowledge
                </button>
              )}
              <button className="pv-btn pv-btn-sec" onClick={() => setViewDoc(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Compose modal */}
      {composeOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '520px', maxWidth: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Compose Document</div>
            <form onSubmit={handleCompose}>
              <div className="pv-fld">
                <label>To</label>
                <select name="to" required>
                  <option value="">— Select employee —</option>
                  {allUsers.filter(u => u.id !== currentUserId).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="pv-fld">
                <label>Subject / Title</label>
                <input type="text" name="subject" placeholder="e.g. Performance Notice — April 2026" required />
              </div>
              <div className="pv-fld">
                <label>Document Type</label>
                <select name="type">
                  <option value="Notice">Notice</option>
                  <option value="Payslip">Payslip</option>
                  <option value="Contract">Contract</option>
                  <option value="Report">Report</option>
                  <option value="Warning">Warning</option>
                </select>
              </div>
              <div className="pv-fld">
                <label>Message / Content</label>
                <textarea name="message" rows={5} placeholder="Document body..." required />
              </div>
              <div className="pv-fld">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" name="req_sig" style={{ width: '15px', height: '15px' }} />
                  Require recipient signature
                </label>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={sending}>{sending ? 'Sending...' : 'Send'}</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setComposeOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
