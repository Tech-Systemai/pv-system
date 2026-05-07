'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const DEFAULT_FOLDERS = [
  { name: 'Sales Playbook', access: 'Sales + Mgmt', icon: '📘', hue: 75 },
  { name: 'CX Procedures', access: 'CX + Mgmt', icon: '📗', hue: 145 },
  { name: 'Company Policies', access: 'Everyone', icon: '📋', hue: 268 },
  { name: 'Onboarding', access: 'New hires', icon: '🎯', hue: 200 },
  { name: 'Compliance & Legal', access: 'Mgmt only', icon: '⚖', hue: 25 },
  { name: 'Product Documentation', access: 'Everyone', icon: '📚', hue: 155 },
];

export default function KBClient({ initialArticles, userRole }: { initialArticles: any[], userRole: string, currentUserId?: string }) {
  const [articles, setArticles] = useState(initialArticles);
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [viewArticle, setViewArticle] = useState<any>(null);
  const [newArticleModal, setNewArticleModal] = useState(false);
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isMgmt = ['owner', 'admin', 'supervisor'].includes(userRole);
  const isOwner = userRole === 'owner';
  const isReadOnly = ['sales', 'cx'].includes(userRole);

  const handleCreateArticle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const newDoc = {
      folder: formData.get('folder') as string,
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      access_level: formData.get('access') as string,
    };
    const { data } = await dbOp('knowledge_base', 'insert', newDoc);
    if (data?.[0]) setArticles([data[0], ...articles]);
    setSaving(false);
    setNewArticleModal(false);
  };

  const handleDeleteArticle = async (id: string) => {
    setDeleting(id);
    await dbOp('knowledge_base', 'delete', undefined, { id });
    setArticles(prev => prev.filter(a => a.id !== id));
    setDeleting(null);
    if (viewArticle?.id === id) setViewArticle(null);
  };

  const handleCreateFolder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name') as string;
    const access = fd.get('access') as string;
    const icon = fd.get('icon') as string || '📁';
    if (name && !folders.find(f => f.name === name)) {
      setFolders(prev => [...prev, { name, access, icon, hue: Math.floor(Math.random() * 360) }]);
    }
    setNewFolderModal(false);
  };

  const folderStats = folders.map(f => {
    const folderArticles = articles.filter(a => a.folder === f.name);
    return { ...f, count: folderArticles.length, items: folderArticles };
  });

  const selectedFolderData = activeFolder ? folderStats.find(f => f.name === activeFolder) : null;

  const filteredArticles = searchQuery
    ? articles.filter(a =>
        a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.folder?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📚</div></div>
          <div className="stat-l">TOTAL ARTICLES</div>
          <div className="stat-v">{articles.length}</div>
          <div className="stat-foot">Across all folders</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico acc">📁</div></div>
          <div className="stat-l">FOLDERS</div>
          <div className="stat-v">{folders.length}</div>
          <div className="stat-foot">Knowledge categories</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">PUBLISHED</div>
          <div className="stat-v">{articles.filter(a => a.content?.length > 0).length}</div>
          <div className="stat-foot">With content</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">🔒</div></div>
          <div className="stat-l">MGMT ONLY</div>
          <div className="stat-v">{articles.filter(a => a.access_level === 'Mgmt only').length}</div>
          <div className="stat-foot">Restricted articles</div>
        </div>
      </div>

      {isReadOnly && (
        <div style={{ background: 'oklch(0.97 0.03 200)', border: '1px solid oklch(0.88 0.06 200)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'oklch(0.40 0.14 200)', marginBottom: 16 }}>
          Browse and read articles. Contact your supervisor to add or edit content.
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input
            type="text"
            placeholder="Search articles by title, folder, or content…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="fld-input"
            style={{ flex: 1, height: 38 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            {isMgmt && <button className="btn btn-acc btn-sm" onClick={() => setNewArticleModal(true)}>+ New Article</button>}
            {isOwner && <button className="btn btn-sec btn-sm" onClick={() => setNewFolderModal(true)}>+ New Folder</button>}
          </div>
        </div>
        {searchQuery && filteredArticles.length > 0 && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '8px 18px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 8 }}>{filteredArticles.length} result{filteredArticles.length !== 1 ? 's' : ''}</div>
            {filteredArticles.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }} onClick={() => setViewArticle(a)}>
                <span style={{ fontSize: 15 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{a.folder} · {a.access_level}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Folder cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {folderStats.map((f) => (
          <div
            key={f.name}
            onClick={() => setActiveFolder(f.name)}
            style={{
              background: `linear-gradient(135deg, oklch(0.96 0.04 ${f.hue}), oklch(0.93 0.06 ${f.hue + 20}))`,
              border: `1px solid oklch(0.88 0.07 ${f.hue})`,
              borderRadius: 14, padding: '20px 18px', cursor: 'pointer',
              transition: 'transform .12s, box-shadow .12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: `oklch(0.30 0.10 ${f.hue})`, marginBottom: 4 }}>{f.name}</div>
            <div style={{ fontSize: 11, color: `oklch(0.48 0.08 ${f.hue})`, marginBottom: 14 }}>{f.count} articles · {f.access}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-sm"
                style={{ background: `oklch(0.88 0.08 ${f.hue})`, color: `oklch(0.30 0.12 ${f.hue})`, border: 'none', flex: 1 }}
                onClick={e => { e.stopPropagation(); setActiveFolder(f.name); }}
              >
                Open Folder →
              </button>
              {isMgmt && (
                <button
                  className="btn btn-sm"
                  style={{ background: `oklch(0.88 0.08 ${f.hue})`, color: `oklch(0.30 0.12 ${f.hue})`, border: 'none' }}
                  onClick={e => { e.stopPropagation(); setActiveFolder(f.name); setNewArticleModal(true); }}
                >
                  +
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Folder contents modal */}
      {activeFolder && selectedFolderData && !viewArticle && (
        <div className="mb">
          <div className="md" style={{ width: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedFolderData.icon} {selectedFolderData.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Access: <strong>{selectedFolderData.access}</strong> · {selectedFolderData.count} articles</div>
              </div>
              {isMgmt && (
                <button className="btn btn-acc btn-sm" onClick={() => setNewArticleModal(true)}>+ Add Article</button>
              )}
            </div>

            {selectedFolderData.items.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No articles in this folder yet.</div>
            ) : (
              selectedFolderData.items.map(a => (
                <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setViewArticle(a)}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>Updated {new Date(a.created_at).toLocaleDateString()}</div>
                  </div>
                  <button className="btn btn-sec btn-sm" onClick={() => setViewArticle(a)}>View</button>
                  {isMgmt && (
                    <button
                      onClick={() => handleDeleteArticle(a.id)}
                      disabled={deleting === a.id}
                      style={{ background: 'none', border: 'none', color: 'var(--err)', cursor: 'pointer', fontSize: 14, padding: '4px' }}
                    >✕</button>
                  )}
                </div>
              ))
            )}

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-sec" onClick={() => setActiveFolder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Article view modal */}
      {viewArticle && (
        <div className="mb">
          <div className="md" style={{ width: 680, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>{viewArticle.title}</div>
              {isMgmt && (
                <button
                  onClick={() => handleDeleteArticle(viewArticle.id)}
                  disabled={deleting === viewArticle.id}
                  className="btn btn-sm"
                  style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)', marginLeft: 12 }}
                >
                  {deleting === viewArticle.id ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 20 }}>
              {viewArticle.folder} · Access: {viewArticle.access_level} · {new Date(viewArticle.created_at).toLocaleDateString()}
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.8, whiteSpace: 'pre-wrap', background: 'var(--surface-2)', padding: 16, borderRadius: 10 }}>
              {viewArticle.content}
            </div>
            <div style={{ marginTop: 20 }}>
              <button className="btn btn-sec" onClick={() => setViewArticle(null)}>← Back</button>
            </div>
          </div>
        </div>
      )}

      {/* New Article modal */}
      {newArticleModal && (
        <div className="mb">
          <div className="md" style={{ width: 520 }}>
            <div className="md-t">New Article</div>
            <form onSubmit={handleCreateArticle}>
              <div className="pv-fld">
                <label>Folder</label>
                <select name="folder" required defaultValue={activeFolder || folders[0].name}>
                  {folders.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
              </div>
              <div className="pv-fld"><label>Title</label><input type="text" name="title" required /></div>
              <div className="pv-fld">
                <label>Content</label>
                <textarea name="content" rows={8} placeholder="Write your article…" required style={{ resize: 'vertical' }} />
              </div>
              <div className="pv-fld">
                <label>Visibility</label>
                <select name="access">
                  <option>Everyone</option>
                  <option>Sales + Mgmt</option>
                  <option>CX + Mgmt</option>
                  <option>Mgmt only</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={saving}>{saving ? 'Publishing…' : 'Publish Article'}</button>
                <button type="button" className="btn btn-sec" onClick={() => setNewArticleModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Folder modal */}
      {newFolderModal && (
        <div className="mb">
          <div className="md" style={{ width: 420 }}>
            <div className="md-t">New Folder</div>
            <form onSubmit={handleCreateFolder}>
              <div className="pv-fld"><label>Folder Name</label><input type="text" name="name" required placeholder="e.g. Training Materials" /></div>
              <div className="pv-fld"><label>Icon (emoji)</label><input type="text" name="icon" placeholder="📁" maxLength={4} defaultValue="📁" /></div>
              <div className="pv-fld">
                <label>Access Level</label>
                <select name="access">
                  <option>Everyone</option>
                  <option>Sales + Mgmt</option>
                  <option>CX + Mgmt</option>
                  <option>Mgmt only</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc">Create Folder</button>
                <button type="button" className="btn btn-sec" onClick={() => setNewFolderModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
