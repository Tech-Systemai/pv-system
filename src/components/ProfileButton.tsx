'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/utils/supabase/client';

const BUCKET = 'employee-docs';
type Tab = 'overview' | 'documents' | 'paystubs';

async function apiFetch(table: string, filters: Record<string, string>, select?: string) {
  const res = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, operation: 'select', select: select ?? '*', filters }),
  });
  const json = await res.json();
  return (json.data ?? []) as any[];
}

async function apiUpdate(table: string, data: Record<string, any>, filters: Record<string, string>) {
  await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, operation: 'update', data, filters }),
  });
}

const ROLE_COLOR: Record<string, string> = {
  owner: '#7c3aed', admin: '#2563eb', supervisor: '#0891b2',
  sales: '#16a34a', cx: '#d97706', accountant: '#6b7280',
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Signed:  { bg: '#dcfce7', color: '#15803d' },
  Active:  { bg: '#dbeafe', color: '#1d4ed8' },
  Draft:   { bg: '#f3f4f6', color: '#6b7280' },
  Pending: { bg: '#fef9c3', color: '#854d0e' },
};

function Badge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.Draft;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

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
  const [mounted, setMounted]   = useState(false);
  const [open, setOpen]         = useState(false);
  const [tab, setTab]           = useState<Tab>('overview');
  const [profile, setProfile]   = useState(initialProfile);
  const [hours, setHours]       = useState<number | null>(null);
  const [contracts, setContracts] = useState<any[] | null>(null);
  const [paystubs,  setPaystubs]  = useState<any[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const idRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;

    // Hours worked
    if (hours === null) {
      supabase
        .from('attendance_logs')
        .select('clock_in_time,clock_out_time')
        .eq('user_id', userId)
        .not('clock_out_time', 'is', null)
        .then(({ data }) => {
          const total = (data ?? []).reduce((acc: number, l: any) => {
            const ms = new Date(l.clock_out_time).getTime() - new Date(l.clock_in_time).getTime();
            return acc + (ms > 0 ? ms / 3600000 : 0);
          }, 0);
          setHours(Math.round(total * 10) / 10);
        });
    }

    // Contracts + paystubs (use admin route to bypass RLS)
    apiFetch('contracts', { user_id: userId }, 'id,type,status,effective_date,end_date,employer_signature,employee_signature,created_at')
      .then(rows => setContracts(rows.slice().reverse()));
    apiFetch('payrolls', { user_id: userId }, 'id,period,net_pay,base_salary,deductions,bonuses,status,created_at')
      .then(rows => setPaystubs(rows.slice().reverse()));
  }, [open]);

  const uploadId = async (file: File) => {
    setUploading(true);
    const ext  = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${userId}/id.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) { alert(`Upload failed: ${error.message}`); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    await apiUpdate('profiles', { id_document_url: publicUrl }, { id: userId });
    setProfile(p => ({ ...p, id_document_url: publicUrl }));
    setUploading(false);
  };

  const initials = (profile.name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const rc = ROLE_COLOR[profile.role] || '#6b7689';

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview'  },
    { id: 'documents', label: 'Documents' },
    { id: 'paystubs',  label: 'Pay Stubs' },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="My Profile"
        style={{ width: 34, height: 34, borderRadius: 10, background: '#e0e7ff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        {initials}
      </button>

      {open && mounted && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{ background: '#fff', borderRadius: 16, width: 540, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>

            {/* ── Fixed header ── */}
            <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#4f46e5', flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1f2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{profile.email || '—'}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color: rc, background: `${rc}15`, padding: '4px 12px', borderRadius: 20, border: `1px solid ${rc}30`, flexShrink: 0 }}>
                  {profile.role}
                </span>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e4e7eb' }}>
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{ padding: '9px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#4f46e5' : '#6b7689', borderBottom: `2px solid ${tab === t.id ? '#4f46e5' : 'transparent'}`, marginBottom: -1, transition: 'color 0.15s' }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Scrollable content ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* OVERVIEW */}
              {tab === 'overview' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {([
                      ['Full Name',     profile.name || '—'],
                      ['Username',      profile.username ? `@${profile.username}` : '—'],
                      ['Role',          profile.role],
                      ['Email',         profile.email || '—'],
                      ['Hours Worked',  hours === null ? '…' : `${hours} hrs`],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} style={{ background: '#f8f9fb', padding: '12px 14px', borderRadius: 10 }}>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{k}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f2e', wordBreak: 'break-all' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DOCUMENTS */}
              {tab === 'documents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* ID */}
                  <div style={{ padding: 16, background: '#f8f9fb', borderRadius: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12 }}>🪪 Government ID</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {profile.id_document_url ? (
                        <a href={profile.id_document_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, background: '#fff', border: '1px solid #d1d5db', color: '#374151', textDecoration: 'none', fontWeight: 600 }}>
                          👁 View ID
                        </a>
                      ) : (
                        <span style={{ fontSize: 12, color: '#9ca3af', flex: 1 }}>No ID on file</span>
                      )}
                      <input ref={idRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadId(e.target.files[0]); e.target.value = ''; }} />
                      <button
                        onClick={() => idRef.current?.click()}
                        disabled={uploading}
                        style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, background: '#fff', border: '1px solid #d1d5db', color: '#374151', cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                      >
                        {uploading ? 'Uploading…' : profile.id_document_url ? '↑ Replace' : '↑ Upload ID'}
                      </button>
                    </div>
                  </div>

                  {/* Contracts */}
                  <div style={{ padding: 16, background: '#f8f9fb', borderRadius: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12 }}>📄 Contracts</div>
                    {contracts === null ? (
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</div>
                    ) : contracts.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>No contracts on file.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {contracts.map(c => (
                          <div key={c.id} style={{ background: '#fff', border: '1px solid #e4e7eb', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f2e' }}>{c.type} Agreement</div>
                              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                                Effective: {c.effective_date || '—'}
                                {c.employer_signature && c.employee_signature ? ' · Both signed' : c.employer_signature ? ' · Employer signed' : c.employee_signature ? ' · You signed' : ' · Pending signatures'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              <Badge status={c.status || 'Draft'} />
                              <a
                                href={`/dashboard/${profile.role}/contracts`}
                                onClick={() => setOpen(false)}
                                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#e0e7ff', color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}
                              >
                                View
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PAY STUBS */}
              {tab === 'paystubs' && (
                <div>
                  {paystubs === null ? (
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</div>
                  ) : paystubs.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>💵</div>
                      No pay stubs on file yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {paystubs.map(p => (
                        <div key={p.id} style={{ background: '#f8f9fb', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f2e' }}>{p.period}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                              Base: ${Number(p.base_salary || 0).toLocaleString()}
                              {p.bonuses > 0 && ` · Bonus: $${Number(p.bonuses).toLocaleString()}`}
                              {p.deductions > 0 && ` · Deductions: $${Number(p.deductions).toLocaleString()}`}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>${Number(p.net_pay || 0).toLocaleString()}</span>
                            <Badge status={p.status || 'Pending'} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Fixed footer ── */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e4e7eb', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpen(false)}
                style={{ fontSize: 13, padding: '8px 20px', borderRadius: 8, background: '#f3f4f6', border: '1px solid #e4e7eb', color: '#374151', cursor: 'pointer', fontWeight: 600 }}
              >
                Close
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
}
