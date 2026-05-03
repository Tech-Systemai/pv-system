'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const NOTE_TYPES = ['Meeting Note', 'Vision', 'Follow-up', 'Ideas', 'Action Items', 'Policy Note', 'General'];

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  'Meeting Note': { bg: '#eef2ff', color: '#4f46e5' },
  'Vision':       { bg: '#f0fdf4', color: '#16a34a' },
  'Follow-up':    { bg: '#fef3c7', color: '#b45309' },
  'Ideas':        { bg: '#fdf4ff', color: '#9333ea' },
  'Action Items': { bg: '#fee2e2', color: '#dc2626' },
  'Policy Note':  { bg: '#f0f9ff', color: '#0369a1' },
  'General':      { bg: '#f5f6f8', color: '#6b7689' },
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
      if (!error) {
        setNotes(prev => prev.map(n => n.id === editNote.id ? { ...n, title: formTitle, content: formContent, type: formType } : n));
      }
    } else {
      const { data } = await dbOp('notes', 'insert', {
        user_id: currentUserId,
        title: formTitle,
        content: formContent,
        type: formType,
      });
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
    <>
      <div className="pn-h" style={{ marginBottom: '14px' }}>
        <div>
          <div className="pn-t">Notes</div>
          <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>{notes.length} saved</div>
        </div>
        <button className="pv-btn pv-btn-pri" onClick={openCreate}>+ New Note</button>
      </div>

      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {['All', ...NOTE_TYPES].map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            style={{
              padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: filterType === t ? '#4f46e5' : '#f5f6f8',
              color: filterType === t ? '#fff' : '#6b7689',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Notes grid */}
      {filtered.length === 0 && (
        <div className="pn">
          <div className="empty">No notes yet. Click "+ New Note" to create your first note.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
        {filtered.map(note => {
          const colors = TYPE_COLORS[note.type] ?? TYPE_COLORS['General'];
          return (
            <div
              key={note.id}
              onClick={() => openEdit(note)}
              style={{
                background: '#fff',
                border: '1px solid #e4e7eb',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s',
                position: 'relative',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: colors.bg, color: colors.color, padding: '3px 8px', borderRadius: '20px' }}>
                  {note.type ?? 'General'}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(note.id); }}
                  disabled={deleting === note.id}
                  style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: '14px', padding: '2px', lineHeight: 1 }}
                  title="Delete note"
                >
                  ✕
                </button>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1f2e', marginBottom: '8px', lineHeight: 1.3 }}>
                {note.title}
              </div>
              {note.content && (
                <div style={{ fontSize: '12px', color: '#6b7689', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {note.content}
                </div>
              )}
              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '12px' }}>
                {new Date(note.updated_at ?? note.created_at).toLocaleDateString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '560px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>
              {editNote ? 'Edit Note' : 'New Note'}
            </div>

            <div className="pv-fld">
              <label>Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Note title..."
                autoFocus
              />
            </div>

            <div className="pv-fld">
              <label>Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value)}>
                {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="pv-fld">
              <label>Content</label>
              <textarea
                rows={10}
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                placeholder="Write your note here..."
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="pv-btn pv-btn-pri" onClick={handleSave} disabled={saving || !formTitle.trim()}>
                {saving ? 'Saving...' : editNote ? 'Update Note' : 'Save Note'}
              </button>
              <button className="pv-btn pv-btn-sec" onClick={() => setIsModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
