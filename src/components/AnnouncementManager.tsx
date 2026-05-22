'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/utils/supabase/client';
import {
  saveAnnouncement,
  clearAnnouncement,
  getAcknowledgments,
} from '@/app/actions/announcements';

type Announcement = {
  type: 'meeting' | 'announcement';
  title: string;
  message: string;
  meeting_link?: string;
  created_at: string;
  created_by_name?: string;
  target_user_ids: string[] | null;
};

type Profile = { id: string; name: string; role: string };

type AckRecord = {
  user_id: string;
  action: 'acknowledged' | 'joined';
  responded_at: string;
  profiles: { name: string } | null;
};

const EMPTY = { type: 'meeting' as 'meeting' | 'announcement', title: '', message: '', meeting_link: '' };

export default function AnnouncementManager({ userName, initialProfiles }: { userName: string; initialProfiles: Profile[] }) {
  const supabase = useRef(createClient()).current;
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Announcement | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>(initialProfiles);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [targetMode, setTargetMode] = useState<'all' | 'specific'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [profileSearch, setProfileSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [acks, setAcks] = useState<AckRecord[]>([]);
  const [acksLoading, setAcksLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchAcks = useCallback(async (ts: string) => {
    setAcksLoading(true);
    try {
      const data = await getAcknowledgments(ts);
      setAcks(data);
    } catch { /* ignore */ }
    setAcksLoading(false);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const { data: setting } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'active_announcement')
        .maybeSingle();
      const ann = setting?.value ? (setting.value as Announcement) : null;
      setActive(ann);
      if (ann) fetchAcks(ann.created_at);
    } catch (e: any) {
      setSaveError(e?.message ?? 'Failed to load data');
    }
  }, [supabase, fetchAcks]);

  useEffect(() => {
    if (open) {
      fetchData();
      setForm(EMPTY);
      setTargetMode('all');
      setSelectedUsers([]);
      setProfileSearch('');
      setSaveError(null);
    } else {
      setAcks([]);
    }
  }, [open, fetchData]);

  // Live ack updates while modal is open
  useEffect(() => {
    if (!open || !active) return;
    const ch = supabase
      .channel('ann-acks-mgr')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_acknowledgments' }, (payload) => {
        const row = payload.new as any;
        if (row.announcement_ts === active.created_at) fetchAcks(active.created_at);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcement_acknowledgments' }, (payload) => {
        const row = payload.new as any;
        if (row.announcement_ts === active.created_at) fetchAcks(active.created_at);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, active?.created_at, supabase, fetchAcks]);

  const toggleUser = (id: string) =>
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const matchesSearch = (p: Profile) =>
    !profileSearch || p.name?.toLowerCase().includes(profileSearch.toLowerCase()) || p.role?.toLowerCase().includes(profileSearch.toLowerCase());

  const filteredProfiles = allProfiles.filter(matchesSearch);
  const allFilteredSelected = filteredProfiles.length > 0 && filteredProfiles.every(p => selectedUsers.includes(p.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedUsers(prev => prev.filter(id => !filteredProfiles.some(p => p.id === id)));
    } else {
      const newIds = filteredProfiles.map(p => p.id).filter(id => !selectedUsers.includes(id));
      setSelectedUsers(prev => [...prev, ...newIds]);
    }
  };

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    if (targetMode === 'specific' && selectedUsers.length === 0) return;
    setSaving(true);
    setSaveError(null);
    const payload: Announcement = {
      type: form.type,
      title: form.title.trim(),
      message: form.message.trim(),
      ...(form.type === 'meeting' && form.meeting_link.trim() ? { meeting_link: form.meeting_link.trim() } : {}),
      created_at: new Date().toISOString(),
      created_by_name: userName,
      target_user_ids: targetMode === 'specific' ? selectedUsers : null,
    };
    try {
      await saveAnnouncement(payload);
      setActive(payload);
      setAcks([]);
      setForm(EMPTY);
      setTargetMode('all');
      setSelectedUsers([]);
    } catch (e: any) {
      setSaveError(e?.message ?? 'Failed to send announcement');
    }
    setSaving(false);
  };

  const handleClear = async () => {
    try {
      await clearAnnouncement();
      setActive(null);
      setAcks([]);
    } catch (e: any) {
      setSaveError(e?.message ?? 'Failed to clear announcement');
    }
  };

  const isMeeting = form.type === 'meeting';
  const canSend = form.title.trim() && form.message.trim() && (targetMode === 'all' || selectedUsers.length > 0);

  // Ack tracking derived data
  const ackedIds = new Set(acks.map(a => a.user_id));
  const targetedProfiles = active?.target_user_ids
    ? allProfiles.filter(p => active.target_user_ids!.includes(p.id))
    : allProfiles;
  const pendingProfiles = targetedProfiles.filter(p => !ackedIds.has(p.id));
  const joinCount = acks.filter(a => a.action === 'joined').length;

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

      {mounted && open && createPortal(
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'oklch(0.20 0.02 265 / 0.50)',
            backdropFilter: 'blur(6px)',
            overflowY: 'auto',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '32px 20px',
          }}>
          <div style={{
            width: 580, maxWidth: '100%',
            margin: '0 auto',
            background: 'white', borderRadius: 14,
            boxShadow: 'var(--sh-pop)', border: '1px solid var(--line)',
            display: 'flex', flexDirection: 'column',
            flexShrink: 0,
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>Announcements & Meetings</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>
                Send a live pop-up to all staff or specific people — requires acknowledgment.
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 24px' }}>

              {/* Active announcement */}
              {active ? (
                <div style={{
                  marginBottom: 12, padding: '12px 14px', borderRadius: 10,
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
                  No active announcement — staff see normal view.
                </div>
              )}

              {/* Acknowledgment tracker */}
              {active && (
                <div style={{
                  marginBottom: 16, padding: '12px 14px', borderRadius: 10,
                  background: 'var(--surface-2)', border: '1px solid var(--line)',
                }}>
                  {/* Summary row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: acksLoading || acks.length > 0 || pendingProfiles.length > 0 ? 10 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)', flex: 1 }}>
                      RESPONSES
                    </div>
                    {acksLoading ? (
                      <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>Loading…</span>
                    ) : (
                      <>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                          background: acks.length > 0 ? 'oklch(0.92 0.08 155)' : 'white',
                          color: acks.length > 0 ? 'oklch(0.36 0.14 155)' : 'var(--ink-5)',
                          border: '1px solid var(--line)',
                        }}>
                          {acks.length} / {targetedProfiles.length} responded
                        </span>
                        {active.type === 'meeting' && joinCount > 0 && (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                            background: 'oklch(0.92 0.08 260)', color: 'oklch(0.36 0.18 260)',
                            border: '1px solid oklch(0.84 0.09 260)',
                          }}>
                            {joinCount} joined
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Responded list */}
                  {acks.length > 0 && (
                    <div style={{ marginBottom: pendingProfiles.length > 0 ? 8 : 0 }}>
                      {acks.map(ack => (
                        <div key={ack.user_id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 8px', borderRadius: 7, marginBottom: 3,
                          background: ack.action === 'joined' ? 'oklch(0.95 0.04 260)' : 'oklch(0.96 0.05 155)',
                        }}>
                          <span style={{ fontSize: 13 }}>{ack.action === 'joined' ? '📹' : '✓'}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>
                            {(ack.profiles as any)?.name ?? 'Unknown'}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
                            background: 'white', border: '1px solid var(--line)',
                            color: ack.action === 'joined' ? 'oklch(0.36 0.18 260)' : 'oklch(0.36 0.14 155)',
                          }}>
                            {ack.action === 'joined' ? 'Joined' : 'Acknowledged'}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--mono)' }}>
                            {new Date(ack.responded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pending list */}
                  {!acksLoading && pendingProfiles.length > 0 && (
                    <div style={{
                      padding: '8px 10px', borderRadius: 8,
                      background: 'white', border: '1px dashed var(--line)',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-5)', marginBottom: 6, letterSpacing: '0.06em' }}>
                        PENDING ({pendingProfiles.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {pendingProfiles.map(p => (
                          <span key={p.id} style={{
                            fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                            background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--ink-3)',
                          }}>
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!acksLoading && acks.length === 0 && targetedProfiles.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--ink-5)', textAlign: 'center', padding: '4px 0' }}>
                      Loading recipients…
                    </div>
                  )}
                </div>
              )}

              {/* New announcement form */}
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)', marginBottom: 10 }}>
                {active ? 'REPLACE WITH NEW' : 'NEW ANNOUNCEMENT'}
              </div>

              {/* Type selector */}
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
                    ? 'e.g. All staff please join immediately.'
                    : 'e.g. Please review the updated attendance policy.'}
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
                      {profilesLoading ? (
                        <div style={{ padding: '18px', textAlign: 'center', fontSize: 12, color: 'var(--ink-5)' }}>
                          Loading staff…
                        </div>
                      ) : filteredProfiles.length === 0 ? (
                        <div style={{ padding: '18px', textAlign: 'center', fontSize: 12, color: 'var(--ink-5)' }}>
                          {profileSearch ? 'No matches' : 'No staff found'}
                        </div>
                      ) : filteredProfiles.map((p, i) => {
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

              {saveError && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 8,
                  background: 'oklch(0.96 0.04 25)', border: '1px solid oklch(0.84 0.09 25)',
                  fontSize: 12, color: 'oklch(0.40 0.20 25)', fontWeight: 500,
                }}>
                  ⚠ Failed to send: {saveError}
                </div>
              )}

            </div>

            {/* Footer */}
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
        </div>,
        document.body
      )}
    </>
  );
}
