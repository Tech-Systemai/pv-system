'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { dbOp } from '@/utils/db';

const BUCKET = 'employee-docs';

export default function ProfileButton({
  userId,
  initialProfile,
}: {
  userId: string;
  initialProfile: {
    name: string;
    username?: string | null;
    role: string;
    email?: string | null;
    contract_url?: string | null;
    id_document_url?: string | null;
  };
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [hours, setHours] = useState<number | null>(null);
  const [uploading, setUploading] = useState<'contract' | 'id' | null>(null);
  const contractRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || hours !== null) return;
    supabase
      .from('attendance_logs')
      .select('clock_in_time, clock_out_time')
      .eq('user_id', userId)
      .not('clock_out_time', 'is', null)
      .then(({ data }) => {
        if (!data) { setHours(0); return; }
        const total = data.reduce((acc: number, log: any) => {
          const ms = new Date(log.clock_out_time).getTime() - new Date(log.clock_in_time).getTime();
          return acc + (ms > 0 ? ms / 3600000 : 0);
        }, 0);
        setHours(Math.round(total * 10) / 10);
      });
  }, [open]);

  const uploadDoc = async (file: File, type: 'contract' | 'id') => {
    setUploading(type);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${userId}/${type}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) { alert(`Upload failed: ${error.message}`); setUploading(null); return; }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const field = type === 'contract' ? 'contract_url' : 'id_document_url';
    await dbOp('profiles', 'update', { [field]: publicUrl }, { id: userId });
    setProfile(prev => ({ ...prev, [field]: publicUrl }));
    setUploading(null);
  };

  const initials = (profile.name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const ROLE_COLOR: Record<string, string> = {
    owner: '#7c3aed', admin: '#2563eb', supervisor: '#0891b2',
    sales: '#16a34a', cx: '#d97706', accountant: '#6b7280',
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="My Profile"
        style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#e0e7ff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        {initials}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '480px', maxWidth: '100%', maxHeight: '90vh', overflow: 'auto' }}>

            {/* Header */}
            <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: '#4f46e5', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a1f2e' }}>{profile.name}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>@{profile.username || '—'}</div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'capitalize', color: ROLE_COLOR[profile.role] || '#6b7689', background: '#f5f6f8', padding: '4px 12px', borderRadius: '20px', border: `1px solid ${ROLE_COLOR[profile.role] || '#e4e7eb'}20` }}>
                {profile.role}
              </span>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                {([
                  ['Full Name', profile.name],
                  ['Username', profile.username ? `@${profile.username}` : '—'],
                  ['Role', profile.role],
                  ['Email', profile.email || '—'],
                  ['Hours Worked', hours === null ? '…' : `${hours} hrs`],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ background: '#f8f9fb', padding: '10px 12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px' }}>{k}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1f2e' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Contract */}
              <div style={{ padding: '14px', background: '#f8f9fb', borderRadius: '10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '10px' }}>📄 Signed Contract</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {profile.contract_url ? (
                    <a href={profile.contract_url} target="_blank" rel="noreferrer" className="pv-btn pv-btn-sec" style={{ fontSize: '12px', textDecoration: 'none' }}>View Contract</a>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#9ca3af', flex: 1 }}>No contract on file</span>
                  )}
                  <input ref={contractRef} type="file" accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadDoc(e.target.files[0], 'contract'); e.target.value = ''; }} />
                  <button onClick={() => contractRef.current?.click()} className="pv-btn pv-btn-sec" style={{ fontSize: '12px' }} disabled={!!uploading}>
                    {uploading === 'contract' ? 'Uploading…' : profile.contract_url ? 'Replace' : 'Upload Contract'}
                  </button>
                </div>
              </div>

              {/* ID Document */}
              <div style={{ padding: '14px', background: '#f8f9fb', borderRadius: '10px', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '10px' }}>🪪 ID Document</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {profile.id_document_url ? (
                    <a href={profile.id_document_url} target="_blank" rel="noreferrer" className="pv-btn pv-btn-sec" style={{ fontSize: '12px', textDecoration: 'none' }}>View ID</a>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#9ca3af', flex: 1 }}>No ID on file</span>
                  )}
                  <input ref={idRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadDoc(e.target.files[0], 'id'); e.target.value = ''; }} />
                  <button onClick={() => idRef.current?.click()} className="pv-btn pv-btn-sec" style={{ fontSize: '12px' }} disabled={!!uploading}>
                    {uploading === 'id' ? 'Uploading…' : profile.id_document_url ? 'Replace' : 'Upload ID'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="pv-btn pv-btn-sec" onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
