'use client';

import { useState, useRef } from 'react';
import { dbOp } from '@/utils/db';

const FILE_ICONS: Record<string, string> = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
  ppt: '📙', pptx: '📙', zip: '📦', txt: '📝', csv: '📊', mp4: '🎬',
};
function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICONS[ext] ?? '📄';
}
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentRow({ a, onRemove }: { a: any; onRemove?: () => void }) {
  const isImage = a.type?.startsWith('image/');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)', marginBottom: 6 }}>
      {isImage
        ? <img src={a.dataUrl} alt={a.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
        : <span style={{ fontSize: 20, flexShrink: 0 }}>{getFileIcon(a.name)}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
        <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{formatSize(a.size)}</div>
      </div>
      {a.dataUrl && (
        <a href={a.dataUrl} download={a.name} onClick={e => e.stopPropagation()}
          style={{ fontSize: 11, color: 'var(--accent-ink)', textDecoration: 'none', padding: '3px 8px', background: 'var(--accent-soft)', borderRadius: 6, fontWeight: 600, flexShrink: 0 }}>
          ↓
        </a>
      )}
      {onRemove && (
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--err)', cursor: 'pointer', fontSize: 14, padding: '2px', flexShrink: 0 }}>✕</button>
      )}
    </div>
  );
}

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
  sharedNotes,
  users,
  currentUserId,
}: {
  initialNotes: any[];
  sharedNotes: any[];
  users: any[];
  currentUserId: string;
}) {
  const [notes,      setNotes]      = useState(initialNotes);
  const [filterType, setFilterType] = useState<string>('All');
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editNote,     setEditNote]     = useState<any>(null);
  const [viewShared,   setViewShared]   = useState<any>(null);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState('');
  const [deleting,     setDeleting]     = useState<string | null>(null);
  const [formTitle,    setFormTitle]    = useState('');
  const [formContent,  setFormContent]  = useState('');
  const [formType,     setFormType]     = useState('General');
  const [formSharedWith, setFormSharedWith] = useState<string[]>([]);
  const [formAttachments, setFormAttachments] = useState<any[]>([]);
  const [userSearch,   setUserSearch]   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      if (file.size > 10 * 1024 * 1024) { alert(`"${file.name}" exceeds 10 MB limit.`); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        setFormAttachments(prev => [...prev, {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: ev.target?.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const filtered = filterType === 'All' ? notes : notes.filter(n => n.type === filterType);

  const openCreate = () => {
    setEditNote(null);
    setFormTitle('');
    setFormContent('');
    setFormType('General');
    setFormSharedWith([]);
    setFormAttachments([]);
    setUserSearch('');
    setSaveError('');
    setIsModalOpen(true);
  };

  const openEdit = (note: any) => {
    setEditNote(note);
    setFormTitle(note.title ?? '');
    setFormContent(note.content ?? '');
    setFormType(note.type ?? 'General');
    setFormSharedWith(note.shared_with ?? []);
    setFormAttachments(note.attachments ?? []);
    setUserSearch('');
    setSaveError('');
    setIsModalOpen(true);
  };

  const toggleShareUser = (userId: string) => {
    setFormSharedWith(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);
    setSaveError('');
    if (editNote) {
      const { error } = await dbOp('notes', 'update',
        { title: formTitle, content: formContent, type: formType, shared_with: formSharedWith, attachments: formAttachments, updated_at: new Date().toISOString() },
        { id: editNote.id }
      );
      if (error) { setSaveError(error); setSaving(false); return; }
      setNotes(prev => prev.map(n =>
        n.id === editNote.id ? { ...n, title: formTitle, content: formContent, type: formType, shared_with: formSharedWith, attachments: formAttachments } : n
      ));
    } else {
      const { data, error } = await dbOp('notes', 'insert',
        { user_id: currentUserId, title: formTitle, content: formContent, type: formType, shared_with: formSharedWith, attachments: formAttachments }
      );
      if (error) { setSaveError(error); setSaving(false); return; }
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

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role?.toLowerCase().includes(userSearch.toLowerCase())
  );

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

      {/* My notes grid */}
      {filtered.length === 0 ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No notes yet. Click "+ New Note" to get started.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
          {filtered.map(note => {
            const hue = TYPE_HUES[note.type] ?? 220;
            const shareCount = (note.shared_with ?? []).length;
            const sharedNames = (note.shared_with ?? [])
              .map((id: string) => users.find(u => u.id === id)?.name)
              .filter(Boolean);
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
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ fontSize: 10, color: `oklch(0.65 0.06 ${hue})` }}>
                    {new Date(note.updated_at ?? note.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    {(note.attachments ?? []).length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: `oklch(0.40 0.14 ${hue})`, background: `oklch(0.90 0.06 ${hue})`, padding: '2px 8px', borderRadius: 20 }}>
                        📎 {note.attachments.length}
                      </span>
                    )}
                    {shareCount > 0 && (
                      <div
                        title={sharedNames.join(', ')}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: `oklch(0.40 0.14 ${hue})`, background: `oklch(0.90 0.06 ${hue})`, padding: '2px 8px', borderRadius: 20 }}
                      >
                        👥 {shareCount === 1 ? sharedNames[0] : `${shareCount} people`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Shared with me section */}
      {sharedNotes.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>Shared with me</div>
            <span className="bdg bdg-acc">{sharedNotes.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {sharedNotes.map(note => {
              const hue = TYPE_HUES[note.type] ?? 220;
              return (
                <div
                  key={note.id}
                  onClick={() => setViewShared(note)}
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
                    <span style={{ fontSize: 10, color: `oklch(0.50 0.08 ${hue})` }}>👁 view only</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: `oklch(0.25 0.10 ${hue})`, marginBottom: 8, lineHeight: 1.3 }}>
                    {note.title}
                  </div>
                  {note.content && (
                    <div style={{ fontSize: 12, color: `oklch(0.45 0.08 ${hue})`, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
                      {note.content}
                    </div>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 10, color: `oklch(0.65 0.06 ${hue})` }}>
                      {new Date(note.updated_at ?? note.created_at).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: `oklch(0.40 0.14 ${hue})`, background: `oklch(0.90 0.06 ${hue})`, padding: '2px 8px', borderRadius: 20 }}>
                      from {note.owner_name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Read-only shared note viewer */}
      {viewShared && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) setViewShared(null); }}>
          <div className="md" style={{ width: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.4 }}>{viewShared.title}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {(() => { const hue = TYPE_HUES[viewShared.type] ?? 220; return (
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: `oklch(0.88 0.08 ${hue})`, color: `oklch(0.35 0.14 ${hue})`, padding: '3px 8px', borderRadius: 20 }}>
                      {viewShared.type ?? 'General'}
                    </span>
                  ); })()}
                  <span className="bdg bdg-gy" style={{ fontSize: 10 }}>Shared by {viewShared.owner_name}</span>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewShared(null)}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
              {viewShared.content
                ? <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{viewShared.content}</div>
                : <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>No content.</div>
              }
              {(viewShared.attachments ?? []).length > 0 && (
                <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Attachments ({viewShared.attachments.length})
                  </div>
                  {viewShared.attachments.map((a: any) => <AttachmentRow key={a.id} a={a} />)}
                </div>
              )}
            </div>
            <div style={{ borderTop: '1px solid var(--line)', padding: '12px 20px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                Last updated {new Date(viewShared.updated_at ?? viewShared.created_at).toLocaleDateString()}
              </span>
              <button className="btn btn-sec btn-sm" onClick={() => setViewShared(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {isModalOpen && (
        <div className="mb">
          <div className="md" style={{ width: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="md-t">{editNote ? 'Edit Note' : 'New Note'}</div>
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileAdd} />
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
              <textarea rows={8} value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Write your note here…" style={{ resize: 'vertical' }} />
            </div>

            {/* Attachments */}
            <div className="pv-fld">
              <label>Attachments</label>
              <button type="button" className="btn btn-sec btn-sm" onClick={() => fileInputRef.current?.click()} style={{ marginBottom: formAttachments.length > 0 ? 10 : 0 }}>
                📎 Attach files
              </button>
              {formAttachments.map(a => (
                <AttachmentRow key={a.id} a={a} onRemove={() => setFormAttachments(prev => prev.filter(x => x.id !== a.id))} />
              ))}
            </div>

            {/* Share with picker */}
            {users.length > 0 && (
              <div className="pv-fld">
                <label>
                  Share with
                  {formSharedWith.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'oklch(0.93 0.05 268)', color: 'oklch(0.38 0.14 268)' }}>
                      {formSharedWith.length} selected
                    </span>
                  )}
                </label>
                {users.length > 5 && (
                  <input
                    type="text"
                    placeholder="Search people…"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    style={{ marginBottom: 8 }}
                  />
                )}
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 0' }}>
                  {filteredUsers.length === 0 ? (
                    <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-4)' }}>No people found</div>
                  ) : filteredUsers.map(u => {
                    const selected = formSharedWith.includes(u.id);
                    const hue = ((u.name ?? '').charCodeAt(0) * 13) % 360;
                    return (
                      <div
                        key={u.id}
                        onClick={() => toggleShareUser(u.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer',
                          background: selected ? 'oklch(0.95 0.04 268)' : 'transparent',
                          transition: 'background .1s',
                        }}
                        onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'; }}
                        onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, border: selected ? 'none' : '1.5px solid var(--line)',
                          background: selected ? 'oklch(0.45 0.20 268)' : 'var(--surface)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: '#fff', fontWeight: 700, flexShrink: 0,
                        }}>
                          {selected ? '✓' : ''}
                        </div>
                        <div className="av-circle" style={{ width: 26, height: 26, fontSize: 9, flexShrink: 0, background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.42 0.16 ${hue + 20}))` }}>
                          {(u.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--ink-4)', textTransform: 'capitalize' }}>{u.role}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {formSharedWith.length > 0 && (
                  <button
                    style={{ marginTop: 6, background: 'none', border: 'none', fontSize: 11, color: 'var(--err)', cursor: 'pointer', padding: 0 }}
                    onClick={() => setFormSharedWith([])}
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

            {saveError && (
              <div style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                ⚠ {saveError}
              </div>
            )}
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
