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
};

const EMPTY = { type: 'meeting' as const, title: '', message: '', meeting_link: '' };

export default function AnnouncementManager({ userName }: { userName: string }) {
  const supabase = useRef(createClient()).current;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Announcement | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchActive = useCallback(async () => {
    const { data } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'active_announcement')
      .maybeSingle();
    setActive(data?.value ? (data.value as Announcement) : null);
  }, [supabase]);

  useEffect(() => {
    if (open) fetchActive();
  }, [open, fetchActive]);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    setSaving(true);
    const payload: Announcement = {
      type: form.type,
      title: form.title.trim(),
      message: form.message.trim(),
      ...(form.type === 'meeting' && form.meeting_link.trim() ? { meeting_link: form.meeting_link.trim() } : {}),
      created_at: new Date().toISOString(),
      created_by_name: userName,
    };
    await supabase.from('global_settings').upsert({ key: 'active_announcement', value: payload });
    setActive(payload);
    setForm(EMPTY);
    setSaving(false);
  };

  const handleClear = async () => {
    await supabase.from('global_settings').delete().eq('key', 'active_announcement');
    setActive(null);
  };

  const isMeeting = form.type === 'meeting';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Announcements & Meetings"
        style={{
          position: 'relative',
          width: 36, height: 36, borderRadius: '50%',
          border: active ? '2px solid oklch(0.68 0.18 25)' : '1.5px solid var(--line)',
          background: active ? 'oklch(0.95 0.05 25)' : 'white',
          cursor: 'pointer', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: active ? '0 0 0 3px oklch(0.88 0.10 25 / 0.45)' : 'none',
          transition: 'all 0.18s',
          flexShrink: 0,
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
          <div className="md" style={{ width: 540, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>Announcements & Meetings</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>
                Send an urgent message or meeting alert to all staff — they will see it as a popup immediately.
              </div>
            </div>

            <div style={{ padding: '20px 26px 26px' }}>
              {active ? (
                <div style={{
                  marginBottom: 24, padding: '16px 18px', borderRadius: 12,
                  background: active.type === 'meeting' ? 'oklch(0.96 0.04 260)' : 'oklch(0.96 0.04 25)',
                  border: `1.5px solid ${active.type === 'meeting' ? 'oklch(0.84 0.09 260)' : 'oklch(0.84 0.09 25)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>
                      {active.type === 'meeting' ? '📹' : '📢'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                        color: active.type === 'meeting' ? 'oklch(0.38 0.20 260)' : 'oklch(0.38 0.22 25)',
                        marginBottom: 3,
                      }}>
                        LIVE · {active.type === 'meeting' ? 'MEETING ALERT' : 'ANNOUNCEMENT'}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                        {active.title}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{active.message}</div>
                      {active.meeting_link && (
                        <a href={active.meeting_link} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: 'oklch(0.40 0.20 260)', fontWeight: 600, wordBreak: 'break-all' }}>
                          {active.meeting_link}
                        </a>
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
                  marginBottom: 24, padding: '12px 16px', borderRadius: 10,
                  background: 'var(--surface-2)', border: '1px dashed var(--line)',
                  fontSize: 13, color: 'var(--ink-5)', textAlign: 'center',
                }}>
                  No active announcement — all staff see normal view.
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--ink-4)', marginBottom: 14 }}>
                {active ? 'REPLACE WITH NEW' : 'NEW ANNOUNCEMENT'}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
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

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={handleSend}
                  disabled={saving || !form.title.trim() || !form.message.trim()}
                  style={{
                    flex: 1, padding: '11px 20px', borderRadius: 10, border: 'none',
                    background: isMeeting
                      ? 'linear-gradient(135deg, oklch(0.48 0.22 260), oklch(0.44 0.24 280))'
                      : 'linear-gradient(135deg, oklch(0.48 0.22 25), oklch(0.44 0.24 10))',
                    color: 'white', fontWeight: 700, fontSize: 13,
                    cursor: saving || !form.title.trim() || !form.message.trim() ? 'not-allowed' : 'pointer',
                    opacity: saving || !form.title.trim() || !form.message.trim() ? 0.6 : 1,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.14)',
                  }}>
                  {saving ? 'Sending…' : `Send ${isMeeting ? 'Meeting Alert' : 'Announcement'} to All`}
                </button>
                <button className="btn btn-sec" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
