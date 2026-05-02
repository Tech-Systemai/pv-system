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
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [newArticleModal, setNewArticleModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const isMgmt = ['owner', 'admin', 'supervisor'].includes(userRole);
  const isOwner = userRole === 'owner';

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
    if (data && data[0]) {
      setArticles([data[0], ...articles]);
    }
    setSaving(false);
    setNewArticleModal(false);
  };

  const folderStats = DEFAULT_FOLDERS.map(f => {
    const folderArticles = articles.filter(a => a.folder === f.name);
    return {
      ...f,
      count: folderArticles.length,
      items: folderArticles
    };
  });

  const selectedFolderData = activeFolder ? folderStats.find(f => f.name === activeFolder) : null;

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '14px' }}>
        <div></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isMgmt && <button className="pv-btn pv-btn-pri" onClick={() => setNewArticleModal(true)}>+ New article</button>}
          {isOwner && <button className="pv-btn pv-btn-sec">+ New folder</button>}
        </div>
      </div>
      
      <div className="three">
        {folderStats.map((f, i) => (
          <div key={i} className="kb-folder" onClick={() => setActiveFolder(f.name)}>
            <div className="kb-icon">{f.icon}</div>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{f.name}</div>
            <div style={{ fontSize: '11px', color: '#6b7689', marginBottom: '9px' }}>{f.count} articles · {f.access}</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="b-ic" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); setActiveFolder(f.name); }}>📂 Open</button>
              {isMgmt && <button className="b-ic" onClick={(e) => { e.stopPropagation(); setNewArticleModal(true); }}>+ Add</button>}
            </div>
          </div>
        ))}
      </div>

      {activeFolder && selectedFolderData && (
        <div className="mb" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="md" style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '520px', maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="md-t" style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>{selectedFolderData.icon} {selectedFolderData.name}</div>
            <div style={{ background: '#f5f6f8', padding: '10px 12px', borderRadius: '7px', fontSize: '11.5px', color: '#6b7689', marginBottom: '12px' }}>
              Access: <strong>{selectedFolderData.access}</strong> · {selectedFolderData.count} articles
            </div>
            
            {selectedFolderData.items.length === 0 && <div className="empty">No articles in this folder yet.</div>}
            
            {selectedFolderData.items.map(a => (
              <div key={a.id} className="row" style={{ padding: '9px 0', borderBottom: '1px solid #f0f2f5', display: 'flex', alignItems: 'center', gap: '11px' }}>
                <span style={{ fontSize: '14px' }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: '10.5px', color: '#6b7689' }}>Updated {new Date(a.created_at).toLocaleDateString()}</div>
                </div>
                <button className="b-ic">View</button>
              </div>
            ))}
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button className="pv-btn pv-btn-sec" onClick={() => setActiveFolder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {newArticleModal && (
        <div className="mb" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="md" style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '520px', maxWidth: '100%' }}>
            <div className="md-t" style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>New article</div>
            <form onSubmit={handleCreateArticle}>
              <div className="pv-fld">
                <label>Folder</label>
                <select name="folder" required defaultValue={activeFolder || DEFAULT_FOLDERS[0].name}>
                  {DEFAULT_FOLDERS.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
              </div>
              <div className="pv-fld">
                <label>Title</label>
                <input type="text" name="title" required />
              </div>
              <div className="pv-fld">
                <label>Content</label>
                <textarea name="content" rows={6} placeholder="Write your article..." required></textarea>
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
    </>
  );
}
