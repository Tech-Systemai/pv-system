'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const DEFAULT_FOLDERS = [
  { name: 'Sales Playbook', access: 'Sales + Mgmt', icon: '📘' },
  { name: 'CX Procedures', access: 'CX + Mgmt', icon: '📗' },
  { name: 'Company Policies', access: 'Everyone', icon: '📋' },
  { name: 'Onboarding', access: 'New hires', icon: '🎯' },
  { name: 'Compliance & Legal', access: 'Mgmt only', icon: '⚖' },
  { name: 'Product Documentation', access: 'Everyone', icon: '📚' },
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
      setFolders(prev => [...prev, { name, access, icon }]);
    }
    setNewFolderModal(false);
  };

  const folderStats = folders.map(f => {
    const folderArticles = articles.filter(a => a.folder === f.name);
    return { ...f, count: folderArticles.length, items: folderArticles };
  });

  const selectedFolderData = activeFolder ? folderStats.find(f => f.name === activeFolder) : null;

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '14px' }}>
        <div>
          <div className="pn-t">Knowledge Base</div>
          <div style={{ fontSize: '12px', color: '#6b7689', marginTop: '2px' }}>{articles.length} articles across {folders.length} folders</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isMgmt && <button className="pv-btn pv-btn-pri" onClick={() => setNewArticleModal(true)}>+ New Article</button>}
          {isOwner && <button className="pv-btn pv-btn-sec" onClick={() => setNewFolderModal(true)}>+ New Folder</button>}
        </div>
      </div>

      {isReadOnly && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#0369a1', marginBottom: '16px' }}>
          Browse and read articles. Contact your supervisor to add or edit content.
        </div>
      )}

      <div className="three">
        {folderStats.map((f, i) => (
          <div key={i} className="kb-folder" onClick={() => setActiveFolder(f.name)}>
            <div className="kb-icon">{f.icon}</div>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{f.name}</div>
            <div style={{ fontSize: '11px', color: '#6b7689', marginBottom: '9px' }}>{f.count} articles · {f.access}</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="b-ic" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); setActiveFolder(f.name); }}>📂 Open</button>
              {isMgmt && <button className="b-ic" onClick={(e) => { e.stopPropagation(); setActiveFolder(f.name); setNewArticleModal(true); }}>+ Add</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Folder contents modal */}
      {activeFolder && selectedFolderData && !viewArticle && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '560px', maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>{selectedFolderData.icon} {selectedFolderData.name}</div>
            <div style={{ background: '#f5f6f8', padding: '8px 12px', borderRadius: '7px', fontSize: '11.5px', color: '#6b7689', marginBottom: '16px' }}>
              Access: <strong>{selectedFolderData.access}</strong> · {selectedFolderData.count} articles
            </div>

            {selectedFolderData.items.length === 0 && <div className="empty">No articles in this folder yet.</div>}

            {selectedFolderData.items.map(a => (
              <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f2f5', display: 'flex', alignItems: 'center', gap: '11px' }}>
                <span style={{ fontSize: '16px' }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: '10.5px', color: '#6b7689' }}>Updated {new Date(a.created_at).toLocaleDateString()}</div>
                </div>
                <button className="b-ic" onClick={() => setViewArticle(a)}>View</button>
                {isMgmt && (
                  <button
                    onClick={() => handleDeleteArticle(a.id)}
                    disabled={deleting === a.id}
                    style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: '14px', padding: '4px' }}
                    title="Delete article"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              {isMgmt && <button className="pv-btn pv-btn-pri" style={{ fontSize: '12px' }} onClick={() => setNewArticleModal(true)}>+ Add Article</button>}
              <button className="pv-btn pv-btn-sec" onClick={() => setActiveFolder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Article view modal */}
      {viewArticle && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '28px', borderRadius: '14px', width: '680px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{viewArticle.title}</div>
              {isMgmt && (
                <button
                  onClick={() => handleDeleteArticle(viewArticle.id)}
                  disabled={deleting === viewArticle.id}
                  style={{ background: '#fee2e2', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}
                >
                  {deleting === viewArticle.id ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7689', marginBottom: '20px' }}>
              {viewArticle.folder} · Access: {viewArticle.access_level} · {new Date(viewArticle.created_at).toLocaleDateString()}
            </div>
            <div style={{ fontSize: '14px', color: '#1a1f2e', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {viewArticle.content}
            </div>
            <div style={{ marginTop: '24px' }}>
              <button className="pv-btn pv-btn-sec" onClick={() => setViewArticle(null)}>← Back to folder</button>
            </div>
          </div>
        </div>
      )}

      {/* New Article modal */}
      {newArticleModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '520px', maxWidth: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>New Article</div>
            <form onSubmit={handleCreateArticle}>
              <div className="pv-fld">
                <label>Folder</label>
                <select name="folder" required defaultValue={activeFolder || folders[0].name}>
                  {folders.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Title</label>
                <input type="text" name="title" required />
              </div>
              <div className="pv-fld">
                <label>Content</label>
                <textarea name="content" rows={8} placeholder="Write your article..." required style={{ resize: 'vertical' }}></textarea>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={saving}>{saving ? 'Publishing...' : 'Publish'}</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setNewArticleModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Folder modal */}
      {newFolderModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '420px', maxWidth: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>New Folder</div>
            <form onSubmit={handleCreateFolder}>
              <div className="pv-fld">
                <label>Folder Name</label>
                <input type="text" name="name" required placeholder="e.g. Training Materials" />
              </div>
              <div className="pv-fld">
                <label>Icon (emoji)</label>
                <input type="text" name="icon" placeholder="📁" maxLength={4} defaultValue="📁" />
              </div>
              <div className="pv-fld">
                <label>Access Level</label>
                <select name="access">
                  <option>Everyone</option>
                  <option>Sales + Mgmt</option>
                  <option>CX + Mgmt</option>
                  <option>Mgmt only</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri">Create Folder</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setNewFolderModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
