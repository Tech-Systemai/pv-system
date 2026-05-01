'use client';

import { useState } from 'react';

export default function AuditClient({ initialLogs }: { initialLogs: any[] }) {
  const [filter, setFilter] = useState('');

  const filteredLogs = initialLogs.filter(log => 
    log.user_name?.toLowerCase().includes(filter.toLowerCase()) || 
    log.action.toLowerCase().includes(filter.toLowerCase()) || 
    log.target.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '14px' }}>
        <div></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            placeholder="Search audit log..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #e4e7eb', borderRadius: '7px', fontSize: '12px', width: '220px', outline: 'none' }} 
          />
          <button className="pv-btn pv-btn-sec">Filter</button>
          <button className="pv-btn pv-btn-pri">↓ Export CSV</button>
        </div>
      </div>
      
      <div className="pn">
        <div className="audit-row" style={{ fontWeight: 700, color: '#1a1f2e', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <div>Time</div><div>User</div><div>Action</div><div>Type</div>
        </div>
        
        <div>
          {filteredLogs.length === 0 && <div className="empty" style={{ padding: '20px' }}>No matching audit logs found.</div>}
          {filteredLogs.map(a => (
            <div key={a.id} className="audit-row">
              <div className="aud-tm">
                {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="aud-u">{a.user_name}</div>
              <div className="aud-a">{a.action} <span style={{ color: '#9fa8be' }}>·</span> <span style={{ color: '#4f46e5' }}>{a.target}</span></div>
              <div className="aud-t">{a.type.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
