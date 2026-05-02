'use client';

import { useState, useRef } from 'react';
import { dbOp } from '@/utils/db';

type PlanDoc = {
  id?: string;
  title: string;
  content: string;
  doc_type: string;
  created_at?: string;
};

const DOC_TYPES = ['Strategy', 'Roadmap', 'Hiring Plan', 'Budget', 'OKRs', 'Policy Draft', 'Other'];

export default function PlanningClient({ initialDocuments }: { initialDocuments: PlanDoc[] }) {
  const [docs, setDocs] = useState<PlanDoc[]>(initialDocuments);
  const [selected, setSelected] = useState<PlanDoc | null>(initialDocuments[0] ?? null);
  const [showUpload, setShowUpload] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({ title: '', content: '', doc_type: 'Strategy' });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setForm(f => ({ ...f, content: text, title: f.title || file.name.replace(/\.[^.]+$/, '') }));
    };
    reader.readAsText(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const { data } = await dbOp('planning_documents', 'insert', {
      title: form.title,
      content: form.content,
      doc_type: form.doc_type,
    });
    if (data?.[0]) {
      setDocs(prev => [data[0], ...prev]);
      setSelected(data[0]);
    }
    setShowUpload(false);
    setForm({ title: '', content: '', doc_type: 'Strategy' });
    setSaving(false);
  };

  const handleDelete = async (doc: PlanDoc) => {
    if (!doc.id || !confirm(`Delete "${doc.title}"?`)) return;
    setDeleting(doc.id);
    await dbOp('planning_documents', 'delete', undefined, { id: doc.id });
    setDocs(prev => prev.filter(d => d.id !== doc.id));
    if (selected?.id === doc.id) setSelected(docs.find(d => d.id !== doc.id) ?? null);
    setDeleting(null);
  };

  const highlighted = (text: string) => {
    if (!search.trim()) return text;
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((p, i) =>
      p.toLowerCase() === search.toLowerCase()
        ? `<mark style="background:#fef08a;padding:0 2px;border-radius:2px">${p}</mark>`
        : p
    ).join('');
  };

  return (
    <div>
      <div className="pn-h" style={{ marginBottom: '20px' }}>
        <div className="pn-t">Strategic Planning Workspace</div>
        <button className="pv-btn pv-btn-pri" onClick={() => setShowUpload(true)}>+ Upload Document</button>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Document list */}
        <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {docs.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '12px', border: '1.5px dashed #e4e7eb', borderRadius: '8px' }}>
              No documents yet.<br />Upload your first plan above.
            </div>
          )}
          {docs.map(doc => (
            <div
              key={doc.id}
              onClick={() => setSelected(doc)}
              style={{
                padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                background: selected?.id === doc.id ? '#eef2ff' : '#fff',
                border: `1.5px solid ${selected?.id === doc.id ? '#c7d2fe' : '#e4e7eb'}`,
                transition: 'all 0.12s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: selected?.id === doc.id ? '#4338ca' : '#1a1f2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {doc.title}
                  </div>
                  <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '3px' }}>
                    {doc.doc_type} · {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Just now'}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(doc); }}
                  disabled={deleting === doc.id}
                  style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: '13px', padding: '0', flexShrink: 0 }}
                  title="Delete"
                >✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Document viewer */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #e4e7eb', borderRadius: '10px', display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
          {selected ? (
            <>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f2f5', background: '#f8fafc', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a1f2e' }}>{selected.title}</div>
                  <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '1px' }}>{selected.doc_type}</div>
                </div>
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search in document..."
                  style={{ fontSize: '12px', padding: '6px 10px', border: '1px solid #e4e7eb', borderRadius: '6px', width: '200px' }}
                />
              </div>
              <div
                style={{ flex: 1, padding: '24px', fontSize: '13px', lineHeight: 1.85, color: '#1a1f2e', whiteSpace: 'pre-wrap', overflowY: 'auto' }}
                dangerouslySetInnerHTML={{ __html: highlighted(selected.content) }}
              />
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '13px' }}>
              Select a document to read it here
            </div>
          )}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '28px', borderRadius: '14px', width: '560px', maxWidth: '100%' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '18px' }}>Upload Plan Document</div>
            <form onSubmit={handleSave}>
              <div className="pv-fld">
                <label>Document Type</label>
                <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Q3 Marketing Strategy"
                  required
                />
              </div>

              <div className="pv-fld">
                <label>Upload a text file <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional — .txt, .md, .csv)</span></label>
                <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json" style={{ display: 'none' }} onChange={handleFileRead} />
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => fileRef.current?.click()} style={{ width: '100%' }}>
                  📁 Choose file to import
                </button>
                {form.content && !showUpload && (
                  <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px' }}>File loaded · {form.content.length} characters</div>
                )}
              </div>

              <div className="pv-fld">
                <label>Content <span style={{ color: '#9ca3af', fontWeight: 400 }}>(paste or type directly)</span></label>
                <textarea
                  rows={8}
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Paste document content here, or upload a file above..."
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={saving || !form.title.trim() || !form.content.trim()}>
                  {saving ? 'Saving...' : 'Save Document'}
                </button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => { setShowUpload(false); setForm({ title: '', content: '', doc_type: 'Strategy' }); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
