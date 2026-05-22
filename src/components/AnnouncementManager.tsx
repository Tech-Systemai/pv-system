'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

type Announcement = {
  type: 'meeting' | 'announcement';
  title: string;
  message: string;
  meeting_link?: string;
  created_at: string;
  created_by_name?: string;
  target_user_ids: string[] | null;
};

const EMPTY = { type: 'meeting' as 'meeting' | 'announcement', title: '', message: '', meeting_link: '' };

export default function AnnouncementManager({ userName }: { userName: string }) {
  const supabase = useRef(createClient()).current;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Announcement | null>(null);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [targetMode, setTargetMode] = useState<'all' | 'specific'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [profileSearch, setProfileSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data: setting }, { data: profiles }] = await Promise.all([
      supabase.from('global_settings').select('value').eq('key', 'active_announcement').maybeSingle(),
      supabase.from('profiles').select('id, name, role').order('name'),
    ]);
    setActive(setting?.value ? (setting.value as Announcement) : null);
    setAllProfiles(profiles ?? []);
  }, [supabase]);

  useEffect(() => {
    if (open) {
      fetchData();
      setForm(EMPTY);
      setTargetMode('all');
      setSelectedUsers([]);
      setProfileSearch('');
    }
  }, [open, fetchData]);

  const toggleUser = (id: string) => {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const filtered = allProfiles.filter(p => matchesSearch(p));
    const allSelected = filtered.every(p => selectedUsers.includes(p.id));
    if (allSelected) {
      setSelectedUsers(prev => prev.filter(id => !filtered.some(p => p.id === id)));
    } else {
      const newIds = filtered.map(p => p.id).filter(id => !selectedUsers.includes(id));
      setSelectedUsers(prev => [...prev, ...newIds]);
    }
  };

  const matchesSearch = (p: any) =>
    !profileSearch || p.name?.toLowerCase().includes(profileSearch.toLowerCase()) || p.role?.toLowerCase().includes(profileSearch.toLowerCase());

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    if (targetMode === 'specific' && selectedUsers.length === 0) return;
    setSaving(true);
    const payload: Announcement = {
      type: form.type,
      title: form.title.trim(),
      message: form.message.trim(),
      ...(form.type === 'meeting' && form.meeting_link.trim() ? { meeting_link: form.meeting_link.trim() } : {}),
      created_at: new Date().toISOString(),
      created_by_name: userName,
      target_user_ids: targetMode === 'specific' ? selectedUsers : null,
    };
    await supabase.from('global_settings').upsert({ key: 'active_announcement', value: payload });
    setActive(payload);
    setForm(EMPTY);
    setTargetMode('all');
    setSelectedUsers([]);
    setSaving(false);
  };

  const handleClear = async () => {
    await supabase.from('global_settings').delete().eq('key', 'active_announcement');
    setActive(null);
  };

  const isMeeting = form.type === 'meeting';
  const canSend = form.title.trim() && form.message.trim() && (targetMode === 'all' || selectedUsers.length > 0);
  const filteredProfiles = allProfiles.filter(matchesSearch);
  const allFilteredSelected = filteredProfiles.length > 0 && filteredProfiles.every(p => selectedUsers.includes(p.id));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Announcements & Meetings"
        style={{
          position: 'relative', width: 36, height: 36, borderRadius: '50%',
          border: active ? '2px solid oklch(0.68 0.18 25)' : '1.5px solid var(--line)',
          background: active ? 'oklch(0.95 0.05 25)' : 'white',
          cursor: 'pointer', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: active ? '0 0 0 3px oklch(0.88 0.10 25 / 0.45)' : 'none',
          transition: 'all 0.18s', flexShrink: 0,
        }}>
        📢
        {active && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            width: 9, height: 9, borderRadius: '50%',
            background: 'oklch(0.50 0.22 25)', border: '2px solid white',
          }} />
        )}
      </button>

      {open && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="md" style={{ width: 580, maxHeight: '90vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Fixed header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>Announcements & Meetings</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>
                Send a popup to all staff or specific people — they see it immediately.
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
              {/* Active announcement */}
              {active ? (
                <div style={{
                  marginBottom: 16, padding: '12px 14px', borderRadius: 10,
                  background: active.type === 'meeting' ? 'oklch(0.96 0.04 260)' : 'oklch(0.96 0.04 25)',
                  border: `1.5px solid ${active.type === 'meeting' ? 'oklch(0.84 0.09 260)' : 'oklch(0.84 0.09 25)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>
                      {active.type === 'meeting' ? '📹' : '📢'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                        color: active.type === 'meeting' ? 'oklch(0.38 0.20 260)' : 'oklch(0.38 0.22 25)',
                        marginBottom: 3,
                      }}>
                        LIVE · {active.type === 'meeting' ? 'MEETING ALERT' : 'ANNOUNCEMENT'}
                        {active.target_user_ids
                          ? ` · ${active.target_user_ids.length} RECIPIENT${active.target_user_ids.length !== 1 ? 'S' : ''}`
                          : ' · ALL STAFF'}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{active.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{active.message}</div>
                      {active.target_user_ids && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {active.target_user_ids.map(id => {
                            const p = allProfiles.find(x => x.id === id);
                            return p ? (
                              <span key={id} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'white', border: '1px solid var(--line)', color: 'var(--ink-3)' }}>
                                {p.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                    <button onClick={handleClear} style={{
                      flexShrink: 0, fontSize: 12, fontWeight: 600, padding: '5px 12px',
                      borderRadius: 8, cursor: 'pointer',
                      border: '1px solid var(--line)', background: 'white', color: 'var(--ink-4)',
                    }}>
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                  background: 'var(--surface-2)', border: '1px dashed var(--line)',
                  fontSize: 13, color: 'var(--ink-5)', textAlign: 'center',
                }}>
                  No active announcement — all staff see normal view.
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)', marginBottom: 10 }}>
                {active ? 'REPLACE WITH NEW' : 'NEW ANNOUNCEMENT'}
              </div>

              {/* Type */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {(['meeting', 'announcement'] as const).map(t => (
                  <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                      fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
                      border: `1.5px solid ${form.type === t ? (t === 'meeting' ? 'oklch(0.62 0.18 260)' : 'oklch(0.62 0.20 25)') : 'var(--line)'}`,
                      background: form.type === t ? (t === 'meeting' ? 'oklch(0.93 0.07 260)' : 'oklch(0.93 0.07 25)') : 'white',
                      color: form.type === t ? (t === 'meeting' ? 'oklch(0.36 0.18 260)' : 'oklch(0.36 0.20 25)') : 'var(--ink-4)',
                    }}>
                    {t === 'meeting' ? '📹 Urgent Meeting' : '📢 Announcement'}
                  </button>
                ))}
              </div>

              <div className="pv-fld">
                <label>Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder={isMeeting ? 'e.g. Emergency Team Meeting' : 'e.g. Important Policy Update'}
                  autoFocus
                />
              </div>
              <div className="pv-fld">
                <label>Message</label>
                <textarea
                  rows={3}
                  value={form.message}
                  onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder={isMeeting
                    ? 'e.g. All staff please join immediately for an urgent discussion.'
                    : 'e.g. Please review the updated attendance policy effective next week.'}
                  style={{ resize: 'vertical' }}
                />
              </div>
              {isMeeting && (
                <div className="pv-fld">
                  <label>Meeting Link</label>
                  <input
                    value={form.meeting_link}
                    onChange={e => setForm(p => ({ ...p, meeting_link: e.target.value }))}
                    placeholder="https://meet.google.com/xxx-yyy-zzz"
                    type="url"
                  />
                </div>
              )}

              {/* Audience */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)', marginBottom: 8 }}>
                  SEND TO
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {(['all', 'specific'] as const).map(m => (
                    <button key={m} onClick={() => setTargetMode(m)}
                      style={{
                        flex: 1, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                        fontWeight: 600, fontSize: 12, transition: 'all 0.14s',
                        border: `1.5px solid ${targetMode === m ? 'oklch(0.55 0.16 260)' : 'var(--line)'}`,
                        background: targetMode === m ? 'oklch(0.94 0.06 260)' : 'white',
                        color: targetMode === m ? 'oklch(0.36 0.18 260)' : 'var(--ink-4)',
                      }}>
                      {m === 'all' ? '👥 Everyone' : '🎯 Specific people'}
                    </button>
                  ))}
                </div>

                {targetMode === 'specific' && (
                  <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line-2)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface-2)' }}>
                      <input
                        type="text"
                        placeholder="Search by name or role…"
                        value={profileSearch}
                        onChange={e => setProfileSearch(e.target.value)}
                        className="fld-input"
                        style={{ flex: 1, height: 30, fontSize: 12 }}
                      />
                      <button onClick={toggleAll}
                        style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'white', cursor: 'pointer', color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>
                        {allFilteredSelected ? 'Deselect all' : 'Select all'}
                      </button>
                      {selectedUsers.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'oklch(0.94 0.06 260)', color: 'oklch(0.36 0.18 260)', whiteSpace: 'nowrap' }}>
                          {selectedUsers.length} selected
                        </span>
                      )}
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                      {filteredProfiles.length === 0 && (
                        <div style={{ padding: '18px', textAlign: 'center', fontSize: 12, color: 'var(--ink-5)' }}>No matches</div>
                      )}
                      {filteredProfiles.map((p, i) => {
                        const checked = selectedUsers.includes(p.id);
                        return (
                          <label key={p.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 14px',
                              borderBottom: i < filteredProfiles.length - 1 ? '1px solid var(--line-2)' : 'none',
                              cursor: 'pointer',
                              background: checked ? 'oklch(0.97 0.03 260)' : 'white',
                              transition: 'background 0.1s',
                            }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUser(p.id)}
                              style={{ width: 15, height: 15, accentColor: 'oklch(0.48 0.22 260)', cursor: 'pointer', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: 'var(--ink)' }}>{p.name}</div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                              {p.role}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Fixed footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', flexShrink: 0, display: 'flex', gap: 8, background: 'white' }}>
              <button
                onClick={handleSend}
                disabled={saving || !canSend}
                style={{
                  flex: 1, padding: '11px 20px', borderRadius: 10, border: 'none',
                  background: isMeeting
                    ? 'linear-gradient(135deg, oklch(0.48 0.22 260), oklch(0.44 0.24 280))'
                    : 'linear-gradient(135deg, oklch(0.48 0.22 25), oklch(0.44 0.24 10))',
                  color: 'white', fontWeight: 700, fontSize: 13,
                  cursor: saving || !canSend ? 'not-allowed' : 'pointer',
                  opacity: saving || !canSend ? 0.55 : 1,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.14)',
                }}>
                {saving ? 'Sending…' : targetMode === 'all'
                  ? `Send ${isMeeting ? 'Meeting Alert' : 'Announcement'} to Everyone`
                  : `Send to ${selectedUsers.length} Person${selectedUsers.length !== 1 ? 's' : ''}`}
              </button>
              <button className="btn btn-sec" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
