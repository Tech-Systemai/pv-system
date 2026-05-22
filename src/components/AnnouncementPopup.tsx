'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

type Announcement = {
  type: 'meeting' | 'announcement';
  title: string;
  message: string;
  meeting_link?: string;
  created_at: string;
  created_by_name?: string;
};

const ACK_KEY = (ts: string) => `pv_ann_ack_${ts}`;

export default function AnnouncementPopup() {
  const supabase = useRef(createClient()).current;
  const [ann, setAnn] = useState<Announcement | null>(null);

  const apply = (val: unknown) => {
    if (!val) { setAnn(null); return; }
    const a = val as Announcement;
    if (localStorage.getItem(ACK_KEY(a.created_at))) return;
    setAnn(a);
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const fetch = async () => {
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'active_announcement')
        .maybeSingle();
      apply(data?.value ?? null);
    };

    fetch();
    timer = setInterval(fetch, 30_000);

    const ch = supabase
      .channel('ann-popup')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, payload => {
        const row = payload.new as any;
        if (row?.key === 'active_announcement') apply(row.value ?? null);
        if ((payload as any).old?.key === 'active_announcement' && payload.eventType === 'DELETE') setAnn(null);
      })
      .subscribe();

    return () => { clearInterval(timer); supabase.removeChannel(ch); };
  }, [supabase]);

  const dismiss = () => {
    if (ann) localStorage.setItem(ACK_KEY(ann.created_at), '1');
    setAnn(null);
  };

  const join = () => {
    if (ann?.meeting_link) window.open(ann.meeting_link, '_blank', 'noopener');
    dismiss();
  };

  if (!ann) return null;
  const isMeeting = ann.type === 'meeting';

  return (
    <>
      <style>{`
        @keyframes ann-in {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(8, 10, 20, 0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
        padding: 16,
      }}>
        <div style={{
          background: 'white', borderRadius: 20, width: 480, maxWidth: '100%',
          boxShadow: '0 32px 80px rgba(0,0,0,0.32)',
          overflow: 'hidden',
          animation: 'ann-in 0.30s cubic-bezier(0.34, 1.4, 0.64, 1)',
        }}>
          <div style={{
            height: 5,
            background: isMeeting
              ? 'linear-gradient(90deg, oklch(0.48 0.22 260), oklch(0.44 0.24 280))'
              : 'linear-gradient(90deg, oklch(0.50 0.22 25), oklch(0.46 0.24 10))',
          }} />

          <div style={{ padding: '28px 28px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{
              width: 54, height: 54, borderRadius: 14, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26,
              background: isMeeting ? 'oklch(0.93 0.07 260)' : 'oklch(0.93 0.07 25)',
            }}>
              {isMeeting ? '📹' : '📢'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
                color: isMeeting ? 'oklch(0.38 0.20 260)' : 'oklch(0.40 0.22 25)',
                marginBottom: 5,
              }}>
                {isMeeting ? 'URGENT MEETING' : 'ANNOUNCEMENT'}
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.25 }}>
                {ann.title}
              </div>
              {ann.created_by_name && (
                <div style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 4 }}>
                  From {ann.created_by_name}
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '0 28px 28px' }}>
            <div style={{
              fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.75,
              padding: '14px 16px',
              background: isMeeting ? 'oklch(0.98 0.02 260)' : 'oklch(0.98 0.02 25)',
              borderRadius: 10,
              borderLeft: `3px solid ${isMeeting ? 'oklch(0.72 0.14 260)' : 'oklch(0.72 0.16 25)'}`,
              marginBottom: 22,
              whiteSpace: 'pre-wrap',
            }}>
              {ann.message}
            </div>

            {isMeeting ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={join} style={{
                  flex: 1, padding: '13px 20px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, oklch(0.48 0.22 260), oklch(0.44 0.24 280))',
                  color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 4px 20px oklch(0.48 0.22 260 / 0.42)',
                  letterSpacing: '0.01em',
                }}>
                  📹 Join Meeting
                </button>
                <button onClick={dismiss} style={{
                  padding: '13px 18px', borderRadius: 10,
                  border: '1.5px solid var(--line)', background: 'white',
                  color: 'var(--ink-4)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}>
                  Dismiss
                </button>
              </div>
            ) : (
              <button onClick={dismiss} style={{
                width: '100%', padding: '13px 20px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, oklch(0.48 0.22 25), oklch(0.44 0.24 10))',
                color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                boxShadow: '0 4px 20px oklch(0.48 0.22 25 / 0.42)',
              }}>
                ✓ Acknowledge
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
