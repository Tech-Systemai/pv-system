'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const NOTE_TYPES = ['Meeting Note', 'Vision', 'Follow-up', 'Ideas', 'Action Items', 'Policy Note', 'General'];

const TYPE_HUES: Record<string, number> = {
  'Meeting Note': 268,
  'Vision': 145,
  'Follow-up': 75,
  'Ideas': 290,
  'Action Items': 25,
  'Policy Note': 200,
  'General': 220,
};

export default function NotesClient({
  initialNotes,
  currentUserId,
}: {
  initialNotes: any[];
  currentUserId: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [filterType, setFilterType] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editNote, setEditNote] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState('General');

  const filtered = filterType === 'All' ? notes : notes.filter(n => n.type === filterType);

  const openCreate = () => {
    setEditNote(null);
    setFormTitle('');
    setFormContent('');
    setFormType('General');
    setIsModalOpen(true);
  };

  const openEdit = (note: any) => {
    setEditNote(note);
    setFormTitle(note.title ?? '');
    setFormContent(note.content ?? '');
    setFormType(note.type ?? 'General');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);
    if (editNote) {
      const { error } = await dbOp('notes', 'update', { title: formTitle, content: formContent, type: formType, updated_at: new Date().toISOString() }, { id: editNote.id });
      if (!error) setNotes(prev => prev.map(n => n.id === editNote.id ? { ...n, title: formTitle, content: formContent, type: formType } : n));
    } else {
      const { data } = await dbOp('notes', 'insert', { user_id: currentUserId, title: formTitle, content: formContent, type: formType });
      if (data?.[0]) setNotes(prev => [data[0], ...prev]);
    }
    setSaving(false);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await dbOp('notes', 'delete', undefined, { id });
    setNotes(prev => prev.filter(n => n.id !== id));
    setDeleting(null);
  };

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📝</div></div>
          <div className="stat-l">TOTAL NOTES</div>
          <div className="stat-v">{notes.length}</div>
          <div className="stat-foot">Your workspace</div>
        </div>
        {['Meeting Note', 'Follow-up', 'Action Items'].map(t => {
          const count = notes.filter(n => n.type === t).length;
          const hue = TYPE_HUES[t] ?? 268;
          return (
            <div key={t} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setFilterType(t)}>
              <div className="stat-h">
                <div className="stat-ico" style={{ background: `oklch(0.93 0.05 ${hue})`, color: `oklch(0.40 0.14 ${hue})` }}>◈</div>
              </div>
              <div className="stat-l">{t.toUpperCase()}</div>
              <div className="stat-v" style={{ color: `oklch(0.40 0.14 ${hue})` }}>{count}</div>
              <div className="stat-foot">Click to filter</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">My Notes</div>
            <div className="card-sub">{notes.length} saved · {filtered.length} showing</div>
          </div>
          <button className="btn btn-acc btn-sm" onClick={openCreate}>+ New Note</button>
        </div>

        {/* Type filter chips */}
        <div style={{ padding: '0 18px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['All', ...NOTE_TYPES].map(t => {
            const hue = TYPE_HUES[t] ?? 220;
            const isActive = filterType === t;
            return (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all .12s',
                  background: isActive ? `oklch(0.52 0.20 ${hue})` : `oklch(0.95 0.04 ${hue})`,
                  color: isActive ? '#fff' : `oklch(0.40 0.14 ${hue})`,
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <div className="card">
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No notes yet. Click "+ New Note" to get started.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(note => {
            const hue = TYPE_HUES[note.type] ?? 220;
            return (
              <div
                key={note.id}
                onClick={() => openEdit(note)}
                style={{
                  background: `linear-gradient(160deg, oklch(0.97 0.03 ${hue}), oklch(0.99 0.01 ${hue + 20}))`,
                  border: `1px solid oklch(0.90 0.05 ${hue})`,
                  borderRadius: 14, padding: '18px 16px', cursor: 'pointer',
                  transition: 'transform .12s, box-shadow .12s',
                  position: 'relative',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: `oklch(0.88 0.08 ${hue})`, color: `oklch(0.35 0.14 ${hue})`, padding: '3px 8px', borderRadius: 20 }}>
                    {note.type ?? 'General'}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(note.id); }}
                    disabled={deleting === note.id}
                    style={{ background: 'none', border: 'none', color: `oklch(0.75 0.06 ${hue})`, cursor: 'pointer', fontSize: 14, padding: '2px', lineHeight: 1 }}
                  >✕</button>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: `oklch(0.25 0.10 ${hue})`, marginBottom: 8, lineHeight: 1.3 }}>
                  {note.title}
                </div>
                {note.content && (
                  <div style={{ fontSize: 12, color: `oklch(0.45 0.08 ${hue})`, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
                    {note.content}
                  </div>
                )}
                <div style={{ fontSize: 10, color: `oklch(0.65 0.06 ${hue})`, marginTop: 12 }}>
                  {new Date(note.updated_at ?? note.created_at).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {isModalOpen && (
        <div className="mb">
          <div className="md" style={{ width: 560, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="md-t">{editNote ? 'Edit Note' : 'New Note'}</div>
            <div className="pv-fld">
              <label>Title</label>
              <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Note title…" autoFocus />
            </div>
            <div className="pv-fld">
              <label>Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value)}>
                {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="pv-fld">
              <label>Content</label>
              <textarea rows={10} value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Write your note here…" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" onClick={handleSave} disabled={saving || !formTitle.trim()}>
                {saving ? 'Saving…' : editNote ? 'Update Note' : 'Save Note'}
              </button>
              <button className="btn btn-sec" onClick={() => setIsModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
