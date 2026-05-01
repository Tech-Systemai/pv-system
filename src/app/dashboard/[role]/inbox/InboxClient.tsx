'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function InboxClient({ initialDocs, allUsers, currentUserId }: { initialDocs: any[], allUsers: any[], currentUserId: string }) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'signature'>('all');
  const [docs, setDocs] = useState(initialDocs);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<any>(null);
  
  const supabase = createClient();

  const filteredDocs = docs.filter(d => {
    if (filter === 'unread') return !d.is_read;
    if (filter === 'signature') return d.requires_signature && !d.is_signed;
    return true;
  });

  const handleOpenDoc = async (doc: any) => {
    setViewDoc(doc);
    if (!doc.is_read) {
      // Mark as read in DB
      await supabase.from('inbox_documents').update({ is_read: true }).eq('id', doc.id);
      setDocs(docs.map(d => d.id === doc.id ? { ...d, is_read: true } : d));
    }
  };

  const handleSignDoc = async (docId: string) => {
    await supabase.from('inbox_documents').update({ is_signed: true }).eq('id', docId);
    setDocs(docs.map(d => d.id === docId ? { ...d, is_signed: true } : d));
    setViewDoc(null);
  };

  const handleCompose = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const toId = formData.get('to') as string;
    const subject = formData.get('subject') as string;
    const type = formData.get('type') as string;
    const reqSig = formData.get('req_sig') === 'on';

    const sender = allUsers.find(u => u.id === currentUserId)?.name || 'System';

    await supabase.from('inbox_documents').insert({
      user_id: toId,
      sender: sender,
      subject: subject,
      type: type,
      requires_signature: reqSig
    });

    setComposeModalOpen(false);
    // Show toast ideally here
  };

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '14px' }}>
        <div></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="pv-btn pv-btn-sec">Filter</button>
          <button className="pv-btn pv-btn-pri" onClick={() => setComposeModalOpen(true)}>+ Compose</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All ({docs.length})</button>
        <button className={`tab ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>Unread ({docs.filter(d => !d.is_read).length})</button>
        <button className={`tab ${filter === 'signature' ? 'active' : ''}`} onClick={() => setFilter('signature')}>Awaiting signature ({docs.filter(d => d.requires_signature && !d.is_signed).length})</button>
      </div>

      <div className="pn" style={{ padding: 0 }}>
        {filteredDocs.length === 0 && <div className="empty" style={{ padding: '40px' }}>Inbox is empty.</div>}
        {filteredDocs.map(i => (
          <div key={i.id} className="pv-row-card" style={{ margin: 0, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', background: !i.is_read ? '#fafbff' : '#fff', cursor: 'pointer' }} onClick={() => handleOpenDoc(i)}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fontWeight: 700, color: '#4f46e5' }}>{i.type}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12.5px', fontWeight: !i.is_read ? 700 : 500 }}>{i.subject}</div>
              <div style={{ fontSize: '10.5px', color: '#6b7689' }}>From {i.sender}</div>
            </div>
            {i.requires_signature && !i.is_signed && <span className="pv-bdg pv-bdg-amber">Signature required</span>}
            {!i.is_read && <span className="pv-bdg pv-bdg-indigo">New</span>}
            <div style={{ fontSize: '10.5px', color: '#9fa8be', fontFamily: "'JetBrains Mono', monospace" }}>{new Date(i.created_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>

      {viewDoc && (
        <div className="mb" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="md" style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '520px', maxWidth: '100%' }}>
            <div className="md-t" style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>{viewDoc.subject}</div>
            <div style={{ background: '#f5f6f8', padding: '11px 13px', borderRadius: '8px', marginBottom: '12px', fontSize: '11.5px' }}>
              <div><strong>From:</strong> {viewDoc.sender}</div>
              <div><strong>Type:</strong> {viewDoc.type}</div>
              <div><strong>Received:</strong> {new Date(viewDoc.created_at).toLocaleString()}</div>
            </div>
            <div style={{ background: '#fafbff', padding: '30px', textAlign: 'center', borderRadius: '8px', border: '1px dashed #cbd2e0', color: '#6b7689', fontSize: '11.5px', marginBottom: '14px' }}>
              📄 PDF preview · Full document loaded
            </div>
            
            {viewDoc.requires_signature && !viewDoc.is_signed && (
              <div style={{ background: '#fef3c7', padding: '13px', borderRadius: '8px', marginBottom: '14px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#b45309', marginBottom: '8px' }}>⚠ Signature required</div>
                <div className="pv-fld"><label>Type your full name to sign</label><input type="text" placeholder="Your full name" /></div>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {viewDoc.requires_signature && !viewDoc.is_signed && (
                <button className="pv-btn pv-btn-pri" onClick={() => handleSignDoc(viewDoc.id)}>Sign & Return</button>
              )}
              <button className="pv-btn pv-btn-sec" onClick={() => setViewDoc(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {composeModalOpen && (
        <div className="mb" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="md" style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '520px', maxWidth: '100%' }}>
            <div className="md-t" style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Compose message</div>
            <form onSubmit={handleCompose}>
              <div className="pv-fld">
                <label>To</label>
                <select name="to" required>
                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Subject</label>
                <input type="text" name="subject" required />
              </div>
              <div className="pv-fld">
                <label>Type / Attachment</label>
                <select name="type">
                  <option value="PDF">Standard PDF</option>
                  <option value="REPORT">Performance Report</option>
                  <option value="CONTRACT">Contract PDF</option>
                  <option value="PAYSLIP">Payslip</option>
                </select>
              </div>
              <div className="pv-fld">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <input type="checkbox" name="req_sig" style={{ width: 'auto' }} />
                  Recipient must sign and return
                </label>
              </div>
              <div className="pv-fld">
                <label>Message</label>
                <textarea rows={4}></textarea>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri">Send</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setComposeModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
