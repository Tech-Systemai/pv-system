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

const DOC_HUES: Record<string, number> = {
  Strategy: 268, Roadmap: 220, 'Hiring Plan': 145, Budget: 75, OKRs: 25, 'Policy Draft': 200, Other: 155,
};

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

  const totalDocs = docs.length;
  const strategies = docs.filter(d => d.doc_type === 'Strategy').length;
  const roadmaps = docs.filter(d => d.doc_type === 'Roadmap').length;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recent = docs.filter(d => d.created_at && d.created_at > sevenDaysAgo).length;

  return (
    <div className="page-fade">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📋</div></div>
          <div className="stat-l">TOTAL DOCUMENTS</div>
          <div className="stat-v">{totalDocs}</div>
          <div className="stat-foot">Planning workspace</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico" style={{ background: 'oklch(0.93 0.05 268)', color: 'oklch(0.40 0.14 268)' }}>◈</div></div>
          <div className="stat-l">STRATEGIES</div>
          <div className="stat-v">{strategies}</div>
          <div className="stat-foot">Strategic plans</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico" style={{ background: 'oklch(0.93 0.05 220)', color: 'oklch(0.40 0.14 220)' }}>◈</div></div>
          <div className="stat-l">ROADMAPS</div>
          <div className="stat-v">{roadmaps}</div>
          <div className="stat-foot">Project roadmaps</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">↑</div></div>
          <div className="stat-l">RECENT</div>
          <div className="stat-v">{recent}</div>
          <div className="stat-foot">Added this week</div>
        </div>
      </div>

      <div className="briefing" style={{ marginBottom: 20 }}>
        <div>
          <div className="card-title">Strategic Planning Workspace</div>
          <div className="card-sub">{totalDocs} document{totalDocs !== 1 ? 's' : ''} in your workspace</div>
        </div>
        <div className="briefing-actions">
          <button className="btn btn-acc" onClick={() => setShowUpload(true)}>+ Upload Document</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Document list */}
        <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {docs.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12, border: '1.5px dashed var(--line)', borderRadius: 8 }}>
              No documents yet.<br />Upload your first plan above.
            </div>
          )}
          {docs.map(doc => {
            const hue = DOC_HUES[doc.doc_type] ?? 268;
            return (
              <div key={doc.id} onClick={() => setSelected(doc)} style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                background: selected?.id === doc.id ? `oklch(0.94 0.04 ${hue})` : 'var(--surface)',
                border: `1.5px solid ${selected?.id === doc.id ? `oklch(0.85 0.08 ${hue})` : 'var(--line)'}`,
                transition: 'all 0.12s',
                boxShadow: selected?.id === doc.id ? 'var(--sh-1)' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: selected?.id === doc.id ? `oklch(0.35 0.14 ${hue})` : 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 3 }}>
                      {doc.doc_type} · {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Just now'}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleDelete(doc); }} disabled={deleting === doc.id} style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 13, padding: 0, flexShrink: 0, opacity: 0.5 }} title="Delete">✕</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Document viewer */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 500 }}>
          {selected ? (
            <>
              <div className="card-hdr">
                <div>
                  <div className="card-title">{selected.title}</div>
                  <div className="card-sub">{selected.doc_type}</div>
                </div>
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search in document…" style={{ fontSize: 12, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, width: 200, background: 'var(--surface-2)', color: 'var(--ink)' }} />
              </div>
              <div style={{ flex: 1, padding: '24px', fontSize: 13, lineHeight: 1.85, color: 'var(--ink)', whiteSpace: 'pre-wrap', overflowY: 'auto' }}
                dangerouslySetInnerHTML={{ __html: highlighted(selected.content) }} />
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              Select a document to read it here
            </div>
          )}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="mb" onClick={() => setShowUpload(false)}>
          <div className="md" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="md-t">Upload Plan Document</div>
            <form onSubmit={handleSave}>
              <div className="pv-fld">
                <label>Document Type</label>
                <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Title</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Q3 Marketing Strategy" required />
              </div>
              <div className="pv-fld">
                <label>Upload a text file <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional — .txt, .md, .csv)</span></label>
                <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json" style={{ display: 'none' }} onChange={handleFileRead} />
                <button type="button" className="btn btn-sec" onClick={() => fileRef.current?.click()} style={{ width: '100%' }}>
                  📁 Choose file to import
                </button>
                {form.content && (
                  <div style={{ fontSize: 11, color: 'var(--ok)', marginTop: 4 }}>File loaded · {form.content.length} characters</div>
                )}
              </div>
              <div className="pv-fld">
                <label>Content <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(paste or type directly)</span></label>
                <textarea rows={8} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Paste document content here, or upload a file above…" required />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={saving || !form.title.trim() || !form.content.trim()}>
                  {saving ? 'Saving…' : 'Save Document'}
                </button>
                <button type="button" className="btn btn-sec" onClick={() => { setShowUpload(false); setForm({ title: '', content: '', doc_type: 'Strategy' }); }}>
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
